# Graph Report - .  (2026-06-26)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1299 nodes · 2430 edges · 108 communities (78 shown, 30 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 109 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b4dc7792`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_CSV Export Service (Backend)|CSV Export Service (Backend)]]
- [[_COMMUNITY_JWT Auth Service|JWT Auth Service]]
- [[_COMMUNITY_NuGet Package Manifests|NuGet Package Manifests]]
- [[_COMMUNITY_User + Refresh Token Repositories|User + Refresh Token Repositories]]
- [[_COMMUNITY_Frontend Category Feature|Frontend Category Feature]]
- [[_COMMUNITY_Auth & Category Service Unit Tests|Auth & Category Service Unit Tests]]
- [[_COMMUNITY_Agent Skills & Workflows (Meta)|Agent Skills & Workflows (Meta)]]
- [[_COMMUNITY_Backend Integration Tests (Auth, Dashboard, Migrations)|Backend Integration Tests (Auth, Dashboard, Migrations)]]
- [[_COMMUNITY_Infrastructure Migrations & User Context|Infrastructure Migrations & User Context]]
- [[_COMMUNITY_Backend Integration Tests (Categories, CORS, Health)|Backend Integration Tests (Categories, CORS, Health)]]
- [[_COMMUNITY_Frontend Auth Context & Logout Hook|Frontend Auth Context & Logout Hook]]
- [[_COMMUNITY_Category Domain & Password Hasher|Category Domain & Password Hasher]]
- [[_COMMUNITY_Transactions Integration Tests|Transactions Integration Tests]]
- [[_COMMUNITY_Category Application Service|Category Application Service]]
- [[_COMMUNITY_Architecture & Design Conventions (Docs)|Architecture & Design Conventions (Docs)]]
- [[_COMMUNITY_Frontend Dev Tooling (ESLint, dotenv)|Frontend Dev Tooling (ESLint, dotenv)]]
- [[_COMMUNITY_Transactions Service & AccessToken DTO|Transactions Service & AccessToken DTO]]
- [[_COMMUNITY_Exports Integration Tests|Exports Integration Tests]]
- [[_COMMUNITY_Transactions Domain & Repository|Transactions Domain & Repository]]
- [[_COMMUNITY_Transactions Page Component Tests|Transactions Page Component Tests]]
- [[_COMMUNITY_TypeScript App Config (tsconfig.app.json)|TypeScript App Config (tsconfig.app.json)]]
- [[_COMMUNITY_Dashboard Repository & Aggregates|Dashboard Repository & Aggregates]]
- [[_COMMUNITY_shadcnui Components Alias Config|shadcn/ui Components Alias Config]]
- [[_COMMUNITY_UI Primitive Components (card, select, etc.)|UI Primitive Components (card, select, etc.)]]
- [[_COMMUNITY_Backend launchSettings & Debug Config|Backend launchSettings & Debug Config]]
- [[_COMMUNITY_Frontend Runtime Dependencies|Frontend Runtime Dependencies]]
- [[_COMMUNITY_Domain Exception Hierarchy|Domain Exception Hierarchy]]
- [[_COMMUNITY_TransactionFormDialog Tests|TransactionFormDialog Tests]]
- [[_COMMUNITY_TypeScript Node Config (tsconfig.node.json)|TypeScript Node Config (tsconfig.node.json)]]
- [[_COMMUNITY_CategoriesPage Tests|CategoriesPage Tests]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 107|Community 107]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 74 edges
2. `TransactionsEndpointsTests` - 39 edges
3. `ExportServiceTests` - 32 edges
4. `ExportsEndpointsTests` - 30 edges
5. `TransactionServiceTests` - 24 edges
6. `CategoryServiceTests` - 23 edges
7. `Category` - 22 edges
8. `AuthServiceTests` - 22 edges
9. `TransactionType` - 22 edges
10. `compilerOptions` - 20 edges

## Surprising Connections (you probably didn't know these)
- `CreateCategoryRequestValidator` --references--> `CreateCategoryRequest`  [EXTRACTED]
  backend/src/ExpenseTracker.Application/Categories/Validators/CategoryValidators.cs → frontend/src/types/api.ts
- `UpdateCategoryRequestValidator` --references--> `UpdateCategoryRequest`  [EXTRACTED]
  backend/src/ExpenseTracker.Application/Categories/Validators/CategoryValidators.cs → frontend/src/types/api.ts
- `CreateTransactionRequestValidator` --references--> `CreateTransactionRequest`  [EXTRACTED]
  backend/src/ExpenseTracker.Application/Transactions/Validators/TransactionValidators.cs → frontend/src/types/api.ts
