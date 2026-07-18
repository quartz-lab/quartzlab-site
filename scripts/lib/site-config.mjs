import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

import { atomicWriteFile, atomicWriteJson } from './fs-utils.mjs';
import { readJsonFile } from './json-utils.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE_PATH = path.join(ROOT, 'site.config.json');
const GENERATED_PATH = path.join(ROOT, 'functions', 'generated', 'site-config.js');

export function validateSiteConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('site.config.json must contain a JSON object.');
  }
  if (typeof config.maintenance?.enabled !== 'boolean') {
    throw new TypeError('site.config.json maintenance.enabled must be a boolean.');
  }
  const retryAfterSeconds = Number(config.maintenance.retryAfterSeconds);
  if (!Number.isInteger(retryAfterSeconds) || retryAfterSeconds < 1 || retryAfterSeconds > 604800) {
    throw new TypeError('site.config.json maintenance.retryAfterSeconds must be an integer from 1 to 604800.');
  }

  return {
    maintenance: {
      enabled: config.maintenance.enabled,
      retryAfterSeconds,
    },
  };
}

export function renderGeneratedSiteConfig(config) {
  const validated = validateSiteConfig(config);
  return `// Generated from site.config.json by scripts/maintenance.mjs. Do not edit manually.\nexport const siteConfig = Object.freeze(${JSON.stringify(validated, null, 2)});\n`;
}

export async function loadSiteConfig() {
  return validateSiteConfig(await readJsonFile(SOURCE_PATH));
}

export async function writeSiteConfig(config) {
  const validated = validateSiteConfig(config);
  await atomicWriteJson(SOURCE_PATH, validated);
  return validated;
}

export async function writeGeneratedSiteConfig(config) {
  const validated = validateSiteConfig(config || await loadSiteConfig());
  await atomicWriteFile(GENERATED_PATH, renderGeneratedSiteConfig(validated), 'utf8');
  return validated;
}

export async function verifyGeneratedSiteConfig(config) {
  const validated = validateSiteConfig(config || await loadSiteConfig());
  const expected = renderGeneratedSiteConfig(validated);
  const actual = await readFile(GENERATED_PATH, 'utf8');
  if (actual !== expected) {
    throw new Error(`${GENERATED_PATH} is out of date. Run node scripts/maintenance.mjs ${validated.maintenance.enabled ? 'on' : 'off'}.`);
  }
  return validated;
}

export const siteConfigPaths = {
  generated: GENERATED_PATH,
  root: ROOT,
  source: SOURCE_PATH,
};
