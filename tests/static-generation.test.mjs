import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { renderAboutPage, renderHomePage, renderPluginPage, siteOrigin, THEME_INIT_SCRIPT } from '../scripts/lib/site-render.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUTPUT = path.join(ROOT, '_site');
const readOutput = (...segments) => readFile(path.join(OUTPUT, ...segments), 'utf8');

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(target));
    if (entry.isFile()) files.push(target);
  }
  return files;
}

test('normal clean build contains static RU/EN catalog, plugin, docs, 404, and SEO routes', async () => {
  for (const language of ['en', 'ru']) {
    const home = await readOutput(language, 'index.html');
    const plugin = await readOutput(language, 'plugins', 'clipswitch', 'index.html');
    const docs = await readOutput(language, 'docs', 'clipswitch', 'index.html');
    assert.match(home, /data-plugin-card/);
    assert.doesNotMatch(home, /Loading catalog|Загрузка каталога|<template id="productTemplate"/);
    assert.match(plugin, /<h1>ClipSwitch<\/h1>/);
    assert.match(plugin, new RegExp(`canonical" href="https://quartzlab\\.ru/${language}/plugins/clipswitch/`));
    assert.match(docs, /class="site-header"/);
    assert.doesNotMatch(docs, /class="topbar"|offline documentation|офлайн-документация/i);
  }
  await access(path.join(OUTPUT, '404.html'));
  assert.equal(siteOrigin, 'https://quartzlab.ru');
  assert.doesNotMatch(await readOutput('sitemap.xml'), /quartzlab-site\.pages\.dev|plugin\.html/);
});

test('output catalog scripts never fetch JSON and Boosty links are direct', async () => {
  const files = await listFiles(OUTPUT);
  for (const file of files.filter(file => ['.html', '.js'].includes(path.extname(file)))) {
    const text = await readFile(file, 'utf8');
    assert.doesNotMatch(text, /fetch\s*\([^)]*(?:plugins|downloads)\.json/i);
    assert.doesNotMatch(text, /\/go\/support|buildSupportUrl|decorateSupportLinks/);
  }
  const home = await readOutput('en', 'index.html');
  assert.match(home, /href="https:\/\/boosty\.to\/quartzlab" target="_blank" rel="noopener noreferrer"/);
});

test('all fingerprinted filenames match their exact bytes and no stale files remain', async () => {
  const manifest = JSON.parse(await readOutput('asset-manifest.json'));
  const files = (await listFiles(path.join(OUTPUT, 'hashed-assets'))).sort();
  const prefix = manifest.basePath === '/' ? '' : manifest.basePath;
  const targets = Object.values(manifest.assets).map(value => value.slice(prefix.length).replace(/^\//, '')).sort();
  assert.deepEqual(files.map(file => path.relative(OUTPUT, file).replaceAll(path.sep, '/')), targets);
  for (const file of files) {
    const digest = createHash('sha256').update(await readFile(file)).digest('hex').slice(0, 12);
    assert.match(path.basename(file), new RegExp(`\\.${digest}\\.(?:css|js)$`));
  }
});

test('theme bootstrap precedes styles and CSP permits only hashed inline bootstraps', async () => {
  const html = await readOutput('en', 'index.html');
  const markup = `<script>${THEME_INIT_SCRIPT}</script>`;
  const hash = createHash('sha256').update(THEME_INIT_SCRIPT).digest('base64');
  assert.ok(html.indexOf(markup) < html.indexOf('styles.'));
  assert.match(html, new RegExp(`sha256-${hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.doesNotMatch(html, /unsafe-inline|frame-ancestors/);
  assert.match(html, /frame-src https:\/\/www\.youtube-nocookie\.com/);
});

test('renderer supports project Pages base path while canonical stays on quartzlab.ru', () => {
  const plugin = {
    slug: 'example', name: 'Example', category: { en: 'Tools', ru: 'Инструменты' }, version: '1.0.0', unityVersion: '2022.3+', license: 'MIT', featured: true,
    updatedAt: '2026-01-01', cover: '/assets/example.png', media: [], releaseUrl: 'https://github.com/quartz-lab/example/releases/tag/v1.0.0', repositoryUrl: 'https://github.com/quartz-lab/example', documentationAvailable: false, assetStoreUrl: null, tags: [],
    i18n: { en: { subtitle: 'Example', description: 'Example.', features: ['One'] }, ru: { subtitle: 'Пример', description: 'Пример.', features: ['Один'] } },
  };
  const opts = { basePath: '/quartzlab-site', siteOrigin: 'https://quartzlab.ru' };
  const home = renderHomePage([plugin], { example: 5 }, 'en', opts);
  const detail = renderPluginPage(plugin, 5, 'en', opts);
  const about = renderAboutPage('en', opts);
  for (const html of [home, detail, about]) {
    assert.match(html, /(?:href|src)="\/quartzlab-site\//);
    assert.doesNotMatch(html, /(?:href|src)="\/assets\//);
    assert.match(html, /canonical" href="https:\/\/quartzlab\.ru\/en\//);
    assert.doesNotMatch(html, /quartzlab\.ru\/quartzlab-site/);
  }
});

test('about page keeps two content sections and the four local-vector social buttons', async () => {
  const html = await readOutput('ru', 'about', 'index.html');
  assert.equal((html.match(/class="project-section"/g) || []).length, 2);
  assert.equal((html.match(/class="project-social-link"/g) || []).length, 4);
  assert.doesNotMatch(html, /<h2>Принципы<\/h2>/);
});

test('GitHub Pages output contains no legacy platform code', async () => {
  const files = await listFiles(OUTPUT);
  const legacyTerms = ['cloud' + 'flare', 'wrang' + 'ler', 'Pages ' + 'Functions', 'SUPPORT_' + 'ANALYTICS'];
  for (const file of files.filter(file => ['.html', '.js', '.json', '.txt', '.xml'].includes(path.extname(file)))) {
    const text = (await readFile(file, 'utf8')).toLowerCase();
    assert.equal(legacyTerms.some(term => text.includes(term.toLowerCase())), false);
  }
});
