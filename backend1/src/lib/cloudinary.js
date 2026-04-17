const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

function ensureCloudinaryConfig() {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend1/.env'
    );
  }
}

function sanitizePublicId(input) {
  return String(input || 'file').replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function uploadBufferToCloudinary({
  buffer,
  folder = 'jobportal',
  publicId,
  resourceType = 'auto',
  originalFilename,
}) {
  ensureCloudinaryConfig();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        public_id: publicId ? sanitizePublicId(publicId) : undefined,
        filename_override: originalFilename || undefined,
        use_filename: false,
        unique_filename: true,
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
}

async function destroyByCloudinaryUrl(url, resourceType = 'image') {
  if (!url || typeof url !== 'string') return;
  const parts = url.split('/');
  const uploadIndex = parts.findIndex((p) => p === 'upload');
  if (uploadIndex < 0) return;
  const pathParts = parts.slice(uploadIndex + 1);
  if (pathParts.length < 2) return;
  if (/^v\d+$/.test(pathParts[0])) pathParts.shift();
  const publicIdWithExt = pathParts.join('/');
  const publicId = publicIdWithExt.replace(/\.[^.]+$/, '');
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch {
    // Ignore deletion failures; upload replacement still succeeds.
  }
}

module.exports = {
  cloudinary,
  uploadBufferToCloudinary,
  destroyByCloudinaryUrl,
};
