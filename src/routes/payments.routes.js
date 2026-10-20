const express = require('express');
const router = express.Router();
const { Webhook } = require('fedapay'); // utilisé uniquement pour vérifier la signature des webhooks
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/auth');
const { sendError } = require('../lib/http');
const { createPaymentLink } = require('../lib/fedapay');
const { notify, notifyAdmins, notifyMerchantOrderPaid } = require('../lib/notify');
const { nextExpiryAfterPayment } = require('../lib/subscription');

// ===================================================================
// POST /api/payments/orders/:orderId/pay
// Le client déclenche l'encaissement d'une commande déjà créée.
// Renvoie un lien de paiement hébergé par FedaPay (Mobile Money OU carte,
// FedaPay affiche les moyens disponibles pour le pays du client — on ne
// force pas de "mode" ici).
// ===================================================================
router.post('/orders/:orderId/pay', requireAuth, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.orderId) },
      include: { client: true }
    });
    if (!order) return sendError(res, 404, 'Commande introuvable');
    if (order.clientId !== req.user.id) return sendError(res, 403, "Cette commande ne vous appartient pas");
    if (order.paymentStatus === 'payee') return sendError(res, 400, 'Cette commande est déjà payée');
    if (order.paymentStatus === 'annulee') {
      return sendError(res, 400, 'Cette commande a expiré faute de paiement : passez une nouvelle commande');
    }

    const { transactionId, paymentUrl } = await createPaymentLink({
      amount: Number(order.totalAmount),
      description: `Commande Shopika #${order.id}`,
      // Le client revient sur cette page après paiement (succès ou échec) ;
      // le vrai statut, lui, n'est confirmé que par le webhook ci-dessous.
      callbackUrl: `${process.env.CLIENT_APP_URL}/app/commandes.html?order=${order.id}`,
      customer: {
        firstname: order.client.firstName || order.client.fullName || 'Client',
        lastname: order.client.lastName || 'Shopika',
        email: order.client.email || undefined,
        phone_number: order.deliveryPhone
          ? { number: order.deliveryPhone, country: (order.deliveryCountry || 'bj').toLowerCase() }
          : undefined
      },
      customMetadata: { orderId: order.id }
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { fedapayTransactionId: String(transactionId) }
    });

    res.json({ paymentUrl });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "Impossible d'initier le paiement pour le moment");
  }
});

