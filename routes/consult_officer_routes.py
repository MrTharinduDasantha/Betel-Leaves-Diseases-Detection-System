from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, current_app
from bson.objectid import ObjectId
from datetime import datetime
from utils.db import users_collection, messages_collection, notifications_collection
from flask_socketio import join_room
from collections import defaultdict
from flask import request as flask_request
from utils import cloudinary_utils as cloud_utils

consult_officer_bp = Blueprint('consult_officer', __name__)

# Get the socketio instance from app
def get_socketio():
    return current_app.extensions['socketio']

@consult_officer_bp.route('/consult-officer')
def consult_officer():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    
    user = users_collection.find_one({'_id': ObjectId(session['user_id'])})
    profile_pic_raw = user.get('profile_pic') if user else None
    if profile_pic_raw:
        if profile_pic_raw.startswith('http'):
            profile_pic_url = profile_pic_raw
        else:
            profile_pic_url = url_for('uploaded_file', filename=profile_pic_raw)
    else:
        profile_pic_url = url_for('static', filename='images/default_profile.png')

    # attach normalized url back to user object passed to template
    user['profile_pic'] = profile_pic_url
    
    return render_template('consult_officer.html', user=user)

@consult_officer_bp.route('/get-users')
def get_users():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    user_type = request.args.get('type', 'farmers')
    current_user_id = session['user_id']
    
    # Determine role to filter by
    role_filter = 'user' if user_type == 'farmers' else 'admin'
    
    # Get all users with the specified role
    users = list(users_collection.find({'role': role_filter}))
    
    # Format user data for response
    formatted_users = []
    for user in users:
        # Skip current user
        if str(user['_id']) == current_user_id:
            continue
        
        user_id = str(user['_id'])
        
        # Get last message between current user and this user
        last_message = messages_collection.find_one({
            '$or': [
                {'sender_id': current_user_id, 'receiver_id': user_id},
                {'sender_id': user_id, 'receiver_id': current_user_id}
            ]
        }, sort=[('timestamp', -1)])
        
        # Get unread message count
        unread_count = messages_collection.count_documents({
            'sender_id': user_id,
            'receiver_id': current_user_id,
            'read': False
        })
        
        # Prepare last message preview and time
        last_message_preview = ""
        last_message_time = ""
        if last_message:
            # Check if it's an image message - now stored as Cloudinary URL
            if last_message.get('is_image', False) or last_message.get('content', '').startswith('https://res.cloudinary.com'):
                last_message_preview = "[Image]"
            else:
                # Truncate long messages
                content = last_message.get('content', '')
                last_message_preview = (content[:30] + '...') if len(content) > 30 else content
            
            # Add timestamp
            last_message_time = last_message.get('timestamp').isoformat() if 'timestamp' in last_message else ""
        
        # Handle profile picture - check if it's a Cloudinary URL
        raw_pic = user.get('profile_pic', '')
        if raw_pic:
            if raw_pic.startswith('https://res.cloudinary.com'):
                profile_pic_url = raw_pic  # Already a Cloudinary URL
            else:
                # Local file, use uploaded_file route
                profile_pic_url = url_for('uploaded_file', filename=raw_pic)
        else:
            profile_pic_url = url_for('static', filename='images/default_profile.png')

        formatted_users.append({
            '_id': user_id,
            'name': user['name'],
            'profile_pic': profile_pic_url,
            'role': user['role'],
            'last_message': last_message_preview,
            'last_message_time': last_message_time,
            'unread_count': unread_count
        })
    
    return jsonify(formatted_users)

@consult_officer_bp.route('/get-messages')
def get_messages():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID is required'}), 400
    
    # Get messages between current user and selected user
    messages = list(messages_collection.find({
        '$or': [
            {'sender_id': session['user_id'], 'receiver_id': user_id},
            {'sender_id': user_id, 'receiver_id': session['user_id']}
        ]
    }).sort('timestamp', 1))
    
    # Format messages for response
    formatted_messages = []
    for message in messages:
        formatted_messages.append({
            '_id': str(message['_id']),
            'sender_id': message['sender_id'],
            'receiver_id': message['receiver_id'],
            'content': message['content'],
            'timestamp': message['timestamp'].isoformat(),
            'read': message.get('read', False),
            'delivered': message.get('delivered', False),
            'is_image': message.get('is_image', False)
        })
    
    # Return all formatted messages
    return jsonify(formatted_messages)

