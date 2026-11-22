const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const prisma = require('../../lib/prisma');
const requireAuth = require('../../middleware/auth');
const { sendError } = require('../../lib/http');
const { notify, notifyAdmins, notifyMerchantLowStock } = require('../../lib/notify');
const { toOrder } = require('../../lib/client-adapter');
const { expireUnpaidOrders } = require('../../lib/orderExpiry');

const MAX_QTY_PER_ITEM = 100;
const MAX_DELIVERY_CODE_ATTEMPTS = 5;

const { releaseEscrowForStoreOrder } = require('../../lib/escrow');

const storeOrderFull = {
  store: { select: { name: true, subdomain: true } },
  items: { include: { product: { select: { name: true, images: true } } } }
};

// ===================================================================
// POST /api/orders — le client passe commande (panier multi-boutiques)
// ===================================================================
router.post('/', requireAuth, async (req, res) => {
  try {
    // Accepte deux formats de body :
    //  - Frontend client : { address, city, country, phone, shopId, items:[{productId, quantity}] }
    //  - Native backend  : { delivery_address, delivery_city, delivery_country, delivery_phone, items:[{product_id, quantity}] }
    const b = req.body || {};
    const delivery_address = b.delivery_address || b.address;
    const delivery_city = b.delivery_city || b.city;
    const delivery_country = b.delivery_country || b.country;
    const delivery_phone = b.delivery_phone || b.phone;

    if (!delivery_address || !Array.isArray(b.items) || b.items.length === 0) {
      return sendError(res, 400, 'Adresse de livraison et articles requis');
    }

    // Validation stricte des quantités : sans elle, une quantité négative
    // produirait un total négatif ET augmenterait le stock.
    // Les lignes du même produit sont fusionnées.
    const merged = new Map();
    for (const i of b.items) {
      const productId = Number(i.product_id ?? i.productId);
      const quantity = Number(i.quantity);
      if (!Number.isInteger(productId) || productId <= 0) {
        return sendError(res, 400, 'Identifiant de produit invalide');
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_ITEM) {
        return sendError(res, 400, `Quantité invalide (entier entre 1 et ${MAX_QTY_PER_ITEM})`);
      }
      merged.set(productId, (merged.get(productId) || 0) + quantity);
    }
    const items = [...merged].map(([product_id, quantity]) => ({ product_id, quantity }));

    // Libère d'abord le stock des commandes abandonnées : sans ça, le dernier
    // exemplaire d'un produit reste bloqué par un panier jamais payé.
    await expireUnpaidOrders().catch((e) => console.error('Expiration des commandes:', e));

    const result = await prisma.$transaction(async (tx) => {
      const productIds = items.map(i => i.product_id);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        include: { store: true }
      });

      if (products.length !== productIds.length) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      // Un produit non publié ne se commande pas, et une boutique dont
      // l'abonnement a expiré (ou suspendue par l'admin) ne reçoit plus de
      // commandes, même si le client avait la page ouverte dans un onglet.
      const now = new Date();
      for (const p of products) {
        if (!p.isPublished) throw new Error(`PRODUCT_UNAVAILABLE:${p.name}`);
        if (!p.store.subscriptionExpiresAt || p.store.subscriptionExpiresAt <= now || p.store.isSuspended) {
          throw new Error(`STORE_INACTIVE:${p.store.name}`);
        }
      }

      // Prix réellement facturé = prix affiché au client (promo si elle existe).
      // Avant, le prix plein était toujours facturé même quand la promo était affichée.
      const unitPriceOf = (p) => (p.promoPrice !== null && p.promoPrice !== undefined ? p.promoPrice : p.price);

      const groupedByStore = {};
      for (const item of items) {
        const product = products.find(p => p.id === item.product_id);
        if (!groupedByStore[product.storeId]) groupedByStore[product.storeId] = [];
        groupedByStore[product.storeId].push({ product, quantity: item.quantity });
      }

      // Frais de livraison : un forfait par boutique concernée (exactement ce
      // qu'affiche le panier côté client : sous-total + frais de chaque boutique).
      // Avant, l'API ne facturait que les articles : le client payait moins que
      // le total affiché et le marchand n'était jamais payé pour la livraison.
      const shippingByStore = {};
      for (const p of products) shippingByStore[p.storeId] = Number(p.store.shippingFee || 0);

      let totalAmount = 0;
      for (const [storeId, storeItems] of Object.entries(groupedByStore)) {
        totalAmount += shippingByStore[storeId];
        for (const { product, quantity } of storeItems) {
          totalAmount += Number(unitPriceOf(product)) * quantity;
        }
      }

      const order = await tx.order.create({
        data: {
          clientId: req.user.id,
          totalAmount,
          deliveryAddress: delivery_address,
          deliveryCity: delivery_city || null,
          deliveryCountry: delivery_country || null,
          deliveryPhone: delivery_phone || null
        }
      });

      for (const [storeId, storeItems] of Object.entries(groupedByStore)) {
        const shippingFee = shippingByStore[storeId];
        const itemsTotal = storeItems.reduce((sum, { product, quantity }) => sum + Number(unitPriceOf(product)) * quantity, 0);

        // subtotal = articles + livraison : c'est le montant versé au marchand
        // (ou remboursé au client en cas de litige), la somme des subtotals
        // vaut donc toujours Order.totalAmount.
        const storeOrder = await tx.storeOrder.create({
          data: { orderId: order.id, storeId: Number(storeId), subtotal: itemsTotal + shippingFee, shippingFee }
        });

        for (const { product, quantity } of storeItems) {
          // Décrément ATOMIQUE conditionnel : le stock est vérifié et
          // décrémenté dans la même requête SQL. L'ancienne version lisait le
          // stock puis le décrémentait séparément : deux clients simultanés
          // pouvaient acheter la dernière pièce et laisser un stock négatif.
          const { count } = await tx.product.updateMany({
            where: { id: product.id, stock: { gte: quantity } },
            data: { stock: { decrement: quantity } }
          });
          if (count !== 1) throw new Error(`STOCK_INSUFFICIENT:${product.name}`);

          await tx.orderItem.create({
            data: { storeOrderId: storeOrder.id, productId: product.id, quantity, unitPrice: unitPriceOf(product) }
          });
        }
      }

      return tx.order.findUnique({
        where: { id: order.id },
        include: {
          storeOrders: {
            include: {
              store: { select: { name: true, subdomain: true } },
              items: { include: { product: { select: { name: true, images: true } } } }
            }
          }
        }
      });
    });

    // Notifie chaque marchand concerné qu'une nouvelle commande est arrivée.
    // Fait après la transaction, en "best effort".
    const storeIds = result.storeOrders.map(so => so.storeId);
    const stores = await prisma.store.findMany({
      where: { id: { in: storeIds } },
      select: { id: true, merchantId: true, name: true }
    });
    for (const so of result.storeOrders) {
      const store = stores.find(s => s.id === so.storeId);
      if (!store) continue;
      await notify(store.merchantId, {
        type: 'nouvelle_commande',
        title: 'Nouvelle commande reçue',
        body: `Une nouvelle commande de ${Number(so.subtotal).toLocaleString('fr-FR')} FCFA vient d'être passée sur \"${store.name}\".`,
        link: `/commandes/${so.id}`
      });
    }

    // Alerte "stock bas" par e-mail au marchand — déclenchée
    // UNE SEULE FOIS par produit, au moment précis où le stock
    // passe sous le seuil (stock d'avant = stock actuel + quantité
    // commandée ; on ne re-alerte donc pas tant que le stock reste
    // sous le seuil, uniquement au franchissement). Best effort.
    const LOW_STOCK_THRESHOLD = 5;
    try {
      const qtyByProduct = new Map();
      for (const it of items) qtyByProduct.set(it.product_id, it.quantity);
      const productsToCheck = await prisma.product.findMany({
        where: { id: { in: [...qtyByProduct.keys()] } },
        include: { store: { select: { merchantId: true, name: true } } }
      });
      for (const p of productsToCheck) {
        const ordered = qtyByProduct.get(p.id) || 0;
        const stockBefore = p.stock + ordered;
        if (p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD && stockBefore > LOW_STOCK_THRESHOLD) {
          await notifyMerchantLowStock({
            merchantId: p.store.merchantId,
            storeName: p.store.name,
            productName: p.name,
            stock: p.stock
          });
        }
      }
    } catch (stockErr) {
      console.error('Alerte stock bas (e-mail):', stockErr.message);
    }

    res.status(201).json(result);
  } catch (err) {
    const msg = err && err.message ? err.message : '';
    if (msg === 'PRODUCT_NOT_FOUND') {
      return sendError(res, 400, 'Un ou plusieurs produits sont introuvables');
    }
    if (msg.startsWith('PRODUCT_UNAVAILABLE')) {
      return sendError(res, 400, `Le produit \"${msg.split(':')[1]}\" n'est plus disponible`);
    }
    if (msg.startsWith('STORE_INACTIVE')) {
      return sendError(res, 400, `La boutique \"${msg.split(':')[1]}\" est temporairement indisponible`);
    }
    if (msg.startsWith('STOCK_INSUFFICIENT')) {
      return sendError(res, 400, `Stock insuffisant pour : ${msg.split(':')[1]}`);
    }
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// GET /api/orders/my — historique du client connecté
router.get('/my', requireAuth, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { clientId: req.user.id },
      include: {
        storeOrders: {
          include: {
            store: { select: { name: true, subdomain: true } },
            items: { include: { product: { select: { name: true, images: true } } } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// GET /api/orders — les commandes du client connecté (format frontend) OU
// les sous-commandes du marchand connecté
router.get('/', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'client') {
      const orders = await prisma.order.findMany({
        where: { clientId: req.user.id },
        include: {
          storeOrders: {
            include: {
              items: { include: { product: { select: { name: true, images: true } } } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.json(orders.map(o => toOrder(o, o.storeOrders)));
    }

    const store = await prisma.store.findUnique({ where: { merchantId: req.user.id } });
    if (!store) return sendError(res, 404, 'Aucune boutique associée à ce compte');

    const storeOrders = await prisma.storeOrder.findMany({
      where: { storeId: store.id },
      include: {
        order: { include: { client: { select: { fullName: true, phone: true } } } },
        items: { include: { product: { select: { name: true, images: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(storeOrders);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// GET /api/orders/:id — détail d'une commande (client, format frontend)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        storeOrders: {
          include: {
            store: { select: { name: true, subdomain: true } },
            items: { include: { product: { select: { name: true, images: true } } } }
          }
        }
      }
    });
    if (!order) return sendError(res, 404, 'Commande introuvable');
    if (order.clientId !== req.user.id) return sendError(res, 403, 'Cette commande ne vous appartient pas');
    res.json(toOrder(order, order.storeOrders));
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// PATCH /api/orders/:id/ship — le marchand marque comme expédiée, génère le code
router.patch('/:id/ship', requireAuth, async (req, res) => {
  try {
    const store = await prisma.store.findUnique({ where: { merchantId: req.user.id } });
    const storeOrder = await prisma.storeOrder.findFirst({
      where: { id: Number(req.params.id), storeId: store?.id },
      include: { order: true }
    });
    if (!storeOrder) return sendError(res, 404, 'Commande introuvable');
    if (storeOrder.order.paymentStatus !== 'payee') {
      return sendError(res, 400, "Cette commande n'a pas encore été payée par le client");
    }
    if (storeOrder.status !== 'en_attente' && storeOrder.status !== 'confirmee') {
      return sendError(res, 400, 'Cette commande ne peut pas être expédiée dans son état actuel');
    }

    const deliveryCode = crypto.randomInt(100000, 999999).toString();
    const updated = await prisma.storeOrder.update({
      where: { id: storeOrder.id },
      data: { status: 'expediee', deliveryCode, shippedAt: new Date() }
    });

    await notify(storeOrder.order.clientId, {
      type: 'commande_expediee',
      title: 'Votre commande a été expédiée',
      body: `Votre commande #${storeOrder.id} est en route. Le livreur pourra vous demander un code de confirmation à la remise.`,
      link: `/mes-commandes`
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// POST /api/orders/:id/confirm — le client confirme lui-même (\"bouton\")
router.post('/:id/confirm', requireAuth, async (req, res) => {
  try {
    const storeOrder = await prisma.storeOrder.findUnique({
      where: { id: Number(req.params.id) },
      include: { order: true, store: { select: { merchantId: true, name: true } } }
    });
    if (!storeOrder) return sendError(res, 404, 'Commande introuvable');
    if (storeOrder.order.clientId !== req.user.id) {
      return sendError(res, 403, "Cette commande ne vous appartient pas");
    }
    if (storeOrder.status !== 'expediee') {
      return sendError(res, 400, "Cette commande n'est pas encore expédiée");
    }
    const released = await releaseEscrowForStoreOrder(storeOrder.id);
    if (!released) return sendError(res, 409, 'Cette commande vient déjà d\'être traitée');

    await notify(storeOrder.store.merchantId, {
      type: 'reception_confirmee',
      title: 'Réception confirmée par le client',
      body: `Le client a confirmé avoir reçu sa commande sur \"${storeOrder.store.name}\". Le versement sera déclenché par l'équipe Shopika.`,
      link: `/commandes/${storeOrder.id}`
    });

    // L'admin doit être alerté dès que l'escrow est libéré, pour aller
    // cliquer sur \"verser le marchand\" dans son espace.
    await notifyAdmins({
      type: 'versement_a_faire',
      title: 'Versement marchand à déclencher',
      body: `Le client a confirmé la réception de sa commande #${storeOrder.id} sur \"${storeOrder.store.name}\". Les fonds peuvent être débloqués vers le marchand.`,
      link: `/payouts`
    });

    const fresh = await prisma.storeOrder.findUnique({ where: { id: storeOrder.id }, include: storeOrderFull });
    res.json(toOrder(storeOrder.order, [fresh]));
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Erreur serveur');
  }
});

// POST /api/orders/:id/confirm-reception — alias frontend pour /:id/confirm
// Fonctionne avec un Order ID (pas StoreOrder ID) : libère l'escrow de
// TOUTES les sous-commandes expédiées de cette commande. Une sous-commande
// non expédiée n'est jamais libérée (avant, \"confirmee\" l'était aussi : un
// client pouvait débloquer les fonds d'un colis jamais envoyé).
router.post('/:id/confirm-reception', requireAuth, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      include: { storeOrders: { include: { store: { select: { merchantId: true, name: true } } } } }
    });
    if (!order) return sendError(res, 404, 'Commande introuvable');
    if (order.clientId !== req.user.id) return sendError(res, 403, "Cette commande ne vous appartient pas");

    const shipped = order.storeOrders.filter(so => so.status === 'expediee');
    if (shipped.length === 0) return sendError(res, 400, "Cette commande n'est pas encore expédiée");

    const releasedOrders = [];
    for (const so of shipped) {
      if (await releaseEscrowForStoreOrder(so.id)) releasedOrders.push(so);
    }
    if (releasedOrders.length === 0) return sendError(res, 409, 'Cette commande vient déjà d\'être traitée');

    for (const so of releasedOrders) {
      await notify(so.store.merchantId, {
        type: 'reception_confirmee',
        title: 'Réception confirmée par le client',
        body: `Le client a confirmé avoir reçu sa commande sur \"${so.store.name}\". Le versement sera déclenché par l'équipe Shopika.`,
        link: `/commandes/${so.id}`
      });
    }

    await notifyAdmins({
      type: 'versement_a_faire',
      title: 'Versement marchand à déclencher',
      body: `Le client a confirmé la réception de sa commande #${order.id}. Les fonds peuvent être débloqués vers le(s) marchand(s).`,
      link: `/payouts`
    });

    const refreshed = await prisma.order.findUnique({
      where: { id: order.id },
      include: { storeOrders: { include: storeOrderFull } }
    });

    res.json(toOrder(refreshed, refreshed.storeOrders));
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Erreur serveur');
  }
});

// POST /api/orders/:id/confirm-with-code — le livreur saisit le code de
// livraison. Le code (6 chiffres) est comparé en temps constant et les
// essais ratés sont comptés : après 5 échecs la confirmation par code est
// verrouillée (le client garde le bouton \"j'ai reçu ma commande\").
router.post('/:id/confirm-with-code', requireAuth, async (req, res) => {
  try {
    const { delivery_code } = req.body || {};
    const storeOrder = await prisma.storeOrder.findUnique({
      where: { id: Number(req.params.id) },
      include: { store: { select: { merchantId: true, name: true } } }
    });
    if (!storeOrder) return sendError(res, 404, 'Commande introuvable');
    if (storeOrder.status !== 'expediee') {
      return sendError(res, 400, "Cette commande n'est pas encore expédiée");
    }
    if (storeOrder.deliveryCodeAttempts >= MAX_DELIVERY_CODE_ATTEMPTS) {
      return sendError(res, 423, 'Trop de tentatives : la confirmation par code est verrouillée pour cette commande');
    }

    const expected = Buffer.from(String(storeOrder.deliveryCode || ''));
    const given = Buffer.from(String(delivery_code || ''));
    const validCode = expected.length > 0 && expected.length === given.length && crypto.timingSafeEqual(expected, given);
    if (!validCode) {
      await prisma.storeOrder.update({
        where: { id: storeOrder.id },
        data: { deliveryCodeAttempts: { increment: 1 } }
      });
      return sendError(res, 401, 'Code de livraison invalide');
    }

    const released = await releaseEscrowForStoreOrder(storeOrder.id);
    if (!released) return sendError(res, 409, 'Cette commande vient déjà d\'être traitée');

    await notify(storeOrder.store.merchantId, {
      type: 'reception_confirmee',
      title: 'Livraison confirmée par le livreur',
      body: `La commande sur \"${storeOrder.store.name}\" a été confirmée livrée. Le versement sera déclenché par l'équipe Shopika.`,
      link: `/commandes/${storeOrder.id}`
    });

    await notifyAdmins({
      type: 'versement_a_faire',
      title: 'Versement marchand à déclencher',
      body: `Le livreur a confirmé la livraison de la commande #${storeOrder.id} sur \"${storeOrder.store.name}\". Les fonds peuvent être débloqués vers le marchand.`,
      link: `/payouts`
    });

    const updated = await prisma.storeOrder.findUnique({ where: { id: storeOrder.id } });
    res.json(updated);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// POST /api/orders/:id/dispute — le client signale un litige
// Fonctionne avec un Order ID. Seules les sous-commandes PAYÉES dont
// l'escrow est encore bloqué et qui ne sont pas déjà clôturées peuvent être
// mises en litige : avant, un litige pouvait être ouvert sur une commande
// déjà libérée, voire déjà versée au marchand, ou jamais payée.
router.post('/:id/dispute', requireAuth, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      include: { storeOrders: { include: { store: { select: { name: true } } } } }
    });
    if (!order) return sendError(res, 404, 'Commande introuvable');
    if (order.clientId !== req.user.id) return sendError(res, 403, "Cette commande ne vous appartient pas");
    if (order.paymentStatus !== 'payee') {
      return sendError(res, 400, "Cette commande n'a pas été payée : aucun litige possible");
    }

    const eligible = order.storeOrders.filter(
      so => so.escrowStatus === 'bloque' && ['en_attente', 'confirmee', 'expediee'].includes(so.status)
    );
    if (eligible.length === 0) {
      return sendError(res, 400, 'Aucune sous-commande de cette commande ne peut être mise en litige (déjà livrée, clôturée ou en litige)');
    }

    const updated = await prisma.storeOrder.updateMany({
      where: {
        id: { in: eligible.map(so => so.id) },
        escrowStatus: 'bloque',
        status: { in: ['en_attente', 'confirmee', 'expediee'] }
      },
      data: { status: 'litige' }
    });

    for (const so of eligible) {
      await notifyAdmins({
        type: 'litige',
        title: 'Nouveau litige signalé',
        body: `Un litige a été ouvert sur la commande #${order.id} (\"${so.store?.name}\").`,
        link: `/disputes`
      });
    }

    res.json({ ok: true, disputeCount: updated.count });
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

module.exports = router;
