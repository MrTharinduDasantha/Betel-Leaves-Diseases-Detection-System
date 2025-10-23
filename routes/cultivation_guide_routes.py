from flask import Blueprint, render_template, request, session, redirect, url_for, jsonify
from bson.objectid import ObjectId
from utils.db import users_collection, cultivation_guides_collection
from datetime import datetime
from bs4 import BeautifulSoup
from utils import cloudinary_utils as cloud_utils

cultivation_guide_bp = Blueprint('cultivation_guide', __name__)

# Helpers for processing images inside guide HTML
def _upload_embedded_images_and_normalize(content_html):
    public_ids = []
    soup = BeautifulSoup(content_html or "", "html.parser")

    for img in soup.find_all("img"):
        src = img.get("src", "")
        public_id = img.get("data-public-id")  # may exist if frontend set it
        # If public_id already present, keep as-is (and ensure we add it to our list)
        if public_id:
            public_ids.append(public_id)
            continue

        # If src is empty skip
        if not src:
            continue

        try:
            # Data URI -> upload directly
            if src.startswith("data:image"):
                upload_result = cloud_utils.upload_image(src, folder="betel/cultivation_guides")
                secure_url = upload_result.get("secure_url")
                new_public_id = upload_result.get("public_id")
                if secure_url:
                    img['src'] = secure_url
                if new_public_id:
                    img['data-public-id'] = new_public_id
                    public_ids.append(new_public_id)

            # Local uploads path (legacy): e.g. "/uploads/..." or relative "uploads/..."
            elif src.startswith("/uploads") or src.startswith("uploads"):
                # We need to read file from disk and upload
                # Normalize file path to path on disk
                local_path = src.lstrip("/")
                try:
                    with open(local_path, "rb") as f:
                        upload_result = cloud_utils.upload_image(f, folder="betel/cultivation_guides")
                        secure_url = upload_result.get("secure_url")
                        new_public_id = upload_result.get("public_id")
                        if secure_url:
                            img['src'] = secure_url
                        if new_public_id:
                            img['data-public-id'] = new_public_id
                            public_ids.append(new_public_id)
                except Exception:
                    # if file not found or upload fails, leave src as-is
                    pass
            else:
                # If src is absolute http(s) but no public_id, we cannot manage deletion later.
                # We leave it as-is (assume already hosted).
                # Optionally, you could attempt to upload it again to Cloudinary.
                continue
        except Exception as e:
            # on any error, continue and leave src unchanged
            print("Error processing image in guide:", e)
            continue

    return str(soup), public_ids

# Route for cultivation guide
@cultivation_guide_bp.route('/cultivation-guide')
def cultivation_guide():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    
    user = users_collection.find_one({'_id': ObjectId(session['user_id'])})
    
    # Get all cultivation guides
    guides = list(cultivation_guides_collection.find().sort('created_at', -1))
    
    # Get admin names for each guide
    for guide in guides:
        guide['_id'] = str(guide['_id'])
        # Get admin name who created the guide
        if 'created_by' in guide:
            admin = users_collection.find_one({'_id': ObjectId(guide['created_by'])})
            if admin:
                guide['admin_name'] = admin.get('name', 'Unknown Admin')
            else:
                guide['admin_name'] = 'Unknown Admin'
        else:
            guide['admin_name'] = 'Unknown Admin'
        
        # Check if current user has reacted to this guide
        if 'reactions' in guide and str(user['_id']) in guide['reactions']:
            guide['user_reacted'] = True
        else:
            guide['user_reacted'] = False
        
        # Count total reactions
        guide['reaction_count'] = len(guide.get('reactions', []))
    
    return render_template('cultivation_guide.html', user=user, guides=guides)

