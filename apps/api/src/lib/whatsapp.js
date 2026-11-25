// Construit un lien "cliquer pour discuter" WhatsApp, prêt à l'emploi.
// wa.me exige le numéro SANS le "+" ni espaces — juste les chiffres.
function buildWhatsAppLink(phone, message = '') {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

module.exports = { buildWhatsAppLink };