const express = require('express');
const router = express.Router();
const prisma = require('../../lib/prisma');
const { toShop, toProduct } = require('../../lib/client-adapter');
const { isStoreActive, activeStoreWhere } = require('../../lib/subscription');

// Requête catalogue paginée côté SERVEUR (avant : tous les produits étaient chargés puis coupés en JavaScript).
// Paramètres : limit (1-200, défaut 200), page, q (recherche), category (id ou slug), sort (new | price_asc | price_desc).
function catalogueQuery(query) {
  const limit = Math.min(200, Math.max(1, Math.floor(Number(query.limit)) || 200));
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  const where = {};
  if (query.q) where.name = { contains: String(query.q).slice(0, 80), mode: 'insensitive' };
  if (query.category) {
    const n = Number(query.category);
    where.category = Number.isInteger(n) ? { id: n } : { slug: String(query.category) };
  }
  const orderBy = query.sort === 'price_asc' ? { price: 'asc' } : query.sort === 'price_desc' ? { price: 'desc' } : { createdAt: 'desc' };
  return { where, orderBy, take: limit, skip: (page - 1) * limit };
}

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
    const { shopId, ids } = req.query;

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
      const cq = catalogueQuery(req.query);
      const shopWhere = { ...cq.where, storeId: store.id, isPublished: true };
      const [products, total] = await Promise.all([
        prisma.product.findMany({ where: shopWhere, include: { category: true, store: true }, orderBy: cq.orderBy, take: cq.take, skip: cq.skip }),
        prisma.product.count({ where: shopWhere }),
      ]);
      res.set('X-Total-Count', String(total)).set('Access-Control-Expose-Headers', 'X-Total-Count');
      return res.json(products.map(toProduct));
    }

    const cq = catalogueQuery(req.query);
    const where = { ...cq.where, isPublished: true, store: activeStoreWhere() };
    const [products, total] = await Promise.all([
      prisma.product.findMany({ where, include: { category: true, store: true }, orderBy: cq.orderBy, take: cq.take, skip: cq.skip }),
      prisma.product.count({ where }),
    ]);
    res.set('X-Total-Count', String(total)).set('Access-Control-Expose-Headers', 'X-Total-Count');
    res.json(products.map(toProduct));
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
