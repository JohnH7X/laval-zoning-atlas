#!/usr/bin/env python3
"""Extract Laval assessment-unit points and public roll fields from MAMH's 2026 GeoPackage."""
import argparse, json, sqlite3, struct
from pathlib import Path


def point_from_gpkg(blob: bytes):
    flags = blob[3]
    envelope = (flags >> 1) & 7
    envelope_bytes = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[envelope]
    offset = 8 + envelope_bytes
    endian = '<' if blob[offset] == 1 else '>'
    geometry_type = struct.unpack(endian + 'I', blob[offset + 1:offset + 5])[0]
    if geometry_type != 4:  # MULTIPOINT
        raise ValueError(f'Expected MULTIPOINT, got {geometry_type}')
    count = struct.unpack(endian + 'I', blob[offset + 5:offset + 9])[0]
    if count != 1:
        raise ValueError(f'Expected one point per assessment unit, got {count}')
    pos = offset + 9
    x, y = struct.unpack(endian + 'dd', blob[pos + 5:pos + 21])
    return x, y


def nonempty(*values):
    return ' '.join(str(v).strip() for v in values if v is not None and str(v).strip())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--gpkg', required=True)
    ap.add_argument('--output', required=True)
    args = ap.parse_args()
    conn = sqlite3.connect(args.gpkg)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    addresses = {}
    for row in cur.execute("""
        SELECT id_provinc, rl0101a, rl0101b, rl0101c, rl0101d, rl0101e,
               rl0101f, rl0101g, rl0101h, rl0101i, rl0101j
        FROM b05v_adr_unite_evaln_2026 WHERE code_mun = '65005'
        ORDER BY no_seq_adr
    """):
        if row['id_provinc'] not in addresses:
            civic = nonempty(row['rl0101a'], row['rl0101b'], row['rl0101c'], row['rl0101d'])
            street = nonempty(row['rl0101e'], row['rl0101f'], row['rl0101g'], row['rl0101h'], row['rl0101i'], row['rl0101j'])
            addresses[row['id_provinc']] = nonempty(civic, street)
    features = []
    fields = [
        'id_provinc', 'mat18', 'rl0301a', 'rl0302a', 'rl0304a', 'rl0305a',
        'rl0306a', 'rl0307a', 'rl0307b', 'rl0308a', 'rl0309a', 'rl0311a', 'rl0312a', 'rl0313a',
        'rl0402a', 'rl0403a', 'rl0404a', 'rl0405a', 'dat_cond_mrche', 'rl0501a', 'rl0502a', 'rl0503a',
        'rl0505a', 'rl0310a', 'rl0314a', 'rl0315a', 'rl0316a', 'rl0317a', 'rl0318a', 'rl0319a', 'rl0320a'
    ]
    sql = 'SELECT g.geom, ' + ','.join('a.' + x for x in fields) + " FROM rol_unite_p_2026 g JOIN b05v_unite_evaln_2026 a ON a.id_provinc = g.id_provinc WHERE g.code_mun = '65005'"
    for row in cur.execute(sql):
        x, y = point_from_gpkg(row['geom'])
        p = {key: row[key] for key in fields if row[key] is not None}
        p['address'] = addresses.get(row['id_provinc'], '')
        # Keep the public map payload human-readable; source field codes are retained in metadata/docs.
        p['totalValue'] = p.pop('rl0404a', None)
        p['landValue'] = p.pop('rl0402a', None)
        p['buildingValue'] = p.pop('rl0403a', None)
        p['previousValue'] = p.pop('rl0405a', None)
        p['landAreaM2'] = p.pop('rl0302a', None)
        p['frontageM'] = p.pop('rl0301a', None)
        p['totalLandAreaM2'] = p.pop('rl0304a', None)
        p['agriculturalAreaM2'] = p.pop('rl0305a', None)
        p['floors'] = p.pop('rl0306a', None)
        p['yearBuilt'] = p.pop('rl0307a', None)
        p['yearBuiltStatus'] = p.pop('rl0307b', None)
        p['floorAreaM2'] = p.pop('rl0308a', None)
        p['housingUnits'] = p.pop('rl0311a', None)
        p['rentalRooms'] = p.pop('rl0312a', None)
        p['nonResidentialUnits'] = p.pop('rl0313a', None)
        p['marketReferenceDate'] = p.pop('dat_cond_mrche', None)
        p['vacantServedLandCategory'] = p.pop('rl0501a', None)
        p['nonResidentialClass'] = p.pop('rl0502a', None)
        p['industrialClass'] = p.pop('rl0503a', None)
        p['taxCategoryCode'] = p.pop('rl0505a', None)
        p.pop('rl0101a', None); p.pop('rl0101b', None); p.pop('rl0101c', None); p.pop('rl0101d', None)
        p.pop('rl0101e', None); p.pop('rl0101f', None); p.pop('rl0101g', None); p.pop('rl0101h', None)
        p.pop('rl0101i', None); p.pop('rl0101j', None)
        # Keep source matricule only as a public assessment-unit identifier; no cadastral fields are included.
        p['assessmentUnitId'] = p.pop('id_provinc')
        p['assessmentIdentifier'] = p.pop('mat18')
        features.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [x, y]}, 'properties': p})
    conn.close()
    out = {'type': 'FeatureCollection', 'features': features}
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    print(f'wrote {len(features)} assessment-unit points to {args.output}')

if __name__ == '__main__':
    main()
