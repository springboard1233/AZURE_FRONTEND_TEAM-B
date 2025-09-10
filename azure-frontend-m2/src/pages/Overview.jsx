import React from 'react'

export default function Overview() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
      <div className='card'>
        <div className='subtle'>Milestone</div>
        <div className='kpi'>M2 – Feature Eng & Insights</div>
        <div className='small'>New charts, filters, insights page, API integration</div>
      </div>
      <div className='card'>
        <div className='subtle'>Actions</div>
        <div className='kpi'>EDA → Insights</div>
        <div className='small'>Explore processed features & download cleaned data</div>
      </div>
      <div className='card'>
        <div className='subtle'>Data</div>
        <div className='kpi'>public/mock</div>
        <div className='small'>features.json + insights.json (mock)</div>
      </div>
    </div>
  )
}
