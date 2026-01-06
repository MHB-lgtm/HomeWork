'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { listExams, createExam, ExamSummary } from '../../lib/examsClient';

export default function ExamsPage() {
  const [title, setTitle] = useState('');
  const [examFile, setExamFile] = useState<File | null>(null);
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load exams on mount
  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    setIsLoading(true);
    const result = await listExams();
    setIsLoading(false);

    if (result.ok) {
      setExams(result.data);
    } else {
      setMessage({ type: 'error', text: result.error });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!title.trim()) {
      setMessage({ type: 'error', text: 'Title is required' });
      return;
    }

    if (!examFile) {
      setMessage({ type: 'error', text: 'Exam file is required' });
      return;
    }

    setIsCreating(true);

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('examFile', examFile);

    const result = await createExam(formData);
    setIsCreating(false);

    if (result.ok) {
      setMessage({ type: 'success', text: `Exam created successfully: ${result.examId}` });
      setTitle('');
      setExamFile(null);
      // Reset file input
      const fileInput = document.getElementById('examFile') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      // Reload exams list
      await loadExams();
    } else {
      setMessage({ type: 'error', text: result.error });
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link href="/" style={{ color: '#0070f3', textDecoration: 'none' }}>
          ← Back to Home
        </Link>
      </div>

      <h1>Manage Exams</h1>

      {message && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
            border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
            borderRadius: '4px',
            color: message.type === 'success' ? '#155724' : '#721c24',
          }}
        >
          {message.text}
        </div>
      )}

      <div style={{ marginTop: '2rem' }}>
        <h2>Create Exam</h2>
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label htmlFor="title" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Title:
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label htmlFor="examFile" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Exam File (PDF/PNG/JPG):
            </label>
            <input
              id="examFile"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setExamFile(e.target.files?.[0] || null)}
              required
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>

          <button
            type="submit"
            disabled={isCreating}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: isCreating ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
            }}
          >
            {isCreating ? 'Creating...' : 'Create Exam'}
          </button>
        </form>
      </div>

      <div style={{ marginTop: '3rem' }}>
        <h2>Existing Exams</h2>
        {isLoading ? (
          <p style={{ marginTop: '1rem' }}>Loading exams...</p>
        ) : exams.length === 0 ? (
          <p style={{ marginTop: '1rem', color: '#666' }}>No exams found. Create one above.</p>
        ) : (
          <div style={{ marginTop: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Exam ID</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Title</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Created At</th>
                  {exams.some((e) => e.updatedAt) && (
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Updated At</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <tr key={exam.examId} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '0.75rem', border: '1px solid #ddd', fontFamily: 'monospace', fontSize: '0.9em' }}>
                      {exam.examId}
                    </td>
                    <td style={{ padding: '0.75rem', border: '1px solid #ddd', fontWeight: 'bold' }}>
                      {exam.title}
                    </td>
                    <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                      {formatDate(exam.createdAt)}
                    </td>
                    {exams.some((e) => e.updatedAt) && (
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {exam.updatedAt ? formatDate(exam.updatedAt) : '-'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

