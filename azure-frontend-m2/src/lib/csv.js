import Papa from 'papaparse'

export async function loadCsv(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: res => resolve(res.data),
      error: reject
    })
  })
}

export async function parseFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: res => resolve(res.data),
      error: reject
    })
  })
}

export function toCsv(rows) {
  if (!rows?.length) return ''
  const cols = Object.keys(rows[0])
  const header = cols.join(',')
  const body = rows.map(r => 
    cols.map(c => 
      JSON.stringify(r[c] ?? '').replace(/^\"|\"$/g, '')
    ).join(',')
  ).join('\n')
  return header + '\n' + body
}
