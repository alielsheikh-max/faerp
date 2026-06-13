# FAERP

FAERP is a modern on-prem ERP starter focused on monthly supplier price collection, managerial price analysis, and resale pricing control.

## What it includes

- Quick role-based login for:
  - `WH` — Purchasing
  - `SC` — Manager
  - `SA` — Sales
- SQLite-backed local data storage with automatic schema setup and demo seed data
- Purchasing form to capture supplier prices per item and month
- Manager dashboard for:
  - comparing the same item across multiple suppliers
  - reviewing price history
  - spotting same-month supplier price changes
  - setting monthly selling prices using `min`, `max`, or `average` strategy plus markup percentages
- Sales view for monthly approved minimum and maximum selling prices
- Administration module for user, supplier, category, and item CRUD
- Reporting module with printable monthly reports and CSV export
- Professional responsive UI designed for local intranet usage

## Stack

- Next.js
- React
- TypeScript
- SQLite via `better-sqlite3`

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Open:

```text
http://localhost:3000
```

## Notes

- The database file is created automatically under `data/faerp.sqlite`.
- The app seeds demo categories, items, suppliers, and historical pricing data on first run.
- Authentication is intentionally lightweight for an on-prem MVP and uses local seeded users plus secure cookies.

## Demo credentials

- `WH` Purchasing: `wh` / `wh123`
- `SC` Manager: `sc` / `sc123`
- `SA` Sales: `sa` / `sa123`
