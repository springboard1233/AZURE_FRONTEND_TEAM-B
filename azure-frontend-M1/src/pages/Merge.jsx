import React, { useEffect, useState } from 'react'
import { loadCsv, toCsv } from '../lib/csv'
import { forwardFill, joinOnDate } from '../lib/stats'
import { saveAs } from 'file-saver'
import DataTable from '../components/DataTable'

export default function Merge(){
  const [usage, setUsage] = useState([])
  const [ext, setExt] = useState([])
  const [merged, setMerged] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    async function run(){
      const u = await loadCsv('/mock/azure_usage.csv')
      const e = await loadCsv('/mock/external_factors.csv')
      // normalize dates
      u.forEach(r => { if(r.date) r.date = String(r.date).slice(0,10) })
      e.forEach(r => { if(r.date) r.date = String(r.date).slice(0,10) })
      // forward fill storage per region as in milestone brief
      const ff = forwardFill(u, 'usage_storage', 'region')
      const j = joinOnDate(ff, e)
      setUsage(ff)
      setExt(e)
      setMerged(j)
      setLoading(false)
    }
    run()
  }, [])

  function download(){
    const csv = toCsv(merged)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, 'cleaned_merged.csv')
  }

  if(loading) return <div className="subtle">Loading & merging…</div>

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="card">
        <div className="subtle">Status</div>
        <div className="kpi">Merged: {merged.length.toLocaleString()} rows</div>
        <div className="small">Join key: <span className="mono">date</span> • Transform: forward-fill <span className="mono">usage_storage</span> by <span className="mono">region</span></div>
        <hr className="sep" />
        <button className="btn" onClick={download}>Download cleaned_merged.csv</button>
      </div>

      <DataTable rows={merged} max={15} />
    </div>
  )
}