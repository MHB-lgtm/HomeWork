'use client';

import { useRef, useState } from 'react';
import { CoursesClientError, uploadLecture } from '../../lib/coursesClient';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Input } from '../ui/input';

type LectureUploadFormProps = {
  courseId: string;
  onUploaded?: () => void;
};

const allowedExtensions = ['.txt', '.md', '.vtt', '.srt'];

const getFileExtension = (name: string) => {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex === -1) return '';
  return name.slice(dotIndex).toLowerCase();
};

const looksLikeUrl = (value: string) => {
  if (!value || /\s/.test(value)) return false;
  if (/^https?:\/\//i.test(value)) return true;
  return /.+\..+/.test(value);
};

const getErrorMessage = (error: unknown, status?: number) => {
  if (status === 415) {
    return 'Unsupported file type. Supported: .txt, .md, .vtt, .srt.';
  }
  if (error instanceof CoursesClientError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Failed to upload lecture.';
};

export function LectureUploadForm({ courseId, onUploaded }: LectureUploadFormProps) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2) {
      setMessage({ type: 'error', text: 'Title must be at least 2 characters.' });
      return;
    }

    if (!file) {
      setMessage({ type: 'error', text: 'Lecture file is required.' });
      return;
    }

    const extension = getFileExtension(file.name);
    if (!allowedExtensions.includes(extension)) {
      setMessage({ type: 'error', text: 'Supported file types: .txt, .md, .vtt, .srt.' });
      return;
    }

    const trimmedUrl = externalUrl.trim();
    if (trimmedUrl && !looksLikeUrl(trimmedUrl)) {
      setMessage({ type: 'error', text: 'External URL should look like a valid link (include http/https if possible).' });
      return;
    }

    setIsUploading(true);
    try {
      await uploadLecture(courseId, {
        title: trimmedTitle,
        file,
        externalUrl: trimmedUrl || undefined,
      });
      setMessage({ type: 'success', text: 'Lecture uploaded successfully.' });
      setTitle('');
      setFile(null);
      setExternalUrl('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onUploaded?.();
    } catch (error) {
      const status = error instanceof CoursesClientError ? error.status : undefined;
      setMessage({ type: 'error', text: getErrorMessage(error, status) });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <CardHeader className="pb-5">
        <CardTitle className="text-lg font-semibold text-slate-900">Upload Lecture</CardTitle>
        <p className="text-sm text-slate-600">Add text, markdown, or transcript files to this course.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="lecture-title" className="text-sm font-medium text-slate-700">
              Lecture title
            </label>
            <Input
              id="lecture-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Lecture 3: Convolution"
              disabled={isUploading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="lecture-file" className="text-sm font-medium text-slate-700">
              Lecture file (.txt, .md, .vtt, .srt)
            </label>
            <Input
              id="lecture-file"
              ref={fileInputRef}
              type="file"
              accept={allowedExtensions.join(',')}
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              disabled={isUploading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="lecture-url" className="text-sm font-medium text-slate-700">
              External URL (optional)
            </label>
            <Input
              id="lecture-url"
              value={externalUrl}
              onChange={(event) => setExternalUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={isUploading}
            />
          </div>

          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              <AlertTitle>{message.type === 'error' ? 'Upload failed' : 'Upload complete'}</AlertTitle>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isUploading} className="w-full">
            {isUploading ? 'Uploading...' : 'Upload Lecture'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
