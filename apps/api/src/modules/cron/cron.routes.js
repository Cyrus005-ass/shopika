const express = require('express');
const router = express.Router();
const { sendError } = require('../../lib/http');
const { expireUnpaidOrders } = require('../../lib/orderExpiry');
const { autoConfirmShippedOrders } = require('../../lib/autoConfirm');
const { sendSubscriptionReminders } = require('../../lib/subscriptionReminders');

// Vercel Cron envoie automatiquement "Authorization: Bearer <CRON_SECRET>" quand la variable
// d'environnement CRON_SECRET est définie (voir vercel.json). Sans secret configuré, les routes
// sont fermées (jamais ouvertes par défaut).
function requireCronSecret(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return sendError(res, 401, 'Non autorisé');
  next();
}

const job = (fn) => async (req, res) => {
  try {
    res.json(await fn());
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
};

// GET /api/cron/expire-orders — annule les commandes jamais payées et remet le stock en vente.
router.get('/expire-orders', requireCronSecret, job(async () => ({ cancelled: await expireUnpaidOrders() })));

// GET /api/cron/auto-confirm — confirme les colis expédiés depuis plus de AUTO_CONFIRM_DAYS jours.
router.get('/auto-confirm', requireCronSecret, job(() => autoConfirmShippedOrders()));

// GET /api/cron/subscription-reminders — rappels J-7 et J-1 avant expiration de l'abonnement.
router.get('/subscription-reminders', requireCronSecret, job(() => sendSubscriptionReminders()));

module.exports = router;
