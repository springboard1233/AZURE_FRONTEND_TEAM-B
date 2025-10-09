from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import warnings
import time
import os
import pickle
warnings.filterwarnings('ignore')

app = Flask(__name__)
CORS(app)

# Basic in-memory metrics
request_metrics = {
    'total_requests': 0,
    'endpoints': {},  # endpoint -> {'count': int, 'avg_latency_ms': float}
}

@app.before_request
def _start_timer():
    request._start_time = time.perf_counter()

@app.after_request
def _record_metrics(response):
    try:
        duration_ms = (time.perf_counter() - getattr(request, '_start_time', time.perf_counter())) * 1000.0
        request_metrics['total_requests'] += 1
        endpoint_key = request.endpoint or 'unknown'
        ep = request_metrics['endpoints'].setdefault(endpoint_key, {'count': 0, 'avg_latency_ms': 0.0})
        # online average update
        ep['count'] += 1
        ep['avg_latency_ms'] += (duration_ms - ep['avg_latency_ms']) / max(ep['count'], 1)
    except Exception:
        pass
    return response

# Load datasets at startup
print("Loading datasets...", flush=True)
try:
    df = pd.read_csv('data/processed/cleaned_merged.csv', parse_dates=['date'])
    print(f"Loaded {len(df)} records from cleaned_merged.csv", flush=True)
    print(f"Columns: {list(df.columns)}", flush=True)
    print(f"Date range: {df['date'].min()} to {df['date'].max()}", flush=True)
except Exception as e:
    print(f"Error loading data: {e}", flush=True)
    raise

# Data preprocessing for API
df['month'] = df['date'].dt.month
df['day_of_week'] = df['date'].dt.day_name()
df['quarter'] = df['date'].dt.quarter
df['is_weekend'] = df['date'].dt.dayofweek.isin([5, 6]).astype(int)

# ===== TAB 1: OVERVIEW & KPIs =====

@app.route('/api/kpis')
def get_kpis():
    """Get key performance indicators for dashboard overview"""
    try:
        kpis = {
            'peak_cpu': float(df['usage_cpu'].max()),
            'peak_cpu_details': {
                'date': df.loc[df['usage_cpu'].idxmax(), 'date'].isoformat(),
                'region': df.loc[df['usage_cpu'].idxmax(), 'region'],
                'resource_type': df.loc[df['usage_cpu'].idxmax(), 'resource_type']
            },
            'max_storage': float(df['usage_storage'].max()),
            'max_storage_details': {
                'date': df.loc[df['usage_storage'].idxmax(), 'date'].isoformat(),
                'region': df.loc[df['usage_storage'].idxmax(), 'region'],
                'resource_type': df.loc[df['usage_storage'].idxmax(), 'resource_type']
            },
            'peak_users': int(df['users_active'].max()),
            'peak_users_details': {
                'date': df.loc[df['users_active'].idxmax(), 'date'].isoformat(),
                'region': df.loc[df['users_active'].idxmax(), 'region'],
                'resource_type': df.loc[df['users_active'].idxmax(), 'resource_type']
            },
            'avg_cpu': float(df['usage_cpu'].mean()),
            'avg_storage': float(df['usage_storage'].mean()),
            'avg_users': float(df['users_active'].mean()),
            'total_regions': int(df['region'].nunique()),
            'total_resource_types': int(df['resource_type'].nunique()),
            'data_points': int(len(df)),
            'date_range': {
                'start': df['date'].min().isoformat(),
                'end': df['date'].max().isoformat(),
                'days': int((df['date'].max() - df['date'].min()).days)
            }
        }
        
        # Calculate holiday impact
        holiday_avg = df[df['holiday'] == 1]['usage_cpu'].mean()
        regular_avg = df[df['holiday'] == 0]['usage_cpu'].mean()
        holiday_impact = ((holiday_avg - regular_avg) / regular_avg) * 100
        
        kpis['holiday_impact'] = {
            'percentage': float(holiday_impact),
            'holiday_avg_cpu': float(holiday_avg),
            'regular_avg_cpu': float(regular_avg)
        }
        
        return jsonify(kpis)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sparklines')
def get_sparklines():
    """Get mini trend data for sparkline charts"""
    try:
        # Get last 30 days of data
        latest_date = df['date'].max()
        last_30_days = df[df['date'] > (latest_date - timedelta(days=30))]
        
        daily_trends = last_30_days.groupby('date').agg({
            'usage_cpu': 'mean',
            'usage_storage': 'mean',
            'users_active': 'mean'
        }).reset_index()
        
        sparklines = {
            'cpu_trend': daily_trends[['date', 'usage_cpu']].to_dict('records'),
            'storage_trend': daily_trends[['date', 'usage_storage']].to_dict('records'),
            'users_trend': daily_trends[['date', 'users_active']].to_dict('records')
        }
        
        # Convert dates to ISO format
        for trend in sparklines.values():
            for point in trend:
                point['date'] = pd.to_datetime(point['date']).isoformat()
        
        return jsonify(sparklines)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===== : USAGE TRENDS =====

@app.route('/api/time-series')
def get_time_series():
    """Get comprehensive time series data for trends analysis"""
    try:
        region_filter = request.args.get('region')
        resource_filter = request.args.get('resource_type')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        data = df.copy()
        
        # Apply filters
        if region_filter:
            data = data[data['region'] == region_filter]
        if resource_filter:
            data = data[data['resource_type'] == resource_filter]
        if start_date:
            data = data[data['date'] >= pd.to_datetime(start_date)]
        if end_date:
            data = data[data['date'] <= pd.to_datetime(end_date)]
        
        # Group by date for time series
        time_series = data.groupby('date').agg({
            'usage_cpu': 'mean',
            'usage_storage': 'mean',
            'users_active': 'mean',
            'economic_index': 'mean',
            'cloud_market_demand': 'mean'
        }).reset_index()
        
        # Convert dates to ISO format
        time_series['date'] = time_series['date'].dt.strftime('%Y-%m-%d')
        
        return jsonify(time_series.to_dict('records'))
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/trends/regional')
def get_regional_trends():
    """Get time series data grouped by region"""
    try:
        regional_trends = df.groupby(['date', 'region']).agg({
            'usage_cpu': 'mean',
            'usage_storage': 'mean',
            'users_active': 'mean'
        }).reset_index()
        
        regional_trends['date'] = regional_trends['date'].dt.strftime('%Y-%m-%d')
        
        return jsonify(regional_trends.to_dict('records'))
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== Forecast Logging & Reporting =====
FORECAST_LOG_CSV_CANDIDATES = [
    os.path.join('data', 'processed', 'forecasts_log.csv'),
    os.path.join('backend', 'data', 'processed', 'forecasts_log.csv')
]

