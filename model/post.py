from datetime import datetime
from bson import ObjectId

class Post:
    def __init__(self, title, description, user_id, image=None):
        self.title = title
        self.description = description
        self.user_id = user_id
        self.image = image
        self.likes = 0
        self.comments = []
        self.date = datetime.utcnow()

    def to_dict(self):
        return {
            'title': self.title,
            'description': self.description,
            'user_id': self.user_id,
            'image': self.image,
            'likes': self.likes,
            'comments': self.comments,
            'date': self.date
        }