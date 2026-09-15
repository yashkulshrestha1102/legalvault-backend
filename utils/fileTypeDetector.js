/**
 * Detect file type category from MIME type
 */
const getFileType = (mimeType) => {
  if (!mimeType) return 'other';

  // ✅ PDF
  if (mimeType === 'application/pdf') return 'pdf';

  // ✅ Images
  if (mimeType.startsWith('image/')) return 'image';

  // ✅ Word documents
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) return 'word';

  // ✅ Excel / CSV
  if (
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'text/csv'
  ) return 'excel';

  // ✅ XML files (Tally data, config files) — treat as TEXT
  if (
    mimeType === 'application/xml' ||
    mimeType === 'text/xml' ||
    mimeType === 'application/x-xml' ||
    mimeType.includes('xml')
  ) return 'text';

  // ✅ JSON files — treat as TEXT
  if (
    mimeType === 'application/json' ||
    mimeType.includes('json')
  ) return 'text';

  // ✅ Other text files
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
  // ✅ XML files (Tally, config)
  'application/xml', 'text/xml', 'application/x-xml',
  // ✅ JSON
  'application/json',
  // Archives (optional)
  'application/zip', 'application/x-zip-compressed',
  'application/x-rar-compressed',
  // ✅ Fallback for unknown types (some Tally files come as octet-stream)
  'application/octet-stream'
];

/**
 * Check if a mime type is allowed for upload
 * Uses both whitelist + fallback patterns
 */
const isAllowedMimeType = (mimeType) => {
  if (!mimeType) return false;

  // ✅ Direct match in whitelist
  if (ALLOWED_MIME_TYPES.includes(mimeType)) return true;

  // ✅ Fallback: allow anything that looks like XML/JSON/text
  if (mimeType.includes('xml')) return true;
  if (mimeType.includes('json')) return true;
  if (mimeType.startsWith('text/')) return true;

  return false;
};

module.exports = { getFileType, isAllowedMimeType, ALLOWED_MIME_TYPES };