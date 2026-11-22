const express = require('express');
const router = express.Router();
const prisma = require('../../lib/prisma');
const requireAuth = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');
const { buildWhatsAppLink } = require('../../lib/whatsapp');
const { sendError } = require('../../lib/http');
const { createPaymentLink } = require('../../lib/fedapay');
const { isStoreActive, activeStoreWhere, amountDueFor } = require('../../lib/subscription');
const { THEME_IDS } = require('../../lib/storefront');
const config = require('../../config');
const rateLimit = require('../../middleware/rateLimit');
const { validateSubdomain } = require('../../lib/validators');
const { aggregateCustomers, summarizeFinance, buildStats } = require('./stores.service');

const checkLimiter = rateLimit({ windowMs: 60 * 1000, max: 40, message: 'Trop de vérifications, patientez un instant' });


// GET /api/stores/search?q=awa
// Sans "q" : renvoie TOUTES les boutiques publiées (c'est ce qui alimente
// la marketplace au chargement, avant que la personne ne tape une recherche —
// avant ce correctif la route renvoyait [] tant qu'il n'y avait pas de "q",
// ce qui empêchait tout aperçu boutique de s'afficher).
//
// `subscriptionExpiresAt: { gt: new Date() }` : une boutique dont
// l'abonnement a expiré disparaît automatiquement de la marketplace, à la
// seconde près, sans job planifié — voir lib/subscription.js.
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    const stores = await prisma.store.findMany({
      where: {
        isPublished: true,
        ...activeStoreWhere(),
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {})
      },
      select: {
        id: true, name: true, subdomain: true, logoUrl: true, colorPrimary: true, colorSecondary: true,
        city: true, country: true, description: true, rating: true, shippingFee: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(stores);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// GET /api/stores/me — la boutique du marchand connecté
router.get('/me', requireAuth, async (req, res) => {
  try {
    const store = await prisma.store.findUnique({
      where: { merchantId: req.user.id },
      include: { merchant: { select: { fullName: true, phone: true } } }
    });
    if (!store) return sendError(res, 404, 'Aucune boutique associée à ce compte');
    res.json({ ...store, subscriptionActive: isStoreActive(store) });
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// GET /api/stores/pricing — tarifs publics (landing page, assistant « Devenir marchand »).
router.get('/pricing', (req, res) => {
  res.json({ creationFee: config.storeCreationFee, monthlyFee: config.storeMonthlyFee, currency: 'XOF' });
});

// GET /api/stores/check-subdomain?name=ma-boutique — disponibilité en direct pendant la saisie.
router.get('/check-subdomain', checkLimiter, async (req, res) => {
  try {
    const check = validateSubdomain(req.query.name);
    if (!check.ok) return res.json({ available: false, reason: check.error });
    const taken = await prisma.store.findUnique({ where: { subdomain: check.value }, select: { id: true } });
    res.json(taken ? { available: false, reason: 'Ce nom est déjà pris' } : { available: true, value: check.value });
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// --- Données de l'espace marchand (calculées côté serveur, sur SES commandes payées uniquement) ---
async function paidStoreOrders(merchantId, select) {
  const store = await prisma.store.findUnique({ where: { merchantId }, select: { id: true } });
  if (!store) return null;
  return prisma.storeOrder.findMany({
    where: { storeId: store.id, order: { paymentStatus: 'payee' } },
    select, orderBy: { createdAt: 'desc' }, take: 5000
  });
}

// GET /api/stores/me/customers
router.get('/me/customers', requireAuth, requireRole('marchand'), async (req, res) => {
  try {
    const rows = await paidStoreOrders(req.user.id, {
      subtotal: true, createdAt: true, status: true, escrowStatus: true,
      order: { select: { clientId: true, deliveryPhone: true, client: { select: { fullName: true, email: true, phone: true } } } }
    });
    if (!rows) return sendError(res, 404, 'Aucune boutique associée à ce compte');
    res.json(aggregateCustomers(rows));
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// GET /api/stores/me/finance — séquestre, à verser, versé + dernières lignes
router.get('/me/finance', requireAuth, requireRole('marchand'), async (req, res) => {
  try {
    const rows = await paidStoreOrders(req.user.id, {
      id: true, orderId: true, subtotal: true, status: true, escrowStatus: true, payoutStatus: true,
      createdAt: true, shippedAt: true, confirmedAt: true, paidOutAt: true
    });
    if (!rows) return sendError(res, 404, 'Aucune boutique associée à ce compte');
    res.json({ summary: summarizeFinance(rows), recent: rows.slice(0, 50) });
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// GET /api/stores/me/stats — 6 derniers mois, panier moyen, meilleurs produits
router.get('/me/stats', requireAuth, requireRole('marchand'), async (req, res) => {
  try {
    const store = await prisma.store.findUnique({ where: { merchantId: req.user.id }, select: { id: true } });
    if (!store) return sendError(res, 404, 'Aucune boutique associée à ce compte');
    const paid = { storeId: store.id, order: { paymentStatus: 'payee' } };
    const [orders, items] = await Promise.all([
      prisma.storeOrder.findMany({ where: paid, select: { subtotal: true, createdAt: true, status: true, escrowStatus: true }, take: 5000 }),
      prisma.orderItem.findMany({
        where: { storeOrder: { ...paid, escrowStatus: { not: 'rembourse' }, status: { not: 'annulee' } } },
        select: { quantity: true, unitPrice: true, product: { select: { name: true } } }, take: 20000
      })
    ]);
    res.json(buildStats(items, orders));
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// GET /api/stores/me/subscription — statut détaillé + montant dû
router.get('/me/subscription', requireAuth, requireRole('marchand'), async (req, res) => {
  try {
    const store = await prisma.store.findUnique({ where: { merchantId: req.user.id } });
    if (!store) return sendError(res, 404, 'Aucune boutique associée à ce compte');

    res.json({
      status: store.subscriptionStatus,
      active: isStoreActive(store),
      expiresAt: store.subscriptionExpiresAt,
      isFirstPayment: !store.subscriptionExpiresAt,
      amountDue: amountDueFor(store)
    });
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// POST /api/stores/me/subscription/pay — lien de paiement FedaPay pour
// payer les frais de création (1re fois) ou se réabonner (mois suivants)
router.post('/me/subscription/pay', requireAuth, requireRole('marchand'), async (req, res) => {
  try {
    const store = await prisma.store.findUnique({
      where: { merchantId: req.user.id },
      include: { merchant: true }
    });
    if (!store) return sendError(res, 404, 'Aucune boutique associée à ce compte');

    const amount = amountDueFor(store);
    const { paymentUrl } = await createPaymentLink({
      amount,
      description: store.subscriptionExpiresAt
        ? `Réabonnement boutique Shopika — ${store.name}`
        : `Frais de création boutique Shopika — ${store.name}`,
      callbackUrl: `${process.env.MERCHANT_APP_URL}/parametres.html?subscription=en_cours`,
      customer: {
        firstname: store.merchant.firstName || store.merchant.fullName || 'Marchand',
        lastname: store.merchant.lastName || 'Shopika',
        phone_number: store.merchant.phone ? { number: store.merchant.phone, country: (store.payoutCountry || 'bj').toLowerCase() } : undefined
      },
      // Distingue ce paiement d'un paiement de commande client dans le
      // webhook unique de payments.routes.js.
      customMetadata: { type: 'subscription', storeId: store.id }
    });

    res.json({ paymentUrl, amount });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "Impossible d'initier le paiement pour le moment");
  }
});

router.get('/:subdomain', async (req, res) => {
  try {
    const store = await prisma.store.findUnique({
      where: { subdomain: req.params.subdomain },
      include: { merchant: { select: { fullName: true, phone: true } } }
    });
    if (!store) return sendError(res, 404, 'Boutique introuvable');

    const whatsappLink = buildWhatsAppLink(
      store.merchant.phone,
      `Bonjour, je vous contacte depuis votre boutique "${store.name}" sur Shopika.`
    );
    res.json({ ...store, whatsappLink, subscriptionActive: isStoreActive(store) });
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// PATCH protégé — merchant_id vient du token, plus du body
router.patch('/', requireAuth, requireRole('marchand'), async (req, res) => {
  try {
    const { name, theme_id, color_primary, color_secondary, logo_url, is_published, payout_phone, payout_country, city, country, description, shipping_fee } = req.body;
    const merchantId = req.user.id;

    // Le thème doit être l'un des thèmes réellement livrés par le front
    // (src/lib/storefront.js) : une valeur libre casserait l'affichage de la boutique.
    if (theme_id !== undefined && !(Number.isInteger(theme_id) && THEME_IDS.includes(theme_id))) {
      return sendError(res, 400, 'Thème invalide');
    }

    const store = await prisma.store.update({
      where: { merchantId },
      data: {
        name, themeId: theme_id, colorPrimary: color_primary, colorSecondary: color_secondary,
        logoUrl: logo_url, isPublished: is_published,
        payoutPhone: payout_phone, payoutCountry: payout_country,
        city, country, description,
        shippingFee: shipping_fee !== undefined ? shipping_fee : undefined
      }
    });
    res.json({ success: true, store });
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

module.exports = router;