/**
 * Case Search Functionality using API endpoint with User-based Access Control
 * Calls backend API with user authentication for filtered results
 */

const viteApiBaseUrl = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
  : '';

const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const API_BASE_URL = isLocalhost
  ? window.location.origin
  : (viteApiBaseUrl || window.location.origin);

// Get current user email from Firebase auth
function getCurrentUserEmail() {
  // This should be integrated with your Firebase auth
  // For now, we'll get it from localStorage or a global state
  const userEmail = localStorage.getItem('userEmail') || 
                   sessionStorage.getItem('userEmail') ||
                   window.currentUserEmail;
  
  if (!userEmail) {
    throw new Error('User not authenticated. Please log in first.');
  }
  
  return userEmail;
}

// Test function to check API connectivity with user auth
export async function testAPIConnection() {
  console.log('🧪 Testing API connection with user auth...');
  
  const userEmail = getCurrentUserEmail();
  if (!userEmail) {
    console.error('❌ Cannot test API - user not authenticated');
    return false;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/test`, {
      headers: {
        'x-user-email': userEmail
      }
    });
    console.log('📡 Test response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Test API failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ API Test successful:', result);
    return true;
  } catch (error) {
    console.error('❌ API Test failed:', error);
    return false;
  }
}

/**
 * Search case IDs from S3 bucket - filtered by user permissions
 * @param {string} searchQuery - The search term to filter case IDs
 * @returns {Promise<Array<string>>} Array of matching case IDs for the user
 */
export async function searchCaseIds(searchQuery = '') {
  const q = searchQuery?.trim();
  const userEmail = getCurrentUserEmail();
  
  if (!userEmail) {
    console.error('❌ Cannot search cases - user not authenticated');
    return [];
  }
  
  console.log('🔍 Searching for case IDs with query:', q, 'for user:', userEmail);

  try {
    const url = `${API_BASE_URL}/api/search-cases?q=${encodeURIComponent(q || '')}&gmailId=${encodeURIComponent(userEmail)}`;
    console.log('📡 Making request to:', url);
    
    const response = await fetch(url);
    console.log('📡 Response status:', response.status);
    
    if (response.status === 401) {
      console.error('🚫 Authentication required');
      return [];
    }
    
    if (response.status === 403) {
      console.error('🚫 Access denied');
      return [];
    }
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const caseIds = await response.json();
    console.log('✅ Found case IDs for user:', caseIds);
    return Array.isArray(caseIds) ? caseIds : [];
  } catch (err) {
    console.error('❌ Case search error:', err);
    
    // Check if it's a network error
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      console.error('🚨 Network error - API server might not be running on port 3001');
    }
    
    return [];
  }
}

// Function to get all cases for the current user (no search filter)
export async function getAllCaseIds() {
  console.log('📋 Getting all case IDs for current user');
  
  const userEmail = getCurrentUserEmail();
  
  if (!userEmail) {
    console.error('❌ Cannot get cases - user not authenticated');
    return [];
  }
  
  try {
    const url = `${API_BASE_URL}/api/search-cases?gmailId=${encodeURIComponent(userEmail)}`;
    console.log('📡 Making request to:', url);
    
    const response = await fetch(url);
    console.log('📡 Response status:', response.status);
    
    if (response.status === 401) {
      console.error('🚫 Authentication required');
      return [];
    }
    
    if (response.status === 403) {
      console.error('🚫 Access denied');
      return [];
    }
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const caseIds = await response.json();
    console.log('✅ Found all case IDs for user:', caseIds);
    return Array.isArray(caseIds) ? caseIds : [];
  } catch (err) {
    console.error('❌ Error fetching all cases:', err);
    return [];
  }
}

/**
 * Get case documents with user authentication
 * @param {string} caseId - Case ID to fetch documents for
 * @returns {Promise<Object>} Documents response
 */
export async function getCaseDocuments(caseId) {
  const userEmail = getCurrentUserEmail();
  
  if (!userEmail) {
    console.error('❌ Cannot get documents - user not authenticated');
    return { success: false, error: 'User not authenticated', documents: [] };
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/get-case-documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': userEmail
      },
      body: JSON.stringify({
        caseId,
        source: 'frontend_search'
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Error fetching documents:', data);
      return { success: false, error: data.error || 'Failed to fetch documents', documents: [] };
    }
    
    return data;
  } catch (error) {
    console.error('❌ Error fetching case documents:', error);
    return { success: false, error: error.message, documents: [] };
  }
}

/**
 * Get user permissions info
 * @returns {Promise<Object>} User permissions data
 */
export async function getUserPermissions() {
  const userEmail = getCurrentUserEmail();
  
  if (!userEmail) {
    console.error('❌ Cannot get permissions - user not authenticated');
    return { success: false, error: 'User not authenticated' };
  }
  
  try {
    // Use query parameter instead of header to avoid CORS issues
    const response = await fetch(`${API_BASE_URL}/api/user-permissions?gmailId=${encodeURIComponent(userEmail)}`);
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Error fetching permissions:', data);
      return { success: false, error: data.error || 'Failed to fetch permissions' };
    }
    
    return data;
  } catch (error) {
    console.error('❌ Error fetching user permissions:', error);
    return { success: false, error: error.message };
  }
}



/**
 * Add a case to localStorage for future searches (optional - for storing submitted cases)
 * @param {Object} caseData - Case data to store
 * @returns {boolean} Success status
 */
export function addCaseToLocalStorage(caseData) {
  try {
    const storedCases = JSON.parse(localStorage.getItem('medxprts_cases') || '[]');
    
    // Check if case already exists
    const existingIndex = storedCases.findIndex(existing => {
      const existingId = typeof existing === 'string' ? existing : existing.caseId;
      const newId = typeof caseData === 'string' ? caseData : caseData.caseId;
      return existingId === newId;
    });

    if (existingIndex === -1) {
      storedCases.push(caseData);
      localStorage.setItem('medxprts_cases', JSON.stringify(storedCases));
    }

    return true;
  } catch (error) {
    console.error('Error adding case to localStorage:', error);
    return false;
  }
}

/**
 * Test function to verify S3 connection
 * @returns {Promise<boolean>} Connection status
 */
export async function testS3Connection() {
  console.log('🧪 Testing API connection...');

  try {
    const response = await fetch(`${API_BASE_URL}/api/test`);
    
    if (!response.ok) {
      throw new Error(`API test failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ API connection successful!', result);
    return true;
  } catch (error) {
    console.error('❌ API connection failed:', error);
    return false;
  }
}