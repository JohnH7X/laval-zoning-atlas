#!/usr/bin/env python3
"""Create static address-anchored assessment lookups; never recreate redacted owners."""
import argparse
import collections
import hashlib
import json
import re
import unicodedata
from pathlib import Path
from lxml import etree

GENERICS = {'RU': 'rue', 'AV': 'avenue', 'BO': 'boulevard', 'CH': 'chemin', 'PL': 'place',
            'MO': 'montee', 'TE': 'terrasse', 'CR': 'croissant', 'DE': 'desserte',
            'RA': 'rang', 'AT': 'autoroute', 'JA': 'jardins'}
LINKS = {'': '', 'H': 'd', 'J': 'de', 'K': 'de l', 'L': 'de la', 'M': 'des',
         'N': 'du', 'P': 'l', 'R': 'le', 'S': 'les'}
CARDINALS = {'E': 'est', 'O': 'ouest', 'N': 'nord', 'S': 'sud',
             'NE': 'nord est', 'NO': 'nord ouest', 'SE': 'sud est', 'SO': 'sud ouest'}


def norm(value):
    value = ''.join(c for c in unicodedata.normalize('NFD', value or '') if not unicodedata.combining(c)).lower()
    return re.sub('[^a-z0-9]+', ' ', value).strip()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n')


