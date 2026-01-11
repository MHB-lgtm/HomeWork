'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { cn } from '../../../lib/utils';
import type { Annotation } from '@hg/shared-schemas';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';

// Configure PDF.js worker using CDN with .mjs (ESM worker for pdfjs-dist v4)
// This must be set before any Document component renders
// Use module-level guard so it runs once on the client
// Note: Next.js webpack doesn't support import.meta.url, so we use CDN as the primary method
let workerConfigured = false;

if (typeof window !== 'undefined' && !workerConfigured) {
  // Use pinned CDN URL with .mjs (ESM worker for pdfjs-dist v4)
  // Do NOT use pdf.worker.min.js - use .mjs for proper ESM support
  // This avoids "Setting up fake worker failed" errors
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
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
  onPageChange?: (pageIndex: number) => void;
}

export function PDFViewer({
  pdfUrl,
  annotations,
  selectedAnnotationId,
  hoveredAnnotationId,
  onAnnotationClick,
  onAnnotationHover,
  getCriterionLabel,
  onPageChange,
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
  const observerRef = useRef<IntersectionObserver | null>(null);
  const activePageRef = useRef<number | null>(null);
  const ratioByPageRef = useRef<Map<number, number>>(new Map());
  const pdfScrollContainerRef = useRef<HTMLElement | null>(null);
  
  // Constants for hysteresis
  const MIN_SWITCH_DELTA = 0.05;
  const MIN_ACTIVE_RATIO = 0.15;

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
    // Show detailed error message instead of infinite loading
    const errorMessage = error.message || String(error);
    setError(`Failed to load PDF document: ${errorMessage}`);
    setLoading(false);
  }, []);

  const onDocumentSourceError = useCallback((error: Error) => {
    // Show detailed error message instead of infinite loading
    const errorMessage = error.message || String(error);
    setError(`PDF source error: ${errorMessage}`);
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

  // Find PDF scroll container (the element that scrolls the PDF pages)
  // This runs after pages are rendered to find the actual scroll container
  useEffect(() => {
    if (!onPageChange || numPages === 0 || pageRefs.current.size === 0) {
      return;
    }

    // Try to find the scroll container by looking for the parent that has overflow
    const findScrollContainer = (): HTMLElement | null => {
      const firstPage = pageRefs.current.values().next().value;
      if (!firstPage) return null;
      
      let current: HTMLElement | null = firstPage.parentElement;
      while (current) {
        const style = window.getComputedStyle(current);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll') {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    };

    const container = findScrollContainer();
    if (container !== pdfScrollContainerRef.current) {
      pdfScrollContainerRef.current = container;
      // If observer exists, recreate it with new root
      if (observerRef.current && pageRefs.current.size > 0) {
        const oldObserver = observerRef.current;
        oldObserver.disconnect();
        
        const newObserver = new IntersectionObserver(observerCallback, {
          threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
          rootMargin: '-20% 0px -20% 0px',
          root: container || undefined,
        });
        
        observerRef.current = newObserver;
        // Re-observe all pages
        pageRefs.current.forEach((pageElement) => {
          if (pageElement) {
            newObserver.observe(pageElement);
          }
        });
      }
    }
  }, [numPages, onPageChange]);

  // Observer callback (shared logic)
  const observerCallback = (entries: IntersectionObserverEntry[]) => {
    // Update ratios for all received entries
    entries.forEach((entry) => {
      const pageIndex = parseInt(entry.target.getAttribute('data-page-index') || '-1', 10);
      if (pageIndex >= 0) {
        ratioByPageRef.current.set(pageIndex, entry.intersectionRatio);
      }
    });

    // Find the page with the highest intersection ratio
    let maxRatio = 0;
    let candidatePage: number | null = null;

    ratioByPageRef.current.forEach((ratio, pageIndex) => {
      if (ratio > maxRatio) {
        maxRatio = ratio;
        candidatePage = pageIndex;
      }
    });

    // Apply hysteresis: only switch if significant change or current is too low
    const currentPage = activePageRef.current;
    const currentRatio = currentPage !== null ? ratioByPageRef.current.get(currentPage) || 0 : 0;

    if (candidatePage !== null) {
      const shouldSwitch =
        candidatePage !== currentPage &&
        (maxRatio >= currentRatio + MIN_SWITCH_DELTA || currentRatio < MIN_ACTIVE_RATIO);

      if (shouldSwitch && onPageChange) {
        activePageRef.current = candidatePage;
        onPageChange(candidatePage);
      }
    }
  };

  // Set up IntersectionObserver to detect active page
  useEffect(() => {
    if (!onPageChange || numPages === 0) {
      return;
    }

    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer with correct root (use current container if available)
    const observer = new IntersectionObserver(
      observerCallback,
      {
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0], // Multiple thresholds for better detection
        rootMargin: '-20% 0px -20% 0px', // Consider page active when it's in the middle 60% of viewport
        root: pdfScrollContainerRef.current || undefined, // Use PDF scroll container if found, else window
      }
    );

    observerRef.current = observer;

    // Observe all existing page elements
    pageRefs.current.forEach((pageElement) => {
      if (pageElement) {
        observer.observe(pageElement);
      }
    });

    // Cleanup on unmount
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      ratioByPageRef.current.clear();
    };
  }, [numPages, onPageChange]);

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
              <AlertDescription>
                {error || 'Failed to render PDF document. Please check the browser console for details.'}
              </AlertDescription>
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
                id={`pdf-page-${index}`}
                data-page-index={index}
                ref={(el) => {
                  if (el) {
                    // Store element in map
                    pageRefs.current.set(index, el);
                    // Observe immediately if observer exists
                    if (observerRef.current) {
                      observerRef.current.observe(el);
                    }
                  } else {
                    // Unobserve and remove from map on unmount
                    if (observerRef.current) {
                      const existingEl = pageRefs.current.get(index);
                      if (existingEl) {
                        observerRef.current.unobserve(existingEl);
                      }
                    }
                    pageRefs.current.delete(index);
                    ratioByPageRef.current.delete(index);
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
