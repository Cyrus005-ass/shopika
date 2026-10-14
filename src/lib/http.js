// Petit helper pour uniformiser les rÃ©ponses d'erreur.
//
// Historique : le frontend marchand lit `data.error`, le frontend client lit
// `data.message` (voir js/api.js cÃ£tÃ© client). PlutÃ´t que de choisir un seul
// format et casser un des deux frontends, on envoie systÃ©matiquement les
// deux clÃ©s. `code` est optionnel et sert pour des cas prÃ©cis gÃ©rÃ©s
// spÃ©cifiquement cÃ´tÃ© frontend (ex: "EMAIL_NOT_VERIFIED").
function sendError(res, status, message, extra = {}) {
  console.log('[http.sendError] status:', status, 'message:', message);
  return res.status(status).json({ error: message, message, ...extra });
}

module.exports = { sendError };