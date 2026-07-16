'use strict';
(() => {
  const saved=localStorage.getItem('quartzlab-language');
  const language=saved==='ru'||saved==='en'?saved:(navigator.language||'').toLowerCase().startsWith('ru')?'ru':'en';
  location.replace(`/${language}/`);
})();
