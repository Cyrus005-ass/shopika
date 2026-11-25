import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../api';
import CountUp from '../components/CountUp';
import AreaChart from '../components/AreaChart';
import { DashboardSkeleton } from '../components/Skeleton';

const fcfa = (n) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = () => {
    setLoading(true); setFailed(false);
    adminApi.overview().then(setData).catch((e) => { console.error(e); setFailed(true); }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <DashboardSkeleton />;
  if (failed || !data) {
    return (
      <div className="card p-8 text-center">
        <p className="text-red-600 font-medium mb-3">Impossible de charger le tableau de bord.</p>
        <button className="btn-primary" onClick={load}>Réessayer</button>
      </div>
    );
  }

  // Ce qui demande une action humaine passe en premier.
  const todo = [
    { n: data.pendingPayouts, text: 'versement(s) marchand à déclencher', to: '/payouts' },
    { n: data.pendingRefunds, text: 'remboursement(s) à traiter', to: '/payouts' },
    { n: data.openDisputes, text: 'litige(s) ouvert(s)', to: '/disputes' },
    { n: data.openSupport, text: 'message(s) de support non traité(s)', to: '/support' },
  ].filter((t) => t.n > 0);

  const cards = [
    { label: 'Ventes (30 jours)', value: data.gmv30 ?? 0, format: fcfa, color: 'bg-emerald-50', text: 'text-emerald-700', icon: '📈' },
    { label: 'Commandes payées (30 j)', value: data.paidOrders30 ?? 0, color: 'bg-green-50', text: 'text-green-700', icon: '🧾' },
    { label: 'Versements en attente', value: data.pendingPayouts, color: 'bg-orange-50', text: 'text-orange-700', icon: '💰' },
    { label: 'Remboursements en attente', value: data.pendingRefunds, color: 'bg-yellow-50', text: 'text-yellow-700', icon: '↩️' },
    { label: 'Litiges ouverts', value: data.openDisputes, color: 'bg-red-50', text: 'text-red-700', icon: '⚠️' },
    { label: 'Support non traité', value: data.openSupport, color: 'bg-blue-50', text: 'text-blue-700', icon: '💬' },
    { label: 'Boutiques', value: data.totalStores, color: 'bg-purple-50', text: 'text-purple-700', icon: '🏪' },
    { label: 'Commandes (total)', value: data.totalOrders, color: 'bg-sky-50', text: 'text-sky-700', icon: '📦' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-[#0D0D1A] mb-6">Tableau de bord</h1>

      {todo.length > 0 && (
        <div className="card p-5 mb-6 border-l-4 border-l-[#FA1757]">
          <div className="font-bold mb-2">À traiter maintenant</div>
          <ul className="space-y-1.5">
            {todo.map((t) => (
              <li key={t.text} className="text-sm text-gray-700">
                <Link to={t.to} className="hover:underline"><strong className="text-[#FA1757]">{t.n}</strong> {t.text} →</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 stagger">
        {cards.map((c, i) => (
          <div key={c.label} className={`${c.color} rounded-2xl p-6 transition-transform hover:-translate-y-0.5`} style={{ '--i': i }}>
            <div className="text-3xl mb-2">{c.icon}</div>
            <div className={`text-3xl font-extrabold ${c.text}`}><CountUp value={c.value} format={c.format} /></div>
            <div className="text-sm text-gray-600 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {Array.isArray(data.series) && data.series.length > 1 && (
        <div className="card p-6 mt-6">
          <div className="font-bold mb-1">Ventes payées, 30 derniers jours</div>
          <p className="text-sm text-gray-500 mb-3">Montant total des commandes payées, jour par jour.</p>
          <AreaChart data={data.series} />
        </div>
      )}
    </div>
  );
}
