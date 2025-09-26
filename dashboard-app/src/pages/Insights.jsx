import React, { useEffect, useState, useRef } from 'react';
import Chart from 'chart.js/auto';
import Papa from 'papaparse';

const KpiCard = ({ title, value }) => (
  <div className="kpi-card">
    <span className="kpi-title">{title}</span>
    <span className="kpi-value">{value}</span>
  </div>
);

const InsightsPage = () => {
  // State for the full and filtered datasets
  const [allData, setAllData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  
  // State for the date range filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateRange, setDateRange] = useState({ min: '', max: '' });

  // State for KPIs
  const [kpiData, setKpiData] = useState({
    busiestDay: 'N/A',
    highestRegion: 'N/A',
    peakMonth: 'N/A',
  });

  // Refs for all our charts
  const dailyUsageChartRef = useRef(null);
  const regionalUsageChartRef = useRef(null);
  const monthlyUsageChartRef = useRef(null);
  const comparisonChartRef = useRef(null);

  // Effect 1: Load the data once on component mount
  useEffect(() => {
    Papa.parse('/featured_dataset.csv', {
      download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: (results) => {
        const data = results.data;
        if (data.length > 0) {
          const firstDate = data[0].date;
          const lastDate = data[data.length - 1].date;
          setAllData(data);
          setFilteredData(data); // Initially, show all data
          setStartDate(firstDate);
          setEndDate(lastDate);
          setDateRange({ min: firstDate, max: lastDate });
        }
      },
    });
  }, []);

  // Effect 2: Re-filter data when the date range changes
  useEffect(() => {
    if (startDate && endDate) {
      const filtered = allData.filter(row => {
        const rowDate = new Date(row.date);
        return rowDate >= new Date(startDate) && rowDate <= new Date(endDate);
      });
      setFilteredData(filtered);
    }
  }, [startDate, endDate, allData]);

  // Effect 3: Re-calculate KPIs and re-draw charts when filteredData changes
  useEffect(() => {
    if (filteredData.length === 0) return;

    // --- KPI Calculations ---
    const dailyUsage = filteredData.reduce((acc, row) => { acc[row.day_of_week] = (acc[row.day_of_week] || 0) + row.usage_cpu; return acc; }, {});
    const busiestDayIndex = Object.keys(dailyUsage).length ? Object.keys(dailyUsage).reduce((a, b) => dailyUsage[a] > dailyUsage[b] ? a : b) : -1;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const busiestDay = busiestDayIndex !== -1 ? days[busiestDayIndex] : 'N/A';

    const regionalUsage = filteredData.reduce((acc, row) => { if (!acc[row.region]) acc[row.region] = { total: 0, count: 0 }; acc[row.region].total += row.usage_cpu; acc[row.region].count++; return acc; }, {});
    let highestRegion = 'N/A'; let maxAvg = 0;
    for (const region in regionalUsage) { const avg = regionalUsage[region].total / regionalUsage[region].count; if (avg > maxAvg) { maxAvg = avg; highestRegion = region; } }
    
    const monthlyUsage = filteredData.reduce((acc, row) => { acc[row.month] = (acc[row.month] || 0) + row.usage_cpu; return acc; }, {});
    const peakMonthIndex = Object.keys(monthlyUsage).length ? Object.keys(monthlyUsage).reduce((a, b) => monthlyUsage[a] > monthlyUsage[b] ? a : b) : -1;
    const months = ['Jan', 'Feb', 'Mar'];
    const peakMonth = peakMonthIndex !== -1 ? months[peakMonthIndex - 1] : 'N/A';
    setKpiData({ busiestDay, highestRegion, peakMonth });

    // --- Chart Creation ---
    const chartTextColor = '#c9d1d9';
    const chartGridColor = '#30363d';
    
    if (dailyUsageChartRef.current) dailyUsageChartRef.current.destroy();
    const dailyCtx = document.getElementById('dailyUsageChart').getContext('2d');
    dailyUsageChartRef.current = new Chart(dailyCtx, {
        type: 'bar',
        data: { labels: days, datasets: [{ label: 'Total CPU Usage', data: days.map((d, i) => dailyUsage[i] || 0), backgroundColor: '#238636' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: false }, legend: { display: false } }, scales: { x: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } }, y: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } } } }
    });

    if (regionalUsageChartRef.current) regionalUsageChartRef.current.destroy();
    const regionalCtx = document.getElementById('regionalUsageChart').getContext('2d');
    regionalUsageChartRef.current = new Chart(regionalCtx, {
        type: 'bar',
        data: { labels: Object.keys(regionalUsage), datasets: [{ label: 'Total CPU Usage', data: Object.values(regionalUsage).map(r => r.total), backgroundColor: ['#1f6feb', '#8957e5', '#db61a2', '#e6c14f'] }] },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { title: { display: false }, legend: { display: false } }, scales: { x: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } }, y: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } } } }
    });
    
    if (monthlyUsageChartRef.current) monthlyUsageChartRef.current.destroy();
    const monthlyCtx = document.getElementById('monthlyUsageChart').getContext('2d');
    monthlyUsageChartRef.current = new Chart(monthlyCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(monthlyUsage).map(m => months[m-1]),
            datasets: [{ label: 'Total CPU Usage by Month', data: Object.values(monthlyUsage), backgroundColor: '#8957e5' }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: false }, legend: { display: false } }, scales: { x: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } }, y: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } } } }
    });

    if (comparisonChartRef.current) comparisonChartRef.current.destroy();
    const comparisonCtx = document.getElementById('comparisonChart').getContext('2d');
    const eastUSData = filteredData.filter(d => d.region === 'East US');
    comparisonChartRef.current = new Chart(comparisonCtx, {
        type: 'line',
        data: {
            labels: eastUSData.map(d => d.date),
            datasets: [
                { label: 'Original CPU Usage', data: eastUSData.map(d => d.usage_cpu), borderColor: '#db61a2', tension: 0.1 },
                { label: '7-Day Rolling Average', data: eastUSData.map(d => d.cpu_rolling_mean_7), borderColor: '#1f6feb', borderDash: [5, 5], tension: 0.1 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: false }, legend: { position: 'top', labels: { color: chartTextColor } } }, scales: { x: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } }, y: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } } } }
    });

  }, [filteredData]);

  return (
    <>
      {/* NEW: Filter Bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <label htmlFor="start-date">Start Date</label>
          <input 
            type="date" 
            id="start-date" 
            value={startDate} 
            min={dateRange.min}
            max={dateRange.max}
            onChange={(e) => setStartDate(e.target.value)} 
          />
        </div>
        <div className="filter-group">
          <label htmlFor="end-date">End Date</label>
          <input 
            type="date" 
            id="end-date" 
            value={endDate}
            min={dateRange.min}
            max={dateRange.max}
            onChange={(e) => setEndDate(e.target.value)} 
          />
        </div>
      </div>

      <div className="page-grid">
        <div className="kpi-grid">
          <KpiCard title="Busiest Day" value={kpiData.busiestDay} />
          <KpiCard title="Highest Region" value={kpiData.highestRegion} />
          <KpiCard title="Peak Month" value={kpiData.peakMonth} />
        </div>
        <div className="chart-box">
          <h4>Usage by Day of Week</h4>
          <canvas id="dailyUsageChart"></canvas>
        </div>
        <div className="chart-box">
          <h4>Usage by Region</h4>
          <canvas id="regionalUsageChart"></canvas>
        </div>
        <div className="chart-box">
          <h4>Monthly Usage Pattern</h4>
          <canvas id="monthlyUsageChart"></canvas>
        </div>
        <div className="chart-box full-width">
          <h4>Before vs. After Feature Engineering (East US)</h4>
          <canvas id="comparisonChart"></canvas>
        </div>
      </div>
    </>
  );
};

export default InsightsPage;