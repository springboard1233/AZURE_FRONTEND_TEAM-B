from flask import Flask, jsonify
from flask_cors import CORS
import pandas as pd

app = Flask(__name__)
CORS(app)

print("Starting simple backend...", flush=True)

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'message': 'Backend is running'})

@app.route('/api/test')
def test():
    try:
        df = pd.read_csv('data/processed/cleaned_merged.csv', parse_dates=['date'])
        return jsonify({
            'status': 'ok', 
            'rows': len(df),
            'columns': list(df.columns),
            'sample': df.head().to_dict('records')
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

if __name__ == '__main__':
    print("Starting Flask server...", flush=True)
    app.run(debug=True, host='0.0.0.0', port=5000)
