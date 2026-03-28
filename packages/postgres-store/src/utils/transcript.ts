import { parseTimecode } from './time';

const normalizeLines = (input: string): string[] => {
  const normalized = input.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
  return normalized.split('\n');
};

const tryParseTimeRange = (line: string): { startSec: number; endSec: number } | null => {
  if (!line.includes('-->')) {
    return null;
  }
  const [startRaw, endRaw] = line.split('-->');
  if (!endRaw) {
    return null;
  }
  const startSec = parseTimecode(startRaw.trim());
  const endCandidate = endRaw.trim().split(/\s+/)[0];
  const endSec = parseTimecode(endCandidate);
  if (startSec == null || endSec == null) {
    return null;
  }
  return { startSec, endSec };
};

const finalizeSegment = (
  segmentCount: { value: number },
  range: { startSec: number; endSec: number },
  textLines: string[]
) => {
  const text = textLines.map((line) => line.trim()).filter(Boolean).join(' ').trim();
  if (!text) {
    return;
  }

  segmentCount.value += 1;
};

const parseTranscript = (input: string, format: 'vtt' | 'srt'): number => {
  const lines = normalizeLines(input);
  const segmentCount = { value: 0 };
  let i = 0;

  if (format === 'vtt') {
    while (i < lines.length && lines[i].trim() === '') {
      i += 1;
    }

    if (lines[i]?.trim().startsWith('WEBVTT')) {
      i += 1;
      while (i < lines.length && lines[i].trim() !== '') {
        i += 1;
      }
    }
  }

  while (i < lines.length) {
    let line = lines[i]?.trim() ?? '';
    if (!line) {
      i += 1;
      continue;
    }

    if (format === 'vtt') {
      if (!tryParseTimeRange(line) && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (tryParseTimeRange(nextLine)) {
          i += 1;
          line = nextLine;
        }
      }
    } else if (/^\d+$/.test(line) && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      if (tryParseTimeRange(nextLine)) {
        i += 1;
        line = nextLine;
      }
    }

    const range = tryParseTimeRange(line);
    if (!range) {
      i += 1;
      continue;
    }

    i += 1;
    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') {
      textLines.push(lines[i]);
      i += 1;
    }

    finalizeSegment(segmentCount, range, textLines);
    i += 1;
  }

  if (segmentCount.value === 0) {
    throw new Error(`No valid ${format.toUpperCase()} segments found`);
  }

  return segmentCount.value;
};

export const assertValidVtt = (input: string): void => {
  parseTranscript(input, 'vtt');
};

export const assertValidSrt = (input: string): void => {
  parseTranscript(input, 'srt');
};
