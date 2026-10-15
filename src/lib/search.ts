import { getJSON } from './data';
import type { AddressRow, SearchResult, Zone } from './types';

export function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
const cache = new Map<string, Promise<AddressRow[]>>();
let streetIndex: Promise<[string, string[]][]> | null = null;
function shard(key: string) {
  if (!cache.has(key)) cache.set(key, getJSON<AddressRow[]>(`/data/addresses/${key}.json`).catch(error => {
    cache.delete(key); throw error;
  }));
  return cache.get(key)!;
}
function checkCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError');
}

export function zoneResults(query: string, zones: Zone[]): SearchResult[] {
  const q = normalize(query);
  return zones.filter(z => normalize(z.code) === q || z.number === q || (q.length >= 3 && normalize(z.code).startsWith(q)))
    .slice(0, 12).map(z => ({ id: 'zone-' + z.code, kind: 'zone', title: z.code,
      subtitle: `Zone ${z.number} · Milieu ${z.type}`, coordinates: z.center, zoneCodes: [z.code] }));
}

export async function searchAtlas(query: string, zones: Zone[], shards: string[], signal?: AbortSignal): Promise<{ results: SearchResult[]; truncated: boolean }> {
  checkCancelled(signal);
  const q = normalize(query);
  if (q.length < 2) return { results: [], truncated: false };
  const numeric = /^\d+$/.test(q);
  const zoneLike = /^[a-z]+\d*\s*\d*(?:\s+\d+)?$/.test(q) && !/^\d/.test(q);
  const zr = zoneResults(query, zones);
  if (zoneLike && zr.length) return { results: zr, truncated: zr.length >= 12 };
  const number = q.match(/^\d+/)?.[0];
  const tokens = q.split(' ');
  let keys: string[];
  if (number) {
    keys = number.length >= 2 ? (shards.includes(number.slice(0, 2)) ? [number.slice(0, 2)] : [])
      : shards.filter(k => k.startsWith(number) || k === number.padStart(2, '0'));
  } else {
    // Read only a small street directory before fetching candidate address shards.
    streetIndex ??= getJSON<[string, string[]][]>('/data/street-index.json').catch(error => { streetIndex = null; throw error; });
    const streets = await streetIndex;
    checkCancelled(signal);
    keys = [...new Set(streets.filter(([street]) => tokens.every(t => street.includes(t))).flatMap(([, ids]) => ids))].sort();
  }
  const hits: SearchResult[] = [];
  let truncated = false;
  for (let i = 0; i < keys.length; i += 6) {
    checkCancelled(signal);
    const groups = await Promise.all(keys.slice(i, i + 6).map(shard));
    checkCancelled(signal);
    outer: for (const rows of groups) for (const row of rows) {
      const text = normalize(row[0] + ' ' + row[1]);
      if (!tokens.every(t => text.includes(t))) continue;
      if (number && normalize(row[0]).split(' ')[0] !== number && !normalize(row[0]).startsWith(number)) continue;
      hits.push({ id: 'address-' + row[6], kind: 'address', title: `${row[0]} ${row[1]}`,
        subtitle: `${row[2] || 'Laval'} · ${row[5].join(', ') || 'Zone unresolved'}`,
        coordinates: [row[3], row[4]], zoneCodes: row[5] });
      if (hits.length >= 30) { truncated = true; break outer; }
    }
    if (truncated) break;
  }
  if (number) hits.sort((a, b) => Number(!normalize(a.title).startsWith(number + ' ')) - Number(!normalize(b.title).startsWith(number + ' ')) || a.title.localeCompare(b.title));
  const results = numeric ? [...zr, ...hits] : [...hits, ...zr];
  return { results: results.slice(0, 30), truncated: truncated || results.length > 30 };
}
