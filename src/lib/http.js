// Petit helper pour uniformiser les réponses d'erreur.
//
// Historique : le frontend marchand lit `data.error`, le frontend client lit
// `data.message` (voir js/api.js côté client). Plutôt que de choisir un seul
// format et casser un des deux frontends, on envoie systématiquement les
// deux clés. `code` est optionnel et sert pour des cas précis gérés
// spécifiquement côté frontend (ex: "EMAIL_NOT_VERIFIED").
function sendError(res, status, message, extra = {}) {
  return res.status(status).json({ error: message, message, ...extra });
}

module.exports = { sendError };
