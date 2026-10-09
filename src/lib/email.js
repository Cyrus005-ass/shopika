// ===================================================================
// Envoi d'e-mails via SMTP générique (nodemailer). Fonctionne avec
// n'importe quel fournisseur transactionnel (Brevo, SendGrid,
// Mailjet, Amazon SES...) ou Gmail avec un mot de passe d'application
// — il suffit de renseigner les variables SMTP_* dans .env
// (voir .env.example).
//
// Design : sendMail() envoie ; les *EmailHtml() ne font QUE du HTML
// (pures fonctions, faciles à tester). Les appels réels partent de
// src/lib/notify.js qui vérifie les préférences du marchand.
// Tout est "best effort" : un échec SMTP est loggé mais ne doit
// JAMAIS faire échouer une commande, un paiement ou une inscription.
// ===================================================================
const nodemailer = require('nodemailer');

let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined
    });
  }
  return transporter;
}

function formatFcf(amount) {
  return `${Number(amount).toLocaleString('fr-FR')} FCFA`;
}

function emailShell({ title, bodyHtml }) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
      <h2 style="color:#FA1757;margin-bottom:4px">shopika</h2>
      <h3 style="margin:8px 0 16px">${title}</h3>
      ${bodyHtml}
      <p style="color:#999;font-size:12px;margin-top:24px">Ce message est automatique — ne répondez pas directement à cet e-mail.</p>
    </div>`;
}

// Envoi générique — sujet + HTML libres.
async function sendMail({ to, subject, html }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    throw new Error('SMTP non configuré (variables SMTP_* absentes)');
  }
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || 'Shopika <no-reply@shopika.app>',
    to,
    subject,
    html
  });
}

// --- Code de vérification (inscription client) ---
async function sendVerificationEmail(toEmail, code) {
  await sendMail({
    to: toEmail,
    subject: 'Votre code de vérification Shopika',
    html: emailShell({
      title: 'Votre code de vérification',
      bodyHtml: `
        <p>Voici votre code de vérification :</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:6px">${code}</p>
        <p style="color:#666;font-size:14px">Ce code expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>`
    })
  });
}

// --- HTML : commande payée → e-mail au marchand ---
// `items` : [{ productName, quantity, unitPrice }] de SA sous-commande.
function merchantOrderEmailHtml({ storeName, orderId, items, subtotal }) {
  const rows = items.map(it => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">${it.productName}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">× ${it.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${formatFcf(Number(it.unitPrice) * it.quantity)}</td>
      </tr>`).join('');

  return emailShell({
    title: `Commande #${orderId} payée`,
    bodyHtml: `
      <p>Une commande vient d'être <strong>payée</strong> sur votre boutique <strong>${storeName}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="text-align:left;color:#666;font-size:12px;text-transform:uppercase;">
            <th style="padding:4px 0;">Produit</th><th style="padding:4px 0;">Qté</th><th style="padding:4px 0;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="font-weight:700;">
            <td style="padding:8px 0;">Total (produits + livraison)</td>
            <td></td>
            <td style="padding:8px 0;text-align:right;">${formatFcf(Number(subtotal))}</td>
          </tr>
        </tfoot>
      </table>
      <p style="color:#666;font-size:14px;">Préparez et expédiez cette commande depuis votre espace marchand Shopika (menu Commandes). Les fonds restent en séquestre jusqu'à confirmation de livraison par le client.</p>`
  });
}

// --- HTML : stock bas → e-mail au marchand ---
function merchantLowStockEmailHtml({ storeName, productName, stock }) {
  return emailShell({
    title: 'Stock bas',
    bodyHtml: `
      <p>Le produit <strong>${productName}</strong> de votre boutique <strong>${storeName}</strong> n'a plus que <strong>${stock}</strong> exemplaire${stock > 1 ? 's' : ''} en stock.</p>
      <p style="color:#666;font-size:14px;">Réapprovisionnez-le depuis votre espace marchand Shopika (menu Produits) pour éviter une rupture.</p>`
  });
}

module.exports = {
  sendMail,
  sendVerificationEmail,
  merchantOrderEmailHtml,
  merchantLowStockEmailHtml
};
