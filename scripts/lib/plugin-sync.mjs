import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONFIG_PATH = path.join(ROOT, 'catalog', 'plugins.config.json');
const PUBLIC_PATH = path.join(ROOT, 'public');
const DATA_PATH = path.join(PUBLIC_PATH, 'data');
const GENERATED_DOCS_PATH = path.join(PUBLIC_PATH, 'generated-docs');
const GITHUB_API = 'https://api.github.com';
const GITHUB_API_VERSION = '2026-03-10';
const USER_AGENT = 'quartzlab-site-sync/1.0';
const DOCS_SOURCE_DIR = 'Documentation~';
const DEFAULT_TIMEOUT_MS = 15000;
const SUPPORTED_LANGUAGES = ['en', 'ru'];
const GENERATED_DOC_ROUTE_SCRIPT = '__route-language.js';

const LICENSE_PATTERNS = [
  ['MIT License', 'MIT'],
  ['Apache License', 'Apache-2.0'],
  ['Mozilla Public License Version 2.0', 'MPL-2.0'],
  ['GNU GENERAL PUBLIC LICENSE', 'GPL'],
  ['BSD 3-Clause License', 'BSD-3-Clause'],
  ['BSD 2-Clause License', 'BSD-2-Clause'],
  ['ISC License', 'ISC'],
];

export function parseGithubRepositoryUrl(repositoryUrl) {
  let url;
  try {
    url = new URL(repositoryUrl);
  } catch {
    throw new Error(`Invalid repository URL: ${repositoryUrl}`);
  }

  if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
    throw new Error(`Only HTTPS GitHub repositories are supported: ${repositoryUrl}`);
  }

  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (parts.length !== 2) {
    throw new Error(`Repository URL must point to the repository root: ${repositoryUrl}`);
  }

  const [owner, repoWithGit] = parts;
  const repo = repoWithGit.replace(/\.git$/i, '');

  if (!owner || !repo) {
    throw new Error(`Repository URL is missing owner or repository name: ${repositoryUrl}`);
  }

  return { owner, repo };
}

export function sanitizeReleaseAssetCount(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const zipAssets = assets.filter(asset => /\.zip$/i.test(asset.name || ''));
  return zipAssets.reduce(
    (sum, asset) => sum + Math.max(0, Number(asset.download_count) || 0),
    0,
  );
}

export function sumPublishedReleaseAssetCount(releases) {
  return releases.reduce((sum, release) => sum + sanitizeReleaseAssetCount(release), 0);
}

export function formatUnityVersion(packageJson) {
  const unity = typeof packageJson?.unity === 'string' ? packageJson.unity.trim() : '';
  const unityRelease = typeof packageJson?.unityRelease === 'string'
    ? packageJson.unityRelease.trim()
    : '';

  if (!unity) {
    return 'Not specified';
  }

  return `${unityRelease ? `${unity}.${unityRelease}` : unity}+`;
}

export function detectLicense(licenseText) {
  const normalized = String(licenseText || '').trim();
  if (!normalized) {
    return 'Not specified';
  }

  for (const [pattern, label] of LICENSE_PATTERNS) {
    if (normalized.includes(pattern)) {
      return label;
    }
  }

  return 'Custom';
}

export function normalizeDocsRelativePath(relativePath) {
  const normalized = path.posix.normalize(relativePath).replace(/^\/+/, '');
  if (!normalized || normalized.startsWith('..') || path.posix.isAbsolute(normalized)) {
    throw new Error(`Unsafe documentation path: ${relativePath}`);
  }
  return normalized;
}

export function normalizeReleaseVersion(tagName) {
  return String(tagName || '').trim().replace(/^v/i, '');
}

export function assertReleaseVersionMatchesTag(packageJsonVersion, releaseTagName) {
  const version = String(packageJsonVersion || '').trim();
  const normalizedTag = normalizeReleaseVersion(releaseTagName);

  if (!version || !normalizedTag || version !== normalizedTag) {
    throw new Error(
      `package.json version "${version || '(missing)'}" does not match release tag "${releaseTagName}"`,
    );
  }
}

