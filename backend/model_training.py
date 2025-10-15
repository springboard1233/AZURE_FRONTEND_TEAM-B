# app/model_training.py

import pandas as pd
import xgboost as xgb
from prophet import Prophet
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split

# -------------------------------
# Load dataset
# -------------------------------
feature_engineered_path = "data/processed/feature_engineered.csv"
df = pd.read_csv(feature_engineered_path, parse_dates=['date'])
print(f"✅ Feature-engineered dataset loaded: {df.shape}")

# -------------------------------
# Encode categorical columns for XGBoost
# -------------------------------
categorical_cols = ['region', 'resource_type_Storage', 'resource_type_VM']
df_encoded = pd.get_dummies(df, columns=categorical_cols, drop_first=True)

# -------------------------------
# Split data into features and target
# -------------------------------
target_col = 'usage_cpu'  # Change to 'usage_storage' if needed
X = df_encoded.drop(columns=['date', target_col])
y = df_encoded[target_col]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)
print(f"✅ Data split: train={X_train.shape}, test={X_test.shape}")

# -------------------------------
# Prophet model
# -------------------------------
prophet_df = df[['date', target_col]].rename(columns={'date': 'ds', target_col: 'y'})
prophet_train = prophet_df.iloc[:len(X_train)]
prophet_test = prophet_df.iloc[len(X_train):]

model_prophet = Prophet()
try:
    print("🔹 Training Prophet model...")
    model_prophet.fit(prophet_train)
    forecast_prophet = model_prophet.predict(prophet_test)
    print("✅ Prophet forecast done")
except Exception as e:
    print("⚠️ Prophet model failed:", e)
    forecast_prophet = None

# -------------------------------
# XGBoost model
# -------------------------------
xgb_model = xgb.XGBRegressor(objective='reg:squarederror', enable_categorical=True)
try:
    print("🔹 Training XGBoost model...")
    xgb_model.fit(X_train, y_train)
    y_pred = xgb_model.predict(X_test)
    print("✅ XGBoost forecast done")
    
    # Metrics
    mae = mean_absolute_error(y_test, y_pred)
    mse = mean_squared_error(y_test, y_pred)
    print(f"MAE: {mae}, MSE: {mse}")

except Exception as e:
    print("⚠️ XGBoost model failed:", e)
    mae, mse, y_pred = None, None, None

# -------------------------------
# Save forecasts and metrics
# -------------------------------
import os

os.makedirs("data/processed", exist_ok=True)

# Save XGBoost forecasts
if y_pred is not None:
    forecast_df = X_test.copy()
    forecast_df[target_col + "_forecast"] = y_pred
    forecast_df.to_csv("data/processed/forecast.csv", index=False)
    print("✅ Forecasts saved to data/processed/forecast.csv")

# Save metrics
metrics = pd.DataFrame({
    "Model": ["XGBoost"],
    "MAE": [mae],
    "MSE": [mse]
})
metrics.to_csv("data/processed/model_metrics.csv", index=False)
print("✅ Model metrics saved to data/processed/model_metrics.csv")




