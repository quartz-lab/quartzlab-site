# QuartzLab site

Статический двуязычный сайт [QuartzLab](https://quartzlab.ru) с каталогом Unity Editor-плагинов и веб-копиями их документации.

## Архитектура

- `catalog/plugins.config.json` — ручные метаданные каталога и RU/EN-тексты.
- `site/` — редактируемые CSS, JavaScript, SVG и изображения.
- `scripts/build-site.mjs` — единственная production-сборка.
- `_site/` — временный готовый deployment artifact; он всегда пересоздаётся и не коммитится.

Сборщик получает публичные GitHub Releases, сверяет release tag с версией `package.json`, суммирует загрузки ZIP-архивов, загружает `Documentation~`, очищает веб-копию от offline-only интерфейса и генерирует каталог, страницы плагинов, документацию, SEO, `robots.txt`, `sitemap.xml` и `404.html`. Исходная `Documentation~` в репозитории плагина не изменяется.

Каталоги `/ru/` и `/en/` полностью статические: карточки уже находятся в HTML. JavaScript отвечает только за тему, язык, фильтры, сортировку и галерею; загрузки `plugins.json` или `downloads.json` в браузере нет.

CSS и JavaScript получают SHA-256 fingerprint в имени. Хэш вычисляется из нормализованных байтов, записанный файл перечитывается и проверяется, затем обновляются HTML и атомарный `asset-manifest.json`. Предыдущие `_site`, manifest и hashed-assets никогда не используются как источник новой сборки.

## Локальная работа

Требуется Node.js 22. Сторонние npm-зависимости не нужны.

```powershell
node scripts/build-site.mjs
node scripts/validate-site.mjs _site
node --test
node scripts/serve.mjs
```

Preview по умолчанию доступен на `http://127.0.0.1:4173/`. Сервер поддерживает красивые маршруты, включая `/ru/`, `/en/`, страницы плагинов и документации. Не открывайте HTML через `file://`: маршруты и CSP рассчитаны на HTTP.

Для проверки стандартного project Pages URL:

```powershell
$env:SITE_BASE_PATH = '/quartzlab-site'
node scripts/build-site.mjs
node scripts/validate-site.mjs _site
node scripts/serve.mjs
```

Откройте `http://127.0.0.1:4173/quartzlab-site/`. Вернуть production-настройку можно, удалив переменную и пересобрав:

```powershell
Remove-Item Env:SITE_BASE_PATH
node scripts/build-site.mjs
```

Переменные сборки:

- `SITE_ORIGIN` — canonical origin, по умолчанию `https://quartzlab.ru`;
- `SITE_BASE_PATH` — путь deployment, по умолчанию `/`;
- `GITHUB_PUBLIC_READ_TOKEN` — необязательный токен только для чтения публичного GitHub API. Без него используется публичный API без авторизации.

Canonical, hreflang, Open Graph, JSON-LD, sitemap и robots всегда используют `SITE_ORIGIN`, а локальные assets и внутренние маршруты учитывают `SITE_BASE_PATH`.

## Режим технических работ

```powershell
node scripts/maintenance.mjs on
node scripts/maintenance.mjs status
node scripts/build-site.mjs
node scripts/maintenance.mjs off
```

При включённом режиме сборка не обращается к GitHub Releases. Она создаёт локализованные maintenance-страницы для корня, `404`, каталога, about и известных plugin/docs-маршрутов, добавляет `noindex,nofollow`, закрывает обход в `robots.txt` и оставляет sitemap пустым. Страница работает без JavaScript и выбирает светлую/тёмную тему через `prefers-color-scheme`.

GitHub Pages возвращает для статической maintenance-страницы HTTP 200, поэтому этот режим является визуальным временным закрытием сайта, а не полноценным серверным maintenance response и не HTTP 503.

## GitHub Pages deployment

Workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) запускается при push в `main`, pull request, вручную и ежедневно по cron. Он использует только официальные `actions/*`, собирает чистый `_site`, валидирует его, запускает тесты, загружает Pages artifact и публикует именно этот artifact. Pull request выполняет проверку, но не production deploy.

Ежедневная синхронизация не изменяет репозиторий: bot-коммитов, `git add`, `git commit` и `git push` в workflow нет. При необходимости создайте Actions secret `GITHUB_PUBLIC_READ_TOKEN`; для одного публичного плагина он обычно не нужен.

Ручной запуск: **Actions → Build and deploy GitHub Pages → Run workflow → main → Run workflow**. Затем откройте выполненный run и убедитесь, что jobs `build` и `deploy` зелёные, а environment `github-pages` указывает на production URL.

## Настройка GitHub Settings → Pages

1. Откройте репозиторий `quartz-lab/quartzlab-site` → **Settings** → **Pages**.
2. В **Build and deployment → Source** выберите **GitHub Actions**.
3. После первого успешного workflow в **Custom domain** укажите `quartzlab.ru` и сохраните.
4. Дождитесь успешной DNS check и выпуска сертификата.
5. Включите **Enforce HTTPS**, когда переключатель станет доступен.
6. Проверьте `https://quartzlab.ru/`, RU/EN-маршруты и environment последнего deployment.

При custom GitHub Actions workflow файл `CNAME` в исходной ветке не требуется: custom domain хранится в Pages settings.

## DNS для quartzlab.ru

Сначала добавьте custom domain в Pages settings, затем изменяйте DNS. Для apex `quartzlab.ru` создайте четыре записи:

| Type | Name | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

Для `www` создайте `CNAME`: имя `www`, значение `quartz-lab.github.io` без имени репозитория. GitHub Pages автоматически перенаправит `www` на настроенный apex-домен.

Если DNS-зона остаётся у Cloudflare, все перечисленные записи должны быть **DNS only** (серое облако). Удалите старый `CNAME`, ведущий на `quartzlab-site.pages.dev`, а также прежний Bulk Redirect для `www`: перенаправление теперь выполняет GitHub Pages. Не создавайте wildcard-записи. Распространение DNS и выпуск HTTPS-сертификата могут занять время.

Проверка в PowerShell:

```powershell
Resolve-DnsName quartzlab.ru -Type A
Resolve-DnsName www.quartzlab.ru -Type CNAME
```

## Ограничения GitHub Pages

GitHub Pages не применяет `_headers` и не позволяет этому репозиторию задавать произвольный `Cache-Control`. Поэтому изменяемые CSS/JS используют content fingerprinting, а HTML содержит безопасные meta-эквиваленты для CSP, referrer и robots. В meta CSP нет неподдерживаемого `frame-ancestors`; разрешены локальные assets и lazy iframe `youtube-nocookie.com`.

После миграции удалены Pages Functions, Wrangler, Analytics Engine и серверная аналитика переходов поддержки. Все Boosty-кнопки являются обычными прямыми ссылками на `https://boosty.to/quartzlab` и работают без JavaScript.
