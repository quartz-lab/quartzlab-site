import path from 'node:path';

const SITE_ORIGIN = 'https://quartzlab.ru';

export const THEME_INIT_SCRIPT = '(()=>{let t;try{t=localStorage.getItem("quartzlab-theme")}catch{}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t})();';

function themeInitMarkup() {
  return `<script>${THEME_INIT_SCRIPT}</script>`;
}

const UI = {
  en: {
    about: 'About',
    aboutPlugin: 'About the plugin',
    assetStore: 'Asset Store',
    documentation: 'Documentation',
    features: 'Features',
    footerCatalog: 'Catalog metadata is kept current through automatic synchronization with GitHub Releases',
    footerCatalogLink: 'Unity plugin catalog',
    footerDescription: 'Independent Unity Editor tools with predictable file changes, published source, and bilingual documentation.',
    footerAboutLink: 'About QuartzLab',
    footerSupportCopy: 'If QuartzLab saved time on a project, Boosty support helps keep releases free and maintenance focused.',
    footerSupportLabel: 'Support the next release',
    githubDownloads: 'GitHub downloads',
    installText: 'Open the latest published GitHub release, download the package archive, extract it, then use Add package from disk in Unity Package Manager and select package.json.',
    installation: 'Installation',
    languageLabel: 'Language',
    license: 'License',
    mediaImage: 'Screenshot',
    mediaVideo: 'Video',
    minimumUnity: 'Minimum Unity',
    navLabel: 'Main navigation',
    plugins: 'Plugins',
    releases: 'Latest release',
    source: 'Source code',
    support: 'Support',
    supportButton: 'Support on Boosty',
    supportProject: 'Support QuartzLab',
    themeLabel: 'Toggle color theme',
    version: 'Version',
    freeNote: 'Free and open source',
    freeNoteText: 'QuartzLab plugins stay free. You can inspect the source, review the license, and support future maintenance only if you want to.',
  },
  ru: {
    about: 'О проекте',
    aboutPlugin: 'О плагине',
    assetStore: 'Asset Store',
    documentation: 'Документация',
    features: 'Возможности',
    footerCatalog: 'Метаданные каталога поддерживаются в актуальном состоянии автоматической синхронизацией с GitHub Releases',
    footerCatalogLink: 'Каталог Unity-плагинов',
    footerDescription: 'Независимые Unity Editor-инструменты с предсказуемыми изменениями файлов, открытым кодом и документацией на двух языках.',
    footerAboutLink: 'О QuartzLab',
    footerSupportCopy: 'Если QuartzLab сэкономил время в проекте, поддержка на Boosty помогает оставлять плагины бесплатными и не раздувать их лишними системами.',
    footerSupportLabel: 'Поддержать следующий релиз',
    githubDownloads: 'Скачиваний на GitHub',
    installText: 'Открой последний опубликованный релиз на GitHub, скачай архив пакета, распакуй его и в Unity Package Manager выбери Add package from disk, указав package.json.',
    installation: 'Установка',
    languageLabel: 'Язык',
    license: 'Лицензия',
    mediaImage: 'Скриншот',
    mediaVideo: 'Видео',
    minimumUnity: 'Минимальная Unity',
    navLabel: 'Главная навигация',
    plugins: 'Плагины',
    releases: 'Последний релиз',
    source: 'Исходный код',
    support: 'Поддержать',
    supportButton: 'Поддержать на Boosty',
    supportProject: 'Поддержать QuartzLab',
    themeLabel: 'Переключить цветовую тему',
    version: 'Версия',
    freeNote: 'Бесплатно и с открытым кодом',
    freeNoteText: 'Плагины QuartzLab остаются бесплатными. Код и лицензии открыты, а поддержка проекта всегда остаётся добровольной.',
  },
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[character]));
}

function escapeXml(value) {
  return escapeHtml(value);
}

function siteUrl(pathname) {
  return `${SITE_ORIGIN}${pathname}`;
}

function localizedPlugin(plugin, language) {
  return {
    ...plugin,
    ...plugin.i18n[language],
    categoryLabel: plugin.category[language],
  };
}

