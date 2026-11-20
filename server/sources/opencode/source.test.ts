// Fonte do OpenCode: sessões locais viram agentes no escritório. Teste com SQLite real + Office falso.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MainInput } from '../../model/office';
import { OpencodeSource } from './source';

const dirs: string[] = [];
function makeDb(now: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'habblaud-opencode-src-'));
  dirs.push(dir);
  const file = join(dir, 'opencode.db');
  const db = new DatabaseSync(file);
  db.exec('create table session_v2 (id TEXT, directory TEXT, title TEXT, time_created INTEGER, time_updated INTEGER, time_archived INTEGER, idle_outcome TEXT)');
  db.exec('create table session_message (id TEXT, session_id TEXT, type TEXT, seq INTEGER, time_created INTEGER, data TEXT)');
  db.prepare('insert into session_v2 values (?,?,?,?,?,?,?)').run('ses_a', '/p/projeto', 'Trabalho', now - 1000, now, null, null);
  db.prepare('insert into session_message values (?,?,?,?,?,?)').run('m1', 'ses_a', 'assistant', 1, now, JSON.stringify({ content: [{ type: 'tool', name: 'shell', state: { status: 'running' } }] }));
  db.close();
  return file;
}

class FakeOffice {
  readonly main: MainInput[] = [];
  readonly closed: string[] = [];
  private ids = new Set<string>();
  addMain(p: MainInput): void { this.main.push(p); this.ids.add(p.id); }
  has(id: string): boolean { return this.ids.has(id); }
  setStatus(): void {}
  closeMain(id: string): void { this.closed.push(id); this.ids.delete(id); }
  markDirty(): void {}
}

afterEach(() => {
  vi.useRealTimers();
  while (dirs.length) {
    try { rmSync(dirs.pop()!, { recursive: true, force: true }); } catch { /* handle SQLite temporário */ }
  }
});

describe('OpencodeSource', () => {
  it('adds one main agent per recent session with the opencode provider', () => {
    const now = 2_000_000;
    const office = new FakeOffice();
    const source = new OpencodeSource({ office, dbPath: makeDb(now), accountId: '.opencode', now: () => now });

    source.start();
    source.stop();

    expect(office.main).toEqual([{
      id: 'opencode:ses_a', provider: 'opencode', account: '.opencode', sessionId: 'ses_a',
      cwd: '/p/projeto', role: 'Agente principal', startedAt: now - 1000, status: 'working',
    }]);
    expect(source.sources()).toMatchObject([{ provider: 'opencode', sessions: 1, ok: true }]);
    expect(source.transcriptPathOf('opencode:ses_a')).toBeUndefined();
    expect(source.transcriptPathOf('outro:1')).toBeUndefined();
  });

  it('closes agents whose sessions are no longer recent', () => {
    vi.useFakeTimers();
    const now = 2_000_000;
    vi.setSystemTime(now);
    const office = new FakeOffice();
    const source = new OpencodeSource({ office, dbPath: makeDb(now), accountId: '.opencode', activeMs: 100, pollMs: 1000 });
    source.start();
    expect(office.main).toHaveLength(1);

    // O relógio avança e o mesmo source faz outra varredura: a sessão saiu da janela.
    vi.advanceTimersByTime(1000);
    source.stop();

    expect(office.closed).toContain('opencode:ses_a');
  });
});
