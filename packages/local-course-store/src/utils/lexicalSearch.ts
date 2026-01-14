const TOKEN_SPLIT_REGEX = /[^a-z0-9\u0590-\u05ff]+/i;

export const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .split(TOKEN_SPLIT_REGEX)
    .filter((token) => token.length >= 2);
};

export const uniqueTokens = (tokens: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of tokens) {
    if (!seen.has(token)) {
      seen.add(token);
      result.push(token);
    }
  }
  return result;
};

const buildFrequencyMap = (tokens: string[]): Map<string, number> => {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }
  return freq;
};

export const scoreChunk = (
  queryTokens: string[],
  chunkText: string
): { score: number; matchedTokens: string[] } => {
  if (queryTokens.length === 0 || !chunkText) {
    return { score: 0, matchedTokens: [] };
  }

  const chunkTokens = tokenize(chunkText);
  const freq = buildFrequencyMap(chunkTokens);
  let score = 0;
  const matchedTokens: string[] = [];

  for (const token of queryTokens) {
    const count = freq.get(token);
    if (count) {
      matchedTokens.push(token);
      const bonus = Math.min(3, count) * 0.1;
      score += 1 + bonus;
    }
  }

  return { score, matchedTokens };
};

const findFirstMatchIndex = (textLower: string, tokens: string[]): number => {
  let earliest = -1;
  for (const token of tokens) {
    const idx = textLower.indexOf(token);
    if (idx !== -1 && (earliest === -1 || idx < earliest)) {
      earliest = idx;
    }
  }
  return earliest;
};

export const buildSnippet = (text: string, matchedTokens: string[]): string => {
  if (!text) return '';

  const lower = text.toLowerCase();
  const idx = matchedTokens.length ? findFirstMatchIndex(lower, matchedTokens) : -1;

  let snippet: string;
  if (idx !== -1) {
    const start = Math.max(0, idx - 120);
    const end = Math.min(text.length, idx + 220);
    snippet = text.slice(start, end).trim();
  } else {
    snippet = text.slice(0, 300).trim();
  }

  if (snippet.length > 320) {
    snippet = snippet.slice(0, 320).trimEnd();
  }

  return snippet;
};

export const selectReasonTokens = (matchedTokens: string[], maxTokens = 3): string[] => {
  return matchedTokens.slice(0, maxTokens);
};
