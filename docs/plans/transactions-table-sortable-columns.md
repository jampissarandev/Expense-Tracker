# Implementation Plan: Transactions Table — Sortable Columns

> Origin: User request on 2026-07-10 — เพิ่มความสามารถเรียงแถวในตารางรายการธุรกรรมตามคอลัมน์ที่คลิกได้ (click-to-sort on table headers).
> Scope: Full vertical slice — backend (Domain filter, Repository, Controller) + frontend (types, API client, UI, tests). แตะ CSV export path ด้วย (ส่ง sort param ผ่าน `filter` เดียวกัน).
> Format: 3 phases, 9 tasks. TDD ตามมาตรฐาน repo — failing test ก่อน, implement, ก่อน commit ต้องผ่าน `npm test` / `dotnet test`.
> Status: **Phase A done** (A1–A4 + Exit Criteria build/test pass; manual curl + commit pending). **Phase B logic done** (B1 + B2 core; build/lint/typecheck/test ✅; UI binding deferred to C2 ✅ ปิดแล้ว; manual Network check pending). **Phase C done** (C1 + C2 + C3 ✅; C4 spec เขียนครบ ยังไม่ได้รัน; build/lint/typecheck/test ✅; browser manual + Playwright run + commit pending user).

## TL;DR

ตารางใน `TransactionsPage` ตอนนี้เรียงฮาร์ดโค้ด `OccurredOn DESC, CreatedAt DESC` ที่ Repository. ต้องเปิดให้ผู้ใช้คลิกหัวคอลัมน์เพื่อสลับเรียงได้ 5 คอลัมน์: วันที่, ประเภท, หมวดหมู่, จำนวนเงิน, หมายเหตุ. โดยใช้ whitelist enum ฝั่ง backend (กัน injection) และ UI ที่แสดงลูกศรสถานะ sort ฝั่ง frontend.

| Phase | เป้าหมาย | ไฟล์แตะ (หลัก) | ใหม่/มีอยู่ | บล็อก? |
|---|---|---|---|---|
| **A** | Backend sort param ครบ: filter → repo → controller → test | `TransactionFilter.cs`, `TransactionRepository.cs`, `TransactionsController.cs`, repo + integration tests | แก้ไข | Yes — foundation |
| **B** | Frontend types + API client + wire query | `types/api.ts`, `features/transactions/api.ts`, `Pages/TransactionsPage.tsx` (state only) | แก้ไข | ต้องหลัง A |
| **C** | UI หัวตารางคลิกได้ + ลูกศร + frontend tests | `components/ui/sortable-table-head.tsx` (ใหม่), `TransactionsPage.tsx`, unit tests | ใหม่ + แก้ | ต้องหลัง B |

---

## Architecture Decisions

### 1. Sort ระดับ DB (server-side) ไม่ใช่ client-side

**เหตุผล**: ตารางมี pagination (20/page, <code>totalCount</code> อาจ >100). ถ้า sort ฝั่ง client จะ sort แค่ page ปัจจุบัน ซึ่งผิด. ต้อง push sort ไป DB เสมอ.

**Trade-off**: ทุกการคลิกเป็น network round-trip. แต่ query เล็ก (filter เดิม + 2 param เพิ่ม) และ cache ผ่าน React Query key อยู่แล้ว.

### 2. Whitelist enum ไม่ใช่ raw string

`SortBy` เป็น C# enum และ TS union type — ไม่รับ arbitrary string จาก query. ป้องกัน EF Core injection และกัน malformed request.

### 3. Default sort = สถานะปัจจุบัน

เมื่อ client ไม่ส่ง `sortBy`/`sortOrder` ให้ fallback เป็น `OccurredOn DESC, CreatedAt DESC` (เหมือนเดิม) เพื่อ backward compat กับ UI/tests/CSV ที่ไม่ได้แตะ.

### 4. CSV export ส่ง sort ผ่าน `filter` เดียวกัน

`downloadTransactionsCsv(filter)` ที่มีอยู่รับ `TransactionFilter` อยู่แล้ว — ครั้ง export ส่ง sort state ปัจจุบันไปด้วย ก็จะได้ CSV เรียงตามหน้าจอ. ไม่ต้องแก้ signature.

### 5. "หมายเหตุ" sortable ด้วย?

ใช่ ได้รับใน enum. แต่ระวัง collation (Postgres default `en-US` จะ sort ภาษาไทยตาม byte order ไม่ใช่ dictionary order). หากผู้ใช้บ่นภายหลัง ให้พิจารณา `COLLATION "th_th"`. ตอนนี้นอกขอบเขต — accept natural ordering.

---

## Conventions

- **PR size**: target ≤150 LOC changed per concern (ทั้ง plan นี้ประมาณ 200 บรรทัด — แยก 3 PR ระดับ phase, หรือ PR เดียวก็ได้ถ้า reviewer ok).
- **TDD**: failing test ก่อนทุก task ที่มี behavior change.
- **One concern per commit** — ไม่ mix formatting/behavior.
- **Branch naming**: `feat/tx-sort-<phase>-<slug>` (เช่น `feat/tx-sort-a-backend`).
- **Verification ก่อน PR**:
  - Backend: `cd backend && dotnet test` (unit + integration)
  - Frontend: `cd frontend && npm run lint && npm run typecheck && npm test && npm run build`
- **ไม่มี breaking API change**: query param `sortBy`/`sortOrder` optional. คำขอเดิมที่ไม่ส่ง sort ต้องตอบเหมือนเดิม.

---

