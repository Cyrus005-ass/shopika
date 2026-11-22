// Utilisé UNIQUEMENT en local (npm run dev). En production sur Vercel,
// c'est api/index.js à la racine qui sert src/app.js directement, sans
// jamais appeler .listen() — Vercel gère l'écoute réseau lui-même.
const app = require('./app');

const missing = [];
if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
if (missing.length > 0) {
  console.error(`[DÉMARRAGE BLOQUÉ] Variables d'environnement manquantes : ${missing.join(', ')}`);
  console.error('Renseignez-les dans .env (inspirez-vous de .env.example) puis relancez.');
  process.exit(1);
}

const server = app.listen(process.env.PORT || 4000, () => {
  console.log(`API Shopika sur http://localhost:${process.env.PORT || 4000}`);
});

// Redémarrage / déploiement sans couper les requêtes en cours (voir lib/gracefulShutdown.js).
const { installGracefulShutdown } = require('./lib/gracefulShutdown');
const prisma = require('./lib/prisma');
installGracefulShutdown(server, { onClose: () => prisma.$disconnect(), drainDelayMs: process.env.SHUTDOWN_DRAIN_MS ? Number(process.env.SHUTDOWN_DRAIN_MS) : 0 });
