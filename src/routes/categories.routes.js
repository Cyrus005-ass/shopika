const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// GET /api/categories — liste complète, publique (remplit les menus déroulants)
router.get('/', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;