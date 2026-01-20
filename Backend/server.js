/**
 * Express server for MCP
 * - Handles S3 case search
 * - Handles MCP upload
 * - Triggers n8n workflow
 * - Tracks MCP progress (Render-ready)
 */
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import FormData from 'form-data';
import xlsx from 'xlsx';

// Use native fetch (Node 18+) or import node-fetch
const fetch = globalThis.fetch || (await import('node-fetch')).default;

dotenv.config();

/* ------------------------------------------------------------------ */
/* ------------------------- BASIC SETUP ----------------------------- */
/* ------------------------------------------------------------------ */
const app = express();
const PORT = process.env.PORT || 3001;
// Base URL used to build document view links; fall back to local server port
const API_BASE = process.env.API_BASE_URL || process.env.API_BASE || `http://localhost:${PORT}`;

// Add these two lines here
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://medxperts.onrender.com',
    'https://medxperts-ui.onrender.com',
    'https://medxperts-frountend.onrender.com',
    'https://medxperts-frontend.onrender.com',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-email']
}));

/* -------------------- MCP PROGRESS STORE (S3-BASED) --------------- */
const mcpProgressStore = new Map();
const S3_PROGRESS_BUCKET = process.env.S3_PROGRESS_BUCKET || 'finallcpreports';

/**
 * Save progress to S3 with unique generation ID to support multiple reports per case
 * Format: progress/{reportType}/{caseId}/{generationId}.json
 */
async function saveProgressToS3(caseId, progressData, reportType = 'MCP') {
  try {
    // Create unique generation ID if not exists
    const generationId = progressData.generationId || `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Update progress data with generation ID and report type
    progressData.generationId = generationId;
    progressData.reportType = reportType.toUpperCase();
    
    // Use hierarchical structure: progress/{reportType}/{caseId}/{generationId}.json
    const s3Key = `progress/${reportType.toLowerCase()}/${caseId}/${generationId}.json`;
    
    const command = new PutObjectCommand({
      Bucket: S3_PROGRESS_BUCKET,
      Key: s3Key,
      Body: JSON.stringify(progressData, null, 2),
      ContentType: 'application/json',
      // Add metadata for easier querying
      Metadata: {
        caseId: caseId,
        generationId: generationId,
        reportType: reportType.toUpperCase(),
        status: progressData.status || 'UNKNOWN',
        lastUpdated: Date.now().toString(),
        timestamp: progressData.timestamp?.toString() || Date.now().toString()
      }
    });

    await s3.send(command);
    console.log(`💾 ${reportType} progress saved to S3: ${S3_PROGRESS_BUCKET}/${s3Key}`);
    return { success: true, generationId };
  } catch (error) {
    console.error(`❌ Error saving ${reportType} progress to S3 for case ${caseId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Load progress from S3 for a specific case and generation
 * If generationId is not provided, loads the most recent generation
 * Format: progress/{reportType}/{caseId}/{generationId}.json
 */
async function loadProgressFromS3(caseId, generationId = null, reportType = 'MCP') {
  try {
    if (generationId) {
      // Load specific generation
      const s3Key = `progress/${reportType.toLowerCase()}/${caseId}/${generationId}.json`;
      
      const command = new GetObjectCommand({
        Bucket: S3_PROGRESS_BUCKET,
        Key: s3Key
      });

      const response = await s3.send(command);
      const chunks = [];
      
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      
      const buffer = Buffer.concat(chunks);
      const progressData = JSON.parse(buffer.toString());
      
      console.log(`📋 Loaded ${reportType} progress from S3 for case ${caseId}, generation ${generationId}`);
      return progressData;
    } else {
      // Load most recent generation for this case and report type
      const listCommand = new ListObjectsV2Command({
        Bucket: S3_PROGRESS_BUCKET,
        Prefix: `progress/${reportType.toLowerCase()}/${caseId}/`,
        MaxKeys: 1000
      });

      const listResponse = await s3.send(listCommand);
      
      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        console.log(`📋 No ${reportType} progress found in S3 for case ${caseId}`);
        return null;
      }

      // Sort by LastModified to get the most recent
      const sortedFiles = listResponse.Contents.sort((a, b) => 
        new Date(b.LastModified) - new Date(a.LastModified)
      );
      
      const mostRecentKey = sortedFiles[0].Key;
      
      const command = new GetObjectCommand({
        Bucket: S3_PROGRESS_BUCKET,
        Key: mostRecentKey
      });

      const response = await s3.send(command);
      const chunks = [];
      
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      
      const buffer = Buffer.concat(chunks);
      const progressData = JSON.parse(buffer.toString());
      
      console.log(`📋 Loaded most recent ${reportType} progress from S3 for case ${caseId}: ${mostRecentKey}`);
      return progressData;
    }
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      console.log(`📋 No ${reportType} progress found in S3 for case ${caseId}${generationId ? `, generation ${generationId}` : ''}`);
      return null;
    }
    console.error(`❌ Error loading ${reportType} progress from S3 for case ${caseId}:`, error);
    return null;
  }
}

/**
 * List all progress files from S3 (for report history)
 * Now supports multiple generations per case and report types
 * Format: progress/{reportType}/{caseId}/{generationId}.json
 */
async function listAllProgressFromS3() {
  try {
    const command = new ListObjectsV2Command({
      Bucket: S3_PROGRESS_BUCKET,
      Prefix: 'progress/',
      MaxKeys: 1000
    });

    const response = await s3.send(command);
    const progressMap = new Map();

    if (response.Contents) {
      for (const object of response.Contents) {
        // Parse the new hierarchical structure: progress/{reportType}/{caseId}/{generationId}.json
        const keyParts = object.Key.split('/');
        
        if (keyParts.length === 4 && keyParts[3].endsWith('.json')) {
          // New format: progress/{reportType}/{caseId}/{generationId}.json
          const reportType = keyParts[1].toUpperCase();
          const caseId = keyParts[2];
          const generationId = keyParts[3].replace('.json', '');
          const uniqueKey = `${caseId}_${generationId}`;
          
          if (caseId && generationId && ['MCP', 'LCP'].includes(reportType)) {
            try {
              const progressData = await loadProgressFromS3(caseId, generationId, reportType);
              if (progressData) {
                // Add metadata for easier processing
                progressData.caseId = caseId;
                progressData.generationId = generationId;
                progressData.reportType = reportType;
                progressData.uniqueKey = uniqueKey;
                progressData.s3Key = object.Key;
                progressData.lastModified = object.LastModified;
                
                progressMap.set(uniqueKey, progressData);
              }
            } catch (error) {
              console.warn(`⚠️ Failed to load ${reportType} progress for ${uniqueKey}:`, error.message);
            }
          }
        } else if (keyParts.length === 3 && keyParts[2].endsWith('.json')) {
          // Legacy format: progress/{caseId}/{generationId}.json
          const caseId = keyParts[1];
          const generationId = keyParts[2].replace('.json', '');
          const uniqueKey = `${caseId}_${generationId}`;
          
          if (caseId && generationId) {
            try {
              const progressData = await loadProgressFromS3(caseId, generationId, 'MCP');
              if (progressData) {
                // Convert legacy format to new format
                const reportType = progressData.reportType || 'MCP';
                
                progressData.caseId = caseId;
                progressData.generationId = generationId;
                progressData.reportType = reportType;
                progressData.uniqueKey = uniqueKey;
                progressData.s3Key = object.Key;
                progressData.lastModified = object.LastModified;
                progressData.isLegacy = true;
                
                progressMap.set(uniqueKey, progressData);
              }
            } catch (error) {
              console.warn(`⚠️ Failed to load legacy progress for ${uniqueKey}:`, error.message);
            }
          }
        } else if (keyParts.length === 2 && keyParts[1].endsWith('.json')) {
          // Very old legacy format: progress/{caseId}.json
          const caseId = keyParts[1].replace('.json', '');
          if (caseId && !caseId.includes('/')) {
            try {
              const command = new GetObjectCommand({
                Bucket: S3_PROGRESS_BUCKET,
                Key: object.Key
              });

              const response = await s3.send(command);
              const chunks = [];
              
              for await (const chunk of response.Body) {
                chunks.push(chunk);
              }
              
              const buffer = Buffer.concat(chunks);
              const progressData = JSON.parse(buffer.toString());
              
              if (progressData) {
                // Convert very old legacy format to new format
                const generationId = progressData.generationId || `legacy_${progressData.timestamp || Date.now()}`;
                const reportType = progressData.reportType || 'MCP';
                const uniqueKey = `${caseId}_${generationId}`;
                
                progressData.caseId = caseId;
                progressData.generationId = generationId;
                progressData.reportType = reportType;
                progressData.uniqueKey = uniqueKey;
                progressData.s3Key = object.Key;
                progressData.lastModified = object.LastModified;
                progressData.isLegacy = true;
                
                progressMap.set(uniqueKey, progressData);
              }
            } catch (error) {
              console.warn(`⚠️ Failed to load very old legacy progress for case ${caseId}:`, error.message);
            }
          }
        }
      }
    }

    console.log(`📋 Loaded ${progressMap.size} progress records from S3 (including multiple generations per case and report types)`);
    return progressMap;
  } catch (error) {
    console.error('❌ Error listing progress from S3:', error);
    return new Map();
  }
}

/* -------------------- MIDDLEWARE FOR AUTH -------------------------- */


/**
 * Middleware to extract and validate user from request
 */
function authenticateUser(req, res, next) {
  const gmailId = req.headers['x-user-email'] || req.body.gmailId || req.query.gmailId;
  
  if (!gmailId) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Gmail ID must be provided in headers or request body' 
    });
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(gmailId)) {
    return res.status(400).json({ 
      error: 'Invalid email format',
      message: 'Please provide a valid Gmail ID' 
    });
  }
  
  req.userEmail = gmailId.toLowerCase().trim();
  console.log(`👤 Authenticated user: ${req.userEmail}`);
  next();
}

