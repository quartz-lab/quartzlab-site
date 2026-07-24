import { createHash } from 'node:crypto';
import path from 'node:path';

import {
  applyBasePathToHtml,
  canonicalUrl,
  DEFAULT_SITE_BASE_PATH,
  DEFAULT_SITE_ORIGIN,
  normalizeBasePath,
  normalizeSiteOrigin,
} from './site-paths.mjs';
import { DEFAULT_SITE_CONFIG } from './site-config.mjs';

export const THEME_INIT_SCRIPT = '(()=>{let t;try{t=localStorage.getItem("quartzlab-theme")}catch{}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t})();';
const COPYRIGHT_YEAR = 2026;

const UI = {
  en: {
    about: 'About', aboutPlugin: 'About the plugin', assetStore: 'Asset Store', documentation: 'Documentation',
    features: 'Features', footerCatalog: 'Catalog is automatically synced with published GitHub releases',
    footerCatalogLink: 'Unity plugin catalog', footerDescription: 'Free Unity Editor open-source tools',
    footerAboutLink: 'About QuartzLab', footerSupportCopy: 'If QuartzLab saved time in your project, support on Boosty will speed up the development of new plugins.',
    footerSupportLabel: 'Support the next release', githubDownloads: 'GitHub downloads',
    installText: 'Open the latest published GitHub release, download the package archive, extract it, then use Add package from disk in Unity Package Manager and select package.json.',
    installation: 'Installation', languageLabel: 'Language', license: 'License', mediaImage: 'Screenshot', mediaVideo: 'Video',
    mediaOpen: 'Open image full screen', mediaClose: 'Close full-screen image', mediaPrevious: 'Previous image', mediaNext: 'Next image',
    mediaDialog: 'Full-screen image viewer', mediaPlay: 'Play video', minimumUnity: 'Minimum Unity', navLabel: 'Main navigation',
    plugins: 'Plugins', releases: 'Latest release', source: 'Source code', support: 'Support', supportButton: 'Support on Boosty',
    supportProject: 'Support QuartzLab', themeLabel: 'Toggle color theme', version: 'Version', freeNote: 'Free and open source',
    freeNoteText: 'QuartzLab plugins stay free. You can inspect the source, review the license, and support future maintenance only if you want to.',
  },
  ru: {
    about: 'О проекте', aboutPlugin: 'О плагине', assetStore: 'Asset Store', documentation: 'Документация',
    features: 'Возможности', footerCatalog: 'Каталог автоматически синхронизируются с опубликованными релизами GitHub',
    footerCatalogLink: 'Каталог Unity-плагинов', footerDescription: 'Бесплатные Unity Editor-инструменты с открытым кодом',
    footerAboutLink: 'О QuartzLab', footerSupportCopy: 'Если QuartzLab сэкономил время в вашем проекте, поддержка на Boosty ускорит разработку новых плагинов.',
    footerSupportLabel: 'Поддержать следующий релиз', githubDownloads: 'Скачиваний на GitHub',
    installText: 'Открой последний опубликованный релиз на GitHub, скачай архив пакета, распакуй его и в Unity Package Manager выбери Add package from disk, указав package.json.',
    installation: 'Установка', languageLabel: 'Язык', license: 'Лицензия', mediaImage: 'Скриншот', mediaVideo: 'Видео',
    mediaOpen: 'Открыть изображение на весь экран', mediaClose: 'Закрыть полноэкранное изображение', mediaPrevious: 'Предыдущее изображение', mediaNext: 'Следующее изображение',
    mediaDialog: 'Полноэкранный просмотр изображения', mediaPlay: 'Воспроизвести видео', minimumUnity: 'Минимальная Unity', navLabel: 'Главная навигация',
    plugins: 'Плагины', releases: 'Последний релиз', source: 'Исходный код', support: 'Поддержать', supportButton: 'Поддержать на Boosty',
    supportProject: 'Поддержать QuartzLab', themeLabel: 'Переключить цветовую тему', version: 'Версия', freeNote: 'Бесплатно и с открытым кодом',
    freeNoteText: 'Плагины QuartzLab остаются бесплатными. Код и лицензии открыты, а поддержка проекта всегда остаётся добровольной.',
  },
};

function options(value = {}) {
  const brand = { ...DEFAULT_SITE_CONFIG.brand, ...(value.brand || {}) };
  return {
    siteOrigin: normalizeSiteOrigin(value.siteOrigin || brand.origin || DEFAULT_SITE_ORIGIN),
    basePath: normalizeBasePath(value.basePath || DEFAULT_SITE_BASE_PATH),
    brand,
    socials: { ...DEFAULT_SITE_CONFIG.socials, ...(value.socials || {}) },
  };
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));
}

function sha256Base64(value) {
  return createHash('sha256').update(value, 'utf8').digest('base64');
}

function jsonLd({ title, description, pathname, image = '/assets/quartzlab-mark.svg', siteOrigin, brandName }) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: canonicalUrl(pathname, siteOrigin),
    primaryImageOfPage: canonicalUrl(image, siteOrigin),
    isPartOf: { '@type': 'WebSite', name: brandName, url: canonicalUrl('/', siteOrigin) },
  });
}

