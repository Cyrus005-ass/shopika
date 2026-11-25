import React, { useEffect, useRef, useState } from 'react';
import { adminApi } from '../api';

const ROLE = { client: 'Client', marchand: 'Marchand', admin: 'Équipe Shopika' };
const REASONS = { non_recu: 'Colis non reçu', non_conforme: 'Produit non conforme', endommage: 'Produit endommagé', autre: 'Autre problème' };
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');
const when = (d) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Fil de discussion d'un litige côté admin : lit tout, peut écrire (visible du client et du marchand).
export default function DisputeThread({ storeOrderId, initial }) {
  const [dispute, setDispute] = useState(initial || null);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const box = useRef(null);

  const reload = () => adminApi.disputeThread(storeOrderId).then(setDispute).catch(() => {});
  useEffect(() => { reload(); }, [storeOrderId]);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [dispute?.messages?.length]);

  if (!dispute) return <p className="text-sm text-gray-400">Chargement du dossier…</p>;
  const open = dispute.status === 'ouvert';

  async function send(e) {
    e.preventDefault();
    if (!text.trim() && !file) { setError('Écrivez un message ou joignez une photo.'); return; }
    setBusy(true); setError('');
    try {
      const url = file ? await adminApi.uploadDisputeImage(file) : undefined;
      await adminApi.sendDisputeMessage(storeOrderId, text.trim(), url);
      setText(''); setFile(null);
      await reload();
    } catch (err) {
      setError(err.message || 'Envoi impossible');
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Motif : {REASONS[dispute.reason] || dispute.reason}</div>
      <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 whitespace-pre-wrap">{dispute.description}</p>

      <div ref={box} className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
        {dispute.messages.length === 0 && <p className="text-xs text-gray-400 text-center py-2">Aucun échange pour l'instant.</p>}
        {dispute.messages.map((m) => (
          <div key={m.id} className={`max-w-[88%] rounded-xl px-3 py-2 text-sm ${m.authorRole === 'admin' ? 'ml-auto bg-green-50' : m.authorRole === 'client' ? 'bg-blue-50' : 'bg-orange-50'}`}>
            <div className="text-[11px] font-semibold text-gray-500 mb-0.5">{ROLE[m.authorRole] || m.authorRole}{m.authorName && m.authorRole !== 'admin' ? ` · ${m.authorName}` : ''} · {when(m.createdAt)}</div>
            {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
            {safeUrl(m.attachmentUrl) && (
              <a href={safeUrl(m.attachmentUrl)} target="_blank" rel="noopener noreferrer">
                <img src={safeUrl(m.attachmentUrl)} alt="Pièce jointe" loading="lazy" className="mt-2 rounded-lg max-h-40 object-cover" />
              </a>
            )}
          </div>
        ))}
      </div>

      {open && (
        <form onSubmit={send} className="mt-3 space-y-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000} placeholder="Message visible par le client et le marchand…" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs font-semibold border border-gray-200 rounded-full px-3 py-1.5 cursor-pointer">
              📎 Photo
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => setFile(e.target.files[0] || null)} />
            </label>
            {file && <span className="text-xs text-gray-500 truncate max-w-[160px]">{file.name}</span>}
            {error && <span className="text-xs text-red-600">{error}</span>}
            <button disabled={busy} className="ml-auto btn-primary text-sm disabled:opacity-50">{busy ? 'Envoi…' : 'Envoyer'}</button>
          </div>
        </form>
      )}
    </div>
  );
}
