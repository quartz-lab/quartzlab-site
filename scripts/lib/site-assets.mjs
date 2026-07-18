import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { atomicWriteJson } from './fs-utils.mjs';

const HASH_LENGTH = 12;
const HASHED_DIRECTORY = 'hashed-assets';
const MANIFEST_FILE = 'asset-manifest.json';

function toPosixPath(value) {
  return String(value).replaceAll(path.sep, '/');
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(target));
    } else if (entry.isFile()) {
      files.push(target);
    }
  }

  return files;
}

async function readPreviousManifest(publicPath) {
  const manifestPath = path.join(publicPath, MANIFEST_FILE);
  let contents;
  try {
    contents = await readFile(manifestPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }

  try {
    const manifest = JSON.parse(contents);
    if (!manifest || typeof manifest.assets !== 'object' || Array.isArray(manifest.assets)) {
      throw new TypeError('the manifest does not contain a valid assets map');
    }
    return manifest;
  } catch (error) {
    if (!(error instanceof SyntaxError) && !(error instanceof TypeError)) throw error;
    console.warn(
      `[site-assets] Ignoring invalid generated cache ${manifestPath}: ${error.message}. `
      + 'Hashed assets and the manifest will be rebuilt.',
    );
    return null;
  }
}

async function restoreSourceAssetReferences(publicPath, manifest) {
  const reverseEntries = Object.entries(manifest?.assets || {})
    .filter(([source, hashed]) => typeof source === 'string' && typeof hashed === 'string')
    .map(([source, hashed]) => [hashed, source])
    .sort((left, right) => right[0].length - left[0].length);

  const htmlFiles = (await listFiles(publicPath)).filter(file => path.extname(file).toLowerCase() === '.html');
  for (const htmlFile of htmlFiles) {
    const original = await readFile(htmlFile, 'utf8');
    let restored = original;
    for (const [hashed, source] of reverseEntries) {
      restored = restored.replaceAll(hashed, source);
    }
    restored = restored.replace(
      /\/hashed-assets\/([^"'?#]+)\.([a-f\d]{12})(\.(?:css|js))(?=[?#["'])/gi,
      '/$1$3',
    );
    if (restored !== original) {
      await writeFile(htmlFile, restored, 'utf8');
    }
  }
}

function rewriteCssUrls(css, sourceRelativePath) {
  const sourceDirectory = path.posix.dirname(`/${sourceRelativePath}`);
  const base = `https://quartzlab.invalid${sourceDirectory === '/' ? '/' : `${sourceDirectory}/`}`;

  return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (match, quote, rawValue) => {
    const value = rawValue.trim();
    if (!value || /^(?:[a-z][a-z\d+.-]*:|\/|#|\?)/i.test(value)) return match;

    const resolved = new URL(value, base);
    const absolutePath = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    return `url(${quote}${absolutePath}${quote})`;
  });
}

function fingerprintedRelativePath(sourceRelativePath, hash) {
  const extension = path.posix.extname(sourceRelativePath);
  const directory = path.posix.dirname(sourceRelativePath);
  const baseName = path.posix.basename(sourceRelativePath, extension);
  return path.posix.join(
    HASHED_DIRECTORY,
    directory === '.' ? '' : directory,
    `${baseName}.${hash}${extension}`,
  );
}

function resolveAssetReference(value, htmlRelativePath) {
  if (!/\.(?:css|js)(?:[?#]|$)/i.test(value) || /^(?:data:|javascript:|#)/i.test(value)) {
    return null;
  }

  const htmlDirectory = path.posix.dirname(`/${htmlRelativePath}`);
  const base = `https://quartzlab.invalid${htmlDirectory === '/' ? '/' : `${htmlDirectory}/`}`;
  let resolved;
  try {
    resolved = new URL(value, base);
  } catch {
    return null;
  }

  if (resolved.hostname !== 'quartzlab.invalid' && resolved.hostname !== 'quartzlab.ru') {
    return null;
  }

  return {
    pathname: resolved.pathname,
    suffix: `${resolved.search}${resolved.hash}`,
  };
}

async function rewriteHtmlAssetReferences(publicPath, assets) {
  const htmlFiles = (await listFiles(publicPath)).filter(file => path.extname(file).toLowerCase() === '.html');

  for (const htmlFile of htmlFiles) {
    const htmlRelativePath = toPosixPath(path.relative(publicPath, htmlFile));
    const original = await readFile(htmlFile, 'utf8');
    const rewritten = original.replace(
      /\b(src|href)\s*=\s*(["'])([^"']+)\2/gi,
      (match, attribute, quote, value) => {
        const reference = resolveAssetReference(value, htmlRelativePath);
        if (!reference || !assets[reference.pathname]) return match;
        return `${attribute}=${quote}${assets[reference.pathname]}${reference.suffix}${quote}`;
      },
    );

    if (rewritten !== original) {
      await writeFile(htmlFile, rewritten, 'utf8');
    }
  }
}

export async function fingerprintPublicAssets(publicPath) {
  const previousManifest = await readPreviousManifest(publicPath);
  await restoreSourceAssetReferences(publicPath, previousManifest);
  await rm(path.join(publicPath, HASHED_DIRECTORY), { recursive: true, force: true });

  const sourceFiles = (await listFiles(publicPath))
    .filter(file => ['.css', '.js'].includes(path.extname(file).toLowerCase()))
    .filter(file => !toPosixPath(path.relative(publicPath, file)).startsWith(`${HASHED_DIRECTORY}/`))
    .sort((left, right) => left.localeCompare(right));

  const assets = {};
  for (const sourceFile of sourceFiles) {
    const sourceRelativePath = toPosixPath(path.relative(publicPath, sourceFile));
    const extension = path.extname(sourceFile).toLowerCase();
    const sourceContents = await readFile(sourceFile);
    const outputContents = extension === '.css'
      ? Buffer.from(rewriteCssUrls(sourceContents.toString('utf8'), sourceRelativePath), 'utf8')
      : sourceContents;
    const hash = createHash('sha256').update(outputContents).digest('hex').slice(0, HASH_LENGTH);
    const targetRelativePath = fingerprintedRelativePath(sourceRelativePath, hash);
    const targetPath = path.join(publicPath, ...targetRelativePath.split('/'));

    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, outputContents);
    assets[`/${sourceRelativePath}`] = `/${targetRelativePath}`;
  }

  await rewriteHtmlAssetReferences(publicPath, assets);

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    assets,
  };
  await atomicWriteJson(path.join(publicPath, MANIFEST_FILE), manifest);

  return manifest;
}

export const assetPipeline = {
  hashedDirectory: HASHED_DIRECTORY,
  hashLength: HASH_LENGTH,
  manifestFile: MANIFEST_FILE,
};
