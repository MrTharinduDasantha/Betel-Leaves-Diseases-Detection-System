import os
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

# Load .env in development
load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

def upload_image(file_obj, folder="betel/profile_pics"):
    # file_obj can be FileStorage; cloudinary.uploader.upload accepts it directly
    result = cloudinary.uploader.upload(
        file_obj,
        folder=folder,
        resource_type="image"
    )
    return {"secure_url": result.get("secure_url"), "public_id": result.get("public_id")}

def delete_image(public_id):
    """Delete an image from Cloudinary by public_id. Returns result dict."""
    if not public_id:
        return None
    return cloudinary.uploader.destroy(public_id, resource_type="image")