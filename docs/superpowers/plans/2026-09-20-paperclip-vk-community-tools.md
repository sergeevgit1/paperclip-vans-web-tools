# Paperclip VK Community Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify `@zaruba/paperclip-vk-community-tools`, an enterprise-grade Paperclip plugin providing deep VK community integration: a full suite of 23 agent tools (wall, media, messaging, moderation, analytics), a company settings connector page, and a real-time community dashboard widget.

**Architecture:** A dual-bundle Paperclip v1 plugin (`dist/worker.js` for the Node.js agent runtime and `dist/ui/index.js` for the React board UI). At runtime, the worker securely resolves Paperclip vault secret references (`userTokenRef`, `groupTokenRef`) without cleartext persistence, provides an in-memory rate-limited VK API client with SSRF protection, dispatches agent tool calls, and exposes data bridges (`ctx.data.register`) to feed the dashboard widget and connection diagnostics.

**Tech Stack:** TypeScript 5, Node.js 22, React 19 (externalized peer), `@paperclipai/plugin-sdk@2026.916.0`, Vitest 4, esbuild.

---

### File Structure Map

```text
/home/macbot12i7/project/paperclip-vk-community-tools/
├── package.json
├── tsconfig.json
├── tsconfig.ui.json
├── esbuild.config.mjs
├── scripts/
│   └── build-ui.mjs
├── vitest.config.ts
├── src/
│   ├── constants.ts
│   ├── types.ts
│   ├── manifest.ts
│   ├── security.ts
│   ├── vk-client.ts
│   ├── tools/
│   │   ├── group.ts
│   │   ├── wall.ts
│   │   ├── media.ts
│   │   ├── comments.ts
│   │   ├── messages.ts
│   │   └── stats.ts
│   ├── ui/
│   │   ├── index.tsx
│   │   ├── widget.tsx
│   │   └── settings.tsx
│   └── worker.ts
└── tests/
    ├── bootstrap.spec.ts
    ├── security.spec.ts
    ├── config.spec.ts
    ├── vk-client.spec.ts
    ├── tools/
    │   ├── group.spec.ts
    │   ├── wall.spec.ts
    │   ├── media.spec.ts
    │   ├── comments.spec.ts
    │   ├── messages.spec.ts
    │   └── stats.spec.ts
    ├── plugin-lifecycle.spec.ts
    └── ui-build.spec.ts
```

---

### Task 1: Package Bootstrap & Build Tooling

**Files:**
- Create: `/home/macbot12i7/project/paperclip-vk-community-tools/package.json`
- Create: `/home/macbot12i7/project/paperclip-vk-community-tools/tsconfig.json`
- Create: `/home/macbot12i7/project/paperclip-vk-community-tools/tsconfig.ui.json`
- Create: `/home/macbot12i7/project/paperclip-vk-community-tools/esbuild.config.mjs`
- Create: `/home/macbot12i7/project/paperclip-vk-community-tools/scripts/build-ui.mjs`
- Create: `/home/macbot12i7/project/paperclip-vk-community-tools/vitest.config.ts`
- Create: `/home/macbot12i7/project/paperclip-vk-community-tools/src/constants.ts`
- Test: `/home/macbot12i7/project/paperclip-vk-community-tools/tests/bootstrap.spec.ts`

- [ ] **Step 1: Write the failing test**
Create `tests/bootstrap.spec.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { PLUGIN_ID, PLUGIN_VERSION } from "../src/constants.js";

describe("package bootstrap", () => {
  it("exports plugin identity constants", () => {
    expect(PLUGIN_ID).toBe("zaruba.vk-community-tools");
    expect(PLUGIN_VERSION).toBe("0.1.0");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test tests/bootstrap.spec.ts`
Expected: FAIL (`PLUGIN_ID` is not defined or module not found).

- [ ] **Step 3: Write minimal implementation**
Create directory `/home/macbot12i7/project/paperclip-vk-community-tools`, write `package.json`, `tsconfig.json`, `tsconfig.ui.json`, `esbuild.config.mjs`, `scripts/build-ui.mjs`, `vitest.config.ts` and `src/constants.ts`. Run `pnpm install`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test tests/bootstrap.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git init
git add .
git commit -m "feat(bootstrap): initialize repository structure and build config"
```

---

### Task 2: Security & URL Validation (SSRF Guard)

**Files:**
- Create: `src/security.ts`
- Test: `tests/security.spec.ts`

- [ ] **Step 1: Write the failing test**
Create `tests/security.spec.ts` with tests for:
1. Rejection of local/private IPs in external media fetch (`127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`, `169.254.169.254`, `::1`).
2. Whitelisting VK upload servers (`*.vk.com`, `*.vk.ru`, `*.userapi.com`).
3. Rejection of credential embeddings in URLs (`https://user:pass@vk.com`).
4. Sanitization of VK access tokens from error strings (`vk1.a...` replaced with `[REDACTED]`).

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test tests/security.spec.ts`
Expected: FAIL (`validateUploadUrl` and `sanitizeVkError` are not defined).

- [ ] **Step 3: Write minimal implementation**
Implement `src/security.ts` with `validateUploadUrl`, `validateExternalFetchUrl`, and `sanitizeVkError`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test tests/security.spec.ts`
Expected: PASS (all security assertions green).

