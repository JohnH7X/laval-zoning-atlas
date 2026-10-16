import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as LibreMap, type ExpressionSpecification, type FilterSpecification, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { FAMILIES, type MapPosition, type ViewState, type Zone } from '../lib/types';
import { getJSON } from '../lib/data';
import type { FeatureCollection, Polygon, Point, GeoJsonProperties } from 'geojson';

interface AssessmentIndex { files: string[]; featureCount: number }

interface Props {
  initial: ViewState;
  selected: Zone | null;
  milieu: string;
  zoneFilter: string;
  activityTypes: string[] | null;
  addressCoordinates: [number, number] | null;
  assessmentVisible: boolean;
  visible: boolean;
  opacity: number;
  focus: { coordinates: [number, number]; zoom: number; serial: number } | null;
  onSelect: (code: string) => void;
  onMove: (position: MapPosition) => void;
}

export default function MapView(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('Loading municipal zoning…');
  const marker = useRef<maplibregl.Marker | null>(null);
  const assessmentPopup = useRef<maplibregl.Popup | null>(null);

  useEffect(() => {
    let active = true;
    let instance: LibreMap | null = null;
    async function boot() {
      try {
        const geometry = await getJSON<FeatureCollection<Polygon>>('/data/zones.geojson');
        let style: StyleSpecification;
        try {
          const response = await fetch('https://tiles.openfreemap.org/styles/positron', { signal: AbortSignal.timeout(12000) });
          if (!response.ok) throw new Error('Basemap unavailable');
          style = await response.json();
        } catch {
          style = { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8ece5' } }] };
          if (active) setMessage('Basemap unavailable. Municipal zoning remains visible.');
        }
        if (!active || !host.current) return;
        instance = new maplibregl.Map({ container: host.current, style,
          center: [props.initial.lng, props.initial.lat], zoom: props.initial.zoom, minZoom: 8, maxZoom: 19,
          attributionControl: false, maxBounds: [[-74.15, 45.35], [-73.3, 45.9]],
          canvasContextAttributes: { preserveDrawingBuffer: true } });
        map.current = instance;
        instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
        instance.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
        instance.addControl(new maplibregl.AttributionControl({ compact: true,
          customAttribution: '<a href="https://www.donneesquebec.ca/recherche/dataset/cdu-type-milieux" target="_blank">Ville de Laval · CC BY 4.0</a>' }), 'bottom-right');
        instance.on('load', () => {
          if (!instance || !active) return;
          instance.addSource('laval-zones', { type: 'geojson', data: geometry, tolerance: 0, generateId: false });
          const colors: (string | ExpressionSpecification)[] = [];
          Object.entries(FAMILIES).forEach(([key, value]) => colors.push(key, value.color));
          const color = ['match', ['get', 'family'], ...colors, '#c8c5bb'] as unknown as ExpressionSpecification;
          // Draw beneath street/place labels when the basemap provides symbols.
          const before = instance.getStyle().layers.find(l => l.type === 'symbol')?.id;
          instance.addLayer({ id: 'zoning-fill', type: 'fill', source: 'laval-zones', paint: { 'fill-color': color, 'fill-opacity': 0.5 } }, before);
          instance.addLayer({ id: 'zoning-line', type: 'line', source: 'laval-zones', paint: { 'line-color': '#5b655c', 'line-opacity': 0.55, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.3, 14, 1] } }, before);
          instance.addLayer({ id: 'zoning-quality', type: 'line', source: 'laval-zones', filter: ['==', ['get', 'qualityIssue'], true], paint: { 'line-color': '#b65328', 'line-width': 2.4, 'line-dasharray': [2, 2] } });
          instance.addLayer({ id: 'selected-fill', type: 'fill', source: 'laval-zones', filter: ['==', ['get', 'code'], ''], paint: { 'fill-color': '#285444', 'fill-opacity': 0.22 } });
          instance.addLayer({ id: 'selected-line', type: 'line', source: 'laval-zones', filter: ['==', ['get', 'code'], ''], paint: { 'line-color': '#173e30', 'line-width': 3 } });
          instance.on('click', 'zoning-fill', e => {
            const code = e.features?.[0]?.properties?.code;
            if (typeof code === 'string') callbacks.current.onSelect(code);
          });
          instance.on('mouseenter', 'zoning-fill', () => { if (instance) instance.getCanvas().style.cursor = 'pointer'; });
          instance.on('mouseleave', 'zoning-fill', () => { if (instance) instance.getCanvas().style.cursor = ''; });
          instance.on('moveend', () => {
            if (!instance) return;
            const c = instance.getCenter(); callbacks.current.onMove({ lng: c.lng, lat: c.lat, zoom: instance.getZoom() });
          });
          setReady(true);
          setMessage(current => current.startsWith('Basemap') ? current : '');
        });
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Unable to start map. Your browser needs WebGL support.');
      }
    }
    void boot();
    return () => { active = false; marker.current?.remove(); assessmentPopup.current?.remove(); instance?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const sourceId = 'laval-assessment-units';
    const layerId = 'assessment-unit-points';
    if (!props.assessmentVisible) {
      if (m.getLayer(layerId)) m.setLayoutProperty(layerId, 'visibility', 'none');
      return;
    }
    if (m.getSource(sourceId)) {
      if (m.getLayer(layerId)) m.setLayoutProperty(layerId, 'visibility', 'visible');
      return;
    }
    let cancelled = false;
    void getJSON<AssessmentIndex>('/data/assessment-units/index.json').then(async index => {
      const collections = await Promise.all(index.files.map(file => getJSON<FeatureCollection<Point, GeoJsonProperties>>(`/data/assessment-units/${file}`)));
      if (cancelled || !map.current) return;
      const data: FeatureCollection<Point, GeoJsonProperties> = { type: 'FeatureCollection', features: collections.flatMap(collection => collection.features) };
      m.addSource(sourceId, { type: 'geojson', data });
      m.addLayer({ id: layerId, type: 'circle', source: sourceId, paint: {
        'circle-color': '#254b3c', 'circle-opacity': 0.78,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 2.5, 14, 5.5],
        'circle-stroke-color': '#f8f6ef', 'circle-stroke-width': 1,
      } });
      m.on('mouseenter', layerId, () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', layerId, () => { m.getCanvas().style.cursor = ''; });
      m.on('click', layerId, event => {
        const p = event.features?.[0]?.properties || {};
        const esc = (value: unknown) => String(value ?? '—').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
        const money = (value: unknown) => value == null || value === '' ? '—' : new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(Number(value));
        const area = (value: unknown) => value == null || value === '' ? '—' : `${Number(value).toLocaleString('en-CA')} m²`;
        assessmentPopup.current?.remove();
        assessmentPopup.current = new maplibregl.Popup({ closeButton: true, maxWidth: '310px' }).setLngLat(event.lngLat).setHTML(`<div class="assessment-popup"><div class="popup-kicker">ASSESSMENT UNIT · 2026 ROLL</div><strong>${esc(p.address || 'Laval assessment unit')}</strong><dl><div><dt>Total assessed value</dt><dd>${money(p.totalValue)}</dd></div><div><dt>Land / building</dt><dd>${money(p.landValue)} / ${money(p.buildingValue)}</dd></div><div><dt>Prior-roll total</dt><dd>${money(p.previousValue)}</dd></div><div><dt>Land area</dt><dd>${area(p.landAreaM2)}</dd></div><div><dt>Year built</dt><dd>${esc(p.yearBuilt)}${p.yearBuiltStatus === 'E' ? ' (estimated)' : ''}</dd></div><div><dt>Housing units</dt><dd>${esc(p.housingUnits)}</dd></div></dl><small>Reference market date: ${esc(String(p.marketReferenceDate || '').slice(0, 10))}. This is an assessment value, not a tax bill or tax balance.</small></div>`).addTo(m);
      });
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [ready, props.assessmentVisible]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const parts: FilterSpecification[] = [];
    if (props.milieu) parts.push(['==', ['get', 'type'], props.milieu]);
    if (props.activityTypes !== null) parts.push(['in', ['get', 'type'], ['literal', props.activityTypes]]);
    if (props.zoneFilter) parts.push(['==', ['get', 'number'], props.zoneFilter]);
    const filter = (parts.length ? ['all', ...parts] : ['all']) as FilterSpecification;
    m.setFilter('zoning-fill', filter); m.setFilter('zoning-line', filter);
    m.setFilter('zoning-quality', ['all', ...parts, ['==', ['get', 'qualityIssue'], true]] as FilterSpecification);
    const selectedFilter = ['==', ['get', 'code'], props.selected?.code || ''] as FilterSpecification;
    m.setFilter('selected-fill', selectedFilter); m.setFilter('selected-line', selectedFilter);
    for (const id of ['zoning-fill', 'zoning-line', 'zoning-quality', 'selected-fill', 'selected-line']) m.setLayoutProperty(id, 'visibility', props.visible ? 'visible' : 'none');
    m.setPaintProperty('zoning-fill', 'fill-opacity', props.opacity);
  }, [ready, props.selected, props.milieu, props.zoneFilter, props.activityTypes, props.visible, props.opacity]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !props.focus) return;
    m.flyTo({ center: props.focus.coordinates, zoom: props.focus.zoom, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650 });

  }, [props.focus, ready]);

  useEffect(() => {
    marker.current?.remove(); marker.current = null;
    if (ready && map.current && props.addressCoordinates) {
      marker.current = new maplibregl.Marker({ color: '#254b3c' }).setLngLat(props.addressCoordinates).addTo(map.current);
    }
  }, [props.addressCoordinates, ready]);

  return <div className="map-wrap"><div ref={host} className="map-canvas" aria-label="Interactive Laval zoning map" />
    {!ready && !message && <div className="map-message">Loading map…</div>}
    {message && <div className={`map-message ${message.startsWith('Basemap') ? 'subtle' : ''}`} role="status">{message}</div>}
    <div className="map-caption"><span className="live-dot" /> MUNICIPAL OPEN DATA <span className="caption-divider">/</span> LAVAL, QUÉBEC</div>
  </div>;
}
