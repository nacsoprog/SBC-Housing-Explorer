# Santa Barbara Housing & Demographics Explorer

An interactive choropleth map dashboard visualizing housing development activity and barriers across Santa Barbara County. Built for the SBCAG Datathon using California's mandatory Housing Element reporting data (Permit Form Survey).

---

## Overview

This tool maps the **Housing Friction Rate** across 28 cities and Census Designated Places (CDPs) in Santa Barbara County — a derived metric that quantifies pipeline attrition in the housing development process based on annual state-reported data.

The data source is California's **Permit Form Survey (PFS)**, which jurisdictions are legally required to submit annually to the Department of Housing and Community Development (HCD) under Housing Element law. It tracks the complete housing production pipeline from entitlement through permit issuance through final certificate of occupancy.

---

## Features

### Interactive Choropleth Map

- Renders 28 Santa Barbara County cities and CDPs using US Census TIGER/Line 2022 boundaries
- Zoomable and pannable via `ZoomableGroup` with smooth animated transitions
- Annotated labels for all regions with collision-aware positioning for dense coastal areas

### Housing Friction Rate Heatmap

The primary analytical metric — a continuous 0–1 scale measuring housing pipeline attrition per jurisdiction:

```
frictionRate = 1 − (COs ÷ max(entitlements, permits, COs))
```

| Rate | Color | Interpretation |
|------|-------|----------------|
| 0.0 | Light pink | Minimal friction — nearly all projects were completed |
| 0.25–0.5 | Medium pink | Moderate attrition |
| 0.75–1.0 | Dark orange-red | Severe friction — most projects stalled or were not completed |

Selected results from the dataset:

| Jurisdiction | Friction Rate | Notes |
|---|---|---|
| Guadalupe | 0.79 | High attrition despite substantial permit activity |
| Buellton | 0.78 | High attrition despite 533 entitlements |
| Montecito | 0.77 | High attrition with small pipeline volume |
| Carpinteria | 0.57 | Moderate attrition |
| Santa Barbara | 0.33 | Below-median friction |
| Lompoc | 0.04 | Near-complete pipeline conversion |
| Goleta | 0.00 | More COs issued than pipeline start (cross-year cohort effect) |

### Layer Toggle

Switch between two display modes via the sidebar:

- **Base Map Only** — displays all 28 labeled regions with default styling
- **Housing Friction Rate** — activates the choropleth with friction color scale; only regions with measurable pipeline data are labeled (17 of 28)

### Region Search

Type-ahead search that highlights and focuses any region on the map, querying directly against `react-simple-maps` feature names.

### Dynamic Region Counter

The Total Regions counter updates reactively based on the active layer — 28 for the base map, and the count of regions with pipeline data when the heatmap is active.

---

## Architecture

```
datathon-project/
├── scripts/
│   ├── generate_geojson.mjs   # One-time: downloads Census shapefiles, filters to SB County
│   └── parse_pfs.mjs          # Aggregates PFS CSV into per-region metrics with friction rates
├── src/
│   ├── components/
│   │   ├── App.jsx             # Root component
│   │   ├── Dashboard.jsx       # Layout and activeLayer state management
│   │   ├── SantaBarbaraMap.jsx # Map rendering, choropleth, annotations, and controls
│   │   └── MapTooltip.jsx      # Hover tooltip component
│   ├── data/
│   │   ├── santa_barbara_county.json  # County boundary GeoJSON (Census 2022)
│   │   ├── santa_barbara_places.json  # 28 places GeoJSON (Census 2022)
│   │   └── heatmap_data.json          # Aggregated per-region metrics (generated)
│   ├── index.css              # Design system: dark theme, glassmorphism, animations
│   └── main.jsx               # Vite entry point
├── PFS_Datathon.csv           # Source data: ~9,287 rows of CA HCD PFS reports
├── index.html
├── package.json
└── vite.config.js
```

### Component Hierarchy

```
App
└── Dashboard            (activeLayer state: 'none' | 'permits')
    └── SantaBarbaraMap  (receives activeLayer prop)
        ├── ComposableMap > ZoomableGroup
        │   ├── Geographies [countyData]   — base county outline
        │   └── Geographies [placesData]   — choropleth + annotations
        ├── map-controls  (search bar + friction rate legend)
        ├── map-metric    (Total Regions counter)
        └── zoom-controls (zoom buttons, bottom-right)
```

---

## Data Pipeline

### Step 1 — Generate GeoJSON (`scripts/generate_geojson.mjs`)

Downloads and filters US Census TIGER/Line 2022 shapefiles to produce the boundary data used by the map.

