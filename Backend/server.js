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
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
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
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-email']
}));

/* -------------------- MCP PROGRESS STORE --------------------------- */
const mcpProgressStore = new Map();
const PROGRESS_FILE = './mcp-progress.json';

function loadProgressFromFile() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      const progressData = JSON.parse(data);
      Object.entries(progressData).forEach(([caseId, d]) => {
        mcpProgressStore.set(caseId, d);
      });
      console.log(`📋 Loaded ${mcpProgressStore.size} progress records`);
    }
  } catch (error) {
    console.error('❌ Error loading progress:', error);
  }
}

function saveProgressToFile() {
  try {
    const progressData = Object.fromEntries(mcpProgressStore);
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progressData, null, 2));
  } catch (error) {
    console.error('❌ Error saving progress:', error);
  }
}

loadProgressFromFile();

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
    console.log('Fetching user permissions from S3...');
    const command = new GetObjectCommand({ Bucket: 'finallcpreports', Key: 'user info1.xlsx' });
    const response = await s3.send(command);
    const chunks = [];
    for await (const chunk of response.Body) { chunks.push(chunk); }
    const buffer = Buffer.concat(chunks);
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    const userPermissions = {};
    data.forEach(row => {
      const gmailId = row['Gmail ID'] || row['gmail_id'] || row['email'];
      const caseId = row['Case ID'] || row['case_id'];
      if (gmailId && caseId) {
        const email = gmailId.toLowerCase().trim();
        let pid = caseId.toString().trim();
        if (/^\d{1,4}$/.test(pid)) {
          pid = pid.padStart(4, '0');
          if (!userPermissions[email]) userPermissions[email] = [];
          userPermissions[email].push(pid);
        }
      }
    });
    userPermissionsCache.set('permissions', { data: userPermissions, timestamp: Date.now() });
    return userPermissions;
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return {};
  }
}

async function getUserPermissions() {
  const cached = userPermissionsCache.get('permissions');
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) return cached.data;
  return await fetchUserPermissions();
}

async function getUserCaseIds(gmailId) {
  // Return all case IDs from S3 for any authenticated user
  try {
    console.log(`📂 Fetching all case IDs from S3 for user: ${gmailId}`);
    const command = new ListObjectsV2Command({
      Bucket: 'finallcpreports',
      Delimiter: '/'
    });
    const response = await s3.send(command);
    const caseIds = [];
    if (response.CommonPrefixes) {
      response.CommonPrefixes.forEach(prefix => {
        const folder = prefix.Prefix.replace('/', '');
        if (/^\d{1,4}$/.test(folder)) {
          caseIds.push(folder.padStart(4, '0'));
        }
      });
    }
    console.log(`✅ Found ${caseIds.length} case IDs in S3`);
    return caseIds;
  } catch (error) {
    console.error('❌ Error fetching case IDs from S3:', error);
    return [];
  }
}

async function hasAccessToCase(gmailId, caseId) {
  return true; // All authenticated users have access
}
function updateMcpProgress(caseId, data) {
  const existingData = mcpProgressStore.get(caseId) || {};
  const updatedData = {
    caseId,
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
  
  mcpProgressStore.set(caseId, updatedData);
  
  // Save to file after each update
  saveProgressToFile();
}

function getMcpProgress(caseId) {
  return mcpProgressStore.get(caseId) || null;
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
/* --------------- MCP GENERATE CASE ID (Step 1) --------------------- */
/* ------------------------------------------------------------------ */

app.post('/api/mcp-generate-case', async (req, res) => {
  console.log(' MCP Generate Case ID received');
  console.log('Body:', req.body);

  try {
    const { fullName, gender, maritalStatus, ethnicity } = req.body;

    // Generate unique case ID
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    const caseId = `CASE-${timestamp}-${random}`.toUpperCase();

    console.log(' Generated Case ID:', caseId);

    // Initialize progress for this case
    updateMcpProgress(caseId, {
      step: 'Case Created',
      progress: 0,
      status: 'CREATED',
    });

    res.json({
      success: true,
      caseId,
      patientName: fullName,
      metadata: { gender, maritalStatus, ethnicity },
    });

  } catch (err) {
    console.error(' Generate case error:', err);
    res.status(500).json({ success: false, error: err.message });
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
    step: 'Validating',
    progress: 5,
    status: 'PROCESSING',
    initiatedBy: req.headers['x-user-email'],
    userEmail: req.headers['x-user-email'], // Store user email
    startTime: Date.now(), // Track when workflow started
    lastHeartbeat: Date.now(), // Track last activity
  });

  // ✅ Fire-and-forget n8n trigger
  fetch('https://n8n-dev.datakernels.in/webhook/0488eff1-3f7b-4000-8acf-db7b94cc2c5a', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId, patientName }),
  }).catch(err => {
    // ⚠️ LOG ONLY — DO NOT FAIL JOB
    console.warn('⚠️ n8n trigger error (non-fatal):', err.message);
    
    // Mark as failed if n8n trigger fails
    updateMcpProgress(caseId, {
      step: 'N8N Trigger Failed',
      progress: 0,
      status: 'FAILED',
      failureReason: `N8N trigger error: ${err.message}`,
      failedAt: Date.now(),
    });
  });

  // ✅ Respond immediately
  res.json({ success: true, caseId });
});

