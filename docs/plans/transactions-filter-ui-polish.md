# Plan: Transactions Filter Bar — UI Polish (Dropdown Background & Date Format)

> Origin: User request on 2026-07-08 — two visual/UX issues on the Transactions page filter bar.
> Scope: `frontend/src/pages/TransactionsPage.tsx` filter bar only. No backend changes. No new API contracts.
> Format: 2 phases, each independently testable. TDD where behavior changes, pure styling items skip test-first.

## TL;DR

Two fixes on the Transactions page filter bar:

1. **Dropdown background**: When a dropdown item is highlighted/selected (ประเภท, หมวดหมู่), the background is too transparent (`--accent: oklch(0.965 0 0)` ≈ near-white gray), making text hard to read. Make it opaque/darker.
2. **Date format**: The native `<Input type="date" />` renders in the browser's OS locale (usually `mm/dd/yyyy`). Display dates as `dd/mm/yyyy` instead, while keeping ISO `yyyy-mm-dd` internally for API compatibility.

| Phase | Goal | Files touched | New deps | Blocking? |
|---|---|---|---|---|
| **A** | Dropdown item highlight becomes opaque & readable | `select.tsx`, `index.css`, `TransactionsPage.test.tsx` (assertion), select tests if any | None | Yes |
| **B** | Date inputs show `dd/mm/yyyy` via custom DateInput (`Popover` + `Calendar`) | `popover.tsx` (new), `date-input.tsx` (new), `TransactionsPage.tsx`, `TransactionsPage.test.tsx`, `format.ts` | None — `date-fns` & `react-day-picker` already installed | No |

---

## Conventions

- **PR size**: target ≤100 LOC changed per concern.
- **TDD**: failing assertion first for any behavior change. Pure visual-only tweaks skip test-first but must not regress existing tests.
- **One concern per commit** — no drive-by formatting or refactors.
- **Branch naming**: `ui/tx-filter-<phase>-<slug>` (e.g. `ui/tx-filter-a-dropdown-bg`, `ui/tx-filter-b-date-format`).
- **Verification per PR** (run before requesting review):
  - `npm test` (vitest run — currently 25 files / 186 tests, all must pass)
  - `npm run lint` + `npm run typecheck` + `npm run build`
- Internal date representation stays ISO `yyyy-mm-dd` for API compatibility. Only the **display** changes to `dd/mm/yyyy`.
- No new runtime dependencies. `date-fns@^4.4.0` and `react-day-picker@^10.0.1` are already in `package.json`.

---

## Current state (as of 2026-07-08)

### Issue 1 — Dropdown item background

- `frontend/src/components/ui/select.tsx` `SelectContent` (line ~84): uses `bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10` → container is **opaque white** (`--popover: oklch(1 0 0)`). OK.
- `SelectItem` (line ~106): uses `focus:bg-accent focus:text-accent-foreground` → the highlighted (focused/hovered) item background is `--accent: oklch(0.965 0 0)` (light mode) / `oklch(0.269 0 0)` (dark mode).
  - Light mode `0.965` is a **near-white gray** — almost indistinguishable from the `bg-popover` white container. **This is the root cause** of "อ่านยาก" (hard to read).
- We must **not** alter the global `--accent` token directly, because other components (e.g. `DropdownMenuItem`) use `focus:bg-accent` and would inherit the change.

### Issue 2 — Date format display

- `frontend/src/pages/TransactionsPage.tsx` (lines ~349–387): two native inputs:
  ```tsx
  <Input id="filter-from" type="date" value={filterFrom}
    onChange={(e) => { setFilterFrom(e.target.value); setPage(1) }} />
  <Input id="filter-to"   type="date" value={filterTo}
    onChange={(e) => { setFilterTo(e.target.value); setPage(1) }} />
  ```
- Native `<input type="date">` format is controlled by the **browser's OS locale**, not by the HTML `lang` attribute. Reliably rendering `dd/mm/yyyy` requires replacing the native control with a custom component.
- `frontend/src/components/ui/calendar.tsx` already wraps `react-day-picker`'s `DayPicker` — available for reuse.
- **No `Popover` UI primitive exists today** (`file_search` for `popover.tsx` returned no results). A new `popover.tsx` wrapping `@base-ui/react/popover` is required.
- `frontend/src/lib/format.ts` has `parseDateParts()` and `formatThaiDate()`; we can add a `formatDateInput(dateStr)` returning `dd/mm/yyyy`.
- `date-fns` `format()` and `parse()` can safely round-trip `dd/mm/yyyy` ↔ ISO if needed, but the Calendar component deals in native `Date` objects so manual string formatting suffices.

