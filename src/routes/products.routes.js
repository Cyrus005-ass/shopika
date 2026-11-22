const express = require('express');
const multer = require('multer');
const router = express.Router();
const prisma = require('../lib/prisma');
const supabase = require('../lib/supabase');
const requireAuth = require('../middleware/auth');
const { buildWhatsAppLink } = require('../lib/whatsapp');
const { isStoreActive, activeStoreWhere } = require('../lib/subscription');
const { sanitizeColors } = require('../lib/storefront');
const { Prisma } = require('@prisma/client');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5 Mo max

// Petit utilitaire : retrouve la boutique du marchand connecté
async function getMyStore(userId) {
  return prisma.store.findUnique({ where: { merchantId: userId } });
}

// Une catégorie est utilisable si elle est de la plateforme (storeId null) ou propre à CETTE boutique.
async function categoryExists(categoryId, storeId) {
  if (categoryId === undefined || categoryId === null) return true;
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  return !!category && (category.storeId === null || category.storeId === storeId);
}

// ===================================================================
// ROUTES PUBLIQUES — utilisées par SHOPIKA_clients, sans authentification
// ===================================================================

// GET /api/products/store/:subdomain — catalogue public d'une boutique
// Si l'abonnement de la boutique a expiré, le catalogue renvoie vide (la
// boutique existe toujours, mais n'est plus "fonctionnelle" tant que le
// marchand n'a pas repayé — voir lib/subscription.js).
router.get('/store/:subdomain', async (req, res) => {
  try {
    const store = await prisma.store.findUnique({ where: { subdomain: req.params.subdomain } });
    if (!store) return res.status(404).json({ error: 'Boutique introuvable' });

    if (!isStoreActive(store)) return res.json([]);

    const products = await prisma.product.findMany({
      where: { storeId: store.id, isPublished: true },
      include: { category: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/products/public/:id — fiche produit publique
router.get('/public/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        category: true,
        store: { select: { name: true, subdomain: true, subscriptionExpiresAt: true, isSuspended: true, merchant: { select: { phone: true } } } }
      }
    });
    if (!product || !product.isPublished) {
      return res.status(404).json({ error: 'Produit introuvable' });
    }
    if (!isStoreActive(product.store)) {
      return res.status(404).json({ error: 'Cette boutique est temporairement indisponible' });
    }

    const whatsappLink = buildWhatsAppLink(
      product.store.merchant.phone,
      `Bonjour, je suis intéressé(e) par "${product.name}" sur votre boutique "${product.store.name}".`
    );
    res.json({ ...product, whatsappLink });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ===================================================================
// ROUTES MARCHAND — protégées, utilisées par SHOPIKA_marchand
// ===================================================================

// POST /api/products/upload-image
router.post('/upload-image', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier envoyé' });

    const ext = req.file.originalname.split('.').pop();
    const fileName = `${req.user.id}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
    if (error) throw error;

    const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
    res.json({ url: data.publicUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Échec de l'upload" });
  }
});

// GET /api/products — liste TOUS mes produits (publiés ou non)
router.get('/', requireAuth, async (req, res) => {
  try {
    const store = await getMyStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'Aucune boutique associée à ce compte' });

    const products = await prisma.product.findMany({
      where: { storeId: store.id },
      include: { category: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/products/search?category=chaussures&q=nike
// Recherche globale multi-boutiques pour la marketplace
router.get('/search', async (req, res) => {
  try {
    const { category, q } = req.query;

    const where = { isPublished: true, store: activeStoreWhere() };

    if (category) {
      where.category = { slug: category };
    }
    if (q) {
      where.name = { contains: q, mode: 'insensitive' };
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        store: { select: { name: true, subdomain: true, logoUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/products/:id — un de mes produits (peu importe le statut)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const store = await getMyStore(req.user.id);
    const product = await prisma.product.findFirst({
      where: { id: Number(req.params.id), storeId: store?.id },
      include: { category: true }
    });
    if (!product) return res.status(404).json({ error: 'Produit introuvable' });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/products — créer un produit
router.post('/', requireAuth, async (req, res) => {
  try {
    const store = await getMyStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'Aucune boutique associée à ce compte' });

    const { name, description, price, promo_price, stock, weight, images, video_url, category_id, is_published, seo_title, seo_description, colors } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Nom et prix requis' });
    }
    if (!(await categoryExists(category_id, store?.id))) {
     return res.status(400).json({ error: 'Catégorie introuvable' });
    }
    const parsedColors = sanitizeColors(colors);
    if (parsedColors.error) return res.status(400).json({ error: parsedColors.error });

    const product = await prisma.product.create({
      data: {
        storeId: store.id,
        categoryId: category_id ?? null,
        name,
        description,
        price,
        promoPrice: promo_price ?? null,
        stock: stock ?? 0,
        weight: weight ?? null,
        images: images ?? [],
        videoUrl: video_url ?? null,
        colors: parsedColors.value ?? Prisma.DbNull,
        isPublished: is_published ?? false,
        seoTitle: seo_title ?? null,
        seoDescription: seo_description ?? null
      }
    });
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/products/:id — modifier (seulement si c'est le mien)
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const store = await getMyStore(req.user.id);
    const existing = await prisma.product.findFirst({ where: { id: Number(req.params.id), storeId: store?.id } });
    if (!existing) return res.status(404).json({ error: 'Produit introuvable' });

    const { name, description, price, promo_price, stock, weight, images, video_url, category_id, is_published, seo_title, seo_description, colors } = req.body;

    if (!(await categoryExists(category_id, store?.id))) {
      return res.status(400).json({ error: 'Catégorie introuvable' });
    }
    // colors absent = inchangé ; null ou [] = on retire toutes les couleurs.
    let colorsUpdate;
    if (colors !== undefined) {
      const parsedColors = sanitizeColors(colors);
      if (parsedColors.error) return res.status(400).json({ error: parsedColors.error });
      colorsUpdate = parsedColors.value ?? Prisma.DbNull;
    }

    const product = await prisma.product.update({
      where: { id: existing.id },
      data: {
        name, description, price,
        promoPrice: promo_price,
        stock, weight, images,
        videoUrl: video_url,
        colors: colorsUpdate,
        categoryId: category_id,
        isPublished: is_published,
        seoTitle: seo_title,
        seoDescription: seo_description
      }
    });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/products/:id — supprimer (seulement si c'est le mien)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const store = await getMyStore(req.user.id);
    const existing = await prisma.product.findFirst({ where: { id: Number(req.params.id), storeId: store?.id } });
    if (!existing) return res.status(404).json({ error: 'Produit introuvable' });

    await prisma.product.delete({ where: { id: existing.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;