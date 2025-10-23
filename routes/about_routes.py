from flask import Blueprint, render_template, session, redirect, url_for
from bson.objectid import ObjectId
from utils.db import db, users_collection

about_bp = Blueprint('about', __name__)

@about_bp.route('/about')
def about():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    user = users_collection.find_one({'_id': ObjectId(session['user_id'])})
    return render_template('about.html', user=user)