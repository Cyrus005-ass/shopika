// Règles des litiges — fonctions pures (pas d'accès base), faciles à tester.

const REASONS = {
  non_recu: 'Colis non reçu',
  non_conforme: 'Produit non conforme à la description',
  endommage: 'Produit endommagé',
  autre: 'Autre problème',
};
const MAX_BODY = 2000;

// Ouverture d'un litige. Sans motif (anciens clients encore en cache) : motif « autre ».
function validateOpen({ reason, description } = {}) {
  if (reason === undefined || reason === null || reason === '') {
    return { ok: true, reason: 'autre', description: 'Litige ouvert sans précision.' };
  }
  if (!Object.prototype.hasOwnProperty.call(REASONS, reason)) {
    return { ok: false, error: 'Motif de litige invalide' };
  }
  const text = String(description ?? '').trim();
  if (text.length < 10) return { ok: false, error: 'Décrivez le problème en quelques mots (10 caractères minimum)' };
  if (text.length > MAX_BODY) return { ok: false, error: `Description trop longue (${MAX_BODY} caractères maximum)` };
  return { ok: true, reason, description: text };
}

function validateMessage({ body, attachmentUrl } = {}, allowedUrlPrefix) {
  const text = String(body ?? '').trim();
  if (!text && !attachmentUrl) return { ok: false, error: 'Écrivez un message ou joignez une photo' };
  if (text.length > MAX_BODY) return { ok: false, error: `Message trop long (${MAX_BODY} caractères maximum)` };
  let url = null;
  if (attachmentUrl) {
    // Seules nos propres images (bucket Supabase public) sont acceptées : jamais une URL libre.
    if (typeof attachmentUrl !== 'string' || !allowedUrlPrefix || !attachmentUrl.startsWith(allowedUrlPrefix) || attachmentUrl.length > 500) {
      return { ok: false, error: 'Pièce jointe invalide' };
    }
    url = attachmentUrl;
  }
  return { ok: true, body: text, attachmentUrl: url };
}

// Rôle de l'utilisateur DANS ce litige : client de la commande, marchand de la boutique, ou admin.
// Renvoie null si la personne n'est pas concernée (elle ne doit alors rien voir ni écrire).
function roleInDispute(user, storeOrder) {
  if (!user || !storeOrder) return null;
  if (user.role === 'admin') return 'admin';
  if (storeOrder.order && storeOrder.order.clientId === user.id) return 'client';
  if (storeOrder.store && storeOrder.store.merchantId === user.id) return 'marchand';
  return null;
}

// Qui prévenir quand quelqu'un écrit : les autres parties (jamais l'auteur).
// `admins` vaut true quand les administrateurs doivent aussi être notifiés.
function recipientsOf(authorRole, storeOrder) {
  const userIds = [];
  if (authorRole !== 'client' && storeOrder.order) userIds.push(storeOrder.order.clientId);
  if (authorRole !== 'marchand' && storeOrder.store) userIds.push(storeOrder.store.merchantId);
  return { userIds, admins: authorRole !== 'admin' };
}

module.exports = { REASONS, MAX_BODY, validateOpen, validateMessage, roleInDispute, recipientsOf };
