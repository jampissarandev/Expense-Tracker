# ADR-0005: Use Docker Compose for Local PostgreSQL Development

## Status

Accepted

## Date

2026-06-23

## Context

Expense Tracker uses PostgreSQL as its primary database. For local development, we need a PostgreSQL instance that:

- Starts quickly and reliably for new contributors
- Does not require installing PostgreSQL system-wide on the developer's machine
- Is reproducible across environments (Windows, macOS, Linux, WSL2)
- Supports health checks to coordinate with dependent services (EF Core migrations, API startup)
- Has a clean teardown path (no leftover data between development sessions)

We considered multiple approaches for providing a local database during development.

## Decision

Use a **Docker Compose file** (`docker/postgres.yml`) that runs PostgreSQL 16 in a container with:

- Named volume (`postgres_data`) for persistence across restarts
- Health check via `pg_isready` (5s interval, 5 retries, 10s start period)
- Simple credentials (`expense`/`expense`) for local development only
- Port mapping `5432:5432`

### Makefile targets

| Target | Command | Purpose |
|---|---|---|
| `make db-up` | `docker compose -f docker/postgres.yml up -d` | Start Postgres (detached) |
| `make db-down` | `docker compose -f docker/postgres.yml down` | Stop Postgres |
| `make db-reset` | `down` → `docker volume rm` → `up -d` | Clean slate (re-seeds on next migration) |
| `make db-wsl-ip` | `wsl hostname -I` | Detect WSL2 IP for portproxy |
| `make db-portproxy` | `netsh interface portproxy` | Forward localhost:5432 → WSL2:5432 |

### Connection string (default dev)

```
Host=localhost;Port=5432;Database=expensetracker;Username=expense;Password=expense
```

Configured in `appsettings.Development.json` and overridable via `ConnectionStrings__DefaultConnection` environment variable.

### WSL2 networking workaround

On Windows 11 with WSL2, `localhost:5432` from a Windows process cannot reach WSL2's Docker daemon. The `make db-portproxy` target uses `netsh interface portproxy` to bridge this gap with an admin-level port forward.

## Alternatives Considered

### Install PostgreSQL system-wide

- **Pros**: No Docker dependency, native performance
- **Cons**: Requires manual installation per OS, version conflicts with other projects, difficult to tear down cleanly, contributor onboarding friction
- **Rejected**: Every contributor would need to install and configure PostgreSQL manually. Docker Compose eliminates this.

### SQLite for local development

- **Pros**: Zero setup, embedded, fast
- **Cons**: Different SQL dialect (no `pg_isready`, different type system), no global query filter testing with PostgreSQL-specific features (partial indexes), schema drift between dev and production
- **Rejected**: SQLite is not PostgreSQL. Features like partial unique indexes (`WHERE UserId IS NOT NULL`) are PostgreSQL-specific and would not be tested locally.

### Testcontainers for local dev (same as CI)

- **Pros**: Identical to CI environment, ephemeral
- **Cons**: Requires Docker (same as Compose), but adds complexity of Testcontainers lifecycle management for local development. Testcontainers is designed for test code, not long-running development servers.
- **Rejected**: Testcontainers is the right tool for integration tests (`ExpenseTracker.IntegrationTests`), but overkill for a development database that needs to persist across multiple `dotnet run` sessions.

### Cloud-hosted database (e.g., Neon, Supabase free tier)

- **Pros**: No local Docker needed
- **Cons**: Requires internet, adds latency, introduces external dependency, potential cost at scale, privacy concerns with financial data in a third-party cloud during development
- **Rejected**: A local database is simpler and avoids external dependencies during development. Cloud hosting can be added for staging/production later.

## Consequences

- **Onboarding**: New contributors run `make db-up` and have a working Postgres in seconds. No database installation required.
- **Reproducibility**: The same `postgres.yml` file is used by all developers. The health check ensures the database is ready before migrations run.
- **Clean state**: `make db-reset` removes the volume and re-creates the database from scratch. Useful for testing migrations from a clean state.
- **WSL2 caveat**: Windows developers using WSL2 for Docker need the portproxy workaround. This is documented in the README and automated via `make db-portproxy`.
- **CI parity**: Integration tests use Testcontainers (ephemeral Postgres) which mirrors the Docker-based local setup. The same PostgreSQL 16 image is used in both contexts.
- **Trade-off**: Docker is a required dependency for all contributors. This is acceptable for a modern .NET + React development workflow.
