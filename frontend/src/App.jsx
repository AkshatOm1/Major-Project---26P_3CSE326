import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import API, { API_BASE_URL } from './api';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import UploadNotes from './pages/UploadNotes';
import AITutorChat from './pages/AITutorChat';
import TakeQuiz from './pages/TakeQuiz';
import MyScores from './pages/MyScores';
import StudyNotes from './pages/StudyNotes';
import Courses from './pages/Courses';

function ConnectionStatus() {
  const [status, setStatus] = useState({ kind: 'checking', label: 'Checking connection', detail: 'Checking backend and quiz providers' });

  useEffect(() => {
    let disposed = false;
    let timer;
    const check = async () => {
      if (!navigator.onLine) {
        setStatus({ kind: 'offline', label: 'Offline', detail: 'No internet connection. Material quizzes can use the local model when the backend is running.' });
        return;
      }
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 3500);
      try {
        const response = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Backend health check failed');
        const data = await response.json();
        if (disposed) return;
        if (data.online_quiz_ai_configured) {
          setStatus({ kind: 'online', label: 'Online', detail: 'Backend connected; online quiz AI is configured.' });
        } else if (data.offline_material_quiz_available) {
          setStatus({ kind: 'local', label: 'Local mode', detail: 'Backend connected; local material quiz model is available.' });
        } else {
          setStatus({ kind: 'limited', label: 'Connected · Limited', detail: 'Backend connected, but quiz generation providers are not configured.' });
        }
      } catch {
        if (!disposed) setStatus({ kind: 'offline', label: 'Offline', detail: 'Backend is unreachable. Start the backend to use saved materials and local quizzes.' });
      } finally {
        window.clearTimeout(timeout);
        if (!disposed) timer = window.setTimeout(check, 15000);
      }
    };
    const onNetworkChange = () => { window.clearTimeout(timer); check(); };
    window.addEventListener('online', onNetworkChange);
    window.addEventListener('offline', onNetworkChange);
    check();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.removeEventListener('online', onNetworkChange);
      window.removeEventListener('offline', onNetworkChange);
    };
  }, []);

  const colors = {
    checking: ['#475569', '#f1f5f9', '#cbd5e1'],
    online: ['#047857', '#ecfdf5', '#a7f3d0'],
    local: ['#1d4ed8', '#eff6ff', '#bfdbfe'],
    limited: ['#a16207', '#fffbeb', '#fde68a'],
    offline: ['#b91c1c', '#fef2f2', '#fecaca'],
  }[status.kind];

  return <div role="status" aria-live="polite" title={status.detail} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 999, background: colors[1], border: `1px solid ${colors[2]}`, color: colors[0], fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: colors[0], boxShadow: status.kind === 'online' ? `0 0 0 3px ${colors[2]}` : 'none' }} />
    {status.label}
  </div>;
}

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';
  return <button
    type="button"
    className="theme-toggle"
    data-no-liquid
    onClick={onToggle}
    aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    aria-pressed={isDark}
    title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
  >
    <span aria-hidden="true">{isDark ? '☀️' : '☾'}</span>
    <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
  </button>;
}

function LightSquareField() {
  return <div className="light-square-field" aria-hidden="true">
    {Array.from({ length: 10 }, (_, index) => <span className="light-square" key={index} />)}
  </div>;
}

function SidebarChatCompanion() {
  return <Link to="/chat" className="sidebar-companion" aria-label="Open AI Tutor Chat">
    <span className="companion-speech">Hi! Click me to chat</span>
    <svg className="companion-mascot" viewBox="0 0 112 112" role="img" aria-label="Waving AI assistant">
      <path d="M22 57h68v39H22z" fill="#4f6df5" />
      <rect x="29" y="58" width="54" height="30" rx="13" fill="#dbeafe" />
      <path d="M31 40c0-15 11-26 25-26s25 11 25 26v10H31z" fill="#f8fafc" stroke="#93c5fd" strokeWidth="3" />
      <path d="M38 39a4 4 0 1 0 0 .1M74 39a4 4 0 1 0 0 .1" fill="#334155" />
      <path d="M47 49q9 7 18 0" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M56 14V7" stroke="#93c5fd" strokeWidth="3" strokeLinecap="round" />
      <circle cx="56" cy="5" r="4" fill="#fbbf24" />
      <g className="assistant-bot-arm">
        <path d="M86 65 96 50" stroke="#dbeafe" strokeWidth="10" strokeLinecap="round" />
        <path d="M96 50 101 38" stroke="#f8fafc" strokeWidth="9" strokeLinecap="round" />
        <path d="M96 39q0-6 5-6t5 6" fill="none" stroke="#f8fafc" strokeWidth="5" strokeLinecap="round" />
      </g>
      <path d="M43 96v7m26-7v7" stroke="#bfdbfe" strokeWidth="7" strokeLinecap="round" />
      <circle cx="45" cy="72" r="3" fill="#4f6df5" />
      <circle cx="56" cy="72" r="3" fill="#4f6df5" />
      <circle cx="67" cy="72" r="3" fill="#4f6df5" />
    </svg>
  </Link>;
}

