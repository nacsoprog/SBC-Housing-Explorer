# Santa Barbara Housing & Demographics Explorer

An interactive web visualization and statistical modeling project submitted to the **SBCAG Code4Good 2026 Datathon**. The project applies open civic data to expose structural barriers to housing production in Santa Barbara County, in the spirit of the **Data4Good** initiative: using data science for civil and social benefit.

**Full analysis report:** [`Code4Good 2026/Datathon.pdf`](Code4Good%202026/Datathon.pdf)

---

## Project Summary

Santa Barbara County faces a compounding housing affordability crisis. This project investigates two interconnected questions:

1. **Where is housing production failing?** Using California's mandatory Housing Element reporting data, a *Housing Friction Rate* metric is derived per jurisdiction — quantifying what share of the housing pipeline (entitlements → permits → certificates of occupancy) never results in completed, habitable units.

2. **Can housing output predict cost burden?** A predictive modeling analysis in R tests whether income-stratified permit and occupancy data can forecast the average percent of households that are cost-burdened (spending >30% of income on housing).

---

## Components

### 1. Statistical Analysis (R / Tidymodels)

Located in `Code4Good 2026/Datathon.Rmd` | Compiled report: `Code4Good 2026/Datathon.pdf`

**Data sources:**

| Dataset | Description |
|---------|-------------|
| `APR_Download_2024.xlsx` | California HCD Annual Progress Report — income-stratified entitlements, permits, and certificates of occupancy by jurisdiction (2017–2021) |
| `Affordability.xlsx` | HUD/Census cost burden data — percent of households spending >30% or >50% of income on housing, by jurisdiction and year |

**Methodology:**

The two datasets are merged on jurisdiction and year, filtered to 2017–2021, and split 75/25 for training and testing. Six regression models are trained via 10-fold cross-validation to predict `percent_avg_burdened` (average cost burden rate) from income-stratified CO counts and aggregate cost burden totals:

| Model | Engine |
|-------|--------|
| Ridge Regression | `glmnet` (mixture = 0) |
| Lasso Regression | `glmnet` (mixture = 1) |
| Elastic Net | `glmnet` (mixture tuned) |
| K-Nearest Neighbors | `kknn` |
| Random Forest | `ranger` |
| Boosted Trees | `xgboost` |

All predictors are normalized. Hyperparameters are tuned over regularized grids and evaluated by RMSE.

**Results:**

KNN outperformed all other models on cross-validation RMSE and was selected as the final model. Final model performance was validated on the held-out test set via `last_fit()`, with residual diagnostics (residuals vs. predicted, Q-Q plot, actual vs. predicted) confirming reasonable fit with no severe systematic bias.

**Key finding:** Income-stratified housing production data (particularly very low and low income completions) shows meaningful correlation with cost burden rates, supporting the case that failing to complete affordable housing directly drives cost burden.

---

### 2. Interactive Map Visualization (React / Vite)

A choropleth dashboard rendering the **Housing Friction Rate** across 28 Santa Barbara County jurisdictions.

#### Housing Friction Rate

```
frictionRate = 1 − (COs ÷ max(entitlements, permits, COs))
```

Measures what fraction of the housing pipeline never reached completion. Regions with fewer than 20 total pipeline units, no permits issued, or where COs exceed pipeline start (cross-year artifact) are excluded.

| Rate | Interpretation |
|------|----------------|
| 0.00–0.25 | Low friction — most projects completed |
| 0.25–0.50 | Moderate attrition |
| 0.50–0.75 | High friction — significant drop-off |
| 0.75–1.00 | Very high friction — most projects did not complete |

Selected results:

| Jurisdiction | Friction Rate |
|---|---|
| Guadalupe | 0.79 |
| Buellton | 0.78 |
| Carpinteria | 0.57 |
| Summerland | 0.52 |
| Santa Ynez | 0.39 |
| Santa Barbara | 0.33 |
| Solvang | 0.30 |
| Orcutt | 0.25 |
| Santa Maria | 0.29 |
| Lompoc | 0.04 |

#### Features

- Click any region or label to view a step-by-step equation breakdown in the sidebar
- Layer toggle between base map and friction rate heatmap
- Expandable description panel explaining the metric and its Data4Good context
- Dynamic region count reflecting only jurisdictions with valid friction rate data
- Region search with highlight

---

### 3. AI Housing Advisor & Predictive Backend (Python / FastAPI)

A dynamic backend service providing localized AI recommendations and real-time model inference.

#### AI Advisor (RAG Pipeline)

Leverages a Retrieval-Augmented Generation (RAG) pipeline powered by **Llama-3.3** (via Groq) to provide context-aware recommendations:

- **Where to Build:** Analyzes workforce signals and affordability metrics to recommend jurisdiction targets for new affordable housing.
- **Worker Matching:** Matches specific job titles and income levels to viable Santa Barbara County communities, incorporating live workforce data.