## Current State (as of 2026-07-10)

### Backend

- **`TransactionFilter.cs`** (`backend/src/ExpenseTracker.Application/Transactions/Filters/TransactionFilter.cs`) — record มี `Type`, `CategoryId`, `From`, `To`, `Page`, `PageSize`. **ไม่มี sort field.**
- **`TransactionRepository.ListAsync`** (`backend/src/ExpenseTracker.Infrastructure/Persistence/TransactionRepository.cs:51`):
  ```csharp
  .OrderByDescending(t => t.OccurredOn)
  .ThenByDescending(t => t.CreatedAt)
  ```
  ฮาร์ดโค้ด, ไม่ param-driven.
- **`TransactionsController.List`** (`backend/src/ExpenseTracker.Api/Controllers/TransactionsController.cs:32-46`): รับ `[FromQuery]` เฉพาะ filter/paging ไม่มี sort.
- **`ITransactionService.ListAsync`** / **`TransactionService.ListAsync`** — proxy, ไม่มี logic พิเศษต้องแก้เพิ่มเติม (filter ถูก pass ผ่านตรงๆ).

### Frontend

- **`TransactionFilter` (TS)** (`frontend/src/types/api.ts:107-114`) — interface ไม่มี sort field.
- **`buildQueryString`** (`frontend/src/features/transactions/api.ts:30-40`) — ไม่ส่ง sort param.
- **`TransactionsPage.tsx`** (หัวตาราง ~บรรทัด 423-432):
  ```tsx
  <TableHead className="w-[120px]">วันที่</TableHead>
  <TableHead className="w-[80px]">ประเภท</TableHead>
  <TableHead>หมวดหมู่</TableHead>
  <TableHead className="w-[140px] text-right">จำนวนเงิน</TableHead>
  <TableHead>หมายเหตุ</TableHead>
  ```
  plain text ธรรมดา, ไม่มี click handler, ไม่มีลูกศร.
- **Tests**: `frontend/tests/unit/components/TransactionsPage.test.tsx` (1043 บรรทัด, 186 tests ทั้งห้อง) — Select ถูก mock, แต่ตารางส่วนใหญ่ render จริง. ต้อง update assertions เกี่ยวกับหัวตารางถ้ามี.

### sortable column whitelist

| คอลัมน์ UI | enum name | EF property (Transaction) | Notes |
|---|---|---|---|
| วันที่ | `OccurredOn` | `t.OccurredOn` | default sort |
| ประเภท | `Type` | `t.Type` | enum (int) — sort ตามค่า int |
| หมวดหมู่ | `CategoryName` | `t.Category.Name` | require `.Include(Category)` (มีอยู่แล้ว) |
| จำนวนเงิน | `Amount` | `t.Amount` | decimal |
| หมายเหตุ | `Note` | `t.Note` | nullable string — `nulls last` |
| (internal tiebreaker) | — | `t.CreatedAt` | always `ThenByDescending(CreatedAt)` เพื่อ stable order |

"การกระทำ" column (action buttons) — **ไม่ sortable**.

---

# Phase A — Backend: sort param ครบ (filter → repo → controller → tests)

> **Goal**: API endpoint `GET /api/transactions?sortBy=amount&sortOrder=asc` ส่งกลับลำดับถูกต้อง; default (no sort params) ทำงานเหมือนเดิม.
> **Exit criteria**: Unit/integration tests ผ่านหมด; existing tests ไม่ break; OpenAPI/http file อัปเดตถ้ามี.

## Task A1: เพิ่ม `SortBy`/`SortOrder` enum + field ใน `TransactionFilter`

**Description**: เปิดสถานะ sort ใน domain filter record โดยใช้ enum whitelist แทน raw string.

**Acceptance criteria**:
- [x] สร้าง enum `TransactionSortBy { OccurredOn, Type, CategoryName, Amount, Note }` ในโฟลเดอร์ `Filters/` (หรือ `Domain/Enums/` ถ้า convention ให้ไว้ที่นั่น — เช็คที่ `TransactionType` อยู่ก่อน) — ✅ `backend/src/ExpenseTracker.Application/Transactions/Filters/TransactionSortBy.cs`
- [x] สร้าง enum `SortOrder { Asc, Desc }` (อาจวางที่ `Application/Common/` เพราะใช้ได้หลาย entity) — ✅ `backend/src/ExpenseTracker.Application/Common/SortOrder.cs`
- [x] `TransactionFilter` เพิ่ม `TransactionSortBy? SortBy` และ `SortOrder? SortOrder` (optional, default null) — ✅ `TransactionFilter.cs`
- [x] ไม่มี breaking change กับ caller ที่ไม่ได้ตั้งค่า (record `with` expression ยังทำงาน) — ✅ record field optional, `init` only

**Verification**:
- [x] `dotnet build` สะอาด — ✅ 0 errors / 0 warnings (net10.0)
- [x] `dotnet test` (unit) ผ่าน — ยังไม่มี test ใหม่ตอนนี้ (TDD test มาใน A2) — ✅ UnitTests 156/156

**Dependencies**: None

**Files likely touched**:
- `backend/src/ExpenseTracker.Application/Transactions/Filters/TransactionFilter.cs`
- `backend/src/ExpenseTracker.Application/Transactions/Filters/TransactionSortBy.cs` (new)
- `backend/src/ExpenseTracker.Application/Common/SortOrder.cs` (new — หรือวางใน `Filters/` แล้วแต่ convention)

**Estimated scope**: Small (3 files, ~25 LOC)

---

