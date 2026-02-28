"""
Image processing utilities for Quality Check.
Centralizes image compression and WebP conversion logic.
"""

import io
from PIL import Image as PILImage
from django.core.files.base import ContentFile


def process_and_compress_image(image_file, max_dimension=1600, quality=85):
    """
    Process and compress an uploaded image to WebP format.
    
    Args:
        image_file: Django UploadedFile or similar file object
        max_dimension: Maximum width/height (maintains aspect ratio)
        quality: WebP quality setting (1-100)
    
    Returns:
        tuple: (ContentFile, filename) - Compressed image and its filename
    
    Raises:
        ValueError: If image processing fails
    """
    try:
        with PILImage.open(image_file) as img:
            # Convert RGBA/P to RGB for WebP compatibility
            if img.mode in ("RGBA", "P", "LA"):
                # Create white background for transparency
                rgb_img = PILImage.new("RGB", img.size, (255, 255, 255))
                if img.mode == "P":
                    img = img.convert("RGBA")
                rgb_img.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
                img = rgb_img
            elif img.mode != "RGB":
                img = img.convert("RGB")
            
            # Resize to max dimension (maintains aspect ratio)
            img.thumbnail((max_dimension, max_dimension), PILImage.Resampling.LANCZOS)
            
            # Save as WebP with specified quality
            compressed_buffer = io.BytesIO()
            img.save(compressed_buffer, format='WEBP', quality=quality, method=6)
            compressed_buffer.seek(0)
            
            # Create filename with .webp extension
            original_name = image_file.name.rsplit('.', 1)[0] if '.' in image_file.name else image_file.name
            webp_filename = f"{original_name}.webp"
            
            # Create Django File object with correct content type for GCS
            compressed_file = ContentFile(compressed_buffer.read(), name=webp_filename)
            compressed_file.content_type = 'image/webp'  # Tells django-storages to set correct Content-Type on GCS
            
            return compressed_file, webp_filename
            
    except Exception as e:
        raise ValueError(f"Image processing failed: {str(e)}")
