export interface Zone {
  code: string;
  number: string;
  type: string;
  family: string;
  qualityIssue: boolean;
  center: [number, number];
  bounds: [number, number, number, number];
}

export interface Metadata {
  checkedDate: string;
  zoningDate: string;
  addressDate: string;
  zoneCount: number;
  addressCount: number;
  milieuCount: number;
  addressShards: string[];
  geometryIssues: { zone: string; reason: string }[];
  zoningSource: string;
  addressSource: string;
  transformations: string;
}

export type AddressRow = [string, string, string, number, number, string[], number];
export interface SearchResult {
  id: string;
  kind: 'address' | 'zone';
  title: string;
  subtitle: string;
  coordinates: [number, number];
  zoneCodes: string[];
}

export interface MapPosition { lng: number; lat: number; zoom: number }
export interface ViewState extends MapPosition { zone: string; milieu: string; zoneFilter: string; activity: string; visible: boolean }

export const FAMILIES: Record<string, { label: string; color: string }> = {
  T1: { label: 'Natural', color: '#81a78c' },
  T2: { label: 'Agricultural', color: '#bdc594' },
  T3: { label: 'Suburban', color: '#edcd82' },
  T4: { label: 'Urban', color: '#e8ae79' },
  T5: { label: 'Compact urban', color: '#dc8e76' },
  T6: { label: 'Urban centrality', color: '#ba797c' },
  CI: { label: 'Institutional', color: '#9b98b9' },
  CE: { label: 'Open space', color: '#afd1bb' },
  ZM: { label: 'Mobile homes', color: '#e2bd9c' },
  ZC: { label: 'Commercial', color: '#d399b7' },
  ZH: { label: 'High technology', color: '#99bdd0' },
  ZI: { label: 'Industrial', color: '#a1aebb' },
  ZE: { label: 'Extraction', color: '#b1a090' },
  ZP: { label: 'Public service', color: '#87afb0' },
  SZD: { label: 'Deferred zoning', color: '#c8c5bb' },
};