```bash
node scripts/generate_geojson.mjs
```

- Downloads `cb_2022_06_place_500k.zip` (California Places) from the US Census Bureau
- Downloads `cb_2022_us_county_500k.zip` (County boundaries)
- Filters features to Santa Barbara County jurisdictions by name
- Outputs `src/data/santa_barbara_places.json` and `src/data/santa_barbara_county.json`
- Removes all temporary zip and shapefile artifacts on completion

> This script only needs to be run once. The generated GeoJSON files are committed to the repository.

### Step 2 — Parse PFS Data (`scripts/parse_pfs.mjs`)

Aggregates the raw PFS CSV into structured per-region pipeline metrics.

```bash
node scripts/parse_pfs.mjs
```

**Jurisdiction resolution:** Direct jurisdictions (e.g., `GOLETA`) are matched via an exact lookup table (`cityBuckets`). County-level rows (`SANTA BARBARA COUNTY`) are resolved by parsing the city from the street address field using comma-delimited splitting.

**Output schema** (`src/data/heatmap_data.json`):

```json
{
  "Santa Barbara": {
    "entitlements": 1375,
    "permits": 2311,
    "cos": 1545,
    "frictionRate": 0.3315
  }
}
```

| Field | Source Column | Description |
|-------|---------------|-------------|
| `entitlements` | `Total Entitlements` | Units approved to proceed |
| `permits` | `Total Number of Building Permits` | Building permits issued |
| `cos` | `Total Number of Units Issued Cert. of Occupancy` | Units completed and habitable |
| `frictionRate` | Derived | Pipeline attrition rate (0–1); `null` if no activity |

Regions with zero activity across all three fields receive `frictionRate: null` and are excluded from the heatmap layer.

---

## Tech Stack

| Library | Version | Role |
|---------|---------|------|
| [React](https://react.dev) | 19.2 | UI framework |
| [Vite](https://vite.dev) | 7.3 | Build tooling and development server |
| [react-simple-maps](https://www.react-simple-maps.io/) | 3.0 | SVG map rendering via D3 projections |
| [d3-scale](https://d3js.org/d3-scale) | 4.0 | Linear color interpolation for the choropleth |
| [d3-geo](https://d3js.org/d3-geo) | 3.1 | `geoCentroid` for annotation subject placement |
| [lucide-react](https://lucide.dev) | 0.575 | UI icons |
| [csv-parser](https://github.com/mafintosh/csv-parser) | 3.2 | Streaming CSV parsing in Node scripts |
| [shapefile](https://github.com/mbostock/shapefile) | 0.6 | Census shapefile to GeoJSON conversion |

**Map projection:** Mercator (`geoMercator`), centered on `[-120.2, 34.65]` at scale `35000`.

---

## Design

All styling is implemented in Vanilla CSS with CSS custom properties defined in `src/index.css`:

- **Color scheme:** Dark mode (`#020617` base) with glassmorphic panels using `rgba` backgrounds and `backdrop-filter: blur`
- **Typography:** [Outfit](https://fonts.google.com/specimen/Outfit) via Google Fonts
- **Animations:** Zoom transitions via `.animating-zoom g { transition: transform 0.3s ease-out }`
- **Color tokens:** `--accent-purple`, `--text-primary/secondary/muted`, `--map-place-fill/hover/stroke`

---

## Getting Started

### Prerequisites

Node.js 18 or later.

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:5173](http://localhost:5173).

### Regenerate Heatmap Data

If the source `PFS_Datathon.csv` is updated:

```bash
node scripts/parse_pfs.mjs
```

To regenerate GeoJSON boundaries from the Census Bureau (requires internet access):

```bash
node scripts/generate_geojson.mjs
```

### Build for Production

```bash
npm run build
```

Output is written to `dist/`.

---

## Data Source and Methodology

- **Source:** California HCD Annual Progress Report (APR) / Permit Form Survey (PFS), compiled by SBCAG
- **Coverage:** All Santa Barbara County jurisdictions, 2018–present
- **Friction Rate Methodology:** The metric compares cumulative totals across all years in the dataset rather than matched cohorts. Cross-year volume mismatches — such as Goleta's 0% friction resulting from certificates of occupancy arriving for permits issued in prior reporting periods — are an expected artifact of this approach. A more precise implementation would track cohorts by permit issuance year.
- **Academic basis:** Consistent with the "entitlement-to-construction conversion rate" methodology used by the UC Berkeley Terner Center and Urban Institute in housing pipeline attrition research.

---

## License

Private — SBCAG Datathon submission.
