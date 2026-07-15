# QuartzLab site

Статический двуязычный сайт для Cloudflare Pages. Статические файлы публикуются из `public/`, серверная часть используется только через Pages Functions.

## Архитектура

- `public/` содержит весь публичный фронтенд.
- `functions/go/support.js` пишет обезличенное событие в Cloudflare Analytics Engine и затем всегда делает redirect на Boosty.
- `catalog/plugins.config.json` хранит ручной каталог плагинов: ссылка на репозиторий и локализованный контент.
- `scripts/sync-plugins.mjs` подтягивает метаданные и документацию только из последнего опубликованного GitHub release каждого плагина.
- Ссылки на страницы плагинов и документации ведут на query-маршруты:
  - `/plugin.html?lang=en&slug={slug}`
  - `/plugin.html?lang=ru&slug={slug}`
  - `/docs.html?lang=en&slug={slug}`
  - `/docs.html?lang=ru&slug={slug}`
- Синхронизированная документация хранится во внутренних статических файлах `public/generated-docs/{lang}/{slug}/`.
- Устаревшие сгенерированные docs и старые clean-route директории для slug, которых больше нет в `catalog/plugins.config.json`, удаляются автоматически.

## Что делает синхронизатор

Для каждого репозитория из `catalog/plugins.config.json` скрипт:

1. Проверяет, что репозиторий публичный и находится на GitHub.
2. Загружает все опубликованные releases с пагинацией, исключая `draft` и `prerelease`.
3. Берет последний опубликованный release как источник `package.json`, `LICENSE*` и `Documentation~`.
4. Проверяет, что `package.json.version` совпадает с `release.tag_name` с учетом опционального префикса `v`.
5. Суммирует `download_count` только по ZIP-assets всех опубликованных releases.
6. Копирует `Documentation~` на сайт целиком, включая HTML, CSS, JS и изображения, в `public/generated-docs/{lang}/{slug}/`.
7. Для HTML-документации извлекает inline `<style>` и `<script>` в локальные файлы, чтобы документация работала под строгим CSP без `unsafe-inline`.
8. Обновляет `public/data/plugins.json` и `public/data/downloads.json`.

Если release невалиден, версия не совпадает или документация содержит запрещенные удаленные ресурсы, синхронизация завершается ошибкой.

## Приватная аналитика

Маршрут `/go/support` принимает только:

- `place`
- `lang`
- `page`

В Analytics Engine записываются только:

- `index1`: тип события, всегда `support_click`
- `blob1`: место кнопки
- `blob2`: язык
- `blob3`: pathname
- `double1`: всегда `1`
- `timestamp`: автоматически выставляется Analytics Engine

Не сохраняются cookies, IP, User-Agent, query string, полный Referer и другие персональные данные. При любой ошибке аналитики redirect на `https://boosty.to/quartzlab` все равно выполняется.

## Cloudflare Pages

Настройки проекта:

- Build command: не требуется
- Build output directory: `public`
- Wrangler config: `wrangler.jsonc`
- Pages Functions: включены

Обязательный binding:

- Analytics Engine binding `SUPPORT_ANALYTICS` с dataset `support_clicks`

Локальный запуск:

```powershell
node scripts/sync-plugins.mjs
node --test
npx wrangler@latest pages dev public
```

Примечание: локально Analytics Engine binding недоступен в `pages dev`, поэтому запись событий не выполняется, но redirect через `/go/support` продолжает работать.

## GitHub Actions

Workflow `.github/workflows/sync-plugin-releases.yml` запускается:

- по cron
- вручную
- при изменениях в `catalog/plugins.config.json`, `scripts/**` и самом workflow

Он:

1. Запускает `node scripts/sync-plugins.mjs`
2. Запускает `node --test`
3. Коммитит сгенерированные изменения в `public/`, включая `public/data` и `public/generated-docs`.

Опциональный secret:

- `GITHUB_PUBLIC_READ_TOKEN`

Назначение секрета:

- повышает лимит GitHub API
- должен быть fine-grained и read-only
- должен иметь доступ только к явно разрешенным публичным репозиториям

Сайт и синхронизация продолжают работать без этого секрета для публичных репозиториев, но могут упереться в rate limit GitHub API.

## Готовые SQL-запросы для Analytics Engine

Топ кликов по месту кнопки:

```sql
SELECT
  blob1 AS place,
  SUM(double1 * _sample_interval) AS clicks
FROM support_clicks
WHERE index1 = 'support_click'
GROUP BY place
ORDER BY clicks DESC;
```

Клики по страницам и языкам:

```sql
SELECT
  blob3 AS pathname,
  blob2 AS language,
  SUM(double1 * _sample_interval) AS clicks
FROM support_clicks
WHERE index1 = 'support_click'
GROUP BY pathname, language
ORDER BY clicks DESC;
```

Дневная динамика:

```sql
SELECT
  toStartOfDay(timestamp) AS day,
  SUM(double1 * _sample_interval) AS clicks
FROM support_clicks
WHERE index1 = 'support_click'
GROUP BY day
ORDER BY day ASC;
```

Клики по конкретной кнопке:

```sql
SELECT
  blob3 AS pathname,
  SUM(double1 * _sample_interval) AS clicks
FROM support_clicks
WHERE index1 = 'support_click'
  AND blob1 = 'plugin-side-note'
GROUP BY pathname
ORDER BY clicks DESC;
```

## Безопасность

- Секреты и токены не должны попадать в `public/`, клиентский код, репозиторий и логи.
- Для синхронизации используется только `GITHUB_PUBLIC_READ_TOKEN`, если он явно задан.
- Документация с удаленными скриптами, удаленными стилями, `meta refresh`, `base` и `javascript:` URL отклоняется.
- CSP задается один раз в `public/_headers`, без конфликтующих повторов.
- Старые clean URLs `/en|ru/plugins/{slug}` и `/en|ru/docs/{slug}` остаются только как обычные `302` redirects на query-маршруты.