### Tests

- `frontend/tests/unit/components/TransactionsPage.test.tsx` (1043 lines) relies on extensive mocks because Base UI portals don't work in happy-dom:
  - `vi.mock("@/components/ui/select", …)` renders Select as a deterministic button + native `<select>` with a `triggerRegistry` Map.
  - The native `<Input type="date">` is **not** currently mocked, so tests currently interact with real date inputs via `getByLabelText` / change events.
  - `vi.mock("@/components/ui/TransactionFormDialog", …)` mocks the dialog form with native `<input type="date">` for `occurredOn` — that dialog is **outside scope** of this plan and must keep working unchanged.
- The dialog form's date input is **not** in scope. Only the filter bar's two date inputs change.

---

# Phase A — Dropdown item background becomes opaque & readable

> **Goal**: Highlighted (focused / hovered / selected) `SelectItem` in the ประเภท and หมวดหมู่ dropdowns reads clearly — the highlight background is visibly darker / more opaque than the container.
> **Exit criteria**: In both light and dark mode, hovering an item produces a clearly distinguishable background that is not near-white in light mode. Existing 186 tests still pass. No visual regression on `DropdownMenuItem`, `Dialog`, `AlertDialog`, `Sheet`, `Calendar` (they don't use `--accent-strong`).

## A1. Introduce a dedicated highlight token

**Files**:
- `frontend/src/index.css` — add `--accent-strong` under `:root` and `.dark`.

**Why**: Reusing `--accent` globally would leak to `DropdownMenuItem`, the Calendar, and others. A dedicated token isolates the change to components that opt in.

**Token values** (chosen for visible contrast against `--popover` white / `--popover` dark):
- Light mode: `--accent-strong: oklch(0.82 0 0)` — a mid-gray clearly darker than `0.965` but still light enough that black text remains readable.
- Dark mode: `--accent-strong: oklch(0.35 0 0)` — lighter than the existing `0.269` so the highlight is **more** visible on the dark popover.
- Add the matching foreground token `--accent-strong-foreground` that points at the current foreground (light: keep `oklch(0.145 0 0)`; dark: keep `oklch(0.985 0 0)`).

**Risks**: None — new token only; no existing consumer breaks.

**Verification**: `npm run build` (Tailwind v4 picks up the new CSS var). No test needed for a token introduction, but Phase A step A3 will assert the resulting class.

## A2. Use the new token in `SelectItem`

**Files**:
- `frontend/src/components/ui/select.tsx` — `SelectItem` className.

**Change**: in `SelectItem`, replace
`focus:bg-accent focus:text-accent-foreground`
with
`focus:bg-accent-strong focus:text-accent-strong-foreground`.

Also add a hover state for pointer devices so mouse users see the same highlight (Base UI fires focus on keyboard navigation; mouse hover doesn't always trigger `focus:` on the item):
add `hover:bg-accent-strong hover:text-accent-strong-foreground`.

Keep all other `SelectItem` classes unchanged.

**TDD**: No behavioral logic changes here — pure styling. No new failing test required, but the assertion added in A3 must still pass.

**Risks**: If any test snapshot pins the exact className string of `SelectItem`, it would break. Grep for `SelectItem` assertions in tests confirms none exist in `TransactionsPage.test.tsx` (Select is mocked there). No `select.test.tsx` exists. Verify by searching `frontend/tests/**` for `focus:bg-accent` / `select-item` after the change.

## A3. Regression guard (optional but recommended)

**Files**:
- `frontend/tests/unit/components/select.test.tsx` (new — or skip if happy-dom cannot render Base UI Select popup; if it can't, fold this assertion into a Playwright e2e instead).

**Test**: render a `<Select>` with multiple `<SelectItem>`s, open it, assert the rendered item has class `focus:bg-accent-strong`. Keep this **only if** Base UI Select works under happy-dom — the project's mock-based approach for happy-dom suggests it may not. If not viable, **add a Playwright e2e** in `frontend/tests/e2e/` that opens the Transactions filter ประเภท dropdown, hovers an item, and screenshots/Asserts the visible background via computed style.

**Fallback if neither works**: rely on manual visual verification + the existing 186-test suite staying green. Document this in the PR description.

## A4. Update existing TransactionsPage tests if they assert on the old class

**Files**: `frontend/tests/unit/components/TransactionsPage.test.tsx` — only if a grep shows a `focus:bg-accent` or `SelectItem` class assertion. Current investigation shows no such assertion, so **expected to be a no-op**.

**Verification command before proceeding**: `grep -rn "focus:bg-accent\|focus:text-accent-foreground" frontend/tests`. If empty, skip this step.

## A. Exit criteria for Phase A

- [ ] `--accent-strong` token added in `index.css` for both light and dark mode.
- [ ] `SelectItem` uses `focus:bg-accent-strong` and `hover:bg-accent-strong`.
- [ ] `npm test` → 186/186 pass.
- [ ] `npm run lint` + `npm run typecheck` + `npm run build` clean.
- [ ] Manual check: light mode dropdown highlight is visibly darker than before; dark mode highlight is visibly lighter than `--popover`.
- [ ] No other component (`DropdownMenuItem`, `Dialog`, `Sheet`, `Calendar`, `AlertDialog`) regresses — verified by smoke test of the dashboard.

---

# Phase B — Date inputs display as `dd/mm/yyyy`

> **Goal**: The จากวันที่ / ถึงวันที่ filter inputs display dates as `dd/mm/yyyy` while still storing and propagating ISO `yyyy-mm-dd` to the API. Users pick a date from a calendar popover or type `dd/mm/yyyy`; invalid input is rejected gracefully.
> **Exit criteria**: Both date inputs show `dd/mm/yyyy` when set; selecting a date keeps the API query params (`from`/`to`) as ISO `yyyy-mm-dd`; all 186 existing tests pass (updated where needed for the new component).

## B1. Add `Popover` UI primitive

**Files**:
- `frontend/src/components/ui/popover.tsx` (new)

**Why**: No `Popover` primitive exists. Building a proper date picker on top of `calendar.tsx` needs one. Base UI ships a Popover under `@base-ui/react/popover` (same package as `@base-ui/react/select`) — no new dependency.

**API surface** (export at minimum):
- `Popover` (root)
- `PopoverTrigger`
- `PopoverContent`
- `PopoverClose` (optional — only if the date picker needs an explicit close button)

Mirror the structure used by `dropdown-menu.tsx` (which also wraps `@base-ui/react`) — Portal/Positioner/Popup pattern, `bg-popover text-popover-foreground shadow-[var(--shadow-popover)] ring-1 ring-foreground/10` styling consistent with `alert-dialog.tsx` / `dialog.tsx`.

**TDD**: No behavior to assert for a pure styling wrapper. Covered by B4's integration tests once the consumer (`DateInput`) lands.

**Risks**: happy-dom + Base UI portal interactions are flaky — this is exactly why `TransactionsPage.test.tsx` mocks Select entirely. Verify with a minimal render test; if happy-dom fails, Phase B's tests will use a `DateInput` mock (see B5).

## B2. Add date format helpers to `format.ts`

**Files**:
- `frontend/src/lib/format.ts` — add two pure functions.

**Functions**:

```ts
// ISO "2026-07-08" → "08/07/2026"; "" / null → ""
export function formatDateInput(date: string | null | undefined): string

// "08/07/2026" → "2026-07-08"; invalid → null (caller keeps prior value)
export function parseDateInput(input: string): string | null
```

Use the existing `parseDateParts()` in the same file — don't re-implement date parsing. Reject inputs that don't match `/^\d{2}\/\d{2}\/\d{4}$/`.

**TDD**: Unit tests **required** — pure functions are the easiest to test first. New file `frontend/tests/unit/lib/format.test.ts` (or extend an existing one if present — grep first):
- `formatDateInput("2026-07-08")` → `"08/07/2026"`
- `formatDateInput("")` → `""`
- `formatDateInput(null)` → `""`
- `parseDateInput("08/07/2026")` → `"2026-07-08"`
- `parseDateInput("31/02/2026")` → `null` (invalid day)
- `parseDateInput("garbage")` → `null`

**Why a manual string parse + format rather than `date-fns format`**: avoids timezone shifts (already a documented concern in `format.ts`) and keeps the representation date-only.

## B3. Create `DateInput` component

**Files**:
- `frontend/src/components/ui/date-input.tsx` (new)

**Why**: Replace the native `<input type="date">` in the filter bar with a custom control that (a) always displays `dd/mm/yyyy` and (b) offers a calendar picker via the existing `Calendar`.

**Component contract**:

```tsx
interface DateInputProps {
  id?: string
  value: string              // ISO "yyyy-mm-dd" or ""
  onChange: (iso: string) => void   // always emits ISO or ""
  placeholder?: string       // default "dd/mm/yyyy"
  className?: string
}
```

**UX** (two interaction modes — both must work):

1. **Text field**: a single `<Input>` showing `formatDateInput(value)`. On `change`:
   - user types `dd/mm/yyyy`
   - `parseDateInput(typed)` → on success call `onChange(iso)`; on failure keep the previous value (don't emit).
   - On blur, if the field is empty, emit `onChange("")`.
2. **Calendar popover**: a `Popover` with `PopoverTrigger` (calendar icon button) and `PopoverContent` containing `<Calendar mode="single" selected={Date} onSelect=… />`. On select:
   - Convert selected `Date` to ISO via `date-fns/format(selected, "yyyy-MM-dd")` (UTC-safe because we then parse back via `parseDateParts`).
   - Call `onChange(iso)`.
   - Close the popover.

**Key behaviors / constraints**:
- **Internal value model is always ISO** (string state is ISO). Display is derived via `formatDateInput`.
- **No timezone drift**: Calendar gives a `Date` at local midnight; convert via `date-fns format(..., "yyyy-MM-dd")`. Existing `parseDateParts` handles the double-trip equivalently.
- **Accessibility**: `PopoverTrigger` is a labelled button with `aria-label`; the text `<Input>` keeps its `id` for `<label htmlFor>`.
- **Styling**: match the layout/height of the existing `<Input>` (h-8). Calendar appears below, left-aligned with the trigger (fit within the `w-40` column).

**TDD**: Integration-level tests go in B4. At the component-unit level, add `frontend/tests/unit/components/DateInput.test.tsx` covering:
- renders given ISO value as `dd/mm/yyyy`
- typing valid `dd/mm/yyyy` calls `onChange` with ISO
- typing invalid input does **not** call `onChange`
- clearing the input calls `onChange("")`
- opening the popover and picking today calls `onChange` with today's ISO

Use `@testing-library/user-event` and `happy-dom`. Mock the `Popover` portaling if needed (Base UI portal test pattern). If Base UI Popover doesn't render in happy-dom, **stub the Popover mock** to render children inline and assert via that — follow the established pattern in `TransactionsPage.test.tsx` Select mock.

## B4. Replace native date inputs in `TransactionsPage.tsx`

**Files**:
- `frontend/src/pages/TransactionsPage.tsx` — replace the two `<Input type="date">` blocks (lines ~349–387) with `<DateInput>`.

**Changes**:
- Import: `import { DateInput } from "@/components/ui/date-input"`
- Replace the จากวันที่ block:
  ```tsx
  <DateInput id="filter-from" value={filterFrom}
    onChange={(v) => { setFilterFrom(v); setPage(1) }} />
  ```
- Replace the ถึงวันที่ block analogously with `filterTo`/`setFilterTo`.
- Keep the surrounding `<div className="w-40">`, `<label htmlFor="filter-from">`, and reset-button logic untouched.
- The `hasActiveFilters` check (`filterFrom !== ""` …) stays unchanged because `filterFrom`/`filterTo` state remains ISO string.

**TDD**: Any existing test that interacts with the date filter inputs must be updated. See B5.

## B5. Update `TransactionsPage.test.tsx`

**Files**:
- `frontend/tests/unit/components/TransactionsPage.test.tsx`

**Approach**:
- The current "resets filters when reset button is clicked" test may set date filters via the existing `<Input type="date">`. After B4 it must drive the new `DateInput`.
- Two options, in order of preference:
  1. **Real component in the test** (preferred): let `DateInput` render for real, find its text `<input>` via `getByLabelText("จากวันที่")`, type `dd/mm/yyyy`, assert the resulting API call carries ISO. This is higher-fidelity.
  2. **Mock `DateInput`** (fallback): if the real component fails in happy-dom (likely, same reason Select is mocked), add `vi.mock("@/components/ui/date-input", …)` that renders a native `<input>` taking ISO directly — then the tests date flow stays ISO and only the display component is mocked. Document why in the mock comment.
- Add a new test (only if going with option 1): assert that the date filter text field displays the ISO value as `dd/mm/yyyy` when set programmatically (e.g. after clicking reset, the field reads `dd/mm/yyyy`).
- Do **not** touch the `TransactionFormDialog` mock: it has its own `<input type="date">` for `occurredOn` and is **out of scope** for this plan.

**Risks**: The 1043-line test file is intricate; the Select mock in particular uses `triggerRegistry`. Don't refactor the Select mock — only add the date component mock if needed. Run `npm test` after each edit.

## B6. (Optional) Playwright e2e for the new date picker

**Files**:
- `frontend/tests/e2e/transactions-filter.spec.ts` (new, or extend an existing file if one exists — grep first)

**Why**: happy-dom mocks can't prove the calendar popover actually renders in a browser. One Playwright test that opens the date popover, selects a date, and verifies the filtered table updates gives end-to-end confidence.

**Test**:
- Navigate to `/transactions`
- Click the จากวันที่ calendar icon
- Select today
- Assert the URL state (or the filtered API call) carries today's ISO
- Assert the visible text field shows `dd/mm/yyyy`

Skip if the project's Playwright smoke tests already cover this page adequately — check `frontend/tests/` before writing.

## B. Exit criteria for Phase B

- [ ] `popover.tsx` exists with `Popover`, `PopoverTrigger`, `PopoverContent`.
- [ ] `formatDateInput` and `parseDateInput` in `format.ts` with unit tests passing.
- [ ] `DateInput` component exists; its unit tests pass in happy-dom.
- [ ] `TransactionsPage.tsx` uses `DateInput` for จากวันที่ / ถึงวันที่; internal state is still ISO.
- [ ] `TransactionFormDialog` date input untouched and still passing.
- [ ] `npm test` full suite green (186 base + new tests).
- [ ] `npm run lint` + `npm run typecheck` + `npm run build` clean.
- [ ] Manual check: popover opens with calendar; selecting a date fills the field as `dd/mm/yyyy`; typing `dd/mm/yyyy` works; API receives ISO `yyyy-mm-dd`.

---

# Open questions / decisions to confirm before coding

1. **Token value for `--accent-strong` light mode** — proposed `oklch(0.82 0 0)`. Confirm contrast vs black text is acceptable. Alternative: a light brand tint if the project adds a primary color later.
2. **Hover behavior on dropdown items** — do we want `hover:bg-accent-strong` to mirror focus, or keep focus-only (keyboard)? Base UI often already handles pointerenter → focus. Recommendation: add explicit `hover:` for parity. Confirm.
3. **DateInput UX — calendar only or text + calendar?** Plan assumes **both** (text input accepts `dd/mm/yyyy`, calendar icon opens a popover). Confirmed assumption; if only calendar is desired, simplify B3 to render a button + popover (no free-text typing).
4. **DateInput calendar icon** — use `lucide-react` `CalendarIcon` (already in the dep). Confirm placement (suffix inside the input, or separate button next to it). Plan assumes suffix button inside the `w-40` column.
5. **Out-of-scope**: The date filter label currently uses a `<label>` HTML element, not the `<Label>` component. Do we migrate it? **No** — keep scope tight; labels are unchanged.
6. **Out-of-scope**: `TransactionFormDialog`'s date input. **No change.** Only the filter bar date inputs are in this plan.

---

# Sequencing & rollout

- Ship **Phase A first** (1 working session, low risk, no new components).
- Ship **Phase B after A is merged** (1–2 working sessions, introduces `Popover` + `DateInput`).
- Each phase is a single PR. Each is independently revertible.
- No ADR required — UI-only change with no architectural impact. Update `docs/SPEC.md` only if it documents the date format explicitly (grep first).

---

# Files touched summary

| File | Phase | Change type |
|---|---|---|
| `frontend/src/index.css` | A | Add `--accent-strong` (+ foreground) in `:root` and `.dark` |
| `frontend/src/components/ui/select.tsx` | A | `SelectItem` className: `focus:bg-accent-strong` + `hover:bg-accent-strong` |
| `frontend/tests/unit/components/select.test.tsx` _(or Playwright fallback)_ | A | New assertion that highlighted item uses the new token |
| `frontend/src/components/ui/popover.tsx` | B | New — wraps `@base-ui/react/popover` |
| `frontend/src/lib/format.ts` | B | Add `formatDateInput`, `parseDateInput` |
| `frontend/tests/unit/lib/format.test.ts` | B | New unit tests for the format helpers |
| `frontend/src/components/ui/date-input.tsx` | B | New `DateInput` component |
| `frontend/tests/unit/components/DateInput.test.tsx` | B | New component tests |
| `frontend/src/pages/TransactionsPage.tsx` | B | Replace 2× `<Input type="date">` with `<DateInput>` |
| `frontend/tests/unit/components/TransactionsPage.test.tsx` | B | Update date-filter interactions (mock or real `DateInput`) |
| `frontend/tests/e2e/transactions-filter.spec.ts` _(optional)_ | B | New Playwright test for calendar popover |

No backend files. No new dependencies. No API contract changes. No DB schema changes.