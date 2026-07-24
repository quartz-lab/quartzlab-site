import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { buildSite } from '../scripts/build-site.mjs';
import { escapeHtml, renderAboutPage, renderHomePage, renderPluginPage, siteOrigin, THEME_INIT_SCRIPT } from '../scripts/lib/site-render.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const LEGACY_ICON_PATTERN = new RegExp(['quartzlab', 'mark\\.svg'].join('-'), 'i');
const siteConfig = JSON.parse(await readFile(path.join(ROOT, 'site.config.json'), 'utf8'));
let OUTPUT = path.join(ROOT, '_site');
let temporaryRoot;
const robots = await readFile(path.join(OUTPUT, 'robots.txt'), 'utf8').catch(() => '');
if (/Disallow:\s*\//.test(robots)) {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'quartzlab-normal-static-tests-'));
  OUTPUT = path.join(temporaryRoot, '_site');
  await buildSite({
    outputPath: OUTPUT,
    environment: {
      ...process.env,
      SITE_ORIGIN: 'https://quartzlab.ru',
      SITE_BASE_PATH: '/',
      SITE_MAINTENANCE: 'false',
    },
  });
}
after(async () => {
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
});
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
  const descriptions = {
    en: 'Free QuartzLab plugins and tools for Unity Editor with documentation, screenshots, and downloads of the latest releases.',
    ru: 'Бесплатные плагины и инструменты QuartzLab для Unity Editor: описание, документация, скриншоты и загрузка последних версий.',
  };
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
    assert.ok(home.includes(`<meta name="description" content="${descriptions[language]}">`));
    assert.ok(home.includes(`<meta property="og:description" content="${descriptions[language]}">`));
    assert.ok(home.includes(`<meta name="twitter:description" content="${descriptions[language]}">`));
  }
  await access(path.join(OUTPUT, '404.html'));
  assert.equal(siteOrigin, 'https://quartzlab.ru');
  assert.doesNotMatch(await readOutput('sitemap.xml'), /quartzlab-site\.pages\.dev|plugin\.html/);
});

test('normal root is indexable, useful without JavaScript, and has complete language SEO metadata', async () => {
  const root = await readOutput('index.html');
  const robotsMeta = root.match(/<meta name="robots" content="([^"]+)">/i)?.[1];

  assert.equal(robotsMeta, 'index,follow');
  assert.doesNotMatch(robotsMeta, /\b(?:noindex|nofollow|none)\b/i);
  assert.doesNotMatch(root, /http-equiv="refresh"/i);
  assert.match(root, /href="\/ru\/"/);
  assert.match(root, /href="\/en\/"/);
  assert.match(root, /<main\b[\s\S]*<h1\b[\s\S]*href="\/en\/"[\s\S]*href="\/ru\/"/i);
  assert.match(root, /<link rel="canonical" href="https:\/\/quartzlab\.ru\/">/);
  assert.match(root, /<link rel="alternate" hreflang="ru" href="https:\/\/quartzlab\.ru\/ru\/">/);
  assert.match(root, /<link rel="alternate" hreflang="en" href="https:\/\/quartzlab\.ru\/en\/">/);
  assert.match(root, /<link rel="alternate" hreflang="x-default" href="https:\/\/quartzlab\.ru\/">/);
});

test('normal sitemap exposes the root as x-default and robots allows the whole site', async () => {
  const sitemap = await readOutput('sitemap.xml');
  const robots = await readOutput('robots.txt');

  assert.match(sitemap, /<loc>https:\/\/quartzlab\.ru\/<\/loc>/);
  assert.match(sitemap, /hreflang="x-default" href="https:\/\/quartzlab\.ru\/"/);
  assert.match(robots, /^Allow:\s*\/$/m);
  assert.doesNotMatch(robots, /^Disallow:\s*\/$/m);
});

test('all generated pages use the root favicon and contain no legacy icon references', async () => {
  await access(path.join(OUTPUT, 'favicon.svg'));
  const files = await listFiles(OUTPUT);
  for (const file of files.filter(file => path.extname(file) === '.html')) {
    assert.match(await readFile(file, 'utf8'), /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml">/);
  }
  for (const file of files.filter(file => ['.html', '.js', '.json', '.txt', '.xml'].includes(path.extname(file)))) {
    assert.doesNotMatch(await readFile(file, 'utf8'), LEGACY_ICON_PATTERN);
  }
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
    assert.match(html, /<link rel="icon" href="\/quartzlab-site\/favicon\.svg" type="image\/svg\+xml">/);
    assert.doesNotMatch(html, /quartzlab\.ru\/quartzlab-site/);
  }
});

test('about page keeps two content sections and renders only configured local-vector social buttons', () => {
  const html = renderAboutPage('ru', {
    brand: siteConfig.brand,
    socials: siteConfig.socials,
    siteOrigin: siteConfig.brand.origin,
  });
  const socialEntries = Object.entries(siteConfig.socials);
  const configuredSocials = socialEntries.filter(([, url]) => typeof url === 'string' && url.trim());
  const disabledSocials = socialEntries.filter(([, url]) => typeof url !== 'string' || !url.trim());
  const socialButtons = [...html.matchAll(/<a class="project-social-link" data-social="([^"]+)" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map(([, name, href, contents]) => ({ name, href, contents }));
  const buttonsByName = new Map(socialButtons.map(button => [button.name, button]));

  assert.equal((html.match(/class="project-section"/g) || []).length, 2);
  assert.equal(socialButtons.length, configuredSocials.length);
  for (const [name, url] of configuredSocials) {
    const button = buttonsByName.get(name);
    assert.ok(button, `configured ${name} social button is missing`);
    assert.equal(button.href, escapeHtml(url));
    assert.match(button.contents, /^<svg\b[\s\S]*<\/svg><span>[^<]+<\/span>$/, `${name} must use an inline local SVG icon`);
    assert.doesNotMatch(button.contents, /<(?:img|use)\b[^>]*(?:src|href)=["']https?:/i, `${name} must not load an external icon`);
  }
  for (const [name] of disabledSocials) {
    assert.equal(buttonsByName.has(name), false, `disabled ${name} social button must not render`);
  }
  const nullableSocial = configuredSocials[0];
  if (nullableSocial) {
    const [nullableName] = nullableSocial;
    const htmlWithNullSocial = renderAboutPage('ru', {
      brand: siteConfig.brand,
      socials: { ...siteConfig.socials, [nullableName]: null },
      siteOrigin: siteConfig.brand.origin,
    });
    const renderedNames = [...htmlWithNullSocial.matchAll(/data-social="([^"]+)"/g)].map(([, name]) => name);
    assert.equal(renderedNames.includes(nullableName), false, `null ${nullableName} social button must not render`);
    assert.equal(renderedNames.length, configuredSocials.length - 1);
  }
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
