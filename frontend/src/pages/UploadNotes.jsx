import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../api';

export default function UploadNotes() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [uploadedMaterial, setUploadedMaterial] = useState(null);
  const [uploadedNotesReady, setUploadedNotesReady] = useState(false);

  // Fetch already uploaded documents on page load
  const fetchDocuments = async () => {
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_BASE_URL}/documents`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setMessage(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first.');
      return;
    }

    setUploading(true);
    setMessage(null);
    setError(null);
    setUploadedMaterial(null);
    setUploadedNotesReady(false);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      // Fallback guarantees request won't fail due to missing token
      const token = localStorage.getItem('token') || '';
      
      const response = await fetch(`${API_BASE_URL}/documents/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        let notesMessage = 'Material uploaded successfully.';
        let notesReady = false;
        if (data.document?._id) {
          setMessage('Material uploaded. Creating meaningful study notes…');
          try {
            const notesResponse = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(data.document._id)}/notes`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const notesData = await notesResponse.json();
            if (!notesResponse.ok) throw new Error(notesData.error || 'Notes could not be generated.');
            notesReady = true;
            notesMessage = 'Material uploaded and meaningful study notes generated. Open Study Notes to read them or start a quiz.';
          } catch (notesError) {
            setError(`Material was uploaded, but notes could not be generated: ${notesError.message}`);
            notesMessage = 'Material uploaded. You can retry note generation in Study Notes.';
          }
        }
        setUploadedMaterial(data.document || null);
        setUploadedNotesReady(notesReady);
        setMessage(notesMessage);
        setSelectedFile(null);
        fetchDocuments();
      } else {
        setError(data.error || 'Upload failed: Token is invalid or expired');
      }
    } catch (err) {
      setError('Upload failed: Could not reach backend server.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>Upload Study Material</h2>
      <p style={{ color: '#64748b', marginBottom: '24px' }}>
        Upload PDFs, Word Documents, or Text files to process with AI.
      </p>

      {/* File Select & Upload Container */}
      <div style={{
        border: '2px dashed #cbd5e1',
        borderRadius: '12px',
        padding: '40px 20px',
        textAlign: 'center',
        backgroundColor: '#ffffff',
        marginBottom: '20px'
      }}>
        <input
          type="file"
          id="file-upload"
          onChange={handleFileChange}
          accept=".pdf,.doc,.docx,.txt"
          style={{ display: 'none' }}
        />
        <label
          htmlFor="file-upload"
          className="upload-file-button"
          style={{
            display: 'inline-block',
            backgroundColor: '#e2e8f0',
            color: '#1e293b',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            marginBottom: '12px'
          }}
        >
          Choose File
        </label>

        {selectedFile && (
          <div className="upload-selected-file" style={{ margin: '12px 0', color: '#475569', fontSize: '14px' }}>
            Selected: <strong>{selectedFile.name}</strong>
          </div>
        )}

        <div style={{ marginTop: '16px' }}>
          <button
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
            style={{
              backgroundColor: uploading || !selectedFile ? '#94a3b8' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: uploading || !selectedFile ? 'not-allowed' : 'pointer'
            }}
          >
            {uploading ? 'Uploading & creating notes…' : 'Upload Material'}
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          ❌ {error}
        </div>
      )}

      {message && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          flexWrap: 'wrap',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          color: '#166534',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <span>✅ {message}</span>
          {uploadedMaterial?._id && (
            <Link
              to={`/take-quiz?document_id=${encodeURIComponent(uploadedMaterial._id)}${uploadedNotesReady ? '&use_notes=1' : ''}`}
              style={{ display: 'inline-block', padding: '9px 14px', borderRadius: '7px', background: '#15803d', color: '#fff', textDecoration: 'none', fontWeight: 650, whiteSpace: 'nowrap' }}
            >
              Take quiz now →
            </Link>
          )}
        </div>
      )}

      {/* Uploaded Documents List */}
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginTop: '32px', marginBottom: '12px' }}>
        Your Uploaded Documents
      </h3>
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '16px'
      }}>
        {documents.length === 0 ? (
          <p style={{ color: '#94a3b8', margin: 0 }}>No documents uploaded yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {documents.map((doc, idx) => (
              <li
                key={doc._id || idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: idx !== documents.length - 1 ? '1px solid #f1f5f9' : 'none'
                }}
              >
                <span style={{ minWidth: 0, fontWeight: '500', color: '#1e293b', overflowWrap: 'anywhere' }}>📄 {doc.filename}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{doc.upload_date || 'Uploaded'}</span>
                  <Link
                    to={`/take-quiz?document_id=${encodeURIComponent(doc._id)}${doc.has_notes ? '&use_notes=1' : ''}`}
                    style={{ padding: '7px 10px', borderRadius: '7px', background: '#2563eb', color: '#fff', textDecoration: 'none', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    Take quiz
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