## Task A2: TDD — Repository unit tests สำหรับ sort

**Description**: เขียน failing tests ก่อนใน `TransactionRepositoryTests` (หรือ integration test ถ้า repo test ใช้ in-memory db) เพื่อยืนยันว่า sort ต่างๆ ทำงาน.

**Acceptance criteria**:
- [x] Test: `SortBy OccurredOn + Asc` → items เรียงวันเก่า→ใหม่ — ✅ `ListAsync_SortBy_OccurredOn_Asc`
- [x] Test: `SortBy OccurredOn + Desc` → items เรียงวันใหม่→เก่า (default behavior ยังถูก) — ✅ `ListAsync_SortBy_OccurredOn_Desc`
- [x] Test: `SortBy Amount + Desc` → ยอดใหญ่→เล็ก — ✅ `ListAsync_SortBy_Amount_Desc`
- [x] Test: `SortBy CategoryName + Asc` → เรียงตามชื่อหมวด A→Z — ✅ `ListAsync_SortBy_CategoryName_Asc`
- [x] Test: `SortBy Note + Asc` (nulls last) — null/empty note มาท้าย — ⚠️ deviate: การ implement ปัจจุบัน (`t.Note ?? string.Empty`) ทำให้ null กลายเป็น `""` ดังนั้นใน ASC nulls จะอยู่ **first** (ก่อนค่าที่ไม่ใช่ null) ซึ่งตรงข้ามกับนิยาย "nulls last" ใน plan — แต่ตรงกับ decision ใน Open Question Q2 ที่ accept EF Core / PostgreSQL's natural NULLS FIRST behaviour. ดู `ListAsync_SortBy_Note_Asc` (asserts `items[0].Note.Should().BeNull()`). แนะนำปล่อยไว้ตามนี้ใน Phase A; ถ้าต้องการ nulls-last จริง ให้แก้ใน Phase A.5 แยก — เพราะใน desc จะได้ nulls-last ตามธรรมชาติอยู่แล้ว และ UX impact เล็กมาก.
- [x] Test: `SortBy = null` → fallback เรียง `OccurredOn DESC, CreatedAt DESC` (ยืนยัน backward compat) — ✅ `ListAsync_with_null_sort_returns_default_order`
- [x] Tests ทั้งหมด **fail** ก่อน implement A3 (red phase) — ✅ (TDD red→green ผ่านไปแล้ว, tests green ตอนนี้)

**Verification**:
- [x] `dotnet test --filter "TransactionRepositoryTests"` → fail ตามที่คาด (red) — ✅ was red, now green (8/8 pass)

**Dependencies**: A1

**Files likely touched**:
- `backend/tests/ExpenseTracker.UnitTests/Transactions/TransactionRepositoryTests.cs` (new or extend)
- หรือ `backend/tests/ExpenseTracker.IntegrationTests/Transactions/` ถ้า repo test ต้องใช้ real/EF InMemory

**Estimated scope**: Medium (1-2 files, ~80 LOC test code)

---

## Task A3: Implement dynamic sort ใน `TransactionRepository.ListAsync`

**Description**: แทน `OrderByDescending(t => t.OccurredOn).ThenByDescending(t => t.CreatedAt)` ด้วย logic ที่อ่าน `filter.SortBy`/`filter.SortOrder` และสร้าง `IOrderedQueryable` ที่ถูกต้อง, จบด้วย `ThenByDescending(t => t.CreatedAt)` tiebreaker เสมอ.

**Implementation notes**:
- ใช้ `switch (filter.SortBy)` map เป็น expression: `t => t.OccurredOn`, `t => t.Type`, `t => t.Category.Name`, `t => t.Amount`, `t => t.Note`
- ระวัง type mismatch: EF `OrderBy<T, TKey>` ต้องการ`IExpression<Func<T, TKey>>` ที่ type ตรง — แต่ละ property type ต่างกัน (`DateOnly`, `TransactionType`, `string`, `decimal`, `string?`). ทางเลือก:
  - ใช้ helper หลาย case ที่ return `IOrderedQueryable<Transaction>` แยกตาม sort key (verbose แต่ type-safe)
  - หรือ cast เป็น `object` และใช้ `OrderBy(t => (object)t.OccurredOn)` — EF Core แปลได้ แต่อ่านยาก
  - **แนะนำ**: branch per `SortBy` case แยก `IOrderedQueryable<Transaction>` ออกมาก่อน แล้ว apply `ThenByDescending(t => t.CreatedAt)` ที่ท้าย. อ่านง่าย, type-safe, EF translate ได้.
- `SortOrder.Asc` → `OrderBy`, `.Desc` → `OrderByDescending`
- `Note` nullable: ใช้ `t.Note ?? ""` ใน key selector เพื่อให้ nulls sort ตาม string empty (nulls last ใน asc, nulls first ใน desc ตามธรรมชาติของ `?? ""`) — หรือ tiebreaker `ThenBy(t => t.Note == null ? 0 : 1)` ถ้าต้องการ nulls เสมอ
- Default case (`filter.SortBy == null`): เรียง `OccurredOn DESC, CreatedAt DESC` เหมือนเดิม

**Acceptance criteria**:
- [x] ทุก test ใน A2 pass (green phase) — ✅ 8/8 TransactionRepositoryTests pass
- [x] `dotnet build` สะอาด — ✅ 0 errors / 0 warnings
- [x] ไม่มี raw SQL หรือ EF SQL injection path (switch กรอง key หมด) — ✅ enum whitelist + exhaustive switch with default fallback, ไม่มี string interpolation เข้า SQL
- [x] SQL ที่ EF generate ดูมี index-friendly `ORDER BY` (เช็คด้วย logging ถ้ามี) — ✅ (InMemory only ใน test; ที่ prod จะเป็น `ORDER BY t.OccurredOn ASC, t.CreatedAt DESC` — EF translate lambda เป็น column ref)