function themeToggle(language) {
  const ui = UI[language];
  return `<button class="theme-toggle" type="button" data-theme-toggle aria-label="${escapeHtml(ui.themeLabel)}" aria-pressed="false">
          <span class="theme-toggle-icons" aria-hidden="true">
            <svg class="theme-icon theme-icon-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"></circle><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"></path></svg>
            <svg class="theme-icon theme-icon-moon" viewBox="0 0 24 24"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z"></path></svg>
          </span>
          <span class="sr-only" data-theme-status></span>
        </button>`;
}

function siteHeader(language, { active = '', slug = '' } = {}) {
  const ui = UI[language];
  const alternate = language === 'en' ? 'ru' : 'en';
  const route = active === 'docs'
    ? lang => `/${lang}/docs/${encodeURIComponent(slug)}/`
    : active === 'plugins' && slug
      ? lang => `/${lang}/plugins/${encodeURIComponent(slug)}/`
      : lang => `/${lang}/`;

  return `<header class="site-header">
    <div class="shell header-inner">
      <a class="brand" href="/${language}/" aria-label="QuartzLab ${language === 'ru' ? '— главная' : 'home'}">
        <img src="/assets/quartzlab-mark.svg" alt="">
        <span>Quartz<span>Lab</span></span>
      </a>
      <nav class="main-nav" aria-label="${escapeHtml(ui.navLabel)}">
        <a${active === 'plugins' ? ' class="active" aria-current="page"' : ''} href="/${language}/#plugins">${ui.plugins}</a>
        <a href="/${language}/about/">${ui.about}</a>
      </nav>
      <div class="header-actions">
        <div class="language-switch" aria-label="${escapeHtml(ui.languageLabel)}">
          <a data-language="ru"${language === 'ru' ? ' class="active" aria-current="true"' : ''} href="${route('ru')}">RU</a>
          <a data-language="en"${language === 'en' ? ' class="active" aria-current="true"' : ''} href="${route('en')}">EN</a>
        </div>
        ${themeToggle(language)}
        <a class="header-support" data-support-link data-support-place="${active === 'docs' ? 'docs-header' : 'plugin-header'}" href="https://boosty.to/quartzlab">${ui.support}</a>
      </div>
    </div>
  </header>`;
}

export function siteFooter(language, supportPlace = 'page-footer') {
  const ui = UI[language];
  const year = new Date().getUTCFullYear();
  return `<footer class="site-footer">
    <div class="shell footer-main">
      <div>
        <a class="brand footer-brand" href="/${language}/">
          <img src="/assets/quartzlab-mark.svg" alt="">
          <span>Quartz<span>Lab</span></span>
        </a>
        <p>${ui.footerDescription}</p>
        <nav class="footer-links" aria-label="${language === 'ru' ? 'Навигация в подвале' : 'Footer navigation'}">
          <a href="/${language}/#plugins">${ui.footerCatalogLink}</a>
          <a href="/${language}/about/">${ui.footerAboutLink}</a>
        </nav>
      </div>
      <div class="support-block">
        <span>${ui.footerSupportLabel}</span>
        <p>${ui.footerSupportCopy}</p>
        <a class="support-button" data-support-link data-support-place="${escapeHtml(supportPlace)}" href="https://boosty.to/quartzlab">${ui.supportButton}</a>
      </div>
    </div>
    <div class="shell footer-bottom">
      <span>© ${year} QuartzLab</span>
      <span>${ui.footerCatalog}</span>
    </div>
  </footer>`;
}

function seoMarkup({ language, pathname, alternatePath, title, description, image = '/assets/quartzlab-mark.svg', type = 'website' }) {
  const canonical = siteUrl(pathname);
  const alternateLanguage = language === 'en' ? 'ru' : 'en';
  return `<link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="alternate" hreflang="${language}" href="${escapeHtml(canonical)}">
  <link rel="alternate" hreflang="${alternateLanguage}" href="${escapeHtml(siteUrl(alternatePath))}">
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(siteUrl(language === 'en' ? pathname : alternatePath))}">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="QuartzLab">
  <meta property="og:locale" content="${language === 'ru' ? 'ru_RU' : 'en_US'}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(siteUrl(image))}">
  <meta name="twitter:card" content="summary_large_image">`;
}

