import { siteConfig } from './generated/site-config.js';

const ALLOWED_PATHS = [
  /^\/assets(?:\/|$)/,
  /^\/hashed-assets(?:\/|$)/,
  /^\/go\/support\/?$/,
  /^\/cdn-cgi(?:\/|$)/,
];

const COPY = {
  en: {
    title: 'Maintenance in progress',
    message: 'QuartzLab is temporarily unavailable while the site is being updated. Please try again a little later.',
  },
  ru: {
    title: 'Ведутся технические работы',
    message: 'QuartzLab временно недоступен. Мы уже работаем над обновлением сайта. Попробуйте зайти немного позже.',
  },
};

export function isMaintenanceAssetPath(pathname) {
  return ALLOWED_PATHS.some(pattern => pattern.test(pathname));
}

function preferredLanguage(acceptLanguage) {
  const candidates = String(acceptLanguage || '')
    .split(',')
    .map((entry, index) => {
      const [tag, ...parameters] = entry.trim().split(';');
      const qualityParameter = parameters.find(parameter => parameter.trim().startsWith('q='));
      const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;
      return { language: tag.toLowerCase().split('-')[0], quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter(item => ['en', 'ru'].includes(item.language) && item.quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index);
  return candidates[0]?.language || 'en';
}

export function maintenanceLanguage(request) {
  const pathname = new URL(request.url).pathname;
  if (pathname === '/ru' || pathname.startsWith('/ru/')) return 'ru';
  if (pathname === '/en' || pathname.startsWith('/en/')) return 'en';
  return preferredLanguage(request.headers.get('accept-language'));
}

export function renderMaintenancePage(language) {
  const copy = COPY[language] || COPY.en;
  return `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${copy.title} — QuartzLab</title>
  <style>
    :root{color-scheme:light dark;--bg:#f5f7f7;--panel:rgba(255,255,255,.82);--text:#101718;--muted:#586768;--line:rgba(16,23,24,.14);--cyan:#08a8b5}
    @media(prefers-color-scheme:dark){:root{--bg:#070b0c;--panel:rgba(16,23,24,.84);--text:#f3f8f8;--muted:#9babad;--line:rgba(255,255,255,.13);--cyan:#26d6df}}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 15%,color-mix(in srgb,var(--cyan) 10%,transparent),transparent 34%),var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{width:min(680px,100%);padding:clamp(30px,7vw,64px);border:1px solid var(--line);border-radius:18px;background:var(--panel);box-shadow:0 26px 90px rgba(0,0,0,.18);text-align:center;backdrop-filter:blur(18px)}
    .brand{display:inline-flex;align-items:center;gap:12px;margin-bottom:42px;font-size:22px;font-weight:800;letter-spacing:-.04em}.brand img{width:38px;height:38px}.brand span span{color:var(--cyan)}
    .status{display:inline-block;margin:0 0 16px;color:var(--cyan);font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}h1{margin:0;font-size:clamp(34px,7vw,58px);line-height:1.02;letter-spacing:-.055em}p{max-width:520px;margin:24px auto 0;color:var(--muted);font-size:clamp(16px,3vw,19px);line-height:1.65}
    @media(max-width:480px){body{padding:12px}main{padding:34px 22px;border-radius:14px}.brand{margin-bottom:34px}}
  </style>
</head>
<body>
  <main>
    <div class="brand"><img src="/assets/quartzlab-mark.svg" alt=""><span>Quartz<span>Lab</span></span></div>
    <div class="status">503 · Service Unavailable</div>
    <h1>${copy.title}</h1>
    <p>${copy.message}</p>
  </main>
</body>
</html>`;
}

export async function handleMaintenanceRequest(context, config = siteConfig) {
  if (!config.maintenance.enabled) return context.next();

  const url = new URL(context.request.url);
  if (isMaintenanceAssetPath(url.pathname)) return context.next();

  const language = maintenanceLanguage(context.request);
  const body = context.request.method === 'HEAD' ? null : renderMaintenancePage(language);
  return new Response(body, {
    status: 503,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Language': language,
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      'Content-Type': 'text/html; charset=utf-8',
      'Retry-After': String(config.maintenance.retryAfterSeconds),
      'Vary': 'Accept-Language',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export function onRequest(context) {
  return handleMaintenanceRequest(context);
}
