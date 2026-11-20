// Fonte de agentes do OpenCode: lê sessões locais do banco (somente leitura) e coloca cada sessão recente
// no escritório como agente principal da conta Opencode. Sem hooks, sem rede e sem ler conteúdo de prompt.
import type { AgentStatus, SourceInfo } from '../../../shared/types';
import type { MainInput } from '../../model/office';
import type { AgentSource } from '../source';
import { latestToolState, listRecentSessions } from './db';

const MAIN_ROLE = 'Agente principal';

/** O que a fonte usa do Office (mantém o teste pequeno, sem um Office completo). */
export interface OpencodeOffice {
  has(id: string): boolean;
  addMain(p: MainInput): void;
  setStatus(id: string, status: AgentStatus): void;
  closeMain(id: string): void;
  markDirty(): void;
}

export interface OpencodeSourceOptions {
  office: OpencodeOffice;
  /** Caminho do opencode.db (padrão: ~/.local/share/opencode/opencode.db). */
  dbPath: string;
  /** Id da conta registrada no AccountsService. */
  accountId: string;
  now?: () => number;
  pollMs?: number;
  /** Janela de "sessão aberta": sessões atualizadas antes de agora-activeMs saem do escritório. */
  activeMs?: number;
}

export class OpencodeSource implements AgentSource {
  readonly provider = 'opencode' as const;
  private timer: ReturnType<typeof setInterval> | null = null;
  private seen = new Set<string>();
  private readonly now: () => number;
  private readonly activeMs: number;

  constructor(private readonly opts: OpencodeSourceOptions) {
    this.now = opts.now ?? Date.now;
    this.activeMs = opts.activeMs ?? 15 * 60_000;
  }

  start(): void {
    this.poll();
    this.timer = setInterval(() => this.poll(), this.opts.pollMs ?? 2_000);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  sources(): SourceInfo[] {
    return [{ label: 'Opencode', provider: 'opencode', path: this.opts.dbPath, sessions: this.seen.size, ok: true }];
  }

  transcriptPathOf(_agentId: string): string | undefined {
    // Conversas ficam no SQLite, não em um arquivo de transcript; o terminal histórico não se aplica ainda.
    return undefined;
  }

  private poll(): void {
    const now = this.now();
    const sessions = listRecentSessions(this.opts.dbPath, now - this.activeMs, 20);
    const present = new Set<string>();
    for (const s of sessions) {
      const id = `opencode:${s.id}`;
      present.add(id);
      const state = latestToolState(this.opts.dbPath, s.id);
      if (!this.opts.office.has(id)) {
        this.opts.office.addMain({
          id,
          provider: 'opencode',
          account: this.opts.accountId,
          sessionId: s.id,
          cwd: s.directory,
          role: MAIN_ROLE,
          startedAt: s.timeCreated,
          status: state.status,
        });
      } else {
        this.opts.office.setStatus(id, state.status);
      }
      this.seen.add(id);
    }
    for (const id of [...this.seen]) {
      if (present.has(id)) continue;
      this.opts.office.closeMain(id);
      this.seen.delete(id);
    }
  }
}