function youtubeId(url) {
  const match = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/i);
  return match ? match[1] : '';
}

function mediaElement(item, plugin, language, autoplay = false) {
  if (item.type === 'youtube') {
    const id = youtubeId(item.url);
    if (!id) return '';
    const query = autoplay ? '?autoplay=1' : '';
    return `<iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(id)}${query}" title="${escapeHtml(item.title?.[language] || plugin.name)}" allow="${autoplay ? 'autoplay; ' : ''}accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  }
  if (item.type === 'video') {
    return `<video controls${autoplay ? ' autoplay' : ''} preload="metadata" poster="${escapeHtml(item.poster || plugin.cover || '')}"><source src="${escapeHtml(item.src)}"></video>`;
  }
  return `<img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt?.[language] || plugin.name)}">`;
}

function pluginMedia(plugin, language) {
  const ui = UI[language];
  const fallback = [{ type: 'image', src: plugin.cover, alt: { en: plugin.name, ru: plugin.name } }];
  const media = plugin.media?.length ? plugin.media : fallback;
  const thumbs = media.map((item, index) => {
    const id = item.type === 'youtube' ? youtubeId(item.url) : '';
    const preview = id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : (item.poster || item.src || plugin.cover);
    const label = item.type === 'image' ? ui.mediaImage : ui.mediaVideo;
    return `<button class="media-thumb${index === 0 ? ' active' : ''}" type="button" data-media-index="${index}" data-media-type="${escapeHtml(item.type || 'image')}" data-media-src="${escapeHtml(item.src || item.url || '')}" data-media-poster="${escapeHtml(item.poster || plugin.cover || '')}" data-media-title="${escapeHtml(item.title?.[language] || item.alt?.[language] || plugin.name)}" aria-label="${escapeHtml(`${label} ${index + 1}`)}"><img src="${escapeHtml(preview)}" alt=""><span>${item.type === 'image' ? '▧' : '▶'}</span></button>`;
  }).join('');
  return `<div id="heroMedia" class="hero-media">${mediaElement(media[0], plugin, language)}</div><div class="media-thumbs">${thumbs}</div>`;
}

function actionLink(url, label, className = 'secondary-button', external = true) {
  if (!url) return '';
  return `<a class="${className}" href="${escapeHtml(url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(label)}${external ? ' ↗' : ''}</a>`;
}

