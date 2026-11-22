import React, { useEffect, useState } from 'react';
import { adminApi } from '../api';

const STATUS = {
  en_attente: { label: 'À verser', cls: 'bg-orange-100 text-orange-700' },
  echoue: { label: 'Échec — relancer', cls: 'bg-red-100 text-red-700' },
  en_cours: { label: 'En cours — à vérifier', cls: 'bg-blue-100 text-blue-700' },
};

const fcfa = (n) => `${Number(n).toLocaleString('fr-FR')} FCFA`;

export default function Payouts() {
  const [tab, setTab] = useState('payouts');
  const [payouts, setPayouts] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    try {
      const [p, r] = await Promise.all([adminApi.payoutsPending(), adminApi.refundsPending()]);
      setPayouts(p);
      setRefunds(r);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function run(kind, so) {
    const isPayout = kind === 'payout';
    const who = isPayout ? `au marchand (${so.store?.name})` : `au client (${so.order?.client?.fullName})`;
    const phone = isPayout ? so.store?.payoutPhone : so.order?.deliveryPhone;
    if (!confirm(`Envoyer ${fcfa(so.subtotal)} ${who} sur le ${phone || '(numéro manquant)'} ? Cette action est irréversible.`)) return;

    setBusyId(so.id);
    try {
      await (isPayout ? adminApi.payout(so.id) : adminApi.refund(so.id));
      await load();
    } catch (err) {
      alert(err.message || (isPayout ? 'Échec du versement' : 'Échec du remboursement'));
      await load(); // le statut a pu passer à "échec" / "en cours"
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div className="text-gray-500">Chargement...</div>;

  const rows = tab === 'payouts' ? payouts : refunds;
  const statusKey = tab === 'payouts' ? 'payoutStatus' : 'refundStatus';

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-[#0D0D1A] mb-6">Versements & remboursements</h1>

      <div className="flex gap-2 mb-6">
        {[
          ['payouts', `Versements marchands (${payouts.length})`],
          ['refunds', `Remboursements clients (${refunds.length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold ${
              tab === key ? 'bg-[#FA1757] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
          {tab === 'payouts' ? 'Aucun versement en attente' : 'Aucun remboursement en attente'}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Commande</th>
                <th className="px-6 py-3 text-left">Boutique</th>
                <th className="px-6 py-3 text-left">{tab === 'payouts' ? 'Marchand' : 'Client'}</th>
                <th className="px-6 py-3 text-left">Mobile Money</th>
                <th className="px-6 py-3 text-left">Statut</th>
                <th className="px-6 py-3 text-right">Montant</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((so) => {
                const st = STATUS[so[statusKey]] || STATUS.en_attente;
                const locked = so[statusKey] === 'en_cours';
                const missingPhone = tab === 'payouts' ? !so.store?.payoutPhone : !so.order?.deliveryPhone;
                return (
                  <tr key={so.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-700">#{so.id}</td>
                    <td className="px-6 py-4 font-bold text-[#0D0D1A]">{so.store?.name}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {tab === 'payouts' ? so.store?.merchant?.fullName : so.order?.client?.fullName}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {(tab === 'payouts' ? so.store?.payoutPhone : so.order?.deliveryPhone) || (
                        <span className="text-red-500 text-xs">Numéro manquant</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-green-700">{fcfa(so.subtotal)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        disabled={busyId === so.id || locked || missingPhone}
                        onClick={() => run(tab === 'payouts' ? 'payout' : 'refund', so)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FA1757] to-[#FC7914] text-white text-xs font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {busyId === so.id ? 'Envoi…' : tab === 'payouts' ? 'Verser' : 'Rembourser'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.some((so) => so[statusKey] === 'en_cours') && (
        <p className="text-xs text-gray-500 mt-4">
          « En cours » : un envoi a été lancé mais son résultat n'a pas été enregistré. Vérifiez-le dans le
          dashboard FedaPay avant toute action — il est volontairement bloqué pour éviter un double paiement.
        </p>
      )}
    </div>
  );
}
