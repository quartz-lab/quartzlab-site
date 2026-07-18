import test from 'node:test';
import assert from 'node:assert/strict';

import { validateSite } from '../scripts/validate-site.mjs';

test('deployment validation accepts the generated site', async () => {
  const messages = [];
  const result = await validateSite({ logger: { log: message => messages.push(message) } });
  assert.ok(result.checks.length >= 10);
  assert.match(messages.join('\n'), /Site validation passed/);
});