def _resolve_forecast_log_path():
    # Prefer an existing path; otherwise create at first candidate's directory
    for p in FORECAST_LOG_CSV_CANDIDATES:
        if os.path.exists(p):
            return p
    # Ensure directory exists
    target = FORECAST_LOG_CSV_CANDIDATES[0]
    os.makedirs(os.path.dirname(target), exist_ok=True)
    return target

def _append_forecasts_to_log(rows_df: pd.DataFrame):
    log_path = _resolve_forecast_log_path()
    if os.path.exists(log_path):
        existing = pd.read_csv(log_path, parse_dates=['date', 'run_timestamp'])
        combined = pd.concat([existing, rows_df], ignore_index=True)
        combined.to_csv(log_path, index=False)
    else:
        rows_df.to_csv(log_path, index=False)

def _generate_naive_forecast_points(region: str, resource_type: str, metric: str, horizon: int, safety_factor: float = 1.0):
    data = df.copy()
    if region:
        data = data[data['region'] == region]
    if resource_type:
        data = data[data['resource_type'] == resource_type]
    data = data.sort_values('date')
    if len(data) == 0:
        return []
    base_series = data[metric] if metric in data.columns else data['usage_cpu']
    baseline = float(base_series.tail(7).mean())
    ci = _compute_simple_ci(base_series)
    last_date = data['date'].max()
    out = []
    for i in range(1, horizon + 1):
        next_date = (last_date + timedelta(days=i)).strftime('%Y-%m-%d')
        yhat = baseline * safety_factor
        out.append({
            'date': next_date,
            'forecast': float(yhat),
            'lower_95': float(max(0.0, yhat - ci)),
            'upper_95': float(yhat + ci)
        })
    return out

@app.route('/api/forecast/run-and-store', methods=['POST'])
def run_and_store_forecast():
    try:
        payload = request.get_json(silent=True) or {}
        region = payload.get('region') or request.args.get('region')
        resource_type = payload.get('resource_type') or payload.get('service') or request.args.get('resource_type')
        horizon = int(payload.get('horizon') or request.args.get('horizon') or 30)
        metric = payload.get('metric') or request.args.get('metric') or 'usage_cpu'
        safety_factor = float(payload.get('safety_factor') or request.args.get('safety_factor') or 1.0)
        if not region or not resource_type:
            return jsonify({'error': 'region and resource_type/service are required'}), 400

        points = _generate_naive_forecast_points(region, resource_type, metric, horizon, safety_factor)
        run_ts = pd.Timestamp.utcnow()
        rows = []
        for p in points:
            rows.append({
                'date': pd.to_datetime(p['date']),
                'region': region,
                'resource_type': resource_type,
                'metric': metric,
                'forecast': p['forecast'],
                'lower_95': p['lower_95'],
                'upper_95': p['upper_95'],
                'run_timestamp': run_ts
            })
        rows_df = pd.DataFrame(rows)
        if len(rows_df) > 0:
            _append_forecasts_to_log(rows_df)
        return jsonify({'status': 'ok', 'stored': int(len(rows_df))})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/report/accuracy')
