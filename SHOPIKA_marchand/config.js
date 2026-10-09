/**
 * Configuration de l'espace marchand — UN SEUL endroit pour
 * changer l'URL de l'API (ici en local ; en production,
 * l'URL déployée de SHOPIKA_api, ex: https://api.shopika.com/api).
 * Chargé AVANT auth.js / views.js / router.js dans index.html
 * et login.html.
 */
window.SHOPIKA_MERCHANT_CONFIG = {
  API_BASE_URL: "http://localhost:4000/api",
};
