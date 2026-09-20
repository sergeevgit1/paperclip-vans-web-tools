# Paperclip Vans Web Tools

Плагин Paperclip, который предоставляет агентам контролируемый интернет-доступ через VansRouter:

- `vans_web_search` — поиск в публичном интернете;
- `vans_web_fetch` — извлечение читаемого текста публичной HTTP(S)-страницы.

Плагин не предоставляет браузер, cookies, сессии, JavaScript, клики, формы, загрузки файлов или произвольные HTTP-запросы.

## Требования

- Node.js 22;
- pnpm 11+;
- Paperclip Plugin SDK `2026.916.0`;
- VansRouter с маршрутами `POST /v1/search` и `POST /v1/web/fetch`.

## Настройки Paperclip

- `baseUrl` — адрес VansRouter без `/v1`, query и fragment;
- `apiKeyRef` — ссылка на секрет Paperclip с API-ключом VansRouter;
- `searchProvider` — `searxng`;
- `fetchProvider` — `scrapling`, `jina-reader` или `camofox`;
- `timeoutMs` — 1–60 секунд;
- `maxSearchResults` — 1–20;
- `maxContentChars` — 1000–100000;
- `allowedDomains` — необязательный список разрешённых публичных доменов;
- `blockedDomains` — необязательный список запрещённых доменов.

Значение API-ключа не хранится в manifest/config: плагин разрешает `apiKeyRef` через `ctx.secrets.resolve()` во время вызова инструмента.

## Локальная проверка

```text
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Живой smoke-тест против VansRouter:

```text
VANS_BASE_URL=http://127.0.0.1:20129 VANS_API_KEY=<секрет> node scripts/live-smoke.mjs
```

Скрипт выводит только агрегированные результаты и проверяет, что секрет отсутствует в `ToolResult`.

## Безопасность

До вызова VansRouter `vans_web_fetch` блокирует:

- схемы кроме HTTP(S);
- credentials и fragments в URL;
- localhost и внутренние доменные суффиксы;
- loopback, private, link-local, CGNAT, multicast и документационные IP-диапазоны;
- нестандартные порты;
- домены, не прошедшие allow/block-политику.

VansRouter обязан повторно проверять разрешённые адреса и redirects на своей стороне, поскольку фактическое скачивание выполняет его fetch provider.

## Установка

Production-установка не выполняется автоматически. После подтверждения оператора:

1. выполнить `pnpm build`;
2. перенести пакет вместе с `package.json`, `pnpm-lock.yaml` и `dist/` в постоянный volume Paperclip;
3. установить локальный путь штатным Plugins API;
4. создать encrypted secret с ключом VansRouter;
5. сохранить в настройках только ссылку `apiKeyRef`;
6. активировать плагин и проверить одного тестового агента.

Полный дизайн: `docs/superpowers/specs/2026-09-20-paperclip-vans-web-tools-design.md`.

План реализации: `docs/superpowers/plans/2026-09-20-paperclip-vans-web-tools.md`.
