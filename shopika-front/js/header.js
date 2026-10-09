/**
 * Injecte le header commun (logo, nav, thème, langue, connexion) dans
 * n'importe quelle page publique. Chaque page inclut simplement :
 *   <div id="site-header"></div>
 *   <script src="js/header.js"></script>
 * et appelle renderHeader() (fait automatiquement au chargement).
 */
function renderHeader() {
  const mount = document.getElementById("site-header");
  if (!mount) return;

  const user = typeof Auth !== "undefined" ? Auth.currentUser() : null;
  const theme = localStorage.getItem("shopika_theme") || "light";
  document.documentElement.setAttribute("data-theme", theme);

  const ctasHtml = user
    ? `<button type="button" class="btn-brand" disabled title="Bientôt disponible" data-i18n="ctaCreateShop">Créer votre boutique</button>`
    : `<a href="inscription.html" class="btn-brand" data-i18n="ctaStart">Commencer gratuitement</a>
       <a href="connexion.html" class="btn-outline" data-i18n="ctaLogin">Se connecter</a>`;

  mount.innerHTML = `
    <header class="site-header">
      <div class="site-header-inner">
        <a href="index.html" class="site-logo">shop<span class="brandGradientText">ika</span></a>
        <nav class="site-navlinks">
          <a href="index.html#fonctionnalites" data-i18n="navFeatures">Fonctionnalités</a>
          <a href="index.html#tarifs" data-i18n="navPricing">Tarifs</a>
          <a href="index.html#themes" data-i18n="navThemes">Thèmes</a>
        </nav>
        <div class="site-right">
          <button class="icon-btn" id="themeToggleBtn" aria-label="Basculer le thème">${theme === "dark" ? "☀" : "☾"}</button>
          <div class="lang-toggle">
            <button data-lang-btn="fr" onclick="setLang('fr')">FR</button>
            <button data-lang-btn="en" onclick="setLang('en')">EN</button>
          </div>
          <div class="site-ctas">${ctasHtml}</div>
          <button class="hamburger" id="hamburgerBtn" aria-label="Ouvrir le menu" aria-expanded="false">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
      <div class="mobile-menu" id="mobileMenu">
        <a href="index.html#fonctionnalites" data-i18n="navFeatures">Fonctionnalités</a>
        <a href="index.html#tarifs" data-i18n="navPricing">Tarifs</a>
        <a href="index.html#themes" data-i18n="navThemes">Thèmes</a>
        <div class="mobile-ctas">${ctasHtml}</div>
      </div>
    </header>`;

  document.getElementById("themeToggleBtn").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("shopika_theme", next);
    document.getElementById("themeToggleBtn").textContent = next === "dark" ? "☀" : "☾";
  });

  const hamburger = document.getElementById("hamburgerBtn");
  const menu = document.getElementById("mobileMenu");
  hamburger.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    hamburger.classList.toggle("open", open);
    hamburger.setAttribute("aria-expanded", open ? "true" : "false");
  });

  applyTranslations();
}
document.addEventListener("DOMContentLoaded", renderHeader);
