import React, { useEffect, useState } from 'react'
import { loadCsv } from '../lib/csv'
import { basicStats, uniqueValues } from '../lib/stats'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import DataTable from '../components/DataTable'

export default function EDA(){
  const [usage, setUsage] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    async function run(){
      const rows = await loadCsv('/mock/azure_usage.csv')
      // Normalize date to ISO YYYY-MM-DD
      rows.forEach(r => { if(r.date) r.date = String(r.date).slice(0,10) })
      setUsage(rows)
      setLoading(false)
    }
    run()
  }, [])

  if(loading) return <div className="subtle">Loading usage data…</div>
  if(!usage.length) return <div className="subtle">No data</div>

  const regions = uniqueValues(usage, 'region')
  const cpuStats = basicStats(usage, 'usage_cpu')
  const storageStats = basicStats(usage, 'usage_storage')
  const daily = usage.reduce((acc, r) => {
    const key = r.date
    if(!acc[key]) acc[key] = { date: key, usage_cpu: 0, usage_storage: 0, active_users: 0 }
    acc[key].usage_cpu += +r.usage_cpu || 0
    acc[key].usage_storage += +r.usage_storage || 0
    acc[key].active_users += +r.active_users || 0
    return acc
  }, {})
  const series = Object.values(daily).sort((a,b)=> a.date.localeCompare(b.date))

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="grid cols-3">
        <div className="card">
          <div className="subtle">Records</div>
          <div className="kpi">{usage.length.toLocaleString()}</div>
          <div className="small">Rows in azure_usage.csv</div>
        </div>
        <div className="card">
          <div className="subtle">Regions</div>
          <div className="kpi">{regions.length}</div>
          <div className="small">{regions.slice(0,5).join(', ')}{regions.length>5?'…':''}</div>
        </div>
        <div className="card">
          <div className="subtle">Avg CPU / Storage</div>
          <div className="kpi">{cpuStats.mean?.toFixed(1)} / {storageStats.mean?.toFixed(1)}</div>
          <div className="small">mean usage across all rows</div>
        </div>
      </div>

      <div className="card" style={{ height: 360 }}>
        <div className="subtle">Total usage over time</div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="usage_cpu" name="CPU" dot={false} />
            <Line type="monotone" dataKey="usage_storage" name="Storage" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <DataTable rows={usage} max={12} />
    </div>
  )
}