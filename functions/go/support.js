const BOOSTY_URL = 'https://boosty.to/quartzlab';
const EVENT_TYPE = 'support_click';
const PLACE_PATTERN = /^[a-z0-9-]{1,40}$/i;
const LANGUAGE_PATTERN = /^(en|ru)$/;
const PATHNAME_PATTERN = /^\/[a-z0-9/_-]{0,160}$/i;

export function sanitizePlace(value) {
  return PLACE_PATTERN.test(String(value || '')) ? String(value).toLowerCase() : 'unknown';
}

export function sanitizeLanguage(value) {
  return LANGUAGE_PATTERN.test(String(value || '')) ? String(value).toLowerCase() : 'en';
}

export function sanitizePathname(value) {
  const pathname = String(value || '').trim().split('?')[0] || '/';
  if (!PATHNAME_PATTERN.test(pathname)) {
    return '/';
  }
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : '/';
}

export function resolveSupportEvent(request) {
  const requestUrl = new URL(request.url);
  const requestedPage = requestUrl.searchParams.get('page');
  const referer = request.headers.get('referer');

  let pathname = sanitizePathname(requestedPage);
  if (pathname === '/' && referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.origin === requestUrl.origin) {
        pathname = sanitizePathname(refererUrl.pathname);
      }
    } catch (_) {}
  }

  return {
    eventType: EVENT_TYPE,
    place: sanitizePlace(requestUrl.searchParams.get('place')),
    language: sanitizeLanguage(requestUrl.searchParams.get('lang')),
    pathname,
  };
}

export function validateAnalyticsPayload(payload) {
  if (!Array.isArray(payload?.indexes) || payload.indexes.length !== 1) {
    throw new Error('Analytics Engine payload must contain exactly one index.');
  }

  return payload;
}

export function buildAnalyticsPayload(event) {
  return validateAnalyticsPayload({
    indexes: [event.eventType],
    blobs: [event.place, event.language, event.pathname],
    doubles: [1],
  });
}

function redirectResponse() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: BOOSTY_URL,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function writeAnalytics(env, event) {
  if (!env?.SUPPORT_ANALYTICS?.writeDataPoint) {
    return;
  }

  await env.SUPPORT_ANALYTICS.writeDataPoint(buildAnalyticsPayload(event));
}

export async function onRequestGet(context) {
  const event = resolveSupportEvent(context.request);

  try {
    await writeAnalytics(context.env, event);
  } catch (_) {
    return redirectResponse();
  }

  return redirectResponse();
}

export async function onRequestHead() {
  return redirectResponse();
}
