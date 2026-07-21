import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  access,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';

import { atomicWriteJson } from './fs-utils.mjs';
import { normalizeBasePath, withBasePath } from './site-paths.mjs';

const HASH_LENGTH = 12;
const HASHED_DIRECTORY = 'hashed-assets';
const MANIFEST_FILE = 'asset-manifest.json';

function toPosix(value) {
  return String(value).replaceAll(path.sep, '/');
}

function normalizeTextBytes(buffer) {
  return Buffer.from(buffer.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'), 'utf8');
}

function digest(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(target));
    if (entry.isFile()) files.push(target);
  }
  return files;
}

function normalizeLogicalPath(value) {
  const normalized = path.posix.normalize(`/${toPosix(value).replace(/^\/+/, '')}`);
  if (!/^\/[A-Za-z0-9._/-]+\.(?:css|js)$/.test(normalized) || normalized.includes('/../')) {
    throw new Error(`Invalid fingerprint source path: ${value}`);
  }
  if (normalized.startsWith(`/${HASHED_DIRECTORY}/`)) {
    throw new Error(`Already fingerprinted files cannot be fingerprint sources: ${value}`);
  }
  return normalized;
}

function rewriteCssUrls(css, logicalPath, basePath) {
  const logicalDirectory = path.posix.dirname(logicalPath);
  const baseUrl = `https://quartzlab.invalid${logicalDirectory === '/' ? '/' : `${logicalDirectory}/`}`;

  return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (match, quote, rawValue) => {
    const value = rawValue.trim();
    if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|data:|#|\?)/i.test(value)) return match;
    const logicalTarget = value.startsWith('/')
      ? value
      : new URL(value, baseUrl).pathname;
    return `url(${quote}${withBasePath(logicalTarget, basePath)}${quote})`;
  });
}

function targetFor(logicalPath, hash) {
  const extension = path.posix.extname(logicalPath);
  const directory = path.posix.dirname(logicalPath).replace(/^\//, '');
  const baseName = path.posix.basename(logicalPath, extension);
  return path.posix.join(
    '/',
    HASHED_DIRECTORY,
    directory,
    `${baseName}.${hash.slice(0, HASH_LENGTH)}${extension}`,
  );
}

function logicalReference(value, htmlRelativePath, basePath) {
  if (!/\.(?:css|js)(?:[?#]|$)/i.test(value) || /^(?:[a-z][a-z\d+.-]*:|\/\/|data:|javascript:|#)/i.test(value)) {
    return null;
  }
  const suffixIndex = value.search(/[?#]/);
  const withoutSuffix = suffixIndex < 0 ? value : value.slice(0, suffixIndex);
  const suffix = suffixIndex < 0 ? '' : value.slice(suffixIndex);
  const normalizedBase = normalizeBasePath(basePath);
  let pathname;

  if (withoutSuffix.startsWith('/')) {
    pathname = withoutSuffix;
    if (normalizedBase !== '/' && (pathname === normalizedBase || pathname.startsWith(`${normalizedBase}/`))) {
      pathname = pathname.slice(normalizedBase.length) || '/';
    }
  } else {
    const htmlDirectory = path.posix.dirname(`/${htmlRelativePath}`);
    const baseUrl = `https://quartzlab.invalid${htmlDirectory === '/' ? '/' : `${htmlDirectory}/`}`;
    pathname = new URL(withoutSuffix, baseUrl).pathname;
  }

  return { pathname: path.posix.normalize(pathname), suffix };
}

async function rewriteHtml(outputPath, manifestAssets, basePath) {
  const htmlFiles = (await listFiles(outputPath)).filter(file => path.extname(file).toLowerCase() === '.html');
  for (const htmlFile of htmlFiles) {
    const htmlRelativePath = toPosix(path.relative(outputPath, htmlFile));
    const original = await readFile(htmlFile, 'utf8');
    const rewritten = original.replace(
      /\b(src|href)\s*=\s*(["'])([^"']+)\2/gi,
      (match, attribute, quote, value) => {
        const reference = logicalReference(value, htmlRelativePath, basePath);
        const target = reference && manifestAssets[reference.pathname];
        return target ? `${attribute}=${quote}${target}${reference.suffix}${quote}` : match;
      },
    );
    if (rewritten !== original) await writeFile(htmlFile, rewritten, 'utf8');
  }
}

export async function findGeneratedAssetSources(outputPath) {
  const files = await listFiles(outputPath);
  return files
    .filter(file => ['.css', '.js'].includes(path.extname(file).toLowerCase()))
    .filter(file => !toPosix(path.relative(outputPath, file)).startsWith(`${HASHED_DIRECTORY}/`))
    .map(file => ({
      filePath: file,
      logicalPath: `/${toPosix(path.relative(outputPath, file))}`,
      removeAfterFingerprint: true,
    }));
}

export async function fingerprintAssets({ outputPath, sources, basePath = '/' }) {
  const normalizedBase = normalizeBasePath(basePath);
  const hashedPath = path.join(outputPath, HASHED_DIRECTORY);
  await rm(hashedPath, { recursive: true, force: true });

  const normalizedSources = sources.map(source => ({
    ...source,
    logicalPath: normalizeLogicalPath(source.logicalPath),
  })).sort((left, right) => left.logicalPath.localeCompare(right.logicalPath));
  const seen = new Set();
  for (const source of normalizedSources) {
    if (seen.has(source.logicalPath)) throw new Error(`Duplicate fingerprint source: ${source.logicalPath}`);
    seen.add(source.logicalPath);
  }

  const assets = {};
  for (const source of normalizedSources) {
    const extension = path.extname(source.filePath).toLowerCase();
    const normalizedBytes = normalizeTextBytes(await readFile(source.filePath));
    const outputBytes = extension === '.css'
      ? Buffer.from(rewriteCssUrls(normalizedBytes.toString('utf8'), source.logicalPath, normalizedBase), 'utf8')
      : normalizedBytes;
    const hash = digest(outputBytes);
    const logicalTarget = targetFor(source.logicalPath, hash);
    const targetFile = path.join(outputPath, ...logicalTarget.slice(1).split('/'));

    await mkdir(path.dirname(targetFile), { recursive: true });
    await writeFile(targetFile, outputBytes);
    const writtenBytes = await readFile(targetFile);
    if (!writtenBytes.equals(outputBytes) || digest(writtenBytes) !== hash) {
      throw new Error(`Fingerprint verification failed after writing ${targetFile}`);
    }
    if (!path.basename(targetFile).includes(`.${hash.slice(0, HASH_LENGTH)}.`)) {
      throw new Error(`Fingerprint filename does not match content: ${targetFile}`);
    }
    assets[source.logicalPath] = withBasePath(logicalTarget, normalizedBase);
  }

  await rewriteHtml(outputPath, assets, normalizedBase);

  for (const source of normalizedSources.filter(item => item.removeAfterFingerprint)) {
    const relative = path.relative(outputPath, source.filePath);
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) await rm(source.filePath, { force: true });
  }

  for (const target of Object.values(assets)) {
    const withoutBase = normalizedBase === '/' ? target : target.slice(normalizedBase.length);
    await access(path.join(outputPath, ...withoutBase.slice(1).split('/')));
  }

  const manifest = { version: 2, basePath: normalizedBase, assets };
  await atomicWriteJson(path.join(outputPath, MANIFEST_FILE), manifest);
  return manifest;
}

export const assetPipeline = {
  hashedDirectory: HASHED_DIRECTORY,
  hashLength: HASH_LENGTH,
  manifestFile: MANIFEST_FILE,
};