/**
 * Validate and normalize 4-digit case ID
 * @param {string|number} caseId - Case ID to validate
 * @returns {string|null} Normalized 4-digit case ID or null if invalid
 */
function validateAndNormalizeCaseId(caseId) {
  if (!caseId) return null;
  
  const caseIdStr = caseId.toString().trim();
  
  // Check if it's a valid 1-4 digit number
  if (/^\d{1,4}$/.test(caseIdStr)) {
    return caseIdStr.padStart(4, '0');
  }
  
  return null;
}


/* -------------------- USER PERMISSIONS ----------------------------- */
const userPermissionsCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

async function fetchUserPermissions() {
  try {
    console.log('📊 Fetching user permissions from S3 Excel file...');
    console.log('🔗 S3 Config:', {
      region: process.env.AWS_REGION || 'us-east-1',
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY
    });
    
    const command = new GetObjectCommand({ 
      Bucket: 'finallcpreports', 
      Key: 'user info1.xlsx' 
    });
    
    console.log('📡 Attempting to fetch from S3: finallcpreports/user info1.xlsx');
    const response = await s3.send(command);
    console.log('✅ S3 response received, processing Excel file...');
    
    const chunks = [];
    
    for await (const chunk of response.Body) { 
      chunks.push(chunk); 
    }
    
    const buffer = Buffer.concat(chunks);
    console.log(`📄 Excel file size: ${buffer.length} bytes`);
    
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet);
    
    console.log(`📋 Processing ${data.length} rows from Excel file`);
    console.log(`📝 Sheet name: ${workbook.SheetNames[0]}`);
    
    // Log first few rows for debugging
    if (data.length > 0) {
      console.log('📋 First 3 rows:', data.slice(0, 3));
      console.log('📋 Column headers:', Object.keys(data[0]));
    }
    
    const userPermissions = {};
    let processedRows = 0;
    let skippedRows = 0;
    
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
          console.warn(`⚠️ Invalid case ID format in row ${index + 1}: "${pid}"`);
          skippedRows++;
        }
      } else {
        console.warn(`⚠️ Missing Gmail ID or Case ID in row ${index + 1}:`, {
          gmailId: gmailId || 'MISSING',
          caseId: caseId || 'MISSING'
        });
        skippedRows++;
      }
    });
    
    console.log(`✅ Excel processing complete:`);
    console.log(`   📊 Total rows: ${data.length}`);
    console.log(`   ✅ Processed: ${processedRows}`);
    console.log(`   ⚠️ Skipped: ${skippedRows}`);
    console.log(`   👥 Unique users: ${Object.keys(userPermissions).length}`);
    
    // Log sample of permissions for debugging
    const sampleUsers = Object.keys(userPermissions).slice(0, 3);
    sampleUsers.forEach(user => {
      console.log(`   📋 ${user}: [${userPermissions[user].join(', ')}]`);
    });
    
    // Cache the permissions
    userPermissionsCache.set('permissions', { 
      data: userPermissions, 
      timestamp: Date.now(),
      stats: {
        totalRows: data.length,
        processedRows,
        skippedRows,
        uniqueUsers: Object.keys(userPermissions).length
      }
    });
    
    return userPermissions;
    
  } catch (error) {
    console.error('❌ Error fetching permissions from Excel:', error);
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.$metadata?.httpStatusCode
    });
    
    if (error.name === 'NoSuchKey') {
      console.error('📄 Excel file "user info1.xlsx" not found in finallcpreports bucket');
    } else if (error.name === 'AccessDenied') {
      console.error('🔐 Access denied to finallcpreports bucket or user info1.xlsx file');
    } else if (error.name === 'CredentialsProviderError') {
      console.error('🔑 AWS credentials not found or invalid');
    }
    
    return {};
  }
}

async function getUserPermissions() {
  const cached = userPermissionsCache.get('permissions');
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) return cached.data;
  return await fetchUserPermissions();
}

async function getUserCaseIds(gmailId) {
  // Get case IDs assigned to specific user from Excel file
  try {
    console.log(`📂 Fetching assigned case IDs for user: ${gmailId}`);
    
    const permissions = await getUserPermissions();
    console.log(`📊 Total users in permissions: ${Object.keys(permissions).length}`);
    console.log(`📋 Sample permissions keys:`, Object.keys(permissions).slice(0, 3));
    
    const userCases = permissions[gmailId.toLowerCase().trim()] || [];
    
    console.log(`✅ User ${gmailId} has access to ${userCases.length} case IDs:`, userCases);
    return userCases;
  } catch (error) {
    console.error('❌ Error fetching user case IDs:', error);
    return [];
  }
}

