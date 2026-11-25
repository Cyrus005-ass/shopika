// Validations partagées (pures, sans accès base) — faciles à tester.

// Sous-domaines refusés : ils servent à l'infrastructure ou prêtent à confusion (hameçonnage).
const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'app', 'admin', 'administrator', 'root', 'support', 'help', 'aide', 'mail', 'email', 'smtp',
  'shopika', 'marchand', 'merchant', 'client', 'boutique', 'shop', 'store', 'marketplace', 'checkout',
  'paiement', 'payment', 'pay', 'login', 'connexion', 'inscription', 'signup', 'static', 'assets', 'cdn',
  'blog', 'status', 'dashboard', 'test', 'demo', 'dev', 'staging',
]);

function normalizeSubdomain(raw) {
  return String(raw ?? '').trim().toLowerCase();
}

// 3 à 30 caractères : lettres minuscules, chiffres, tirets (jamais au début, à la fin, ni doublés).
function validateSubdomain(raw) {
  const value = normalizeSubdomain(raw);
  if (value.length < 3 || value.length > 30) {
    return { ok: false, value, error: 'Le sous-domaine doit contenir entre 3 et 30 caractères' };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    return { ok: false, value, error: 'Utilisez seulement des lettres minuscules, des chiffres et des tirets (pas au début ni à la fin)' };
  }
  if (RESERVED_SUBDOMAINS.has(value)) {
    return { ok: false, value, error: 'Ce nom est réservé, choisissez-en un autre' };
  }
  return { ok: true, value };
}

// Numéro de téléphone : chiffres, + initial facultatif, 8 à 15 chiffres (E.164). Espaces/tirets/points tolérés.
function validatePhone(raw) {
  const value = String(raw ?? '').trim().replace(/[\s.\-()]/g, '');
  if (!/^\+?\d{8,15}$/.test(value)) {
    return { ok: false, value, error: 'Numéro de téléphone invalide (8 à 15 chiffres, indicatif pays accepté)' };
  }
  return { ok: true, value };
}

function validateStoreName(raw) {
  const value = String(raw ?? '').trim();
  if (value.length < 2 || value.length > 60) {
    return { ok: false, value, error: 'Le nom de la boutique doit contenir entre 2 et 60 caractères' };
  }
  return { ok: true, value };
}

// Types d'image acceptés à l'upload : on vérifie les premiers octets du fichier (le Content-Type du
// navigateur est librement falsifiable). Renvoie l'extension à utiliser, ou null si le fichier n'est pas une image sûre.
function sniffImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  return null;
}

module.exports = { RESERVED_SUBDOMAINS, normalizeSubdomain, validateSubdomain, validatePhone, validateStoreName, sniffImageType };
