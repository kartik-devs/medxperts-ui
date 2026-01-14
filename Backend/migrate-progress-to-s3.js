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

const S3_PROGRESS_BUCKET = process.env.S3_PROGRESS_BUCKET || 'finallcpreports';
const PROGRESS_FILE = './mcp-progress.json';

async function migrateProgressToS3() {
  try {
    console.log('🔄 Starting migration of progress data to S3...');
    
    // Check if local progress file exists
    if (!fs.existsSync(PROGRESS_FILE)) {
      console.log('ℹ️ No local progress file found. Nothing to migrate.');
      return;
    }
    
    // Read local progress data
    const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
    const progressData = JSON.parse(data);
    
    console.log(`📋 Found ${Object.keys(progressData).length} progress records to migrate`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Migrate each case to S3
    for (const [caseId, caseData] of Object.entries(progressData)) {
      try {
        const s3Key = `progress/${caseId}.json`;
        
        const command = new PutObjectCommand({
          Bucket: S3_PROGRESS_BUCKET,
          Key: s3Key,
          Body: JSON.stringify(caseData, null, 2),
          ContentType: 'application/json',
          Metadata: {
            caseId: caseId,
            status: caseData.status || 'UNKNOWN',
            lastUpdated: Date.now().toString(),
            migratedAt: new Date().toISOString()
          }
        });

        await s3.send(command);
        console.log(`✅ Migrated case ${caseId} to S3: ${S3_PROGRESS_BUCKET}/${s3Key}`);
        successCount++;
        
      } catch (error) {
        console.error(`❌ Failed to migrate case ${caseId}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${successCount} cases`);
    console.log(`   ❌ Failed to migrate: ${errorCount} cases`);
    console.log(`   📍 S3 Bucket: ${S3_PROGRESS_BUCKET}`);
    console.log(`   📁 S3 Path: progress/{caseId}.json`);
    
    if (successCount > 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('💡 You can now safely remove the local mcp-progress.json file');
      console.log('💡 The server will now use S3 for progress storage');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    
    if (error.name === 'CredentialsProviderError') {
      console.error('🔑 AWS credentials not found. Please check your .env file:');
      console.error('   AWS_ACCESS_KEY_ID=your_key');
      console.error('   AWS_SECRET_ACCESS_KEY=your_secret');
      console.error('   AWS_REGION=us-east-1');
      console.error('   S3_PROGRESS_BUCKET=finallcpreports');
    }
  }
}

// Run migration
migrateProgressToS3();