async function hasAccessToCase(gmailId, caseId) {
  // Check if user has access to specific case ID based on Excel mapping
  try {
    const permissions = await getUserPermissions();
    const userCases = permissions[gmailId.toLowerCase().trim()] || [];
    
    // Normalize case ID for comparison
    let normalizedCaseId = caseId.toString().trim();
    if (/^\d{1,4}$/.test(normalizedCaseId)) {
      normalizedCaseId = normalizedCaseId.padStart(4, '0');
    }
    
    const hasAccess = userCases.includes(normalizedCaseId);
    
    // Only log denied access for security monitoring
    if (!hasAccess) {
      console.log(`🔐 Access DENIED: ${gmailId} -> ${normalizedCaseId}`);
    }
    
    return hasAccess;
  } catch (error) {
    console.error('❌ Error checking case access:', error);
    return false; // Deny access on error
  }
}
function updateMcpProgress(caseId, data) {
  // Determine report type from data or default to MCP
  const reportType = data.reportType || 'MCP';
  
  // Create unique generation ID for new reports
  let generationId = data.generationId;
  if (!generationId) {
    // Check if this is a new report generation
    if (data.step === 'Workflow Triggered' || 
        data.step === 'LCP Workflow Triggered' || 
        data.step === 'Files Uploaded' || 
        !data.step) {
      generationId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`🆕 Creating new ${reportType} generation ID for case ${caseId}: ${generationId}`);
    } else {
      // For updates to existing reports, try to find the current generation ID
      const existingData = mcpProgressStore.get(caseId);
      generationId = existingData?.generationId || `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }
  
  const uniqueKey = `${caseId}_${generationId}`;
  const existingData = mcpProgressStore.get(uniqueKey) || {};
  
  const updatedData = {
    caseId,
    generationId,
    uniqueKey,
    reportType: reportType.toUpperCase(),
    timestamp: existingData.timestamp || Date.now(), // Keep original timestamp
    lastUpdated: Date.now(),
    ...data,
    updatedAt: new Date().toISOString(),
    // Store user email for filtering
    userEmail: data.userEmail || existingData.userEmail || data.initiatedBy || null,
  };
  
  // If status is being set to COMPLETED, record completion time
  if (data.status === 'COMPLETED' && existingData.status !== 'COMPLETED') {
    updatedData.completedAt = Date.now();
  }
  
  // Update in-memory store for fast access (use unique key)
  mcpProgressStore.set(uniqueKey, updatedData);
  
  // Also store by caseId for backward compatibility (most recent generation)
  const existingCaseData = mcpProgressStore.get(caseId);
  if (!existingCaseData || updatedData.timestamp >= (existingCaseData.timestamp || 0)) {
    mcpProgressStore.set(caseId, updatedData);
  }
  
  // Save to S3 asynchronously with report type (don't block the response)
  saveProgressToS3(caseId, updatedData, reportType).catch(error => {
    console.error(`❌ Failed to save ${reportType} progress to S3 for case ${caseId}, generation ${generationId}:`, error);
  });
  
  console.log(`📊 ${reportType} progress updated for case ${caseId}, generation ${generationId}:`, {
    step: updatedData.step,
    progress: updatedData.progress,
    status: updatedData.status,
    userEmail: updatedData.userEmail,
    uniqueKey: updatedData.uniqueKey
  });
  
  return generationId; // Return generation ID for reference
}

async function getMcpProgress(caseId, generationId = null, reportType = 'MCP') {
  const type = (reportType || 'MCP').toUpperCase();
  
  if (generationId) {
    // Get specific generation
    const uniqueKey = `${caseId}_${generationId}`;
    let progressData = mcpProgressStore.get(uniqueKey);
    
    // If not in cache, try to load from S3
    if (!progressData) {
      progressData = await loadProgressFromS3(caseId, generationId, type);
      if (progressData) {
        // Cache it for future requests
        mcpProgressStore.set(uniqueKey, progressData);
      }
    }
    
    return progressData || null;
  } else {
    // Get most recent generation (backward compatibility)
    let progressData = mcpProgressStore.get(caseId);
    
    // If not in cache, try to load from S3
    if (!progressData) {
      progressData = await loadProgressFromS3(caseId, null, type);
      if (progressData) {
        // Cache it for future requests
        const uniqueKey = progressData.uniqueKey || `${caseId}_${progressData.generationId || 'legacy'}`;
        mcpProgressStore.set(uniqueKey, progressData);
        mcpProgressStore.set(caseId, progressData); // Also cache by caseId for compatibility
      }
    }
    
    return progressData || null;
  }
}

/* ------------------------------------------------------------------ */
/* ----------------------- MULTER CONFIG ----------------------------- */
/* ------------------------------------------------------------------ */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // Increased to 50MB
    fieldSize: 50 * 1024 * 1024  // Also increase field size
  }
});
/* ------------------------------------------------------------------ */
/* ----------------------- AWS S3 CONFIG ----------------------------- */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* ----------------------- AWS S3 CONFIG ----------------------------- */
/* ------------------------------------------------------------------ */
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

// List of buckets to search in (defined in search endpoint)




/* ------------------------------------------------------------------ */
/* ---------------------- SEARCH CASE IDS (USER-FILTERED) ----------- */
/* ------------------------------------------------------------------ */
app.get('/api/search-cases', authenticateUser, async (req, res) => {
  const q = req.query.q?.trim();
  const userEmail = req.userEmail;
  
  console.log('🔍 User-filtered search request:', { user: userEmail, query: q || '(empty)' });

  try {
    // Get user's allowed case IDs from Excel
    const userCaseIds = await getUserCaseIds(userEmail);
    
    if (userCaseIds.length === 0) {
      console.log(`⚠️ No cases found for user: ${userEmail}`);
      return res.json([]);
    }
    
    // Filter case IDs based on search query
    let filteredCases = userCaseIds;
    if (q) {
      // Normalize search query for 4-digit case IDs
      let normalizedQuery = q.trim();
      if (/^\d{1,4}$/.test(normalizedQuery)) {
        normalizedQuery = normalizedQuery.padStart(4, '0');
      }
      
      filteredCases = userCaseIds.filter(caseId => 
        caseId.includes(normalizedQuery) || 
        caseId.toLowerCase().includes(q.toLowerCase())
      );
      console.log(`🔍 Filtered ${userCaseIds.length} cases to ${filteredCases.length} matching "${q}"`);
    }
    
    console.log(`✨ Returning ${filteredCases.length} cases for user ${userEmail}`);
    res.json(filteredCases.slice(0, 50)); // Limit to 50 results
    
  } catch (err) {
    console.error('❌ User-filtered search error:', {
      user: userEmail,
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({ 
      error: 'Failed to search cases',
      details: err.message
    });
  }
});
/* ------------------------------------------------------------------ */
/* ---------------- MCP UPLOAD FILES (Step 2) ------------------------ */
/* ------------------------------------------------------------------ */

app.post('/api/mcp-upload', upload.array('attachments'), async (req, res) => {
  console.log('MCP Upload received');
  console.log('Body:', req.body);
  console.log('Files:', req.files?.length || 0);

  try {
    const caseId = req.body.caseId;
    
    if (!caseId) {
      return res.status(400).json({ 
        success: false, 
        error: 'caseId is required. Please generate a case ID first.' 
      });
    }

    console.log('Using Case ID:', caseId);

    // Prepare files as base64 for reliable n8n transfer
    const filesData = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file, index) => {
        console.log('File ' + index + ': ' + file.originalname + ' (' + file.size + ' bytes)');
        filesData.push({
          filename: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          data: file.buffer.toString('base64')
        });
      });
    }

    // Send as JSON - more reliable than multipart for n8n
    const payload = {
      caseId,
      fullName: req.body.fullName || '',
      gender: req.body.gender || '',
      maritalStatus: req.body.maritalStatus || '',
      ethnicity: req.body.ethnicity || '',
      timestamp: new Date().toISOString(),
      fileCount: filesData.length,
      files: filesData
    };

    console.log('Sending to n8n - caseId:', payload.caseId);
    console.log('Sending to n8n - files:', payload.files.map(f => f.filename));
    
    const n8nResponse = await fetch('https://n8n.datakernels.in/webhook/awscrm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log('n8n response status:', n8nResponse.status);
    
    const responseText = await n8nResponse.text();
    console.log('n8n response:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    if (!n8nResponse.ok) {
      console.error('n8n webhook failed:', n8nResponse.status);
      return res.status(n8nResponse.status).json({ 
        success: false,
        error: 'n8n webhook failed', 
        details: data 
      });
    }

    updateMcpProgress(caseId, {
      step: 'Files Uploaded',
      progress: 5,
      status: 'PROCESSING',
    });

    console.log('MCP Upload successful, caseId:', caseId);

    res.json({
      success: true,
      caseId,
      patientName: req.body.fullName,
      filesProcessed: req.files?.length || 0,
      n8nResponse: data,
    });
  } catch (err) {
    console.error('MCP upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/* ------------------ MCP GENERATE (Trigger n8n) --------------------- */
/* ------------------------------------------------------------------ */

app.post('/api/mcp-generate', (req, res) => {
  const { caseId, patientName } = req.body;

  if (!caseId) {
    return res.status(400).json({ error: 'caseId required' });
  }

  console.log('🚀 Triggering n8n workflow for caseId:', caseId);

  // ✅ Initialize progress (ONLY processing)
  updateMcpProgress(caseId, {
    step: 'Workflow Triggered',
    progress: 5,
    status: 'PROCESSING',
    reportType: 'MCP', // Explicitly set report type
    initiatedBy: req.headers['x-user-email'],
    userEmail: req.headers['x-user-email'], // Store user email
    startTime: Date.now(), // Track when workflow started
    lastHeartbeat: Date.now(), // Track last activity
  });

  // ✅ Fire-and-forget n8n trigger with timeout
  // The workflow takes 1+ hours, so we don't wait for completion
  // Progress updates will come via /api/case-progress endpoint
  const mcpGenerateUrl = process.env.N8N_WEBHOOK_URL_MCP_GENERATE || 'https://n8n.datakernels.in/webhook/mcp-generate';
  
  fetch(mcpGenerateUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId, patientName }),
    signal: AbortSignal.timeout(5000) // Abort after 5 seconds
  }).then(() => {
    console.log(`✅ n8n webhook triggered successfully for case ${caseId} at ${mcpGenerateUrl}`);
  }).catch(err => {
    // ⚠️ IGNORE ALL ERRORS - This is expected behavior
    // The workflow will still run in n8n and send progress updates
    // Timeout errors are normal since n8n takes 1+ hours to complete
    console.log(`📤 n8n trigger sent for case ${caseId} (timeout/error ignored: ${err.name})`);
  });

  // ✅ Respond immediately - don't wait for n8n
  res.json({ 
    success: true, 
    caseId,
    message: 'Workflow triggered successfully. Check progress via polling.',
    status: 'PROCESSING'
  });
});

/* ------------------------------------------------------------------ */
/* -------- FALLBACK: Handle progress updates sent to wrong endpoint - */
/* ------------------------------------------------------------------ */

// Sometimes n8n might send progress updates to the generate endpoint by mistake
app.post('/api/mcp-generate-progress', async (req, res) => {
  console.log('⚠️  Progress update received at generate endpoint, redirecting...');
  
  // Forward to the correct progress endpoint
  const { caseId, step, progress, status, reportUrl, pdf_url } = req.body;
  
  if (caseId && (progress !== undefined || status || step)) {
    try {
      const existing = await getMcpProgress(caseId);
      
      const safeProgress =
        typeof progress === 'number'
          ? Math.max(existing?.progress || 0, progress)
          : existing?.progress || 0;

      const updateData = {
        step: step || existing?.step || 'Processing',
        progress: safeProgress,
        status: status || existing?.status || 'PROCESSING',
        reportUrl: reportUrl || pdf_url || existing?.reportUrl || existing?.pdf_url || null,
        pdf_url: pdf_url || reportUrl || existing?.pdf_url || existing?.reportUrl || null,
      };

      updateMcpProgress(caseId, updateData);

      console.log('✅ Progress updated via fallback endpoint:', {
        caseId,
        progress: safeProgress,
        status: updateData.status,
        step: updateData.step
      });

      return res.json({ success: true, caseId, updated: updateData });
    } catch (error) {
      console.error('❌ Error in fallback progress update:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        message: error.message 
      });
    }
  }
  
  // If it's not a progress update, treat as regular generation
  res.json({ success: true, message: 'Request processed' });
});

/* ------------------------------------------------------------------ */
/* -------- MCP PROGRESS UPDATE (n8n â†’ backend) ---------------------- */
/* ------------------------------------------------------------------ */

app.post('/api/case-progress', async (req, res) => {
  try {
    console.log('📈 Progress update received:', JSON.stringify(req.body, null, 2));
    console.log('📈 Headers:', JSON.stringify(req.headers, null, 2));
    
    const { caseId, step, progress, status, reportUrl, pdf_url } = req.body;

    if (!caseId) {
      console.error('❌ Missing caseId in progress update');
      console.error('❌ Full request body:', req.body);
      return res.status(400).json({ error: 'caseId is required' });
    }

    const existing = await getMcpProgress(caseId);
    console.log('📋 Existing progress for', caseId, ':', existing);

    const safeProgress =
      typeof progress === 'number'
        ? Math.max(existing?.progress || 0, progress)
        : existing?.progress || 0;

    const updateData = {
      step: step || existing?.step || 'Processing',
      progress: safeProgress,
      status: status || existing?.status || 'PROCESSING',
      reportUrl: reportUrl || pdf_url || existing?.reportUrl || existing?.pdf_url || null,
      pdf_url: pdf_url || reportUrl || existing?.pdf_url || existing?.reportUrl || null,
      reportType: existing?.reportType || 'MCP', // Preserve existing reportType or default to MCP
    };

    updateMcpProgress(caseId, updateData);

    console.log('✅ MCP Progress Updated:', {
      caseId,
      progress: safeProgress,
      status: updateData.status,
      step: updateData.step,
      pdf_url: updateData.pdf_url
    });

    res.json({ success: true, caseId, updated: updateData });
  } catch (error) {
    console.error('❌ Error updating progress:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message 
    });
  }
});
/* ------------------------------------------------------------------ */
/* -------- DIRECT S3 PROGRESS FETCH (Frontend Direct Access) ------- */
/* ------------------------------------------------------------------ */

app.get('/api/s3-progress/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    
    if (!caseId) {
      return res.status(400).json({ error: 'caseId is required' });
    }

    // Load progress directly from S3
    const progressData = await loadProgressFromS3(caseId);

    if (!progressData) {
      return res.json({
        caseId,
        progress: 0,
        step: 'Waiting',
        status: 'PROCESSING',
        pdf_url: null,
        source: 'default'
      });
    }

    res.json({
      caseId: progressData.caseId,
      progress: progressData.progress,
      step: progressData.step,
      status: progressData.status,
      pdf_url: progressData.pdf_url || progressData.reportUrl || null,
      lastUpdated: progressData.lastUpdated,
      updatedAt: progressData.updatedAt,
      source: 's3'
    });
  } catch (error) {
    console.error('❌ Error fetching S3 progress:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/* ------------------------------------------------------------------ */
/* -------- LCP PROGRESS UPDATE (From N8N) -------------------------- */
/* ------------------------------------------------------------------ */

app.post('/api/lcp-progress', async (req, res) => {
  try {
    console.log('📈 LCP Progress update received:', JSON.stringify(req.body, null, 2));
    
    const { caseId, step, progress, status, reportUrl, pdf_url, reportType } = req.body;

    if (!caseId) {
      console.error('❌ Missing caseId in LCP progress update');
      console.error('❌ Full request body:', req.body);
      return res.status(400).json({ error: 'caseId is required' });
    }

    // Get existing LCP progress
    const existing = await getMcpProgress(caseId, null, 'LCP');
    console.log('📋 Existing LCP progress for', caseId, ':', existing);

    const safeProgress =
      typeof progress === 'number'
        ? Math.max(existing?.progress || 0, progress)
        : existing?.progress || 0;

    const updateData = {
      step: step || existing?.step || 'Processing',
      progress: safeProgress,
      status: status || existing?.status || 'PROCESSING',
      reportUrl: reportUrl || pdf_url || existing?.reportUrl || existing?.pdf_url || null,
      pdf_url: pdf_url || reportUrl || existing?.pdf_url || existing?.reportUrl || null,
      reportType: 'LCP', // Explicitly set as LCP
      lastUpdated: Date.now(),
    };

    // Update progress with LCP type
    updateMcpProgress(caseId, updateData);

    console.log('✅ LCP Progress Updated:', {
      caseId,
      progress: safeProgress,
      status: updateData.status,
      step: updateData.step,
      pdf_url: updateData.pdf_url
    });

    res.json({ success: true, caseId, updated: updateData });
  } catch (error) {
    console.error('❌ Error updating LCP progress:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/* ------------------------------------------------------------------ */
/* -------- MCP PROGRESS FETCH (Frontend Polling) -------------------- */
/* ------------------------------------------------------------------ */

app.get('/api/case-status', async (req, res) => {
  try {
    const { caseId, reportType, generationId } = req.query;
    
    if (!caseId) {
      return res.status(400).json({ error: 'caseId is required' });
    }

    // Determine report type (default to MCP for backward compatibility)
    const type = (reportType || 'MCP').toUpperCase();
    
    console.log(`📊 Fetching ${type} progress for case ${caseId}${generationId ? `, generation ${generationId}` : ''}`);

    const data = await getMcpProgress(caseId, generationId, type);

    if (!data) {
      return res.json({
        caseId,
        reportType: type,
        progress: 0,
        step: type === 'LCP' ? 'Validating' : 'Waiting',
        status: 'PROCESSING',
        pdf_url: null
      });
    }

    res.json({
      caseId: data.caseId,
      reportType: data.reportType || type,
      generationId: data.generationId,
      progress: data.progress,
      step: data.step,
      status: data.status,
      pdf_url: data.pdf_url || data.reportUrl || null,
    });
  } catch (error) {
    console.error('❌ Error fetching case status:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/* ------------------------------------------------------------------ */
/* -------------------- LCP WEBHOOK (Trigger n8n) -------------------- */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* -------- LCP GENERATE ENDPOINT (Similar to MCP) ------------------ */
/* ------------------------------------------------------------------ */

app.post('/api/lcp-generate', (req, res) => {
  const { caseId, patientName, reportType } = req.body;

  if (!caseId) {
    return res.status(400).json({ error: 'caseId is required' });
  }

  console.log('🚀 LCP workflow triggered for caseId:', caseId, 'reportType:', reportType || 'LCP');

  // ✅ Initialize progress with LCP-specific settings and generation tracking
  const generationId = updateMcpProgress(caseId, {
    step: 'LCP Workflow Triggered',
    progress: 5,
    status: 'PROCESSING',
    initiatedBy: req.headers['x-user-email'],
    userEmail: req.headers['x-user-email'], // Store user email
    reportType: 'LCP', // Store report type
    startTime: Date.now(), // Track when workflow started
    lastHeartbeat: Date.now(), // Track last activity
  });

  // ✅ Fire-and-forget n8n trigger with timeout
  const lcpWebhookUrl = 'https://n8n.datakernels.in/webhook/6ca9a42a-3739-482b-a161-30ec56f2e086';
  
  fetch(lcpWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      caseId, 
      case_id: caseId, // Also send as case_id for n8n compatibility
      patientName: patientName || '', 
      reportType: 'LCP',
      generationId: generationId, // Include generation ID for n8n
      timestamp: new Date().toISOString()
    }),
    signal: AbortSignal.timeout(5000) // Abort after 5 seconds
  }).then(() => {
    console.log(`✅ LCP n8n webhook triggered successfully for case ${caseId} at ${lcpWebhookUrl}`);
  }).catch(err => {
    // ⚠️ IGNORE ALL ERRORS - This is expected behavior
    console.log(`📤 LCP n8n trigger sent for case ${caseId} (timeout/error ignored: ${err.name})`);
  });

  // ✅ Respond immediately with generation info
  res.json({ 
    success: true, 
    caseId,
    generationId: generationId,
    uniqueKey: `${caseId}_${generationId}`,
    message: 'LCP workflow triggered successfully. Check progress via polling.',
    status: 'PROCESSING'
  });
});

/* -------------------- LCP TEST ENDPOINT (Debug) -------------------- */
app.get('/api/lcp-test', (req, res) => {
  console.log('🔹 LCP Test endpoint hit');
  res.json({ 
    success: true, 
    message: 'LCP endpoint is working!',
    timestamp: new Date().toISOString()
  });
});

/* -------------------- LCP UPLOAD FILES (Step 2) -------------------- */




app.post('/api/lcp-upload', upload.array('files'), async (req, res) => {
  try {
    const formData = new FormData();

    // forward body
    Object.entries(req.body).forEach(([k, v]) => {
      formData.append(k, v);
    });

    // forward files as BINARY
    req.files.forEach(file => {
      formData.append('files', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });
    });

    const n8nRes = await fetch(
      'https://n8n.datakernels.in/webhook/lcp-upload',
      {
        method: 'POST',
        headers: formData.getHeaders(),
        body: formData,
      }
    );

    const text = await n8nRes.text();

    if (!n8nRes.ok) {
      return res.status(500).json({ error: text });
    }

    let parsed;
try { parsed = JSON.parse(text); } catch { parsed = text; }

res.status(200).json({
  success: true,
  data: parsed
});

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});




/* ------------------------------------------------------------------ */
/* -------------------------- TEST API ------------------------------- */
/* ------------------------------------------------------------------ */

app.get('/api/test', (req, res) => {
  res.json({
    message: 'API server is running!',
    timestamp: new Date().toISOString(),
    env: {
      hasRegion: !!process.env.AWS_REGION,
hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,

    },
  });
});



/* ------------------------------------------------------------------ */
/* -------------------- DASHBOARD STATISTICS ------------------------- */
/* ------------------------------------------------------------------ */

app.get('/api/dashboard-stats', authenticateUser, async (req, res) => {
  try {
    const userEmail = req.userEmail;
    console.log(`📊 Dashboard stats requested by: ${userEmail}`);

    // Load all progress data from S3
    const allProgressData = await listAllProgressFromS3();
    
    // Get user's allowed case IDs
    const userCaseIds = await getUserCaseIds(userEmail);
    
    // Filter progress data for user's accessible cases
    const userProgress = [];
    for (const [caseId, progressData] of allProgressData.entries()) {
      const hasAccess = await hasAccessToCase(userEmail, caseId);
      const userInitiated = progressData.initiatedBy === userEmail || progressData.userEmail === userEmail;
      
      if (hasAccess || userInitiated) {
        userProgress.push(progressData);
      }
    }

    // Get active cases with details
    const activeCasesData = userProgress.filter(p => 
      ['CREATED', 'PENDING', 'PROCESSING'].includes(p.status)
    );

    // Get in progress cases with details
    const inProgressData = userProgress.filter(p => 
      p.status === 'PROCESSING'
    );

    // Get completed cases with details
    const completedData = userProgress.filter(p => 
      p.status === 'COMPLETED'
    );

    // Get issues cases with details
    const issuesData = userProgress.filter(p => 
      ['FAILED', 'ERROR'].includes(p.status)
    );

    // Calculate statistics
    const stats = {
      activeCases: activeCasesData.length,
      inProgress: inProgressData.length,
      completed: completedData.length,
      issues: issuesData.length
    };

    // Prepare case lists with details
    const caseLists = {
      activeCases: activeCasesData.map(p => ({
        caseId: p.caseId,
        status: p.status,
        progress: p.progress || 0,
        step: p.step || 'Unknown',
        type: p.reportType || 'MCP',
        lastUpdated: p.lastUpdated || p.timestamp
      })),
      inProgress: inProgressData.map(p => ({
        caseId: p.caseId,
        status: p.status,
        progress: p.progress || 0,
        step: p.step || 'Unknown',
        type: p.reportType || 'MCP',
        lastUpdated: p.lastUpdated || p.timestamp
      })),
      completed: completedData.map(p => ({
        caseId: p.caseId,
        status: p.status,
        progress: 100,
        step: 'Completed',
        type: p.reportType || 'MCP',
        completedAt: p.completedAt || p.lastUpdated || p.timestamp
      })),
      issues: issuesData.map(p => ({
        caseId: p.caseId,
        status: p.status,
        progress: p.progress || 0,
        step: p.step || 'Failed',
        type: p.reportType || 'MCP',
        failedAt: p.lastUpdated || p.timestamp
      }))
    };

    // Calculate breakdown by type
    const breakdown = {
      byType: {
        MCP: {
          active: userProgress.filter(p => 
            (p.reportType || 'MCP') === 'MCP' && 
            ['CREATED', 'PENDING', 'PROCESSING'].includes(p.status)
          ).length,
          inProgress: userProgress.filter(p => 
            (p.reportType || 'MCP') === 'MCP' && 
            p.status === 'PROCESSING'
          ).length,
          completed: userProgress.filter(p => 
            (p.reportType || 'MCP') === 'MCP' && 
            p.status === 'COMPLETED'
          ).length,
          issues: userProgress.filter(p => 
            (p.reportType || 'MCP') === 'MCP' && 
            ['FAILED', 'ERROR'].includes(p.status)
          ).length
        },
        LCP: {
          active: userProgress.filter(p => 
            (p.reportType || 'MCP') === 'LCP' && 
            ['CREATED', 'PENDING', 'PROCESSING'].includes(p.status)
          ).length,
          inProgress: userProgress.filter(p => 
            (p.reportType || 'MCP') === 'LCP' && 
            p.status === 'PROCESSING'
          ).length,
          completed: userProgress.filter(p => 
            (p.reportType || 'MCP') === 'LCP' && 
            p.status === 'COMPLETED'
          ).length,
          issues: userProgress.filter(p => 
            (p.reportType || 'MCP') === 'LCP' && 
            ['FAILED', 'ERROR'].includes(p.status)
          ).length
        }
      },
      byStatus: {
        CREATED: userProgress.filter(p => p.status === 'CREATED').length,
        PENDING: userProgress.filter(p => p.status === 'PENDING').length,
        PROCESSING: userProgress.filter(p => p.status === 'PROCESSING').length,
        COMPLETED: userProgress.filter(p => p.status === 'COMPLETED').length,
        FAILED: userProgress.filter(p => ['FAILED', 'ERROR'].includes(p.status)).length
      }
    };

    // Get recent activity (last 10 updates)
    const recentActivity = userProgress
      .sort((a, b) => (b.lastUpdated || b.timestamp) - (a.lastUpdated || a.timestamp))
      .slice(0, 10)
      .map(p => {
        const timestamp = p.lastUpdated || p.timestamp || Date.now();
        const timeAgo = getTimeAgo(timestamp);
        
        let action = 'Unknown';
        if (p.status === 'COMPLETED') action = 'Report Generated';
        else if (p.status === 'PROCESSING') action = 'Processing';
        else if (p.status === 'FAILED' || p.status === 'ERROR') action = 'Failed';
        else if (p.status === 'PENDING') action = 'Review Required';
        else if (p.status === 'CREATED') action = 'Case Created';
        
        const type = p.reportType || 'MCP';
        
        return {
          caseId: p.caseId,
          action,
          type,
          status: p.status,
          step: p.step,
          progress: p.progress || 0,
          timestamp,
          timeAgo,
          userEmail: p.userEmail || p.initiatedBy
        };
      });

    console.log(`✅ Dashboard stats calculated for ${userEmail}:`, stats);

    res.json({
      success: true,
      stats,
      caseLists,
      breakdown,
      recentActivity,
      userEmail,
      totalCasesAccess: userCaseIds.length,
      assignedCaseIds: userCaseIds, // All case IDs user has access to
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics',
      message: error.message
    });
  }
});

// Helper function to calculate time ago
function getTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

/* ------------------------------------------------------------------ */
/* -------------------- MANUAL CASE STATUS UPDATE ------------------- */
/* ------------------------------------------------------------------ */

app.post('/api/update-case-status', authenticateUser, async (req, res) => {
  try {
    const { caseId, status, reason } = req.body;
    const userEmail = req.userEmail;

    if (!caseId || !status) {
      return res.status(400).json({ 
        error: 'caseId and status are required' 
      });
    }

    console.log(`🔧 Manual status update: ${caseId} -> ${status} by ${userEmail}`);

    // Check if user has access to this case
    const hasAccess = await hasAccessToCase(userEmail, caseId);
    const existingData = await getMcpProgress(caseId);
    const userInitiated = existingData?.userEmail === userEmail || existingData?.initiatedBy === userEmail;

    if (!hasAccess && !userInitiated) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: `You don't have permission to update case ${caseId}` 
      });
    }

    // Update the case status
    updateMcpProgress(caseId, {
      status: status.toUpperCase(),
      step: reason || `Manually updated to ${status}`,
      lastUpdated: Date.now(),
      manuallyUpdated: true,
      updatedBy: userEmail
    });

    console.log(`✅ Case ${caseId} status updated to ${status}`);

    res.json({
      success: true,
      caseId,
      status: status.toUpperCase(),
      message: `Case ${caseId} status updated to ${status}`,
      updatedBy: userEmail
    });

  } catch (error) {
    console.error('❌ Error updating case status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update case status',
      message: error.message
    });
  }
});

