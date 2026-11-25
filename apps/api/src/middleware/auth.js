const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // { id, role, tokenVersion }

    // Vérifie que ce token n'a pas été invalidé depuis son émission
    // (ex: changement de rôle client → marchand)
    const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { tokenVersion: true, isActive: true } });
    if (!user || user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter' });
    }

    // Un compte désactivé perd l'accès immédiatement, sans attendre l'expiration du JWT (7 jours).
    if (user.isActive === false) {
      return res.status(403).json({ error: 'Compte désactivé', message: 'Compte désactivé' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

module.exports = requireAuth;