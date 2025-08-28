import "./Dashboard.css";
import React from "react";
import ForecastChart from "./ForecastChart";
import StorageChart from "./StorageChart";
import DemandChart from "./DemandChart";

export default function Dashboard() {
  return (
    <div className="dashboard">
      <h1>Azure Demand Forecasting Dashboard</h1>
      <ForecastChart />
      <StorageChart />
      <DemandChart />
    </div>
  );
}
