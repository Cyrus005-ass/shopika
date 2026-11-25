const prisma = require('./prisma');
const config = require('../config');
const { notify, sendMerchantEmail } = require('./notify');
const { subscriptionReminderEmailHtml } = require('./email');

const DAY = 24 * 60 * 60 * 1000;
// Fenêtres de 24 h : avec un cron quotidien, chaque boutique reçoit chaque rappel UNE seule fois (sans état en base).
const STAGES = [{ daysLeft: 7, from: 6 * DAY, to: 7 * DAY }, { daysLeft: 1, from: 0, to: 1 * DAY }];

async function sendSubscriptionReminders({ now = new Date(), db = prisma } = {}) {
  let sent = 0;
  for (const stage of STAGES) {
    const stores = await db.store.findMany({
      where: {
        isSuspended: false,
        subscriptionExpiresAt: { gt: new Date(now.getTime() + stage.from), lte: new Date(now.getTime() + stage.to) }
      },
      select: { id: true, name: true, merchantId: true },
      take: 500
    });
    for (const store of stores) {
      const title = stage.daysLeft === 1 ? 'Votre abonnement expire demain' : `Votre abonnement expire dans ${stage.daysLeft} jours`;
      await notify(store.merchantId, {
        type: 'abonnement_rappel', title,
        body: `Renouvelez l'abonnement de "${store.name}" pour rester visible sur la marketplace.`,
        link: '/abonnement'
      });
      await sendMerchantEmail(store.merchantId, {
        subject: `${title} — ${store.name}`,
        html: subscriptionReminderEmailHtml({ storeName: store.name, daysLeft: stage.daysLeft, amount: config.storeMonthlyFee })
      });
      sent++;
    }
  }
  return { sent };
}

module.exports = { sendSubscriptionReminders, STAGES };
