const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../lib/prisma');
const requireAuth = require('../../middleware/auth');
const { sendError } = require('../../lib/http');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../../lib/email');
const config = require('../../config');
const { validateSubdomain, validatePhone, validateStoreName } = require('../../lib/validators');
const { grantFreeTrialExpiry } = require('../../lib/subscription');
const rateLimit = require('../../middleware/rateLimit');

const MAX_FAILED_LOGINS = 8;
const LOCK_MS = 15 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

// Freins par IP (complètent les verrouillages par compte stockés en base).
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: 'Trop de tentatives de connexion, réessayez dans quelques minutes' });
const verifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Trop de tentatives, réessayez dans quelques minutes' });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, message: "Trop d'inscriptions depuis cette adresse, réessayez plus tard" });

// ===================================================================
// Deux façons de s'identifier sur Shopika :
//  - MARCHAND (et admin) : téléphone + mot de passe, sans vérification
//    par e-mail — cohérent avec le reste de la plateforme (WhatsApp,
//    Mobile Money) qui repose sur le numéro de téléphone.
//  - CLIENT : e-mail + mot de passe, avec vérification par code à 6
//    chiffres envoyé par e-mail à l'inscription. Le téléphone du client
//    est demandé séparément, au moment de la commande (Mobile Money).
// ===================================================================

const CODE_TTL_MS = 10 * 60 * 1000;      // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000;    // 60 secondes entre deux envois

function generateCode() {
  return crypto.randomInt(100000, 999999).toString();
}

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    phone: user.phone,
    email: user.email,
    emailNotifications: user.emailNotifications,
    address: user.address,
    city: user.city,
    country: user.country,
    twoFactorOn: user.twoFactorOn
  };
}

function issueToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, tokenVersion: user.tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ===================================================================
// POST /api/auth/register
// ===================================================================
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { phone, full_name, password, firstName, lastName, email } = req.body;

    // --- Flux MARCHAND (inchangé) : téléphone, retourne un token direct ---
    if (phone) {
      if (!full_name || !password) {
        return sendError(res, 400, 'Téléphone, nom et mot de passe requis');
      }
      const existing = await prisma.user.findUnique({ where: { phone } });
      if (existing) return sendError(res, 409, 'Ce numéro est déjà utilisé');

      // E-mail facultatif mais recommandé : c'est l'adresse qui
      // reçoit les notifications marchand (commandes payées,
      // stock bas). Elle doit être unique si renseignée.
      let emailToSave = null;
      if (email) {
        const normalized = String(email).trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
          return sendError(res, 400, 'Adresse e-mail invalide');
        }
        const emailTaken = await prisma.user.findFirst({ where: { email: normalized } });
        if (emailTaken) return sendError(res, 409, 'Cette adresse e-mail est déjà utilisée');
        emailToSave = normalized;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { phone, fullName: full_name, passwordHash, role: 'client', email: emailToSave }
      });

      const token = issueToken(user);
      return res.status(201).json({ token, user: publicUser(user) });
    }

    // --- Flux CLIENT : e-mail, nécessite une vérification avant token ---
    if (email) {
      if (!firstName || !lastName || !password) {
        return sendError(res, 400, 'Prénom, nom, e-mail et mot de passe requis');
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.emailVerified) {
        return sendError(res, 409, 'Cette adresse e-mail est déjà utilisée');
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const code = generateCode();
      const data = {
        email,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        passwordHash,
        role: 'client',
        emailVerified: false,
        emailVerificationCode: code,
        emailVerificationExpires: new Date(Date.now() + CODE_TTL_MS),
        emailVerificationSentAt: new Date(),
        emailVerificationAttempts: 0
      };

      // Si un compte non-vérifié existe déjà pour cet e-mail (ex: la
      // personne a fermé l'onglet avant de saisir son code), on le
      // réutilise plutôt que de bloquer sur la contrainte unique.
      if (existing) {
        await prisma.user.update({ where: { id: existing.id }, data });
      } else {
        await prisma.user.create({ data });
      }

      try {
        await sendVerificationEmail(email, code);
      } catch (mailErr) {
        console.error("Échec envoi e-mail de vérification:", mailErr);
        return sendError(res, 500, "Impossible d'envoyer l'e-mail de vérification pour le moment. Réessayez dans un instant.");
      }

      return res.status(201).json({ email });
    }

    return sendError(res, 400, 'Téléphone ou e-mail requis');
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Erreur serveur');
  }
});

