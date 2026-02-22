"""
rag_pipeline.py
Retrieval logic for both advisor modes.
- retrieve_for_build()   → top places to build, weighted by need + low friction
- retrieve_for_worker()  → top places for affordability + vacancy
- build prompts for Groq
"""

from knowledge_base import load_all, to_build_doc, to_worker_doc


def _score_place(p: dict, weights: dict) -> float:
    """Composite scoring function. Higher = better candidate."""
    score = 0.0

    # Friction rate: lower = better building opportunity
    fr = p.get('friction_rate')
    if fr is not None:
        score += (1.0 - fr) * weights.get('w_friction', 1.0)

    # IMS cycle 6: higher = more unmet need (more important to build there)
    ims = p.get('ims_cycle6')
    if ims is not None:
        # Normalise roughly 0-3000 range to 0-1
        score += min(ims / 2000.0, 1.0) * weights.get('w_ims', 1.0)

    # Renter/owner vacancy: higher = more opportunity absorb new units
    vac = p.get('overall_vacancy_rate')
    if vac is not None:
        score += vac * weights.get('w_vacancy', 0.5)

    # Renter cost burden: high burden = urgent need
    rcb = p.get('renter_cost_burden_2021')
    if rcb is not None:
        score += rcb * weights.get('w_renter_burden', 0.5)

    return score


def retrieve_for_build(top_k: int = 4) -> tuple[list[str], list[str]]:
    """Return (documents, place_names) emphasising building need."""
    weights = {
        'w_friction': 1.2,
        'w_ims':      1.8,
        'w_vacancy':  0.4,
        'w_renter_burden': 0.8,
    }
    places = load_all()
    scored = sorted(places.items(), key=lambda kv: -_score_place(kv[1], weights))
    top = scored[:top_k]
    docs  = [to_build_doc(p) for _, p in top]
    names = [name for name, _ in top]
    return docs, names


def retrieve_for_worker(top_k: int = 4) -> tuple[list[str], list[str]]:
    """Return (documents, place_names) emphasising affordability + availability."""
    weights = {
        'w_friction':      0.1,
        'w_ims':           0.3,
        'w_vacancy':       1.5,   # availability matters
        'w_renter_burden': -1.2,  # high burden = bad for worker (penalise)
    }
    places = load_all()
    scored = sorted(places.items(), key=lambda kv: -_score_place(kv[1], weights))
    top = scored[:top_k]
    docs  = [to_worker_doc(p) for _, p in top]
    names = [name for name, _ in top]
    return docs, names


def build_advisor_prompt(question: str, docs: list[str], workforce_text: str) -> str:
    context = '\n'.join(docs)
    return f"""You are a housing policy advisor for Santa Barbara County with access to detailed data on every community in the county.

RETRIEVED COMMUNITY DATA (ranked by building priority):
{context}

LIVE WORKFORCE DATA (from Live Data Technologies — real professional job movement):
{workforce_text}

USER QUESTION:
{question}

Instructions:
- Recommend the top 2-3 specific communities by name.
- For each, cite the exact metric values from the data above that support your recommendation.
- Note which communities have workforce inflow pressure (from the Live Data) and low vacancy.
- Use bullet points. Be direct, data-driven, and concise."""


def build_worker_prompt(job_title: str, annual_income: float, docs: list[str], workforce_text: str) -> str:
    monthly_budget = annual_income * 0.30 / 12
    context = '\n'.join(docs)
    return f"""You are a housing affordability counselor for Santa Barbara County.

WORKER PROFILE:
- Job: {job_title}
- Annual Income: ${annual_income:,.0f}
- Maximum Affordable Monthly Housing Cost (30% rule): ${monthly_budget:,.0f}/month

COMMUNITY DATA (retrieved for affordability + availability):
{context}

LIVE WORKFORCE DATA (similar workers in the region, from Live Data Technologies):
{workforce_text}

Instructions:
- Recommend the top 3 communities where this worker can realistically afford to rent.
- For each community, explain: (1) why it's affordable based on the cost burden data, 
  (2) whether units are available (vacancy rate), (3) commute context if relevant.
- Call out any community where workers at this income level are typically cost-burdened (>30%).
- Use bullet points. Cite exact metric values. Be warm but realistic."""