export function transformDocumentationHtml(html, routeLanguage) {
  const assets = [];
  const directory = '.';
  let styleIndex = 0;
  let scriptIndex = 0;

  let output = String(html);

  output = output.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_match, attrs, cssText) => {
    styleIndex += 1;
    const fileName = `__doc-inline-style-${styleIndex}.css`;
    const mediaMatch = String(attrs || '').match(/\smedia\s*=\s*(["'][^"']+["'])/i);
    assets.push({
      relativePath: path.posix.join(directory, fileName),
      contents: `${String(cssText).trim()}\n`,
      isBinary: false,
    });
    return `<link rel="stylesheet" href="./${fileName}"${mediaMatch ? ` media=${mediaMatch[1]}` : ''}>`;
  });

  output = output.replace(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi, (_match, attrs, scriptText) => {
    const typeMatch = String(attrs || '').match(/\stype\s*=\s*(["'][^"']+["'])/i);
    if (typeMatch && !/javascript|module/i.test(typeMatch[1])) {
      throw new Error(`Unsupported inline script type in documentation HTML: ${typeMatch[1]}`);
    }

    scriptIndex += 1;
    const fileName = `__doc-inline-script-${scriptIndex}.js`;
    assets.push({
      relativePath: path.posix.join(directory, fileName),
      contents: `${String(scriptText).trim()}\n`,
      isBinary: false,
    });
    return `<script src="./${fileName}"></script>`;
  });

  output = output.replace(/<html\b([^>]*)>/i, (_match, attrs) => {
    let nextAttrs = String(attrs || '');
    if (/\blang\s*=/.test(nextAttrs)) {
      nextAttrs = nextAttrs.replace(/\blang\s*=\s*(["']).*?\1/i, `lang="${routeLanguage}"`);
    } else {
      nextAttrs = `${nextAttrs} lang="${routeLanguage}"`;
    }

    if (/\bdata-route-language\s*=/.test(nextAttrs)) {
      nextAttrs = nextAttrs.replace(/\bdata-route-language\s*=\s*(["']).*?\1/i, `data-route-language="${routeLanguage}"`);
    } else {
      nextAttrs = `${nextAttrs} data-route-language="${routeLanguage}"`;
    }

    return `<html${nextAttrs}>`;
  });

  if (!output.includes('/theme.js')) {
    output = output.replace('</title>', '</title>\n  <script src="/theme.js"></script>');
  }

  if (!output.includes('/docs-theme.css')) {
    output = output.replace('</head>', '  <link rel="stylesheet" href="/docs-theme.css">\n</head>');
  }

  output = output.replace(
    '</head>',
    `  <script src="./${GENERATED_DOC_ROUTE_SCRIPT}"></script>\n</head>`,
  );

  assets.push({
    relativePath: path.posix.join(directory, GENERATED_DOC_ROUTE_SCRIPT),
    contents: [
      "'use strict';",
      '(() => {',
      `  const lang = ${JSON.stringify(routeLanguage)};`,
      '  if (lang === "en" || lang === "ru") {',
      '    try { localStorage.setItem("quartzlab-doc-language", lang); } catch (_) {}',
      '  }',
      '})();',
      '',
    ].join('\n'),
    isBinary: false,
  });

  if (/<style\b/i.test(output) || /<script(?![^>]*\bsrc=)/i.test(output)) {
    throw new Error('Documentation HTML still contains inline style or script blocks after extraction.');
  }

  return { html: output, assets };
}

function createAbortSignal(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function githubHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': USER_AGENT,
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function fetchGitHubJson(url, token) {
  const { signal, clear } = createAbortSignal();
  try {
    const response = await fetch(url, {
      headers: githubHeaders(token),
      signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub API ${response.status} for ${url}: ${text.slice(0, 240)}`);
    }

    return await response.json();
  } finally {
    clear();
  }
}

async function fetchGitHubRaw(url, token) {
  const { signal, clear } = createAbortSignal();
  try {
    const response = await fetch(url, {
      headers: {
        ...githubHeaders(token),
        Accept: 'application/vnd.github.raw',
      },
      signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub raw API ${response.status} for ${url}: ${text.slice(0, 240)}`);
    }

    return Buffer.from(await response.arrayBuffer());
  } finally {
    clear();
  }
}

async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function safeResolve(basePath, ...segments) {
  const targetPath = path.resolve(basePath, ...segments);
  const relative = path.relative(basePath, targetPath);

  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return targetPath;
  }

  throw new Error(`Resolved path escapes target directory: ${targetPath}`);
}

async function writeTextFile(targetPath, contents) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, contents, 'utf8');
}

async function writeBinaryFile(targetPath, contents) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, contents);
}

function sortPublishedReleases(releases) {
  return [...releases].sort((left, right) => {
    const leftTime = Date.parse(left.published_at || left.created_at || 0);
    const rightTime = Date.parse(right.published_at || right.created_at || 0);
    return rightTime - leftTime;
  });
}

function isNotFoundError(error) {
  return String(error.message || '').includes('GitHub API 404');
}

function generatedDocsBasePath(language) {
  return path.join(GENERATED_DOCS_PATH, language);
}

function validateHtmlDocument(filePath, contents) {
  const remoteResourcePattern = /<(?:script|img|iframe|video|audio|source|link)\b[^>]*(?:src|href)\s*=\s*["'](?:https?:)?\/\//i;
  const metaRefreshPattern = /<meta\b[^>]*http-equiv\s*=\s*["']refresh["']/i;
  const baseElementPattern = /<base\b/i;
  const javascriptUrlPattern = /\b(?:src|href)\s*=\s*["']javascript:/i;
  const inlineHandlerPattern = /\son[a-z]+\s*=/i;
  const styleAttributePattern = /\sstyle\s*=/i;

  if (remoteResourcePattern.test(contents)) {
    throw new Error(`Remote resource reference is not allowed in ${filePath}`);
  }

  if (metaRefreshPattern.test(contents)) {
    throw new Error(`Meta refresh is not allowed in ${filePath}`);
  }

  if (baseElementPattern.test(contents)) {
    throw new Error(`Base tags are not allowed in ${filePath}`);
  }

  if (javascriptUrlPattern.test(contents)) {
    throw new Error(`javascript: URLs are not allowed in ${filePath}`);
  }

  if (inlineHandlerPattern.test(contents)) {
    throw new Error(`Inline event handlers are not allowed in ${filePath}`);
  }

  if (styleAttributePattern.test(contents)) {
    throw new Error(`Inline style attributes are not allowed in ${filePath}`);
  }
}

function validateCssDocument(filePath, contents) {
  if (/@import\s+['"](?:https?:)?\/\//i.test(contents) || /url\(\s*['"]?(?:https?:)?\/\//i.test(contents)) {
    throw new Error(`Remote CSS imports are not allowed in ${filePath}`);
  }
}

function validateDocumentationTextFile(filePath, contents) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.html') {
    validateHtmlDocument(filePath, contents);
    return;
  }

  if (extension === '.css') {
    validateCssDocument(filePath, contents);
  }
}

async function cleanupGeneratedSlugDirectories(basePath, activeSlugs) {
  try {
    const entries = await readdir(basePath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      if (!activeSlugs.has(entry.name)) {
        await rm(path.join(basePath, entry.name), { recursive: true, force: true });
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function cleanupGeneratedOutput(activeSlugs) {
  for (const language of SUPPORTED_LANGUAGES) {
    await cleanupGeneratedSlugDirectories(generatedDocsBasePath(language), activeSlugs);
    await rm(path.join(PUBLIC_PATH, language, 'plugins'), { recursive: true, force: true });
    await rm(path.join(PUBLIC_PATH, language, 'docs'), { recursive: true, force: true });
  }

  await rm(path.join(PUBLIC_PATH, 'plugin-docs'), { recursive: true, force: true });
}

async function getRepositoryDirectory(owner, repo, directoryPath, ref, token) {
  const encodedPath = directoryPath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

  return fetchGitHubJson(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
    token,
  );
}

async function getRepositoryFile(owner, repo, filePath, ref, token) {
  const encodedPath = filePath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

  return fetchGitHubJson(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
    token,
  );
}

async function getRepositoryFileText(owner, repo, filePath, ref, token) {
  const encodedPath = filePath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
  const buffer = await fetchGitHubRaw(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
    token,
  );
  return buffer.toString('utf8');
}

async function tryGetRepositoryFileText(owner, repo, filePath, ref, token) {
  try {
    return await getRepositoryFileText(owner, repo, filePath, ref, token);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

async function collectDocumentationEntries(owner, repo, directoryPath, ref, token) {
  const entries = await getRepositoryDirectory(owner, repo, directoryPath, ref, token);
  if (!Array.isArray(entries)) {
    throw new Error(`${directoryPath} in ${owner}/${repo}@${ref} is not a directory`);
  }

  const files = [];
  for (const entry of entries) {
    if (entry.type === 'dir') {
      files.push(...await collectDocumentationEntries(owner, repo, entry.path, ref, token));
      continue;
    }

    if (entry.type !== 'file' || !entry.download_url) {
      throw new Error(
        `Unsupported documentation entry type "${entry.type}" in ${owner}/${repo}@${ref}: ${entry.path}`,
      );
    }

    files.push({
      path: entry.path,
      apiUrl: `${GITHUB_API}/repos/${owner}/${repo}/contents/${entry.path
        .split('/')
        .map(segment => encodeURIComponent(segment))
        .join('/')}?ref=${encodeURIComponent(ref)}`,
    });
  }

  return files;
}

async function loadDocumentationFiles(owner, repo, ref, token) {
  let entries;
  try {
    entries = await collectDocumentationEntries(owner, repo, DOCS_SOURCE_DIR, ref, token);
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const relativePath = normalizeDocsRelativePath(
      path.posix.relative(DOCS_SOURCE_DIR, entry.path),
    );
    const buffer = await fetchGitHubRaw(entry.apiUrl, token);
    files.push({
      relativePath,
      buffer,
      extension: path.extname(relativePath).toLowerCase(),
    });
  }

  return files;
}

async function writeDocumentationRoutes(slug, routeLanguage, documentationFiles) {
  if (!documentationFiles.length) {
    return false;
  }

  const targetDirectory = safeResolve(generatedDocsBasePath(routeLanguage), slug);
  await rm(targetDirectory, { recursive: true, force: true });
  await mkdir(targetDirectory, { recursive: true });

  let hasIndex = false;

  for (const file of documentationFiles) {
    const targetPath = safeResolve(targetDirectory, file.relativePath);

    if (file.extension === '.html') {
      const sourceText = file.buffer.toString('utf8');
      validateDocumentationTextFile(file.relativePath, sourceText);
      const { html, assets } = transformDocumentationHtml(sourceText, routeLanguage);
      await writeTextFile(targetPath, html);

      for (const asset of assets) {
        const assetPath = safeResolve(targetDirectory, path.posix.dirname(file.relativePath), asset.relativePath);
        await writeTextFile(assetPath, asset.contents);
      }
    } else if (['.css', '.js', '.svg', '.txt', '.json', '.xml'].includes(file.extension)) {
      const sourceText = file.buffer.toString('utf8');
      validateDocumentationTextFile(file.relativePath, sourceText);
      await writeTextFile(targetPath, sourceText);
    } else {
      await writeBinaryFile(targetPath, file.buffer);
    }

    if (file.relativePath === 'index.html') {
      hasIndex = true;
    }
  }

  if (!hasIndex) {
    throw new Error(`Documentation for ${slug} is missing Documentation~/index.html`);
  }

  return true;
}

export async function loadPluginConfig() {
  return readJsonFile(CONFIG_PATH);
}

export async function getPublicRepository(owner, repo, token) {
  const repository = await fetchGitHubJson(`${GITHUB_API}/repos/${owner}/${repo}`, token);
  if (repository.private) {
    throw new Error(`Private repositories are not allowed: ${owner}/${repo}`);
  }
  return repository;
}

export async function getPublishedReleases(owner, repo, token) {
  const releases = [];

  for (let page = 1; page <= 50; page += 1) {
    const batch = await fetchGitHubJson(
      `${GITHUB_API}/repos/${owner}/${repo}/releases?per_page=100&page=${page}`,
      token,
    );

    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }

    releases.push(...batch.filter(release => !release.draft && !release.prerelease));

    if (batch.length < 100) {
      break;
    }
  }

  return sortPublishedReleases(releases);
}

export async function getLatestPublishedRelease(owner, repo, token) {
  const releases = await getPublishedReleases(owner, repo, token);
  if (!releases.length) {
    throw new Error(`No published release found for ${owner}/${repo}`);
  }
  return releases[0];
}

async function resolveLicense(packageJson, owner, repo, ref, token) {
  if (typeof packageJson?.license === 'string' && packageJson.license.trim()) {
    return packageJson.license.trim();
  }

  for (const fileName of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md', 'LICENCE.txt']) {
    const text = await tryGetRepositoryFileText(owner, repo, fileName, ref, token);
    if (text) {
      return detectLicense(text);
    }
  }

  return 'Not specified';
}

function buildPluginRecord(config, release, packageJson, hasDocumentation) {
  const { owner, repo } = parseGithubRepositoryUrl(config.repository);
  const slug = repo.toLowerCase();
  const name = typeof packageJson?.displayName === 'string' && packageJson.displayName.trim()
    ? packageJson.displayName.trim()
    : repo;

  return {
    slug,
    name,
    category: config.category,
    version: packageJson.version.trim(),
    unityVersion: formatUnityVersion(packageJson),
    license: config.license,
    featured: Boolean(config.featured),
    updatedAt: String(release.published_at || release.created_at || '').slice(0, 10),
    cover: config.cover || '/assets/covers/placeholder.svg',
    media: Array.isArray(config.media) ? config.media : [],
    releaseUrl: release.html_url,
    repositoryUrl: `https://github.com/${owner}/${repo}`,
    documentationAvailable: hasDocumentation,
    assetStoreUrl: config.assetStoreUrl || null,
    tags: Array.isArray(config.tags) ? config.tags : [],
    i18n: config.i18n,
  };
}

function validatePluginConfig(config) {
  parseGithubRepositoryUrl(config.repository);

  if (!config.category?.en || !config.category?.ru) {
    throw new Error(`Plugin category must include English and Russian labels for ${config.repository}`);
  }

  if (!config.i18n?.en || !config.i18n?.ru) {
    throw new Error(`Plugin translations are missing for ${config.repository}`);
  }

  for (const language of SUPPORTED_LANGUAGES) {
    const localized = config.i18n[language];
    if (!localized.subtitle || !localized.description || !Array.isArray(localized.features)) {
      throw new Error(`Localized plugin content is incomplete for ${config.repository} (${language})`);
    }
  }
}

export async function syncPlugins() {
  const token = process.env.GITHUB_PUBLIC_READ_TOKEN || null;
  const configs = await loadPluginConfig();

  await mkdir(DATA_PATH, { recursive: true });
  await mkdir(GENERATED_DOCS_PATH, { recursive: true });

  const activeSlugs = new Set(configs.map(config => parseGithubRepositoryUrl(config.repository).repo.toLowerCase()));

  const plugins = [];
  const downloads = {};

  for (const config of configs) {
    validatePluginConfig(config);

    const { owner, repo } = parseGithubRepositoryUrl(config.repository);
    await getPublicRepository(owner, repo, token);

    const releases = await getPublishedReleases(owner, repo, token);
    if (!releases.length) {
      throw new Error(`No published release found for ${owner}/${repo}`);
    }

    const latestRelease = releases[0];
    const packageJson = JSON.parse(await getRepositoryFileText(owner, repo, 'package.json', latestRelease.tag_name, token));
    assertReleaseVersionMatchesTag(packageJson.version, latestRelease.tag_name);

    const documentationFiles = await loadDocumentationFiles(owner, repo, latestRelease.tag_name, token);
    let hasDocumentation = false;
    if (documentationFiles.length) {
      for (const language of SUPPORTED_LANGUAGES) {
        const written = await writeDocumentationRoutes(repo.toLowerCase(), language, documentationFiles);
        hasDocumentation = hasDocumentation || written;
      }
    }

    const license = await resolveLicense(packageJson, owner, repo, latestRelease.tag_name, token);
    const plugin = buildPluginRecord(
      { ...config, license },
      latestRelease,
      packageJson,
      hasDocumentation,
    );

    plugins.push(plugin);
    downloads[plugin.slug] = sumPublishedReleaseAssetCount(releases);
  }

  await cleanupGeneratedOutput(activeSlugs);

  plugins.sort((left, right) => {
    if (Number(right.featured) !== Number(left.featured)) {
      return Number(right.featured) - Number(left.featured);
    }
    return String(right.updatedAt).localeCompare(String(left.updatedAt));
  });

  const generatedAt = new Date().toISOString();
  await writeTextFile(
    path.join(DATA_PATH, 'plugins.json'),
    `${JSON.stringify(plugins, null, 2)}\n`,
  );
  await writeTextFile(
    path.join(DATA_PATH, 'downloads.json'),
    `${JSON.stringify({ generatedAt, plugins: downloads }, null, 2)}\n`,
  );

  return {
    generatedAt,
    downloads,
    plugins,
  };
}

export const paths = {
  config: CONFIG_PATH,
  data: DATA_PATH,
  generatedDocs: GENERATED_DOCS_PATH,
  root: ROOT,
};