// ===================================================================
// POST /api/auth/verify-email
// ===================================================================
router.post('/verify-email', verifyLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return sendError(res, 400, 'E-mail et code requis');

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return sendError(res, 404, 'Aucun compte associé à cet e-mail');

    if (user.emailVerified) {
      // Idempotent : si déjà vérifié (double-clic, page rechargée), on
      // connecte simplement la personne au lieu de renvoyer une erreur.
      return res.json({ token: issueToken(user), user: publicUser(user) });
    }

    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      return sendError(res, 400, 'Ce code a expiré, demandez-en un nouveau.', { expired: true });
    }
    if (!user.emailVerificationCode) {
      return sendError(res, 400, 'Aucun code actif, demandez-en un nouveau.', { expired: true });
    }
    if (user.emailVerificationCode !== String(code)) {
      // Un code à 6 chiffres se devine en 10 min par force brute : au bout de
      // 5 essais ratés on l'invalide, il faut en redemander un.
      const attempts = user.emailVerificationAttempts + 1;
      if (attempts >= MAX_CODE_ATTEMPTS) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerificationCode: null, emailVerificationExpires: null, emailVerificationAttempts: 0 }
        });
        return sendError(res, 429, 'Trop d\'essais incorrects : demandez un nouveau code.', { expired: true });
      }
      await prisma.user.update({ where: { id: user.id }, data: { emailVerificationAttempts: attempts } });
      return sendError(res, 400, 'Code incorrect');
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationCode: null,
        emailVerificationExpires: null,
        emailVerificationAttempts: 0
      }
    });

    return res.json({ token: issueToken(updated), user: publicUser(updated) });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Erreur serveur');
  }
});

// ===================================================================
// POST /api/auth/resend-code
// ===================================================================
router.post('/resend-code', verifyLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return sendError(res, 400, 'E-mail requis');

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return sendError(res, 404, 'Aucun compte associé à cet e-mail');
    if (user.emailVerified) return sendError(res, 400, 'Ce compte est déjà vérifié');

    if (user.emailVerificationSentAt) {
      const elapsed = Date.now() - user.emailVerificationSentAt.getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const secondsRemaining = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        return sendError(res, 429, 'Veuillez patienter avant de redemander un code', { secondsRemaining });
      }
    }

    const code = generateCode();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationCode: code,
        emailVerificationExpires: new Date(Date.now() + CODE_TTL_MS),
        emailVerificationSentAt: new Date(),
        emailVerificationAttempts: 0
      }
    });

    await sendVerificationEmail(email, code);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Erreur serveur');
  }
});

// ===================================================================
// POST /api/auth/login
// ===================================================================
router.post('/login', loginLimiter, async (req, res) => {
  console.log('[auth.login] body:', req.body);
  try {
    const { phone, email, password } = req.body;
    if (!password || (!phone && !email)) {
      console.log('[auth.login] missing credentials');
      console.log('[auth.login] missing credentials');
      return sendError(res, 400, 'Identifiant et mot de passe requis');
      console.log('[auth.login] missing credentials');
    }

    const user = await prisma.user.findUnique({ where: phone ? { phone } : { email } });
    if (!user || !user.passwordHash) {
      return sendError(res, 401, 'Identifiants invalides');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const secondsRemaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
      return sendError(res, 429, 'Trop de tentatives échouées : compte temporairement verrouillé. Réessayez plus tard.', { secondsRemaining });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const failed = user.failedLoginCount + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: failed >= MAX_FAILED_LOGINS
          ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MS) }
          : { failedLoginCount: failed }
      });
      return sendError(res, 401, 'Identifiants invalides');
    }
    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    }

    if (user.isActive === false) {
      return sendError(res, 403, 'Ce compte est désactivé. Contactez le support Shopika.');
    }

    // La vérification par e-mail ne s'applique qu'aux comptes qui se
    // connectent par e-mail (les comptes marchand/admin par téléphone
    // n'ont pas ce champ pertinent).
    if (email && !user.emailVerified) {
      return sendError(res, 403, 'Veuillez vérifier votre e-mail avant de vous connecter', { code: 'EMAIL_NOT_VERIFIED' });
    }

    return res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Erreur serveur');
  }
});

