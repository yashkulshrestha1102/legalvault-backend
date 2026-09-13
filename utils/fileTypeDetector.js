/**
 * Detect file type category from MIME type
 */
const getFileType = (mimeType) => {
  if (!mimeType) return 'other';
  
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) return 'word';
  
  if (
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'text/csv'
  ) return 'excel';
  
  if (mimeType.startsWith('text/')) return 'text';
  
  return 'other';
};

/**
 * Allowed MIME types for upload (broad — allow everything legal)
 */
const ALLOWED_MIME_TYPES = [
  // PDF
  'application/pdf',
  // Images
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml', 'image/tiff',
  // Word
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // PowerPoint
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Text
  'text/plain', 'text/csv', 'text/html', 'text/markdown',
  // Archives (optional)
  'application/zip', 'application/x-zip-compressed',
  'application/x-rar-compressed',
  // Misc
  'application/json', 'application/xml', 'text/xml'
];

const isAllowedMimeType = (mimeType) => ALLOWED_MIME_TYPES.includes(mimeType);

module.exports = { getFileType, isAllowedMimeType, ALLOWED_MIME_TYPES };