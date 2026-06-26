# Graph Report - .  (2026-06-26)

## Corpus Check
- 208 files · ~112,856 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 991 nodes · 1984 edges · 109 communities (49 shown, 60 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Auth Integration Tests|Auth Integration Tests]]
- [[_COMMUNITY_Auth Unit Tests|Auth Unit Tests]]
- [[_COMMUNITY_Project Dependencies|Project Dependencies]]
- [[_COMMUNITY_Export Service Tests|Export Service Tests]]
- [[_COMMUNITY_Infrastructure & DbContext|Infrastructure & DbContext]]
- [[_COMMUNITY_Agent Skills & Concepts|Agent Skills & Concepts]]
- [[_COMMUNITY_Transaction Repository|Transaction Repository]]
- [[_COMMUNITY_Auth Service Logic|Auth Service Logic]]
- [[_COMMUNITY_Dashboard & Aggregation|Dashboard & Aggregation]]
- [[_COMMUNITY_User Repository|User Repository]]
- [[_COMMUNITY_Category Repository|Category Repository]]
- [[_COMMUNITY_JWT & Token Services|JWT & Token Services]]
- [[_COMMUNITY_Architecture Decisions|Architecture Decisions]]
- [[_COMMUNITY_Category Service|Category Service]]
- [[_COMMUNITY_Frontend Dev Config|Frontend Dev Config]]
- [[_COMMUNITY_Export Endpoint Tests|Export Endpoint Tests]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Transaction Service|Transaction Service]]
- [[_COMMUNITY_UI Component Config|UI Component Config]]
- [[_COMMUNITY_API Launch Settings|API Launch Settings]]
- [[_COMMUNITY_Frontend Dependencies|Frontend Dependencies]]
- [[_COMMUNITY_Domain Exceptions|Domain Exceptions]]
- [[_COMMUNITY_API Controllers|API Controllers]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
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
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 106|Community 106]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 108|Community 108]]

## God Nodes (most connected - your core abstractions)
1. `TransactionsEndpointsTests` - 39 edges
2. `ExportServiceTests` - 32 edges
3. `ExportsEndpointsTests` - 30 edges
4. `TransactionServiceTests` - 24 edges
5. `CategoryServiceTests` - 23 edges
6. `Category` - 22 edges
7. `AuthServiceTests` - 22 edges
8. `TransactionType` - 21 edges
9. `compilerOptions` - 20 edges
10. `Transaction` - 19 edges

## Surprising Connections (you probably didn't know these)
- `CreateCategoryRequestValidator` --references--> `CreateCategoryRequest`  [EXTRACTED]
  backend/src/ExpenseTracker.Application/Categories/Validators/CategoryValidators.cs → frontend/src/types/api.ts
- `UpdateCategoryRequestValidator` --references--> `UpdateCategoryRequest`  [EXTRACTED]
  backend/src/ExpenseTracker.Application/Categories/Validators/CategoryValidators.cs → frontend/src/types/api.ts
- `CreateTransactionRequestValidator` --references--> `CreateTransactionRequest`  [EXTRACTED]
  backend/src/ExpenseTracker.Application/Transactions/Validators/TransactionValidators.cs → frontend/src/types/api.ts
- `UpdateTransactionRequestValidator` --references--> `UpdateTransactionRequest`  [EXTRACTED]
  backend/src/ExpenseTracker.Application/Transactions/Validators/TransactionValidators.cs → frontend/src/types/api.ts
- `Expense Tracker` --references--> `Project Coding Standards`  [EXTRACTED]
  README.md → .github/copilot-instructions.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **PR Review Fan-Out Pattern** — code_reviewer_agent, security_auditor_agent, test_engineer_agent [EXTRACTED 1.00]
- **Core Coding Standards and Practices** — copilot_instructions_tdd, copilot_instructions_five_axes, copilot_instructions_incremental, copilot_instructions_graphify [EXTRACTED 1.00]
- **Core Expense Tracker Features** — readme_multi_user_auth, readme_jwt_refresh_tokens, readme_transactions, readme_categories, readme_dashboard_charts, readme_csv_export, readme_rfc7807 [EXTRACTED 1.00]
- **Idea Refine Supplemental Documentation** — idea_refine_examples, idea_refine_frameworks, idea_refine_refinement_criteria [EXTRACTED 1.00]
- **Five-Dimension Code Review Framework** — code_reviewer_correctness, code_reviewer_readability, code_reviewer_architecture, code_reviewer_security, code_reviewer_performance [EXTRACTED 1.00]

