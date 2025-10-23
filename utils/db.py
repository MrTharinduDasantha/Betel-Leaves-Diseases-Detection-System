import os
from dotenv import load_dotenv
from pymongo import MongoClient

# Load environment variables from .env file
load_dotenv()

# MongoDB connection string retrieved from environment variables
connection_string = os.getenv("MONGO_CONNECTION_STRING")

# Check if connection string is available
if not connection_string:
    # Raise an error if the connection string isn't found, preventing silent failure
    raise ValueError("MONGO_CONNECTION_STRING not found in environment variables. Please check your .env file.")

# Create a MongoDB client
client = MongoClient(connection_string)

# Access the database
db = client['betel_leaf_db']

# Define collections
users_collection = db['users']
testimonials_collection = db['testimonials']
posts_collection = db['posts']
solutions_collection = db['solutions']
messages_collection = db['messages']
cultivation_guides_collection = db['cultivation_guides']
notifications_collection = db['notifications']

# Test the connection
try:
    client.admin.command('ping')
    print("MongoDB connection successful!")
except Exception as e:
    print(f"Connection error: {e}")