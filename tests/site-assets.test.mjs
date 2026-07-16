import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { fingerprintPublicAssets } from '../scripts/lib/site-assets.mjs';

test('fingerprint pipeline updates HTML and removes assets from the previous build', async () => {
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
  } finally {
    await rm(publicPath, { recursive: true, force: true });
  }
});
