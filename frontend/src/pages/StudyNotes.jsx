import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../api';

const API = API_BASE_URL;
const TRANSLATION_LANGUAGES = [
  ['afr', 'Afrikaans'], ['amh', 'Amharic'], ['ara', 'Arabic'], ['asm', 'Assamese'],
  ['ben', 'Bengali'], ['bod', 'Tibetan'], ['bul', 'Bulgarian'], ['cat', 'Catalan'],
  ['ces', 'Czech'], ['cmn_Hans', 'Chinese (Simplified)'], ['cmn_Hant', 'Chinese (Traditional)'],
  ['dan', 'Danish'], ['deu', 'German'], ['ell', 'Greek'], ['est', 'Estonian'], ['eus', 'Basque'],
  ['fin', 'Finnish'], ['fra', 'French'], ['guj', 'Gujarati'], ['hau_Latn', 'Hausa'],
  ['heb', 'Hebrew'], ['hin', 'Hindi'], ['hrv', 'Croatian'], ['hun', 'Hungarian'],
  ['ind', 'Indonesian'], ['ita', 'Italian'], ['jpn', 'Japanese'], ['kan', 'Kannada'],
  ['khm', 'Khmer'], ['lao', 'Lao'], ['mal', 'Malayalam'], ['mar', 'Marathi'],
  ['mya', 'Burmese'], ['nld', 'Dutch'], ['npi', 'Nepali'], ['ori', 'Odia'],
  ['pan_Guru', 'Punjabi'], ['pes', 'Persian'], ['pol', 'Polish'], ['por', 'Portuguese'],
  ['ron', 'Romanian'], ['rus', 'Russian'], ['sin', 'Sinhala'], ['spa', 'Spanish'],
  ['swe', 'Swedish'], ['swh', 'Swahili'], ['tam', 'Tamil'], ['tel', 'Telugu'],
  ['tha', 'Thai'], ['tur', 'Turkish'], ['ukr', 'Ukrainian'], ['urd', 'Urdu'],
  ['vie', 'Vietnamese'], ['yor', 'Yoruba'], ['zul', 'Zulu'],
];

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

