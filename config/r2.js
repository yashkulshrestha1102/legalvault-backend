// config/r2.js
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;

const isR2Configured = () => {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL
  );
};

const uploadToR2 = async ({ buffer, key, contentType, metadata = {} }) => {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    Metadata: metadata,
    CacheControl: 'public, max-age=31536000, immutable',
  });

  await r2Client.send(command);
  return { key, url: `${process.env.R2_PUBLIC_URL}/${key}` };
};

const getSignedDownloadUrl = async (key, expiresIn = 3600) => {
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
  return await getSignedUrl(r2Client, command, { expiresIn });
};

const deleteFromR2 = async (key) => {
  const command = new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key });
  await r2Client.send(command);
};

const fileExistsInR2 = async (key) => {
  try {
    const command = new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key });
    await r2Client.send(command);
    return true;
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw err;
  }
};

module.exports = {
  r2Client,
  uploadToR2,
  getSignedDownloadUrl,
  deleteFromR2,
  fileExistsInR2,
  isR2Configured,
  BUCKET_NAME,
};
