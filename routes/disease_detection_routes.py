from flask import Blueprint, render_template, request, session, redirect, url_for, flash, jsonify
from tensorflow.keras.models import load_model # type: ignore
from tensorflow.keras.preprocessing.image import load_img, img_to_array # type: ignore
from bson.objectid import ObjectId
from utils.db import users_collection, solutions_collection
import numpy as np
import os
from datetime import datetime

# Blueprint for disease detection (for normal users and admin view)
disease_detection_bp = Blueprint('disease_detection', __name__)

# Load the model
MODEL_PATH = os.path.join('model', 'betel_leaf_model.keras')
model = load_model(MODEL_PATH)

# Define the disease categories (class labels)
class_labels = ['Bacterial Leaf Spot Disease', 'Dried Leaf', 'Fungal Brown Spot Disease', 'Healthy Leaf']

# Disease detection route
@disease_detection_bp.route('/disease-detection', methods=['GET', 'POST'])
def disease_detection():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))

    user = users_collection.find_one({'_id': ObjectId(session['user_id'])})
    prediction = None
    confidence = None
    solution = None

    if request.method == 'POST':
        file = request.files.get('file')
        if file and file.filename != '':
            filepath = os.path.join('uploads', file.filename)
            file.save(filepath)

            # Process the image and make a prediction
            img = load_img(filepath, target_size=(150, 150))
            img_array = img_to_array(img) / 255.0
            img_array = np.expand_dims(img_array, axis=0) 
            preds = model.predict(img_array)
            predicted_index = np.argmax(preds)
            prediction = class_labels[predicted_index]
            confidence = np.max(preds)

            # Fetch solution from the database for the predicted disease
            solution_data = solutions_collection.find_one({'disease': prediction})
            solution = solution_data['solution'] if solution_data else 'No solution available.'

            # Remove the uploaded file after prediction
            os.remove(filepath)
        else:
            flash('Please upload a betel leaf image', 'error')

    return render_template(
        'disease_detection.html',
        user=user,
        prediction=prediction,
        confidence=confidence,
        solution=solution,
        class_labels=class_labels
    )

# Admin: Update or add solution route
@disease_detection_bp.route('/admin/update-solution', methods=['POST'])
def update_solution():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))

    user = users_collection.find_one({'_id': ObjectId(session['user_id'])})
    if user.get('role') != 'admin':
        flash('You do not have permission to perform this action.', 'error')
        return redirect(url_for('disease_detection.disease_detection'))

    # Get selected disease from radio buttons and rich text solution
    disease = request.form.get('disease')
    solution_content = request.form.get('solution')

    if not disease or not solution_content:
        flash('Please select a category and enter a solution.', 'error')
        return redirect(url_for('disease_detection.disease_detection'))

    # Update or insert the solution while preserving rich text formatting
    solutions_collection.update_one(
        {'disease': disease},
        {'$set': {'solution': solution_content, 'last_updated': datetime.utcnow()}},
        upsert=True
    )

    flash('Solution updated successfully.', 'success')
    return redirect(url_for('disease_detection.disease_detection'))

# Admin: Get solution for a given disease (for editing)
@disease_detection_bp.route('/admin/get-solution/<disease>', methods=['GET'])
def get_solution(disease):
    # Only allow admin to fetch the solution for editing
    if 'user_id' not in session:
        return jsonify({'solution': ''})
    user = users_collection.find_one({'_id': ObjectId(session['user_id'])})
    
    if not user or user.get('role') != 'admin':
        return jsonify({'solution': ''})
    solution_data = solutions_collection.find_one({'disease': disease})
    
    return jsonify({'solution': solution_data['solution'] if solution_data else ''})