# Paperclip Vans Web Tools — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать минимальный и строго верифицированный плагин Paperclip `@zaruba/paperclip-vans-web-tools`, дающий агентам два контролируемых инструмента: `vans_web_search` и `vans_web_fetch` через VansRouter.

**Architecture:** Плагин состоит из манифеста Paperclip, проверяемой схемы конфигурации со ссылкой на секрет `apiKeyRef`, валидатора сетевых адресов против SSRF и двух тонких обработчиков инструментов поверх безопасного HTTP-клиента к VansRouter `/v1/search` и `/v1/web/fetch`. Браузерные абстракции, cookies и сессии исключены.

**Tech Stack:** TypeScript 5, Node.js 22, `@paperclipai/plugin-sdk@2026.916.0`, Vitest 3/4, esbuild.

---

### File Structure Map

```text
/home/macbot12i7/project/paperclip-vans-web-tools/
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── vitest.config.ts
├── src/
│   ├── constants.ts
│   ├── types.ts
│   ├── manifest.ts
│   ├── security.ts
│   ├── vans-client.ts
│   ├── tools/
│   │   ├── search.ts
│   │   └── fetch.ts
│   └── worker.ts
└── tests/
    ├── security.spec.ts
    ├── config.spec.ts
    ├── vans-client.spec.ts
    ├── search-tool.spec.ts
    ├── fetch-tool.spec.ts
    └── plugin-lifecycle.spec.ts
```

---

### Task 1: Инициализация окружения сборки и тестового стенда

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `vitest.config.ts`
- Test: `tests/bootstrap.spec.ts`

- [ ] **Step 1: Write the failing test**
Создать базовый тест `tests/bootstrap.spec.ts`, проверяющий, что vitest запускается и видит базовую константу плагина.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test`
Expected: FAIL (отсутствуют зависимости и модуль)

- [ ] **Step 3: Write minimal implementation**
Установить зависимости пакета, создать `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `vitest.config.ts`, `src/constants.ts`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**
`git add . && git commit -m "feat(build): setup package build and vitest runner"`

---

### Task 2: Безопасность сетевых адресов и URL (SSRF Guard)

**Files:**
- Create: `src/security.ts`
- Test: `tests/security.spec.ts`

- [ ] **Step 1: Write the failing test**
Покрыть тестами:
1. отклонение не-HTTP(S) схем (`file:`, `gopher:`, `ftp:`);
2. отклонение username/password в URL;
3. отклонение fragment;
4. отклонение `localhost`, `.local`, `.internal`, `.home.arpa`;
5. отклонение loopback IP (`127.0.0.1`, `::1`);
6. отклонение частных IP (RFC1918 `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`);
7. отклонение link-local (`169.254.0.0/16`) и облачных metadata (`169.254.169.254`);
8. проверку портов (разрешены только 80, 443 или пустой);
9. работу `allowedDomains` и `blockedDomains`.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test tests/security.spec.ts`
Expected: FAIL (`validateWebUrl` is not defined)

- [ ] **Step 3: Write minimal implementation**
Реализовать `validateWebUrl` и сопутствующие проверки в `src/security.ts`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test tests/security.spec.ts`
Expected: PASS (все проверки безопасности проходят)

- [ ] **Step 5: Commit**
`git add src/security.ts tests/security.spec.ts && git commit -m "feat(security): implement strict ssrf guard for web fetch urls"`

---

### Task 3: Манифест плагина и валидация конфигурации

**Files:**
- Create: `src/types.ts`
- Create: `src/manifest.ts`
- Test: `tests/config.spec.ts`

- [ ] **Step 1: Write the failing test**
Тесты на:
1. корректность структуры манифеста Paperclip V1;
2. наличие ровно двух инструментов;
3. отсутствие открытого поля API-ключа, только `apiKeyRef`;
4. `onValidateConfig`: отклонение невалидного `baseUrl` (наличие путей, параметров);
5. обязательность `apiKeyRef`;
6. валидация числовых диапазонов `timeoutMs`, `maxSearchResults`, `maxContentChars`;
7. валидация провайдеров `searxng` и `fetchProvider` enum.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test tests/config.spec.ts`
Expected: FAIL (`manifest` is not defined)

- [ ] **Step 3: Write minimal implementation**
Реализовать `src/types.ts`, `src/manifest.ts` и функцию `validatePluginConfig`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test tests/config.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/types.ts src/manifest.ts tests/config.spec.ts && git commit -m "feat(manifest): define paperclip plugin manifest and config validator"`

---

### Task 4: Клиент VansRouter HTTP (поиск и извлечение)

**Files:**
- Create: `src/vans-client.ts`
- Test: `tests/vans-client.spec.ts`

