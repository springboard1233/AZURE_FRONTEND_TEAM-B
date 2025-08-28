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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function ForecastChart() {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    Papa.parse(process.env.PUBLIC_URL + "/data/cleaned_merged.csv", {
      download: true,
      header: true,
      complete: (result) => {
        const rows = result.data;
        const labels = rows.map((row) => row.date);
        const values = rows.map((row) => Number(row.usage_cpu));

        setChartData({
          labels,
          datasets: [
            {
              label: "CPU Usage",
              data: values,
              borderColor: "rgba(75,192,192,1)",
              backgroundColor: "rgba(75,192,192,0.2)",
            },
          ],
        });
      },
    });
  }, []);

  if (!chartData) return <p>Loading chart...</p>;

  return (
    <div style={{ padding: "1rem" }}>
      <h2>CPU Usage Over Time</h2>
      <Line data={chartData} />
    </div>
  );
}
