# Graph Report - .  (2026-06-25)

## Corpus Check
- 203 files · ~110,867 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1109 nodes · 2212 edges · 85 communities (63 shown, 22 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 93 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_api  transactionsEndpoint Tests|api / transactionsEndpoint Tests]]
- [[_COMMUNITY_backend  tests|backend / tests]]
- [[_COMMUNITY_transactions  api|transactions / api]]
- [[_COMMUNITY_exports  exportServicetests|exports / exportServicetests]]
- [[_COMMUNITY_persistence  testdbcontextfactory|persistence / testdbcontextfactory]]
- [[_COMMUNITY_Controllers authController|Controllers// authController]]
- [[_COMMUNITY_hooks  uselogout|hooks / uselogout]]
- [[_COMMUNITY_abstractions  iuserRepository|abstractions / iuserRepository]]
- [[_COMMUNITY_persistence  categoryRepository|persistence / categoryRepository]]
- [[_COMMUNITY_Services  refreshtokenService|Services / refreshtokenService]]
- [[_COMMUNITY_abstractions  itransactionRepository|abstractions / itransactionRepository]]
- [[_COMMUNITY_frontend  package|frontend / package]]
- [[_COMMUNITY_Controllers categoriesController|Controllers// categoriesController]]
- [[_COMMUNITY_transactions  transactionService|transactions / transactionService]]
- [[_COMMUNITY_api  exportsEndpoint Tests|api / exportsEndpoint Tests]]
- [[_COMMUNITY_dashboard  idashboardRepository|dashboard / idashboardRepository]]
- [[_COMMUNITY_components  transactionspage|components / transactionspage]]
- [[_COMMUNITY_frontend  tsconfig|frontend / tsconfig]]
- [[_COMMUNITY_frontend  components|frontend / components]]
- [[_COMMUNITY_ui  select|ui / select]]
- [[_COMMUNITY_properties  launchsettings|properties / launchsettings]]
- [[_COMMUNITY_frontend  package|frontend / package]]
- [[_COMMUNITY_middleware  globalexceptionmiddleware|middleware / globalexceptionmiddleware]]
- [[_COMMUNITY_exports  exportService|exports / exportService]]
- [[_COMMUNITY_components  transactionformdialog|components / transactionformdialog]]
- [[_COMMUNITY_Controllers exportsController|Controllers// exportsController]]
- [[_COMMUNITY_frontend  tsconfig|frontend / tsconfig]]
- [[_COMMUNITY_components  categoriespage|components / categoriespage]]
- [[_COMMUNITY_ui  dropdown|ui / dropdown]]
- [[_COMMUNITY_dashboard  api|dashboard / api]]
- [[_COMMUNITY_ui  alert|ui / alert]]
- [[_COMMUNITY_ui  form|ui / form]]
- [[_COMMUNITY_ui  dialog|ui / dialog]]
- [[_COMMUNITY_ui  sheet|ui / sheet]]
- [[_COMMUNITY_Controllers transactionsController|Controllers// transactionsController]]
- [[_COMMUNITY_frontend  package|frontend / package]]
- [[_COMMUNITY_ui  table|ui / table]]
- [[_COMMUNITY_lib  apiclient|lib / apiclient]]
- [[_COMMUNITY_components  dashboardpage|components / dashboardpage]]
- [[_COMMUNITY_dashboard  dashboardService|dashboard / dashboardService]]
- [[_COMMUNITY_frontend  package|frontend / package]]
- [[_COMMUNITY_migrations  20260624052221|migrations / 20260624052221]]
- [[_COMMUNITY_ui  avatar|ui / avatar]]
- [[_COMMUNITY_exports  api|exports / api]]
- [[_COMMUNITY_ui  button|ui / button]]
- [[_COMMUNITY_layout  sidebar|layout / sidebar]]
- [[_COMMUNITY_common  loadingspinner|common / loadingspinner]]
- [[_COMMUNITY_docker  install|docker / install]]
- [[_COMMUNITY_domain  transactiontests|domain / transactiontests]]
- [[_COMMUNITY_unit  test|unit / test]]
- [[_COMMUNITY_common  emptystate|common / emptystate]]
- [[_COMMUNITY_common  errorstate|common / errorstate]]
- [[_COMMUNITY_components  applayout|components / applayout]]
- [[_COMMUNITY_dashboard  api|dashboard / api]]
- [[_COMMUNITY_domain  categorytests|domain / categorytests]]
- [[_COMMUNITY_frontend  tsconfig|frontend / tsconfig]]
- [[_COMMUNITY_layout  header|layout / header]]
- [[_COMMUNITY_scripts  verify|scripts / verify]]
- [[_COMMUNITY_ui  badge|ui / badge]]
- [[_COMMUNITY_unit  apiclient|unit / apiclient]]
- [[_COMMUNITY_unit  loginpage|unit / loginpage]]
- [[_COMMUNITY_unit  registerpage|unit / registerpage]]
- [[_COMMUNITY_github  skills|github / skills]]
- [[_COMMUNITY_exports  api|exports / api]]
- [[_COMMUNITY_ui  input|ui / input]]
- [[_COMMUNITY_ui  label|ui / label]]
- [[_COMMUNITY_ui  skeleton|ui / skeleton]]

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

## Communities (85 total, 22 thin omitted)

### Community 0 - "api / transactionsEndpoint Tests"
Cohesion: 0.05
Nodes (18): AuthEndpointsTests, CategoriesEndpointsTests, DashboardEndpointsTests, TransactionsEndpointsTests, AuthServiceTests, CategoryServiceTests, DashboardServiceTests, DateTimeOffset (+10 more)

### Community 1 - "backend / tests"
Cohesion: 0.05
Nodes (38): BCrypt.Net-Next (4.2.0), Microsoft.EntityFrameworkCore.Design (10.0.0), Microsoft.NET.Sdk, Microsoft.NET.Sdk, BCrypt.Net-Next (4.2.0), Microsoft.EntityFrameworkCore (10.0.0), Microsoft.EntityFrameworkCore.Design (10.0.0), Microsoft.NET.Sdk (+30 more)

### Community 2 - "transactions / api"
Cohesion: 0.05
Nodes (24): categoryKeys, useCategories(), useCreateCategory(), useDeleteCategory(), useUpdateCategory(), CategoryFormDialog(), CategoryFormDialogProps, CategoryFormInput (+16 more)

### Community 3 - "exports / exportServicetests"
Cohesion: 0.13
Nodes (5): ExportServiceTests, InlineData, Theory, TransactionAmountParserTests, MonthlyTotalDto

### Community 4 - "persistence / testdbcontextfactory"
Cohesion: 0.06
Nodes (18): bool, DbContext, IAsyncLifetime, IDisposable, IServiceScope, IServiceScopeFactory, ExpenseTracker.Infrastructure.Migrations, InitialCreate (+10 more)

### Community 5 - "Controllers// authController"
Cohesion: 0.11
Nodes (11): AllowAnonymous, AuthService, IAuthService, Authorize, AuthController, HttpPost, IConfiguration, AuthResponse (+3 more)

### Community 6 - "hooks / uselogout"
Cohesion: 0.07
Nodes (20): AuthContext, AuthContextValue, useAuth(), Harness(), mockLogout, mockNavigate, useLogout(), UseLogoutResult (+12 more)

### Community 7 - "abstractions / iuserRepository"
Cohesion: 0.09
Nodes (10): IUserRepository, CategoryConfiguration, RefreshTokenConfiguration, TransactionConfiguration, UserConfiguration, User, EntityTypeBuilder, IEntityTypeConfiguration (+2 more)

### Community 8 - "persistence / categoryRepository"
Cohesion: 0.09
Nodes (6): ICategoryRepository, IPasswordHasher, Category, int, CategoryRepository, BCryptPasswordHasher

### Community 9 - "Services / refreshtokenService"
Cohesion: 0.10
Nodes (10): IJwtTokenService, IRefreshTokenService, JwtSettings, RefreshTokenSettings, RefreshToken, JwtTokenResult, PlaintextToken, JwtTokenService (+2 more)

### Community 10 - "abstractions / itransactionRepository"
Cohesion: 0.10
Nodes (12): ITransactionRepository, AbstractValidator, decimal, Transaction, Items, TransactionRepository, TotalCount, CreateCategoryRequestValidator (+4 more)

### Community 11 - "frontend / package"
Cohesion: 0.07
Nodes (28): devDependencies, autoprefixer, dotenv, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+20 more)

### Community 12 - "Controllers// categoriesController"
Cohesion: 0.13
Nodes (8): CategoryService, ICategoryService, CategoriesController, HttpDelete, HttpPut, CategoryDto, CreateCategoryRequest, UpdateCategoryRequest

### Community 13 - "transactions / transactionService"
Cohesion: 0.14
Nodes (11): ITransactionService, TransactionService, AccessTokenDto, CategoryTotalDto, CreateTransactionRequest, CurrentMonthDto, PagedResult, ProblemDetails (+3 more)

### Community 15 - "dashboard / idashboardRepository"
Cohesion: 0.17
Nodes (10): AggregateByCategoryAndMonth, CategoryAggregate, CurrentMonthTotals, IDashboardRepository, Guid, IReadOnlyList, MonthlyAggregate, DashboardRepository (+2 more)

### Community 16 - "components / transactionspage"
Cohesion: 0.09
Nodes (7): categories, handlers, harvestItems(), { mockDownloadTransactionsCsv, mockDownloadSummaryCsv }, sampleTransactions, Select(), server

### Community 17 - "frontend / tsconfig"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly, ignoreDeprecations, jsx, lib, module (+14 more)

### Community 18 - "frontend / components"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 19 - "ui / select"
Cohesion: 0.15
Nodes (18): cn(), Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle() (+10 more)

### Community 20 - "properties / launchsettings"
Cohesion: 0.10
Nodes (21): ASPNETCORE_ENVIRONMENT, applicationUrl, commandName, dotnetRunMessages, environmentVariables, launchBrowser, launchUrl, commandName (+13 more)

### Community 21 - "frontend / package"
Cohesion: 0.10
Nodes (21): dependencies, axios, @base-ui/react, class-variance-authority, clsx, date-fns, @hookform/resolvers, lucide-react (+13 more)

### Community 22 - "middleware / globalexceptionmiddleware"
Cohesion: 0.12
Nodes (11): Exception, DomainException, DomainValidationException, ForbiddenException, NotFoundException, RefreshTokenValidationException, HttpContext, HttpStatusCode (+3 more)

### Community 23 - "exports / exportService"
Cohesion: 0.16
Nodes (6): DateOnly, ExportService, IExportService, MemoryStream, T, TransactionFilter

### Community 24 - "components / transactionformdialog"
Cohesion: 0.11
Nodes (7): categories, createSpy, harvestItems(), sampleEditingTransaction, Select(), server, updateSpy

### Community 25 - "Controllers// exportsController"
Cohesion: 0.17
Nodes (8): ICurrentUserService, ControllerBase, DashboardController, ExportsController, HttpGet, IActionResult, IHttpContextAccessor, CurrentUserService

### Community 26 - "frontend / tsconfig"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 27 - "components / categoriespage"
Cohesion: 0.12
Nodes (5): handlers, server, systemExpenseCategories, systemIncomeCategories, userCategories

### Community 28 - "ui / dropdown"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 29 - "dashboard / api"
Cohesion: 0.15
Nodes (8): DashboardFilter, dashboardKeys, useDashboardSummary(), formatTHB(), CHART_COLORS, DashboardPage(), formatMonthLabel(), thaiShortMonths

### Community 30 - "ui / alert"
Cohesion: 0.15
Nodes (9): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogMedia(), AlertDialogOverlay() (+1 more)

### Community 31 - "ui / form"
Cohesion: 0.17
Nodes (9): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+1 more)

### Community 32 - "ui / dialog"
Cohesion: 0.18
Nodes (6): DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle()

### Community 33 - "ui / sheet"
Cohesion: 0.18
Nodes (6): SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle()

### Community 35 - "frontend / package"
Cohesion: 0.20
Nodes (10): scripts, build, dev, format, format:fix, lint, preview, test (+2 more)

### Community 36 - "ui / table"
Cohesion: 0.22
Nodes (8): Table(), TableBody(), TableCaption(), TableCell(), TableFooter(), TableHead(), TableHeader(), TableRow()

### Community 37 - "lib / apiclient"
Cohesion: 0.25
Nodes (3): apiClient, _onRefreshed, _onRefreshFailed

### Community 38 - "components / dashboardpage"
Cohesion: 0.29
Nodes (5): emptyDashboardData, handlers, mockDashboardData, { mockDownloadTransactionsCsv, mockDownloadSummaryCsv }, server

### Community 39 - "dashboard / dashboardService"
Cohesion: 0.33
Nodes (3): DashboardService, IDashboardService, DashboardSummaryDto

### Community 40 - "frontend / package"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 41 - "migrations / 20260624052221"
Cohesion: 0.33
Nodes (4): Migration, MigrationBuilder, ExpenseTracker.Infrastructure.Migrations, InitialCreate

### Community 42 - "ui / avatar"
Cohesion: 0.29
Nodes (6): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage()

### Community 43 - "exports / api"
Cohesion: 0.67
Nodes (5): buildTransactionsQuery(), downloadSummaryCsv(), downloadTransactionsCsv(), extractFilename(), triggerDownload()

### Community 44 - "ui / button"
Cohesion: 0.40
Nodes (4): Button(), buttonVariants, Calendar(), CalendarDayButton()

### Community 45 - "layout / sidebar"
Cohesion: 0.40
Nodes (4): NAV_ITEMS, NavItem, Sidebar(), SidebarProps

### Community 47 - "docker / install"
Cohesion: 0.67
Nodes (3): install-docker-ce-wsl.sh script, DEBIAN_FRONTEND, log()

## Knowledge Gaps
- **252 isolated node(s):** `idea-refine.sh script`, `BCrypt.Net-Next (4.2.0)`, `FluentValidation.AspNetCore (11.3.1)`, `Microsoft.AspNetCore.Authentication.JwtBearer (10.0.0)`, `Microsoft.EntityFrameworkCore.Design (10.0.0)` (+247 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ExpenseTrackerDbContext` connect `persistence / testdbcontextfactory` to `abstractions / iuserRepository`, `persistence / categoryRepository`, `Services / refreshtokenService`, `abstractions / itransactionRepository`, `dashboard / idashboardRepository`, `Controllers// exportsController`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `AuthServiceTests` connect `api / transactionsEndpoint Tests` to `Controllers// authController`, `abstractions / iuserRepository`, `persistence / categoryRepository`, `Services / refreshtokenService`, `dashboard / idashboardRepository`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `cn()` connect `ui / select` to `ui / dialog`, `ui / input`, `ui / label`, `ui / sheet`, `ui / skeleton`, `ui / table`, `ui / avatar`, `ui / button`, `layout / sidebar`, `common / loadingspinner`, `common / emptystate`, `common / errorstate`, `ui / badge`, `ui / dropdown`, `dashboard / api`, `ui / alert`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Are the 73 inferred relationships involving `cn()` (e.g. with `EmptyState()` and `ErrorState()`) actually correct?**
  _`cn()` has 73 INFERRED edges - model-reasoned connections that need verification._
- **What connects `idea-refine.sh script`, `BCrypt.Net-Next (4.2.0)`, `FluentValidation.AspNetCore (11.3.1)` to the rest of the system?**
  _252 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api / transactionsEndpoint Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.05009578544061303 - nodes in this community are weakly interconnected._
- **Should `backend / tests` be split into smaller, more focused modules?**
  _Cohesion score 0.05087881591119334 - nodes in this community are weakly interconnected._