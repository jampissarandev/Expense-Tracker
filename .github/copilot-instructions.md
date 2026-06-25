# Project Coding Standards



## Testing

- Write tests before code (TDD)

- For bugs: write a failing test first, then fix (Prove-It pattern)

- Test hierarchy: unit > integration > e2e (use the lowest level that captures the behavior)

- Run `npm test` after every change



## Code Quality

- Review across five axes: correctness, readability, architecture, security, performance

- Every PR must pass: lint, type check, tests, build

- No secrets in code or version control



## Implementation

- Build in small, verifiable increments

- Each increment: implement → test → verify → commit

- Never mix formatting changes with behavior changes



## Boundaries

- Always: Run tests before commits, validate user input

- Ask first: Database schema changes, new dependencies

- Never: Commit secrets, remove failing tests, skip verification

## graphify

For any question about this repo's architecture, structure, components, or how to add/modify/find
code, your first action should be `graphify query "<question>"` when `graphify-out/graph.json`
exists. Use `graphify path "<A>" "<B>"` for relationship questions and `graphify explain "<concept>"`
for focused-concept questions. These return a scoped subgraph, usually much smaller than the full
report or raw grep output.

Triggers: "how do I…", "where is…", "what does … do", "add/modify a <component>",
"explain the architecture", or anything that depends on how files or classes relate.

If `graphify-out/wiki/index.md` exists, use it for broad navigation. Read `graphify-out/GRAPH_REPORT.md`
only for broad architecture review or when query/path/explain do not surface enough context. Only read
source files when (a) modifying/debugging specific code, (b) the graph lacks the needed detail, or
(c) the graph is missing or stale.

Type `/graphify` in Copilot Chat to build or update the graph.
