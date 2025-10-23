from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, current_app
from datetime import datetime, timedelta
from bson.objectid import ObjectId
from datetime import datetime
from utils.db import users_collection, posts_collection, notifications_collection
from flask_socketio import join_room
from utils import cloudinary_utils as cloud_utils

community_forum_bp = Blueprint('community_forum', __name__)

# Get the socketio instance from app
def get_socketio():
    return current_app.extensions['socketio']

# Helper to return an absolute URL for profile pics
def normalize_profile_pic(raw_pic):
    if not raw_pic:
        return url_for('static', filename='images/default_profile.png')
    if isinstance(raw_pic, str) and raw_pic.startswith('http'):
        return raw_pic
    return url_for('uploaded_file', filename=raw_pic)

# Helper function to calculate the time ago string for a given date
def time_ago(date):
    now = datetime.utcnow()
    diff = now - date

    if diff < timedelta(minutes=1):
        return "Just now"
    elif diff < timedelta(hours=1):
        return f"{int(diff.seconds / 60)} Minute Ago"
    elif diff < timedelta(days=1):
        return f"{int(diff.seconds / 3600)} Hour Ago"
    elif diff < timedelta(days=30):
        return f"{diff.days} Day Ago"
    elif diff < timedelta(days=365):
        return f"{int(diff.days / 30)} Month Ago"
    else:
        return f"{int(diff.days / 365)} Year Ago"

# Helper function to recursively convert datetime and ObjectId objects to JSON-serializable formats.
def prepare_for_json(obj):
    if isinstance(obj, dict):
        return {k: prepare_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [prepare_for_json(item) for item in obj]
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, ObjectId):
        return str(obj)
    else:
        return obj

# Helper function to recursively convert all ObjectIds in a dictionary or list to strings
def convert_ids(obj):
    if isinstance(obj, dict):
        for key, value in list(obj.items()):
            if key == 'user_id':
                # Skip converting 'user_id' to string to avoid breaking user lookup
                continue
            if isinstance(value, ObjectId):
                obj[key] = str(value)
            else:
                convert_ids(value)
    elif isinstance(obj, list):
        for i in range(len(obj)):
            convert_ids(obj[i])

# Helper function to count the total number of comments in a list of comments
def count_comments(comments):
    count = 0
    for comment in comments:
        count += 1
        if 'replies' in comment:
            count += count_comments(comment['replies'])
    return count

# Community Forum Route
@community_forum_bp.route('/community-forum')
def community_forum():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    
    user = users_collection.find_one({'_id': ObjectId(session['user_id'])})

    # normalize current user's profile pic for template
    user['profile_pic'] = normalize_profile_pic(user.get('profile_pic'))

    posts = list(posts_collection.find().sort('date', -1))

    # Add user data to each post (normalize profile pics)
    for post in posts:
        try:
            post_user = users_collection.find_one({'_id': ObjectId(post['user_id'])})
            post['user'] = {
                'name': post_user['name'],
                'profile_pic': normalize_profile_pic(post_user.get('profile_pic'))
            }
        except Exception:
            post['user'] = {
                'name': 'Unknown',
                'profile_pic': url_for('static', filename='images/default_profile.png')
            }
        post['time_ago'] = time_ago(post['date'])

    return render_template('community_forum.html', user=user, posts=posts)

# Get Posts Route
@community_forum_bp.route('/community-forum/posts')
def get_posts():
    # Read the new query parameters for sort and scope.
    sort_option = request.args.get('sort', 'latest')
    scope_option = request.args.get('scope', 'all')
    
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    # Build the query filter based on the scope option.
    query = {}
    if scope_option == 'own':
        query['user_id'] = session['user_id']

    # Fetch posts based on the sort option using the query filter.
    if sort_option == 'latest':
        posts = list(posts_collection.find(query).sort('date', -1))
    elif sort_option == 'oldest':
        posts = list(posts_collection.find(query).sort('date', 1))
    elif sort_option == 'most-liked':
        posts = list(posts_collection.find(query).sort('likes', -1))
    elif sort_option == 'most-commented':
        posts = sorted(
            posts_collection.find(query),
            key=lambda p: count_comments(p.get('comments', [])),
            reverse=True
        )
    else:
        posts = list(posts_collection.find(query).sort('date', -1))
    
    # Convert posts to a list if not already one
    if not isinstance(posts, list):
        posts = list(posts)

    # Add user data and computed "time ago" to each post
    for post in posts:
        user_id = ObjectId(post['user_id']) if isinstance(post['user_id'], str) else post['user_id']
        post_user = users_collection.find_one({'_id': user_id})
        post['total_comments'] = count_comments(post.get('comments', []))
        
        if post_user:
            post['user'] = {
                'name': post_user['name'],
                'profile_pic': normalize_profile_pic(post_user.get('profile_pic'))
            }
        else:
            post['user'] = {
                'name': 'Unknown User',
                'profile_pic': url_for('static', filename='images/default_profile.png')
            }

        post['time_ago'] = time_ago(post['date'])
        post['liked'] = session['user_id'] in post.get('liked_by', [])

    # Recursively convert ObjectIds to strings
    for post in posts:
        convert_ids(post)

    return jsonify(posts), 200

