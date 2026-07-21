'use strict';
(() => {
  let saved;
  try { saved=localStorage.getItem('quartzlab-language'); } catch (_) {}
  const language=saved==='ru'||saved==='en'?saved:(navigator.language||'').toLowerCase().startsWith('ru')?'ru':'en';
  const base=(document.documentElement.dataset.siteBasePath||'/').replace(/\/+$/,'');
  location.replace(`${base}/${language}/`.replace(/\/{2,}/g,'/'));
})();
