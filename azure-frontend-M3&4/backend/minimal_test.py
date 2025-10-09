import pandas as pd
import sys

print("Starting minimal test...", flush=True)

try:
    df = pd.read_csv('data/processed/cleaned_merged.csv', parse_dates=['date'])
    print(f"Data loaded: {len(df)} rows", flush=True)
    print("Test completed successfully!", flush=True)
except Exception as e:
    print(f"Error: {e}", flush=True)
    sys.exit(1)
