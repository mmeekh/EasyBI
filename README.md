# EasyBI — Lightweight BI Dashboard

> Paste your data. Build a dashboard. Export in seconds.

EasyBI is a zero-setup business intelligence tool built for analysts and finance teams who need quick KPI visualizations without the complexity of Power BI or Tableau.

<p align="center">
  <img src="docs/screenshot.webp" alt="EasyBI — Review &amp; Map Columns step with type detection and live sample preview" width="900">
  <br>
  <sub>Review &amp; Map Columns: automatic type detection, rename/toggle columns, live sample preview before import.</sub>
</p>

## Features

- **Instant Data Import** — paste raw text or upload CSV/XLSX files
- **Drag & Drop Layout** — arrange KPI cards and charts freely with multi-panel support
- **Chart Types** — bar, line, area, pie, scatter, and geo maps (Recharts + D3)
- **KPI Cards** — auto-calculated metrics with trend indicators
- **AI Suggestions** — smart chart recommendations based on your data shape
- **Export** — download as PNG, JPEG, or PDF; save/load full project as JSON
- **Themes** — light/dark mode with custom color palette management

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | React 19 + Vite 6 |
| Styling | Tailwind CSS + Framer Motion |
| Charts | Recharts 3 |
| Drag & Drop | @dnd-kit |
| Export | html2canvas + jsPDF |
| Data Parsing | xlsx |

## Getting Started

```bash
git clone https://github.com/mmeekh/EasyBI.git
cd EasyBI
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for production

```bash
npm run build
npm run preview
```

## Project Structure

```
EasyBI/
├── App.tsx              # Root component & export/import logic
├── components/          # UI components (charts, grid, panels)
├── hooks/               # Dashboard state & persistence
├── utils/               # Excel parser, color utils, geo helpers
└── constants.ts         # Themes and global config
```

## Motivation

Power BI is powerful but slow to set up for quick ad-hoc analysis. EasyBI was built as a lightweight alternative for fast internal reporting — especially useful for finance and ops teams who work with Excel data daily.

---

Built by [Muhammet Emin Kilic](https://linkedin.com/in/emin-kilic-250b14210)