export function renderPluginPage(pluginRecord, downloads, language) {
  const plugin = localizedPlugin(pluginRecord, language);
  const ui = UI[language];
  const pathname = `/${language}/plugins/${plugin.slug}/`;
  const alternateLanguage = language === 'en' ? 'ru' : 'en';
  const alternatePath = `/${alternateLanguage}/plugins/${plugin.slug}/`;
  const title = `${plugin.name} — QuartzLab`;
  const features = plugin.features.map(feature => `<li>${escapeHtml(feature)}</li>`).join('');
  const actions = [
    actionLink(plugin.releaseUrl, ui.releases, 'download-button'),
    plugin.documentationAvailable ? actionLink(`/${language}/docs/${plugin.slug}/`, ui.documentation, 'secondary-button', false) : '',
    actionLink(plugin.repositoryUrl, ui.source),
    actionLink(plugin.assetStoreUrl, ui.assetStore),
  ].join('');
  const count = new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US').format(Number(downloads) || 0);

  return `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="${escapeHtml(plugin.subtitle)}">
  <title>${escapeHtml(title)}</title>
  ${seoMarkup({ language, pathname, alternatePath, title, description: plugin.subtitle, image: plugin.cover })}
  <link rel="icon" href="/assets/quartzlab-mark.svg" type="image/svg+xml">
  ${themeInitMarkup()}
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  ${siteHeader(language, { active: 'plugins', slug: plugin.slug })}
  <main class="shell plugin-page">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/${language}/">QuartzLab</a><span>/</span><a href="/${language}/#plugins">${ui.plugins}</a><span>/</span><span aria-current="page">${escapeHtml(plugin.name)}</span>
    </nav>
    <section class="plugin-hero">
      <div class="plugin-gallery">${pluginMedia(plugin, language)}</div>
      <aside class="plugin-summary">
        <span class="detail-category">${escapeHtml(plugin.categoryLabel)}</span>
        <h1>${escapeHtml(plugin.name)}</h1>
        <p class="plugin-lead">${escapeHtml(plugin.subtitle)}</p>
        <div class="detail-meta">
          <div class="meta-row"><span>${ui.version}</span><strong>${escapeHtml(plugin.version)}</strong></div>
          <div class="meta-row"><span>${ui.minimumUnity}</span><strong>${escapeHtml(plugin.unityVersion)}</strong></div>
          <div class="meta-row"><span>${ui.license}</span><strong>${escapeHtml(plugin.license)}</strong></div>
          <div class="meta-row"><span>${ui.githubDownloads}</span><strong>↓ ${count}</strong></div>
          <div class="meta-row"><span>${language === 'ru' ? 'Дата релиза' : 'Release date'}</span><strong><time datetime="${escapeHtml(plugin.updatedAt)}">${escapeHtml(plugin.updatedAt)}</time></strong></div>
        </div>
        <div class="plugin-actions">${actions}</div>
      </aside>
    </section>
    <section class="plugin-content">
      <div class="content-main">
        <section><h2>${ui.aboutPlugin}</h2><p>${escapeHtml(plugin.description)}</p></section>
        <section><h2>${ui.features}</h2><ul class="feature-list">${features}</ul></section>
        <section><h2>${ui.installation}</h2><p>${escapeHtml(ui.installText)}</p></section>
        ${plugin.documentationAvailable ? `<section class="docs-callout"><h2>${ui.documentation}</h2><p>${language === 'ru' ? 'Полная веб-документация синхронизируется с папкой Documentation~ последнего опубликованного релиза.' : 'The complete web documentation is synchronized from the Documentation~ folder of the latest published release.'}</p><a href="/${language}/docs/${plugin.slug}/">${ui.documentation} →</a></section>` : ''}
      </div>
      <aside class="detail-side"><div class="detail-side-note"><h3>${ui.freeNote}</h3><p>${ui.freeNoteText}</p><a data-support-link data-support-place="plugin-side-note" href="https://boosty.to/quartzlab">${ui.supportProject} →</a></div></aside>
    </section>
  </main>
  ${siteFooter(language, 'plugin-footer')}
  <script src="/site.js" defer></script>
  <script src="/plugin-gallery.js" defer></script>
</body>
</html>
`;
}

