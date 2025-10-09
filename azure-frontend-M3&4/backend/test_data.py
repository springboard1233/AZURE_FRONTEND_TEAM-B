#!/usr/bin/env python3

import pandas as pd
import sys

print("Testing data loading...")

try:
    df = pd.read_csv('data/processed/cleaned_merged.csv', parse_dates=['date'])
    print(f"✅ Data loaded successfully: {len(df)} rows")
    print(f"✅ Columns: {list(df.columns)}")
    print(f"✅ Date range: {df['date'].min()} to {df['date'].max()}")
    print(f"✅ Sample data:")
    print(df.head())
except Exception as e:
    print(f"❌ Error loading data: {e}")
    sys.exit(1)

print("✅ Data loading test passed!")