/* ------------------------------------------------------------------ */
/* -------------------- REPORT HISTORY API (CLEAN) ------------------ */
/* ------------------------------------------------------------------ */

app.get('/api/report-history', authenticateUser, async (req, res) => {
  console.log('📊 Report History API called for user:', req.userEmail);

  try {
    const userEmail = req.userEmail;
    const reports = [];

    // Load all progress data from S3 (now includes multiple generations per case)
    const allProgressData = await listAllProgressFromS3();
    console.log('📋 Checking progress data with', allProgressData.size, 'entries (including multiple generations)');

    // Convert progress data to report format
    for (const [uniqueKey, progressData] of allProgressData.entries()) {
      const caseId = progressData.caseId;
      
      // Check if user has access to this case
      const hasAccess = await hasAccessToCase(userEmail, caseId);
      const userInitiated = progressData.initiatedBy === userEmail || progressData.userEmail === userEmail;
      
      if (!hasAccess && !userInitiated) {
        continue; // Skip cases user doesn't have access to
      }

      // Determine report type - use stored reportType first, then fallback to step analysis
      let reportType = progressData.reportType || 'MCP';
      if (!progressData.reportType) {
        // Fallback logic only if reportType is not stored
        if (progressData.step && progressData.step.toLowerCase().includes('lcp')) {
          reportType = 'LCP';
        }
      }

      // Map status from progress to report status
      let reportStatus = 'Pending';
      switch (progressData.status) {
        case 'PROCESSING':
        case 'IN_PROGRESS':
          reportStatus = 'Processing';
          break;
        case 'COMPLETED':
          reportStatus = 'Generated';
          break;
        case 'FAILED':
        case 'ERROR':
          reportStatus = 'Failed';
          break;
        case 'CREATED':
          reportStatus = 'Pending';
          break;
        default:
          reportStatus = 'Pending';
      }

      // Create report object with unique identification
      const report = {
        caseId,
        generationId: progressData.generationId,
        uniqueKey: progressData.uniqueKey,
        title: `${reportType} Case Report${progressData.isLegacy ? ' (Legacy)' : ''}`,
        type: reportType,
        status: reportStatus,
        createdDate: new Date(progressData.timestamp || Date.now()).toLocaleString(),
        reportDate: progressData.status === 'COMPLETED' 
          ? new Date(progressData.completedAt || progressData.lastUpdated || Date.now()).toLocaleDateString()
          : null,
        s3Url: progressData.pdf_url || progressData.reportUrl || null,
        progress: progressData.progress || 0,
        step: progressData.step || 'Unknown',
        userEmail: progressData.userEmail || progressData.initiatedBy || userEmail,
        lastModified: progressData.lastModified || new Date(progressData.lastUpdated || Date.now()),
        isLegacy: progressData.isLegacy || false
      };

      reports.push(report);
    }

    // Sort by creation date (newest first), then by last modified for same timestamp
    reports.sort((a, b) => {
      const dateA = new Date(a.createdDate);
      const dateB = new Date(b.createdDate);
      
      if (dateA.getTime() === dateB.getTime()) {
        // If same creation date, sort by last modified
        return new Date(b.lastModified) - new Date(a.lastModified);
      }
      
      return dateB - dateA;
    });

    console.log('✅ Returning', reports.length, 'reports for user:', userEmail);
    console.log('📊 Report breakdown:', {
      total: reports.length,
      processing: reports.filter(r => r.status === 'Processing').length,
      generated: reports.filter(r => r.status === 'Generated').length,
      failed: reports.filter(r => r.status === 'Failed').length,
      pending: reports.filter(r => r.status === 'Pending').length,
      legacy: reports.filter(r => r.isLegacy).length,
      uniqueCases: new Set(reports.map(r => r.caseId)).size
    });

    res.json({
      success: true,
      reports,
      total: reports.length,
      userEmail,
      uniqueCases: new Set(reports.map(r => r.caseId)).size,
      generationsPerCase: reports.reduce((acc, report) => {
        acc[report.caseId] = (acc[report.caseId] || 0) + 1;
        return acc;
      }, {})
    });

  } catch (error) {
    console.error('❌ Report History API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch report history',
      message: error.message,
      reports: [],
      total: 0
    });
  }
});


