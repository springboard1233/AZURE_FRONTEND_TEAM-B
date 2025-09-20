from flask import Flask, jsonify
from flask_cors import CORS
import pandas as pd

app = Flask(__name__)
CORS(app)  # Allow frontend to fetch data

@app.route("/api/data")
def get_data():
    try:
        df = pd.read_csv("C:/Users/Vijay/OneDrive/Desktop/infosys(project)/milestone2_feature_engineered.csv")
        
        # Remove duplicate columns if any
        df = df.loc[:, ~df.columns.duplicated()]
        
        # Convert to list of dictionaries
        data = df.to_dict(orient="records")
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route("/")
def home():
    return "Backend is running 🚀"

if __name__ == "__main__":
    app.run(debug=True)


