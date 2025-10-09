// Existing mock-backed helpers (kept for Insights page compatibility)
export async function getFeatures() {
  try {
    // Prefer backend regional trends which include region + date
    const res = await fetch('/api/trends/regional')
    if (!res.ok) throw new Error('fallback')
    return await res.json()
  } catch (e) {
    console.warn('using mock features', e)
    const r = await fetch('/mock/features.json')
    return await r.json()
  }
}

export async function getInsights() {
  try {
    // Build insights object from available backend endpoints
    const [kpisRes, regionalRes, tsRes] = await Promise.all([
      fetch('/api/kpis'),
      fetch('/api/trends/regional'),
      fetch('/api/time-series')
    ])

    if (!kpisRes.ok || !regionalRes.ok || !tsRes.ok) throw new Error('backend-insights-failed')

    const [kpis, regionalTrends, timeSeries] = await Promise.all([
      kpisRes.json(),
      regionalRes.json(),
      tsRes.json()
    ])

    // Peak Demand: show date and region of peak CPU
    const peakDetails = kpis?.peak_cpu_details || {}
    const peakDate = peakDetails.date ? String(peakDetails.date).slice(0, 10) : 'N/A'
    const peakRegion = peakDetails.region || 'All Regions'
    const peakTime = `${peakDate} • ${peakRegion}`

    // Top Regions by Growth: compute growth on usage_cpu per region over time
    const regionToSeries = new Map()
    for (const row of regionalTrends) {
      const reg = row.region
      if (!reg) continue
      if (!regionToSeries.has(reg)) regionToSeries.set(reg, [])
      regionToSeries.get(reg).push({ date: row.date, usage_cpu: Number(row.usage_cpu) || 0 })
    }
    const topRegions = Array.from(regionToSeries.entries()).map(([reg, series]) => {
      const sorted = series.sort((a, b) => a.date.localeCompare(b.date))
      const first = sorted[0]?.usage_cpu ?? 0
      const last = sorted[sorted.length - 1]?.usage_cpu ?? 0
      const growthRate = first > 0 ? ((last - first) / first) * 100 : (last > 0 ? 100 : 0)
      return { region: reg, growthRate: Number(growthRate.toFixed(2)) }
    }).sort((a, b) => b.growthRate - a.growthRate).slice(0, 5)

    // External Factor Impact: align economic_index and usage_cpu over time
    const externalImpact = (Array.isArray(timeSeries) ? timeSeries : []).map(d => ({
      date: d.date,
      economic_index: Number(d.economic_index) || 0,
      usage_cpu: Number(d.usage_cpu) || 0
    }))

    return { peakTime, topRegions, externalImpact }
  } catch (e) {
    console.warn('using mock insights', e)
    const r = await fetch('/mock/insights.json')
    return await r.json()
  }
}

// New backend helpers
export async function getKpis() {
  const res = await fetch('/api/kpis')
  if (!res.ok) throw new Error('Failed to load KPIs')
  return res.json()
}

export async function getFilters() {
  const res = await fetch('/api/filters/options')
  if (!res.ok) throw new Error('Failed to load filter options')
  return res.json()
}

export async function getRegionalTrends() {
  const res = await fetch('/api/trends/regional')
  if (!res.ok) throw new Error('Failed to load regional trends')
  return res.json()
}

export async function getTimeSeries(params = {}) {
  const qs = new URLSearchParams(params)
  const res = await fetch(`/api/time-series?${qs.toString()}`)
  if (!res.ok) throw new Error('Failed to load time series')
  return res.json()
}

export async function postForecast({ region, resource_type, service, horizon = 30, metric = 'usage_cpu' }) {
  const payload = { region, resource_type: resource_type || undefined, service: service || undefined, horizon, metric }
  const res = await fetch('/api/forecast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error('Failed to fetch model forecast')
  return res.json()
}

export async function getCapacityAssessment({ region, resource_type, service, metric = 'usage_cpu', horizon = 30, available_capacity, safety_factor = 1.0 }) {
  const qs = new URLSearchParams({
    region,
    resource_type: resource_type || service,
    metric,
    horizon: String(horizon),
    available_capacity: String(available_capacity),
    safety_factor: String(safety_factor)
  })
  const res = await fetch(`/api/capacity/assessment?${qs.toString()}`)
  if (!res.ok) throw new Error('Failed to assess capacity')
  return res.json()
}

export async function getMonitoring({ region, resource_type, service, metric = 'usage_cpu', window_days = 30 }) {
  const qs = new URLSearchParams({ region, resource_type: resource_type || service, metric, window_days: String(window_days) })
  const res = await fetch(`/api/monitoring?${qs.toString()}`)
  if (!res.ok) throw new Error('Failed to load monitoring')
  return res.json()
}

export function downloadReport({ type = 'logs', region, resource_type, service, metric = 'usage_cpu', window_days = 30 }) {
  const qs = new URLSearchParams({ type, region, resource_type: resource_type || service, metric, window_days: String(window_days) })
  const url = `/api/report/export?${qs.toString()}`
  window.open(url, '_blank')
}

// Data endpoints (original instead of mock)
export async function getCleanedRows(params = {}) {
  const query = new URLSearchParams({ page: '1', page_size: String(params.page_size || 50000) })
  for (const [k, v] of Object.entries(params)) {
    if (v == null || k === 'page_size') continue
    query.set(k, String(v))
  }
  const res = await fetch(`/api/data/rows?${query.toString()}`)
  if (!res.ok) throw new Error('Failed to load cleaned rows')
  const payload = await res.json()
  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.rows)) return payload.rows
  return []
}

export async function getRawUsage() {
  const res = await fetch('/api/data/raw/usage')
  if (!res.ok) throw new Error('Failed to load raw usage')
  return res.json()
}

export async function getRawExternal() {
  const res = await fetch('/api/data/raw/external')
  if (!res.ok) throw new Error('Failed to load raw external')
  return res.json()
}

export function downloadCleanedCsv() {
  window.location.href = '/api/data/download'
}
