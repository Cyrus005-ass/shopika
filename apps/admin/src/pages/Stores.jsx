import React, { useEffect, useState } from 'react';
import { adminApi } from '../api';

const STATE_STYLE = {
  active: { label: 'Active', cls: 'bg-green-100 text-green-700' },
  expiree: { label: 'Abonnement expiré', cls: 'bg-orange-100 text-orange-700' },
  suspendue: { label: 'Suspendue', cls: 'bg-red-100 text-red-700' },
};

export default function Stores() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    adminApi.stores().then(setStores).catch(console.error).finally(() => setLoading(false));
  }, []);

  const replace = (updated) => setStores((s) => s.map((x) => (x.id === updated.id ? updated : x)));

  async function handleSuspend(store) {
    const reason = prompt(`Motif de la suspension de « ${store.name} » (visible par le marchand) :`);
    if (reason === null) return;
    if (!reason.trim()) return alert('Un motif est obligatoire');
    setBusyId(store.id);
    try {
      replace(await adminApi.suspendStore(store.id, reason.trim()));
    } catch (err) {
      alert(err.message || 'Erreur lors de la suspension');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReactivate(store) {
    if (!confirm(`Réactiver la boutique « ${store.name} » ?`)) return;
    setBusyId(store.id);
    try {
      replace(await adminApi.reactivateStore(store.id));
    } catch (err) {
      alert(err.message || 'Erreur lors de la réactivation');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRating(id, current) {
    const val = prompt('Note (0-5) :', current || '');
    if (val === null) return;
    const rating = parseFloat(val);
    if (isNaN(rating) || rating < 0 || rating > 5) return alert('Note invalide');
    try {
      replace(await adminApi.updateStoreRating(id, rating));
    } catch (err) {
      alert(err.message || 'Erreur lors de la mise à jour');
    }
  }

  if (loading) return <div className="text-gray-500">Chargement...</div>;

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-[#0D0D1A] mb-4">Boutiques</h1>

      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3 mb-6">
        Une boutique ne se supprime pas : elle se <strong>suspend</strong>. Son historique de commandes,
        d'escrows et de paiements reste intact, et elle peut être réactivée à tout moment.
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-3 text-left">Boutique</th>
              <th className="px-6 py-3 text-left">Sous-domaine</th>
              <th className="px-6 py-3 text-left">Marchand</th>
              <th className="px-6 py-3 text-left">Statut</th>
              <th className="px-6 py-3 text-left">Note</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stores.map((s) => {
              const st = STATE_STYLE[s.state] || STATE_STYLE.expiree;
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {s.logoUrl ? (
                        <img src={s.logoUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400 text-xs">LOGO</div>
                      )}
                      <div>
                        <div className="font-bold text-[#0D0D1A]">{s.name}</div>
                        <div className="text-xs text-gray-400">
                          {[s.city, s.country].filter(Boolean).join(', ') || '—'} · {s._count?.products ?? 0} produit(s) · {s._count?.storeOrders ?? 0} commande(s)
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{s.subdomain}</td>
                  <td className="px-6 py-4">
                    <div className="text-gray-700">{s.merchant?.fullName}</div>
                    <div className="text-xs text-gray-400">{s.merchant?.phone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${st.cls}`}>{st.label}</span>
                    {s.isSuspended && s.suspendedReason && (
                      <div className="text-xs text-gray-400 mt-1 max-w-[220px]">Motif : {s.suspendedReason}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {s.rating ? parseFloat(s.rating).toFixed(1) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => handleRating(s.id, s.rating)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
                    >
                      Note
                    </button>
                    {s.isSuspended ? (
                      <button
                        disabled={busyId === s.id}
                        onClick={() => handleReactivate(s)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
                      >
                        Réactiver
                      </button>
                    ) : (
                      <button
                        disabled={busyId === s.id}
                        onClick={() => handleSuspend(s)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                      >
                        Suspendre
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {stores.length === 0 && <div className="p-8 text-center text-gray-400">Aucune boutique</div>}
      </div>
    </div>
  );
}
