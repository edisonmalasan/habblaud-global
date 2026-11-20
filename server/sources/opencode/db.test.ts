// Leitura do banco local do OpenCode (session_v2 / session_message). Testes com SQLite real temporário.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { latestToolState, listRecentSessions } from './db';

const dirs: string[] = [];
function makeDb(): string {
  const dir = mkdtempSync(join(tmpdir(), 'habblaud-opencode-'));
  dirs.push(dir);
  const file = join(dir, 'opencode.db');
  const db = new DatabaseSync(file);
  db.exec(`create table session_v2 (id TEXT, directory TEXT, title TEXT, time_created INTEGER, time_updated INTEGER, time_archived INTEGER, idle_outcome TEXT)`);
  db.exec(`create table session_message (id TEXT, session_id TEXT, type TEXT, seq INTEGER, time_created INTEGER, data TEXT)`);
  return file;
}
afterEach(() => {
  while (dirs.length) {
    try {
      rmSync(dirs.pop()!, { recursive: true, force: true });
    } catch {
      // Windows pode manter o handle do arquivo SQLite por um instante; o temp dir é descartável.
    }
  }
});

function session(db: DatabaseSync, id: string, updated: number, archived: number | null = null): void {
  db.prepare('insert into session_v2 values (?,?,?,?,?,?,?)').run(id, `/p/${id}`, `Title ${id}`, updated - 1000, updated, archived, 'succeeded');
}
function message(db: DatabaseSync, sessionId: string, seq: number, status: string): void {
  const data = JSON.stringify({ content: [{ type: 'tool', name: 'shell', state: { status } }] });
  db.prepare('insert into session_message values (?,?,?,?,?,?)').run(`msg${seq}`, sessionId, 'assistant', seq, seq, data);
}

describe('listRecentSessions', () => {
  it('returns only sessions updated since the cutoff, newest first, skipping archived', () => {
    const file = makeDb();
    const db = new DatabaseSync(file);
    session(db, 'new', 5000);
    session(db, 'old', 1000);
    session(db, 'archived', 6000, 4000);
    db.close();

    expect(listRecentSessions(file, 2000).map((s) => s.id)).toEqual(['new']);
  });

  it('maps the directory, title and timestamps used by the office', () => {
    const file = makeDb();
    const db = new DatabaseSync(file);
    session(db, 'ses1', 9000);
    db.close();

    expect(listRecentSessions(file, 0)[0]).toEqual({
      id: 'ses1', directory: '/p/ses1', title: 'Title ses1', timeCreated: 8000, timeUpdated: 9000,
    });
  });

  it('returns an empty list when the database or table is missing', () => {
    expect(listRecentSessions(join(mkdtempSync(join(tmpdir(), 'habblaud-missing-')), 'none.db'), 0)).toEqual([]);
  });
});

describe('latestToolState', () => {
  it('reports working when the latest assistant message has a running tool', () => {
    const file = makeDb();
    const db = new DatabaseSync(file);
    message(db, 'ses1', 1, 'completed');
    message(db, 'ses1', 2, 'running');
    db.close();

    expect(latestToolState(file, 'ses1')).toEqual({ status: 'working', text: 'shell' });
  });

  it('reports idle when the latest message has no running tool', () => {
    const file = makeDb();
    const db = new DatabaseSync(file);
    message(db, 'ses1', 1, 'running');
    message(db, 'ses1', 2, 'completed');
    db.close();

    expect(latestToolState(file, 'ses1')).toEqual({ status: 'idle', text: '' });
  });
});
