"""
slim_live_data.py
Strips Live-Data JSONL files down to only the fields used by live_data.py.
Reads:  Live-Data.jsonl (and Live-Data-2.jsonl, Live-Data-3.jsonl if they exist)
Writes: Live-Data-slim.jsonl (merged, slimmed output)

Fields kept per record:
  - location         (top-level string — used for city matching)
  - location_details (top-level — county matching)
  - employment_status
  - position (current job):
      title, level, function, location, location_details, duration, company_tenure
      company: { name, industry, employee_count }

We DROP: id, created_at, *_change_detected_at, jobs (full history),
         education, connections, country
"""

import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

INPUT_FILES = [
    os.path.join(ROOT, 'Live-Data.jsonl'),
    os.path.join(ROOT, 'Live-Data-2.jsonl'),
    os.path.join(ROOT, 'Live-Data-3.jsonl'),
]

OUTPUT_FILE = os.path.join(ROOT, 'Live-Data-slim.jsonl')


def slim_position(pos):
    """Strip a position dict to only required fields."""
    if not pos or not isinstance(pos, dict):
        return None
    company = pos.get('company') or {}
    return {
        'title':          pos.get('title'),
        'level':          pos.get('level'),
        'function':       pos.get('function'),
        'location':       pos.get('location'),
        'location_details': pos.get('location_details'),
        'duration':       pos.get('duration'),
        'company_tenure': pos.get('company_tenure'),
        'company': {
            'name':           company.get('name'),
            'industry':       company.get('industry'),
            'employee_count': company.get('employee_count'),
        },
    }


def slim_record(rec):
    return {
        'location':          rec.get('location'),
        'location_details':  rec.get('location_details'),
        'employment_status': rec.get('employment_status'),
        'position':          slim_position(rec.get('position')),
    }


total_in = 0
total_out = 0

with open(OUTPUT_FILE, 'w', encoding='utf-8') as out_f:
    for path in INPUT_FILES:
        if not os.path.exists(path):
            print(f'  skipping (not found): {os.path.basename(path)}')
            continue
        size_mb = os.path.getsize(path) / 1_000_000
        print(f'Processing {os.path.basename(path)}  ({size_mb:.0f} MB) ...')
        file_count = 0
        with open(path, encoding='utf-8') as in_f:
            for line in in_f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                    slimmed = slim_record(rec)
                    out_f.write(json.dumps(slimmed) + '\n')
                    file_count += 1
                except json.JSONDecodeError:
                    pass
        total_in  += file_count
        total_out += file_count
        print(f'  wrote {file_count:,} records from {os.path.basename(path)}')

slim_mb = os.path.getsize(OUTPUT_FILE) / 1_000_000
print(f'\n✅ Done. {total_out:,} records → {OUTPUT_FILE}')
print(f'   Size: {slim_mb:.1f} MB  (was combined input across all files)')
print(f'   Next: update backend/live_data.py to read Live-Data-slim.jsonl')
