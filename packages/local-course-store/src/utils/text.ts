export const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
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

export const scoreTokens = (
  queryTokens: string[],
  chunkTokens: string[]
): { score: number; matchedTokens: string[] } => {
  const freq = buildFrequencyMap(chunkTokens);
  let score = 0;
  const matchedTokens: string[] = [];

  for (const token of queryTokens) {
    const count = freq.get(token);
    if (count) {
      matchedTokens.push(token);
      score += 1 + Math.log1p(count);
    }
  }

  return { score, matchedTokens };
};

const findFirstMatchIndex = (haystackLower: string, tokens: string[]): number => {
  let earliest = -1;
  for (const token of tokens) {
    const idx = haystackLower.indexOf(token);
    if (idx !== -1 && (earliest === -1 || idx < earliest)) {
      earliest = idx;
    }
  }
  return earliest;
};

export const buildSnippet = (text: string, matchedTokens: string[]): string => {
  const lower = text.toLowerCase();
  const idx = matchedTokens.length > 0 ? findFirstMatchIndex(lower, matchedTokens) : -1;

  let snippet: string;
  if (idx !== -1) {
    const start = Math.max(0, idx - 120);
    const end = Math.min(text.length, idx + 200);
    snippet = text.slice(start, end).trim();
  } else {
    snippet = text.slice(0, 240).trim();
  }

  if (snippet.length > 320) {
    snippet = snippet.slice(0, 320).trimEnd();
  }

  return snippet;
};

export const selectReasonTokens = (matchedTokens: string[], maxTokens = 3): string[] => {
  return matchedTokens.slice(0, maxTokens);
};
