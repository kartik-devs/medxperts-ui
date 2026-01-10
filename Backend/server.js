import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS configuration for production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://medxperts-frountend.onrender.com', 'https://medxperts-frontend.onrender.com', 'https://medxperts-ui.onrender.com']
    : '*',
  credentials: true
};
app.use(cors(corsOptions));

// Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});
// Upload Files and Trigger N8N
app.post('/api/upload-files', upload.array('files'), async (req, res) => {
  try {
    const { caseId, fullName, gender, maritalStatus, ethnicity } = req.body;

    // Prepare files for N8N
    const filesData = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        filesData.push({
          filename: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          data: file.buffer.toString('base64')
        });
      });
    }

    // Send to N8N webhook
    const payload = {
      caseId,
      fullName: fullName || '',
      gender: gender || '',
      maritalStatus: maritalStatus || '',
      ethnicity: ethnicity || '',
      timestamp: new Date().toISOString(),
      fileCount: filesData.length,
      files: filesData
    };

    const n8nResponse = await fetch('https://n8n.datakernels.in/webhook/awscrm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseText = await n8nResponse.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    if (!n8nResponse.ok) {
      return res.status(n8nResponse.status).json({ 
        success: false,
        error: 'N8N webhook failed', 
        details: data 
      });
    }

    res.json({
      success: true,
      caseId,
      filesProcessed: req.files?.length || 0,
      n8nResponse: data
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Trigger N8N Workflow
app.post('/api/trigger-workflow', async (req, res) => {
  try {
    const { caseId, patientName } = req.body;

    if (!caseId) {
      return res.status(400).json({ error: 'caseId required' });
    }

    // Trigger N8N workflow
    const n8nResponse = await fetch('https://n8n-dev.datakernels.in/webhook/0488eff1-3f7b-4000-8acf-db7b94cc2c5a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, patientName })
    });

    if (!n8nResponse.ok) {
      throw new Error(`N8N workflow trigger failed: ${n8nResponse.status}`);
    }

    const data = await n8nResponse.json();

    res.json({ 
      success: true, 
      caseId,
      workflowTriggered: true,
      n8nResponse: data
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Health check endpoints
app.get('/api/health', (req, res) => {
  const healthCheck = {
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'N8N Backend API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB'
    },
    endpoints: {
      upload: '/api/upload-files',
      workflow: '/api/trigger-workflow',
      reports: '/api/report-history',
      search: '/api/search-cases',
      mcpGenerate: '/api/mcp-generate'
    }
  };
  
  res.status(200).json(healthCheck);
});

// Legacy test endpoint (kept for backward compatibility)
app.get('/api/test', (req, res) => {
  res.json({
    message: 'N8N Backend API is running!',
    timestamp: new Date().toISOString(),
    status: 'online'
  });
});

// Report History endpoint
app.get('/api/report-history', (req, res) => {
  const gmailId = req.query.gmailId;
  console.log('📊 Report history requested for:', gmailId);
  
  // Mock report history data
  const reports = [
    {
      caseId: 'MCP-24-802',
      title: 'Medical Cost Projection',
      status: 'Completed',
      created: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      reportDate: new Date().toISOString()
    },
    {
      caseId: 'LCP-24-891',
      title: 'Life Care Plan',
      status: 'Review Required',
      created: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
      reportDate: new Date().toISOString()
    },
    {
      caseId: 'MCP-24-890',
      title: 'Medical Cost Projection',
      status: 'Processing',
      created: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
      reportDate: null
    }
  ];
  
  res.json(reports);
});

// Search Cases endpoint
app.get('/api/search-cases', (req, res) => {
  const q = req.query.q?.trim();
  const gmailId = req.query.gmailId;
  
  console.log('🔍 Case search requested:', { query: q, user: gmailId });
  
  // Mock case IDs based on user
  const userCases = {
    'fsaghori777@gmail.com': ['0001', '0002', '0003', '0004', '0005', '0802', '0891', '0890'],
    'test@gmail.com': ['0001', '0002', '0003']
  };
  
  let cases = userCases[gmailId] || [];
  
  // Filter by query if provided
  if (q) {
    const normalized = /^\d{1,4}$/.test(q) ? q.padStart(4, '0') : q;
    cases = cases.filter(c => c.includes(normalized));
  }
  
  res.json(cases.slice(0, 50));
});

// MCP Generate endpoint
app.post('/api/mcp-generate', (req, res) => {
  const { caseId, patientName } = req.body;
  const userEmail = req.headers['x-user-email'];
  
  console.log('🔄 MCP generation requested:', { caseId, patientName, user: userEmail });
  
  if (!caseId) {
    return res.status(400).json({ error: 'caseId required' });
  }
  
  // Trigger N8N workflow (same as trigger-workflow endpoint)
  fetch('https://n8n-dev.datakernels.in/webhook/0488eff1-3f7b-4000-8acf-db7b94cc2c5a', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId, patientName }),
  }).catch(err => {
    console.warn('N8N trigger failed:', err.message);
  });
  
  res.json({ success: true, caseId, message: 'MCP generation started' });
});

// Start server with error handling
const server = app.listen(PORT, () => {
  console.log(`🚀 N8N Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
