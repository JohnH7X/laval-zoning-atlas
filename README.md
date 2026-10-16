# Laval Zoning Atlas

Read-only static browser map of City of Laval zoning. No CRM, database, accounts, application backend or automatic data refresh. This is an independent screening map, not a cadastral plan or a building-permission determination.

## Run and build

Node.js and npm are required. Install with `npm ci`, run `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`, and open the project preview. `npm test` validates search and shareable URL state. `npm run build` typechecks and produces the static `dist/` directory. Any future deployment should serve the files over HTTPS with compression. No deployment was requested or performed.

## Data

The municipal snapshots inspected on October 6, 2026 contain 2,657 zoning polygons (41 milieu codes) and 135,672 address points. Zoning resource date: August 27, 2026. Address resource date: August 19, 2025. Zoning catalog rechecked October 8, 2026. Published metadata is in `public/data/metadata.json`, including source hashes and URLs.

The original zoning coordinate arrays are preserved without simplification, snapping or repair. Five zones with ring self-intersections are visibly outlined and carry contextual warnings: T3.3-4611, ZI.2-7016, T3.3-5237, T3.4-4616 and T6.1-4108. The browser's rendering of an invalid polygon is not an authoritative boundary interpretation.

Unused attributes were removed. Spatial intersections were computed from the raw snapshots. Address rows are split into lazy civic-number-prefix files; row IDs are snapshot-only result keys, not permanent property IDs. Duplicate addresses remain separate choices with location coordinates. No owner/assessment enrichment is included.

