import React, { useEffect, useState } from 'react'

export default function Overview() {
  const [kpis, setKpis] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/kpis')
        if (!res.ok) throw new Error('Failed to load KPIs')
        const data = await res.json()
        setKpis(data)
      } catch (e) {
        setError(String(e?.message || e))
      }
    }
    load()
  }, [])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
      <div className='card'>
        <div className='subtle'>Milestone</div>
        <div className='kpi'>M3 – Backend Integration</div>
        <div className='small'>Frontend pages connected to Flask API</div>
      </div>
      <div className='card'>
        <div className='subtle'>KPIs (from API)</div>
        {error && <div className='small' style={{ color: 'red' }}>{error}</div>}
        {!kpis ? (
          <div className='small'>Loading…</div>
        ) : (
          <div>
            <div className='small'>Date range</div>
            <div className='kpi'>{String(kpis?.date_range?.start || '')?.slice(0,10)} → {String(kpis?.date_range?.end || '')?.slice(0,10)}</div>
            <div className='small'>Regions</div>
            <div className='kpi'>{kpis?.total_regions}</div>
          </div>
        )}
      </div>
      <div className='card'>
        <div className='subtle'>Data</div>
        <div className='kpi'>Processed</div>
        <div className='small'>Served via `/api` proxy</div>
      </div>
    </div>
  )
}
