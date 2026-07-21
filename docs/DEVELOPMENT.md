# Development

## Requirements

- Node.js 22 or newer.
- Network access to public GitHub repositories for a normal build.
- No npm dependencies or install step.

## Commands

```sh
npm run build
npm run validate
npm test
npm run check
npm run dev
```

`npm run check` performs a clean build, validates `_site/`, and runs the complete test suite. The preview server listens on `http://127.0.0.1:4173/` and supports the same clean routes used by GitHub Pages. Use HTTP preview instead of opening HTML through `file://`.

## Build environment

- `SITE_ORIGIN` overrides the canonical HTTPS origin used by canonical links, hreflang, Open Graph, JSON-LD, robots, and sitemap. It defaults to `brand.origin` in `site.config.json`.
- `SITE_BASE_PATH` controls internal deployment paths. Production uses `/`. A project-path value such as `/quartzlab-site` is only useful for optional local compatibility tests of the normal site.
- `SITE_MAINTENANCE` accepts exactly `true` or `false` and overrides `site.config.json` without changing the file.
- `GITHUB_PUBLIC_READ_TOKEN` is an optional read-only token for public GitHub API requests. Normal public builds can run without it at the lower unauthenticated rate limit.

PowerShell example:

```powershell
$env:SITE_ORIGIN = 'https://quartzlab.ru'
$env:SITE_BASE_PATH = '/'
npm run build
Remove-Item Env:SITE_ORIGIN, Env:SITE_BASE_PATH
```

Do not print token values in logs or store them in repository files.

## Tests

Tests cover release metadata rules, static page generation, documentation cleanup, the gallery, exact asset fingerprints, production root paths, forbidden project-path leakage, maintenance environment priority, and real normal/maintenance builds in temporary directories.
