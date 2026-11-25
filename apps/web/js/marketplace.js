/**
 * Marketplace = annuaire des vraies boutiques créées par les marchands.
 * Un seul champ de recherche : trouve une boutique par SON NOM, ou par le
 * nom d'un produit qu'elle vend. Toute la recherche se fait côté serveur
 * (GET /marketplace/shops?search=...), pour rester rapide même avec des
 * milliers de boutiques.
 */
// Les noms/descriptions de boutiques sont saisis par les marchands : toujours échappés avant innerHTML.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function shopCardHtml(shop, matchedProduct) {
  return `
    <a href="boutique.html?slug=${encodeURIComponent(shop.slug)}" class="shop-card">
      <div class="shop-card-top">
        <div class="shop-logo">${esc(shop.name.slice(0, 2).toUpperCase())}</div>
        <div>
          <div class="shop-name">${esc(shop.name)}</div>
          <div class="shop-meta">${esc([shop.city, shop.country].filter(Boolean).join(", "))} · ★ ${Number(shop.rating || 0).toFixed(1)}</div>
        </div>
      </div>
      ${shop.description ? `<p class="shop-desc">${esc(shop.description)}</p>` : ""}
      ${matchedProduct ? `<span class="shop-match-tag" data-i18n="marketMatchingProduct">Produit trouvé</span> : ${esc(matchedProduct.name)}` : ""}
    </a>`;
}

let searchToken = 0;
async function renderMarketplace() {
  const query = document.getElementById("marketSearchInput").value.trim();
  const myToken = ++searchToken;
  const grid = document.getElementById("shopGrid");
  grid.innerHTML = window.Motion ? Motion.skeletonCards(6) : `<p class="market-empty" data-i18n="marketLoading">Recherche…</p>`;

  let results = [];
  try { results = await Store.searchShops(query); } catch { results = []; }
  if (myToken !== searchToken) return; // une recherche plus récente est déjà partie

  if (results.length === 0) {
    grid.innerHTML = `<p class="market-empty" data-i18n="marketEmpty">Aucune boutique ne correspond à votre recherche.</p>`;
  } else {
    grid.innerHTML = results.map((r) => shopCardHtml(r.shop, r.matchedProduct)).join("");
    if (window.Motion) { grid.classList.add("mt-stagger"); grid.classList.remove("in"); Motion.reveal(grid); }
  }
  applyTranslations();
}

document.addEventListener("DOMContentLoaded", () => {
  renderMarketplace();
  let debounce;
  document.getElementById("marketSearchInput").addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(renderMarketplace, 300);
  });
});
