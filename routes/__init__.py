def register_blueprints(app):
    # Import blueprints
    from routes.auth_routes import auth_bp
    from routes.dashboard_routes import dashboard_bp
    from routes.disease_detection_routes import disease_detection_bp
    from routes.community_forum_routes import community_forum_bp, register_forum_socketio_handlers
    from routes.consult_officer_routes import consult_officer_bp, register_socketio_handlers
    from routes.cultivation_guide_routes import cultivation_guide_bp
    from routes.about_routes import about_bp
    
    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(disease_detection_bp)
    app.register_blueprint(community_forum_bp)
    app.register_blueprint(consult_officer_bp)
    app.register_blueprint(cultivation_guide_bp)
    app.register_blueprint(about_bp)
    
    # Register Socket.IO handlers
    if 'socketio' in app.extensions:
        register_socketio_handlers(app.extensions['socketio'])
        register_forum_socketio_handlers(app.extensions['socketio'])