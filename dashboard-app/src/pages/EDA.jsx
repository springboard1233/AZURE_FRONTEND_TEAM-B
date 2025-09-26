import React, { useEffect, useState, useRef } from 'react';
import Chart from 'chart.js/auto';
import Papa from 'papaparse';

const KpiCard = ({ title, value, description }) => (
    <div className="kpi-card">
        <span className="kpi-title">{title}</span>
        <span className="kpi-value">{value}</span>
        <p style={{color: '#8b949e', fontSize: '12px', margin: '8px 0 0 0'}}>{description}</p>
    </div>
);

const EdaPage = () => {
    // State for all data
    const [allData, setAllData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    
    // State for filters
    const [regionFilter, setRegionFilter] = useState('All');
    const [resourceFilter, setResourceFilter] = useState('All');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // State for calculated KPIs
    const [kpiData, setKpiData] = useState({});

    // Refs for charts
    const usageChartRef = useRef(null);
    const storageChartRef = useRef(null);
    const regionPieChartRef = useRef(null);
    
    useEffect(() => {
        Papa.parse('/azure_usage.csv', {
            download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
            complete: (results) => {
                const data = results.data;
                if (data.length > 0) {
                    setAllData(data);
                    const dates = data.map(row => new Date(row.date)).filter(d => !isNaN(d));
                    setStartDate(new Date(Math.min.apply(null, dates)).toISOString().split('T')[0]);
                    setEndDate(new Date(Math.max.apply(null, dates)).toISOString().split('T')[0]);
                }
            },
        });
    }, []);

    useEffect(() => {
        let data = allData;
        if (regionFilter !== 'All') data = data.filter(d => d.region === regionFilter);
        if (resourceFilter !== 'All') data = data.filter(d => d.resource_type === resourceFilter);
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            data = data.filter(d => {
                const rowDate = new Date(d.date);
                return rowDate >= start && rowDate <= end;
            });
        }
        setFilteredData(data);
    }, [regionFilter, resourceFilter, startDate, endDate, allData]);

    useEffect(() => {
        if (filteredData.length > 0) {
            const totalCpu = filteredData.reduce((sum, d) => sum + d.usage_cpu, 0);
            const totalStorage = filteredData.reduce((sum, d) => sum + d.usage_storage, 0);
            setKpiData({
                records: filteredData.length,
                regions: [...new Set(filteredData.map(item => item.region))].length,
                avgCpu: (totalCpu / filteredData.length).toFixed(1),
                avgStorage: (totalStorage / filteredData.length).toFixed(1),
            });

            // --- Chart Logic ---
            const chartTextColor = '#c9d1d9';
            const chartGridColor = '#30363d';
            
            if (usageChartRef.current) usageChartRef.current.destroy();
            const usageCtx = document.getElementById('usageChart').getContext('2d');
            usageChartRef.current = new Chart(usageCtx, {
                type: 'line', data: { labels: filteredData.map(d => d.date), datasets: [{ label: 'CPU Usage', data: filteredData.map(d => d.usage_cpu), borderColor: '#1f6feb', fill: true, backgroundColor: 'rgba(31, 111, 235, 0.2)' }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } }, y: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } } } }
            });

            if (storageChartRef.current) storageChartRef.current.destroy();
            const storageCtx = document.getElementById('storageChart').getContext('2d');
            storageChartRef.current = new Chart(storageCtx, {
                type: 'bar', data: { labels: filteredData.map(d => d.date), datasets: [{ label: 'Storage (Units)', data: filteredData.map(d => d.usage_storage), backgroundColor: '#238636' }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } }, y: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } } } }
            });

            const regionData = filteredData.reduce((acc, d) => { acc[d.region] = (acc[d.region] || 0) + d.usage_cpu; return acc; }, {});
            if (regionPieChartRef.current) regionPieChartRef.current.destroy();
            const regionCtx = document.getElementById('regionPieChart').getContext('2d');
            regionPieChartRef.current = new Chart(regionCtx, {
                type: 'pie', data: { labels: Object.keys(regionData), datasets: [{ data: Object.values(regionData), backgroundColor: ['#1f6feb', '#8957e5', '#db61a2', '#e6c14f'] }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: chartTextColor } } } }
            });
        }
    }, [filteredData]);

    return (
        // UPDATED: This now uses a React Fragment <> instead of a div
        <>
            <div className="filter-bar">
                <div> <label>Region</label> <select onChange={(e) => setRegionFilter(e.target.value)} value={regionFilter}> <option>All</option> {[...new Set(allData.map(item => item.region))].map(r => <option key={r}>{r}</option>)} </select> </div>
                <div> <label>Resource Type</label> <select onChange={(e) => setResourceFilter(e.target.value)} value={resourceFilter}> <option>All</option> {[...new Set(allData.map(item => item.resource_type))].map(r => <option key={r}>{r}</option>)} </select> </div>
                <div> <label>Start Date</label> <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /> </div>
                <div> <label>End Date</label> <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /> </div>
            </div>

            <div className="kpi-grid">
                <KpiCard title="Filtered Records" value={kpiData.records?.toLocaleString()} description="Total rows in current selection" />
                <KpiCard title="Regions in View" value={kpiData.regions} description="Unique regions in selection" />
                <KpiCard title="Avg CPU / Storage" value={`${kpiData.avgCpu || '0'} / ${kpiData.avgStorage || '0'}`} description="Mean usage in selection" />
            </div>

            <div className="chart-box"> <h4>Total CPU Usage Over Time</h4> <canvas id="usageChart"></canvas> </div>
            <div className="chart-box"> <h4>Total Storage Over Time</h4> <canvas id="storageChart"></canvas> </div>
            <div className="chart-box full-width"> <h4>Usage by Region (CPU)</h4> <canvas id="regionPieChart"></canvas> </div>
        </>
    );
};

export default EdaPage;