/* ------------------------------------------------------------------ */
/* -------------------- TEST PROGRESS UPDATES ------------------------ */
/* ------------------------------------------------------------------ */

app.post('/api/test-progress', (req, res) => {
  const { caseId } = req.body;
  
  if (!caseId) {
    return res.status(400).json({ error: 'caseId is required' });
  }

  // Simulate progress updates
  const steps = [
    { step: 'Validating', progress: 5 },
    { step: 'OCR Extraction', progress: 20 },
    { step: 'Section 3', progress: 35 },
    { step: 'Section 2', progress: 45 },
    { step: 'PDF Generate', progress: 75 },
    { step: 'Finalizing', progress: 95 },
    { step: 'Completed', progress: 100, status: 'COMPLETED', reportUrl: 'https://example.com/report.pdf' }
  ];

  let currentIndex = 0;
  
  const updateProgress = () => {
    if (currentIndex < steps.length) {
      const currentStep = steps[currentIndex];
      updateMcpProgress(caseId, {
        step: currentStep.step,
        progress: currentStep.progress,
        status: currentStep.status || 'PROCESSING',
        reportUrl: currentStep.reportUrl || null,
      });
      
      console.log(`ðŸ“Š Test progress update: ${currentStep.step} - ${currentStep.progress}%`);
      currentIndex++;
      
      if (currentIndex < steps.length) {
        setTimeout(updateProgress, 5000); // Update every 5 seconds
      }
    }
  };

  // Start the simulation
  setTimeout(updateProgress, 1000);
  
  res.json({ success: true, message: 'Test progress simulation started' });
});

