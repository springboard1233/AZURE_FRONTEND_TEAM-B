import React, { useEffect, useState, useRef } from 'react';
import Papa from 'papaparse';
import Chart from 'chart.js/auto';

// A reusable component for our KPI cards
const KpiCard = ({ title, value, description }) => (
  <div className="kpi-card">
    <span className="kpi-title">{title}</span>
    <span className="kpi-value">{value}</span>
    <span className="kpi-description">{description}</span>
  </div>
);

const OverviewPage = () => {
  const [kpiData, setKpiData] = useState(null);
  const resourceChartRef = useRef(null);

  useEffect(() => {
    const usageFilePath = '/azure_usage.csv';

    Papa.parse(usageFilePath, {
      download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: (results) => {
        const usageData = results.data;

        // --- Calculate KPIs from the data ---
        const totalRecords = usageData.length;
        const regions = new Set(usageData.map(row => row.region));
        const totalRegions = regions.size;
        
        const totalCpu = usageData.reduce((sum, row) => sum + (row.usage_cpu || 0), 0);
        const avgCpu = (totalCpu / totalRecords).toFixed(1);

        const dateRangeStart = usageData[0]?.date.split(' ')[0];
        const dateRangeEnd = usageData[totalRecords - 1]?.date.split(' ')[0];

        // --- Process data for the new resource type chart ---
        const resourceUsage = {};
        usageData.forEach(row => {
          const type = row.resource_type;
          resourceUsage[type] = (resourceUsage[type] || 0) + row.usage_cpu;
        });
        
        setKpiData({
          totalRecords: totalRecords.toLocaleString(),
          totalRegions,
          avgCpu,
          dateRange: `${dateRangeStart} to ${dateRangeEnd}`,
          resourceTypes: {
            labels: Object.keys(resourceUsage),
            data: Object.values(resourceUsage)
          }
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!kpiData) return;

    if (resourceChartRef.current) {
      resourceChartRef.current.destroy();
    }

    // --- Create the new Horizontal Bar Chart ---
    const resourceCtx = document.getElementById('resourceChart').getContext('2d');
    resourceChartRef.current = new Chart(resourceCtx, {
      type: 'bar', // Changed from 'doughnut' to 'bar'
      data: {
        labels: kpiData.resourceTypes.labels,
        datasets: [{
          label: 'Total CPU Usage',
          data: kpiData.resourceTypes.data,
          backgroundColor: ['#3b82f6', '#10b981', '#f97316', '#8b5cf6'],
          borderColor: '#1f2937',
          borderWidth: 2,
        }]
      },
      options: {
        indexAxis: 'y', // This makes the bar chart horizontal
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1000 },
        plugins: {
          legend: { display: false }, // Hide legend as labels are on the axis
          title: { display: true, text: 'CPU Usage by Resource Type', color: 'white', font: { size: 16 } }
        },
        scales: {
          x: { 
            ticks: { color: '#9ca3af' }, 
            grid: { color: '#374151' },
            title: { display: true, text: 'Total CPU Units', color: '#9ca3af'}
          },
          y: { 
            ticks: { color: '#9ca3af' }, 
            grid: { color: '#374151' } 
          }
        }
      }
    });
  }, [kpiData]);

  return (
    <div className="page active" style={{ display: 'block' }}>
      <div className="kpi-grid" style={{ gridColumn: 'span 2', marginBottom: '24px' }}>
        {kpiData ? (
          <>
            <KpiCard title="Total Usage Records" value={kpiData.totalRecords} description="Total rows in the usage dataset" />
            <KpiCard title="Regions Monitored" value={kpiData.totalRegions} description="Unique geographical regions" />
            <KpiCard title="Average CPU Usage" value={kpiData.avgCpu} description="Mean CPU units consumed daily" />
            <KpiCard title="Data Date Range" value={kpiData.dateRange} description="Time period of the analysis" />
          </>
        ) : <p>Loading data...</p>}
      </div>
      
      {/* The new bar chart will render in this existing chart-box */}
      <div className="chart-box" style={{ gridColumn: 'span 2' }}>
        <canvas id="resourceChart"></canvas>
      </div>
    </div>
  );
};

export default OverviewPage;
