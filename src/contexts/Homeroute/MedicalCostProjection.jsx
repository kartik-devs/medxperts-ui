// MCP N8N Workflow Integration
// Direct webhook triggering for Medical Cost Projection workflows

// N8N Webhook URLs from environment variables
const N8N_GENERATE_WORKFLOW = import.meta.env.VITE_N8N_WEBHOOK_URL_MCP ;
const N8N_UPLOAD_WEBHOOK = import.meta.env.VITE_N8N_WEBHOOK_URL_UPLOAD ;

/**
 * STEP 1: Generate Case ID via N8N Workflow
 * Triggers the workflow to create a new MCP case
 */
export const generateMCPCase = async (patientData) => {
  console.log('[MCP] Generating case ID via workflow...');
  
  try {
    const res = await fetch(N8N_GENERATE_WORKFLOW, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: patientData.fullName,
        gender: patientData.gender,
        maritalStatus: patientData.maritalStatus,
        ethnicity: patientData.ethnicity,
        dateOfBirth: patientData.dateOfBirth,
        email: patientData.email,
        source: 'mcp_generate_case'
      }),
    });

    // Handle empty or non-JSON response
    const responseText = await res.text();
    let data = {};
    
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      console.log('[MCP] Non-JSON response:', responseText);
      // If the response is not JSON but the status is OK, consider it a success
      if (res.ok) {
        return {
          success: true,
          message: 'Workflow triggered successfully! Please check your email or dashboard for updates.',
          caseId: null
        };
      }
    }

    console.log('[MCP] Workflow response:', data);

    if (!res.ok) {
      throw new Error(data.error || `Workflow failed with status ${res.status}`);
    }

    // Check if workflow returned a case ID
    if (data.caseId) {
      return {
        success: true,
        caseId: data.caseId,
        message: 'Case ID generated successfully'
      };
    } else {
      return {
        success: true,
        message: 'Workflow triggered successfully! Please check your email or dashboard for updates.',
        caseId: null
      };
    }

  } catch (err) {
    console.error('[MCP] Workflow trigger error:', err);
    throw new Error(`Failed to trigger workflow: ${err.message}`);
  }
};

/**
 * STEP 2: Upload Files to S3 via N8N Webhook
 * Uploads documents for a case
 */
export const uploadMCPFiles = async (caseId, files, patientData) => {
  console.log('[MCP] Uploading files to S3...', {
    caseId,
    fileCount: files.length,
    fileNames: files.map(f => f.name)
  });

  try {
    const formData = new FormData();
    formData.append('caseId', caseId);
    formData.append('fullName', patientData.fullName);
    formData.append('gender', patientData.gender);
    formData.append('maritalStatus', patientData.maritalStatus);
    formData.append('ethnicity', patientData.ethnicity);
    formData.append('dateOfBirth', patientData.dateOfBirth);
    formData.append('email', patientData.email);
    
    // Add all files to FormData
    files.forEach((file) => {
      formData.append('file', file);
    });

    const res = await fetch(N8N_UPLOAD_WEBHOOK, {
      method: 'POST',
      body: formData,
    });

    // Handle empty or non-JSON response
    const responseText = await res.text();
    let responseData = {};
    
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      console.log('[MCP] Non-JSON response:', responseText);
      // If the response is not JSON but the status is OK, consider it a success
      if (res.ok) {
        return {
          success: true,
          message: 'Files uploaded successfully to S3'
        };
      }
    }

    console.log('[MCP] Upload webhook response:', responseData);

    if (!res.ok) {
      throw new Error(responseData.error || `Upload failed with status ${res.status}`);
    }

    return {
      success: true,
      message: 'Files uploaded successfully to S3'
    };

  } catch (err) {
    console.error('[MCP] Upload error:', err);
    throw new Error(`Upload failed: ${err.message}`);
  }
};

/**
 * Upload Additional Files to Existing Case
 */
export const uploadToExistingMCPCase = async (caseId, files) => {
  console.log('[MCP] Uploading additional files to existing case:', caseId);

  try {
    const formData = new FormData();
    formData.append('caseId', caseId);
    formData.append('isAdditionalUpload', 'true');
    
    // Add files if any exist
    files.forEach((file) => {
      formData.append('attachments', file);
    });

    const res = await fetch(N8N_UPLOAD_WEBHOOK, {
      method: 'POST',
      body: formData,
    });

    // Handle empty or non-JSON response
    const responseText = await res.text();
    let data = {};
    
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      console.log('[MCP] Non-JSON response from existing case upload:', responseText);
      // If the response is not JSON but the status is OK, consider it a success
      if (res.ok) {
        return {
          success: true,
          message: 'Files uploaded successfully to existing case'
        };
      }
    }

    console.log('[MCP] Upload to existing case response:', data);

    if (!res.ok) {
      throw new Error(data.error || `Upload failed with status ${res.status}`);
    }

    return {
      success: true,
      message: 'Files uploaded successfully to existing case'
    };

  } catch (err) {
    console.error('[MCP] Upload error:', err);
    throw new Error(`Upload failed: ${err.message}`);
  }
};

/**
 * Test N8N Webhook Connectivity
 */
export const testMCPWebhookConnection = async () => {
  try {
    const response = await fetch(N8N_GENERATE_WORKFLOW, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        test: true,
        timestamp: new Date().toISOString()
      }),
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

// Export webhook URLs for reference
export { N8N_GENERATE_WORKFLOW, N8N_UPLOAD_WEBHOOK };
