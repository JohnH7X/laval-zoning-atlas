import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ACTIVITIES, activityCandidateZones, activityFilterTypes, activityMatches, findActivities, useStatusLabel, type UseMatrix } from './activities';
import { DEFAULT_VIEW, encodeView, readView } from './data';
import type { Zone } from './types';
const matrix: UseMatrix = JSON.parse(readFileSync('public/data/use-matrix.json','utf8'));
const zones: Zone[] = JSON.parse(readFileSync('public/data/zones-index.json','utf8'));
const sales = ACTIVITIES.find(a=>a.id==='car-sales')!;

describe('reverse activity lookup',()=>{
  it('resolves the requested plain-language example to vehicle sales, not generic commercial zoning',()=>{
    for(const q of ['car sales','car dealership','vente de voitures','concessionnaire','5511']) expect(findActivities(q)[0].id).toBe('car-sales');
    expect(sales.officialCode).toBe('5511'); expect(sales.groups).toEqual(['C5']);
  });
  it('indexes all 41 actual milieu use tables with unverified zone exceptions',()=>{
    expect(Object.keys(matrix.types)).toHaveLength(41);
    for(const r of Object.values(matrix.types)){expect(r.exceptionsChecked).toBe(false);expect(Object.keys(r.groups)).toHaveLength(21);}
  });
  it('returns A baseline versus C conditional car-sale candidates and excludes restricted industrial C5 uses',()=>{
    const hits=activityMatches(sales,matrix,zones);
    expect(hits.filter(h=>h.symbol==='A').map(h=>h.type)).toEqual(['SZD.2','ZC']);
    expect(hits.filter(h=>h.symbol==='C').map(h=>h.type)).toEqual(['T4.5','T6.1','T6.2','T6.3','T6.4','T6.5']);
    expect(hits.some(h=>['ZI.1','ZI.2'].includes(h.type))).toBe(false);
    expect(hits.every(h=>h.scope==='baseline-candidate' && h.sourceUrl.includes('#page='))).toBe(true);
  });
  it('keeps automobile repair separate from sales and includes specified industrial repair routes',()=>{
    const repair=ACTIVITIES.find(a=>a.id==='car-repair')!;
    const hits=activityMatches(repair,matrix,zones);
    expect(hits.some(h=>h.type==='ZI.1')).toBe(true);expect(hits.some(h=>h.type==='ZI.2')).toBe(true);
  });
  it('filters real zones only and does not offer residential T3 zones through the C5 sales route',()=>{
    const result=activityCandidateZones(sales,matrix,zones);
    expect(result.length).toBeGreaterThan(0);expect(result.some(z=>z.type.startsWith('T3'))).toBe(false);
    expect(new Set(result.map(z=>z.code)).size).toBe(result.length);
  });
  it('does not invent unrecognized activity matches',()=>{expect(findActivities('not-a-real-business-qzz')).toEqual([]);});
  it('round-trips a shareable activity-filter URL',()=>{
    const view={...DEFAULT_VIEW,activity:'car-sales'};expect(readView(encodeView(view)).activity).toBe('car-sales');
    expect(encodeView(view)).toContain('use=car-sales');
  });
  it('keeps official "A et C" cells as a distinct mixed status, never plain as-of-right',()=>{
    const mixed=Object.values(matrix.types).flatMap(r=>Object.entries(r.groups).filter(([,g])=>g.evidence.includes('A et C')));
    expect(mixed).toHaveLength(20);
    expect(mixed.every(([,g])=>g.symbol==='AC')).toBe(true);
    const bar=ACTIVITIES.find(a=>a.id==='bar')!;
    expect(activityMatches(bar,matrix,zones).some(h=>h.symbol==='AC')).toBe(true);
    expect(useStatusLabel('AC')).toMatch(/review/i);
    expect(useStatusLabel('AC')).not.toBe(useStatusLabel('A'));
  });
  it('does not hide every zone while use-table data is pending or failed',()=>{
    expect(activityFilterTypes('car-sales',null,zones)).toBeNull();
    expect(activityFilterTypes('','' as never,zones)).toBeNull();
    expect(activityFilterTypes('car-sales',matrix,zones)!.length).toBeGreaterThan(0);
  });
  it('retains restriction evidence only for its own milieu section',()=>{
    for(const [code,row] of Object.entries(matrix.types)) expect(row.restrictions,code).not.toMatch(/\b(?:SECTION|CHAPITRE|TITRE)\s+\d+/);
  });
});
