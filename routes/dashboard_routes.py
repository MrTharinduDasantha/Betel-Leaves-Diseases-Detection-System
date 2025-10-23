from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify
from bson.objectid import ObjectId
from utils.db import users_collection, testimonials_collection
import datetime

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    user = users_collection.find_one({'_id': ObjectId(session['user_id'])})
    return render_template('dashboard.html', user=user)

@dashboard_bp.route('/get-testimonials')
def get_testimonials():
    testimonials = list(testimonials_collection.find())
    
    # Convert ObjectId to string for JSON serialization
    for testimonial in testimonials:
        testimonial['_id'] = str(testimonial['_id'])
    
    return jsonify(testimonials)

@dashboard_bp.route('/add-testimonial', methods=['POST'])
def add_testimonial():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'You must be logged in to add a testimonial'})
    
    data = request.json
    user_id = session['user_id']
    user = users_collection.find_one({'_id': ObjectId(user_id)})
    
    if not user:
        return jsonify({'success': False, 'message': 'User not found'})
    
    # Validate input
    if 'rating' not in data or 'message' not in data:
        return jsonify({'success': False, 'message': 'Rating and message are required'})
    
    rating = int(data['rating'])
    message = data['message'].strip()
    
    if rating < 1 or rating > 5:
        return jsonify({'success': False, 'message': 'Rating must be between 1 and 5'})
    
    if not message:
        return jsonify({'success': False, 'message': 'Message cannot be empty'})
    
    # Create testimonial
    testimonial = {
        'user_id': user_id,
        'user_name': user['name'],
        'profile_pic': user['profile_pic'],
        'rating': rating,
        'message': message,
        'created_at': datetime.datetime.now()
    }
    
    # Insert into database
    result = testimonials_collection.insert_one(testimonial)
    
    if result.inserted_id:
        return jsonify({'success': True, 'message': 'Testimonial added successfully'})
    else:
        return jsonify({'success': False, 'message': 'Failed to add testimonial'})

@dashboard_bp.route('/update-testimonial', methods=['POST'])
def update_testimonial():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'You must be logged in to update a testimonial'})
    
    data = request.json
    user_id = session['user_id']
    
    # Validate input
    if 'id' not in data or 'rating' not in data or 'message' not in data:
        return jsonify({'success': False, 'message': 'Testimonial ID, rating, and message are required'})
    
    testimonial_id = data['id']
    rating = int(data['rating'])
    message = data['message'].strip()
    
    if rating < 1 or rating > 5:
        return jsonify({'success': False, 'message': 'Rating must be between 1 and 5'})
    
    if not message:
        return jsonify({'success': False, 'message': 'Message cannot be empty'})
    
    # Find the testimonial
    testimonial = testimonials_collection.find_one({'_id': ObjectId(testimonial_id)})
    
    if not testimonial:
        return jsonify({'success': False, 'message': 'Testimonial not found'})
    
    # Check if the user owns this testimonial
    if testimonial['user_id'] != user_id:
        return jsonify({'success': False, 'message': 'You do not have permission to edit this testimonial'})
    
    # Update testimonial
    result = testimonials_collection.update_one(
        {'_id': ObjectId(testimonial_id)},
        {'$set': {
            'rating': rating,
            'message': message,
            'updated_at': datetime.datetime.now()
        }}
    )
    
    if result.modified_count > 0:
        return jsonify({'success': True, 'message': 'Testimonial updated successfully'})
    else:
        return jsonify({'success': False, 'message': 'Failed to update testimonial'})

@dashboard_bp.route('/delete-testimonial', methods=['POST'])
def delete_testimonial():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'You must be logged in to delete a testimonial'})
    
    data = request.json
    user_id = session['user_id']
    
    if 'id' not in data:
        return jsonify({'success': False, 'message': 'Testimonial ID is required'})
    
    testimonial_id = data['id']
    
    # Find the testimonial
    testimonial = testimonials_collection.find_one({'_id': ObjectId(testimonial_id)})
    
    if not testimonial:
        return jsonify({'success': False, 'message': 'Testimonial not found'})
    
    # Check if the user owns this testimonial
    if testimonial['user_id'] != user_id:
        return jsonify({'success': False, 'message': 'You do not have permission to delete this testimonial'})
    
    # Delete testimonial
    result = testimonials_collection.delete_one({'_id': ObjectId(testimonial_id)})
    
    if result.deleted_count > 0:
        return jsonify({'success': True, 'message': 'Testimonial deleted successfully'})
    else:
        return jsonify({'success': False, 'message': 'Failed to delete testimonial'})