/* ------------------------------------------------------------------ */
/* -------- FALLBACK: Handle progress updates sent to wrong endpoint - */
/* ------------------------------------------------------------------ */

// Sometimes n8n might send progress updates to the generate endpoint by mistake
app.post('/api/mcp-generate-progress', (req, res) => {
  console.log('⚠️  Progress update received at generate endpoint, redirecting...');
  
  // Forward to the correct progress endpoint
  const { caseId, step, progress, status, reportUrl, pdf_url } = req.body;
  
  if (caseId && (progress !== undefined || status || step)) {
    try {
      const existing = getMcpProgress(caseId);
      
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

app.post('/api/case-progress', (req, res) => {
  try {
    console.log('📈 Progress update received:', JSON.stringify(req.body, null, 2));
    console.log('📈 Headers:', JSON.stringify(req.headers, null, 2));
    
    const { caseId, step, progress, status, reportUrl, pdf_url } = req.body;

    if (!caseId) {
      console.error('❌ Missing caseId in progress update');
      console.error('❌ Full request body:', req.body);
      return res.status(400).json({ error: 'caseId is required' });
    }

    const existing = getMcpProgress(caseId);
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
/* -------- MCP PROGRESS FETCH (Frontend Polling) -------------------- */
/* ------------------------------------------------------------------ */

app.get('/api/case-status', (req, res) => {
  try {
    const { caseId } = req.query;
    
    if (!caseId) {
      return res.status(400).json({ error: 'caseId is required' });
    }

    const data = getMcpProgress(caseId);

    if (!data) {
      return res.json({
        caseId,
        progress: 0,
        step: 'Waiting',
        status: 'PROCESSING',
        pdf_url: null
      });
    }

    res.json({
      caseId: data.caseId,
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

/* -------------------- LCP GENERATE CASE ID (Step 1) ---------------- */
app.post('/api/lcp-generate-case', async (req, res) => {
  console.log('🔹 LCP Generate Case ID received');
  console.log('Body:', req.body);

  try {
    const { fullName, gender, maritalStatus, ethnicity } = req.body;

    // Generate unique case ID
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    const caseId = `LCP-${timestamp}-${random}`.toUpperCase();

    console.log('🔹 Generated LCP Case ID:', caseId);

    // Initialize progress for this case (similar to MCP)
    // Note: You may want to create an updateLcpProgress function similar to updateMcpProgress
    // updateLcpProgress(caseId, {
    //   step: 'Case Created',
    //   progress: 0,
    //   status: 'CREATED',
    // });

    res.json({
      success: true,
      caseId,
      patientName: fullName,
      metadata: { gender, maritalStatus, ethnicity },
    });

  } catch (err) {
    console.error('🔹 Generate LCP case error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
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
    const existingData = getMcpProgress(caseId);
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

    console.log('📋 Checking progress store with', mcpProgressStore.size, 'entries');

    // Convert progress data to report format
    for (const [caseId, progressData] of mcpProgressStore.entries()) {
      // Check if user has access to this case
      const hasAccess = await hasAccessToCase(userEmail, caseId);
      const userInitiated = progressData.initiatedBy === userEmail || progressData.userEmail === userEmail;
      
      if (!hasAccess && !userInitiated) {
        continue; // Skip cases user doesn't have access to
      }

      // Determine report type
      let reportType = 'MCP';
      if (caseId.toUpperCase().includes('LCP')) {
        reportType = 'LCP';
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

      // Create report object
      const report = {
        caseId,
        title: `${reportType} Case Report`,
        type: reportType,
        status: reportStatus,
        createdDate: new Date(progressData.timestamp || Date.now()).toLocaleString(),
        reportDate: progressData.status === 'COMPLETED' 
          ? new Date(progressData.completedAt || progressData.lastUpdated || Date.now()).toLocaleDateString()
          : null,
        s3Url: progressData.pdf_url || progressData.reportUrl || null,
        progress: progressData.progress || 0,
        step: progressData.step || 'Unknown',
        userEmail: progressData.userEmail || progressData.initiatedBy || userEmail
      };

      reports.push(report);
    }

    // Sort by creation date (newest first)
    reports.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));

    console.log('✅ Returning', reports.length, 'reports for user:', userEmail);

    res.json({
      success: true,
      reports,
      total: reports.length,
      userEmail
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
              url: `${API_BASE || 'http://localhost:3001'}/api/view-document/${location.bucket}/${encodeURIComponent(file.Key)}?userEmail=${encodeURIComponent(userEmail)}`,
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
    
    res.json({
      success: true,
      userEmail,
      caseCount: userCases.length,
      cases: userCases,
      message: `User ${userEmail} has access to ${userCases.length} cases`
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
    const permissions = await fetchUserPermissions();
    
    res.json({
      success: true,
      message: 'Permissions cache refreshed successfully',
      userCount: Object.keys(permissions).length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error refreshing permissions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ------------------------- START SERVER ---------------------------- */
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




