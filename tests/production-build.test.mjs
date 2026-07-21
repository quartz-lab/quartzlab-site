import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { buildSite } from '../scripts/build-site.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
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
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'quartzlab-production-build-'));
  const outputPath = path.join(temporaryRoot, '_site');
  try {
    const result = await buildSite({
      outputPath,
      environment: {
        ...process.env,
        SITE_ORIGIN: 'https://quartzlab.ru',
        SITE_BASE_PATH: '/',
      },
    });
    assert.equal(result.siteOrigin, 'https://quartzlab.ru');
    assert.equal(result.basePath, '/');

    const textExtensions = new Set(['.css', '.html', '.js', '.json', '.txt', '.xml']);
    const offenders = [];
    for (const file of await listFiles(outputPath)) {
      if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
      if ((await readFile(file, 'utf8')).includes(FORBIDDEN_PRODUCTION_PREFIX)) offenders.push(path.relative(outputPath, file));
    }
    assert.deepEqual(offenders, []);

    const rootHtml = await readFile(path.join(outputPath, 'index.html'), 'utf8');
    const notFoundHtml = await readFile(path.join(outputPath, '404.html'), 'utf8');
    assert.match(rootHtml, /href="\/ru\/"/);
    assert.match(rootHtml, /href="\/en\/"/);
    assert.doesNotMatch(rootHtml, /href="\/quartzlab-site\//);
    assert.match(notFoundHtml, /href="\/hashed-assets\/styles\.[a-f0-9]{12}\.css"/);
    assert.match(notFoundHtml, /src="\/hashed-assets\/site\.[a-f0-9]{12}\.js"/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('GitHub Pages workflow fixes the custom-domain production base path to root', async () => {
  const workflow = await readFile(path.join(ROOT, '.github', 'workflows', 'pages.yml'), 'utf8');
  assert.match(workflow, /SITE_ORIGIN:\s*https:\/\/quartzlab\.ru/);
  assert.match(workflow, /SITE_BASE_PATH:\s*\//);
  assert.doesNotMatch(workflow, /steps\.pages\.outputs\.base_path/);
});