// ===================================================================
// POST /api/payments/webhook — appelé par FedaPay, jamais par le frontend.
// Doit rester la SEULE source de vérité sur le fait qu'une commande est
// réellement payée : on ne fait jamais confiance à une redirection
// navigateur (callback_url), qui peut être manipulée ou simplement ratée.
// ===================================================================
router.post('/webhook', async (req, res) => {
  // Vérifie que le secret webhook est configuré (pas vide, pas placeholder)
  if (!process.env.FEDAPAY_WEBHOOK_SECRET ||
      process.env.FEDAPAY_WEBHOOK_SECRET === 'your_live_webhook_secret_here' ||
      process.env.FEDAPAY_WEBHOOK_SECRET === 'wh_sandbox_...') {
    console.error('FEDAPAY_WEBHOOK_SECRET non configuré');
    return res.status(500).json({ error: 'Webhook non configuré sur le serveur' });
  }

  let event;
  try {
    const signature = req.headers['x-fedapay-signature'];
    // req.rawBody est peuplé par le "verify" du express.json() dans server.js —
    // indispensable ici car une signature se vérifie sur le corps BRUT.
    event = Webhook.constructEvent(req.rawBody, signature, process.env.FEDAPAY_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Signature webhook FedaPay invalide:', err.message);
    return res.status(400).send('Signature invalide');
  }

  try {
    const transaction = event.entity || event.object;
    const metadata = transaction?.custom_metadata || {};

    // --- Paiement d'ABONNEMENT boutique (frais de création / réabonnement) ---
    if (metadata.type === 'subscription' && metadata.storeId) {
      if (event.name === 'transaction.approved' && transaction && transaction.id) {
        const store = await prisma.store.findUnique({ where: { id: Number(metadata.storeId) } });
        if (store) {
          const expiresAt = nextExpiryAfterPayment(store);
          // IDEMPOTENCE : FedaPay peut renvoyer le même événement (retry, rejeu
          // manuel). SubscriptionPayment porte une contrainte d'unicité sur l'id
          // de transaction et est créée dans la même transaction SQL que la
          // prolongation : si elle existe déjà (P2002), tout est annulé et
          // l'abonnement n'est PAS prolongé une deuxième fois.
          let applied = true;
          try {
            await prisma.$transaction([
              prisma.subscriptionPayment.create({
                data: { storeId: store.id, fedapayTransactionId: String(transaction.id) }
              }),
              prisma.store.update({
                where: { id: store.id },
                data: { subscriptionStatus: 'active', subscriptionExpiresAt: expiresAt, creationFeePaid: true }
              })
            ]);
          } catch (e) {
            if (e.code === 'P2002') applied = false; // déjà traité
            else throw e;
          }
          if (applied) {
            await notify(store.merchantId, {
              type: 'abonnement_active',
              title: store.creationFeePaid ? 'Réabonnement confirmé' : 'Boutique activée',
              body: `Votre boutique "${store.name}" est active jusqu'au ${expiresAt.toLocaleDateString('fr-FR')} ${expiresAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`,
              link: '/parametres.html'
            });
          }
        }
      }
      return res.json({ received: true });
    }

    // --- Paiement de COMMANDE client (flux existant) ---
    const orderId = metadata.orderId;

    if (event.name === 'transaction.approved' && orderId) {
      // Transition atomique en_attente/echouee -> payee. Si la commande est
      // déjà payée (événement rejoué), count vaut 0 : on ne renotifie pas les
      // marchands et on ne réécrit pas paidAt.
      const { count } = await prisma.order.updateMany({
        where: { id: Number(orderId), paymentStatus: { in: ['en_attente', 'echouee'] } },
        data: {
          paymentStatus: 'payee',
          paymentMethod: transaction.mode && transaction.mode.includes('card') ? 'card' : 'mobile_money',
          paidAt: new Date()
        }
      });
      if (count === 0) {
        // Soit un rejeu d'événement (commande déjà payée : rien à faire), soit un
        // paiement arrivé APRÈS l'annulation de la commande : l'argent est bien
        // encaissé mais la commande n'existe plus -> alerte admin, remboursement manuel.
        const late = await prisma.order.findUnique({ where: { id: Number(orderId) }, select: { id: true, paymentStatus: true, totalAmount: true } });
        if (late && late.paymentStatus === 'annulee') {
          await notifyAdmins({
            type: 'paiement_orphelin',
            title: 'Paiement reçu sur une commande annulée',
            body: `Le client a payé ${Number(late.totalAmount).toLocaleString('fr-FR')} FCFA pour la commande #${late.id}, déjà annulée faute de paiement dans le délai. À rembourser manuellement depuis FedaPay (transaction ${transaction.id}).`,
            link: '/audit'
          });
        }
        return res.json({ received: true });
      }
      const order = await prisma.order.findUnique({ where: { id: Number(orderId) } });

      // Notifie chaque marchand concerné — c'est le vrai déclencheur
      // "commande payée" (à ne pas confondre avec "nouvelle commande",
      // envoyé dès la création, avant paiement).
      const storeOrders = await prisma.storeOrder.findMany({
        where: { orderId: order.id },
        include: {
          store: { select: { merchantId: true, name: true } },
          items: { include: { product: { select: { name: true } } } }
        }
      });
      for (const so of storeOrders) {
        await notify(so.store.merchantId, {
          type: 'commande_payee',
          title: 'Commande payée',
          body: `Le paiement de la commande sur "${so.store.name}" a été confirmé. Vous pouvez la préparer et l'expédier.`,
          link: `/commandes/${so.id}`
        });
        // E-mail au marchand (Gmail/SMTP) s'il a renseigné son
        // adresse et n'a pas désactivé les notifications :
        // détail des articles de SA sous-commande. Best effort.
        await notifyMerchantOrderPaid({
          merchantId: so.store.merchantId,
          storeName: so.store.name,
          orderId: order.id,
          items: so.items.map(it => ({
            productName: it.product ? it.product.name : 'Produit',
            quantity: it.quantity,
            unitPrice: Number(it.unitPrice)
          })),
          subtotal: Number(so.subtotal)
        });
      }
    }

    if ((event.name === 'transaction.declined' || event.name === 'transaction.canceled') && orderId) {
      // Jamais de régression d'une commande déjà payée : un événement "declined"
      // arrivant après "approved" (l'ordre n'est pas garanti) est ignoré.
      await prisma.order.updateMany({
        where: { id: Number(orderId), paymentStatus: 'en_attente' },
        data: { paymentStatus: 'echouee' }
      });
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Erreur traitement webhook FedaPay:', err);
    // On répond 500 pour que FedaPay RÉESSAIE : tous les traitements ci-dessus
    // sont idempotents, un rejeu est donc sans danger. Avant, répondre 200 sur
    // une erreur transitoire (base indisponible) faisait perdre définitivement
    // la confirmation d'un paiement réel.
    res.status(500).json({ received: false });
  }
});

module.exports = router;
