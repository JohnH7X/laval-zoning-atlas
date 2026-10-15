import { ArrowUpRight, BookOpen } from 'lucide-react';
import type { MilieuDescription } from '../lib/zoning';
import { OFFICIAL_GRID_LOOKUP } from '../lib/zoning';

export default function ZoneDescription({ description, code, type, checkedDate, loading = false }: {
  description?: MilieuDescription;
  code?: string;
  type: string;
  checkedDate?: string;
  loading?: boolean;
}) {
  return <section className="zone-description" aria-label={code ? 'Plain-language zone description' : 'Plain-language milieu description'}>
    <div className="description-heading"><BookOpen size={14}/><span>IN PLAIN LANGUAGE</span></div>
    <h3>{description?.title || type}</h3>
    <p>{loading ? 'Loading the source-backed description…' : description?.summary || 'The official description is not available in this snapshot. Consult Laval’s full rules rather than inferring uses from the zone code.'}</p>
    {description && <a href={description.sourceUrl} target="_blank" rel="noreferrer">Read full description (official French PDF) <ArrowUpRight size={12}/></a>}
    <small>{description?.sourceScope === 'family' ? `Shared ${type.split('.')[0]} family summary; subtype differences were not verified.` : description?.sourceScope === 'unavailable' ? 'Description unavailable; the official source remains authoritative.' : `Shared milieu ${type} description, not a complete list of permitted uses.`} {description?.pdfPage && ` Official code edition: 2026-06-08, PDF page ${description.pdfPage}.`} {checkedDate && `Sources checked ${checkedDate}.`}</small>
    {code && <><a className="zone-grid-link" href={OFFICIAL_GRID_LOOKUP} target="_blank" rel="noreferrer">Open Laval’s zone-grid lookup <ArrowUpRight size={12}/></a><small>Search zone <strong>{code.split('-').pop()}</strong> ({code}). Its grid, exceptions and other applicable rules can differ from this shared milieu description.</small></>}
  </section>;
}
