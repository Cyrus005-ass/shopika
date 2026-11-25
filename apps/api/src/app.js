require('dotenv').config();
const express = require('express');
const cors = require('cors');

const storesRoutes = require('./modules/stores/stores.routes');
const authRoutes = require('./modules/auth/auth.routes');
const productsRoutes = require('./modules/products/products.routes');
const ordersRoutes = require('./modules/orders/orders.routes');
const categoriesRoutes = require('./modules/categories/categories.routes');
const paymentsRoutes = require('./modules/payments/payments.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const supportRoutes = require('./modules/support/support.routes');
const notificationsRoutes = require('./modules/notifications/notifications.routes');
const favoritesRoutes = require('./modules/favorites/favorites.routes');
const marketplaceRoutes = require('./modules/marketplace/marketplace.routes');
const cronRoutes = require('./modules/cron/cron.routes');
const disputesRoutes = require('./modules/disputes/disputes.routes');
const systemRoutes = require('./modules/system/system.routes');

const app = express();

// Derrière Vercel / un reverse proxy, req.ip doit venir de X-Forwarded-For
// (sinon toutes les requêtes semblent venir du proxy et partagent le même quota).
app.set('trust proxy', 1);

// CORS : si CORS_ORIGINS est défini (liste séparée par des virgules), seuls
// ces domaines sont autorisés. Sinon, ouvert par défaut (pratique en local).
// Renseigne CORS_ORIGINS en production avec tes vraies URLs Vercel.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function isLocalDevelopmentOrigin(origin) {
  if (process.env.NODE_ENV === 'production' || !origin) return false;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
}

console.log('[CORS] allowedOrigins:', allowedOrigins);
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use(cors({
  origin: (origin, callback) => {
    const allowed = !origin
      || allowedOrigins.length === 0
      || allowedOrigins.includes(origin)
      || isLocalDevelopmentOrigin(origin);
    callback(null, allowed);
  }
}));

// `verify` conserve le corps brut de la requête dans req.rawBody — c'est
// indispensable pour vérifier la signature des webhooks FedaPay, qui se
// calcule sur le corps EXACT envoyé, avant tout parsing JSON.
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

app.use('/api/stores', storesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/disputes', disputesRoutes);
// /api/version et /api/health/ready : utilisés par le CI et la supervision après un déploiement.
app.use('/api', systemRoutes);
// /api/orders géré par ordersRoutes (compat client + merchant)

module.exports = app;