function MainLayout({ user, onUserChange, onSignOut, theme, onToggleTheme }) {
  const location = useLocation();
  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/upload', label: 'Upload Notes', icon: '📤' },
    { path: '/study-notes', label: 'Study Notes', icon: '📚' },
    { path: '/courses', label: 'My Courses', icon: '🎓' },
    { path: '/chat', label: 'AI Tutor Chat', icon: '💬' },
    { path: '/take-quiz', label: 'Take Quiz', icon: '🏷️' },
    { path: '/scores', label: 'My Scores', icon: '📈' },
  ];

  return (
    <div className={`app-theme app-layout ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`} style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {theme === 'light' && <LightSquareField />}
      <aside style={{ width: 240, flexShrink: 0, background: '#0f172a', color: '#fff', padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 750, marginBottom: 30 }}>📖 LearnAI</div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return <Link key={item.path} to={item.path} className={`sidebar-link${active ? ' sidebar-link-active' : ''}`} aria-current={active ? 'page' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, color: active ? '#38bdf8' : '#94a3b8', background: 'transparent', textDecoration: 'none', fontWeight: active ? 650 : 400 }}><span className="sidebar-link-icon">{item.icon}</span><span className="sidebar-link-label">{item.label}</span></Link>;
            })}
          </nav>
        </div>
        <SidebarChatCompanion />
        <div style={{ borderTop: '1px solid #334155', paddingTop: 16, marginTop: 24 }}>
          <div style={{ fontWeight: 700 }}>{user.name}</div>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>@{user.username}{user.domain ? ` · ${user.domain}` : ''}</div>
          <button onClick={onSignOut} style={{ marginTop: 12, padding: '8px 10px', color: '#cbd5e1', background: '#1e293b', border: 0, borderRadius: 7, cursor: 'pointer' }}>Sign out</button>
        </div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, background: '#f8fafc', padding: 24 }}>
        <div className="app-topbar" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, minHeight: 40, marginBottom: 8 }}>
          <ConnectionStatus />
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
        <Routes>
          <Route path="/" element={<Dashboard user={user} onUserChange={onUserChange} />} />
          <Route path="/upload" element={<UploadNotes />} />
          <Route path="/study-notes" element={<StudyNotes />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/chat" element={<AITutorChat />} />
          <Route path="/take-quiz" element={<TakeQuiz />} />
          <Route path="/scores" element={<MyScores />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('learnai-theme') === 'dark' ? 'dark' : 'light');

  const toggleTheme = () => setTheme((current) => {
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('learnai-theme', next);
    return next;
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setCheckingSession(false);
      return;
    }
    API.get('/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => { localStorage.removeItem('token'); localStorage.removeItem('user'); })
      .finally(() => setCheckingSession(false));
  }, []);

  const authenticate = (result) => {
    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result.user));
    setUser(result.user);
  };
  const updateUser = (nextUser) => {
    localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
  };
  const signOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (checkingSession) return <div className={`app-theme ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`} style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#64748b', fontFamily: 'system-ui' }}>Loading your account…</div>;
  if (!user) return <div className={`app-theme auth-theme-shell ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
    {theme === 'light' && <LightSquareField />}
    <div className="auth-theme-toggle"><ThemeToggle theme={theme} onToggle={toggleTheme} /></div>
    <Auth onAuthenticated={authenticate} />
  </div>;
  return <Router><MainLayout user={user} onUserChange={updateUser} onSignOut={signOut} theme={theme} onToggleTheme={toggleTheme} /></Router>;
}
