/**
 * Fabrique le HTML d'une carte produit, réutilisée par l'accueil, la
 * marketplace, la page boutique, les favoris, etc.
 *
 * Chaque `product` vient de l'API et contient déjà `product.shop`
 * (id, name, slug...) — pas besoin d'un second appel réseau par carte.
 * Avant d'appeler productCardHtml() en boucle sur une page, on appelle une
 * fois `await Store.primeFavorites()` pour que le cœur ♥ soit correct.
 */
function formatPrice(n) {
  return n.toLocaleString("fr-FR").replace(/,/g, " ") + " FCFA";
}
// Échappe un texte avant de l'insérer dans du HTML (noms de produits, couleurs…
// saisis par les marchands : ne jamais les injecter tels quels dans innerHTML).
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function productCardHtml(p) {
  const discount = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : null;
  const isFav = Store.isFavoriteCached(p.id);
  return `
    <a href="${location.pathname.includes("/app/") ? "../" : ""}produit.html?id=${p.id}" class="p-card">
      <div class="p-thumb">
        ${discount ? `<span class="p-promo-tag">-${discount}%</span>` : ""}
        <button type="button" class="p-fav-btn ${isFav ? "active" : ""}" onclick="event.preventDefault(); toggleFavoriteFromCard('${p.id}', this)">♥</button>
      </div>
      <div class="p-body">
        <div class="p-name">${escapeHtml(p.name)}</div>
        <div class="p-shop">${p.shop ? escapeHtml(p.shop.name) : ""}</div>
        <div class="p-price-row">
          <span class="p-price">${formatPrice(p.price)}</span>
          ${p.oldPrice ? `<span class="p-price-old">${formatPrice(p.oldPrice)}</span>` : ""}
        </div>
      </div>
    </a>`;
}
async function toggleFavoriteFromCard(productId, btnEl) {
  const user = Auth.currentUser();
  if (!user) { window.location.href = (location.pathname.includes("/app/") ? "../" : "") + "connexion.html"; return; }
  await Store.toggleFavorite(productId);
  btnEl.classList.toggle("active");
}
