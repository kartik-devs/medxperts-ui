import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const S3_PROGRESS_BUCKET = process.env.S3_PROGRESS_BUCKET || 'finallcpreports';

async function checkS3Progress() {
  console.log('🔍 Checking MCP Progress Storage in S3');
  console.log('=====================================');
  console.log(`📦 Bucket: ${S3_PROGRESS_BUCKET}`);
  console.log(`📁 Path: progress/`);
  console.log('');

  try {
    // List all progress files
    console.log('📋 Listing all progress files...\n');
    
    const listCommand = new ListObjectsV2Command({
      Bucket: S3_PROGRESS_BUCKET,
      Prefix: 'progress/',
      MaxKeys: 100
    });

    const listResponse = await s3.send(listCommand);

    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      console.log('⚠️  No progress files found in S3');
      console.log('💡 This is normal if no workflows have been created yet');
      console.log('💡 Run a test: node Backend/test-s3-progress.js');
      return;
    }

    console.log(`✅ Found ${listResponse.Contents.length} progress file(s):\n`);

    // Display each file
    for (const object of listResponse.Contents) {
      const caseId = object.Key.replace('progress/', '').replace('.json', '');
      const size = (object.Size / 1024).toFixed(2);
      const lastModified = object.LastModified.toLocaleString();
      
      console.log(`📄 ${object.Key}`);
      console.log(`   Case ID: ${caseId}`);
      console.log(`   Size: ${size} KB`);
      console.log(`   Last Modified: ${lastModified}`);
      
      // Fetch and display content
      try {
        const getCommand = new GetObjectCommand({
          Bucket: S3_PROGRESS_BUCKET,
          Key: object.Key
        });
        
        const getResponse = await s3.send(getCommand);
        const chunks = [];
        
        for await (const chunk of getResponse.Body) {
          chunks.push(chunk);
        }
        
        const buffer = Buffer.concat(chunks);
        const data = JSON.parse(buffer.toString());
        
        console.log(`   Status: ${data.status || 'UNKNOWN'}`);
        console.log(`   Progress: ${data.progress || 0}%`);
        console.log(`   Step: ${data.step || 'N/A'}`);
        console.log(`   User: ${data.userEmail || data.initiatedBy || 'N/A'}`);
        console.log('');
        
      } catch (err) {
        console.log(`   ⚠️  Could not read file content: ${err.message}`);
        console.log('');
      }
    }

    console.log('✅ S3 Progress Storage Check Complete!');
    console.log(`📍 S3 URL: https://s3.console.aws.amazon.com/s3/buckets/${S3_PROGRESS_BUCKET}?prefix=progress/`);

  } catch (error) {
    console.error('❌ Error checking S3 progress:', error);
    
    if (error.name === 'CredentialsProviderError') {
      console.error('\n🔑 AWS credentials not found. Please check your .env file:');
      console.error('   AWS_ACCESS_KEY_ID=your_key');
      console.error('   AWS_SECRET_ACCESS_KEY=your_secret');
      console.error('   AWS_REGION=us-east-1');
      console.error('   S3_PROGRESS_BUCKET=finallcpreports');
    } else if (error.name === 'NoSuchBucket') {
      console.error(`\n📦 Bucket "${S3_PROGRESS_BUCKET}" does not exist`);
      console.error('   Please create the bucket or update S3_PROGRESS_BUCKET in .env');
    } else if (error.name === 'AccessDenied') {
      console.error('\n🔐 Access denied to S3 bucket');
      console.error('   Please check your AWS credentials have S3 permissions');
    }
  }
}

// Run the check
checkS3Progress();
