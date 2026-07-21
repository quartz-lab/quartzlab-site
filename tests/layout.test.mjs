import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUTPUT = path.join(ROOT, '_site');
const styles = await readFile(path.join(ROOT, 'site', 'styles', 'styles.css'), 'utf8');

test('shared page layout provides a non-overlaying sticky footer', () => {
  assert.match(styles, /html\s*{[^}]*min-height:\s*100%/s);
  assert.match(styles, /body\s*{[^}]*min-height:\s*100vh;[^}]*min-height:\s*100dvh;[^}]*display:\s*flex;[^}]*flex-direction:\s*column/s);
  assert.match(styles, /body\s*>\s*main,[^{]*body\.web-documentation-page\s*>\s*\.layout\s*{[^}]*flex:\s*1 0 auto;[^}]*min-width:\s*0/s);
  assert.match(styles, /\.site-footer\s*{[^}]*flex-shrink:\s*0;[^}]*margin-top:\s*auto/s);
  assert.doesNotMatch(styles, /\.site-footer\s*{[^}]*(?:position:\s*(?:fixed|absolute))/s);
});

test('catalog background uses a full-width section without viewport-width overflow', async () => {
  assert.doesNotMatch(styles, /\.catalog::before/);
  assert.doesNotMatch(styles, /\.catalog[^,{]*{[^}]*(?:width|inset|margin)[^;]*100vw/s);
  assert.match(styles, /\.catalog\s*{[^}]*border-top:[^}]*background:\s*var\(--catalog-bg\)/s);
  assert.match(styles, /\.catalog-shell\s*{[^}]*min-width:\s*0/s);

  for (const language of ['ru', 'en']) {
    const html = await readFile(path.join(OUTPUT, language, 'index.html'), 'utf8');
    assert.match(html, /<body>[\s\S]*<header class="site-header">[\s\S]*<main>[\s\S]*<section class="catalog" id="plugins"><div class="shell catalog-shell">[\s\S]*<\/main>[\s\S]*<footer class="site-footer">/);
    assert.doesNotMatch(html, /class="catalog shell"/);
  }
});