@consult_officer_bp.route('/mark-messages-read', methods=['POST'])
def mark_messages_read():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID is required'}), 400
    
    # Mark all messages from this user to current user as read
    messages_collection.update_many(
        {'sender_id': user_id, 'receiver_id': session['user_id'], 'read': False},
        {'$set': {'read': True}}
    )
    
    return jsonify({'success': True})

@consult_officer_bp.route('/get-notifications')
def get_notifications():
    if 'user_id' not in session:
        return jsonify([])
    
    current_user_id = session['user_id']
    
    # Get all unread messages for the current user
    unread_messages = list(messages_collection.find({
        'receiver_id': current_user_id,
        'type': 'message',
        'read': False
    }).sort('timestamp', -1))
    
    # Format notifications for response
    notifications = []
    for notification  in unread_messages:
        sender_id = notification['sender_id']
        sender = users_collection.find_one({'_id': ObjectId(sender_id)})
        
        if sender:
            notifications.append({
                'notification_id': str(notification['_id']),
                'message_id': notification.get('message_id'),
                'sender_id': sender_id,
                'sender_name': sender['name'],
                'content': notification['content'],
                'message_content': notification.get('message_content', ''),
                'timestamp': notification['timestamp'].isoformat()
            })
    
    return jsonify(notifications)

@consult_officer_bp.route('/mark-notification-read', methods=['POST'])
def mark_notification_read():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    notification_id = request.json.get('notification_id')
    if not notification_id:
        return jsonify({'error': 'Notification ID is required'}), 400
    
    # Mark notification as read
    notifications_collection.update_one(
        {'_id': ObjectId(notification_id)},
        {'$set': {'read': True}}
    )
    
    return jsonify({'success': True})

@consult_officer_bp.route('/get-user-info')
def get_user_info():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID is required'}), 400
    
    user = users_collection.find_one({'_id': ObjectId(user_id)})
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Normalize profile pic - handle Cloudinary URLs
    raw_pic = user.get('profile_pic', '')
    if raw_pic:
        if raw_pic.startswith('https://res.cloudinary.com'):
            profile_pic_url = raw_pic  # Already a Cloudinary URL
        else:
            profile_pic_url = url_for('uploaded_file', filename=raw_pic)
    else:
        profile_pic_url = url_for('static', filename='images/default_profile.png')

    return jsonify({
        '_id': str(user['_id']),
        'name': user['name'],
        'profile_pic': profile_pic_url,
        'role': user['role']
    })

