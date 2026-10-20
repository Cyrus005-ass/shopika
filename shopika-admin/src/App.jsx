import React from 'react';
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

function Protected({ children }) {
  const token = localStorage.getItem('shopika_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const navigate = useNavigate();
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

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
