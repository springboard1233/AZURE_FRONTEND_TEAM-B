import React, { useEffect, useState } from 'react'

export default function ModelComparison() {
  const [rows, setRows] = useState([])
  const [recommended, setRecommended] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/model-comparison')
        if (!res.ok) throw new Error('Failed to load model comparison')
        const data = await res.json()
        // Backend returns { models: [{name, rmse, mae, ...}], best_model: 'XGBoost' }
        const rows = Array.isArray(data?.models) ? data.models.map(m => ({
          model: m.name,
          mae: m.mae,
          rmse: m.rmse,
          mape: m.mape,
          bias: m.bias,
          training_time_s: m.training_time_s,
          inference_ms_per_sample: m.inference_ms_per_sample
        })) : []
        setRows(rows)
        setRecommended(data?.best_model ? { model: data.best_model } : null)
      } catch (e) {
        setError(String(e?.message || e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function fmt(v) {
    if (v == null || Number.isNaN(Number(v))) return '—'
    return Number(v).toFixed(3)
  }

  const bestModelName = recommended?.model || (rows.slice().sort((a,b) => (a.rmse ?? Infinity) - (b.rmse ?? Infinity))[0]?.model)

  return (
    <div>
      <h2>Model Comparison</h2>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      {loading ? (
        <div>Loading…</div>
      ) : rows.length === 0 ? (
        <div className='subtle'>No metrics available. Run model training and selection first.</div>
      ) : (
        <table className='table'>
          <thead>
            <tr>
              <th>Model</th>
              <th>MAE</th>
              <th>RMSE</th>
              <th>MAPE</th>
              <th>Bias</th>
              <th>Train Time (s)</th>
              <th>Inference (ms/sample)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} style={{ background: r.model === bestModelName ? 'rgba(46, 204, 113, 0.15)' : undefined }}>
                <td style={{ fontWeight: r.model === bestModelName ? 700 : 400 }}>{r.model}</td>
                <td>{fmt(r.mae)}</td>
                <td>{fmt(r.rmse)}</td>
                <td>{fmt(r.mape)}</td>
                <td>{fmt(r.bias)}</td>
                <td>{fmt(r.training_time_s)}</td>
                <td>{fmt(r.inference_ms_per_sample)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
