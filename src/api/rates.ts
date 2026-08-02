import { supabase } from '../lib/supabase';
import { todayISO } from '../utils/date';
import type { Currency } from '../utils/currency';
import type { RateRow, RateSource } from '../utils/rates';

const ECB_URL = 'https://api.frankfurter.dev/v1';
const BCV_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Rate request failed: ${url}`);
  return (await response.json()) as Record<string, unknown>;
}

export async function listRates(): Promise<RateRow[]> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('currency, rate_date, units_per_usd, source')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      currency: r.currency as Currency,
      rateDate: r.rate_date as string,
      unitsPerUsd: Number(r.units_per_usd),
      source: r.source as RateSource,
    };
  });
}

export async function upsertRate(row: RateRow): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase.from('exchange_rates').upsert(
    {
      user_id: userId,
      currency: row.currency,
      rate_date: row.rateDate,
      units_per_usd: row.unitsPerUsd,
      source: row.source,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,currency,rate_date' },
  );
  if (error) throw error;
}

/** ECB reference rate for EUR. Frankfurter reports the date it actually published. */
export async function fetchEcbRate(): Promise<{ date: string; unitsPerUsd: number }> {
  const json = await getJson(`${ECB_URL}/latest?base=USD&symbols=EUR`);
  const rate = (json.rates as Record<string, number> | undefined)?.EUR;
  if (typeof rate !== 'number') throw new Error('ECB response missing EUR rate');
  return { date: json.date as string, unitsPerUsd: rate };
}

/** Official BCV rate. This endpoint exposes `oficial` and `paralelo`; only `oficial` is used. */
export async function fetchBcvRate(): Promise<{ date: string; unitsPerUsd: number }> {
  const json = await getJson(BCV_URL);
  const rate = json.promedio;
  if (typeof rate !== 'number') throw new Error('BCV response missing promedio');
  return { date: (json.fechaActualizacion as string).slice(0, 10), unitsPerUsd: rate };
}

/** One entry per date the ECB published in the range — used for the EUR backfill. */
export async function fetchEcbRange(
  start: string,
  end: string,
): Promise<Array<{ date: string; unitsPerUsd: number }>> {
  const json = await getJson(`${ECB_URL}/${start}..${end}?base=USD&symbols=EUR`);
  const rates = (json.rates ?? {}) as Record<string, { EUR?: number }>;
  return Object.entries(rates)
    .filter(([, v]) => typeof v.EUR === 'number')
    .map(([date, v]) => ({ date, unitsPerUsd: v.EUR as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Tops up today's rate for any currency missing it, and persists what it fetched.
 * Failures are swallowed deliberately: a rate outage degrades to the last known
 * rate (carry-forward handles the rest), it never breaks the page.
 */
export async function ensureTodayRates(existing: RateRow[]): Promise<RateRow[]> {
  const today = todayISO();
  const has = (currency: Currency) =>
    existing.some((r) => r.currency === currency && r.rateDate === today);

  const fetched: RateRow[] = [];

  if (!has('EUR')) {
    try {
      const { date, unitsPerUsd } = await fetchEcbRate();
      fetched.push({ currency: 'EUR', rateDate: date, unitsPerUsd, source: 'ecb' });
    } catch { /* keep the stale rate */ }
  }

  if (!has('VES')) {
    try {
      const { date, unitsPerUsd } = await fetchBcvRate();
      fetched.push({ currency: 'VES', rateDate: date, unitsPerUsd, source: 'bcv' });
    } catch { /* keep the stale rate */ }
  }

  for (const row of fetched) {
    try { await upsertRate(row); } catch { /* non-fatal */ }
  }

  return [...existing, ...fetched];
}
