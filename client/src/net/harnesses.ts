// Inventário de harnesses para o Cliente (espelho do tipo devolvido por GET /api/harnesses).
// Só leitura: detecção acontece no servidor, sem credenciais e sem chamadas externas.
export interface HarnessInventoryEntry {
  id: string;
  name: string;
  kind: 'adapter' | 'planned';
  provider?: string;
  detected: boolean;
  signals: string[];
}

export interface HarnessRow {
  id: string;
  name: string;
  detected: boolean;
  kind: 'adapter' | 'planned';
  /** Chaves em PT passadas por tr() na renderização (a língua de origem é a chave). */
  statusKey: 'Detectado' | 'Não detectado';
  kindKey: 'Adapter' | 'Planejado';
}

/** Transforma o inventário em linhas, preservando a ordem do registro do servidor. */
export function harnessRows(entries: readonly HarnessInventoryEntry[]): HarnessRow[] {
  return entries.map((e) => ({
    id: e.id,
    name: e.name,
    detected: e.detected,
    kind: e.kind,
    statusKey: e.detected ? 'Detectado' : 'Não detectado',
    kindKey: e.kind === 'adapter' ? 'Adapter' : 'Planejado',
  }));
}

/** Lê o inventário local de harnesses; lança com o corpo do erro se a resposta não for ok. */
export async function fetchHarnesses(signal?: AbortSignal): Promise<HarnessInventoryEntry[]> {
  const res = await fetch('/api/harnesses', { signal, cache: 'no-store' });
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return (await res.json()) as HarnessInventoryEntry[];
}
