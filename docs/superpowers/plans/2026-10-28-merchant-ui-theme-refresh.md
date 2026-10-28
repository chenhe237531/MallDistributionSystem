# Merchant UI Theme Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the merchant H5 and WeChat Mini Program dual-theme UI with refined semantic tokens, a clearer operations-first home page, unified product media, and consistent responsive component states.

**Architecture:** Keep the existing Taro, React, NutUI and `themePacks` architecture. Extend semantic variables in `@mall/shared`, consume them through `app.scss`, and keep page markup theme-agnostic. Use small pure helpers for home entry grouping and source-level UI contract tests for cross-platform CSS invariants that cannot be meaningfully rendered in the current test stack.

**Tech Stack:** TypeScript, React 18, Taro 4, NutUI React Taro, SCSS, Node test runner, tsx

**Spec:** `docs/superpowers/specs/2026-10-28-merchant-ui-theme-refresh-design.md`

## Global Constraints

- Do not change APIs, database schema, route slugs, primary tab labels, or form field order.
- Both themes share layout, typography, sizing and interaction; only semantic color and material tokens differ.
- Page code must consume `--mall-*` variables and must not add hard-coded theme colors.
- Do not add icon or animation runtime dependencies.
- H5 and WeChat builds must both pass, together with TypeScript and repository tests.
- Fixed bottom actions must preserve safe-area spacing.

## Review Focus

- 320px width: controls and product prices must not overflow or wrap primary actions.
- Theme switch: portals, navigation, input placeholders and bottom bars must not retain the previous theme.
- Missing or broken product image: the neutral branded fallback must preserve the media aspect ratio.
- Long merchant, organisation and product names: hierarchy must remain readable without overlapping notification badges or actions.
- H5 wide viewport and Mini Program safe areas: application shell and bottom navigation must remain centered and reachable.

---

### Task 1: Semantic theme tokens and contract

**Files:**
- Modify: `packages/shared/src/tokens.ts`
- Create: `packages/shared/src/tokens.test.ts`
- Modify: `packages/shared/package.json`
- Modify: `apps/mini-b/src/app.scss`

**Interfaces:**
- Produces: matching `ThemePack.vars` entries for `--mall-surface-raised`, `--mall-surface-sunken`, `--mall-border-strong`, `--mall-focus-ring`, `--mall-disabled-bg`, `--mall-disabled-text`, `--mall-media-bg`, `--mall-overlay`, and `--mall-shell-max`.
- Consumes: existing `ThemePack`, `themePacks` and NutUI variable mapping.

- [ ] **Step 1: Write failing theme token tests**

Add Node tests asserting the exact new palette values from the spec, matching key sets for both themes, and absence of pure black or pure white in the gold theme surfaces.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @mall/shared test`

Expected: FAIL because the new semantic variables and refreshed values are absent.

- [ ] **Step 3: Implement the token refresh and CSS mapping**

Update both theme packs and the top-level CSS variable blocks. Map overlay, disabled, media and focus states into NutUI and shared primitives without changing theme selection behavior.

- [ ] **Step 4: Run focused and shared type checks**

Run: `pnpm --filter @mall/shared test && pnpm --filter @mall/shared typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat(mini-b): refine dual-theme semantic tokens`

### Task 2: Operations-first home hierarchy

**Files:**
- Modify: `apps/mini-b/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/mini-b/src/config/home.ts`
- Create: `apps/mini-b/src/config/home.test.ts`
- Modify: `apps/mini-b/src/pages/index/index.tsx`
- Modify: `apps/mini-b/src/app.scss`

**Interfaces:**
- Produces: `PRIMARY_HOME_ENTRIES: HomeEntry[]` and `SECONDARY_HOME_ENTRIES: HomeEntry[]`, with five unique primary entries and all remaining entries in the secondary list.
- Consumes: Task 1 semantic surface and focus tokens.

- [ ] **Step 1: Add mini-b test runner and failing entry-group tests**

Assert that primary entries are exactly 5, include procurement/prepaid/pricing/report/customers in the intended order, secondary entries contain no duplicate labels, and both groups cover `HOME_ENTRIES` exactly once.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @mall/mini-b test -- src/config/home.test.ts`