function securityMeta(inlineScripts = []) {
  const hashes = inlineScripts.map(script => `'sha256-${sha256Base64(script)}'`).join(' ');
  const scriptSource = [`'self'`, hashes].filter(Boolean).join(' ');
  const policy = [
    "default-src 'self'", `script-src ${scriptSource}`, "style-src 'self'", "img-src 'self' data: https://i.ytimg.com",
    "media-src 'self'", 'frame-src https://www.youtube-nocookie.com', "font-src 'self'", "connect-src 'none'",
    "object-src 'none'", "base-uri 'none'", "form-action 'self'",
  ].join('; ');
  return `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(policy)}">
  <meta name="referrer" content="strict-origin-when-cross-origin">`;
}

function themeInitMarkup() {
  return `<script>${THEME_INIT_SCRIPT}</script>`;
}

function seoMarkup({ language, pathname, alternatePath, title, description, image = '/assets/quartzlab-mark.svg', type = 'website', siteOrigin, brandName }) {
  const canonical = canonicalUrl(pathname, siteOrigin);
  const alternateLanguage = language === 'en' ? 'ru' : 'en';
  const defaultPath = language === 'en' ? pathname : alternatePath;
  return `<link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="alternate" hreflang="${language}" href="${escapeHtml(canonical)}">
  <link rel="alternate" hreflang="${alternateLanguage}" href="${escapeHtml(canonicalUrl(alternatePath, siteOrigin))}">
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(canonicalUrl(defaultPath, siteOrigin))}">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="${escapeHtml(brandName)}">
  <meta property="og:locale" content="${language === 'ru' ? 'ru_RU' : 'en_US'}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(canonicalUrl(image, siteOrigin))}">
  <meta name="twitter:card" content="summary_large_image">`;
}

function pageHead({ language, pathname, alternatePath, title, description, image, type, renderOptions }) {
  const opts = options(renderOptions);
  const structuredData = jsonLd({ title, description, pathname, image, siteOrigin: opts.siteOrigin, brandName: opts.brand.name });
  return `<meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${securityMeta([THEME_INIT_SCRIPT, structuredData])}
  <meta name="description" content="${escapeHtml(description)}">
  <title>${escapeHtml(title)}</title>
  ${seoMarkup({ language, pathname, alternatePath, title, description, image, type, siteOrigin: opts.siteOrigin, brandName: opts.brand.name })}
  <link rel="icon" href="/assets/quartzlab-mark.svg" type="image/svg+xml">
  ${themeInitMarkup()}
  <link rel="stylesheet" href="/styles.css">
  <script type="application/ld+json">${structuredData}</script>`;
}

function finalize(html, renderOptions) {
  const opts = options(renderOptions);
  return `${applyBasePathToHtml(String(html).trim(), opts.basePath)}\n`;
}

function localizedPlugin(plugin, language) {
  return { ...plugin, ...plugin.i18n[language], categoryLabel: plugin.category[language] };
}

function themeToggle(language) {
  return `<button class="theme-toggle" type="button" data-theme-toggle aria-label="${escapeHtml(UI[language].themeLabel)}" aria-pressed="false">
          <span class="theme-toggle-icons" aria-hidden="true">
            <svg class="theme-icon theme-icon-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"></circle><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"></path></svg>
            <svg class="theme-icon theme-icon-moon" viewBox="0 0 24 24"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z"></path></svg>
          </span><span class="sr-only" data-theme-status></span>
        </button>`;
}

function brandWordmark(name) {
  const match = String(name).match(/^(.*?)(Lab)$/);
  return match ? `${escapeHtml(match[1])}<span>${escapeHtml(match[2])}</span>` : escapeHtml(name);
}

function supportAnchor(renderOptions, className, label) {
  const url = options(renderOptions).socials.boosty;
  return url ? `<a class="${className}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>` : '';
}

export function siteHeader(language, { active = '', slug = '' } = {}, renderOptions = {}) {
  const ui = UI[language];
  const opts = options(renderOptions);
  const route = active === 'docs'
    ? lang => `/${lang}/docs/${encodeURIComponent(slug)}/`
    : active === 'plugins' && slug
      ? lang => `/${lang}/plugins/${encodeURIComponent(slug)}/`
      : active === 'about'
        ? lang => `/${lang}/about/`
        : lang => `/${lang}/`;
  return `<header class="site-header">
    <div class="shell header-inner">
      <a class="brand" href="/${language}/" aria-label="${escapeHtml(opts.brand.name)} ${language === 'ru' ? '— главная' : 'home'}"><img src="/assets/quartzlab-mark.svg" alt=""><span>${brandWordmark(opts.brand.name)}</span></a>
      <nav class="main-nav" aria-label="${escapeHtml(ui.navLabel)}">
        <a${active === 'plugins' ? ' class="active" aria-current="page"' : ''} href="/${language}/#plugins">${ui.plugins}</a>
        <a${active === 'about' ? ' class="active" aria-current="page"' : ''} href="/${language}/about/">${ui.about}</a>
      </nav>
      <div class="header-actions">
        <div class="language-switch" aria-label="${escapeHtml(ui.languageLabel)}">
          <a data-language="ru"${language === 'ru' ? ' class="active" aria-current="true"' : ''} href="${route('ru')}">RU</a>
          <a data-language="en"${language === 'en' ? ' class="active" aria-current="true"' : ''} href="${route('en')}">EN</a>
        </div>
        ${themeToggle(language)}
        ${supportAnchor(renderOptions, 'header-support', ui.support)}
      </div>
    </div>
  </header>`;
}