## Communities (109 total, 60 thin omitted)

### Community 0 - "Auth Integration Tests"
Cohesion: 0.08
Nodes (10): AuthEndpointsTests, CategoriesEndpointsTests, DashboardEndpointsTests, TransactionsEndpointsTests, HttpClient, IClassFixture, JsonSerializerOptions, Program (+2 more)

### Community 1 - "Auth Unit Tests"
Cohesion: 0.08
Nodes (9): AuthServiceTests, CategoryServiceTests, DashboardServiceTests, DateTimeOffset, CategoryTests, TransactionTests, Fact, Trait (+1 more)

### Community 2 - "Project Dependencies"
Cohesion: 0.05
Nodes (38): BCrypt.Net-Next (4.2.0), Microsoft.EntityFrameworkCore.Design (10.0.0), Microsoft.NET.Sdk, Microsoft.NET.Sdk, BCrypt.Net-Next (4.2.0), Microsoft.EntityFrameworkCore (10.0.0), Microsoft.EntityFrameworkCore.Design (10.0.0), Microsoft.NET.Sdk (+30 more)

### Community 3 - "Export Service Tests"
Cohesion: 0.13
Nodes (5): ExportServiceTests, InlineData, Theory, TransactionAmountParserTests, MonthlyTotalDto

### Community 4 - "Infrastructure & DbContext"
Cohesion: 0.06
Nodes (18): bool, DbContext, IAsyncLifetime, IDisposable, IServiceScope, IServiceScopeFactory, ExpenseTracker.Infrastructure.Migrations, InitialCreate (+10 more)

### Community 5 - "Agent Skills & Concepts"
Cohesion: 0.06
Nodes (35): Core Operating Behaviors (6 Rules), Core Web Vitals (LCP INP CLS), Dependency Graph Mapping, Distributed Tracing (OpenTelemetry), Documentation Citation Pattern, Feature Flag Strategy, Gated Workflow (Specify-Plan-Tasks-Implement), Hypothesis with Confidence Number (+27 more)

### Community 6 - "Transaction Repository"
Cohesion: 0.09
Nodes (13): ITransactionRepository, AbstractValidator, DateOnly, decimal, Transaction, Items, TransactionRepository, TotalCount (+5 more)

### Community 7 - "Auth Service Logic"
Cohesion: 0.11
Nodes (11): AllowAnonymous, AuthService, IAuthService, Authorize, AuthController, HttpPost, IConfiguration, AuthResponse (+3 more)

### Community 8 - "Dashboard & Aggregation"
Cohesion: 0.13
Nodes (13): AggregateByCategoryAndMonth, CategoryAggregate, CurrentMonthTotals, DashboardService, IDashboardRepository, IDashboardService, Guid, IReadOnlyList (+5 more)

### Community 9 - "User Repository"
Cohesion: 0.09
Nodes (10): IUserRepository, CategoryConfiguration, RefreshTokenConfiguration, TransactionConfiguration, UserConfiguration, User, EntityTypeBuilder, IEntityTypeConfiguration (+2 more)

### Community 10 - "Category Repository"
Cohesion: 0.09
Nodes (6): ICategoryRepository, IPasswordHasher, Category, int, CategoryRepository, BCryptPasswordHasher

### Community 11 - "JWT & Token Services"
Cohesion: 0.10
Nodes (10): IJwtTokenService, IRefreshTokenService, JwtSettings, RefreshTokenSettings, RefreshToken, JwtTokenResult, PlaintextToken, JwtTokenService (+2 more)

### Community 12 - "Architecture Decisions"
Cohesion: 0.08
Nodes (29): Auth Conventions (Bearer Token + HttpOnly Cookie), Clean Architecture (Domain-Application-Infrastructure-Api), Thai-Language CSV Export with Injection Guard, Pre-Aggregated Dashboard JSON (Server-Side), DashboardService Race Condition Fix (Sequential await), Docker Compose Postgres Setup, Expense Tracker (Multi-User Expense/Income Tracker), Global Query Filter for User Data Isolation (+21 more)

