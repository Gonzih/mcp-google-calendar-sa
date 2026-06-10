# PLAN: @gonzih/mcp-google-calendar-sa

## Task Understanding
Build a minimal TypeScript MCP server that authenticates to Google Calendar using a service account JSON key and exposes 5 tools: create-event, list-events, get-event, delete-event, update-event. Package as `@gonzih/mcp-google-calendar-sa` on npm.

## Approaches Considered

### Approach 1: Single-file index.ts with inline everything (CHOSEN)
- All logic in `src/index.ts`
- Minimal dependencies: `@modelcontextprotocol/sdk`, `googleapis`
- Simple, easy to audit, low maintenance
- Trade-off: less modular, but this is a minimal tool

### Approach 2: Separate modules per tool
- `src/tools/create-event.ts`, etc.
- More structured, easier to extend
- Overkill for 5 small tools

### Approach 3: Use google-auth-library directly
- Skip googleapis wrapper
- More control but more boilerplate
- Not needed since googleapis handles SA auth well

## Chosen Approach: Approach 1
Single-file implementation using `@modelcontextprotocol/sdk` stdio transport and `googleapis` for Calendar API with GoogleAuth service account credentials.

## Files to Touch
- `package.json` — new
- `tsconfig.json` — new
- `src/index.ts` — main implementation
- `__tests__/index.test.ts` — smoke test (mock-based)

## Risks & Unknowns
- `@modelcontextprotocol/sdk` API may have changed — check latest version
- `googleapis` v144+ API for Calendar — verify method signatures
- npm publish access — need to be logged in as gonzih
- MCP stdio protocol init handshake format for smoke test
