import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchHarnesses, harnessRows, type HarnessInventoryEntry } from './harnesses';

function entry(id: string, detected: boolean, kind: 'adapter' | 'planned' = 'planned'): HarnessInventoryEntry {
  return { id, name: id, kind, detected, signals: detected ? ['dir:/tmp/opencode'] : [] };
}

afterEach(() => vi.unstubAllGlobals());

describe('harnessRows', () => {
  it('keeps registry order and maps detection/kind to translatable keys', () => {
    const rows = harnessRows([entry('claude', true, 'adapter'), entry('opencode', true), entry('kimi-code', false)]);

    expect(rows.map((r) => r.id)).toEqual(['claude', 'opencode', 'kimi-code']);
    expect(rows[0]).toMatchObject({ detected: true, statusKey: 'Detectado', kindKey: 'Adapter' });
    expect(rows[1]).toMatchObject({ detected: true, statusKey: 'Detectado', kindKey: 'Planejado' });
    expect(rows[2]).toMatchObject({ detected: false, statusKey: 'Não detectado', kindKey: 'Planejado' });
  });

  it('maps an empty inventory to no rows', () => {
    expect(harnessRows([])).toEqual([]);
  });
});

describe('fetchHarnesses', () => {
  it('reads the inventory from /api/harnesses', async () => {
    const body = [entry('opencode', true)];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => body });
    vi.stubGlobal('fetch', fetchMock);

    const got = await fetchHarnesses();

    expect(fetchMock).toHaveBeenCalledWith('/api/harnesses', expect.anything());
    expect(got).toEqual(body);
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }));

    await expect(fetchHarnesses()).rejects.toThrow('boom');
  });
});
