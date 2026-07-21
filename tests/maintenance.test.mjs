import test from 'node:test';
import assert from 'node:assert/strict';

import { validateSiteConfig } from '../scripts/lib/site-config.mjs';
import { renderMaintenancePage } from '../scripts/lib/site-render.mjs';

test('maintenance configuration is a static boolean without Retry-After settings', () => {
  assert.deepEqual(validateSiteConfig({ maintenance: { enabled: true } }), { maintenance: { enabled: true } });
  assert.throws(() => validateSiteConfig({ maintenance: { enabled: true, retryAfterSeconds: 3600 } }), /not supported/i);
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
  assert.match(ru, /href="\/quartzlab-site\/ru\/"/);
  assert.match(ru, /href="\/quartzlab-site\/en\/"/);
});
