const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { sendError } = require('../lib/http');
const { sendPayout } = require('../lib/fedapay');
const { notify } = require('../lib/notify');
const { isStoreActive } = require('../lib/subscription');
const { logAdminAction } = require('../lib/audit');

// Toutes les routes de ce fichier sont réservées à role=admin.
router.use(requireAuth, requireRole('admin'));

// Statuts de versement/remboursement qui restent à traiter. `en_cours` est
// listé pour que l'admin voie un envoi resté bloqué (à vérifier dans le
// dashboard FedaPay) — mais il ne peut pas être relancé depuis l'interface.
const TO_PROCESS = ['en_attente', 'echoue', 'en_cours'];
const RETRYABLE = ['en_attente', 'echoue'];

// ===================================================================
// GET /api/admin/overview — compteurs du tableau de bord
// ===================================================================
router.get('/overview', async (req, res) => {
  try {
    const [pendingPayouts, pendingRefunds, openDisputes, openSupport, totalStores, suspendedStores, totalOrders] = await Promise.all([
      prisma.storeOrder.count({ where: { escrowStatus: 'libere', payoutStatus: { in: TO_PROCESS } } }),
      prisma.storeOrder.count({ where: { escrowStatus: 'rembourse', refundStatus: { in: TO_PROCESS } } }),
      prisma.storeOrder.count({ where: { status: 'litige' } }),
      prisma.supportMessage.count({ where: { status: 'ouvert' } }),
      prisma.store.count(),
      prisma.store.count({ where: { isSuspended: true } }),
      prisma.order.count()
    ]);
    res.json({ pendingPayouts, pendingRefunds, openDisputes, openSupport, totalStores, suspendedStores, totalOrders });
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// ===================================================================
// GET /api/admin/payouts/pending
// Sous-commandes dont l'escrow a été libéré mais dont le marchand n'a pas
// encore été payé (ou dont le dernier versement a échoué : relançable).
// ===================================================================
router.get('/payouts/pending', async (req, res) => {
  try {
    const storeOrders = await prisma.storeOrder.findMany({
      where: { escrowStatus: 'libere', payoutStatus: { in: TO_PROCESS } },
      include: {
        store: { select: { id: true, name: true, subdomain: true, payoutPhone: true, payoutCountry: true, merchant: { select: { fullName: true, phone: true } } } },
        order: { select: { id: true, createdAt: true } }
      },
      orderBy: { confirmedAt: 'asc' }
    });
    res.json(storeOrders);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// ===================================================================
// POST /api/admin/payouts/:storeOrderId — déclenche le versement réel
//
// Protection contre le double versement : la sous-commande est d'abord
// "réservée" par un UPDATE conditionnel (en_attente/echoue -> en_cours).
// Deux clics simultanés ou deux admins ne peuvent donc jamais appeler
// FedaPay deux fois. Si FedaPay refuse, le statut passe à `echoue` (relançable) ;
// si l'appel réussit mais que l'écriture finale échoue, le statut reste
// `en_cours` : on préfère un blocage visible à un double paiement.
// ===================================================================
router.post('/payouts/:storeOrderId', async (req, res) => {
  const id = Number(req.params.storeOrderId);
  try {
    const storeOrder = await prisma.storeOrder.findUnique({
      where: { id },
      include: { store: { include: { merchant: true } } }
    });
    if (!storeOrder) return sendError(res, 404, 'Sous-commande introuvable');
    if (storeOrder.escrowStatus !== 'libere') {
      return sendError(res, 400, "L'escrow n'a pas encore été libéré pour cette commande");
    }
    if (storeOrder.payoutStatus === 'effectue') {
      return sendError(res, 400, 'Cette commande a déjà été versée au marchand');
    }
    if (storeOrder.payoutStatus === 'en_cours') {
      return sendError(res, 409, 'Un versement est déjà en cours pour cette commande — vérifiez son statut dans le dashboard FedaPay avant toute relance');
    }
    if (!storeOrder.store.payoutPhone) {
      return sendError(res, 400, "Le marchand n'a pas encore renseigné de numéro Mobile Money pour recevoir ses versements");
    }

    const claim = await prisma.storeOrder.updateMany({
      where: { id, escrowStatus: 'libere', payoutStatus: { in: RETRYABLE } },
      data: { payoutStatus: 'en_cours' }
    });
    if (claim.count === 0) {
      return sendError(res, 409, 'Cette commande est déjà en cours de traitement');
    }

    let payout;
    try {
      payout = await sendPayout({
        amount: Number(storeOrder.subtotal),
        phoneNumber: storeOrder.store.payoutPhone,
        country: (storeOrder.store.payoutCountry || 'bj').toLowerCase(),
        firstname: storeOrder.store.merchant.firstName || storeOrder.store.merchant.fullName,
        lastname: storeOrder.store.merchant.lastName || '',
        description: `Versement Shopika — commande #${storeOrder.id} (${storeOrder.store.name})`
      });
    } catch (err) {
      console.error('Échec payout FedaPay:', err);
      await prisma.storeOrder.update({ where: { id }, data: { payoutStatus: 'echoue' } });
      await logAdminAction(req.user.id, 'payout_echec', 'store_order', id, { amount: Number(storeOrder.subtotal) });
      return sendError(res, 502, "Échec du versement FedaPay — vérifiez le numéro Mobile Money du marchand, puis relancez");
    }

    let updated;
    try {
      updated = await prisma.storeOrder.update({
        where: { id },
        data: { payoutStatus: 'effectue', fedapayPayoutId: String(payout.id), paidOutAt: new Date() }
      });
    } catch (err) {
      console.error(`ALERTE : payout FedaPay ${payout.id} envoyé mais non enregistré (store_order #${id})`, err);
      await logAdminAction(req.user.id, 'payout_non_enregistre', 'store_order', id, { fedapayPayoutId: String(payout.id) });
      return sendError(res, 500, `Le versement est parti (FedaPay #${payout.id}) mais n'a pas pu être enregistré. Ne le relancez pas : contactez le développeur.`);
    }

    await logAdminAction(req.user.id, 'payout', 'store_order', id, {
      amount: Number(storeOrder.subtotal), store: storeOrder.store.name, fedapayPayoutId: String(payout.id)
    });

    await notify(storeOrder.store.merchantId, {
      type: 'payout_effectue',
      title: 'Versement effectué',
      body: `${Number(storeOrder.subtotal).toLocaleString('fr-FR')} FCFA viennent de vous être envoyés pour la commande #${storeOrder.id}.`,
      link: `/commandes/${storeOrder.id}`
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// ===================================================================
// GET /api/admin/refunds/pending
// Litiges tranchés en faveur du client : l'argent est encore chez nous
// (encaissé sur le compte FedaPay), il reste à le renvoyer au client.
// ===================================================================
router.get('/refunds/pending', async (req, res) => {
  try {
    const storeOrders = await prisma.storeOrder.findMany({
      where: { escrowStatus: 'rembourse', refundStatus: { in: TO_PROCESS } },
      include: {
        store: { select: { id: true, name: true, subdomain: true } },
        order: {
          select: {
            id: true, deliveryPhone: true, deliveryCountry: true,
            client: { select: { fullName: true, email: true, phone: true } }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(storeOrders);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// ===================================================================
// POST /api/admin/refunds/:storeOrderId — rembourse réellement le client
// (même mécanique anti double paiement que les versements marchands)
// ===================================================================
router.post('/refunds/:storeOrderId', async (req, res) => {
  const id = Number(req.params.storeOrderId);
  try {
    const storeOrder = await prisma.storeOrder.findUnique({
      where: { id },
      include: { store: { select: { name: true } }, order: { include: { client: true } } }
    });
    if (!storeOrder) return sendError(res, 404, 'Sous-commande introuvable');
    if (storeOrder.escrowStatus !== 'rembourse') {
      return sendError(res, 400, "Cette commande n'a pas été marquée à rembourser");
    }
    if (storeOrder.refundStatus === 'effectue') {
      return sendError(res, 400, 'Cette commande a déjà été remboursée');
    }
    if (storeOrder.refundStatus === 'en_cours') {
      return sendError(res, 409, 'Un remboursement est déjà en cours pour cette commande — vérifiez son statut dans le dashboard FedaPay avant toute relance');
    }
    if (!storeOrder.order.deliveryPhone) {
      return sendError(res, 400, "Aucun numéro Mobile Money enregistré sur cette commande : remboursez manuellement depuis FedaPay");
    }

    const claim = await prisma.storeOrder.updateMany({
      where: { id, escrowStatus: 'rembourse', refundStatus: { in: RETRYABLE } },
      data: { refundStatus: 'en_cours' }
    });
    if (claim.count === 0) return sendError(res, 409, 'Cette commande est déjà en cours de traitement');

    const client = storeOrder.order.client;
    let refund;
    try {
      refund = await sendPayout({
        amount: Number(storeOrder.subtotal),
        phoneNumber: storeOrder.order.deliveryPhone,
        country: (storeOrder.order.deliveryCountry || 'bj').toLowerCase(),
        firstname: client.firstName || client.fullName,
        lastname: client.lastName || '',
        description: `Remboursement Shopika — commande #${storeOrder.orderId} (${storeOrder.store.name})`
      });
    } catch (err) {
      console.error('Échec remboursement FedaPay:', err);
      await prisma.storeOrder.update({ where: { id }, data: { refundStatus: 'echoue' } });
      await logAdminAction(req.user.id, 'remboursement_echec', 'store_order', id, { amount: Number(storeOrder.subtotal) });
      return sendError(res, 502, "Échec du remboursement FedaPay — vérifiez le numéro Mobile Money du client, puis relancez");
    }

    let updated;
    try {
      updated = await prisma.storeOrder.update({
        where: { id },
        data: { refundStatus: 'effectue', fedapayRefundId: String(refund.id), refundedAt: new Date() }
      });
    } catch (err) {
      console.error(`ALERTE : remboursement FedaPay ${refund.id} envoyé mais non enregistré (store_order #${id})`, err);
      await logAdminAction(req.user.id, 'remboursement_non_enregistre', 'store_order', id, { fedapayRefundId: String(refund.id) });
      return sendError(res, 500, `Le remboursement est parti (FedaPay #${refund.id}) mais n'a pas pu être enregistré. Ne le relancez pas : contactez le développeur.`);
    }

    // Quand TOUTES les sous-commandes de la commande sont remboursées, la
    // commande passe à "remboursee" (sinon elle reste "payee" : remboursement partiel).
    const siblings = await prisma.storeOrder.findMany({ where: { orderId: storeOrder.orderId } });
    if (siblings.every(so => so.escrowStatus === 'rembourse' && so.refundStatus === 'effectue')) {
      await prisma.order.update({ where: { id: storeOrder.orderId }, data: { paymentStatus: 'remboursee' } });
    }

    await logAdminAction(req.user.id, 'remboursement', 'store_order', id, {
      amount: Number(storeOrder.subtotal), store: storeOrder.store.name, fedapayRefundId: String(refund.id)
    });

    await notify(storeOrder.order.clientId, {
      type: 'remboursement_effectue',
      title: 'Remboursement effectué',
      body: `${Number(storeOrder.subtotal).toLocaleString('fr-FR')} FCFA vous ont été remboursés pour votre commande #${storeOrder.orderId}.`,
      link: '/mes-commandes'
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// ===================================================================
// GET /api/admin/disputes — litiges à arbitrer
// ===================================================================
const disputeInclude = {
  store: { select: { name: true, subdomain: true } },
  order: { include: { client: { select: { fullName: true, email: true, phone: true } } } },
  items: { include: { product: { select: { name: true } } } }
};

router.get('/disputes', async (req, res) => {
  try {
    const disputes = await prisma.storeOrder.findMany({
      where: { status: 'litige' },
      include: disputeInclude,
      orderBy: { createdAt: 'desc' }
    });
    res.json(disputes);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// ===================================================================
// PATCH /api/admin/disputes/:id/resolve — { resolution: "libere" | "rembourse" }
//  - libere    : l'escrow est libéré -> apparaît dans les versements marchands
//  - rembourse : l'escrow est marqué remboursé -> apparaît dans les remboursements clients
// La décision est atomique : un litige déjà tranché ne peut pas l'être à nouveau.
// ===================================================================
router.patch('/disputes/:id/resolve', async (req, res) => {
  try {
    const { resolution } = req.body || {};
    if (!['libere', 'rembourse'].includes(resolution)) {
      return sendError(res, 400, 'resolution doit valoir "libere" ou "rembourse"');
    }
    const id = Number(req.params.id);

    const storeOrder = await prisma.storeOrder.findUnique({
      where: { id },
      include: { order: true, store: { select: { name: true, merchantId: true } } }
    });
    if (!storeOrder) return sendError(res, 404, 'Sous-commande introuvable');
    if (storeOrder.status !== 'litige') return sendError(res, 400, "Cette commande n'est pas en litige");

    const { count } = await prisma.storeOrder.updateMany({
      where: { id, status: 'litige' },
      data: resolution === 'libere'
        ? { status: 'livree', escrowStatus: 'libere', confirmedAt: new Date() }
        : { status: 'annulee', escrowStatus: 'rembourse', refundStatus: 'en_attente' }
    });
    if (count === 0) return sendError(res, 409, 'Ce litige vient déjà d\'être tranché');

    await logAdminAction(req.user.id, 'litige_tranche', 'store_order', id, {
      resolution, amount: Number(storeOrder.subtotal), store: storeOrder.store.name
    });

    if (resolution === 'libere') {
      await notify(storeOrder.store.merchantId, {
        type: 'litige',
        title: 'Litige résolu en votre faveur',
        body: `Le litige sur la commande #${storeOrder.id} a été résolu : le versement va être déclenché.`
      });
    } else {
      await notify(storeOrder.order.clientId, {
        type: 'litige',
        title: 'Litige résolu — remboursement',
        body: `Le litige sur votre commande a été résolu en votre faveur. Le remboursement va être traité.`
      });
    }

    const updated = await prisma.storeOrder.findUnique({ where: { id }, include: disputeInclude });
    res.json(updated);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// ===================================================================
// Support clients et marchands → admin (voir aussi routes/support.routes.js)
// ===================================================================
router.get('/support', async (req, res) => {
  try {
    const messages = await prisma.supportMessage.findMany({
      include: { merchant: { select: { fullName: true, phone: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(messages);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

router.patch('/support/:id/reply', async (req, res) => {
  try {
    const { reply } = req.body || {};
    if (!reply || !String(reply).trim()) return sendError(res, 400, 'Réponse requise');

    const existing = await prisma.supportMessage.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) return sendError(res, 404, 'Message introuvable');

    const message = await prisma.supportMessage.update({
      where: { id: existing.id },
      data: { adminReply: reply, repliedAt: new Date(), status: 'traite' },
      include: { merchant: { select: { fullName: true, phone: true, email: true, role: true } } }
    });

    await notify(message.merchantId, {
      type: 'support_reponse',
      title: 'Réponse du support Shopika',
      body: reply,
      link: '/support'
    });

    res.json(message);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// ===================================================================
// GET /api/admin/stores — vue d'ensemble des boutiques de la plateforme
// `state` : "suspendue" (modération admin) > "expiree" (abonnement) > "active"
// ===================================================================
const storeInclude = {
  merchant: { select: { fullName: true, phone: true, email: true } },
  _count: { select: { products: true, storeOrders: true } }
};

function withState(s) {
  const state = s.isSuspended ? 'suspendue' : isStoreActive(s) ? 'active' : 'expiree';
  return { ...s, subscriptionActive: isStoreActive(s), state };
}

router.get('/stores', async (req, res) => {
  try {
    const stores = await prisma.store.findMany({ include: storeInclude, orderBy: { createdAt: 'desc' } });
    res.json(stores.map(withState));
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// PATCH /api/admin/stores/:id/rating — note saisie manuellement par l'admin.
router.patch('/stores/:id/rating', async (req, res) => {
  try {
    const { rating } = req.body || {};
    if (typeof rating !== 'number' || !Number.isFinite(rating) || rating < 0 || rating > 5) {
      return sendError(res, 400, 'rating doit être un nombre entre 0 et 5');
    }
    const id = Number(req.params.id);
    const existing = await prisma.store.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, 'Boutique introuvable');

    const store = await prisma.store.update({ where: { id }, data: { rating }, include: storeInclude });
    await logAdminAction(req.user.id, 'note_boutique', 'store', id, { from: existing.rating, to: rating });
    res.json(withState(store));
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// ===================================================================
// PATCH /api/admin/stores/:id/suspend — { reason }
// La boutique disparaît de la marketplace et ne reçoit plus de commandes ;
// ses commandes en cours, escrows et historique sont conservés intacts.
// ===================================================================
router.patch('/stores/:id/suspend', async (req, res) => {
  try {
    const reason = String((req.body && req.body.reason) || '').trim();
    if (!reason) return sendError(res, 400, 'Un motif de suspension est requis');

    const id = Number(req.params.id);
    const existing = await prisma.store.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, 'Boutique introuvable');
    if (existing.isSuspended) return sendError(res, 400, 'Cette boutique est déjà suspendue');

    const store = await prisma.store.update({
      where: { id },
      data: { isSuspended: true, suspendedReason: reason, suspendedAt: new Date() },
      include: storeInclude
    });

    await logAdminAction(req.user.id, 'boutique_suspendue', 'store', id, { reason, name: existing.name });
    await notify(existing.merchantId, {
      type: 'boutique_suspendue',
      title: 'Boutique suspendue',
      body: `Votre boutique "${existing.name}" a été suspendue par l'équipe Shopika. Motif : ${reason}`,
      link: '/support'
    });

    res.json(withState(store));
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// PATCH /api/admin/stores/:id/reactivate
router.patch('/stores/:id/reactivate', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.store.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, 'Boutique introuvable');
    if (!existing.isSuspended) return sendError(res, 400, "Cette boutique n'est pas suspendue");

    const store = await prisma.store.update({
      where: { id },
      data: { isSuspended: false, suspendedReason: null, suspendedAt: null },
      include: storeInclude
    });

    await logAdminAction(req.user.id, 'boutique_reactivee', 'store', id, { name: existing.name });
    await notify(existing.merchantId, {
      type: 'boutique_reactivee',
      title: 'Boutique réactivée',
      body: `Votre boutique "${existing.name}" est de nouveau en ligne (sous réserve d'un abonnement actif).`,
      link: '/parametres.html'
    });

    res.json(withState(store));
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// ===================================================================
// DELETE /api/admin/stores/:id — réservé aux boutiques SANS historique
// (ex : la boutique de test créée gratuitement). Une boutique qui a eu des
// commandes ou des paiements d'abonnement ne se supprime jamais : on la
// suspend. Le schéma l'impose aussi (onDelete: Restrict sur les sous-commandes).
// ===================================================================
router.delete('/stores/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const store = await prisma.store.findUnique({
      where: { id },
      include: { _count: { select: { storeOrders: true, subscriptionPayments: true } } }
    });
    if (!store) return sendError(res, 404, 'Boutique introuvable');

    if (store._count.storeOrders > 0 || store._count.subscriptionPayments > 0) {
      return sendError(res, 409, "Cette boutique a un historique de transactions : elle ne peut pas être supprimée. Suspendez-la à la place.");
    }

    await prisma.store.delete({ where: { id } });
    await logAdminAction(req.user.id, 'boutique_supprimee', 'store', id, { name: store.name, subdomain: store.subdomain });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    // P2003 : clé étrangère (filet de sécurité si une commande est apparue entre-temps)
    if (err.code === 'P2003') {
      return sendError(res, 409, 'Cette boutique a un historique de transactions : suspendez-la à la place.');
    }
    sendError(res, 500, 'Erreur serveur');
  }
});

// ===================================================================
// GET /api/admin/orders?status=&q= — suivi de toutes les commandes
// (paiement, escrow, versement, remboursement) pour le support.
// ===================================================================
router.get('/orders', async (req, res) => {
  try {
    const { status, q } = req.query;
    const where = {};
    if (status && ['en_attente', 'payee', 'echouee', 'remboursee', 'annulee'].includes(status)) {
      where.paymentStatus = status;
    }
    if (q) {
      const n = Number(q);
      where.OR = [
        ...(Number.isInteger(n) ? [{ id: n }] : []),
        { client: { fullName: { contains: String(q), mode: 'insensitive' } } },
        { client: { email: { contains: String(q), mode: 'insensitive' } } }
      ];
    }
    const orders = await prisma.order.findMany({
      where,
      include: {
        client: { select: { fullName: true, email: true, phone: true } },
        storeOrders: {
          select: {
            id: true, status: true, escrowStatus: true, payoutStatus: true, refundStatus: true,
            subtotal: true, shippingFee: true, store: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// ===================================================================
// GET /api/admin/users?role=&q= — comptes de la plateforme
// PATCH /api/admin/users/:id/active — { isActive } : désactive/réactive un compte
// (connexion refusée et sessions en cours coupées immédiatement).
// Un compte admin ne peut jamais être désactivé depuis cette API, ni soi-même.
// ===================================================================
router.get('/users', async (req, res) => {
  try {
    const { role, q } = req.query;
    const where = {};
    if (role && ['client', 'marchand', 'admin'].includes(role)) where.role = role;
    if (q) {
      where.OR = [
        { fullName: { contains: String(q), mode: 'insensitive' } },
        { email: { contains: String(q), mode: 'insensitive' } },
        { phone: { contains: String(q) } }
      ];
    }
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, fullName: true, email: true, phone: true, role: true, isActive: true,
        createdAt: true, lockedUntil: true, _count: { select: { orders: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

router.patch('/users/:id/active', async (req, res) => {
  try {
    const { isActive } = req.body || {};
    if (typeof isActive !== 'boolean') return sendError(res, 400, 'isActive doit être un booléen');

    const id = Number(req.params.id);
    if (id === req.user.id) return sendError(res, 400, 'Vous ne pouvez pas modifier votre propre compte');

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return sendError(res, 404, 'Compte introuvable');
    if (target.role === 'admin') return sendError(res, 403, "Un compte administrateur ne peut pas être désactivé depuis l'interface");

    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true, fullName: true, email: true, phone: true, role: true, isActive: true,
        createdAt: true, lockedUntil: true, _count: { select: { orders: true } }
      }
    });
    await logAdminAction(req.user.id, isActive ? 'compte_reactive' : 'compte_desactive', 'user', id, { name: target.fullName, role: target.role });
    res.json(user);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// ===================================================================
// GET /api/admin/audit — journal des actions sensibles (200 dernières)
// ===================================================================
router.get('/audit', async (req, res) => {
  try {
    const logs = await prisma.adminAuditLog.findMany({
      include: { admin: { select: { fullName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    res.json(logs);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

module.exports = router;
