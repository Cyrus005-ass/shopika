const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/auth');
const { sendError } = require('../lib/http');

const MAX_STORE_CATEGORIES = 30;

const slugify = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'categorie';

function cleanName(raw) {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 40) return null;
  return name;
}

async function getMyStore(userId) {
  return prisma.store.findUnique({ where: { merchantId: userId } });
}

// GET /api/categories — catégories de la PLATEFORME uniquement, publique
// (filtres de la marketplace, menus). Les catégories créées par les marchands n'y figurent pas.
router.get('/', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({ where: { storeId: null }, orderBy: { name: 'asc' } });
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/categories/mine — catégories de la plateforme + celles du marchand connecté
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const store = await getMyStore(req.user.id);
    if (!store) return sendError(res, 404, 'Aucune boutique associée à ce compte');
    const categories = await prisma.category.findMany({
      where: { OR: [{ storeId: null }, { storeId: store.id }] },
      orderBy: { name: 'asc' }
    });
    res.json(categories.map((c) => ({ ...c, mine: c.storeId === store.id })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/categories — le marchand crée une catégorie pour sa boutique
router.post('/', requireAuth, async (req, res) => {
  try {
    const store = await getMyStore(req.user.id);
    if (!store) return sendError(res, 404, 'Aucune boutique associée à ce compte');
    const name = cleanName(req.body.name);
    if (!name) return sendError(res, 400, 'Nom de catégorie invalide (2 à 40 caractères)');

    const visible = await prisma.category.findMany({ where: { OR: [{ storeId: null }, { storeId: store.id }] }, select: { name: true, storeId: true } });
    if (visible.some((c) => c.name.toLowerCase() === name.toLowerCase())) return sendError(res, 409, 'Cette catégorie existe déjà');
    if (visible.filter((c) => c.storeId === store.id).length >= MAX_STORE_CATEGORIES) return sendError(res, 400, `Maximum ${MAX_STORE_CATEGORIES} catégories`);

    const category = await prisma.category.create({ data: { name, slug: `${slugify(name)}-s${store.id}`, storeId: store.id } });
    res.status(201).json({ ...category, mine: true });
  } catch (err) {
    if (err.code === 'P2002') return sendError(res, 409, 'Cette catégorie existe déjà');
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/categories/:id — renommer une de SES catégories
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const store = await getMyStore(req.user.id);
    const existing = store && await prisma.category.findFirst({ where: { id: Number(req.params.id), storeId: store.id } });
    if (!existing) return sendError(res, 404, 'Catégorie introuvable');
    const name = cleanName(req.body.name);
    if (!name) return sendError(res, 400, 'Nom de catégorie invalide (2 à 40 caractères)');
    const clash = await prisma.category.findFirst({ where: { id: { not: existing.id }, name: { equals: name, mode: 'insensitive' }, OR: [{ storeId: null }, { storeId: store.id }] } });
    if (clash) return sendError(res, 409, 'Cette catégorie existe déjà');
    const category = await prisma.category.update({ where: { id: existing.id }, data: { name } });
    res.json({ ...category, mine: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/categories/:id — supprimer une de SES catégories (ses produits deviennent « sans catégorie »)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const store = await getMyStore(req.user.id);
    const existing = store && await prisma.category.findFirst({ where: { id: Number(req.params.id), storeId: store.id } });
    if (!existing) return sendError(res, 404, 'Catégorie introuvable');
    await prisma.category.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