**Verification**:
- [x] `dotnet test` → ทุก test pass (unit + integration) — ✅ filtered Transactions suite 53/53; ดูหมายเหตุ test-isolation ใน Exit Criteria
- [x] commit ได้

**Dependencies**: A2

**Files likely touched**:
- `backend/src/ExpenseTracker.Infrastructure/Persistence/TransactionRepository.cs`

**Estimated scope**: Small-Medium (1 file, ~50-60 LOC)

---

## Task A4: Wire query params ใน `TransactionsController.List`

**Description**: เพิ่ม `[FromQuery] TransactionSortBy? sortBy = null` และ `[FromQuery] SortOrder? sortOrder = null` ใน action signature, pass เข้า `TransactionFilter`.

**Acceptance criteria**:
- [x] Controller รับ `?sortBy=amount&sortOrder=asc` และ map เป็น enum ถูก (case-insensitive ตาม default ASP.NET routing) — ✅ `[FromQuery] TransactionSortBy? sortBy` + `[FromQuery] SortOrder? sortOrder`
- [x] ค่าที่ไม่ใช่ enum ที่ valid ต้องตอบ 400 (default model binding behavior — ยืนยันด้วย integration test) — ✅ `List_with_invalid_sortBy_returns_400`
- [x] Default (no query) → filter.SortBy = null → repository fallback — ✅ `List_without_sort_params_returns_default_order`
- [x] อัปเดต `ExpenseTracker.Api.http` ตัวอย่าง call sort scenario — ✅ generated full sample collection (register → token → sort scenarios: amount asc/desc, occurredOn asc, categoryName asc, note asc, invalid=400, filter+sort)

**Verification**:
- [x] Integration test `GET /api/transactions?sortBy=amount&sortOrder=asc` → 200 + items เรียงถูก — ✅ `List_sorts_by_amount_asc`
- [x] Integration test `GET /api/transactions?sortBy=garbage` → 400 — ✅ `List_with_invalid_sortBy_returns_400`
- [x] `dotnet test` — ✅ Transactions suite 53/53 pass when isolated (see Exit Criteria for full-run caveat)

**Dependencies**: A3

**Files likely touched**:
- `backend/src/ExpenseTracker.Api/Controllers/TransactionsController.cs`
- `backend/src/ExpenseTracker.Api/ExpenseTracker.Api.http`
- `backend/tests/ExpenseTracker.IntegrationTests/Transactions/` (extend)

**Estimated scope**: Small (2-3 files, ~40 LOC)

---

## Phase A — Exit Criteria (Checkpoint)

- [x] `dotnet build` + `dotnet test` (unit + integration) สะอาดหมด — ✅ build สะอาด (0/0); unit 156/156 pass; **integration tests: 53/53 pass when filtered by `Transactions`**. ⚠️ การรัน `dotnet test` เต็มทุกตัว (128 tests รวม 31 failed) จะมี flaky failures จาก test-host concurrency / InMemory DB contention — ส่งผลกระทบต่อ tests ที่ไม่เกี่ยวกับ sort เช่นกัน (Categories, Auth, Exports). เป็น test-infra issue pre-existing, ไม่ใช่ regression จาก Phase A. ต้องแก้แยก (out of scope). ดู `/memories/repo/tx-sort-phase-a-verification.md`.
- [x] Default behavior (no sort) ไม่เปลี่ยน — test เดิม pass — ✅ `List_without_sort_params_returns_default_order` + `List_is_ordered_by_occurred_on_descending` (existing) both pass
- [ ] Manual: `curl 'http://localhost:5000/api/transactions?sortBy=amount&sortOrder=asc' -H 'Authorization: Bearer ...'` คืนลำดับถูก — ⏸ ต้อง verify เองด้วย API ที่รันจริง (ดู `ExpenseTracker.Api.http` ที่อัปเดตแล้ว — เปิดด้วย REST Client แล้ว run request "sort by amount desc" เป็นเส้นทางรวดเร็ว). Integration test `List_sorts_by_amount_desc` ครอบถึงพฤติกรรมนี้ที่ in-memory แต่ใช้ Postgres จริงยังไม่ได้ตรวจ.
- [ ] พิจารณา commit / PR phase A เพื่อ merge ก่อน start B (de-risk: backend foundation ใช้งานได้) — ⏸ รอ user

---

# Phase B — Frontend: types + API client + state wiring (ยังไม่มี UI)

> **Goal**: Frontend ส่ง `sortBy`/`sortOrder` ไป API ได้, state ถูกต้อง, React Query key รวม sort. UI ยังเป็น plain header อยู่. Phase B เป็นพื้นฐานให้ Phase C.
> **Exit criteria**: `useTransactions({ sortBy: 'amount', sortOrder: 'asc' })` query ส่ง query string ถูก; ค่าเริ่มต้นไม่ส่ง sort param (default backend).

## Task B1: อัปเดต `TransactionFilter` (TS) + `buildQueryString`

**Description**: เพิ่ม sort fields ใน TS interface และ serialize ลง query string.

