import React, { useCallback, useEffect, useRef, useState } from 'react';
import './AITutorChat.css';
import API from '../api';
const starterMessage = {
  sender: 'bot',
  text: 'Hi! I can help with your uploaded notes or discuss any subject. Ask for a simple explanation, a worked example, or help solving a problem.'
};

function formatPublished(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function topicIllustration(category = '') {
  if (/science/i.test(category)) return '/news-science.svg';
  if (/education|learning/i.test(category)) return '/news-education.svg';
  return '/news-ai.svg';
}

export default function AITutorChat() {
  const [messages, setMessages] = useState([starterMessage]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [news, setNews] = useState({ topics: [], articles: [] });
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState('');
  const messageEndRef = useRef(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  const loadNews = useCallback(async () => {
    setNewsLoading(true);
    setNewsError('');
    try {
      const { data } = await API.get('/trending-topics');
      setNews(data);
      if (!data.articles?.length) setNewsError('Live headlines are temporarily unavailable.');
    } catch (error) {
      setNewsError(error.message === 'Failed to fetch'
        ? 'Cannot reach the app server. Start the backend and refresh headlines.'
        : (error.message || 'Could not load current headlines.'));
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => { loadNews(); }, [loadNews]);

  useEffect(() => {
    API.get('/chat/history?limit=100')
      .then(({ data }) => {
        if (data.messages?.length) {
          const visibleMessages = data.messages.filter(({ sender, text }) => !(
            sender === 'bot' && String(text || '').startsWith('I could not find a matching passage in your saved study materials.')
          ));
          if (visibleMessages.length) {
            setMessages(visibleMessages.map(({ sender, text, citations, provider }) => ({ sender, text, citations, provider })));
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleSend = async (event) => {
    event.preventDefault();
    const userText = input.trim();
    if (!userText || loading) return;

    const previousMessages = messages.filter((message) => ['user', 'bot'].includes(message.sender)).slice(-12);
    setMessages((previous) => [...previous, { sender: 'user', text: userText }]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await API.post('/chat', {
          question: userText,
          history: previousMessages.map(({ sender, text }) => ({ sender, text }))
      });
      setMessages((previous) => [...previous, {
        sender: 'bot',
        text: data.answer || data.response || 'I did not receive an answer.',
        citations: data.citations || [],
        provider: data.provider || ''
      }]);
    } catch (error) {
      setMessages((previous) => [...previous, { sender: 'bot', error: true, text: error.message || 'Could not connect to the tutor. Check that the backend is running.' }]);
    } finally {
      setLoading(false);
    }
  };

  const topicChips = news.topics?.length ? news.topics : ['AI & Technology', 'Science', 'Education'];
  const articles = news.articles || [];
  const sideArticles = articles.slice(0, 4);
  const bottomArticles = articles.slice(4, 10);

  return (
    <div className="tutor-page">
      <header className="tutor-header">
        <div>
          <h1>AI Tutor Chat</h1>
          <p>Ask about any topic, get help with a problem, or explore what’s happening in learning, science, and technology.</p>
        </div>
        <span className="tutor-provider">Powered by your configured AI API</span>
      </header>

      <div className="tutor-grid">
        <aside className="tutor-side tutor-left">
          <section className="tutor-panel tutor-trending">
            <div className="tutor-panel-heading">
              <div><span className="tutor-eyebrow">EXPLORE</span><h2>Trending topics</h2></div>
            </div>
            <div className="tutor-topic-list">
              {topicChips.map((topic) => <span key={topic} className="tutor-topic-chip">✦ {topic}</span>)}
            </div>
            <p className="tutor-panel-note">Current headlines are grouped into topics to make it easy to explore.</p>
            <a className="tutor-text-link" href="https://news.google.com/" target="_blank" rel="noreferrer">Browse Google News ↗</a>
          </section>

          <section className="tutor-panel tutor-tip">
            <span className="tutor-eyebrow">STUDY TIP</span>
            <h2>Ask for a worked example</h2>
            <p>Try: “Explain this simply, then give me one example and a question to check my understanding.”</p>
          </section>
        </aside>

        <main className="tutor-chat-card">
          <div className="tutor-chat-heading">
            <div><span className="tutor-status-dot" /><strong>Your study tutor</strong></div>
            <span>Uses relevant notes when available · general questions welcome</span>
          </div>
          <div className="tutor-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div key={`${index}-${message.sender}`} className={`tutor-message-row ${message.sender === 'user' ? 'is-user' : 'is-tutor'}`}>
                <div className={`tutor-message ${message.sender === 'user' ? 'user-message' : 'bot-message'} ${message.error ? 'error-message' : ''}`}>
                  {message.text}
                  {message.citations?.length > 0 && <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #dbe3ef', fontSize: 12, color: '#64748b' }}>
                    Sources: {[...new Set(message.citations.map((item) => item.filename))].join(', ')}
                    {message.provider === 'offline-rag' && ' · answered from saved notes offline'}
                  </div>}
                </div>
              </div>
            ))}
            {loading && <div className="tutor-message-row is-tutor"><div className="tutor-message bot-message tutor-thinking">Thinking through your question…</div></div>}
            <div ref={messageEndRef} />
          </div>
          <form onSubmit={handleSend} className="tutor-composer">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSend(event); } }}
              placeholder="Ask about any topic, your notes, or a problem…"
              aria-label="Ask your AI tutor"
              rows={2}
              maxLength={4000}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()}>{loading ? 'Sending…' : 'Send'}</button>
            <small>Enter to send · Shift + Enter for a new line</small>
          </form>
        </main>

        <aside className="tutor-side tutor-right">
          <section className="tutor-panel tutor-headlines-panel">
            <div className="tutor-panel-heading">
              <div><span className="tutor-eyebrow">LATEST</span><h2>Trending news</h2></div>
              <button className="tutor-refresh" onClick={loadNews} disabled={newsLoading} aria-label="Refresh trending news">↻</button>
            </div>
            {newsLoading ? <p className="tutor-panel-note">Loading current headlines…</p> : newsError && !sideArticles.length ? (
              <p className="tutor-panel-note">{newsError} <button className="tutor-inline-button" onClick={loadNews}>Try again</button></p>
            ) : (
              <div className="tutor-headline-list">
                {sideArticles.map((article, index) => (
                  <a key={`${article.url}-${index}`} href={article.url} target="_blank" rel="noreferrer" className="tutor-headline">
                    <img src={topicIllustration(article.category)} alt="" loading="lazy" />
                    <span className="tutor-headline-category">{article.category}</span>
                    <strong>{article.title}</strong>
                    <span className="tutor-headline-meta">{article.source || 'Google News'}{article.published ? ` · ${formatPublished(article.published)}` : ''}</span>
                  </a>
                ))}
              </div>
            )}
            <span className="tutor-news-attribution">Headlines via Google News RSS</span>
          </section>
        </aside>
      </div>

      <section className="tutor-bottom-news">
        <div className="tutor-bottom-heading"><div><span className="tutor-eyebrow">MORE TO EXPLORE</span><h2>Learning, science & technology</h2></div>{newsLoading && <span>Refreshing headlines…</span>}</div>
        {bottomArticles.length ? (
          <div className="tutor-bottom-grid">
            {bottomArticles.map((article, index) => (
              <a key={`${article.url}-bottom-${index}`} href={article.url} target="_blank" rel="noreferrer" className="tutor-bottom-article">
                <img src={topicIllustration(article.category)} alt="" loading="lazy" />
                <span>{article.category}</span><strong>{article.title}</strong><small>{article.source || 'Google News'}{article.published ? ` · ${formatPublished(article.published)}` : ''}</small>
              </a>
            ))}
          </div>
        ) : <p className="tutor-panel-note">{newsError || 'More headlines will appear here when available.'}</p>}
      </section>
    </div>
  );
}
