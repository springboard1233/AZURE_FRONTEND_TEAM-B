# backend/utils.py

import pandas as pd
import numpy as np
import math
from datetime import datetime, timedelta

def load_simulated_data():
    """Generates the simulated DataFrame with all required columns."""
    data_size = 1080
    data = pd.DataFrame({
        "date": pd.date_range(start="2023-01-01", periods=data_size, freq="D"),
        "usage_cpu": np.random.rand(data_size) * 80 + 20,
        "usage_storage": np.random.rand(data_size) * 1000 + 500,
        "storage_efficiency": np.random.rand(data_size) * 0.2 + 0.75
    })
    return data

def calculate_data_insights_kpis():
    """Calculates key performance indicators (KPIs) for the Data Insights page."""
    
    df = load_simulated_data() # Use the simulated data

    if df.empty:
        return {
            "overallEfficiency": "90.0%",
            "efficiencyChange": 1.5,
            "totalUsageGB": "50K GB",
            "usageChange": 3.0
        }
    
    try:
        total_usage_gb = df['usage_storage'].sum()
        overall_efficiency_pct = df['storage_efficiency'].mean() * 100
        
        df_sorted = df.sort_values(by='date')
        usage_change_percent = 0
        if len(df_sorted) >= 14:
            latest_period_avg = df_sorted['usage_cpu'].tail(7).mean()
            previous_period_avg = df_sorted['usage_cpu'].iloc[-14:-7].mean()
            
            if not math.isnan(latest_period_avg) and not math.isnan(previous_period_avg) and previous_period_avg > 0:
                usage_change_percent = ((latest_period_avg - previous_period_avg) / previous_period_avg) * 100
                
        return {
            "overallEfficiency": f"{overall_efficiency_pct:.1f}%",
            "efficiencyChange": round(usage_change_percent * 0.5, 1),
            "totalUsageGB": f"{total_usage_gb / 1000:,.0f}K GB",
            "usageChange": round(usage_change_percent, 1)
        }

    except Exception as e:
        print(f"❌ Error calculating KPIs: {e}. Returning default mock data.")
        return {
            "overallEfficiency": "91.5%",
            "efficiencyChange": -0.8,
            "totalUsageGB": "48K GB",
            "usageChange": -1.6
        }