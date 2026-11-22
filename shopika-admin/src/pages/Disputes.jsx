import React, { useEffect, useState } from 'react';
import { adminApi } from '../api';

export default function Disputes() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    adminApi.disputes().then(setItems).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleResolve(so, resolution) {
    const amount = `${Number(so.subtotal).toLocaleString('fr-FR')} FCFA`;
    const msg = resolution === 'libere'
      ? `Donner raison au marchand « ${so.store?.name} » ?\n${amount} seront à verser au marchand (onglet Versements).`
      : `Donner raison au client ${so.order?.client?.fullName || ''} ?\n${amount} seront à rembourser au client (onglet Remboursements).`;
    if (!confirm(msg)) return;

    setBusyId(so.id);
    try {
      await adminApi.resolveDispute(so.id, resolution);
      // Le litige est tranché : il quitte la liste (avant, il y restait avec un statut périmé).
      setItems((s) => s.filter((x) => x.id !== so.id));
      setNotice(
        resolution === 'libere'
          ? `Litige #${so.id} tranché : versement à déclencher dans « Versements & remboursements ».`
          : `Litige #${so.id} tranché : remboursement à déclencher dans « Versements & remboursements ».`
      );
    } catch (err) {
      alert(err.message || 'Erreur lors de la résolution');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div className="text-gray-500">Chargement...</div>;

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-[#0D0D1A] mb-6">Litiges</h1>

      {notice && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3 mb-4">{notice}</div>
      )}

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
          Aucun litige ouvert
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((so) => (
            <div key={so.id} className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold text-gray-400">Commande #{so.orderId} · sous-commande #{so.id}</span>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">LITIGE</span>
                  </div>
                  <div className="font-bold text-[#0D0D1A]">{so.store?.name}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    Client : {so.order?.client?.fullName} ({so.order?.client?.email || so.order?.client?.phone})
                  </div>
                  <div className="text-sm text-gray-500">
                    Articles : {so.items?.map((i) => `${i.product?.name} x${i.quantity}`).join(', ')}
                  </div>
                  <div className="text-sm font-bold text-green-700 mt-1">
                    {Number(so.subtotal).toLocaleString('fr-FR')} FCFA
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    disabled={busyId === so.id}
                    onClick={() => handleResolve(so, 'libere')}
                    className="px-4 py-2 rounded-xl bg-green-50 text-green-700 text-xs font-bold hover:bg-green-100 disabled:opacity-50"
                  >
                    Libérer au marchand
                  </button>
                  <button
                    disabled={busyId === so.id}
                    onClick={() => handleResolve(so, 'rembourse')}
                    className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 disabled:opacity-50"
                  >
                    Rembourser le client
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
