#!/usr/bin/env python3
"""Extract baseline CDU Title 7 use-group symbols. No zone-exception inference."""
import argparse
import hashlib
import json
import re
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--text', required=True, help='pdftotext -layout output for the official code PDF')
parser.add_argument('--descriptions', required=True, help='Description JSON containing physical pdfPage per milieu')
parser.add_argument('--output', required=True)
args = parser.parse_args()
source = Path(args.text).read_text()
pages = source.split('\f')
descriptions = json.loads(Path(args.descriptions).read_text())
base = 'https://www.laval.ca/wp-content/uploads/2026/06/cdu-1-reglement-2026-06-08.pdf'
records = {}
for code, description in descriptions['types'].items():
    first = description['pdfPage'] - 1
    end = min([v['pdfPage'] - 1 for v in descriptions['types'].values() if v['pdfPage'] > first + 1] + [815])
    section = '\f'.join(pages[first:end+1])
    next_section = re.search(r'(?m)^[ \t]*(?:SECTION|CHAPITRE|TITRE)\s+\d+\b', section[section.find('Intention')+9:])
    if next_section:
        section = section[:section.find('Intention')+9+next_section.start()]
    match = re.search(r'Tableau\s+\d+\.\s*Usages[^\n]*\n', section)
    if not match:
        raise ValueError(f'No use table for {code}')
    after = section[match.end():]
    next_article = re.search(r'(?m)^\d{3,4}(?:\.\d+)?\.\s', after)
    table = after[:next_article.start()] if next_article else after.split('Sous-section 9')[0]
    table_page = first + section[:match.start()].count('\f') + 1
    rules = after[next_article.start():] if next_article else ''
    rules = rules.split('Sous-section 9')[0]
    groups = {}
    lines = table.splitlines()
    for i, line in enumerate(lines):
        group = re.search(r'\(([CPRIEA]\d)\)', line)
        if not group:
            continue
        flag = re.search(r'\)\s+([AC](?:\s+et\s+[AC])?)(?:\s|$)', line)
        if not flag and group.group(1) == 'C2' and i:
            flag = re.search(r'\s{2,}([AC](?:\s+et\s+[AC])?)\s+\d*\s*$', lines[i-1])
        groups[group.group(1)] = {
            'symbol': 'AC' if flag and 'et' in flag.group(1) else flag.group(1) if flag else '',
            'page': first + section[:match.end()].count('\f') + table[:table.find(line)].count('\f') + 1,
            'evidence': line.strip(),
        }
    expected = [f'C{i}' for i in range(1,8)] + [f'P{i}' for i in range(1,4)] + [f'R{i}' for i in range(1,4)] + [f'I{i}' for i in range(1,5)] + ['E1','E2','A1','A2']
    if set(groups) != set(expected):
        raise ValueError(f'Incomplete groups for {code}: {set(expected)-set(groups)}')
    records[code] = {'code': code, 'groups': groups, 'tablePage': table_page,
                     'tableSourceUrl': base + '#page=' + str(table_page),
                     'restrictions': ' '.join(rules.replace('\u00ad', '').split()),
                     'exceptionsChecked': False}
result = {'documentDate':'2026-06-08', 'checkedDate':'2026-10-08', 'sourceUrl':base,
          'sourceTextSha256':hashlib.sha256(source.encode()).hexdigest(),
          'symbolMeaning':{'A':'Baseline group authorized as of right, subject to specific restrictions and zone exceptions',
                           'C':'Baseline group conditional on approval and applicable conditions',
                           'AC':'Mixed as-of-right and conditional components; specific activity status unresolved',
                           '':'No baseline group authorization shown; individual exceptions may differ'},
          'scope':'Baseline group shortlist only. Annex B, overlays, existing rights and project-level conditions are not resolved.',
          'types':records}
output = Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'Extracted {len(records)} milieu use tables; no zone exceptions inferred; {output.stat().st_size} bytes')
for code,r in records.items():
    if r['groups']['C5']['symbol']:
        print(code, r['groups']['C5']['symbol'], 'PDF page', r['groups']['C5']['page'])
