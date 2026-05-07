'use client';

import { useState, useEffect } from 'react';

// ─── Akun yang diizinkan ────────────────────────────────────────────────────────
const ACCOUNTS = [
  { username: 'admin',   password: 'gipsy2025',   name: 'Admin Utama',  role: 'Super Admin' },
  { username: 'ian',     password: 'reza#123',     name: 'Ian',          role: 'Manager' },
  { username: 'asrifah', password: 'nadia@456',    name: 'Asrifah',      role: 'Analyst' },
];

interface LoginPageProps {
  onLogin: (user: { username: string; name: string; role: string }) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogin = () => {
    if (!username || !password) {
      setError('Username dan password wajib diisi.');
      return;
    }
    setLoading(true);
    setError('');

    // Simulasi delay autentikasi
    setTimeout(() => {
      const found = ACCOUNTS.find(
        a => a.username === username.trim().toLowerCase() && a.password === password
      );
      if (found) {
        onLogin({ username: found.username, name: found.name, role: found.role });
      } else {
        setError('Username atau password salah.');
        setShake(true);
        setTimeout(() => setShake(false), 600);
      }
      setLoading(false);
    }, 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'DM Sans', sans-serif;
          background: #0A0F1A;
          color: #F9FAFB;
        }

        .login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0A0F1A;
          position: relative;
          overflow: hidden;
          font-family: 'DM Sans', sans-serif;
        }

