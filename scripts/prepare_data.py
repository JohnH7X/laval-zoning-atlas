#!/usr/bin/env python3
"""Build static Laval map data without changing municipal source geometry."""
import argparse
import collections
import hashlib
import json
import re
import unicodedata
from pathlib import Path
from shapely.geometry import shape
from shapely import STRtree
from shapely.validation import explain_validity


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--zoning', type=Path, required=True)
    parser.add_argument('--addresses', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--checked-date', default='2026-10-08')
    args = parser.parse_args()
    zones = json.loads(args.zoning.read_text())['features']
    addresses = json.loads(args.addresses.read_text())['features']
    geometries = [shape(f['geometry']) for f in zones]
    tree = STRtree(geometries)
    pairs = tree.query([shape(f['geometry']) for f in addresses], predicate='intersects')
    matches = collections.defaultdict(list)
    for ai, zi in zip(*pairs):
        matches[int(ai)].append(int(zi))
    features, summaries, issues = [], [], []
    for f, geom in zip(zones, geometries):
        p = f['properties']
        issue = '' if geom.is_valid else explain_validity(geom)
        if issue:
            issues.append({'zone': p['TM_ZONE'], 'reason': issue})
        family = p['TYPE_MILIE'].split('.')[0]
        # Keep the original coordinate arrays: no simplification, snapping or repair.
        properties = {'code': p['TM_ZONE'], 'number': p['NO_ZONE'], 'type': p['TYPE_MILIE'],
                      'family': family, 'qualityIssue': bool(issue)}
        features.append({'type': 'Feature', 'id': p['NO_ZONE'],
                         'properties': properties, 'geometry': f['geometry']})
        center = geom.representative_point()
        summaries.append({**properties, 'center': [center.x, center.y], 'bounds': list(geom.bounds)})
    shards = collections.defaultdict(list)
    keys = collections.Counter()
    street_shards = collections.defaultdict(set)
    for i, f in enumerate(addresses):
        p = f['properties']
        civic = str(p['NO_CIVIQUE'])
        street = p['RUE']
        number = re.match(r'\d+', civic)
        shard = (number.group(0)[:2] if number else '_').zfill(2)
        xy = f['geometry']['coordinates']
        codes = [zones[zi]['properties']['TM_ZONE'] for zi in matches[i]]
        # Row index is a snapshot-only result key, not a durable property identifier.
        shards[shard].append([civic, street, p.get('EX_VILLE', ''), xy[0], xy[1], codes, i])
        keys[(civic.casefold().strip(), street.casefold().strip())] += 1
        normalized_street = ''.join(c for c in unicodedata.normalize('NFD', street) if not unicodedata.combining(c)).lower()
        normalized_street = re.sub('[^a-z0-9]+', ' ', normalized_street).strip()
        street_shards[normalized_street].add(shard)
    for key, rows in shards.items():
        save(args.output / 'addresses' / (key + '.json'), rows)
    save(args.output / 'street-index.json', [[street, sorted(keys)] for street, keys in sorted(street_shards.items())])
    save(args.output / 'zones.geojson', {'type': 'FeatureCollection', 'features': features})
    save(args.output / 'zones-index.json', summaries)
    metadata = {'checkedDate': args.checked_date, 'zoningDate': '2026-08-27', 'addressDate': '2025-08-19',
                'zoneCount': len(zones), 'addressCount': len(addresses),
                'milieuCount': len({f['properties']['TYPE_MILIE'] for f in zones}),
                'geometryIssues': issues, 'addressShards': sorted(shards),
                'uniqueSpatialMatches': sum(len(matches[i]) == 1 for i in range(len(addresses))),
                'duplicateAddressGroups': sum(n > 1 for n in keys.values()),
                'license': 'CC BY 4.0',
                'zoningSource': 'https://www.donneesquebec.ca/recherche/dataset/cdu-type-milieux',
                'addressSource': 'https://www.donneesquebec.ca/recherche/dataset/geolocalisation-des-adresses',
                'zoningSha256': hashlib.sha256(args.zoning.read_bytes()).hexdigest(),
                'addressSha256': hashlib.sha256(args.addresses.read_bytes()).hexdigest(),
                'transformations': 'Removed unused attributes; original zoning coordinates retained without repair or simplification; static address-to-zone intersections; addresses split by civic-number prefix.'}
    save(args.output / 'metadata.json', metadata)
    print(json.dumps({'zones': len(zones), 'addresses': len(addresses), 'issues': issues,
                      'shards': len(shards), 'output': str(args.output)}, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    main()
