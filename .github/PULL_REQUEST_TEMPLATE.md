<!--
Thanks for the PR! Please fill in the sections below. The "Threat model" checkbox
is the most important one — see docs/adr/0009-threat-model.md for why.
-->

## What & Why

<!-- One short paragraph: what does this change, and why? -->

## How to verify

<!-- Concrete steps a reviewer can run. Examples:
  - `dotnet test`
  - `cd frontend && npm test`
  - `curl -I http://localhost:5117/api/health`
  - "screenshot of the dashboard before/after"
-->

## Checklist

- [ ] Tests added or updated (TDD for behavior changes; see `.github/copilot-instructions.md`)
- [ ] `dotnet test` green (UnitTests + IntegrationTests)
- [ ] `dotnet format --verify-no-changes` clean
- [ ] `npm test` + `npm run lint` + `npm run typecheck` green (if frontend touched)
- [ ] Docs updated if behavior changed: `docs/SPEC.md`, `docs/api-contract.md`, or the relevant ADR
- [ ] No secrets, no debug `Console.WriteLine`, no drive-by formatting
- [ ] One concern per commit, ≤100 LOC per fix (multi-fix PRs justified in the description)
- [ ] **Threat model reviewed** — read [ADR-0009: Threat-Model Baseline](docs/adr/0009-threat-model.md) and confirm one of:

  - [ ] No new endpoint, no new trust boundary, no new data classification → no change to the baseline needed
  - [ ] New endpoint(s) added → the endpoint-inventory table in ADR-0009 has been updated (Authorization rule, Data classification, STRIDE notes, Test refs columns)
  - [ ] New trust boundary (file upload, webhook, third-party API call, user-supplied URL, etc.) → a new B# row was added to ADR-0009 with a STRIDE pass
  - [ ] New security finding or control → it has been added to the audit finding list (`docs/plans/security-hardening.md` §"Risk-prioritized fix list") with the next R-number

  > If you can't fill the Authorization column, you have **A01: Broken Access Control** (OWASP). Stop and figure out who is allowed to call this endpoint.

## Linked issues / ADRs / audit findings

<!-- Examples:
  Closes: R7 / Phase B1
  See also: ADR-0009
  Related: #123
-->
