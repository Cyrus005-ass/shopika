// ===================================================================
// Abonnement boutique — principe :
//
// `subscriptionExpiresAt` est la SEULE source de vérité. On ne "suspend"
// jamais explicitement une boutique via un job planifié (cron) : on compare
// juste `subscriptionExpiresAt` à `new Date()` à chaque lecture qui compte
// (marketplace, catalogue produits). Cette approche est précise à la
// seconde ("jour pour jour, heure pour heure") et fonctionne pareil quel
// que soit l'hébergeur, avec ou sans cron configuré.
//
// Quand le marchand repaie, on repousse `subscriptionExpiresAt` d'un mois
// — la boutique redevient donc automatiquement visible dès l'instant où la
// nouvelle date dépasse "maintenant", sans aucune action supplémentaire.
// ===================================================================

// Une boutique est "active" (visible, commandable) si son abonnement n'a pas
// expiré ET qu'elle n'a pas été suspendue par l'admin.
function isStoreActive(store) {
  return (
    Boolean(store.subscriptionExpiresAt) &&
    store.subscriptionExpiresAt > new Date() &&
    !store.isSuspended
  );
}

// Équivalent de isStoreActive() sous forme de filtre Prisma — à utiliser dans
// tous les `where` publics (marketplace, recherche, catalogue) pour qu'une
// boutique suspendue ou expirée n'apparaisse jamais, sans logique dupliquée.
function activeStoreWhere() {
  return { subscriptionExpiresAt: { gt: new Date() }, isSuspended: false };
}

// Ajoute un mois calendaire "jour pour jour, heure pour heure" (ex: payé le
// 10 septembre à 14h32 -> expire le 10 octobre à 14h32). Cas limite connu :
// si le mois de départ a plus de jours que le mois d'arrivée (ex: 31 janvier
// -> pas de 31 février), JavaScript reporte automatiquement au 2-3 mars.
// Assez rare et sans conséquence grave (la boutique gagne quelques jours ce
// mois-là) pour ne pas justifier une logique de date plus complexe.
function addOneMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
}

// Montant à payer : frais de création la toute première fois (boutique
// jamais payée), frais de réabonnement mensuel ensuite. Configurable en XOF
// via l'environnement pour changer les tarifs sans toucher au code.
function amountDueFor(store) {
  const isFirstPayment = !store.subscriptionExpiresAt;
  return isFirstPayment
    ? Number(process.env.STORE_CREATION_FEE || 5000)
    : Number(process.env.STORE_MONTHLY_FEE || 3000);
}

// Point de départ du nouveau mois : si l'abonnement est encore actif (le
// marchand renouvelle en avance), on prolonge à partir de la date
// d'expiration actuelle plutôt que de repartir de "maintenant" — il ne
// perd jamais de jours déjà payés.
function nextExpiryAfterPayment(store) {
  const base = isStoreActive(store) ? store.subscriptionExpiresAt : new Date();
  return addOneMonth(base);
}

// Concerne UNE SEULE boutique sur toute la plateforme : la toute première
// jamais créée. Sert à tester le parcours complet (création → apparition
// marketplace) sans avoir à payer les frais de création ni attendre une
// validation admin. Donne un abonnement "actif" pour 100 ans — largement
// suffisant pour une boutique de test que l'admin supprimera lui-même
// ensuite (voir DELETE /api/admin/stores/:id).
function grantFreeTrialExpiry() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 100);
  return d;
}

module.exports = { isStoreActive, activeStoreWhere, addOneMonth, amountDueFor, nextExpiryAfterPayment, grantFreeTrialExpiry };
