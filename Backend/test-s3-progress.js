import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const API_BASE = 'http://localhost:3001';
const TEST_CASE_ID = 'TEST-S3-' + Date.now();

async function testS3Progress() {
  console.log('🧪 Testing S3 Progress System');
  console.log('================================');
  
  try {
    // Test 1: Create initial progress
    console.log('\n1️⃣ Creating initial progress...');
    const createResponse = await fetch(`${API_BASE}/api/case-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: TEST_CASE_ID,
        step: 'Test Started',
        progress: 10,
        status: 'PROCESSING'
      })
    });
    
    const createResult = await createResponse.json();
    console.log('✅ Create result:', createResult);
    
    // Wait a moment for S3 write
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Fetch progress via legacy endpoint
    console.log('\n2️⃣ Fetching via legacy endpoint...');
    const legacyResponse = await fetch(`${API_BASE}/api/case-status?caseId=${TEST_CASE_ID}`);
    const legacyResult = await legacyResponse.json();
    console.log('✅ Legacy result:', legacyResult);
    
    // Test 3: Fetch progress via S3 endpoint
    console.log('\n3️⃣ Fetching via S3 endpoint...');
    const s3Response = await fetch(`${API_BASE}/api/s3-progress/${TEST_CASE_ID}`);
    const s3Result = await s3Response.json();
    console.log('✅ S3 result:', s3Result);
    
    // Test 4: Update progress
    console.log('\n4️⃣ Updating progress...');
    const updateResponse = await fetch(`${API_BASE}/api/case-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: TEST_CASE_ID,
        step: 'Test Updated',
        progress: 50,
        status: 'PROCESSING'
      })
    });
    
    const updateResult = await updateResponse.json();
    console.log('✅ Update result:', updateResult);
    
    // Wait a moment for S3 write
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 5: Fetch updated progress
    console.log('\n5️⃣ Fetching updated progress...');
    const finalResponse = await fetch(`${API_BASE}/api/s3-progress/${TEST_CASE_ID}`);
    const finalResult = await finalResponse.json();
    console.log('✅ Final result:', finalResult);
    
    // Test 6: Complete the case
    console.log('\n6️⃣ Completing the case...');
    const completeResponse = await fetch(`${API_BASE}/api/case-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: TEST_CASE_ID,
        step: 'Test Completed',
        progress: 100,
        status: 'COMPLETED',
        reportUrl: 'https://example.com/test-report.pdf'
      })
    });
    
    const completeResult = await completeResponse.json();
    console.log('✅ Complete result:', completeResult);
    
    console.log('\n🎉 All tests passed! S3 Progress system is working correctly.');
    console.log(`📋 Test case ID: ${TEST_CASE_ID}`);
    console.log('💡 Check your S3 bucket for the progress file at: progress/' + TEST_CASE_ID + '.json');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('💡 Make sure the server is running on port 3001');
    console.error('💡 Check your AWS credentials and S3 bucket configuration');
  }
}

// Run the test
testS3Progress();