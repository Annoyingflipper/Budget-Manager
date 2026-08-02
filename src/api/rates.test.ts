import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const upserts: unknown[] = [];
const fromMock = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) },
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { fetchEcbRate, fetchBcvRate, fetchEcbRange, ensureTodayRates } from './rates';
import { todayISO } from '../utils/date';
import type { RateRow } from '../utils/rates';

beforeEach(() => {
  upserts.length = 0;
  fromMock.mockReset();
  fromMock.mockImplementation(() => ({
    upsert: (row: unknown) => { upserts.push(row); return Promise.resolve({ error: null }); },
  }));
});

afterEach(() => { vi.unstubAllGlobals(); });

function stubFetch(handler: (url: string) => unknown) {
  vi.stubGlobal('fetch', vi.fn((url: string) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(handler(url)) })));
}

describe('fetchEcbRate', () => {
  it('reads the EUR rate and the date the ECB actually published', async () => {
    stubFetch(() => ({ amount: 1, base: 'USD', date: '2026-07-31', rates: { EUR: 0.8707 } }));
    expect(await fetchEcbRate()).toEqual({ date: '2026-07-31', unitsPerUsd: 0.8707 });
  });

  it('throws when the payload has no EUR rate', async () => {
    stubFetch(() => ({ amount: 1, base: 'USD', date: '2026-07-31', rates: {} }));
    await expect(fetchEcbRate()).rejects.toThrow();
  });
});

describe('fetchBcvRate', () => {
  it('reads promedio and the date portion of fechaActualizacion', async () => {
    stubFetch(() => ({
      moneda: 'USD', fuente: 'oficial', promedio: 746.6297,
      fechaActualizacion: '2026-07-31T00:00:00-04:00',
    }));
    expect(await fetchBcvRate()).toEqual({ date: '2026-07-31', unitsPerUsd: 746.6297 });
  });

  it('requests the official BCV endpoint, never the parallel rate', async () => {
    const spy = vi.fn((_url: string) => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ promedio: 1, fechaActualizacion: '2026-07-31T00:00:00-04:00' }),
    }));
    vi.stubGlobal('fetch', spy);
    await fetchBcvRate();
    expect(spy.mock.calls[0][0]).toContain('/dolares/oficial');
    expect(spy.mock.calls[0][0]).not.toContain('paralelo');
  });

  it('throws when promedio is missing', async () => {
    stubFetch(() => ({ fechaActualizacion: '2026-07-31T00:00:00-04:00' }));
    await expect(fetchBcvRate()).rejects.toThrow();
  });
});

describe('fetchEcbRange', () => {
  it('flattens the range payload into one entry per published date', async () => {
    stubFetch(() => ({
      amount: 1, base: 'USD', start_date: '2026-04-30', end_date: '2026-05-05',
      rates: { '2026-04-30': { EUR: 0.85455 }, '2026-05-04': { EUR: 0.8547 } },
    }));
    expect(await fetchEcbRange('2026-04-30', '2026-05-05')).toEqual([
      { date: '2026-04-30', unitsPerUsd: 0.85455 },
      { date: '2026-05-04', unitsPerUsd: 0.8547 },
    ]);
  });
});

describe('ensureTodayRates', () => {
  // Must match the implementation's notion of "today": todayISO() is local-clock,
  // whereas toISOString() is UTC — they differ either side of midnight and would
  // make this suite fail for several hours a day depending on the timezone.
  const today = todayISO();

  it('fetches and persists both currencies when today is missing', async () => {
    stubFetch((url) => url.includes('frankfurter')
      ? { date: today, rates: { EUR: 0.87 } }
      : { promedio: 750, fechaActualizacion: `${today}T00:00:00-04:00` });

    const result = await ensureTodayRates([]);

    expect(upserts).toHaveLength(2);
    expect(result.find((r) => r.currency === 'EUR')?.unitsPerUsd).toBe(0.87);
    expect(result.find((r) => r.currency === 'VES')?.unitsPerUsd).toBe(750);
    expect(result.find((r) => r.currency === 'EUR')?.source).toBe('ecb');
    expect(result.find((r) => r.currency === 'VES')?.source).toBe('bcv');
  });

  it('does not re-fetch a currency that already has today', async () => {
    const spy = vi.fn((_url: string) => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ promedio: 750, fechaActualizacion: `${today}T00:00:00-04:00` }),
    }));
    vi.stubGlobal('fetch', spy);

    const existing: RateRow[] = [{ currency: 'EUR', rateDate: today, unitsPerUsd: 0.87, source: 'ecb' }];
    await ensureTodayRates(existing);

    for (const call of spy.mock.calls) expect(String(call[0])).not.toContain('frankfurter');
  });

  // An upstream outage must never break the page.
  it('keeps the existing rows and does not throw when a fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    const existing: RateRow[] = [
      { currency: 'VES', rateDate: '2026-07-01', unitsPerUsd: 700, source: 'bcv' },
    ];
    const result = await ensureTodayRates(existing);
    expect(result).toEqual(existing);
    expect(upserts).toHaveLength(0);
  });

  it('never writes a manual row it did not fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    await ensureTodayRates([]);
    expect(upserts).toHaveLength(0);
  });
});
