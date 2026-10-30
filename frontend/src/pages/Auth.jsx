import React, { useState } from 'react';
import API from '../api';

export default function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', name: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const endpoint = mode === 'signup' ? '/auth/signup' : '/auth/login';
      const payload = mode === 'signup'
        ? { username: form.username, name: form.name, password: form.password }
        : { username: form.username, password: form.password };
      const { data } = await API.post(endpoint, payload);
      onAuthenticated(data);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not connect to the learning server. Check that the backend is running.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      <section style={{ width: '100%', maxWidth: 440, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 32, boxShadow: '0 12px 40px rgba(15,23,42,.08)' }}>
        <div style={{ color: '#2563eb', fontSize: 14, fontWeight: 800, letterSpacing: '.04em' }}>📖 LearnAI</div>
        <h1 style={{ color: '#0f172a', margin: '12px 0 6px', fontSize: 28 }}>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
        <p style={{ color: '#64748b', margin: '0 0 24px' }}>{mode === 'signup' ? 'Your study materials and progress will have a private dashboard.' : 'Sign in to continue to your learning dashboard.'}</p>
        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <label style={labelStyle}>Username
            <input autoComplete="username" required minLength={3} maxLength={32} name="username" value={form.username} onChange={update} placeholder="e.g. akshat_28" style={inputStyle} />
          </label>
          {mode === 'signup' && <label style={labelStyle}>Your name
            <input autoComplete="name" required maxLength={80} name="name" value={form.name} onChange={update} placeholder="How should we address you?" style={inputStyle} />
          </label>}
          <label style={labelStyle}>Password
            <input autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={8} type="password" name="password" value={form.password} onChange={update} placeholder="At least 8 characters" style={inputStyle} />
          </label>
          {error && <div role="alert" style={{ color: '#b91c1c', background: '#fef2f2', padding: 12, borderRadius: 9, fontSize: 14 }}>{error}</div>}
          <button disabled={busy} type="submit" style={{ ...buttonStyle, opacity: busy ? .7 : 1 }}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
        </form>
        <p style={{ color: '#64748b', textAlign: 'center', margin: '20px 0 0', fontSize: 14 }}>
          {mode === 'signup' ? 'Already have an account? ' : 'New to LearnAI? '}
          <button type="button" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }} style={{ border: 0, padding: 0, background: 'none', color: '#2563eb', fontWeight: 700, cursor: 'pointer' }}>{mode === 'signup' ? 'Sign in' : 'Create account'}</button>
        </p>
      </section>
    </main>
  );
}

const labelStyle = { display: 'grid', gap: 7, fontSize: 14, fontWeight: 650, color: '#334155' };
const inputStyle = { width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 9, padding: '12px 13px', fontSize: 15, outlineColor: '#2563eb' };
const buttonStyle = { border: 0, borderRadius: 9, background: '#2563eb', color: 'white', padding: '13px 16px', fontSize: 15, fontWeight: 750, cursor: 'pointer', marginTop: 4 };
