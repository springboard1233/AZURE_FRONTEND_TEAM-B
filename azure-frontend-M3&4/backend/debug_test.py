import sys
import traceback

# Redirect output to a file
with open('debug_output.txt', 'w') as f:
    sys.stdout = f
    sys.stderr = f
    
    try:
        print("Starting debug test...")
        
        import pandas as pd
        print("Pandas imported successfully")
        
        df = pd.read_csv('data/processed/cleaned_merged.csv', parse_dates=['date'])
        print(f"Data loaded: {len(df)} rows")
        print(f"Columns: {list(df.columns)}")
        
        from flask import Flask
        print("Flask imported successfully")
        
        from flask_cors import CORS
        print("Flask-CORS imported successfully")
        
        app = Flask(__name__)
        CORS(app)
        print("Flask app created successfully")
        
        print("All imports and data loading successful!")
        
    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()

# Restore stdout
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
print("Debug test completed. Check debug_output.txt for details.")
