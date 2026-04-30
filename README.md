# 🏗️ SBC Housing Explorer

An interactive dashboard for visualizing housing production, affordability metrics, and development friction across Santa Barbara County.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-Private-gray)
![Build](https://img.shields.io/badge/build-Vite-purple)

## 🌟 Overview

The **SBC Housing Explorer** is a data-driven visualization platform built for the *SBCAG Code4Good 2026 Datathon*. It aims to expose structural barriers to housing production by quantifying the "friction" between entitlements, permits, and completed units.

### Key Metrics
- **Housing Friction Rate:** Quantifies the percentage of the housing pipeline that fails to reach completion.
- **Affordability Gaps:** Visualizes the discrepancy between allocated housing needs (RHNA) and actual units generated.
- **Demographic Insights:** Overlays economic and workforce data to contextualize housing needs.

---

## 🛠️ Tech Stack

- **Frontend:** React 18, Vite
- **Visualization:** D3.js (Projections & Scales), React Simple Maps
- **Styling:** Vanilla CSS (Glassmorphism design system)
- **Icons:** Lucide React
- **Data Processing:** Node.js (CSV-to-JSON streaming)

---

## 📁 Project Structure

```text
├── scripts/             # Data processing & GeoJSON generation tools
├── src/
│   ├── components/      # React components (Map, Dashboard, Tooltips)
│   ├── data/            # Processed JSON data (the app's state)
│   ├── assets/          # Static assets & images
│   └── index.css        # Global styles & design tokens
├── datasets/            # Raw CSV data (excluded from production builds)
├── public/              # Static public assets
└── vercel.json          # Deployment configuration
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/nacsoprog/SBC-Housing-Explorer.git
   cd SBC-Housing-Explorer
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

### Data Pipeline
To update the dashboard with new raw data:
1. Place raw CSVs in the `datasets/` folder.
2. Run the processing scripts:
   ```bash
   node scripts/parse_pfs.mjs
   node scripts/parse_ims.mjs
   ```
3. The scripts will update the files in `src/data/`, which are then used by the frontend.

---

## 🌐 Deployment

The project is optimized for deployment on **Vercel**. 
Every push to the `main` branch automatically triggers a new build and deployment.

---

## 📝 License

This project was developed for the **SBCAG Code4Good 2026 Datathon**. All rights reserved.
