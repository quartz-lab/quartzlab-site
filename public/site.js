'use strict';

window.QuartzLab = (() => {
  const supported = ['en', 'ru'];
  const boostyUrl = 'https://boosty.to/quartzlab';
  const supportRoute = '/go/support';

  const strings = {
    en: {
      plugins: 'Plugins',
      about: 'About',
      support: 'Support',
      documentation: 'Documentation',
      source: 'Source code',
      releases: 'Latest release',
      assetStore: 'Asset Store',
      version: 'Version',
      unity: 'Minimum Unity',
      license: 'License',
      githubDownloads: 'GitHub downloads',
      aboutPlugin: 'About the plugin',
      features: 'Features',
      installation: 'Installation',
      installText: 'Open the latest published GitHub release, download the package archive, extract it, then use Add package from disk in Unity Package Manager and select package.json.',
      freeNote: 'Free and open source',
      freeNoteText: 'QuartzLab plugins stay free. You can inspect the source, review the license, and support future maintenance only if you want to.',
      supportProject: 'Support QuartzLab',
      loading: 'Loading…',
      notFound: 'Plugin not found',
      notFoundText: 'The link may be outdated or the plugin is not published yet.',
      backCatalog: 'Back to catalog',
      downloads: 'downloads',
      mediaImage: 'Screenshot',
      mediaVideo: 'Video'
    },
    ru: {
      plugins: 'Плагины',
      about: 'О проекте',
      support: 'Поддержать',
      documentation: 'Документация',
      source: 'Исходный код',
      releases: 'Последний релиз',
      assetStore: 'Asset Store',
      version: 'Версия',
      unity: 'Минимальная Unity',
      license: 'Лицензия',
      githubDownloads: 'Скачиваний на GitHub',
      aboutPlugin: 'О плагине',
      features: 'Возможности',
      installation: 'Установка',
      installText: 'Открой последний опубликованный релиз на GitHub, скачай архив пакета, распакуй его и в Unity Package Manager выбери Add package from disk, указав package.json.',
      freeNote: 'Бесплатно и с открытым кодом',
      freeNoteText: 'Плагины QuartzLab остаются бесплатными. Код и лицензии открыты, а поддержка проекта всегда остаётся добровольной.',
      supportProject: 'Поддержать QuartzLab',
      loading: 'Загрузка…',
      notFound: 'Плагин не найден',
      notFoundText: 'Возможно, ссылка устарела или плагин ещё не опубликован.',
      backCatalog: 'Вернуться в каталог',
      downloads: 'скачиваний',
      mediaImage: 'Скриншот',
      mediaVideo: 'Видео'
    }
  };

  const escape = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[char]));

  const clampLanguage = language => supported.includes(language) ? language : 'en';

  const languageFromPath = () => {
    const pathLanguage = location.pathname.split('/').filter(Boolean)[0];
    const previewLanguage = new URLSearchParams(location.search).get('lang');
    return supported.includes(pathLanguage)
      ? pathLanguage
      : supported.includes(previewLanguage)
        ? previewLanguage
        : 'en';
  };

  const slugFromPath = section => {
    const parts = location.pathname.split('/').filter(Boolean);
    const index = parts.indexOf(section);
    if (index >= 0 && parts[index + 1]) {
      return decodeURIComponent(parts[index + 1]);
    }
    return new URLSearchParams(location.search).get('slug') || '';
  };

  const normalizePathname = pathname => {
    const clean = String(pathname || '/').split('?')[0].trim();
    if (!clean.startsWith('/')) {
      return '/';
    }
    return clean.length > 1 ? clean.replace(/\/+$/, '') : '/';
  };

  const localize = (plugin, lang) => ({
    ...plugin,
    ...plugin.i18n[lang],
    categoryLabel: plugin.category[lang],
  });

  const pluginUrl = (lang, slug) =>
    `/${encodeURIComponent(clampLanguage(lang))}/plugins/${encodeURIComponent(slug)}/`;

  const docsUrl = (lang, slug) =>
    `/${encodeURIComponent(clampLanguage(lang))}/docs/${encodeURIComponent(slug)}/`;

  const aboutUrl = lang => `/${encodeURIComponent(clampLanguage(lang))}/about/`;

  const formatNumber = (value, lang) =>
    new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-US').format(Number(value) || 0);

  function setLanguagePreference(lang) {
    if (!supported.includes(lang)) {
      return;
    }
    try {
      localStorage.setItem('quartzlab-language', lang);
    } catch (_) {}
  }

  function bindLanguageSwitchers(currentLang, slug = '', section = '') {
    document.querySelectorAll('[data-language]').forEach(link => {
      const targetLang = link.dataset.language;
      link.classList.toggle('active', targetLang === currentLang);
      link.setAttribute('aria-current', targetLang === currentLang ? 'true' : 'false');

      if (slug && section === 'plugins') {
        link.href = pluginUrl(targetLang, slug);
      } else if (slug && section === 'docs') {
        link.href = docsUrl(targetLang, slug);
      } else if (section === 'about') {
        link.href = aboutUrl(targetLang);
      } else {
        link.href = `/${targetLang}/`;
      }

      link.addEventListener('click', () => setLanguagePreference(targetLang));
    });
  }

  function youtubeId(url) {
    if (!url) {
      return '';
    }
    const match = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/i);
    return match ? match[1] : '';
  }

  function buildSupportUrl(place, lang = languageFromPath(), page = location.pathname) {
    const safePlace = /^[a-z0-9-]{1,40}$/i.test(place || '') ? place : 'unknown';
    const safeLang = clampLanguage(lang);
    const safePage = normalizePathname(page);
    const params = new URLSearchParams({
      place: safePlace,
      lang: safeLang,
      page: safePage,
    });

    return `${supportRoute}?${params.toString()}`;
  }

  function decorateSupportLinks(root = document) {
    const lang = languageFromPath();
    const page = normalizePathname(location.pathname);

    root.querySelectorAll('[data-support-link]').forEach(link => {
      const place = link.dataset.supportPlace || 'unknown';
      link.href = buildSupportUrl(place, lang, page);
      link.rel = 'noopener noreferrer';
    });
  }

  async function loadData() {
    const [pluginsResponse, downloadsResponse] = await Promise.all([
      fetch('/data/plugins.json'),
      fetch('/data/downloads.json'),
    ]);

    if (!pluginsResponse.ok) {
      throw new Error(`Catalog HTTP ${pluginsResponse.status}`);
    }

    const plugins = await pluginsResponse.json();
    const downloads = downloadsResponse.ok ? await downloadsResponse.json() : { plugins: {} };
    return { plugins, downloads: downloads.plugins || {} };
  }

  const api = {
    aboutUrl,
    boostyUrl,
    buildSupportUrl,
    bindLanguageSwitchers,
    decorateSupportLinks,
    docsUrl,
    escape,
    formatNumber,
    languageFromPath,
    loadData,
    localize,
    normalizePathname,
    pluginUrl,
    setLanguagePreference,
    slugFromPath,
    strings,
    youtubeId,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => decorateSupportLinks(), { once: true });
  } else {
    decorateSupportLinks();
  }

  return api;
})();
