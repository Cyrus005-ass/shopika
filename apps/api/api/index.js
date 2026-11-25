// Vercel exécute ce fichier comme une fonction serverless. On lui donne
// directement l'app Express de src/app.js (qui n'appelle jamais .listen()) :
// Vercel se charge d'écouter le réseau et de router chaque requête ici.
module.exports = require('../src/app');
