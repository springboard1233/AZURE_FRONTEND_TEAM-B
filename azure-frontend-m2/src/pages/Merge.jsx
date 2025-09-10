import React, { useEffect, useState, useMemo } from 'react'
import { loadCsv } from '../lib/csv'
import { toCsv } from '../lib/csv'
import { saveAs } from 'file-saver'
import DataTable from '../components/DataTable'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts'

export default function Merge() {
  const [usage, setUsage] = useState([])
  const [ext, setExt] = useState([])
  const [merged, setMerged] = useState([])
  const [view, setView] = useState('after')
  const [metric, setMetric] = useState('usage_cpu')

  useEffect(() => {
    async function run() {
      const u = await loadCsv('/mock/azure_usage.csv')
      const e = await loadCsv('/mock/external_factors.csv')
      u.forEach(r => {
        if (r.date) r.date = String(r.date).slice(0, 10)
      })
      e.forEach(r => {
        if (r.date) r.date = String(r.date).slice(0, 10)
      })
      setUsage(u)
      setExt(e)
      const map = new Map()
      e.forEach(r => map.set(String(r.date), r))
      const mergedRows = u.map(r => ({ ...r, ...(map.get(String(r.date)) || {}) }))
      setMerged(mergedRows)
    }
    run()
  }, [])

  const comparisonSeries = useMemo(() => {
    const byDate = {}
    usage.forEach(r => {
      const k = r.date
      if (!byDate[k]) byDate[k] = { date: k, before_cpu: 0, before_storage: 0, after_cpu: 0, after_storage: 0 }
      byDate[k].before_cpu += +r.usage_cpu || 0
      byDate[k].before_storage += +r.usage_storage || 0
    })
    merged.forEach(r => {
      const k = r.date
      if (!byDate[k]) byDate[k] = { date: k, before_cpu: 0, before_storage: 0, after_cpu: 0, after_storage: 0 }
      byDate[k].after_cpu += +r.usage_cpu || 0
      byDate[k].after_storage += +r.usage_storage || 0
    })
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  }, [usage, merged])

  async function download() {
    const csv = toCsv(merged)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, 'cleaned_merged.csv')
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className='card' style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className='subtle'>View</div>
        <button 
          className='btn' 
          onClick={() => setView('before')} 
          style={{ opacity: view === 'before' ? 1 : 0.7 }}
        >
          Before
        </button>
        <button 
          className='btn' 
          onClick={() => setView('after')} 
          style={{ opacity: view === 'after' ? 1 : 0.7 }}
        >
          After
        </button>
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
        <div style={{ marginLeft: 'auto' }}>
          <button className='btn' onClick={download}>
            Download cleaned_merged.csv
          </button>
        </div>
      </div>
      
      <div className='card' style={{ height: 340 }}>
        <div className='subtle'>Before vs After (sum by date)</div>
        <ResponsiveContainer width='100%' height='100%'>
          <LineChart data={comparisonSeries}>
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis dataKey='date' />
            <YAxis />
            <Tooltip />
            <Legend />
            {metric === 'usage_cpu' ? (
              <>
                <Line type='monotone' dataKey='before_cpu' name='Before CPU' stroke='#8acbff' dot={false} />
                <Line type='monotone' dataKey='after_cpu' name='After CPU' stroke='#6aa3ff' dot={false} />
              </>
            ) : (
              <>
                <Line type='monotone' dataKey='before_storage' name='Before Storage' stroke='#8acbff' dot={false} />
                <Line type='monotone' dataKey='after_storage' name='After Storage' stroke='#6aa3ff' dot={false} />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {view === 'before' ? <DataTable rows={usage} max={15} /> : <DataTable rows={merged} max={15} />}
    </div>
  )
}