export function siteFooter(language, renderOptions = {}) {
  const ui = UI[language];
  const opts = options(renderOptions);
  return `<footer class="site-footer">
    <div class="shell footer-main">
      <div>
        <a class="brand footer-brand" href="/${language}/"><img src="/assets/quartzlab-mark.svg" alt=""><span>${brandWordmark(opts.brand.name)}</span></a>
        <p>${ui.footerDescription}</p>
        <nav class="footer-links" aria-label="${language === 'ru' ? 'Навигация в подвале' : 'Footer navigation'}"><a href="/${language}/#plugins">${ui.footerCatalogLink}</a><a href="/${language}/about/">${ui.footerAboutLink}</a></nav>
      </div>
      <div class="support-block"><span>${ui.footerSupportLabel}</span><p>${ui.footerSupportCopy}</p>${supportAnchor(renderOptions, 'support-button', ui.supportButton)}</div>
    </div>
    <div class="shell footer-bottom"><span>© ${COPYRIGHT_YEAR} ${escapeHtml(opts.brand.name)}</span><span>${ui.footerCatalog}</span></div>
  </footer>`;
}

function formatCount(value, language) {
  return new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US').format(Number(value) || 0);
}

function catalogCard(pluginRecord, count, language) {
  const plugin = localizedPlugin(pluginRecord, language);
  const search = [plugin.name, plugin.subtitle, plugin.description, plugin.categoryLabel, ...(plugin.tags || [])].join(' ').toLocaleLowerCase(language);
  const href = `/${language}/plugins/${encodeURIComponent(plugin.slug)}/`;
  return `<article class="product-card" data-plugin-card data-name="${escapeHtml(plugin.name)}" data-search="${escapeHtml(search)}" data-category="${escapeHtml(plugin.categoryLabel)}" data-unity="${escapeHtml(plugin.unityVersion)}" data-featured="${plugin.featured ? '1' : '0'}" data-updated="${escapeHtml(plugin.updatedAt)}" data-downloads="${Number(count) || 0}">
          <a class="product-cover" href="${href}"><img src="${escapeHtml(plugin.cover)}" alt="${escapeHtml(`${plugin.name} — ${language === 'ru' ? 'обложка плагина' : 'plugin cover'}`)}" loading="lazy"><span class="free-badge">${language === 'ru' ? 'БЕСПЛАТНО' : 'FREE'}</span></a>
          <div class="product-info"><a class="product-title" href="${href}">${escapeHtml(plugin.name)}</a><p class="product-description">${escapeHtml(plugin.subtitle)}</p><div class="product-meta"><span class="product-category">${escapeHtml(plugin.categoryLabel)}</span><span class="product-downloads">↓ ${formatCount(count, language)}</span><span class="product-version">v${escapeHtml(plugin.version)}</span></div></div>
        </article>`;
}

