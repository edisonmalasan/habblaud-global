# Design: multi-harness detection (2026-11-20)

## Intent

Habblaud's original code detects exactly two harnesses (Claude Code config dirs in `server/accounts/detect.ts`, Codex dirs in `server/sources/codex/accounts.ts`). `habblaud-global` plans seven more. Before adapters can be built, the app needs a single, testable answer to "which harnesses are present on this machine?".

## Goals

- Detect all nine harnesses from local signals: config dirs, env vars, explicit dir overrides, executables on PATH.
- Expose the result through the existing HTTP API with a stable shape.
- Never read credentials, tokens, session contents or prompts; no network calls.
- Cover the detector and the HTTP contract with tests written first (Superpowers TDD).

## Non-goals

- No per-harness session/history/activity adapters on `main` — those stay on the seven harness branches.
- No change to the protocol `Provider` union or UI labels.

## Approaches considered

1. **Extend `Provider` to nine values and add a registry entry per harness.**
   Rejected: `Provider` is optional everywhere with "absent = claude" (`shared/types.ts`) and is consumed as a hardcoded union in `shared/world/protocol.ts`, `WORLD_TOOL_ACCOUNTS`, `PROVIDER_NAME` and dozens of binary `=== 'codex'` branches. Seven new values would force a large, risky change across protocol, UI, demo and i18n before any adapter exists.
2. **Reuse only the two existing detectors and hardcode the planned list in docs.**
   Rejected: not actual detection, untestable, and the knowledge would stay scattered.
3. **Chosen: a separate `HarnessId` inventory in `server/harnesses/detect.ts`.**
   A `HarnessDescriptor` registry (id, name, kind, optional `provider`, dirs, env, dirsEnv, bins) drives one pure `detectHarnesses()` function plus `harnessInventory()` for the full list. The real filesystem, env and a real PATH lookup are used in production; tests inject env/executable lookups and use real temporary directories. The API route `GET /api/harnesses` exposes the inventory. Adding an adapter later only requires setting `provider` on its entry and wiring its `AgentSource` in `server/index.ts`.

## Decisions (builder's calls)

- Detection reads only path existence, environment values and executable lookup; an `env:` signal includes its value because that value is a directory path.
- Stable registry order: two adapters first, then the seven planned harnesses — the same order used in `docs/multi-harness.md` and `ATTRIBUTION.md`.
- The endpoint is read-only and follows the API's existing host/remote guard rules; no new config flag is needed because detection has no runtime cost beyond a few `existsSync` calls at request time.

## Verification

- `npx vitest run server/harnesses/detect.test.ts server/http/http.test.ts` — new tests.
- `npm test` — full suite; pre-existing Windows-only failures (Unix path assertions, chmod 600 semantics, CRLF fixtures) are documented in the final report, and were reproduced on the untouched original repository.
- `npm run typecheck` — clean.
