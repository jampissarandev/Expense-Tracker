# ADR-0003: Use EF Core as Primary Data Access (Code-First Migrations)

## Status

Accepted

## Date

2026-06-23

## Context

We need to select a data access strategy for the PostgreSQL database. The application has:

- 4 entities with relationships (User → RefreshTokens cascade, Transaction → Category restrict, Category → User nullable)
- Complex queries: pagination with filters, aggregation for dashboard (GROUP BY month, GROUP BY category), partial unique indexes (filtered by `UserId IS NULL` vs `UserId IS NOT NULL`)
- A critical security requirement: **multi-user data isolation** via global query filters
- Code-first migration management (schema evolves with the application)
- 10+ migrations expected over the project lifecycle

## Decision

Use **Entity Framework Core** with the Npgsql PostgreSQL provider:

- **ORM**: EF Core 10.x + `Npgsql.EntityFrameworkCore.PostgreSQL`
- **Migrations**: Code-first (`dotnet ef migrations add`)
- **Configuration**: Fluent API (`IEntityTypeConfiguration<T>`) for all entities
- **Query patterns**: Global query filters for user isolation, `AsNoTracking()` for read-heavy queries, LINQ composition for filters/pagination

### Why EF Core specifically

1. **Global query filters** — the `ICurrentUserService.UserId` is injected into the `DbContext` constructor, and query filters on `Category` and `Transaction` automatically restrict all queries to the current user. This is a **compile-time-checked, always-on** security boundary that Dapper cannot provide.

2. **Code-first migrations** — schema changes are versioned and replayable. The `dotnet ef` tooling integrates with CI and Testcontainers for automated migration testing.

3. **Entity configuration in code** — PostgreSQL-specific features like partial unique indexes (`UNIQUE (UserId, Name, Type) WHERE UserId IS NOT NULL`) are expressible via Fluent API and applied consistently.

4. **Change tracking** — simplifies update patterns: attach entity, set properties, call `SaveChangesAsync()`.

5. **LINQ query composition** — repositories build queries dynamically (`Where`, `OrderBy`, `Skip`, `Take`) with compile-time type safety.

## Alternatives Considered

### Dapper (micro-ORM)

- **Pros**: Fast, minimal overhead, full SQL control, lighter dependency
- **Cons**: No global query filters (must add `WHERE UserId = @userId` to every query manually), no change tracking, no migration tooling, hand-written SQL is error-prone for complex joins/aggregations
- **Rejected**: The absence of global query filters is a dealbreaker for multi-user data isolation. Every query would need manual user-filtering, and a single missed filter is a security vulnerability. The maintenance burden of hand-written SQL migrations is also higher.

### Raw ADO.NET / Npgsql direct

- **Pros**: Maximum performance, full control
- **Cons**: All the downsides of Dapper plus manual connection management, manual mapping, no migration tooling
- **Rejected**: Far too low-level for a CRUD-heavy application. The productivity loss is not justified by performance gains that are irrelevant at this scale.

### Npgsql Entity Framework 6 (EF6) / legacy

- **Pros**: Mature, well-documented
- **Cons**: Tightly coupled to ASP.NET, no global query filters, no lightweight hosting, not designed for .NET 10
- **Rejected**: EF Core is the modern successor with all the features we need.

### Database-first with EF Core (`dotnet ef dbcontext scaffold`)

- **Pros**: Starting from an existing schema
- **Cons**: Our schema evolves with the application (code-first is more natural); scaffolded code lacks global query filters and entity behavior methods
- **Rejected**: Code-first is the natural fit for a project where the schema is defined by the application.

## Consequences

- **Data isolation**: Global query filters provide an automatic, always-on security boundary. Every query to `Category` and `Transaction` is filtered by `UserId` — no repository method can accidentally omit it.
- **Migration safety**: Integration tests in `ExpenseTracker.IntegrationTests` verify that migrations apply cleanly to a fresh Testcontainers Postgres database. This catches schema drift before deployment.
- **Performance**: EF Core's query compilation is a one-time cost per query shape. For a CRUD app with < 100 concurrent users, this is negligible. `AsNoTracking()` is used for read-heavy paths (dashboard, transaction list).
- **Query flexibility**: Dashboard aggregations (GROUP BY, SUM, COUNT) use raw SQL via `FromSqlRaw` where LINQ is awkward, giving us the best of both worlds.
- **Testing**: Unit tests for Application services mock the repository interfaces. Integration tests use `WebApplicationFactory` + real Postgres via Testcontainers.
- **Trade-off**: EF Core adds a heavier dependency than Dapper, but the global query filter feature alone justifies the choice for a multi-user financial application.
