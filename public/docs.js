'use strict';

const Q = window.QuartzLab;
const params = new URLSearchParams(location.search);

const lang = params.get('lang') || Q.languageFromPath();
const slug = params.get('slug') || Q.slugFromPath('docs');
const t = Q.strings[lang];
const root = document.querySelector('#docsPage');

function updateChrome() {
  const navLinks = document.querySelectorAll('.main-nav a');
  if (navLinks[0]) {
    navLinks[0].textContent = t.plugins;
    navLinks[0].href = `/${lang}/#plugins`;
  }
  if (navLinks[1]) {
    navLinks[1].textContent = t.about;
    navLinks[1].href = Q.aboutUrl(lang);
  }

  document.querySelector('.brand').href = `/${lang}/`;

  const footerLinks = document.querySelectorAll('.compact-footer a');
  if (footerLinks[0]) {
    footerLinks[0].textContent = 'QuartzLab';
    footerLinks[0].href = `/${lang}/`;
  }
  if (footerLinks[1]) {
    footerLinks[1].textContent = t.about;
    footerLinks[1].href = Q.aboutUrl(lang);
  }
}

function notFound() {
  document.title = `${t.notFound} - QuartzLab`;
  Q.bindLanguageSwitchers(lang);
  updateChrome();
  root.innerHTML = `<div class="not-found"><h1>${t.notFound}</h1><a href="/${lang}/#plugins">${t.backCatalog}</a></div>`;
}

function bindFrameSize(frame) {
  const resize = () => {
    try {
      const bodyHeight = frame.contentDocument?.body?.scrollHeight || 0;
      const documentHeight = frame.contentDocument?.documentElement?.scrollHeight || 0;
      frame.style.height = `${Math.max(bodyHeight, documentHeight, 720)}px`;
    } catch (_) {}
  };

  frame.addEventListener('load', () => {
    resize();
    setTimeout(resize, 100);
    setTimeout(resize, 500);

    try {
      frame.contentWindow.addEventListener('resize', resize);
      frame.contentDocument.querySelectorAll('img').forEach(image => {
        image.addEventListener('load', resize);
      });
    } catch (_) {}
  });
}

function render(plugin) {
  document.documentElement.lang = lang;
  document.title = `${plugin.name} - ${t.documentation} - QuartzLab`;
  document.querySelector('meta[name="description"]').content = plugin.subtitle;

  Q.bindLanguageSwitchers(lang, plugin.slug, 'docs');
  updateChrome();

  const docsSrc = Q.generatedDocsUrl(lang, plugin.slug);
  root.innerHTML = `
    <nav class="breadcrumbs">
      <a href="/${lang}/">QuartzLab</a>
      <span>/</span>
      <a href="/${lang}/#plugins">${t.plugins}</a>
      <span>/</span>
      <a href="${Q.pluginUrl(lang, plugin.slug)}">${Q.escape(plugin.name)}</a>
      <span>/</span>
      <span>${t.documentation}</span>
    </nav>
    <div class="docs-frame-shell">
      <iframe
        class="docs-frame"
        src="${Q.escape(docsSrc)}"
        title="${Q.escape(`${plugin.name} ${t.documentation}`)}"
        loading="eager"
        referrerpolicy="strict-origin-when-cross-origin"></iframe>
    </div>`;

  bindFrameSize(root.querySelector('.docs-frame'));
}

document.documentElement.lang = lang;
Q.bindLanguageSwitchers(lang, slug, 'docs');
updateChrome();

Q.loadData()
  .then(({ plugins }) => {
    const item = plugins.find(plugin => plugin.slug === slug);
    if (!item) {
      notFound();
      return;
    }

    const localized = Q.localize(item, lang);

    if (!item.documentationAvailable) {
      notFound();
      return;
    }

    render(localized);
  })
  .catch(notFound);
