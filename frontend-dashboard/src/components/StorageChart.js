import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Register chart.js modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function StorageChart() {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    Papa.parse(process.env.PUBLIC_URL + "/data/cleaned_merged.csv", {
      download: true,
      header: true,
      complete: (result) => {
        const rows = result.data;

        const labels = rows.map((row) => row.date);
        const values = rows.map((row) => Number(row.usage_storage));

        setChartData({
          labels,
          datasets: [
            {
              label: "Storage Usage",
              data: values,
              borderColor: "rgba(255,99,132,1)",
              backgroundColor: "rgba(255,99,132,0.2)",
            },
          ],
        });
      },
    });
  }, []);

  if (!chartData) return <p>Loading Storage chart...</p>;

  return (
    <div className="p-4">
      <h2>Storage Usage Over Time</h2>
      <Line data={chartData} />
    </div>
  );
}
