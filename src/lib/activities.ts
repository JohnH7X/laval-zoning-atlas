import { normalize } from './search';
import type { Zone } from './types';

export const CODE_PDF = 'https://www.laval.ca/wp-content/uploads/2026/06/cdu-1-reglement-2026-06-08.pdf';
export interface Activity { id: string; label: string; groups: string[]; aliases: string[]; officialCode?: string; note: string; classificationPage?: number }
export interface UseGroup { symbol: '' | 'A' | 'C' | 'AC'; page: number; evidence: string }
export interface UseMatrix {
  documentDate: string; checkedDate: string; sourceUrl: string;
  types: Record<string, { code: string; groups: Record<string, UseGroup>; tablePage: number; tableSourceUrl: string; restrictions: string; exceptionsChecked: false }>;
}
export interface ActivityMatch { type: string; symbol: 'A' | 'C' | 'AC'; group: string; sourceUrl: string; zoneCount: number; scope: 'baseline-candidate' }
const broad = 'This searches a broad official use group. The specific business classification, individual use restrictions and zone exceptions still need review.';
export const ACTIVITIES: Activity[] = [
  { id: 'car-sales', label: 'Car sales / dealership', groups: ['C5'], aliases: ['car sales','car sale','cars for sale','car dealer','car dealership','auto sales','auto dealer','vehicle sales','new cars','used cars','vente automobile','vente de voitures','vente auto','concessionnaire','5511'], officialCode: '5511', classificationPage: 300, note: 'Vehicle sales (5511), searched through automotive group C5. ZI.1 and ZI.2 are excluded from this route: their listed C5 uses are parts/service, not car sales. Indoor-only retail can also fall under C2b (PDF page 296); that alternative route is not resolved here. Outdoor display, parking and zone exceptions must be checked.' },
  { id: 'car-repair', label: 'Car repair / auto garage', groups: ['C5'], aliases: ['car repair','auto repair','auto garage','mechanic','mechanics','garage automobile','reparation automobile','mecanique automobile','6411'], officialCode: '6411', classificationPage: 300, note: 'Automobile repair (6411) in C5. Industrial-area C5 permissions are limited to specified parts/service uses and indoor operations. Conditional approval, lot design and zone exceptions may apply.' },
  { id: 'car-wash', label: 'Car wash', groups: ['C5'], aliases: ['car wash','carwash','lavage automobile','lave auto','6412'], officialCode: '6412', classificationPage: 300, note: 'Automobile washing (6412) in C5. Conditional approvals, indoor-operation restrictions and zone exceptions may apply.' },
  { id: 'car-rental', label: 'Car rental', groups: ['C5'], aliases: ['car rental','rent a car','vehicle rental','location automobile','location de voitures','6353'], officialCode: '6353', classificationPage: 300, note: 'Automobile rental (6353) in C5. The restricted industrial C5 lists do not include this use, so ZI.1 and ZI.2 are excluded from this route. Verify site requirements and zone exceptions.' },
  { id: 'automotive', label: 'Automotive businesses and services', groups: ['C5'], aliases: ['automotive','automobile','auto business','auto service','C5'], classificationPage: 300, note: 'Broad C5 group shortlist. ZI.1 and ZI.2 authorize only listed parts/service activities, not every automotive business. Select the specific activity above where available.' },
  { id: 'office', label: 'Offices and administration', groups: ['C1'], aliases: ['office','offices','administration','bureau','bureaux','C1'], note: broad },
  { id: 'restaurant', label: 'Restaurant / café', groups: ['C2'], aliases: ['restaurant','restaurants','cafe','coffee shop','dining','restauration','C2c'], classificationPage: 297, note: 'Restaurant activity is associated with subgroup C2c. Results use the broad C2 baseline table; subgroup restrictions, site conditions and zone exceptions are not yet resolved.' },
  { id: 'retail', label: 'Retail shops', groups: ['C2'], aliases: ['retail','shop','shops','store','stores','commerce detail','magasin','boutique','C2b'], classificationPage: 296, note: 'Retail is associated with subgroup C2b. Results use the broad C2 baseline table, not a confirmed permission for each type of store. Review subgroup restrictions and zone exceptions.' },
  { id: 'hotel', label: 'Hotel / accommodation', groups: ['C2'], aliases: ['hotel','motel','lodging','accommodation','hebergement','auberge','C2d'], classificationPage: 297, note: 'Accommodation is associated with subgroup C2d. This is a broad C2 shortlist; accommodation-specific restrictions, zone exceptions and approvals remain unverified.' },
  { id: 'services', label: 'Commercial services', groups: ['C2'], aliases: ['commercial services','personal services','service business','commerce services','C2a','C2'], note: broad },
  { id: 'bar', label: 'Bars and drinking establishments', groups: ['C3'], aliases: ['bar','bars','pub','nightclub','debit de boisson','C3'], classificationPage: 298, note: broad },
  { id: 'gas-station', label: 'Gas stations / EV charging', groups: ['C6'], aliases: ['gas station','fuel station','petrol station','ev charging','charging station','poste essence','station recharge','C6'], classificationPage: 301, note: broad },
  { id: 'heavy-commercial', label: 'Heavy commercial businesses', groups: ['C7'], aliases: ['heavy commercial','equipment rental','machinery','commerce lourd','C7'], classificationPage: 302, note: broad },
  { id: 'institution', label: 'Institutional and community facilities', groups: ['P1'], aliases: ['school','daycare','library','community','institution','ecole','garderie','bibliotheque','P1'], note: broad },
  { id: 'gathering', label: 'Gathering and assembly activities', groups: ['P2'], aliases: ['assembly','gathering','event hall','rassemblement','P2'], note: broad },
  { id: 'cemetery', label: 'Cemeteries', groups: ['P3'], aliases: ['cemetery','cemeteries','cimetiere','P3'], note: broad },
  { id: 'outdoor-recreation', label: 'Low-impact outdoor recreation', groups: ['R1'], aliases: ['outdoor recreation','nature recreation','recreation extensive','R1'], note: broad },
  { id: 'recreation', label: 'Intensive recreation', groups: ['R2'], aliases: ['recreation','sports','leisure','recreation intensive','R2'], note: broad },
  { id: 'golf', label: 'Golf', groups: ['R3'], aliases: ['golf','golf course','terrain golf','R3'], note: broad },
  { id: 'light-industry', label: 'Craft and light industry', groups: ['I1'], aliases: ['light industry','craft','manufacturing','artisanat','industrie legere','I1'], note: broad },
  { id: 'warehouse', label: 'Warehousing, distribution and wholesale', groups: ['I2'], aliases: ['warehouse','warehousing','distribution','wholesale','storage','entreposage','commerce gros','I2'], note: broad },
  { id: 'heavy-industry', label: 'Heavy industry', groups: ['I3'], aliases: ['heavy industry','industrial plant','industrie lourde','I3'], note: broad },
  { id: 'extraction', label: 'Industrial extraction', groups: ['I4'], aliases: ['quarry','sand pit','extraction','carriere','sabliere','I4'], note: broad },
  { id: 'public-service', label: 'Light public-service equipment', groups: ['E1'], aliases: ['public service','infrastructure','equipement service public leger','E1'], note: broad },
  { id: 'heavy-public-service', label: 'High-impact public-service equipment', groups: ['E2'], aliases: ['heavy public service','equipement service public contraignant','E2'], note: broad },
  { id: 'farming', label: 'Crop farming', groups: ['A1'], aliases: ['farm','farming','crops','agriculture','culture','A1'], note: broad },
  { id: 'livestock', label: 'Livestock farming', groups: ['A2'], aliases: ['livestock','animal farm','elevage','A2'], note: broad },
];
export function findActivities(query: string): Activity[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const exact = ACTIVITIES.filter(a => a.aliases.some(x => normalize(x) === q) || normalize(a.label) === q);
  if (exact.length) return exact;
  const tokens = q.split(' ');
  return ACTIVITIES.filter(a => [a.label, ...a.aliases].some(text => tokens.every(t => normalize(text).includes(t))));
}
export function activityMatches(activity: Activity, matrix: UseMatrix, zones: Zone[]): ActivityMatch[] {
  const matches: ActivityMatch[] = [];
  for (const [type, row] of Object.entries(matrix.types)) {
    // Articles 1370 and 1388 list permitted C5 services; sales/rental are not among them.
    if (['car-sales', 'car-rental'].includes(activity.id) && ['ZI.1', 'ZI.2'].includes(type)) continue;
    for (const group of activity.groups) {
      const rule = row.groups[group];
      if (!rule || !['A','C','AC'].includes(rule.symbol)) continue;
      matches.push({ type, symbol: rule.symbol as 'A'|'C'|'AC', group, sourceUrl: `${matrix.sourceUrl}#page=${rule.page}`, zoneCount: zones.filter(z => z.type === type).length, scope: 'baseline-candidate' });
      break;
    }
  }
  return matches.sort((a,b) => a.symbol.localeCompare(b.symbol) || a.type.localeCompare(b.type, undefined, {numeric:true}));
}
export function activityCandidateZones(activity: Activity, matrix: UseMatrix, zones: Zone[]): Zone[] {
  const types = new Set(activityMatches(activity, matrix, zones).map(row => row.type));
  return zones.filter(zone => types.has(zone.type));
}

export function activityFilterTypes(id: string, matrix: UseMatrix | null, zones: Zone[]): string[] | null {
  const activity = ACTIVITIES.find(item => item.id === id);
  // Pending/failed data is not an empty candidate set: leave regular zoning visible.
  if (!activity || !matrix) return null;
  return activityMatches(activity, matrix, zones).map(row => row.type);
}
export function useStatusLabel(symbol: ActivityMatch['symbol']): string {
  return symbol === 'AC' ? 'Mixed A + C — specific activity requires review'
    : symbol === 'C' ? 'Conditional group C — approval required' : 'Baseline group A';
}
