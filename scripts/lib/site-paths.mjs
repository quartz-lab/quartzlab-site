export const DEFAULT_SITE_ORIGIN = 'https://quartzlab.ru';
export const DEFAULT_SITE_BASE_PATH = '/';

export function normalizeSiteOrigin(value = DEFAULT_SITE_ORIGIN) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new TypeError(`SITE_ORIGIN must be an absolute URL: ${value}`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new TypeError('SITE_ORIGIN must be a clean HTTPS origin.');
  }
  return url.origin;
}

export function normalizeBasePath(value = DEFAULT_SITE_BASE_PATH) {
  const input = String(value || '/').trim();
  if (/[?#\\]/.test(input) || input.includes('..')) {
    throw new TypeError(`SITE_BASE_PATH is invalid: ${value}`);
  }
  const segments = input.split('/').filter(Boolean);
  return segments.length ? `/${segments.join('/')}` : '/';
}

export function withBasePath(pathname, basePath = DEFAULT_SITE_BASE_PATH) {
  const normalizedBase = normalizeBasePath(basePath);
  const input = String(pathname || '/');
  if (!input.startsWith('/')) throw new TypeError(`Public path must start with /: ${pathname}`);
  if (normalizedBase === '/') return input.replace(/\/{2,}/g, '/');
  if (input === '/') return `${normalizedBase}/`;
  return `${normalizedBase}${input}`.replace(/\/{2,}/g, '/');
}

export function canonicalUrl(pathname, siteOrigin = DEFAULT_SITE_ORIGIN) {
  return `${normalizeSiteOrigin(siteOrigin)}${String(pathname).startsWith('/') ? pathname : `/${pathname}`}`;
}

export function buildOptions(environment = process.env, defaults = {}) {
  return {
    siteOrigin: normalizeSiteOrigin(environment.SITE_ORIGIN || defaults.siteOrigin || DEFAULT_SITE_ORIGIN),
    basePath: normalizeBasePath(environment.SITE_BASE_PATH || DEFAULT_SITE_BASE_PATH),
  };
}

export function applyBasePathToHtml(html, basePath) {
  const normalizedBase = normalizeBasePath(basePath);
  if (normalizedBase === '/') return String(html);

  return String(html).replace(
    /\b(href|src|poster|data-media-src|data-media-full-src|data-media-poster)=(['"])(\/[^/'"][^'"]*|\/)\2/gi,
    (match, attribute, quote, value) => `${attribute}=${quote}${withBasePath(value, normalizedBase)}${quote}`,
  );
}
