/**
 * Fil de discussion d'un litige — partagé par le site client et l'espace marchand.
 * Source unique : packages/shared/dispute-thread.js  →  copié par `npm run sync:shared`.
 *
 *   DisputeThread.render(element, dispute, {
 *     send(body, attachmentUrl)  → Promise   envoie un message
 *     upload(file)               → Promise<string>   envoie une photo, renvoie son URL
 *     reload()                   → Promise   recharge le litige puis rappelle render()
 *   })
 * `dispute` : objet renvoyé par GET /api/disputes/... (voir apps/api/src/modules/disputes).
 */
(function (global) {
  "use strict";
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var ROLE = { client: "Client", marchand: "Marchand", admin: "Équipe Shopika" };
  var STATUS = { ouvert: "Litige en cours", resolu_marchand: "Tranché en faveur du marchand", resolu_client: "Tranché en faveur du client" };
  var money = function (n) { return Math.round(Number(n) || 0).toLocaleString("fr-FR") + " FCFA"; };
  var when = function (d) { return new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };
  var safeUrl = function (u) { return /^https?:\/\//i.test(u || "") ? u : ""; };

  function messageHtml(m, viewerRole) {
    var mine = m.authorRole === viewerRole;
    var img = safeUrl(m.attachmentUrl);
    return '<div class="dsp-msg ' + (mine ? "mine" : "theirs") + " role-" + esc(m.authorRole) + '">' +
      '<div class="dsp-who">' + esc(ROLE[m.authorRole] || m.authorRole) + (m.authorName && m.authorRole !== "admin" ? " · " + esc(m.authorName) : "") + " · " + when(m.createdAt) + "</div>" +
      (m.body ? '<div class="dsp-body">' + esc(m.body) + "</div>" : "") +
      (img ? '<a href="' + esc(img) + '" target="_blank" rel="noopener"><img class="dsp-img" src="' + esc(img) + '" alt="Pièce jointe" loading="lazy"></a>' : "") +
      "</div>";
  }

  function render(el, d, api) {
    var open = d.status === "ouvert";
    el.innerHTML =
      '<div class="dsp">' +
        '<div class="dsp-head"><div><div class="dsp-title">' + esc(d.reasonLabel) + "</div>" +
        '<div class="dsp-sub">Commande #' + esc(d.orderId) + (d.store ? " · " + esc(d.store.name) : "") + " · " + money(d.amount) + "</div></div>" +
        '<span class="dsp-badge ' + (open ? "open" : "closed") + '">' + esc(STATUS[d.status] || d.status) + "</span></div>" +
        '<div class="dsp-desc">' + esc(d.description) + "</div>" +
        (d.adminNote ? '<div class="dsp-decision"><strong>Décision de Shopika :</strong> ' + esc(d.adminNote) + "</div>" : "") +
        '<div class="dsp-msgs" id="dspMsgs">' + (d.messages.length ? d.messages.map(function (m) { return messageHtml(m, d.viewerRole); }).join("") : '<p class="dsp-empty">Aucun message pour l’instant.</p>') + "</div>" +
        (open
          ? '<form class="dsp-form"><textarea maxlength="2000" rows="2" placeholder="Votre message…" aria-label="Votre message"></textarea>' +
            '<div class="dsp-actions"><label class="dsp-attach">📎 Photo<input type="file" accept="image/jpeg,image/png,image/webp" hidden></label>' +
            '<span class="dsp-file"></span><span class="dsp-error" role="alert"></span><button type="submit" class="dsp-send">Envoyer</button></div></form>'
          : "") +
      "</div>";

    var box = el.querySelector("#dspMsgs");
    if (box) box.scrollTop = box.scrollHeight;
    var form = el.querySelector(".dsp-form");
    if (!form) return;
    var input = form.querySelector('input[type="file"]');
    var fileLabel = form.querySelector(".dsp-file");
    var errBox = form.querySelector(".dsp-error");
    input.addEventListener("change", function () {
      var f = input.files[0];
      if (f && f.size > 5 * 1024 * 1024) { errBox.textContent = "Photo trop lourde (5 Mo maximum)."; input.value = ""; fileLabel.textContent = ""; return; }
      errBox.textContent = "";
      fileLabel.textContent = f ? f.name : "";
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = form.querySelector("textarea").value.trim();
      var file = input.files[0];
      if (!text && !file) { errBox.textContent = "Écrivez un message ou joignez une photo."; return; }
      var btn = form.querySelector(".dsp-send");
      btn.disabled = true; btn.textContent = "Envoi…"; errBox.textContent = "";
      Promise.resolve(file ? api.upload(file) : null)
        .then(function (url) { return api.send(text, url); })
        .then(function () { return api.reload(); })
        .catch(function (err) {
          errBox.textContent = (err && err.message) || "Envoi impossible, réessayez.";
          btn.disabled = false; btn.textContent = "Envoyer";
        });
    });
  }

  global.DisputeThread = { render: render, STATUS: STATUS, ROLE: ROLE };
})(window);
