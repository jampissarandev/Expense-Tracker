# Plan: Wire Unwired App-Shell Refactor + Semantic Color Tokens

> Origin: Follow-up to commits `310a89e`, `a239fc5`, `f7f7843` (landed 2026-07-08 on `feat/popup-elevation-phase1-tokens`). Those introduced `colors.ts`, `TopBar`, `MobileTabBar`, `PageHeader`, `SegmentedControl`, `DeleteConfirmDialog` as **unwired scaffolding**. This plan finishes the job: declare missing CSS tokens and connect consumers so the new components actually replace their inline equivalents in the app.
> Scope: Frontend only. No backend changes, no new dependencies (everything already installed).
> Format: 4 phases, each independently revertible. TDD where behavior changes; pure replace-in-place refactor skips test-first but existing tests must stay green.

## TL;DR

The previous commits shipped new components/utilities with **no consumers** and **no CSS token declarations** for `colors.ts`. Result: dead code on disk, typecheck green by accident.

This plan wires it all in:

| Phase | Goal | Risk | Blocking? |
|---|---|---|---|
| **A** | Declare missing semantic CSS tokens (`--success`, `--danger`, `--info`, `--warning`, `--chart-1..10`, `--success-foreground`, etc.) in `index.css` | Low — additive CSS only | Yes |
| **B** | Migrate hard-coded green/red Tailwind classes to `colors.ts` helpers (`DashboardPage`, `TransactionsPage`) | Medium — visual regression risk; needs visual diff | Yes |
| **C** | Replace inline `<h1>` headers with `PageHeader` (`DashboardPage`, `TransactionsPage`, `CategoriesPage`) | Low — pure refactor | No |
| **D** | Replace inline delete `AlertDialog` (~30 lines each in `CategoriesPage` + `TransactionsPage`) with `DeleteConfirmDialog` | Low — pure refactor; must keep the test mock expectations intact | No |
| **E** | Migrate `AppLayout` from `Header` → `TopBar` + `MobileTabBar` (mobile-first shell) | High — touches the authenticated-shell entry point; all e2e flows pass through it | No (after A–D land) |

> Sequencing: A → B → C → D → E. A unlocks B (tokens needed). C and D are independent refactors on top of A. E is riskiest and depends on all previous phases landing first.

---

## Conventions

- **PR size**: target ≤100 LOC changed per concern. Multi-file refactors split across commits when they touch different pages.
- **TDD**: write a failing assertion for any behavior change. Pure visual swaps / replace-in-place refactors keep the existing test suite green and add nothing new unless a behavior is new.
- **One concern per commit** — per `.github/copilot-instructions.md`. No drive-by formatting.
- **Branch naming**: `ui/wire-<phase>-<slug>` (e.g. `ui/wire-a-semantic-tokens`, `ui/wire-b-color-helpers`).
- **Verification per commit** (before requesting review):
  - `npm test` (vitest — 186 tests must stay green; `TransactionFormDialog` mock interactions in `TransactionsPage.test.tsx` are particularly brittle, re-run after any TransactionsPage edit)
  - `npm run lint` + `npm run typecheck` + `npm run build`
  - Manual visual diff for B and E (open dashboard, transactions, categories, both light/dark)
- **Out of scope (explicit)**:
  - The `DateInput` / Dropdown-background changes — those live in `transactions-filter-ui-polish.md`.
  - Backend, API contracts, DB schema.
  - The `Header.tsx` file itself is **kept** in the repo after Phase E; only `AppLayout` stops importing it. Deletion of `Header.tsx` is a separate deprecation tracked in §"Future work" (use the `deprecation-and-migration` skill when the time comes).

---

## Current state (as of 2026-07-08, post-refactor commits)

### What was added (unwired)

- `frontend/src/lib/colors.ts` — exposes:
  - `textSuccess/Danger/Info/Warning/Muted`, `textOnSuccess/Danger/Info`
  - `bgSoftSuccess/Danger/Info/Warning`
  - `textAmountClass(type)`, `chipAmountClass(type)`
  - `CHART_COLORS` array
  - All reference CSS tokens (`--success`, `--danger`, `--info`, `--warning`, `--success-foreground`, …, `--chart-1..10`) that are **NOT declared anywhere in `index.css`** today.
