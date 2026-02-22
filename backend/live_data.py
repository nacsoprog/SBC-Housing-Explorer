"""
live_data.py
Parses the Live-Data.jsonl file into a fast in-memory index.
Exposes:
  - get_workforce_summary(city)     → job function breakdown for a city
  - get_workers_by_title(title)     → people with similar job titles in SB area
  - get_sb_area_summary()           → overview of all SB-area workers in the dataset
"""

import json
import os
import re
from collections import Counter, defaultdict

JSONL_PATH = os.path.join(os.path.dirname(__file__), '..', 'datasets', 'Live-Data-slim.jsonl')

# SB-county city name aliases for matching
SB_CITIES = {
    'santa barbara', 'goleta', 'lompoc', 'santa maria', 'carpinteria',
    'solvang', 'buellton', 'guadalupe', 'orcutt', 'isla vista',
    'vandenberg', 'montecito', 'summerland', 'toro canyon',
    'los alamos', 'los olivos', 'santa ynez', 'ballard', 'garey',
    'mission hills', 'mission canyon', 'new cuyama', 'cuyama',
}

_records = None  # lazy loaded


def _load() -> list:
    """
    Lazily loads the slimmed Live-Data file into memory.
    
    Returns:
        A list of dictionaries containing individual worker records.
    """
    global _records
    if _records is not None:
        return _records
    records = []
    with open(JSONL_PATH, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    _records = records
    return records


def _normalize_location(loc_str: str) -> str:
    """Extract city portion from a location string."""
    if not loc_str:
        return ''
    # e.g. 'Santa Barbara, California, United States' → 'santa barbara'
    return loc_str.split(',')[0].strip().lower()


def _is_sb_record(record: dict) -> bool:
    loc = _normalize_location(record.get('location') or '')
    for city in SB_CITIES:
        if city in loc:
            return True
    # Also check position.location_details
    pos = record.get('position') or {}
    ld = pos.get('location_details') or {}
    county = (ld.get('county') or '').lower()
    if 'santa barbara' in county:
        return True
    return False


def _get_current_position(record: dict) -> dict:
    """Return the position dict (current role) from a record."""
    return record.get('position') or {}


def get_workforce_summary(city: str) -> dict:
    """
    Summarise workers whose current location matches `city`.
    Returns job function counts, industry counts, job level counts,
    recent job changers (position started in last 18 months).
    """
    records = _load()
    city_lower = city.lower()

    matched = []
    for r in records:
        loc = _normalize_location(r.get('location') or '')
        if city_lower in loc:
            matched.append(r)

    functions = Counter()
    industries = Counter()
    levels = Counter()
    recent_movers = 0  # started current role within ~18 months of data snapshot

    for r in matched:
        pos = _get_current_position(r)
        fn = pos.get('function') or 'Unknown'
        level = pos.get('level') or 'Unknown'
        company = pos.get('company') or {}
        ind = company.get('industry') or 'Unknown'
        functions[fn] += 1
        levels[level] += 1
        industries[ind] += 1
        # Duration ≤ 18 months = recent mover
        dur = pos.get('duration')
        if dur is not None and dur <= 18:
            recent_movers += 1

    return {
        'city': city,
        'total_workers': len(matched),
        'recent_movers': recent_movers,
        'top_functions': functions.most_common(6),
        'top_industries': industries.most_common(5),
        'top_levels': levels.most_common(5),
    }


def get_workers_by_title(job_title: str, sb_only: bool = True) -> dict:
    """
    Find workers whose current title broadly matches job_title.
    Returns count, function distribution, and level distribution.
    Optionally filter to SB-county area only.
    """
    records = _load()
    job_lower = job_title.lower()
    # Simple keyword tokenisation
    tokens = re.findall(r'\w+', job_lower)

    matched = []
    for r in records:
        if sb_only and not _is_sb_record(r):
            continue
        pos = _get_current_position(r)
        title = (pos.get('title') or '').lower()
        # Match if any meaningful keyword overlaps
        if any(tok in title for tok in tokens if len(tok) > 3):
            matched.append(r)

    functions = Counter()
    levels = Counter()
    industries = Counter()
    for r in matched:
        pos = _get_current_position(r)
        functions[pos.get('function') or 'Unknown'] += 1
        levels[pos.get('level') or 'Unknown'] += 1
        company = pos.get('company') or {}
        industries[company.get('industry') or 'Unknown'] += 1

    return {
        'job_title': job_title,
        'matches_in_sb': len(matched),
        'top_functions': functions.most_common(4),
        'top_levels': levels.most_common(4),
        'top_industries': industries.most_common(4),
    }


def get_sb_area_summary() -> dict:
    """High-level summary of all SB-area workers in the dataset."""
    records = _load()
    sb = [r for r in records if _is_sb_record(r)]

    functions = Counter()
    industries = Counter()
    recent_movers = 0
    for r in sb:
        pos = _get_current_position(r)
        fn = pos.get('function') or 'Unknown'
        ind = (pos.get('company') or {}).get('industry') or 'Unknown'
        functions[fn] += 1
        industries[ind] += 1
        dur = pos.get('duration')
        if dur is not None and dur <= 18:
            recent_movers += 1

    return {
        'total_sb_area_workers': len(sb),
        'recent_movers': recent_movers,
        'top_functions': functions.most_common(8),
        'top_industries': industries.most_common(6),
    }