- [ ] **Step 5: Commit**
```bash
git add src/security.ts tests/security.spec.ts
git commit -m "feat(security): implement ssrf guard and token sanitization"
```

---

### Task 3: Manifest Declaration & Configuration Validator

**Files:**
- Create: `src/types.ts`
- Create: `src/manifest.ts`
- Test: `tests/config.spec.ts`

- [ ] **Step 1: Write the failing test**
Create `tests/config.spec.ts` verifying:
1. Manifest structure conforms to Paperclip V1 API.
2. Manifest declares exactly 23 tools.
3. Manifest registers both UI slots (`companySettingsPage`, `dashboardWidget`).
4. `onValidateConfig` accepts valid `groupId`, `userTokenRef`, and `groupTokenRef` (both string & object form).
5. `onValidateConfig` rejects missing `groupId` or negative values.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test tests/config.spec.ts`
Expected: FAIL (`manifest` is not defined).

- [ ] **Step 3: Write minimal implementation**
Define config types in `src/types.ts` and export `manifest` with `onValidateConfig` in `src/manifest.ts`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test tests/config.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/types.ts src/manifest.ts tests/config.spec.ts
git commit -m "feat(manifest): define plugin manifest with 23 tools and ui slots"
```

---

### Task 4: High-Performance VK API Client

**Files:**
- Create: `src/vk-client.ts`
- Test: `tests/vk-client.spec.ts`

- [ ] **Step 1: Write the failing test**
Create `tests/vk-client.spec.ts` with local mock HTTP server testing:
1. `call(method, params, tokenType)` targeting `https://api.vk.com/method/{method}` with `v=5.199`.
2. Token dispatching: selects `userToken` when `tokenType: "user"`, `groupToken` when `tokenType: "group"`.
3. Auto-retry on VK Error 6 (Too many requests per second) with backoff.
4. Token redaction when VK Error 5 (User authorization failed) occurs.
5. Strict execution timeout handling.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test tests/vk-client.spec.ts`
Expected: FAIL (`VkApiClient` not defined).

- [ ] **Step 3: Write minimal implementation**
Implement `VkApiClient` in `src/vk-client.ts` using `ctx.http.fetch` or standard `fetch` with token routing and rate control.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test tests/vk-client.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/vk-client.ts tests/vk-client.spec.ts
git commit -m "feat(client): implement safe vk api client with rate limiter and retries"
```

---

### Task 5: Group & Wall Tools (Identity & Core Posts)

**Files:**
- Create: `src/tools/group.ts`
- Create: `src/tools/wall.ts`
- Test: `tests/tools/group.spec.ts`
- Test: `tests/tools/wall.spec.ts`

- [ ] **Step 1: Write the failing test**
Create tests for:
- `vk_group_get_details` (`groups.getById`)
- `vk_group_is_member` (`groups.isMember`)
- `vk_wall_post` (`wall.post`, `from_group: 1`)
- `vk_wall_edit` (`wall.edit`)
- `vk_wall_delete` (`wall.delete`)
- `vk_wall_get` (`wall.get`)
- `vk_wall_pin` / `vk_wall_unpin` (`wall.pin`, `wall.unpin`)

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test tests/tools/group.spec.ts tests/tools/wall.spec.ts`
Expected: FAIL (tool handlers not defined).

- [ ] **Step 3: Write minimal implementation**
Implement handlers in `src/tools/group.ts` and `src/tools/wall.ts`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test tests/tools/group.spec.ts tests/tools/wall.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/tools/group.ts src/tools/wall.ts tests/tools/group.spec.ts tests/tools/wall.spec.ts
git commit -m "feat(tools): implement community identity and wall management tools"
```

---

### Task 6: Media Upload Tools (Photos, Docs, Videos, Polls)

**Files:**
- Create: `src/tools/media.ts`
- Test: `tests/tools/media.spec.ts`

- [ ] **Step 1: Write the failing test**
Create `tests/tools/media.spec.ts` testing:
1. `vk_media_upload_photo`: 3-step pipeline (`photos.getWallUploadServer` -> multipart upload -> `photos.saveWallPhoto`), returning descriptor `photo{owner}_{id}`.
2. `vk_media_upload_document`: `docs.getWallUploadServer` -> upload -> `docs.save`, returning `doc{owner}_{id}`.
3. `vk_media_upload_video`: `video.save`, returning upload URL and `video{owner}_{id}`.
4. `vk_media_create_poll`: `polls.create`, returning `poll{owner}_{id}`.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test tests/tools/media.spec.ts`
Expected: FAIL (media upload handlers not defined).

- [ ] **Step 3: Write minimal implementation**
Implement media upload routines in `src/tools/media.ts` using multipart payloads and safe destination checking.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test tests/tools/media.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/tools/media.ts tests/tools/media.spec.ts
git commit -m "feat(tools): implement media upload and poll tools"
```

