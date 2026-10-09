const { sendError } = require('../lib/http');

// À utiliser APRÈS requireAuth : requireRole('admin')
// req.user vient du token JWT (voir middleware/auth.js), jamais du body.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return sendError(res, 403, "Accès refusé : rôle insuffisant");
    }
    next();
  };
}

module.exports = requireRole;
