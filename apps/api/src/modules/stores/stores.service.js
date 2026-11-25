// Agrégations de l'espace marchand — fonctions PURES (les routes récupèrent les lignes, ici on calcule).
// Montants : `subtotal` = articles + livraison de la boutique (ce qui est versé au marchand).

const num = (v) => Number(v || 0);

// rows : [{ subtotal, createdAt, status, escrowStatus, order: { clientId, deliveryPhone, client: { fullName, email, phone } } }]
function aggregateCustomers(rows) {
  const byClient = new Map();
  for (const r of rows) {
    const c = r.order?.client;
    const id = r.order?.clientId;
    if (!id) continue;
    let e = byClient.get(id);
    if (!e) {
      e = {
        clientId: id, name: c?.fullName || 'Client', email: c?.email || null,
        phone: r.order.deliveryPhone || c?.phone || null, orders: 0, totalSpent: 0, lastOrderAt: r.createdAt,
      };
      byClient.set(id, e);
    }
    e.orders += 1;
    if (r.escrowStatus !== 'rembourse' && r.status !== 'annulee') e.totalSpent += num(r.subtotal);
    if (new Date(r.createdAt) > new Date(e.lastOrderAt)) e.lastOrderAt = r.createdAt;
  }
  return [...byClient.values()]
    .map((e) => ({ ...e, segment: e.orders >= 3 ? 'fidele' : e.orders === 1 ? 'nouveau' : 'regulier' }))
    .sort((a, b) => b.totalSpent - a.totalSpent);
}

// rows : sous-commandes PAYÉES de la boutique.
function summarizeFinance(rows) {
  const s = { enSequestre: 0, aVerser: 0, verse: 0, rembourse: 0, enCours: 0 };
  for (const r of rows) {
    const amount = num(r.subtotal);
    if (r.escrowStatus === 'bloque') s.enSequestre += amount;
    else if (r.escrowStatus === 'rembourse') s.rembourse += amount;
    else if (r.escrowStatus === 'libere') {
      if (r.payoutStatus === 'effectue') s.verse += amount;
      else if (r.payoutStatus === 'en_cours') s.enCours += amount;
      else s.aVerser += amount;
    }
  }
  return s;
}

// rows : [{ quantity, unitPrice, product: { name }, storeOrder: { createdAt } }] — lignes de commandes payées.
function buildStats(items, orders, now = new Date(), months = 6) {
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('fr-FR', { month: 'short' }), revenue: 0, orders: 0 });
  }
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  const keyOf = (date) => { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

  let totalRevenue = 0;
  for (const o of orders) {
    if (o.escrowStatus === 'rembourse' || o.status === 'annulee') continue;
    const amount = num(o.subtotal);
    totalRevenue += amount;
    const i = idx.get(keyOf(o.createdAt));
    if (i !== undefined) { buckets[i].revenue += amount; buckets[i].orders += 1; }
  }

  const perProduct = new Map();
  for (const it of items) {
    const name = it.product?.name || 'Produit';
    const e = perProduct.get(name) || { name, quantity: 0, revenue: 0 };
    e.quantity += it.quantity;
    e.revenue += it.quantity * num(it.unitPrice);
    perProduct.set(name, e);
  }
  const counted = orders.filter((o) => o.escrowStatus !== 'rembourse' && o.status !== 'annulee').length;
  return {
    months: buckets,
    totalRevenue,
    ordersCount: counted,
    averageBasket: counted ? Math.round(totalRevenue / counted) : 0,
    topProducts: [...perProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
  };
}

module.exports = { aggregateCustomers, summarizeFinance, buildStats };