def register_socketio_handlers(socketio):
    # Track online users with their socket IDs
    online_users = defaultdict(set)
    
    @socketio.on('connect')
    def handle_connect():
        print('Client connected')

    @socketio.on('disconnect')
    def handle_disconnect(sid):
        # Find the user_id associated with this socket ID
        sid = flask_request.sid
        print(f'Client disconnected: {sid}')

        # Walk through our map of user_id → set(of sids)
        for user_id, sockets in list(online_users.items()):
            if sid in sockets:
                sockets.remove(sid)
                if not sockets:
                    # no more live sockets for this user → truly offline
                    del online_users[user_id]
                    # notify all clients
                    socketio.emit('user_offline', {'user_id': user_id})
                break

    @socketio.on('join')
    def handle_join(data):
        user_id = data.get('user_id')
        if user_id:
            # Join the room for this user
            join_room(user_id)
            print(f"User {user_id} joined their room")
            
            # Add this socket connection to the user's set of connections
            sid = flask_request.sid
            was_online = bool(online_users[user_id])  # Check if user was already online
            online_users[user_id].add(sid)
            
            # Broadcast online status to all clients if this is the first connection
            if not was_online:
                socketio.server.emit('user_online', {'user_id': user_id}, namespace='/')
            
            # Send current online users to the newly connected client
            for online_user_id in online_users:
                if online_users[online_user_id]:  # Only if they have active connections
                    socketio.emit('user_online', {'user_id': online_user_id}, room=user_id)

    @socketio.on('user_online')
    def handle_user_online(data):
        user_id = data.get('user_id')
        if user_id:
            sid = flask_request.sid
            was_online = bool(online_users[user_id])
            online_users[user_id].add(sid)
            
            if not was_online:
                socketio.emit('user_online', {'user_id': user_id}, broadcast=True)

    @socketio.on('user_offline')
    def handle_user_offline(data):
        user_id = data.get('user_id')
        if user_id and user_id in online_users and not online_users[user_id]:
            del online_users[user_id]
            socketio.emit('user_offline', {'user_id': user_id}, broadcast=True)

    @socketio.on('typing')
    def handle_typing(data):
        sender_id = data.get('sender_id')
        receiver_id = data.get('receiver_id')
        if sender_id and receiver_id:
            socketio.emit('typing', {'sender_id': sender_id}, room=receiver_id)

    @socketio.on('stop_typing')
    def handle_stop_typing(data):
        sender_id = data.get('sender_id')
        receiver_id = data.get('receiver_id')
        if sender_id and receiver_id:
            socketio.emit('stop_typing', {'sender_id': sender_id}, room=receiver_id)

    @socketio.on('send_message')
    def handle_send_message(data):
        sender_id = data.get('sender_id')
        receiver_id = data.get('receiver_id')
        content = data.get('content')

        if not all([sender_id, receiver_id, content]):
            return

        # If content is base64 image (data URI) → upload to Cloudinary
        is_image = False
        public_id = None
        content_to_store = content

        try:
            if isinstance(content, str) and content.startswith('data:image'):
                # upload base64/data-uri directly to Cloudinary
                upload_result = cloud_utils.upload_image(content, folder="betel/messages")
                content_to_store = upload_result.get('secure_url')
                public_id = upload_result.get('public_id')
                is_image = True
                print(f"Image uploaded to Cloudinary: {content_to_store}")
        except Exception as e:
            # upload failed: log and return
            print("Cloudinary upload failed:", e)
            return

        # Create new message document
        message = {
            'sender_id': sender_id,
            'receiver_id': receiver_id,
            'content': content_to_store,
            'timestamp': datetime.utcnow(),
            'read': False,
            'delivered': False,
            'is_image': is_image
        }
        if public_id:
            message['public_id'] = public_id

        # Insert message into DB
        result = messages_collection.insert_one(message)
        message_id = str(result.inserted_id)

        # Format timestamp and notification content
        timestamp = message['timestamp'].isoformat()
        notification_content = "[Image]" if is_image else content_to_store

        # Emit user list update to both sender and receiver
        socketio.emit('update_user_list', {
            'user_id': receiver_id,
            'last_message': notification_content,
            'last_message_time': timestamp
        }, room=sender_id)

        socketio.emit('update_user_list', {
            'user_id': sender_id,
            'last_message': notification_content,
            'last_message_time': timestamp
        }, room=receiver_id)

        # Emit to sender and receiver (include is_image flag)
        socketio.emit('message', {
            'message_id': message_id,
            'sender_id': sender_id,
            'receiver_id': receiver_id,
            'content': content_to_store,
            'timestamp': timestamp,
            'delivered': False,
            'read': False,
            'is_image': is_image
        }, room=sender_id)

        # Deliver to receiver and mark delivered if online
        if receiver_id in online_users and online_users[receiver_id]:
            messages_collection.update_one({'_id': ObjectId(message_id)}, {'$set': {'delivered': True}})
            socketio.emit('message_delivered', {
                'message_id': message_id,
                'sender_id': sender_id,
                'receiver_id': receiver_id
            }, room=sender_id)

            socketio.emit('message', {
                'message_id': message_id,
                'sender_id': sender_id,
                'receiver_id': receiver_id,
                'content': content_to_store,
                'timestamp': timestamp,
                'delivered': True,
                'read': False,
                'is_image': is_image
            }, room=receiver_id)
        else:
            # still emit to receiver (they'll get it when connecting)
            socketio.emit('message', {
                'message_id': message_id,
                'sender_id': sender_id,
                'receiver_id': receiver_id,
                'content': content_to_store,
                'timestamp': timestamp,
                'delivered': False,
                'read': False,
                'is_image': is_image
            }, room=receiver_id)

        # Save notification to database
        sender = users_collection.find_one({'_id': ObjectId(sender_id)})
        if sender:
            notification = {
                'type': 'message',
                'sender_id': sender_id,
                'receiver_id': receiver_id,
                'message_id': message_id,
                'content': f"{sender['name']} sent you a message",
                'message_content': notification_content,
                'timestamp': datetime.utcnow(),
                'read': False
            }
            notifications_collection.insert_one(notification)


        # Send notification to receiver
        socketio.emit('notification', {
            'message_id': message_id,
            'sender_id': sender_id,
            'content': notification_content,
            'timestamp': timestamp,
            'is_image': is_image
        }, room=receiver_id)

    @socketio.on('update_message')
    def handle_update_message(data):
        message_id = data.get('message_id')
        sender_id = data.get('sender_id')
        receiver_id = data.get('receiver_id')
        content = data.get('content')
    
        if not all([message_id, sender_id, content]):
            return
    
        # Find existing message
        existing = messages_collection.find_one({'_id': ObjectId(message_id)})
        if not existing:
            return
    
        # If new content is image base64 → upload to Cloudinary and delete old image if existed
        try:
            if isinstance(content, str) and content.startswith('data:image'):
                # Upload new image to Cloudinary
                upload_result = cloud_utils.upload_image(content, folder="betel/messages")
                new_url = upload_result.get('secure_url')
                new_public_id = upload_result.get('public_id')
                print(f"New image uploaded to Cloudinary: {new_url}")
    
                # Delete previous image from Cloudinary if present
                old_public_id = existing.get('public_id')
                if old_public_id:
                    try:
                        cloud_utils.delete_image(old_public_id)
                        print(f"Deleted old image from Cloudinary: {old_public_id}")
                    except Exception as e:
                        print(f"Failed to delete old image from Cloudinary: {e}")
    
                # Update DB with new image URL & public_id
                update_result = messages_collection.update_one(
                    {'_id': ObjectId(message_id)},
                    {'$set': {
                        'content': new_url,
                        'is_image': True,
                        'public_id': new_public_id,
                        'updated_at': datetime.utcnow()
                    }}
                )
                
                if update_result.modified_count > 0:
                    print(f"Successfully updated message {message_id} with new image")
                else:
                    print(f"Failed to update message {message_id} in database")
                    
                updated_content = new_url
                is_image = True
            else:
                # Update to text - remove any public_id and delete image from Cloudinary if switching from image to text
                old_public_id = existing.get('public_id')
                if old_public_id and existing.get('is_image', False):
                    try:
                        cloud_utils.delete_image(old_public_id)
                        print(f"Deleted image from Cloudinary when switching to text: {old_public_id}")
                    except Exception as e:
                        print(f"Failed to delete image from Cloudinary: {e}")
    
                # Update DB to text message
                update_result = messages_collection.update_one(
                    {'_id': ObjectId(message_id)},
                    {'$set': {
                        'content': content, 
                        'is_image': False, 
                        'updated_at': datetime.utcnow()
                    }, '$unset': {'public_id': ""}}
                )
                
                if update_result.modified_count > 0:
                    print(f"Successfully updated message {message_id} with text content")
                else:
                    print(f"Failed to update message {message_id} in database")
                    
                updated_content = content
                is_image = False
                
        except Exception as e:
            print("Error updating message with Cloudinary:", e)
            return
    
        # Verify the update was successful by fetching the updated message
        updated_message = messages_collection.find_one({'_id': ObjectId(message_id)})
        if not updated_message:
            print(f"Failed to fetch updated message {message_id}")
            return
    
        print(f"Message updated successfully: {updated_message['content']}")
    
        # Notify both users about the update
        for user_id in [sender_id, receiver_id]:
            socketio.emit('message_updated', {
                'message_id': message_id,
                'content': updated_content,
                'is_image': is_image
            }, room=user_id)

    @socketio.on('delete_message')
    def handle_delete_message(data):
        message_id = data.get('message_id')
        sender_id = data.get('sender_id')
        receiver_id = data.get('receiver_id')

        if not all([message_id, sender_id, receiver_id]):
            return

        # Find and delete stored Cloudinary image if message was an image
        existing = messages_collection.find_one({'_id': ObjectId(message_id)})
        if existing:
            public_id = existing.get('public_id')
            if public_id:
                try:
                    cloud_utils.delete_image(public_id)
                    print(f"Deleted image from Cloudinary: {public_id}")
                except Exception as e:
                    print(f"Failed to delete image from Cloudinary: {e}")

        # Delete DB record
        messages_collection.delete_one({'_id': ObjectId(message_id)})

        # Emit deletion event to both participants
        for user_id in [sender_id, receiver_id]:
            socketio.emit('message_deleted', {'message_id': message_id}, room=user_id)


    @socketio.on('mark_read')
    def handle_mark_read(data):
        user_id = data.get('user_id')
        sender_id = data.get('sender_id')
        
        if not all([user_id, sender_id]):
            return
        
        messages_collection.update_many(
            {'sender_id': sender_id, 'receiver_id': user_id, 'read': False},
            {'$set': {'read': True}}
        )
        
        socketio.emit('messages_read', {'sender_id': sender_id}, room=user_id)
        socketio.emit('messages_read', {'sender_id': user_id}, room=sender_id)