def number(value):
    try:
        return float(value) if value is not None else None
    except ValueError:
        return None


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--roll', type=Path, required=True)
    p.add_argument('--addresses', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--source-date', required=True)
    args = p.parse_args()
    civic = json.loads(args.addresses.read_text())['features']
    by_address = collections.defaultdict(list)
    source_keys, shard_keys = {}, {}
    for i, feature in enumerate(civic):
        f = feature['properties']
        # Use full structured street; generic, link and directional suffix remain distinct.
        street = norm(' '.join([f.get('GENERIQUE', ''), f.get('LIEN', ''), f.get('TOPONYME', '')]))
        key = (norm(str(f['NO_CIVIQUE'])), street)
        by_address[key].append(i)
        source_keys[i] = key
        n = re.match(r'\d+', str(f['NO_CIVIQUE']))
        shard_keys[i] = (n.group(0)[:2] if n else '_').zfill(2)
    records = {}
    links = collections.defaultdict(set)
    counters = collections.Counter()
    role_year = None
    market_dates = collections.Counter()
    skipped_codes = collections.Counter()
    examples = []
    # The XML contains owner-section status fields only; none are retained.
    for _, e in etree.iterparse(str(args.roll), events=('end',), tag=('RLM02A', 'RLUEx'),
                               resolve_entities=False, no_network=True):
        if e.tag == 'RLM02A':
            role_year = e.text
            continue
        counters['sourceUnits'] += 1
        get = lambda tag: e.findtext(tag)
        parts = [e.findtext('RL0104/' + k, '') for k in ['RL0104A', 'RL0104B', 'RL0104C', 'RL0104D', 'RL0104E', 'RL0104F', 'RL0104G', 'RL0104H']]
        uid = '-'.join(v for v in parts if v) or ('record-' + str(counters['sourceUnits']))
        addresses = []
        matched_ids = set()
        for a in e.findall('RL0101/RL0101x'):
            d = {c.tag: c.text or '' for c in a}
            generic_code, link_code = d.get('RL0101Ex', ''), d.get('RL0101Fx', '')
            cardinal_code = d.get('RL0101Hx', '')
            street = norm(' '.join([GENERICS.get(generic_code, generic_code), LINKS.get(link_code, link_code),
                                    d.get('RL0101Gx', ''), CARDINALS.get(cardinal_code, cardinal_code)]))
            lower = d.get('RL0101Ax', '') + d.get('RL0101Bx', '')
            upper = d.get('RL0101Cx', '') + d.get('RL0101Dx', '')
            apartment = ' '.join(v for v in [d.get('RL0101Ix'), d.get('RL0101Jx')] if v)
            label = (lower + (('–' + upper) if upper and upper != lower else '') + ' ' + street).strip()
            if apartment:
                label += ' · Unit ' + apartment
            addresses.append(label)
            if generic_code not in GENERICS or link_code not in LINKS or cardinal_code and cardinal_code not in CARDINALS:
                skipped_codes[(generic_code, link_code, cardinal_code)] += 1
                continue
            if not lower:
                counters['addressesWithoutCivic'] += 1
                continue
            if upper and upper != lower:
                counters['rangeAddressesExcluded'] += 1
                continue
            matches = by_address.get((norm(lower), street), [])
            if len(matches) > 1:
                # Distinct source map points with the same text cannot be assigned by text alone.
                counters['ambiguousCivicAddressesExcluded'] += 1
                continue
            matched_ids.update(matches)
        if matched_ids:
            record = {'id': uid, 'addresses': addresses, 'roleYear': role_year,
                      'marketDate': get('RL0401A'), 'landValue': number(get('RL0402A')),
                      'buildingValue': number(get('RL0403A')), 'totalValue': number(get('RL0404A')),
                      'previousValue': number(get('RL0405A')), 'landArea': number(get('RL0302A')),
                      'builtYear': get('RL0307A'), 'builtYearStatus': get('RL0307B'),
                      'dwellings': number(get('RL0311A')), 'useCode': get('RL0105A')}
            records[uid] = record
            counters['matchedUnits'] += 1
            market_dates[get('RL0401A')] += 1
            for i in matched_ids:
                links[i].add(uid)
            if len(examples) < 4:
                examples.append({'address': civic[next(iter(matched_ids))]['properties']['NO_CIVIQUE'] + ' ' + civic[next(iter(matched_ids))]['properties']['RUE'], 'record': record})
        e.clear()
        while e.getprevious() is not None:
            del e.getparent()[0]
        if counters['sourceUnits'] % 25000 == 0:
            print('Processed', counters['sourceUnits'], 'assessment units;', counters['matchedUnits'], 'matched', flush=True)
    shards = collections.defaultdict(lambda: {'byAddress': {}, 'records': {}})
    for i, ids in links.items():
        s = shards[shard_keys[i]]
        s['byAddress'][str(i)] = sorted(ids)
        for uid in ids:
            s['records'][uid] = records[uid]
    for key, data in shards.items():
        write_json(args.output / (key + '.json'), data)
    metadata = {'publisher': 'MAMH · Ville de Laval', 'sourceUrl': 'https://mamh.gouv.qc.ca/role/RM65005.xml',
                'catalogUrl': 'https://www.donneesquebec.ca/recherche/dataset/roles-d-evaluation-fonciere-du-quebec',
                'sourceDate': args.source_date, 'checkedDate': '2026-10-08', 'roleYear': role_year,
                'marketDates': dict(market_dates), 'sourceUnits': counters['sourceUnits'],
                'matchedUnits': counters['matchedUnits'], 'matchedAddresses': len(links),
                'ambiguousAssessmentAddresses': sum(len(v) > 1 for v in links.values()),
                'rangeAddressesExcluded': counters['rangeAddressesExcluded'],
                'ambiguousCivicAddressesExcluded': counters['ambiguousCivicAddressesExcluded'],
                'shards': sorted(shards), 'license': 'CC BY 4.0',
                'sourceSha256': hashlib.sha256(args.roll.read_bytes()).hexdigest(),
                'joinMethod': 'Exact civic number and normalized structured street, preserving generic, link and cardinal direction. Excludes ranges and ambiguous civic points. Multiple assessment units at a single address remain separate candidates.',
                'limitations': 'Assessment values, not annual taxes or tax debts. Address points are lookup anchors, not parcel or assessment geometry. No owner names, mailing addresses, cadastral reconstruction, fuzzy or nearest matches.',
                'unknownCodes': [{'codes': list(k), 'count': v} for k, v in skipped_codes.items()]}
    write_json(args.output / 'metadata.json', metadata)
    write_json(args.output / 'examples.json', examples)
    print(json.dumps(metadata, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    main()
