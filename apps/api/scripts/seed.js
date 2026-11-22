// ===================================================================
// Seed de développement — comptes de test, catégories et produits
// d'exemple. Idempotent : réexécutable sans dupliquer quoi que ce
// soit (recherche par identifiants uniques, mise à jour si existant).
//
//   node src/scripts/seed.js
//
// ⚠️ Ne jamais exécuter sur une base de production.
// ===================================================================
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const TEST_PASSWORD = 'test1234';

// Abonnement actif 1 an pour les boutiques de test (la vraie
// logique de paiement prolonge d'un mois via FedaPay — voir
// src/lib/subscription.js).
function inOneYear() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

async function upsertCategory(name, slug, parentId = null) {
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) return existing;
  return prisma.category.create({ data: { name, slug, parentId } });
}

async function upsertUser(where, data) {
  const existing = await prisma.user.findFirst({ where });
  if (existing) {
    return prisma.user.update({ where: { id: existing.id }, data });
  }
  return prisma.user.create({ data });
}

async function upsertStore(merchantId, data) {
  const existing = await prisma.store.findUnique({ where: { merchantId } });
  if (existing) {
    return prisma.store.update({ where: { id: existing.id }, data });
  }
  return prisma.store.create({ data: { ...data, merchantId } });
}

async function upsertProduct(storeId, data) {
  const existing = await prisma.product.findFirst({ where: { storeId, name: data.name } });
  if (existing) {
    return prisma.product.update({ where: { id: existing.id }, data });
  }
  return prisma.product.create({ data: { ...data, storeId } });
}

async function main() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  console.log('— Comptes de test (mot de passe : %s)', TEST_PASSWORD);

  // --- Catégories (globales, avec sous-catégories) ---
  const modeFemme = await upsertCategory('Mode Femme', 'mode-femme');
  await upsertCategory('Robes', 'robes', modeFemme.id);
  const accessoires = await upsertCategory('Accessoires Mode', 'accessoires-mode');
  await upsertCategory('Mode Homme', 'mode-homme');
  await upsertCategory('Maison & Déco', 'maison-deco');
  const electronique = await upsertCategory('Électronique', 'electronique');
  await upsertCategory('Téléphones & Gadgets', 'telephones-gadgets');
  await upsertCategory('Beauté', 'beaute');
  console.log('— Catégories créées');

  // --- Admin ---
  const admin = await upsertUser(
    { phone: '+2250700000001' },
    { phone: '+2250700000001', fullName: 'Admin Shopika', passwordHash, role: 'admin', isActive: true }
  );

  // --- Marchands ---
  const awa = await upsertUser(
    { phone: '+2250700000002' },
    { phone: '+2250700000002', fullName: 'Awa Koné', passwordHash, role: 'marchand', isActive: true }
  );
  await upsertStore(awa.id, {
    name: 'Boutique Awa',
    subdomain: 'awa',
    city: 'Abidjan',
    country: 'Côte d\'Ivoire',
    description: 'Mode féminine africaine : robes wax, pagnes et accessoires artisanaux.',
    rating: 4.8,
    shippingFee: 1000,
    payoutPhone: '+2250700000002',
    payoutCountry: 'CI',
    isPublished: true,
    subscriptionStatus: 'active',
    subscriptionExpiresAt: inOneYear(),
    creationFeePaid: true,
  });

  const kofi = await upsertUser(
    { phone: '+2250700000003' },
    { phone: '+2250700000003', fullName: 'Kofi Mensah', passwordHash, role: 'marchand', isActive: true }
  );
  await upsertStore(kofi.id, {
    name: 'Boutique Kofi',
    subdomain: 'kofi',
    city: 'Lomé',
    country: 'Togo',
    description: 'Électronique et gadgets à prix accessible.',
    rating: 4.5,
    shippingFee: 1500,
    payoutPhone: '+2250700000003',
    payoutCountry: 'TG',
    isPublished: true,
    subscriptionStatus: 'active',
    subscriptionExpiresAt: inOneYear(),
    creationFeePaid: true,
  });
  console.log('— Marchands Awa (awa) et Kofi (kofi) créés');

  // --- Clients ---
  await upsertUser(
    { email: 'client@shopika.test' },
    {
      email: 'client@shopika.test',
      firstName: 'Amina',
      lastName: 'Touré',
      fullName: 'Amina Touré',
      passwordHash,
      role: 'client',
      emailVerified: true,
      emailVerificationCode: null,
      emailVerificationExpires: null,
      isActive: true,
    }
  );
  await upsertUser(
    { phone: '+2250700000004' },
    { phone: '+2250700000004', fullName: 'Client Test', passwordHash, role: 'client', isActive: true }
  );
  console.log('— Clients client@shopika.test et +2250700000004 créés');

  // --- Produits d'exemple ---
  const storeAwa = await prisma.store.findUnique({ where: { merchantId: awa.id } });
  const storeKofi = await prisma.store.findUnique({ where: { merchantId: kofi.id } });

  await upsertProduct(storeAwa.id, {
    name: 'Robe wax africaine',
    description: 'Robe en tissu wax 100% coton, coupe ajustée. Tailles S à XL.',
    price: 15000,
    promoPrice: 12000,
    stock: 25,
    categoryId: modeFemme.id,
    images: [],
    isPublished: true,
  });
  await upsertProduct(storeAwa.id, {
    name: 'Pagne kita traditionnel',
    description: 'Pagne kita 100% coton, teinture naturelle. 2 mètres.',
    price: 8000,
    stock: 40,
    categoryId: modeFemme.id,
    images: [],
    isPublished: true,
  });
  await upsertProduct(storeAwa.id, {
    name: 'Sac artisanal en cuir',
    description: 'Sac en cuir artisanal, fabrication locale.',
    price: 22000,
    stock: 12,
    categoryId: accessoires.id,
    images: [],
    isPublished: true,
  });

  await upsertProduct(storeKofi.id, {
    name: 'Casque Bluetooth sans fil',
    description: 'Casque Bluetooth 5.0, autonomie 20 h, réduction de bruit.',
    price: 25000,
    promoPrice: 19900,
    stock: 30,
    categoryId: electronique.id,
    images: [],
    isPublished: true,
  });
  await upsertProduct(storeKofi.id, {
    name: 'Chargeur solaire 20 000 mAh',
    description: 'Panneau solaire pliable, batterie 20 000 mAh, double port USB.',
    price: 12000,
    stock: 50,
    categoryId: electronique.id,
    images: [],
    isPublished: true,
  });
  await upsertProduct(storeKofi.id, {
    name: 'Smartphone 64 Go double SIM',
    description: 'Écran 6,5", 64 Go, double SIM, 4G.',
    price: 95000,
    stock: 8,
    categoryId: null,
    images: [],
    isPublished: true,
  });
  console.log('— Produits d\'exemple créés (6)');

  console.log('\nSeed terminé. Comptes de test (mot de passe : %s) :', TEST_PASSWORD);
  console.log('  admin   : +2250700000001');
  console.log('  marchand: +2250700000002 (Boutique Awa, subdomain "awa")');
  console.log('  marchand: +2250700000003 (Boutique Kofi, subdomain "kofi")');
  console.log('  client  : client@shopika.test (e-mail déjà vérifié)');
  console.log('  client  : +2250700000004 (ancien schéma téléphone)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
