/**
 * Couche de données de Shopika.
 *
 * Tout ce qui est catalogue, comptes, favoris et commandes vient
 * désormais du VRAI backend (voir js/config.js pour l'URL de l'API).
 *
 * Seul le PANIER reste en localStorage : c'est volontaire et normal pour
 * un site marchand (une personne doit pouvoir ajouter des articles avant
 * même de créer un compte) — ce n'est pas de la "fausse donnée", juste une
 * mémoire de navigateur temporaire, comme sur n'importe quel vrai site
 * e-commerce. Elle ne contient que { productId, quantity }, jamais de prix
 * ni d'infos boutique : au moment de payer, le panier est toujours revérifié
 * contre le backend (prix, stock, frais de livraison à jour).
 *
 * ---- Contrat API attendu côté backend (à respecter quand tu le construiras) ----
 *
 *  GET  /marketplace/shops?search=texte
 *       → [{ shop, matchedProduct }]  (matchedProduct = null si le nom de
 *         la boutique correspond directement, sinon le produit trouvé)
 *  GET  /marketplace/shops/:slug
 *       → { shop }  (404 si boutique absente ou non publiée)
 *  GET  /marketplace/products?shopId=...&search=...&sort=popular&limit=8
 *       → [product, ...]   chaque produit inclut product.shop = { id, name,
 *         slug, city, country, shippingFee } (évite un aller-retour en plus)
 *  GET  /marketplace/products/:id
 *       → product (avec product.shop embarqué comme ci-dessus)
 *  GET  /marketplace/products?ids=id1,id2,id3
 *       → [product, ...]   (utilisé pour recharger le panier)
 *
 *  GET  /favorites/ids                (auth requise)
 *       → [productId, ...]            (liste légère, pour l'état du cœur ♥)
 *  GET  /favorites                    (auth requise)
 *       → [product, ...]              (produits complets, pour la page Favoris)
 *  POST /favorites/:productId         (auth requise) → { ok: true }
 *  DELETE /favorites/:productId       (auth requise) → { ok: true }
 *
 *  POST /orders                       (auth requise)
 *       body: { shopId, items:[{productId, quantity}], address, city,
 *               country, phone, paymentMethod }
 *       → { order }  (le backend recalcule tout depuis la base : prix,
 *         stock, frais de livraison DÉFINIS PAR LE MARCHAND sur sa boutique
 *         — jamais un montant envoyé par le navigateur)
 *  GET  /orders                       (auth requise) → [order, ...] (les miennes)
 *  GET  /orders/:id                   (auth requise) → order
 *  POST /orders/:id/confirm-reception (auth requise) → { order }
 *  POST /orders/:id/dispute           (auth requise) → { order }
 */

const CART_KEY = "shopika_cart";
let favoriteIdsCache = null; // Set<string> — rempli par Store.primeFavorites()

function readCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
}
function writeCart(cart) { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }

const Store = {
  /* ---------------- Marketplace (public) ---------------- */
  async searchShops(query) {
    const qs = query ? `?search=${encodeURIComponent(query)}` : "";
    return Api.apiFetch(`/marketplace/shops${qs}`, { auth: false });
  },
  async getShopBySlug(slug) {
    try { return await Api.apiFetch(`/marketplace/shops/${encodeURIComponent(slug)}`, { auth: false }); }
    catch { return null; }
  },
  async getProductsByShop(shopId) {
    return Api.apiFetch(`/marketplace/products?shopId=${encodeURIComponent(shopId)}`, { auth: false });
  },
  async getPopularProducts(limit = 8) {
    return Api.apiFetch(`/marketplace/products?sort=popular&limit=${limit}`, { auth: false });
  },
  async getProductById(id) {
    try { return await Api.apiFetch(`/marketplace/products/${encodeURIComponent(id)}`, { auth: false }); }
    catch { return null; }
  },
  async getProductsByIds(ids) {
    if (!ids.length) return [];
    return Api.apiFetch(`/marketplace/products?ids=${ids.map(encodeURIComponent).join(",")}`, { auth: false });
  },

  /* ---------------- Favoris (compte requis) ---------------- */
  async primeFavorites() {
    if (!Auth.currentUser()) { favoriteIdsCache = new Set(); return favoriteIdsCache; }
    try {
      const ids = await Api.apiFetch(`/favorites/ids`);
      favoriteIdsCache = new Set(ids);
    } catch { favoriteIdsCache = new Set(); }
    return favoriteIdsCache;
  },
  isFavoriteCached(productId) {
    return favoriteIdsCache ? favoriteIdsCache.has(productId) : false;
  },
  async toggleFavorite(productId) {
    const isFav = this.isFavoriteCached(productId);
    await Api.apiFetch(`/favorites/${encodeURIComponent(productId)}`, { method: isFav ? "DELETE" : "POST" });
    if (!favoriteIdsCache) favoriteIdsCache = new Set();
    if (isFav) favoriteIdsCache.delete(productId); else favoriteIdsCache.add(productId);
  },
  async getFavoriteProducts() {
    return Api.apiFetch(`/favorites`);
  },

  /* ---------------- Panier (local, avant paiement) ---------------- */
  getCart() { return readCart(); },
  addToCart(productId, qty) {
    const cart = readCart();
    const existing = cart.find((l) => l.productId === productId);
    if (existing) existing.quantity += qty; else cart.push({ productId, quantity: qty });
    writeCart(cart);
  },
  setCartQuantity(productId, qty) {
    writeCart(readCart().map((l) => (l.productId === productId ? { ...l, quantity: Math.max(1, qty) } : l)));
  },
  removeFromCart(productId) { writeCart(readCart().filter((l) => l.productId !== productId)); },
  clearCart() { writeCart([]); },

  /* ---------------- Commandes (compte requis) ---------------- */
  async createOrder(payload) { return Api.apiFetch(`/orders`, { method: "POST", body: payload }); },
  async getMyOrders() { return Api.apiFetch(`/orders`); },
  async getOrderById(id) {
    try { return await Api.apiFetch(`/orders/${encodeURIComponent(id)}`); }
    catch { return null; }
  },
  async confirmReception(id) { return Api.apiFetch(`/orders/${encodeURIComponent(id)}/confirm-reception`, { method: "POST" }); },
  async openDispute(id) { return Api.apiFetch(`/orders/${encodeURIComponent(id)}/dispute`, { method: "POST" }); },
};

window.Store = Store;
