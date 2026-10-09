/**
 * Petit client HTTP partagé par store.js et auth.js. Tout appel au backend
 * passe par apiFetch() : ajoute automatiquement le token de connexion,
 * lit la réponse JSON, transforme une erreur HTTP en Error JS classique
 * (message lisible, propriétés .code / .status si le backend les fournit),
 * et déconnecte automatiquement la personne si le token n'est plus valide.
 *
 * Contrat attendu côté backend pour les erreurs :
 *   { "message": "texte lisible pour l'utilisateur", "code": "OPTIONNEL" }
 */
const TOKEN_KEY = "shopika_token";
const USER_CACHE_KEY = "shopika_user";

function apiUrl(path) {
  return window.SHOPIKA_CONFIG.API_BASE_URL.replace(/\/$/, "") + path;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function apiFetch(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (auth && token) headers["Authorization"] = "Bearer " + token;

  let res;
  try {
    res = await fetch(apiUrl(path), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new Error(
      getLang() === "fr"
        ? "Impossible de joindre le serveur. Vérifiez votre connexion."
        : "Could not reach the server. Check your connection."
    );
  }

  // Session expirée ou invalide : on déconnecte proprement.
  if (res.status === 401 && auth) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
    const isApp = location.pathname.includes("/app/");
    window.location.href = (isApp ? "../" : "") + "connexion.html";
    return new Promise(() => {}); // stoppe le code appelant, la redirection est en cours
  }

  let data = null;
  try { data = await res.json(); } catch { /* réponse vide, ex: 204 */ }

  if (!res.ok) {
    const err = new Error((data && data.message) || "Une erreur est survenue.");
    if (data && data.code) err.code = data.code;
    if (data && data.secondsRemaining) err.secondsRemaining = data.secondsRemaining;
    err.status = res.status;
    throw err;
  }
  return data;
}

window.Api = { apiFetch, getToken, TOKEN_KEY, USER_CACHE_KEY };
