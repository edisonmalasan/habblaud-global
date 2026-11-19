# Attribution / Atribuição

## Original project / Projeto original

**Habblaud** — the pixel-art virtual office that shows, in real time, what your AI coding agents are doing.

- Original author: **Márcio Junior** ([@marmottajr](https://github.com/marmottajr))
- Original repository: <https://github.com/marmottajr/habblaud>
- License: **MIT** (see [LICENSE](LICENSE)). The original source code remains free to use, modify and redistribute under that license.

Todos os créditos pelo design, código e conceito do Habblaud original pertencem ao autor acima. Este repositório é um ponto de partida derivado, criado para estender o projeto a mais harnesses/providers de IA.

## Originally supported harnesses / Harnesses originais

The original Habblaud integrated with exactly two coding agents:

- **Claude Code** (Anthropic)
- **Codex** (OpenAI)

The Claude Code integration (status line, hooks and the `mod/habblaud*` plugins) and the Codex integration (`scripts/codex-*.ts`, the Codex bridge) were both created in the original repository and are preserved here as the baseline.

A integração original com Claude Code e Codex foi criada no repositório original e é mantida aqui como base.

## Goal of `habblaud-global` / Objetivo do `habblaud-global`

Our goal is to grow Habblaud from a Claude Code / Codex office into a **multi-harness office**: the same pixel-art workspace should be able to show agents from many coding harnesses and model providers side by side.

Um mesmo escritório capaz de mostrar agentes de vários harnesses e provedores de modelos lado a lado.

A dedicated branch is reserved for each harness/provider that will be added:

| Harness / Provider | Branch |
| --- | --- |
| Opencode | [`opencode`](../../tree/opencode) |
| Gemini | [`gemini`](../../tree/gemini) |
| Cline | [`cline`](../../tree/cline) |
| Hermes Agent | [`hermes-agent`](../../tree/hermes-agent) |
| Kilo Code | [`kilo-code`](../../tree/kilo-code) |
| Kimi Code | [`kimi-code`](../../tree/kimi-code) |
| Orca ADE | [`orca-ade`](../../tree/orca-ade) |

Each branch holds the work needed to teach Habblaud how to read that harness's local session/activity data and render its agents in the office. Branches are intentionally kept separate until their integrations are ready.

Local **detection** for all nine harnesses is already implemented on `main`: `GET /api/harnesses` reports which ones are installed, using only config-dir/env/binary presence. See [docs/multi-harness.md](docs/multi-harness.md). Detection works for the seven planned harnesses before their adapters exist.

## Trademarks / Marcas

Claude Code, Codex, Opencode, Gemini, Cline, Hermes Agent, Kilo Code, Kimi Code and Orca ADE are names of their respective owners. They are mentioned here for attribution and compatibility purposes only; no endorsement or affiliation is implied.
