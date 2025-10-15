# ================================
# Milestone 2: Feature Engineering
# Backend Script for Azure Forecast Project
# Author: Abin Joshy
# ================================

import pandas as pd
import numpy as np
import os

# Step 1: Load Cleaned Dataset
script_dir = os.path.dirname(os.path.abspath(__file__))
input_path = os.path.join(script_dir, "..", "data", "processed", "cleaned_merged.csv")
output_path = os.path.join(script_dir, "..", "data", "processed", "feature_engineered.csv")

df = pd.read_csv(input_path, parse_dates=['date'])
print("✅ Dataset Loaded:", df.shape)

# Step 2: CPU Utilization
df['cpu_total'] = df.groupby('resource_type')['usage_cpu'].transform('max')
df['cpu_utilization'] = df['usage_cpu'] / df['cpu_total']

# Step 3: Storage Efficiency
df['max_storage'] = df.groupby('resource_type')['usage_storage'].transform('max')
df['storage_efficiency'] = df['usage_storage'] / df['max_storage']

# Step 4: Lag Features & Rolling Averages
df = df.sort_values(['resource_type', 'date'])
df['cpu_lag_1'] = df.groupby('resource_type')['usage_cpu'].shift(1)
df['cpu_lag_7'] = df.groupby('resource_type')['usage_cpu'].shift(7)
df['cpu_roll_mean_7'] = df.groupby('resource_type')['usage_cpu'].transform(lambda x: x.rolling(7, min_periods=1).mean())
df['storage_roll_mean_7'] = df.groupby('resource_type')['usage_storage'].transform(lambda x: x.rolling(7, min_periods=1).mean())

# Step 5: Seasonality Features
df['month'] = df['date'].dt.month
df['quarter'] = df['date'].dt.quarter
df['day_of_week'] = df['date'].dt.dayofweek

# Step 6: One-Hot Encoding
df = pd.get_dummies(df, columns=['resource_type', 'quarter'], drop_first=True)

# Step 7: Save Feature-Engineered Dataset
os.makedirs(os.path.dirname(output_path), exist_ok=True)
df.to_csv(output_path, index=False)
print("✅ Feature-engineered dataset saved:", output_path)
