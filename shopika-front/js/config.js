/**
 * URL de l'API backend Shopika.
 * Détection automatique :
 *   - localhost / 127.0.0.1  -> http://localhost:4000/api
 *   - autre (production)       -> https://shopika-api-indol.vercel.app/api
 *
 * URL de l'espace marchand (pour redirection après vérification).
 *   - localhost / 127.0.0.1  -> http://localhost:5500
 *   - autre (production)       -> https://shopika-marchand.vercel.app
 */
window.SHOPIKA_CONFIG = {
  API_BASE_URL: (() => {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:4000/api';
    }
    return 'https://shopika-api-indol.vercel.app/api';
  })(),
  MERCHANT_APP_URL: (() => {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:5500';
    }
    return 'https://shopika-marchand.vercel.app';
  })(),
};
