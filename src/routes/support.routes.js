const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { sendError } = require('../lib/http');

// POST /api/support — un marchand envoie une suggestion/question au support
router.post('/', requireAuth, requireRole('marchand'), async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) return sendError(res, 400, 'Sujet et message requis');

    const created = await prisma.supportMessage.create({
      data: { merchantId: req.user.id, subject, message }
    });
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// GET /api/support/my — historique des échanges du marchand connecté
router.get('/my', requireAuth, requireRole('marchand'), async (req, res) => {
  try {
    const messages = await prisma.supportMessage.findMany({
      where: { merchantId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(messages);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

module.exports = router;
