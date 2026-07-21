import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { atomicWriteJson } from './fs-utils.mjs';
import { readJsonFile } from './json-utils.mjs';
import { normalizeSiteOrigin } from './site-paths.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE_PATH = path.join(ROOT, 'site.config.json');

export const DEFAULT_SITE_CONFIG = Object.freeze({
  brand: Object.freeze({ name: 'QuartzLab', origin: 'https://quartzlab.ru' }),
  socials: Object.freeze({
    github: 'https://github.com/quartz-lab',
    youtube: 'https://www.youtube.com/@quartz-lab',
    telegram: null,
    boosty: 'https://boosty.to/quartzlab',
  }),
  maintenance: Object.freeze({ enabled: false }),
});

function validateSocialUrl(value, key) {
  if (value === null) return null;
  if (typeof value !== 'string' || !value) {
    throw new TypeError(`site.config.json socials.${key} must be an absolute HTTPS URL or null.`);
  }
  let url;
  try { url = new URL(value); }
  catch { throw new TypeError(`site.config.json socials.${key} must be an absolute HTTPS URL or null.`); }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new TypeError(`site.config.json socials.${key} must be an absolute HTTPS URL without credentials.`);
  }
  return url.href.replace(/\/$/, value.endsWith('/') ? '/' : '');
}

export function validateSiteConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('site.config.json must contain a JSON object.');
  }
  if (typeof config.brand?.name !== 'string' || !config.brand.name.trim()) {
    throw new TypeError('site.config.json brand.name must be a non-empty string.');
  }
  if (typeof config.brand?.origin !== 'string' || !config.brand.origin) {
    throw new TypeError('site.config.json brand.origin must be a clean HTTPS origin.');
  }
  const origin = normalizeSiteOrigin(config.brand?.origin);
  if (!config.socials || typeof config.socials !== 'object' || Array.isArray(config.socials)) {
    throw new TypeError('site.config.json socials must contain a JSON object.');
  }
  if (typeof config.maintenance?.enabled !== 'boolean') {
    throw new TypeError('site.config.json maintenance.enabled must be a boolean.');
  }
  if (Object.hasOwn(config.maintenance, 'retryAfterSeconds')) {
    throw new TypeError('site.config.json maintenance.retryAfterSeconds is not supported by static GitHub Pages.');
  }

  return {
    brand: { name: config.brand.name.trim(), origin },
    socials: {
      github: validateSocialUrl(config.socials.github, 'github'),
      youtube: validateSocialUrl(config.socials.youtube, 'youtube'),
      telegram: validateSocialUrl(config.socials.telegram, 'telegram'),
      boosty: validateSocialUrl(config.socials.boosty, 'boosty'),
    },
    maintenance: { enabled: config.maintenance.enabled },
  };
}

export function resolveMaintenanceEnabled(config, environment = process.env) {
  const configured = validateSiteConfig(config).maintenance.enabled;
  const override = environment?.SITE_MAINTENANCE;
  if (override === undefined) return configured;
  if (override === 'true') return true;
  if (override === 'false') return false;
  throw new TypeError('SITE_MAINTENANCE must be exactly "true" or "false" when set.');
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