        /* Background decorative blobs */
        .bg-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
        }
        .blob-1 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(45,212,191,0.12) 0%, transparent 70%);
          top: -100px; left: -100px;
          animation: floatBlob 8s ease-in-out infinite;
        }
        .blob-2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%);
          bottom: -80px; right: -80px;
          animation: floatBlob 10s ease-in-out infinite reverse;
        }
        .blob-3 {
          width: 200px; height: 200px;
          background: radial-gradient(circle, rgba(167,139,250,0.06) 0%, transparent 70%);
          top: 50%; left: 60%;
          animation: floatBlob 12s ease-in-out infinite;
        }

        /* Grid pattern overlay */
        .bg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(45,212,191,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(45,212,191,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          z-index: 0;
        }

        .login-panel {
          position: relative;
          z-index: 1;
          width: 420px;
          max-width: 92vw;
          opacity: 0;
          transform: translateY(20px);
          animation: panelIn 0.6s cubic-bezier(0.22,1,0.36,1) 0.1s forwards;
        }

        /* Brand header */
        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 40px;
          justify-content: center;
        }
        .brand-icon {
          width: 44px; height: 44px;
          background: linear-gradient(135deg, #134E4A, #0D2D29);
          border: 1px solid rgba(45,212,191,0.3);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 20px rgba(45,212,191,0.15);
        }
        .brand-name {
          font-family: 'Syne', sans-serif;
          font-size: 26px;
          font-weight: 700;
          color: #F9FAFB;
          letter-spacing: -0.5px;
        }
        .brand-name span {
          color: #2DD4BF;
        }

        /* Card */
        .login-card {
          background: rgba(17, 24, 39, 0.8);
          border: 0.5px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 36px 32px 32px;
          backdrop-filter: blur(20px);
          box-shadow:
            0 0 0 0.5px rgba(45,212,191,0.08),
            0 24px 80px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .login-title {
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #F9FAFB;
          margin-bottom: 6px;
          letter-spacing: -0.3px;
        }
        .login-sub {
          font-size: 13px;
          color: #6B7280;
          margin-bottom: 28px;
          line-height: 1.5;
        }

        /* Form */
        .field {
          margin-bottom: 16px;
        }
        .field-label {
          font-size: 11px;
          font-weight: 500;
          color: #9CA3AF;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-bottom: 7px;
          display: block;
        }
        .input-wrap {
          position: relative;
        }
        .input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #4B5563;
          pointer-events: none;
          transition: color 0.2s;
        }
        .input-wrap:focus-within .input-icon {
          color: #2DD4BF;
        }
        .field-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 0.5px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 11px 12px 11px 38px;
          font-size: 13px;
          color: #F9FAFB;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .field-input::placeholder { color: #4B5563; }
        .field-input:focus {
          border-color: rgba(45,212,191,0.5);
          background: rgba(45,212,191,0.04);
          box-shadow: 0 0 0 3px rgba(45,212,191,0.08);
        }
        .field-input.has-error {
          border-color: rgba(248,113,113,0.5);
        }
        .pass-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #4B5563;
          cursor: pointer;
          padding: 2px;
          transition: color 0.15s;
          display: flex;
          align-items: center;
        }
        .pass-toggle:hover { color: #9CA3AF; }

        /* Error */
        .error-msg {
          display: flex;
          align-items: center;
          gap: 7px;
          background: rgba(248,113,113,0.08);
          border: 0.5px solid rgba(248,113,113,0.25);
          border-radius: 8px;
          padding: 9px 12px;
          font-size: 12px;
          color: #FCA5A5;
          margin-bottom: 16px;
        }

        /* Shake */
        .shake {
          animation: shakeAnim 0.5s cubic-bezier(.36,.07,.19,.97);
        }

        /* Submit button */
        .login-btn {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #0F766E, #0D9488);
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          color: #F0FDFA;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 20px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(13,148,136,0.3);
          letter-spacing: 0.2px;
        }
        .login-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent);
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 28px rgba(13,148,136,0.4);
        }
        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .login-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Spinner */
        .btn-spin {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: rot 0.7s linear infinite;
          flex-shrink: 0;
        }

        /* Footer */
        .login-footer {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 0.5px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .secure-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: #4B5563;
        }

        /* Bottom text */
        .login-bottom {
          text-align: center;
          margin-top: 20px;
          font-size: 11px;
          color: #374151;
        }

        @keyframes panelIn {
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatBlob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(20px, -20px) scale(1.05); }
          66% { transform: translate(-10px, 15px) scale(0.97); }
        }
        @keyframes rot {
          to { transform: rotate(360deg); }
        }
        @keyframes shakeAnim {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(4px); }
          30%, 50%, 70% { transform: translateX(-6px); }
          40%, 60% { transform: translateX(6px); }
        }
      `}</style>

      <div className="login-root">
        <div className="bg-grid" />
        <div className="bg-blob blob-1" />
        <div className="bg-blob blob-2" />
        <div className="bg-blob blob-3" />

        <div className="login-panel">
          {/* Brand */}
          <div className="brand">
            <div className="brand-icon">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L14 13H2L8 1Z" fill="#2DD4BF" />
              </svg>
            </div>
            <span className="brand-name">Gipsy<span>AI</span></span>
          </div>

          {/* Card */}
          <div className={`login-card${shake ? ' shake' : ''}`}>
            <div className="login-title">Selamat datang kembali</div>
            <div className="login-sub">Masuk ke dashboard analitik GipsyAI</div>

            {/* Error */}
            {error && (
              <div className="error-msg">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            {/* Username */}
            <div className="field">
              <label className="field-label">Username</label>
              <div className="input-wrap">
                <svg className="input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  className={`field-input${error ? ' has-error' : ''}`}
                  type="text"
                  placeholder="Masukkan username"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                  onKeyDown={handleKeyDown}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div className="field">
              <label className="field-label">Password</label>
              <div className="input-wrap">
                <svg className="input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                <input
                  className={`field-input${error ? ' has-error' : ''}`}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Masukkan password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  onKeyDown={handleKeyDown}
                  autoComplete="current-password"
                  style={{ paddingRight: 40 }}
                />
                <button className="pass-toggle" onClick={() => setShowPass(s => !s)} type="button" tabIndex={-1}>
                  {showPass
                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" /></svg>
                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  }
                </button>
              </div>
            </div>

            {/* Submit */}
            <button className="login-btn" onClick={handleLogin} disabled={loading}>
              {loading
                ? <><div className="btn-spin" /> Memverifikasi...</>
                : <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
                  </svg>
                  Masuk ke Dashboard
                </>
              }
            </button>

            {/* Footer */}
            <div className="login-footer">
              <div className="secure-badge">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Akses terbatas — hanya untuk tim internal
              </div>
            </div>
          </div>

          <div className="login-bottom">
            GipsyAI Dashboard © {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </>
  );
}