- `frontend/src/components/layout/TopBar.tsx` — sticky top bar with page-title lookup via `useLocation` + `PAGE_TITLES`; imports `UserMenu` + `ModeToggle`. Not imported by anyone.
- `frontend/src/components/layout/MobileTabBar.tsx` — bottom tab bar with center "Add" button; takes `onAdd?: () => void`. Not imported by anyone.
- `frontend/src/components/common/PageHeader.tsx` — `<h1>` + eyebrow + description + right-aligned actions; responsive wrap. Not imported by anyone.
- `frontend/src/components/common/SegmentedControl.tsx` — radio-group segmented control. Not imported by anyone. **No obvious consumer exists today** (see §"Open questions" — may be unused).
- `frontend/src/components/common/DeleteConfirmDialog.tsx` — wraps `AlertDialog` with `Trash2Icon` media, `isPending` disabling, caller-owned close. Not imported by anyone.

### What the consumers currently do (to be replaced)

- `frontend/src/components/layout/AppLayout.tsx` (line 10) imports `Header` from `@/components/layout/Header` → renders `<Header onMenuClick={…} />`. **No children passed**, so the page-title area is empty in the current shell.
- `frontend/src/components/layout/Header.tsx` (29 LOC) — the simplified header: hamburger + empty `children` div + `ModeToggle` + `UserMenu`. Used by `AppLayout` only.
- `frontend/src/pages/DashboardPage.tsx`:
  - line 159: `<h1 className="text-2xl font-bold">แดชบอร์ด</h1>`
  - line 204: `text-green-600` (income summary card title)
  - line 222: `text-red-600` (expense summary card title)
  - line 250–251: `text-green-600` / `text-red-600` (delta indicator)
  - line 59 (local `const CHART_COLORS = [...]` — overrides the one in `colors.ts`; chart colors are currently arbitrary hex, not CSS tokens)
- `frontend/src/pages/TransactionsPage.tsx`:
  - line 236: `<h1 className="text-2xl font-bold">รายการ</h1>`
  - line 460–461: `text-green-600 dark:text-green-400` / `text-red-600 dark:text-red-400` (amount cells) — manual dark-mode branch, exactly the anti-pattern `colors.ts` solves
  - lines ~534–560: an inline `<AlertDialog>` for delete confirmation that duplicates `DeleteConfirmDialog`
- `frontend/src/pages/CategoriesPage.tsx`:
  - line 125 / 157: `<h1 className="text-2xl font-bold">หมวดหมู่</h1>` (twice — once in the empty state, once in the list state)
  - lines ~252–290: an inline `<AlertDialog>` for delete confirmation that duplicates `DeleteConfirmDialog`
