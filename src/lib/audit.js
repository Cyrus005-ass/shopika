const prisma = require('./prisma');

// Journal d'audit des actions sensibles de l'admin (qui, quoi, quand).
// Volontairement "best effort" comme notify() : un échec d'écriture du journal
// est loggé mais ne doit pas annuler une action déjà exécutée côté FedaPay
// (un versement parti ne se "rollback" pas).
async function logAdminAction(adminId, action, entityType, entityId, details) {
  try {
    return await prisma.adminAuditLog.create({
      data: { adminId, action, entityType, entityId: entityId ?? null, details: details ?? undefined }
    });
  } catch (err) {
    console.error("Échec écriture du journal d'audit:", err);
    return null;
  }
}

module.exports = { logAdminAction };
