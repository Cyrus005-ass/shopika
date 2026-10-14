require('dotenv').config();
const express = require('express');
const cors = require('cors');

const storesRoutes = require('./routes/stores.routes');
const authRoutes = require('./routes/auth.routes');
const productsRoutes = require('./routes/products.routes');
const ordersRoutes = require('./routes/orders.routes');
const categoriesRoutes = require('./routes/categories.routes');
const paymentsRoutes = require('./routes/payments.routes');
const adminRoutes = require('./routes/admin.routes');
const supportRoutes = require('./routes/support.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const favoritesRoutes = require('./routes/favorites.routes');
const marketplaceRoutes = require('./routes/marketplace.routes');
const cronRoutes = require('./routes/cron.routes');

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

console.log('[CORS] allowedOrigins:', allowedOrigins);

app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true }));

// `verify` conserve le corps brut de la requête dans req.rawBody — c'est
// indispensable pour vérifier la signature des webhooks FedaPay, qui se
// calcule sur le corps EXACT envoyé, avant tout parsing JSON.
app.use(express.json());

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
// /api/orders géré par ordersRoutes (compat client + merchant)

module.exports = app;
