export function basicStats(rows, col){
  const vals = rows.map(r => +r[col]).filter(v => Number.isFinite(v))
  const n = vals.length
  if(n === 0) return { n: 0, mean: null, min: null, max: null }
  const sum = vals.reduce((a,b)=>a+b,0)
  const mean = sum / n
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  return { n, mean, min, max }
}

export function uniqueValues(rows, col){
  return Array.from(new Set(rows.map(r => r[col]).filter(v => v !== undefined && v !== null)))
}

// Forward fill a column, optionally grouping by a key (e.g., region)
export function forwardFill(rows, col, groupBy){
  let last = new Map()
  return rows.map(r => {
    const key = groupBy ? r[groupBy] : '__all__'
    let val = r[col]
    if(val === null || val === undefined || val === ''){
      if(last.has(key)) r[col] = last.get(key)
    } else {
      last.set(key, val)
    }
    return r
  })
}

// Simple inner join on 'date' (ISO string like 2025-01-01)
export function joinOnDate(leftRows, rightRows){
  const map = new Map()
  rightRows.forEach(r => {
    if(r.date) map.set(String(r.date), r)
  })
  const merged = []
  leftRows.forEach(l => {
    const d = String(l.date)
    if(map.has(d)){
      merged.push({ ...l, ...map.get(d) })
    }
  })
  return merged
}