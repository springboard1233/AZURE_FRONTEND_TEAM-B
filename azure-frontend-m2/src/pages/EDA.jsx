import React, { useEffect, useState } from 'react'
import { loadCsv } from '../lib/csv'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import DataTable from '../components/DataTable'

export default function EDA() {
  const [usage, setUsage] = useState([])
  const [filtered, setFiltered] = useState([])
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [region, setRegion] = useState('All')
  const [metric, setMetric] = useState('usage_cpu')

  useEffect(() => {
    async function run() {
      const rows = await loadCsv('/mock/azure_usage.csv')
      rows.forEach(r => {
        if (r.date) r.date = String(r.date).slice(0, 10)
      })
      setUsage(rows)
      setFiltered(rows)
    }
    run()
  }, [])

  useEffect(() => {
    let out = usage.slice()
    if (region !== 'All') out = out.filter(r => r.region === region)
    if (start) out = out.filter(r => r.date >= start)
    if (end) out = out.filter(r => r.date <= end)
    setFiltered(out)
  }, [usage, start, end, region, metric])

  const regions = Array.from(new Set(usage.map(r => r.region).filter(Boolean)))
  
  const daily = filtered.reduce((acc, r) => {
    const k = r.date
    if (!acc[k]) acc[k] = { date: k, usage_cpu: 0, usage_storage: 0 }
    acc[k].usage_cpu += +r.usage_cpu || 0
    acc[k].usage_storage += +r.usage_storage || 0
    return acc
  }, {})
  
  const series = Object.values(daily).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10 }} className='card'>
        <div>
          <label className='small'>From</label>
          <input 
            className='input' 
            type='date' 
            value={start} 
            onChange={e => setStart(e.target.value)} 
          />
        </div>
        <div>
          <label className='small'>To</label>
          <input 
            className='input' 
            type='date' 
            value={end} 
            onChange={e => setEnd(e.target.value)} 
          />
        </div>
        <div>
          <label className='small'>Region</label>
          <select 
            className='input' 
            value={region} 
            onChange={e => setRegion(e.target.value)}
          >
            <option>All</option>
            {regions.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className='small'>Metric</label>
          <select 
            className='input' 
            value={metric} 
            onChange={e => setMetric(e.target.value)}
          >
            <option value='usage_cpu'>CPU</option>
            <option value='usage_storage'>Storage</option>
          </select>
        </div>
      </div>
      
      <div className='card' style={{ height: 360 }}>
        <div className='subtle'>Regional trend ({metric})</div>
        <ResponsiveContainer width='100%' height='100%'>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis dataKey='date' />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type='monotone' dataKey={metric} dot={false} name={metric} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <DataTable rows={filtered} max={12} />
    </div>
  )
}
