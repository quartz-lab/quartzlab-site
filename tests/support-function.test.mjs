import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAnalyticsPayload,
  onRequestHead,
  onRequestGet,
  resolveSupportEvent,
  sanitizeLanguage,
  sanitizePathname,
  sanitizePlace,
  validateAnalyticsPayload,
} from '../functions/go/support.js';

test('support analytics event keeps only minimal fields', () => {
  const request = new Request(
    'https://quartzlab.example/go/support?place=plugin-side-note&lang=ru&page=/ru/plugins/clipswitch/?utm=x',
    {
      headers: {
        referer: 'https://quartzlab.example/ru/plugins/clipswitch/?utm_source=test',
        'user-agent': 'Example Browser',
      },
    },
  );

  const event = resolveSupportEvent(request);

  assert.equal(event.eventType, 'support_click');
  assert.equal(event.place, 'plugin-side-note');
  assert.equal(event.language, 'ru');
  assert.equal(event.pathname, '/ru/plugins/clipswitch');
});

test('support analytics falls back to same-origin referer pathname', () => {
  const request = new Request('https://quartzlab.example/go/support?place=home-footer&lang=en&page=javascript:alert(1)', {
    headers: {
      referer: 'https://quartzlab.example/en/about/?via=menu',
    },
  });

  const event = resolveSupportEvent(request);
  assert.equal(event.pathname, '/en/about');
});

test('support analytics ignores invalid place, language, and external referer data', () => {
  const request = new Request('https://quartzlab.example/go/support?place=../../etc&lang=de&page=not-a-path', {
    headers: {
      referer: 'https://other.example/tracker?x=1',
    },
  });

  const event = resolveSupportEvent(request);
  assert.equal(event.place, 'unknown');
  assert.equal(event.language, 'en');
  assert.equal(event.pathname, '/');
});

test('support redirect still works when analytics write fails', async () => {
  const response = await onRequestGet({
    request: new Request('https://quartzlab.example/go/support?place=home-header&lang=en&page=/en'),
    env: {
      SUPPORT_ANALYTICS: {
        async writeDataPoint() {
          throw new Error('write failed');
        },
      },
    },
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://boosty.to/quartzlab');
});

test('support HEAD request redirects without analytics write', async () => {
  const response = await onRequestHead();

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://boosty.to/quartzlab');
});

test('support redirect writes only event type, place, language, pathname, and counter', async () => {
  let captured;
  const response = await onRequestGet({
    request: new Request('https://quartzlab.example/go/support?place=about-cta&lang=ru&page=/ru/about'),
    env: {
      SUPPORT_ANALYTICS: {
        async writeDataPoint(payload) {
          captured = payload;
        },
      },
    },
  });

  assert.equal(response.status, 302);
  assert.deepEqual(captured.indexes, ['support_click']);
  assert.deepEqual(captured.blobs, ['about-cta', 'ru', '/ru/about']);
  assert.deepEqual(captured.doubles, [1]);
});

test('basic sanitizers stay strict', () => {
  assert.equal(sanitizePlace('Home-Footer'), 'home-footer');
  assert.equal(sanitizePlace('bad/place'), 'unknown');
  assert.equal(sanitizeLanguage('ru'), 'ru');
  assert.equal(sanitizeLanguage('fr'), 'en');
  assert.equal(sanitizePathname('/en/plugins/clipswitch/'), '/en/plugins/clipswitch');
  assert.equal(sanitizePathname('https://example.com'), '/');
});

test('analytics payload builder uses exactly one index', () => {
  const payload = buildAnalyticsPayload({
    eventType: 'support_click',
    place: 'home-footer',
    language: 'en',
    pathname: '/en/about',
  });

  assert.equal(payload.indexes.length, 1);
  assert.deepEqual(payload.indexes, ['support_click']);
  assert.deepEqual(payload.blobs, ['home-footer', 'en', '/en/about']);
  assert.deepEqual(payload.doubles, [1]);
});

test('analytics payload validation rejects more than one index', () => {
  assert.throws(
    () => validateAnalyticsPayload({
      indexes: ['support_click', 'extra'],
      blobs: ['home-footer', 'en', '/en/about'],
      doubles: [1],
    }),
    /exactly one index/i,
  );
});
