'use strict';

(() => {
  const key = 'quartzlab-theme';
  let theme = null;

  try {
    const saved = localStorage.getItem(key);
    if (saved === 'light' || saved === 'dark') {
      theme = saved;
    }
  } catch (_) {}

  if (!theme) {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  document.documentElement.dataset.theme = theme;
})();
