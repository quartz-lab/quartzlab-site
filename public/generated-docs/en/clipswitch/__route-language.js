'use strict';
(() => {
  const lang = "en";
  if (lang === "en" || lang === "ru") {
    document.documentElement.dataset.routeLanguage = lang;
    try {
      localStorage.setItem("quartzlab-language", lang);
      localStorage.setItem("quartzlab-doc-language", lang);
    } catch (_) {}
  }
})();
