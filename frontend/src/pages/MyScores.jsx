import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../api';

export default function MyScores() {
  const [scores, setScores] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchScores = async () => {
      try {
        const token = localStorage.getItem('token') || '';
        const res = await fetch(`${API_BASE_URL}/scores`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load quiz results.');
        setScores(Array.isArray(data.scores) ? data.scores : []);
      } catch (err) {
        setError(err.message || 'Could not connect to the backend server.');
      } finally {
        setLoading(false);
      }
    };
    fetchScores();
  }, []);

  const average = scores.length
    ? Math.round(scores.reduce((sum, item) => sum + (Number(item.percentage) || 0), 0) / scores.length)
    : 0;
  const mastery = average >= 80 ? 'Proficient' : average >= 50 ? 'Developing' : 'Needs practice';

  return (
    <div style={{ maxWidth: '1060px', margin: '30px auto', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>My Quiz Analytics & Scores</h2>
      <p style={{ color: '#64748b', marginBottom: '24px' }}>Open any quiz result to see which topics you know well and which need more practice.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>Total Quizzes</span>
          <h3 style={{ fontSize: '28px', color: '#2563eb', margin: '6px 0 0' }}>{scores.length}</h3>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>Average Score</span>
          <h3 style={{ fontSize: '28px', color: '#16a34a', margin: '6px 0 0' }}>{average}%</h3>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>Mastery Level</span>
          <h3 style={{ fontSize: '28px', color: '#0284c7', margin: '6px 0 0' }}>{mastery}</h3>
        </div>
      </div>

      {error && <div role="alert" style={{ marginBottom: 16, padding: 14, borderRadius: 8, background: '#fef2f2', color: '#991b1b' }}>{error}</div>}

      <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? <p style={{ padding: 20, color: '#64748b' }}>Loading your quiz results…</p> : scores.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: '#64748b' }}>
            <strong style={{ display: 'block', color: '#334155', marginBottom: 6 }}>No quiz results yet</strong>
            Complete a quiz and your score and topic breakdown will appear here.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>Quiz / Study Material</th>
                <th style={{ padding: '12px 16px' }}>Score</th>
                <th style={{ padding: '12px 16px' }}>Percentage</th>
                <th style={{ padding: '12px 16px' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((score, index) => {
                const id = score._id || String(index);
                const isExpanded = expandedId === id;
                const topics = Array.isArray(score.topic_breakdown) ? [...score.topic_breakdown].sort((a, b) => a.percentage - b.percentage) : [];
                return (
                  <React.Fragment key={id}>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                        <button
                          aria-expanded={isExpanded}
                          onClick={() => setExpandedId(isExpanded ? null : id)}
                          style={{ padding: 0, border: 0, background: 'transparent', color: '#1d4ed8', font: 'inherit', fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}
                        >
                          {isExpanded ? '▾' : '▸'} {score.doc_name || 'Study Material Quiz'}
                        </button>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334155' }}>{score.score} / {score.total}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: score.percentage >= 80 ? '#16a34a' : '#d97706' }}>{score.percentage}%</td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>{score.date || 'Recent'}</td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ background: '#f8fafc' }}>
                        <td colSpan="4" style={{ padding: '16px 22px 20px' }}>
                          {topics.length === 0 ? (
                            <p style={{ margin: 0, color: '#64748b' }}>Topic details are unavailable for this older result. New quizzes save topic-wise results.</p>
                          ) : (
                            <>
                              <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Topic-wise performance <span style={{ fontWeight: 400, color: '#64748b' }}>(weakest topics first)</span></h3>
                              <div style={{ display: 'grid', gap: 10 }}>
                                {topics.map((topic, topicIndex) => {
                                  const needsPractice = topic.percentage < 50;
                                  const color = topic.percentage >= 80 ? '#16a34a' : needsPractice ? '#dc2626' : '#d97706';
                                  return (
                                    <div key={`${topic.topic}-${topicIndex}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) minmax(100px, 2fr) auto', gap: 12, alignItems: 'center', padding: '10px 12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                                      <div>
                                        <strong>{topic.topic}</strong>
                                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{topic.correct}/{topic.total} correct · {topic.wrong} wrong</div>
                                      </div>
                                      <div style={{ height: 8, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
                                        <div style={{ width: `${topic.percentage}%`, height: '100%', background: color }} />
                                      </div>
                                      <strong style={{ color, whiteSpace: 'nowrap' }}>{topic.percentage}% · {topic.level}</strong>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
