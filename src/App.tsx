import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Info, Layers, MapPin, RotateCcw, Search, ShieldAlert, SlidersHorizontal, X } from 'lucide-react';
import MapView from './components/MapView';
import AssessmentPanel from './components/AssessmentPanel';
import ZoneDescription from './components/ZoneDescription';
import ActivitySearch from './components/ActivitySearch';
import { ACTIVITIES, activityMatches, activityFilterTypes, useStatusLabel, type UseMatrix } from './lib/activities';
import { changeMilieu, selectDropdownZone, zonesForType, type DescriptionCatalog } from './lib/zoning';
import { DEFAULT_VIEW, encodeView, getJSON, loadAtlas, readView } from './lib/data';
import { searchAtlas } from './lib/search';
import { FAMILIES, type Metadata, type SearchResult, type ViewState, type Zone } from './lib/types';

const SOURCE_URL = 'https://www.donneesquebec.ca/recherche/dataset/cdu-type-milieux';
const REGULATIONS_URL = 'https://info-reglements.laval.ca/consultation/';
const numberFormat = new Intl.NumberFormat('en-CA');

export default function App() {
  const [initial] = useState(readView);
  const [view, setView] = useState<ViewState>(initial);
  const [zones, setZones] = useState<Zone[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [searchError, setSearchError] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [focus, setFocus] = useState<{ coordinates: [number, number]; zoom: number; serial: number } | null>(null);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [addressCoordinates, setAddressCoordinates] = useState<[number, number] | null>(null);
  const [opacity, setOpacity] = useState(0.5);
  const [about, setAbout] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [shareMessage, setShareMessage] = useState('');
  const [descriptions, setDescriptions] = useState<DescriptionCatalog | null>(null);
  const [descriptionState, setDescriptionState] = useState<'loading' | 'done' | 'error'>('loading');
  const [useMatrix, setUseMatrix] = useState<UseMatrix | null>(null);
  const [useError, setUseError] = useState(false);
  const searchId = useRef(0);
  const selected = zones.find(z => z.code === view.zone) || null;
  const activeActivity = ACTIVITIES.find(a => a.id === view.activity);
  const activeMatches = activeActivity && useMatrix ? activityMatches(activeActivity, useMatrix, zones) : [];
  const activityTypes = activityFilterTypes(view.activity, useMatrix, zones);
  const availableZones = activityTypes ? zones.filter(z => activityTypes.includes(z.type)) : zones;
  const selectedActivityMatch = selected ? activeMatches.find(row => row.type === selected.type) : null;
  const milieuTypes = [...new Set(availableZones.map(z => z.type))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const dropdownZones = zonesForType(availableZones, view.milieu);
  const dropdownValue = dropdownZones.some(z => z.code === view.zone) ? view.zone : '';
  const visibleCount = availableZones.filter(z => (!view.milieu || z.type === view.milieu) && (!view.zoneFilter || z.number === view.zoneFilter)).length;

  useEffect(() => {
    void loadAtlas().then(data => { setZones(data.zones); setMetadata(data.metadata); }).catch(e => setError(e.message));
    const onHash = () => {
      const next = readView(); setView(next);
      setSelectedAddress(''); setSelectedAddressId(''); setAddressCoordinates(null);
      setFocus({ coordinates: [next.lng, next.lat], zoom: next.zoom, serial: Date.now() });
    };
    void getJSON<DescriptionCatalog>('/data/milieu-descriptions.json').then(data => { setDescriptions(data); setDescriptionState('done'); }).catch(() => setDescriptionState('error'));
    void getJSON<UseMatrix>('/data/use-matrix.json').then(setUseMatrix).catch(() => setUseError(true));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (view.activity && !activeActivity) { setView(current => ({ ...current, activity: '' })); return; }
    if (!zones.length || (view.activity && !useMatrix)) return;
    if (view.milieu && !availableZones.some(z => z.type === view.milieu)) { setView(current => ({ ...current, milieu: '', zone: '', zoneFilter: '' })); setSelectedAddress(''); setSelectedAddressId(''); setAddressCoordinates(null); return; }
    const incompatibleZone = !!view.zone && !availableZones.some(z => z.code === view.zone && (!view.milieu || z.type === view.milieu));
    const incompatibleFilter = !!view.zoneFilter && !availableZones.some(z => z.number === view.zoneFilter && (!view.milieu || z.type === view.milieu));
    if (incompatibleZone || incompatibleFilter) {
      setView(current => ({ ...current, zone: incompatibleZone ? '' : current.zone, zoneFilter: incompatibleFilter ? '' : current.zoneFilter }));
      setSelectedAddress(''); setSelectedAddressId(''); setAddressCoordinates(null);
    }
  }, [zones, view.zone, view.zoneFilter, view.milieu, view.activity, useMatrix]);

  useEffect(() => {
    if (!metadata) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search + encodeView(view));
  }, [view, metadata]);

  useEffect(() => {
    const current = ++searchId.current;
    if (!metadata || query.trim().length < 2) { setResults([]); setSearchState('idle'); return; }
    const controller = new AbortController();
    setSearchState('loading');
    const timer = window.setTimeout(() => {
      void searchAtlas(query, zones, metadata.addressShards, controller.signal).then(found => {
        if (current !== searchId.current) return;
        setResults(found.results); setTruncated(found.truncated); setSearchState('done');
      }).catch(e => { if (!controller.signal.aborted && current === searchId.current) { setSearchError(e.message); setSearchState('error'); } });
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, metadata, zones]);

  function choose(result: SearchResult) {
    setView(current => ({ ...current, zone: result.zoneCodes.length === 1 ? result.zoneCodes[0] : '', milieu: '', zoneFilter: '', activity: '', visible: true }));
    setSelectedAddress(result.kind === 'address' ? result.title : '');
    setSelectedAddressId(result.kind === 'address' ? result.id : '');
    setAddressCoordinates(result.kind === 'address' ? result.coordinates : null);
    setFocus({ coordinates: result.coordinates, zoom: result.kind === 'address' ? 16.3 : 14.2, serial: Date.now() });
    setQuery(''); setResults([]); setSearchState('idle');
    if (window.innerWidth < 760) setRailOpen(false);
  }
  function reset() {
    setView({ ...DEFAULT_VIEW }); setSelectedAddress(''); setQuery('');
    setSelectedAddressId(''); setAddressCoordinates(null);
    setFocus({ coordinates: [DEFAULT_VIEW.lng, DEFAULT_VIEW.lat], zoom: DEFAULT_VIEW.zoom, serial: Date.now() });
  }
  async function share() {
    try { await navigator.clipboard.writeText(window.location.href); setShareMessage('Link copied'); }
    catch { setShareMessage('Copy the URL from your browser address bar'); }
    window.setTimeout(() => setShareMessage(''), 3500);
  }
  function chooseActivity(activity: string) {
    setView(current => ({ ...current, activity, milieu: '', zone: '', zoneFilter: '', visible: true }));
    setSelectedAddress(''); setSelectedAddressId(''); setAddressCoordinates(null);
    setFocus({ coordinates: [DEFAULT_VIEW.lng, DEFAULT_VIEW.lat], zoom: DEFAULT_VIEW.zoom, serial: Date.now() });
  }
  function chooseMilieu(milieu: string) {
    setView(current => changeMilieu(current, milieu, availableZones));
    setSelectedAddress(''); setSelectedAddressId(''); setAddressCoordinates(null);
  }
  function chooseZone(code: string) {
    setView(current => selectDropdownZone(current, code, availableZones));
    setSelectedAddress(''); setSelectedAddressId(''); setAddressCoordinates(null);
    const match = dropdownZones.find(zone => zone.code === code);
    if (match) {
      setFocus({ coordinates: match.center, zoom: 14.2, serial: Date.now() });
      if (window.innerWidth < 760) setRailOpen(false);
    }
  }


  return <div className="atlas-app">
    <header className="topbar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); reset(); }} aria-label="Laval Zoning Atlas home">
        <svg className="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M5 29 15 7l12 3 8 17-14 8L5 29Z" stroke="currentColor" strokeWidth="1.5"/><path d="m11 26 7-13 7 2 5 10-9 5-10-4Z" stroke="currentColor" strokeWidth="1.5"/><path d="m17 24 4-6 4 5-4 3-4-2Z" fill="currentColor"/></svg>
        <span className="wordmark">LAVAL <span>ZONING ATLAS</span></span>
      </a>
      <div className="topbar-middle"><span className="edition">INDEPENDENT MAP EXPLORER</span><span className="pill">Québec, Canada</span></div>
      <nav className="header-actions"><button className="quiet-button about-button" onClick={() => setAbout(true)}><Info size={16}/> About the data</button><button className="share-button" onClick={share}>{shareMessage === 'Link copied' ? <Check size={16}/> : <Copy size={16}/>}<span>{shareMessage || 'Share view'}</span></button></nav>
    </header>
    <main className="workspace">
      {metadata && <MapView initial={initial} selected={selected} milieu={view.milieu} zoneFilter={view.zoneFilter} activityTypes={activityTypes} visible={view.visible} opacity={opacity} focus={focus} addressCoordinates={addressCoordinates}
        onSelect={code => { setView(current => ({ ...current, zone: code })); setSelectedAddress(''); setSelectedAddressId(''); setAddressCoordinates(null); }}
        onMove={position => setView(current => ({ ...current, ...position }))}/>}
      {error && <div className="fatal-error" role="alert">{error}<button onClick={() => window.location.reload()}>Reload map</button></div>}
      <button className="rail-toggle" onClick={() => setRailOpen(!railOpen)} aria-label={railOpen ? 'Close explorer' : 'Open explorer'}>{railOpen ? <ChevronLeft size={18}/> : <SlidersHorizontal size={18}/>}</button>
      <aside className={`explorer-rail ${railOpen ? '' : 'collapsed'}`} aria-label="Map explorer">
        <div className="rail-heading"><div className="eyebrow">EXPLORE THE TERRITORY</div><h1>A clearer view<br/>of Laval zoning.</h1><p>Find a location. Understand its zone.<br/>Verify the rules with the city.</p></div>
        <section className="search-section"><label htmlFor="atlas-search" className="field-label">FIND AN ADDRESS OR ZONE</label><div className="search-input"><Search size={18}/><input id="atlas-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. 5807 or 100 boulevard…" autoComplete="off" aria-describedby="search-hint"/>{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={15}/></button>}</div>
          <p id="search-hint" className="search-hint">Search by civic number, street or zone code.</p>
          {searchState === 'loading' && <div className="search-feedback" role="status"><span className="spinner"/> Searching Laval addresses…</div>}
          {searchState === 'error' && <div className="search-feedback error" role="alert">{searchError}</div>}
          {searchState === 'done' && results.length === 0 && <div className="search-feedback">No matching address or zone. Try a civic number and street. The address snapshot is from 2025.</div>}
          {searchState === 'done' && results.length > 0 && <div className="search-results"><div className="result-heading">{results.length > 1 ? 'CHOOSE THE CORRECT LOCATION' : 'SELECT TO VIEW ON MAP'}{truncated && <span>Refine your search</span>}</div>{results.map(r => <button key={r.id} className="result" onClick={() => choose(r)}><MapPin size={16}/><span><strong>{r.title}</strong><small>{r.subtitle}</small>{results.filter(other => other.title === r.title).length > 1 && <small>Location {r.coordinates[1].toFixed(5)}, {r.coordinates[0].toFixed(5)}</small>}</span><ChevronRight size={14}/></button>)}</div>}
        </section>
        <ActivitySearch matrix={useMatrix} zones={zones} activeId={view.activity} onChoose={chooseActivity} onMilieu={chooseMilieu} error={useError}/>
        <section className="controls-section"><div className="section-heading"><h2><Layers size={17}/> Zoning layer</h2><button className={`toggle ${view.visible ? 'on' : ''}`} role="switch" aria-checked={view.visible} aria-label="Show zoning layer" onClick={() => setView(current => ({ ...current, visible: !current.visible }))}><span/></button></div><div className="opacity-row"><span>Overlay opacity</span><input aria-label="Zoning overlay opacity" type="range" min="0.1" max="0.85" step="0.05" value={opacity} onChange={e => setOpacity(Number(e.target.value))}/><span>{Math.round(opacity * 100)}%</span></div>
          <div className="field-row"><label className="field-label" htmlFor="milieu-filter">MILIEU TYPE</label><div className="select-wrap"><select id="milieu-filter" value={view.milieu} onChange={e => chooseMilieu(e.target.value)}><option value="">All milieu types</option>{milieuTypes.map(type => <option key={type} value={type}>{type} — {descriptions?.types[type]?.title || FAMILIES[type.split('.')[0]]?.label || type}</option>)}</select><ChevronDown size={14}/></div></div>
          <div className="field-row"><label className="field-label" htmlFor="zone-filter">{view.milieu ? `ZONES IN ${view.milieu}` : 'ZONE · GROUPED BY MILIEU'}</label><div className="select-wrap"><select id="zone-filter" value={dropdownValue} onChange={e => chooseZone(e.target.value)} disabled={!zones.length}><option value="">{view.milieu ? `All ${dropdownZones.length} zones in ${view.milieu}` : `All ${availableZones.length} ${view.activity && useMatrix ? 'candidate ' : ''}zones`}</option>{view.milieu ? dropdownZones.map(z => <option key={z.code} value={z.code}>{z.code} — {descriptions?.types[z.type]?.title || FAMILIES[z.family]?.label}</option>) : milieuTypes.map(type => <optgroup key={type} label={`${type} — ${descriptions?.types[type]?.title || FAMILIES[type.split('.')[0]]?.label || type}`}>{dropdownZones.filter(z => z.type === type).map(z => <option key={z.code} value={z.code}>{z.code}</option>)}</optgroup>)}</select><ChevronDown size={14}/></div><p className="search-hint">Choose a zone to highlight it and read its description.</p></div>
          {view.milieu && <ZoneDescription description={descriptions?.types[view.milieu]} type={view.milieu} checkedDate={descriptions?.checkedDate} loading={descriptionState === 'loading'}/>}
          {descriptionState === 'error' && <p className="context-warning">Descriptions could not be loaded. Official rules remain available through Laval.</p>}
          <div className="filter-footer"><span><strong>{numberFormat.format(visibleCount)}</strong> {view.visible ? 'zones shown' : 'zones · layer hidden'}</span><button className="text-button" onClick={() => { setView(current => ({ ...current, milieu: '', zoneFilter: '', zone: '', activity: '' })); setSelectedAddress(''); setSelectedAddressId(''); setAddressCoordinates(null); }}><RotateCcw size={12}/> Reset filters</button></div>
          {(view.milieu || view.zoneFilter || view.activity) && <div className="active-filters">{view.activity && <span>{activeActivity?.label || 'Activity'}<button aria-label="Remove activity filter" onClick={() => chooseActivity('')}><X size={11}/></button></span>}{view.milieu && <span>{view.milieu}<button aria-label="Remove milieu filter" onClick={() => chooseMilieu('')}><X size={11}/></button></span>}{view.zoneFilter && <span>Zone {view.zoneFilter}<button aria-label="Remove zone filter" onClick={() => { chooseZone(''); }}><X size={11}/></button></span>}</div>}
        </section>
        <section className="legend-section"><div className="section-heading"><h2>Map legend</h2><span className="small-label">MILIEU FAMILIES</span></div><div className="legend-grid">{Object.entries(FAMILIES).map(([code, item]) => <div className="legend-item" key={code}><i style={{ background: item.color }}/><span>{code}</span><small>{item.label}</small></div>)}</div><div className="legend-key"><span className="selected-key"/> Selected zone <span className="quality-key"/> Source geometry issue</div></section>
        <div className="rail-data"><span className="live-dot"/><span>OFFICIAL LAVAL OPEN DATA</span><strong>{metadata?.zoningDate || 'Loading…'}</strong></div>
      </aside>
      {selected ? <section className="zone-card" aria-label="Selected zone details"><div className="zone-card-top"><div className="eyebrow">SELECTED ZONE</div><button onClick={() => { chooseZone(''); }} aria-label="Close zone details"><X size={18}/></button></div><div className="zone-code">{selected.code}</div><div className="zone-type" style={{ borderColor: FAMILIES[selected.family]?.color }}><i style={{ background: FAMILIES[selected.family]?.color }}/>{FAMILIES[selected.family]?.label || selected.family}</div>{selectedAddress && <div className="selected-address"><MapPin size={15}/>{selectedAddress}</div>}<div className="zone-fields"><div><span>ZONE NUMBER</span><strong>{selected.number}</strong></div><div><span>MILIEU TYPE</span><strong>{selected.type}</strong></div></div>
        {selected.qualityIssue && <div className="quality-warning"><ShieldAlert size={18}/><span><strong>Source geometry issue</strong>This boundary has a known self-intersection. Original coordinates are retained. Confirm the boundary with Laval.</span></div>}
        {(view.milieu && view.milieu !== selected.type || view.zoneFilter && view.zoneFilter !== selected.number) && <p className="context-warning">This selected zone is outside the active filter.</p>}
        {activeActivity && selectedActivityMatch && <div className="quality-warning"><ShieldAlert size={16}/><span><strong>Candidate: {activeActivity.label}</strong>{useStatusLabel(selectedActivityMatch.symbol)} · {selectedActivityMatch.group}. Zone exceptions are not checked. <a href={selectedActivityMatch.sourceUrl} target="_blank" rel="noreferrer">Read official use table</a></span></div>}
        <ZoneDescription description={descriptions?.types[selected.type]} code={selected.code} type={selected.type} checkedDate={descriptions?.checkedDate} loading={descriptionState === 'loading'}/>
        {selectedAddressId ? <AssessmentPanel key={selectedAddressId} addressId={selectedAddressId} addressTitle={selectedAddress}/> : <p className="assessment-note">Search and select an address to view property assessment data. A zone contains many properties.</p>}
        <p className="zone-note">Milieu type is not a complete statement of permitted uses, height or development rights.</p><a className="primary-link" href={REGULATIONS_URL} target="_blank" rel="noreferrer">Verify rules with Laval <ArrowUpRight size={16}/></a><a className="secondary-link" href={SOURCE_URL} target="_blank" rel="noreferrer">View municipal zoning dataset <ArrowUpRight size={13}/></a><div className="card-source">Source: Ville de Laval · {metadata?.zoningDate}</div></section> : selectedAddressId ? <section className="zone-card" aria-label="Selected address details"><div className="zone-card-top"><div className="eyebrow">SELECTED ADDRESS</div><button onClick={() => { setSelectedAddressId(''); setAddressCoordinates(null); setSelectedAddress(''); }} aria-label="Close address details"><X size={18}/></button></div><div className="selected-address"><MapPin size={15}/>{selectedAddress}</div><p className="assessment-note">No unique zoning assignment. Confirm zoning separately with Laval.</p><AssessmentPanel key={selectedAddressId} addressId={selectedAddressId} addressTitle={selectedAddress}/></section> : <div className="map-instruction"><MapPin size={17}/><span>Click a zone to explore its details</span></div>}
      <button className="extent-button" onClick={reset}><RotateCcw size={14}/> Laval overview</button>
      <div className="disclaimer"><ShieldAlert size={15}/><span><strong>Screening map only.</strong> Not a cadastral plan or building-permission determination. Verify boundaries and applicable rules with Laval.</span><button onClick={() => setAbout(true)}>Data notes <ArrowUpRight size={12}/></button></div>
    </main>
    {about && <div className="modal-backdrop" onClick={() => setAbout(false)}><section className="about-modal" role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setAbout(false)} aria-label="Close data notes"><X size={20}/></button><div className="eyebrow">PROVENANCE & LIMITATIONS</div><h2 id="about-title">The data behind the map.</h2><p>This independent atlas uses municipal open data. It is not an official Ville de Laval application and does not imply municipal endorsement.</p><div className="source-stat-grid"><div><strong>{metadata ? numberFormat.format(metadata.zoneCount) : '—'}</strong><span>Zoning polygons</span></div><div><strong>{metadata ? numberFormat.format(metadata.addressCount) : '—'}</strong><span>Address points</span></div><div><strong>{metadata?.milieuCount || '—'}</strong><span>Milieu codes</span></div></div><dl className="source-dates"><div><dt>Zoning resource date</dt><dd>{metadata?.zoningDate}</dd></div><div><dt>Address resource date</dt><dd>{metadata?.addressDate}</dd></div><div><dt>Zoning catalog last checked</dt><dd>{metadata?.checkedDate}</dd></div><div><dt>License</dt><dd><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></dd></div></dl><h3>Boundaries are kept as published</h3><p>No zoning coordinates have been simplified or repaired. Five polygons have known ring self-intersections and are outlined with dashed rust-colored lines. These require verification with the city, not automatic legal boundary correction.</p><div className="issue-codes">{metadata?.geometryIssues.map(i => <button key={i.zone} onClick={() => { const z = zones.find(zone => zone.code === i.zone); if (z) choose({ id: z.code, kind: 'zone', title: z.code, subtitle: '', coordinates: z.center, zoneCodes: [z.code] }); setAbout(false); }}>{i.zone}</button>)}</div><h3>Plain-language descriptions are a shared milieu guide</h3><p>Each zone inherits a short English summary of its milieu’s official intention. The linked full French PDF is the June 8, 2026 code edition, checked October 8, 2026. Each zone’s unique grid and exceptions remain a separate official lookup; this summary is not a complete permitted-use or development-rights assessment.</p><h3>Reverse activity search is a baseline shortlist</h3><p>Activity aliases map to official use groups. A, C and mixed A+C symbols come from the full Title 7 tables. Individual use restrictions and Annex B exceptions can change the result; no property-level permission is confirmed. Vehicle sales use the C5 route and exclude restricted industrial C5 lists. Indoor retail under C2b is a separate route not fully resolved. Conditional approvals, site design, outdoor display and other rules still require official review.</p><h3>Assessment is not a tax bill</h3><p>The current provincial open-data roll supplies Laval public situs addresses and assessed values. The roll starts in 2025; the downloadable file’s modification date is June 12, 2026. Values use the source market-reference date, not today’s market prices. Annual tax amounts and outstanding balances are not in this snapshot; use Laval’s official lookup. Owner names and mailing addresses remain redacted. Exact address matching excludes ranges and ambiguous map points, so coverage is partial.</p><h3>Search is not a parcel lookup</h3><p>The 2025 address snapshot can omit newer locations. Duplicate addresses are shown as separate candidates. An address point is not a lot boundary. Public assessment values are linked only by exact address; ambiguous assessment units remain separate choices. No owner names or private records are included. Milieu family names are English translations of Laval’s CDU headings.</p><div className="source-links"><a href={SOURCE_URL} target="_blank" rel="noreferrer">Zoning source <ArrowUpRight size={14}/></a><a href="https://www.donneesquebec.ca/recherche/dataset/geolocalisation-des-adresses" target="_blank" rel="noreferrer">Address source <ArrowUpRight size={14}/></a><a href={REGULATIONS_URL} target="_blank" rel="noreferrer">Info-règlements <ArrowUpRight size={14}/></a><a href="https://www.donneesquebec.ca/recherche/dataset/roles-d-evaluation-fonciere-du-quebec" target="_blank" rel="noreferrer">Assessment source <ArrowUpRight size={14}/></a><a href="https://www.laval.ca/taxes-evaluation-fonciere/consulter-role-evaluation-taxation/" target="_blank" rel="noreferrer">Official tax lookup <ArrowUpRight size={14}/></a><a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap basemap <ArrowUpRight size={14}/></a></div><p className="modal-footer">Attribution: Ville de Laval, Données Québec · CC BY 4.0. Unused fields removed and address intersections precomputed; original zoning coordinates retained. This snapshot has no automatic updates.</p></section></div>}
  </div>;
}
