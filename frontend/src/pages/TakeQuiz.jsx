import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../api';

const TOPIC_GROUPS = [
  {
    name: 'Engineering & Technology',
    topics: ['Data Mining', 'Operating Systems', 'Machine Learning', 'DBMS', 'Cloud Computing', 'Artificial Intelligence', 'Computer Networks', 'Data Structures & Algorithms', 'Software Engineering', 'Cybersecurity']
  },
  {
    name: 'Commerce & Management',
    topics: ['Financial Accounting', 'Corporate Finance', 'Business Ethics', 'Macroeconomics', 'Digital Marketing', 'Organizational Behavior', 'Entrepreneurship', 'Business Analytics']
  },
  {
    name: 'Humanities & Social Sciences',
    topics: ['Indian Constitutional History', 'Sociology of India', 'Modern Political Thought', 'Globalization Studies', 'Cognitive Psychology', 'Indian Economy', 'Public Administration']
  },
  {
    name: 'Science',
    topics: ['Classical Mechanics', 'Organic Chemistry', 'Calculus', 'Cell Biology', 'Ecology', 'Statistics', 'Genetics']
  }
];

const Quiz = () => {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');
  const [selectedTopic, setSelectedTopic] = useState(() => new URLSearchParams(window.location.search).get('topic') || '');
  const [hasStarted, setHasStarted] = useState(false);
  const [sourceDocument, setSourceDocument] = useState('');
  const [generationMode, setGenerationMode] = useState('');
  const [materials, setMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [materialsError, setMaterialsError] = useState('');

  const token = localStorage.getItem('token') || '';
  const routeParams = new URLSearchParams(window.location.search);
  const routeDocumentId = routeParams.get('document_id');
  const [selectedDocumentId, setSelectedDocumentId] = useState(routeDocumentId || '');
  const useNotes = routeParams.get('use_notes') === '1';
  const selectedMaterial = materials.find((material) => material._id === selectedDocumentId);

  useEffect(() => {
    let cancelled = false;
    const loadMaterials = async () => {
      setMaterialsLoading(true);
      setMaterialsError('');
      try {
        const response = await fetch(`${API_BASE_URL}/documents`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load uploaded materials.');
        const list = Array.isArray(data.documents) ? data.documents : [];
        if (!cancelled) {
          setMaterials(list);
          setSelectedDocumentId((current) => routeDocumentId || (list.some((material) => material._id === current) ? current : ''));
        }
      } catch (err) {
        if (!cancelled) setMaterialsError(err.message || 'Could not load uploaded materials.');
      } finally {
        if (!cancelled) setMaterialsLoading(false);
      }
    };
    loadMaterials();
    return () => { cancelled = true; };
  }, [token, routeDocumentId]);

  const fetchQuiz = async (count = numQuestions) => {
    setHasStarted(true);
    setIsLoading(true);
    setError('');
    setNotice('');
    setIsSubmitted(false);
    setSelectedOptions({});
    setCurrentIndex(0);
    setGenerationMode('');

    try {
      const response = await fetch(`${API_BASE_URL}/quiz/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          num_questions: count,
          difficulty,
          ...(!selectedDocumentId && selectedTopic ? { topic: selectedTopic } : {}),
          ...(selectedDocumentId ? { document_id: selectedDocumentId } : {}),
          ...(useNotes ? { use_notes: true } : {})
        })
      });

      const data = await response.json();
      if (response.ok && (data.questions || data.quiz)) {
        setQuestions(data.questions || data.quiz);
        setNotice(data.message || '');
        setSourceDocument(data.source_document || 'Study Material');
        setGenerationMode(data.generation_mode || '');
      } else {
        setError(data.error || 'Failed to load quiz questions');
      }
    } catch (err) {
      console.error(err);
      setError('Error connecting to backend server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOption = (questionIndex, optionIndex) => {
    if (isSubmitted) return;
    setSelectedOptions(prev => ({
      ...prev,
      [questionIndex]: optionIndex
    }));
  };

  const calculateScore = () => {
    let score = 0;
    questions.forEach((q, idx) => {
      if (selectedOptions[idx] === q.correctAnswer) {
        score++;
      }
    });
    return score;
  };

  const handleSubmitQuiz = async () => {
    setIsSubmitted(true);
    const finalScore = calculateScore();

    try {
      await fetch(`${API_BASE_URL}/scores/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          score: finalScore,
          total: questions.length,
          difficulty,
          doc_name: sourceDocument || 'Adaptive Study Quiz',
          answers: questions.map((question, index) => ({
            topic: question.topic || 'General',
            correct: selectedOptions[index] === question.correctAnswer
          }))
        })
      });
    } catch (err) {
      console.error('Failed to submit score:', err);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', fontFamily: 'sans-serif' }}>
        <h2>Generating Quiz...</h2>
        <p>{selectedTopic ? `Preparing ${numQuestions} questions about ${selectedTopic}.` : 'Reading your study material and preparing conceptual questions.'}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', fontFamily: 'sans-serif' }}>
        <h3 style={{ color: '#dc2626' }}>{error}</h3>
        <label htmlFor="quiz-difficulty-retry" style={{ marginRight: '8px' }}>Difficulty:</label>
        <select
          id="quiz-difficulty-retry"
          value={difficulty}
          onChange={(event) => setDifficulty(event.target.value)}
          style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db', marginRight: '10px' }}
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <label htmlFor="quiz-question-count-retry" style={{ marginRight: '8px' }}>Questions:</label>
        <select
          id="quiz-question-count-retry"
          value={numQuestions}
          onChange={(event) => setNumQuestions(Number(event.target.value))}
          style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db', marginRight: '10px' }}
        >
          {[5, 15, 20, 30, 50].map((count) => <option key={count} value={count}>{count}</option>)}
        </select>
        <button 
          onClick={() => fetchQuiz(numQuestions)} 
          style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (questions.length === 0) {
    const topicSelectionEnabled = !selectedDocumentId;
    const canGenerate = Boolean(selectedDocumentId || selectedTopic);
    return (
      <div className="quiz-setup" style={{ maxWidth: '980px', margin: '0 auto', padding: '48px 28px', fontFamily: 'sans-serif', color: '#111827' }}>
        <section style={{ textAlign: 'center', paddingBottom: '32px' }}>
          <h1 style={{ fontSize: '30px', fontWeight: 500, margin: '0 0 12px' }}>Generate a Quiz</h1>
          <p style={{ color: '#64748b', fontSize: '18px', margin: '0 0 30px' }}>
            Choose a question count and generate from your study material or a university topic.
          </p>
          <div className="quiz-material-quickstart">
            <label htmlFor="quiz-material-select" style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>
              Quick start: choose a study material
            </label>
            <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '14px' }}>
              Select an upload and start its quiz here—no need to return to Upload Notes.
            </p>
            <select
              id="quiz-material-select"
              value={selectedDocumentId}
              disabled={Boolean(routeDocumentId) || materialsLoading}
              onChange={(event) => {
                setSelectedDocumentId(event.target.value);
                setSelectedTopic('');
              }}
              style={{ display: 'block', width: 'min(100%, 540px)', margin: '0 auto 18px', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '16px' }}
            >
              <option value="">{materialsLoading ? 'Loading your materials…' : 'Select an uploaded material'}</option>
              {materials.map((material) => (
                <option key={material._id} value={material._id}>
                  {material.filename}{material.has_notes ? ' · notes ready' : ''}
                </option>
              ))}
            </select>
            {materialsError && <p role="alert" style={{ color: '#b91c1c', margin: '-8px 0 14px' }}>{materialsError}</p>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <label htmlFor="quiz-difficulty" style={{ fontWeight: 600 }}>Difficulty</label>
            <select
              id="quiz-difficulty"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
              style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '16px' }}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <label htmlFor="quiz-question-count" style={{ fontWeight: 600 }}>Questions</label>
            <select
              id="quiz-question-count"
              value={numQuestions}
              onChange={(event) => setNumQuestions(Number(event.target.value))}
              style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '16px' }}
            >
              {[5, 15, 20, 30, 50].map((count) => <option key={count} value={count}>{count} questions</option>)}
            </select>
            <button
              onClick={() => fetchQuiz(numQuestions)}
              disabled={!canGenerate}
              style={{ padding: '12px 22px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 600 }}
            >
              {selectedTopic ? `Start quiz: ${selectedTopic}` : selectedDocumentId ? `Start quiz from ${selectedMaterial?.filename || 'selected material'}` : 'Choose a topic or material'}
            </button>
          </div>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '12px 0 0' }}>
            {routeDocumentId ? `This quiz is locked to ${selectedMaterial?.filename || 'the material opened from Study Notes'}.` : selectedDocumentId ? `Questions will be generated from ${selectedMaterial?.filename || 'your selected upload'}.` : selectedTopic ? `Selected topic: ${selectedTopic}. Click the button to start.` : 'Choose an uploaded material here, or select a topic below to make a topic-based quiz.'}
          </p>
        </section>

        {topicSelectionEnabled && <section style={{ borderTop: '1px solid #e2e8f0', paddingTop: '28px' }}>
          <h2 style={{ textAlign: 'center', fontSize: '21px', margin: '0 0 28px', fontWeight: 700 }}>Popular University Topics (India)</h2>
          {TOPIC_GROUPS.map((group) => (
            <div key={group.name} style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '13px', letterSpacing: '.04em', textTransform: 'uppercase', margin: '0 0 12px', color: '#334155' }}>{group.name}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {group.topics.map((topic) => {
                  const selected = selectedTopic === topic;
                  return <button
                    key={topic}
                    className={`topic-pill${selected ? ' topic-pill-selected' : ''}`}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setSelectedDocumentId('');
                      setSelectedTopic(selected ? '' : topic);
                    }}
                    style={{ padding: '9px 17px', borderRadius: '999px', border: `1px solid ${selected ? '#2563eb' : '#94a3b8'}`, background: selected ? '#2563eb' : '#eef1f5', color: selected ? '#fff' : '#1f2937', cursor: 'pointer', fontSize: '14px', transition: 'background .15s, color .15s' }}
                  >{topic}</button>;
                })}
              </div>
            </div>
          ))}
          {selectedTopic && <div style={{ textAlign: 'center', paddingTop: '6px' }}>
            <button onClick={() => fetchQuiz(numQuestions)} style={{ padding: '12px 24px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 600 }}>
              Generate {numQuestions}-Question Quiz on {selectedTopic}
            </button>
          </div>}
        </section>}
        {hasStarted && !error && <p style={{ color: '#6b7280', marginTop: '16px', textAlign: 'center' }}>No questions were returned. Try again or choose another topic.</p>}
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const totalScore = calculateScore();

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif', color: '#1f2937' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{difficulty[0].toUpperCase() + difficulty.slice(1)} Quiz</h1>
        {generationMode && <span title="How these questions were generated" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 999, padding: '6px 11px', border: `1px solid ${generationMode.startsWith('offline') ? '#bfdbfe' : '#a7f3d0'}`, background: generationMode.startsWith('offline') ? '#eff6ff' : '#ecfdf5', color: generationMode.startsWith('offline') ? '#1d4ed8' : '#047857', fontSize: 12, fontWeight: 700 }}>
          <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: generationMode.startsWith('offline') ? '#2563eb' : '#059669' }} />
          {generationMode.startsWith('offline') ? 'Generated offline · local model' : 'Generated online · AI'}
        </span>}
      </div>
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>
        {useNotes ? `Quiz based on notes for ${sourceDocument || 'your selected study material'}.` : 'Test your knowledge generated from your uploaded study materials.'}
      </p>
      {notice && (
        <div role="status" style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
          {notice}
        </div>
      )}

      {!isSubmitted ? (
        /* QUIZ TAKING VIEW */
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', color: '#6b7280', fontSize: '14px' }}>
            <span>Question {currentIndex + 1} of {questions.length}</span>
            <span>Answered: {Object.keys(selectedOptions).length} / {questions.length}</span>
          </div>

          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>{currentQ.question}</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {currentQ.options && currentQ.options.map((option, optIdx) => {
              const isSelected = selectedOptions[currentIndex] === optIdx;
              return (
                <button
                  key={optIdx}
                  onClick={() => handleSelectOption(currentIndex, optIdx)}
                  style={{
                    textAlign: 'left',
                    padding: '14px 18px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid #2563eb' : '1px solid #d1d5db',
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    color: isSelected ? '#1e40af' : '#374151',
                    fontSize: '15px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {option}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                backgroundColor: currentIndex === 0 ? '#f3f4f6' : '#fff',
                cursor: currentIndex === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Previous
            </button>

            {currentIndex < questions.length - 1 ? (
              <button
                onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#2563eb', color: '#fff', cursor: 'pointer' }}
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmitQuiz}
                style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', backgroundColor: '#16a34a', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Submit Quiz
              </button>
            )}
          </div>
        </div>
      ) : (
        /* QUIZ COMPLETED & DETAILED REVIEW BREAKDOWN VIEW */
        <div>
          {/* Summary Banner */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', backgroundColor: '#fff', textAlign: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '8px' }}>Quiz Completed!</h2>
            <p style={{ fontSize: '18px', color: '#374151', margin: '8px 0' }}>
              Your Score: <strong>{totalScore} / {questions.length}</strong> ({Math.round((totalScore / questions.length) * 100)}%)
            </p>
            <label htmlFor="quiz-question-count-again" style={{ marginRight: '8px' }}>Next quiz size:</label>
            <label htmlFor="quiz-difficulty-again" style={{ margin: '12px 8px 0 12px' }}>Difficulty:</label>
            <select
              id="quiz-difficulty-again"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
              style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db', marginTop: '12px' }}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <select
              id="quiz-question-count-again"
              value={numQuestions}
              onChange={(event) => setNumQuestions(Number(event.target.value))}
              style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db', marginTop: '12px' }}
            >
              {[5, 15, 20, 30, 50].map((count) => <option key={count} value={count}>{count} questions</option>)}
            </select>
            <button
              onClick={() => fetchQuiz(numQuestions)}
              style={{ marginTop: '12px', padding: '10px 20px', borderRadius: '6px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Generate Another {numQuestions}-Question {difficulty[0].toUpperCase() + difficulty.slice(1)} Quiz
            </button>
          </div>

          {/* Question Breakdown List */}
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Detailed Answer Review</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {questions.map((q, idx) => {
              const userAns = selectedOptions[idx];
              const isCorrect = userAns === q.correctAnswer;

              return (
                <div
                  key={idx}
                  className="quiz-review-card"
                  style={{
                    border: `2px solid ${isCorrect ? '#86efac' : '#fca5a5'}`,
                    borderRadius: '10px',
                    padding: '20px',
                    backgroundColor: isCorrect ? '#f0fdf4' : '#fef2f2'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', margin: 0, paddingRight: '12px' }}>
                      {idx + 1}. {q.question}
                    </h4>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: isCorrect ? '#166534' : '#991b1b',
                      backgroundColor: isCorrect ? '#dcfce7' : '#fee2e2'
                    }}>
                      {isCorrect ? '✓ Correct' : '✕ Incorrect'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                    {q.options && q.options.map((opt, optIdx) => {
                      const wasSelectedByUser = userAns === optIdx;
                      const isTheRightAnswer = q.correctAnswer === optIdx;

                      let bg = '#ffffff';
                      let border = '1px solid #e5e7eb';
                      let label = '';

                      if (isTheRightAnswer) {
                        bg = '#dcfce7';
                        border = '2px solid #16a34a';
                        label = ' (Correct Answer)';
                      } else if (wasSelectedByUser && !isCorrect) {
                        bg = '#fee2e2';
                        border = '2px solid #dc2626';
                        label = ' (Your Answer)';
                      }

                      return (
                        <div
                          key={optIdx}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '6px',
                            backgroundColor: bg,
                            border: border,
                            fontSize: '14px'
                          }}
                        >
                          {opt} <strong>{label}</strong>
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="quiz-review-explanation" style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#ffffff', borderLeft: '4px solid #2563eb', fontSize: '14px', color: '#374151' }}>
                      <strong>Explanation:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Quiz;
