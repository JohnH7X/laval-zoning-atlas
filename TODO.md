# Outcomes

- [x] Interactive map: basemap centered on Laval, actual municipal zoning polygons, user-controlled zoning-layer toggle, and no fabricated geometry. Five known ring self-intersections retained and visibly flagged.
- [x] Search and selection: actual retained address dataset, explicit candidate selection for ambiguous matches, honest unmatched states, and clickable zones showing zone number and milieu-type code. Compact street-to-shard directory and cancellation prevent stale searches fetching further batches.
- [x] Filters and legend: milieu-type and zone-number filters, clear active-filter state and reset, legend explaining styling, selected features and geometry-quality handling.
- [x] Shareable state: URL hash preserves center, zoom, selected zone and active filters without accounts or server-side storage.
- [x] Provenance: source dates, municipal attribution and license, official regulation/open-data links, persistent screening disclaimer and contextual geometry warnings.
- [x] Static application: working local preview, no CRM/backend/database/accounts/private records/parcels/extra constraints/entitlement engine/subscriptions/automated updates/public deployment. Reproducible preprocessing and README update guide. Ten search/URL tests passed; source fidelity check retained all 2,657 original geometries and all 135,672 address rows.
- [ ] Saved Manus source checkpoint: blocked because the managed Git operation reports no verified project directory even after successfully reattaching the exact project and worktree. Source and static build remain on the connected computer; no public deployment was performed.

## Assessment addition

- [x] Public source assessment data available after address selection: land/building/total/prior values, land area, year built, housing units, assessment ID and source/role/reference dates. CAD formatting and honest missing values.
- [x] Conservative address linkage: preserve street generic/cardinal distinctions, show all source assessment candidates at a shared address, no guessed ranges or fuzzy/nearest joins, explicit unmatched states. Zone-only clicks must not imply one property value for the zone.
- [x] Static low-cost operation and provenance: lazy lookup files, reproducible streaming processor, no owner reconstruction, no tax estimates/live bills/debt data, official tax lookup link, no new backend/database/accounts/CRM/subscription/public deployment/automatic updates.

Assessment evidence: 14 tests passed; TypeScript and production build passed. Validated 123,140 assessment units, 105,111 address links and 1,365 multiple-unit addresses, with no owner/mailing/cadastre fields. Local preview metadata endpoint returned HTTP 200. Managed source saving still reports no verified directory, so delivery is the updated local source package, not a recorded Manus checkpoint.

## Zone dropdown and descriptions

- [x] Add the zones for each type as a pull down: dependent native zone selector, every actual zone included, all-types view grouped by milieu, selection focuses/highlights/opens the zone, incompatible type changes reset prior selection/filter/address context, reset restores all zones.
- [x] Show each selected zone’s plain-language description grounded in its official milieu/subtype, with clear shared-description versus zone-specific-rule distinction and no invented permitted uses, heights, densities or rights.
- [x] Link the full official description and Laval’s official zone-grid lookup, display source/checked-date provenance and any unavailable-description state. Preserve static low-cost operation and property-assessment lookup.

Zone-dropdown evidence: clean pinned-dependency validation passed all 20 tests, TypeScript and production build. Verified 2,657 zones and 41 full-intent-based English descriptions with real PDF pages. Connected preview endpoints returned valid JSON for all 2,657 zones and 41 descriptions. Restored the affected zoning index and assessment shard from the verified backup; local generated dependencies still need a clean reinstall before reliable on-device test runs. Managed source checkpoint remains unavailable due to directory verification; no publication is claimed.

## Reverse activity search

- [x] Search “car sales” and plain English/French activity synonyms; resolve to a named official use/group rather than a vague commercial milieu, show relevant real zones on the map and in the dependent zone dropdown, preserve existing address search.
- [x] Show baseline A versus conditional C route, exact source links and per-type counts, and clear incompatible zone/assessment context on activity changes; activity-filter URLs can be shared and reset removes the activity filter.
- [x] Clearly label reverse results as baseline candidates with zone exceptions unverified, exclude ZI.1/ZI.2 car-sale candidates via the restricted C5 route, disclose alternative indoor-retail C2b classification and separate outdoor-display checks; no-match results must not assert a citywide prohibition. No CRM, database, subscription or runtime AI service.

Reverse-search evidence: 27 local tests, TypeScript and production build passed; preview HTTP 200. All 41 baseline use tables have 21 group entries with source page/evidence. Car-sale C5 candidates total 367, with 62 A and 305 C. ZI.1/ZI.2 are excluded from the sales/rental C5 route. No per-zone permission or parsed Annex B exception is claimed. On-device generated dependencies were repaired with npm ci, and diagnostics were restored. Public publishing remains disabled.

## Review corrections (October 15, 2026)

- [x] Official "A et C" use cells keep a distinct mixed A+C status (20 cells) with "requires specific-use review" wording; never shown as plain as-of-right.
- [x] A pending or failed use-table download no longer hides every zone; regular zoning stays visible with an explicit unavailable message.
- [x] Address pin follows explicitly selected address coordinates and is cleared with the property context.
- [x] Retained restriction text stops at the next official section (7 leaks removed).
- Evidence: typecheck clean, 30 tests passed, production build passed in a clean copy. Preview served from the verified build on 127.0.0.1:5173 because the Vite dev server stalls on every file request on this computer (`node scripts/serve-dist.mjs dist 5173`).
- Not done: managed source-version checkpoint (not requested to publish; public publishing remains disabled).

## Assessment-unit layer (October 16, 2026)

- [x] Downloaded and inspected the official 2026 georeferenced GeoPackage: Laval has 154,876 evaluation-unit points; geometry is `MULTIPOINT`, not parcel polygons.
- [x] Added lazy geographic shards and a toggleable public map layer; point click shows selected assessed-value and roll fields.
- [x] Preserved the key limitation: no cadastral parcel boundaries, owner names or owner mailing addresses; no annual tax bill/debt calculation.
- [x] Clean validation: TypeScript, 30 tests and production build passed; no shard exceeds GitHub's per-file limit.
- Available public-roll fields include assessment-unit identifier/matricule, situs address components, frontage, land area, agricultural-area fields, floors, construction year/status, floor area, housing units, rental rooms, non-residential units, land/building/total/prior assessed values, market-reference date, vacant-served-land category, non-residential and industrial classes, tax category and additional coded characteristics. These describe an evaluation unit, not a legal parcel.
