"""
FastAPI AI Advisor Backend

Endpoints:
  POST /api/build-advisor   -> Uses Groq Llama-3.3 to advise where SB county should build affordable housing.
  POST /api/worker-match    -> Uses Groq Llama-3.3 to find matching affordable housing based on job title.
  GET  /api/sb-workforce    -> Returns live workforce job breakdowns for regions.
  GET  /health              -> Health check.
"""
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from dotenv import load_dotenv
import onnxruntime as ort
import numpy as np

# Load ONNX model at startup
try:
    model_path = os.path.join(os.path.dirname(__file__), '..', 'burden_model.onnx')
    burden_model_session = ort.InferenceSession(model_path)
    print("Successfully loaded burden_model.onnx")
except Exception as e:
    print(f"Warning: could not load ONNX model: {e}")
    burden_model_session = None

from rag_pipeline import (
    retrieve_for_build,
    retrieve_for_worker,
    build_advisor_prompt,
    build_worker_prompt,
)
from live_data import get_workforce_summary, get_workers_by_title, get_sb_area_summary

env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path)

groq_client = Groq(api_key=os.getenv('GROQ_API_KEY'))
MODEL = 'llama-3.3-70b-versatile'

app = FastAPI(title='SB Housing AI Advisor', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)


def _chat(prompt: str, max_tokens: int = 800) -> str:
    resp = groq_client.chat.completions.create(
        model=MODEL,
        messages=[{'role': 'user', 'content': prompt}],
        temperature=0.25,
        max_tokens=max_tokens,
    )
    return resp.choices[0].message.content


# ── Request models ────────────────────────────────────────────────

class BuildRequest(BaseModel):
    question: str


class WorkerRequest(BaseModel):
    job_title: str
    annual_income: float  # USD per year


class PredictRequest(BaseModel):
    jurisdiction: str
    population: float
    very_low: float
    low: float
    moderate: float
    above_moderate: float


@app.post("/predict")
async def predict_burden(req: PredictRequest):
    if not burden_model_session:
        return {"predicted_burden": 0.0, "error": "Model not loaded"}
    
    # ONNX model expects 13 features:
    # 5 base numeric: population, very_low, low, moderate, above_moderate
    # 8 one-hot jurisdictions
    raw_features = [
        req.population,
        req.very_low,
        req.low,
        req.moderate,
        req.above_moderate
    ]
    
    locations = ['BUELLTON', 'CARPINTERIA', 'GOLETA', 'GUADALUPE', 'LOMPOC', 'SANTA BARBARA', 'SANTA MARIA', 'SOLVANG']
    one_hot = [1.0 if req.jurisdiction.upper() == loc else 0.0 for loc in locations]
    
    input_vector = np.array([raw_features + one_hot], dtype=np.float32)
    
    try:
        inputs = {burden_model_session.get_inputs()[0].name: input_vector}
        pred = burden_model_session.run(None, inputs)[0][0, 0]
        # ensure bounded between 0 and 1
        pred = max(0.0, min(float(pred), 1.0))
        return {"predicted_burden": pred}
    except Exception as e:
        print(f"ONNX prediction error: {e}")
        return {"predicted_burden": 0.0, "error": str(e)}


# ── Endpoints ─────────────────────────────────────────────────────

@app.get('/health')
def health():
    return {'status': 'ok', 'model': MODEL}


@app.post('/api/build-advisor')
def build_advisor(req: BuildRequest):
    """Idea 2 — Where Should the County Build?"""
    if not req.question.strip():
        raise HTTPException(status_code=400, detail='question is required')

    # 1. Retrieve top places for building
    docs, place_names = retrieve_for_build(top_k=5)

    # 2. Pull workforce signals for top 3 places
    workforce_lines = []
    for city in place_names[:3]:
        summary = get_workforce_summary(city)
        if summary['total_workers'] > 0:
            fns = ', '.join(f"{fn} ({ct})" for fn, ct in summary['top_functions'][:3])
            workforce_lines.append(
                f"  • {city}: {summary['total_workers']} professionals tracked, "
                f"{summary['recent_movers']} recent job movers. "
                f"Top functions: {fns}."
            )
        else:
            workforce_lines.append(f"  • {city}: No workforce records in dataset.")

    # Also add county-wide signal
    sb_summary = get_sb_area_summary()
    workforce_lines.insert(0,
        f"SB County overall: {sb_summary['total_sb_area_workers']} professionals tracked, "
        f"{sb_summary['recent_movers']} changed jobs recently."
    )
    workforce_text = '\n'.join(workforce_lines)

    # 3. Build and send prompt
    prompt = build_advisor_prompt(req.question, docs, workforce_text)
    answer = _chat(prompt, max_tokens=900)

    return {
        'answer': answer,
        'retrieved_places': place_names,
        'workforce_summary': workforce_text,
        'model': MODEL,
    }


@app.post('/api/worker-match')
def worker_match(req: WorkerRequest):
    """Idea 4 — Match a Worker to a Community."""
    if not req.job_title.strip():
        raise HTTPException(status_code=400, detail='job_title is required')
    if req.annual_income <= 0:
        raise HTTPException(status_code=400, detail='annual_income must be positive')

    # 1. Retrieve top places for affordability
    docs, place_names = retrieve_for_worker(top_k=6)

    # 2. Live Data: find similar workers in SB area
    worker_signal = get_workers_by_title(req.job_title, sb_only=True)

    if worker_signal['matches_in_sb'] > 0:
        levels = ', '.join(f"{l} ({c})" for l, c in worker_signal['top_levels'][:3])
        inds   = ', '.join(f"{i} ({c})" for i, c in worker_signal['top_industries'][:3])
        workforce_text = (
            f"{worker_signal['matches_in_sb']} '{req.job_title}' professionals "
            f"found in the SB-area dataset. "
            f"Job levels: {levels}. Industries: {inds}."
        )
    else:
        # Fallback: county-wide summary
        sb = get_sb_area_summary()
        fns = ', '.join(f"{fn} ({ct})" for fn, ct in sb['top_functions'][:4])
        workforce_text = (
            f"No exact matches for '{req.job_title}' in SB dataset. "
            f"County-wide: {sb['total_sb_area_workers']} professionals tracked. "
            f"Top sectors: {fns}."
        )

    # 3. Build and send prompt
    prompt = build_worker_prompt(req.job_title, req.annual_income, docs, workforce_text)
    answer = _chat(prompt, max_tokens=800)

    return {
        'answer': answer,
        'retrieved_places': place_names,
        'workforce_signal': workforce_text,
        'monthly_budget': round(req.annual_income * 0.30 / 12),
        'model': MODEL,
    }


@app.get('/api/sb-workforce')
def sb_workforce():
    """Return a summary of SB-area workers from Live Data."""
    return get_sb_area_summary()
