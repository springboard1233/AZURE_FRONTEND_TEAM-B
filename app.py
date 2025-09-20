import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

pd.set_option("display.max_columns", 200)

import pandas as pd

df = pd.read_excel("cleaned_merged.csv.xlsx")  # Because it's Excel format
df['date'] = pd.to_datetime(df['date'])  # Ensure date column is in datetime format

print(df.shape)
df.head()

# Add time-based features
df['month'] = df['date'].dt.month
df['day_of_week'] = df['date'].dt.dayofweek
df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)
df['quarter'] = df['date'].dt.quarter


df.head()

# Group by region and resource_type for time-series operations
grp = df.groupby(['region', 'resource_type'], group_keys=False)

# Add lag features for CPU usage
df['usage_cpu_lag1'] = grp['usage_cpu'].shift(1)
df['usage_cpu_lag3'] = grp['usage_cpu'].shift(3)
df['usage_cpu_lag7'] = grp['usage_cpu'].shift(7)
df.head()

# Rolling mean, max, min for CPU usage
df['cpu_roll_mean_7'] = grp['usage_cpu'].transform(lambda x: x.rolling(window=7, min_periods=1).mean())
df['cpu_roll_max_7']  = grp['usage_cpu'].transform(lambda x: x.rolling(window=7, min_periods=1).max())
df['cpu_roll_min_7']  = grp['usage_cpu'].transform(lambda x: x.rolling(window=7, min_periods=1).min())

df['cpu_roll_mean_30'] = grp['usage_cpu'].transform(lambda x: x.rolling(window=30, min_periods=1).mean())
df['cpu_roll_max_30']  = grp['usage_cpu'].transform(lambda x: x.rolling(window=30, min_periods=1).max())
df['cpu_roll_min_30']  = grp['usage_cpu'].transform(lambda x: x.rolling(window=30, min_periods=1).min())
df.head()

# ================================
#  Derived Metrics 
# ================================

# CPU Utilization = cpu_used / cpu_total
# - cpu_total = maximum observed CPU usage for that resource_type
df['cpu_total'] = df.groupby('resource_type')['usage_cpu'].transform('max')
df['cpu_utilization'] = df['usage_cpu'] / df['cpu_total']

# Storage Efficiency = storage_used / storage_allocated
# - storage_allocated = maximum observed storage usage for that resource_type
df['storage_allocated'] = df.groupby('resource_type')['usage_storage'].transform('max')
df['storage_efficiency'] = df['usage_storage'] / df['storage_allocated']

df.head()

import numpy as np
np.random.seed(42)
df['weather_index'] = np.random.randint(0, 3, size=len(df))  # 0=normal, 1=hot, 2=cold
df['power_outage_flag'] = np.random.choice([0, 1], size=len(df), p=[0.98, 0.02])
df['price_change'] = np.random.uniform(-0.05, 0.05, size=len(df))  # ±5% change

# Fill missing values caused by lag and rolling operations
df.fillna(method='bfill', inplace=True)
df.fillna(method='ffill', inplace=True)

# Check if any NaNs are left
print("Remaining missing values:", df.isna().sum().sum())

# One-hot encode 'region' and 'resource_type'
df = pd.get_dummies(df, columns=['region', 'resource_type'], drop_first=False)  # I recommend drop_first=False

print("Categorical variables one-hot encoded.")
df.head()

# ------------------------
# Add string columns for frontend filters
# ------------------------
df['Region'] = ''
df.loc[df['region_EAST US'] == 1, 'Region'] = 'East US'
df.loc[df['region_NORTH EUROPE'] == 1, 'Region'] = 'North Europe'
df.loc[df['region_SOUTHEAST ASIA'] == 1, 'Region'] = 'Southeast Asia'
df.loc[df['region_WEST US'] == 1, 'Region'] = 'West US'

df['ResourceType'] = ''
df.loc[df['resource_type_VM'] == 1, 'ResourceType'] = 'VM'
df.loc[df['resource_type_Storage'] == 1, 'ResourceType'] = 'Storage'
df.loc[df['resource_type_Container'] == 1, 'ResourceType'] = 'Container'

df.to_csv("milestone2_feature_engineered.csv", index=False)
