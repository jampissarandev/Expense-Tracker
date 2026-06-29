# ADR-0008: No Application-Level Encryption of PII at Rest

## Status

Accepted

## Date

2026-06-29

## Context

Expense Tracker is a multi-user personal-finance application backed by a single PostgreSQL 16 instance. The application schema persists the following PII (personally identifying information) and credential material in the `users` and `refresh_tokens` tables:

| Field | Table | Current encoding | Reason for the encoding |
|---|---|---|---|
| `Email` | `users` | Plaintext | Displayed in the UI; used as the login identifier; indexed for the `WHERE email = $1` lookup in `AuthService.LoginAsync`. |
| `DisplayName` | `users` | Plaintext | Free-text profile field; returned to the client. |
| `PasswordHash` | `users` | BCrypt (work factor 12) | One-way hash; the cleartext is never recoverable. |
| `TokenHash` | `refresh_tokens` | SHA-256 of the random plaintext | One-way hash; the cleartext token is in the `et_rt` HttpOnly cookie and is not recoverable from the DB alone. |

The security audit on 2026-06-27 raised the question: "Why isn't `User.Email` encrypted?" This ADR is the citable answer.

The threat model is:

- **Database file disclosure** — an attacker with read access to the Postgres data directory (or a `pg_dump` of the cluster, or a stolen EBS volume / VM disk) reads the rows.
- **Insider read** — a privileged operator with `SELECT` on the `users` table reads the rows.
- **Backup disclosure** — a backup file (logical `pg_dump`, physical base backup) leaves the data center and is read by an attacker.

For each of these, the natural mitigation is *at-rest encryption* of the PII. There are three places it can be applied:

1. **Column-level** — `Email` and `DisplayName` stored as encrypted ciphertext in the DB; the app decrypts on read.
2. **Field-level (application)** — the app encrypts before writing and decrypts after reading; the DB stores ciphertext; keys are managed outside the DB.
3. **Disk-level (infrastructure)** — the entire Postgres data directory is encrypted at the storage layer (AWS RDS encryption, Azure TDE, LUKS on a VM, etc.); the DB and app see plaintext.

## Decision

We **do not** encrypt `Email` or `DisplayName` in the application. The DB stores them as plaintext. The compensating control is **disk-level encryption at the infrastructure layer**, which is a deployment-time requirement:

- The operator must run Postgres on infrastructure that provides at-rest encryption of the storage volume.
- For cloud-managed Postgres (AWS RDS, Azure Database for PostgreSQL, GCP Cloud SQL), this means the "encryption at rest" / "storage encryption" option is **enabled and not optional**.
- For self-hosted Postgres on a VM, the underlying volume (EBS, Persistent Disk, LUKS-encrypted partition) must be encrypted.
- For local development (Docker Compose via `make db-up`), encryption is not required because the data is throwaway and the dev machine's disk is the developer's responsibility.

The single Postgres instance is treated as a **trust boundary**: anyone with read access to the DB can read the plaintext PII. This is documented in `docs/SPEC.md` §"Data at rest" (added by this ADR) and in `README.md` §"Security" so that an operator who skips disk encryption is making a visible, traceable choice.

### What is *already* protected (and not affected by this ADR)

- `PasswordHash` is BCrypt(work-factor 12) — already one-way, no encryption needed.
- `TokenHash` is SHA-256 of the cookie plaintext — already one-way, no encryption needed.
- `Email` and `DisplayName` PII are only ever readable by someone who already has access to the `users` table.

### What this ADR does *not* change

- **Logs**: the structured `SecurityEvents` logger already stores `EmailHash` (first 16 hex chars of SHA-256, normalized) rather than the raw email. See `docs/SPEC.md` §"Security Events". This decision predates the audit and stands.
- **Network in transit**: TLS termination at the reverse proxy / load balancer (see `docs/SPEC.md` §"Deployment") handles encryption between the app and the DB's wire protocol.
- **Backups**: backup files inherit the disk-encryption property of whatever volume they are stored on. Backups to a separate unencrypted destination (e.g., S3 without SSE) are a deployment misconfiguration and out of scope for this ADR.

## Consequences

### Positive

- **Query simplicity**: `WHERE email = $1` and `ORDER BY email` work with normal B-tree indexes. No deterministic-encryption trap (see Alternatives Considered), no per-row key derivation, no schema changes.
- **No key-management surface**: there is no KMS, no key-rotation job, no key-loss recovery procedure. Operators don't need to integrate a vault.
- **Migrations stay simple**: no encrypted column to add, no `pgcrypto` extension, no schema-bloat from `bytea` ciphertext alongside plaintext indices.
- **Backup, replication, logical decoding, and `psql` access all work unchanged.** Operators can `pg_dump` a production database to investigate a bug without a separate decryption step.

### Negative

