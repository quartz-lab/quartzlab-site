import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { siteOrigin, THEME_INIT_SCRIPT } from '../scripts/lib/site-render.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

async function readPublic(...segments) {
  return readFile(path.join(PUBLIC, ...segments), 'utf8');
}

test('sync output contains canonical static plugin pages with content and SEO', async () => {
  for (const language of ['en', 'ru']) {
    const html = await readPublic(language, 'plugins', 'clipswitch', 'index.html');
    assert.match(html, /<h1>ClipSwitch<\/h1>/);
    assert.match(html, /<meta name="description" content="[^"]+">/);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://quartzlab\\.ru/${language}/plugins/clipswitch/">`));
    assert.match(html, /hreflang="en"/);
    assert.match(html, /hreflang="ru"/);
    assert.match(html, /Скачиваний на GitHub|GitHub downloads/);
    assert.doesNotMatch(html, /plugin\.html\?|fetch\(['"]\/data\/plugins\.json/);
  }
});

test('all public SEO URLs use the canonical quartzlab.ru origin', async () => {
  assert.equal(siteOrigin, 'https://quartzlab.ru');

  const pages = [
    ['en', 'index.html'],
    ['ru', 'index.html'],
    ['en', 'about', 'index.html'],
    ['ru', 'about', 'index.html'],
    ['en', 'plugins', 'clipswitch', 'index.html'],
    ['ru', 'plugins', 'clipswitch', 'index.html'],
    ['en', 'docs', 'clipswitch', 'index.html'],
    ['ru', 'docs', 'clipswitch', 'index.html'],
  ];

  for (const page of pages) {
    const html = await readPublic(...page);
    assert.match(html, /<link rel="canonical" href="https:\/\/quartzlab\.ru\//);
    assert.doesNotMatch(html, /quartzlab-site\.pages\.dev/);
  }

  const sitemap = await readPublic('sitemap.xml');
  const robots = await readPublic('robots.txt');
  assert.match(sitemap, /<loc>https:\/\/quartzlab\.ru\//);
  assert.doesNotMatch(sitemap, /quartzlab-site\.pages\.dev/);
  assert.match(robots, /Sitemap: https:\/\/quartzlab\.ru\/sitemap\.xml/);
});

test('sync output contains direct, cleaned documentation HTML for each language', async () => {
  const en = await readPublic('en', 'docs', 'clipswitch', 'index.html');
  const ru = await readPublic('ru', 'docs', 'clipswitch', 'index.html');

  assert.match(en, /<h1>Clip<span>Switch<\/span><\/h1>/);
  assert.match(en, /id="en-quick-start"/);
  assert.doesNotMatch(en, /id="ru-quick-start"/);
  assert.match(ru, /id="ru-quick-start"/);
  assert.doesNotMatch(ru, /id="en-quick-start"/);

  for (const html of [en, ru]) {
    assert.doesNotMatch(html, /<iframe\b/i);
    assert.doesNotMatch(html, /offline documentation|offline html|офлайн-документация/i);
    const languageSwitches = html.match(/<div class="language-switch"[^>]*>[\s\S]*?<\/div>/gi) || [];
    assert.equal(languageSwitches.length, 1, 'only the global site language switch remains');
    assert.doesNotMatch(languageSwitches[0], /<button/i);
    assert.match(html, /data-theme-toggle/);
    assert.match(html, /<link rel="canonical"/);
    assert.doesNotMatch(html, /class="topbar"/);
    assert.equal((html.match(/class="site-header"/g) || []).length, 1);
    assert.match(html, /<span>Quartz<span>Lab<\/span><\/span>/);
  }
});

test('public pages initialize the saved theme before styles without weakening CSP', async () => {
  const pages = [
    ['en', 'index.html'],
    ['ru', 'index.html'],
    ['en', 'about', 'index.html'],
    ['ru', 'about', 'index.html'],
    ['en', 'plugins', 'clipswitch', 'index.html'],
    ['ru', 'docs', 'clipswitch', 'index.html'],
  ];
  const themeMarkup = `<script>${THEME_INIT_SCRIPT}</script>`;

  for (const page of pages) {
    const html = await readPublic(...page);
    assert.ok(html.indexOf(themeMarkup) > -1, `${page.join('/')} has the inline theme initializer`);
    assert.ok(html.indexOf(themeMarkup) < html.indexOf('/styles.css'), `${page.join('/')} initializes theme before site styles`);
  }

  const headers = await readPublic('_headers');
  const hash = createHash('sha256').update(THEME_INIT_SCRIPT).digest('base64');
  assert.match(headers, new RegExp(`script-src 'self' 'sha256-${hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  assert.doesNotMatch(headers, /script-src[^\n]*'unsafe-inline'/);
});

test('localized footers use descriptive site navigation and synchronized catalog wording', async () => {
  const cases = [
    { language: 'en', catalog: 'Unity plugin catalog', about: 'About QuartzLab', sync: 'automatic synchronization with GitHub Releases' },
    { language: 'ru', catalog: 'Каталог Unity-плагинов', about: 'О QuartzLab', sync: 'автоматической синхронизацией с GitHub Releases' },
  ];

  for (const item of cases) {
    for (const page of [
      [item.language, 'index.html'],
      [item.language, 'about', 'index.html'],
      [item.language, 'plugins', 'clipswitch', 'index.html'],
      [item.language, 'docs', 'clipswitch', 'index.html'],
    ]) {
      const html = await readPublic(...page);
      assert.match(html, new RegExp(`<nav class="footer-links"[^>]*>[\\s\\S]*${item.catalog}[\\s\\S]*${item.about}[\\s\\S]*<\\/nav>`));
      assert.match(html, new RegExp(item.sync));
      assert.doesNotMatch(html, /footer-links[\s\S]*?href="https:\/\/github\.com\/quartz-lab"/);
    }
  }
});

test('about pages contain only the two requested project sections', async () => {
  for (const language of ['en', 'ru']) {
    const html = await readPublic(language, 'about', 'index.html');
    assert.equal((html.match(/class="project-section"/g) || []).length, 2);
    assert.doesNotMatch(html, /<h2>Principles<\/h2>|<h2>Принципы<\/h2>/);
  }
});

test('sitemap includes every public language route and no legacy query pages', async () => {
  const sitemap = await readPublic('sitemap.xml');
  for (const route of [
    '/en/plugins/clipswitch/',
    '/ru/plugins/clipswitch/',
    '/en/docs/clipswitch/',
    '/ru/docs/clipswitch/',
  ]) {
    assert.match(sitemap, new RegExp(route.replaceAll('/', '\\/')));
  }
  assert.doesNotMatch(sitemap, /plugin\.html|docs\.html/);
  assert.match(sitemap, /xmlns:xhtml=/);
});

test('legacy dynamic shells and route functions are absent', async () => {
  for (const relativePath of [
    ['plugin-shell.html'],
    ['docs-shell.html'],
    ['plugin.js'],
    ['docs.js'],
  ]) {
    await assert.rejects(access(path.join(PUBLIC, ...relativePath)));
  }

  for (const relativePath of ['plugin.html.js', 'docs.html.js', '_middleware.js']) {
    await assert.rejects(access(path.join(ROOT, 'functions', relativePath)));
  }
});