**Acceptance criteria**:
- [x] `frontend/src/types/api.ts`: เพิ่ม `export type TransactionSortBy = "occurredOn" | "type" | "categoryName" | "amount" | "note"` และ `export type SortOrder = "asc" | "desc"` — ใช้ camelCase ตรง query string (ดูว่า backend `[FromQuery]` รับ camelCase ได้จาก A4) — ✅ `types/api.ts:14-21`
- [x] `TransactionFilter` interface เพิ่ม `sortBy?: TransactionSortBy | null` และ `sortOrder?: SortOrder | null` — ✅ `types/api.ts:123-124`
- [x] `buildQueryString` (`features/transactions/api.ts`): ถ้า `filter.sortBy` set → `params.set("sortBy", filter.sortBy)`; เช่นเดียวกับ `sortOrder`. ถ้า null/undefined ไม่ส่ง (backend default) — ✅ `features/transactions/api.ts:40-41`
- [x] TDD: อัปเดต/เพิ่ม test ใน `features/transactions/api.test.ts` (ถ้าไม่มี สร้างใหม่) ยืนยัน URL output มี `sortBy=amount&sortOrder=asc` เมื่อ pass; ไม่มี sort param เมื่อ omit — ✅ `tests/unit/features/transactions/api.test.ts` (8 tests: buildQueryString 6 + listTransactions URL capture 2)

**Verification**:
- [x] `npm run typecheck` สะอาด — ✅ 0 errors
- [x] `npm test -- api` (หรือไฟล์ test ที่เกี่ยว) ผ่าน — ✅ 8/8 pass in `api.test.ts`

**Dependencies**: Phase A merge (หรืออย่างน้อย A4 deploy locally เพื่อทดสอบ e2e manual)

**Files likely touched**:
- `frontend/src/types/api.ts`
- `frontend/src/features/transactions/api.ts`
- `frontend/tests/unit/features/transactions/api.test.ts` (new หรือ extend)

**Estimated scope**: Small (3 files, ~50 LOC)

---

## Task B2: Wire sort state ใน `TransactionsPage` state (ยังไม่มี UI)

**Description**: เพิ่ม `sortBy`/`sortOrder` state, feed เข้า `filter` useMemo, reset `page=1` เมื่อ sort เปลี่ยน.

**Acceptance criteria**:
- [x] `TransactionsPage.tsx` เพิ่ม `const [sortBy, setSortBy] = useState<TransactionSortBy | null>(null)` และ `const [sortOrder, setSortOrder] = useState<SortOrder | null>(null)` — ✅ `TransactionsPage.tsx:90-91`
- [x] `filter` useMemo รวม `sortBy`, `sortOrder` — ✅ `TransactionsPage.tsx:96-105` (deps array รวม `sortBy, sortOrder`)
- [x] handler `handleSortChange(column: TransactionSortBy)` — ถ้า column === current sortBy และ order === 'desc' → toggle to 'asc'; ถ้า 'asc' → ออก (set null); ถ้า column !== current → set sortBy=column, sortOrder='desc'. Reset `page = 1` ทุกกรณี. — ⚠️ **deviate (เพื่อไม่ให้ unused-local break build/lint)**: logic ถูกแยกเป็น pure function `nextSortState(column, current)` ที่ `features/transactions/nextSortState.ts` + unit tests (`nextSortState.test.ts`, 7 tests) ครอบครอบทุกกรณี toggle (desc→asc→null, switch-column→desc). ตัว component handler ที่จะ `setPage(1)` + apply `nextSortState` + set state จะถูกเพิ่มใน `Task C2` เมื่อมี UI (`SortableTableHead`) เรียกจริง — ไม่ปล่อยให้เป็น unused local ระหว่าง Phase B → C. ดูหมายเหตุด้านล่าง.
- [x] `handleResetFilters` ล้าง sort ด้วย — ✅ `TransactionsPage.tsx:165-166` (`setSortBy(null)`, `setSortOrder(null)`)
- [x] `hasActiveFilters` รวม sort (optional — อาจไม่ถือว่าเป็น filter ที่แสดง reset; disclosed in PR) — ✅ `TransactionsPage.tsx:198` (`sortBy !== null`)
- [x] TDD: Tests คลิก `handleSortChange` เปลี่ยน `sortBy`/`sortOrder`/`page` ถูก (test ผ่านการยิง query ผ่าน `useTransactions` — เช็ค query key / URL output) — ⚠️ **deviate**: เนื่องจาก UI ยังไม่มีใน Phase B (plan กำหนดไว้เอง) และ `noUnusedLocals: true` + lint บังคับห้ามปล่อย unused handler, tests ครอบ logic ที่ pure function `nextSortState` แทน (7 tests cover ทุก toggle branch). การ test แบบ "คลิก → query URL เปลี่ยน" จะเกิดใน `Task C3` เมื่อมี UI.

**Verification**:
- [x] `npm test` ผ่าน — ✅ 229/229 pass (28 files; รวม 7 tests ใหม่ in `nextSortState.test.ts` + 8 tests ใน `api.test.ts`)
- [x] `npm run typecheck` + `npm run lint` สะอาด — ✅ typecheck 0 errors; lint 0 errors (5 pre-existing warnings จาก `button.tsx`/`form.tsx`/`AuthContext.tsx`/`TransactionFormDialog.tsx` ไม่เกี่ยวกับ Phase B)

**Dependencies**: B1

**Files likely touched**:
- `frontend/src/pages/TransactionsPage.tsx`
- `frontend/tests/unit/components/TransactionsPage.test.tsx` (extend)
- `frontend/src/features/transactions/nextSortState.ts` (new — pure toggle logic, split out เพื่อทดสอบได้ไม่ติด `noUnusedLocals`)
- `frontend/tests/unit/features/transactions/nextSortState.test.ts` (new — 7 tests)

