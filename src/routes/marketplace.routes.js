const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { toShop, toProduct, toOrder } = require('../lib/client-adapter');
const { isStoreActive, activeStoreWhere } = require('../lib/subscription');

const now = () => new Date();

router.get('/shops', async (req, res) => {
  try {
    const { search } = req.query;
    const where = {
      isPublished: true,
      ...activeStoreWhere(),
    };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { products: { some: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const stores = await prisma.store.findMany({
      where,
      include: { products: { where: { isPublished: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const results = stores.map((store) => {
      let matchedProduct = null;
      if (search && store.products.length > 0) {
        const match = store.products.find((p) =>
          p.name.toLowerCase().includes(search.toLowerCase())
        );
        if (match) {
          matchedProduct = {
            id: match.id,
            name: match.name,
            price: Number(match.price),
          };
        }
      }
      return { shop: toShop(store), matchedProduct };
    });

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/shops/:slug', async (req, res) => {
  try {
    const store = await prisma.store.findUnique({
      where: { subdomain: req.params.slug },
      include: { merchant: { select: { fullName: true, phone: true } } },
    });
    if (!store) return res.status(404).json({ error: 'Boutique introuvable' });

    const shop = toShop(store);
    res.json(shop);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/products', async (req, res) => {
  try {
    const { shopId, ids, sort, limit } = req.query;

    if (ids) {
      const idArr = ids.split(',').map(Number);
      const products = await prisma.product.findMany({
        where: { id: { in: idArr.filter(Number.isInteger) }, isPublished: true, store: activeStoreWhere() },
        include: { category: true, store: true },
      });
      return res.json(products.map(toProduct));
    }

    if (shopId) {
      const store = await prisma.store.findUnique({
        where: { id: Number(shopId) },
      });
      if (!store || !isStoreActive(store)) {
        return res.json([]);
      }
      const products = await prisma.product.findMany({
        where: { storeId: store.id, isPublished: true },
        include: { category: true, store: true },
        orderBy: { createdAt: 'desc' },
      });
      const limitNum = limit ? Number(limit) : undefined;
      const result = limitNum ? products.slice(0, limitNum) : products;
      return res.json(result.map(toProduct));
    }

    const where = { isPublished: true, store: activeStoreWhere() };
    const products = await prisma.product.findMany({
      where,
      include: { category: true, store: true },
      orderBy: { createdAt: 'desc' },
    });
    const limitNum = limit ? Number(limit) : undefined;
    const result = limitNum ? products.slice(0, limitNum) : products;
    res.json(result.map(toProduct));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        category: true,
        store: { select: { name: true, subdomain: true, subscriptionExpiresAt: true, isSuspended: true, merchant: { select: { phone: true } } } },
      },
    });
    if (!product || !product.isPublished) {
      return res.status(404).json({ error: 'Produit introuvable' });
    }
    if (!isStoreActive(product.store)) {
      return res.status(404).json({ error: 'Cette boutique est temporairement indisponible' });
    }
    res.json(toProduct(product));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
