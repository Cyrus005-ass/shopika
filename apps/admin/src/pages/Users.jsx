import React, { useEffect, useState } from 'react';
import { adminApi } from '../api';

const ROLE = {
  client: 'bg-gray-100 text-gray-700',
  marchand: 'bg-purple-100 text-purple-700',
  admin: 'bg-pink-100 text-pink-700',
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState(null);

  async function load(params = {}) {
    setLoading(true);
    try {
      setUsers(await adminApi.users(params));
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
    if (role) params.role = role;
    if (q.trim()) params.q = q.trim();
    load(params);
  }

  async function toggle(u) {
    const next = !u.isActive;
    const msg = next
      ? `Réactiver le compte de ${u.fullName} ?`
      : `Désactiver le compte de ${u.fullName} ? La personne sera déconnectée immédiatement et ne pourra plus se reconnecter.`;
    if (!confirm(msg)) return;
    setBusyId(u.id);
    try {
      const updated = await adminApi.setUserActive(u.id, next);
      setUsers((s) => s.map((x) => (x.id === u.id ? updated : x)));
    } catch (err) {
      alert(err.message || 'Erreur');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-[#0D0D1A] mb-6">Comptes</h1>

      <form onSubmit={submit} className="flex gap-3 mb-6">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nom, e-mail ou téléphone"
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#FA1757]"
        />
        <select value={role} onChange={(e) => setRole(e.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm bg-white">
          <option value="">Tous les rôles</option>
          <option value="client">Clients</option>
          <option value="marchand">Marchands</option>
          <option value="admin">Admins</option>
        </select>
        <button className="px-5 py-2.5 rounded-xl bg-[#FA1757] text-white text-sm font-bold">Filtrer</button>
      </form>

      {loading ? (
        <div className="text-gray-500">Chargement...</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Nom</th>
                <th className="px-6 py-3 text-left">Contact</th>
                <th className="px-6 py-3 text-left">Rôle</th>
                <th className="px-6 py-3 text-left">Commandes</th>
                <th className="px-6 py-3 text-left">Statut</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <div className="font-bold text-[#0D0D1A]">{u.fullName}</div>
                    <div className="text-xs text-gray-400">inscrit le {new Date(u.createdAt).toLocaleDateString('fr-FR')}</div>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{u.email || u.phone || '—'}</td>
                  <td className="px-6 py-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${ROLE[u.role]}`}>{u.role}</span>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{u._count?.orders ?? 0}</td>
                  <td className="px-6 py-3">
                    {u.isActive ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">Actif</span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">Désactivé</span>
                    )}
                    {u.lockedUntil && new Date(u.lockedUntil) > new Date() && (
                      <div className="text-xs text-orange-600 mt-1">Verrouillé (tentatives échouées)</div>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {u.role === 'admin' ? (
                      <span className="text-xs text-gray-400">Protégé</span>
                    ) : (
                      <button
                        disabled={busyId === u.id}
                        onClick={() => toggle(u)}
                        className={`text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 ${
                          u.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        {u.isActive ? 'Désactiver' : 'Réactiver'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <div className="p-8 text-center text-gray-400">Aucun compte</div>}
        </div>
      )}
      <p className="text-xs text-gray-400 mt-4">200 comptes les plus récents correspondant au filtre.</p>
    </div>
  );
}
