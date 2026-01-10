import * as fs from 'fs/promises';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';

/**
 * Get data directory from environment variable
 */
function getDataDir(): string {
  const dataDir = process.env.HG_DATA_DIR;
  if (!dataDir) {
    throw new Error('HG_DATA_DIR is not set in environment variables');
  }
  return path.resolve(dataDir);
}

export type ExtractMiniPdfResult = { ok: true; outputPath: string } | { ok: false; error: string };

/**
 * Extract selected pages from a PDF into a new mini-PDF file
 * Uses pdf-lib to copy pages (0-based indices) without rasterization
 * Output is saved to HG_DATA_DIR/uploads/derived/<jobId>/questions/<questionId>.pdf
 */
export async function extractMiniPdf(
  inputPdfPath: string,
  pageIndices: number[],
  jobId: string,
  questionId: string
): Promise<ExtractMiniPdfResult> {
  try {
    // Validate pageIndices
    if (pageIndices.length === 0) {
      return { ok: false, error: 'pageIndices must not be empty' };
    }

    // Read input PDF
    const inputPdfBytes = await fs.readFile(inputPdfPath);

    // Load PDF document
    const inputPdf = await PDFDocument.load(inputPdfBytes);
    const totalPages = inputPdf.getPageCount();

    // Validate page indices are within bounds
    for (const pageIndex of pageIndices) {
      if (pageIndex < 0 || pageIndex >= totalPages) {
        return {
          ok: false,
          error: `Page index ${pageIndex} is out of bounds (total pages: ${totalPages})`,
        };
      }
    }

    // Create new PDF document
    const outputPdf = await PDFDocument.create();

    // Copy selected pages (pdf-lib uses 0-based indices)
    const copiedPages = await outputPdf.copyPages(inputPdf, pageIndices);
    copiedPages.forEach((page) => {
      outputPdf.addPage(page);
    });

    // Serialize PDF
    const outputPdfBytes = await outputPdf.save();

    // Ensure output directory exists
    const dataDir = getDataDir();
    const outputDir = path.join(dataDir, 'uploads', 'derived', jobId, 'questions');
    await fs.mkdir(outputDir, { recursive: true });

    // Write output PDF
    const outputPath = path.join(outputDir, `${questionId}.pdf`);
    await fs.writeFile(outputPath, outputPdfBytes);

    console.log(`[worker] Extracted mini-PDF: ${outputPath} (pages: [${pageIndices.join(', ')}])`);
    return { ok: true, outputPath };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: `Failed to extract mini-PDF: ${errorMessage}`,
    };
  }
}
