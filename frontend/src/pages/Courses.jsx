import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../api';

const API = API_BASE_URL;

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token') || '';
    fetch(`${API}/courses`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load courses.');
        setCourses(data.courses || []);
      })
      .catch((err) => setError(err.message || 'Could not reach the backend.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: 12, fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, margin: '0 0 8px' }}>My Learning Courses</h1>
        <p style={{ margin: 0, color: '#64748b' }}>Your uploaded materials and practiced subjects, organized into lessons, quizzes, and progress.</p>
      </header>

      {error && <div role="alert" style={{ padding: 14, borderRadius: 8, background: '#fef2f2', color: '#991b1b', marginBottom: 18 }}>{error}</div>}
      {loading ? <p style={{ color: '#64748b' }}>Loading your course list…</p> : courses.length === 0 ? (
        <section className="courses-empty-state" style={{ background: '#fff', padding: 28, border: '1px solid #e2e8f0', borderRadius: 12, textAlign: 'center' }}>
          <h2>Start your first course</h2>
          <p>Upload study material or complete a topic quiz. LearnAI will add it here and track your progress.</p>
          <Link to="/upload">Upload material</Link>
        </section>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {courses.map((course) => (
            <article key={course.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(15,23,42,.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em' }}>{course.course_type === 'topic' ? 'University topic' : 'Study material'}</span>
                  <h2 style={{ fontSize: 19, margin: '6px 0 4px', overflowWrap: 'anywhere' }}>{course.title}</h2>
                  <p style={{ color: '#64748b', fontSize: 13, margin: 0, overflowWrap: 'anywhere' }}>{course.material_name}</p>
                </div>
                <strong style={{ color: '#2563eb', whiteSpace: 'nowrap' }}>{course.progress}%</strong>
              </div>

              <div style={{ height: 8, borderRadius: 99, background: '#e2e8f0', margin: '16px 0', overflow: 'hidden' }}>
                <div style={{ width: `${course.progress}%`, height: '100%', background: course.progress >= 80 ? '#16a34a' : '#2563eb' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: 13, marginBottom: 14 }}>
                <span>{course.modules.length} learning steps</span>
                <span>{course.attempts} quiz {course.attempts === 1 ? 'attempt' : 'attempts'}</span>
              </div>

              <ol style={{ margin: '0 0 18px', paddingLeft: 20, color: '#475569', fontSize: 13, lineHeight: 1.7 }}>
                {course.modules.slice(0, 4).map((module, index) => <li key={`${module}-${index}`}>{module}</li>)}
              </ol>
              {course.last_score && <p style={{ margin: '0 0 16px', color: '#334155', fontSize: 14 }}>Latest quiz: <strong>{course.last_score.score}/{course.last_score.total} · {course.last_score.percentage}%</strong></p>}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {course.document_id && <Link to={`/study-notes?document_id=${encodeURIComponent(course.document_id)}`} style={{ padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: 7, color: '#1e293b', textDecoration: 'none', fontSize: 13 }}>Open lessons</Link>}
                <Link to={course.document_id ? `/take-quiz?document_id=${encodeURIComponent(course.document_id)}${course.has_notes ? '&use_notes=1' : ''}` : `/take-quiz?topic=${encodeURIComponent(course.title)}`} style={{ padding: '9px 12px', background: '#2563eb', borderRadius: 7, color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>Continue learning</Link>
              </div>
            </article>
          ))}
        </div>
      )}
      <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 20 }}>Progress reflects available milestones: material, notes, quiz attempts, and strong quiz results.</p>
    </div>
  );
}
