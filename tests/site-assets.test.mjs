import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { fingerprintAssets } from '../scripts/lib/site-assets.mjs';

const hash12 = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 12);

async function temporaryFixture(prefix) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  const source = path.join(root, 'source');
  const output = path.join(root, 'output');
  await mkdir(source); await mkdir(output);
  return { root, source, output };
}

test('clean fingerprint ignores a wrong old manifest and stale incorrectly named asset', async () => {
  const fixture = await temporaryFixture('quartzlab-stale-assets-');
  try {
    const sourceFile = path.join(fixture.source, 'catalog.js');
    const sourceBytes = Buffer.from("document.documentElement.dataset.catalog = 'current';\n");
    await writeFile(sourceFile, sourceBytes);
    await mkdir(path.join(fixture.output, 'hashed-assets'));
    await writeFile(path.join(fixture.output, 'hashed-assets', 'catalog.2e3f44e91a65.js'), sourceBytes);
    await writeFile(path.join(fixture.output, 'asset-manifest.json'), '{"assets":{"/catalog.js":"/hashed-assets/catalog.2e3f44e91a65.js"}}\n');
    await writeFile(path.join(fixture.output, 'index.html'), '<script src="/catalog.js"></script>\n');

    const manifest = await fingerprintAssets({ outputPath: fixture.output, sources: [{ logicalPath: '/catalog.js', filePath: sourceFile }] });
    const expected = `/hashed-assets/catalog.${hash12(sourceBytes)}.js`;
    assert.equal(manifest.assets['/catalog.js'], expected);
    assert.match(await readFile(path.join(fixture.output, 'index.html'), 'utf8'), new RegExp(expected.replaceAll('.', '\\.')));
    assert.deepEqual(await readdir(path.join(fixture.output, 'hashed-assets')), [path.basename(expected)]);
    await assert.rejects(access(path.join(fixture.output, 'hashed-assets', 'catalog.2e3f44e91a65.js')));
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test('fingerprints normalize Windows and Linux line endings and verify written bytes', async () => {
  const left = await temporaryFixture('quartzlab-lf-');
  const right = await temporaryFixture('quartzlab-crlf-');
  try {
    const leftFile = path.join(left.source, 'app.js');
    const rightFile = path.join(right.source, 'app.js');
    await writeFile(leftFile, 'const one = 1;\nconst two = 2;\n');
    await writeFile(rightFile, 'const one = 1;\r\nconst two = 2;\r\n');
    await writeFile(path.join(left.output, 'index.html'), '<script src="/app.js"></script>');
    await writeFile(path.join(right.output, 'index.html'), '<script src="/app.js"></script>');
    const a = await fingerprintAssets({ outputPath: left.output, sources: [{ logicalPath: '/app.js', filePath: leftFile }] });
    const b = await fingerprintAssets({ outputPath: right.output, sources: [{ logicalPath: '/app.js', filePath: rightFile }] });
    assert.equal(a.assets['/app.js'], b.assets['/app.js']);
    const bytes = await readFile(path.join(left.output, ...a.assets['/app.js'].slice(1).split('/')));
    assert.match(path.basename(a.assets['/app.js']), new RegExp(`\\.${hash12(bytes)}\\.js$`));
  } finally {
    await rm(left.root, { recursive: true, force: true });
    await rm(right.root, { recursive: true, force: true });
  }
});

test('fingerprinted HTML and CSS honor a GitHub Pages project base path', async () => {
  const fixture = await temporaryFixture('quartzlab-base-path-');
  try {
    const cssFile = path.join(fixture.source, 'styles.css');
    await writeFile(cssFile, 'body { background: url("/assets/grid.svg"); }\n');
    await writeFile(path.join(fixture.output, 'index.html'), '<link rel="stylesheet" href="/quartzlab-site/styles.css">');
    const manifest = await fingerprintAssets({ outputPath: fixture.output, basePath: '/quartzlab-site', sources: [{ logicalPath: '/styles.css', filePath: cssFile }] });
    assert.match(manifest.assets['/styles.css'], /^\/quartzlab-site\/hashed-assets\//);
    const target = manifest.assets['/styles.css'].slice('/quartzlab-site'.length);
    assert.match(await readFile(path.join(fixture.output, ...target.slice(1).split('/')), 'utf8'), /url\("\/quartzlab-site\/assets\/grid\.svg"\)/);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});
