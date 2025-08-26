import React from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Header from './components/Header'
import Overview from './pages/Overview'
import EDA from './pages/EDA'
import Merge from './pages/Merge'
import Forecasts from './pages/Forecasts'

export default function App(){
  return (
    <BrowserRouter>
      <div className="layout">
        <aside className="sidebar">
          <h2>Azure Frontend</h2>
          <nav className="nav">
            <NavLink to="/" end>Overview</NavLink>
            <NavLink to="/eda">EDA</NavLink>
            <NavLink to="/merge">Merge</NavLink>
            <NavLink to="/forecasts">Forecasts</NavLink>
          </nav>
          <div className="small">Data: <span className="mono">public/mock/*.csv</span></div>
        </aside>
        <main>
          <Header />
          <div className="content">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/eda" element={<EDA />} />
              <Route path="/merge" element={<Merge />} />
              <Route path="/forecasts" element={<Forecasts />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  )
}