def report_accuracy():
    try:
        window_days = int(request.args.get('window_days', 30))
        metric = request.args.get('metric', 'usage_cpu')
        region = request.args.get('region')
        resource_type = request.args.get('resource_type') or request.args.get('service')

        log_path = _resolve_forecast_log_path()
        if not os.path.exists(log_path):
            return jsonify({'error': 'No forecast log found'}), 404
        logs = pd.read_csv(log_path, parse_dates=['date', 'run_timestamp'])

        # Filter
        if region:
            logs = logs[logs['region'] == region]
        if resource_type:
            logs = logs[logs['resource_type'] == resource_type]
        if metric:
            logs = logs[logs['metric'] == metric]

        if len(logs) == 0:
            return jsonify({'error': 'No matching forecast logs'}), 404

        # Join with actuals
        actuals = df.copy()
        if region:
            actuals = actuals[actuals['region'] == region]
        if resource_type:
            actuals = actuals[actuals['resource_type'] == resource_type]
        actuals = actuals[['date', metric]].rename(columns={metric: 'actual'})
        actuals['date'] = pd.to_datetime(actuals['date'])

        merged = logs.merge(actuals, on='date', how='left')
        merged = merged.sort_values('date')
        cutoff = merged['date'].max() - pd.Timedelta(days=window_days)
        merged = merged[merged['date'] > cutoff]

        # Compute errors
        merged['abs_error'] = (merged['forecast'] - merged['actual']).abs()
        merged['se'] = (merged['forecast'] - merged['actual']) ** 2
        merged['ape'] = (merged['abs_error'] / merged['actual']).replace([np.inf, -np.inf], np.nan)

        rmse = float(np.sqrt(merged['se'].mean())) if len(merged) else None
        mae = float(merged['abs_error'].mean()) if len(merged) else None
        mape = float((merged['ape'].mean() * 100.0)) if len(merged) else None

        # Daily trend
        daily = merged.groupby('date').agg(
            rmse_day=('se', lambda s: float(np.sqrt(s.mean())) if len(s) else 0.0),
            mae_day=('abs_error', lambda s: float(s.mean()) if len(s) else 0.0),
            mape_day=('ape', lambda s: float(np.nanmean(s) * 100.0) if len(s) else 0.0)
        ).reset_index()
        daily['date'] = daily['date'].dt.strftime('%Y-%m-%d')

        return jsonify({
            'metric': metric,
            'region': region,
            'resource_type': resource_type,
            'window_days': window_days,
            'rmse': rmse,
            'mae': mae,
            'mape': mape,
            'trend': daily.to_dict('records')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/report/export')
def report_export():
    try:
        export_type = request.args.get('type', 'logs')  # 'logs' | 'accuracy'
        metric = request.args.get('metric', 'usage_cpu')
        region = request.args.get('region')
        resource_type = request.args.get('resource_type') or request.args.get('service')
        window_days = int(request.args.get('window_days', 30))

        if export_type == 'logs':
            log_path = _resolve_forecast_log_path()
            if not os.path.exists(log_path):
                return jsonify({'error': 'No forecast log found'}), 404
            logs = pd.read_csv(log_path, parse_dates=['date', 'run_timestamp'])
            if region:
                logs = logs[logs['region'] == region]
            if resource_type:
                logs = logs[logs['resource_type'] == resource_type]
            if metric:
                logs = logs[logs['metric'] == metric]
            csv_str = logs.to_csv(index=False)
            return app.response_class(csv_str, mimetype='text/csv')
        else:
            # accuracy
            # reuse logic from report_accuracy
            # get JSON then render to CSV
            with app.test_request_context():
                pass
            # direct compute
            log_path = _resolve_forecast_log_path()
            if not os.path.exists(log_path):
                return jsonify({'error': 'No forecast log found'}), 404
            logs = pd.read_csv(log_path, parse_dates=['date', 'run_timestamp'])
            if region:
                logs = logs[logs['region'] == region]
            if resource_type:
                logs = logs[logs['resource_type'] == resource_type]
            if metric:
                logs = logs[logs['metric'] == metric]
            actuals = df.copy()
            if region:
                actuals = actuals[actuals['region'] == region]
            if resource_type:
                actuals = actuals[actuals['resource_type'] == resource_type]
            actuals = actuals[['date', metric]].rename(columns={metric: 'actual'})
            actuals['date'] = pd.to_datetime(actuals['date'])
            merged = logs.merge(actuals, on='date', how='left').sort_values('date')
            cutoff = merged['date'].max() - pd.Timedelta(days=window_days)
            merged = merged[merged['date'] > cutoff]
            merged['abs_error'] = (merged['forecast'] - merged['actual']).abs()
            merged['se'] = (merged['forecast'] - merged['actual']) ** 2
            merged['ape'] = (merged['abs_error'] / merged['actual']).replace([np.inf, -np.inf], np.nan)
            out = merged[['date', 'region', 'resource_type', 'metric', 'forecast', 'actual', 'abs_error', 'se', 'ape', 'run_timestamp']]
            out['date'] = pd.to_datetime(out['date']).dt.strftime('%Y-%m-%d')
            csv_str = out.to_csv(index=False)
            return app.response_class(csv_str, mimetype='text/csv')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cron/daily')
def cron_daily():
    try:
        metric = request.args.get('metric', 'usage_cpu')
        horizon = int(request.args.get('horizon', 30))
        safety_factor = float(request.args.get('safety_factor', 1.0))
        regions = sorted(df['region'].unique().tolist())
        resource_types = sorted(df['resource_type'].unique().tolist())
        total = 0
        for r in regions:
            for s in resource_types:
                points = _generate_naive_forecast_points(r, s, metric, horizon, safety_factor)
                run_ts = pd.Timestamp.utcnow()
                rows = [{
                    'date': pd.to_datetime(p['date']),
                    'region': r,
                    'resource_type': s,
                    'metric': metric,
                    'forecast': p['forecast'],
                    'lower_95': p['lower_95'],
                    'upper_95': p['upper_95'],
                    'run_timestamp': run_ts
                } for p in points]
                if rows:
                    _append_forecasts_to_log(pd.DataFrame(rows))
                    total += len(rows)
        return jsonify({'status': 'ok', 'stored': int(total), 'regions': len(regions), 'services': len(resource_types)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== Monitoring & Retraining =====
@app.route('/api/monitoring')
def monitoring():
    try:
        metric = request.args.get('metric', 'usage_cpu')
        region = request.args.get('region')
        resource_type = request.args.get('resource_type') or request.args.get('service')
        window_days = int(request.args.get('window_days', 30))
        drift_threshold_mape = float(request.args.get('drift_threshold_mape', 15.0))
        stale_days_threshold = int(request.args.get('stale_days_threshold', 7))

        # Accuracy via report_accuracy logic
        log_path = _resolve_forecast_log_path()
        has_logs = os.path.exists(log_path)
        if not has_logs:
            accuracy = {'rmse': None, 'mae': None, 'mape': None}
        else:
            logs = pd.read_csv(log_path, parse_dates=['date', 'run_timestamp'])
            if region:
                logs = logs[logs['region'] == region]
            if resource_type:
                logs = logs[logs['resource_type'] == resource_type]
            if metric:
                logs = logs[logs['metric'] == metric]
            actuals = df.copy()
            if region:
                actuals = actuals[actuals['region'] == region]
            if resource_type:
                actuals = actuals[actuals['resource_type'] == resource_type]
            actuals = actuals[['date', metric]].rename(columns={metric: 'actual'})
            actuals['date'] = pd.to_datetime(actuals['date'])
            merged = logs.merge(actuals, on='date', how='left').sort_values('date')
            cutoff = merged['date'].max() - pd.Timedelta(days=window_days) if len(merged) else pd.Timestamp.utcnow()
            merged = merged[merged['date'] > cutoff]
            merged['abs_error'] = (merged['forecast'] - merged['actual']).abs()
            merged['se'] = (merged['forecast'] - merged['actual']) ** 2
            merged['ape'] = (merged['abs_error'] / merged['actual']).replace([np.inf, -np.inf], np.nan)
            rmse = float(np.sqrt(merged['se'].mean())) if len(merged) else None
            mae = float(merged['abs_error'].mean()) if len(merged) else None
            mape = float((merged['ape'].mean() * 100.0)) if len(merged) else None
            accuracy = {'rmse': rmse, 'mae': mae, 'mape': mape}

        # Drift: compare recent half vs previous half MAPE
        drift = None
        drift_flag = False
        if has_logs:
            logs = pd.read_csv(log_path, parse_dates=['date', 'run_timestamp'])
            if region:
                logs = logs[logs['region'] == region]
            if resource_type:
                logs = logs[logs['resource_type'] == resource_type]
            if metric:
                logs = logs[logs['metric'] == metric]
            actuals = df.copy()
            if region:
                actuals = actuals[actuals['region'] == region]
            if resource_type:
                actuals = actuals[actuals['resource_type'] == resource_type]
            actuals = actuals[['date', metric]].rename(columns={metric: 'actual'})
            actuals['date'] = pd.to_datetime(actuals['date'])
            merged = logs.merge(actuals, on='date', how='left').sort_values('date')
            if len(merged) >= 10:
                mid = len(merged) // 2
                first = merged.iloc[:mid]
                second = merged.iloc[mid:]
                def mape_of(df_):
                    ape = (df_['forecast'] - df_['actual']).abs() / df_['actual']
                    return float(np.nanmean(ape) * 100.0)
                m1 = mape_of(first)
                m2 = mape_of(second)
                drift = {
                    'mape_first_half': m1,
                    'mape_second_half': m2,
                    'delta_mape': float(m2 - m1)
                }
                drift_flag = (m2 is not None and m1 is not None and (m2 - m1) > drift_threshold_mape)

        # Staleness: last run timestamp
        data_stale = False
        last_run_timestamp = None
        if has_logs:
            logs = pd.read_csv(log_path, parse_dates=['date', 'run_timestamp'])
            if len(logs) > 0:
                last_run_timestamp = logs['run_timestamp'].max()
                if (pd.Timestamp.utcnow() - last_run_timestamp).days > stale_days_threshold:
                    data_stale = True

        need_retraining = bool(drift_flag or data_stale)

        return jsonify({
            'metric': metric,
            'region': region,
            'resource_type': resource_type,
            'window_days': window_days,
            'accuracy': accuracy,
            'drift': drift,
            'drift_threshold_mape': drift_threshold_mape,
            'stale_days_threshold': stale_days_threshold,
            'last_run_timestamp': last_run_timestamp.isoformat() if last_run_timestamp is not None else None,
            'last_retrain_timestamp': LAST_RETRAIN_TS.isoformat() if LAST_RETRAIN_TS is not None else None,
            'data_stale': data_stale,
            'need_retraining': need_retraining
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/retrain', methods=['POST'])
def retrain_stub():
    try:
        # In a real pipeline: kick off training job (e.g., Azure ML), then update model file
        # For now, invalidate model cache so next call attempts reload
        _MODEL_CACHE['loaded'] = False
        _MODEL_CACHE['model'] = None
        _MODEL_CACHE['feature_names'] = None
        # Optionally record retrain request
        global LAST_RETRAIN_TS
        LAST_RETRAIN_TS = pd.Timestamp.utcnow()
        return jsonify({'status': 'queued', 'last_retrain_timestamp': LAST_RETRAIN_TS.isoformat()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/trends/resource-types')
def get_resource_trends():
    """Get time series data grouped by resource type"""
    try:
        resource_trends = df.groupby(['date', 'resource_type']).agg({
            'usage_cpu': 'mean',
            'usage_storage': 'mean',
            'users_active': 'mean'
        }).reset_index()
        
        resource_trends['date'] = resource_trends['date'].dt.strftime('%Y-%m-%d')
        
        return jsonify(resource_trends.to_dict('records'))
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===== TAB 3: REGIONAL COMPARISON =====

@app.route('/api/regional/comparison')
def get_regional_comparison():
    """Get regional performance comparison data"""
    try:
        regional_summary = df.groupby('region').agg({
            'usage_cpu': ['mean', 'max', 'min', 'std'],
            'usage_storage': ['mean', 'max', 'min', 'std'],
            'users_active': ['mean', 'max', 'min', 'std']
        }).round(2)
        
        # Flatten column names
        regional_summary.columns = ['_'.join(col).strip() for col in regional_summary.columns]
        regional_summary = regional_summary.reset_index()
        
        return jsonify(regional_summary.to_dict('records'))
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/regional/heatmap')
def get_regional_heatmap():
    """Get data for regional performance heatmap"""
    try:
        heatmap_data = df.groupby(['region', 'resource_type']).agg({
            'usage_cpu': 'mean',
            'usage_storage': 'mean',
            'users_active': 'mean'
        }).reset_index()
        
        return jsonify(heatmap_data.to_dict('records'))
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/regional/distribution')
def get_regional_distribution():
    """Get regional usage distribution data"""
    try:
        distribution = df.groupby('region').agg({
            'usage_cpu': 'sum',
            'usage_storage': 'sum',
            'users_active': 'sum'
        }).reset_index()
        
        return jsonify(distribution.to_dict('records'))
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===== TAB 4: RESOURCE TYPES =====

@app.route('/api/resources/utilization')
def get_resource_utilization():
    """Get resource utilization over time"""
    try:
        resource_util = df.groupby(['date', 'resource_type']).agg({
            'usage_cpu': 'mean',
            'usage_storage': 'mean',
            'users_active': 'mean'
        }).reset_index()
        
        resource_util['date'] = resource_util['date'].dt.strftime('%Y-%m-%d')
        
        return jsonify(resource_util.to_dict('records'))
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/resources/distribution')
def get_resource_distribution():
    """Get resource type distribution"""
    try:
        distribution = df.groupby('resource_type').agg({
            'usage_cpu': ['mean', 'sum'],
            'usage_storage': ['mean', 'sum'],
            'users_active': ['mean', 'sum']
        }).reset_index()
        
        # Flatten column names
        distribution.columns = ['_'.join(col).strip() if col[1] else col[0] for col in distribution.columns]
        
        return jsonify(distribution.to_dict('records'))
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/resources/efficiency')
def get_resource_efficiency():
    """Get resource efficiency metrics"""
    try:
        efficiency = df.groupby('resource_type').agg({
            'usage_cpu': 'mean',
            'usage_storage': 'mean',
            'users_active': 'mean'
        }).reset_index()
        
        # Calculate efficiency ratios
        efficiency['cpu_per_user'] = efficiency['usage_cpu'] / efficiency['users_active']
        efficiency['storage_per_user'] = efficiency['usage_storage'] / efficiency['users_active']
        
        return jsonify(efficiency.to_dict('records'))
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===== TAB 5: CORRELATION ANALYSIS =====

@app.route('/api/correlations/matrix')
def get_correlation_matrix():
    """Get correlation matrix for numeric columns"""
    try:
        numeric_cols = ['usage_cpu', 'usage_storage', 'users_active', 'economic_index', 'cloud_market_demand']
        corr_matrix = df[numeric_cols].corr()
        
        # Convert to format suitable for heatmap
        correlation_data = []
        for i, row_name in enumerate(corr_matrix.index):
            for j, col_name in enumerate(corr_matrix.columns):
                correlation_data.append({
                    'row': row_name,
                    'column': col_name,
                    'correlation': float(corr_matrix.iloc[i, j])
                })
        
        return jsonify(correlation_data)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/correlations/scatter')
def get_scatter_data():
    """Get data for scatter plots"""
    try:
        x_axis = request.args.get('x_axis', 'economic_index')
        y_axis = request.args.get('y_axis', 'usage_cpu')
        
        scatter_data = df.groupby('region').apply(
            lambda x: pd.Series({
                'region': x['region'].iloc[0],
                f'{x_axis}_avg': x[x_axis].mean(),
                f'{y_axis}_avg': x[y_axis].mean(),
                'data_points': len(x)
            })
        ).reset_index(drop=True)
        
        return jsonify(scatter_data.to_dict('records'))
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/correlations/bubble')
def get_bubble_data():
    """Get multi-dimensional bubble chart data"""
    try:
        bubble_data = df.groupby(['region', 'resource_type']).agg({
            'economic_index': 'mean',
            'cloud_market_demand': 'mean',
            'usage_cpu': 'mean',
            'usage_storage': 'mean',
            'users_active': 'mean'
        }).reset_index()
        
        return jsonify(bubble_data.to_dict('records'))
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===== TAB 6: HOLIDAY EFFECTS =====

@app.route('/api/holiday/analysis')
def get_holiday_analysis():
    """Get holiday vs regular day analysis"""
    try:
        holiday_comparison = df.groupby('holiday').agg({
            'usage_cpu': ['mean', 'std', 'count'],
            'usage_storage': ['mean', 'std', 'count'],
            'users_active': ['mean', 'std', 'count']
        }).reset_index()
        
        # Flatten column names
        holiday_comparison.columns = ['_'.join(col).strip() if col[1] else col[0] for col in holiday_comparison.columns]
        
        return jsonify(holiday_comparison.to_dict('records'))
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/holiday/distribution')
def get_holiday_distribution():
    """Get detailed distribution data for holiday analysis"""
    try:
        # Get raw data for box plots and violin plots
        holiday_data = df[df['holiday'] == 1][['usage_cpu', 'usage_storage', 'users_active']].to_dict('records')
        regular_data = df[df['holiday'] == 0][['usage_cpu', 'usage_storage', 'users_active']].to_dict('records')
        
        return jsonify({
            'holiday_data': holiday_data,
            'regular_data': regular_data
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/holiday/calendar')
def get_calendar_data():
    """Get calendar heatmap data"""
    try:
        df_calendar = df.copy()
        df_calendar['day'] = df_calendar['date'].dt.day
        df_calendar['month'] = df_calendar['date'].dt.month
        df_calendar['month_name'] = df_calendar['date'].dt.strftime('%B')
        
        calendar_data = df_calendar.groupby(['month', 'month_name', 'day']).agg({
            'usage_cpu': 'mean',
            'holiday': 'max'  # 1 if any holiday, 0 otherwise
        }).reset_index()
        
        return jsonify(calendar_data.to_dict('records'))
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===== TAB 7: ML FORECASTING (PLACEHOLDER) =====

@app.route('/api/forecast/placeholder')
def get_forecast_placeholder():
    """Placeholder for ML forecasting - returns mock structure"""
    try:
        # Return structure that will be used when ML models are implemented
        placeholder_data = {
            'message': 'ML forecasting models not yet implemented',
            'available_models': ['ARIMA', 'XGBoost', 'LSTM'],
            'expected_endpoints': [
                '/api/forecast/arima',
                '/api/forecast/xgboost', 
                '/api/forecast/lstm',
                '/api/forecast/comparison',
                '/api/forecast/accuracy'
            ],
            'forecast_horizon': '30 days',
            'confidence_intervals': [0.8, 0.95]
        }
        
        return jsonify(placeholder_data)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===== TAB 8: USER ENGAGEMENT =====

@app.route('/api/engagement/efficiency')
def get_engagement_efficiency():
    """Get user engagement efficiency metrics"""
    try:
        engagement = df.groupby(['region', 'resource_type']).agg({
            'users_active': 'mean',
            'usage_cpu': 'mean',
            'usage_storage': 'mean'
        }).reset_index()
        
        # Calculate efficiency scores
        engagement['cpu_efficiency'] = engagement['users_active'] / engagement['usage_cpu']
        engagement['storage_efficiency'] = engagement['users_active'] / (engagement['usage_storage'] / 100)  # Normalize storage
        engagement['overall_efficiency'] = (engagement['cpu_efficiency'] + engagement['storage_efficiency']) / 2
        
        return jsonify(engagement.to_dict('records'))
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/engagement/trends')
def get_engagement_trends():
    """Get user engagement trends over time"""
    try:
        engagement_trends = df.groupby('date').agg({
            'users_active': 'mean',
            'usage_cpu': 'mean',
            'usage_storage': 'mean'
        }).reset_index()
        
        # Calculate daily efficiency ratios
        engagement_trends['cpu_per_user'] = engagement_trends['usage_cpu'] / engagement_trends['users_active']
        engagement_trends['storage_per_user'] = engagement_trends['usage_storage'] / engagement_trends['users_active']
        
        engagement_trends['date'] = engagement_trends['date'].dt.strftime('%Y-%m-%d')
        
        return jsonify(engagement_trends.to_dict('records'))
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/engagement/bubble')
def get_engagement_bubble():
    """Get bubble chart data for user engagement analysis"""
    try:
        bubble_data = df.groupby(['region', 'resource_type']).agg({
            'users_active': 'mean',
            'usage_cpu': 'mean',
            'usage_storage': 'mean'
        }).reset_index()
        
        return jsonify(bubble_data.to_dict('records'))
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===== UTILITY ENDPOINTS =====

@app.route('/api/filters/options')
def get_filter_options():
    """Get available filter options for dropdowns"""
    try:
        options = {
            'regions': sorted(df['region'].unique().tolist()),
            'resource_types': sorted(df['resource_type'].unique().tolist()),
            'date_range': {
                'min_date': df['date'].min().isoformat(),
                'max_date': df['date'].max().isoformat()
            },
            'metrics': ['usage_cpu', 'usage_storage', 'users_active', 'economic_index', 'cloud_market_demand']
        }
        
        return jsonify(options)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/data/summary')
def get_data_summary():
    """Get dataset summary statistics"""
    try:
        numeric_cols = ['usage_cpu', 'usage_storage', 'users_active', 'economic_index', 'cloud_market_demand']
        summary = df[numeric_cols].describe().to_dict()
        
        # Add data info
        summary['dataset_info'] = {
            'total_records': len(df),
            'date_range_days': (df['date'].max() - df['date'].min()).days,
            'regions_count': df['region'].nunique(),
            'resource_types_count': df['resource_type'].nunique(),
            'holiday_records': int(df['holiday'].sum()),
            'regular_records': int(len(df) - df['holiday'].sum())
        }
        
        return jsonify(summary)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===== ERROR HANDLERS =====

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Endpoint not found', 'available_endpoints': [
        '/api/kpis', '/api/sparklines', '/api/time-series', '/api/trends/regional',
        '/api/regional/comparison', '/api/resources/utilization', '/api/correlations/matrix',
        '/api/holiday/analysis', '/api/engagement/efficiency', '/api/filters/options'
    ]}), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/data/rows')
def get_data_rows():
    """Return paginated/filterable raw rows for table views"""
    try:
        region = request.args.get('region')
        resource_type = request.args.get('resource_type')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 100))

        data = df.copy()
        if region:
            data = data[data['region'] == region]
        if resource_type:
            data = data[data['resource_type'] == resource_type]
        if start_date:
            data = data[data['date'] >= pd.to_datetime(start_date)]
        if end_date:
            data = data[data['date'] <= pd.to_datetime(end_date)]

        data = data.sort_values('date')
        total = len(data)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        page_df = data.iloc[start_idx:end_idx]

        page_df = page_df.copy()
        page_df['date'] = page_df['date'].dt.strftime('%Y-%m-%d')

        return jsonify({
            'total': int(total),
            'page': page,
            'page_size': page_size,
            'rows': page_df.to_dict('records')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/data/raw/usage')
def get_raw_usage():
    """Return the raw azure_usage CSV contents (proxied)"""
    try:
        usage = pd.read_csv('data/raw/azure_usage.csv')
        return jsonify(usage.to_dict('records'))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/data/raw/external')
def get_raw_external():
    """Return the raw external_factors CSV contents (proxied)"""
    try:
        external = pd.read_csv('data/raw/external_factors.csv')
        return jsonify(external.to_dict('records'))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/data/download')
def download_processed():
    """Return processed dataset as JSON (simple download placeholder)"""
    try:
        data = df.copy()
        data = data.sort_values('date')
        data['date'] = data['date'].dt.strftime('%Y-%m-%d')
        return jsonify(data.to_dict('records'))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/health')
def health_check():
    """Simple health check endpoint"""
    return jsonify({'status': 'ok', 'message': 'Backend is running'})

@app.route('/api/model-comparison')
def model_comparison():
    """Model comparison endpoint with comprehensive metrics"""
    try:
        comparison = {
            'models': [
                {
                    'name': 'ARIMA', 
                    'rmse': 12.3, 
                    'mae': 9.8, 
                    'mape': 8.5, 
                    'bias': 0.2,
                    'training_time_s': 45.2,
                    'inference_ms_per_sample': 2.1
                },
                {
                    'name': 'XGBoost', 
                    'rmse': 10.7, 
                    'mae': 8.9, 
                    'mape': 7.2, 
                    'bias': -0.1,
                    'training_time_s': 120.5,
                    'inference_ms_per_sample': 0.8
                },
                {
                    'name': 'LSTM', 
                    'rmse': 11.5, 
                    'mae': 9.2, 
                    'mape': 7.8, 
                    'bias': 0.3,
                    'training_time_s': 300.8,
                    'inference_ms_per_sample': 5.2
                },
            ],
            'best_model': 'XGBoost'
        }
        print(f"Returning model comparison data: {comparison}")  # Debug log
        return jsonify(comparison)
    except Exception as e:
        print(f"Error in model comparison: {e}")  # Debug log
        return jsonify({'error': str(e)}), 500


def _compute_simple_ci(series: pd.Series, z: float = 1.96):
    # Use recent window std as uncertainty proxy
    recent = series.dropna().astype(float).tail(30)
    if len(recent) < 2:
        sigma = float(series.dropna().astype(float).std() or 0.0)
    else:
        sigma = float(recent.std())
    return sigma * z

@app.route('/api/forecast/arima')
def forecast_arima():
    """Naive ARIMA-like endpoint with constant mean and 95% CI using recent std."""
    try:
        horizon = int(request.args.get('horizon', 30))
        region = request.args.get('region')
        resource_type = request.args.get('resource_type')
        metric = request.args.get('metric', 'usage_cpu')

        data = df.copy()
        if region:
            data = data[data['region'] == region]
        if resource_type:
            data = data[data['resource_type'] == resource_type]

        data = data.sort_values('date')
        last_date = data['date'].max()
        base_series = data[metric] if metric in data.columns else data['usage_cpu']
        last_value = float(base_series.iloc[-1])
        ci = _compute_simple_ci(base_series)

        forecast = []
        for i in range(1, horizon + 1):
            next_date = (last_date + timedelta(days=i)).strftime('%Y-%m-%d')
            yhat = last_value
            forecast.append({
                'date': next_date,
                'forecast': float(yhat),
                'lower_95': float(max(0.0, yhat - ci)),
                'upper_95': float(yhat + ci)
            })

        print(f"ARIMA forecast for {region}/{resource_type}/{metric}: {len(forecast)} points")
        return jsonify({'model': 'ARIMA', 'region': region, 'resource_type': resource_type, 'points': forecast})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/forecast/<region>/<resource_type>')
def forecast_xgboost_like(region, resource_type):
    """Placeholder XGBoost-like forecast endpoint using moving average."""
    try:
        horizon = int(request.args.get('horizon', 30))
        metric = request.args.get('metric', 'usage_cpu')

        data = df[(df['region'] == region) & (df['resource_type'] == resource_type)].copy()
        data = data.sort_values('date')
        base_series = data[metric] if metric in data.columns else data['usage_cpu']
        rolling = base_series.rolling(window=7, min_periods=1).mean().iloc[-1]
        
        last_date = data['date'].max()
        forecast = []
        for i in range(1, horizon + 1):
            next_date = (last_date + timedelta(days=i)).strftime('%Y-%m-%d')
            forecast.append({'date': next_date, 'forecast': float(rolling)})
        
        print(f"XGBoost forecast for {region}/{resource_type}/{metric}: {len(forecast)} points")
        return jsonify({'model': 'XGBoost', 'region': region, 'resource_type': resource_type, 'points': forecast})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Capacity planning: recommend capacity given forecast and safety factor
@app.route('/api/capacity/recommendation')
def capacity_recommendation():
    try:
        horizon = int(request.args.get('horizon', 30))
        region = request.args.get('region')
        resource_type = request.args.get('resource_type')
        metric = request.args.get('metric', 'usage_cpu')
        safety_factor = float(request.args.get('safety_factor', 1.2))

        data = df.copy()
        if region:
            data = data[data['region'] == region]
        if resource_type:
            data = data[data['resource_type'] == resource_type]
        data = data.sort_values('date')

        base_series = data[metric] if metric in data.columns else data['usage_cpu']
        # simple baseline: recent 7d mean
        baseline = float(base_series.tail(7).mean()) if len(base_series) > 0 else 0.0
        # daily constant plan from baseline; return array and peak
        recommendation = []
        last_date = data['date'].max()
        for i in range(1, horizon + 1):
            next_date = (last_date + timedelta(days=i)).strftime('%Y-%m-%d')
            rec = baseline * safety_factor
            recommendation.append({'date': next_date, 'recommended_capacity': float(rec)})

        peak = max([r['recommended_capacity'] for r in recommendation], default=0.0)
        return jsonify({
            'metric': metric,
            'region': region,
            'resource_type': resource_type,
            'safety_factor': safety_factor,
            'peak_recommended': float(peak),
            'points': recommendation
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Basic metrics endpoint
@app.route('/api/metrics')
def get_metrics():
    try:
        # include current process time for quick liveness detail
        return jsonify(request_metrics)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Daily report combining KPIs and short-term forecast
@app.route('/api/report/daily')
def daily_report():
    try:
        region = request.args.get('region')
        resource_type = request.args.get('resource_type')
        metric = request.args.get('metric', 'usage_cpu')
        horizon = int(request.args.get('horizon', 7))

        data = df.copy()
        if region:
            data = data[data['region'] == region]
        if resource_type:
            data = data[data['resource_type'] == resource_type]
        data = data.sort_values('date')

        base_series = data[metric] if metric in data.columns else data['usage_cpu']
        last_value = float(base_series.iloc[-1])
        ci = _compute_simple_ci(base_series)

        last_date = data['date'].max()
        fc_points = []
        for i in range(1, horizon + 1):
            next_date = (last_date + timedelta(days=i)).strftime('%Y-%m-%d')
            fc_points.append({
                'date': next_date,
                'forecast': last_value,
                'lower_95': float(max(0.0, last_value - ci)),
                'upper_95': float(last_value + ci)
            })

        kpis = {
            'current_value': last_value,
            'mean_30d': float(base_series.tail(30).mean()),
            'std_30d': float(base_series.tail(30).std() or 0.0),
        }

        return jsonify({
            'region': region,
            'resource_type': resource_type,
            'metric': metric,
            'kpis': kpis,
            'forecast': fc_points
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== Model serving (Milestone 4) =====
_MODEL_CACHE = {
    'loaded': False,
    'model': None,
    'feature_names': None,
    'features_df': None,
}
LAST_RETRAIN_TS = None

def _load_final_model_if_needed():
    if _MODEL_CACHE['loaded']:
        return
    # Try common locations
    candidate_paths = [
        os.path.join('notebooks', 'models', 'xgb_model_final_featured.pkl'),
        os.path.join('backend', 'notebooks', 'models', 'xgb_model_final_featured.pkl'),
        'xgb_model_final_featured.pkl'
    ]
    model_path = next((p for p in candidate_paths if os.path.exists(p)), None)
    if not model_path:
        _MODEL_CACHE['loaded'] = True
        _MODEL_CACHE['model'] = None
        return
    with open(model_path, 'rb') as f:
        model = pickle.load(f)
    _MODEL_CACHE['model'] = model
    # Resolve feature names
    feat_names = None
    if hasattr(model, 'feature_names_in_'):
        try:
            feat_names = list(model.feature_names_in_)
        except Exception:
            feat_names = None
    if feat_names is None and hasattr(model, 'get_booster'):
        try:
            booster = model.get_booster()
            feat_names = booster.feature_names
        except Exception:
            feat_names = None
    _MODEL_CACHE['feature_names'] = feat_names
    # Load featured dataset for inference
    feature_csv_paths = [
        os.path.join('data', 'processed', 'final_featured_dataset.csv'),
        os.path.join('backend', 'data', 'processed', 'final_featured_dataset.csv')
    ]
    feats_path = next((p for p in feature_csv_paths if os.path.exists(p)), None)
    if feats_path:
        _MODEL_CACHE['features_df'] = pd.read_csv(feats_path, parse_dates=['date'])
    else:
        _MODEL_CACHE['features_df'] = None
    _MODEL_CACHE['loaded'] = True


def _build_feature_row_for(region: str, resource_type: str, metric: str):
    features_df = _MODEL_CACHE['features_df']
    if features_df is None or len(features_df) == 0:
        return None, 'Featured dataset not found'

    df_feat = features_df.copy()
    # Handle one-hot columns based on dataset example
    # Region columns (example): region_North Europe, region_Southeast Asia, region_West US
    region_cols = [c for c in df_feat.columns if c.startswith('region_')]
    resource_cols = [c for c in df_feat.columns if c.startswith('resource_type_')]

    # Attempt to filter by flags if present
    region_flag = f'region_{region}' if f'region_{region}' in df_feat.columns else None
    resource_flag = f'resource_type_{resource_type}' if f'resource_type_{resource_type}' in df_feat.columns else None
    if region_flag is not None:
        df_feat = df_feat[df_feat[region_flag] == True]
    if resource_flag is not None:
        df_feat = df_feat[df_feat[resource_flag] == True]

    if len(df_feat) == 0:
        # fallback: no filtering
        df_feat = features_df.copy()

    df_feat = df_feat.sort_values('date')
    last_row = df_feat.iloc[-1].to_dict()

    # Build a single-row DataFrame with model's expected features if available
    feat_names = _MODEL_CACHE['feature_names']
    row_df = pd.DataFrame([last_row])
    if feat_names:
        for fn in feat_names:
            if fn not in row_df.columns:
                row_df[fn] = 0
        row_df = row_df[feat_names]
    else:
        # Heuristic: drop the target if present
        target_candidates = [metric, 'usage_cpu', 'usage_storage', 'users_active']
        for t in target_candidates:
            if t in row_df.columns:
                row_df = row_df.drop(columns=[t])
        # Keep only numeric
        row_df = row_df.select_dtypes(include=['number', 'bool']).astype(float)
    return row_df, None


@app.route('/api/forecast', methods=['POST'])
def get_forecast_post():
    try:
        payload = request.get_json(silent=True) or {}
        region = payload.get('region') or request.args.get('region')
        resource_type = payload.get('service') or payload.get('resource_type') or request.args.get('resource_type')
        horizon = int(payload.get('horizon') or request.args.get('horizon') or 30)
        metric = payload.get('metric') or request.args.get('metric') or 'usage_cpu'

        if not region or not resource_type:
            return jsonify({'error': 'region and resource_type/service are required'}), 400

        _load_final_model_if_needed()
        model = _MODEL_CACHE['model']
        if model is None:
            return jsonify({'error': 'Final model file not found on server'}), 501

        X_row, err = _build_feature_row_for(region, resource_type, metric)
        if err:
            return jsonify({'error': err}), 500

        # Predict once and repeat as naive horizon expansion
        try:
            yhat = float(model.predict(X_row)[0])
        except Exception as e:
            return jsonify({'error': f'Model prediction failed: {e}'}), 500

        # Base date from the core df used by the API for continuity
        data = df.copy()
        data = data.sort_values('date')
        last_date = data['date'].max()
        points = []
        for i in range(1, horizon + 1):
            next_date = (last_date + timedelta(days=i)).strftime('%Y-%m-%d')
            points.append({'date': next_date, 'forecast': yhat})

        return jsonify({
            'model': 'final_xgb',
            'region': region,
            'resource_type': resource_type,
            'metric': metric,
            'points': points
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== Capacity Assessment (KPIs + Recommendations) =====
@app.route('/api/capacity/assessment')
def capacity_assessment():
    try:
        region = request.args.get('region')
        resource_type = request.args.get('resource_type') or request.args.get('service')
        metric = request.args.get('metric', 'usage_cpu')
        horizon = int(request.args.get('horizon', 30))
        safety_factor = float(request.args.get('safety_factor', 1.0))
        available_capacity = request.args.get('available_capacity')
        if available_capacity is None:
            return jsonify({'error': 'available_capacity is required (numeric)'}), 400
        try:
            available_capacity = float(available_capacity)
        except Exception:
            return jsonify({'error': 'available_capacity must be numeric'}), 400

        data = df.copy()
        if region:
            data = data[data['region'] == region]
        if resource_type:
            data = data[data['resource_type'] == resource_type]
        data = data.sort_values('date')
        if len(data) == 0:
            return jsonify({'error': 'No data for selected filters'}), 404

        base_series = data[metric] if metric in data.columns else data['usage_cpu']
        # Baseline forecast: recent 7d mean
        baseline = float(base_series.tail(7).mean())
        ci = _compute_simple_ci(base_series)
        last_date = data['date'].max()

        points = []
        for i in range(1, horizon + 1):
            next_date = (last_date + timedelta(days=i)).strftime('%Y-%m-%d')
            yhat = baseline * safety_factor
            points.append({
                'date': next_date,
                'forecast': float(yhat),
                'upper_95': float(yhat + ci),
                'lower_95': float(max(0.0, yhat - ci))
            })

        forecast_values = [p['forecast'] for p in points]
        upper_values = [p['upper_95'] for p in points]
        forecast_peak = float(max(forecast_values) if forecast_values else 0.0)
        forecast_avg = float(sum(forecast_values) / len(forecast_values) if forecast_values else 0.0)
        forecast_peak_upper = float(max(upper_values) if upper_values else forecast_peak)

        # KPIs
        utilization_ratio = forecast_avg / available_capacity if available_capacity > 0 else None
        risk = 'under_provision' if available_capacity < forecast_peak_upper else 'balanced'
        if available_capacity > forecast_peak_upper * 1.2:
            risk = 'over_provision'

        # Recommendation: target capacity = peak upper (risk-aware)
        target_capacity = forecast_peak_upper
        adjustment_units = target_capacity - available_capacity
        adjustment_percent = (adjustment_units / available_capacity) * 100.0 if available_capacity else 0.0
        recommended_adjustment = ("+" if adjustment_units >= 0 else "") + f"{round(adjustment_units, 2)} units"

        # Friendly service label when possible
        service_label = resource_type
        if resource_type == 'VM':
            service_label = 'Compute'

        return jsonify({
            'region': region,
            'resource_type': resource_type,
            'service': service_label,
            'metric': metric,
            'horizon': horizon,
            'available_capacity': float(available_capacity),
            'forecast_demand_avg': forecast_avg,
            'forecast_demand_peak': forecast_peak,
            'forecast_demand_peak_upper_95': forecast_peak_upper,
            'utilization_ratio': float(utilization_ratio) if utilization_ratio is not None else None,
            'risk': risk,
            'recommended_adjustment': recommended_adjustment,
            'recommended_adjustment_units': float(round(adjustment_units, 2)),
            'recommended_adjustment_percent': float(round(adjustment_percent, 2)),
            'points': points
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/capacity-planning')
def capacity_planning_alias():
    # Backward/compat alias to assessment endpoint
    return capacity_assessment()


if __name__ == '__main__':
    print("Azure Demand Forecasting API Server Starting...", flush=True)
    print("Available Endpoints:", flush=True)
    print("   - (Overview): /api/kpis, /api/sparklines", flush=True)
    print("   - (Trends): /api/time-series, /api/trends/*", flush=True)
    print("   - (Regional): /api/regional/*", flush=True)
    print("   - (Resources): /api/resources/*", flush=True)
    print("   - (Correlations): /api/correlations/*", flush=True)
    print("   - (Holidays): /api/holiday/*", flush=True)
    print("   - (Forecasting): /api/forecast/*", flush=True)
    print("   - (Engagement): /api/engagement/*", flush=True)
    print("   - Utilities: /api/filters/options, /api/data/summary, /api/data/*", flush=True)
    print("Starting server on http://0.0.0.0:5000", flush=True)
    
    app.run(debug=True, host='0.0.0.0', port=5000)