export function renderHomePage(pluginRecords, downloads, language, renderOptions = {}) {
  const isRu = language === 'ru';
  const pathname = `/${language}/`;
  const alternatePath = `/${isRu ? 'en' : 'ru'}/`;
  const title = isRu ? 'QuartzLab — плагины для Unity Editor' : 'QuartzLab — Unity Editor plugins';
  const description = isRu ? 'Компактные плагины QuartzLab для Unity Editor с данными из последних опубликованных GitHub-релизов.' : 'Focused Unity Editor plugins by QuartzLab, synced from published GitHub releases.';
  const categories = [...new Set(pluginRecords.map(plugin => plugin.category[language]))].sort((a, b) => a.localeCompare(b, language));
  const cards = pluginRecords.map(plugin => catalogCard(plugin, downloads[plugin.slug], language)).join('\n');
  const countLabel = isRu
    ? `${pluginRecords.length} ${pluginRecords.length === 1 ? 'плагин' : pluginRecords.length < 5 ? 'плагина' : 'плагинов'} — все бесплатные`
    : `${pluginRecords.length} ${pluginRecords.length === 1 ? 'plugin' : 'plugins'} — all free`;
  const categoryButton = (value, label, count) => `<button class="filter-button${value === '__all' ? ' active' : ''}" type="button" data-category="${escapeHtml(value)}"><span>${escapeHtml(label)}</span><b>${count}</b></button>`;
  const mobileButton = (value, label) => `<button class="${value === '__all' ? 'active' : ''}" type="button" data-category="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
  const categoryControls = [categoryButton('__all', isRu ? 'Все' : 'All', pluginRecords.length), ...categories.map(category => categoryButton(category, category, pluginRecords.filter(plugin => plugin.category[language] === category).length))].join('');
  const mobileControls = [mobileButton('__all', isRu ? 'Все' : 'All'), ...categories.map(category => mobileButton(category, category))].join('');
  return finalize(`<!doctype html>
<html lang="${language}" data-site-base-path="${escapeHtml(options(renderOptions).basePath)}">
<head>${pageHead({ language, pathname, alternatePath, title, description, renderOptions })}</head>
<body>
  ${siteHeader(language, { active: 'plugins' }, renderOptions)}
  <main>
    <section class="intro"><div class="hero-grid" aria-hidden="true"></div><div class="shell intro-layout"><div class="intro-inner"><p class="eyebrow">Unity Editor Tools</p><h1>${isRu ? 'Меньше рутины.<br>Больше времени на игру.' : 'Less busywork.<br>More time for your game.'}</h1><p class="intro-copy">${isRu ? 'Небольшие бесплатные плагины QuartzLab для задач, которые Unity заставляет делать слишком долго.' : 'Small, free QuartzLab plugins for the tasks Unity makes take too long.'}</p></div><div class="hero-mark" aria-hidden="true"><div class="mark-orbit"></div><img src="/assets/quartzlab-mark.svg" alt=""></div></div></section>
    <section class="catalog" id="plugins"><div class="shell catalog-shell">
      <div class="catalog-heading"><div><h2>${isRu ? 'Все плагины' : 'All plugins'}</h2><p id="catalogCount">${countLabel}</p></div><label class="search-box"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg><input id="searchInput" type="search" placeholder="${isRu ? 'Поиск плагинов' : 'Search plugins'}" autocomplete="off"></label></div>
      <div class="catalog-layout"><aside class="filters" aria-label="${isRu ? 'Фильтры каталога' : 'Catalog filters'}"><div class="filter-section"><h3>${isRu ? 'Категория' : 'Category'}</h3><div id="categoryFilters" class="filter-list">${categoryControls}</div></div><div class="filter-section compact"><h3>${isRu ? 'Совместимость' : 'Compatibility'}</h3><label class="check-row"><input id="ltsOnly" type="checkbox"><span>Unity 2022.3+</span></label></div><button id="resetFilters" class="text-button" type="button" hidden>${isRu ? 'Сбросить фильтры' : 'Reset filters'}</button></aside>
        <div class="catalog-main"><div class="catalog-toolbar"><div class="mobile-filter-row" id="mobileFilters">${mobileControls}</div><label class="sort-control"><span>${isRu ? 'Сортировка' : 'Sort'}</span><select id="sortSelect"><option value="featured">${isRu ? 'Рекомендуемые' : 'Featured'}</option><option value="popular">${isRu ? 'Популярные' : 'Popular'}</option><option value="newest">${isRu ? 'Сначала новые' : 'Newest'}</option><option value="name">${isRu ? 'По названию' : 'Name'}</option></select></label></div>
          <div id="pluginGrid" class="product-grid" aria-live="polite">${cards}</div><div id="emptyState" class="empty-state" hidden><strong>${isRu ? 'Ничего не найдено' : 'Nothing found'}</strong><span>${isRu ? 'Попробуй другую категорию или запрос.' : 'Try another category or search query.'}</span><button id="emptyReset" class="small-button" type="button">${isRu ? 'Сбросить фильтры' : 'Reset filters'}</button></div></div></div>
    </div></section>
  </main>
  ${siteFooter(language, renderOptions)}
  <script src="/site.js" defer></script><script src="/catalog-interactions.js" defer></script>
</body></html>`, renderOptions);
}

const SOCIAL_ICONS = {
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.12-1.47-1.12-1.47-.91-.62.07-.61.07-.61 1 .07 1.54 1.03 1.54 1.03.9 1.54 2.35 1.1 2.92.83.09-.65.35-1.1.64-1.35-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.28.1-2.66 0 0 .84-.27 2.75 1.02a9.59 9.59 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.41.1 2.66.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.93.36.31.68.92.68 1.86v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23.5 6.2a3.1 3.1 0 0 0-2.18-2.2C19.4 3.5 12 3.5 12 3.5s-7.4 0-9.32.5A3.1 3.1 0 0 0 .5 6.2 32.4 32.4 0 0 0 0 12a32.4 32.4 0 0 0 .5 5.8 3.1 3.1 0 0 0 2.18 2.2c1.92.5 9.32.5 9.32.5s7.4 0 9.32-.5a3.1 3.1 0 0 0 2.18-2.2A32.4 32.4 0 0 0 24 12a32.4 32.4 0 0 0-.5-5.8ZM9.6 15.7V8.3l6.4 3.7-6.4 3.7Z"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m21.3 4.6-3 14.2c-.23 1-.84 1.24-1.7.77l-4.7-3.45-2.27 2.18c-.25.25-.47.47-.95.47l.34-4.82 8.78-7.93c.38-.34-.08-.54-.59-.2l-10.86 6.84-4.67-1.46c-1.01-.32-1.03-1.01.22-1.5L19.5 3.1c.83-.31 1.55.2 1.8 1.5Z"/></svg>',
  boosty: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8.1 2h8.2l-1.5 7h3.6L9.2 22l1.7-9H5.6L8.1 2Zm2.2 3-1.2 5h5.5l.8-1.2h-4.2l.8-3.8h-1.7Z"/></svg>',
};
const SOCIAL_LABELS = { github: 'GitHub', youtube: 'YouTube', telegram: 'Telegram', boosty: 'Boosty' };

function socialLinks(renderOptions) {
  const socials = options(renderOptions).socials;
  return Object.entries(SOCIAL_ICONS).flatMap(([name, icon]) => socials[name]
    ? [`<a class="project-social-link" data-social="${name}" href="${escapeHtml(socials[name])}" target="_blank" rel="noopener noreferrer">${icon}<span>${SOCIAL_LABELS[name]}</span></a>`]
    : []).join('\n        ');
}

export function renderAboutPage(language, renderOptions = {}) {
  const isRu = language === 'ru';
  const pathname = `/${language}/about/`;
  const alternatePath = `/${isRu ? 'en' : 'ru'}/about/`;
  const title = isRu ? 'О QuartzLab' : 'About QuartzLab';
  const description = isRu ? 'О QuartzLab, его подходе к Unity Editor-инструментам, обратной связи и поддержке.' : 'About QuartzLab, its approach to Unity Editor tools, feedback channels, and support links.';
  return finalize(`<!doctype html><html lang="${language}" data-site-base-path="${escapeHtml(options(renderOptions).basePath)}"><head>${pageHead({ language, pathname, alternatePath, title, description, renderOptions })}</head><body>
  ${siteHeader(language, { active: 'about' }, renderOptions)}
  <main class="shell project-page"><section class="project-hero"><div><p class="eyebrow">QuartzLab</p><h1>${isRu ? 'Небольшие Unity Editor-инструменты для задач, которые должны решаться просто.' : 'Small Unity Editor tools for work that should stay simple.'}</h1><p class="project-copy">${isRu ? 'QuartzLab — независимый проект одного разработчика с фокусом на компактных editor-only плагинах. Цель простая: убрать повторяющуюся ручную работу, сделать изменения файлов предсказуемыми и не превращать маленький инструмент в отдельный фреймворк.' : 'QuartzLab is an independent one-developer project focused on compact editor-only plugins. The goal is to cut repeated manual work, keep file changes predictable, and avoid turning a small tool into a framework.'}</p></div><div class="project-social-row" aria-label="${isRu ? 'Ссылки проекта' : 'Project links'}">${socialLinks(renderOptions)}</div></section>
    <section class="project-flow"><section class="project-section"><h2>${isRu ? 'Чем занимается QuartzLab' : 'What QuartzLab does'}</h2><p>${isRu ? 'QuartzLab делает сфокусированные инструменты для Unity Editor: импорт, замена, проверка и чистка ассетов без runtime-систем и скрытых пайплайнов. Плагины намеренно остаются узкими: один инструмент, одна понятная задача, минимум лишних настроек.' : 'QuartzLab builds focused Unity Editor tools for importing, replacing, reviewing, and cleaning up assets without adding runtime systems or hidden pipelines. Plugins stay narrow on purpose: one tool, one clear job, minimum setup.'}</p></section><section class="project-section"><h2>${isRu ? 'Как разрабатываются плагины' : 'How the plugins are built'}</h2><p>${isRu ? 'Основная цель — Unity LTS. Предпочтительный подход: editor-only архитектура, документация на двух языках, открытые репозитории и обратная совместимость там, где она не превращается в хрупкость. Инструмент должен быть простым и понятным, без необходимости обучения для работы с ним.' : 'Unity LTS is the main target. The preferred approach is editor-only architecture, bilingual documentation, open repositories, and backwards compatibility where it stays maintainable. The tool should be simple and intuitive, with no need for training to use it.'}</p></section></section>
  </main>${siteFooter(language, renderOptions)}<script src="/site.js" defer></script></body></html>`, renderOptions);
}

function youtubeId(url) {
  const match = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/i);
  return match ? match[1] : '';
}

function mediaElement(item, plugin, language, index = 0) {
  const ui = UI[language];
  const title = item.title?.[language] || item.alt?.[language] || plugin.name;
  if (item.type === 'youtube') {
    const id = youtubeId(item.url);
    if (!id) return '';
    const poster = item.poster || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    return `<button class="hero-media-action" type="button" data-activate-media="${index}" aria-label="${escapeHtml(`${ui.mediaPlay}: ${title}`)}"><img src="${escapeHtml(poster)}" alt=""><span aria-hidden="true">▶</span></button>`;
  }
  if (item.type === 'video') return `<video controls preload="none" poster="${escapeHtml(item.poster || plugin.cover || '')}"><source src="${escapeHtml(item.src)}"></video>`;
  return `<button class="hero-image-button" type="button" data-open-lightbox data-image-media-index="${index}" aria-label="${escapeHtml(`${ui.mediaOpen}: ${title}`)}"><img src="${escapeHtml(item.src)}" alt="${escapeHtml(title)}"></button>`;
}

function pluginMedia(plugin, language) {
  const ui = UI[language];
  const fallback = [{ type: 'image', src: plugin.cover, alt: { en: plugin.name, ru: plugin.name } }];
  const media = plugin.media?.length ? plugin.media : fallback;
  const thumbs = media.map((item, index) => {
    const id = item.type === 'youtube' ? youtubeId(item.url) : '';
    const preview = id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : (item.poster || item.src || plugin.cover);
    const label = item.type === 'image' ? ui.mediaImage : ui.mediaVideo;
    return `<button class="media-thumb${index === 0 ? ' active' : ''}" type="button" data-media-index="${index}" data-media-type="${escapeHtml(item.type || 'image')}" data-media-src="${escapeHtml(item.src || item.url || '')}" data-media-full-src="${escapeHtml(item.fullSrc || item.src || '')}" data-media-poster="${escapeHtml(item.poster || plugin.cover || '')}" data-media-title="${escapeHtml(item.title?.[language] || item.alt?.[language] || plugin.name)}" aria-label="${escapeHtml(`${label} ${index + 1}`)}"><img src="${escapeHtml(preview)}" alt=""><span>${item.type === 'image' ? '▧' : '▶'}</span></button>`;
  }).join('');
  return `<div id="heroMedia" class="hero-media">${mediaElement(media[0], plugin, language, 0)}</div><div class="media-thumbs">${thumbs}</div><dialog class="media-lightbox" data-media-dialog aria-label="${escapeHtml(ui.mediaDialog)}"><div class="media-lightbox-layout"><button class="media-lightbox-close" type="button" data-lightbox-close aria-label="${escapeHtml(ui.mediaClose)}">×</button><button class="media-lightbox-nav media-lightbox-previous" type="button" data-lightbox-previous aria-label="${escapeHtml(ui.mediaPrevious)}">‹</button><img data-lightbox-image alt=""><button class="media-lightbox-nav media-lightbox-next" type="button" data-lightbox-next aria-label="${escapeHtml(ui.mediaNext)}">›</button></div></dialog>`;
}

function actionLink(url, label, className = 'secondary-button', external = true) {
  if (!url) return '';
  return `<a class="${className}" href="${escapeHtml(url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(label)}${external ? ' ↗' : ''}</a>`;
}

