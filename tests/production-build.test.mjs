import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUTPUT = path.join(ROOT, '_site');
const FORBIDDEN_PRODUCTION_PREFIX = '/quartzlab-site/';

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

test('production build is rooted at quartzlab.ru and contains no project Pages prefix', async () => {
  const manifest = JSON.parse(await readFile(path.join(OUTPUT, 'asset-manifest.json'), 'utf8'));
  assert.equal(manifest.basePath, '/');

  const textExtensions = new Set(['.css', '.html', '.js', '.json', '.txt', '.xml']);
  const offenders = [];
  for (const file of await listFiles(OUTPUT)) {
    if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
    if ((await readFile(file, 'utf8')).includes(FORBIDDEN_PRODUCTION_PREFIX)) offenders.push(path.relative(OUTPUT, file));
  }
  assert.deepEqual(offenders, []);

  const rootHtml = await readFile(path.join(OUTPUT, 'index.html'), 'utf8');
  const notFoundHtml = await readFile(path.join(OUTPUT, '404.html'), 'utf8');
  await readFile(path.join(OUTPUT, 'favicon.svg'));
  assert.match(rootHtml, /<link rel="canonical" href="https:\/\/quartzlab\.ru\/">/);
  assert.match(rootHtml, /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml">/);
  assert.match(rootHtml, /href="\/ru\/"/);
  assert.match(rootHtml, /href="\/en\/"/);
  assert.doesNotMatch(rootHtml, /href="\/quartzlab-site\//);
  assert.match(notFoundHtml, /href="\/hashed-assets\/styles\.[a-f0-9]{12}\.css"/);
  assert.match(notFoundHtml, /src="\/hashed-assets\/site\.[a-f0-9]{12}\.js"/);
});

test('GitHub Pages workflow fixes the custom-domain production base path to root', async () => {
  const workflow = await readFile(path.join(ROOT, '.github', 'workflows', 'pages.yml'), 'utf8');
  assert.match(workflow, /SITE_ORIGIN:\s*https:\/\/quartzlab\.ru/);
  assert.match(workflow, /SITE_BASE_PATH:\s*\//);
  assert.match(workflow, /SITE_MAINTENANCE:\s*\$\{\{ vars\.SITE_MAINTENANCE \|\| 'false' \}\}/);
  assert.doesNotMatch(workflow, /steps\.pages\.outputs\.base_path/);
});
