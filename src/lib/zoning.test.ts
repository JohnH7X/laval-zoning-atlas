import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_VIEW } from './data';
import { changeMilieu, selectDropdownZone, zonesForType, type DescriptionCatalog } from './zoning';
import type { Zone } from './types';
const zones: Zone[] = JSON.parse(readFileSync('public/data/zones-index.json', 'utf8'));

describe('dependent zoning dropdown', () => {
  it('includes every actual zone once with all types selected', () => {
    expect(zonesForType(zones, '')).toHaveLength(zones.length);
    expect(new Set(zonesForType(zones, '').map(z => z.code)).size).toBe(zones.length);
  });
  it('lists only the three mobile-home zones for ZM', () => {
    const list = zonesForType(zones, 'ZM');
    expect(list).toHaveLength(3);
    expect(list.every(z => z.type === 'ZM')).toBe(true);
  });
  it('clears incompatible selection and old filters on milieu changes', () => {
    const view = changeMilieu({ ...DEFAULT_VIEW, zone: 'T3.2-1020', zoneFilter: '1020' }, 'ZM', zones);
    expect(view.milieu).toBe('ZM'); expect(view.zone).toBe(''); expect(view.zoneFilter).toBe('');
  });
  it('selects a real zone, preserves milieu and restores its visible layer', () => {
    const z = zonesForType(zones, 'ZM')[0];
    const view = selectDropdownZone({ ...DEFAULT_VIEW, milieu: 'ZM', visible: false }, z.code, zones);
    expect(view.zone).toBe(z.code); expect(view.zoneFilter).toBe(z.number); expect(view.milieu).toBe('ZM'); expect(view.visible).toBe(true);
  });
  it('does not accept a zone from an incompatible type or an invented zone', () => {
    const view = { ...DEFAULT_VIEW, milieu: 'ZM' };
    expect(selectDropdownZone(view, 'T3.2-1020', zones)).toEqual(view);
    expect(selectDropdownZone(view, 'fake', zones)).toEqual(view);
  });
  it('has a description record and official source link for all 41 actual types', () => {
    const data: DescriptionCatalog = JSON.parse(readFileSync('public/data/milieu-descriptions.json', 'utf8'));
    const types = [...new Set(zones.map(z => z.type))];
    expect(types).toHaveLength(41);
    for (const type of types) {
      expect(data.types[type].summary.length).toBeGreaterThan(25);
      expect(data.types[type].sourceUrl.startsWith('https://www.laval.ca/wp-content/uploads/2026/06/cdu-1-reglement-2026-06-08.pdf#page=')).toBe(true);
      expect(['subtype', 'family', 'unavailable']).toContain(data.types[type].sourceScope);
    }
  });
});
