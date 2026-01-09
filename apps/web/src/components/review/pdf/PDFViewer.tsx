'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { cn } from '../../../lib/utils';
import type { Annotation } from '@hg/shared-schemas';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';

// Configure PDF.js worker using bundler-managed worker (no CDN)
// This must be set before any Document component renders
// For Next.js App Router, we use import.meta.url with the worker path
// The bundler resolves this at build time
let workerConfigured = false;

if (typeof window !== 'undefined' && !workerConfigured) {
  // Use import.meta.url to resolve worker from pdfjs-dist package
  // Next.js bundler handles this resolution at build time
  // Note: This requires the worker file to be accessible via the bundler
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch (error) {
    // Fallback: If import.meta.url fails, use a path that Next.js can resolve
    // This should not happen in production with proper webpack configuration
    console.warn('PDF.js worker: import.meta.url failed, using fallback');
    // Use the worker from node_modules via a path Next.js can resolve
    pdfjs.GlobalWorkerOptions.workerSrc = `/_next/static/chunks/pdf.worker-${pdfjs.version}.min.mjs`;
  }
  workerConfigured = true;
}

interface PDFViewerProps {
  pdfUrl: string;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  hoveredAnnotationId: string | null;
  onAnnotationClick: (annotationId: string) => void;
  onAnnotationHover: (annotationId: string | null) => void;
  getCriterionLabel: (criterionId: string) => string;
}

