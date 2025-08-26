import React from 'react'

export default function FileUpload({ onFile }){
  const handle = (e)=>{
    const file = e.target.files?.[0]
    if(file) onFile(file)
  }
  return (
    <label className="btn">
      Upload CSV
      <input type="file" accept=".csv" onChange={handle} style={{ display: 'none' }} />
    </label>
  )
}