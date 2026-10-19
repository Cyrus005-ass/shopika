import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Stores from './pages/Stores';
import Payouts from './pages/Payouts';
import Disputes from './pages/Disputes';
import Support from './pages/Support';
import Audit from './pages/Audit';
import Orders from './pages/Orders';
import Users from './pages/Users';
import Settings from './pages/Settings';
import FirstAdminSetup from './pages/FirstAdminSetup';
import CreateAdmin from './pages/CreateAdmin';
import { authApi } from './api';

function Protected({ children }) {
  const token = localStorage.getItem('shopika_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [adminExists, setAdminExists] = useState(false);

  useEffect(() => {
    authApi.adminExists()
      .then(({ exists }) => {
        setAdminExists(exists);
        setChecking(false);
      })
      .catch(() => {
        setChecking(false);
      });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('shopika_token');
    localStorage.removeItem('shopika_user');
    navigate('/login');
  };

  const page = (element) => (
    <Protected>
      <Layout onLogout={handleLogout}>{element}</Layout>
    </Protected>
  );

  // Si on est encore en train de vérifier, on n'affiche rien
  if (checking) return null;

  // Aucun admin n'existe : on force la création du premier
  if (!adminExists) {
    return (
      <Routes>
        <Route path="/setup" element={<FirstAdminSetup />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  // Un admin existe : routes normales
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin/create" element={page(<CreateAdmin />)} />
      <Route path="/" element={page(<Dashboard />)} />
      <Route path="/dashboard" element={page(<Dashboard />)} />
      <Route path="/orders" element={page(<Orders />)} />
      <Route path="/stores" element={page(<Stores />)} />
      <Route path="/users" element={page(<Users />)} />
      <Route path="/payouts" element={page(<Payouts />)} />
      <Route path="/disputes" element={page(<Disputes />)} />
      <Route path="/support" element={page(<Support />)} />
      <Route path="/audit" element={page(<Audit />)} />
      <Route path="/settings" element={page(<Settings />)} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