export function renderPluginPage(pluginRecord, downloads, language, renderOptions = {}) {
  const plugin = localizedPlugin(pluginRecord, language);
  const ui = UI[language];
  const pathname = `/${language}/plugins/${plugin.slug}/`;
  const alternatePath = `/${language === 'en' ? 'ru' : 'en'}/plugins/${plugin.slug}/`;
  const title = `${plugin.name} — QuartzLab`;
  const features = plugin.features.map(feature => `<li>${escapeHtml(feature)}</li>`).join('');
  const actions = [actionLink(plugin.releaseUrl, ui.releases, 'download-button'), plugin.documentationAvailable ? actionLink(`/${language}/docs/${plugin.slug}/`, ui.documentation, 'secondary-button', false) : '', actionLink(plugin.repositoryUrl, ui.source), actionLink(plugin.assetStoreUrl, ui.assetStore)].join('');
  const count = formatCount(downloads, language);
  const supportUrl = options(renderOptions).socials.boosty;
  return finalize(`<!doctype html><html lang="${language}" data-site-base-path="${escapeHtml(options(renderOptions).basePath)}"><head>${pageHead({ language, pathname, alternatePath, title, description: plugin.subtitle, image: plugin.cover, renderOptions })}</head><body>
  ${siteHeader(language, { active: 'plugins', slug: plugin.slug }, renderOptions)}
  <main class="shell plugin-page"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/${language}/">QuartzLab</a><span>/</span><a href="/${language}/#plugins">${ui.plugins}</a><span>/</span><span aria-current="page">${escapeHtml(plugin.name)}</span></nav>
    <section class="plugin-hero"><div class="plugin-gallery">${pluginMedia(plugin, language)}</div><aside class="plugin-summary"><span class="detail-category">${escapeHtml(plugin.categoryLabel)}</span><h1>${escapeHtml(plugin.name)}</h1><p class="plugin-lead">${escapeHtml(plugin.subtitle)}</p><div class="detail-meta"><div class="meta-row"><span>${ui.version}</span><strong>${escapeHtml(plugin.version)}</strong></div><div class="meta-row"><span>${ui.minimumUnity}</span><strong>${escapeHtml(plugin.unityVersion)}</strong></div><div class="meta-row"><span>${ui.license}</span><strong>${escapeHtml(plugin.license)}</strong></div><div class="meta-row"><span>${ui.githubDownloads}</span><strong>↓ ${count}</strong></div><div class="meta-row"><span>${language === 'ru' ? 'Дата релиза' : 'Release date'}</span><strong><time datetime="${escapeHtml(plugin.updatedAt)}">${escapeHtml(plugin.updatedAt)}</time></strong></div></div><div class="plugin-actions">${actions}</div></aside></section>
    <section class="plugin-content"><div class="content-main"><section><h2>${ui.aboutPlugin}</h2><p>${escapeHtml(plugin.description)}</p></section><section><h2>${ui.features}</h2><ul class="feature-list">${features}</ul></section><section><h2>${ui.installation}</h2><p>${escapeHtml(ui.installText)}</p></section>${plugin.documentationAvailable ? `<section class="docs-callout"><h2>${ui.documentation}</h2><p>${language === 'ru' ? 'Полная веб-документация синхронизируется с папкой Documentation~ последнего опубликованного релиза.' : 'The complete web documentation is synchronized from the Documentation~ folder of the latest published release.'}</p><a href="/${language}/docs/${plugin.slug}/">${ui.documentation} →</a></section>` : ''}</div><aside class="detail-side"><div class="detail-side-note"><h3>${ui.freeNote}</h3><p>${ui.freeNoteText}</p>${supportUrl ? `<a href="${escapeHtml(supportUrl)}" target="_blank" rel="noopener noreferrer">${ui.supportProject} →</a>` : ''}</div></aside></section>
  </main>${siteFooter(language, renderOptions)}<script src="/site.js" defer></script><script src="/plugin-gallery.js" defer></script></body></html>`, renderOptions);
}

