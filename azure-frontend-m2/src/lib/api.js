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
    // No direct equivalent; keep mock for now
    throw new Error('use-mock')
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