---

### Task 7: Comments, Moderation & Direct Messages

**Files:**
- Create: `src/tools/comments.ts`
- Create: `src/tools/messages.ts`
- Test: `tests/tools/comments.spec.ts`
- Test: `tests/tools/messages.spec.ts`

- [ ] **Step 1: Write the failing test**
Create tests for:
- `vk_comments_get` (`wall.getComments`)
- `vk_comments_create` (`wall.createComment`, `from_group: groupId`)
- `vk_comments_delete` (`wall.deleteComment`)
- `vk_members_ban` (`groups.ban`)
- `vk_members_unban` (`groups.unban`)
- `vk_messages_get_conversations` (`messages.getConversations`)
- `vk_messages_get_history` (`messages.getHistory`)
- `vk_messages_send` (`messages.send`, requires `random_id`)
- `vk_messages_mark_as_read` (`messages.markAsRead`)

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test tests/tools/comments.spec.ts tests/tools/messages.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**
Implement handlers in `src/tools/comments.ts` and `src/tools/messages.ts`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test tests/tools/comments.spec.ts tests/tools/messages.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/tools/comments.ts src/tools/messages.ts tests/tools/comments.spec.ts tests/tools/messages.spec.ts
git commit -m "feat(tools): implement comments moderation and direct messaging tools"
```

---

### Task 8: Analytics & Performance Tools

**Files:**
- Create: `src/tools/stats.ts`
- Test: `tests/tools/stats.spec.ts`

- [ ] **Step 1: Write the failing test**
Create `tests/tools/stats.spec.ts` testing:
- `vk_stats_get_summary` (`stats.get`, interval parsing, aggregation)
- `vk_stats_get_post_reach` (`stats.getPostReach`)

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test tests/tools/stats.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**
Implement stats endpoints in `src/tools/stats.ts`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test tests/tools/stats.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/tools/stats.ts tests/tools/stats.spec.ts
git commit -m "feat(tools): implement community statistics and post reach tools"
```

---

### Task 9: Plugin Worker & Data Bridge Handlers

**Files:**
- Create: `src/worker.ts`
- Test: `tests/plugin-lifecycle.spec.ts`

- [ ] **Step 1: Write the failing test**
Create `tests/plugin-lifecycle.spec.ts` using `createTestHarness` from `@paperclipai/plugin-sdk/testing`:
1. Plugin registers all 23 tools.
2. Registers data bridge `vk-community-summary` returning subscriber and activity metrics.
3. Registers data bridge `vk-connection-status` returning token diagnostic health.
4. Executes a mock tool call with company-scoped secret resolution.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test tests/plugin-lifecycle.spec.ts`
Expected: FAIL (`worker` not implemented).

- [ ] **Step 3: Write minimal implementation**
Assemble `definePlugin` in `src/worker.ts` registering all tools and data bridges.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test tests/plugin-lifecycle.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/worker.ts tests/plugin-lifecycle.spec.ts
git commit -m "feat(worker): assemble plugin lifecycle and data bridges"
```

---

### Task 10: UI Layer (Dashboard Widget & Company Settings Page)

**Files:**
- Create: `src/ui/widget.tsx`
- Create: `src/ui/settings.tsx`
- Create: `src/ui/index.tsx`
- Test: `tests/ui-build.spec.ts`

- [ ] **Step 1: Write the failing test**
Create `tests/ui-build.spec.ts` verifying that `scripts/build-ui.mjs` successfully produces `dist/ui/index.js` exporting `VkDashboardWidget` and `VkCompanySettingsPage`.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test tests/ui-build.spec.ts`
Expected: FAIL (`dist/ui/index.js` missing).

- [ ] **Step 3: Write minimal implementation**
Implement `VkDashboardWidget` in `src/ui/widget.tsx`, `VkCompanySettingsPage` in `src/ui/settings.tsx`, export from `src/ui/index.tsx`, and run `node scripts/build-ui.mjs`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test tests/ui-build.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/ui scripts/build-ui.mjs tests/ui-build.spec.ts
git commit -m "feat(ui): implement dashboard widget and company connector settings page"
```

---

### Task 11: Production Build, Secret Scan & GitHub Release

**Files:**
- Create: `README.md`
- Create: `LICENSE`

- [ ] **Step 1: Build both worker and UI**
Run: `pnpm build && pnpm typecheck && pnpm test`
Expected: Exit code 0, 0 type errors, all tests passing.

- [ ] **Step 2: Scan for secret leaks**
Run git history scan to ensure no real tokens or sensitive strings are present.

- [ ] **Step 3: Push to GitHub**
Run: `gh repo create sergeevgit1/paperclip-vk-community-tools --public --source . --remote origin --push`

- [ ] **Step 4: Deploy & Verify in Live Paperclip**
Deploy package to `/paperclip/plugins-local/zaruba.vk-community-tools` on `macbot11i7`, register in company, verify dashboard widget and live tool execution.
