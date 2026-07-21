# Adding a plugin

1. Add one entry to `catalog/plugins.config.json`. Keep the existing schema and provide the public GitHub repository, RU/EN catalog copy, category, feature list, tags, cover, and media declarations.
2. Put stable site-owned images under `site/assets/plugins/<slug>/`. Use repository-relative paths beginning with `/assets/` in catalog data.
3. Provide clear screenshots and localized alt text. Media can declare images, local videos, or supported YouTube URLs; do not add a runtime media library.
4. Publish a GitHub Release in the plugin repository. Its tag must match the version in the released package's `package.json`, and release assets should include the distributable archive expected by the synchronization code.
5. Include `Documentation~` in the release source when web documentation should be generated. The site copies and adapts it for web output without modifying the plugin repository.
6. Run the full local checks:

```sh
npm run build
npm run validate
npm test
npm run dev
```

Inspect both language catalog cards, plugin pages, documentation routes, media thumbnails, fullscreen gallery behavior, and release/download metadata. Do not commit `_site/`.
