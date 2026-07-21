# Maintenance mode / Технический режим

Maintenance mode is a static visual closure for GitHub Pages. It returns HTTP 200 rather than a server-side 503, but every generated HTML page includes `noindex,nofollow`, `robots.txt` contains `Disallow: /`, and the sitemap is empty. Pages are localized, script-free, and use a fingerprinted stylesheet.

## Русский

Локальная проверка с изменением конфигурации:

```sh
npm run maintenance:on
npm run build
npm run validate
npm run dev
npm run maintenance:off
```

После проверки обязательно убедись, что `npm run maintenance:status` показывает `OFF`.

Для production открой **Settings → Secrets and variables → Actions → Variables** и создай или измени `SITE_MAINTENANCE`:

- `true` — включить технический режим;
- `false` — включить обычный сайт.

Затем вручную запусти **Actions → Build and deploy GitHub Pages → Run workflow**. Scheduled deployment использует ту же переменную и не выключит режим самопроизвольно. Environment override не записывается в `site.config.json`.

## English

Local configuration-based check:

```sh
npm run maintenance:on
npm run build
npm run validate
npm run dev
npm run maintenance:off
```

Confirm that `npm run maintenance:status` reports `OFF` when the check is complete.

For production, open **Settings → Secrets and variables → Actions → Variables** and set `SITE_MAINTENANCE` to `true` to enable maintenance or `false` to restore the normal site. Then run **Actions → Build and deploy GitHub Pages → Run workflow** manually. The scheduled deployment reads the same variable. The environment override never writes to `site.config.json`.

For a temporary local override without editing configuration, set `SITE_MAINTENANCE=true`, build and validate, then remove the environment variable.
