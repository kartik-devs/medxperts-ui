/**
 * Test script to verify Excel file permissions
 * Run with: node test-permissions.js
 */
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import xlsx from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

async function testExcelPermissions() {
  try {
    console.log('🔍 Testing Excel file permissions...');
    console.log('📍 Bucket: finallcpreports');
    console.log('📄 File: user info1.xlsx');
    console.log('');

    // Fetch Excel file from S3
    const command = new GetObjectCommand({ 
      Bucket: 'finallcpreports', 
      Key: 'user info1.xlsx' 
    });
    
    const response = await s3.send(command);
    const chunks = [];
    
    for await (const chunk of response.Body) { 
      chunks.push(chunk); 
    }
    
    const buffer = Buffer.concat(chunks);
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet);
    
    console.log(`📊 Excel file loaded successfully!`);
    console.log(`📋 Total rows: ${data.length}`);
    console.log(`📝 Sheet name: ${workbook.SheetNames[0]}`);
    console.log('');

    // Analyze column structure
    if (data.length > 0) {
      console.log('📋 Column headers found:');
      Object.keys(data[0]).forEach((header, index) => {
        console.log(`   ${index + 1}. "${header}"`);
      });
      console.log('');
    }

    // Process permissions
    const userPermissions = {};
    let processedRows = 0;
    let skippedRows = 0;
    
    console.log('🔄 Processing rows...');
    
    data.forEach((row, index) => {
      // Try different possible column names for Gmail ID
      const gmailId = row['Gmail ID'] || 
                     row['gmail_id'] || 
                     row['email'] || 
                     row['Email'] || 
                     row['Gmail'] ||
                     row['User Email'] ||
                     row['user_email'];
      
      // Try different possible column names for Case ID
      const caseId = row['Case ID'] || 
                     row['case_id'] || 
                     row['CaseID'] ||
                     row['Case Id'] ||
                     row['ID'] ||
                     row['id'];
      
      if (gmailId && caseId) {
        const email = gmailId.toString().toLowerCase().trim();
        let pid = caseId.toString().trim();
        
        // Validate and normalize case ID (1-4 digits)
        if (/^\d{1,4}$/.test(pid)) {
          pid = pid.padStart(4, '0');
          
          if (!userPermissions[email]) {
            userPermissions[email] = [];
          }
          
          // Avoid duplicates
          if (!userPermissions[email].includes(pid)) {
            userPermissions[email].push(pid);
          }
          
          processedRows++;
        } else {
          console.log(`⚠️ Row ${index + 1}: Invalid case ID format "${pid}"`);
          skippedRows++;
        }
      } else {
        console.log(`⚠️ Row ${index + 1}: Missing data - Gmail: "${gmailId || 'MISSING'}", Case: "${caseId || 'MISSING'}"`);
        skippedRows++;
      }
    });
    
    console.log('');
    console.log('✅ Processing complete!');
    console.log(`📊 Statistics:`);
    console.log(`   📋 Total rows: ${data.length}`);
    console.log(`   ✅ Successfully processed: ${processedRows}`);
    console.log(`   ⚠️ Skipped (invalid/missing): ${skippedRows}`);
    console.log(`   👥 Unique users: ${Object.keys(userPermissions).length}`);
    console.log('');
    
    // Show sample permissions
    console.log('📋 Sample user permissions:');
    const sampleUsers = Object.keys(userPermissions).slice(0, 5);
    sampleUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user}: [${userPermissions[user].join(', ')}]`);
    });
    
    if (Object.keys(userPermissions).length > 5) {
      console.log(`   ... and ${Object.keys(userPermissions).length - 5} more users`);
    }
    
    console.log('');
    console.log('🎯 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    if (error.name === 'NoSuchKey') {
      console.error('📄 Excel file "user info1.xlsx" not found in finallcpreports bucket');
      console.error('💡 Make sure the file is uploaded to the correct location');
    } else if (error.name === 'AccessDenied') {
      console.error('🔐 Access denied to finallcpreports bucket or user info1.xlsx file');
      console.error('💡 Check your AWS credentials and bucket permissions');
    } else if (error.name === 'CredentialsProviderError') {
      console.error('🔑 AWS credentials not found. Please check your .env file:');
      console.error('   AWS_ACCESS_KEY_ID=your_key');
      console.error('   AWS_SECRET_ACCESS_KEY=your_secret');
      console.error('   AWS_REGION=us-east-1');
    }
  }
}

// Run the test
testExcelPermissions();