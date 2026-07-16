import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertReleaseVersionMatchesTag,
  cleanDocumentationHtml,
  detectLicense,
  formatUnityVersion,
  normalizeDocsRelativePath,
  normalizeReleaseVersion,
  parseGithubRepositoryUrl,
  sanitizeReleaseAssetCount,
  sumPublishedReleaseAssetCount,
  transformDocumentationHtml,
} from '../scripts/lib/plugin-sync.mjs';

test('parseGithubRepositoryUrl accepts repository root URLs', () => {
  assert.deepEqual(
    parseGithubRepositoryUrl('https://github.com/quartz-lab/clipswitch'),
    { owner: 'quartz-lab', repo: 'clipswitch' },
  );
});

test('parseGithubRepositoryUrl rejects non-root or non-github URLs', () => {
  assert.throws(
    () => parseGithubRepositoryUrl('https://github.com/quartz-lab/clipswitch/tree/main'),
    /repository root/i,
  );
  assert.throws(
    () => parseGithubRepositoryUrl('https://example.com/quartz-lab/clipswitch'),
    /GitHub repositories/i,
  );
});

test('sanitizeReleaseAssetCount counts only zip release assets', () => {
  const count = sanitizeReleaseAssetCount({
    assets: [
      { name: 'ClipSwitch.zip', download_count: 4 },
      { name: 'checksums.txt', download_count: 99 },
      { name: 'release-notes.md', download_count: 2 },
    ],
  });

  assert.equal(count, 4);
});

test('sumPublishedReleaseAssetCount aggregates zip downloads across published releases', () => {
  const count = sumPublishedReleaseAssetCount([
    {
      assets: [
        { name: 'ClipSwitch-1.0.0.zip', download_count: 4 },
        { name: 'notes.txt', download_count: 20 },
      ],
    },
    {
      assets: [
        { name: 'ClipSwitch-0.9.0.zip', download_count: 6 },
        { name: 'ClipSwitch-0.9.0.unitypackage', download_count: 7 },
      ],
    },
  ]);

  assert.equal(count, 10);
});

test('formatUnityVersion produces a minimum supported Unity label', () => {
  assert.equal(formatUnityVersion({ unity: '2022.3' }), '2022.3+');
  assert.equal(formatUnityVersion({ unity: '2022.3', unityRelease: '8' }), '2022.3.8+');
  assert.equal(formatUnityVersion({}), 'Not specified');
});

test('detectLicense maps known license texts', () => {
  assert.equal(detectLicense('MIT License\n\nPermission is hereby granted...'), 'MIT');
  assert.equal(detectLicense('Mozilla Public License Version 2.0'), 'MPL-2.0');
  assert.equal(detectLicense('Some internal custom terms'), 'Custom');
});

test('normalizeDocsRelativePath blocks traversal attempts', () => {
  assert.equal(normalizeDocsRelativePath('images/editor.webp'), 'images/editor.webp');
  assert.throws(() => normalizeDocsRelativePath('../secrets.txt'), /Unsafe documentation path/);
});

test('release version normalization strips leading v from tags', () => {
  assert.equal(normalizeReleaseVersion('v1.2.3'), '1.2.3');
  assert.equal(normalizeReleaseVersion('1.2.3'), '1.2.3');
});

test('assertReleaseVersionMatchesTag rejects mismatched package and release versions', () => {
  assert.doesNotThrow(() => assertReleaseVersionMatchesTag('1.2.3', 'v1.2.3'));
  assert.throws(
    () => assertReleaseVersionMatchesTag('1.2.4', 'v1.2.3'),
    /does not match release tag/i,
  );
});

test('transformDocumentationHtml extracts inline assets and injects local helpers', () => {
  const { html, assets } = transformDocumentationHtml(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Docs</title>
  <style>body { color: red; }</style>
</head>
<body>
  <h1>Docs</h1>
  <script>window.docsReady = true;</script>
</body>
</html>`, 'ru');

  assert.match(html, /<html[^>]*lang="ru"[^>]*data-route-language="ru"/i);
  assert.match(html, /<link rel="stylesheet" href="\.\/__doc-inline-style-1\.css">/i);
  assert.match(html, /<script src="\.\/__doc-inline-script-1\.js"><\/script>/i);
  assert.match(html, /<link rel="stylesheet" href="\/docs-theme\.css">/i);
  assert.match(html, /<script src="\/theme\.js"><\/script>/i);
  assert.match(html, /<script src="\.\/__route-language\.js"><\/script>/i);
  assert.doesNotMatch(html, /<style\b/i);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)/i);

  assert.deepEqual(
    assets.map(asset => asset.relativePath).sort(),
    ['__doc-inline-script-1.js', '__doc-inline-style-1.css', '__route-language.js'],
  );
});

test('cleanDocumentationHtml keeps only the route language and removes offline-only chrome', () => {
  const html = cleanDocumentationHtml(`<!doctype html>
<html lang="en"><body>
  <header class="topbar"><a class="brand">QuartzLab</a><span>ClipSwitch Documentation</span></header>
  <div class="language-switch"><button data-language="ru">RU</button><button data-language="en">EN</button></div>
  <div data-toc-language="ru"><a href="#ru-overview">Обзор</a></div>
  <div data-toc-language="en" hidden><a href="#en-overview">Overview</a></div>
  <article data-document-language="ru"><h1 id="ru-overview">Документация</h1></article>
  <article data-document-language="en" hidden><h1 id="en-overview">Documentation</h1><span>Offline documentation</span></article>
</body></html>`, 'en');

  assert.match(html, /id="en-overview"/);
  assert.match(html, /data-document-language="en"(?![^>]*hidden)/);
  assert.match(html, /data-toc-language="en"(?![^>]*hidden)/);
  assert.doesNotMatch(html, /id="ru-overview"/);
  assert.doesNotMatch(html, /language-switch/);
  assert.doesNotMatch(html, /class="topbar"/);
  assert.doesNotMatch(html, /ClipSwitch Documentation/);
  assert.doesNotMatch(html, /offline documentation/i);
});
