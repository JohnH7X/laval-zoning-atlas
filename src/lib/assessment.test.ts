import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { formatValue, loadAssessments, type AssessmentMetadata } from './assessment';

beforeAll(() => {
  vi.stubGlobal('fetch', async (path: string) => {
    try { return { ok: true, json: async () => JSON.parse(readFileSync('public' + path, 'utf8')) }; }
    catch { return { ok: false, status: 404 }; }
  });
});
describe('public assessment data', () => {
  it('distinguishes missing from zero and formats CAD', () => {
    expect(formatValue(null)).toBe('Not provided');
    expect(formatValue(0)).toBe('$0');
    expect(formatValue(826000)).toBe('$826,000');
  });
  it('never assigns a property assessment to a zone-only result', async () => {
    const metadata: AssessmentMetadata = JSON.parse(readFileSync('public/data/assessment/metadata.json', 'utf8'));
    expect(await loadAssessments('zone-T5.2-5807', 'T5.2-5807', metadata)).toEqual([]);
  });
  it('returns the exact source valuation for 9060 Boulevard Lévesque Est', async () => {
    const metadata: AssessmentMetadata = JSON.parse(readFileSync('public/data/assessment/metadata.json', 'utf8'));
    const rows = JSON.parse(readFileSync('public/data/addresses/90.json', 'utf8'));
    const row = rows.find((r: unknown[]) => r[0] === '9060' && r[1] === 'Boulevard Lévesque Est');
    expect(row).toBeDefined();
    const found = await loadAssessments('address-' + row[6], row[0] + ' ' + row[1], metadata);
    expect(found.length).toBe(1);
    expect(found[0].totalValue).toBe(826000);
    expect(found[0].landValue).toBe(340200);
    expect(found[0].buildingValue).toBe(485800);
    expect(found[0].roleYear).toBe('2025');
    expect(found[0].marketDate).toBe('2023-07-01');
    expect(Object.keys(found[0]).some(k => /owner|mail|cadastre/i.test(k))).toBe(false);
  });
  it('preserves multiple assessment units as separate candidates', async () => {
    const metadata: AssessmentMetadata = JSON.parse(readFileSync('public/data/assessment/metadata.json', 'utf8'));
    let candidate: { id: string; key: string; ids: string[] } | undefined;
    for (const key of metadata.shards) {
      const data = JSON.parse(readFileSync(`public/data/assessment/${key}.json`, 'utf8'));
      const match = Object.entries(data.byAddress).find(([, ids]) => (ids as string[]).length > 1);
      if (match) { candidate = { id: match[0], key, ids: match[1] as string[] }; break; }
    }
    expect(candidate).toBeDefined();
    const rows = JSON.parse(readFileSync(`public/data/addresses/${candidate!.key}.json`, 'utf8'));
    const row = rows.find((r: unknown[]) => String(r[6]) === candidate!.id);
    const found = await loadAssessments('address-' + row[6], row[0] + ' ' + row[1], metadata);
    expect(found.map(r => r.id)).toEqual(candidate!.ids);
  });
});