Sources: [zoning](https://www.donneesquebec.ca/recherche/dataset/cdu-type-milieux), [addresses](https://www.donneesquebec.ca/recherche/dataset/geolocalisation-des-adresses), [milieu headings](https://info-reglements.laval.ca/consultation/cdu/titre-7-types-de-milieux/). English family names are translations of the CDU headings, not a full set of regulatory definitions.

Attribution: Ville de Laval, Données Québec. Municipal datasets licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Transformations are identified above and in the app. No municipal endorsement is implied.

Basemap: [OpenFreeMap](https://openfreemap.org/) Positron, with OpenMapTiles/OpenStreetMap attribution maintained by MapLibre. Free public instance, commercial usage allowed, no API key or subscription, no SLA guarantee. A zoning-only fallback loads when the initial basemap style request fails. An unavailable basemap tile service can still leave partial base-map context.

## Update manually

Check the municipal resource dates and download new zoning/address GeoJSON snapshots from the source pages. Keep the prior originals and hashes. With Python 3 and Shapely installed, run:

```sh
python3 scripts/prepare_data.py --zoning /path/cdu-type-milieux.geojson --addresses /path/adresse-civique.geojson --output public/data --checked-date YYYY-MM-DD
```

The source dates in the script must be updated to the actual resource dates before rebuilding. If shard keys change, remove obsolete generated address files only after retaining a backup. Review all geometry issues, schema changes, source license and address-to-zone matches. Validate representative locations against [Laval Info-règlements](https://info-reglements.laval.ca/consultation/), run tests/build and replace the approved static output. Do not silently repair regulatory boundaries. No scheduled job is configured.

## Controls

Search civic number/street or a full zone code. A numeric query can match both an address and a zone; select the correct candidate. Filter by milieu or zone number, toggle zoning, adjust overlay opacity and use the overview control. Selected-zone cards link to official regulatory guidance. Share view copies center, zoom, zone and filter state into the URL hash without storing personal data. A local preview link works only while the project preview is available; publishing for broader sharing requires a separate authorized action.

## Property assessment addition

After selecting an address, the zone card now has a property-assessment section. It uses the current Laval-only [MAMH open XML roll](https://mamh.gouv.qc.ca/role/RM65005.xml), referenced by the [official Données Québec assessment catalog](https://www.donneesquebec.ca/recherche/dataset/roles-d-evaluation-fonciere-du-quebec). The quarterly index lists Laval’s file modification as June 12, 2026. Laval’s current valuation roll is 2025–2027, effective January 1, 2025, with market reference July 1, 2023 ([city explanation](https://www.laval.ca/taxes-evaluation-fonciere/evaluation-fonciere/role-evaluation-fonciere/)). A 2026 download is not a new 2026 market valuation.

This is assessment data, **not annual tax bills or outstanding balances**. The panel links to Laval’s [official assessment/tax lookup](https://www.laval.ca/taxes-evaluation-fonciere/consulter-role-evaluation-taxation/). No tax amount is computed from assessed values. Laval’s older municipal open files for 2016/2019 remove precise property identifiers and are not used for property-level joins.

The processor retains an allowlist of public situs addresses, matricule, land/building/total/prior values, land area, construction year and dwelling count. Owner names and owner mailing addresses remain redacted; no redacted data is reconstructed. Values use CAD; absent data is “Not provided,” distinct from zero. Multiple assessment units at an address remain separate candidates and are never summed automatically.

Lookup files are static, loaded only for a selected address’s civic-prefix shard. Matching requires an exact civic number plus normalized structured street with generic, link and directional suffix. Source address ranges and duplicate map address points are excluded rather than guessed. Therefore coverage is partial. An address point is an anchor, not a cadastral or assessment-unit boundary. Zone-only clicks do not show one property’s valuation for a whole zone. Shared URLs preserve zoning state but not the address/assessment unit selection; recipients select the address separately.

For a manual refresh, download the Laval XML from the current municipal index and rerun after regenerating address rows with `prepare_data.py` (row IDs depend on the address snapshot). Python requires `lxml`:

```sh
python3 scripts/prepare_assessment.py --roll /path/RM65005.xml --addresses /path/adresse-civique.geojson --output public/data/assessment --source-date YYYY-MM-DD
```

Review the generated metadata, match coverage, source date, role year and candidate units before replacing the approved build. Back up the previous output. No automatic refresh, live property API, database, paid service, owner enrichment, CRM or public deployment has been added. Assessment attribution: Ministère des Affaires municipales et de l’Habitation / Ville de Laval, Données Québec, CC BY 4.0. Original records are filtered to needed fields and linked by public situs address; source hashes and transformations are recorded in generated metadata.

### Assessment snapshot coverage

The processed XML contains 154,880 assessment units. 123,140 units are linked to 105,111 municipal address points. 1,365 linked addresses have multiple assessment units and require a choice. Source address ranges and ambiguous civic points are excluded. Unknown source street component codes are excluded rather than guessed; exclusions are recorded in metadata. The first linked test address is 9060 Boulevard Lévesque Est: CAD $826,000 total, $340,200 land and $485,800 building, with market reference July 1, 2023. This is a source snapshot, not a current-market appraisal or a tax invoice.

## Dependent zone dropdown and plain-language descriptions

Choose a milieu type, then choose one of its actual zones in the dependent dropdown. With all milieu types selected, zones are grouped by type. Choosing a zone highlights it, focuses the map and opens its details. Changing type removes incompatible selections and old zone filters; address/assessment context is cleared to avoid showing a property's values under a different selected zone.

All 41 actual milieu types have concise English summaries grounded in the complete **Intention** sections of Laval’s official [CDU edition dated June 8, 2026](https://www.laval.ca/wp-content/uploads/2026/06/cdu-1-reglement-2026-06-08.pdf). The full-description link opens the real PDF page for that subtype; the excerpt, page, chapter URL, source hash, document date and checked date are retained in `public/data/milieu-descriptions.json`. Source pages were checked on October 8, 2026. The interactive Info-règlements gateway returned blocked/sparse content in this research environment, so incomplete search snippets were replaced with complete PDF-based summaries.

**A zone's plain-language summary describes its shared milieu type, not all individual zone exceptions.** The intention's descriptions of existing building character or planning direction are not a blanket authorization for uses, heights or density. The panel links separately to Laval’s [official grid directory](https://info-reglements.laval.ca/consultation/grilles/) and tells you which numeric zone to search. Laval explains that each unique grid combines Title 7 milieu rules with Annex B exceptions. Other CDU provisions and overlays may also apply. We do not invent or claim to have summarized every numeric zone’s exceptions. The dated PDF is a verified snapshot; the latest applicable rules must still be confirmed with Laval.

Descriptions remain static: no runtime AI API, paid subscription, database or automatic refresh. Refresh manually from a verified official edition, recheck full source paragraphs/page links and keep the scope warning. `src/lib/zoning.ts` provides dependent-dropdown helpers; `src/components/ZoneDescription.tsx` displays summaries and full-source/grid links. Existing property assessment lookup remains separate and unchanged.

### Validation environment note

The source/data update passed all 20 tests and the static build in a clean sandbox copy using the pinned lockfile. The connected preview served valid zone and description catalogs. On-device tests encountered transient data reads and a broken generated picomatch dependency; affected data files were restored from a verified source backup. The generated dependency issue was subsequently resolved with `npm ci`; the final 27-test run and build passed on-device. No new production service was started and public publishing remains disabled. Managed source-version saving still reports an unverified project directory; this package is the complete verified source handoff, not a claimed cloud checkpoint.

## Reverse activity lookup

Use **Find zoning by activity**, enter `car sales`, then select **Car sales / dealership**. The map and dependent zone selector show relevant baseline candidate polygons; choose a milieu or zone to explore it. English/French aliases and official activity codes are supported, with 27 activity/category entries (including automotive repair/washing/rental, restaurants, retail, offices, warehouses, institutional uses and farming). This is a static, source-backed shortlist—not a complete permission engine.

The June 8, 2026 official CDU’s 41 Title 7 tables supply 21 non-residential use-group flags each. **A** means baseline group authorization, while **C** means a conditional route requiring approval. The UI links each exact group-table PDF page and distinguishes both statuses from confirmed zone/property-level permission. Restrictions and source evidence remain in `public/data/use-matrix.json`; none of the individual Annex B exception grids is marked checked. Broad searches such as restaurant resolve to a broad group and explicitly require specific subgroup/activity review.

For car sales, official code **5511** is searched through automotive group **C5** (classification PDF page 300). Articles **1370/1388** restrict industrial C5 uses to listed parts/service activities, so **ZI.1/ZI.2 are excluded from this sales route**, rather than wrongly assuming all C5 activity is allowed there. The current C5 shortlist has **367 real zones**: **62 baseline A** (60 ZC, 2 SZD.2) and **305 conditional C** (T4.5 and T6.1–T6.5). These are candidates, not verified individual permissions. All possible exception-added zones are not covered, and indoor-only retail may also follow **C2b** (PDF page 296), a separate route not resolved here. Car repair/washing are separate activities; rental is not confused with sales. Outdoor vehicle display, parking, site conditions, existing rights, other CDU provisions and zone-specific exceptions must be verified with Laval. No matches must not be interpreted as a citywide prohibition.

Selected activity is encoded in a shareable URL as `use=car-sales`; location search clears the activity filter to avoid hiding the selected address. Activity selection clears old zone/milieu filters and property-assessment context. Reset restores the unfiltered map. There is no runtime AI request, subscription, CRM, database or new persistent service.

Manual refresh: run `pdftotext -layout` on a verified official code PDF, update the description/page provenance, then run `python3 scripts/prepare_uses.py --text <code-layout.txt> --descriptions public/data/milieu-descriptions.json --output public/data/use-matrix.json`. Review the A/C symbol extraction and activity-specific restrictions against that edition; the script intentionally fails on missing/incomplete group tables. Full per-zone confirmation would require obtaining, normalizing and reconciling the separate Annex B grids and other applicable rules; that is not claimed as implemented.

Final reverse-search evidence: **27 tests, TypeScript and production build passed on the connected computer**, with preview HTTP 200 after a clean pinned-dependency reinstall. The earlier generated-dependency problem is resolved. Managed source-version saving remains unavailable; public publication remains disabled.

## Serving the built atlas

If `npm run dev` stalls on your machine, build (`npm run build`) and serve the static output: `node scripts/serve-dist.mjs dist 5173`.

## Use-status labels

`A` = baseline group authorized as of right; `C` = conditional approval; `A+C` = the official table lists mixed as-of-right and conditional components, so the specific activity needs review. None confirms permission at a property.

## Toggleable assessment-unit layer (2026 roll)

The atlas includes an optional **Assessment units** layer. It is off by default and loads geographic shards only when enabled. It draws one point per Laval evaluation unit from MAMH's 2026 georeferenced open roll; it does **not** draw parcel boundaries. Clicking a point shows the address, total/land/building/prior assessed values, land area, year built, housing units and market-reference date.

The 2026 GeoPackage's spatial table is `rol_unite_p_2026` with `MULTIPOINT` geometry. Its separate attribute tables include `b05v_unite_evaln_2026`, address components, fiscal-distribution fields and a lot/cadastre table. Cadastral information, owner names and owner mailing addresses are redacted or excluded from this public map. Annual tax bills and outstanding balances are not present; use Laval's official tax lookup for those.

Source: [MAMH/Québec property assessment open data](https://www.donneesquebec.ca/recherche/dataset/roles-d-evaluation-fonciere-du-quebec), 2026 roll, market reference July 1, 2023, CC BY 4.0.
