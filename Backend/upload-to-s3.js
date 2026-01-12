import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

async function uploadExcelFile() {
  try {
    console.log('📤 Uploading Excel file to S3...');
    
    // Read the Excel file
    const fileContent = fs.readFileSync('user info1.xlsx');
    
    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: 'finallcpreports',
      Key: 'user info1.xlsx',
      Body: fileContent,
      ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    
    const response = await s3.send(command);
    console.log('✅ File uploaded successfully!');
    console.log('📍 Location: finallcpreports/user info1.xlsx');
    console.log('🔄 Server will automatically refresh permissions cache in 5 minutes');
    console.log('💡 Or call refresh API to update immediately');
    
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    
    if (error.name === 'CredentialsProviderError') {
      console.error('🔑 AWS credentials not found. Please check your .env file:');
      console.error('   AWS_ACCESS_KEY_ID=your_key');
      console.error('   AWS_SECRET_ACCESS_KEY=your_secret');
      console.error('   AWS_REGION=us-east-1');
    }
  }
}

uploadExcelFile();