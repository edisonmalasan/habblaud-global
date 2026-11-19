# Opencode — Habblaud harness integration

> Status: **Planned**. This branch is the home for the Opencode integration; it does not send any agent data anywhere yet.

See [ATTRIBUTION.md](../../ATTRIBUTION.md) for project credits and the full list of planned harness branches.

## Goal

Show Opencode coding sessions in the Habblaud office: each active session becomes a pixel-art character with a live status (typing, running a tool, waiting for input, done), the same way the original Claude Code and Codex integrations do.

## What to investigate

- the OpenCode CLI's local session store and configuration directory (for example the project-local or user-level OpenCode state directory).
- Which signals are available: session start/end, prompt submitted, tool call, permission request, idle/waiting.
- Whether the harness exposes a hook or status-line mechanism that can push updates instead of polling files.
- How to map harness events onto the shared agent/room model in `shared/` and the server state in `server/`.

## Integration checklist

- [ ] Locate and document the local data source (read-only; no credentials).
- [ ] Add a reader/adapter that translates harness events into Habblaud agent state.
- [ ] Wire the adapter into the local server update loop.
- [ ] Add translated UI strings via `tr()` and check them with `npm run i18n:check`.
- [ ] Cover with tests and document the change in the READMEs and `CHANGELOG.md` ("Não lançado").
- [ ] Respect the truthful-data notice in `AGENTS.md`: never fabricate or inflate activity.

## Privacy

Read local session metadata only. Never read credentials, tokens or private prompt content, and never send fabricated office data to Habblaud World.