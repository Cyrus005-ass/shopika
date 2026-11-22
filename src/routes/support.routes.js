const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const rateLimit = require('../middleware/rateLimit');
const { sendError } = require('../lib/http');
const { validateSupportInput, emailSupportTeam } = require('../lib/support');
const { notifyAdmins } = require('../lib/notify');

// Les clients ET les marchands peuvent écrire au support (suggestions, questions, problèmes).
// Le champ `merchantId` de la table désigne en réalité « l'expéditeur » (clé vers User) :
// aucune migration de base n'est nécessaire.
const canUseSupport = requireRole('marchand', 'client');

// 5 messages par heure et par personne : évite le spam vers la boîte de l'équipe.
const sendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  key: (req) => `support:${req.user.id}`,
  message: 'Vous avez envoyé plusieurs messages récemment. Réessayez dans un moment.'
});

// POST /api/support — envoie une suggestion / question à l'équipe Shopika
router.post('/', requireAuth, canUseSupport, sendLimiter, async (req, res) => {
  try {
    const input = validateSupportInput(req.body);
    if (!input.ok) return sendError(res, 400, input.error);
    const { subject, message } = input.value;

    const created = await prisma.supportMessage.create({
      data: { merchantId: req.user.id, subject, message }
    });

    // Infos de l'expéditeur lues en base (jamais dans le corps de la requête).
    const sender = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { fullName: true, email: true, phone: true, role: true }
    });

    // Cloche de l'espace admin + e-mail à l'équipe. L'envoi est attendu (Vercel gèle la
    // fonction dès la réponse) mais plafonné à quelques secondes et sans effet sur le résultat.
    const [emailed] = await Promise.all([
      emailSupportTeam({ sender: sender || { role: req.user.role }, subject, message, id: created.id }),
      notifyAdmins({
        type: 'support_nouveau',
        title: 'Nouveau message au support',
        body: `${sender?.fullName || 'Un utilisateur'} : ${subject}`,
        link: '/support'
      }).catch((err) => console.error('[support] notification admin échouée :', err.message))
    ]);

    res.status(201).json({ ...created, emailed });
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

// GET /api/support/my — historique des échanges de la personne connectée (avec les réponses de l'équipe)
router.get('/my', requireAuth, canUseSupport, async (req, res) => {
  try {
    const messages = await prisma.supportMessage.findMany({
      where: { merchantId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(messages);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erreur serveur');
  }
});

module.exports = router;
