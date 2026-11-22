const express = require('express');
const router = express.Router();
const prisma = require('../../lib/prisma');
const requireAuth = require('../../middleware/auth');
const { sendError } = require('../../lib/http');

// GET /api/notifications — les miennes, non lues d'abord
router.get('/', requireAuth, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: 50
    });
    const unreadCount = await prisma.notification.count({ where: { userId: req.user.id, isRead: false } });
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const notif = await prisma.notification.findFirst({ where: { id: Number(req.params.id), userId: req.user.id } });
    if (!notif) return sendError(res, 404, 'Notification introuvable');
    const updated = await prisma.notification.update({ where: { id: notif.id }, data: { isRead: true } });
    res.json(updated);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

module.exports = router;
