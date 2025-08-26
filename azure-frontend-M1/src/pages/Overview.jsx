import React from 'react'
import { Link } from 'react-router-dom'

export default function Overview(){
  return (
    <div className="grid cols-3">
      <div className="card">
        <div className="subtle">Milestone</div>
        <div className="kpi">M1 – Data Prep</div>
        <div className="small">Load CSVs, run EDA, merge external factors, export cleaned dataset.</div>
        <hr className="sep" />
        <Link className="link" to="/eda">Go to EDA →</Link>
      </div>
      <div className="card">
        <div className="subtle">Data Sources</div>
        <div className="kpi">Usage & External</div>
        <div className="small">From <span className="mono">public/mock/azure_usage.csv</span> and <span className="mono">external_factors.csv</span>.</div>
        <hr className="sep" />
        <a className="link" href="/mock/azure_usage.csv" target="_blank">View usage CSV</a>
        {' '}
        <a className="link" href="/mock/external_factors.csv" target="_blank">View external CSV</a>
      </div>
      <div className="card">
        <div className="subtle">Next</div>
        <div className="kpi">Feature Eng.</div>
        <div className="small">This UI will hand off a <span className="mono">cleaned_merged.csv</span> ready for M2.</div>
      </div>
    </div>
  )
}