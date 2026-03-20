import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export async function uploadBufferToCloudinary(
  buffer,
  {
    folder = 'jobportal',
    resourceType = 'auto',
    publicId,
    originalFilename = 'file',
  } = {}
) {
  if (!buffer) {
    throw new Error('No file buffer provided for Cloudinary upload');
  }

  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder,
      resource_type: resourceType,
      use_filename: true,
      unique_filename: true,
      filename_override: originalFilename,
    };
    if (publicId) {
      uploadOptions.public_id = publicId;
    }

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) return reject(error);
      return resolve(result);
    });

    stream.end(buffer);
  });
}