# Create Post Route
@community_forum_bp.route('/create-post', methods=['POST'])
def create_post():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    title = request.form.get('title')
    description = request.form.get('description')
    image = request.files.get('image')
    user_id = session['user_id']

    if not title or not description or not image:
        return jsonify({'error': 'All fields are required'}), 400

    post_data = {
        'title': title,
        'description': description,
        'user_id': user_id,
        'likes': 0,
        'liked_by': [],
        'comments': [],
        'date': datetime.utcnow()
    }

    if image:
        try:
            upload_result = cloud_utils.upload_image(image, folder="betel/posts")
            post_data['image'] = upload_result.get('secure_url')
            post_data['image_public_id'] = upload_result.get('public_id')
        except Exception as e:
            return jsonify({'error': 'Failed to upload image'}), 500

    # Insert the post into the database
    result = posts_collection.insert_one(post_data)
    post_id = result.inserted_id
    # Add the post ID to the response
    post_data['_id'] = str(post_id)  

    # Fetch the user data for the post
    post_user = users_collection.find_one({'_id': ObjectId(user_id)})
    post_data['user'] = {
        'name': post_user['name'],
        'profile_pic': normalize_profile_pic(post_user.get('profile_pic'))
    }

    # Add the time_ago value to the response
    post_data['time_ago'] = time_ago(post_data['date'])

    # Emit socket event for new post
    socketio = get_socketio()
    post_data_for_socket = dict(post_data)
    post_data_for_socket['_id'] = str(post_id)
    post_data_for_socket = prepare_for_json(post_data_for_socket)
    socketio.emit('new_post', post_data_for_socket)

    return jsonify({'message': 'Post created successfully', 'post': post_data}), 201


