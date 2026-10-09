/**
 * Marketplace = annuaire des vraies boutiques créées par les marchands.
 * Un seul champ de recherche : trouve une boutique par SON NOM, ou par le
 * nom d'un produit qu'elle vend. Toute la recherche se fait côté serveur
 * (GET /marketplace/shops?search=...), pour rester rapide même avec des
 * milliers de boutiques.
 */
function shopCardHtml(shop, matchedProduct) {
  return `
    <a href="boutique.html?slug=${shop.slug}" class="shop-card">
      <div class="shop-card-top">
        <div class="shop-logo">${shop.name.slice(0, 2).toUpperCase()}</div>
        <div>
          <div class="shop-name">${shop.name}</div>
          <div class="shop-meta">${shop.city}, ${shop.country} · ★ ${shop.rating.toFixed(1)}</div>
        </div>
      </div>
      ${shop.description ? `<p class="shop-desc">${shop.description}</p>` : ""}
      ${matchedProduct ? `<span class="shop-match-tag" data-i18n="marketMatchingProduct">Produit trouvé</span> : ${matchedProduct.name}` : ""}
    </a>`;
}

let searchToken = 0;
async function renderMarketplace() {
  const query = document.getElementById("marketSearchInput").value.trim();
  const myToken = ++searchToken;
  const grid = document.getElementById("shopGrid");
  grid.innerHTML = `<p class="market-empty" data-i18n="marketLoading">Recherche…</p>`;

  let results = [];
  try { results = await Store.searchShops(query); } catch { results = []; }
  if (myToken !== searchToken) return; // une recherche plus récente est déjà partie

  if (results.length === 0) {
    grid.innerHTML = `<p class="market-empty" data-i18n="marketEmpty">Aucune boutique ne correspond à votre recherche.</p>`;
  } else {
    grid.innerHTML = results.map((r) => shopCardHtml(r.shop, r.matchedProduct)).join("");
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
