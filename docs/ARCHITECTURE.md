# Architecture

QuartzLab is built as a static bilingual site. A clean build recreates `_site/` from editable source and live public release metadata; generated output is never used as input and is not committed.

## Source layout

- `catalog/plugins.config.json` contains manually maintained catalog metadata, media declarations, and RU/EN copy.
- `site/` contains editable CSS, JavaScript, SVG, and image assets.
- `scripts/` contains the build, GitHub synchronization, documentation transformation, fingerprinting, validation, maintenance, and preview tools.
- `tests/` contains renderer, synchronization, asset-pipeline, production, and maintenance tests.
- `_site/` is the disposable GitHub Pages artifact.

## Build flow

`scripts/build-site.mjs` is the single production entry point. It removes the previous output, reads `site.config.json` and the catalog, synchronizes each configured public repository with its latest published GitHub Release, and verifies that the release tag agrees with the plugin package version.

The synchronization stage produces static catalog data, download totals, local web copies of `Documentation~`, localized catalog pages, plugin pages, documentation pages, SEO metadata, `robots.txt`, `sitemap.xml`, the root language entry, and `404.html`. The original documentation in plugin repositories is never modified.

The catalog cards and primary page content are present in HTML. JavaScript only provides interaction such as theme and language handling, catalog controls, and the fullscreen gallery; it does not fetch catalog JSON at runtime.

## Asset fingerprinting

Editable and generated CSS/JavaScript receive a 12-character SHA-256 content fingerprint. HTML references are rewritten to `/hashed-assets/...`, written bytes are verified against their filename, and stale hashed assets disappear because every build starts with a clean output directory. `asset-manifest.json` records the logical-to-fingerprinted mapping.

Maintenance builds use the same generator but intentionally skip release synchronization and emit only the fingerprinted maintenance stylesheet, localized maintenance routes, restrictive indexing files, and no JavaScript.
