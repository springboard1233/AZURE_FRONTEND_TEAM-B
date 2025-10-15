# ================================
# Milestone 3: Machine Learning Model Development
# Backend Script for Azure Forecast Project
# Author: Abin Joshy
# ================================

import pandas as pd
import numpy as np
from statsmodels.tsa.arima.model import ARIMA
from sklearn.metrics import mean_absolute_error, mean_squared_error
import xgboost as xgb
from sklearn.preprocessing import StandardScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
from tensorflow.keras.callbacks import EarlyStopping
import os

# --------------------------
# Step 0: Paths
# --------------------------
script_dir = os.path.dirname(os.path.abspath(__file__))
input_path = os.path.join(script_dir, "..", "data", "processed", "feature_engineered.csv")
output_path = os.path.join(script_dir, "..", "data", "processed", "model_comparison.csv")

# --------------------------
# Step 1: Load Dataset
# --------------------------
df = pd.read_csv(input_path, parse_dates=['date'])
print("✅ Feature-engineered dataset loaded:", df.shape)

# --------------------------
# Step 2: Prepare Features
# --------------------------
# Drop date and target from features
target_col = 'usage_cpu'
X = df.drop([target_col, 'date'], axis=1)

# One-hot encode remaining object columns (like region)
X = pd.get_dummies(X, drop_first=True)

y = df[target_col].values

# Time-based split: 70%-20%-10%
train_size = int(0.7 * len(df))
val_size = int(0.2 * len(df))

X_train, y_train = X.iloc[:train_size], y[:train_size]
X_val, y_val = X.iloc[train_size:train_size+val_size], y[train_size:train_size+val_size]
X_test, y_test = X.iloc[train_size+val_size:], y[train_size+val_size:]

print(f"Train: {X_train.shape}, Val: {X_val.shape}, Test: {X_test.shape}")

# --------------------------
# Step 3: Train ARIMA Model
# --------------------------
# For simplicity, we train ARIMA on total CPU usage aggregated
cpu_series = df[target_col]
arima_order = (5,1,0)  # Simple example
arima_model = ARIMA(cpu_series[:train_size], order=arima_order)
arima_fit = arima_model.fit()
arima_pred = arima_fit.forecast(steps=len(y_test))

# Metrics
def calculate_metrics(y_true, y_pred):
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mape = np.mean(np.abs((y_true - y_pred)/y_true)) * 100
    bias = np.mean(y_pred - y_true)
    return mae, rmse, mape, bias

arima_mae, arima_rmse, arima_mape, arima_bias = calculate_metrics(y_test, arima_pred)

# --------------------------
# Step 4: Train XGBoost Model
# --------------------------
xgb_model = xgb.XGBRegressor(n_estimators=100, learning_rate=0.1)
xgb_model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
xgb_pred = xgb_model.predict(X_test)
xgb_mae, xgb_rmse, xgb_mape, xgb_bias = calculate_metrics(y_test, xgb_pred)

# --------------------------
# Step 5: Train LSTM Model
# --------------------------
# Scale features
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
X_train_lstm = X_scaled[:train_size].reshape(-1, 1, X_train.shape[1])
X_val_lstm = X_scaled[train_size:train_size+val_size].reshape(-1, 1, X_train.shape[1])
X_test_lstm = X_scaled[train_size+val_size:].reshape(-1, 1, X_train.shape[1])

y_train_lstm = y_train
y_val_lstm = y_val
y_test_lstm = y_test

lstm_model = Sequential()
lstm_model.add(LSTM(64, input_shape=(X_train_lstm.shape[1], X_train_lstm.shape[2])))
lstm_model.add(Dense(1))
lstm_model.compile(optimizer='adam', loss='mse')

early_stop = EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True)
lstm_model.fit(X_train_lstm, y_train_lstm, validation_data=(X_val_lstm, y_val_lstm),
               epochs=50, batch_size=16, verbose=0, callbacks=[early_stop])

lstm_pred = lstm_model.predict(X_test_lstm).flatten()
lstm_mae, lstm_rmse, lstm_mape, lstm_bias = calculate_metrics(y_test_lstm, lstm_pred)

# --------------------------
# Step 6: Save Model Comparison
# --------------------------
model_comparison = pd.DataFrame({
    "Model": ["ARIMA", "XGBoost", "LSTM"],
    "MAE": [arima_mae, xgb_mae, lstm_mae],
    "RMSE": [arima_rmse, xgb_rmse, lstm_rmse],
    "MAPE (%)": [arima_mape, xgb_mape, lstm_mape],
    "Forecast_Bias": [arima_bias, xgb_bias, lstm_bias]
})

model_comparison.to_csv(output_path, index=False)
print("✅ Model comparison saved:", output_path)
print(model_comparison)


