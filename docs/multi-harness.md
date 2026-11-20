# Multi-harness detection

Habblaud was born reading Claude Code's local files, then gained a second adapter for Codex. `habblaud-global` adds a **generic, local-only inventory** that answers one question: *which coding harnesses are installed on this machine?*

## What is detected

`server/harnesses/detect.ts` holds the registry and the detection logic. A harness is reported when at least one of these local signals is present:

- a config/state directory under `$HOME` (for example `.claude`, `.codex`, `.opencode`, `.gemini`, `.cline`, `.hermes`, `.kilocode`, `.kimi`, `.orca`);
- a harness-specific environment variable (for example `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `OPENCODE_CONFIG_DIR`);
- an explicit directory override (`HABBLAUD_CLAUDE_DIRS`, `HABBLAUD_CODEX_DIRS`);
- an executable found on `PATH`.

| Harness | Kind | Provider in the office |
| --- | --- | --- |
| Claude Code | adapter | `claude` |
| Codex | adapter | `codex` |
| Opencode | adapter (local) | `opencode` |
| Gemini | planned | — |
| Cline | planned | — |
| Hermes Agent | planned | — |
| Kilo Code | planned | — |
| Kimi Code | planned | — |
| Orca ADE | planned | — |

"Planned" means detection works, but no agent source/history adapter exists yet. Each of those harnesses has its own branch (`gemini`, `cline`, `hermes-agent`, `kilo-code`, `kimi-code`, `orca-ade`) with the integration checklist. Opencode's branch work has started on `main` with a local source (below).

## Opencode agent source

`server/sources/opencode/` reads the local OpenCode V2 database (`~/.local/share/opencode/opencode.db`) read-only. Only `session_v2` (session metadata) and `session_message` (the status of the latest tool call) are queried — no credentials, account tables, prompt text or network calls. Each non-archived session updated in the last 15 minutes becomes a main agent in the `.opencode` account; a running tool shows the agent as `working`, otherwise `idle`. Sessions that fall out of the window are closed with the normal office grace period.

Requires Node with `node:sqlite` (Node 22.5+; unflagged in 23.4+). Set `HABBLAUD_OPENCODE=0` to disable the source. Detection of Opencode in the inventory still works when the source is disabled.

## Privacy

Detection only checks for the **presence** of paths, environment variables and executables. It never opens credentials, tokens, session contents or private prompt data, and makes no network calls. Signals are reported as `dir:`, `env:` and `bin:` strings; an `env:` signal includes the variable's value, which is normally a directory path.

## API

```
GET /api/harnesses
```

Returns the full inventory in stable registry order:

```json
[
  { "id": "claude", "name": "Claude Code", "kind": "adapter", "provider": "claude", "detected": true,
    "signals": ["dir:C:\\Users\\me\\.claude"] },
  { "id": "opencode", "name": "Opencode", "kind": "planned", "detected": false, "signals": [] }
]
```

`provider` is omitted for planned harnesses. The endpoint is read-only (GET/HEAD; other methods return 405) and honors the same host/remote rules as the rest of the API.

The same inventory is shown in the app's Help dialog (`?` → **Harnesses detectados**), fetched on first open. Each row shows the harness name, whether it was detected and whether it has an adapter (`Adapter`) or is `Planned`. A detected harness does **not** mean an agent appears in the office — only Claude Code and Codex have agent sources so far.

## Tests

```
npx vitest run server/harnesses/detect.test.ts server/http/http.test.ts
```

`server/harnesses/detect.test.ts` uses real temporary directories and injected environment/executable lookups — it asserts detection, registry order, signal deduplication and the complete inventory. `server/http/http.test.ts` covers the HTTP contract.

## Implementation note

The detector is deliberately separate from the protocol `Provider` union (`'claude' | 'codex'`). Adding seven new values there would ripple through the World protocol, UI labels and every binary `=== 'codex'` branch. The inventory uses its own `HarnessId` type, so a harness can be detected before it has an agent adapter. When an adapter is added on its branch, set `provider` on that registry entry and wire its `AgentSource` in `server/index.ts`.
