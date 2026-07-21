import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { validateSite } from '../scripts/validate-site.mjs';

test('deployment validation accepts the generated site', async () => {
  const messages = [];
  const result = await validateSite({ outputPath: path.resolve(import.meta.dirname, '..', '_site'), logger: { log: message => messages.push(message) } });
  assert.ok(result.checks.length >= 10);
  assert.match(messages.join('\n'), /Site validation passed/);
});
