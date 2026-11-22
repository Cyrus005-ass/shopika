import React, { useEffect, useState } from 'react';
import { adminApi } from '../api';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.overview().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500">Chargement...</div>;
  if (!data) return <div className="text-red-500">Erreur de chargement</div>;

  const cards = [
    { label: 'Versements en attente', value: data.pendingPayouts, color: 'bg-orange-50', text: 'text-orange-700', icon: '💰' },
    { label: 'Remboursements en attente', value: data.pendingRefunds, color: 'bg-yellow-50', text: 'text-yellow-700', icon: '↩️' },
    { label: 'Litiges ouverts', value: data.openDisputes, color: 'bg-red-50', text: 'text-red-700', icon: '⚠️' },
    { label: 'Support non traité', value: data.openSupport, color: 'bg-blue-50', text: 'text-blue-700', icon: '💬' },
    { label: 'Boutiques suspendues', value: data.suspendedStores, color: 'bg-gray-100', text: 'text-gray-700', icon: '⏸️' },
    { label: 'Boutiques', value: data.totalStores, color: 'bg-purple-50', text: 'text-purple-700', icon: '🏪' },
    { label: 'Commandes', value: data.totalOrders, color: 'bg-green-50', text: 'text-green-700', icon: '📦' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-[#0D0D1A] mb-6">Tableau de bord</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`${c.color} rounded-2xl p-6`}>
            <div className="text-3xl mb-2">{c.icon}</div>
            <div className="text-3xl font-extrabold">{c.value}</div>
            <div className="text-sm text-gray-600 mt-1">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}