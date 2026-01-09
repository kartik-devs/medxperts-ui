// MCP API client
// Frontend → Express backend ONLY

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/* -------------------------------------------------- */
/* ---------------- MCP UPLOAD ---------------------- */
/* -------------------------------------------------- */
/**
 * Upload files + patient info
 * Backend:
 *  - forwards to n8n
 *  - gets caseId from n8n
 *  - initializes progress
 */
export async function uploadMCP(formData) {
  const res = await fetch(`${API_BASE}/api/mcp-upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'MCP upload failed');
  }

  return await res.json(); 
  // { success: true, caseId }
}

/* -------------------------------------------------- */
/* -------------- MCP GENERATE ---------------------- */
/* -------------------------------------------------- */
/**
 * Starts async MCP workflow
 */
export async function generateMCP(caseId, patientName) {
  const res = await fetch(`${API_BASE}/api/mcp-generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId, patientName }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to start MCP generation');
  }

  return await res.json();
}

/* -------------------------------------------------- */
/* --------------- MCP STATUS ----------------------- */
/* -------------------------------------------------- */
/**
 * Poll progress for progress page
 */
export async function getMCPStatus(caseId) {
  const res = await fetch(
    `${API_BASE}/api/case-status?caseId=${encodeURIComponent(caseId)}`,
    { cache: 'no-store' }
  );

  if (!res.ok) {
    throw new Error('Failed to fetch MCP status');
  }

  return await res.json();
}
