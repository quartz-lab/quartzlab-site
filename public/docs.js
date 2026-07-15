'use strict';

const Q = window.QuartzLab;
const params = new URLSearchParams(location.search);

const lang = params.get('lang') || Q.languageFromPath();
const slug = params.get('slug') || Q.slugFromPath('docs');
const t = Q.strings[lang];
const root = document.querySelector('#docsPage');

function notFound() {
  document.title = `${t.notFound} — QuartzLab`;
  Q.bindLanguageSwitchers(lang);
  root.innerHTML = `<div class="not-found"><h1>${t.notFound}</h1><a href="/${lang}/#plugins">${t.backCatalog}</a></div>`;
}

document.documentElement.lang = lang;
Q.bindLanguageSwitchers(lang, slug, 'docs');

Q.loadData()
  .then(({ plugins }) => {
    const item = plugins.find(plugin => plugin.slug === slug);
    if (!item) {
      notFound();
      return;
    }

    const localized = Q.localize(item, lang);
    document.title = `${localized.name} — ${t.documentation} — QuartzLab`;

    if (!item.documentationAvailable) {
      notFound();
      return;
    }

    location.replace(Q.docsUrl(lang, item.slug));
  })
  .catch(notFound);
