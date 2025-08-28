import React from "react";
import "./App.css";
import Dashboard from "./components/Dashboard";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";

function App() {
  return (
    <div className="App">
      <Header />
      <div className="main-layout">
        <Sidebar />
        <Dashboard />
      </div>
    </div>
  );
}

export default App;