/* ------------------------------------------------------------------ */
/* -------- GET CASE DOCUMENTS FROM AWS S3 (USER-FILTERED) ---------- */
/* ------------------------------------------------------------------ */
app.post('/api/get-case-documents', authenticateUser, async (req, res) => {
  console.log('🔍 Get Case Documents API called (User-Filtered)');
  console.log('Body:', req.body);
  console.log('User:', req.userEmail);

  try {
    const { caseId } = req.body;
    const userEmail = req.userEmail;

    if (!caseId) {
      return res.status(400).json({
        success: false,
        error: 'caseId is required',
        documents: []
      });
    }

    // Check if user has access to this case ID
    const hasAccess = await hasAccessToCase(userEmail, caseId);
    if (!hasAccess) {
      console.log(`🚫 Access denied: ${userEmail} -> ${caseId}`);
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: `You don't have permission to access case ${caseId}`,
        documents: []
      });
    }

    console.log(`✅ Access granted: ${userEmail} -> ${caseId}`);
    console.log('🔍 Searching for documents for case:', caseId);

    const documents = [];

    // Search only in output/result folders (both lowercase and uppercase)
    const searchLocations = [
      // Main bucket locations
      { bucket: 'finallcpreports', prefix: `${caseId}/output/` },
      { bucket: 'finallcpreports', prefix: `${caseId}/results/` },
      { bucket: 'finallcpreports', prefix: `${caseId}/generated/` },
      { bucket: 'finallcpreports', prefix: `${caseId}/Output/` },
      { bucket: 'finallcpreports', prefix: `${caseId}/Results/` },
      { bucket: 'finallcpreports', prefix: `${caseId}/Generated/` },
      
      // Farhan-testing subfolder locations
      { bucket: 'finallcpreports', prefix: `farhan-testing/${caseId}/output/` },
      { bucket: 'finallcpreports', prefix: `farhan-testing/${caseId}/results/` },
      { bucket: 'finallcpreports', prefix: `farhan-testing/${caseId}/generated/` },
      { bucket: 'finallcpreports', prefix: `farhan-testing/${caseId}/Output/` },
      { bucket: 'finallcpreports', prefix: `farhan-testing/${caseId}/Results/` },
      { bucket: 'finallcpreports', prefix: `farhan-testing/${caseId}/Generated/` },
      
      // Other buckets
      { bucket: 'testingbucketdk', prefix: `${caseId}/output/` },
      { bucket: 'testingbucketdk', prefix: `${caseId}/results/` },
      { bucket: 'testingbucketdk', prefix: `${caseId}/Output/` },
      { bucket: 'testingbucketdk', prefix: `${caseId}/Results/` }
    ];

    for (const location of searchLocations) {
      try {
        console.log(`🔍 Searching in bucket: ${location.bucket}, prefix: ${location.prefix}`);
        
        const params = {
          Bucket: location.bucket,
          Prefix: location.prefix,
          MaxKeys: 100
        };

        const command = new ListObjectsV2Command(params);
        const response = await s3.send(command);

        if (response.Contents && response.Contents.length > 0) {
          console.log(`✅ Found ${response.Contents.length} files in ${location.bucket}/${location.prefix}`);
          
          response.Contents.forEach(file => {
            const fileName = file.Key.split('/').pop();
            const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'unknown';
            
            documents.push({
              name: fileName,
              fileName: fileName,
              s3Key: file.Key,
              url: `${API_BASE}/api/view-document/${location.bucket}/${file.Key}?userEmail=${encodeURIComponent(userEmail)}`,
              directUrl: `https://${location.bucket}.s3.amazonaws.com/${file.Key}`,
              bucket: location.bucket,
              size: file.Size,
              lastModified: file.LastModified,
              type: fileExtension,
              path: file.Key
            });
          });
        }
      } catch (bucketError) {
        console.log(`⚠️ Error searching in ${location.bucket}:`, bucketError.message);
        // Continue with next bucket even if one fails
      }
    }

    // Remove duplicates based on s3Key
    const uniqueDocuments = documents.filter((doc, index, self) => 
      index === self.findIndex(d => d.s3Key === doc.s3Key)
    );

    console.log(`🔍 Total unique documents found for ${userEmail}: ${uniqueDocuments.length}`);

    res.json({
      success: true,
      caseId,
      userEmail,
      documents: uniqueDocuments,
      count: uniqueDocuments.length,
      message: `Found ${uniqueDocuments.length} document(s) for case ${caseId}`
    });

  } catch (err) {
    console.error('🔍 Get case documents error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      documents: []
    });
  }
});


