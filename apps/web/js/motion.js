/**
 * Shopika — module d'animation partagé (client + marchand).
 * Source unique : packages/shared/motion.js  →  copié par `npm run sync:shared`.
 * Aucune dépendance. Respecte prefers-reduced-motion partout.
 *
 *   Motion.countUp(el, 12500, { suffix: " FCFA" })
 *   Motion.animateNumbers(container)      // anime les nombres déjà écrits dans le HTML
 *   Motion.reveal(container)              // apparition au scroll (.mt-reveal : l'élément ; .mt-stagger : ses enfants en cascade)
 *   Motion.toast("Enregistré", "success") // success | error | info
 *   Motion.skeletonCards(8)               // HTML de cartes squelettes
 *   Motion.bump(el) / Motion.pop(el)      // micro-interactions (badge panier, cœur favori)
 */
(function (global) {
  "use strict";
  document.documentElement.classList.add("mt-js");
  var reduce = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fmt = function (n) { return Math.round(n).toLocaleString("fr-FR"); };

  function countUp(el, to, opts) {
    opts = opts || {};
    var prefix = opts.prefix || "", suffix = opts.suffix || "", dur = opts.dur || 1400, from = opts.from || 0;
    if (!el) return;
    if (reduce || from === to) { el.textContent = prefix + fmt(to) + suffix; return; }
    var start = performance.now();
    (function tick(now) {
      var p = Math.min((now - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + fmt(from + (to - from) * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }

  // Anime les nombres déjà rendus (ex. « 850 000 F », « 12 commandes ») dans les éléments ciblés.
  function animateNumbers(root, selector) {
    root = root || document;
    var nodes = root.querySelectorAll(selector || ".kpi-value, [data-animate-number]");
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.dataset.animated) return;
      var text = (el.textContent || "").trim();
      var m = text.match(/^([^\d-]*)(-?[\d\s\u00a0\u202f.,]*\d)(.*)$/);
      if (!m) return;
      var digits = m[2].replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
      var value = parseFloat(digits);
      if (!isFinite(value) || value === 0) return;
      el.dataset.animated = "1";
      countUp(el, value, { prefix: m[1], suffix: m[3], dur: 1100 });
    });
  }

  var io;
  function reveal(root) {
    root = root || document;
    var targets = root.querySelectorAll(".mt-reveal:not(.in), .mt-stagger:not(.in)");
    if (!targets.length) return;
    if (reduce || !("IntersectionObserver" in global)) {
      Array.prototype.forEach.call(targets, function (el) { el.classList.add("in"); });
      return;
    }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var el = e.target;
          io.unobserve(el);
          Array.prototype.forEach.call(el.children, function (c, i) { c.style.setProperty("--rd", i * 80 + "ms"); });
          el.classList.add("in");
        });
      }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
    }
    Array.prototype.forEach.call(targets, function (el) { io.observe(el); });
  }

  function toastHost() {
    var h = document.getElementById("mt-toasts");
    if (!h) {
      h = document.createElement("div");
      h.id = "mt-toasts";
      h.setAttribute("role", "status");
      h.setAttribute("aria-live", "polite");
      document.body.appendChild(h);
    }
    return h;
  }
  function toast(message, type, ms) {
    var el = document.createElement("div");
    el.className = "mt-toast mt-" + (type || "info");
    el.textContent = message;
    toastHost().appendChild(el);
    requestAnimationFrame(function () { el.classList.add("show"); });
    setTimeout(function () {
      el.classList.remove("show");
      setTimeout(function () { el.remove(); }, 300);
    }, ms || 3200);
  }

  function skeletonCards(n) {
    var one = '<div class="sk-card" aria-hidden="true"><div class="sk sk-thumb"></div><div class="sk sk-line"></div><div class="sk sk-line short"></div></div>';
    return '<div class="grid sk-grid">' + new Array((n || 8) + 1).join(one) + "</div>";
  }
  function skeletonRows(n) {
    var row = '<div class="sk sk-row" aria-hidden="true"></div>';
    return '<div class="sk-rows">' + new Array((n || 5) + 1).join(row) + "</div>";
  }

  function replay(el, cls) {
    if (!el || reduce) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
  function bump(el) { replay(el, "mt-bump"); }
  function pop(el) { replay(el, "mt-pop"); }

  // Barre de header qui se compacte au scroll (ajoute .is-scrolled sur <html>).
  function watchScroll() {
    var on = false;
    function update() {
      var s = (global.scrollY || 0) > 24;
      if (s !== on) { on = s; document.documentElement.classList.toggle("is-scrolled", s); }
    }
    global.addEventListener("scroll", update, { passive: true });
    update();
  }

  global.Motion = {
    reduce: reduce, fmt: fmt, countUp: countUp, animateNumbers: animateNumbers, reveal: reveal,
    toast: toast, skeletonCards: skeletonCards, skeletonRows: skeletonRows, bump: bump, pop: pop, watchScroll: watchScroll,
  };
  document.addEventListener("DOMContentLoaded", function () { watchScroll(); reveal(document); });
})(window);
