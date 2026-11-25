import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Store, DollarSign, AlertTriangle, MessageSquare, Settings, LogOut, ScrollText, Package, Users, Menu, X } from 'lucide-react';
import { adminApi } from '../api';

// `badge` : clé de /admin/overview affichée en pastille sur le menu (ce qui attend une action).
const nav = [
  { label: 'Tableau de bord', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Commandes', icon: Package, to: '/orders' },
  { label: 'Boutiques', icon: Store, to: '/stores' },
  { label: 'Comptes', icon: Users, to: '/users' },
  { label: 'Versements', icon: DollarSign, to: '/payouts', badge: ['pendingPayouts', 'pendingRefunds'] },
  { label: 'Litiges', icon: AlertTriangle, to: '/disputes', badge: ['openDisputes'] },
  { label: 'Support', icon: MessageSquare, to: '/support', badge: ['openSupport'] },
  { label: "Journal d'audit", icon: ScrollText, to: '/audit' },
  { label: 'Paramètres', icon: Settings, to: '/settings' },
];

export default function Layout({ children, onLogout }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState(null);

  // Le menu mobile se referme à chaque changement de page ; les pastilles se rafraîchissent aussi.
  useEffect(() => {
    setOpen(false);
    adminApi.overview().then(setCounts).catch(() => {});
  }, [location.pathname]);

  const badgeFor = (item) => (item.badge && counts ? item.badge.reduce((s, k) => s + (counts[k] || 0), 0) : 0);

  return (
    <div className="flex min-h-screen">
      {open && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

      {/* Sidebar : tiroir sur mobile, fixe dès md */}
      <aside className={`w-64 bg-[#0D0D1A] text-white flex flex-col fixed top-0 left-0 h-full z-40 transition-transform duration-300 ease-out md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FA1757] to-[#FC7914] flex items-center justify-center font-extrabold text-white text-lg">S</div>
            <div>
              <h1 className="font-extrabold text-lg leading-tight">Shopika</h1>
              <p className="text-xs text-white/50">Espace Admin</p>
            </div>
          </div>
          <button className="md:hidden text-white/70" onClick={() => setOpen(false)} aria-label="Fermer le menu"><X size={22} /></button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const active = location.pathname === item.to;
            const Icon = item.icon;
            const n = badgeFor(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  active ? 'bg-[#FA1757] text-white shadow-lg shadow-[#FA1757]/30' : 'text-white/70 hover:bg-white/5 hover:text-white hover:translate-x-0.5'
                }`}
              >
                <Icon size={20} />
                <span className="flex-1">{item.label}</span>
                {n > 0 && <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${active ? 'bg-white text-[#FA1757]' : 'bg-[#FA1757] text-white'}`}>{n > 99 ? '99+' : n}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white w-full"
          >
            <LogOut size={20} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 md:ml-64 min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 sticky top-0 z-20 flex items-center gap-3">
          <button className="md:hidden text-[#0D0D1A]" onClick={() => setOpen(true)} aria-label="Ouvrir le menu"><Menu size={24} /></button>
          <h2 className="text-xl font-bold text-[#0D0D1A]">Administration Shopika</h2>
        </header>
        {/* key = chemin : la transition rejoue à chaque page */}
        <div key={location.pathname} className="p-4 md:p-8 page-enter">
          {children}
        </div>
      </main>
    </div>
  );
}
