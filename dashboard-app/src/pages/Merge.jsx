import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';

const MergePage = () => {
  const [featuredData, setFeaturedData] = useState([]);

  useEffect(() => {
    // This page will now load and display the output of our feature engineering
    // Make sure 'featured_dataset.csv' is in your 'public' folder.
    Papa.parse('/featured_dataset.csv', {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        setFeaturedData(results.data);
      },
    });
  }, []);

  return (
    // Use the chart-full class to make the table container span the entire width
    <div className="page active chart-full">
      <div className="chart-box" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <h3>Merged & Feature-Engineered Dataset</h3>
        <p>
          This table shows the combined Azure usage data with external factors, plus the new features 
          (like day of the week and rolling averages) created during our data science phase. 
          This is the dataset our forecasting models will use.
        </p>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {/* Create table headers dynamically from the first row of data */}
                {featuredData.length > 0 && Object.keys(featuredData[0]).map(header => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Create table rows dynamically from the data */}
              {featuredData.map((row, index) => (
                <tr key={index}>
                  {Object.values(row).map((value, i) => (
                    <td key={i}>{String(value)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MergePage;

