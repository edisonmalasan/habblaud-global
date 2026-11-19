// Detecção multi-harness: testes primeiro (TDD). Cada teste nomeia a quebra que ele pega.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectHarnesses, harnessInventory, type HarnessId } from './detect';

const homes: string[] = [];
function emptyHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'habblaud-harness-'));
  homes.push(home);
  return home;
}
afterEach(() => {
  while (homes.length) rmSync(homes.pop()!, { recursive: true, force: true });
});

function dir(home: string, ...parts: string[]): string {
  const p = join(home, ...parts);
  mkdirSync(p, { recursive: true });
  return p;
}

const noBins = () => undefined;

describe('detectHarnesses', () => {
  it('reports Claude Code with its provider when only its config dir exists', () => {
    const home = emptyHome();
    const claudeDir = dir(home, '.claude');

    const found = detectHarnesses({ home, env: {}, findExecutable: noBins });

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ id: 'claude', kind: 'adapter', provider: 'claude' });
    expect(found[0].signals).toContain(`dir:${claudeDir}`);
  });

  it('reports nothing when the machine has no harness signals', () => {
    const home = emptyHome();

    expect(detectHarnesses({ home, env: {}, findExecutable: noBins })).toEqual([]);
  });

  it('detects Codex from CODEX_HOME without requiring a Claude config layout', () => {
    const home = emptyHome();
    const codexDir = dir(home, 'custom-codex');

    const found = detectHarnesses({ home, env: { CODEX_HOME: codexDir }, findExecutable: noBins });

    const codex = found.find((h) => h.id === 'codex');
    expect(codex).toMatchObject({ id: 'codex', kind: 'adapter', provider: 'codex' });
    expect(codex!.signals).toContain(`env:CODEX_HOME=${codexDir}`);
    expect(codex!.signals).toContain(`dir:${codexDir}`);
  });

  it('detects all seven planned harnesses from their config dirs', () => {
    const home = emptyHome();
    const planned = ['opencode', 'gemini', 'cline', 'hermes', 'kilocode', 'kimi', 'orca'] as const;
    for (const p of planned) dir(home, `.${p}`);

    const found = detectHarnesses({ home, env: {}, findExecutable: noBins });

    expect(found.map((h) => h.id)).toEqual<HarnessId[]>([
      'opencode', 'gemini', 'cline', 'hermes-agent', 'kilo-code', 'kimi-code', 'orca-ade',
    ]);
    expect(found.every((h) => h.kind === 'planned' && h.provider === undefined)).toBe(true);
  });

  it('detects a harness from an executable on PATH even without a config dir', () => {
    const home = emptyHome();
    const bin = (name: string) => (name === 'opencode' ? '/usr/local/bin/opencode' : undefined);

    const found = detectHarnesses({ home, env: {}, findExecutable: bin });

    expect(found.map((h) => h.id)).toEqual(['opencode']);
    expect(found[0].signals).toEqual(['bin:/usr/local/bin/opencode']);
  });

  it('accepts explicit harness dirs from the HABBLAUD_*_DIRS overrides', () => {
    const home = emptyHome();
    const custom = dir(home, 'accounts', 'team-claude');

    const found = detectHarnesses({
      home,
      env: { HABBLAUD_CLAUDE_DIRS: join(home, 'accounts', 'team-claude') },
      findExecutable: noBins,
    });

    expect(found.find((h) => h.id === 'claude')!.signals).toContain(`dir:${custom}`);
  });

  it('keeps registry order and never duplicates a signal', () => {
    const home = emptyHome();
    dir(home, '.codex');
    dir(home, '.claude');

    const found = detectHarnesses({ home, env: {}, findExecutable: noBins });

    expect(found.map((h) => h.id)).toEqual(['claude', 'codex']);
    for (const h of found) expect(new Set(h.signals).size).toBe(h.signals.length);
  });
});

describe('harnessInventory', () => {
  it('lists all nine supported harnesses with detected=false when there are no signals', () => {
    const home = emptyHome();

    const inventory = harnessInventory({ home, env: {}, findExecutable: noBins });

    expect(inventory.map((h) => h.id)).toEqual<HarnessId[]>([
      'claude', 'codex', 'opencode', 'gemini', 'cline', 'hermes-agent', 'kilo-code', 'kimi-code', 'orca-ade',
    ]);
    expect(inventory.every((h) => h.detected === false && h.signals.length === 0)).toBe(true);
  });

  it('marks only the harness with a local signal as detected', () => {
    const home = emptyHome();
    dir(home, '.gemini');

    const inventory = harnessInventory({ home, env: {}, findExecutable: noBins });

    expect(inventory.find((h) => h.id === 'gemini')).toMatchObject({ detected: true, kind: 'planned' });
    expect(inventory.find((h) => h.id === 'claude')).toMatchObject({ detected: false });
    expect(inventory).toHaveLength(9);
  });
});