// ===================================================================
// PATCH /api/auth/me — profil du compte connecté
// (le marchand y renseigne notamment son adresse e-mail de
// notification et son opt-out e-mail)
// ===================================================================
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { firstName, lastName, phone, address, country, city, twoFactorOn, email, emailNotifications } = req.body;

    if (phone) {
      const taken = await prisma.user.findFirst({ where: { phone, NOT: { id: req.user.id } } });
      if (taken) return sendError(res, 409, 'Ce numéro est déjà utilisé par un autre compte');
    }

    // E-mail de notification marchand : unique, format vérifié.
    // Null = suppression de l'adresse (plus d'e-mail).
    let normalizedEmail;
    if (email !== undefined) {
      normalizedEmail = String(email || '').trim().toLowerCase() || null;
      if (normalizedEmail) {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
          return sendError(res, 400, 'Adresse e-mail invalide');
        }
        const taken = await prisma.user.findFirst({ where: { email: normalizedEmail, NOT: { id: req.user.id } } });
        if (taken) return sendError(res, 409, 'Cette adresse e-mail est déjà utilisée par un autre compte');
      }
    }

    const current = await prisma.user.findUnique({ where: { id: req.user.id } });
    const nextFirstName = firstName ?? current.firstName;
    const nextLastName = lastName ?? current.lastName;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        firstName: nextFirstName,
        lastName: nextLastName,
        fullName: (nextFirstName || nextLastName) ? `${nextFirstName || ''} ${nextLastName || ''}`.trim() : current.fullName,
        phone: phone ?? current.phone,
        address: address ?? current.address,
        country: country ?? current.country,
        city: city ?? current.city,
        twoFactorOn: twoFactorOn ?? current.twoFactorOn,
        email: email !== undefined ? normalizedEmail : current.email,
        emailNotifications: typeof emailNotifications === 'boolean' ? emailNotifications : current.emailNotifications
      }
    });

    return res.json({ user: publicUser(user) });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Erreur serveur');
  }
});

// ===================================================================
// POST /api/auth/change-password
// ===================================================================
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return sendError(res, 400, 'Mot de passe actuel et nouveau mot de passe requis');
    }
    if (newPassword.length < 6) {
      return sendError(res, 400, 'Le nouveau mot de passe doit contenir au moins 6 caractères');
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return sendError(res, 401, 'Mot de passe actuel incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Erreur serveur');
  }
});


// ===================================================================
// Mot de passe oublié — jeton SANS état (aucune colonne en base) :
// signé avec le secret JWT + une empreinte de l'ancien hash du mot de passe.
// Dès que le mot de passe change, l'empreinte ne correspond plus : le lien
// ne sert donc qu'UNE seule fois, et expire de toute façon après 30 minutes.
// ===================================================================
const forgotLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 8, message: 'Trop de demandes, réessayez dans une heure' });
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: 'Trop de tentatives, réessayez dans quelques minutes' });

const resetSecret = () => `${process.env.JWT_SECRET}:pwd-reset`;
const passwordFingerprint = (user) => crypto.createHash('sha256').update(user.passwordHash || '').digest('hex').slice(0, 24);
function signResetToken(user) {
  return jwt.sign({ id: user.id, purpose: 'pwd-reset', pf: passwordFingerprint(user) }, resetSecret(), { expiresIn: `${config.passwordResetMinutes}m` });
}

// POST /api/auth/forgot-password  { email }
// Répond TOUJOURS 200 avec le même message : on ne révèle jamais si l'adresse existe.
router.post('/forgot-password', forgotLimiter, async (req, res) => {
  const generic = { ok: true, message: 'Si un compte existe pour cette adresse, un e-mail vient de partir.' };
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.json(generic);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.isActive && user.passwordHash) {
      const link = `${config.frontUrl}/reinitialiser.html?token=${encodeURIComponent(signResetToken(user))}`;
      try { await sendPasswordResetEmail(user.email, link); }
      catch (err) { console.error('Échec e-mail réinitialisation:', err.message); }
    }
    return res.json(generic);
  } catch (err) {
    console.error(err);
    return res.json(generic);
  }
});

