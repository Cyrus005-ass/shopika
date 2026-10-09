async function renderPopularProducts() {
  const mount = document.getElementById("popularProducts");
  if (!mount) return;
  await Store.primeFavorites();
  let products = [];
  try { products = await Store.getPopularProducts(8); } catch { products = []; }
  if (products.length === 0) {
    mount.innerHTML = `<p class="empty-state" data-i18n="emptyProducts">Aucun produit publié pour l'instant.</p>`;
    applyTranslations();
    return;
  }
  mount.innerHTML = `<div class="grid">${products.map(productCardHtml).join("")}</div>`;
}
document.addEventListener("DOMContentLoaded", renderPopularProducts);
