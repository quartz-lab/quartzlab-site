import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { renderPluginPage } from '../scripts/lib/site-render.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

function pluginWithMedia(media) {
  return {
    slug: 'example',
    name: 'Example',
    category: { en: 'Tools', ru: 'Инструменты' },
    version: '1.0.0',
    unityVersion: '2022.3+',
    license: 'MIT',
    featured: false,
    updatedAt: '2026-07-18',
    cover: '/assets/example.webp',
    media,
    releaseUrl: 'https://github.com/quartz-lab/example/releases/tag/v1.0.0',
    repositoryUrl: 'https://github.com/quartz-lab/example',
    documentationAvailable: false,
    assetStoreUrl: null,
    tags: [],
    i18n: {
      en: { subtitle: 'Example plugin', description: 'Example.', features: ['One'] },
      ru: { subtitle: 'Пример плагина', description: 'Пример.', features: ['Один'] },
    },
  };
}

test('single-image galleries render a native lazy full-screen dialog', () => {
  const html = renderPluginPage(pluginWithMedia([{
    type: 'image',
    src: '/assets/preview.webp',
    fullSrc: '/assets/full.png',
    alt: { en: 'Preview', ru: 'Превью' },
  }]), 0, 'en');

  assert.match(html, /<dialog class="media-lightbox"/);
  assert.match(html, /data-media-full-src="\/assets\/full\.png"/);
  assert.match(html, /data-open-lightbox/);
  assert.doesNotMatch(html, /<img data-lightbox-image[^>]+src=/);
});

test('video media stays lazy and YouTube embeds are created only by the gallery script', async () => {
  const html = renderPluginPage(pluginWithMedia([
    { type: 'youtube', url: 'https://www.youtube.com/watch?v=abcdefghi', title: { en: 'Demo', ru: 'Демо' } },
    { type: 'video', src: '/assets/demo.mp4', poster: '/assets/poster.webp' },
    { type: 'image', src: '/assets/preview.webp', alt: { en: 'Preview', ru: 'Превью' } },
  ]), 0, 'en');
  const script = await readFile(path.join(ROOT, 'site', 'scripts', 'plugin-gallery.js'), 'utf8');
  const css = await readFile(path.join(ROOT, 'site', 'styles', 'styles.css'), 'utf8');

  assert.doesNotMatch(html, /<iframe/);
  assert.match(html, /data-activate-media="0"/);
  assert.match(script, /youtube-nocookie\.com\/embed/);
  assert.match(script, /preload="none"/);
  assert.match(script, /ArrowLeft/);
  assert.match(script, /ArrowRight/);
  assert.match(script, /lightboxOpener\?\.focus/);
  assert.match(css, /\.media-lightbox img[\s\S]*object-fit:\s*contain/);
});