- `UpdateTransactionRequestValidator` --references--> `UpdateTransactionRequest`  [EXTRACTED]
  backend/src/ExpenseTracker.Application/Transactions/Validators/TransactionValidators.cs → frontend/src/types/api.ts
- `EmptyState()` --calls--> `cn()`  [INFERRED]
  frontend/src/components/common/EmptyState.tsx → frontend/src/lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **PR Review Fan-Out Pattern** — code_reviewer_agent, security_auditor_agent, test_engineer_agent [EXTRACTED 1.00]
- **Five-Dimension Code Review Framework** — code_reviewer_correctness, code_reviewer_readability, code_reviewer_architecture, code_reviewer_security, code_reviewer_performance [EXTRACTED 1.00]
- **Core Coding Standards and Practices** — copilot_instructions_tdd, copilot_instructions_five_axes, copilot_instructions_incremental, copilot_instructions_graphify [EXTRACTED 1.00]
- **Idea Refine Supplemental Documentation** — idea_refine_examples, idea_refine_frameworks, idea_refine_refinement_criteria [EXTRACTED 1.00]
- **Core Expense Tracker Features** — readme_multi_user_auth, readme_jwt_refresh_tokens, readme_transactions, readme_categories, readme_dashboard_charts, readme_csv_export, readme_rfc7807 [EXTRACTED 1.00]

## Communities (108 total, 30 thin omitted)

### Community 0 - "CSV Export Service (Backend)"
Cohesion: 0.09
Nodes (9): ExportService, ExportServiceTests, IExportService, InlineData, MemoryStream, T, Theory, TransactionAmountParserTests (+1 more)

### Community 1 - "JWT Auth Service"
Cohesion: 0.07
Nodes (19): IJwtTokenService, AllowAnonymous, AuthService, IAuthService, Authorize, JwtSettings, RefreshTokenSettings, AuthController (+11 more)

### Community 2 - "NuGet Package Manifests"
Cohesion: 0.05
Nodes (39): BCrypt.Net-Next (4.2.0), Microsoft.EntityFrameworkCore.Design (10.0.9), Microsoft.NET.Sdk, Microsoft.NET.Sdk, BCrypt.Net-Next (4.2.0), Microsoft.EntityFrameworkCore (10.0.9), Microsoft.EntityFrameworkCore.Design (10.0.9), Microsoft.NET.Sdk (+31 more)

### Community 3 - "User + Refresh Token Repositories"
Cohesion: 0.06
Nodes (14): IRefreshTokenService, IUserRepository, CategoryConfiguration, RefreshTokenConfiguration, TransactionConfiguration, UserConfiguration, RefreshToken, User (+6 more)

### Community 4 - "Frontend Category Feature"
Cohesion: 0.05
Nodes (24): categoryKeys, useCategories(), useCreateCategory(), useDeleteCategory(), useUpdateCategory(), CategoryFormDialog(), CategoryFormDialogProps, CategoryFormInput (+16 more)

### Community 5 - "Auth & Category Service Unit Tests"
Cohesion: 0.13
Nodes (4): AuthServiceTests, CategoryServiceTests, Fact, Trait

### Community 6 - "Agent Skills & Workflows (Meta)"
Cohesion: 0.06
Nodes (35): Core Operating Behaviors (6 Rules), Core Web Vitals (LCP INP CLS), Dependency Graph Mapping, Distributed Tracing (OpenTelemetry), Documentation Citation Pattern, Feature Flag Strategy, Gated Workflow (Specify-Plan-Tasks-Implement), Hypothesis with Confidence Number (+27 more)

### Community 7 - "Backend Integration Tests (Auth, Dashboard, Migrations)"
Cohesion: 0.09
Nodes (5): AuthEndpointsTests, DashboardServiceTests, IAsyncLifetime, MigrationsApplyToFreshDatabase, Task

### Community 8 - "Infrastructure Migrations & User Context"
Cohesion: 0.07
Nodes (19): ICurrentUserService, bool, DbContext, IDisposable, IHttpContextAccessor, IServiceScope, IServiceScopeFactory, ExpenseTracker.Infrastructure.Migrations (+11 more)

### Community 9 - "Backend Integration Tests (Categories, CORS, Health)"
Cohesion: 0.10
Nodes (9): CategoriesEndpointsTests, CorsEndpointsTests, HealthEndpointsTests, RateLimitEndpointsTests, HttpClient, IClassFixture, JsonSerializerOptions, Program (+1 more)

