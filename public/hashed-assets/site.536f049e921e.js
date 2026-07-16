'use strict';

window.QuartzLab = (() => {
  const supported = ['en', 'ru'];
  const boostyUrl = 'https://boosty.to/quartzlab';
  const supportRoute = '/go/support';
  const themeStorageKey = 'quartzlab-theme';

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
      loading: 'Loading...',
      notFound: 'Plugin not found',
      notFoundText: 'The link may be outdated or the plugin is not published yet.',
      backCatalog: 'Back to catalog',
      downloads: 'downloads',
      mediaImage: 'Screenshot',
      mediaVideo: 'Video',
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
      loading: 'Загрузка...',
      notFound: 'Плагин не найден',
      notFoundText: 'Возможно, ссылка устарела или плагин ещё не опубликован.',
      backCatalog: 'Вернуться в каталог',
      downloads: 'скачиваний',
      mediaImage: 'Скриншот',
      mediaVideo: 'Видео',
    },
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

  const generatedDocsUrl = (lang, slug) =>
    `/generated-docs/${encodeURIComponent(clampLanguage(lang))}/${encodeURIComponent(slug)}/`;

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

  function currentTheme() {
    const appliedTheme = document.documentElement.dataset.theme;
    if (appliedTheme === 'light' || appliedTheme === 'dark') {
      return appliedTheme;
    }

    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function updateThemeToggles(root = document) {
    const theme = currentTheme();
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    const language = languageFromPath();
    const label = language === 'ru'
      ? (nextTheme === 'dark' ? 'Включить тёмную тему' : 'Включить светлую тему')
      : (nextTheme === 'dark' ? 'Switch to dark theme' : 'Switch to light theme');
    const status = language === 'ru'
      ? (theme === 'dark' ? 'Тёмная тема включена' : 'Светлая тема включена')
      : (theme === 'dark' ? 'Dark theme is active' : 'Light theme is active');

    root.querySelectorAll('[data-theme-toggle]').forEach(button => {
      if (!button.querySelector('.theme-toggle-icons')) {
        button.insertAdjacentHTML('afterbegin', `
          <span class="theme-toggle-icons" aria-hidden="true">
            <svg class="theme-icon theme-icon-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"></circle><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"></path></svg>
            <svg class="theme-icon theme-icon-moon" viewBox="0 0 24 24"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z"></path></svg>
          </span>
          <span class="sr-only" data-theme-status></span>`);
      }
      button.dataset.theme = theme;
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      const statusNode = button.querySelector('[data-theme-status]');
      if (statusNode) statusNode.textContent = status;
    });
  }

  function applyTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') {
      return;
    }

    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch (_) {}

    updateThemeToggles();
    window.dispatchEvent(new CustomEvent('quartzlab:themechange', { detail: { theme } }));
  }

  function bindThemeToggles(root = document) {
    root.querySelectorAll('[data-theme-toggle]').forEach(button => {
      if (button.dataset.themeBound === 'true') {
        return;
      }

      button.dataset.themeBound = 'true';
      button.addEventListener('click', () => {
        applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
      });
    });

    updateThemeToggles(root);
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

      if (link.dataset.languageBound === 'true') {
        return;
      }

      link.dataset.languageBound = 'true';
      link.addEventListener('click', event => {
        setLanguagePreference(targetLang);

        if (section !== 'docs' || !location.hash) {
          return;
        }

        const suffix = location.hash.replace(/^#(?:ru|en)-/, '');
        const targetHash = suffix ? `#${targetLang}-${suffix}` : location.hash;
        event.preventDefault();
        location.assign(`${link.href.split('#')[0]}${targetHash}`);
      });
    });
  }

  function bindPageLanguageSwitchers() {
    const language = languageFromPath();
    const parts = location.pathname.split('/').filter(Boolean);
    const section = parts[1] || '';
    if ((section === 'plugins' || section === 'docs') && parts[2]) {
      bindLanguageSwitchers(language, decodeURIComponent(parts[2]), section);
      if (section === 'docs' && location.hash) {
        const target = document.querySelector(location.hash);
        if (target) {
          const alignTarget = () => requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
          if (document.readyState === 'complete') {
            alignTarget();
          } else {
            window.addEventListener('load', alignTarget, { once: true });
          }
        }
      }
      return;
    }
    bindLanguageSwitchers(language, '', section === 'about' ? 'about' : '');
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
    applyTheme,
    bindLanguageSwitchers,
    bindThemeToggles,
    boostyUrl,
    buildSupportUrl,
    currentTheme,
    decorateSupportLinks,
    docsUrl,
    escape,
    formatNumber,
    generatedDocsUrl,
    languageFromPath,
    loadData,
    localize,
    normalizePathname,
    pluginUrl,
    setLanguagePreference,
    slugFromPath,
    strings,
    updateThemeToggles,
    youtubeId,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      decorateSupportLinks();
      bindThemeToggles();
      bindPageLanguageSwitchers();
    }, { once: true });
  } else {
    decorateSupportLinks();
    bindThemeToggles();
    bindPageLanguageSwitchers();
  }

  return api;
})();
