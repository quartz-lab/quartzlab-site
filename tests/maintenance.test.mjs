import test from 'node:test';
import assert from 'node:assert/strict';

import {
  handleMaintenanceRequest,
  isMaintenanceAssetPath,
} from '../functions/_middleware.js';

const enabled = { maintenance: { enabled: true, retryAfterSeconds: 3600 } };
const disabled = { maintenance: { enabled: false, retryAfterSeconds: 3600 } };

function context(pathname, { language = '', method = 'GET' } = {}) {
  let nextCalls = 0;
  return {
    value: {
      request: new Request(`https://quartzlab.example${pathname}`, {
        method,
        headers: language ? { 'Accept-Language': language } : {},
      }),
      async next() {
        nextCalls += 1;
        return new Response('next', { status: 200 });
      },
    },
    nextCalls: () => nextCalls,
  };
}

test('disabled maintenance passes requests through unchanged', async () => {
  const testContext = context('/ru/');
  const response = await handleMaintenanceRequest(testContext.value, disabled);
  assert.equal(response.status, 200);
  assert.equal(testContext.nextCalls(), 1);
});

test('enabled maintenance returns localized 503 responses with deployment-safe headers', async () => {
  for (const [pathname, text] of [
    ['/ru/plugins/clipswitch/', 'Ведутся технические работы'],
    ['/en/plugins/clipswitch/', 'Maintenance in progress'],
  ]) {
    const testContext = context(pathname);
    const response = await handleMaintenanceRequest(testContext.value, enabled);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('retry-after'), '3600');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(response.headers.get('location'), null, 'maintenance does not redirect');
    assert.match(await response.text(), new RegExp(text));
    assert.equal(testContext.nextCalls(), 0);
  }
});

test('Accept-Language chooses Russian outside explicit locale routes', async () => {
  const testContext = context('/', { language: 'ru-RU,ru;q=0.9,en;q=0.8' });
  const response = await handleMaintenanceRequest(testContext.value, enabled);
  assert.match(await response.text(), /QuartzLab временно недоступен/);
});

test('maintenance assets, support route, and Cloudflare internals remain available', async () => {
  for (const pathname of ['/assets/quartzlab-mark.svg', '/hashed-assets/site.abc.js', '/go/support', '/cdn-cgi/trace']) {
    assert.equal(isMaintenanceAssetPath(pathname), true);
    const testContext = context(pathname);
    const response = await handleMaintenanceRequest(testContext.value, enabled);
    assert.equal(response.status, 200);
    assert.equal(testContext.nextCalls(), 1);
  }
});

test('HEAD maintenance response has no body and cannot form a redirect loop', async () => {
  const testContext = context('/en/', { method: 'HEAD' });
  const response = await handleMaintenanceRequest(testContext.value, enabled);
  assert.equal(response.status, 503);
  assert.equal(await response.text(), '');
  assert.equal(response.headers.get('location'), null);
});
