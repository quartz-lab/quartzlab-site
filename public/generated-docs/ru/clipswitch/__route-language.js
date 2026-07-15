'use strict';
(() => {
  const lang = "ru";
  if (lang === "en" || lang === "ru") {
    try { localStorage.setItem("quartzlab-doc-language", lang); } catch (_) {}
  }
})();
