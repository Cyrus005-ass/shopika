const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const router = express.Router();
const prisma = require('../../lib/prisma');
const supabase = require('../../lib/supabase');
const requireAuth = require('../../middleware/auth');
const rateLimit = require('../../middleware/rateLimit');
const { sendError } = require('../../lib/http');
const { notify, notifyAdmins } = require('../../lib/notify');
const { sniffImageType } = require('../../lib/validators');
const { validateMessage, roleInDispute, recipientsOf, REASONS } = require('../../lib/disputes');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const messageLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 40, message: 'Trop de messages, patientez un instant' });
const BUCKET = 'product-images';

// Préfixe des URL publiques de notre bucket : les seules pièces jointes acceptées.
const attachmentPrefix = () => `${String(process.env.SUPABASE_URL || '').replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET}/disputes/`;

const messageInclude = { author: { select: { fullName: true } } };
const contextInclude = {
  order: { select: { id: true, clientId: true } },
  store: { select: { id: true, name: true, merchantId: true } },
  dispute: { include: { messages: { include: messageInclude, orderBy: { createdAt: 'asc' } } } },
};

function present(storeOrder, role) {
  const d = storeOrder.dispute;
  return {
    storeOrderId: storeOrder.id,
    orderId: storeOrder.orderId,
    store: storeOrder.store ? { id: storeOrder.store.id, name: storeOrder.store.name } : null,
    amount: Number(storeOrder.subtotal),
    viewerRole: role,
    reason: d.reason,
    reasonLabel: REASONS[d.reason] || d.reason,
    description: d.description,
    status: d.status,
    adminNote: d.adminNote,
    createdAt: d.createdAt,
    resolvedAt: d.resolvedAt,
    messages: d.messages.map((m) => ({
      id: m.id, authorRole: m.authorRole, authorName: m.author?.fullName || '', body: m.body,
      attachmentUrl: m.attachmentUrl, createdAt: m.createdAt,
    })),
  };
}

async function loadForUser(req, storeOrderId) {
  const so = await prisma.storeOrder.findUnique({ where: { id: storeOrderId }, include: contextInclude });
  if (!so || !so.dispute) return { status: 404, error: 'Litige introuvable' };
  const role = roleInDispute(req.user, so);
  // 404 (et non 403) pour ne pas révéler l'existence d'un litige à un tiers.
  if (!role) return { status: 404, error: 'Litige introuvable' };
  return { so, role };
}

// GET /api/disputes — mes litiges (client : ceux de mes commandes ; marchand : ceux de ma boutique)
router.get('/', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'client' && req.user.role !== 'marchand') return sendError(res, 403, 'Accès refusé');
    const where = req.user.role === 'client'
      ? { dispute: { isNot: null }, order: { clientId: req.user.id } }
      : { dispute: { isNot: null }, store: { merchantId: req.user.id } };
    const list = await prisma.storeOrder.findMany({
      where, include: contextInclude, orderBy: { createdAt: 'desc' }, take: 100,
    });
    res.json(list.map((so) => present(so, req.user.role)));
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// GET /api/disputes/by-order/:orderId — les litiges d'une de MES commandes (page de suivi du client)
router.get('/by-order/:orderId', requireAuth, async (req, res) => {
  try {
    const list = await prisma.storeOrder.findMany({
      where: { orderId: Number(req.params.orderId), dispute: { isNot: null }, order: { clientId: req.user.id } },
      include: contextInclude, orderBy: { id: 'asc' },
    });
    res.json(list.map((so) => present(so, 'client')));
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// POST /api/disputes/upload — photo (preuve) : JPEG, PNG ou WebP réels uniquement
router.post('/upload', requireAuth, messageLimiter, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return sendError(res, 400, 'Aucun fichier envoyé');
    const type = sniffImageType(req.file.buffer);
    if (!type) return sendError(res, 400, 'Format non accepté : envoyez une image JPEG, PNG ou WebP');
    const name = `disputes/${req.user.id}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${type.ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(name, req.file.buffer, { contentType: type.mime });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);
    res.json({ url: data.publicUrl });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "Échec de l'envoi de l'image");
  }
});

// GET /api/disputes/:storeOrderId — un litige et ses messages (parties concernées + admin)
router.get('/:storeOrderId', requireAuth, async (req, res) => {
  try {
    const found = await loadForUser(req, Number(req.params.storeOrderId));
    if (found.error) return sendError(res, found.status, found.error);
    res.json(present(found.so, found.role));
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// POST /api/disputes/:storeOrderId/messages  { body, attachmentUrl? }
router.post('/:storeOrderId/messages', requireAuth, messageLimiter, async (req, res) => {
  try {
    const found = await loadForUser(req, Number(req.params.storeOrderId));
    if (found.error) return sendError(res, found.status, found.error);
    const { so, role } = found;
    if (so.dispute.status !== 'ouvert') return sendError(res, 400, 'Ce litige est clos : il n\'accepte plus de messages');

    const check = validateMessage(req.body, attachmentPrefix());
    if (!check.ok) return sendError(res, 400, check.error);

    const message = await prisma.disputeMessage.create({
      data: { disputeId: so.dispute.id, authorId: req.user.id, authorRole: role, body: check.body, attachmentUrl: check.attachmentUrl },
      include: messageInclude,
    });

    const to = recipientsOf(role, so);
    const note = { type: 'litige', title: 'Nouveau message sur un litige', body: `Commande #${so.orderId} — « ${so.store?.name} »`, link: '/disputes' };
    await Promise.all(to.userIds.map((id) => notify(id, { ...note, link: id === so.order.clientId ? `/commande?id=${so.orderId}` : '/litiges' })));
    if (to.admins) await notifyAdmins(note);

    res.status(201).json({
      id: message.id, authorRole: role, authorName: message.author?.fullName || '', body: message.body,
      attachmentUrl: message.attachmentUrl, createdAt: message.createdAt,
    });
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

module.exports = router;
