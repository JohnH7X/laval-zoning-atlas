import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { encodeView, readView } from './data';
import { normalize, searchAtlas } from './search';
import type { Metadata, Zone } from './types';

const zones: Zone[] = JSON.parse(readFileSync('public/data/zones-index.json', 'utf8'));
const metadata: Metadata = JSON.parse(readFileSync('public/data/metadata.json', 'utf8'));
beforeAll(() => {
  vi.stubGlobal('fetch', async (path: string) => {
    try { return { ok: true, json: async () => JSON.parse(readFileSync('public' + path, 'utf8')) }; }
    catch { return { ok: false, status: 404 }; }
  });
});

describe('static map state', () => {
  it('round-trips the view, selected zone, filters and hidden layer', () => {
    const view = { lng: -73.74712, lat: 45.60543, zoom: 14.2, zone: 'T5.2-5807', milieu: 'T5.2', zoneFilter: '5807', activity: '', visible: false };
    expect(readView(encodeView(view))).toEqual(view);
  });
  it('rejects invalid map coordinates', () => {
    expect(readView('#lng=900&lat=oops&z=-2').lng).toBe(-73.747);
  });
});

describe('municipal search', () => {
  it('normalizes accented French street text', () => {
    expect(normalize('Rue de l’Île')).toBe('rue de l ile');
  });
  it('finds a full zone code', async () => {
    const found = await searchAtlas('T5.2-5807', zones, metadata.addressShards);
    expect(found.results[0]?.title).toBe('T5.2-5807');
    expect(found.results[0]?.zoneCodes).toEqual(['T5.2-5807']);
  });
  it('offers a zone number without automatically guessing an address', async () => {
    const found = await searchAtlas('5807', zones, metadata.addressShards);
    expect(found.results.some(r => r.kind === 'zone' && r.title === 'T5.2-5807')).toBe(true);
  });
  it('resolves a real source address with its precomputed zone', async () => {
    const rows = JSON.parse(readFileSync('public/data/addresses/10.json', 'utf8'));
    const row = rows.find((r: unknown[]) => r[0] === '100') || rows[0];
    const found = await searchAtlas(row[0] + ' ' + row[1], zones, metadata.addressShards);
    expect(found.results.some(r => r.kind === 'address' && r.coordinates[0] === row[3] && r.coordinates[1] === row[4])).toBe(true);
    expect(found.results.filter(r => r.kind === 'address').every(r => r.zoneCodes.length === 1)).toBe(true);
  });
  it('shows no result for a nonexistent address without fabricated geocoding', async () => {
    const found = await searchAtlas('999999 Totally Invented Street', zones, metadata.addressShards);
    expect(found.results).toEqual([]);
  });
  it('returns unmatched street-only queries from the compact directory', async () => {
    const found = await searchAtlas('Totally Invented Street', zones, metadata.addressShards);
    expect(found.results).toEqual([]);
  });
  it('searches a real street without loading unrelated shards', async () => {
    const rows = JSON.parse(readFileSync('public/data/addresses/10.json', 'utf8'));
    const found = await searchAtlas(rows[0][1], zones, metadata.addressShards);
    expect(found.results.length).toBeGreaterThan(0);
    expect(found.results.length).toBeLessThanOrEqual(30);
  });
  it('stops a cancelled search before loading data', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(searchAtlas('boulevard', zones, metadata.addressShards, controller.signal)).rejects.toThrow('Search cancelled');
  });
});
