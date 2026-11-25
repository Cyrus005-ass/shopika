/**
 * Configuration de l'espace marchand — UN SEUL endroit pour
 * changer l'URL de l'API.
 * Détection automatique :
 *   - localhost / 127.0.0.1  -> http://localhost:4000/api
 *   - autre (production)       -> https://shopika-api-indol.vercel.app/api
 */
window.SHOPIKA_MERCHANT_CONFIG = {
  API_BASE_URL: (() => {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:4000/api';
    }
    return 'https://shopika-api-indol.vercel.app/api';
  })(),
  // Site client (boutiques publiques) : sert au bouton « Voir ma boutique » / aperçu des thèmes.
  // Local : `npm run dev:all` sert le front client sur le port 3000.
  // Production : adapter à l'URL réelle du front.
  FRONT_URL: (() => {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3000';
    }
    return 'https://shopika-shopika-front.vercel.app';
  })(),
};
