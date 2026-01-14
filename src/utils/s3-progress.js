/**
 * Utility functions for fetching MCP progress from S3
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

/**
 * Fetch progress for a specific case from S3 via backend proxy
 * @param {string} caseId - The case ID to fetch progress for
 * @returns {Promise<Object>} Progress data
 */
export async function fetchProgressFromS3(caseId) {
  try {
    const response = await fetch(`${API_BASE}/api/s3-progress/${caseId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching progress for case ${caseId}:`, error);
    throw error;
  }
}

/**
 * Poll progress for a case with automatic retries
 * @param {string} caseId - The case ID to poll
 * @param {Function} onUpdate - Callback function called with progress updates
 * @param {Object} options - Polling options
 * @returns {Function} Stop polling function
 */
export function pollProgress(caseId, onUpdate, options = {}) {
  const {
    interval = 3000, // Poll every 3 seconds
    maxRetries = 5,
    onError = console.error,
    stopOnComplete = true
  } = options;
  
  let retryCount = 0;
  let isPolling = true;
  
  const poll = async () => {
    if (!isPolling) return;
    
    try {
      const progress = await fetchProgressFromS3(caseId);
      
      // Reset retry count on successful fetch
      retryCount = 0;
      
      // Call update callback
      onUpdate(progress);
      
      // Stop polling if completed and stopOnComplete is true
      if (stopOnComplete && progress.status === 'COMPLETED') {
        console.log(`✅ Case ${caseId} completed, stopping polling`);
        isPolling = false;
        return;
      }
      
      // Schedule next poll
      if (isPolling) {
        setTimeout(poll, interval);
      }
      
    } catch (error) {
      retryCount++;
      
      if (retryCount <= maxRetries) {
        console.warn(`⚠️ Retry ${retryCount}/${maxRetries} for case ${caseId}:`, error.message);
        // Exponential backoff
        const backoffDelay = interval * Math.pow(2, retryCount - 1);
        setTimeout(poll, backoffDelay);
      } else {
        console.error(`❌ Max retries exceeded for case ${caseId}`);
        onError(error);
        isPolling = false;
      }
    }
  };
  
  // Start polling
  poll();
  
  // Return stop function
  return () => {
    isPolling = false;
    console.log(`🛑 Stopped polling for case ${caseId}`);
  };
}

/**
 * Fetch progress using the legacy endpoint (fallback)
 * @param {string} caseId - The case ID to fetch progress for
 * @returns {Promise<Object>} Progress data
 */
export async function fetchProgressLegacy(caseId) {
  try {
    const response = await fetch(`${API_BASE}/api/case-status?caseId=${caseId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return { ...data, source: 'legacy' };
  } catch (error) {
    console.error(`Error fetching legacy progress for case ${caseId}:`, error);
    throw error;
  }
}

/**
 * Fetch progress with automatic fallback to legacy endpoint
 * @param {string} caseId - The case ID to fetch progress for
 * @returns {Promise<Object>} Progress data
 */
export async function fetchProgressWithFallback(caseId) {
  try {
    // Try S3 first
    return await fetchProgressFromS3(caseId);
  } catch (error) {
    console.warn(`S3 progress fetch failed for ${caseId}, trying legacy:`, error.message);
    
    try {
      // Fallback to legacy endpoint
      return await fetchProgressLegacy(caseId);
    } catch (legacyError) {
      console.error(`Both S3 and legacy progress fetch failed for ${caseId}`);
      throw legacyError;
    }
  }
}