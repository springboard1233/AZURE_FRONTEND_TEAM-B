import React from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Header from './components/Header'
import Overview from './pages/Overview'
import EDA from './pages/EDA'
import Merge from './pages/Merge'
import Insights from './pages/Insights'

export default function App() {
  return (
    <BrowserRouter>
      <div className='layout'>
        <aside className='sidebar'>
          <h2 style={{ color: '#6aa3ff' }}>Azure DF – M2</h2>
          <nav style={{ marginTop: 12 }}>
            <NavLink to='/' end style={{ display: 'block', padding: '8px 10px' }}>
              Overview
            </NavLink>
            <NavLink to='/eda' style={{ display: 'block', padding: '8px 10px' }}>
              EDA
            </NavLink>
            <NavLink to='/merge' style={{ display: 'block', padding: '8px 10px' }}>
              Merge
            </NavLink>
            <NavLink to='/insights' style={{ display: 'block', padding: '8px 10px' }}>
              Insights
            </NavLink>
          </nav>
          <div style={{ marginTop: 16 }} className='subtle'>
            Data: <code>/public/mock</code>
          </div>
        </aside>
        <main>
          <Header />
          <div className='content'>
            <Routes>
              <Route path='/' element={<Overview />} />
              <Route path='/eda' element={<EDA />} />
              <Route path='/merge' element={<Merge />} />
              <Route path='/insights' element={<Insights />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  )
}