### Community 10 - "Frontend Auth Context & Logout Hook"
Cohesion: 0.07
Nodes (20): AuthContext, AuthContextValue, useAuth(), Harness(), mockLogout, mockNavigate, useLogout(), UseLogoutResult (+12 more)

### Community 11 - "Category Domain & Password Hasher"
Cohesion: 0.09
Nodes (6): ICategoryRepository, IPasswordHasher, Category, int, CategoryRepository, BCryptPasswordHasher

### Community 13 - "Category Application Service"
Cohesion: 0.15
Nodes (10): CategoryService, ICategoryService, CategoriesController, Guid, HttpDelete, HttpPut, IValidator, CategoryDto (+2 more)

### Community 14 - "Architecture & Design Conventions (Docs)"
Cohesion: 0.08
Nodes (29): Auth Conventions (Bearer Token + HttpOnly Cookie), Clean Architecture (Domain-Application-Infrastructure-Api), Thai-Language CSV Export with Injection Guard, Pre-Aggregated Dashboard JSON (Server-Side), DashboardService Race Condition Fix (Sequential await), Docker Compose Postgres Setup, Expense Tracker (Multi-User Expense/Income Tracker), Global Query Filter for User Data Isolation (+21 more)

### Community 15 - "Frontend Dev Tooling (ESLint, dotenv)"
Cohesion: 0.07
Nodes (28): devDependencies, autoprefixer, dotenv, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+20 more)

### Community 16 - "Transactions Service & AccessToken DTO"
Cohesion: 0.14
Nodes (11): ITransactionService, TransactionService, AccessTokenDto, CategoryTotalDto, CreateTransactionRequest, CurrentMonthDto, PagedResult, ProblemDetails (+3 more)

### Community 18 - "Transactions Domain & Repository"
Cohesion: 0.14
Nodes (7): ITransactionRepository, DateOnly, Transaction, Items, TransactionRepository, TotalCount, TransactionFilter

### Community 19 - "Transactions Page Component Tests"
Cohesion: 0.09
Nodes (7): categories, handlers, harvestItems(), { mockDownloadTransactionsCsv, mockDownloadSummaryCsv }, sampleTransactions, Select(), server

### Community 20 - "TypeScript App Config (tsconfig.app.json)"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly, ignoreDeprecations, jsx, lib, module (+14 more)

### Community 21 - "Dashboard Repository & Aggregates"
Cohesion: 0.19
Nodes (8): AggregateByCategoryAndMonth, CategoryAggregate, CurrentMonthTotals, IDashboardRepository, IReadOnlyList, MonthlyAggregate, DashboardRepository, TransactionType

### Community 22 - "shadcn/ui Components Alias Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 23 - "UI Primitive Components (card, select, etc.)"
Cohesion: 0.15
Nodes (18): cn(), Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle() (+10 more)

### Community 24 - "Backend launchSettings & Debug Config"
Cohesion: 0.10
Nodes (21): ASPNETCORE_ENVIRONMENT, applicationUrl, commandName, dotnetRunMessages, environmentVariables, launchBrowser, launchUrl, commandName (+13 more)

### Community 25 - "Frontend Runtime Dependencies"
Cohesion: 0.10
Nodes (21): dependencies, axios, @base-ui/react, class-variance-authority, clsx, date-fns, @hookform/resolvers, lucide-react (+13 more)

### Community 26 - "Domain Exception Hierarchy"
Cohesion: 0.12
Nodes (11): Exception, DomainException, DomainValidationException, ForbiddenException, NotFoundException, RefreshTokenValidationException, HttpContext, HttpStatusCode (+3 more)

### Community 27 - "TransactionFormDialog Tests"
Cohesion: 0.11
Nodes (7): categories, createSpy, harvestItems(), sampleEditingTransaction, Select(), server, updateSpy

### Community 28 - "TypeScript Node Config (tsconfig.node.json)"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 29 - "CategoriesPage Tests"
Cohesion: 0.12
Nodes (5): handlers, server, systemExpenseCategories, systemIncomeCategories, userCategories

### Community 30 - "Community 30"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 33 - "Community 33"
Cohesion: 0.20
Nodes (9): phase3-smoke-cross-user.sh script, phase3-smoke-csv-injection.sh script, phase3-smoke.sh script, wait-api.sh script, CSV export live smoke testing — Phase 3 manual verification, CSV injection sanitization — apostrophe-prefix defense, Deleted June 2026 — one-off Phase 3 debug scripts, netsh interface portproxy — Windows-to-WSL2 port forwarding (+1 more)

