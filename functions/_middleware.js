const LEGACY_ROUTE_PATTERN = /^\/(ru|en)\/(plugins|docs)\/([a-z0-9][a-z0-9-]{0,63})\/?$/;

export function parseLegacyRoute(pathname) {
  const match = LEGACY_ROUTE_PATTERN.exec(pathname);
  if (!match) {
    return null;
  }

  const [, language, section, slug] = match;
  return {
    language,
    section,
    slug,
  };
}

function buildLegacyRedirect(url, route) {
  const destination = new URL(route.section === 'plugins' ? '/plugin.html' : '/docs.html', url);
  destination.searchParams.set('lang', route.language);
  destination.searchParams.set('slug', route.slug);
  return destination;
}

export async function onRequest(context) {
  const { request, next } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return next();
  }

  const url = new URL(request.url);
  const route = parseLegacyRoute(url.pathname);
  if (!route) {
    return next();
  }

  return Response.redirect(buildLegacyRedirect(url, route), 302);
}