export default function StudyNotes() {
  const [documents, setDocuments] = useState([]);
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.search).get('document_id') || '');
  const [notes, setNotes] = useState(null);
  const [displayNotes, setDisplayNotes] = useState(null);
  const [translationLanguage, setTranslationLanguage] = useState('');
  const [translatedLanguage, setTranslatedLanguage] = useState('');
  const [translationCache, setTranslationCache] = useState({});
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const token = localStorage.getItem('token') || '';
  const selectedDocument = documents.find((doc) => doc._id === selectedId);

  const loadDocuments = useCallback(async () => {
    setLoadingList(true);
    try {
      const response = await fetch(`${API}/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load study materials.');
      const list = data.documents || [];
      setDocuments(list);
      setSelectedId((current) => list.some((doc) => doc._id === current) ? current : (list[0]?._id || ''));
    } catch (err) {
      setError(err.message || 'Could not connect to the backend.');
    } finally {
      setLoadingList(false);
    }
  }, [token]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  useEffect(() => {
    let cancelled = false;
    setNotes(null);
    setDisplayNotes(null);
    setTranslatedLanguage('');
    setTranslationError('');
    setError('');
    setNotice('');
    setLoadingNotes(false);
    if (!selectedId || !selectedDocument?.has_notes) return undefined;

    setLoadingNotes(true);
    fetch(`${API}/documents/${encodeURIComponent(selectedId)}/notes`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load notes.');
        if (!cancelled) {
          setNotes(data.notes);
          setDisplayNotes(data.notes);
          if (data.notes?.generation_mode === 'source-extractive') {
            setNotice('These notes were organized directly from the uploaded text because the AI service returned no usable notes.');
          }
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load notes.'); })
      .finally(() => { if (!cancelled) setLoadingNotes(false); });

    return () => { cancelled = true; };
  }, [selectedId, selectedDocument?.has_notes, token]);

  const generateNotes = async () => {
    if (!selectedId) return;
    setLoadingNotes(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`${API}/documents/${encodeURIComponent(selectedId)}/notes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not generate notes.');
      setNotes(data.notes);
      setDisplayNotes(data.notes);
      setTranslatedLanguage('');
      setTranslationCache((current) => Object.fromEntries(
        Object.entries(current).filter(([key]) => !key.startsWith(`${selectedId}:`))
      ));
      setNotice(data.message || '');
      setDocuments((current) => current.map((doc) => doc._id === selectedId
        ? { ...doc, has_notes: true, notes_title: data.notes.title }
        : doc));
    } catch (err) {
      setError(err.message || 'Could not generate notes.');
    } finally {
      setLoadingNotes(false);
    }
  };

  const translateStudyNotes = async () => {
    if (!notes || !selectedId || !translationLanguage) return;
    const documentId = selectedId;
    const cacheKey = `${documentId}:${translationLanguage}`;
    if (translationCache[cacheKey]) {
      setDisplayNotes(translationCache[cacheKey]);
      setTranslatedLanguage(TRANSLATION_LANGUAGES.find(([code]) => code === translationLanguage)?.[1] || translationLanguage);
      setTranslationError('');
      return;
    }
    setTranslating(true);
    setTranslationError('');
    try {
      const response = await fetch(`${API}/documents/${encodeURIComponent(documentId)}/notes/translate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target_language: translationLanguage }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not translate these notes.');
      if (selectedId === documentId) {
        setDisplayNotes(data.notes);
        setTranslatedLanguage(data.language_name || translationLanguage);
        setTranslationCache((current) => ({ ...current, [cacheKey]: data.notes }));
      }
    } catch (err) {
      setTranslationError(err.message || 'Could not translate these notes.');
    } finally {
      setTranslating(false);
    }
  };

  const downloadNotes = () => {
    if (!notes) return;
    const notesToDownload = displayNotes || notes;
    const title = notesToDownload.title || selectedDocument?.filename || 'Study Notes';
    const sections = (notesToDownload.sections || []).map((section) => `
      <section>
        <h2>${escapeHtml(section.heading || 'Study section')}</h2>
        ${section.content ? `<p>${escapeHtml(section.content)}</p>` : ''}
        ${section.key_points?.length ? `<ul>${section.key_points.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>` : ''}
      </section>`).join('');
    const keyTerms = notesToDownload.key_terms?.length ? `
      <section><h2>Key terms</h2><dl>${notesToDownload.key_terms.map((item) => `
        <div><dt>${escapeHtml(item.term)}</dt><dd>${escapeHtml(item.definition)}</dd></div>`).join('')}
      </dl></section>` : '';
    const questions = notesToDownload.review_questions?.length ? `
      <section><h2>Check your understanding</h2><ol>${notesToDownload.review_questions.map((question) => `<li>${escapeHtml(question)}</li>`).join('')}</ol></section>` : '';
    const content = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root{font-family:Arial,Helvetica,sans-serif;color:#1f2937;background:#f3f6fb}body{max-width:850px;margin:32px auto;padding:48px;background:#fff;line-height:1.65;box-shadow:0 4px 24px #0f172a12}
  h1{font-size:30px;line-height:1.2;margin:0 0 8px;color:#172554}h2{font-size:21px;margin:28px 0 8px;color:#1d4ed8;border-bottom:1px solid #dbeafe;padding-bottom:5px}
  .source{color:#64748b;font-size:14px;margin:0 0 28px}p{white-space:pre-wrap;margin:8px 0}li{margin:5px 0}dl>div{margin:12px 0}dt{font-weight:700}dd{margin:2px 0 0;color:#475569}section{break-inside:avoid}
  @media print{body{max-width:none;margin:0;padding:0;box-shadow:none;background:#fff}h2{break-after:avoid}a{color:inherit}}
</style></head><body>
<h1>${escapeHtml(title)}</h1>
${selectedDocument?.filename ? `<p class="source">Source material: ${escapeHtml(selectedDocument.filename)}</p>` : ''}
${notesToDownload.summary ? `<section><h2>Overview</h2><p>${escapeHtml(notesToDownload.summary)}</p></section>` : ''}
${sections}${keyTerms}${questions}
</body></html>`;

    const safeName = title
      .replace(/\.[^.]+$/, '')
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
      .trim() || 'Study Notes';
    const file = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}-notes.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: 20, fontFamily: 'system-ui, sans-serif', color: '#172033' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 28, margin: '0 0 8px' }}>Study Notes</h1>
        <p style={{ color: '#64748b', margin: 0 }}>AI-organized notes from your uploaded study material, ready to read and review.</p>
      </div>

      {error && <div role="alert" style={{ padding: 14, borderRadius: 8, background: '#fef2f2', color: '#991b1b', marginBottom: 16 }}>{error}</div>}
      {notice && <div role="status" style={{ padding: 14, borderRadius: 8, background: '#eff6ff', color: '#1e40af', marginBottom: 16 }}>{notice}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(210px, 280px) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
        <aside style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>Your materials</h2>
          {loadingList ? <p style={{ color: '#64748b' }}>Loading materials…</p> : documents.length === 0 ? (
            <p style={{ color: '#64748b', lineHeight: 1.5 }}>No uploads yet. <Link to="/upload">Upload study material</Link> to get started.</p>
          ) : documents.map((doc) => (
            <button
              key={doc._id}
              onClick={() => setSelectedId(doc._id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: 12, marginBottom: 8,
                borderRadius: 8, border: selectedId === doc._id ? '1px solid #2563eb' : '1px solid #e2e8f0',
                background: selectedId === doc._id ? '#eff6ff' : '#fff', color: '#1e293b', cursor: 'pointer'
              }}
            >
              <span style={{ display: 'block', fontWeight: 600, overflowWrap: 'anywhere' }}>📄 {doc.filename}</span>
              <span style={{ display: 'block', marginTop: 5, fontSize: 12, color: doc.has_notes ? '#15803d' : '#64748b' }}>
                {doc.has_notes ? 'Notes ready to read' : 'Notes not generated'}
              </span>
            </button>
          ))}
        </aside>

        <main style={{ minHeight: 420, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24 }}>
          {!selectedDocument ? (
            <div style={{ color: '#64748b' }}>Upload a study material to generate and read its notes.</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', paddingBottom: 18, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 5 }}>STUDY MATERIAL</div>
                  <h2 style={{ fontSize: 21, margin: 0 }}>{displayNotes?.title || notes?.title || selectedDocument.filename}</h2>
                </div>
                {notes && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                    <button
                      type="button"
                      className="download-notes-button"
                      onClick={downloadNotes}
                      style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#1e293b', padding: '10px 14px', borderRadius: 8, fontWeight: 650, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      ⬇ Download readable notes (.html)
                    </button>
                    <Link
                      to={`/take-quiz?document_id=${encodeURIComponent(selectedId)}&use_notes=1`}
                      style={{ background: '#2563eb', color: '#fff', textDecoration: 'none', padding: '10px 14px', borderRadius: 8, fontWeight: 600, whiteSpace: 'nowrap' }}
                    >
                      Take quiz from these notes →
                    </Link>
                    <div className="notes-translation-controls">
                      <select
                        aria-label="Translate notes to"
                        value={translationLanguage}
                        onChange={(event) => setTranslationLanguage(event.target.value)}
                        disabled={translating}
                        style={{ maxWidth: 190, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#1e293b' }}
                      >
                        <option value="">Translate to…</option>
                        {TRANSLATION_LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={translateStudyNotes}
                        disabled={!translationLanguage || translating}
                        style={{ padding: '10px 14px', border: 0, borderRadius: 8, background: '#0f766e', color: '#fff', fontWeight: 650, cursor: translating ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}
                      >
                        {translating ? 'Translating…' : 'Translate'}
                      </button>
                      {translatedLanguage && <button
                        type="button"
                        onClick={() => {
                          setDisplayNotes(notes);
                          setTranslatedLanguage('');
                        }}
                        style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8, background: 'transparent', color: '#334155', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Show original
                      </button>}
                    </div>
                  </div>
                )}
              </div>

              {translationError && <div role="alert" style={{ padding: 12, marginBottom: 16, borderRadius: 8, background: '#fef2f2', color: '#991b1b' }}>{translationError}</div>}

              {loadingNotes ? (
                <div role="status" style={{ padding: 24, textAlign: 'center', color: '#475569' }}>Creating or loading your study notes…</div>
              ) : notes ? (
                <article style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 8, lineHeight: 1.7 }}>
                  {displayNotes?.summary && <section style={{ padding: 16, background: '#f8fafc', borderRadius: 10, marginBottom: 22 }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: 17 }}>Overview</h3>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{displayNotes.summary}</p>
                  </section>}
                  {(displayNotes?.sections || []).map((section, index) => (
                    <section key={`${section.heading}-${index}`} style={{ marginBottom: 22 }}>
                      <h3 style={{ fontSize: 19, margin: '0 0 8px', color: '#1d4ed8' }}>{section.heading}</h3>
                      {section.content && <p style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{section.content}</p>}
                      {Array.isArray(section.key_points) && section.key_points.length > 0 && (
                        <ul style={{ marginTop: 8, paddingLeft: 22 }}>{section.key_points.map((point, pointIndex) => <li key={pointIndex}>{point}</li>)}</ul>
                      )}
                    </section>
                  ))}
                  {Array.isArray(displayNotes?.key_terms) && displayNotes.key_terms.length > 0 && <section style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginBottom: 22 }}>
                    <h3 style={{ fontSize: 19 }}>Key terms</h3>
                    <dl style={{ display: 'grid', gap: 12 }}>{displayNotes.key_terms.map((item, index) => <div key={index}>
                      <dt style={{ fontWeight: 700 }}>{item.term}</dt><dd style={{ margin: '2px 0 0 0', color: '#475569' }}>{item.definition}</dd>
                    </div>)}</dl>
                  </section>}
                  {Array.isArray(displayNotes?.review_questions) && displayNotes.review_questions.length > 0 && <section style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                    <h3 style={{ fontSize: 19 }}>Check your understanding</h3>
                    <ol style={{ paddingLeft: 22 }}>{displayNotes.review_questions.map((question, index) => <li key={index} style={{ marginBottom: 6 }}>{question}</li>)}</ol>
                  </section>}
                </article>
              ) : (
                <div style={{ textAlign: 'center', padding: '44px 16px' }}>
                  <h3 style={{ marginTop: 0 }}>Turn this upload into study notes</h3>
                  <p style={{ color: '#64748b', marginBottom: 20 }}>The notes will be organized into a summary, topic sections, key terms, and review questions.</p>
                  <button onClick={generateNotes} style={{ border: 0, borderRadius: 8, padding: '11px 18px', background: '#2563eb', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                    Generate Notes
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
