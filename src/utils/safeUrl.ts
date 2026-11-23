export function isSafeHttpOrRelativeUrl(rawUrl: unknown): boolean {
  if (typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return false;
  if (trimmed.startsWith('#') || (trimmed.startsWith('/') && !trimmed.startsWith('//'))) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function toSafeExternalHref(rawUrl: unknown, fallback = '#top'): string {
  if (!isSafeHttpOrRelativeUrl(rawUrl)) {
    return fallback;
  }
  return (rawUrl as string).trim();
}
