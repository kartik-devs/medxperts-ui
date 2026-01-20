import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Profile from '../../components/Profile';
import UserPermissionsInfo from '../../components/UserPermissionsInfo';
import ServerStatus from '../../components/ServerStatus';
import ReportHistory from '../../components/ReportHistory';

import { searchCaseIds, getAllCaseIds, getCaseDocuments } from '../../contexts/search-case';

import {
  Search,
  AlertTriangle,
  Clock,
  FileText,
  Eye,
  Stethoscope,
  Scale,
  CheckCircle,
  ExternalLink,
  Copy,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

/* ==================== SEARCH CASE SECTION COMPONENT ==================== */
const SearchCaseSection = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSuggestions, setCaseSuggestions] = useState([]);
  const [searchingCases, setSearchingCases] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [copied, setCopied] = useState(false);
  
  // New state for workflow documents
  const [caseDocuments, setCaseDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [documentsError, setDocumentsError] = useState(null);

  // PDF Viewer state
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [showPdfViewer, setShowPdfViewer] = useState(false);

  // Handle case search
  const handleCaseSearch = async (value) => {
    setSearchQuery(value);
    
    // Fetch documents directly from AWS when 4 or more digits are entered
    if (value.trim().length >= 4) {
      // Auto-fetch documents for valid case IDs
      await fetchDocumentsForCase(value.trim());

      // Then search for case suggestions
      setSearchingCases(true);
      setShowSuggestions(true);
      try {
        const results = await searchCaseIds(value);
        setCaseSuggestions(results || []);
        
        // If exact match found, auto-select it
        if (results && results.includes(value.trim())) {
          setSelectedCase(value.trim());
        }
      } catch (err) {
        console.error('Case search failed:', err);
        setCaseSuggestions([]);
      } finally {
        setSearchingCases(false);
      }
    } else if (value.trim().length > 0) {
      // For less than 4 characters, just search without fetching documents
      setCaseDocuments([]);
      setDocumentsError(null);
      setSelectedCase(null);
      
      setSearchingCases(true);
      setShowSuggestions(true);
      try {
        const results = await searchCaseIds(value);
        setCaseSuggestions(results || []);
      } catch (err) {
        console.error('Case search failed:', err);
        setCaseSuggestions([]);
      } finally {
        setSearchingCases(false);
      }
    } else {
      // Clear everything when search is empty
      setShowSuggestions(false);
      setCaseSuggestions([]);
      setCaseDocuments([]);
      setDocumentsError(null);
      setSelectedCase(null);
    }
  };

  // Load all cases when input is focused
  const handleInputFocus = async () => {
    if (caseSuggestions.length === 0 && searchQuery.trim() === '') {
      setShowSuggestions(true);
      setSearchingCases(true);
      try {
        const allCases = await getAllCaseIds();
        setCaseSuggestions(allCases || []);
      } catch (err) {
        console.error('Failed to load all cases:', err);
      } finally {
        setSearchingCases(false);
      }
    } else {
      setShowSuggestions(true);
    }
  };

  // Handle case selection
  const handleSelectCase = async (caseId) => {
    setSelectedCase(caseId);
    setSearchQuery(caseId);
    setShowSuggestions(false);
    
    // Automatically fetch documents for the selected case
    await fetchDocumentsForCase(caseId);
  };

  // Function to fetch documents for a specific case
  const fetchDocumentsForCase = async (caseId) => {
    if (!caseId || caseId.trim().length < 4) return;
    
    setLoadingDocuments(true);
    setDocumentsError(null);
    setCaseDocuments([]);
    
    try {
      console.log('[Dashboard] Auto-fetching documents for selected case:', caseId);
      
      const responseData = await getCaseDocuments(caseId.trim());
      
      console.log('[Dashboard] Documents response:', responseData);
      
      if (responseData.success) {
        console.log('[Dashboard] Documents loaded successfully for case:', caseId);
        setCaseDocuments(responseData.documents || []);
        
        if (responseData.documents && responseData.documents.length > 0) {
          console.log(`✅ Found ${responseData.documents.length} documents for case ${caseId}`);
        } else {
          console.log(`ℹ️ No documents found for case ${caseId}`);
        }
      } else {
        setDocumentsError(responseData.error || 'Failed to fetch documents');
        console.error('❌ Failed to fetch documents:', responseData.error);
      }
    } catch (err) {
      console.error('[Dashboard] Document fetch error:', err);
      setDocumentsError(`Failed to fetch documents: ${err.message}`);
    } finally {
      setLoadingDocuments(false);
    }
  };

  // Copy case ID to clipboard
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('Unable to copy');
    }
  };

  // Navigate to case details (you can customize this based on your routing)
  const viewCaseDetails = (caseId) => {
    // Always use backend data now - no more localStorage dependency
    // The backend will automatically determine if it's MCP or LCP from S3 structure
    navigate(`/mcp-progress?caseId=${caseId}`);
  };

  // PDF Viewer functions
  const viewPdf = (document) => {
    setSelectedPdf(document);
    setShowPdfViewer(true);
  };

  const closePdfViewer = () => {
    setSelectedPdf(null);
    setShowPdfViewer(false);
  };

  const downloadDocument = (document) => {
    window.open(document.url, '_blank');
  };

  return (
    <div className="space-y-4 max-w-full">{/* Added max-w-full */}
      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleCaseSearch(e.target.value)}
            onFocus={handleInputFocus}
            onBlur={() => {
              // Delay hiding to allow clicking on suggestions
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            placeholder="Enter Case ID (e.g., 1234, 5678, 9012)"
            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        {/* Search Results Dropdown */}
        {showSuggestions && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">{/* Changed to overflow-y-auto */}
            {searchingCases ? (
              <div className="p-4 text-center text-slate-500">
                <div className="animate-pulse">Searching cases...</div>
              </div>
            ) : caseSuggestions.length > 0 ? (
              <div>
                <div className="px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 border-b border-slate-200">
                  {searchQuery.trim() ? 'Search Results' : 'Recent Cases'}
                </div>
                {caseSuggestions.slice(0, 10).map((caseId, index) => (
                  <button
                    key={index}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 flex items-center justify-between group"
                    onMouseDown={() => handleSelectCase(caseId)}
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-slate-400" />
                      <span className="font-mono text-sm text-slate-700">{caseId}</span>
                    </div>
                    <ExternalLink size={14} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-slate-500 text-sm">
                No matching case IDs found
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Case Display - Enhanced UI */}
      {selectedCase && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700 mb-1">Selected Case</p>
                <p className="font-mono text-xl font-bold text-blue-900">{selectedCase}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => fetchDocumentsForCase(selectedCase)}
                disabled={loadingDocuments}
                className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 flex items-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                <FileText size={16} />
                {loadingDocuments ? 'Loading...' : 'Load Documents'}
              </button>
              <button
                onClick={() => copyToClipboard(selectedCase)}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center gap-2 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Copy size={16} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={() => viewCaseDetails(selectedCase)}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 flex items-center gap-2 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <ExternalLink size={16} />
                View Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Documents Loading State - Enhanced */}
      {loadingDocuments && (
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-800 mb-1">Loading Documents</p>
              <p className="text-sm text-blue-600">Fetching case documents from AWS S3...</p>
            </div>
          </div>
        </div>
      )}

      {/* Documents Error - Enhanced */}
      {documentsError && (
        <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-800 mb-1">Error Loading Documents</p>
              <p className="text-sm text-red-600">{documentsError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Case Documents Display - Completely Enhanced */}
      {caseDocuments.length > 0 && caseDocuments.filter(doc => doc.type === 'pdf').length > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-6 shadow-sm">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-900 mb-1">
                  PDF Documents Found for {selectedCase || searchQuery}
                </h3>
                <p className="text-sm text-emerald-700">
                  {caseDocuments.filter(doc => doc.type === 'pdf').length} PDF document(s) retrieved from AWS S3
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchDocumentsForCase(selectedCase || searchQuery)}
              disabled={loadingDocuments}
              className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <RefreshCw size={16} className={loadingDocuments ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
          
          {/* Documents Grid */}
          <div className="grid gap-4">
            {caseDocuments
              .filter(doc => doc.type === 'pdf')
              .map((doc, index) => (
              <div key={index} className="bg-white border border-emerald-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-start justify-between">
                  {/* Document Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-base font-semibold text-gray-900 mb-1">
                          {doc.name || doc.filename || doc.title || `PDF Document ${index + 1}`}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                            PDF
                          </span>
                          {doc.size && (
                            <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                              Size: {doc.size >= 1024 * 1024 
                                ? `${(doc.size / (1024 * 1024)).toFixed(1)} MB` 
                                : `${Math.round(doc.size / 1024)} KB`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Document Metadata */}
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      {doc.bucket && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-700 min-w-16">Bucket:</span>
                          <span className="text-gray-600 font-mono text-xs">{doc.bucket}</span>
                        </div>
                      )}
                      {doc.path && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-700 min-w-16">Path:</span>
                          <span className="text-gray-600 font-mono text-xs break-all">{doc.path}</span>
                        </div>
                      )}
                      {doc.lastModified && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-700 min-w-16">Modified:</span>
                          <span className="text-gray-600">{new Date(doc.lastModified).toLocaleString()}</span>
                        </div>
                      )}
                      {doc.description && (
                        <div className="flex items-start gap-2 text-sm">
                          <span className="font-medium text-gray-700 min-w-16">Description:</span>
                          <span className="text-gray-600">{doc.description}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 ml-6">
                    <button
                      onClick={() => viewPdf(doc)}
                      className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 transition-all duration-200 shadow-sm hover:shadow-md min-w-28"
                    >
                      <Eye size={16} />
                      View PDF
                    </button>
                    {doc.url && (
                      <button
                        onClick={() => downloadDocument(doc)}
                        className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2 transition-all duration-200 shadow-sm hover:shadow-md min-w-28"
                      >
                        <ExternalLink size={16} />
                        Download
                      </button>
                    )}
                    <button
                      onClick={() => copyToClipboard(doc.url || JSON.stringify(doc, null, 2))}
                      className="px-4 py-2.5 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 flex items-center gap-2 transition-all duration-200 shadow-sm hover:shadow-md min-w-28"
                    >
                      <Copy size={16} />
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No PDF Documents Found Message - Enhanced */}
      {selectedCase && !loadingDocuments && !documentsError && caseDocuments.filter(doc => doc.type === 'pdf').length === 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-amber-900 mb-1">No PDF Documents Found</h3>
              <p className="text-sm text-amber-700">
                No PDF documents found for case <span className="font-mono font-semibold">{selectedCase}</span> in AWS S3.
              </p>
              <p className="text-sm text-amber-600 mt-1">
                {caseDocuments.length > 0 ? 
                  `Found ${caseDocuments.length} non-PDF document(s), but only PDFs are displayed here.` :
                  'Documents may still be processing or stored in a different location.'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer Modal - Enhanced */}
      {showPdfViewer && selectedPdf && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedPdf.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Case: <span className="font-mono font-semibold">{searchQuery}</span> • 
                    Size: <span className="font-semibold">{selectedPdf.size >= 1024 * 1024 
                      ? `${(selectedPdf.size / (1024 * 1024)).toFixed(1)} MB` 
                      : `${Math.round(selectedPdf.size / 1024)} KB`}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => downloadDocument(selectedPdf)}
                  className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 flex items-center gap-2 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <ExternalLink size={16} />
                  Download
                </button>
                <button
                  onClick={closePdfViewer}
                  className="px-4 py-2.5 bg-gray-600 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 p-6 overflow-hidden bg-gray-50">
              <div className="w-full h-full bg-white rounded-xl shadow-inner overflow-hidden">
                <iframe
                  src={selectedPdf.url}
                  className="w-full h-full border-0"
                  title={`PDF Viewer - ${selectedPdf.name}`}
                  style={{ minHeight: '500px' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const OperationsDashboard = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    activeCases: 0,
    inProgress: 0,
    completed: 0,
    issues: 0
  });
  const [caseLists, setCaseLists] = useState({
    activeCases: [],
    inProgress: [],
    completed: [],
    issues: []
  });
  const [assignedCaseIds, setAssignedCaseIds] = useState([]);
  const [totalCasesAccess, setTotalCasesAccess] = useState(0);
  const [expandedStat, setExpandedStat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);
  const [statsError, setStatsError] = useState(null);
  const [activeLcpCases, setActiveLcpCases] = useState([]);
  const [activeMcpCases, setActiveMcpCases] = useState([]);

  // Check for active MCP cases that were triggered through workflow
  const checkActiveMcpCases = () => {
    const mcpCases = [];
    
    // First check if there's a current active MCP case
    const currentMcpCaseId = localStorage.getItem('mcp_case_id');
    if (currentMcpCaseId) {
      // For MCP, we need to check backend progress or localStorage progress
      // Since MCP uses backend progress tracking, we'll mark it as active if it exists
      mcpCases.push({
        caseId: currentMcpCaseId,
        progress: 0, // Will be updated from backend
        step: 'Processing',
        status: 'PROCESSING',
        isActive: true
      });
    }
    
    setActiveMcpCases(mcpCases);
    return mcpCases;
  };

  // Check for active LCP cases that were triggered through workflow
  const checkActiveLcpCases = () => {
    // LCP cases are now stored in backend/S3, so we get them from dashboard stats
    // This function will be updated to use backend data instead of localStorage
    // For now, return empty array and let dashboard stats handle it
    setActiveLcpCases([]);
    return [];
  };

  // Fetch dashboard statistics from backend
  const fetchDashboardStats = async () => {
    try {
      const userEmail = localStorage.getItem('userEmail') || 
                       sessionStorage.getItem('userEmail');

      if (!userEmail) {
        console.warn('No user email found, skipping stats fetch');
        setLoading(false);
        return;
      }

      const API_URL = import.meta.env.VITE_API_BASE_URL || 
                     import.meta.env.VITE_API_BASE_URL_PRODUCTION || 
                     'https://medxperts-ui.onrender.com';

      console.log('📊 Fetching dashboard stats for:', userEmail);

      const response = await fetch(`${API_URL}/api/dashboard-stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log('✅ Dashboard stats loaded:', data.stats);
        setStats(data.stats);
        setCaseLists(data.caseLists || {
          activeCases: [],
          inProgress: [],
          completed: [],
          issues: []
        });
        setAssignedCaseIds(data.assignedCaseIds || []);
        setTotalCasesAccess(data.totalCasesAccess || 0);
        setRecentActivity(data.recentActivity || []);
        setStatsError(null);
      } else {
        throw new Error(data.message || 'Failed to load dashboard stats');
      }

    } catch (error) {
      console.error('❌ Error fetching dashboard stats:', error);
      setStatsError(error.message);
      // Keep existing stats on error
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats on mount and refresh periodically
  React.useEffect(() => {
    fetchDashboardStats();
    checkActiveLcpCases(); // Check for LCP cases on mount
    checkActiveMcpCases(); // Check for MCP cases on mount

    // Refresh stats every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardStats();
      checkActiveLcpCases(); // Also check LCP cases periodically
      checkActiveMcpCases(); // Also check MCP cases periodically
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Refresh report history when dashboard loads
  React.useEffect(() => {
    // Trigger report history refresh when dashboard loads
    if (window.refreshReportHistory) {
      setTimeout(() => {
        window.refreshReportHistory();
      }, 500);
    }
  }, []);
  const statsConfig = [
    { 
      label: 'Active Cases', 
      value: stats.activeCases, 
      icon: FileText, 
      color: 'blue',
      description: 'Cases in progress or pending',
      key: 'activeCases'
    },
    { 
      label: 'In Progress', 
      value: stats.inProgress, 
      icon: Clock, 
      color: 'yellow',
      description: 'Currently processing',
      key: 'inProgress'
    },
    { 
      label: 'Completed', 
      value: stats.completed, 
      icon: Eye, 
      color: 'green',
      description: 'Successfully completed',
      key: 'completed'
    },
    { 
      label: 'Issues', 
      value: stats.issues, 
      icon: AlertTriangle, 
      color: 'red',
      description: 'Failed or error cases',
      key: 'issues'
    },
  ];

  const handleCaseClick = (caseId, caseType = null) => {
    // Detect case type if not provided
    let detectedType = caseType;
    
    if (!detectedType) {
      // Check if this case has LCP progress in localStorage
      const lcpProgressKey = `lcpProgress_${caseId}`;
      const lcpProgress = localStorage.getItem(lcpProgressKey);
      
      if (lcpProgress) {
        try {
          const parsed = JSON.parse(lcpProgress);
          // Use stored report type if available
          if (parsed.reportType === 'LCP' || parsed.reportType === 'LCP_REDACTED') {
            detectedType = 'LCP';
          } else if (parsed.reportType === 'MCP') {
            detectedType = 'MCP';
          } else {
            // Fallback to checking if it has LCP workflow structure
            detectedType = 'LCP';
          }
        } catch (error) {
          console.warn('Failed to parse progress data for case', caseId);
          detectedType = 'MCP'; // Default fallback
        }
      } else {
        // Default to MCP for backward compatibility
        detectedType = 'MCP';
      }
    }
    
    if (detectedType === 'LCP') {
      localStorage.setItem('lcp_case_id', caseId);
      navigate('/lcp-progress');
    } else {
      localStorage.setItem('mcp_case_id', caseId);
      navigate('/mcp-progress');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-full">{/* Added max-w-full */}
      {/* ================= HEADER ================= */}
      <header className="flex justify-between items-center px-8 h-16 bg-white shadow-sm border-b border-slate-200">
        <h1 className="text-lg font-bold text-slate-700">
          Operations Console
        </h1>
        
        <div className="flex items-center gap-4">
          {/* Server Status */}
          <ServerStatus />
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Jump to Case ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
            />
          </div>

          {/* Profile Component */}
          <Profile />
        </div>
      </header>

      {/* ================= MAIN ================= */}
      <div className="flex-1 p-8">{/* Removed overflow-auto */}

        {/* -------- STATS ERROR MESSAGE -------- */}
        {statsError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Failed to load statistics</p>
              <p className="text-xs text-red-600 mt-1">{statsError}</p>
            </div>
            <button
              onClick={fetchDashboardStats}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* -------- STATS -------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsConfig.map((stat, i) => {
            const isExpanded = expandedStat === stat.key;
            const caseList = caseLists[stat.key] || [];
            const hasCase = caseList.length > 0;
            
            // For Active Cases, show all assigned cases
            const showAllAssigned = stat.key === 'activeCases';
            const displayList = showAllAssigned && isExpanded ? assignedCaseIds : caseList;

            return (
              <div key={i} className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                {/* Stats Card Header */}
                <div className="p-5 relative overflow-hidden">
                  {/* Loading overlay */}
                  {loading && (
                    <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg bg-${stat.color}-100`}>
                      <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-500">{stat.label}</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {loading ? '...' : stat.value}
                      </p>
                      {!loading && (
                        <>
                          <p className="text-xs text-slate-400 mt-1">{stat.description}</p>
                          {showAllAssigned && totalCasesAccess > 0 && (
                            <p className="text-xs text-blue-600 font-medium mt-1">
                              Total assigned: {totalCasesAccess}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expand button */}
                  {!loading && (showAllAssigned ? assignedCaseIds.length > 0 : hasCase) && (
                    <button
                      onClick={() => setExpandedStat(isExpanded ? null : stat.key)}
                      className="absolute top-3 right-3 p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      title={isExpanded ? 'Hide cases' : 'Show cases'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-600" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-600" />
                      )}
                    </button>
                  )}
                </div>

                {/* Expandable Case List */}
                {isExpanded && (showAllAssigned ? assignedCaseIds.length > 0 : hasCase) && (
                  <div className="border-t border-slate-200 bg-slate-50 max-h-64 overflow-y-auto">
                    {showAllAssigned ? (
                      // Show all assigned case IDs for Active Cases
                      <div className="p-3">
                        <div className="mb-2 px-2">
                          <p className="text-xs font-semibold text-slate-600 uppercase">
                            All Assigned Cases ({assignedCaseIds.length})
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Cases you have permission to access
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {displayList.map((caseId, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleCaseClick(caseId)}
                              className="p-2 bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all text-left group"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-semibold text-slate-900">
                                  {caseId}
                                </span>
                                <ExternalLink className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      // Show detailed case info for other stats
                      <div className="p-3 space-y-2">
                        {caseList.map((caseItem, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleCaseClick(caseItem.caseId, caseItem.type)}
                            className="w-full text-left p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all group"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-semibold text-slate-900">
                                    {caseItem.caseId}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                    caseItem.type === 'MCP'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-purple-100 text-purple-700'
                                  }`}>
                                    {caseItem.type}
                                  </span>
                                </div>
                                {caseItem.step && (
                                  <p className="text-xs text-slate-500 mt-1">{caseItem.step}</p>
                                )}
                                {caseItem.progress > 0 && caseItem.progress < 100 && (
                                  <div className="mt-2">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                      <span className="text-slate-600">Progress</span>
                                      <span className="font-semibold text-blue-600">{caseItem.progress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                                      <div 
                                        className="bg-blue-600 h-1.5 rounded-full transition-all"
                                        style={{ width: `${caseItem.progress}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <ExternalLink className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* No cases message */}
                {isExpanded && !showAllAssigned && !hasCase && (
                  <div className="border-t border-slate-200 bg-slate-50 p-4 text-center">
                    <p className="text-sm text-slate-500">No cases in this category</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* -------- RECENT ACTIVITY -------- */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-10">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">
              Recent Activity
            </h3>
            <button
              onClick={fetchDashboardStats}
              disabled={loading}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {loading && recentActivity.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-500">
                <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm">Loading recent activity...</p>
              </div>
            ) : recentActivity.length > 0 ? (
              recentActivity.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => {
                    // Check if this case has LCP progress in localStorage
                    const lcpProgressKey = `lcpProgress_${item.caseId}`;
                    const lcpProgress = localStorage.getItem(lcpProgressKey);
                    
                    if (lcpProgress || item.type === 'LCP') {
                      localStorage.setItem('lcp_case_id', item.caseId);
                      navigate('/lcp-progress');
                    } else {
                      localStorage.setItem('mcp_case_id', item.caseId);
                      navigate('/mcp-progress');
                    }
                  }}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {item.action}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          item.type === 'MCP'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {item.type}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {item.caseId}
                      </span>
                      {item.step && (
                        <span className="text-xs text-slate-400">
                          • {item.step}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">{item.timeAgo}</span>
                    {item.progress > 0 && (
                      <div className="mt-1">
                        <span className="text-xs font-medium text-blue-600">
                          {item.progress}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-slate-500">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium">No recent activity</p>
                <p className="text-xs text-slate-400 mt-1">
                  Start a new case to see activity here
                </p>
              </div>
            )}
          </div>
        </div>

        {/* -------- MCP & LCP (FIXED SIZE) -------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10 items-stretch">

          {/* MCP */}
          <div className="group cursor-pointer">
            <div className="h-full min-h-[260px] flex flex-col justify-between bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
              <div className="p-6">
                <div className="flex justify-between mb-4">
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-4 rounded-xl">
                    <Stethoscope className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="bg-green-100 px-3 py-1 rounded-full text-xs font-semibold text-green-700">
                      Medical
                    </span>
                    {activeMcpCases.length > 0 && (
                      <span className="bg-blue-100 px-2 py-0.5 rounded-full text-xs font-semibold text-blue-700">
                        {activeMcpCases.length} Active
                      </span>
                    )}
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-2">MCP Case Processing</h3>
                <p className="text-sm text-slate-600">
                  Medical Case Processing with comprehensive diagnostic analysis
                </p>
              </div>
              <div className="px-6 pb-6 space-y-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/medicalcostprojection');
                  }}
                  className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200 font-semibold text-sm"
                >
                  Start Processing →
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Check if there's an active MCP case that was triggered through workflow
                    const mcpCaseId = localStorage.getItem('mcp_case_id');
                    
                    if (mcpCaseId) {
                      // Navigate to MCP progress page
                      navigate('/mcp-progress');
                    } else {
                      // No workflow-triggered MCP cases found
                      alert('No active MCP workflow found. Please start a new MCP case and generate a report first.');
                    }
                  }}
                  className={`w-full px-4 py-2 rounded-lg transition-all duration-200 font-semibold text-sm flex items-center justify-center gap-2 ${
                    activeMcpCases.length > 0
                      ? 'bg-blue-50 border border-blue-300 text-blue-700 hover:bg-blue-100 hover:border-blue-400'
                      : 'bg-white border border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400'
                  }`}
                >
                  <Eye size={16} />
                  {activeMcpCases.length > 0 ? `Show Progress (${activeMcpCases.length})` : 'Show Progress'}
                </button>
              </div>
            </div>
          </div>

          {/* LCP */}
          <div className="group cursor-pointer">
            <div className="h-full min-h-[260px] flex flex-col justify-between bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
              <div className="p-6">
                <div className="flex justify-between mb-4">
                  <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-4 rounded-xl">
                    <Scale className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="bg-purple-100 px-3 py-1 rounded-full text-xs font-semibold text-purple-700">
                      Legal
                    </span>
                    {activeLcpCases.length > 0 && (
                      <span className="bg-green-100 px-2 py-0.5 rounded-full text-xs font-semibold text-green-700">
                        {activeLcpCases.length} Active
                      </span>
                    )}
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-2">New LCP Case</h3>
                <p className="text-sm text-slate-600">
                  Legal Case Processing with detailed documentation review
                </p>
              </div>
              <div className="px-6 pb-6 space-y-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/lifecareplan');
                  }}
                  className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 font-semibold text-sm"
                >
                  Start Processing →
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Check if there's an active LCP case from dashboard stats
                    if (activeLcpCases.length > 0) {
                      // Use the first active case
                      const firstCase = activeLcpCases[0];
                      localStorage.setItem('lcp_case_id', firstCase.caseId);
                      if (firstCase.generationId) {
                        localStorage.setItem('lcp_generation_id', firstCase.generationId);
                      }
                      navigate('/lcp-progress');
                    } else {
                      // No active LCP cases found
                      alert('No active LCP workflow found. Please start a new LCP case and generate a report first.');
                    }
                  }}
                  className={`w-full px-4 py-2 rounded-lg transition-all duration-200 font-semibold text-sm flex items-center justify-center gap-2 ${
                    activeLcpCases.length > 0
                      ? 'bg-green-50 border border-green-300 text-green-700 hover:bg-green-100 hover:border-green-400'
                      : 'bg-white border border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-400'
                  }`}
                >
                  <Eye size={16} />
                  {activeLcpCases.length > 0 ? `Show Progress (${activeLcpCases.length})` : 'Show Progress'}
                </button>
              </div>
            </div>
          </div>

          {/* LCP Review */}
          <div
            onClick={() => navigate('/lcp-review')}
            className="group cursor-pointer"
          >
            <div className="h-full min-h-[260px] flex flex-col justify-between bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
              <div className="p-6">
                <div className="flex justify-between mb-4">
                  <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-4 rounded-xl">
                    <CheckCircle className="w-7 h-7 text-white" />
                  </div>
                  <span className="bg-blue-100 px-3 py-1 rounded-full text-xs font-semibold text-blue-700">
                    Review
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-2">LCP Review</h3>
                <p className="text-sm text-slate-600">
                  Review and validate completed Legal Case Processing reports
                </p>
              </div>
              <div className="px-6 pb-6 text-blue-600 font-semibold text-sm">
                Start Review →
              </div>
            </div>
          </div>

        </div>

        {/* -------- SEARCH CASE ID SECTION -------- */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-10">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-600" />
              Search Case ID
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Find and access existing cases by entering a Case ID (filtered by your permissions)
            </p>
          </div>

          <div className="p-6">
            {/* User Permissions Info */}
            <div className="mb-6">
              <UserPermissionsInfo />
            </div>
            
            <SearchCaseSection />
          </div>
        </div>

        {/* -------- REPORT HISTORY DASHBOARD SECTION -------- */}
        <div className="mb-10">
          <ReportHistory />
        </div>
      </div>
    </div>
  );
};

export default OperationsDashboard;
