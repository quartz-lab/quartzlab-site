import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { fingerprintPublicAssets } from '../scripts/lib/site-assets.mjs';

test('fingerprint pipeline creates a missing manifest, updates HTML, and removes stale assets', async () => {
  const publicPath = await mkdtemp(path.join(os.tmpdir(), 'quartzlab-assets-'));

  try {
    await mkdir(path.join(publicPath, 'images'), { recursive: true });
    await writeFile(path.join(publicPath, 'styles.css'), 'body { background: url("./images/grid.svg"); color: black; }\n');
    await writeFile(path.join(publicPath, 'app.js'), 'document.documentElement.dataset.build = "one";\n');
    await writeFile(path.join(publicPath, 'images', 'grid.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n');
    await writeFile(
      path.join(publicPath, 'index.html'),
      '<!doctype html><link rel="stylesheet" href="/styles.css"><script src="/app.js"></script>\n',
    );

    const first = await fingerprintPublicAssets(publicPath);
    const firstManifestJson = await readFile(path.join(publicPath, 'asset-manifest.json'), 'utf8');
    assert.doesNotThrow(() => JSON.parse(firstManifestJson));
    const firstStylePath = first.assets['/styles.css'];
    const firstHtml = await readFile(path.join(publicPath, 'index.html'), 'utf8');
    const firstStyle = await readFile(path.join(publicPath, ...firstStylePath.slice(1).split('/')), 'utf8');
    assert.match(firstHtml, new RegExp(firstStylePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(firstStyle, /url\("\/images\/grid\.svg"\)/);

    await writeFile(path.join(publicPath, 'styles.css'), 'body { background: url("./images/grid.svg"); color: white; }\n');
    const second = await fingerprintPublicAssets(publicPath);
    const secondStylePath = second.assets['/styles.css'];
    const secondHtml = await readFile(path.join(publicPath, 'index.html'), 'utf8');

    assert.notEqual(secondStylePath, firstStylePath);
    assert.match(secondHtml, new RegExp(secondStylePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(secondHtml, new RegExp(firstStylePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await assert.rejects(access(path.join(publicPath, ...firstStylePath.slice(1).split('/'))));
    await access(path.join(publicPath, ...secondStylePath.slice(1).split('/')));

    const third = await fingerprintPublicAssets(publicPath);
    const thirdHtml = await readFile(path.join(publicPath, 'index.html'), 'utf8');
    assert.equal(third.assets['/styles.css'], secondStylePath, 'repeated generation keeps stable asset links');
    assert.equal((thirdHtml.match(/\/hashed-assets\/styles\./g) || []).length, 1);
    assert.doesNotMatch(thirdHtml, /\/hashed-assets\/hashed-assets\//);
    assert.equal((await readdir(publicPath)).filter(name => name.includes('.tmp')).length, 0);
  } finally {
    await rm(publicPath, { recursive: true, force: true });
  }
});

test('fingerprint pipeline warns and rebuilds a corrupted manifest instead of failing', async () => {
  const publicPath = await mkdtemp(path.join(os.tmpdir(), 'quartzlab-assets-corrupt-'));
  const warnings = [];
  const originalWarn = console.warn;

  try {
    await writeFile(path.join(publicPath, 'styles.css'), 'body { color: black; }\n');
    await mkdir(path.join(publicPath, 'hashed-assets'), { recursive: true });
    await writeFile(path.join(publicPath, 'hashed-assets', 'stale.aaaaaaaaaaaa.js'), 'stale\n');
    await writeFile(
      path.join(publicPath, 'index.html'),
      '<!doctype html><link rel="stylesheet" href="/hashed-assets/styles.111111111111.css">\n',
    );
    await writeFile(path.join(publicPath, 'asset-manifest.json'), '{\n<<<<<<< HEAD\n}\n');
    console.warn = message => warnings.push(String(message));

    const manifest = await fingerprintPublicAssets(publicPath);
    const html = await readFile(path.join(publicPath, 'index.html'), 'utf8');
    const rebuiltManifestJson = await readFile(path.join(publicPath, 'asset-manifest.json'), 'utf8');

    assert.match(warnings.join('\n'), /Ignoring invalid generated cache/);
    assert.doesNotThrow(() => JSON.parse(rebuiltManifestJson));
    assert.match(html, new RegExp(manifest.assets['/styles.css'].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await assert.rejects(access(path.join(publicPath, 'hashed-assets', 'stale.aaaaaaaaaaaa.js')));
    assert.doesNotMatch(html, /<<<<<<<|=======|>>>>>>>/);
  } finally {
    console.warn = originalWarn;
    await rm(publicPath, { recursive: true, force: true });
  }
});