- **DB file == PII.** Anyone who can read the Postgres data directory — directly, via a stolen backup, via a snapshot, or via a compromised `psql` session — can read every user's email and display name in plaintext. Disk-level encryption is the **only** thing that mitigates a stolen-volume attack.
- **Single-tenant assumption baked in.** A future migration to multi-tenant SaaS (where one Postgres instance serves multiple companies) will likely need per-tenant encryption keys. That day, this ADR is revisited and most likely superseded.
- **A misconfigured deployment that omits disk encryption has no application-level safety net.** This is the failure mode the operator must understand.

### Neutral

- The decision is **explicitly** about `Email` and `DisplayName`. `PasswordHash` and `TokenHash` are already one-way hashed and are out of scope.
- Disk-encryption is a deployment concern, not a code concern. The application cannot detect whether the underlying volume is encrypted; the operator's runbook must include the check.

## Alternatives Considered

### Column-level encryption (e.g., `pgcrypto` `pgp_sym_encrypt`)

- **Pros**: PII never appears in plaintext on disk, even in a stolen backup. Granular: only the columns we care about are encrypted. No infra change.
- **Cons**:
  - All equality lookups (`WHERE email = $1`) require server-side decryption of every candidate row, or the use of *deterministic* encryption (a fixed IV) — which itself leaks plaintext-equality information and is a known weakness.
  - Indexes on the encrypted column are either useless (random IV) or leak the same information as deterministic encryption.
  - The encryption key still has to live somewhere. Putting it in the same DB is pointless; putting it in the app means we are doing field-level encryption (see below).
  - `pgcrypto` is an extra extension with its own upgrade surface.
- **Rejected**: the query complexity, index loss, and key-storage problem all conspire to push us toward the next alternative anyway.

### Field-level encryption in the application (envelope encryption with a KMS)

- **Pros**: PII encrypted before it ever reaches the DB. The DB sees ciphertext only. Compromise of the DB does not yield plaintext PII without also compromising the KMS.
- **Cons**:
  - We need a key-management service (AWS KMS, Azure Key Vault, HashiCorp Vault, or self-hosted). The project today has **zero** cloud dependencies and the operator runs Postgres in a single container.
  - Key rotation: every rotation requires a re-encryption pass over every row. For v1 with 4 entities and ~4 PII fields, the rotation logic is tractable, but adds a background job to the deployment.
  - **Login is the show-stopper.** `AuthService.LoginAsync` needs to look up the user by email. With application-level encryption, every email in the table is ciphertext, and we cannot run `WHERE email = $1` without either:
    - Decrypting the entire `users` table on every login (unacceptable at scale), or
    - Maintaining a deterministic-encryption sidecar column (defeats the purpose — see above), or
    - Hashing the email server-side and using the hash as a deterministic key (a "blind index"). This works but means the email hash becomes a *searchable* identifier — leaking the same information the encryption was meant to hide, and creating a new database that mirrors the user table.
  - Email-as-login-identifier is a hard requirement (the user types their email to sign in). We cannot move to an opaque user ID for login without a UX change and a separate "email → user ID" lookup, which moves the problem to a different column.
- **Rejected**: the login flow makes this approach much more complex than its threat-model benefit. The threat model we are actually defending against — disk theft — is fully covered by disk-level encryption.

### Disk-level encryption only (chosen)

- **Pros**: Zero application changes. PII on the wire, in RAM, and on the operator's screen is plaintext (as it must be, to be useful). PII on disk, in a snapshot, and in a stolen volume is ciphertext. Backup encryption is a single volume attribute, not per-row logic.
- **Cons**: The DB process itself sees plaintext. A compromised `psql` session reads plaintext. A privileged cloud-operator with IAM access to the volume reads plaintext. These are accepted — they are the threat model of a single-tenant app.
- **Chosen**: it solves the actual threat (disk theft) without paying the cost (KMS, blind index, re-encryption on rotation) the other options impose.

### Move to a managed identity provider (Auth0, Clerk, Cognito, etc.)

- **Pros**: We never see plaintext email or password at all. The IdP holds the PII; we hold opaque user IDs.
- **Cons**: Adds a cloud dependency, monthly cost, and a vendor lock-in that the project does not have today. The project's stated scope is personal finance for a small set of trusted users; bringing in an IdP is over-engineering.
- **Rejected**: deferred to a future ADR if the product scope moves to multi-tenant SaaS.

## Follow-Up

- If the product scope expands beyond personal finance (multi-tenant SaaS, public launch, regulated industry), revisit this ADR. The likely path is to supersede it with a "move identity to a managed IdP" ADR, not to bolt field-level encryption onto the existing schema.
- The deployment runbook (whatever document the operator consults when bringing up a production Postgres) **must** include a step that verifies the storage volume is encrypted. A future enhancement is a `make check-disk-encryption` target that runs `aws rds describe-db-instances --db-instance-identifier ... --query "DBInstances[0].StorageEncrypted"` (or equivalent for the target cloud) and fails the deploy if `false`. Out of scope for this ADR.
- If we ever add a feature that requires a *searchable* secondary identifier (e.g., "find users whose email contains @example.com" for an admin tool), we must not introduce a blind index. Instead, we surface the lookup through the application's own user list endpoint with authorization checks — see ADR-0001's data-isolation rules.
