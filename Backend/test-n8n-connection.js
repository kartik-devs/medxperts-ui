/**
 * Test N8N Webhook Connectivity
 * Run this to verify if N8N webhooks are accessible from the backend
 */

import dotenv from 'dotenv';
dotenv.config();

// Use native fetch (Node 18+) or import node-fetch
const fetch = globalThis.fetch || (await import('node-fetch')).default;

const testUrls = {
  'MCP Generate': process.env.N8N_WEBHOOK_URL_MCP_GENERATE || 'https://n8n-dev.datakernels.in/webhook/0488eff1-3f7b-4000-8acf-db7b94cc2c5a',
  'LCP Generate': process.env.N8N_WEBHOOK_URL_LCP_GENERATE || 'https://n8n.datakernels.in/webhook/mainworkflow',
  'MCP/LCP Case': process.env.N8N_WEBHOOK_URL_MCP || 'https://n8n.datakernels.in/webhook/awscrm',
  'Upload': process.env.N8N_WEBHOOK_URL_UPLOAD || 'https://n8n.datakernels.in/webhook/Upload',
};

console.log('🧪 Testing N8N Webhook Connectivity...\n');

async function testWebhook(name, url) {
  console.log(`\n📡 Testing: ${name}`);
  console.log(`🔗 URL: ${url}`);
  
  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        test: true,
        timestamp: new Date().toISOString(),
        source: 'connectivity_test'
      }),
    });
    
    const duration = Date.now() - startTime;
    const responseText = await response.text();
    
    console.log(`✅ Status: ${response.status} ${response.statusText}`);
    console.log(`⏱️  Response time: ${duration}ms`);
    console.log(`📄 Response: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
    
    return { success: true, status: response.status, duration };
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(`📋 Error details:`, error);
    return { success: false, error: error.message };
  }
}

// Test all webhooks
for (const [name, url] of Object.entries(testUrls)) {
  await testWebhook(name, url);
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between tests
}

console.log('\n\n✅ Test completed!');