# Route for listing cultivation guides
@cultivation_guide_bp.route('/cultivation-guide/list')
def list_guides():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    user_id = session['user_id']
    
    # Get all cultivation guides
    guides = list(cultivation_guides_collection.find().sort('created_at', -1))
    
    # Get admin names for each guide and check if current user can edit/delete
    for guide in guides:
        guide['_id'] = str(guide['_id'])
        
        # Check if current user is the creator of the guide
        guide['can_edit'] = guide.get('created_by') == user_id
        
        # Get admin name who created the guide
        if 'created_by' in guide:
            admin = users_collection.find_one({'_id': ObjectId(guide['created_by'])})
            if admin:
                guide['admin_name'] = admin.get('name', 'Unknown Admin')
            else:
                guide['admin_name'] = 'Unknown Admin'
        else:
            guide['admin_name'] = 'Unknown Admin'
        
        # Check if current user has reacted to this guide
        if 'reactions' in guide and user_id in guide['reactions']:
            guide['user_reacted'] = True
        else:
            guide['user_reacted'] = False
        
        # Count total reactions
        guide['reaction_count'] = len(guide.get('reactions', []))
    
    return jsonify({'success': True, 'guides': guides})

# Route for getting a specific cultivation guide
@cultivation_guide_bp.route('/cultivation-guide/get/<guide_id>')
def get_guide(guide_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    user = users_collection.find_one({'_id': ObjectId(session['user_id'])})
    
    # Only admin can access this endpoint
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    
    # Get the guide
    guide = cultivation_guides_collection.find_one({'_id': ObjectId(guide_id)})
    
    if not guide:
        return jsonify({'error': 'Guide not found'}), 404
    
    # Convert ObjectId to string for JSON serialization
    guide['_id'] = str(guide['_id'])
    
    # Check if current user is the creator of the guide
    guide['can_edit'] = guide.get('created_by') == session['user_id']
    
    return jsonify({'success': True, 'guide': guide})

# Route for saving a new cultivation guide
@cultivation_guide_bp.route('/cultivation-guide/save', methods=['POST'])
def save_guide():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    user = users_collection.find_one({'_id': ObjectId(session['user_id'])})
    
    # Only admin can save guides
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    
    title = request.form.get('title')
    content = request.form.get('content')
    
    if not title or not content:
        return jsonify({'success': False, 'message': 'Title and content are required'}), 400

    # Normalize/upload any embedded images and collect cloudinary public_ids
    normalized_content, public_ids = _upload_embedded_images_and_normalize(content)

    # Create new guide
    guide = {
        'title': title,
        'content': normalized_content,
        'created_by': session['user_id'],  # Store user_id as string
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'reactions': [],  # Initialize empty reactions array
        'image_public_ids': public_ids  # store the list of cloudinary public_ids
    }

    # Insert guide into database
    result = cultivation_guides_collection.insert_one(guide)

    if result.inserted_id:
        return jsonify({
            'success': True, 
            'message': 'Cultivation guide saved successfully',
            'guide_id': str(result.inserted_id)
        })
    else:
        return jsonify({'success': False, 'message': 'Failed to save guide'}), 500

# Route for updating an existing cultivation guide
@cultivation_guide_bp.route('/cultivation-guide/update', methods=['POST'])
def update_guide():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    user = users_collection.find_one({'_id': ObjectId(session['user_id'])})
    
    # Only admin can update guides
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    
    guide_id = request.form.get('guide_id')
    title = request.form.get('title')
    content = request.form.get('content')
    
    if not guide_id or not title or not content:
        return jsonify({'success': False, 'message': 'Guide ID, title, and content are required'}), 400
    
    # Check if the current user is the creator of the guide
    guide = cultivation_guides_collection.find_one({'_id': ObjectId(guide_id)})
    if not guide or guide.get('created_by') != session['user_id']:
        return jsonify({'success': False, 'message': 'You can only edit guides you created'}), 403
    
    # Fetch existing guide
    existing_guide = cultivation_guides_collection.find_one({'_id': ObjectId(guide_id)})
    if not existing_guide:
        return jsonify({'success': False, 'message': 'Guide not found'}), 404

    # Upload/normalize embedded images in the new content and collect their public_ids
    normalized_content, new_public_ids = _upload_embedded_images_and_normalize(content)

    # Determine which public_ids were removed (present before, not present now)
    old_public_ids = existing_guide.get('image_public_ids', [])
    removed_public_ids = set(old_public_ids) - set(new_public_ids)

    # Delete removed images from Cloudinary
    for pid in removed_public_ids:
        try:
            cloud_utils.delete_image(pid)
        except Exception:
            pass

    # Update guide in database with normalized content and new list of public_ids
    result = cultivation_guides_collection.update_one(
        {'_id': ObjectId(guide_id)},
        {'$set': {
            'title': title,
            'content': normalized_content,
            'updated_at': datetime.utcnow(),
            'image_public_ids': new_public_ids
        }}
    )
    
    if result.modified_count > 0:
        return jsonify({
            'success': True, 
            'message': 'Cultivation guide updated successfully'
        })
    else:
        return jsonify({'success': False, 'message': 'No changes made to the guide'}), 400

# Route for deleting a cultivation guide
@cultivation_guide_bp.route('/cultivation-guide/delete/<guide_id>', methods=['DELETE'])
def delete_guide(guide_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    user = users_collection.find_one({'_id': ObjectId(session['user_id'])})
    
    # Only admin can delete guides
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    
    # Check if the current user is the creator of the guide
    guide = cultivation_guides_collection.find_one({'_id': ObjectId(guide_id)})
    if not guide or guide.get('created_by') != session['user_id']:
        return jsonify({'success': False, 'message': 'You can only delete guides you created'}), 403
    
    # Delete images from Cloudinary if any
    public_ids = guide.get('image_public_ids', [])
    for pid in public_ids:
        try:
            cloud_utils.delete_image(pid)
        except Exception:
            pass

    # Delete guide from database
    result = cultivation_guides_collection.delete_one({'_id': ObjectId(guide_id)})
    
    if result.deleted_count == 0:
        return jsonify({'success': False, 'message': 'Guide not found'}), 404
    
    return jsonify({
        'success': True,
        'message': 'Cultivation guide deleted successfully'
    })

# Route for uploading images for cultivation guides
@cultivation_guide_bp.route('/cultivation-guide/upload-image', methods=['POST'])
def upload_image():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    user = users_collection.find_one({'_id': ObjectId(session['user_id'])})
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401

    if 'image' not in request.files:
        return jsonify({'success': False, 'message': 'No image file provided'}), 400

    image = request.files['image']
    if image.filename == '':
        return jsonify({'success': False, 'message': 'No image selected'}), 400

    try:
        # Upload to Cloudinary using helper (accepts FileStorage directly)
        upload_result = cloud_utils.upload_image(image, folder="betel/cultivation_guides")
        secure_url = upload_result.get('secure_url')
        public_id = upload_result.get('public_id')

        if not secure_url:
            return jsonify({'success': False, 'message': 'Upload failed'}), 500

        return jsonify({
            'success': True,
            'message': 'Image uploaded successfully',
            'imageUrl': secure_url,
            'public_id': public_id
        })
    except Exception as e:
        print("Cloudinary upload error:", e)
        return jsonify({'success': False, 'message': 'Failed to upload image'}), 500

# Route for toggling reactions on cultivation guides
@cultivation_guide_bp.route('/cultivation-guide/toggle-reaction/<guide_id>', methods=['POST'])
def toggle_reaction(guide_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    user_id = session['user_id']
    
    # Find the guide
    guide = cultivation_guides_collection.find_one({'_id': ObjectId(guide_id)})
    if not guide:
        return jsonify({'success': False, 'message': 'Guide not found'}), 404
    
    # Check if user has already reacted
    reactions = guide.get('reactions', [])
    
    if user_id in reactions:
        # Remove reaction
        cultivation_guides_collection.update_one(
            {'_id': ObjectId(guide_id)},
            {'$pull': {'reactions': user_id}}
        )
        user_reacted = False
    else:
        # Add reaction
        cultivation_guides_collection.update_one(
            {'_id': ObjectId(guide_id)},
            {'$addToSet': {'reactions': user_id}}
        )
        user_reacted = True
    
    # Get updated reaction count
    updated_guide = cultivation_guides_collection.find_one({'_id': ObjectId(guide_id)})
    reaction_count = len(updated_guide.get('reactions', []))
    
    return jsonify({
        'success': True,
        'user_reacted': user_reacted,
        'reaction_count': reaction_count
    })