### Community 13 - "Category Service"
Cohesion: 0.13
Nodes (9): CategoryService, ICategoryService, CategoriesController, HttpDelete, HttpPut, IValidator, CategoryDto, CreateCategoryRequest (+1 more)

### Community 14 - "Frontend Dev Config"
Cohesion: 0.07
Nodes (28): devDependencies, autoprefixer, dotenv, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+20 more)

### Community 16 - "TypeScript Config"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly, ignoreDeprecations, jsx, lib, module (+14 more)

### Community 17 - "Transaction Service"
Cohesion: 0.17
Nodes (8): ITransactionService, TransactionService, CreateTransactionRequest, PagedResult, TransactionDto, TransactionFilter, UpdateTransactionRequest, ValidationResult

### Community 18 - "UI Component Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 19 - "API Launch Settings"
Cohesion: 0.10
Nodes (21): ASPNETCORE_ENVIRONMENT, applicationUrl, commandName, dotnetRunMessages, environmentVariables, launchBrowser, launchUrl, commandName (+13 more)

### Community 20 - "Frontend Dependencies"
Cohesion: 0.10
Nodes (21): dependencies, axios, @base-ui/react, class-variance-authority, clsx, date-fns, @hookform/resolvers, lucide-react (+13 more)

### Community 21 - "Domain Exceptions"
Cohesion: 0.12
Nodes (11): Exception, DomainException, DomainValidationException, ForbiddenException, NotFoundException, RefreshTokenValidationException, HttpContext, HttpStatusCode (+3 more)

### Community 22 - "API Controllers"
Cohesion: 0.17
Nodes (8): ICurrentUserService, ControllerBase, DashboardController, ExportsController, HttpGet, IActionResult, IHttpContextAccessor, CurrentUserService

### Community 23 - "Community 23"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 24 - "Community 24"
Cohesion: 0.15
Nodes (14): System + Custom Categories, Clean Architecture with Domain-Application-Infrastructure-Api Layers, CSV Export with Filters and Injection Guard, Dashboard with KPI, Trend Line, and Bar Charts, PostgreSQL 16 Database, Expense Tracker, JWT Refresh-Token Authentication with HttpOnly Cookies, Multi-User Email+Password Authentication (+6 more)

### Community 25 - "Community 25"
Cohesion: 0.24
Nodes (4): ExportService, IExportService, MemoryStream, T

### Community 26 - "Community 26"
Cohesion: 0.18
Nodes (11): Browser Testing with DevTools Skill, Browser Testing Security Boundaries and Profile Isolation, Browser Content as Untrusted Data Boundary, WCAG 2.1 AA Keyboard and ARIA Compliance, Avoid AI Aesthetic — Production-Quality Visual Design, Component Composition Over Configuration, Frontend UI Engineering Skill, State Management Simplicity Hierarchy (+3 more)

