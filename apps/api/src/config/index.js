// Configuration centralisée : un seul endroit pour lire l'environnement.
// Les valeurs sont lues À L'APPEL (getters) : dotenv est déjà chargé et les tests peuvent les modifier.
const num = (value, fallback) => {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(n) ? n : fallback;
};
const trimSlash = (s) => String(s).replace(/\/+$/, '');

module.exports = {
  // URL publique du site client (liens dans les e-mails, retour de paiement).
  // FRONT_URL est le nom historique ; CLIENT_APP_URL est accepté aussi.
  get frontUrl() { return trimSlash(process.env.FRONT_URL || process.env.CLIENT_APP_URL || 'http://localhost:8080'); },
  get merchantUrl() { return trimSlash(process.env.MERCHANT_APP_URL || 'http://localhost:5500'); },
  // Tarifs (XOF) : ligne unique de vérité, exposée aussi par GET /api/stores/pricing.
  get storeCreationFee() { return num(process.env.STORE_CREATION_FEE, 5000); },
  get storeMonthlyFee() { return num(process.env.STORE_MONTHLY_FEE, 3000); },
  // Après N jours sans confirmation du client, un colis expédié est confirmé automatiquement.
  get autoConfirmDays() { return num(process.env.AUTO_CONFIRM_DAYS, 7); },
  get passwordResetMinutes() { return num(process.env.PASSWORD_RESET_MINUTES, 30); },
};
