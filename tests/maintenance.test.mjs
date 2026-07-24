import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { buildSite } from '../scripts/build-site.mjs';
import {
  DEFAULT_SITE_CONFIG,
  resolveMaintenanceEnabled,
  validateSiteConfig,
} from '../scripts/lib/site-config.mjs';
import { renderMaintenancePage } from '../scripts/lib/site-render.mjs';
import { validateSite } from '../scripts/validate-site.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const LEGACY_ICON_PATTERN = new RegExp(['quartzlab', 'mark\\.svg'].join('-'), 'i');

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

test('site config validates brand URLs, nullable socials, and static maintenance settings', () => {
  assert.deepEqual(validateSiteConfig(DEFAULT_SITE_CONFIG), {
    brand: { name: 'QuartzLab', origin: 'https://quartzlab.ru' },
    socials: {
      github: 'https://github.com/quartz-lab',
      youtube: 'https://www.youtube.com/@quartz-lab',
      telegram: 'https://t.me/svetakpop1337',
      boosty: 'https://boosty.to/quartzlab',
    },
    maintenance: { enabled: false },
  });
  assert.throws(
    () => validateSiteConfig({ ...DEFAULT_SITE_CONFIG, maintenance: { enabled: true, retryAfterSeconds: 3600 } }),
    /not supported/i,
  );
  assert.throws(
    () => validateSiteConfig({ ...DEFAULT_SITE_CONFIG, socials: { ...DEFAULT_SITE_CONFIG.socials, github: 'ftp://example.com' } }),
    /absolute HTTPS URL/i,
  );
});

test('SITE_MAINTENANCE strictly overrides config without changing the fallback', () => {
  const configFalse = { ...DEFAULT_SITE_CONFIG, maintenance: { enabled: false } };
  const configTrue = { ...DEFAULT_SITE_CONFIG, maintenance: { enabled: true } };
  assert.equal(resolveMaintenanceEnabled(configFalse, { SITE_MAINTENANCE: 'true' }), true);
  assert.equal(resolveMaintenanceEnabled(configTrue, { SITE_MAINTENANCE: 'false' }), false);
  assert.equal(resolveMaintenanceEnabled(configTrue, {}), true);
  assert.equal(resolveMaintenanceEnabled(configFalse, {}), false);
  assert.throws(() => resolveMaintenanceEnabled(configFalse, { SITE_MAINTENANCE: 'yes' }), /exactly "true" or "false"/);
});

test('maintenance page is localized, index-safe, script-free, and supports a Pages base path', () => {
  const ru = renderMaintenancePage('ru', { basePath: '/quartzlab-site', siteOrigin: 'https://quartzlab.ru' });
  const en = renderMaintenancePage('en');
  assert.match(ru, /Проводим технические работы/);
  assert.match(en, /We are performing maintenance/);
  for (const html of [ru, en]) {
    assert.match(html, /noindex,nofollow/);
    assert.doesNotMatch(html, /<script\b/i);
    assert.doesNotMatch(html, /503|Retry-After/i);
    assert.match(html, /maintenance\.css/);
  }
  assert.match(ru, /<link rel="icon" href="\/quartzlab-site\/favicon\.svg" type="image\/svg\+xml">/);
  assert.match(ru, /href="\/quartzlab-site\/ru\/"/);
  assert.match(ru, /href="\/quartzlab-site\/en\/"/);
});

test('maintenance integration build validates all routes and leaves source config unchanged', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'quartzlab-maintenance-build-'));
  const outputPath = path.join(temporaryRoot, '_site');
  const configPath = path.join(ROOT, 'site.config.json');
  const configBefore = await readFile(configPath);
  try {
    const result = await buildSite({
      outputPath,
      environment: {
        ...process.env,
        SITE_ORIGIN: 'https://quartzlab.ru',
        SITE_BASE_PATH: '/',
        SITE_MAINTENANCE: 'true',
      },
    });
    assert.equal(result.maintenance, true);
    await validateSite({ root: ROOT, outputPath, expectedBasePath: '/', maintenance: true, logger: { log() {} } });

    const rootHtml = await readFile(path.join(outputPath, 'index.html'), 'utf8');
    const robots = await readFile(path.join(outputPath, 'robots.txt'), 'utf8');
    await readFile(path.join(outputPath, 'favicon.svg'));
    assert.match(rootHtml, /<meta name="robots" content="noindex,nofollow">/);
    assert.match(rootHtml, /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml">/);
    assert.match(robots, /^Disallow:\s*\/$/m);

    const manifest = JSON.parse(await readFile(path.join(outputPath, 'asset-manifest.json'), 'utf8'));
    assert.deepEqual(Object.keys(manifest.assets), ['/maintenance.css']);
    assert.match(manifest.assets['/maintenance.css'], /^\/hashed-assets\/maintenance\.[0-9a-f]{12}\.css$/);

    const routes = [
      'index.html', '404.html', 'ru/index.html', 'en/index.html',
      'ru/about/index.html', 'en/about/index.html',
      'ru/plugins/clipswitch/index.html', 'en/plugins/clipswitch/index.html',
      'ru/docs/clipswitch/index.html', 'en/docs/clipswitch/index.html',
    ];
    for (const route of routes) {
      const html = await readFile(path.join(outputPath, ...route.split('/')), 'utf8');
      assert.match(html, /\/hashed-assets\/maintenance\.[0-9a-f]{12}\.css/);
      assert.match(html, /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml">/);
      assert.doesNotMatch(html, /<script\b|language-redirect\.js/i);
      assert.doesNotMatch(html, LEGACY_ICON_PATTERN);
    }
    const outputFiles = await listFiles(outputPath);
    assert.equal(outputFiles.some(file => path.extname(file) === '.js'), false);
    for (const file of outputFiles.filter(file => ['.html', '.css', '.json', '.txt', '.xml'].includes(path.extname(file)))) {
      assert.doesNotMatch(await readFile(file, 'utf8'), /\/quartzlab-site\//);
    }
  } finally {
    assert.deepEqual(await readFile(configPath), configBefore);
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
