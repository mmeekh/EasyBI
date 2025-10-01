# EasyBI

EasyBI is a lightweight business intelligence dashboard that lets you upload spreadsheet data, explore previews, generate chart recommendations, and compose interactive dashboards powered by Plotly.

## Architecture

- **Backend:** FastAPI + Pandas (Python 3.11) exposing REST endpoints for file ingestion and chart generation.
- **Frontend:** React (Vite) single-page app with Plotly.js visualisations and a draggable dashboard layout.
- **Communication:** JSON over HTTP.
- **State:** In-memory only (no external database).

## Prerequisites

- Python 3.11+
- Node.js 18+
- npm 9+

## Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5050
```

The API will be available at `http://localhost:5050`.

### Key endpoints

| Endpoint | Method | Description |
| --- | --- | --- |
| `/upload-excel` | `POST (multipart/form-data)` | Upload a CSV/XLSX file. Returns detected columns and a 20-row preview. |
| `/suggest-charts` | `POST (application/json)` | Provide column metadata to receive suggested chart types. |
| `/generate-chart` | `POST (application/json)` | Request Plotly configuration for a chart type/axes/aggregation. |

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The development server runs at `http://localhost:5173` and proxies API calls to the backend configured in `VITE_API_BASE` (defaults to `http://localhost:5050`).

### Features

- Drag & drop spreadsheets (CSV/XLSX) into the upload area.
- Preview the first 20 rows with detected column datatypes.
- Display chart recommendations returned by the backend.
- Configure chart type, axes, and aggregation; add multiple charts to a draggable grid layout.
- Export individual charts as PNG or the entire dashboard as PDF (client-side using jsPDF + html2canvas).

## Docker Compose

To run both services together:

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5050

Hot reloading is enabled by mounting the project directories as volumes.

## Sample usage

1. Start both backend and frontend (locally or via Docker Compose).
2. Drag an Excel or CSV file into the upload panel.
3. Review the preview table and column metadata.
4. Select a recommended chart type, choose axes/aggregation, then click **Add Chart**.
5. Rearrange chart tiles on the dashboard and export as needed.

## Project structure

```
backend/
  main.py
  requirements.txt
  Dockerfile
frontend/
  src/
    App.jsx
    main.jsx
    styles.css
  package.json
  Dockerfile
  vite.config.js
README.md
```