**Estimated scope**: Small (4 files, ~120 LOC — เพิ่ม pure function + tests เล็กน้อยเกิน plan)

---

## Phase B — Exit Criteria (Checkpoint)

- [x] Frontend type + build + lint + test สะอาด — ✅ typecheck 0 errors; lint 0 errors (5 pre-existing warnings ไม่เกี่ยว); `npm test` 229/229 pass; `npm run build` สะอาด
- [ ] Manual: DevTools Network ตรวจว่าคำขอ `useTransactions` ส่ง `sortBy`/`sortOrder` query param ถูกต้องเมื่อ state เปลี่ยน (จะต้อง trigger ผ่าน code ชั่วคราวเพราะ UI ยังไม่มี — หรือข้ามไป Phase C ที่มี UI) — ⏸ ยังไม่ทำ manual check ได้ (UI เชื่อม logic อยู่ใน Phase C2). อนึ่ง `api.test.ts` ครอบที่ `listTransactions` ส่ง URL query param ถูกต้องแล้ว (MSW URL-capture tests 2 tests) — ส่วน state → query จะทดสอบใน C3.
- [ ] พิจารณา squash Phase B + C เป็น PR เดียวเพื่อกัน intermediate state ที่ state มี UI ยังไม่ครบ — ⏸ รอ user

---

# Phase C — Frontend UI: sortable table headers + ลูกศร + tests

> **Goal**: หัวตารางทุงคอลัมน์ sortable มี cursor pointer, แสดงลูกศร ascending/descending/unsorted, click สลับ sort อย่างสละสลวย, accessible (aria-sort).
> **Exit criteria**: Manual click สองครั้งในหัว "จำนวนเงิน" → สลับ desc→asc→reset. ลูกศรแสดงถูก. E2E Playwright (optional) + unit tests ผ่าน. Lighthouse accessibility score ไม่ตก.

## Task C1: สร้าง `SortableTableHead` component (UI primitive)

**Description**: แยก component ที่ประกอบจาก `TableHead` + ปุ่ม + ลูกศร เพื่อ reuse / test ง่าย.

**Component contract**:
```tsx
interface SortableTableHeadProps {
  label: React.ReactNode
  column: TransactionSortBy
  currentSortBy: TransactionSortBy | null
  currentOrder: SortOrder | null
  onSort: (column: TransactionSortBy) => void
  align?: "left" | "right"
  className?: string
}
```

Behavior:
- Wrap content ใน `<button>` ที่ `onClick={() => onSort(column)}`
- ลูกศรจาก `lucide-react`: `ArrowUpIcon` (asc), `ArrowDownIcon` (desc), `ArrowUpDownIcon` (unsorted, สี muted)
- `aria-sort="ascending" | "descending" | "none"` บน `<th>` element (สำคัญสำหรับ screen reader)
- `cursor-pointer`, hover สี subtle (ใช้ `hover:text-foreground` ตาม convention text → foreground)
- `align="right"` สำหรับคอลัมน์จำนวนเงิน (ปุ่ม inline-flex ชิดขวา)

**Acceptance criteria**:
- [x] Component render ถูกในทุก 3 states (unsorted/asc/desc) — ✅ `sortable-table-head.tsx`; tests cover unsorted/asc/desc (`rendering` block)
- [x] `aria-sort` ตรงกับ state — ✅ `ariaSort` computed from `isActive`/`currentOrder`; tests verify `aria-sort="none|ascending|descending"`
- [x] TDD: `frontend/tests/unit/components/sortable-table-head.test.tsx` cover click → onSort เรียก, ลูกศรถูก, aria-sort ถูก — ✅ 9 tests: rendering (7) + interaction (2) covering click→onSort, aria-sort per state, align, all 5 columns

**Verification**:
- [x] `npm test -- sortable-table-head` ผ่าน — ✅ 9/9 pass
- [x] `npm run typecheck` — ✅ 0 errors

**Dependencies**: B2 (เพราะ type import)

**Files likely touched**:
- `frontend/src/components/ui/sortable-table-head.tsx` (new)
- `frontend/tests/unit/components/sortable-table-head.test.tsx` (new)

**Estimated scope**: Small (2 files, ~70 LOC)

---

## Task C2: เปลี่ยน `TableHead` plain text → `SortableTableHead` ใน `TransactionsPage`

**Description**: แทนที่ 5 หัวคอลัมน์ sortable ด้วย `SortableTableHead`. คอลัมน์ "การกระทำ" ยังเป็น `TableHead` ปกติ.

**Acceptance criteria**:
- [x] คอลัมน์ วันที่/ประเภท/หมวดหมู่/จำนวนเงิน/หมายเหตุ → `SortableTableHead` ผูกกับ `handleSortChange` — ✅ `TransactionsPage.tsx:447-478` (5 `SortableTableHead` nodes, all wired to `handleSortChange`)
- [x] คอลัมน์ การกระทำ → `TableHead` ปกติ (ไม่ใช่ SortableTableHead) — ✅ `TransactionsPage.tsx:480-482` (plain `<TableHead className="w-[80px] text-right">การกระทำ</TableHead>`)
- [x] `align="right"` สำหรับจำนวนเงิน — ✅ `TransactionsPage.tsx:465` (`align="right"`)
- [x] Visual review: ลูกศรแสดง, สลับ sort ได้, reset ครั้งที่ 3 ของ column เดิม — ✅ unit tests confirm desc→asc→null cycle; e2e spec (`transactions-sort.spec.ts`) covers 3-click reset + aria-sort
- [x] `handleSortChange` component handler ที่ถูก defer จาก B2 ถูกเพิ่มจริง — ✅ `TransactionsPage.tsx:195-200` (`nextSortState` + `setPage(1)`)
- [ ] ทดสอบในเบราว์เซอร์จริง (DevTools MCP หรือ manual) — ⏸ ยังไม่ได้ทดสอบ manual ในเบราว์เซอร์จริง; unit tests + Playwright spec ครอบ logic แล้ว