function rewriteDocumentationAssetUrls(html, language, slug) {
  const base = `/generated-docs/${encodeURIComponent(language)}/${encodeURIComponent(slug)}/`;
  return html.replace(/\b(src|href)\s*=\s*(["'])([^"']+)\2/gi, (match, attribute, quote, value) => {
    if (/^(?:[a-z][a-z\d+.-]*:|\/|#|\?|data:)/i.test(value)) return match;
    const normalized = path.posix.normalize(value).replace(/^(?:\.\/)+/, '').replace(/^\.\.\//, '');
    return `${attribute}=${quote}${base}${normalized}${quote}`;
  });
}

function addBodyClass(html, className) {
  return html.replace(/<body\b([^>]*)>/i, (_match, attributes) => /\bclass\s*=/.test(attributes)
    ? `<body${attributes.replace(/\bclass\s*=\s*(["'])(.*?)\1/i, (_classMatch, quote, classes) => `class=${quote}${classes} ${className}${quote}`)}>`
    : `<body${attributes} class="${className}">`);
}

export function renderDocumentationPage(pluginRecord, language, sourceHtml, renderOptions = {}) {
  const plugin = localizedPlugin(pluginRecord, language);
  const opts = options(renderOptions);
  const pathname = `/${language}/docs/${plugin.slug}/`;
  const alternatePath = `/${language === 'en' ? 'ru' : 'en'}/docs/${plugin.slug}/`;
  const title = language === 'ru' ? `${plugin.name} — документация QuartzLab` : `${plugin.name} Documentation — QuartzLab`;
  const description = language === 'ru' ? `Документация ${plugin.name}: ${plugin.subtitle}` : `${plugin.name} documentation: ${plugin.subtitle}`;
  const structuredData = jsonLd({ title, description, pathname, siteOrigin: opts.siteOrigin, brandName: opts.brand.name });
  let output = String(sourceHtml)
    .replace(/\bclass\s*=\s*(["'])([^"']*\bbrand\b[^"']*)\1/gi, (_match, quote, classes) => `class=${quote}${classes.replace(/\bbrand\b/g, 'documentation-brand')}${quote}`)
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace(/<link\s+rel=["'](?:canonical|alternate)["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+property=["']og:[^>]+>\s*/gi, '')
    .replace(/<meta\s+name=["']twitter:[^>]+>\s*/gi, '')
    .replace('<script src="/theme.js"></script>', themeInitMarkup());
  output = rewriteDocumentationAssetUrls(output, language, plugin.slug);
  const additions = `${securityMeta([THEME_INIT_SCRIPT, structuredData])}\n  ${seoMarkup({ language, pathname, alternatePath, title, description, siteOrigin: opts.siteOrigin, brandName: opts.brand.name })}\n  <link rel="icon" href="/assets/quartzlab-mark.svg" type="image/svg+xml">\n  <link rel="stylesheet" href="/styles.css">\n  <script type="application/ld+json">${structuredData}</script>`;
  output = output.replace('</head>', `  ${additions}\n</head>`);
  output = output.replace(/<html\b([^>]*)>/i, (_match, attrs) => `<html${attrs} data-site-base-path="${escapeHtml(opts.basePath)}">`);
  output = addBodyClass(output, 'web-documentation-page');
  output = output.replace(/<body\b([^>]*)>/i, match => `${match}\n  ${siteHeader(language, { active: 'docs', slug: plugin.slug }, renderOptions)}`);
  output = output.replace('</body>', `  ${siteFooter(language, renderOptions)}\n  <script src="/site.js" defer></script>\n</body>`);
  return finalize(output, renderOptions);
}

export function renderRootPage(renderOptions = {}) {
  const opts = options(renderOptions);
  return finalize(`<!doctype html><html lang="en" data-site-base-path="${escapeHtml(opts.basePath)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${securityMeta()}<meta name="robots" content="noindex"><title>${escapeHtml(opts.brand.name)}</title><link rel="icon" href="/assets/quartzlab-mark.svg" type="image/svg+xml"><script src="/language-redirect.js"></script><noscript><meta http-equiv="refresh" content="0;url=${opts.basePath === '/' ? '' : opts.basePath}/en/"></noscript></head><body><p><a href="/en/">English</a> · <a href="/ru/">Русский</a></p></body></html>`, renderOptions);
}

export function renderNotFoundPage(renderOptions = {}) {
  const title = 'Page not found — QuartzLab';
  const description = 'The requested QuartzLab page was not found.';
  return finalize(`<!doctype html><html lang="en" data-site-base-path="${escapeHtml(options(renderOptions).basePath)}"><head>${pageHead({ language: 'en', pathname: '/404.html', alternatePath: '/404.html', title, description, renderOptions })}<meta name="robots" content="noindex"></head><body>${siteHeader('en', {}, renderOptions)}<main class="shell plugin-page"><section class="project-section"><p class="eyebrow">404</p><h1>Page not found</h1><p>The address may be outdated. Return to the <a href="/en/#plugins">plugin catalog</a> or open the <a href="/ru/#plugins">Russian version</a>.</p></section></main>${siteFooter('en', renderOptions)}<script src="/site.js" defer></script></body></html>`, renderOptions);
}

function sitemapEntry(pathname, alternatePath, siteOrigin, lastModified = '') {
  const language = pathname.split('/').filter(Boolean)[0];
  const alternateLanguage = language === 'en' ? 'ru' : 'en';
  const defaultPath = language === 'en' ? pathname : alternatePath;
  return `  <url>\n    <loc>${escapeHtml(canonicalUrl(pathname, siteOrigin))}</loc>\n${lastModified ? `    <lastmod>${escapeHtml(lastModified)}</lastmod>\n` : ''}    <xhtml:link rel="alternate" hreflang="${language}" href="${escapeHtml(canonicalUrl(pathname, siteOrigin))}" />\n    <xhtml:link rel="alternate" hreflang="${alternateLanguage}" href="${escapeHtml(canonicalUrl(alternatePath, siteOrigin))}" />\n    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeHtml(canonicalUrl(defaultPath, siteOrigin))}" />\n  </url>`;
}

export function renderSitemap(plugins, renderOptions = {}) {
  const { siteOrigin } = options(renderOptions);
  const entries = [sitemapEntry('/en/', '/ru/', siteOrigin), sitemapEntry('/ru/', '/en/', siteOrigin), sitemapEntry('/en/about/', '/ru/about/', siteOrigin), sitemapEntry('/ru/about/', '/en/about/', siteOrigin)];
  for (const plugin of plugins) {
    entries.push(sitemapEntry(`/en/plugins/${plugin.slug}/`, `/ru/plugins/${plugin.slug}/`, siteOrigin, plugin.updatedAt));
    entries.push(sitemapEntry(`/ru/plugins/${plugin.slug}/`, `/en/plugins/${plugin.slug}/`, siteOrigin, plugin.updatedAt));
    if (plugin.documentationAvailable) {
      entries.push(sitemapEntry(`/en/docs/${plugin.slug}/`, `/ru/docs/${plugin.slug}/`, siteOrigin, plugin.updatedAt));
      entries.push(sitemapEntry(`/ru/docs/${plugin.slug}/`, `/en/docs/${plugin.slug}/`, siteOrigin, plugin.updatedAt));
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
}

export function renderRobotsTxt(renderOptions = {}) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${canonicalUrl('/sitemap.xml', options(renderOptions).siteOrigin)}\n`;
}

export function renderMaintenancePage(language = 'en', renderOptions = {}) {
  const isRu = language === 'ru';
  const brandName = options(renderOptions).brand.name;
  return finalize(`<!doctype html><html lang="${language}" data-site-base-path="${escapeHtml(options(renderOptions).basePath)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${securityMeta()}<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${isRu ? 'Технические работы' : 'Maintenance'} — ${escapeHtml(brandName)}</title><link rel="icon" href="/assets/quartzlab-mark.svg" type="image/svg+xml"><link rel="stylesheet" href="/maintenance.css"></head><body class="maintenance-page"><main><img src="/assets/quartzlab-mark.svg" alt=""><p class="eyebrow">${escapeHtml(brandName)}</p><h1>${isRu ? 'Проводим технические работы' : 'We are performing maintenance'}</h1><p>${isRu ? 'Сайт временно закрыт на обновление. Пожалуйста, загляните немного позже.' : 'The site is temporarily closed while it is being updated. Please check back soon.'}</p><p class="maintenance-language"><a href="/ru/">Русский</a><span>·</span><a href="/en/">English</a></p></main></body></html>`, renderOptions);
}

export const siteOrigin = DEFAULT_SITE_CONFIG.brand.origin;