# Update Post Route
@community_forum_bp.route('/update-post/<post_id>', methods=['POST'])
def update_post(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    # Expecting form-data for updates (title, description, and image)
    title = request.form.get('title')
    description = request.form.get('description')
    image = request.files.get('image')

    if not title and not description and not image:
        return jsonify({'error': 'At least one field (title, description, or image) is required'}), 400

    post = posts_collection.find_one({'_id': ObjectId(post_id)})
    if not post:
        return jsonify({'error': 'Post not found'}), 404

    # Only allow update if the current user created the post
    if post['user_id'] != session['user_id']:
        return jsonify({'error': "You don't have access to update this post"}), 403

    update_fields = {}
    if title:
        update_fields['title'] = title
    if description:
        update_fields['description'] = description

    # If a new image is provided, remove the old one (Cloudinary) and upload the new one
    if image:
        # delete old Cloudinary image if present
        old_public_id = post.get('image_public_id')
        if old_public_id:
            try:
                cloud_utils.delete_image(old_public_id)
            except Exception:
                pass

        # upload new image to Cloudinary
        try:
            upload_result = cloud_utils.upload_image(image, folder="betel/posts")
            update_fields['image'] = upload_result.get('secure_url')
            update_fields['image_public_id'] = upload_result.get('public_id')
        except Exception:
            return jsonify({'error': 'Failed to upload new image'}), 500

    update_fields['date'] = datetime.utcnow()  # Update timestamp

    posts_collection.update_one({'_id': ObjectId(post_id)}, {'$set': update_fields})
    
    # Get updated post for socket event
    updated_post = posts_collection.find_one({'_id': ObjectId(post_id)})
    
    # Add user data to the updated post
    post_user = users_collection.find_one({'_id': ObjectId(updated_post['user_id'])})
    updated_post['user'] = {
        'name': post_user['name'],
        'profile_pic': normalize_profile_pic(post_user.get('profile_pic'))
    }
    
    # Add time_ago to the updated post
    updated_post['time_ago'] = time_ago(updated_post['date'])
    
    # Convert ObjectId to string for JSON serialization
    updated_post['_id'] = str(updated_post['_id'])
    
    # Emit socket event for updated post
    socketio = get_socketio()
    updated_post = prepare_for_json(updated_post)
    socketio.emit('update_post', updated_post)
    
    return jsonify({'message': 'Post updated successfully'}), 200

# Delete Post Route
@community_forum_bp.route('/delete-post/<post_id>', methods=['DELETE'])
def delete_post(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    post = posts_collection.find_one({'_id': ObjectId(post_id)})
    if not post:
        return jsonify({'error': 'Post not found'}), 404

    # Only allow deletion if the current user created the post
    if post['user_id'] != session['user_id']:
        return jsonify({'error': "You don't have access to delete this post"}), 403

    # Remove Cloudinary image if stored
    if post.get('image_public_id'):
        try:
            cloud_utils.delete_image(post.get('image_public_id'))
        except Exception:
            pass

    posts_collection.delete_one({'_id': ObjectId(post_id)})
    
    # Emit socket event for deleted post
    socketio = get_socketio()
    socketio.emit('delete_post', {'post_id': post_id})
    
    return jsonify({'message': 'Post deleted successfully'}), 200

# Like Post Route
@community_forum_bp.route('/like-post/<post_id>', methods=['POST'])
def like_post(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    # Toggle like status
    post = posts_collection.find_one({'_id': ObjectId(post_id)})
    user_id = session['user_id']
    post_owner_id = post['user_id']

    if user_id in post.get('liked_by', []):
        # User already liked the post, so unlike it
        posts_collection.update_one(
            {'_id': ObjectId(post_id)},
            {'$inc': {'likes': -1}, '$pull': {'liked_by': user_id}}
        )
        liked = False
    else:
        # User has not liked the post, so like it
        posts_collection.update_one(
            {'_id': ObjectId(post_id)},
            {'$inc': {'likes': 1}, '$push': {'liked_by': user_id}}
        )
        liked = True
        
        # Create notification for post owner if the liker is not the owner
        if user_id != post_owner_id:
            # Get user info for notification
            liker = users_collection.find_one({'_id': ObjectId(user_id)})
            
            # Create notification
            notification = {
                'type': 'post_like',
                'sender_id': user_id,
                'receiver_id': post_owner_id,
                'post_id': post_id,
                'content': f"{liker['name']} liked your post",
                'timestamp': datetime.utcnow(),
                'read': False
            }
            
            # Save notification to database
            notifications_collection.insert_one(notification)
            
            # Emit notification to post owner
            socketio = get_socketio()
            socketio.emit('notification', {
                'type': 'post_like',
                'sender_id': user_id,
                'sender_name': liker['name'],
                'content': f"{liker['name']} liked your post",
                'timestamp': datetime.utcnow().isoformat(),
                'post_id': post_id
            }, room=post_owner_id)

    # Fetch the updated like count
    updated_post = posts_collection.find_one({'_id': ObjectId(post_id)})
    
    # Emit socket event for post like update
    socketio = get_socketio()
    socketio.emit('update_post_likes', {
        'post_id': post_id,
        'likes': updated_post['likes'],
        'liked_by': updated_post.get('liked_by', [])
    })
    
    return jsonify({
        'message': 'Post liked successfully',
        'likes': updated_post['likes'],
        'liked': liked
    }), 200

# Add Comment Route
@community_forum_bp.route('/add-comment/<post_id>', methods=['POST'])
def add_comment(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    # Get the comment text from the request JSON
    comment_data = request.get_json()
    comment_text = comment_data.get('comment')

    if not comment_text:
        return jsonify({'error': 'Comment text is required'}), 400

    # Prepare the comment data
    new_comment = {
        '_id': ObjectId(),
        'post_id': ObjectId(post_id),
        'user_id': session['user_id'],
        'text': comment_text,
        'date': datetime.utcnow(),
        'replies': [], # Ensure top-level comments also have a 'replies' field
        'likes': 0, # # Initialize like count
        'liked_by': [] # Initialize list of users who liked it
    }

    # Insert the comment into the database
    posts_collection.update_one(
        {'_id': ObjectId(post_id)},
        {'$push': {'comments': new_comment}}
    )

    # Fetch the updated post
    updated_post = posts_collection.find_one({'_id': ObjectId(post_id)})
    post_owner_id = updated_post['user_id']

    # Fetch the user data for the comment
    user = users_collection.find_one({'_id': ObjectId(session['user_id'])})

    # Prepare comment data for response
    comment_response = {
        '_id': str(new_comment['_id']),
        'text': new_comment['text'],
        'date': new_comment['date'],
        'likes': 0, # Initialize likes to 0
        'can_edit': True, # Set can_edit to True for the logged-in user
        'user': {
            'name': user['name'],
            'profile_pic': normalize_profile_pic(user.get('profile_pic'))
        }
    }
    
    # Create notification for post owner if commenter is not the owner
    if session['user_id'] != post_owner_id:
        # Create notification
        notification = {
            'type': 'post_comment',
            'sender_id': session['user_id'],
            'receiver_id': post_owner_id,
            'post_id': post_id,
            'comment_id': str(new_comment['_id']),
            'content': f"{user['name']} commented on your post",
            'timestamp': datetime.utcnow(),
            'read': False
        }
        
        # Save notification to database
        notifications_collection.insert_one(notification)
        
        # Emit notification to post owner
        socketio = get_socketio()
        socketio.emit('notification', {
            'type': 'post_comment',
            'sender_id': session['user_id'],
            'sender_name': user['name'],
            'content': f"{user['name']} commented on your post",
            'timestamp': datetime.utcnow().isoformat(),
            'post_id': post_id,
            'comment_id': str(new_comment['_id'])
        }, room=post_owner_id)
    
    # Emit socket event for new comment
    socketio = get_socketio()
    updated_post = posts_collection.find_one({'_id': ObjectId(post_id)})
    total_comments = count_comments(updated_post.get('comments', []))
    data = {
        'post_id': post_id,
        'comment': comment_response,
        'comments_count': total_comments,
    }
    data = prepare_for_json(data)
    socketio.emit('new_comment', data)

    return jsonify({
        'message': 'Comment added successfully',
        'new_comment': comment_response,
        'comments_count': len(updated_post.get('comments', []))
    }), 201

# Add Reply Route
@community_forum_bp.route('/add-reply/<comment_id>', methods=['POST'])
def add_reply(comment_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    # Get the reply text from the request JSON
    reply_data = request.get_json()
    reply_text = reply_data.get('reply')
    if not reply_text:
        return jsonify({'error': 'Reply text is required'}), 400

    # Prepare the reply data
    reply = {
        '_id': ObjectId(),  # Generate a unique ID for the reply
        'comment_id': ObjectId(comment_id),
        'user_id': session['user_id'],
        'text': reply_text,
        'date': datetime.utcnow(),
        'replies': [],  # Nested replies
        'likes': 0,  # Initialize like count
        'liked_by': []  # Initialize list of users who liked it
    }

    # Insert the reply into the database under the correct comment
    posts_collection.update_one(
        {'comments._id': ObjectId(comment_id)},
        {'$push': {'comments.$.replies': reply}}
    )

    # Fetch the updated comment and user data
    post = posts_collection.find_one({'comments._id': ObjectId(comment_id)})
    post_id = str(post['_id'])
    comment = next((c for c in post['comments'] if c['_id'] == ObjectId(comment_id)), None)
    comment_owner_id = comment['user_id']
    user = users_collection.find_one({'_id': ObjectId(session['user_id'])})

    # Prepare reply data for response
    reply_response = {
        '_id': str(reply['_id']),
        'text': reply['text'],
        'date': reply['date'],
        'likes': 0, # Initialize likes to 0
        'can_edit': True, # Set can_edit to True for the logged-in user
        'user': {
            'name': user['name'],
            'profile_pic': normalize_profile_pic(user.get('profile_pic'))
        }
    }
    
    # Create notification for comment owner if replier is not the owner
    if session['user_id'] != comment_owner_id:
        # Get comment owner info
        comment_owner = users_collection.find_one({'_id': ObjectId(comment_owner_id)})
        
        # Create notification
        notification = {
            'type': 'comment_reply',
            'sender_id': session['user_id'],
            'receiver_id': comment_owner_id,
            'post_id': post_id,
            'comment_id': comment_id,
            'reply_id': str(reply['_id']),
            'content': f"{user['name']} replied to your comment",
            'timestamp': datetime.utcnow(),
            'read': False
        }
        
        # Save notification to database
        notifications_collection.insert_one(notification)
        
        # Emit notification to comment owner
        socketio = get_socketio()
        socketio.emit('notification', {
            'type': 'comment_reply',
            'sender_id': session['user_id'],
            'sender_name': user['name'],
            'content': f"{user['name']} replied to your comment",
            'timestamp': datetime.utcnow().isoformat(),
            'post_id': post_id,
            'comment_id': comment_id,
            'reply_id': str(reply['_id'])
        }, room=comment_owner_id)
    
    # Emit socket event for new reply
    socketio = get_socketio()
    updated_post = posts_collection.find_one({'_id': ObjectId(post_id)})
    total_comments = count_comments(updated_post.get('comments', []))
    data = {
        'post_id': post_id,
        'comment_id': comment_id,
        'reply': reply_response,
        'total_comments': total_comments
    }
    data = prepare_for_json(data)
    socketio.emit('new_reply', data)

    return jsonify({
        'message': 'Reply added successfully',
        'new_reply': reply_response
    }), 201

# Add Nested Reply Route
@community_forum_bp.route('/add-nested-reply/<post_id>/<reply_id>', methods=['POST'])
def add_nested_reply(post_id, reply_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    # Get the reply text from the request JSON
    data = request.get_json()
    reply_text = data.get('reply')
    if not reply_text:
        return jsonify({'error': 'Reply text is required'}), 400

    # Find the post by its ID
    post = posts_collection.find_one({'_id': ObjectId(post_id)})
    if not post:
        return jsonify({'error': 'Post not found'}), 404

    # Build the new nested reply
    nested_reply = {
        '_id': ObjectId(),
        'reply_id': ObjectId(reply_id),
        'user_id': session['user_id'],
        'text': reply_text,
        'date': datetime.utcnow(),
        'replies': [], # so we can nest further
        'likes': 0, # Initialize like count
        'liked_by': [] # Initialize list of users who liked it
    }

    # Find the parent reply and its owner
    parent_reply_owner_id = None
    
    # Recursive helper to find parent reply
    def find_parent_reply(replies_list, target_id):
        for r in replies_list:
            if str(r['_id']) == str(target_id):
                return r
            if 'replies' in r:
                found = find_parent_reply(r['replies'], target_id)
                if found:
                    return found
        return None

    # Search through all comments/replies in the post to find parent reply
    for c in post.get('comments', []):
        parent_reply = find_parent_reply(c.get('replies', []), reply_id)
        if parent_reply:
            parent_reply_owner_id = parent_reply['user_id']
            break

    # Recursive helper to insert nested reply
    def insert_nested_reply(replies_list, target_id, new_reply):
        for r in replies_list:
            if str(r['_id']) == str(target_id):
                # Found the target
                r.setdefault('replies', [])
                r['replies'].append(new_reply)
                return True
            if 'replies' in r:
                if insert_nested_reply(r['replies'], target_id, new_reply):
                    return True
        return False

    # Search through all comments/replies in the post
    inserted = False
    for c in post.get('comments', []):
        if insert_nested_reply(c.get('replies', []), reply_id, nested_reply):
            inserted = True
            break

    if not inserted:
        return jsonify({'error': 'Reply not found at any depth'}), 404

    # Replace entire post doc with updated structure
    posts_collection.replace_one({'_id': post['_id']}, post)

    # Get user info for response
    user = users_collection.find_one({'_id': ObjectId(session['user_id'])})
    
    # Prepare nested reply data for response
    nested_reply_response = {
        '_id': str(nested_reply['_id']),
        'text': nested_reply['text'],
        'date': nested_reply['date'],
        'likes': 0, # Initialize likes to 0
        'can_edit': True, # Set can_edit to True for the logged-in user
        'user': {
            'name': user['name'],
            'profile_pic': normalize_profile_pic(user.get('profile_pic'))
        }
    }
    
    # Create notification for parent reply owner if replier is not the owner
    if parent_reply_owner_id and session['user_id'] != parent_reply_owner_id:
        # Get parent reply owner info
        parent_reply_owner = users_collection.find_one({'_id': ObjectId(parent_reply_owner_id)})
        
        # Create notification
        notification = {
            'type': 'nested_reply',
            'sender_id': session['user_id'],
            'receiver_id': parent_reply_owner_id,
            'post_id': str(post['_id']),
            'reply_id': reply_id,
            'nested_reply_id': str(nested_reply['_id']),
            'content': f"{user['name']} replied to your comment",
            'timestamp': datetime.utcnow(),
            'read': False
        }
        
        # Save notification to database
        notifications_collection.insert_one(notification)
        
        # Emit notification to parent reply owner
        socketio = get_socketio()
        socketio.emit('notification', {
            'type': 'nested_reply',
            'sender_id': session['user_id'],
            'sender_name': user['name'],
            'content': f"{user['name']} replied to your comment",
            'timestamp': datetime.utcnow().isoformat(),
            'post_id': str(post['_id']),
            'reply_id': reply_id,
            'nested_reply_id': str(nested_reply['_id'])
        }, room=parent_reply_owner_id)
    
    # Emit socket event for new nested reply
    socketio = get_socketio()
    updated_post = posts_collection.find_one({'_id': ObjectId(post_id)})
    total_comments = count_comments(updated_post.get('comments', []))
    data = {
        'post_id': str(post['_id']),
        'reply_id': reply_id,
        'nested_reply': nested_reply_response,
        'total_comments': total_comments
    }
    data = prepare_for_json(data)
    socketio.emit('new_nested_reply', data)

    return jsonify({
        'message': 'Nested reply added successfully',
        'new_nested_reply': nested_reply_response
    }), 201

# Update Comment Route
@community_forum_bp.route('/update-comment/<post_id>/<comment_id>', methods=['POST'])
def update_comment(post_id, comment_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    new_text = data.get('text')
    if not new_text:
        return jsonify({'error': 'New text is required'}), 400

    post = posts_collection.find_one({'_id': ObjectId(post_id)})
    if not post:
        return jsonify({'error': 'Post not found'}), 404

    # Locate the comment within the post's comments array
    comment = next((c for c in post.get('comments', []) if str(c['_id']) == comment_id), None)
    if not comment:
        return jsonify({'error': 'Comment not found'}), 404

    if comment['user_id'] != session['user_id']:
        return jsonify({'error': "You don't have access to update this comment"}), 403

    # Update the comment text and refresh its date
    posts_collection.update_one(
        {'_id': ObjectId(post_id), 'comments._id': ObjectId(comment_id)},
        {'$set': {'comments.$.text': new_text, 'comments.$.date': datetime.utcnow()}}
    )
    
    # Emit socket event for updated comment
    socketio = get_socketio()
    data = {
        'post_id': post_id,
        'comment_id': comment_id,
        'text': new_text,
        'date': datetime.utcnow().isoformat(),
    }
    data = prepare_for_json(data)
    socketio.emit('update_comment', data)

    return jsonify({'message': 'Comment updated successfully', 'updated_text': new_text}), 200

# Update Reply Route
@community_forum_bp.route('/update-reply/<post_id>/<reply_id>', methods=['POST'])
def update_reply(post_id, reply_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    new_text = data.get('text')
    if not new_text:
        return jsonify({'error': 'New text is required'}), 400

    post = posts_collection.find_one({'_id': ObjectId(post_id)})
    if not post:
        return jsonify({'error': 'Post not found'}), 404

    # Recursive helper to update a reply within a list of replies
    def update_reply_recursive(replies):
        for reply in replies:
            if str(reply['_id']) == str(reply_id):
                if reply['user_id'] != session['user_id']:
                    return False, "You don't have access to update this reply"
                reply['text'] = new_text
                reply['date'] = datetime.utcnow()
                return True, None
            if 'replies' in reply:
                found, err = update_reply_recursive(reply['replies'])
                if found:
                    return True, None
        return False, None

    updated = False
    for comment in post.get('comments', []):
        if 'replies' in comment:
            found, err = update_reply_recursive(comment['replies'])
            if found:
                updated = True
                break

    if not updated:
        return jsonify({'error': err or 'Reply not found'}), 404

    posts_collection.replace_one({'_id': post['_id']}, post)
    
    # Emit socket event for updated reply
    socketio = get_socketio()
    data = {
        'post_id': post_id,
        'reply_id': reply_id,
        'text': new_text,
        'date': datetime.utcnow().isoformat()
    }
    data = prepare_for_json(data)
    socketio.emit('update_reply', data)

    return jsonify({'message': 'Reply updated successfully', 'updated_text': new_text}), 200

# Delete Comment Route
@community_forum_bp.route('/delete-comment/<post_id>/<comment_id>', methods=['DELETE'])
def delete_comment(post_id, comment_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    post = posts_collection.find_one({'_id': ObjectId(post_id)})
    if not post:
        return jsonify({'error': 'Post not found'}), 404

    comment = next((c for c in post.get('comments', []) if str(c['_id']) == comment_id), None)
    if not comment:
        return jsonify({'error': 'Comment not found'}), 404

    if comment['user_id'] != session['user_id']:
        return jsonify({'error': "You don't have access to delete this comment"}), 403

    posts_collection.update_one(
        {'_id': ObjectId(post_id)},
        {'$pull': {'comments': {'_id': ObjectId(comment_id)}}}
    )
    
    # Get updated comment count
    updated_post = posts_collection.find_one({'_id': ObjectId(post_id)})
    total_comments = count_comments(updated_post.get('comments', []))
    
    # Emit socket event for deleted comment
    socketio = get_socketio()
    socketio.emit('delete_comment', {
        'post_id': post_id,
        'comment_id': comment_id,
        'comments_count': total_comments,
    })

    return jsonify({'message': 'Comment deleted successfully'}), 200

# Delete Reply Route
@community_forum_bp.route('/delete-reply/<post_id>/<reply_id>', methods=['DELETE'])
def delete_reply(post_id, reply_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    post = posts_collection.find_one({'_id': ObjectId(post_id)})
    if not post:
        return jsonify({'error': 'Post not found'}), 404

    # Recursive helper to remove a reply from a list of replies
    def remove_reply(replies):
        for i, reply in enumerate(replies):
            if str(reply['_id']) == reply_id:
                if reply['user_id'] != session['user_id']:
                    return False, "You don't have access to delete this reply"
                replies.pop(i)
                return True, None
            if 'replies' in reply:
                found, err = remove_reply(reply['replies'])
                if found:
                    return True, None
        return False, None

    deleted = False
    for comment in post.get('comments', []):
        if 'replies' in comment:
            found, err = remove_reply(comment['replies'])
            if found:
                deleted = True
                break

    if not deleted:
        return jsonify({'error': err or 'Reply not found'}), 404

    posts_collection.replace_one({'_id': post['_id']}, post)
    updated_post = posts_collection.find_one({'_id': ObjectId(post_id)})
    total_comments = count_comments(updated_post.get('comments', []))  
    
    # Emit socket event for deleted reply
    socketio = get_socketio()
    socketio.emit('delete_reply', {
        'post_id': post_id,
        'reply_id': reply_id,
        'comments_count': total_comments,
    })

    return jsonify({'message': 'Reply deleted successfully'}), 200

# Like Comment Route
@community_forum_bp.route('/like-comment/<post_id>/<comment_id>', methods=['POST'])
def like_comment(post_id, comment_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    user_id = session['user_id']
    post = posts_collection.find_one({'_id': ObjectId(post_id)})
    if not post:
        return jsonify({'error': 'Post not found'}), 404
    # Find the comment
    comment = next((c for c in post.get('comments', []) if str(c['_id']) == comment_id), None)
    if not comment:
        return jsonify({'error': 'Comment not found'}), 404

    # Initialize like fields if missing
    if 'likes' not in comment:
        comment['likes'] = 0
    if 'liked_by' not in comment:
        comment['liked_by'] = []

    # Toggle like
    if user_id in comment['liked_by']:
        comment['liked_by'].remove(user_id)
        comment['likes'] -= 1
        liked = False
    else:
        comment['liked_by'].append(user_id)
        comment['likes'] += 1
        liked = True
        
        # Create notification for comment owner if liker is not the owner
        if user_id != comment['user_id']:
            # Get user info for notification
            liker = users_collection.find_one({'_id': ObjectId(user_id)})
            
            # Create notification
            notification = {
                'type': 'comment_like',
                'sender_id': user_id,
                'receiver_id': comment['user_id'],
                'post_id': post_id,
                'comment_id': comment_id,
                'content': f"{liker['name']} liked your comment",
                'timestamp': datetime.utcnow(),
                'read': False
            }
            
            # Save notification to database
            notifications_collection.insert_one(notification)
            
            # Emit notification to comment owner
            socketio = get_socketio()
            socketio.emit('notification', {
                'type': 'comment_like',
                'sender_id': user_id,
                'sender_name': liker['name'],
                'content': f"{liker['name']} liked your comment",
                'timestamp': datetime.utcnow().isoformat(),
                'post_id': post_id,
                'comment_id': comment_id
            }, room=comment['user_id'])

    posts_collection.replace_one({'_id': post['_id']}, post)
    
    # Emit socket event for comment like update
    socketio = get_socketio()
    socketio.emit('update_comment_likes', {
        'post_id': post_id,
        'comment_id': comment_id,
        'likes': comment['likes'],
        'liked_by': comment['liked_by']
    })
    
    return jsonify({
        'message': 'Comment like toggled successfully',
        'likes': comment['likes'],
        'liked': liked
    }), 200

# Like Reply Route
@community_forum_bp.route('/like-reply/<post_id>/<reply_id>', methods=['POST'])
def like_reply(post_id, reply_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    user_id = session['user_id']
    post = posts_collection.find_one({'_id': ObjectId(post_id)})
    if not post:
        return jsonify({'error': 'Post not found'}), 404

    # Recursive helper to toggle like in a list of replies
    def toggle_like_in_replies(replies):
        for reply in replies:
            if str(reply['_id']) == reply_id:
                if 'likes' not in reply:
                    reply['likes'] = 0
                if 'liked_by' not in reply:
                    reply['liked_by'] = []
                if user_id in reply['liked_by']:
                    reply['liked_by'].remove(user_id)
                    reply['likes'] -= 1
                    return True, reply['likes'], False, reply['user_id'], reply['liked_by']
                else:
                    reply['liked_by'].append(user_id)
                    reply['likes'] += 1
                    return True, reply['likes'], True, reply['user_id'], reply['liked_by']
            if 'replies' in reply:
                found, like_count, liked, reply_owner_id, liked_by = toggle_like_in_replies(reply['replies'])
                if found:
                    return True, like_count, liked, reply_owner_id, liked_by
        return False, None, None, None, None

    # Find the reply and toggle like
    found = False
    like_count = None
    liked = None
    reply_owner_id = None
    liked_by = None
    
    for comment in post.get('comments', []):
        if 'replies' in comment:
            found, like_count, liked, reply_owner_id, liked_by = toggle_like_in_replies(comment['replies'])
            if found:
                break

    if not found:
        return jsonify({'error': 'Reply not found'}), 404

    # Create notification for reply owner if liker is not the owner and it's a like (not unlike)
    if liked and user_id != reply_owner_id:
        # Get user info for notification
        liker = users_collection.find_one({'_id': ObjectId(user_id)})
        
        # Create notification
        notification = {
            'type': 'reply_like',
            'sender_id': user_id,
            'receiver_id': reply_owner_id,
            'post_id': post_id,
            'reply_id': reply_id,
            'content': f"{liker['name']} liked your reply",
            'timestamp': datetime.utcnow(),
            'read': False
        }
        
        # Save notification to database
        notifications_collection.insert_one(notification)
        
        # Emit notification to reply owner
        socketio = get_socketio()
        socketio.emit('notification', {
            'type': 'reply_like',
            'sender_id': user_id,
            'sender_name': liker['name'],
            'content': f"{liker['name']} liked your reply",
            'timestamp': datetime.utcnow().isoformat(),
            'post_id': post_id,
            'reply_id': reply_id
        }, room=reply_owner_id)

    # Update the post with the new like count and return success
    posts_collection.replace_one({'_id': post['_id']}, post)
    
    # Emit socket event for reply like update
    socketio = get_socketio()
    socketio.emit('update_reply_likes', {
        'post_id': post_id,
        'reply_id': reply_id,
        'likes': like_count,
        'liked_by': liked_by
    })
    
    return jsonify({
        'message': 'Reply like toggled successfully',
        'likes': like_count,
        'liked': liked
    }), 200

# Get Comments Route
@community_forum_bp.route('/get-comments/<post_id>')
def get_comments(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    # Fetch the post and its comments
    post = posts_collection.find_one({'_id': ObjectId(post_id)})
    if not post:
        return jsonify({'error': 'Post not found'}), 404

    # Recursive function to fetch nested replies
    def fetch_replies(replies):
        nested_replies = []
        for reply in replies:
            reply_user = users_collection.find_one({'_id': ObjectId(reply['user_id'])})
            nested_replies.append({
                '_id': str(reply['_id']),
                'text': reply['text'],
                'date': reply['date'],
                'likes': reply.get('likes', 0),
                'liked': (session['user_id'] in reply.get('liked_by', [])),
                'can_edit': (reply['user_id'] == session['user_id']),
                'user': {
                    'name': reply_user['name'],
                    'profile_pic': normalize_profile_pic(reply_user.get('profile_pic'))
                },
                'replies': fetch_replies(reply.get('replies', []))
            })
        return nested_replies

    # Add user data to each comment and its replies
    comments = []
    for comment in post.get('comments', []):
        comment_user = users_collection.find_one({'_id': ObjectId(comment['user_id'])})
        comments.append({
        '_id': str(comment['_id']),
        'text': comment['text'],
        'date': comment['date'],
        'likes': comment.get('likes', 0),
        'liked': (session['user_id'] in comment.get('liked_by', [])),
        'can_edit': (comment['user_id'] == session['user_id']),
        'user': {
            'name': comment_user['name'],
            'profile_pic': normalize_profile_pic(comment_user.get('profile_pic'))
        },
        'replies': fetch_replies(comment.get('replies', []))
    })

    return jsonify(comments), 200

# Mark all notifications as read
@community_forum_bp.route('/mark-notifications-read', methods=['POST'])
def mark_notifications_read():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    notifications_collection.update_many(
        {'receiver_id': session['user_id'], 'read': False},
        {'$set': {'read': True}}
    )
    return jsonify({'message': 'Notifications marked as read'}), 200

# Clear all notifications
@community_forum_bp.route('/clear-notifications', methods=['DELETE'])
def clear_notifications():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    notifications_collection.delete_many({'receiver_id': session['user_id']})
    return jsonify({'message': 'All notifications cleared'}), 200

# Get Notifications Route
@community_forum_bp.route('/get-notifications', methods=['GET'])
def get_notifications():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    # Fetch all notifications for the current user
    notifications = list(notifications_collection.find({'receiver_id': session['user_id']}))
    
    # Prepare notifications for JSON response
    notification_list = []
    for notification in notifications:
        sender = users_collection.find_one({'_id': ObjectId(notification['sender_id'])})
        notification_data = {
            'message_id': str(notification['_id']),
            'sender_id': notification['sender_id'],
            'sender_name': sender['name'] if sender else 'Unknown',
            'content': notification['content'],
            'timestamp': notification['timestamp'].isoformat(),
            'read': notification['read']
        }
        notification_list.append(notification_data)
    
    return jsonify(notification_list), 200

# Register Socket.IO handlers
def register_forum_socketio_handlers(socketio):
    @socketio.on('join_forum')
    def handle_join_forum(data):
        user_id = data.get('user_id')
        if user_id:
            join_room(user_id)
            print(f"User {user_id} joined forum room")