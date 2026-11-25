const prisma = require('./prisma');
const {
  sendMail,
  merchantOrderEmailHtml,
  merchantLowStockEmailHtml
} = require('./email');

// Crée une notification in-app. Volontairement "best effort" : si la
// notification échoue à être créée, on logge mais on ne fait jamais échouer
// l'action principale (créer une commande, expédier...) à cause de ça.
async function notify(userId, { type, title, body, link }) {
  try {
    return await prisma.notification.create({
      data: { userId, type, title, body, link: link || null }
    });
  } catch (err) {
    console.error('Échec création notification:', err);
    return null;
  }
}

// Notifie tous les comptes admin d'un coup — utilisé pour tout ce qui
// nécessite une action côté espace admin (déblocage de fonds, litige...).
async function notifyAdmins({ type, title, body, link }) {
  const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
  await Promise.all(admins.map(admin => notify(admin.id, { type, title, body, link })));
}

// ===================================================================
// E-mails marchand (Gmail / SMTP configuré dans .env).
//
// N'envoie QUE si le compte marchand :
//  - a renseigné une adresse e-mail (PATCH /api/auth/me), ET
//  - n'a pas désactivé les notifications e-mail (emailNotifications).
// Best effort : un échec SMTP est loggé, l'action principale
// (commande, paiement) n'est jamais bloquée par l'e-mail.
// ===================================================================

// Renvoie { email } du marchand ou null s'il ne veut pas / pas d'e-mail.
async function merchantEmailTarget(merchantId) {
  const merchant = await prisma.user.findUnique({
    where: { id: merchantId },
    select: { email: true, emailNotifications: true }
  });
  if (!merchant || !merchant.email) return null;
  if (merchant.emailNotifications === false) return null;
  return merchant.email;
}

// E-mail libre (sujet + HTML) au marchand, s'il l'accepte.
async function sendMerchantEmail(merchantId, { subject, html }) {
  try {
    const to = await merchantEmailTarget(merchantId);
    if (!to) return null;
    return await sendMail({ to, subject, html });
  } catch (err) {
    console.error('Échec e-mail marchand:', err.message);
    return null;
  }
}

// Commande payée : liste les articles de la sous-commande du marchand.
// `items` : [{ productName, quantity, unitPrice }].
async function notifyMerchantOrderPaid({ merchantId, storeName, orderId, items, subtotal }) {
  try {
    const to = await merchantEmailTarget(merchantId);
    if (!to) return null;
    return await sendMail({
      to,
      subject: `Nouvelle commande payée sur "${storeName}" — #${orderId}`,
      html: merchantOrderEmailHtml({ storeName, orderId, items, subtotal })
    });
  } catch (err) {
    console.error('Échec e-mail commande payée:', err.message);
    return null;
  }
}

// Stock bas sur un de ses produits (seuil franchi par la baisse).
async function notifyMerchantLowStock({ merchantId, storeName, productName, stock }) {
  try {
    const to = await merchantEmailTarget(merchantId);
    if (!to) return null;
    return await sendMail({
      to,
      subject: `Stock bas : "${productName}" (${storeName})`,
      html: merchantLowStockEmailHtml({ storeName, productName, stock })
    });
  } catch (err) {
    console.error('Échec e-mail stock bas:', err.message);
    return null;
  }
}

module.exports = {
  notify,
  notifyAdmins,
  sendMerchantEmail,
  notifyMerchantOrderPaid,
  notifyMerchantLowStock
};
