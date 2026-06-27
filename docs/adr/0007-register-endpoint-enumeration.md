# ADR-0007: Accept Register Endpoint Enumeration Trade-Off (v1)

## Status

Accepted

## Date

2026-06-27

## Context

`POST /api/auth/register` reveals whether a given email is already registered:

- **Current behavior** (see `AuthService.RegisterAsync`): the service calls
  `IUserRepository.ExistsByEmailAsync(request.Email)`. If the email exists it
  throws `DomainValidationException("A user with email '<email>' already exists.")`,
  which `GlobalExceptionMiddleware` maps to **HTTP 400** with a problem+json
  body containing that message. The message is also reflected to the client
  verbatim, so the client can distinguish:

  - "this email is available" → 200 OK
  - "this email is taken" → 400 with the literal phrase `already exists`

- **Threat model**: An attacker can submit a list of candidate emails to
  `/api/auth/register` and learn which ones already have accounts on
  Expense Tracker. This is a classic **user enumeration** vector.

- **Why it's tempting to fix now**: OWASP and most auth guidance recommends
  returning an identical response (200 + "we have sent you a confirmation
  email" message) whether or not the email is registered, then sending the
  email to confirm the account. The email itself becomes the enumeration
  oracle for the legitimate user, but bots are rate-limited and out-of-band
  delivery is harder to scale.

- **Why we are NOT fixing it for v1**: The Expense Tracker product is, in
  this iteration, a **personal finance app used by a small number of
  trusted users** (the project is the developer's own tool, not a
  multi-tenant SaaS). The realistic attacker is:

  1. A casual snooper who already knows the target's email (most registration
     forms are not the primary attack surface for account discovery — leaked
     data breaches are).
  2. A bot doing large-scale email validation. This is already dampened by
     the 5 req/min/IP rate limit on `/api/auth/*` (see
     `Program.cs` rate-limiter config) and by the cost of actually proving
     the email belongs to *this* application (the bot would need to know
     we use Expense Tracker at all).

  The cost of the proper fix — adding an email-confirmation flow, an
  outbound email provider, an email-queue background job, an unverified
  account state, and a "did you mean to register or recover?" UX — is
  substantial, and the threat it addresses is low for v1.

## Decision

For v1, we **accept the register endpoint enumeration trade-off**. The
endpoint behaves as documented (duplicate email → 400 with a clear message)
and we do not invest in a send-email-on-register pattern now.

Specifically:

1. `POST /api/auth/register` will continue to return **400** (via
   `DomainValidationException`) on a duplicate email, with the message
   `A user with email '<email>' already exists.`
2. `docs/api-contract.md` lists the **400** status — not 409 — under the
   "Errors" table for `POST /api/auth/register`. (Note: a prior version of
   that table listed 409; this ADR is the source of truth and the
   api-contract file should match this decision.)
3. The 5 req/min/IP rate limit on `/api/auth/*` remains the primary
   bulk-enumeration mitigation.

## Consequences

### Positive

- No new infrastructure (no email provider, no queue, no background worker).
- No unverified-account state machine to design or test.
- UX remains simple: a successful register response contains the access
  token and refresh cookie. A duplicate-email response is unambiguous, which
  helps legitimate users who typed their email slightly wrong.
- The decision is reversible — if the product scope changes (multi-tenant
  SaaS, public launch, any case where the attacker capability grows), we
  revisit this ADR.

### Negative

- The endpoint is a confirmed user-enumeration vector. We must be honest
  about this in our threat model and in any user-facing security disclosure.
- A future maintainer reading `api-contract.md` may "fix" the 400 → 409
  change without realizing it is part of this trade-off. This ADR is the
  pointer: the comment in `api-contract.md` will reference it.

### Neutral

- The 5 req/min rate limit is enough to slow but not stop a determined
  attacker. If the threat grows, the rate limit can be lowered, but at the
  cost of legitimate users on shared NATs (e.g. office networks).

## Alternatives Considered

### Return identical 200 responses and send an email either way

- **Pros**: Industry standard. Eliminates enumeration as a public endpoint
  behavior. The email channel becomes the oracle, which has its own rate
  limits and costs money for the attacker.
- **Cons**: Requires an outbound email provider, a queue, a background
  worker, an unverified-account state, a "confirm your email" UI page, and
  a "did you mean to log in?" UX. The scope is too large for v1.
- **Rejected**: Out of scope for v1. Revisit if the product leaves the
  personal-finance scope.

### Return 409 (Conflict) on duplicate email, but still include the message

- **Pros**: More semantically correct than 400.
- **Cons**: Does not change the enumeration vector at all — the message body
  still tells the attacker the email exists. The code change is small but
  the security benefit is zero.
- **Rejected**: Would mislead readers of `api-contract.md` into thinking
  the enumeration trade-off was considered. The 400 response matches the
  current implementation; we will not pretend to have closed the
  enumeration vector.

### Use a CAPTCHA on `/api/auth/register`

- **Pros**: Cheap. Blocks naive bots.
- **Cons**: Hurts UX, only blocks the most basic automation, and is a UX
  tax on legitimate users. Real attackers will use CAPTCHA farms.
- **Rejected**: Not a substitute for proper out-of-band verification, and
  not worth the UX cost on its own.

### Hash the email before checking, then check the hash

- **Pros**: Looks clever, but...
- **Cons**: ...the API still tells the caller the email was found
  (just with a different status code or message). The only way to hide
  that is to return the same response shape either way, which is just the
  first alternative.
- **Rejected**: Does not actually solve the problem.

## Follow-Up

- If the product scope expands beyond personal finance, re-open this ADR
  and migrate to the send-email-on-register pattern.
- If we add a "forgot password" endpoint later, we should apply the same
  decision process (currently the Login endpoint already has the same
  enumeration profile — `Invalid credentials.` is used for both wrong-email
  and wrong-password, which is the correct behavior).
- When the rate limit on `/api/auth/*` is reviewed, check the
  `/api/auth/register` path specifically to make sure the 5 req/min budget
  is still appropriate for the threat model.
