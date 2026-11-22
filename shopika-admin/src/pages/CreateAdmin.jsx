import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';

export default function CreateAdmin() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await authApi.createAdmin(fullName, phone, password);
      setSuccess('Administrateur crÃ©e avec succÃ¨s');
      setFullName('');
      setPhone('');
      setPassword('');
    } catch (err) {
      setError(err.body?.error || err.body?.message || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F6F9] p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="w-10 h-10 rounded-xl bg-[#FA1757] flex items-center justify-center font-bold text-white mr-2">S</div>
            <h1 className="text-xl font-extrabold text-[#0D0D1A] inline">CrÃ©er un administrateur</h1>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-[#FA1757] font-medium hover:underline"
          >
            Annuler
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jean Dupont"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#FA1757] focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">TÃ©lÃ©phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+2250700000001"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#FA1757] focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#FA1757] focus:border-transparent"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#FA1757] to-[#FC7914] text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer cet administrateur'}
          </button>
        </form>
      </div>
    </div>
  );
}
