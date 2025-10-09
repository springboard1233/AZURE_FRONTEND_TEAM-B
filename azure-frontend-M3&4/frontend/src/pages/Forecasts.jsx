import React, { useEffect, useMemo, useState } from 'react'
import { getFilters, getTimeSeries } from '../lib/api'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ComposedChart
} from 'recharts'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

export default function Forecasts() {
  const [regions, setRegions] = useState([])
  const [services, setServices] = useState([])
  const [region, setRegion] = useState('')
  const [service, setService] = useState('')
  const [horizon, setHorizon] = useState(30)
  const [metric, setMetric] = useState('cloud_market_demand')
  const [model, setModel] = useState('xgboost') // 'xgboost' | 'arima'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forecast, setForecast] = useState([])
  const [history, setHistory] = useState([])
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [arimaForecast, setArimaForecast] = useState([])
  const [xgboostForecast, setXgboostForecast] = useState([])
  const [modelComparisonData, setModelComparisonData] = useState([])
  const [bestModel, setBestModel] = useState(null)
  const [capacityPlan, setCapacityPlan] = useState([])
  const [safetyFactor, setSafetyFactor] = useState(1.2)
  const [activeTab, setActiveTab] = useState('forecast') // 'forecast' | 'capacity'
  const [availableCapacity, setAvailableCapacity] = useState(0)
  const [assessment, setAssessment] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const opts = await getFilters()
        setRegions(opts?.regions || [])
        setServices(opts?.resource_types || [])
        if ((opts?.regions || []).length > 0) setRegion(opts.regions[0])
        if ((opts?.resource_types || []).length > 0) setService(opts.resource_types[0])
      } catch (e) { console.warn(e) }
    }
    load()
  }, [])

  useEffect(() => {
    async function loadHistory() {
      if (!region || !service) return
      try {
        const ts = await getTimeSeries({ region, resource_type: service })
        let cleaned = (Array.isArray(ts) ? ts : []).map(d => ({
          date: d.date,
          value: Number(d[metric]) || 0
        }))
        // Filter by date range if selected
        if (startDate && endDate) {
          cleaned = cleaned.filter(d =>
            new Date(d.date) >= startDate && new Date(d.date) <= endDate
          )
        }
        setHistory(cleaned)
      } catch (e) { console.warn(e) }
    }
    loadHistory()
  }, [region, service, metric, startDate, endDate])

  useEffect(() => {
    async function loadModelComparison() {
      try {
        // First check if backend is reachable
        const healthRes = await fetch('/api/health')
        if (!healthRes.ok) {
          console.error('Backend health check failed:', healthRes.status)
          return
        }
        console.log('Backend is reachable')
        
        const res = await fetch('/api/model-comparison')
        if (res.ok) {
          const data = await res.json()
          console.log('Model comparison data:', data) // Debug log
          setModelComparisonData(data.models || [])
          setBestModel(data.best_model || null)
        } else {
          console.error('Failed to fetch model comparison data:', res.status)
        }
      } catch (e) { 
        console.error('Error loading model comparison:', e) 
      }
    }
    loadModelComparison()
  }, [])

  async function fetchForecast() {
    if (!region || !service) return
    setLoading(true)
    setError('')
    setForecast([])
    try {
      const qs = new URLSearchParams({ metric, horizon: String(horizon) })
      let url = ''
      if (model === 'arima') {
        url = `/api/forecast/arima?${qs.toString()}&region=${encodeURIComponent(region)}&resource_type=${encodeURIComponent(service)}`
      } else {
        url = `/api/forecast/${encodeURIComponent(region)}/${encodeURIComponent(service)}?${qs.toString()}`
      }
      const res = await fetch(url)
      if (!res.ok) {
        const text = await res.text()
        console.error('Forecast API error:', text)
        throw new Error('Forecast request failed: ' + text)
      }
      const data = await res.json()
      console.log('Forecast API response:', data) // Debug log
      const forecastData = Array.isArray(data?.points) ? data.points : []
      console.log('Processed forecast data:', forecastData) // Debug log
      setForecast(forecastData)
    } catch (e) {
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  function downloadReport(type = 'logs') {
    // Opens backend export endpoint; browser downloads CSV
    const qs = new URLSearchParams({
      type,
      region: region || '',
      resource_type: service || '',
      metric,
      window_days: '30'
    })
    const url = `/api/report/export?${qs.toString()}`
    window.open(url, '_blank')
  }

  async function fetchCapacityRecommendation() {
    if (!region || !service) return
    setLoading(true)
    setError('')
    setCapacityPlan([])
    try {
      const qs = new URLSearchParams({ metric, horizon: String(horizon), safety_factor: String(safetyFactor) })
      const url = `/api/capacity/recommendation?${qs.toString()}&region=${encodeURIComponent(region)}&resource_type=${encodeURIComponent(service)}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Capacity recommendation failed')
      const data = await res.json()
      const pts = Array.isArray(data?.points) ? data.points : []
      setCapacityPlan(pts)
    } catch (e) {
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  async function fetchCapacityAssessment() {
    if (!region || !service) return
    setLoading(true)
    setError('')
    setAssessment(null)
    try {
      const qs = new URLSearchParams({ 
        metric, 
        horizon: String(horizon), 
        available_capacity: String(availableCapacity), 
        safety_factor: String(safetyFactor),
        region: region,
        resource_type: service
      })
      const url = `/api/capacity/assessment?${qs.toString()}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Capacity assessment failed')
      const data = await res.json()
      setAssessment(data)
    } catch (e) {
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  async function fetchBothForecasts() {
    if (!region || !service) return
    setLoading(true)
    setError('')
    setArimaForecast([])
    setXgboostForecast([])
    try {
      const qs = new URLSearchParams({ metric, horizon: String(horizon) })
      const arimaUrl = `/api/forecast/arima?${qs.toString()}&region=${encodeURIComponent(region)}&resource_type=${encodeURIComponent(service)}`
      const xgboostUrl = `/api/forecast/${encodeURIComponent(region)}/${encodeURIComponent(service)}?${qs.toString()}`
      const [arimaRes, xgboostRes] = await Promise.all([fetch(arimaUrl), fetch(xgboostUrl)])
      if (!arimaRes.ok || !xgboostRes.ok) throw new Error('Forecast request failed')
      const arimaData = await arimaRes.json()
      const xgboostData = await xgboostRes.json()
      console.log('ARIMA forecast response:', arimaData) // Debug log
      console.log('XGBoost forecast response:', xgboostData) // Debug log
      const arimaForecastData = Array.isArray(arimaData?.points) ? arimaData.points : []
      const xgboostForecastData = Array.isArray(xgboostData?.points) ? xgboostData.points : []
      console.log('Processed ARIMA forecast:', arimaForecastData) // Debug log
      console.log('Processed XGBoost forecast:', xgboostForecastData) // Debug log
      setArimaForecast(arimaForecastData)
      setXgboostForecast(xgboostForecastData)
    } catch (e) {
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  const horizonOptions = useMemo(() => [7, 14, 30], [])

  // Color schemes for charts
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#2ca02c', '#d62728']
  const MODEL_COLORS = {
    'ARIMA': '#8884d8',
    'XGBoost': '#ff7300', 
    'LSTM': '#2ca02c'
  }

  // Prepare data for model comparison charts
  const modelPerformanceData = useMemo(() => {
    const processed = modelComparisonData.map(model => ({
      name: model.name,
      rmse: model.rmse || 0,
      mae: model.mae || 0,
      mape: model.mape || 0,
      bias: model.bias || 0,
      training_time: model.training_time_s || 0,
      inference_time: model.inference_ms_per_sample || 0,
      isBest: model.name === bestModel
    }))
    console.log('Processed model performance data:', processed) // Debug log
    return processed
  }, [modelComparisonData, bestModel])

  const modelDistributionData = useMemo(() => {
    return modelComparisonData.map((model, index) => ({
      name: model.name,
      value: model.rmse || 0,
      color: COLORS[index % COLORS.length]
    }))
  }, [modelComparisonData])

  const mergedSeries = useMemo(() => {
    // Merge last 90d history with forecast; mark type
    const lastHistory = history.slice(Math.max(0, history.length - 90))
    const hist = lastHistory.map(d => ({ date: d.date, actual: d.value }))
    const fc = (forecast || []).map(d => ({
      date: d.date,
      forecast: Number(d.forecast) || 0,
      lower_95: d.lower_95 != null ? Number(d.lower_95) : undefined,
      upper_95: d.upper_95 != null ? Number(d.upper_95) : undefined
    }))
    const merged = [...hist, ...fc]
    console.log('Merged series data:', merged) // Debug log
    return merged
  }, [history, forecast])

  function downloadCSV(data, filename = 'forecast.csv') {
    const csvRows = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ]
    const csv = csvRows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ 
          background: 'var(--panel)', 
          border: '1px solid rgba(255,255,255,.1)', 
          padding: 12,
          borderRadius: '8px',
          color: 'var(--txt)'
        }}>
          <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Date: {label}</div>
          {payload.map((p, i) => (
            <div key={i} style={{ color: p.color, marginBottom: '4px' }}>
              <b>{p.name}:</b> {p.value}
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div>
      <h2>Forecasts</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button 
          className='tab-btn'
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: activeTab === 'forecast' ? 'var(--panel)' : 'transparent', color: 'var(--txt)' }}
          onClick={() => setActiveTab('forecast')}
        >
          Forecast
        </button>
        <button 
          className='tab-btn'
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: activeTab === 'capacity' ? 'var(--panel)' : 'transparent', color: 'var(--txt)' }}
          onClick={() => setActiveTab('capacity')}
        >
          Capacity Planning
        </button>
      </div>
      <div style={{ 
        display: 'flex', 
        gap: 12, 
        flexWrap: 'wrap', 
        alignItems: 'center',
        background: 'var(--panel)',
        border: '1px solid rgba(255,255,255,.06)',
        padding: '15px',
        borderRadius: '12px',
        marginBottom: '20px'
      }}>
        <label>
          <div className='subtle'>Region</div>
          <select value={region} onChange={e => setRegion(e.target.value)}>
            {regions.map(r => (<option key={r} value={r}>{r}</option>))}
          </select>
        </label>
        <label>
          <div className='subtle'>Service</div>
          <select value={service} onChange={e => setService(e.target.value)}>
            {services.map(s => (<option key={s} value={s}>{s}</option>))}
          </select>
        </label>
        <label>
          <div className='subtle'>Horizon</div>
          <select value={horizon} onChange={e => setHorizon(Number(e.target.value))}>
            {horizonOptions.map(h => (<option key={h} value={h}>{h} days</option>))}
          </select>
        </label>
        <label>
          <div className='subtle'>Metric</div>
          <select value={metric} onChange={e => setMetric(e.target.value)}>
            <option value='cloud_market_demand'>cloud_market_demand</option>
            <option value='usage_cpu'>usage_cpu</option>
            <option value='usage_storage'>usage_storage</option>
            <option value='users_active'>users_active</option>
          </select>
        </label>
        <label>
          <div className='subtle'>Model</div>
          <select value={model} onChange={e => setModel(e.target.value)}>
            <option value='xgboost'>XGBoost (fast)</option>
            <option value='arima'>ARIMA (with CI)</option>
          </select>
        </label>
        <label>
          <div className='subtle'>Date Range</div>
          <DatePicker
            selected={startDate}
            onChange={date => setStartDate(date)}
            selectsStart
            startDate={startDate}
            endDate={endDate}
            placeholderText="Start date"
          />
          <DatePicker
            selected={endDate}
            onChange={date => setEndDate(date)}
            selectsEnd
            startDate={startDate}
            endDate={endDate}
            minDate={startDate}
            placeholderText="End date"
          />
        </label>
        <button onClick={fetchForecast} disabled={!region || !service || loading}>
          {loading ? 'Loading…' : 'Get Forecast'}
        </button>
        <button onClick={fetchBothForecasts} disabled={!region || !service || loading}>
          Compare Models
        </button>
        <label>
          <div className='subtle'>Safety factor</div>
          <input type='number' step='0.05' min='1' value={safetyFactor} onChange={e => setSafetyFactor(Number(e.target.value))} />
        </label>
        <button onClick={fetchCapacityRecommendation} disabled={!region || !service || loading}>
          Recommend Capacity
        </button>
        {activeTab === 'capacity' && (
          <>
            <label>
              <div className='subtle'>Available Capacity</div>
              <input type='number' step='1' min='0' value={availableCapacity} onChange={e => setAvailableCapacity(Number(e.target.value))} />
            </label>
            <button onClick={fetchCapacityAssessment} disabled={!region || !service || loading || !availableCapacity}>
              Assess Risk
            </button>
          </>
        )}
      </div>

      {error && (<div style={{ color: 'red', marginTop: 10 }}>{error}</div>)}

      {loading && (
        <div style={{ marginTop: 10 }} className='subtle'>Fetching forecast…</div>
      )}

      {activeTab === 'forecast' && (
        <div style={{ marginTop: 20, background: 'var(--panel)', border: '1px solid rgba(255,255,255,.06)', padding: 20, borderRadius: 12 }}>
          <h3 style={{ marginBottom: 15, color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: 10 }}>
            📈 Historical Data + Forecast
            {loading && <span style={{ fontSize: '0.8em', color: 'var(--muted)' }}>(Loading...)</span>}
          </h3>
          <div style={{ width: '100%', height: 350, opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }}>
            {mergedSeries.length > 0 ? (
              <ResponsiveContainer>
                <LineChart data={mergedSeries} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,.1)' />
                <XAxis 
                  dataKey='date' 
                  tick={{ fontSize: 12, fill: 'var(--muted)' }} 
                  minTickGap={20}
                  axisLine={{ stroke: 'rgba(255,255,255,.1)' }}
                  tickLine={{ stroke: 'rgba(255,255,255,.1)' }}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: 'var(--muted)' }}
                  axisLine={{ stroke: 'rgba(255,255,255,.1)' }}
                  tickLine={{ stroke: 'rgba(255,255,255,.1)' }}
                />
                <Tooltip 
                  content={<CustomTooltip />}
                  wrapperStyle={{ 
                    background: 'var(--panel)', 
                    border: '1px solid rgba(255,255,255,.1)', 
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="line"
                />
                {mergedSeries.some(d => d.lower_95 != null && d.upper_95 != null) && (
                  <Area type='monotone' dataKey='upper_95' stroke='none' fill='rgba(100,149,237,0.15)' activeDot={false} />
                )}
                {mergedSeries.some(d => d.lower_95 != null && d.upper_95 != null) && (
                  <Area type='monotone' dataKey='lower_95' stroke='none' fill='white' activeDot={false} />
                )}
                <Line 
                  type='monotone' 
                  dataKey='actual' 
                  name='Actual' 
                  stroke='#8884d8' 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, stroke: '#8884d8', strokeWidth: 2 }}
                />
                <Line 
                  type='monotone' 
                  dataKey='forecast' 
                  name='Forecast' 
                  stroke='#ff7300' 
                  strokeWidth={2}
                  strokeDasharray='5 5'
                  dot={false}
                  activeDot={{ r: 4, stroke: '#ff7300', strokeWidth: 2 }}
                />
                {capacityPlan.length > 0 && (
                  <Line 
                    type='monotone' 
                    data={capacityPlan}
                    dataKey='recommended_capacity' 
                    name='Recommended Capacity' 
                    stroke='#4caf50' 
                    strokeWidth={2}
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
            ) : (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%', 
                color: 'var(--muted)',
                fontSize: '14px'
              }}>
                No data available. Please select a region and service, then click "Get Forecast".
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'capacity' && (
        <div style={{ marginTop: 20 }}>
          {/* Risk Indicator */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            {assessment ? (
              <div style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'var(--panel)' }}>
                <span className='subtle'>Risk:&nbsp;</span>
                <span style={{
                  color: assessment.risk === 'under_provision' ? '#ff5252' : assessment.risk === 'over_provision' ? '#ffca28' : '#66bb6a',
                  fontWeight: 'bold'
                }}>{assessment.risk}</span>
                <span className='subtle' style={{ marginLeft: 12 }}>Adj:&nbsp;</span>
                <span style={{ fontWeight: 'bold' }}>{assessment.recommended_adjustment}</span>
              </div>
            ) : (
              <div className='subtle'>Enter capacity and click Assess Risk.</div>
            )}
          </div>

          {/* Recommendations Panel */}
          <div style={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,.06)', padding: 16, borderRadius: 12, marginBottom: 16 }}>
            <h3 style={{ margin: 0, marginBottom: 10, color: 'var(--txt)' }}>Recommendations</h3>
            {!assessment ? (
              <div className='subtle'>No recommendation yet.</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li style={{ marginBottom: 6 }}>
                  {assessment.region || region} {assessment.service || service} {assessment.recommended_adjustment}
                  {typeof assessment.recommended_adjustment_percent === 'number' && (
                    <span className='subtle'> ({assessment.recommended_adjustment_percent}% of capacity)</span>
                  )}
                </li>
              </ul>
            )}
          </div>

          {/* Forecast line with CI (if available) */}
          <div style={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,.06)', padding: 20, borderRadius: 12, marginBottom: 16 }}>
            <h3 style={{ marginBottom: 15, color: 'var(--txt)' }}>Forecasted Demand (with CI)</h3>
            <div style={{ width: '100%', height: 300 }}>
              {forecast.length > 0 ? (
                <ResponsiveContainer>
                  <LineChart data={forecast} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,.1)' />
                    <XAxis dataKey='date' tick={{ fontSize: 12, fill: 'var(--muted)' }} minTickGap={20} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                    <Tooltip />
                    <Legend />
                    {forecast.some(d => d.lower_95 != null && d.upper_95 != null) && (
                      <Area type='monotone' dataKey='upper_95' stroke='none' fill='rgba(100,149,237,0.15)' activeDot={false} />
                    )}
                    {forecast.some(d => d.lower_95 != null && d.upper_95 != null) && (
                      <Area type='monotone' dataKey='lower_95' stroke='none' fill='white' activeDot={false} />
                    )}
                    <Line type='monotone' dataKey='forecast' name='Forecast' stroke='#ff7300' strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className='subtle' style={{ paddingTop: 40, textAlign: 'center' }}>Load a forecast first.</div>
              )}
            </div>
          </div>

          {/* Capacity vs Forecast bar comparison */}
          <div style={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,.06)', padding: 20, borderRadius: 12 }}>
            <h3 style={{ marginBottom: 15, color: 'var(--txt)' }}>Capacity vs Forecast Comparison</h3>
            <div style={{ width: '100%', height: 300 }}>
              {forecast.length > 0 ? (
                <ResponsiveContainer>
                  <BarChart data={forecast.map(d => ({ date: d.date, forecast: Number(d.forecast) || 0, capacity: Number(availableCapacity) || 0 }))} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,.1)' />
                    <XAxis dataKey='date' tick={{ fontSize: 12, fill: 'var(--muted)' }} minTickGap={20} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey='capacity' name='Capacity' fill='#66bb6a' />
                    <Bar dataKey='forecast' name='Forecast' fill='#ff7300' />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className='subtle' style={{ paddingTop: 40, textAlign: 'center' }}>Load a forecast and enter capacity.</div>
              )}
            </div>
          </div>

          {/* Downloads */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => downloadReport('logs')} disabled={!region || !service}>Download Forecast Report (CSV)</button>
            <button onClick={() => downloadReport('accuracy')} disabled={!region || !service}>Download Accuracy Report (CSV)</button>
          </div>
        </div>
      )}

      {/* Enhanced Comparison chart: last 30d actual vs next forecast horizon */}
      <div style={{ marginTop: 20, background: 'var(--panel)', border: '1px solid rgba(255,255,255,.06)', padding: 20, borderRadius: 12 }}>
        <h3 style={{ marginBottom: 15, color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: 10 }}>
          🔄 Actual vs Predicted Comparison
        </h3>
        <div style={{ width: '100%', height: 300, opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }}>
          {history.length > 0 || forecast.length > 0 ? (
            <ResponsiveContainer>
              <LineChart 
                data={[...history.slice(Math.max(0, history.length - 30)).map(d => ({ date: d.date, actual: d.value })), ...forecast.map(d => ({ date: d.date, predicted: Number(d.forecast) || 0 }))]} 
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
              <CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,.1)' />
              <XAxis 
                dataKey='date' 
                tick={{ fontSize: 12, fill: 'var(--muted)' }} 
                minTickGap={20}
                axisLine={{ stroke: 'rgba(255,255,255,.1)' }}
                tickLine={{ stroke: 'rgba(255,255,255,.1)' }}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: 'var(--muted)' }}
                axisLine={{ stroke: 'rgba(255,255,255,.1)' }}
                tickLine={{ stroke: 'rgba(255,255,255,.1)' }}
              />
              <Tooltip 
                wrapperStyle={{ 
                  background: 'var(--panel)', 
                  border: '1px solid rgba(255,255,255,.1)', 
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              <Line 
                type='monotone' 
                dataKey='actual' 
                name='Actual (last 30d)' 
                stroke='#82ca9d' 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: '#82ca9d', strokeWidth: 2 }}
              />
              <Line 
                type='monotone' 
                dataKey='predicted' 
                name='Predicted (next horizon)' 
                stroke='#d62728' 
                strokeWidth={2}
                strokeDasharray='5 5'
                dot={false}
                activeDot={{ r: 4, stroke: '#d62728', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
          ) : (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%', 
              color: 'var(--muted)',
              fontSize: '14px'
            }}>
              No data available. Please select a region and service, then click "Get Forecast".
            </div>
          )}
        </div>
        {!loading && forecast.length === 0 && (
          <div className='subtle' style={{ marginTop: 8, textAlign: 'center', color: '#666' }}>
            No forecast yet. Select options and click "Get Forecast".
          </div>
        )}
      </div>

      {/* Model Comparison Visualizations */}
      {modelComparisonData.length > 0 ? (
        <div style={{ marginTop: 30 }}>
          <h3 style={{ marginBottom: 20, color: 'var(--txt)', borderBottom: '2px solid rgba(255,255,255,.1)', paddingBottom: 10 }}>
            Model Performance Comparison
          </h3>
          
          {/* Bar Charts for Model Metrics */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
            gap: 20, 
            marginBottom: 30 
          }}>
            {/* RMSE and MAE Comparison */}
            <div style={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,.06)', padding: 20, borderRadius: 12 }}>
              <h4 style={{ marginBottom: 15, color: 'var(--txt)' }}>Error Metrics Comparison</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={modelPerformanceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.1)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                  <Tooltip 
                    wrapperStyle={{ 
                      background: 'var(--panel)', 
                      border: '1px solid rgba(255,255,255,.1)', 
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="rmse" name="RMSE" fill="#8884d8" />
                  <Bar dataKey="mae" name="MAE" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Training and Inference Time */}
            <div style={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,.06)', padding: 20, borderRadius: 12 }}>
              <h4 style={{ marginBottom: 15, color: 'var(--txt)' }}>Performance Metrics</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={modelPerformanceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.1)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                  <Tooltip 
                    wrapperStyle={{ 
                      background: 'var(--panel)', 
                      border: '1px solid rgba(255,255,255,.1)', 
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="training_time" name="Training Time (s)" fill="#ffc658" />
                  <Bar dataKey="inference_time" name="Inference Time (ms)" fill="#ff7300" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart and Additional Metrics */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
            gap: 20, 
            marginBottom: 30 
          }}>
            {/* Model Distribution Pie Chart */}
            <div style={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,.06)', padding: 20, borderRadius: 12 }}>
              <h4 style={{ marginBottom: 15, color: 'var(--txt)' }}>Model Performance Distribution</h4>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={modelDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {modelDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    wrapperStyle={{ 
                      background: 'var(--panel)', 
                      border: '1px solid rgba(255,255,255,.1)', 
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* MAPE and Bias Comparison */}
            <div style={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,.06)', padding: 20, borderRadius: 12 }}>
              <h4 style={{ marginBottom: 15, color: 'var(--txt)' }}>Accuracy Metrics</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={modelPerformanceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.1)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                  <Tooltip 
                    wrapperStyle={{ 
                      background: 'var(--panel)', 
                      border: '1px solid rgba(255,255,255,.1)', 
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="mape" name="MAPE (%)" fill="#2ca02c" />
                  <Bar dataKey="bias" name="Bias" fill="#d62728" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Best Model Highlight */}
          {bestModel && (
            <div style={{ 
              background: 'linear-gradient(135deg, var(--brand) 0%, #4a90e2 100%)', 
              color: 'white', 
              padding: 20, 
              borderRadius: 12, 
              marginBottom: 20,
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,.1)'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.5em' }}>🏆 Best Performing Model</h3>
              <p style={{ margin: '10px 0 0 0', fontSize: '1.2em', fontWeight: 'bold' }}>
                {bestModel}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 30, textAlign: 'center', padding: '40px', background: 'var(--panel)', border: '1px solid rgba(255,255,255,.06)', borderRadius: '12px' }}>
          <h3 style={{ color: 'var(--txt)', marginBottom: '10px' }}>Model Comparison Data</h3>
          <p style={{ color: 'var(--muted)' }}>Loading model comparison data...</p>
          <p style={{ color: 'var(--muted)', fontSize: '0.9em' }}>
            If this persists, check the browser console for errors.
          </p>
        </div>
      )}

      <button
        style={{ marginLeft: 8 }}
        onClick={() => downloadCSV(forecast)}
        disabled={forecast.length === 0}
      >
        Download Forecast (CSV)
      </button>

      {/* Enhanced Model comparison chart */}
      <div style={{ marginTop: 20, background: 'var(--panel)', border: '1px solid rgba(255,255,255,.06)', padding: 20, borderRadius: 12 }}>
        <h3 style={{ marginBottom: 15, color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: 10 }}>
          🔀 Model Comparison Forecasts
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          {history.length > 0 || xgboostForecast.length > 0 || arimaForecast.length > 0 ? (
            <LineChart 
              data={history.slice(-30).map(d => ({ date: d.date, actual: d.value }))
                .concat(xgboostForecast.map(d => ({ date: d.date, xgboost: Number(d.forecast) || 0 })))
                .concat(arimaForecast.map(d => ({ date: d.date, arima: Number(d.forecast) || 0 })))
              } 
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,.1)' />
              <XAxis 
                dataKey='date' 
                tick={{ fontSize: 12, fill: 'var(--muted)' }} 
                minTickGap={20}
                axisLine={{ stroke: 'rgba(255,255,255,.1)' }}
                tickLine={{ stroke: 'rgba(255,255,255,.1)' }}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: 'var(--muted)' }}
                axisLine={{ stroke: 'rgba(255,255,255,.1)' }}
                tickLine={{ stroke: 'rgba(255,255,255,.1)' }}
              />
              <Tooltip 
                content={<CustomTooltip />}
                wrapperStyle={{ 
                  background: 'var(--panel)', 
                  border: '1px solid rgba(255,255,255,.1)', 
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}
              />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            <Line 
              type='monotone' 
              dataKey='actual' 
              name='Actual' 
              stroke='#8884d8' 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: '#8884d8', strokeWidth: 2 }}
            />
            <Line 
              type='monotone' 
              dataKey='xgboost' 
              name='XGBoost Forecast' 
              stroke='#ff7300' 
              strokeWidth={2}
              strokeDasharray='5 5'
              dot={false}
              activeDot={{ r: 4, stroke: '#ff7300', strokeWidth: 2 }}
            />
            <Line 
              type='monotone' 
              dataKey='arima' 
              name='ARIMA Forecast' 
              stroke='#2ca02c' 
              strokeWidth={2}
              strokeDasharray='3 3'
              dot={false}
              activeDot={{ r: 4, stroke: '#2ca02c', strokeWidth: 2 }}
            />
          </LineChart>
          ) : (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%', 
              color: 'var(--muted)',
              fontSize: '14px'
            }}>
              No data available. Please click "Compare Models" to load forecast data.
            </div>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
