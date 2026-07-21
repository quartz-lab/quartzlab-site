'use strict';

window.QuartzLab = (() => {
  const supported = ['en', 'ru'];
  const themeStorageKey = 'quartzlab-theme';

  const basePath = (() => {
    const value = document.documentElement.dataset.siteBasePath || '/';
    return value === '/' ? '' : value.replace(/\/+$/, '');
  })();

  const withBasePath = pathname => `${basePath}${String(pathname).startsWith('/') ? pathname : `/${pathname}`}`.replace(/\/{2,}/g, '/');
  const routeParts = () => {
    const pathname = basePath && location.pathname.startsWith(`${basePath}/`)
      ? location.pathname.slice(basePath.length)
      : location.pathname;
    return pathname.split('/').filter(Boolean);
  };
  const languageFromPath = () => supported.includes(routeParts()[0]) ? routeParts()[0] : 'en';
  const clampLanguage = language => supported.includes(language) ? language : 'en';
  const pluginUrl = (language, slug) => withBasePath(`/${clampLanguage(language)}/plugins/${encodeURIComponent(slug)}/`);
  const docsUrl = (language, slug) => withBasePath(`/${clampLanguage(language)}/docs/${encodeURIComponent(slug)}/`);
  const aboutUrl = language => withBasePath(`/${clampLanguage(language)}/about/`);

  function setLanguagePreference(language) {
    if (!supported.includes(language)) return;
    try { localStorage.setItem('quartzlab-language', language); } catch (_) {}
  }

  function currentTheme() {
    const applied = document.documentElement.dataset.theme;
    if (applied === 'light' || applied === 'dark') return applied;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function updateThemeToggles(root = document) {
    const theme = currentTheme();
    const next = theme === 'dark' ? 'light' : 'dark';
    const language = languageFromPath();
    const label = language === 'ru'
      ? (next === 'dark' ? 'Включить тёмную тему' : 'Включить светлую тему')
      : (next === 'dark' ? 'Switch to dark theme' : 'Switch to light theme');
    const status = language === 'ru'
      ? (theme === 'dark' ? 'Тёмная тема включена' : 'Светлая тема включена')
      : (theme === 'dark' ? 'Dark theme is active' : 'Light theme is active');
    root.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.dataset.theme = theme;
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      const statusNode = button.querySelector('[data-theme-status]');
      if (statusNode) statusNode.textContent = status;
    });
  }

  function applyTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') return;
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(themeStorageKey, theme); } catch (_) {}
    updateThemeToggles();
    dispatchEvent(new CustomEvent('quartzlab:themechange', { detail: { theme } }));
  }

  function bindThemeToggles(root = document) {
    root.querySelectorAll('[data-theme-toggle]').forEach(button => {
      if (button.dataset.themeBound === 'true') return;
      button.dataset.themeBound = 'true';
      button.addEventListener('click', () => applyTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
    });
    updateThemeToggles(root);
  }

  function bindLanguageSwitchers() {
    const parts = routeParts();
    const language = languageFromPath();
    const section = parts[1] || '';
    const slug = parts[2] ? decodeURIComponent(parts[2]) : '';
    document.querySelectorAll('[data-language]').forEach(link => {
      const targetLanguage = clampLanguage(link.dataset.language);
      link.classList.toggle('active', targetLanguage === language);
      if (targetLanguage === language) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
      if (slug && section === 'plugins') link.href = pluginUrl(targetLanguage, slug);
      else if (slug && section === 'docs') link.href = docsUrl(targetLanguage, slug);
      else if (section === 'about') link.href = aboutUrl(targetLanguage);
      else link.href = withBasePath(`/${targetLanguage}/`);
      link.addEventListener('click', event => {
        setLanguagePreference(targetLanguage);
        if (section !== 'docs' || !location.hash) return;
        const suffix = location.hash.replace(/^#(?:ru|en)-/, '');
        event.preventDefault();
        location.assign(`${link.href.split('#')[0]}${suffix ? `#${targetLanguage}-${suffix}` : location.hash}`);
      });
    });
  }

  function alignDocumentationHash() {
    if (routeParts()[1] !== 'docs' || !location.hash) return;
    const target = document.querySelector(location.hash);
    if (!target) return;
    const align = () => requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
    if (document.readyState === 'complete') align();
    else addEventListener('load', align, { once: true });
  }

  function initialize() {
    bindThemeToggles();
    bindLanguageSwitchers();
    alignDocumentationHash();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();

  return { aboutUrl, applyTheme, basePath, bindThemeToggles, currentTheme, docsUrl, languageFromPath, pluginUrl, setLanguagePreference, updateThemeToggles, withBasePath };
})();
