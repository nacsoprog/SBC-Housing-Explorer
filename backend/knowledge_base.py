"""
knowledge_base.py
Loads all per-place housing metric JSON files into a flat dict.
Also exposes to_document() that converts a place dict into a plain-text
chunk ready for retrieval.
"""

import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')


def load_all() -> dict[str, dict]:
    """Return a dict keyed by place name, value = all available metrics."""

    def _read(fname):
        path = os.path.join(DATA_DIR, fname)
        if not os.path.exists(path):
            return {}
        with open(path, encoding='utf-8') as f:
            return json.load(f)

    friction      = _read('heatmap_data.json')
    ims           = _read('ims_data.json')
    affordability = _read('affordability_data.json')
    vacancy       = _read('vacancy_data.json')

    all_names = set(friction) | set(ims) | set(affordability) | set(vacancy)

    places = {}
    for name in all_names:
        aff_2021 = affordability.get(name, {}).get('2021', {})
        vac      = vacancy.get(name, {})
        ims_c6   = ims.get(name, {}).get('cycle6', {})
        ims_c5   = ims.get(name, {}).get('cycle5', {})
        fr       = friction.get(name, {})

        places[name] = {
            'name':                    name,
            'friction_rate':           fr.get('frictionRate'),
            'permit_rate':             fr.get('permitRate'),
            'completion_rate':         fr.get('completionRate'),
            'ims_cycle6':              ims_c6.get('ims'),
            'ims_cycle5':              ims_c5.get('ims'),
            'owner_cost_burden_2021':  aff_2021.get('ownerRate'),
            'renter_cost_burden_2021': aff_2021.get('renterRate'),
            'owner_burdened':          aff_2021.get('ownerBurdened'),
            'owner_total':             aff_2021.get('ownerTotal'),
            'renter_burdened':         aff_2021.get('renterBurdened'),
            'renter_total':            aff_2021.get('renterTotal'),
            'overall_vacancy_rate':    vac.get('overallRate'),
            'renter_vacancy_rate':     vac.get('renterRate'),
            'owner_vacancy_rate':      vac.get('ownerRate'),
            'total_vacant':            vac.get('totalVacant'),
            'for_rent':                vac.get('forRent'),
            'for_sale':                vac.get('forSaleOnly'),
            'occupied_units':          vac.get('occupied'),
        }

    return places


def _fmt(v, pct=False, decimals=1):
    if v is None:
        return 'N/A'
    if pct:
        return f'{v * 100:.{decimals}f}%'
    if isinstance(v, float):
        return f'{v:.{decimals}f}'
    return str(v)


def to_build_doc(p: dict) -> str:
    """Context-specific JSON for build recommendations."""
    return json.dumps({
        "community": p['name'],
        "friction_rate": _fmt(p['friction_rate'], pct=True),
        "permit_rate": _fmt(p['permit_rate'], pct=True),
        "completion_rate": _fmt(p['completion_rate'], pct=True),
        "ims_cycle6": _fmt(p['ims_cycle6']),
        "renter_burden": _fmt(p['renter_cost_burden_2021'], pct=True),
        "overall_vacancy": _fmt(p['overall_vacancy_rate'], pct=True)
    })

def to_worker_doc(p: dict) -> str:
    """Context-specific JSON for worker affordability recommendations."""
    return json.dumps({
        "community": p['name'],
        "renter_burden": _fmt(p['renter_cost_burden_2021'], pct=True),
        "overall_vacancy": _fmt(p['overall_vacancy_rate'], pct=True),
        "renter_vacancy": _fmt(p['renter_vacancy_rate'], pct=True)
    })
