const express = require('express');
const router = express.Router();
const { sendError } = require('../lib/http');
const { expireUnpaidOrders } = require('../lib/orderExpiry');

// GET /api/cron/expire-orders — appelé par Vercel Cron (voir vercel.json).
// Vercel envoie automatiquement "Authorization: Bearer <CRON_SECRET>" quand la
// variable d'environnement CRON_SECRET est définie. Sans secret configuré, la
// route est fermée (jamais ouverte par défaut).
router.get('/expire-orders', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return sendError(res, 401, 'Non autorisé');
  }
  try {
    const cancelled = await expireUnpaidOrders();
    res.json({ cancelled });
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

module.exports = router;
