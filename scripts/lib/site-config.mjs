import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { atomicWriteJson } from './fs-utils.mjs';
import { readJsonFile } from './json-utils.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE_PATH = path.join(ROOT, 'site.config.json');

export function validateSiteConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('site.config.json must contain a JSON object.');
  }
  if (typeof config.maintenance?.enabled !== 'boolean') {
    throw new TypeError('site.config.json maintenance.enabled must be a boolean.');
  }
  if (Object.hasOwn(config.maintenance, 'retryAfterSeconds')) {
    throw new TypeError('site.config.json maintenance.retryAfterSeconds is not supported by static GitHub Pages.');
  }

  return { maintenance: { enabled: config.maintenance.enabled } };
}

export async function loadSiteConfig() {
  return validateSiteConfig(await readJsonFile(SOURCE_PATH));
}

export async function writeSiteConfig(config) {
  const validated = validateSiteConfig(config);
  await atomicWriteJson(SOURCE_PATH, validated);
  return validated;
}

export const siteConfigPaths = {
  root: ROOT,
  source: SOURCE_PATH,
};
