// Detecção multi-harness: quais ferramentas de código com agente existem nesta máquina.
// Node puro, sem chamadas de rede e sem ler credenciais: só presença de pastas, variáveis de ambiente
// e executáveis no PATH. A identidade descoberta aqui é de INVENTÁRIO; só claude e codex têm adapter
// (`provider`) hoje. Os outros sete são os harnesses planejados em ATTRIBUTION.md.
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { findExecutable } from '../claude-bin';
import { expandHome } from '../accounts/detect';
import type { Provider } from '../../shared/types';

export type HarnessId =
  | 'claude'
  | 'codex'
  | 'opencode'
  | 'gemini'
  | 'cline'
  | 'hermes-agent'
  | 'kilo-code'
  | 'kimi-code'
  | 'orca-ade';

export type HarnessKind = 'adapter' | 'planned';

export interface HarnessDescriptor {
  id: HarnessId;
  name: string;
  kind: HarnessKind;
  /** Preenchido quando o harness já tem fonte de agentes no servidor. */
  provider?: Provider;
  /** Pastas de configuração/estado, relativas ao $HOME. */
  dirs?: readonly string[];
  /** Variáveis que, quando definidas, indicam o harness. */
  env?: readonly string[];
  /** Variável com uma lista (vírgulas) de pastas explícitas. */
  dirsEnv?: string;
  /** Executáveis procurados no PATH. */
  bins?: readonly string[];
}

export interface DetectedHarness {
  id: HarnessId;
  name: string;
  kind: HarnessKind;
  provider?: Provider;
  /** Sinais observados: `dir:`, `env:` e `bin:`. Nunca conteúdo de arquivo. */
  signals: string[];
}

/** Ordem estável: os dois adapters primeiro, depois os sete harnesses planejados. */
export const HARNESS_REGISTRY: readonly HarnessDescriptor[] = [
  { id: 'claude', name: 'Claude Code', kind: 'adapter', provider: 'claude', dirs: ['.claude'], env: ['CLAUDE_CONFIG_DIR'], dirsEnv: 'HABBLAUD_CLAUDE_DIRS', bins: ['claude'] },
  { id: 'codex', name: 'Codex', kind: 'adapter', provider: 'codex', dirs: ['.codex'], env: ['CODEX_HOME'], dirsEnv: 'HABBLAUD_CODEX_DIRS', bins: ['codex'] },
  { id: 'opencode', name: 'Opencode', kind: 'planned', dirs: ['.opencode', '.config/opencode'], env: ['OPENCODE_CONFIG_DIR'], bins: ['opencode'] },
  { id: 'gemini', name: 'Gemini', kind: 'planned', dirs: ['.gemini'], env: ['GEMINI_HOME', 'GEMINI_CLI_HOME'], bins: ['gemini'] },
  { id: 'cline', name: 'Cline', kind: 'planned', dirs: ['.cline'], env: ['CLINE_HOME'], bins: ['cline'] },
  { id: 'hermes-agent', name: 'Hermes Agent', kind: 'planned', dirs: ['.hermes'], env: ['HERMES_HOME'], bins: ['hermes'] },
  { id: 'kilo-code', name: 'Kilo Code', kind: 'planned', dirs: ['.kilocode'], env: ['KILO_CODE_HOME'], bins: ['kilo'] },
  { id: 'kimi-code', name: 'Kimi Code', kind: 'planned', dirs: ['.kimi'], env: ['KIMI_HOME'], bins: ['kimi'] },
  { id: 'orca-ade', name: 'Orca ADE', kind: 'planned', dirs: ['.orca'], env: ['ORCA_HOME'], bins: ['orca'] },
];

export interface HarnessInventoryEntry extends DetectedHarness {
  detected: boolean;
}

export interface DetectHarnessOptions {
  env?: NodeJS.ProcessEnv;
  home?: string;
  exists?: (path: string) => boolean;
  findExecutable?: (name: string, env: NodeJS.ProcessEnv) => string | undefined;
}

function listEnv(v: string | undefined): string[] {
  return (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

function descriptorOf(d: HarnessDescriptor, signals: string[]): DetectedHarness {
  const out: DetectedHarness = { id: d.id, name: d.name, kind: d.kind, signals: [...new Set(signals)] };
  if (d.provider) out.provider = d.provider;
  return out;
}

/** Devolve os harnesses com pelo menos um sinal local, na ordem do registro. */
export function detectHarnesses(opts: DetectHarnessOptions = {}): DetectedHarness[] {
  const env = opts.env ?? process.env;
  const home = opts.home ?? homedir();
  const exists = opts.exists ?? existsSync;
  const find = opts.findExecutable ?? ((name: string, e: NodeJS.ProcessEnv) => findExecutable(name, e));

  const out: DetectedHarness[] = [];
  for (const d of HARNESS_REGISTRY) {
    const signals: string[] = [];
    for (const name of d.env ?? []) {
      const value = env[name]?.trim();
      if (value) signals.push(`env:${name}=${value}`);
    }
    const envPaths = (d.env ?? []).map((name) => env[name]?.trim()).filter((v): v is string => !!v);
    const candidates = [...(d.dirs ?? []), ...listEnv(d.dirsEnv ? env[d.dirsEnv] : undefined), ...envPaths];
    for (const raw of candidates) {
      const path = expandHome(raw.startsWith('~') || isAbsolute(raw) ? raw : join(home, raw), home);
      if (exists(path)) signals.push(`dir:${path}`);
    }
    for (const bin of d.bins ?? []) {
      const found = find(bin, env);
      if (found) signals.push(`bin:${found}`);
    }
    if (signals.length) out.push(descriptorOf(d, signals));
  }
  return out;
}

/** Inventário completo: todos os harnesses suportados, marcando os que têm sinais locais. */
export function harnessInventory(opts: DetectHarnessOptions = {}): HarnessInventoryEntry[] {
  const found = new Map(detectHarnesses(opts).map((h) => [h.id, h]));
  return HARNESS_REGISTRY.map((d) => {
    const detected = found.get(d.id);
    const entry: HarnessInventoryEntry = detected
      ? { ...detected, detected: true }
      : { id: d.id, name: d.name, kind: d.kind, signals: [], detected: false };
    if (d.provider) entry.provider = d.provider;
    return entry;
  });
}