// POST /api/auth/reset-password  { token, password }
router.post('/reset-password', resetLimiter, async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return sendError(res, 400, 'Lien et nouveau mot de passe requis');
    if (String(password).length < 6) return sendError(res, 400, 'Le mot de passe doit contenir au moins 6 caractères');

    let payload;
    try { payload = jwt.verify(String(token), resetSecret()); }
    catch { return sendError(res, 400, 'Ce lien est invalide ou a expiré. Refaites une demande.'); }
    if (payload.purpose !== 'pwd-reset') return sendError(res, 400, 'Ce lien est invalide ou a expiré. Refaites une demande.');

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || !user.isActive || passwordFingerprint(user) !== payload.pf) {
      return sendError(res, 400, 'Ce lien a déjà été utilisé ou a expiré. Refaites une demande.');
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    await prisma.user.update({
      where: { id: user.id },
      // tokenVersion + 1 : toutes les sessions ouvertes (peut-être celles d'un intrus) sont coupées.
      data: { passwordHash, tokenVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null }
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Erreur serveur');
  }
});

// ===================================================================
// POST /api/auth/become-merchant — bascule un client en marchand + boutique
// ===================================================================
router.post('/become-merchant', requireAuth, async (req, res) => {
  try {
    const { name, subdomain, phone, payout_phone, payout_country } = req.body;
    const nameCheck = validateStoreName(name);
    if (!nameCheck.ok) return sendError(res, 400, nameCheck.error);
    const subCheck = validateSubdomain(subdomain);
    if (!subCheck.ok) return sendError(res, 400, subCheck.error);
    if (phone) {
      const phoneCheck = validatePhone(phone);
      if (!phoneCheck.ok) return sendError(res, 400, phoneCheck.error);
    }
    if (payout_phone && !validatePhone(payout_phone).ok) {
      return sendError(res, 400, 'Numéro Mobile Money de versement invalide');
    }

    const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    const existingStore = await prisma.store.findUnique({ where: { merchantId: req.user.id } });
    // On bloque uniquement si le compte a DÉJÀ une boutique. Un marchand
    // dont la boutique de test a été supprimée par l'admin (voir
    // DELETE /api/admin/stores/:id) peut donc en recréer une normalement.
    if (currentUser.role === 'marchand' && existingStore) {
      return sendError(res, 400, 'Ce compte a déjà une boutique');
    }
    if (currentUser.role === 'admin') {
      return sendError(res, 400, 'Ce compte est administrateur');
    }

    // Devenir marchand nécessite un numéro de téléphone (WhatsApp, Mobile
    // Money) — les comptes créés par e-mail n'en ont pas encore forcément.
    let phoneToSet = currentUser.phone;
    if (!phoneToSet) {
      if (!phone) return sendError(res, 400, 'Un numéro de téléphone est requis pour devenir marchand');
      const phoneTaken = await prisma.user.findFirst({ where: { phone, NOT: { id: currentUser.id } } });
      if (phoneTaken) return sendError(res, 409, 'Ce numéro est déjà utilisé par un autre compte');
      phoneToSet = phone;
    }

    const subdomainTaken = await prisma.store.findUnique({ where: { subdomain: subCheck.value } });
    if (subdomainTaken) return sendError(res, 409, 'Ce sous-domaine est déjà pris');

    // Exception ponctuelle : la toute première boutique de la plateforme
    // (utile pour tes propres tests) est activée automatiquement, sans
    // paiement — voir README, section Abonnement. Toute boutique suivante
    // suit le circuit normal (frais de création via
    // POST /api/stores/me/subscription/pay).
    const isPlatformFirstStore = (await prisma.store.count()) === 0;
    const storeData = {
      merchantId: req.user.id, name: nameCheck.value, subdomain: subCheck.value,
      // Coordonnées de versement : sans elles, impossible de payer le marchand. Par défaut, son numéro de compte.
      payoutPhone: payout_phone ? validatePhone(payout_phone).value : phoneToSet,
      payoutCountry: payout_country || null
    };
    if (isPlatformFirstStore) {
      storeData.subscriptionStatus = 'active';
      storeData.subscriptionExpiresAt = grantFreeTrialExpiry();
      storeData.creationFeePaid = true;
    }

    const [updatedUser, store] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { role: 'marchand', phone: phoneToSet, tokenVersion: { increment: 1 } }
      }),
      prisma.store.create({ data: storeData })
    ]);

    return res.status(201).json({
      token: issueToken(updatedUser),
      user: publicUser(updatedUser),
      store
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Erreur serveur');
  }
});

module.exports = router;
