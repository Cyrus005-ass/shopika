const express = require('express');
const router = express.Router();
const prisma = require('../../lib/prisma');
const requireAuth = require('../../middleware/auth');
const { sendError } = require('../../lib/http');

// GET /api/favorites/ids — juste les IDs (pour cocher les cœurs rapidement)
router.get('/ids', requireAuth, async (req, res) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      select: { productId: true }
    });
    res.json(favorites.map(f => f.productId));
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// GET /api/favorites — produits favoris complets, pour la page favoris
router.get('/', requireAuth, async (req, res) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      include: { product: { include: { store: { select: { name: true, subdomain: true } } } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(favorites.map(f => f.product));
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// POST /api/favorites/:productId
router.post('/:productId', requireAuth, async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return sendError(res, 404, 'Produit introuvable');

    await prisma.favorite.upsert({
      where: { userId_productId: { userId: req.user.id, productId } },
      create: { userId: req.user.id, productId },
      update: {}
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// DELETE /api/favorites/:productId
router.delete('/:productId', requireAuth, async (req, res) => {
  try {
    await prisma.favorite.deleteMany({
      where: { userId: req.user.id, productId: Number(req.params.productId) }
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

module.exports = router;
