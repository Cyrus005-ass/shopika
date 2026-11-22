/**
 * Authentification — parle uniquement au vrai backend (voir js/config.js).
 *
 * Le mot de passe n'est jamais haché ni vérifié ici : il est envoyé une
 * seule fois en clair via HTTPS jusqu'au backend, qui applique bcrypt et
 * fait toutes les vérifications. Le code de vérification à 6 chiffres est
 * généré et envoyé par e-mail par le backend (POST /auth/register déclenche
 * cet envoi automatiquement côté serveur) — plus rien de tout ça ne vit
 * dans le navigateur.
 *
 * Après connexion/vérification, on garde en cache local (localStorage) :
 *  - le token de session (Api.TOKEN_KEY)
 *  - une copie du profil utilisateur (Api.USER_CACHE_KEY), uniquement pour
 *    afficher l'interface instantanément (nom dans le header, sidebar...)
 *    sans attendre un aller-retour réseau à chaque page. Le backend reste
 *    la seule source de vérité : si le token n'est plus valide, apiFetch()
 *    (voir js/api.js) déconnecte automatiquement la personne.
 *
 * ---- Contrat API attendu côté backend ----
 *  POST /auth/register     { firstName, lastName, email, password } → { email }
 *                           (envoie automatiquement le code par e-mail)
 *  POST /auth/verify-email { email, code }  → { token, user }
 *  POST /auth/resend-code  { email }        → { ok:true } ou 429 { message, secondsRemaining }
 *  POST /auth/login        { email, password } → { token, user }
 *                           ou 403 { code:"EMAIL_NOT_VERIFIED" } si pas encore vérifié
 *  PATCH /auth/me          { firstName?, lastName?, phone?, address?, country?, city?, twoFactorOn? } → { user }
 *  POST /auth/change-password { currentPassword, newPassword } → { ok:true }
 */

const Auth = {
  async register({ firstName, lastName, email, password }) {
    return Api.apiFetch("/auth/register", { method: "POST", auth: false, body: { firstName, lastName, email, password } });
  },

  async verifyEmail({ email, code }) {
    const { token, user } = await Api.apiFetch("/auth/verify-email", { method: "POST", auth: false, body: { email, code } });
    localStorage.setItem(Api.TOKEN_KEY, token);
    localStorage.setItem(Api.USER_CACHE_KEY, JSON.stringify(user));
    return user;
  },

  async resendCode(email) {
    return Api.apiFetch("/auth/resend-code", { method: "POST", auth: false, body: { email } });
  },

  async login({ email, password }) {
    const { token, user } = await Api.apiFetch("/auth/login", { method: "POST", auth: false, body: { email, password } });
    localStorage.setItem(Api.TOKEN_KEY, token);
    localStorage.setItem(Api.USER_CACHE_KEY, JSON.stringify(user));
    return user;
  },

  async updateProfile(patch) {
    const { user } = await Api.apiFetch("/auth/me", { method: "PATCH", body: patch });
    localStorage.setItem(Api.USER_CACHE_KEY, JSON.stringify(user));
    return user;
  },

  async changePassword({ currentPassword, newPassword }) {
    return Api.apiFetch("/auth/change-password", { method: "POST", body: { currentPassword, newPassword } });
  },

  logout() {
    localStorage.removeItem(Api.TOKEN_KEY);
    localStorage.removeItem(Api.USER_CACHE_KEY);
  },

  currentUser() {
    if (!Api.getToken()) return null;
    try { return JSON.parse(localStorage.getItem(Api.USER_CACHE_KEY)); } catch { return null; }
  },

  requireAuth(redirectTo) {
    const user = this.currentUser();
    if (!user) {
      window.location.href = redirectTo || "connexion.html";
      return null;
    }
    return user;
  },
};

window.Auth = Auth;