### Community 28 - "Community 28"
Cohesion: 0.22
Nodes (10): Finding Severity Categorization (Critical/Nit/Optional/FYI), Change Sizing Guidelines (~100 lines per change), Code Review and Quality Skill, Senior Code Reviewer Agent, Architecture Review Dimension, Correctness Review Dimension, Performance Review Dimension, Readability Review Dimension (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.20
Nodes (10): scripts, build, dev, format, format:fix, lint, preview, test (+2 more)

### Community 30 - "Community 30"
Cohesion: 0.31
Nodes (9): CSV export live smoke testing — Phase 3 manual verification, CSV injection sanitization — apostrophe-prefix defense, Deleted June 2026 — one-off Phase 3 debug scripts, netsh interface portproxy — Windows-to-WSL2 port forwarding, phase3-smoke.sh — Full Phase 3 export flow smoke test, phase3-smoke-cross-user.sh — Data isolation regression guard, phase3-smoke-csv-injection.sh — CSV injection prevention test, scripts/README.md — Helper scripts for local development, networking, and live smoke testing (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.22
Nodes (9): Consistent Error Semantics, Contract-First Interface Design, Hyrum's Law — All Observable Behaviors Become Contracts, Prefer Addition Over Modification, API and Interface Design Skill, Churn Rule — Deprecator Owns Migration Responsibility, Code Is a Liability — Ongoing Maintenance Cost, Deprecation and Migration Skill (+1 more)

### Community 32 - "Community 32"
Cohesion: 0.25
Nodes (8): Validate at System Boundaries, Claim → Extract → Doubt → Reconcile → Stop Cycle, Cross-Model Second Opinion Escalation, Fresh-Context Adversarial Review Process, Doubt-Driven Development Skill, Security Auditor Agent, OWASP Top 10 Vulnerability Mapping, STRIDE Threat Modeling at Trust Boundaries

### Community 33 - "Community 33"
Cohesion: 0.29
Nodes (7): Chesterton's Fence — Understand Before Removing, Prefer Clarity Over Cleverness, Preserve Behavior Exactly, Code Simplification Skill, Debugging and Error Recovery Skill, Stop-the-Line Rule — Preserve Evidence Before Diagnosing, Triage Checklist — Reproduce → Localize → Reduce → Fix → Guard → Verify

### Community 34 - "Community 34"
Cohesion: 0.33
Nodes (7): Project Coding Standards, Graphify Knowledge Graph Querying, Incremental Implementation Discipline, TDD and Prove-It Test Pattern, Test Engineer Agent, Prove-It Bug Test Pattern, Unit > Integration > E2E Test Hierarchy

### Community 35 - "Community 35"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 36 - "Community 36"
Cohesion: 0.29
Nodes (7): Divergent → Convergent → Sharpen Three-Phase Process, Ideation Session Examples, Ideation Frameworks Reference (SCAMPER, HMW, JTBD, etc.), Hidden Assumptions Surfacing and Stress-Testing, Not Doing List — Explicit Trade-Off Documentation, Refinement and Evaluation Criteria Rubric, Idea Refine Skill

### Community 37 - "Community 37"
Cohesion: 0.33
Nodes (4): Migration, MigrationBuilder, ExpenseTracker.Infrastructure.Migrations, InitialCreate

### Community 38 - "Community 38"
Cohesion: 0.29
Nodes (7): Bluesky icon symbol, Discord icon symbol, Documentation icon symbol, GitHub icon symbol, Social/general icon symbol, Social media icon sprite — Bluesky, Discord, GitHub, X/Twitter, documentation, social icons, X/Twitter icon symbol

### Community 39 - "Community 39"
Cohesion: 0.50
Nodes (4): CI/CD and Automation Skill, Quality Gate Pipeline — Lint → Type → Test → Build → Security, Shift Left — Catch Problems Early, Pre-Commit Verification Gates

### Community 40 - "Community 40"
Cohesion: 0.67
Nodes (3): install-docker-ce-wsl.sh script, DEBIAN_FRONTEND, log()

### Community 41 - "Community 41"
Cohesion: 0.67
Nodes (4): Atomic Commits — One Logical Change Per Commit, Save Point Pattern — Commit After Each Successful Increment, Trunk-Based Development with Short-Lived Branches, Git Workflow and Versioning Skill

### Community 42 - "Community 42"
Cohesion: 0.67
Nodes (3): ADR Lifecycle — Proposed → Accepted → Superseded/Deprecated, ADR Template — Context, Decision, Alternatives, Consequences, Documentation and ADRs Skill

## Knowledge Gaps
- **326 isolated node(s):** `idea-refine.sh script`, `BCrypt.Net-Next (4.2.0)`, `FluentValidation.AspNetCore (11.3.1)`, `Microsoft.AspNetCore.Authentication.JwtBearer (10.0.0)`, `Microsoft.EntityFrameworkCore.Design (10.0.0)` (+321 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **60 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ExpenseTrackerDbContext` connect `Infrastructure & DbContext` to `Transaction Repository`, `Dashboard & Aggregation`, `User Repository`, `Category Repository`, `JWT & Token Services`, `API Controllers`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `AuthServiceTests` connect `Auth Unit Tests` to `Auth Service Logic`, `Dashboard & Aggregation`, `User Repository`, `Category Repository`, `JWT & Token Services`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `Category` connect `Category Repository` to `Auth Unit Tests`, `Dashboard & Aggregation`, `User Repository`, `Category Service`, `Transaction Service`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `idea-refine.sh script`, `BCrypt.Net-Next (4.2.0)`, `FluentValidation.AspNetCore (11.3.1)` to the rest of the system?**
  _331 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth Integration Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.07592592592592592 - nodes in this community are weakly interconnected._
- **Should `Auth Unit Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.07536231884057971 - nodes in this community are weakly interconnected._
- **Should `Project Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05087881591119334 - nodes in this community are weakly interconnected._