#### Burden Prediction API

Serves the optimal predictive model (exported as `.onnx`) from the R statistical analysis, exposing a `/predict` endpoint that outputs expected cost burden rates given hypothetical housing pipeline metrics.

---

## Repository Structure

```
datathon-project/
├── Code4Good 2026/
│   ├── Datathon.Rmd           # Full statistical analysis (R / Tidymodels)
│   └── Datathon.pdf           # Compiled PDF report
├── scripts/
│   ├── generate_geojson.mjs   # Downloads Census shapefiles, filters to SB County
│   └── parse_pfs.mjs          # Aggregates PFS CSV into per-region friction metrics
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx       # Layout, layer state, region analysis panel
│   │   ├── SantaBarbaraMap.jsx # Choropleth map, annotations, zoom, click handlers
│   │   └── MapTooltip.jsx      # Hover tooltip
│   ├── data/
│   │   ├── santa_barbara_county.json  # County boundary GeoJSON
│   │   ├── santa_barbara_places.json  # 28 places GeoJSON
│   │   └── heatmap_data.json          # Per-region friction metrics (generated)
│   └── index.css              # Dark theme, glassmorphism design system
├── backend/
│   ├── main.py                # FastAPI server and endpoints
│   ├── rag_pipeline.py        # RAG implementation for AI Advisor
│   └── requirements.txt       # Python dependencies
├── burden_model.onnx          # Exported predictive model for inference
├── PFS_Datathon.csv           # Source: ~9,287 rows, CA HCD PFS reports
├── package.json
└── README.md
```

---

## Data Pipeline

### GeoJSON Generation

```bash
node scripts/generate_geojson.mjs
```

Downloads US Census TIGER/Line 2022 shapefiles and filters to Santa Barbara County jurisdictions. Run once; outputs are committed.

### Friction Rate Computation

```bash
node scripts/parse_pfs.mjs
```

Aggregates `PFS_Datathon.csv` by jurisdiction, computing total entitlements, permits, and COs. Applies three validity guards before computing a friction rate:

1. **Cross-year artifact** — COs ≥ pipelineStart excluded (completions arrived from permits issued before the dataset window)
2. **No permits issued** — entitlements-only regions excluded (construction friction requires permits)
3. **Insufficient volume** — pipelines with fewer than 20 units excluded as statistically unreliable

---

## Tech Stack

### Visualization

| Library | Version | Role |
|---------|---------|------|
| React | 19.2 | UI framework |
| Vite | 7.3 | Build tooling |
| react-simple-maps | 3.0 | SVG map via D3 projections |
| d3-scale | 4.0 | Linear color interpolation |
| d3-geo | 3.1 | Centroid calculation for annotations |
| lucide-react | 0.575 | Icons |
| csv-parser | 3.2 | Streaming CSV parsing |
| shapefile | 0.6 | Shapefile to GeoJSON |

### Analysis

| Library | Role |
|---------|------|
| tidymodels | Modeling framework (recipes, workflows, tuning) |
| glmnet | Ridge, Lasso, Elastic Net |
| kknn | K-Nearest Neighbors |
| ranger | Random Forest |
| xgboost | Gradient Boosted Trees |
| ggcorrplot | Correlation matrix visualization |
| readxl / writexl | Excel I/O |
| janitor | Column name cleaning |

### AI & Backend

| Technology | Role |
|------------|------|
| Python / FastAPI | High-performance backend API |
| Groq API (Llama-3.3) | Large language model for AI Advisor |
| ONNX Runtime | Predictive model inference |
| uvicorn | ASGI web server |

---

## Setup

### Prerequisites

Node.js 18+ (visualization); Python 3.9+ (backend); R 4.x with the libraries listed in `Datathon.Rmd` (analysis).

### Run Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Requires a `.env` file with `GROQ_API_KEY`. The API runs at [http://localhost:8000](http://localhost:8000).

### Run Visualization

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Regenerate Friction Data

```bash
node scripts/parse_pfs.mjs
```

### Build for Production

```bash
npm run build
```

---

## Methodology Notes

- **Timing lag:** The friction rate treats the dataset as a single cumulative pool rather than tracking annual cohorts. COs issued for permits from prior years can distort rates — this is why Goleta is excluded (941 COs from 692 permits). A more precise implementation would track units by permit year.
- **Predictive model scope:** The R analysis covers 2017–2021 and is limited to jurisdictions present in both the HCD and affordability datasets. Results should be interpreted as exploratory rather than causal.
- **Academic basis:** Friction rate methodology is consistent with "entitlement-to-construction conversion rate" analysis used by the UC Berkeley Terner Center and Urban Institute.

---

## License

Private — SBCAG Code4Good 2026 Datathon submission.
