import React, { useEffect, useState, useMemo } from 'react'
import { getInsights, getFeatures } from '../lib/api'
import DataTable from '../components/DataTable'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend, AreaChart, Area } from 'recharts'

export default function Insights() {
  const [insights, setInsights] = useState(null)
  const [features, setFeatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [region, setRegion] = useState('All')
  const [resource, setResource] = useState('usage_cpu')

  useEffect(() => {
    async function run() {
      const ins = await getInsights()
      const feats = await getFeatures()
      feats.forEach(r => {
        if (r.date) r.date = String(r.date).slice(0, 10)
      })
      setInsights(ins)
      setFeatures(feats)
      setLoading(false)
    }
    run()
  }, [])

  const regions = useMemo(() => 
    Array.from(new Set(features.map(r => r.region).filter(Boolean))), 
    [features]
  )

  const filtered = useMemo(() => {
    let out = features.slice()
    if (region !== 'All') out = out.filter(r => r.region === region)
    if (start) out = out.filter(r => r.date >= start)
    if (end) out = out.filter(r => r.date <= end)
    return out
  }, [features, start, end, region])

  const trendByDateAllRegions = useMemo(() => {
    const map = {}
    filtered.forEach(r => {
      const k = r.date
      if (!map[k]) map[k] = { date: k }
      map[k][resource] = (map[k][resource] || 0) + (+r[resource] || 0)
    })
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  }, [filtered, resource])

  const trendByRegion = useMemo(() => {
    const map = {}
    filtered.forEach(r => {
      const k = r.region
      if (!k) return
      if (!map[k]) map[k] = { region: k, usage_cpu: 0, usage_storage: 0 }
      map[k].usage_cpu += +r.usage_cpu || 0
      map[k].usage_storage += +r.usage_storage || 0
    })
    return Object.values(map).sort((a, b) => (a.region || '').localeCompare(b.region || ''))
  }, [filtered])

  const monthlySeasonal = useMemo(() => {
    const map = {}
    filtered.forEach(r => {
      const m = (r.date || '').slice(0, 7)
      if (!m) return
      if (!map[m]) map[m] = { month: m, usage_cpu: 0, usage_storage: 0, count: 0 }
      map[m].usage_cpu += +r.usage_cpu || 0
      map[m].usage_storage += +r.usage_storage || 0
      map[m].count += 1
    })
    return Object.values(map).map(d => ({ 
      month: d.month, 
      usage_cpu: d.usage_cpu, 
      usage_storage: d.usage_storage 
    })).sort((a, b) => a.month.localeCompare(b.month))
  }, [filtered])

  const weekdaySeasonal = useMemo(() => {
    const map = new Map()
    const order = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    filtered.forEach(r => {
      if (!r.date) return
      const d = new Date(r.date + 'T00:00:00')
      const w = order[d.getUTCDay()]
      if (!map.has(w)) map.set(w, { weekday: w, usage_cpu: 0, usage_storage: 0 })
      const x = map.get(w)
      x.usage_cpu += +r.usage_cpu || 0
      x.usage_storage += +r.usage_storage || 0
    })
    return order.map(w => map.get(w) || { weekday: w, usage_cpu: 0, usage_storage: 0 })
  }, [filtered])

  if (loading) return <div className='subtle'>Loading insights…</div>
  if (!insights) return <div className='subtle'>No insights available</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
      <div className='card' style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
          <label className='small'>Resource</label>
          <select 
            className='input' 
            value={resource} 
            onChange={e => setResource(e.target.value)}
          >
            <option value='usage_cpu'>CPU</option>
            <option value='usage_storage'>Storage</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <div className='card'>
          <div className='subtle'>Peak Demand</div>
          <div className='kpi'>{insights.peakTime}</div>
          <div className='small'>Highest observed demand</div>
        </div>
        <div className='card' style={{ height: 250 }}>
          <div className='subtle'>Top Regions by Growth</div>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart data={insights.topRegions}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis dataKey='region' />
              <YAxis />
              <Tooltip />
              <Bar dataKey='growthRate' />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className='card' style={{ height: 250 }}>
          <div className='subtle'>External Factor Impact</div>
          <ResponsiveContainer width='100%' height='100%'>
            <LineChart data={insights.externalImpact}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis dataKey='date' />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type='monotone' dataKey='economic_index' name='Economic Index' />
              <Line type='monotone' dataKey='usage_cpu' name='Usage CPU' />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className='card' style={{ height: 340 }}>
        <div className='subtle'>Trend ({resource}) across selected scope</div>
        <ResponsiveContainer width='100%' height='100%'>
          <AreaChart data={trendByDateAllRegions}>
            <defs>
              <linearGradient id='g1' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='5%' stopColor='#6aa3ff' stopOpacity={0.8} />
                <stop offset='95%' stopColor='#6aa3ff' stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis dataKey='date' />
            <YAxis />
            <Tooltip />
            <Area 
              type='monotone' 
              dataKey={resource} 
              stroke='#6aa3ff' 
              fillOpacity={1} 
              fill='url(#g1)' 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className='card' style={{ height: 340 }}>
        <div className='subtle'>Regional comparison (sum)</div>
        <ResponsiveContainer width='100%' height='100%'>
          <BarChart data={trendByRegion}>
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis dataKey='region' />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey='usage_cpu' name='CPU' fill='#6aa3ff' />
            <Bar dataKey='usage_storage' name='Storage' fill='#8acbff' />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className='card' style={{ height: 320 }}>
          <div className='subtle'>Monthly pattern</div>
          <ResponsiveContainer width='100%' height='100%'>
            <LineChart data={monthlySeasonal}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis dataKey='month' />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type='monotone' dataKey='usage_cpu' name='CPU' stroke='#6aa3ff' />
              <Line type='monotone' dataKey='usage_storage' name='Storage' stroke='#8acbff' />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className='card' style={{ height: 320 }}>
          <div className='subtle'>Weekday pattern</div>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart data={weekdaySeasonal}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis dataKey='weekday' />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey='usage_cpu' name='CPU' />
              <Bar dataKey='usage_storage' name='Storage' />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className='card' style={{ gridColumn: '1 / span 1' }}>
        <div className='subtle'>Features dataset (first 12 rows)</div>
        <DataTable rows={filtered} max={12} />
      </div>
    </div>
  )
}
