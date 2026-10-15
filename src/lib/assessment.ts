import { getJSON } from './data';

export interface Assessment {
  id: string;
  addresses: string[];
  roleYear: string;
  marketDate: string | null;
  landValue: number | null;
  buildingValue: number | null;
  totalValue: number | null;
  previousValue: number | null;
  landArea: number | null;
  builtYear: string | null;
  builtYearStatus: string | null;
  dwellings: number | null;
  useCode: string | null;
}
export interface AssessmentMetadata {
  sourceDate: string;
  checkedDate: string;
  roleYear: string;
  sourceUnits: number;
  matchedUnits: number;
  matchedAddresses: number;
  ambiguousAssessmentAddresses: number;
  shards: string[];
  catalogUrl: string;
}
interface AssessmentShard { byAddress: Record<string, string[]>; records: Record<string, Assessment> }
const cache = new Map<string, Promise<AssessmentShard>>();
export async function loadAssessments(addressId: string, addressTitle: string, metadata: AssessmentMetadata): Promise<Assessment[]> {
  const id = addressId.match(/^address-(\d+)$/)?.[1];
  const civic = addressTitle.match(/^\d+/)?.[0];
  if (!id || !civic) return [];
  const key = civic.slice(0, 2).padStart(2, '0');
  if (!metadata.shards.includes(key)) return [];
  if (!cache.has(key)) cache.set(key, getJSON<AssessmentShard>(`/data/assessment/${key}.json`).catch(error => { cache.delete(key); throw error; }));
  const data = await cache.get(key)!;
  return (data.byAddress[id] || []).map(recordId => data.records[recordId]).filter(Boolean);
}
const dollars = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
export function formatValue(value: number | null): string { return value === null ? 'Not provided' : dollars.format(value); }
export const TAX_LOOKUP_URL = 'https://www.laval.ca/taxes-evaluation-fonciere/consulter-role-evaluation-taxation/';
