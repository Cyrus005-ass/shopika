const prisma = require('./prisma');

// Libère l'escrow d'une sous-commande de façon ATOMIQUE : l'update n'a lieu
// que si la sous-commande est encore "expediee" avec un escrow "bloque".
// Deux requêtes simultanées (double clic, client + livreur, cron) ne peuvent donc
// jamais libérer deux fois. Renvoie true seulement pour celle qui a gagné.
async function releaseEscrowForStoreOrder(storeOrderId) {
  const { count } = await prisma.storeOrder.updateMany({
    where: { id: storeOrderId, status: 'expediee', escrowStatus: 'bloque' },
    data: { status: 'livree', escrowStatus: 'libere', confirmedAt: new Date() }
  });
  return count === 1;
}

module.exports = { releaseEscrowForStoreOrder };
