import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

/**
 * PDFs/docs must use resource_type "raw" so delivery URLs use /raw/upload/ (not /image/upload/).
 */
export function cloudinaryResourceTypeForFile(mimetype = '', originalFilename = '') {
  const mime = (mimetype || '').toLowerCase();
  const name = (originalFilename || '').toLowerCase();

  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';

  const rawMimeTypes = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
    'application/rtf',
  ]);
  if (rawMimeTypes.has(mime)) return 'raw';
  if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rtf)$/i.test(name)) return 'raw';

  return 'auto';
}

export async function uploadBufferToCloudinary(
  buffer,
  {
    folder = 'jobportal',
    resourceType = 'auto',
    publicId,
    originalFilename = 'file',
    accessMode = 'public',
  } = {}
) {
  if (!buffer) {
    throw new Error('No file buffer provided for Cloudinary upload');
  }

  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder,
      type: 'upload',
      resource_type: resourceType,
      access_mode: accessMode,
      access_control: [{ access_type: 'anonymous' }],
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

