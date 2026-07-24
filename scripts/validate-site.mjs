import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { access, readdir, readFile } from 'node:fs/promises';

import { readJsonFile } from './lib/json-utils.mjs';
import { normalizeBasePath } from './lib/site-paths.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.md', '.mjs', '.txt', '.xml', '.yaml', '.yml']);
const CONFLICT_MARKER = /^(?:<<<<<<<|=======|>>>>>>>)(?:\s|$)/m;
const LEGACY_TERMS = ['cloud' + 'flare', 'wrang' + 'ler', 'SUPPORT_' + 'ANALYTICS', 'Pages ' + 'Functions', '/go/' + 'support'];
const HASHED_NAME = /\.([0-9a-f]{12})\.(css|js)$/;
const FORBIDDEN_PRODUCTION_PREFIX = '/quartzlab-site/';
const LEGACY_ICON_NAME = ['quartzlab', 'mark.svg'].join('-');

async function listFiles(directory, ignored = new Set()) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignored.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(target, ignored));
    if (entry.isFile()) files.push(target);
  }
  return files;
}

function toPosix(value) { return String(value).replaceAll(path.sep, '/'); }
function sha256(buffer) { return createHash('sha256').update(buffer).digest('hex'); }
function isExternal(value) { return /^(?:[a-z][a-z\d+.-]*:|\/\/|data:|javascript:|mailto:|tel:|#|\?)/i.test(value); }

async function expectFile(filePath, label) {
  try { await access(filePath); } catch (error) { throw new Error(`${label} is missing: ${filePath}`, { cause: error }); }
}

async function configuredPluginSlugs(root) {
  const configs = await readJsonFile(path.join(root, 'catalog', 'plugins.config.json'));
  if (!Array.isArray(configs) || !configs.length) throw new Error('catalog/plugins.config.json must contain plugins');
  return configs.map(config => {
    let repository;
    try { repository = new URL(config.repository); }
    catch { throw new Error(`invalid plugin repository URL: ${config.repository}`); }
    const slug = repository.pathname.split('/').filter(Boolean).at(-1)?.replace(/\.git$/i, '').toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug || '')) throw new Error(`invalid plugin slug from ${config.repository}`);
    return slug;
  });
}

function stripBase(value, basePath) {
  if (!value.startsWith('/')) return value;
  if (basePath === '/') return value;
  if (value === basePath) return '/';
  if (!value.startsWith(`${basePath}/`)) throw new Error(`internal URL is missing SITE_BASE_PATH ${basePath}: ${value}`);
  return value.slice(basePath.length) || '/';
}

