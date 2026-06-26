# ADR-0001: Adopt Clean Architecture (Onion) for Backend Layers

## Status

Accepted

## Date

2026-06-23

## Context

Expense Tracker is a multi-user web application with a .NET 10 Web API backend and a React frontend. We need a backend layering strategy that:

- Keeps domain logic free of infrastructure concerns (EF Core, JWT, HTTP)
- Enables unit testing of business logic without spinning up a database or web server
- Scales to ~4 service modules (Auth, Categories, Transactions, Dashboard/Exports) without becoming unwieldy
- Matches the team's familiarity with ASP.NET conventions while avoiding the "fat controller" anti-pattern

We considered three approaches:

1. **N-tier / layered monolith** — all services live in one project; controllers call services directly
2. **Clean Architecture (Onion / Hexagonal)** — concentric layers with strict dependency direction
3. **Vertical Slice Architecture** — each feature is a self-contained slice across all layers

## Decision

Adopt a **light Clean Architecture** with four projects:

```
Domain (innermost)
  ↑
Application
  ↑
Infrastructure
  ↑
Api (outermost)
```

| Layer | Project | Responsibilities |
|---|---|---|
| **Domain** | `ExpenseTracker.Domain` | Entities, enums, value-object-like constructors, domain exceptions. Zero NuGet dependencies. |
| **Application** | `ExpenseTracker.Application` | Service interfaces (`IAuthService`, `ICategoryService`, …), repository interfaces, DTOs, FluentValidation validators, business orchestration. References only Domain. |
| **Infrastructure** | `ExpenseTracker.Infrastructure` | `ExpenseTrackerDbContext`, EF Core configurations, migrations, repository implementations, JWT/BCrypt services. References Application (and transitively Domain). |
| **Api** | `ExpenseTracker.Api` | Controllers, middleware, `Program.cs` (DI composition root), Swagger. References Application + Infrastructure. |

### Key rules

- **Dependency arrows point inward only.** Application never references Infrastructure; Domain references nothing.
- **Interfaces live in Application; implementations live in Infrastructure.** This is dependency inversion, not just layering.
- No generic `Repository<T>` base class — each repository is standalone (Category, Transaction, Dashboard) to keep queries explicit.
- Entity constructors validate invariants; no public setters.

## Alternatives Considered

### N-tier / layered monolith

- **Pros**: Simple, familiar, fewer projects
- **Cons**: Tends toward fat controllers, hard to test domain logic in isolation, infrastructure leaks into business code
- **Rejected**: This is the default anti-pattern we are avoiding. Without the Application/Infrastructure split, services inevitably accumulate EF Core dependencies.

### Vertical Slice Architecture

- **Pros**: Each feature is fully self-contained, excellent for large teams working in parallel
- **Cons**: Overhead for a 4-service app; duplication of infrastructure wiring per slice; harder to enforce cross-cutting concerns (global query filters, error handling)
- **Rejected**: The project's domain surface is small enough (4 entities, ~18 endpoints) that vertical slices would create unnecessary complexity. Clean Architecture provides enough separation.

## Consequences

- **Testability**: Unit tests for Domain and Application layers run in-memory with no database. Integration tests use `WebApplicationFactory` + Testcontainers.
- **Onboarding**: The 4-layer pattern is widely documented and understood by .NET developers.
- **DI wiring**: All composition happens in `Api/Program.cs` — a single file to audit for registration correctness.
- **Trade-off**: Slight overhead from interface + implementation pairs. For a project of this size, the overhead is acceptable and pays for itself in testability.
- **Migration path**: If the project grows significantly, slices can be introduced within the Application layer (feature folders) without changing the outer structure.
