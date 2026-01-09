// API Configuration for Life Care Plan n8n Integration
// This file contains the API logic for connecting to n8n webhook

// Use server proxy to avoid CORS issues
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const LCP_UPLOAD_URL = `${API_BASE}/api/lcp-upload`;

// API function to send data via server proxy
export const sendToN8nWebhook = async (formData) => {
  console.log('🚀 Sending to LCP webhook via proxy:', LCP_UPLOAD_URL);
  
  try {
    const response = await fetch(LCP_UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });

    console.log('📡 LCP response status:', response.status);

    const text = await response.text();
    console.log('📡 LCP response text:', text);
    
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      console.error('❌ LCP webhook error:', response.status, data);
      throw new Error(`Webhook error ${response.status}: ${data.raw || response.statusText}`);
    }

    console.log('✅ LCP webhook success:', data);
    return {
      success: true,
      data: data.data || data,
      status: response.status
    };
  } catch (err) {
    console.error('❌ Error calling LCP webhook:', err);
    throw new Error(`Failed to reach workflow: ${err.message}`);
  }
};

// Helper function to create form data for new patient
export const createNewPatientFormData = (files, metadata) => {
  const formData = new FormData();
  
  // Add metadata
  formData.append('mode', 'new');
  formData.append('workflowVersion', metadata.workflowVersion || 'LCP V3 (latest)');
  formData.append('reportVersion', metadata.reportVersion || 'LCP REPORT');
  
  // Add timestamp
  formData.append('timestamp', new Date().toISOString());
  
  // Add files
  files.forEach((file, index) => {
    formData.append('files', file, file.name);
    formData.append(`fileName_${index}`, file.name);
    formData.append(`fileSize_${index}`, file.size.toString());
  });
  
  return formData;
};

// Helper function to create form data for existing patient
export const createExistingPatientFormData = (caseId, files, metadata) => {
  const formData = new FormData();
  
  // Add metadata
  formData.append('mode', 'existing');
  formData.append('caseId', caseId);
  formData.append('workflowVersion', metadata.workflowVersion || 'LCP V3 (latest)');
  formData.append('reportVersion', metadata.reportVersion || 'LCP REPORT');
  formData.append('batchMode', metadata.batchMode ? 'true' : 'false');
  
  // Add timestamp
  formData.append('timestamp', new Date().toISOString());
  
  // Add files if any
  if (files && files.length > 0) {
    files.forEach((file, index) => {
      formData.append('files', file, file.name);
      formData.append(`fileName_${index}`, file.name);
      formData.append(`fileSize_${index}`, file.size.toString());
    });
  }
  
  return formData;
};

// Main API functions
export const processNewPatient = async (files, metadata) => {
  const formData = createNewPatientFormData(files, metadata);
  return await sendToN8nWebhook(formData);
};

export const processExistingPatient = async (caseId, files, metadata) => {
  const formData = createExistingPatientFormData(caseId, files, metadata);
  return await sendToN8nWebhook(formData);
};

// Test function to verify webhook connectivity
export const testWebhookConnection = async () => {
  try {
    const testFormData = new FormData();
    testFormData.append('test', 'true');
    testFormData.append('timestamp', new Date().toISOString());
    
    const response = await fetch(LCP_UPLOAD_URL, {
      method: 'POST',
      body: testFormData,
    });
    
    return {
      success: response.ok,
      status: response.status,
      message: response.ok ? 'Webhook connection successful' : 'Webhook connection failed'
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: `Connection error: ${error.message}`
    };
  }
};

// Export the webhook URL for direct access if needed
export { LCP_UPLOAD_URL };