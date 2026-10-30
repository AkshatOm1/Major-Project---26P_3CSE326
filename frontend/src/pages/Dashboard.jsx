import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';

export default function Dashboard({ user, onUserChange }) {
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(user.role || 'Student');
  const [domain, setDomain] = useState(user.domain || '');
  const [profileError, setProfileError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const domainTopics = getDomainTopics(user.domain);
  useEffect(() => {
    API.get('/learning/profile').then(({ data }) => setProfile(data)).catch(() => {});
  }, [user.id]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileError('');
    setSavingProfile(true);
    try {
      const { data } = await API.patch('/profile', { role, domain });
      onUserChange(data.profile);
    } catch (error) {
      setProfileError(error.response?.data?.error || 'Could not save your profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '20px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '26px', color: '#0f172a', marginBottom: '8px' }}>Welcome, {user.name}</h1>
      <p style={{ color: '#64748b', marginBottom: '28px' }}>{user.domain ? `${user.role} · ${user.domain} — your learning dashboard` : 'Set your learner profile to personalize your dashboard.'}</p>

      {!user.domain && <section style={{ background: '#fff', padding: 22, border: '1px solid #bfdbfe', borderRadius: 12, marginBottom: 20 }}>
        <h2 style={{ fontSize: 19, margin: '0 0 6px', color: '#0f172a' }}>Tell us what you study</h2>
        <p style={{ color: '#64748b', margin: '0 0 16px', fontSize: 14 }}>Choose your role and add a field or domain. We’ll use it to tailor topic suggestions for your dashboard.</p>
        <form onSubmit={saveProfile} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, .7fr) minmax(200px, 1.3fr) auto', gap: 10, alignItems: 'end' }}>
          <label style={fieldLabel}>I am a
            <select value={role} onChange={(event) => setRole(event.target.value)} style={fieldInput}>
              <option>Student</option><option>Teacher</option><option>Working professional</option><option>Other</option>
            </select>
          </label>
          <label style={fieldLabel}>My field / domain
            <input value={domain} onChange={(event) => setDomain(event.target.value)} maxLength={100} required placeholder="e.g. Computer Science, Commerce, Biology" style={fieldInput} />
          </label>
          <button disabled={savingProfile} style={{ padding: '12px 16px', border: 0, borderRadius: 8, color: '#fff', background: '#2563eb', fontWeight: 700, cursor: 'pointer' }}>{savingProfile ? 'Saving…' : 'Save profile'}</button>
        </form>
        {profileError && <p role="alert" style={{ margin: '12px 0 0', color: '#b91c1c', fontSize: 14 }}>{profileError}</p>}
      </section>}

      {profile && <section style={{ background: '#eff6ff', padding: 20, border: '1px solid #bfdbfe', borderRadius: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', color: '#1d4ed8' }}>YOUR PERSONALIZED NEXT STEP</span>
        <h2 style={{ fontSize: 18, margin: '7px 0', color: '#0f172a' }}>{profile.recommendation}</h2>
        {profile.strengths?.length > 0 && <p style={{ margin: '8px 0 0', color: '#166534', fontSize: 14 }}>Strong topics: {profile.strengths.map((item) => `${item.topic} (${item.accuracy}%)`).join(', ')}</p>}
        {profile.needs_practice?.length > 0 && <p style={{ margin: '6px 0 0', color: '#9a3412', fontSize: 14 }}>Needs practice: {profile.needs_practice.map((item) => `${item.topic} (${item.accuracy}%)`).join(', ')}</p>}
        <Link to={profile.recommended_topic ? `/take-quiz?topic=${encodeURIComponent(profile.recommended_topic)}` : '/upload'} style={{ display: 'inline-block', marginTop: 12, color: '#1d4ed8', fontWeight: 700, textDecoration: 'none' }}>{profile.recommended_topic ? `Practice ${profile.recommended_topic} →` : 'Start learning →'}</Link>
      </section>}

      {user.domain && <section style={{ background: '#fff', padding: 20, border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 800, letterSpacing: '.05em' }}>FOR YOUR FIELD · {user.domain.toUpperCase()}</span>
        <h2 style={{ fontSize: 18, margin: '7px 0 14px', color: '#0f172a' }}>Suggested topics to practice</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
          {domainTopics.map((topic) => <Link key={topic} to={`/take-quiz?topic=${encodeURIComponent(topic)}`} style={{ borderRadius: 999, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', textDecoration: 'none', padding: '8px 13px', fontSize: 13, fontWeight: 650 }}>{topic} →</Link>)}
        </div>
      </section>}

      {profile?.recent_activity?.length > 0 && <section style={{ background: '#fff', padding: 20, border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, margin: '0 0 14px', color: '#0f172a' }}>Recent learning history</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {profile.recent_activity.slice(0, 8).map((activity) => {
            const verb = activity.verb?.display?.['en-US'] || 'studied';
            const title = activity.object?.definition?.name?.['en-US'] || activity.object?.id || 'Learning activity';
            const when = activity.timestamp ? new Date(activity.timestamp).toLocaleString() : '';
            return <div key={activity.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, color: '#334155', fontSize: 14 }}>
              <span><strong style={{ textTransform: 'capitalize' }}>{verb}</strong> · {title}</span><time style={{ color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>{when}</time>
            </div>;
          })}
        </div>
      </section>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        <Link to="/courses" style={{ textDecoration: 'none', backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🎓</div>
          <h3 style={{ fontSize: '18px', color: '#0f172a', margin: '0 0 6px' }}>My Courses</h3>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Follow lessons and see course progress from your materials and topic quizzes.</p>
        </Link>
        <Link to="/upload" style={{ textDecoration: 'none', backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>📤</div>
          <h3 style={{ fontSize: '18px', color: '#0f172a', margin: '0 0 6px' }}>Upload Notes</h3>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Add new PDF or DOCX files to your learning assistant.</p>
        </Link>

        <Link to="/take-quiz" style={{ textDecoration: 'none', backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏷️</div>
          <h3 style={{ fontSize: '18px', color: '#0f172a', margin: '0 0 6px' }}>Take Adaptive Quiz</h3>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Generate personalized quizzes from your uploaded documents.</p>
        </Link>

        <Link to="/chat" style={{ textDecoration: 'none', backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>💬</div>
          <h3 style={{ fontSize: '18px', color: '#0f172a', margin: '0 0 6px' }}>AI Tutor Chat</h3>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Ask questions and clear doubts on complex concepts.</p>
        </Link>

        <Link to="/scores" style={{ textDecoration: 'none', backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>📈</div>
          <h3 style={{ fontSize: '18px', color: '#0f172a', margin: '0 0 6px' }}>My Scores</h3>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>View historical scores and track performance trends.</p>
        </Link>
      </div>
    </div>
  );
}

const fieldLabel = { display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: '#334155' };
const fieldInput = { width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8, padding: '11px 12px', background: '#fff', fontSize: 14 };

function getDomainTopics(domain = '') {
  const value = domain.toLowerCase();
  if (/computer|software|engineering|technology|data|it\b/.test(value)) return ['Data Mining', 'Operating Systems', 'Machine Learning', 'DBMS', 'Computer Networks'];
  if (/commerce|business|finance|account|management|econom/.test(value)) return ['Financial Accounting', 'Corporate Finance', 'Business Ethics', 'Macroeconomics', 'Digital Marketing'];
  if (/biology|medical|health|life science/.test(value)) return ['Cell Biology', 'Genetics', 'Ecology', 'Human Physiology', 'Biochemistry'];
  if (/physics|chemistry|math|science/.test(value)) return ['Classical Mechanics', 'Organic Chemistry', 'Calculus', 'Statistics', 'Cell Biology'];
  if (/humanit|history|sociology|politic|psychology|law/.test(value)) return ['Indian Constitutional History', 'Sociology', 'Psychology', 'Modern Political Thought', 'Indian Economy'];
  return [domain || 'General Studies', 'Problem Solving', 'Core Concepts', 'Applied Practice'];
}
