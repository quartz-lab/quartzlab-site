'use strict';

window.QuartzLab = (() => {
  const supported = ['en', 'ru'];
  const strings = {
    en: {
      plugins: 'Plugins', about: 'About', support: 'Support', documentation: 'Documentation', source: 'Source code', releases: 'GitHub Releases', assetStore: 'Asset Store',
      version: 'Version', unity: 'Unity', license: 'License', aboutPlugin: 'About the plugin', features: 'Features', installation: 'Installation',
      installText: 'Download the ZIP from GitHub Releases, extract it, then add the package in Unity Package Manager using Add package from disk and select package.json.',
      freeNote: 'Free and open source', freeNoteText: 'Every QuartzLab plugin is published under the MIT license. Support is always optional.',
      supportProject: 'Support QuartzLab', loading: 'Loading…', notFound: 'Plugin not found', notFoundText: 'The link may be outdated or the plugin is not published yet.', backCatalog: 'Back to catalog',
      downloads: 'downloads', mediaImage: 'Screenshot', mediaVideo: 'Video'
    },
    ru: {
      plugins: 'Плагины', about: 'О проекте', support: 'Поддержать', documentation: 'Документация', source: 'Исходный код', releases: 'GitHub Releases', assetStore: 'Asset Store',
      version: 'Версия', unity: 'Unity', license: 'Лицензия', aboutPlugin: 'О плагине', features: 'Возможности', installation: 'Установка',
      installText: 'Скачай ZIP из GitHub Releases, распакуй его, затем в Unity Package Manager выбери Add package from disk и укажи файл package.json.',
      freeNote: 'Бесплатно и с открытым кодом', freeNoteText: 'Все плагины QuartzLab публикуются по лицензии MIT. Поддержка проекта всегда добровольна.',
      supportProject: 'Поддержать QuartzLab', loading: 'Загрузка…', notFound: 'Плагин не найден', notFoundText: 'Возможно, ссылка устарела или плагин ещё не опубликован.', backCatalog: 'Вернуться в каталог',
      downloads: 'скачиваний', mediaImage: 'Скриншот', mediaVideo: 'Видео'
    }
  };

  const escape = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const languageFromPath = () => {
    const pathLanguage=location.pathname.split('/').filter(Boolean)[0];
    const previewLanguage=new URLSearchParams(location.search).get('lang');
    return supported.includes(pathLanguage) ? pathLanguage : supported.includes(previewLanguage) ? previewLanguage : 'en';
  };
  const slugFromPath = section => {
    const parts = location.pathname.split('/').filter(Boolean);
    const index = parts.indexOf(section);
    return index >= 0 && parts[index + 1] ? decodeURIComponent(parts[index + 1]) : new URLSearchParams(location.search).get('slug') || '';
  };
  const localize = (plugin, lang) => ({...plugin, ...plugin.i18n[lang], categoryLabel: plugin.category[lang]});
  const pluginUrl = (lang, slug) => `/${lang}/plugins/${encodeURIComponent(slug)}/`;
  const docsUrl = (lang, slug) => `/${lang}/docs/${encodeURIComponent(slug)}/`;
  const formatNumber = (value, lang) => new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-US').format(Number(value) || 0);

  function setLanguagePreference(lang) {
    if (supported.includes(lang)) localStorage.setItem('quartzlab-language', lang);
  }

  function bindLanguageSwitchers(currentLang, slug = '', section = '') {
    document.querySelectorAll('[data-language]').forEach(link => {
      const targetLang = link.dataset.language;
      link.classList.toggle('active', targetLang === currentLang);
      link.setAttribute('aria-current', targetLang === currentLang ? 'true' : 'false');
      if (slug && section === 'plugins') link.href = pluginUrl(targetLang, slug);
      else if (slug && section === 'docs') link.href = docsUrl(targetLang, slug);
      else link.href = `/${targetLang}/`;
      link.addEventListener('click', () => setLanguagePreference(targetLang));
    });
  }

  function youtubeId(url) {
    if (!url) return '';
    const match = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/i);
    return match ? match[1] : '';
  }

  async function loadData() {
    const [pluginsResponse, downloadsResponse] = await Promise.all([fetch('/data/plugins.json'), fetch('/data/downloads.json')]);
    if (!pluginsResponse.ok) throw new Error(`Catalog HTTP ${pluginsResponse.status}`);
    const plugins = await pluginsResponse.json();
    const downloads = downloadsResponse.ok ? await downloadsResponse.json() : {plugins:{}};
    return {plugins, downloads: downloads.plugins || {}};
  }

  return {strings, escape, languageFromPath, slugFromPath, localize, pluginUrl, docsUrl, formatNumber, bindLanguageSwitchers, setLanguagePreference, youtubeId, loadData};
})();
