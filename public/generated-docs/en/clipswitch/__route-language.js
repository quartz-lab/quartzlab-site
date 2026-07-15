'use strict';
(() => {
  const lang = "en";
  if (lang === "en" || lang === "ru") {
    try { localStorage.setItem("quartzlab-doc-language", lang); } catch (_) {}
  }
})();