### Community 34 - "Community 34"
Cohesion: 0.15
Nodes (8): DashboardFilter, dashboardKeys, useDashboardSummary(), formatTHB(), CHART_COLORS, DashboardPage(), formatMonthLabel(), thaiShortMonths

### Community 35 - "Community 35"
Cohesion: 0.15
Nodes (14): System + Custom Categories, Clean Architecture with Domain-Application-Infrastructure-Api Layers, CSV Export with Filters and Injection Guard, Dashboard with KPI, Trend Line, and Bar Charts, PostgreSQL 16 Database, Expense Tracker, JWT Refresh-Token Authentication with HttpOnly Cookies, Multi-User Email+Password Authentication (+6 more)

### Community 36 - "Community 36"
Cohesion: 0.15
Nodes (9): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogMedia(), AlertDialogOverlay() (+1 more)

### Community 37 - "Community 37"
Cohesion: 0.21
Nodes (5): ControllerBase, DashboardController, DashboardService, IDashboardService, DashboardSummaryDto

### Community 38 - "Community 38"
Cohesion: 0.17
Nodes (9): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+1 more)

### Community 39 - "Community 39"
Cohesion: 0.24
Nodes (7): AbstractValidator, decimal, CreateCategoryRequestValidator, UpdateCategoryRequestValidator, CreateTransactionRequestValidator, TransactionAmountParser, UpdateTransactionRequestValidator

### Community 40 - "Community 40"
Cohesion: 0.18
Nodes (11): Browser Testing with DevTools Skill, Browser Testing Security Boundaries and Profile Isolation, Browser Content as Untrusted Data Boundary, WCAG 2.1 AA Keyboard and ARIA Compliance, Avoid AI Aesthetic — Production-Quality Visual Design, Component Composition Over Configuration, Frontend UI Engineering Skill, State Management Simplicity Hierarchy (+3 more)

### Community 41 - "Community 41"
Cohesion: 0.18
Nodes (6): DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle()

### Community 42 - "Community 42"
Cohesion: 0.18
Nodes (6): SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle()

### Community 44 - "Community 44"
Cohesion: 0.22
Nodes (10): Finding Severity Categorization (Critical/Nit/Optional/FYI), Change Sizing Guidelines (~100 lines per change), Code Review and Quality Skill, Senior Code Reviewer Agent, Architecture Review Dimension, Correctness Review Dimension, Performance Review Dimension, Readability Review Dimension (+2 more)

### Community 45 - "Community 45"
Cohesion: 0.20
Nodes (10): scripts, build, dev, format, format:fix, lint, preview, test (+2 more)

### Community 46 - "Community 46"
Cohesion: 0.22
Nodes (9): Consistent Error Semantics, Contract-First Interface Design, Hyrum's Law — All Observable Behaviors Become Contracts, Prefer Addition Over Modification, API and Interface Design Skill, Churn Rule — Deprecator Owns Migration Responsibility, Code Is a Liability — Ongoing Maintenance Cost, Deprecation and Migration Skill (+1 more)

### Community 47 - "Community 47"
Cohesion: 0.22
Nodes (8): Table(), TableBody(), TableCaption(), TableCell(), TableFooter(), TableHead(), TableHeader(), TableRow()

### Community 48 - "Community 48"
Cohesion: 0.25
Nodes (8): Validate at System Boundaries, Claim → Extract → Doubt → Reconcile → Stop Cycle, Cross-Model Second Opinion Escalation, Fresh-Context Adversarial Review Process, Doubt-Driven Development Skill, Security Auditor Agent, OWASP Top 10 Vulnerability Mapping, STRIDE Threat Modeling at Trust Boundaries

### Community 49 - "Community 49"
Cohesion: 0.46
Nodes (3): ExportsController, HttpGet, IActionResult

### Community 50 - "Community 50"
Cohesion: 0.25
Nodes (3): apiClient, _onRefreshed, _onRefreshFailed

### Community 51 - "Community 51"
Cohesion: 0.29
Nodes (7): Chesterton's Fence — Understand Before Removing, Prefer Clarity Over Cleverness, Preserve Behavior Exactly, Code Simplification Skill, Debugging and Error Recovery Skill, Stop-the-Line Rule — Preserve Evidence Before Diagnosing, Triage Checklist — Reproduce → Localize → Reduce → Fix → Guard → Verify

### Community 52 - "Community 52"
Cohesion: 0.29
Nodes (5): emptyDashboardData, handlers, mockDashboardData, { mockDownloadTransactionsCsv, mockDownloadSummaryCsv }, server

