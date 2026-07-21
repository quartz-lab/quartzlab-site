[English](README.md) · [Русский](README.ru.md)

<p align="center">
  <img src="site/assets/quartzlab-mark.svg" width="88" height="88" alt="Логотип QuartzLab">
</p>

# Сайт QuartzLab

Статический двуязычный каталог и сайт документации для Unity Editor-плагинов QuartzLab.

[Открыть quartzlab.ru](https://quartzlab.ru)

[![GitHub Pages](https://github.com/quartz-lab/quartzlab-site/actions/workflows/pages.yml/badge.svg)](https://github.com/quartz-lab/quartzlab-site/actions/workflows/pages.yml)
[![Сайт](https://img.shields.io/badge/live-quartzlab.ru-24b8b0)](https://quartzlab.ru)
![Node 22](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
[![Лицензия MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Возможности

- Полностью статический каталог на русском и английском без runtime-загрузки данных.
- Автоматическая синхронизация с опубликованными GitHub Releases.
- Генерация страниц плагинов и веб-копий их документации.
- Детерминированный content fingerprinting CSS и JavaScript.
- Чистая публикация на GitHub Pages с custom domain.

<p align="center">
  <img src="site/assets/quartzlab-site-preview.png" width="960" alt="Страница плагина ClipSwitch на сайте QuartzLab">
</p>

## Быстрый старт

Нужен Node.js 22 или новее. У проекта нет runtime-зависимостей.

```sh
npm run build
npm run validate
npm test
npm run dev
```

Локальный preview откроется на `http://127.0.0.1:4173/`.

## Структура репозитория

```text
.github/workflows/  автоматизация GitHub Pages
catalog/            ручные метаданные плагинов
scripts/            сборка, синхронизация, валидация и preview
site/               редактируемые стили, скрипты, изображения и SVG
tests/              модульные и интеграционные тесты
docs/               техническая и эксплуатационная документация
_site/              генерируемый deployment artifact (игнорируется)
```

## Документация

- [Архитектура](docs/ARCHITECTURE.md)
- [Разработка](docs/DEVELOPMENT.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Технический режим](docs/MAINTENANCE.md)
- [Добавление плагина](docs/ADDING_PLUGIN.md)
- [Участие в разработке](CONTRIBUTING.md)
- [Безопасность](SECURITY.md)

## Лицензия

Исходный код сайта и генератора распространяется по [лицензии MIT](LICENSE). Условия для брендовых материалов и лицензий плагинов описаны в [NOTICE.md](NOTICE.md).

Сопровождение: [QuartzLab](https://github.com/quartz-lab)
