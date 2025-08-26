# Azure Demand Forecasting – Frontend (Milestone 1)

A lightweight React (Vite) UI to perform **data loading, EDA, and merge** for Milestone-1 — using CSVs stored in `public/mock/`.

## ✨ Features
- Load `azure_usage.csv` & `external_factors.csv`
- EDA: record counts, regions, averages, and a time-series chart
- Merge: forward-fill `usage_storage` per region, inner-join on `date`, and **download `cleaned_merged.csv`**
- Clean, modern UI; zero backend

## 📦 Getting Started
```bash
# Node 18+ recommended
npm i
npm run dev
# open http://localhost:5173
```

## 📁 Data
Place or replace CSVs here:
```
public/mock/azure_usage.csv
public/mock/external_factors.csv
```

## 🧪 Notes
- Join key is `date` (YYYY-MM-DD)
- Forward-fill is applied to `usage_storage` grouped by `region`
- You can tweak logic in `src/lib/stats.js`