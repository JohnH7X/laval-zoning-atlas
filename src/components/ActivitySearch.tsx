import { useState } from 'react';
import { ArrowUpRight, ChevronRight, Search, X } from 'lucide-react';
import { ACTIVITIES, CODE_PDF, activityMatches, findActivities, useStatusLabel, type Activity, type UseMatrix } from '../lib/activities';
import type { Zone } from '../lib/types';

export default function ActivitySearch({ matrix, zones, activeId, onChoose, onMilieu, error }: {
  matrix: UseMatrix | null; zones: Zone[]; activeId: string; onChoose: (id:string)=>void; onMilieu: (type:string)=>void; error: boolean;
}) {
  const [query,setQuery] = useState('');
  const found = findActivities(query);
  const active: Activity | undefined = ACTIVITIES.find(a=>a.id===activeId);
  const matches = active && matrix ? activityMatches(active,matrix,zones) : [];
  const count = matches.reduce((sum,row)=>sum+row.zoneCount,0);
  return <section className="activity-search" aria-label="Reverse zoning activity search">
    <label className="field-label" htmlFor="activity-search">FIND ZONING BY ACTIVITY</label>
    <div className="search-input"><Search size={17}/><input id="activity-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. car sales, restaurant, warehouse" autoComplete="off"/>{query && <button aria-label="Clear activity search" onClick={()=>setQuery('')}><X size={14}/></button>}</div>
    <p className="search-hint">English or French · activity → candidate zones</p>
    {!active && !query && <div className="activity-examples">{['car-sales','restaurant','warehouse'].map(id=><button key={id} onClick={()=>onChoose(id)}>{ACTIVITIES.find(a=>a.id===id)?.label.split(' /')[0]}</button>)}</div>}
    {query.trim().length>=2 && <div className="activity-options" aria-live="polite">{found.length ? found.map(a=><button key={a.id} className="result" onClick={()=>{onChoose(a.id);setQuery('');}}><span><strong>{a.label}</strong><small>{a.groups.join(', ')}{a.officialCode ? ` · official use ${a.officialCode}` : ' · broad group shortlist'}</small></span><ChevronRight size={13}/></button>) : <p className="assessment-note">Activity not in this search dictionary. Try a broader term or the official French activity name. No permission or prohibition is inferred.</p>}</div>}
    {error && <p className="context-warning">Activity filter unavailable: use-table data could not load. Regular zoning remains visible; no activity matches have been evaluated.</p>}
    {active && <div className="activity-summary"><div className="activity-selected"><strong>{active.label}</strong><button aria-label="Clear activity filter" onClick={()=>onChoose('')}><X size={14}/></button></div>
      {!matrix ? <p className="assessment-note">{error ? 'Activity results unavailable. Reload to try again.' : 'Loading official baseline use tables…'}</p> : <><div className="candidate-label">{count.toLocaleString('en-CA')} baseline candidate zones · {matches.length} milieu types</div><p className="activity-warning"><strong>Zone exceptions not checked.</strong> A = baseline group authorization; C = conditional approval; A+C = mixed components requiring specific-use review. None confirms this activity at a particular property.</p><p className="activity-detail">{active.note}</p>
      {active.classificationPage && <a className="activity-source-link" href={`${CODE_PDF}#page=${active.classificationPage}`} target="_blank" rel="noreferrer">Official activity classification (French PDF) <ArrowUpRight size={12}/></a>}
      {active.groups.includes('C5') && <a className="activity-source-link" href={`${CODE_PDF}#page=351`} target="_blank" rel="noreferrer">Automotive conditional-approval rules <ArrowUpRight size={12}/></a>}
      {matches.length ? <div className="activity-milieux">{matches.map(row=><div key={row.type}><button onClick={()=>onMilieu(row.type)} aria-label={`Show ${row.type} candidate zones`}><span className={`use-badge ${row.symbol!=='A'?'conditional':''}`} title={useStatusLabel(row.symbol)}>{row.symbol==='AC'?'A+C':row.symbol}</span><span><strong>{row.type}</strong><small>{row.zoneCount} zones · {row.group}</small></span><ChevronRight size={12}/></button><a href={row.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Official ${row.type} ${row.group} use table`}><ArrowUpRight size={13}/></a></div>)}</div> : <p className="assessment-note">No baseline group match. Individual zone exceptions may still allow this activity; this is not a citywide prohibition.</p>}
      <p className="assessment-source">Ville de Laval CDU · edition {matrix.documentDate} · checked {matrix.checkedDate}. Verify the selected zone’s grid, other rules and outdoor display/parking before relying on a match.</p></>}
    </div>}
  </section>;
}
