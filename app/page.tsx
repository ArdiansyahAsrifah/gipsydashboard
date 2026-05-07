'use client';

import { useState, useEffect } from 'react';
import LoginPage from './loginpage';
import Dashboard from './Dashboard'; 

interface User {
  username: string;
  name: string;
  role: string;
}

const SESSION_KEY = 'gipsy_user';

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  // Cek session dari localStorage saat pertama load
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        setUser(JSON.parse(saved));
      }
    } catch (_) {}
    setChecking(false);
  }, []);

  const handleLogin = (loggedInUser: User) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(loggedInUser));
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  // Tampilkan layar kosong sebentar saat cek session (hindari flash)
  if (checking) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0A0F1A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: 28, height: 28,
          border: '2px solid #1F2937',
          borderTopColor: '#2DD4BF',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Belum login → tampilkan LoginPage
  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Sudah login → tampilkan Dashboard dengan user info
  return <Dashboard user={user} onLogout={handleLogout} />;
}