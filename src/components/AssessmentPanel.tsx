import { useEffect, useState } from 'react';
import { ArrowUpRight, Building2, ChevronDown } from 'lucide-react';
import { getJSON } from '../lib/data';
import { formatValue, loadAssessments, TAX_LOOKUP_URL, type Assessment, type AssessmentMetadata } from '../lib/assessment';

export default function AssessmentPanel({ addressId, addressTitle }: { addressId: string; addressTitle: string }) {
  const [metadata, setMetadata] = useState<AssessmentMetadata | null>(null);
  const [records, setRecords] = useState<Assessment[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setStatus('loading'); setRecords([]); setSelectedId('');
    void getJSON<AssessmentMetadata>('/data/assessment/metadata.json').then(async meta => {
      const found = await loadAssessments(addressId, addressTitle, meta);
      if (!active) return;
      setMetadata(meta); setRecords(found); setSelectedId(found.length === 1 ? found[0].id : ''); setStatus('done');
    }).catch(e => { if (active) { setError(e.message); setStatus('error'); } });
    return () => { active = false; };
  }, [addressId, addressTitle]);
  const selected = records.find(r => r.id === selectedId);
  return <section className="assessment-panel" aria-label="Property assessment">
    <h3><Building2 size={15}/> Property assessment <span>CAD</span></h3>
    {status === 'loading' && <p className="assessment-note" role="status">Loading public assessment data…</p>}
    {status === 'error' && <p className="assessment-note" role="alert">Assessment data could not be loaded. {error}</p>}
    {status === 'done' && records.length === 0 && <p className="assessment-note">No exact, unambiguous address link was found in the assessment snapshot. Address ranges, changed addresses and duplicate map points are not guessed. Check Laval’s official lookup.</p>}
    {records.length > 1 && <><p className="assessment-note">{records.length} assessment units share this address. Choose the correct unit; values are not combined.</p><div className="select-wrap"><select aria-label="Select assessment unit" value={selectedId} onChange={e => setSelectedId(e.target.value)}><option value="">Choose an assessment unit</option>{records.map(record => <option key={record.id} value={record.id}>{record.addresses.join(' / ')} · {record.id}</option>)}</select><ChevronDown size={14}/></div></>}
    {selected && <>
      <div className="assessment-total"><span>TOTAL ASSESSED VALUE</span><strong>{formatValue(selected.totalValue)}</strong></div>
      <dl className="assessment-values"><div><dt>Land</dt><dd>{formatValue(selected.landValue)}</dd></div><div><dt>Building</dt><dd>{formatValue(selected.buildingValue)}</dd></div><div><dt>Previous roll total</dt><dd>{formatValue(selected.previousValue)}</dd></div><div><dt>Land area</dt><dd>{selected.landArea === null ? 'Not provided' : new Intl.NumberFormat('en-CA').format(selected.landArea) + ' m²'}</dd></div><div><dt>Year built</dt><dd>{selected.builtYear || 'Not provided'}{selected.builtYearStatus === 'E' ? ' (estimated)' : ''}</dd></div><div><dt>Housing units</dt><dd>{selected.dwellings ?? 'Not provided'}</dd></div></dl>
      <div className="assessment-id"><span>ASSESSMENT ID</span><code>{selected.id}</code></div>
      <p className="assessment-note">Role start: {selected.roleYear}. Market reference: {selected.marketDate || 'Not provided'}. Assessment values are not current market prices or annual tax bills.</p>
    </>}
    <a className="assessment-tax-link" href={TAX_LOOKUP_URL} target="_blank" rel="noreferrer">Official assessment & tax lookup <ArrowUpRight size={13}/></a>
    <p className="assessment-source">Source: MAMH / Laval · CC BY 4.0{metadata && <> · File modified {metadata.sourceDate}</>}. Public situs addresses only; no owner data. Address point is not a parcel boundary.</p>
  </section>;
}