Expected: FAIL because the grouped exports do not exist.

- [ ] **Step 3: Implement grouping and home layout**

Add the two exports, show primary entries by default, add an accessible expand/collapse control for all applications, move the metric card before application shortcuts, tighten merchant identity copy, and give banners a consistent action-oriented structure without introducing unsupported claims.

- [ ] **Step 4: Add responsive and theme-neutral home styles**

Use semantic variables for cards, search, metrics and application grids. Ensure five shortcuts fit as a horizontal mobile row and secondary applications use a compact grid.

- [ ] **Step 5: Verify tests and type checks**

Run: `pnpm --filter @mall/mini-b test && pnpm --filter @mall/mini-b typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit: `feat(mini-b): prioritize merchant home operations`

### Task 3: Product media and shared component states

**Files:**
- Create: `apps/mini-b/src/ui-contract.test.ts`
- Modify: `apps/mini-b/src/components/goods/GoodsThumb.tsx`
- Modify: `apps/mini-b/src/components/goods/GoodsCard.tsx`
- Modify: `apps/mini-b/src/pages/product-detail/index.tsx`
- Modify: `apps/mini-b/src/app.scss`

**Interfaces:**
- Produces: `GoodsThumb` sizes `sm | md | lg | hero`, shared `goods-media-stage` and `goods-card-action` classes.
- Consumes: Task 1 media, raised surface, disabled and focus tokens.

- [ ] **Step 1: Write failing product UI contract tests**

Assert the hero size is accepted, product detail renders a media stage around the hero image, list actions use the shared action class, and SCSS contains fixed 1:1 thumbnail and 4:3 hero media contracts.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @mall/mini-b test -- src/ui-contract.test.ts`

Expected: FAIL because the hero media and shared action contracts are absent.

- [ ] **Step 3: Implement media stage and product card states**

Add the hero size, wrap detail media in a semantic neutral stage, standardize fallbacks, tags, price hierarchy and add-to-cart focus/pressed/disabled behavior.

- [ ] **Step 4: Verify focused tests and type checks**

Run: `pnpm --filter @mall/mini-b test && pnpm --filter @mall/mini-b typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat(mini-b): unify product media presentation`

### Task 4: Global component polish and dual-platform verification

**Files:**
- Modify: `apps/mini-b/src/app.scss`
- Modify: `apps/mini-b/src/components/Button.tsx`
- Modify: `apps/mini-b/src/components/AppTabbar.tsx`
- Modify: `docs/商家小程序黑金主题设计方案.md`

**Interfaces:**
- Produces: consistent button, card, navigation, form, dialog, empty, loading, focus and responsive shell states for both themes.
- Consumes: all Task 1 tokens and Task 2/3 class contracts.

- [ ] **Step 1: Extend UI contract tests and verify RED**

Assert semantic focus-visible support, safe-area padding, H5 max-width shell, theme-neutral disabled states, and reduced-motion transition behavior.

- [ ] **Step 2: Implement global component polish**

Consolidate component shape rules, reduce theme-specific gold borders and glow, add keyboard focus for H5, safe-area padding, centered wide H5 shell, form contrast, skeleton, dialog and empty-state parity.

- [ ] **Step 3: Update implementation documentation**

Record the v2 token additions, page changes, verification matrix and known limits in the existing black-gold design document.

- [ ] **Step 4: Run complete verification**

Run: `pnpm test && pnpm typecheck && pnpm --filter @mall/mini-b build:h5 && pnpm --filter @mall/mini-b build`

Expected: all commands exit 0.

- [ ] **Step 5: Perform source and rendered artifact review**

Review the complete diff against the spec, inspect generated CSS for both theme selectors and verify no critical or important findings remain.

- [ ] **Step 6: Commit**

Commit: `feat(mini-b): complete dual-theme visual refresh`