- `frontend/src/pages/NotFoundPage.tsx`, `LoginPage.tsx`, `RegisterPage.tsx` use `<h1>`/`CardTitle` but are **out of scope** for `PageHeader` (unauthenticated/error shells — the mobile shell migration doesn't touch them; using `PageHeader` here would require passing actions/eyebrow and adds no value on auth pages).

### Test landscape

- `frontend/tests/unit/components/TransactionsPage.test.tsx` (1043 LOC) — heavy mocks: `@/components/ui/select`, `@/components/ui/alert-dialog` is **not** mocked fully (appears to use a partial inline mock — re-verify), `TransactionFormDialog` is mocked. The delete-dialog flow is exercised end-to-end via the real `AlertDialog` or its mock — **any change to TransactionsPage's inline AlertDialog in Phase D must keep the test selectors working** (currently uses `getByRole("button", { name: /^ลบ$/i })`).
- `frontend/tests/unit/components/CategoriesPage.test.tsx` — analogous; delete flow tested.
- `frontend/tests/unit/components/AppLayout.test.tsx` exists — Phase E must keep it green; it currently asserts on `Header`-based behavior (re-verify before editing).
- `frontend/tests/e2e/` — Playwright; every authenticated flow passes through `AppLayout` — Phase E needs an e2e smoke run.

---

# Phase A — Declare missing semantic CSS tokens

> **Goal**: `colors.ts` and any `var(--success)` / `var(--chart-N)` references resolve to actual colors in both light and dark mode. Nothing visually breaks because no consumer is wired yet — this phase is **purely additive CSS**.
> **Exit criteria**: `colors.ts` is referenced in a temporary scratch render (deleted before commit) and the tokens resolve; `npm run build` picks them up via Tailwind v4's `@theme`; existing 186 tests stay green; no visual regression.

## A1. Add semantic tokens to `index.css`

**Files**:
- `frontend/src/index.css` — add new tokens under `:root` and `.dark`.

**Token table** (proposed values — confirm in review):

| Token | Light | Dark | Used by |
|---|---|---|---|
| `--success` | `oklch(0.65 0.17 145)` | `oklch(0.7 0.17 145)` | `textSuccess`, `bgSoftSuccess` |
| `--success-foreground` | `oklch(0.985 0 0)` | `oklch(0.145 0 0)` | text on solid success chips |
| `--danger` | `oklch(0.58 0.22 25)` | `oklch(0.65 0.22 25)` | `textDanger`, `bgSoftDanger` |
| `--danger-foreground` | `oklch(0.985 0 0)` | `oklch(0.145 0 0)` | text on solid danger chips |
| `--info` | `oklch(0.6 0.13 230)` | `oklch(0.7 0.13 230)` | `textInfo`, `bgSoftInfo` |
| `--info-foreground` | `oklch(0.985 0 0)` | `oklch(0.145 0 0)` | text on solid info chips |
| `--warning` | `oklch(0.75 0.16 80)` | `oklch(0.8 0.16 80)` | `textWarning`, `bgSoftWarning` |
| `--warning-foreground` | `oklch(0.145 0 0)` | `oklch(0.145 0 0)` | text on solid warning chips (dark text on amber) |
| `--chart-1` | `oklch(0.65 0.17 145)` | `oklch(0.7 0.17 145)` | recharts income |
| `--chart-2` | `oklch(0.58 0.22 25)` | `oklch(0.65 0.22 25)` | recharts expense |
| `--chart-3` | `oklch(0.6 0.13 230)` | `oklch(0.7 0.13 230)` | recharts category 3 |
| `--chart-4` | `oklch(0.7 0.15 60)` | `oklch(0.75 0.15 60)` | category 4 |
| `--chart-5` | `oklch(0.6 0.18 300)` | `oklch(0.7 0.18 300)` | category 5 |
| `--chart-6` | `oklch(0.65 0.15 180)` | `oklch(0.7 0.15 180)` | category 6 |
| `--chart-7` | `oklch(0.7 0.14 20)` | `oklch(0.75 0.14 20)` | category 7 |
| `--chart-8` | `oklch(0.6 0.15 130)` | `oklch(0.7 0.15 130)` | category 8 |
| `--chart-9` | `oklch(0.65 0.16 280)` | `oklch(0.72 0.16 280)` | category 9 |
| `--chart-10` | `oklch(0.7 0.12 200)` | `oklch(0.75 0.12 200)` | category 10 |

**Decisions deferred to review**:
- Whether to reuse `--destructive` for `--danger` (saves a token but couples two semantic axes). Recommendation: **keep them separate** — `--destructive` is for *form-error / destructive action* states, `--danger` is for the *amount-is-an-expense* semantic. Coupling them means changing one later forces the other.
- Dark-mode lightness for chart colors: bumping lightness in dark mode is the convention (see the existing `--accent` light-0.965 / dark-0.269 pattern). Values above follow that.

**TDD**: No behavior change. No new test. Verify visually with a throwaway scratch component rendered in a running dev server (delete before commit).

**Risks**:
- Tailwind v4 `@theme` integration: confirm whether the new tokens are picked up automatically (the existing `bg-popover` etc. work — they're referenced via `var(--popover)` in component classNames, not via `@theme`). Since `colors.ts` uses `bg-[color:var(--success)]/10`, **no `@theme` registration is required** — raw `var()` references work directly. Keep the CSS in `index.css` minimal: just `:root` and `.dark` declarations.

## A. Exit criteria for Phase A

- [ ] Tokens `--success`, `--danger`, `--info`, `--warning`, `--success-foreground`, `--danger-foreground`, `--info-foreground`, `--warning-foreground`, `--chart-1..10` declared in `:root` and `.dark`.
- [ ] `npm run build` succeeds.
- [ ] `npm test` → 186/186.
- [ ] No consumer behavior changes — purely additive.

---

# Phase B — Migrate hard-coded green/red classes to `colors.ts` helpers

> **Goal**: `DashboardPage` and `TransactionsPage` use `textAmountClass`, `textSuccess`, `textDanger`, `bgSoftSuccess`, `bgSoftDanger`, and `CHART_COLORS` from `@/lib/colors` instead of hard-coded `text-green-600` / `text-red-600 dark:text-red-400`. Colors adapt to light/dark via the tokens from Phase A.
> **Exit criteria**: No `text-green-`, `text-red-`, `bg-emerald-`, `bg-red-` literal Tailwind classes remain in `DashboardPage.tsx` or `TransactionsPage.tsx`. Visual diff in light and dark mode shows equivalent or improved contrast. 186 tests green.

## B1. DashboardPage — summary cards + delta indicator

**Files**:
- `frontend/src/pages/DashboardPage.tsx`

**Changes**:
- Import `textSuccess`, `textDanger`, `CHART_COLORS` from `@/lib/colors`.
- Remove the local `const CHART_COLORS = [...]` (line 59) and use the imported one.
- Replace:
  - line 204 `text-green-600` → `textSuccess` (income card title)
  - line 222 `text-red-600` → `textDanger` (expense card title)
  - lines 250–251 `text-green-600` / `text-red-600` → `textSuccess` / `textDanger` (delta indicator)
- Replace any inline `fill="#10b981"` / `fill="#ef4444"` (if present — recheck) with `var(--chart-1)` / `var(--chart-2)` via the imported `CHART_COLORS`.

**TDD**: No new test — pure refactor; existing `DashboardPage.test.tsx` selectors by text/role remain valid.

**Risks**: Chart colors changing may shift screenshot tests if any exist. Grep `frontend/tests/**` for `CHART_COLORS|fill=|recharts` — confirm no snapshot pins specific hex. If a Playwright visual test pins colors, update its baseline.

## B2. TransactionsPage — amount cells

**Files**:
- `frontend/src/pages/TransactionsPage.tsx`

**Changes**:
- Import `textAmountClass` from `@/lib/colors`.
- Replace the inline `text-green-600 dark:text-green-400` / `text-red-600 dark:text-red-400` at lines 460–461 with `textAmountClass(type === TransactionType.Income ? "income" : "expense")` — **or** inline `cn("text-right", type === TransactionType.Income ? textSuccess : textDanger, "tabular-nums")` if `textAmountClass` doesn't line up with the existing class set. Prefer the helper for consistency.

**TDD**: The `TransactionsPage.test.tsx` suite asserts amount formatting via text content (`formatTHB`), not class names — so the class swap is invisible to tests. Run the suite to confirm.

**Risks**: The amount is inside a `<TableCell>`. Confirm the `tabular-nums` class is still applied (it is part of `textAmountClass` already).

## B3. Grep + cleanup sweep

**Command**: `grep -rn "text-green-|text-red-|bg-emerald-|bg-red-" frontend/src/` — should return **zero matches** (excluding `node_modules` / build output).

If any remain outside scope (e.g. an icon glyph in `Sonner.tsx`), document why in the PR.

## B. Exit criteria for Phase B

- [ ] `DashboardPage.tsx` uses `CHART_COLORS` from `@/lib/colors` and `textSuccess`/`textDanger`.
- [ ] `TransactionsPage.tsx` uses `textAmountClass` (or `textSuccess`/`textDanger`) for amount cells.
- [ ] `grep -rn "text-green-\|text-red-\|bg-emerald-\|bg-red-" frontend/src/` is empty.
- [ ] Visual diff light/dark: income still reads as "positive", expense still reads as "negative", contrast ≥ existing.
- [ ] `npm test` green.

---

# Phase C — Replace inline `<h1>` with `PageHeader`

> **Goal**: Authenticated pages share a single page-header component (`PageHeader`) for `<h1>` + actions, eliminating the duplicated `text-2xl font-bold` boilerplate.
> **Exit criteria**: `DashboardPage`, `TransactionsPage`, `CategoriesPage` use `<PageHeader>` for their main header. Existing header text is unchanged. All tests green.

## C1. DashboardPage header

**Files**:
- `frontend/src/pages/DashboardPage.tsx`

**Changes**:
- Import `PageHeader` from `@/components/common/PageHeader`.
- Replace `<h1 className="text-2xl font-bold">แดชบอร์ด</h1>` (line 159) with:
  ```tsx
  <PageHeader title="แดชบอร์ด" description="ภาพรวมรายรับรายจ่ายของคุณ" />
  ```
  (or no description if the dashboard has no subtitle today — keep scope tight)
- Any right-aligned actions (e.g. export buttons) move into `<PageHeader actions={…} />`.
- Note: `PageHeader` uses `text-2xl font-semibold tracking-tight` (slightly different from current `text-2xl font-bold`). **Confirm with the user** this visual change is acceptable (§"Open questions"); if not, align `PageHeader` to `font-bold` instead.

**TDD**: No new test. The `DashboardPage.test.tsx` matches by text (`แดชบอร์ด`) → still works because `PageHeader.title` is the `<h1>` text content.

## C2. TransactionsPage header

**Files**:
- `frontend/src/pages/TransactionsPage.tsx`

**Changes**:
- Replace `<h1 className="text-2xl font-bold">รายการ</h1>` (line 236) with `<PageHeader title="รายการ" actions={…} />`.
- The add/export/clear buttons currently in the header div move into the `actions` prop.
- **Risk**: The `<h1>` currently lives inside a flex row with those buttons; `PageHeader` handles the flex layout itself (right-aligned actions wrap on small screens). Verify the wrapping behavior matches the mobile spec.

**TDD**: `TransactionsPage.test.tsx` finds the add button by role+name (`getByRole("button", { name: /เพิ่มรายการ$/i })`); the change is invisible to that selector. Run the suite.

## C3. CategoriesPage header

**Files**:
- `frontend/src/pages/CategoriesPage.tsx`

**Changes**:
- There are **two** inline `<h1 className="text-2xl font-bold">หมวดหมู่</h1>` (lines 125 and 157) — one in each conditional branch (empty list vs. list). Hoist a single `<PageHeader title="หมวดหมู่" description="จัดการหมวดหมู่รายรับรายจ่าย" actions={…} />` **above** the conditional, so both branches inherit the same header.
- The add button moves into `actions`.

**TDD**: `CategoriesPage.test.tsx` matches by text (`หมวดหมู่` + button labels) — unaffected. Run the suite.

## C4. (Decision) PageHeader font-weight alignment

If the user wants `font-bold` preserved, edit `frontend/src/components/common/PageHeader.tsx` to change `font-semibold tracking-tight` → `font-bold`. One-line change. Default recommendation: **keep `PageHeader` as designed** (`font-semibold tracking-tight`) and update all three pages, since `tracking-tight` is the modern Tailwind shadcn default and reads cleaner at `text-2xl`.

## C. Exit criteria for Phase C

- [ ] `DashboardPage`, `TransactionsPage`, `CategoriesPage` use `<PageHeader>`.
- [ ] The duplicated inline `<h1>` in `CategoriesPage` collapses to a single instance above the conditional branch.
- [ ] All header text content is byte-identical to before (Thai strings preserved).
- [ ] `npm test` green.

---

# Phase D — Replace inline delete AlertDialog with `DeleteConfirmDialog`

> **Goal**: Remove ~30 lines of duplicated `AlertDialog` boilerplate from `CategoriesPage` and `TransactionsPage`; both call `<DeleteConfirmDialog>` with their own `onConfirm`/`isPending`/`description`.
> **Exit criteria**: Both pages use `DeleteConfirmDialog`. The `Trash2Icon` import in each page file can be dropped (it moves into `DeleteConfirmDialog`). Delete confirmation behavior unchanged — same button labels (`ลบ` / `ยกเลิก`), same pending state, same caller-owned close.

## D1. TransactionsPage delete dialog

**Files**:
- `frontend/src/pages/TransactionsPage.tsx`

**Changes**:
- Import `DeleteConfirmDialog` from `@/components/common/DeleteConfirmDialog`.
- Remove imports of `AlertDialog*` and `Trash2Icon` (still used at line 486 as a row-action icon — recheck; the row-action `Trash2Icon` stays if it's in the row menu, only the dialog-media one goes).
- Replace the inline `<AlertDialog>...<AlertDialogContent>...</AlertDialog>` block (lines ~534–560) with:
  ```tsx
  <DeleteConfirmDialog
    open={!!deletingTransaction}
    onOpenChange={(open) => { if (!open) setDeletingTransaction(null) }}
    title="ยืนยันการลบ"
    description={<>ยืนยันที่จะลบรายการ {formatThaiDate(deletingTransaction?.occurredOn ?? "")}…</>}
    isPending={deleteMutation.isPending}
    onConfirm={() => deleteMutation.mutate(deletingTransaction?.id)}
  />
  ```
  (exact prop wiring may differ — re-read the existing block before editing.)

**TDD**: The existing test at `TransactionsPage.test.tsx` line ~842 clicks a delete button, then confirms via `getByRole("button", { name: /^ลบ$/i })`. `DeleteConfirmDialog`'s `AlertDialogAction` continues to render that button with the same label — selector unaffected. Run the suite after the edit.

**Risks**:
- The current test mock for `@/components/ui/alert-dialog` in TransactionsPage is **partial** — re-verify by reading the mock. If the test mocks AlertDialog, `DeleteConfirmDialog` (which itself imports AlertDialog) inherits the mock automatically. Good.
- If the mock captures structural details (e.g. specific child counts), inspect before editing.

## D2. CategoriesPage delete dialog

**Files**:
- `frontend/src/pages/CategoriesPage.tsx`

**Changes**: Analogous to D1. Replace the inline `<AlertDialog>` block (lines ~252–290) with `<DeleteConfirmDialog>`.

**TDD**: `CategoriesPage.test.tsx` asserts the same `ลบ`/`ยกเลิก` button labels — unaffected.

## D3. Drop unused AlertDialog imports

After D1 + D2, grep each page for stale `AlertDialog*` imports and remove them. If `AlertDialog` is no longer imported directly, ESLint will flag the unused imports — fix as part of the same commit.

## D. Exit criteria for Phase D

- [ ] `TransactionsPage` and `CategoriesPage` use `DeleteConfirmDialog`.
- [ ] No inline `<AlertDialog>` block remains in either file for delete flows.
- [ ] Button labels (`ลบ`, `ยกเลิก`, `กำลังลบ...`) and pending-disabled behavior identical.
- [ ] `TransactionsPage.test.tsx` delete flow + `CategoriesPage.test.tsx` delete flow pass unchanged.
- [ ] `npm test` green; `npm run lint` clean.

---

# Phase E — Migrate AppLayout from `Header` to `TopBar` + `MobileTabBar`

> **Goal**: The authenticated shell uses the new mobile-first layout: `TopBar` on top (with page-title + right-side actions) and `MobileTabBar` on the bottom for `<lg` screens. Desktop keeps the sidebar.
> **Exit criteria**: `AppLayout` imports `TopBar` + `MobileTabBar` (no `Header`). Sidebar stays on desktop. Mobile uses the bottom tab bar for primary navigation and a hamburger-less top bar (TopBar collapses to title + actions on mobile). All tests + e2e pass.

> **⚠️ High risk** — every authenticated route goes through `AppLayout`. Land A–D first, then E in isolation, with a Playwright smoke run.

## E1. Design the mobile-first shell contract

**Decisions to confirm with user before coding**:

1. **Does the desktop sidebar stay?** Plan assumes **yes** — TopBar replaces Header; MobileTabBar is `lg:hidden`; Sidebar stays `hidden lg:block`. On mobile, navigation is via the bottom tabs.
2. **Where does "Add transaction" go on desktop?** Today there's no global add button on desktop (each page has its own add button in the page header, via Phase C). `MobileTabBar`'s center `+` is mobile-only. Confirm.
3. **MobileTabBar's `onAdd`**: what does it do? Open `TransactionFormDialog` globally? Or route to `/transactions/new`? Plan assumes: open the dialog globally via a callback in `AppLayout` — but `TransactionFormDialog` is currently page-local to `TransactionsPage`. This is a non-trivial lift; **flag as a separate sub-phase E2** unless the user wants the simple "navigate to /transactions and click add" behavior.
4. **Page-title source**: `TopBar` uses `PAGE_TITLES` keyed by path regex. New routes must register there. Acceptable? Alternative: pages declare their own title via context. Plan keeps `PAGE_TITLES` — it's already in `TopBar.tsx`.
5. **Auth pages** (`/login`, `/register`, `/404`): these don't use `AppLayout`; they're unaffected. Confirm.

## E2. `MobileTabBar.onAdd` wiring (sub-phase)

**Files**:
- `frontend/src/components/layout/AppLayout.tsx`
- `frontend/src/features/transactions/TransactionFormDialog.tsx` — or a new lightweight "global add transaction" entry point.

**Two options, in order of preference**:

1. **Navigate**: `onAdd` → `navigate("/transactions")` (mobile user taps `+`, lands on Transactions, taps the in-page add button). Simplest, no global dialog state. Recommended for Phase E.
2. **Global dialog**: lift `TransactionFormDialog` usage into `AppLayout` with a context-based open trigger. More work; defer to a follow-up if option 1 is acceptable.

**TDD**: Add an e2e: click the bottom-tab `+` on mobile viewport, assert navigation to `/transactions`.

## E3. AppLayout.tsx rewrite

**Files**:
- `frontend/src/components/layout/AppLayout.tsx`

**Changes**:
- Replace `import { Header } from "@/components/layout/Header"` → `import { TopBar } from "@/components/layout/TopBar"`.
- Add `import { MobileTabBar } from "@/components/layout/MobileTabBar"`.
- Replace `<Header onMenuClick={() => setMobileNavOpen(true)} />` with `<TopBar onMenuClick={() => setMobileNavOpen(true)} actions={…} />`.
- Keep the existing `Sheet` (`mobileNavOpen`) for the hamburger-driven mobile nav — **note**: if `MobileTabBar` provides primary navigation on mobile, do we still need the hamburger/Sheet? Decision: **keep the Sheet for now** (gives access to less-frequent routes / settings); remove in a follow-up if redundant.
- Add `<MobileTabBar onAdd={…} />` at the bottom of the main column.
- Pad the bottom of `<main>` by `h-16` on mobile so content isn't hidden behind the bar (`pb-16 lg:pb-0` or similar).

**TDD**: `AppLayout.test.tsx` — update to assert `TopBar` and `MobileTabBar` render; the existing Header-based assertions must be migrated. If the test pins header role/name, update to the new top bar's role/name.

**Risks**:
- `AppLayout.test.tsx` (existence confirmed via `file_search`) — rewrite the layout assertions.
- Playwright e2e (auth flows): every login → dashboard flow passes through `AppLayout`. Run the e2e suite.

## E4. Deprecate `Header.tsx` (do not delete yet)

**Files**: none modified.

**Action**: Add a `@deprecated` JSDoc tag to `Header.tsx` pointing to `TopBar`. Per the `deprecation-and-migration` skill, deletion is a separate tracked step (keep the file until no consumer references it and one release cycle has passed).

## E. Exit criteria for Phase E

- [ ] `AppLayout` imports `TopBar` and `MobileTabBar`, not `Header`.
- [ ] Desktop: sidebar + top bar visible; no bottom bar.
- [ ] Mobile (`<lg`): top bar (title + actions) + bottom tab bar; sidebar hidden.
- [ ] `Header.tsx` carries `@deprecated` JSDoc but is not deleted.
- [ ] `AppLayout.test.tsx` updated and green.
- [ ] Playwright e2e smoke green (login → dashboard → transactions → categories, both desktop and mobile viewport).
- [ ] `npm test` 186 green.

---

# Phase F (optional) — `SegmentedControl`: find or close the open consumer

**Open question**: `SegmentedControl` was committed without a consumer. Grep found **no page** that obviously needs a segmented control. Possibilities:

1. Intended to replace the type-filter `<Select>` on `TransactionsPage`? (The filter collapses to a 2-option segmented income/expense toggle.)
2. Intended for a future dashboard range switcher (1M / 3M / 1Y)?
3. Pure scaffold with no concrete plan yet.

**Action**: **Do not delete** in this plan. Either (a) wire a concrete consumer (sub-plan), or (b) leave unwired and add a TODO + a JSDoc `@internal` tag so reviewers know it's pending. Default: (b) — leave unwired, document in the commit that closed the scaffolding loop.

If a concrete consumer is identified later, a separate plan supersedes this section.

---

# Open questions / decisions to confirm before coding

1. **Phase A token values** — proposed oklch values above. Confirm contrast ratios for `--success`/`--danger` against white and against `bg-soft-*`10% tints. Run a quick WCAG AA check.
2. **Phase A token separation (`--danger` vs `--destructive`)** — confirm keeping them separate (recommended) or merging.
3. **Phase C `PageHeader` font weight** — keep `font-semibold tracking-tight` (recommended) or align to the legacy `font-bold`. Default decision: **keep `PageHeader` as-is** and change page visual slightly.
4. **Phase E mobile nav** — does the hamburger Sheet stay alongside `MobileTabBar`? Default: **yes**; revisit in a follow-up.
5. **Phase E `MobileTabBar.onAdd`** — option 1 (navigate to `/transactions`) vs option 2 (global dialog). Default: **option 1** for E; option 2 is a follow-up plan.
6. **Phase E desktop add affordance** — confirm no global add button on desktop; each page's `PageHeader.actions` carries the add button (post Phase C).
7. **Phase F `SegmentedControl`** — confirm it stays unwired + documented, vs. identifying a concrete consumer now.

---

# Sequencing & rollout

- **Phase A** (additive CSS) → low-risk, lands first. Unlocks B.
- **Phase B** (color migration) → depends on A. Visual-diff review required.
- **Phase C** (PageHeader adoption) → independent of A/B; can land in parallel with B.
- **Phase D** (DeleteConfirmDialog adoption) → independent of A/B/C; can land in parallel.
- **Phase E** (AppLayout rewrite) → depends on C (PageHeader.actions shape) and decision E2. Lands **last**.
- **Phase F** → optional, can land any time.
- Each phase is its own PR. Each is independently revertible.
- **ADR**: no new ADR required — frontend-only UI refactor. If the `--danger` vs `--destructive` decision in Phase A is contentious, write an ADR; follow the `documentation-and-adrs` skill.
- **SPEC.md**: grep first; if `docs/SPEC.md` documents the dashboard's color semantics, update it after Phase B.

---

# Files touched summary

| File | Phase | Change type |
|---|---|---|
| `frontend/src/index.css` | A | Add `--success/danger/info/warning`-foreground + `--chart-1..10` in `:root` and `.dark` |
| `frontend/src/pages/DashboardPage.tsx` | B, C | Use `colors.ts` helpers + `CHART_COLORS`; `<h1>` → `<PageHeader>` |
| `frontend/src/pages/TransactionsPage.tsx` | B, C, D | `textAmountClass` for amount cells; `<h1>` → `<PageHeader>`; inline AlertDialog → `DeleteConfirmDialog` |
| `frontend/src/pages/CategoriesPage.tsx` | C, D | `<h1>` → `<PageHeader>` (dedupe across branches); inline AlertDialog → `DeleteConfirmDialog` |
| `frontend/src/components/layout/AppLayout.tsx` | E | `Header` → `TopBar` + add `MobileTabBar` |
| `frontend/src/components/layout/Header.tsx` | E | Add `@deprecated` JSDoc (no code change) |
| `frontend/tests/unit/components/AppLayout.test.tsx` | E | Update layout assertions to TopBar/MobileTabBar |
| `frontend/tests/e2e/*` | E | Smoke run; possibly a new test for `MobileTabBar` `+` button |
| `docs/SPEC.md` | B (if applicable) | Document semantic color tokens if SPEC mentions dashboard colors |

No backend files. No new dependencies. No API contract changes. No DB schema changes. No deletion of `Header.tsx` (deprecation only).