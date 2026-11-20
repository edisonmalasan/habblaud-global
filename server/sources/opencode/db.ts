// Leitura SOMENTE LEITURA do banco local do OpenCode (Node >= 22.5, node:sqlite).
// Privacidade: só session_v2 (metadados de sessão) e session_message (última mensagem para o status).
// Nunca abre as tabelas credential/account/blob, nem conteúdo de prompt/resposta além do status da ferramenta.
import { DatabaseSync } from 'node:sqlite';

export interface OpencodeSession {
  id: string;
  directory: string;
  title: string;
  timeCreated: number;
  timeUpdated: number;
}

export interface ToolState {
  status: 'working' | 'idle';
  text: string;
}

function openReadOnly(file: string): DatabaseSync | undefined {
  try {
    return new DatabaseSync(file, { readOnly: true });
  } catch {
    return undefined;
  }
}

/** Sessões não arquivadas atualizadas depois de `since`, mais recentes primeiro. */
export function listRecentSessions(file: string, since: number, limit = 20): OpencodeSession[] {
  const db = openReadOnly(file);
  if (!db) return [];
  try {
    const rows = db
      .prepare('select id, directory, title, time_created, time_updated from session_v2 where time_updated >= ? and time_archived is null order by time_updated desc limit ?')
      .all(since, limit) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      directory: String(r.directory ?? ''),
      title: String(r.title ?? ''),
      timeCreated: Number(r.time_created ?? 0),
      timeUpdated: Number(r.time_updated ?? 0),
    }));
  } catch {
    return [];
  } finally {
    db.close();
  }
}

/** Está usando uma ferramenta agora? Lê só o status da última mensagem do assistente. */
export function latestToolState(file: string, sessionId: string): ToolState {
  const db = openReadOnly(file);
  if (!db) return { status: 'idle', text: '' };
  try {
    const row = db
      .prepare("select data from session_message where session_id = ? and type = 'assistant' order by seq desc limit 1")
      .get(sessionId) as { data?: string } | undefined;
    if (!row?.data) return { status: 'idle', text: '' };
    const parsed: unknown = JSON.parse(row.data);
    const content = (parsed as { content?: unknown })?.content;
    if (!Array.isArray(content)) return { status: 'idle', text: '' };
    for (const part of content) {
      const p = part as { type?: string; name?: string; state?: { status?: string } };
      if (p.type === 'tool' && p.state?.status === 'running') {
        return { status: 'working', text: p.name ?? '' };
      }
    }
    return { status: 'idle', text: '' };
  } catch {
    return { status: 'idle', text: '' };
  } finally {
    db.close();
  }
}

/** Caminho padrão do banco do OpenCode V2, relativo ao $HOME. */
export function defaultDbPath(home: string): string {
  return `${home.replace(/[\\/]+$/, '')}/.local/share/opencode/opencode.db`;
}
