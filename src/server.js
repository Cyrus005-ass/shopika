// Utilisé UNIQUEMENT en local (npm run dev). En production sur Vercel,
// c'est api/index.js à la racine qui sert src/app.js directement, sans
// jamais appeler .listen() — Vercel gère l'écoute réseau lui-même.
const app = require('./app');

app.listen(process.env.PORT || 4000, () => {
  console.log(`API Shopika sur http://localhost:${process.env.PORT || 4000}`);
});
