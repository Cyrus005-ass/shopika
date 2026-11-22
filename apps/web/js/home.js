async function renderPopularProducts() {
  const mount = document.getElementById("popularProducts");
  if (!mount) return;
  if (window.Motion) mount.innerHTML = Motion.skeletonCards(8);
  await Store.primeFavorites();
  let products = [];
  try { products = await Store.getPopularProducts(8); } catch { products = []; }
  if (products.length === 0) {
    mount.innerHTML = `<p class="empty-state" data-i18n="emptyProducts">Aucun produit publié pour l'instant.</p>`;
    applyTranslations();
    return;
  }
  mount.innerHTML = `<div class="grid">${products.map(productCardHtml).join("")}</div>`;
  if (window.observeProductGrid) window.observeProductGrid();
}
document.addEventListener("DOMContentLoaded", renderPopularProducts);

/* ===== Animations de la page d'accueil ===== */
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fmt = (n) => Math.round(n).toLocaleString("fr-FR");

  // Compteur animé
  function countUp(el, to, opts = {}) {
    const { prefix = "", suffix = "", dur = 1600, from = 0 } = opts;
    if (reduce) { el.textContent = prefix + fmt(to) + suffix; return; }
    const start = performance.now();
    (function tick(now) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + fmt(from + (to - from) * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }

  // Hero : ventes en direct + notification de commande qui tourne
  function initHeroLive() {
    const sales = document.getElementById("liveSales");
    const toast = document.getElementById("orderToast");
    const sub = document.getElementById("orderToastSub");
    if (!sales || !toast || !sub) return;
    const orders = [
      { n: "Awa", c: "Dakar", a: 25000 }, { n: "Koffi", c: "Abidjan", a: 12500 },
      { n: "Mariam", c: "Bamako", a: 38000 }, { n: "Jean", c: "Douala", a: 9500 },
      { n: "Fatou", c: "Cotonou", a: 17000 }, { n: "Yao", c: "Lomé", a: 22500 },
    ];
    let total = 482500, i = 0;
    const show = (o) => { sub.textContent = `${o.n} · ${o.c} · +${fmt(o.a)} FCFA`; };
    show(orders[0]);
    setTimeout(() => countUp(sales, total, { suffix: " FCFA", dur: 1800 }), 500);
    if (reduce) return;
    setInterval(() => {
      if (document.hidden) return;
      i = (i + 1) % orders.length;
      const o = orders[i];
      show(o);
      toast.classList.remove("ping"); void toast.offsetWidth; toast.classList.add("ping");
      const from = total; total += o.a;
      countUp(sales, total, { suffix: " FCFA", dur: 900, from });
    }, 3800);
  }

  // Défilement continu des enseignes
  function initMarquee() {
    const row = document.getElementById("trustRow");
    if (!row || reduce) return;
    const mask = document.createElement("div");
    mask.className = "trust-mask";
    row.parentNode.insertBefore(mask, row);
    mask.appendChild(row);
    const items = Array.from(row.children);
    // 6 séries identiques : l'animation va de 0 à -50 % (3 séries), donc la boucle est continue même sur grand écran
    for (let k = 0; k < 5; k++) items.forEach((el) => { const c = el.cloneNode(true); c.setAttribute("aria-hidden", "true"); row.appendChild(c); });
    row.classList.add("marquee");
  }

  // Apparition au défilement
  let io;
  function observe(el) { if (io) io.observe(el); }
  function initReveal() {
    if (reduce || !("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal,[data-stagger],.steps,.roi-card").forEach((el) => el.classList.add("in"));
      document.querySelectorAll("[data-count]").forEach((el) => countUp(el, +el.dataset.count, { prefix: el.dataset.prefix, suffix: el.dataset.suffix }));
      return;
    }
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        io.unobserve(el);
        Array.from(el.children).forEach((c, idx) => c.style.setProperty("--rd", `${idx * 90}ms`));
        el.classList.add("in");
        el.querySelectorAll("[data-count]").forEach((n) => countUp(n, +n.dataset.count, { prefix: n.dataset.prefix, suffix: n.dataset.suffix, dur: 2000 }));
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
    document.querySelectorAll(".reveal,[data-stagger],.steps,.roi-card").forEach(observe);
  }
  window.observeProductGrid = function () {
    const g = document.querySelector("#popularProducts .grid");
    if (!g) return;
    if (reduce || !io) { g.classList.add("in"); return; }
    observe(g);
  };

  // Tarifs réels (GET /stores/pricing) : la page n'affiche jamais un prix inventé.
  async function initPricing() {
    try {
      const pr = await Api.apiFetch("/stores/pricing", { auth: false });
      const set = (id, v) => { const el = document.getElementById(id); if (el && Number.isFinite(+v)) el.textContent = fmt(+v); };
      set("priceCreation", pr.creationFee);
      set("priceMonthly", pr.monthlyFee);
    } catch { /* on garde les valeurs par défaut du HTML */ }
  }

  // « Ils vendent déjà avec Shopika » : de vraies boutiques publiées. S'il n'y en a pas, la section reste cachée.
  async function initTrust() {
    const section = document.getElementById("trustSection");
    const row = document.getElementById("trustRow");
    if (!section || !row) return false;
    try {
      const shops = await Api.apiFetch("/stores/search", { auth: false });
      const names = (Array.isArray(shops) ? shops : []).map((s) => s.name).filter(Boolean).slice(0, 8);
      if (!names.length) return false;
      row.innerHTML = names.map((n) => `<span>${String(n).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))}</span>`).join("");
      section.hidden = false;
      return true;
    } catch { return false; }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initHeroLive(); initReveal(); initPricing();
    initTrust().then((ok) => { if (ok) initMarquee(); });
  });
})();
