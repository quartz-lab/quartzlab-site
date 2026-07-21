import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { validateSite } from '../scripts/validate-site.mjs';

test('deployment validation accepts the generated site', async () => {
  const messages = [];
  const result = await validateSite({ outputPath: path.resolve(import.meta.dirname, '..', '_site'), logger: { log: message => messages.push(message) } });
  assert.ok(result.checks.length >= 10);
  assert.match(messages.join('\n'), /Site validation passed/);
});

test('production validation rejects a leaked project Pages prefix', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'quartzlab-invalid-production-'));
  const sourceOutput = path.resolve(import.meta.dirname, '..', '_site');
  const outputPath = path.join(temporaryRoot, '_site');
  try {
    await cp(sourceOutput, outputPath, { recursive: true });
    const indexPath = path.join(outputPath, 'index.html');
    await writeFile(indexPath, `${await readFile(indexPath, 'utf8')}\n<!-- /quartzlab-site/ -->\n`, 'utf8');
    await assert.rejects(
      () => validateSite({ outputPath, logger: { log() {} } }),
      /production output has no project Pages base path:[\s\S]*\/quartzlab-site\//,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
