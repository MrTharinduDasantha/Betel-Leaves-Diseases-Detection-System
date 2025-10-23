from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify
from utils.auth import hash_password, verify_password
from utils.db import users_collection, testimonials_collection
from bson.objectid import ObjectId
from utils import cloudinary_utils as cloud_utils

auth_bp = Blueprint('auth', __name__)

# Route for user login
@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        # Validate input fields
        if not email or not password:
            flash('All fields are required', 'error')
            return redirect(url_for('auth.login'))

        user = users_collection.find_one({'email': email})

        # Check if user exists and password is correct
        if not user:
            flash('Invalid email', 'error')
        elif not verify_password(user['password'], password):
            if user:
                flash('Invalid password', 'error')
            else:
                flash('Invalid email and password', 'error')
        else:
            session['user_id'] = str(user['_id'])
            session['role'] = user['role']
            session['profile_pic'] = user['profile_pic']
            
            flash('Login successful', 'success')
            return redirect(url_for('dashboard.dashboard'))

    return render_template('login.html')

# Route for user registration
@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        password = request.form.get('password')
        role = request.form.get('role')
        profile_pic = request.files.get('profile_pic')

        # Validate input fields
        if not name or not email or not password or not role or not profile_pic:
            flash('All fields are required', 'error')
            return redirect(url_for('auth.register'))

        # Check if email is already registered
        existing_user = users_collection.find_one({'email': email})
        if existing_user:
            if existing_user['role'] == 'admin':
                flash('Agricultural officer already registered', 'error')
            else:
                flash('Farmer already registered', 'error')
            return redirect(url_for('auth.register'))

        # Validate password length
        if len(password) < 8:
            flash('Password must be at least 8 characters long', 'error')
            return redirect(url_for('auth.register'))

        # Upload profile picture to Cloudinary
        try:
            upload_result = cloud_utils.upload_image(profile_pic, folder="betel/profile_pics")
            profile_pic_url = upload_result["secure_url"]
            profile_pic_public_id = upload_result["public_id"]
        except Exception as e:
            flash('Failed to upload profile picture. Please try again.', 'error')
            return redirect(url_for('auth.register'))

        # Create user data
        user_data = {
            'name': name,
            'email': email,
            'password': hash_password(password),
            'role': role,
            'profile_pic': profile_pic_url,
            'profile_pic_public_id': profile_pic_public_id  
        }

        # Insert user into the database
        users_collection.insert_one(user_data)

        # Update session with the new profile picture path
        session['profile_pic'] = profile_pic_url

        flash('Registration successful', 'success')
        return redirect(url_for('auth.login'))

    return render_template('register.html')

# Route to get user profile data
@auth_bp.route('/get-user-profile', methods=['GET'])
def get_user_profile():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not authenticated'}), 401

    user = users_collection.find_one({'_id': ObjectId(session['user_id'])})
    
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404

    return jsonify({
        'success': True,
        'name': user.get('name', ''),
        'email': user.get('email', ''),
        'password': user.get('password', ''),
        'profile_pic': user.get('profile_pic', '')
    })

# Route to update user profile data
@auth_bp.route('/update-user-profile', methods=['POST'])
def update_user_profile():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not authenticated'}), 401

    user_id = session['user_id']
    name = request.form.get('name')
    email = request.form.get('email')
    password = request.form.get('password')
    profile_pic = request.files.get('profile_pic')

    # Validate input (name and email are required, password is optional)
    if not name or not email:
        return jsonify({'success': False, 'message': 'Name and email are required'}), 400

    # Check if email is already used by another user
    existing_user = users_collection.find_one({
        'email': email,
        '_id': {'$ne': ObjectId(user_id)}
    })
    
    if existing_user:
        return jsonify({'success': False, 'message': 'Email already in use'}), 400

    # Prepare update data
    update_data = {
        'name': name,
        'email': email,
    }

    # Only update password if a new one is provided and not empty
    if password and password.strip():
        # Validate password length
        if len(password) < 8:
            return jsonify({'success': False, 'message': 'Password must be at least 8 characters long'}), 400
        update_data['password'] = hash_password(password)

    if profile_pic:
        try:
            # Upload new image
            upload_result = cloud_utils.upload_image(profile_pic, folder="betel/profile_pics")
            new_secure_url = upload_result["secure_url"]
            new_public_id = upload_result["public_id"]
            update_data['profile_pic'] = new_secure_url
            update_data['profile_pic_public_id'] = new_public_id

            # Delete previous image from Cloudinary if exists (clean up)
            user_doc = users_collection.find_one({'_id': ObjectId(user_id)})
            old_public_id = user_doc.get('profile_pic_public_id')
            if old_public_id:
                try:
                    cloud_utils.delete_image(old_public_id)
                except Exception:
                    # deletion errors are non-fatal — just continue
                    pass

        except Exception as e:
            return jsonify({'success': False, 'message': 'Failed to upload profile picture'}), 500

    # Update user in database
    users_collection.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': update_data}
    )

    # Update session
    session['profile_pic'] = update_data.get('profile_pic') or session.get('profile_pic')

    # Also update profile pics in testimonials made by the user
    if 'profile_pic' in update_data and update_data['profile_pic']:
        try:
            testimonials_collection.update_many(
                {'user_id': user_id},
                {'$set': {'profile_pic': update_data['profile_pic']}}
            )
        except Exception as e:
            print("Failed to update testimonials' profile pics:", e)

    return jsonify({
        'success': True,
        'message': 'Profile updated successfully',
        'profile_pic': update_data.get('profile_pic') or session.get('profile_pic')
    })

# Route for user logout
@auth_bp.route('/logout')
def logout():
    session.clear()
    flash('Logout successful', 'success')
    return redirect(url_for('auth.login'))