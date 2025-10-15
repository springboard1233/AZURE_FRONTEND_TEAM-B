# backend/routes.py

from flask import Blueprint, jsonify, send_file
import pandas as pd
import numpy as np
import os
import io
from datetime import datetime, timedelta
import random
# *** CRITICAL: Import utilities directly as they are now in the same folder ***
from utils import calculate_data_insights_kpis 

# =========================================================
# CRITICAL FIX: Define the Blueprint FIRST
# =========================================================
api_routes = Blueprint('api_routes', __name__) 

# ----------------------------------------------------------------------
# UTILITY FUNCTION (Correlation Mock - Only needed here)
# ----------------------------------------------------------------------
def get_correlation_matrix_mock():
    # Data for Feature Correlation Explorer
    return [
        {"feature": "Lagged Demand", "Lagged Demand": 1.00, "Rolling Avg": 0.45, "Target": 0.85},
        {"feature": "Rolling Avg", "Lagged Demand": 0.45, "Rolling Avg": 1.00, "Target": 0.70},
        {"feature": "Target Usage", "Lagged Demand": 0.85, "Rolling Avg": 0.70, "Target": 1.00},
    ]

# ----------------------------------------------------------------------
# 🛑 MILESTONE 4/3 API ROUTES (The Core Endpoints)
# ----------------------------------------------------------------------

@api_routes.route('/forecast', methods=['GET'])
def get_forecast():
    # Route for Forecast.js - Returns 7-day forecast with CI
    start_date = datetime.now().date()
    forecast = []
    for i in range(7):
        date = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
        predicted = 55 + i * 2 + (i % 3) * 5 
        lower = predicted * 0.90
        upper = predicted * 1.10
        forecast.append({"date": date, "lower": round(lower, 2), "predicted": round(predicted, 2), "upper": round(upper, 2)})
    return jsonify(forecast)

@api_routes.route('/model-comparison', methods=['GET'])
def get_model_comparison():
    # Route for ModelComparison.js
    metrics = [
        {"model": "LSTM (Best)", "mae": 7.1, "rmse": 11.0, "mape": "3.9%", "time": "25s", "speed": "12ms"},
        {"model": "XGBoost", "mae": 8.0, "rmse": 12.5, "mape": "4.4%", "time": "10s", "speed": "5ms"},
        {"model": "SARIMA", "mae": 12.5, "rmse": 18.0, "mape": "6.8%", "time": "5s", "speed": "3ms"},
    ]
    return jsonify(metrics)

@api_routes.route("/capacity-planning", methods=['GET'])
def get_capacity_planning():
    # Route for CapacityPlanning.js
    charts_data = [
        {"region": "East US", "capacity": 1000, "forecast": 1200, "resource": "VM"},
        {"region": "North Europe", "capacity": 800, "forecast": 720, "resource": "VM"},
        {"region": "Southeast Asia", "capacity": 2000, "forecast": 2500, "resource": "Storage"},
        {"region": "West US", "capacity": 1500, "forecast": 1500, "resource": "Container"},
    ]
    recommendations = [
        {"region": "East US", "resource": "VM", "adjustment": "+200", "risk": "Shortage"},
        {"region": "North Europe", "resource": "VM", "adjustment": "-100", "risk": "Over-provision"},
        {"region": "Southeast Asia", "resource": "Storage", "adjustment": "+500", "risk": "Shortage"},
        {"region": "West US", "resource": "Container", "adjustment": "±0", "risk": "Sufficient"},
    ]
    return jsonify({"charts": charts_data, "recommendations": recommendations})


@api_routes.route("/monitoring", methods=['GET'])
def get_monitoring():
    # Route for Monitoring.js
    monitoring_data = {
        "last_retrain": "2025-10-01",
        "current_accuracy": 88.5,
        "accuracy_trend": [85.2, 86.1, 87.5, 88.5], 
        "health_status": "Stable (Accuracy > 85%)",
        "alert": "No drift detected."
    }
    return jsonify(monitoring_data)

# ----------------------------------------------------------------------
# 🛑 DATA INSIGHTS API ROUTES
# ----------------------------------------------------------------------

@api_routes.route('/analysis/kpis', methods=['GET'])
def analysis_kpis():
    # Calculates KPIs using the utils.py logic
    kpis = calculate_data_insights_kpis() 
    return jsonify({"kpis": kpis})

@api_routes.route('/analysis/regional_performance', methods=['GET'])
def regional_performance_endpoint():
    # Data for RegionalPerformance.js
    regional_data = [
        {"region": "East US", "avg_performance": 74, "volatility": 16.7, "efficiency_score": 70},
        {"region": "North Europe", "avg_performance": 78, "volatility": 13.9, "efficiency_score": 80},
        {"region": "Southeast Asia", "avg_performance": 76, "volatility": 14.2, "efficiency_score": 75},
        {"region": "West US", "avg_performance": 70, "volatility": 15.7, "efficiency_score": 65},
    ]
    return jsonify({"regionalUsage": regional_data})

@api_routes.route('/analysis/trend', methods=['GET'])
def trend_analysis_route():
    # Data for TrendAnalysis.js
    trend_data = [
        {"date": "Mon", "usage": 65, "anomaly": 0, "forecast": 70},
        {"date": "Tue", "usage": 72, "anomaly": 0, "forecast": 75},
        {"date": "Wed", "usage": 58, "anomaly": -1, "forecast": 60},
        {"date": "Thu", "usage": 85, "anomaly": 1, "forecast": 78},
        {"date": "Fri", "usage": 68, "anomaly": 0, "forecast": 69},
        {"date": "Sat", "usage": 50, "anomaly": 0, "forecast": 55},
        {"date": "Sun", "usage": 45, "anomaly": -1, "forecast": 50},
    ]
    pattern_data = [
        {"type": "Mon", "value": 120}, {"type": "Tue", "value": 150}, {"type": "Wed", "value": 140}, 
        {"type": "Thu", "value": 160}, {"type": "Fri", "value": 170}, {"type": "Sat", "value": 80}, 
        {"type": "Sun", "value": 50}
    ]

    return jsonify({
        "trend": trend_data, 
        "patterns": pattern_data,
        "correlationMatrix": get_correlation_matrix_mock()
    })

@api_routes.route('/report', methods=['GET'])
def download_report():
    # Generates and serves a mock report CSV file (M4)
    data = {'Date': [str(datetime.date.today()), str(datetime.date.today() + timedelta(days=1))], 'Forecasted Demand': [1200, 1250], 'Recommendation': ['Add 200 units', 'Add 250 units']}
    report_df = pd.DataFrame(data)
    buffer = io.StringIO()
    report_df.to_csv(buffer, index=False)
    buffer.seek(0)
    
    return send_file(
        io.BytesIO(buffer.getvalue().encode('utf-8')),
        mimetype='text/csv',
        as_attachment=True,
        download_name='Azure_Forecast_Report.csv'
    )