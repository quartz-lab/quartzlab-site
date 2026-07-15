import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest, parseLegacyRoute } from '../functions/_middleware.js';

test('parseLegacyRoute matches only legacy plugin and docs URLs', () => {
  assert.deepEqual(parseLegacyRoute('/ru/plugins/clipswitch/'), {
    language: 'ru',
    section: 'plugins',
    slug: 'clipswitch',
  });
  assert.deepEqual(parseLegacyRoute('/en/docs/clipswitch'), {
    language: 'en',
    section: 'docs',
    slug: 'clipswitch',
  });
  assert.equal(parseLegacyRoute('/plugin.html?lang=ru&slug=clipswitch'), null);
  assert.equal(parseLegacyRoute('/generated-docs/en/clipswitch/'), null);
});

test('legacy plugin route redirects to query-based plugin page', async () => {
  const response = await onRequest({
    request: new Request('https://quartzlab.example/ru/plugins/clipswitch/'),
    next() {
      throw new Error('next should not be called');
    },
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://quartzlab.example/plugin.html?lang=ru&slug=clipswitch');
});

test('legacy docs route redirects to query-based docs page', async () => {
  const response = await onRequest({
    request: new Request('https://quartzlab.example/en/docs/clipswitch'),
    next() {
      throw new Error('next should not be called');
    },
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://quartzlab.example/docs.html?lang=en&slug=clipswitch');
});

test('middleware falls through for non-legacy paths and non-GET methods', async () => {
  let called = 0;
  const next = () => {
    called += 1;
    return new Response(null, { status: 204 });
  };

  const first = await onRequest({
    request: new Request('https://quartzlab.example/en/'),
    next,
  });
  const second = await onRequest({
    request: new Request('https://quartzlab.example/ru/plugins/clipswitch/', { method: 'POST' }),
    next,
  });

  assert.equal(first.status, 204);
  assert.equal(second.status, 204);
  assert.equal(called, 2);
});