function outputFileForUrl(outputPath, htmlFile, rawValue, basePath) {
  const value = rawValue.split(/[?#]/, 1)[0];
  if (!value || isExternal(value)) return null;
  let decoded;
  try { decoded = decodeURIComponent(value); } catch { decoded = value; }
  const target = decoded.startsWith('/')
    ? path.resolve(outputPath, `.${stripBase(decoded, basePath)}`)
    : path.resolve(path.dirname(htmlFile), decoded);
  const candidate = decoded.endsWith('/') ? path.join(target, 'index.html') : target;
  const relative = path.relative(outputPath, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`URL escapes deployment output: ${rawValue}`);
  return candidate;
}

function manifestFile(outputPath, target, basePath) {
  const pathname = stripBase(target, basePath);
  return path.join(outputPath, ...pathname.replace(/^\//, '').split('/'));
}

export async function validateSite({
  root = ROOT,
  outputPath = path.join(root, '_site'),
  expectedBasePath,
  maintenance,
  logger = console,
} = {}) {
  const errors = [];
  const checks = [];
  let files = [];
  let manifest;
  let plugins;
  let maintenanceMode = maintenance;

  async function check(label, operation) {
    try { await operation(); checks.push(label); }
    catch (error) { errors.push(`${label}: ${error.message || error}`); }
  }

  await check('deployment output exists', async () => { files = await listFiles(outputPath); if (!files.length) throw new Error('output directory is empty'); });
  if (maintenanceMode === undefined) {
    const robots = await readFile(path.join(outputPath, 'robots.txt'), 'utf8').catch(() => '');
    maintenanceMode = /Disallow:\s*\//.test(robots);
  }
  await check('all deployment JSON is valid', async () => {
    for (const file of files.filter(file => path.extname(file).toLowerCase() === '.json')) await readJsonFile(file);
    manifest = await readJsonFile(path.join(outputPath, 'asset-manifest.json'));
    const pluginPath = path.join(outputPath, 'data', 'plugins.json');
    try { plugins = await readJsonFile(pluginPath); } catch (error) { if (!maintenanceMode) throw error; }
  });

  await check('no Git conflict markers', async () => {
    const sourceFiles = await listFiles(root, new Set(['.git', '_site', 'node_modules']));
    const conflicts = [];
    for (const file of [...sourceFiles, ...files]) {
      if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
      if (CONFLICT_MARKER.test(await readFile(file, 'utf8'))) conflicts.push(path.relative(root, file));
    }
    if (conflicts.length) throw new Error(`found in ${conflicts.join(', ')}`);
  });

  const basePath = normalizeBasePath(expectedBasePath || manifest?.basePath || '/');
  await check('production output has no project Pages base path', async () => {
    if (basePath !== '/') return;
    const offenders = [];
    for (const file of files) {
      if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
      const text = await readFile(file, 'utf8');
      if (text.includes(FORBIDDEN_PRODUCTION_PREFIX)) offenders.push(path.relative(outputPath, file));
    }
    if (offenders.length) throw new Error(`${FORBIDDEN_PRODUCTION_PREFIX} found in ${offenders.join(', ')}`);
  });

  await check('asset manifest matches fingerprinted files', async () => {
    if (manifest?.version !== 2 || manifest.basePath !== basePath || !manifest.assets || Array.isArray(manifest.assets)) throw new Error('invalid asset-manifest.json structure');
    const targets = new Set(Object.values(manifest.assets));
    for (const [logical, target] of Object.entries(manifest.assets)) {
      if (!/^\/.+\.(?:css|js)$/.test(logical) || typeof target !== 'string') throw new Error(`invalid manifest entry ${logical}`);
      const file = manifestFile(outputPath, target, basePath);
      const bytes = await readFile(file);
      const match = path.basename(file).match(HASHED_NAME);
      if (!match || sha256(bytes).slice(0, 12) !== match[1]) throw new Error(`filename does not match SHA-256 bytes: ${path.relative(outputPath, file)}`);
    }
    const hashedFiles = files.filter(file => toPosix(path.relative(outputPath, file)).startsWith('hashed-assets/'));
    for (const file of hashedFiles) {
      const bytes = await readFile(file);
      const match = path.basename(file).match(HASHED_NAME);
      if (!match || sha256(bytes).slice(0, 12) !== match[1]) throw new Error(`invalid fingerprinted file: ${path.relative(outputPath, file)}`);
      const publicPath = `${basePath === '/' ? '' : basePath}/${toPosix(path.relative(outputPath, file))}`;
      if (!targets.has(publicPath)) throw new Error(`fingerprinted file is absent from manifest: ${path.relative(outputPath, file)}`);
    }
  });

  const htmlFiles = files.filter(file => path.extname(file).toLowerCase() === '.html');
  await check('all local HTML asset and internal links exist', async () => {
    for (const htmlFile of htmlFiles) {
      const html = await readFile(htmlFile, 'utf8');
      for (const match of html.matchAll(/\b(?:src|href|poster|data-media-src|data-media-full-src|data-media-poster)\s*=\s*["']([^"']+)["']/gi)) {
        const value = match[1];
        if (/^https?:/i.test(value) || /^(?:data:|mailto:|tel:|#|\?)/i.test(value)) continue;
        const target = outputFileForUrl(outputPath, htmlFile, value, basePath);
        if (target) await expectFile(target, `${path.relative(outputPath, htmlFile)} reference ${value}`);
      }
    }
  });

  await check('HTML uses fingerprinted CSS and JavaScript only', async () => {
    const logicalSources = new Set(Object.keys(manifest.assets));
    for (const htmlFile of htmlFiles) {
      const html = await readFile(htmlFile, 'utf8');
      for (const logical of logicalSources) {
        const rootReference = basePath === '/' ? logical : `${basePath}${logical}`;
        if (html.includes(`"${rootReference}"`) || html.includes(`'${rootReference}'`)) throw new Error(`${path.relative(outputPath, htmlFile)} still references ${logical}`);
      }
      for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+\.(?:css|js)(?:[?#][^"']*)?)["']/gi)) {
        if (!match[1].includes('/hashed-assets/')) throw new Error(`${path.relative(outputPath, htmlFile)} references non-fingerprinted ${match[1]}`);
      }
    }
  });

  await check('required static entry files exist', async () => {
    for (const relative of ['index.html', '404.html', 'favicon.svg', 'robots.txt', 'sitemap.xml']) await expectFile(path.join(outputPath, relative), relative);
  });

  await check('all pages use the root favicon and contain no legacy icon references', async () => {
    const faviconHref = `${basePath === '/' ? '' : basePath}/favicon.svg`;
    const faviconMarkup = `<link rel="icon" href="${faviconHref}" type="image/svg+xml">`;
    for (const htmlFile of htmlFiles) {
      const html = await readFile(htmlFile, 'utf8');
      if (!html.includes(faviconMarkup)) throw new Error(`${path.relative(outputPath, htmlFile)} does not use ${faviconHref}`);
    }
    for (const file of files.filter(file => TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()))) {
      if ((await readFile(file, 'utf8')).toLowerCase().includes(LEGACY_ICON_NAME)) {
        throw new Error(`legacy icon reference in ${path.relative(outputPath, file)}`);
      }
    }
  });

  await check('production root is indexable, localized, and uses root assets', async () => {
    if (maintenanceMode || basePath !== '/') return;
    const rootHtml = await readFile(path.join(outputPath, 'index.html'), 'utf8');
    const notFoundHtml = await readFile(path.join(outputPath, '404.html'), 'utf8');
    const sitemap = await readFile(path.join(outputPath, 'sitemap.xml'), 'utf8');
    const robots = await readFile(path.join(outputPath, 'robots.txt'), 'utf8');
    for (const route of ['/ru/', '/en/']) {
      if (!rootHtml.includes(`href="${route}"`)) throw new Error(`root index does not link to ${route}`);
    }
    if (!rootHtml.includes('data-site-base-path="/"')) throw new Error('root index does not declare the root base path');
    const robotsDirective = rootHtml.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)/i)?.[1] || '';
    if (!/\bindex\b/i.test(robotsDirective) || !/\bfollow\b/i.test(robotsDirective) || /\b(?:noindex|nofollow|none)\b/i.test(robotsDirective)) {
      throw new Error(`root index has unsafe robots directives: ${robotsDirective || '(missing)'}`);
    }
    for (const markup of [
      '<link rel="canonical" href="https://quartzlab.ru/">',
      '<link rel="alternate" hreflang="ru" href="https://quartzlab.ru/ru/">',
      '<link rel="alternate" hreflang="en" href="https://quartzlab.ru/en/">',
      '<link rel="alternate" hreflang="x-default" href="https://quartzlab.ru/">',
    ]) {
      if (!rootHtml.includes(markup)) throw new Error(`root index is missing SEO markup: ${markup}`);
    }
    if (!sitemap.includes('<loc>https://quartzlab.ru/</loc>') || !sitemap.includes('hreflang="x-default" href="https://quartzlab.ru/"')) {
      throw new Error('sitemap does not contain the root x-default URL');
    }
    if (!/^Allow:\s*\/$/m.test(robots) || /^Disallow:\s*\/$/m.test(robots)) throw new Error('production robots.txt does not allow root crawling');
    const redirectAsset = manifest.assets['/language-redirect.js'];
    const stylesAsset = manifest.assets['/styles.css'];
    const siteAsset = manifest.assets['/site.js'];
    if (!redirectAsset || !rootHtml.includes(`src="${redirectAsset}"`)) throw new Error('root language redirect is missing or not fingerprinted');
    if (!stylesAsset || !rootHtml.includes(`href="${stylesAsset}"`)) throw new Error('root index does not use the fingerprinted site stylesheet');
    if (!siteAsset || !rootHtml.includes(`src="${siteAsset}"`)) throw new Error('root index does not use the fingerprinted site script');
    if (!stylesAsset || !notFoundHtml.includes(`href="${stylesAsset}"`)) throw new Error('404.html does not use the fingerprinted site stylesheet');
    if (!siteAsset || !notFoundHtml.includes(`src="${siteAsset}"`)) throw new Error('404.html does not use the fingerprinted site script');
    const redirectScript = await readFile(manifestFile(outputPath, redirectAsset, basePath), 'utf8');
    if (!redirectScript.includes('location.replace') || !redirectScript.includes('dataset.siteBasePath') || !redirectScript.includes('/${language}/')) throw new Error('root language redirect does not resolve to /ru/ or /en/ from the configured base path');
  });

  await check('maintenance routes and fingerprinted assets are complete', async () => {
    if (!maintenanceMode) return;
    if (basePath !== '/') throw new Error(`maintenance production build must use SITE_BASE_PATH=/, received ${basePath}`);
    const maintenanceAsset = manifest.assets['/maintenance.css'];
    if (!maintenanceAsset || !/^\/hashed-assets\/maintenance\.[0-9a-f]{12}\.css$/.test(maintenanceAsset)) {
      throw new Error('fingerprinted maintenance.css is missing');
    }
    if (manifest.assets['/language-redirect.js'] || Object.keys(manifest.assets).some(logical => logical.endsWith('.js'))) {
      throw new Error('maintenance manifest contains JavaScript or language-redirect.js');
    }
    if (files.some(file => path.extname(file).toLowerCase() === '.js')) throw new Error('maintenance output contains JavaScript files');

    const slugs = await configuredPluginSlugs(root);
    const routes = ['index.html', '404.html'];
    for (const language of ['ru', 'en']) {
      routes.push(`${language}/index.html`, `${language}/about/index.html`);
      for (const slug of slugs) routes.push(`${language}/plugins/${slug}/index.html`, `${language}/docs/${slug}/index.html`);
    }
    for (const route of routes) {
      const file = path.join(outputPath, ...route.split('/'));
      await expectFile(file, `maintenance route ${route}`);
      const html = await readFile(file, 'utf8');
      if (!html.includes(`href="${maintenanceAsset}"`)) throw new Error(`${route} does not use fingerprinted maintenance.css`);
      if (/<script\b/i.test(html)) throw new Error(`${route} contains a script`);
      if (/language-redirect\.js/i.test(html)) throw new Error(`${route} contains language-redirect.js`);
      if (!/noindex,nofollow/i.test(html)) throw new Error(`${route} is missing noindex,nofollow`);
    }
    const rootHtml = await readFile(path.join(outputPath, 'index.html'), 'utf8');
    for (const route of ['/ru/', '/en/']) {
      if (!rootHtml.includes(`href="${route}"`)) throw new Error(`maintenance root does not link to ${route}`);
    }
  });

  await check('RU and EN plugin routes are complete', async () => {
    if (maintenanceMode) return;
    if (!Array.isArray(plugins) || !plugins.length) throw new Error('data/plugins.json must contain plugins');
    for (const plugin of plugins) {
      if (!/^[a-z0-9-]+$/.test(plugin.slug || '')) throw new Error(`invalid slug ${plugin.slug}`);
      for (const value of [plugin.cover, ...(plugin.media || []).flatMap(item => [item.src, item.fullSrc, item.poster])]) {
        if (typeof value !== 'string' || !value.startsWith('/')) continue;
        await expectFile(manifestFile(outputPath, value, basePath), `plugin asset ${value}`);
      }
      for (const language of ['ru', 'en']) {
        await expectFile(path.join(outputPath, language, 'plugins', plugin.slug, 'index.html'), `${language} plugin page for ${plugin.slug}`);
        if (plugin.documentationAvailable) await expectFile(path.join(outputPath, language, 'docs', plugin.slug, 'index.html'), `${language} docs page for ${plugin.slug}`);
      }
    }
  });

  await check('catalog cards are static and do not use runtime fetch', async () => {
    if (maintenanceMode) return;
    for (const language of ['ru', 'en']) {
      const html = await readFile(path.join(outputPath, language, 'index.html'), 'utf8');
      if (!html.includes('data-plugin-card') || /Loading catalog|Загрузка каталога/.test(html)) throw new Error(`${language} catalog has no static cards`);
      if (/\bfetch\s*\(/.test(html)) throw new Error(`${language} catalog contains fetch()`);
    }
    const scripts = files.filter(file => path.extname(file) === '.js');
    for (const file of scripts) if (/\bfetch\s*\([^)]*(?:plugins|downloads)\.json/i.test(await readFile(file, 'utf8'))) throw new Error(`runtime catalog fetch in ${path.relative(outputPath, file)}`);
  });

  await check('SEO URLs use quartzlab.ru', async () => {
    if (maintenanceMode) return;
    for (const file of [...htmlFiles, path.join(outputPath, 'sitemap.xml'), path.join(outputPath, 'robots.txt')]) {
      const text = await readFile(file, 'utf8');
      if (/quartzlab-site\.pages\.dev/i.test(text)) throw new Error(`legacy origin in ${path.relative(outputPath, file)}`);
      for (const match of text.matchAll(/(?:rel=["'](?:canonical|alternate)["'][^>]*href=|property=["']og:url["'][^>]*content=)["'](https?:\/\/[^"']+)/gi)) {
        if (!match[1].startsWith('https://quartzlab.ru/')) throw new Error(`wrong SEO origin in ${path.relative(outputPath, file)}: ${match[1]}`);
      }
    }
  });

  await check('Boosty links are direct and work without JavaScript', async () => {
    if (maintenanceMode) return;
    let count = 0;
    for (const file of htmlFiles) {
      const html = await readFile(file, 'utf8');
      for (const match of html.matchAll(/href=["']([^"']*boosty[^"']*)["']/gi)) {
        count += 1;
        if (match[1] !== 'https://boosty.to/quartzlab') throw new Error(`non-direct Boosty link in ${path.relative(outputPath, file)}`);
      }
    }
    if (!count) throw new Error('no Boosty links found');
  });

  await check('CSP supports local assets and lazy YouTube embeds', async () => {
    if (maintenanceMode) return;
    for (const htmlFile of htmlFiles.filter(file => !toPosix(path.relative(outputPath, file)).startsWith('generated-docs/'))) {
      const html = await readFile(htmlFile, 'utf8');
      const policy = html.match(/http-equiv=["']Content-Security-Policy["']\s+content=["']([^"']+)/i)?.[1] || '';
      if (!policy.includes("script-src &#39;self&#39;") || !policy.includes("style-src &#39;self&#39;") || !policy.includes('frame-src https://www.youtube-nocookie.com')) throw new Error(`incomplete CSP in ${path.relative(outputPath, htmlFile)}`);
      if (/frame-ancestors/i.test(policy)) throw new Error(`unsupported meta CSP directive in ${path.relative(outputPath, htmlFile)}`);
      for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
        const hash = createHash('sha256').update(match[1], 'utf8').digest('base64');
        if (!policy.includes(`sha256-${hash}`)) throw new Error(`inline script hash is absent from CSP in ${path.relative(outputPath, htmlFile)}`);
      }
    }
  });

  await check('deployment has no legacy platform code, support route, or secrets', async () => {
    const offenders = [];
    for (const file of files) {
      const relative = toPosix(path.relative(outputPath, file));
      if (/(^|\/)(?:\.env(?:\.|$)|\.dev\.vars$)|secret|credential/i.test(relative)) offenders.push(relative);
      const text = TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()) ? await readFile(file, 'utf8') : '';
      if (LEGACY_TERMS.some(term => text.toLowerCase().includes(term.toLowerCase()))) offenders.push(relative);
    }
    if (offenders.length) throw new Error(`found in ${[...new Set(offenders)].join(', ')}`);
  });

  await check('maintenance indexing state is correct', async () => {
    const robots = await readFile(path.join(outputPath, 'robots.txt'), 'utf8');
    const sitemap = await readFile(path.join(outputPath, 'sitemap.xml'), 'utf8');
    if (maintenanceMode) {
      if (!/Disallow:\s*\//.test(robots) || /<url>/.test(sitemap)) throw new Error('maintenance robots or sitemap is unsafe');
      for (const file of htmlFiles) if (!/noindex,nofollow/.test(await readFile(file, 'utf8'))) throw new Error(`maintenance noindex missing in ${path.relative(outputPath, file)}`);
    } else if (!/Allow:\s*\//.test(robots) || !/<url>/.test(sitemap)) throw new Error('normal robots or sitemap is incomplete');
  });

  if (errors.length) throw new Error(`Site validation failed (${errors.length} problems):\n- ${errors.join('\n- ')}`);
  logger.log(`Site validation passed: ${checks.length} checks.`);
  return { checks, basePath };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const outputArgument = process.argv[2] || '_site';
  try { await validateSite({ outputPath: path.resolve(ROOT, outputArgument) }); }
  catch (error) { console.error(error.message || error); process.exitCode = 1; }
}
