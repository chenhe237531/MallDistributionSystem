# Merchant Prototype Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved 百英诺 black-gold merchant prototype to the existing shared H5 and WeChat Mini Program interface without changing business behaviour.

**Architecture:** Retain the existing Taro React routes and semantic theme variables. Extend the current black-gold-only presentation layer and a small set of reusable view components; screens consume those components and existing APIs so the same source compiles to H5 and WeChat Mini Program.

**Tech Stack:** TypeScript, React 18, Taro 4, NutUI React Taro, SCSS, Node test runner, tsx.

**Spec:** `docs/superpowers/specs/2026-10-28-merchant-prototype-application-design.md`

## Global Constraints

- Preserve existing API calls, routes, authentication, cart storage and transaction behaviour.
- Keep all new theme styling behind semantic `--mall-*` variables or `.theme-gold` scope; classic theme remains usable.
- Do not add runtime dependencies or embed generated prototype images as application UI.
- H5 and WeChat Mini Program must build; fixed bottom actions preserve safe-area padding.

## Review Focus

- 320px width: purchase and authentication CTAs must remain single-line and reachable.
- Theme switching: new black-gold decoration must not leak into classic styling or portal dialogs.
- Real product images and no-image fallback must keep a stable media frame.
- Long merchant/product labels must not collide with actions or overflow their cards.
- H5 focus and WeChat touch interactions must both open and close sheets predictably.

---

### Task 1: Prototype surface primitives and UI contract

**Files:**
- Modify: `apps/mini-b/src/ui-contract.test.ts`
- Modify: `apps/mini-b/src/app.scss`

**Interfaces:**
- Produces: black-gold-only `prototype-*` surface classes, consistent decorative backdrop, frosted card, gold action and safe-area sheet contracts.
- Consumes: existing `theme-gold` and `--mall-*` variables.

- [ ] **Step 1: Write failing source contract tests** for the prototype surface classes, gold scope, H5 shell and safe-area sheet rule.
- [ ] **Step 2: Run the focused test and verify RED.**
- [ ] **Step 3: Add the semantic, black-gold scoped SCSS primitives** without changing classic-theme colour values.
- [ ] **Step 4: Run the focused test and TypeScript check to verify GREEN.**
- [ ] **Step 5: Commit** `feat(mini-b): add prototype visual primitives`.

### Task 2: Apply the login, home and profile compositions

**Files:**
- Modify: `apps/mini-b/src/pages/login/index.tsx`
- Modify: `apps/mini-b/src/pages/index/index.tsx`
- Modify: `apps/mini-b/src/pages/profile/index.tsx`
- Modify: `apps/mini-b/src/ui-contract.test.ts`
- Modify: `apps/mini-b/src/app.scss`

**Interfaces:**
- Produces: prototype composition classes applied to existing login, merchant dashboard and profile data.
- Consumes: Task 1 surface primitives and the current theme, API and navigation interfaces.

- [ ] **Step 1: Write failing source contract tests** for brand headers, operations card ordering, five shortcuts and profile account sections.
- [ ] **Step 2: Run the focused test and verify RED.**
- [ ] **Step 3: Reshape screen markup and CSS around current data and handlers**, preserving every existing endpoint and navigation target.
- [ ] **Step 4: Run focused tests and TypeScript check to verify GREEN.**
- [ ] **Step 5: Commit** `feat(mini-b): apply merchant dashboard prototype`.

### Task 3: Apply the catalogue and detail compositions

**Files:**
- Modify: `apps/mini-b/src/components/goods/GoodsCard.tsx`
- Modify: `apps/mini-b/src/pages/procurement/index.tsx`
- Modify: `apps/mini-b/src/pages/product-detail/index.tsx`
- Modify: `apps/mini-b/src/ui-contract.test.ts`
- Modify: `apps/mini-b/src/app.scss`

**Interfaces:**
- Produces: two-column prototype product cards, horizontal category rail and a product detail layout with a specification selector trigger.
- Consumes: existing product type, category filtering, goods media and cart functions.

- [ ] **Step 1: Write failing source contract tests** covering the card action, category rail, media stage and specification selector trigger.
- [ ] **Step 2: Run the focused test and verify RED.**
- [ ] **Step 3: Implement the catalogue and detail markup/CSS** while retaining filtering, product detail loading and add-to-cart behaviour.
- [ ] **Step 4: Run focused tests and TypeScript check to verify GREEN.**
- [ ] **Step 5: Commit** `feat(mini-b): apply commerce prototype screens`.

### Task 4: Specification and submission feedback states

**Files:**
- Modify: `apps/mini-b/src/pages/product-detail/index.tsx`
- Modify: `apps/mini-b/src/pages/cart/index.tsx`
- Modify: `apps/mini-b/src/ui-contract.test.ts`
- Modify: `apps/mini-b/src/app.scss`

**Interfaces:**
- Produces: a safe-area specification bottom sheet and an order-submitted confirmation state; both close deterministically and preserve existing cart submit request.
- Consumes: Task 1 sheet primitives and Task 3 product actions.

- [ ] **Step 1: Write failing source contract tests** for the specification sheet, selection controls and success dialog action.
- [ ] **Step 2: Run the focused test and verify RED.**
- [ ] **Step 3: Implement local state and visual feedback**, keeping cart POST semantics unchanged.
- [ ] **Step 4: Run focused tests and TypeScript check to verify GREEN.**
- [ ] **Step 5: Commit** `feat(mini-b): add prototype purchase feedback`.

### Task 5: Dual-platform verification

**Files:**
- Modify: `docs/商家小程序黑金主题设计方案.md`

**Interfaces:**
- Produces: documentation for prototype-derived page coverage and platform constraints.
- Consumes: all previous tasks.

- [ ] **Step 1: Update the black-gold design documentation** with applied screens and known image/content limitations.
- [ ] **Step 2: Run `pnpm --filter @mall/mini-b test`, `pnpm --filter @mall/mini-b typecheck`, `pnpm --filter @mall/mini-b build:h5`, and `pnpm --filter @mall/mini-b build`.**
- [ ] **Step 3: Inspect the changed source and generated output for the Review Focus cases.**
- [ ] **Step 4: Commit** `docs(mini-b): record prototype application coverage`.
