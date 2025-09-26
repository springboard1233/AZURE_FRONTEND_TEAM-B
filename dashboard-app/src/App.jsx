import React, { useState } from 'react';
import './styles.css';

// Import all the page components
import OverviewPage from './pages/Overview';
import EdaPage from './pages/EDA';
import MergePage from './pages/Merge';
import ForecastsPage from './pages/Forecasts';
import InsightsPage from './pages/Insights';

const App = () => {
  const [activePage, setActivePage] = useState('Overview');

  const renderPage = () => {
    // This function will render the correct page component based on the activePage state
    // We also pass the 'active' class to ensure it's visible
    return (
      <>
        <div className={`page ${activePage === 'Overview' ? 'active' : ''}`}><OverviewPage /></div>
        <div className={`page ${activePage === 'EDA' ? 'active' : ''}`}><EdaPage /></div>
        <div className={`page ${activePage === 'Insights' ? 'active' : ''}`}><InsightsPage /></div>
        <div className={`page ${activePage === 'Merge' ? 'active' : ''}`}><MergePage /></div>
        <div className={`page ${activePage === 'Forecasts' ? 'active' : ''}`}><ForecastsPage /></div>
      </>
    );
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <h3 className="sidebar-header">Azure Frontend</h3>
        <nav className="sidebar-nav">
          <button className={activePage === 'Overview' ? 'active' : ''} onClick={() => setActivePage('Overview')}>Overview</button>
          <button className={activePage === 'EDA' ? 'active' : ''} onClick={() => setActivePage('EDA')}>EDA</button>
          <button className={activePage === 'Insights' ? 'active' : ''} onClick={() => setActivePage('Insights')}>Insights</button>
          <button className={activePage === 'Merge' ? 'active' : ''} onClick={() => setActivePage('Merge')}>Merge</button>
          <button className={activePage === 'Forecasts' ? 'active' : ''} onClick={() => setActivePage('Forecasts')}>Forecasts</button>
        </nav>
      </div>
      <div className="content-area">
        <div className="topbar">
          <span>Azure Demand Forecasting</span>
        </div>
        <div className="main-content">
          {renderPage()}
        </div>
      </div>
    </div>
  );
};

export default App;

