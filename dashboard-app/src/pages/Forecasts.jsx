import React, { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import Papa from 'papaparse';

const ForecastsPage = () => {
  const forecastChartRef = useRef(null);
  const recentTrendChartRef = useRef(null);
  const [lastCpuValue, setLastCpuValue] = useState(0);

  // Load real data for both the KPI and the recent trend chart
  useEffect(() => {
    Papa.parse('/azure_usage.csv', {
      download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: (results) => {
        const usageData = results.data;
        if (usageData.length > 0) {
          // KPI Card: Get the last record's CPU usage
          setLastCpuValue(usageData[usageData.length - 1].usage_cpu);

          // Recent Trend Chart: Get the last 30 days of data
          const last30Days = usageData.slice(-30);
          const labels = last30Days.map(d => d.date);
          const cpuData = last30Days.map(d => d.usage_cpu);

          if (recentTrendChartRef.current) recentTrendChartRef.current.destroy();
          const trendCtx = document.getElementById('recentTrendChart').getContext('2d');
          recentTrendChartRef.current = new Chart(trendCtx, {
            type: 'line',
            data: {
              labels,
              datasets: [{
                label: 'Recent CPU Usage',
                data: cpuData,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                fill: true,
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                title: { display: true, text: 'Last 30 Days CPU Usage Trend', color: 'white' },
                legend: { labels: { color: '#d1d5db' } }
              },
              scales: {
                x: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } },
                y: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } }
              }
            }
          });
        }
      }
    });

    // Dummy data for the forecast chart remains the same
    const forecastData = {
      labels: ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'],
      datasets: [{
        label: 'Forecasted CPU Demand',
        data: [150, 165, 160, 180],
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        fill: true,
        tension: 0.4
      }]
    };
    if (forecastChartRef.current) forecastChartRef.current.destroy();
    const forecastCtx = document.getElementById('forecastChart').getContext('2d');
    forecastChartRef.current = new Chart(forecastCtx, {
      type: 'line',
      data: forecastData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'CPU Demand Forecast for 2024', color: 'white' },
          legend: { labels: { color: '#d1d5db' } }
        },
        scales: {
          x: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } },
          y: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } }
        }
      }
    });

  }, []); // Run once on component mount

  return (
    <div className="page active">
       <div className="kpi-card">
        <span className="kpi-title">Last Recorded CPU Usage</span>
        <span className="kpi-value">{lastCpuValue}</span>
        <span className="kpi-description">This is the final historical data point.</span>
      </div>
      <div className="chart-box">
        <canvas id="recentTrendChart"></canvas>
      </div>
      <div className="chart-box">
        <canvas id="forecastChart"></canvas>
      </div>
      <div className="chart-box" style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
         <h3>Forecasting Models</h3>
        <p>This section will contain the results from our machine learning models, predicting future Azure demand based on historical data and external factors.</p>
        <p><em>(Forecasting models are under development for Milestone 2)</em></p>
      </div>
    </div>
  );
};

export default ForecastsPage;
