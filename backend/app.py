# backend/app.py

from flask import Flask, jsonify
from flask_cors import CORS
# *** CRITICAL: Import the blueprint from the routes file (must be in same folder) ***
from routes import api_routes 

app = Flask(__name__)
CORS(app)

# Register the blueprint under the '/api' prefix
app.register_blueprint(api_routes, url_prefix='/api')

@app.route('/', methods=['GET'])
def home():
    # Simple check to confirm the server is alive
    return jsonify({"message": "✅ Backend is running! Access the APIs via /api/<endpoint>"})

if __name__ == '__main__':
    # Flask will automatically handle routes defined in api_routes now
    app.run(debug=True, port=5000)

