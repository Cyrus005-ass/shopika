/**
 * Coquille commune de l'espace client (/app/*.html) : vérifie que la
 * personne est connectée (sinon redirige vers connexion.html), affiche la
 * sidebar avec ses vraies infos de compte, gère le tiroir mobile.
 */
function renderAppShell(activePage) {
  const user = Auth.requireAuth("../connexion.html");
  if (!user) return null;

  const initials = (user.firstName[0] + (user.lastName[0] || "")).toUpperCase();
  const NAV = [
    { href: "index.html", key: "home", label: "navHome" },
    { href: "../marketplace.html", key: "marketplace", label: "navMarketplace" },
    { href: "favoris.html", key: "favoris", label: "navFavorites" },
    { href: "commandes.html", key: "commandes", label: "navOrders" },
    { href: "panier.html", key: "panier", label: "navCart" },
    { href: "profil.html", key: "profil", label: "navProfile" },
    { href: "parametres.html", key: "parametres", label: "navSettings" },
  ];

  document.getElementById("appSidebar").innerHTML = `
    <div class="app-logo">shop<span class="brandGradientText">ika</span></div>
    <nav class="app-nav">
      ${NAV.map((item) => `<a href="${item.href}" class="${item.key === activePage ? "active" : ""}" data-i18n="${item.label}"></a>`).join("")}
    </nav>
    <div class="app-userbox">
      <div class="app-avatar">${initials}</div>
      <div style="flex:1; min-width:0;">
        <div class="app-username">${user.firstName} ${user.lastName}</div>
        <div class="app-usersub">${user.city || user.email}</div>
      </div>
      <button class="app-logout" id="logoutBtn" title="Se déconnecter">⎋</button>
    </div>`;

  document.getElementById("logoutBtn").addEventListener("click", () => {
    Auth.logout();
    window.location.href = "../connexion.html";
  });

  // Barre supérieure : thème + langue, accessibles depuis n'importe quelle page de l'espace client.
  const contentEl = document.querySelector(".app-content");
  if (contentEl && !document.getElementById("appTopbar")) {
    const theme = localStorage.getItem("shopika_theme") || "light";
    document.documentElement.setAttribute("data-theme", theme);
    const topbar = document.createElement("div");
    topbar.className = "app-topbar";
    topbar.id = "appTopbar";
    topbar.innerHTML = `
      <button class="icon-btn" id="appThemeToggle" aria-label="Basculer le thème">${theme === "dark" ? "☀" : "☾"}</button>
      <div class="lang-toggle">
        <button data-lang-btn="fr" onclick="setLang('fr')">FR</button>
        <button data-lang-btn="en" onclick="setLang('en')">EN</button>
      </div>`;
    contentEl.insertBefore(topbar, contentEl.firstChild);
    document.getElementById("appThemeToggle").addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("shopika_theme", next);
      document.getElementById("appThemeToggle").textContent = next === "dark" ? "☀" : "☾";
    });
  }

  const hamburger = document.getElementById("appHamburgerBtn");
  const sidebar = document.getElementById("appSidebar");
  const backdrop = document.getElementById("appShellBackdrop");
  if (hamburger) {
    hamburger.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      backdrop.classList.toggle("show");
    });
    backdrop.addEventListener("click", () => {
      sidebar.classList.remove("open");
      backdrop.classList.remove("show");
    });
  }

  applyTranslations();
  return user;
}
