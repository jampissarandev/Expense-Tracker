# EF Core CLI gotchas (verified 2026-06-26)

## Two distinct bugs, one root cause class

When `dotnet ef database update` fails in CI, the symptom can be a
red-herring "Could not load Microsoft.EntityFrameworkCore.Design
Version=X.0.0.0" error that is **actually caused by `-c Release` being
misinterpreted as `--environment`**, not by a version mismatch.

### Gotcha 1: `-c` flag means different things across subcommands

For `dotnet ef`:

| Subcommand              | `-c` short flag means | Long form               |
|-------------------------|-----------------------|-------------------------|
| `migrations add`        | `--configuration`     | `--configuration`       |
| `migrations script`     | `--configuration`     | `--configuration`       |
| `database update`       | **`--environment`**   | **`--environment`**     |

`database update -c Release` makes EF Core look for a DbContext whose
**name** is `Release` and fail with:

```
No DbContext named 'Release' was found.
```

Fix: use `--configuration Release` (spelled out) on `database update`.

### Gotcha 2: Wildcard tool version resolves to lowest

`dotnet tool install --global dotnet-ef --version 10.*` resolves to
the **lowest** 10.0.x (10.0.0 in practice), which then cannot load
the 10.0.9 EF Core assemblies restored by `dotnet restore`.

Fix: pin the tool to the exact version the csproj files reference:

```
dotnet tool install --global dotnet-ef --version 10.0.9
```

### Diagnostic trail for "Could not load assembly" errors

If the error mentions `Microsoft.EntityFrameworkCore.Design` or
`Microsoft.EntityFrameworkCore` with `Version=X.0.0.0`, first
**check whether `-c` is being used on a subcommand where it means
`--environment`**. Only after that, suspect a tool version
mismatch. The two interact: a mis-`-c` can leave a stale build
output on disk, which then produces the "Could not load assembly"
message that looks like a version problem but isn't.

### See also

- `p5-1-playwright-complete.md` — local e2e setup
- `p5-2-*.md` (this dir) — CI wiring