export function PDFViewer({
  pdfUrl,
  annotations,
  selectedAnnotationId,
  hoveredAnnotationId,
  onAnnotationClick,
  onAnnotationHover,
  getCriterionLabel,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageDimensions, setPageDimensions] = useState<Map<number, { width: number; height: number }>>(new Map());
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<{ status: number; contentType: string; message: string } | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const objectUrlRef = useRef<string | null>(null);

  // Fetch PDF and create object URL
  useEffect(() => {
    let isMounted = true;

    async function fetchPDF() {
      try {
        setLoading(true);
        setError(null);
        setFetchError(null);

        const response = await fetch(pdfUrl);

        if (!response.ok) {
          const contentType = response.headers.get('content-type') || 'unknown';
          const status = response.status;
          const text = await response.text().catch(() => 'Failed to read response');
          
          if (isMounted) {
            setFetchError({
              status,
              contentType,
              message: text.substring(0, 200), // Limit error message length
            });
            setLoading(false);
          }
          return;
        }

        const blob = await response.blob();
        const contentType = response.headers.get('content-type') || '';

        // Verify it's actually a PDF
        if (!contentType.includes('application/pdf') && !blob.type.includes('application/pdf')) {
          if (isMounted) {
            setFetchError({
              status: response.status,
              contentType,
              message: `Expected PDF but got ${contentType}`,
            });
            setLoading(false);
          }
          return;
        }

        // Create object URL
        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;

        if (isMounted) {
          setPdfFile(objectUrl);
        }
      } catch (err) {
        if (isMounted) {
          setError(`Failed to fetch PDF: ${err instanceof Error ? err.message : String(err)}`);
          setLoading(false);
        }
      }
    }

    fetchPDF();

    // Cleanup object URL on unmount
    return () => {
      isMounted = false;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [pdfUrl]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
    setFetchError(null);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    setError(`Failed to load PDF document: ${error.message}`);
    setLoading(false);
  }, []);

  const onDocumentSourceError = useCallback((error: Error) => {
    setError(`PDF source error: ${error.message}`);
    setLoading(false);
  }, []);

  const onPageLoadSuccess = useCallback((page: any, pageIndex: number) => {
    const viewport = page.getViewport({ scale });
    setPageDimensions((prev) => {
      const next = new Map(prev);
      next.set(pageIndex, { width: viewport.width, height: viewport.height });
      return next;
    });
  }, [scale]);

  // Group annotations by pageIndex
  const annotationsByPage = useCallback(() => {
    const grouped = new Map<number, Annotation[]>();
    annotations.forEach((ann) => {
      const pageIdx = ann.pageIndex;
      if (!grouped.has(pageIdx)) {
        grouped.set(pageIdx, []);
      }
      grouped.get(pageIdx)!.push(ann);
    });
    return grouped;
  }, [annotations]);

  // Scroll to page when annotation is selected
  useEffect(() => {
    if (selectedAnnotationId) {
      const annotation = annotations.find((ann) => ann.id === selectedAnnotationId);
      if (annotation) {
        const pageIdx = annotation.pageIndex;
        const pageElement = pageRefs.current.get(pageIdx);
        if (pageElement) {
          pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [selectedAnnotationId, annotations]);

  const groupedAnnotations = annotationsByPage();

  // Show fetch error (from API call)
  if (fetchError) {
    return (
      <div className="py-8">
        <Alert variant="destructive">
          <AlertTitle>Failed to fetch PDF</AlertTitle>
          <AlertDescription>
            <div className="space-y-1 mt-2">
              <p><strong>Status:</strong> {fetchError.status}</p>
              <p><strong>Content-Type:</strong> {fetchError.contentType}</p>
              <p><strong>Message:</strong> {fetchError.message}</p>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show render error (from PDF.js)
  if (error && !loading) {
    return (
      <div className="py-8">
        <Alert variant="destructive">
          <AlertTitle>Error loading PDF</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Wait for PDF file to be ready
  if (!pdfFile) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-600">Loading PDF...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* PDF Pages */}
      <Document
        file={pdfFile}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        onSourceError={onDocumentSourceError}
        loading={
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-600">Loading PDF...</p>
          </div>
        }
        error={
          <div className="py-8">
            <Alert variant="destructive">
              <AlertTitle>Error rendering PDF</AlertTitle>
              <AlertDescription>Failed to render PDF document.</AlertDescription>
            </Alert>
          </div>
        }
      >
        <div className="space-y-6">
          {Array.from({ length: numPages }, (_, index) => {
            const pageNumber = index + 1;
            const pageAnnotations = groupedAnnotations.get(index) || [];
            const pageDim = pageDimensions.get(index);

            return (
              <div
                key={index}
                ref={(el) => {
                  if (el) {
                    pageRefs.current.set(index, el);
                  }
                }}
                className="relative inline-block border border-gray-200 rounded-lg overflow-visible bg-white shadow-sm"
              >
                <div className="relative">
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    onLoadSuccess={(page) => onPageLoadSuccess(page, index)}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                  {/* Overlay layer for annotations */}
                  {pageDim && pageAnnotations.length > 0 && (
                    <div
                      className="absolute top-0 left-0 pointer-events-none"
                      style={{
                        width: `${pageDim.width}px`,
                        height: `${pageDim.height}px`,
                      }}
                    >
                      {pageAnnotations.map((ann) => {
                        const bbox = ann.bboxNorm;
                        const isSelected = selectedAnnotationId === ann.id;
                        const isHovered = hoveredAnnotationId === ann.id;

                        return (
                          <div
                            key={ann.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onAnnotationClick(ann.id);
                            }}
                            onMouseEnter={() => onAnnotationHover(ann.id)}
                            onMouseLeave={() => onAnnotationHover(null)}
                            className={cn(
                              'absolute cursor-pointer rounded transition-all pointer-events-auto',
                              'box-border',
                              // Default state
                              !isSelected && !isHovered && 'border border-blue-400 bg-blue-400/10',
                              // Hover state (not selected)
                              !isSelected && isHovered && 'border-2 border-blue-600 bg-blue-400/20',
                              // Selected state
                              isSelected && 'border-[3px] border-red-600 bg-red-400/20 shadow-lg shadow-red-500/30'
                            )}
                            style={{
                              left: `${bbox.x * pageDim.width}px`,
                              top: `${bbox.y * pageDim.height}px`,
                              width: `${bbox.w * pageDim.width}px`,
                              height: `${bbox.h * pageDim.height}px`,
                            }}
                            title={ann.label || getCriterionLabel(ann.criterionId)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Document>
    </div>
  );
}