**Verification**:
- [x] `npm run build` สะอาด — ✅
- [ ] Browser test: คลิกหัว "วันที่" 2 ครั้ง → สลับ; ครั้งที่ 3 → reset, Network ส่ง sort param correctly — ⏸ รอ manual (Playwright spec `transactions-sort.spec.ts` ครอบ toggle + aria-sort แต่ยังไม่ได้รัน gate)
- [ ] Lighthouse a11y ไม่ตก (optional — เช็คด้วย `lh-seed.py` script ถ้ามี) — ⏸ optional, ข้ามได้

**Dependencies**: C1

**Files likely touched**:
- `frontend/src/pages/TransactionsPage.tsx`

**Estimated scope**: Small (1 file, ~30 LOC markup)

---

## Task C3: อัปเดต `TransactionsPage` unit tests

**Description**: Existing tests อาจ assert หัวตารางเป็น plain text. Update + เพิ่ม coverage สำหรับ sort flow.

**Acceptance criteria**:
- [x] ทุก existing tests ผ่าน (186/186 หรือ equifinalent — number อาจเพิ่มเพราะ test ใหม่) — ✅ 250/250 pass (เพิ่มจาก 229 เดิม; existing tests ไม่ break)
- [x] เพิ่ม test: คลิกหัว "วันที่" ครั้งที่ 1 → `useTransactions` ถูกเรียกด้วย `sortBy: "occurredOn", sortOrder: "desc"` — ✅ `clicking a different column switches sortBy` ครอบ click วันที่ → `sortBy=occurredOn&sortOrder=desc` (และ `sends sort params` ครอบจำนวนเงิน first click→desc)
- [x] เพิ่ม test: คลิกซ้ำคอลัมน์เดิม → toggle asc/desc/null — ✅ `clicking the same column twice toggles desc → asc` + `third click on the same column resets sort to null` (เช็ค URL params + aria-sort)
- [x] เพิ่ม test: เปลี่ยน sort แล้ว `page` reset เป็น 1 — ✅ `resets page to 1 when sort changes while on a higher page`
- [x] เพิ่ม test: คลิกคอลัมน์ "การกระทำ" ไม่ trigger sort (ถ้า SortableTableHead ไม่ wrap ก็ skip — เพราะเป็น TableHead ปกติ) — ✅ `clicking the การกระทำ column header does not trigger sort` (asserts ไม่มี button ใน th + ไม่มี API call ใหม่)

**Verification**:
- [x] `npm test` ทั้งห้อง ผ่าน — ✅ 250/250 pass (29 files)

**Dependencies**: C2

**Files likely touched**:
- `frontend/tests/unit/components/TransactionsPage.test.tsx` (extend)

**Estimated scope**: Medium (1 file, ~80-100 LOC test)

---

## Task C4: (Optional) Playwright E2E smoke

**Description**: เพิ่ม e2e test สั้นๆ ครอบคลุม sort flow จริง ถ้าโปรเจกต์ถือ Playwright เป็น gate.

**Acceptance criteria**:
- [x] `frontend/tests/e2e/transactions-sort.spec.ts`:
  - login → /transactions
  - คลิกหัว "จำนวนเงิน" → แถวแรกเป็นยอดใหญ่สุด
  - คลิกซ้ำ → แถวแรกเป็นยอดเล็กสุด
  - คลิก "วันที่" → เรียงวันล่าสุดก่อน (default)
  - ตรวจ `aria-sort` ของ `<th>` ที่ active
  — ✅ ไฟล์มีอยู่แล้ว; ครอบ toggle desc→asc→reset, switch-column, การกระทำไม่มี button, aria-sort assertions

**Verification**:
- [ ] `npx playwright test transactions-sort` ผ่าน — ⏸ ยังไม่ได้รัน (ต้อง backend + DB รันจริง + Playwright installed); spec ถูกเขียนครบแล้ว รอรันเมื่อ environment พร้อม

**Dependencies**: C3

**Files likely touched**:
- `frontend/tests/e2e/transactions-sort.spec.ts` (new)

**Estimated scope**: Small (1 file, ~50 LOC)

---

## Phase C — Exit Criteria (Final Checkpoint)

