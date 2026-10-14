/**
 * Detect file type category from MIME type AND filename
 * v2 — Now handles PowerPoint, better Word/Excel detection
 */

const getFileType = (mimeType, filename = '') => {
  const ext = (filename || '').toLowerCase().split('.').pop() || '';
  const mime = (mimeType || '').toLowerCase();

  if (!mime && !ext) return 'other';

  // ✅ PDF
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';

  // ✅ Images
  if (
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'ico'].includes(ext)
  ) return 'image';

  // ✅ Word (must check before generic xml/json)
  if (
    mime.includes('wordprocessingml') ||
    mime === 'application/msword' ||
    ['doc', 'docx'].includes(ext)
  ) return 'word';

  // ✅ Excel / CSV
  if (
    mime.includes('spreadsheetml') ||
    mime === 'application/vnd.ms-excel' ||
    ['xls', 'xlsx'].includes(ext)
  ) return 'excel';

  // ✅ CSV (separate but same display)
  if (mime === 'text/csv' || ext === 'csv') return 'excel';

  // ✅ PowerPoint
  if (
    mime.includes('presentationml') ||
    mime === 'application/vnd.ms-powerpoint' ||
    ['ppt', 'pptx'].includes(ext)
  ) return 'pptx';

  // ✅ ZIP
  if (
    mime.includes('zip') ||
    mime.includes('compressed') ||
    ['zip'].includes(ext)
  ) return 'zip';

  // ✅ RAR / 7z
  if (
    mime.includes('rar') ||
    ['rar', '7z'].includes(ext)
  ) return 'rar';

  // ✅ XML (must be AFTER word/excel/pptx checks!)
  if (
    mime === 'application/xml' ||
    mime === 'text/xml' ||
    mime === 'application/x-xml' ||
    ext === 'xml'
  ) return 'xml';

  // ✅ JSON
  if (mime === 'application/json' || ext === 'json') return 'json';

  // ✅ Text / Code
  if (
    mime.startsWith('text/') ||
    ['txt', 'md', 'log', 'html', 'htm', 'css', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'sql', 'env', 'yaml', 'yml'].includes(ext)
  ) return 'text';

  // ✅ Media (optional)
  if (mime.startsWith('video/') || mime.startsWith('audio/')) return 'media';

  return 'other';
};

/**
 * Allowed MIME types for upload
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
  // XML
  'application/xml', 'text/xml', 'application/x-xml',
  // JSON
  'application/json',
  // Archives
  'application/zip', 'application/x-zip-compressed',
  'application/x-rar-compressed',
  // Fallback
  'application/octet-stream',
];

const isAllowedMimeType = (mimeType) => {
  if (!mimeType) return false;
  if (ALLOWED_MIME_TYPES.includes(mimeType)) return true;
  if (mimeType.includes('xml')) return true;
  if (mimeType.includes('json')) return true;
  if (mimeType.startsWith('text/')) return true;
  return false;
};

module.exports = { getFileType, isAllowedMimeType, ALLOWED_MIME_TYPES };