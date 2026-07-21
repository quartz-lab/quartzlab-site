import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

import { loadPluginConfig, parseGithubRepositoryUrl, syncPlugins } from './lib/plugin-sync.mjs';
import { findGeneratedAssetSources, fingerprintAssets } from './lib/site-assets.mjs';
import { loadSiteConfig, resolveMaintenanceEnabled } from './lib/site-config.mjs';
import { buildOptions } from './lib/site-paths.mjs';
import {
  renderAboutPage,
  renderHomePage,
  renderMaintenancePage,
  renderNotFoundPage,
  renderRobotsTxt,
  renderRootPage,
  renderSitemap,
} from './lib/site-render.mjs';
import { validateSite } from './validate-site.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_SOURCE = path.join(ROOT, 'site');
const DEFAULT_OUTPUT = path.join(ROOT, '_site');

async function writeText(outputPath, relativePath, contents) {
  const target = path.join(outputPath, ...relativePath.split('/'));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents, 'utf8');
}

function editableSources(maintenance) {
  const sources = maintenance ? [
    ['/maintenance.css', 'styles/maintenance.css'],
  ] : [
    ['/styles.css', 'styles/styles.css'],
    ['/docs-theme.css', 'styles/docs-theme.css'],
    ['/site.js', 'scripts/site.js'],
    ['/catalog-interactions.js', 'scripts/catalog-interactions.js'],
    ['/plugin-gallery.js', 'scripts/plugin-gallery.js'],
    ['/theme.js', 'scripts/theme.js'],
    ['/language-redirect.js', 'scripts/language-redirect.js'],
  ];
  return sources.map(([logicalPath, source]) => ({
    logicalPath,
    filePath: path.join(SITE_SOURCE, ...source.split('/')),
    removeAfterFingerprint: false,
  }));
}

async function renderNormalSite(outputPath, renderOptions) {
  const { plugins, downloads } = await syncPlugins({ outputPath, ...renderOptions });
  await Promise.all([
    writeText(outputPath, 'index.html', renderRootPage(renderOptions)),
    writeText(outputPath, '404.html', renderNotFoundPage(renderOptions)),
    writeText(outputPath, 'ru/index.html', renderHomePage(plugins, downloads, 'ru', renderOptions)),
    writeText(outputPath, 'en/index.html', renderHomePage(plugins, downloads, 'en', renderOptions)),
    writeText(outputPath, 'ru/about/index.html', renderAboutPage('ru', renderOptions)),
    writeText(outputPath, 'en/about/index.html', renderAboutPage('en', renderOptions)),
    writeText(outputPath, 'sitemap.xml', renderSitemap(plugins, renderOptions)),
    writeText(outputPath, 'robots.txt', renderRobotsTxt(renderOptions)),
  ]);
  return { plugins, maintenance: false };
}

async function renderMaintenanceSite(outputPath, renderOptions) {
  const configs = await loadPluginConfig();
  const slugs = configs.map(config => parseGithubRepositoryUrl(config.repository).repo.toLowerCase());
  const routes = [
    ['index.html', 'en'], ['404.html', 'en'], ['ru/index.html', 'ru'], ['en/index.html', 'en'],
    ['ru/about/index.html', 'ru'], ['en/about/index.html', 'en'],
  ];
  for (const slug of slugs) {
    for (const language of ['ru', 'en']) {
      routes.push([`${language}/plugins/${slug}/index.html`, language]);
      routes.push([`${language}/docs/${slug}/index.html`, language]);
    }
  }
  await Promise.all(routes.map(([route, language]) => writeText(outputPath, route, renderMaintenancePage(language, renderOptions))));
  await Promise.all([
    writeText(outputPath, 'robots.txt', 'User-agent: *\nDisallow: /\n'),
    writeText(outputPath, 'sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n'),
  ]);
  return { plugins: slugs.map(slug => ({ slug, documentationAvailable: true })), maintenance: true };
}

export async function buildSite({
  outputPath = DEFAULT_OUTPUT,
  environment = process.env,
  validate = true,
} = {}) {
  const siteConfig = await loadSiteConfig();
  const maintenance = resolveMaintenanceEnabled(siteConfig, environment);
  const renderOptions = {
    ...buildOptions(environment, { siteOrigin: siteConfig.brand.origin }),
    brand: siteConfig.brand,
    socials: siteConfig.socials,
  };
  await loadPluginConfig();

  await rm(outputPath, { recursive: true, force: true });
  await mkdir(outputPath, { recursive: true });
  await cp(path.join(SITE_SOURCE, 'assets'), path.join(outputPath, 'assets'), { recursive: true });

  const result = maintenance
    ? await renderMaintenanceSite(outputPath, renderOptions)
    : await renderNormalSite(outputPath, renderOptions);

  const generatedSources = await findGeneratedAssetSources(outputPath);
  const manifest = await fingerprintAssets({
    outputPath,
    sources: [...editableSources(maintenance), ...generatedSources],
    basePath: renderOptions.basePath,
  });

  if (validate) {
    await validateSite({ root: ROOT, outputPath, expectedBasePath: renderOptions.basePath, maintenance: result.maintenance });
  }
  return { ...result, manifest, outputPath, ...renderOptions };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    const result = await buildSite();
    console.log(`Built ${result.maintenance ? 'maintenance' : 'normal'} site in ${path.relative(ROOT, result.outputPath)} (${result.plugins.length} plugin(s), base path ${result.basePath}).`);
  } catch (error) {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  }
}
