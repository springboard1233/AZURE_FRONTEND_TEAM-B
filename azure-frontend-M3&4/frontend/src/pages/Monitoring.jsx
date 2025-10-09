import React, { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'

export default function Monitoring() {
  const [region, setRegion] = useState('')
  const [service, setService] = useState('')
  const [metric, setMetric] = useState('usage_cpu')
  const [windowDays, setWindowDays] = useState(30)
  const [accuracy, setAccuracy] = useState(null)
  const [trend, setTrend] = useState([])
  const [monitor, setMonitor] = useState(null)
  const [filters, setFilters] = useState({ regions: [], resource_types: [] })
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(60) // seconds

  useEffect(() => {
    async function loadFilters() {
      try {
        const res = await fetch('/api/filters/options')
        const data = await res.json()
        setFilters({ regions: data.regions || [], resource_types: data.resource_types || [] })
        if ((data.regions || []).length > 0) setRegion(data.regions[0])
        if ((data.resource_types || []).length > 0) setService(data.resource_types[0])
      } catch (e) { /* ignore */ }
    }
    loadFilters()
  }, [])

  async function loadAccuracy() {
    setError('')
    try {
      const qs = new URLSearchParams({ region, resource_type: service, metric, window_days: String(windowDays) })
      const res = await fetch(`/api/report/accuracy?${qs.toString()}`)
      if (res.status === 404) {
        // No logs yet; treat as empty state rather than error
        setAccuracy({ rmse: null, mae: null, mape: null })
        setTrend([])
        return
      }
      if (!res.ok) throw new Error('Failed to load accuracy')
      const data = await res.json()
      setAccuracy({ rmse: data.rmse, mae: data.mae, mape: data.mape })
      setTrend(Array.isArray(data.trend) ? data.trend : [])
    } catch (e) {
      setError(String(e?.message || e))
    }
  }

  async function loadMonitoring() {
    setError('')
    try {
      const qs = new URLSearchParams({ region, resource_type: service, metric, window_days: String(windowDays) })
      const res = await fetch(`/api/monitoring?${qs.toString()}`)
      if (res.status === 404) {
        setMonitor(null)
        return
      }
      if (!res.ok) throw new Error('Failed to load monitoring')
      const data = await res.json()
      setMonitor(data)
    } catch (e) {
      setError(String(e?.message || e))
    }
  }

  useEffect(() => {
    if (!region || !service) return
    loadAccuracy()
    loadMonitoring()
  }, [region, service, metric, windowDays])

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => {
      loadAccuracy()
      loadMonitoring()
    }, Math.max(5, Number(refreshInterval)) * 1000)
    return () => clearInterval(id)
  }, [autoRefresh, refreshInterval, region, service, metric, windowDays])

  const health = useMemo(() => {
    const mape = Number(monitor?.accuracy?.mape)
    if (!isFinite(mape)) return { label: 'unknown', color: '#999' }
    const accuracyPct = 100 - mape
    if (accuracyPct > 85) return { label: 'Stable', color: '#66bb6a' }
    if (accuracyPct >= 70) return { label: 'Caution', color: '#ffca28' }
    return { label: 'Retrain Needed', color: '#ff5252' }
  }, [monitor])

  function fmt(val, suffix = '') {
    if (val === null || val === undefined || (typeof val === 'number' && !isFinite(val))) return 'N/A'
    return String(val) + suffix
  }

  async function onRefresh() {
    setRefreshing(true)
    await Promise.all([loadAccuracy(), loadMonitoring()])
    setRefreshing(false)
  }

  async function runDailyCron() {
    try {
      setError('')
      const qs = new URLSearchParams({ metric, horizon: String(30) })
      const res = await fetch(`/api/cron/daily?${qs.toString()}`)
      if (!res.ok) throw new Error('Failed to run daily cron')
      await onRefresh()
    } catch (e) {
      setError(String(e?.message || e))
    }
  }

  async function logForecastNow() {
    try {
      setError('')
      const res = await fetch('/api/forecast/run-and-store', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region, resource_type: service, metric, horizon: 14, safety_factor: 1.0 }) })
      if (!res.ok) throw new Error('Failed to log forecast')
      await onRefresh()
    } catch (e) {
      setError(String(e?.message || e))
    }
  }

  async function triggerRetrain() {
    try {
      setError('')
      const res = await fetch('/api/retrain', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to trigger retrain')
      await onRefresh()
    } catch (e) {
      setError(String(e?.message || e))
    }
  }

  return (
    <div>
      <h2>Monitoring</h2>
      <div style={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,.06)', padding: 16, borderRadius: 12, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <label>
          <div className='subtle'>Region</div>
          <select value={region} onChange={e => setRegion(e.target.value)}>
            {filters.regions.map(r => (<option key={r} value={r}>{r}</option>))}
          </select>
        </label>
        <label>
          <div className='subtle'>Service</div>
          <select value={service} onChange={e => setService(e.target.value)}>
            {filters.resource_types.map(s => (<option key={s} value={s}>{s}</option>))}
          </select>
        </label>
        <label>
          <div className='subtle'>Metric</div>
          <select value={metric} onChange={e => setMetric(e.target.value)}>
            <option value='usage_cpu'>usage_cpu</option>
            <option value='usage_storage'>usage_storage</option>
            <option value='users_active'>users_active</option>
          </select>
        </label>
        <label>
          <div className='subtle'>Window (days)</div>
          <select value={windowDays} onChange={e => setWindowDays(Number(e.target.value))}>
            {[14,30,60,90].map(w => (<option key={w} value={w}>{w}</option>))}
          </select>
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type='checkbox' checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
            <span className='small'>Auto-refresh</span>
          </label>
          <input type='number' min='5' step='5' value={refreshInterval} onChange={e => setRefreshInterval(Number(e.target.value))} style={{ width: 70 }} />
          <span className='small'>sec</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={logForecastNow}>Log Forecast Now</button>
          <button onClick={runDailyCron}>Run Daily</button>
          <button onClick={triggerRetrain}>Retrain</button>
        </div>
      </div>

      {error && <div style={{ color: 'red', marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div className='card'>
          <div className='subtle'>Model Health</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: 12, background: health.color }} />
            <div style={{ fontWeight: 'bold' }}>{health.label}</div>
          </div>
          <div className='small' style={{ marginTop: 8 }}>Accuracy = {monitor?.accuracy?.mape != null ? (100 - Number(monitor.accuracy.mape)).toFixed(1) : 'N/A'}%</div>
        </div>
        <div className='card'>
          <div className='subtle'>Drift Alert</div>
          {monitor?.drift ? (
            <div style={{ marginTop: 8 }}>
              <div className='small'>MAPE first half: {Number(monitor.drift.mape_first_half).toFixed(1)}%</div>
              <div className='small'>MAPE second half: {Number(monitor.drift.mape_second_half).toFixed(1)}%</div>
              <div className='small'>Δ MAPE: {Number(monitor.drift.delta_mape).toFixed(1)}%</div>
            </div>
          ) : (
            <div className='small' style={{ marginTop: 8 }}>No drift window available. This usually means insufficient logged forecasts.</div>
          )}
        </div>
        <div className='card'>
          <div className='subtle'>Last Retrain</div>
          <div className='kpi'>{monitor?.last_retrain_timestamp ? String(monitor.last_retrain_timestamp).replace('T',' ').slice(0,19) : 'N/A'}</div>
          <div className='small'>Last run: {monitor?.last_run_timestamp ? String(monitor.last_run_timestamp).replace('T',' ').slice(0,19) : 'N/A'}</div>
        </div>
        <div className='card'>
          <div className='subtle'>Summary</div>
          <div className='small'>RMSE: {fmt(monitor?.accuracy?.rmse)}</div>
          <div className='small'>MAE: {fmt(monitor?.accuracy?.mae)}</div>
          <div className='small'>MAPE: {monitor?.accuracy?.mape != null ? Number(monitor.accuracy.mape).toFixed(2) + '%' : 'N/A'}</div>
          <div className='small'>Data stale: {monitor?.data_stale != null ? String(monitor.data_stale) : 'N/A'}</div>
          <div className='small'>Need retraining: {monitor?.need_retraining != null ? String(monitor.need_retraining) : 'N/A'}</div>
        </div>
      </div>

      {/* Backend status details to display missing/null data explicitly */}
      <div style={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,.06)', padding: 16, borderRadius: 12, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0, color: 'var(--txt)', marginBottom: 10 }}>Backend Monitoring Data</h3>
        <div className='small'>Metric: {fmt(monitor?.metric)}</div>
        <div className='small'>Region: {fmt(monitor?.region)}</div>
        <div className='small'>Service: {fmt(monitor?.resource_type)}</div>
        <div className='small'>Window (days): {fmt(monitor?.window_days)}</div>
        <div className='small'>MAPE: {monitor?.accuracy?.mape != null ? Number(monitor.accuracy.mape).toFixed(2) + '%' : 'N/A'}</div>
        <div className='small'>RMSE: {fmt(monitor?.accuracy?.rmse)}</div>
        <div className='small'>MAE: {fmt(monitor?.accuracy?.mae)}</div>
        <div className='small'>Data stale: {monitor?.data_stale != null ? String(monitor.data_stale) : 'N/A'}</div>
        <div className='small'>Need retraining: {monitor?.need_retraining != null ? String(monitor.need_retraining) : 'N/A'}</div>
      </div>

      <div style={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,.06)', padding: 16, borderRadius: 12 }}>
        <h3 style={{ marginTop: 0, color: 'var(--txt)' }}>Model Accuracy Trend (Daily)</h3>
        <div style={{ width: '100%', height: 320 }}>
          {trend.length > 0 ? (
            <ResponsiveContainer>
              <LineChart data={trend.map(d => ({ ...d, accuracy_day: (d.mape_day != null ? (100 - Number(d.mape_day)) : null) }))} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,.1)' />
                <XAxis dataKey='date' tick={{ fontSize: 12, fill: 'var(--muted)' }} minTickGap={20} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                <Tooltip />
                <Legend />
                {/* Health thresholds */}
                <ReferenceLine y={85} stroke='#66bb6a' strokeDasharray='4 4' ifOverflow='extendDomain' />
                <ReferenceLine y={70} stroke='#ffca28' strokeDasharray='4 4' ifOverflow='extendDomain' />
                {/* Accuracy (%) derived from MAPE */}
                <Line type='monotone' dataKey='accuracy_day' name='Accuracy (%)' stroke='#66bb6a' strokeWidth={2} dot={false} />
                <Line type='monotone' dataKey='mape_day' name='MAPE (%)' stroke='#ff7300' strokeWidth={2} dot={false} />
                <Line type='monotone' dataKey='rmse_day' name='RMSE' stroke='#8884d8' strokeWidth={2} dot={false} />
                <Line type='monotone' dataKey='mae_day' name='MAE' stroke='#82ca9d' strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className='subtle' style={{ paddingTop: 40, textAlign: 'center' }}>
              No accuracy data yet. Run forecasts to populate logs, or use the daily cron endpoint.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


