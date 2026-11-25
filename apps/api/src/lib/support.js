const { sendMail } = require('./email');

const MAX_SUBJECT_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 5000;

function validateSupportInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Le sujet et le message sont requis.' };
  }

  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (!subject || !message) {
    return { ok: false, error: 'Le sujet et le message sont requis.' };
  }
  if (subject.length > MAX_SUBJECT_LENGTH) {
    return { ok: false, error: `Le sujet ne peut pas dépasser ${MAX_SUBJECT_LENGTH} caractères.` };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `Le message ne peut pas dépasser ${MAX_MESSAGE_LENGTH} caractères.` };
  }

  return { ok: true, value: { subject, message } };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

async function emailSupportTeam({ sender, subject, message, id }) {
  const to = process.env.SUPPORT_EMAIL;
  if (!to) {
    console.error('[support] SUPPORT_EMAIL non configuré; message enregistré sans e-mail.');
    return false;
  }

  const senderName = sender?.fullName || 'Utilisateur Shopika';
  const role = sender?.role || 'inconnu';
  const senderContact = sender?.email || sender?.phone || 'Non renseigné';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:24px">
      <h2>Nouveau message au support Shopika (#${escapeHtml(id)})</h2>
      <p><strong>Expéditeur :</strong> ${escapeHtml(senderName)} (${escapeHtml(role)})</p>
      <p><strong>Contact :</strong> ${escapeHtml(senderContact)}</p>
      <p><strong>Sujet :</strong> ${escapeHtml(subject)}</p>
      <p><strong>Message :</strong></p>
      <div style="white-space:pre-wrap">${escapeHtml(message)}</div>
    </div>`;

  try {
    await sendMail({
      to,
      subject: `[Shopika Support] ${subject}`,
      html,
      replyTo: sender?.email || undefined,
    });
    return true;
  } catch (error) {
    console.error('[support] Échec de l’envoi de l’e-mail :', error.message);
    return false;
  }
}

module.exports = { validateSupportInput, emailSupportTeam };
