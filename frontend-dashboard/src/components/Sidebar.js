import React from "react";

export default function Sidebar() {
  return (
    <aside style={{ width: "200px", background: "#f0f0f0", padding: "1rem" }}>
      <nav>
        <ul>
          <li>Usage Trends</li>
          <li>Forecasts</li>
          <li>Reports</li>
        </ul>
      </nav>
    </aside>
  );
}
