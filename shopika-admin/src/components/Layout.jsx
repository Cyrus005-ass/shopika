import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Store, DollarSign, AlertTriangle, MessageSquare, Settings, LogOut, ScrollText, Package, Users } from 'lucide-react';

const nav = [
  { label: 'Tableau de bord', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Commandes', icon: Package, to: '/orders' },
  { label: 'Boutiques', icon: Store, to: '/stores' },
  { label: 'Comptes', icon: Users, to: '/users' },
  { label: 'Versements', icon: DollarSign, to: '/payouts' },
  { label: 'Litiges', icon: AlertTriangle, to: '/disputes' },
  { label: 'Support', icon: MessageSquare, to: '/support' },
  { label: "Journal d'audit", icon: ScrollText, to: '/audit' },
  { label: 'Paramètres', icon: Settings, to: '/settings' },
];

export default function Layout({ children, onLogout }) {
  const location = useLocation();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0D0D1A] text-white flex flex-col fixed top-0 left-0 h-full z-20">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FA1757] to-[#FC7914] flex items-center justify-center font-extrabold text-white text-lg">S</div>
            <div>
              <h1 className="font-extrabold text-lg leading-tight">Shopika</h1>
              <p className="text-xs text-white/50">Espace Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {nav.map((item) => {
            const active = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  active ? 'bg-[#FA1757] text-white shadow-lg shadow-[#FA1757]/30' : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={20} />
                {item.label}
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
      <main className="flex-1 ml-64">
        <header className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-10">
          <h2 className="text-xl font-bold text-[#0D0D1A]">Administration Shopika</h2>
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}