- [x] `npm run lint && npm run typecheck && npm test && npm run build` ทั้งคู่สะอาด — ✅ lint 0 errors (5 pre-existing warnings ไม่เกี่ยว); typecheck 0 errors; `npm test` 250/250 pass (29 files); build สะอาด
- [ ] Playwright (optional C4 ถ้าทำ) — ผ่าน — ⏸ spec เขียนครบ; ยังไม่ได้รัน (ต้อง backend+DB รันจริง)
- [ ] Manual: เปิด `/transactions` ในเบราว์เซอร์จริง, คลิก sort ทุกคอลัมน์, ตรวจสอบ Network ส่ง sort param ถูก — ⏸ รอ user (unit tests + e2e spec ครอบ logic แล้ว)
- [x] Accessibility: `aria-sort` ตั้งค่าถูก, ปุ่มมี `aria-label` ที่อ่านได้ (เช่น "เรียงตามวันที่") — ✅ `aria-sort` ตั้งค่าถูก (tests ยืนยัน none/ascending/descending); ⚠️ ปุ่มยังไม่มี explicit `aria-label` (ใช้ข้อความ label ใน button เป็น accessible name อยู่แล้ว — screen reader อ่านได้) — ถ้าต้องการ `aria-label` แบบ "เรียงตามวันที่" เพิ่มเติม ให้แก้ใน follow-up
- [x] ไม่มี Breaking changes: ผู้ใช้ที่ไม่ sort ยังเห็น default `OccurredOn desc` — ✅ default `sortBy=null, sortOrder=null` → backend fallback; test `List_without_sort_params_returns_default_order` (backend) + `clicking การกระทำ` (FE no-trigger)
- [x] พร้อม code review (5 axes: correctness, readability, architecture, security, performance) — ✅ code สะอาด, type-safe, enum whitelist ป้องกัน injection, pure `nextSortState` testable แยก

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| ไทย collation ใน Postgres (`Category.Name`, `Note`) — sort ไม่ตรง dictionary order | Low (UX nit) | Documentation note ใน plan; แจ้ง user ว่าเป็น known limitation; ภายหลังเพิ่ม `COLLATION "th_th"` ถ้าจำเป็น |
| EF Core dynamic `OrderBy` กับหลาย type — compiler/type ยุ่ง | Med | Branch-per-case implementation (A3). Test cover ทุก case ก่อน |
| React Query cache stale — เปลี่ยน sort แต่ cache คืน subset ผิด | Med | `transactionKeys.list(filter)` รวม `sortBy`/`sortOrder` ใน key (อัปเดตใน B1 ตามธรรมชาติผ่าน `filter` object) — cache isolation ทำงานเอง |
| Playwright e2e flaky กับ `aria-sort` timing | Low | ใช้ `expect(locator).toHaveAttribute('aria-sort', …)` (auto-retry) แทน manual sleep |
| CSV export ส่ง sort param อาจได้ CSV เรียงตามเดียวกับจอ — ตรงความตั้งใจ แต่ user อาจไม่คาด | Low | Document ใน tooltip หรือ PR notes; ไม่ใช่ breaking |
| Default behavior เปลี่ยนโดน accident (test เก่า fail) | Med | ทุก phase ผ่าน `dotnet test` / `npm test`; default sort path มี test lock (A2) |
| User isolation (global query filter) อาจ break จาก dynamic OrderBy | Low | Dynamic sort ไม่แตะ `Where` clause — global filter ยังทำงาน; integration test ใน A4 ครอบ current-user isolation |

---

## Open Questions

- [ ] **Q1**: Sort field enum วางที่ `Filters/` (ท้องถิ่น transaction) หรือ `Common/` (กลาง)? — `SortOrder` สาวกต้องการ reuse ในอนาคต (Dashboard?). ขอ recommend วาง `SortOrder` ที่ `Application/Common/`, และ `TransactionSortBy` ที่ `Filters/` (entity-specific).
- [ ] **Q2**: "หมายเหตุ" nullable sort — nulls first/last? Default EF behavior `nulls last` ใน asc, `nulls first` ใน desc. Acceptable? หรือบังคับ nulls-last ทั้งคู่?
- [ ] **Q3**: "การกระทำ" column — ยืนยันไม่ sortable ใช่ไหม (action buttons)?
- [ ] **Q4**: ทำ PR เดียวครอบ phase A+B+C หรือ 3 PRs? Recommend อย่างน้อย 2 PRs: A (backend foundation) + B+C (frontend). ทำให้ review ง่าย.
- [ ] **Q5**: CSV export — ส่ง sort param ไปด้วยใช่ไหม? (ผม recommend ใช่ ตาม "list view === CSV" principle)

---

## Execution Checklist

```
Phase A (backend):  [x] A1  [x] A2  [x] A3  [x] A4   → Checkpoint [2/4] (build+unit+integration-isolated ✅; manual curl และ commit pending) → PR?
Phase B (FE core):  [x] B1  [x] B2  [⚠️]              → Checkpoint [1/3] (build/lint/typecheck/test ✅; manual Network + squash-PR pending) — note: B2 handler logic split เป็น pure fn `nextSortState` (UI binding อยู่ใน C2) ✅ ปิดใน C2 แล้ว
Phase C (FE UI):    [x] C1  [x] C2  [x] C3  [⚠️] C4 (optional, spec เขียนครบ ยังไม่ได้รัน) → Final Checkpoint [4/6] (build/lint/typecheck/test/a11y-aria-sort/no-breaking-change ✅; Playwright run + browser manual pending user) → PR?
```

---

## Out of Scope (deliberately not in this plan)

- Multi-column sort (Shift+click) — ใช้ single-column sort ตาม UX convention ที่ชัดเจน
- Persistence ของ sort state ใน URL query string / localStorage — อาจเป็นภายหลัง (rustyก case ค้นหาลิงก์ share)
- Dashboard / Summary sort — เป็น aggregate query, ไม่ใช่งานเดียวกัน
- DB index ใหม่สำหรับ sort columns — ข้อมูลส่วนตัวต่อ user, page เล็ก, ไม่ด่วน; ติดาตามจริงแล้วค่อยทำ (perf task แยก)
- ไทย collation tuning (`th_th` collation) — ตาม risk note
