import React, { useEffect, useState } from 'react';
import { adminApi } from '../api';

const PAYMENT = {
  en_attente: { label: 'Paiement en attente', cls: 'bg-orange-100 text-orange-700' },
  payee: { label: 'Payée', cls: 'bg-green-100 text-green-700' },
  echouee: { label: 'Paiement échoué', cls: 'bg-red-100 text-red-700' },
  remboursee: { label: 'Remboursée', cls: 'bg-blue-100 text-blue-700' },
  annulee: { label: 'Annulée (non payée)', cls: 'bg-gray-200 text-gray-600' },
};
const FLOW = {
  en_attente: 'À préparer', confirmee: 'Confirmée', expediee: 'Expédiée', livree: 'Livrée',
  terminee: 'Terminée', litige: 'Litige', annulee: 'Annulée',
};
const fcfa = (n) => `${Number(n).toLocaleString('fr-FR')} FCFA`;

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');

  async function load(params = {}) {
    setLoading(true);
    try {
      setOrders(await adminApi.orders(params));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function submit(e) {
    e.preventDefault();
    const params = {};
    if (status) params.status = status;
    if (q.trim()) params.q = q.trim();
    load(params);
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-[#0D0D1A] mb-6">Commandes</h1>

      <form onSubmit={submit} className="flex gap-3 mb-6">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="N° de commande, nom ou e-mail du client"
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#FA1757]"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm bg-white"
        >
          <option value="">Tous les paiements</option>
          {Object.entries(PAYMENT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className="px-5 py-2.5 rounded-xl bg-[#FA1757] text-white text-sm font-bold">Filtrer</button>
      </form>

      {loading ? (
        <div className="text-gray-500">Chargement...</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-400">Aucune commande</div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const p = PAYMENT[o.paymentStatus] || PAYMENT.en_attente;
            return (
              <div key={o.id} className="bg-white rounded-2xl shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="font-bold text-[#0D0D1A]">Commande #{o.id}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(o.createdAt).toLocaleString('fr-FR')} · {o.client?.fullName} ({o.client?.email || o.client?.phone})
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${p.cls}`}>{p.label}</span>
                    <div className="font-bold text-green-700 mt-1">{fcfa(o.totalAmount)}</div>
                  </div>
                </div>
                <div className="divide-y divide-gray-100 text-sm">
                  {o.storeOrders.map((so) => (
                    <div key={so.id} className="py-2 flex items-center justify-between gap-4">
                      <div>
                        <span className="font-medium text-gray-800">{so.store?.name}</span>
                        <span className="text-xs text-gray-400"> · #{so.id} · livraison {fcfa(so.shippingFee)}</span>
                      </div>
                      <div className="text-xs text-gray-500 text-right">
                        {FLOW[so.status] || so.status} · escrow {so.escrowStatus} · versement {so.payoutStatus}
                        {so.escrowStatus === 'rembourse' && ` · remboursement ${so.refundStatus}`}
                        <span className="font-bold text-gray-700 ml-3">{fcfa(so.subtotal)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-gray-400 mt-4">100 commandes les plus récentes correspondant au filtre.</p>
    </div>
  );
}