/* ------------------------------------------------------------------ */
/* -------------------- PDF PROXY ENDPOINT (USER-FILTERED) ---------- */
/* ------------------------------------------------------------------ */

app.get('/api/view-document/:bucket/:key(*)', async (req, res) => {
  console.log('📄 PDF Proxy request received (User-Filtered)');
  console.log('Bucket:', req.params.bucket);
  console.log('Key:', req.params.key);

  try {
    const { bucket, key } = req.params;
    const userEmail = req.query.userEmail;
    
    if (!bucket || !key) {
      return res.status(400).json({
        success: false,
        error: 'Bucket and key are required'
      });
    }

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    // Extract case ID from the key path
    const keyParts = key.split('/');
    let caseId = null;
    
    // Handle different path structures
    if (keyParts[0] === 'farhan-testing' && keyParts.length > 1) {
      caseId = keyParts[1]; // farhan-testing/1234/...
    } else {
      caseId = keyParts[0]; // 1234/...
    }

    if (!caseId) {
      return res.status(400).json({
        success: false,
        error: 'Could not extract case ID from document path'
      });
    }

    // Normalize case ID to 4-digit format
    let normalizedCaseId = caseId.toString().trim();
    if (/^\d{1,4}$/.test(normalizedCaseId)) {
      normalizedCaseId = normalizedCaseId.padStart(4, '0');
    }

    // Check if user has access to this case ID
    const hasAccess = await hasAccessToCase(userEmail, normalizedCaseId);
    if (!hasAccess) {
      console.log(`🚫 Document access denied: ${userEmail} -> ${normalizedCaseId} -> ${key}`);
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: `You don't have permission to access documents for case ${normalizedCaseId}`
      });
    }

    console.log(`✅ Document access granted: ${userEmail} -> ${normalizedCaseId} -> ${key}`);
    console.log(`📄 Fetching document from S3: ${bucket}/${key}`);

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });

    const response = await s3.send(command);
    
    // Set appropriate headers for PDF viewing
    const contentType = response.ContentType || 'application/pdf';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    // Stream the file content
    if (response.Body) {
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      res.send(buffer);
    } else {
      res.status(404).json({ error: 'Document not found' });
    }

  } catch (err) {
    console.error('📄 PDF Proxy error:', err);
    
    if (err.name === 'NoSuchKey') {
      res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    } else if (err.name === 'AccessDenied') {
      res.status(403).json({
        success: false,
        error: 'Access denied to document'
      });
    } else {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }
});

