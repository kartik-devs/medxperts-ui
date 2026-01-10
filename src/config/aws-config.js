// src/config/aws-config.js
// NOTE: The original implementation imported the Node-only `aws-sdk` package
// which caused runtime errors when bundled into the browser (e.g. sts.js
// reading prototype of undefined). Frontend builds should not include
// `aws-sdk`. S3 operations must be performed on the backend API.

const WARNING = 'S3 operations are disabled in the browser build. Use backend APIs instead.';

export const AWS_CONFIG = {
  region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID || '',
  secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || '',
  bucketName: import.meta.env.VITE_S3_BUCKET_NAME || 'finallcpreports',
};

export const initializeAWS = () => {
  console.warn(WARNING);
  return false;
};

export const uploadFileToS3 = async () => {
  throw new Error(WARNING + ' Call your backend upload endpoint instead.');
};

export const listS3Files = async () => {
  throw new Error(WARNING + ' Call your backend listing endpoint instead.');
};

export const generatePresignedUrl = async () => {
  throw new Error(WARNING + ' Request a presigned URL from the backend.');
};

export default null;