const prisma = require('./prisma');
const config = require('../config');
const { releaseEscrowForStoreOrder } = require('./escrow');
const { notify, notifyAdmins } = require('./notify');

// Un colis expédié depuis plus de N jours (AUTO_CONFIRM_DAYS, 7 par défaut) sans confirmation
// ni litige est considéré comme reçu : sans cela, l'argent resterait bloqué en séquestre à vie.
// Le client est prévenu à l'expédition qu'il peut ouvrir un litige ; ici les litiges (status "litige")
// ne sont jamais touchés. La libération est atomique : aucun risque de double traitement.
async function autoConfirmShippedOrders({ days = config.autoConfirmDays, now = new Date(), db = prisma, release = releaseEscrowForStoreOrder } = {}) {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const candidates = await db.storeOrder.findMany({
    where: { status: 'expediee', escrowStatus: 'bloque', shippedAt: { not: null, lte: cutoff } },
    include: { order: { select: { clientId: true } }, store: { select: { merchantId: true, name: true } } },
    take: 200
  });

  let confirmed = 0;
  for (const so of candidates) {
    if (!(await release(so.id))) continue; // déjà traité entre-temps (client, livreur…)
    confirmed++;
    await notify(so.order.clientId, {
      type: 'reception_auto',
      title: 'Réception confirmée automatiquement',
      body: `Votre commande #${so.id} était expédiée depuis plus de ${days} jours : elle est considérée comme reçue.`,
      link: '/mes-commandes'
    });
    await notify(so.store.merchantId, {
      type: 'reception_confirmee',
      title: 'Commande confirmée automatiquement',
      body: `La commande #${so.id} sur "${so.store.name}" est confirmée (aucune réponse du client en ${days} jours). Le versement sera déclenché par l'équipe Shopika.`,
      link: `/commandes/${so.id}`
    });
  }
  if (confirmed > 0) {
    await notifyAdmins({
      type: 'versement_a_faire',
      title: 'Versements marchand à déclencher',
      body: `${confirmed} commande(s) confirmée(s) automatiquement : les fonds peuvent être débloqués vers les marchands.`,
      link: '/payouts'
    });
  }
  return { checked: candidates.length, confirmed };
}

module.exports = { autoConfirmShippedOrders };
