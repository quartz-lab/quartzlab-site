import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  access,
  readdir,
  readFile,
} from 'node:fs/promises';

import { readJsonFile } from './lib/json-utils.mjs';
import { verifyGeneratedSiteConfig } from './lib/site-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEXT_EXTENSIONS = new Set([
  '.css', '.html', '.js', '.json', '.jsonc', '.md', '.mjs', '.txt', '.xml', '.yaml', '.yml',
]);
const IGNORED_DIRECTORIES = new Set(['.git', '.wrangler', 'node_modules']);
const CONFLICT_MARKER = /^(?:<<<<<<<|=======|>>>>>>>)(?:\s|$)/m;

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(target));
    if (entry.isFile()) files.push(target);
  }
  return files;
}

function publicFileFromUrl(publicPath, htmlFile, value) {
  const withoutSuffix = value.split(/[?#]/, 1)[0];
  if (!withoutSuffix || /^(?:[a-z][a-z\d+.-]*:|\/\/|data:|javascript:|#)/i.test(withoutSuffix)) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(withoutSuffix);
  } catch {
    decoded = withoutSuffix;
  }
  const target = decoded.startsWith('/')
    ? path.resolve(publicPath, `.${decoded}`)
    : path.resolve(path.dirname(htmlFile), decoded);
  const relative = path.relative(publicPath, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`asset URL escapes public/: ${value}`);
  }
  return target;
}

function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase())
    || ['_headers', '_redirects'].includes(path.basename(filePath));
}

async function expectFile(filePath, label) {
  try {
    await access(filePath);
  } catch (error) {
    throw new Error(`${label} is missing: ${filePath}`, { cause: error });
  }
}

export async function validateSite({ root = ROOT, logger = console } = {}) {
  const publicPath = path.join(root, 'public');
  const jsonPaths = {
    config: path.join(root, 'catalog', 'plugins.config.json'),
    manifest: path.join(publicPath, 'asset-manifest.json'),
    plugins: path.join(publicPath, 'data', 'plugins.json'),
    downloads: path.join(publicPath, 'data', 'downloads.json'),
  };
  const errors = [];
  const checks = [];
  const values = {};

  async function check(label, operation) {
    try {
      const value = await operation();
      checks.push(label);
      return value;
    } catch (error) {
      errors.push(`${label}: ${error.message || error}`);
      return undefined;
    }
  }

  for (const [name, filePath] of Object.entries(jsonPaths)) {
    values[name] = await check(`valid JSON ${path.relative(root, filePath)}`, () => readJsonFile(filePath));
  }

  await check('no Git conflict markers in text files', async () => {
    const files = (await listFiles(root)).filter(isTextFile);
    const conflicts = [];
    for (const file of files) {
      if (CONFLICT_MARKER.test(await readFile(file, 'utf8'))) conflicts.push(path.relative(root, file));
    }
    if (conflicts.length) throw new Error(`found in ${conflicts.join(', ')}`);
  });

  await check('generated Pages Functions config matches site.config.json', () => verifyGeneratedSiteConfig());

  if (values.manifest) {
    await check('all asset manifest targets exist', async () => {
      if (!values.manifest.assets || typeof values.manifest.assets !== 'object' || Array.isArray(values.manifest.assets)) {
        throw new Error('asset-manifest.json does not contain an assets object');
      }
      for (const [source, target] of Object.entries(values.manifest.assets)) {
        if (typeof source !== 'string' || typeof target !== 'string' || !target.startsWith('/')) {
          throw new Error(`invalid manifest entry ${source}: ${String(target)}`);
        }
        await expectFile(path.resolve(publicPath, `.${target}`), `manifest target for ${source}`);
      }
    });
  }

  await check('all local CSS and JavaScript links in generated HTML exist', async () => {
    const htmlFiles = (await listFiles(publicPath)).filter(file => path.extname(file).toLowerCase() === '.html');
    for (const htmlFile of htmlFiles) {
      const html = await readFile(htmlFile, 'utf8');
      for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+\.(?:css|js)(?:[?#][^"']*)?)["']/gi)) {
        const target = publicFileFromUrl(publicPath, htmlFile, match[1]);
        if (target) await expectFile(target, `${path.relative(publicPath, htmlFile)} reference ${match[1]}`);
      }
    }
  });

  if (values.plugins) {
    await check('plugin data and localized plugin routes are complete', async () => {
      if (!Array.isArray(values.plugins)) throw new Error('public/data/plugins.json must contain an array');
      for (const plugin of values.plugins) {
        if (!/^[a-z0-9-]+$/.test(plugin?.slug || '')) throw new Error(`invalid plugin slug: ${String(plugin?.slug)}`);
        for (const language of ['ru', 'en']) {
          await expectFile(
            path.join(publicPath, language, 'plugins', plugin.slug, 'index.html'),
            `${language.toUpperCase()} plugin page for ${plugin.slug}`,
          );
          if (plugin.documentationAvailable) {
            await expectFile(
              path.join(publicPath, language, 'docs', plugin.slug, 'index.html'),
              `${language.toUpperCase()} documentation page for ${plugin.slug}`,
            );
          }
        }
      }
    });
  }

  await check('sitemap.xml and robots.txt exist', async () => {
    await expectFile(path.join(publicPath, 'sitemap.xml'), 'sitemap.xml');
    await expectFile(path.join(publicPath, 'robots.txt'), 'robots.txt');
  });

  await check('public pages do not reference quartzlab-site.pages.dev', async () => {
    const files = (await listFiles(publicPath)).filter(file => [
      '.html', '.xml', '.txt',
    ].includes(path.extname(file).toLowerCase()));
    const offenders = [];
    for (const file of files) {
      if ((await readFile(file, 'utf8')).includes('quartzlab-site.pages.dev')) offenders.push(path.relative(publicPath, file));
    }
    if (offenders.length) throw new Error(`legacy Pages origin found in ${offenders.join(', ')}`);
  });

  if (values.plugins && values.manifest) {
    await check('localized catalogs load the generated plugins data and catalog script', async () => {
      if (!Array.isArray(values.plugins)) throw new Error('plugins.json is not an array');
      const catalogAsset = values.manifest.assets?.['/catalog.js'];
      if (!catalogAsset) throw new Error('asset manifest has no /catalog.js entry');
      for (const language of ['ru', 'en']) {
        const html = await readFile(path.join(publicPath, language, 'index.html'), 'utf8');
        if (!html.includes(catalogAsset)) throw new Error(`/${language}/ does not load ${catalogAsset}`);
      }
    });
  }

  if (errors.length) {
    throw new Error(`Site validation failed (${errors.length} problem${errors.length === 1 ? '' : 's'}):\n- ${errors.join('\n- ')}`);
  }

  logger.log(`Site validation passed: ${checks.length} checks.`);
  return { checks };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    await validateSite();
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
}
