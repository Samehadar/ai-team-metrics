export const MODEL_SHORT_NAMES: Record<string, string> = {
  'composer-1.5': 'Composer 1.5',
  'composer-1': 'Composer 1',
  'claude-4.6-opus-high-thinking': 'Opus 4.6',
  'claude-4.6-opus-max-thinking': 'Opus 4.6 Max',
  'claude-4.6-sonnet-medium-thinking': 'Sonnet 4.6',
  'claude-4.5-sonnet-thinking': 'Sonnet 4.5',
  'claude-4.5-sonnet': 'Sonnet 4.5 (no think)',
  'claude-4.5-opus-high-thinking': 'Opus 4.5',
  'auto': 'Auto',
  'gpt-5.3-codex': 'GPT-5.3 Codex',
  'gpt-5.4-medium': 'GPT-5.4 Medium',
  'kimi-k2-instruct-0905': 'Kimi K2',
  'gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
};

export const COLORS = [
  '#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261',
  '#264653', '#a8dadc', '#6a4c93', '#1982c4', '#8ac926',
  '#ff595e', '#ffca3a', '#06d6a0',
];

export function shortModel(model: string): string {
  return MODEL_SHORT_NAMES[model] || model;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

export function formatNumber(n: number, locale = 'en-US'): string {
  return n.toLocaleString(locale);
}

export function formatDate(dateStr: string, locale = 'en-US'): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

export function extractNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.(csv|json)$/i, '');
  const withoutPrefix = base.replace(/^акк[_ ]/i, '');
  return withoutPrefix.replace(/_/g, ' ').trim();
}

export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) return parts[parts.length - 1];
  return parts[0];
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    const p = parts[0];
    return (p.length >= 2 ? p.slice(0, 2) : p).toUpperCase();
  }
  const first = parts[0][0] ?? '';
  const last = parts[parts.length - 1][0] ?? '';
  return (first + last).toUpperCase();
}