function rewriteDocumentationAssetUrls(html, language, slug) {
  const base = `/generated-docs/${encodeURIComponent(language)}/${encodeURIComponent(slug)}/`;
  return html.replace(/\b(src|href)\s*=\s*(["'])([^"']+)\2/gi, (match, attribute, quote, value) => {
    if (/^(?:[a-z][a-z\d+.-]*:|\/|#|\?|data:)/i.test(value)) return match;
    const normalized = path.posix.normalize(value).replace(/^(?:\.\/)+/, '').replace(/^\.\.\//, '');
    return `${attribute}=${quote}${base}${normalized}${quote}`;
  });
}

function replaceHeadMetadata(html, { language, plugin }) {
  const ui = UI[language];
  const pathname = `/${language}/docs/${plugin.slug}/`;
  const alternateLanguage = language === 'en' ? 'ru' : 'en';
  const alternatePath = `/${alternateLanguage}/docs/${plugin.slug}/`;
  const title = language === 'ru'
    ? `${plugin.name} — документация QuartzLab`
    : `${plugin.name} Documentation — QuartzLab`;
  const description = language === 'ru'
    ? `Документация ${plugin.name}: ${plugin.subtitle}`
    : `${plugin.name} documentation: ${plugin.subtitle}`;
  let output = html
    .replace('<script src="/theme.js"></script>', themeInitMarkup())
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace(/<link\s+rel=["'](?:canonical|alternate)["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+property=["']og:[^>]+>\s*/gi, '')
    .replace(/<meta\s+name=["']twitter:[^>]+>\s*/gi, '');
  const additions = `${seoMarkup({ language, pathname, alternatePath, title, description })}
  <link rel="icon" href="/assets/quartzlab-mark.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">`;
  output = output.replace('</head>', `  ${additions}\n</head>`);
  return output;
}

function addBodyClass(html, className) {
  return html.replace(/<body\b([^>]*)>/i, (_match, attributes) => {
    if (/\bclass\s*=/.test(attributes)) {
      return `<body${attributes.replace(/\bclass\s*=\s*(["'])(.*?)\1/i, (_classMatch, quote, classes) => `class=${quote}${classes} ${className}${quote}`)}>`;
    }
    return `<body${attributes} class="${className}">`;
  });
}

export function renderDocumentationPage(pluginRecord, language, sourceHtml) {
  const plugin = localizedPlugin(pluginRecord, language);
  let output = String(sourceHtml)
    .replace(/\bclass\s*=\s*(["'])([^"']*\bbrand\b[^"']*)\1/gi, (_match, quote, classes) => `class=${quote}${classes.replace(/\bbrand\b/g, 'documentation-brand')}${quote}`);
  output = rewriteDocumentationAssetUrls(output, language, plugin.slug);
  output = replaceHeadMetadata(output, { language, plugin });
  output = addBodyClass(output, 'web-documentation-page');
  output = output.replace(/<body\b([^>]*)>/i, match => `${match}\n  ${siteHeader(language, { active: 'docs', slug: plugin.slug })}`);
  output = output.replace('</body>', `  ${siteFooter(language, 'docs-footer')}\n  <script src="/site.js" defer></script>\n</body>`);
  return `${output.trim()}\n`;
}

function sitemapEntry(pathname, alternatePath, lastModified = '') {
  const language = pathname.split('/').filter(Boolean)[0];
  const alternateLanguage = language === 'en' ? 'ru' : 'en';
  const defaultPath = language === 'en' ? pathname : alternatePath;
  return `  <url>
    <loc>${escapeXml(siteUrl(pathname))}</loc>
${lastModified ? `    <lastmod>${escapeXml(lastModified)}</lastmod>\n` : ''}    <xhtml:link rel="alternate" hreflang="${language}" href="${escapeXml(siteUrl(pathname))}" />
    <xhtml:link rel="alternate" hreflang="${alternateLanguage}" href="${escapeXml(siteUrl(alternatePath))}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(siteUrl(defaultPath))}" />
  </url>`;
}

export function renderSitemap(plugins) {
  const entries = [
    sitemapEntry('/en/', '/ru/'),
    sitemapEntry('/ru/', '/en/'),
    sitemapEntry('/en/about/', '/ru/about/'),
    sitemapEntry('/ru/about/', '/en/about/'),
  ];
  for (const plugin of plugins) {
    entries.push(sitemapEntry(`/en/plugins/${plugin.slug}/`, `/ru/plugins/${plugin.slug}/`, plugin.updatedAt));
    entries.push(sitemapEntry(`/ru/plugins/${plugin.slug}/`, `/en/plugins/${plugin.slug}/`, plugin.updatedAt));
    if (plugin.documentationAvailable) {
      entries.push(sitemapEntry(`/en/docs/${plugin.slug}/`, `/ru/docs/${plugin.slug}/`, plugin.updatedAt));
      entries.push(sitemapEntry(`/ru/docs/${plugin.slug}/`, `/en/docs/${plugin.slug}/`, plugin.updatedAt));
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`;
}

export function renderRobotsTxt() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl('/sitemap.xml')}\n`;
}

export const siteOrigin = SITE_ORIGIN;
