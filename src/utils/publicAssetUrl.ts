const BASE_URL = import.meta.env.BASE_URL || '/';

export const IS_STATIC_ONLY_BUILD =
  import.meta.env.VITE_STATIC_ONLY === 'true' || BASE_URL !== '/';

export function publicAssetUrl(path: string): string {
  if (/^(?:https?:|data:|blob:)/i.test(path)) return path;
  const base = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`;
  return `${base}${path.replace(/^\/+/, '')}`;
}
