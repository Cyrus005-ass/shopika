import React, { useEffect, useState } from 'react';
import { adminApi } from '../api';

const LABELS = {
  payout: 'Versement marchand',
  payout_echec: 'Versement — échec FedaPay',
  payout_non_enregistre: 'Versement parti mais non enregistré',
  remboursement: 'Remboursement client',
  remboursement_echec: 'Remboursement — échec FedaPay',
  remboursement_non_enregistre: 'Remboursement parti mais non enregistré',
  litige_tranche: 'Litige tranché',
  boutique_suspendue: 'Boutique suspendue',
  boutique_reactivee: 'Boutique réactivée',
  boutique_supprimee: 'Boutique supprimée (sans historique)',
  note_boutique: 'Note de boutique modifiée',
  compte_desactive: 'Compte désactivé',
  compte_reactive: 'Compte réactivé',
};

const ALERT_ACTIONS = ['payout_non_enregistre', 'remboursement_non_enregistre'];

function describe(details) {
  if (!details) return '';
  return Object.entries(details)
    .map(([k, v]) => `${k} : ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' · ');
}

export default function Audit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.audit().then(setLogs).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500">Chargement...</div>;

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-[#0D0D1A] mb-2">Journal d'audit</h1>
      <p className="text-sm text-gray-500 mb-6">Les 200 dernières actions sensibles effectuées depuis l'espace admin. Ce journal est en lecture seule.</p>

      {logs.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-400">Aucune action enregistrée</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Admin</th>
                <th className="px-6 py-3 text-left">Action</th>
                <th className="px-6 py-3 text-left">Objet</th>
                <th className="px-6 py-3 text-left">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((l) => (
                <tr key={l.id} className={ALERT_ACTIONS.includes(l.action) ? 'bg-red-50' : 'hover:bg-gray-50'}>
                  <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{new Date(l.createdAt).toLocaleString('fr-FR')}</td>
                  <td className="px-6 py-3 text-gray-700">{l.admin?.fullName || `#${l.adminId}`}</td>
                  <td className="px-6 py-3 font-bold text-[#0D0D1A]">{LABELS[l.action] || l.action}</td>
                  <td className="px-6 py-3 text-gray-600">{l.entityType} {l.entityId ? `#${l.entityId}` : ''}</td>
                  <td className="px-6 py-3 text-xs text-gray-500">{describe(l.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
