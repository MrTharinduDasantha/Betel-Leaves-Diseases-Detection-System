from flask import Flask, send_from_directory, redirect, url_for
from routes import register_blueprints
from datetime import datetime
from flask_socketio import SocketIO

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'

# Initialize Socket.IO with increased message size limit
socketio = SocketIO(app, cors_allowed_origins="*", max_http_buffer_size=16*1024*1024)

# Register Blueprints
register_blueprints(app)

# Define a route for the root URL
@app.route('/')
def home():
    return redirect(url_for('auth.login'))

# Serve files from the 'uploads' directory
@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory('uploads', filename)

# Serve files from the 'uploads/profile_pics' directory
@app.route('/uploads/profile_pics/<path:filename>')
def profile_pics(filename):
    return send_from_directory('uploads/profile_pics', filename)

# Inject current year into templates
@app.context_processor
def inject_year():
    return {'current_year': lambda: datetime.now().year}

# Run the app
if __name__ == '__main__':
    socketio.run(app, debug=True)