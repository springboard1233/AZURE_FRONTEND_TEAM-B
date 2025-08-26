import React from 'react'

export default function DataTable({ rows, max=10 }){
  if(!rows?.length) return <div className="subtle">No rows</div>
  const cols = Object.keys(rows[0])
  const subset = rows.slice(0, max)
  return (
    <div className="card">
      <div className="subtle">Previewing {subset.length} of {rows.length} rows</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {subset.map((r,i)=>(
              <tr key={i}>
                {cols.map(c=> <td key={c+'-'+i}>{String(r[c] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}