### Community 53 - "Community 53"
Cohesion: 0.33
Nodes (7): Project Coding Standards, Graphify Knowledge Graph Querying, Incremental Implementation Discipline, TDD and Prove-It Test Pattern, Test Engineer Agent, Prove-It Bug Test Pattern, Unit > Integration > E2E Test Hierarchy

### Community 54 - "Community 54"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 55 - "Community 55"
Cohesion: 0.29
Nodes (7): Divergent → Convergent → Sharpen Three-Phase Process, Ideation Session Examples, Ideation Frameworks Reference (SCAMPER, HMW, JTBD, etc.), Hidden Assumptions Surfacing and Stress-Testing, Not Doing List — Explicit Trade-Off Documentation, Refinement and Evaluation Criteria Rubric, Idea Refine Skill

### Community 56 - "Community 56"
Cohesion: 0.33
Nodes (4): Migration, MigrationBuilder, ExpenseTracker.Infrastructure.Migrations, InitialCreate

### Community 57 - "Community 57"
Cohesion: 0.29
Nodes (7): Bluesky icon symbol, Discord icon symbol, Documentation icon symbol, GitHub icon symbol, Social/general icon symbol, Social media icon sprite — Bluesky, Discord, GitHub, X/Twitter, documentation, social icons, X/Twitter icon symbol

### Community 58 - "Community 58"
Cohesion: 0.29
Nodes (6): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage()

### Community 59 - "Community 59"
Cohesion: 0.67
Nodes (5): buildTransactionsQuery(), downloadSummaryCsv(), downloadTransactionsCsv(), extractFilename(), triggerDownload()

### Community 60 - "Community 60"
Cohesion: 0.40
Nodes (4): Button(), buttonVariants, Calendar(), CalendarDayButton()

### Community 61 - "Community 61"
Cohesion: 0.40
Nodes (4): NAV_ITEMS, NavItem, Sidebar(), SidebarProps

### Community 62 - "Community 62"
Cohesion: 0.50
Nodes (4): CI/CD and Automation Skill, Quality Gate Pipeline — Lint → Type → Test → Build → Security, Shift Left — Catch Problems Early, Pre-Commit Verification Gates

### Community 64 - "Community 64"
Cohesion: 0.67
Nodes (3): install-docker-ce-wsl.sh script, DEBIAN_FRONTEND, log()

### Community 65 - "Community 65"
Cohesion: 0.67
Nodes (4): Atomic Commits — One Logical Change Per Commit, Save Point Pattern — Commit After Each Successful Increment, Trunk-Based Development with Short-Lived Branches, Git Workflow and Versioning Skill

### Community 71 - "Community 71"
Cohesion: 0.67
Nodes (3): ADR Lifecycle — Proposed → Accepted → Superseded/Deprecated, ADR Template — Context, Decision, Alternatives, Consequences, Documentation and ADRs Skill

## Knowledge Gaps
- **357 isolated node(s):** `idea-refine.sh script`, `BCrypt.Net-Next (4.2.0)`, `FluentValidation.AspNetCore (11.3.1)`, `Microsoft.AspNetCore.Authentication.JwtBearer (10.0.0)`, `Microsoft.EntityFrameworkCore.Design (10.0.9)` (+352 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ExpenseTrackerDbContext` connect `Infrastructure Migrations & User Context` to `User + Refresh Token Repositories`, `Transactions Domain & Repository`, `Category Domain & Password Hasher`, `Dashboard Repository & Aggregates`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `cn()` connect `UI Primitive Components (card, select, etc.)` to `Community 34`, `Community 67`, `Community 68`, `Community 36`, `Community 41`, `Community 42`, `Community 76`, `Community 47`, `Community 85`, `Community 86`, `Community 87`, `Community 58`, `Community 60`, `Community 61`, `Community 30`, `Community 63`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `CategoryServiceTests` connect `Auth & Category Service Unit Tests` to `Category Domain & Password Hasher`, `Category Application Service`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Are the 73 inferred relationships involving `cn()` (e.g. with `EmptyState()` and `ErrorState()`) actually correct?**
  _`cn()` has 73 INFERRED edges - model-reasoned connections that need verification._
- **What connects `idea-refine.sh script`, `BCrypt.Net-Next (4.2.0)`, `FluentValidation.AspNetCore (11.3.1)` to the rest of the system?**
  _362 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CSV Export Service (Backend)` be split into smaller, more focused modules?**
  _Cohesion score 0.09013605442176871 - nodes in this community are weakly interconnected._
- **Should `JWT Auth Service` be split into smaller, more focused modules?**
  _Cohesion score 0.06648936170212766 - nodes in this community are weakly interconnected._