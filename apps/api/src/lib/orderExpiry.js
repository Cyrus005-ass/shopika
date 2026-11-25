const prisma = require('./prisma');

// Délai pendant lequel une commande non payée réserve son stock (minutes).
const TTL_MINUTES = Number(process.env.ORDER_PAYMENT_TTL_MINUTES || 60);

// Annule les commandes jamais payées dans le délai et remet leur stock en
// vente. Sans ça, une commande abandonnée bloquait le stock pour toujours
// (le stock est décrémenté dès la création de la commande, avant paiement).
//
// Sûr en concurrence : chaque commande est "réclamée" par un UPDATE
// conditionnel (en_attente/echouee -> annulee). Si le webhook de paiement
// passe la commande à "payee" entre-temps, l'UPDATE ne correspond plus et la
// commande n'est pas touchée ; deux exécutions simultanées ne restituent
// jamais le stock deux fois.
async function expireUnpaidOrders() {
  const cutoff = new Date(Date.now() - TTL_MINUTES * 60 * 1000);
  const stale = await prisma.order.findMany({
    where: { paymentStatus: { in: ['en_attente', 'echouee'] }, createdAt: { lt: cutoff } },
    select: { id: true },
    take: 200
  });

  let cancelled = 0;
  for (const { id } of stale) {
    try {
      const done = await prisma.$transaction(async (tx) => {
        const claim = await tx.order.updateMany({
          where: { id, paymentStatus: { in: ['en_attente', 'echouee'] } },
          data: { paymentStatus: 'annulee' }
        });
        if (claim.count !== 1) return false;

        const storeOrders = await tx.storeOrder.findMany({
          where: { orderId: id, status: 'en_attente' },
          include: { items: true }
        });
        for (const so of storeOrders) {
          for (const item of so.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } }
            });
          }
          await tx.storeOrder.update({ where: { id: so.id }, data: { status: 'annulee' } });
        }
        return true;
      });
      if (done) cancelled += 1;
    } catch (err) {
      console.error(`Expiration de la commande #${id} impossible:`, err);
    }
  }
  return cancelled;
}

module.exports = { expireUnpaidOrders, TTL_MINUTES };
