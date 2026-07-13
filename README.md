# QuartzLab website

Полностью статический двуязычный каталог бесплатных Unity Editor-плагинов. Проект предназначен для прямой публикации на Cloudflare Pages.

## Cloudflare Pages

- Build command: отсутствует
- Build output directory: `public`
- Node.js, сервер, база данных и переменные окружения не используются.

## Добавление и обновление плагина

Все записи находятся в `public/data/plugins.json`. Изменения выполняются только владельцем в приватном GitHub-репозитории.

Основные поля:

- `slug` — постоянная часть URL, одинаковая для обоих языков;
- `name` — название плагина, оно не переводится;
- `category`, `i18n.en`, `i18n.ru` — полный перевод каталога, страницы плагина и документации;
- `media` — изображения, локальные видео/WebM или YouTube-ссылки;
- `repositoryUrl` — публичный GitHub-репозиторий плагина;
- `releaseUrl` — страница GitHub Releases, включает кнопку скачивания;
- `downloadAsset` — необязательное точное имя Release Asset; если `null`, считаются все ZIP-файлы репозитория;
- `assetStoreUrl` — URL Asset Store или `null`; при `null` кнопка скрыта.

Пример YouTube-элемента галереи:

```json
{
  "type": "youtube",
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "title": {"en": "Feature overview", "ru": "Обзор возможностей"}
}
```

Документация поддерживает медиаблоки внутри секций:

```json
{
  "title": "Workflow",
  "paragraphs": ["Step-by-step text."],
  "media": [
    {"type": "image", "src": "/assets/docs/example.webp", "alt": {"en": "Example", "ru": "Пример"}},
    {"type": "video", "src": "/assets/docs/example.webm", "poster": "/assets/docs/poster.webp"}
  ]
}
```

## Счётчики скачиваний

Workflow `.github/workflows/update-downloads.yml` запускается ежедневно и вручную. Он читает публичные GitHub Releases, суммирует `download_count` всех ZIP-файлов (либо файла с точным именем из `downloadAsset`), обновляет `public/data/downloads.json` и коммитит изменение. После этого Cloudflare Pages публикует новую версию.

Для каждого опубликованного плагина укажите реальные `repositoryUrl` и `releaseUrl`. `downloadAsset` нужен только если в Releases есть посторонние ZIP-файлы. Пока `repositoryUrl` равен `null`, внешние кнопки скрыты, а счётчик равен нулю.

## Локальная проверка

Подойдёт любой простой статический сервер. Например, Python используется только локально для предпросмотра и не является частью сайта:

```powershell
python -m http.server 4173 --directory public
```

Cloudflare-правила из `public/_redirects` обслуживают чистые URL плагинов и документации. При простом локальном сервере те же страницы можно проверять как `/plugin.html?lang=ru&slug=clipswitch` и `/docs.html?lang=en&slug=clipswitch`.