/* ------------------------------------------------------------------ */
/* -------------------- USER PERMISSIONS TEST ENDPOINT -------------- */
/* ------------------------------------------------------------------ */

app.get('/api/user-permissions', authenticateUser, async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const userCases = await getUserCaseIds(userEmail);
    const allPermissions = await getUserPermissions();
    
    res.json({
      success: true,
      userEmail,
      caseCount: userCases.length,
      cases: userCases,
      message: `User ${userEmail} has access to ${userCases.length} cases`,
      // Include cache stats for debugging
      cacheStats: userPermissionsCache.get('permissions')?.stats || null,
      totalUsersInSystem: Object.keys(allPermissions).length
    });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
/* -------------------- REFRESH PERMISSIONS CACHE ------------------ */
app.post('/api/refresh-permissions', authenticateUser, async (req, res) => {
  try {
    console.log('🔄 Manual permissions cache refresh requested by:', req.userEmail);
    
    // Clear cache and fetch fresh data
    userPermissionsCache.delete('permissions');
    console.log('🗑️ Permissions cache cleared');
    
    const permissions = await fetchUserPermissions();
    
    res.json({
      success: true,
      message: 'Permissions cache refreshed successfully',
      userCount: Object.keys(permissions).length,
      timestamp: new Date().toISOString(),
      sampleUsers: Object.keys(permissions).slice(0, 3)
    });
  } catch (error) {
    console.error('Error refreshing permissions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* -------------------- FORCE CACHE CLEAR (DEBUG) ------------------- */
app.get('/api/clear-cache', async (req, res) => {
  try {
    console.log('🗑️ Force clearing all caches...');
    
    // Clear permissions cache
    userPermissionsCache.clear();
    
    // Force fresh fetch
    const permissions = await fetchUserPermissions();
    
    res.json({
      success: true,
      message: 'All caches cleared and refreshed',
      userCount: Object.keys(permissions).length,
      timestamp: new Date().toISOString(),
      debug: true
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* -------------------- EXCEL FILE DEBUG ENDPOINT ------------------- */
app.get('/api/debug-excel', authenticateUser, async (req, res) => {
  try {
    console.log('🔍 Excel debug endpoint called by:', req.userEmail);
    
    // Force refresh permissions to get latest data
    userPermissionsCache.delete('permissions');
    const permissions = await fetchUserPermissions();
    const cached = userPermissionsCache.get('permissions');
    
    res.json({
      success: true,
      message: 'Excel file debug information',
      stats: cached?.stats || {},
      sampleData: {
        totalUsers: Object.keys(permissions).length,
        firstFiveUsers: Object.keys(permissions).slice(0, 5).map(email => ({
          email,
          caseCount: permissions[email].length,
          cases: permissions[email]
        }))
      },
      requestedBy: req.userEmail,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in Excel debug:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to debug Excel file'
    });
  }
});

/* ------------------------------------------------------------------ */
/* -------------------- DIAGNOSTIC ENDPOINTS ------------------------- */
/* ------------------------------------------------------------------ */

// Test N8N webhook connectivity
app.get('/api/test-n8n', async (req, res) => {
  const n8nGenerateUrl = process.env.N8N_WEBHOOK_URL_MCP_GENERATE || 'https://n8n.datakernels.in/webhook/mcp-generate';
  
  console.log('🧪 Testing N8N connectivity...');
  console.log('🔗 URL:', n8nGenerateUrl);
  
  try {
    const startTime = Date.now();
    const response = await fetch(n8nGenerateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        test: true,
        timestamp: new Date().toISOString(),
        source: 'backend_diagnostic'
      }),
    });
    
    const duration = Date.now() - startTime;
    const responseText = await response.text();
    
    res.json({
      success: true,
      url: n8nGenerateUrl,
      status: response.status,
      statusText: response.statusText,
      duration: `${duration}ms`,
      response: responseText.substring(0, 500),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ N8N test failed:', error);
    res.status(500).json({
      success: false,
      url: n8nGenerateUrl,
      error: error.message,
      errorType: error.constructor.name,
      timestamp: new Date().toISOString()
    });
  }
});

/* ------------------------------------------------------------------ */
/* ------------------------- START SERVER ---------------------------- */
/* ------------------------------------------------------------------ */
app.listen(PORT, () => {
  console.log(`🚀 MCP API running on port ${PORT}`);
});

// Serve frontend static files (Vite build output) when available
// This allows visiting the root URL in production where the frontend is built into /dist
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const frontDist = path.join(__dirname, 'dist');

  if (fs.existsSync(frontDist)) {
    app.use(express.static(frontDist));

    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) return res.status(404).end();
      res.sendFile(path.join(frontDist, 'index.html'));
    });
    console.log('✅ Serving frontend from', frontDist);
  } else {
    console.log('ℹ️ Frontend build not found at', frontDist);
  }
} catch (err) {
  console.warn('⚠️ Could not enable static frontend serving:', err.message);
}