- [ ] **Step 1: Write the failing test**
Тесты с mock HTTP-сервером Node.js:
1. корректный `POST /v1/search` с заголовком `Authorization: Bearer <secret>`;
2. корректный `POST /v1/web/fetch` с заголовком `Authorization: Bearer <secret>`;
3. очистка ошибок от токена при `401`, `403`, `500`;
4. обработка таймаута;
5. защита от превышения лимита размера ответа (`maxBytes`);
6. преобразование в строгие типизированные ответы.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test tests/vans-client.spec.ts`
Expected: FAIL (`VansRouterClient` is not defined)

- [ ] **Step 3: Write minimal implementation**
Реализовать `src/vans-client.ts` поверх `ctx.http.fetch` или внедряемого HTTP fetcher.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test tests/vans-client.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/vans-client.ts tests/vans-client.spec.ts && git commit -m "feat(client): implement safe vansrouter client with token redaction"`

---

### Task 5: Обработчик инструмента `vans_web_search`

**Files:**
- Create: `src/tools/search.ts`
- Test: `tests/search-tool.spec.ts`

- [ ] **Step 1: Write the failing test**
Тесты:
1. успешный поиск с нормализацией полей (title, url, snippet, position);
2. ограничение числа результатов согласно `maxResults` и лимиту конфига;
3. обрезка слишком длинных сниппетов;
4. валидация входных параметров (пустой запрос, неизвестные поля);
5. обработка ошибок VansRouter с понятным описанием без утечки секрета.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test tests/search-tool.spec.ts`
Expected: FAIL (`handleWebSearch` is not defined)

- [ ] **Step 3: Write minimal implementation**
Реализовать `src/tools/search.ts`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test tests/search-tool.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/tools/search.ts tests/search-tool.spec.ts && git commit -m "feat(tools): implement vans_web_search handler"`

---

### Task 6: Обработчик инструмента `vans_web_fetch`

**Files:**
- Create: `src/tools/fetch.ts`
- Test: `tests/fetch-tool.spec.ts`

- [ ] **Step 1: Write the failing test**
Тесты:
1. блокировка локального/внутреннего URL до отправки в VansRouter;
2. успешное извлечение страницы с ограничением символов `maxChars`;
3. флаг `truncated` при превышении лимита;
4. поддержка форматов `markdown` и `text`;
5. применение доменных списков allow/block.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test tests/fetch-tool.spec.ts`
Expected: FAIL (`handleWebFetch` is not defined)

- [ ] **Step 3: Write minimal implementation**
Реализовать `src/tools/fetch.ts`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test tests/fetch-tool.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/tools/fetch.ts tests/fetch-tool.spec.ts && git commit -m "feat(tools): implement vans_web_fetch handler with truncation"`

---

### Task 7: Точка входа воркера и интеграционный тест жизненного цикла плагина

**Files:**
- Create: `src/worker.ts`
- Test: `tests/plugin-lifecycle.spec.ts`

- [ ] **Step 1: Write the failing test**
Используя тестовый стенд Paperclip SDK (`createTestHarness` или эмуляцию `PluginContext`):
1. проверить запуск воркера и регистрацию обоих инструментов;
2. проверить `onHealth` возвращает `ok`;
3. проверить вызов обоих инструментов через контекст плагина с разрешением секрета `apiKeyRef`.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test tests/plugin-lifecycle.spec.ts`
Expected: FAIL (`worker` is not defined)

- [ ] **Step 3: Write minimal implementation**
Реализовать `src/worker.ts` с регистрацией инструментов и обработчиками жизненного цикла.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test tests/plugin-lifecycle.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/worker.ts tests/plugin-lifecycle.spec.ts && git commit -m "feat(worker): assemble plugin worker and lifecycle integration test"`

---

### Task 8: Сборка пакета и верификация дистрибутива

**Files:**
- Modify: `package.json`
- Test: полная сборка `dist/manifest.js` и `dist/worker.js`

- [ ] **Step 1: Run typecheck and full test suite**
Run: `pnpm typecheck && pnpm test`
Expected: All tests pass, 0 type errors.

- [ ] **Step 2: Build bundle**
Run: `pnpm build`
Expected: `dist/manifest.js` и `dist/worker.js` сгенерированы без ошибок.

- [ ] **Step 3: Verify artifact integrity**
Проверить размер бандлов, отсутствие внешних незабандленных зависимостей кроме `@paperclipai/plugin-sdk`.

- [ ] **Step 4: Commit**
`git add dist/ package.json && git commit -m "chore(release): verify clean build artifacts"`

---

### Task 9: Живая верификация с локальным VansRouter (Non-mutating Smoke)

**Scope:**
- Проверить запросы к живому `http://127.0.0.1:20129` из локального окружения через тест-скрипт (без изменения боевого инстанса Paperclip).
- Проверить, что токен нигде не выводится.

---

### Task 10: Подготовка к установке в Paperclip

**Scope:**
- Сформировать пакет и инструкцию по установке.
- **ОСТАНОВКА:** Не устанавливать на боевой Paperclip до явного подтверждения пользователя.
