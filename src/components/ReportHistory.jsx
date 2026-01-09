import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  AlertTriangle,
  FileText,
  Eye,
  Download,
  RefreshCw,
  Filter,
  ChevronDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const ReportHistory = () => {
  const navigate = useNavigate();
  const abortControllerRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [sortBy, setSortBy] = useState('Newest First');
  const [showFilters, setShowFilters] = useState(false);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [processingReports, setProcessingReports] = useState(new Set());
  const [pollingActive, setPollingActive] = useState(false);

  // Enhanced error handling with retry logic
  const handleError = useCallback((err, context = 'Unknown') => {
    console.error(`❌ Report History Error [${context}]:`, err);
    
    if (err.name === 'AbortError') {
      console.log('🚫 Request was aborted');
      return;
    }
    
    const errorMessage = err.message || 'Unknown error occurred';
    setError(`${context}: ${errorMessage}`);
    
    // Auto-retry logic for network errors
    if (retryCount < 3 && (err.name === 'TypeError' || err.message.includes('fetch'))) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff
      console.log(`🔄 Auto-retry in ${delay}ms (attempt ${retryCount + 1}/3)`);
      
      retryTimeoutRef.current = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        loadReports();
      }, delay);
    }
  }, [retryCount]);

  // Enhanced report loading with better error handling
  const loadReports = useCallback(async (showLoadingState = true) => {
    try {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      
      if (showLoadingState) {
        setLoading(true);
      }
      setError(null);

      // Get user email with fallback options
      const userEmail = localStorage.getItem('userEmail') || 
                       sessionStorage.getItem('userEmail') || 
                       window.currentUserEmail ||
                       document.querySelector('[data-user-email]')?.dataset.userEmail;

      if (!userEmail) {
        throw new Error('User authentication required. Please log in again.');
      }

      console.log('📊 Loading reports for user:', userEmail);

      const response = await fetch(`${API_BASE}/api/report-history`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail,
        },
        signal: abortControllerRef.current.signal,
        // Prevent caching for real-time data
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to load reports');
      }

      const newReports = data.reports || [];
      
      // Validate report data structure
      const validatedReports = newReports.map(report => ({
        caseId: report.caseId || 'Unknown',
        title: report.title || 'Untitled Report',
        type: report.type || 'MCP',
        status: report.status || 'Pending',
        createdDate: report.createdDate || new Date().toLocaleString(),
        reportDate: report.reportDate || null,
        s3Url: report.s3Url || null,
        progress: Math.max(0, Math.min(100, report.progress || 0)),
        step: report.step || 'Unknown',
        userEmail: report.userEmail || userEmail,
        // Add metadata for better tracking
        lastUpdated: report.lastUpdated || Date.now(),
        isStale: false,
      }));

      setReports(validatedReports);
      setLastUpdated(new Date());
      setRetryCount(0); // Reset retry count on success
      
      // Track processing reports for smart polling
      const processing = new Set();
      const pending = new Set();
      validatedReports.forEach(report => {
        if (report.status === 'Processing') {
          processing.add(report.caseId);
        } else if (report.status === 'Pending') {
          pending.add(report.caseId);
        }
      });
      setProcessingReports(processing);
      
      console.log('✅ Loaded reports:', {
        total: validatedReports.length,
        processing: processing.size,
        pending: pending.size,
        completed: validatedReports.filter(r => r.status === 'Generated').length,
        failed: validatedReports.filter(r => r.status === 'Failed').length,
      });

      // Log polling decision
      if (processing.size === 0 && pending.size === 0) {
        console.log('🛑 No active reports - polling will stop');
      } else if (processing.size > 0) {
        console.log(`🚀 ${processing.size} processing reports - fast polling will continue`);
      } else {
        console.log(`⏸️ ${pending.size} pending reports - slow polling will continue`);
      }
      
    } catch (err) {
      handleError(err, 'Loading Reports');
      setReports([]); // Clear reports on error
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  // Smart polling - only poll when there are processing reports
  useEffect(() => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (processingReports.size === 0) {
      // No processing reports - check if we should stop polling entirely
      const hasAnyActiveReports = reports.some(report => 
        report.status === 'Processing' || report.status === 'Pending'
      );
      
      if (!hasAnyActiveReports) {
        console.log('🛑 All reports are completed/failed. Stopping polling.');
        setPollingActive(false);
        return; // Stop all polling
      }
      
      // Some reports exist but none processing, use slower refresh rate
      pollingIntervalRef.current = setInterval(() => {
        console.log('🔄 Slow polling: checking for new reports...');
        loadReports(false); // Don't show loading state for background refresh
      }, 30000); // 30 seconds for idle state
      
      setPollingActive(true);
      console.log('⏸️ Slow polling active: no processing reports');
      
    } else {
      // Has processing reports, use faster polling
      pollingIntervalRef.current = setInterval(() => {
        console.log('🔄 Fast polling: checking processing reports...');
        loadReports(false); // Don't show loading state for background refresh
      }, 5000); // 5 seconds for active processing
      
      setPollingActive(true);
      console.log(`🚀 Fast polling active: ${processingReports.size} processing reports`);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [processingReports.size, reports.length, loadReports]);

  // Initial load and event listeners
  useEffect(() => {
    loadReports();
    
    // Enhanced global refresh function
    window.refreshReportHistory = (reason = 'Manual') => {
      console.log(`🔄 Report history refresh triggered: ${reason}`);
      setRetryCount(0); // Reset retry count
      loadReports();
    };
    
    // Listen for various events
    const handleReportGenerated = (event) => {
      console.log('🔄 Report generated event received:', event.detail);
      setTimeout(() => loadReports(false), 1000); // Small delay to ensure backend is updated
    };
    
    const handleReportFailed = (event) => {
      console.log('❌ Report failed event received:', event.detail);
      setTimeout(() => loadReports(false), 500); // Immediate refresh for failures
    };
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 Tab became visible, refreshing reports');
        loadReports(false);
      }
    };
    
    const handleFocus = () => {
      console.log('🔄 Window focused, refreshing reports');
      loadReports(false);
    };
    
    // Event listeners
    window.addEventListener('reportGenerated', handleReportGenerated);
    window.addEventListener('mcpCompleted', handleReportGenerated);
    window.addEventListener('mcpFailed', handleReportFailed);
    window.addEventListener('workflowFailed', handleReportFailed);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    // Cleanup
    return () => {
      // Clear all timers and controllers
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      
      // Remove event listeners
      delete window.refreshReportHistory;
      window.removeEventListener('reportGenerated', handleReportGenerated);
      window.removeEventListener('mcpCompleted', handleReportGenerated);
      window.removeEventListener('mcpFailed', handleReportGenerated);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadReports]);

  // Enhanced filtering and sorting
  const filteredReports = reports
    .filter(report => {
      const matchesSearch = !searchQuery || 
        report.caseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.step.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'All Status' || report.status === statusFilter;
      const matchesType = typeFilter === 'All Types' || report.type === typeFilter;
      
      return matchesSearch && matchesStatus && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === 'Newest First') {
        return new Date(b.createdDate) - new Date(a.createdDate);
      } else if (sortBy === 'Oldest First') {
        return new Date(a.createdDate) - new Date(b.createdDate);
      } else if (sortBy === 'Status') {
        const statusOrder = { 'Processing': 0, 'Failed': 1, 'Generated': 2, 'Pending': 3 };
        return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
      }
      return 0;
    });

  // Enhanced action handlers
  const handleViewReport = useCallback((report) => {
    console.log('👁️ View report action:', report.caseId, report.status);
    
    if (report.status === 'Processing') {
      // Go to MCP progress page to see live progress
      localStorage.setItem('mcp_case_id', report.caseId);
      navigate('/mcp-progress');
      return;
    }
    
    if (report.status === 'Generated' && report.s3Url) {
      // Open PDF directly with error handling
      try {
        window.open(report.s3Url, '_blank', 'noopener,noreferrer');
      } catch (err) {
        console.error('Failed to open PDF:', err);
        alert('Failed to open PDF. Please try downloading instead.');
      }
      return;
    }
    
    if (report.status === 'Failed') {
      // Go to MCP progress page to see error details
      localStorage.setItem('mcp_case_id', report.caseId);
      navigate('/mcp-progress');
      return;
    }
    
    // Default: go to generation page
    localStorage.setItem('mcp_case_id', report.caseId);
    navigate('/medicalcostprojection');
  }, [navigate]);

  const handleDownloadReport = useCallback((report) => {
    if (!report.s3Url) {
      alert('Download URL not available');
      return;
    }
    
    try {
      const link = document.createElement('a');
      link.href = report.s3Url;
      link.download = `${report.caseId}-${report.type}-report.pdf`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('📥 Download initiated:', report.caseId);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Download failed. Please try opening the PDF directly.');
    }
  }, []);

  const handleRetry = useCallback((report) => {
    console.log('🔄 Retry action:', report.caseId);
    localStorage.setItem('mcp_case_id', report.caseId);
    navigate('/medicalcostprojection');
  }, [navigate]);

  // Enhanced status badge with more visual feedback
  const StatusBadge = ({ status, progress, step }) => {
    const getStatusConfig = () => {
      switch (status) {
        case 'Generated':
          return {
            icon: <CheckCircle size={14} />,
            text: 'Completed',
            className: 'bg-green-100 text-green-700 border-green-200',
          };
        case 'Processing':
          return {
            icon: <Loader2 size={14} className="animate-spin" />,
            text: `Processing ${progress ? `(${progress}%)` : ''}`,
            className: 'bg-blue-100 text-blue-700 border-blue-200',
          };
        case 'Failed':
          return {
            icon: <XCircle size={14} />,
            text: 'Failed',
            className: 'bg-red-100 text-red-700 border-red-200',
          };
        default:
          return {
            icon: <Clock size={14} />,
            text: 'Pending',
            className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
          };
      }
    };

    const config = getStatusConfig();
    
    return (
      <div className="flex flex-col gap-1">
        <span className={`px-3 py-1 text-xs font-semibold rounded-full border flex items-center gap-2 ${config.className}`}>
          {config.icon}
          {config.text}
        </span>
        {status === 'Processing' && step && (
          <span className="text-xs text-slate-500 px-3">
            {step}
          </span>
        )}
      </div>
    );
  };

  // Enhanced action buttons with better UX
  const ActionButtons = ({ report }) => {
    if (report.status === 'Processing') {
      return (
        <div className="flex gap-2">
          <button
            onClick={() => handleViewReport(report)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Eye size={16} />
            View Progress
          </button>
        </div>
      );
    }
    
    if (report.status === 'Generated') {
      return (
        <div className="flex gap-2">
          <button
            onClick={() => handleViewReport(report)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Eye size={16} />
            View PDF
          </button>
          {report.s3Url && (
            <button
              onClick={() => handleDownloadReport(report)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <Download size={16} />
              Download
            </button>
          )}
        </div>
      );
    }
    
    if (report.status === 'Failed') {
      return (
        <div className="flex gap-2">
          <button
            onClick={() => handleViewReport(report)}
            className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <AlertCircle size={16} />
            View Error
          </button>
          <button
            onClick={() => handleRetry(report)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={() => handleRetry(report)}
        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
      >
        Generate Report
      </button>
    );
  };

  // Loading state
  if (loading && reports.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="p-12 text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-600">Loading report history…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Report History
          </h3>
          <div className="flex items-center gap-2">
            {processingReports.size > 0 && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" />
                {processingReports.size} processing
              </span>
            )}
            {!pollingActive && reports.length > 0 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                All complete
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-500">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => loadReports()}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors flex items-center gap-2"
          >
            <Filter size={16} />
            Filters
            <ChevronDown size={16} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200 text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button
            onClick={() => {
              setError(null);
              setRetryCount(0);
              loadReports();
            }}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="p-6 border-b border-slate-200">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Case ID, Title, Type, or Step..."
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option>All Status</option>
                <option>Pending</option>
                <option>Processing</option>
                <option>Generated</option>
                <option>Failed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option>All Types</option>
                <option>MCP</option>
                <option>LCP</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option>Newest First</option>
                <option>Oldest First</option>
                <option>Status</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Case ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Title / Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Report Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {filteredReports.map((report, index) => (
              <tr key={`${report.caseId}-${index}`} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap font-mono text-blue-600 font-medium">
                  {report.caseId}
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{report.title}</div>
                  <div className="text-xs text-slate-500">{report.type}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                  {report.createdDate}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge 
                    status={report.status} 
                    progress={report.progress} 
                    step={report.step}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                  {report.reportDate || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <ActionButtons report={report} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {filteredReports.length === 0 && !loading && (
        <div className="p-12 text-center text-slate-500">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No reports found</h3>
          <p className="text-sm text-slate-600 mb-4">
            {searchQuery || statusFilter !== 'All Status' || typeFilter !== 'All Types'
              ? 'Try adjusting your search or filter criteria.'
              : 'No reports generated yet.'}
          </p>
          {error && (
            <button
              onClick={() => {
                setError(null);
                setRetryCount(0);
                loadReports();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportHistory;