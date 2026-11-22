import React, { useEffect, useState } from 'react';
import { adminApi } from '../api';

export default function Support() {
  const [messages, setMessages] = useState([]);
  const [replies, setReplies] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.supportMessages().then((data) => {
      setMessages(data);
      const init = {};
      data.forEach((m) => (init[m.id] = m.adminReply || ''));
      setReplies(init);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleReply(id) {
    const reply = replies[id];
    if (!reply.trim()) return alert('Rédigez une réponse');
    try {
      const updated = await adminApi.replySupport(id, reply);
      setMessages((s) => s.map((m) => (m.id === id ? updated : m)));
    } catch (err) {
      alert(err.message || 'Erreur lors de l\'envoi de la réponse');
    }
  }

  if (loading) return <div className="text-gray-500">Chargement...</div>;

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-[#0D0D1A] mb-6">Support (clients et marchands)</h1>
      {messages.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
          Aucun message
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((m) => (
            <div key={m.id} className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold text-[#0D0D1A] flex items-center gap-2">
                    {m.merchant?.fullName}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      m.merchant?.role === 'client' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {m.merchant?.role === 'client' ? 'Client' : 'Marchand'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {[m.merchant?.email, m.merchant?.phone].filter(Boolean).join(' · ') || 'Aucun contact'} · {new Date(m.createdAt).toLocaleString('fr-FR')}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  m.status === 'traite' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {m.status === 'traite' ? 'Traité' : 'Ouvert'}
                </span>
              </div>
              <div className="text-sm font-bold text-gray-700 mb-1">{m.subject}</div>
              <div className="text-sm text-gray-600 mb-3">{m.message}</div>
              {m.adminReply && (
                <div className="bg-green-50 border-l-4 border-green-400 p-3 rounded-r-lg mb-3">
                  <div className="text-xs font-bold text-green-700 mb-1">Réponse admin</div>
                  <div className="text-sm text-green-800">{m.adminReply}</div>
                </div>
              )}
              <textarea
                value={replies[m.id] || ''}
                onChange={(e) => setReplies((r) => ({ ...r, [m.id]: e.target.value }))}
                placeholder="Rédigez votre réponse..."
                rows={2}
                className="w-full px-4 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#FA1757]"
              />
              <button
                onClick={() => handleReply(m.id)}
                className="mt-2 px-4 py-2 rounded-xl bg-[#FA1757] text-white text-xs font-bold hover:opacity-90"
              >
                Envoyer la réponse
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}