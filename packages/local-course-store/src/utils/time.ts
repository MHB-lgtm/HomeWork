const TIME_PATTERN = /^(?:(\d{1,2}):)?(\d{2}):(\d{2})(?:[.,](\d{1,3}))?$/;

export const parseTimecode = (raw: string): number | null => {
  const trimmed = raw.trim();
  const match = trimmed.match(TIME_PATTERN);
  if (!match) {
    return null;
  }

  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const millisRaw = match[4] ?? '0';
  const millis = Number(millisRaw.padEnd(3, '0').slice(0, 3));

  if ([hours, minutes, seconds, millis].some((value) => Number.isNaN(value))) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
};

export const formatSeconds = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => value.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${minutes}:${pad(secs)}`;
};

export const buildTimeUrl = (url: string, startSec: number): string => {
  const normalized = url.trim();
  const seconds = Math.max(0, Math.floor(startSec));

  if (/youtube\.com|youtu\.be/i.test(normalized)) {
    const hasQuery = normalized.includes('?');
    const joiner = hasQuery ? '&' : '?';
    return `${normalized}${joiner}t=${seconds}`;
  }

  return normalized;
};
