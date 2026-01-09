import { useState, useEffect } from 'react';
import { Download, FileText, RefreshCw, Eye } from 'lucide-react';
 
// Read-only PDF viewer component
const PDFReadOnly = ({
  pdfUrl = "/src/PDF/Farhan Ghori.pdf",
  fileName,
  caseId,
  generatedTime
}) => {
  const [fileSize, setFileSize] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState('Loading PDF...');
  const [actualFileName, setActualFileName] = useState(null);
  const [actualGeneratedTime, setActualGeneratedTime] = useState(null);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [totalPages, setTotalPages] = useState(null);
  const [pageCountLoading, setPageCountLoading] = useState(true);
  const [error, setError] = useState(null);
 
  // Extract file information from URL or use provided values
  const extractFileInfo = (url) => {
    try {
      const urlPath = url.split('/').pop();
      const decodedFileName = decodeURIComponent(urlPath);
     
      const caseIdMatch = decodedFileName.match(/#(\d{2}-\d{3})/);
      const extractedCaseId = caseIdMatch ? `#${caseIdMatch[1]}` : null;
     
      // Use the actual filename from the URL without modification
      let displayFileName = decodedFileName;
 
      return {
        fileName: displayFileName,
        caseId: extractedCaseId,
        generatedTime: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
      };
    } catch (error) {
      console.error('Error extracting file info:', error);
      return {
        fileName: 'Document.pdf',
        caseId: null,
        generatedTime: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
      };
    }
  };
 
  // Initialize file information
  useEffect(() => {
    const extracted = extractFileInfo(pdfUrl);
    setActualFileName(fileName || extracted.fileName);
    setActualGeneratedTime(generatedTime || extracted.generatedTime);
  }, [pdfUrl, fileName, generatedTime]);
 
  // Load PDF information dynamically
  useEffect(() => {
    const loadPDFInfo = async () => {
      try {
        setLoadingStatus('Loading PDF document...');
        setError(null);
        setPageCountLoading(true);
 
        // Get actual file size from the server
        try {
          const response = await fetch(pdfUrl, { method: 'HEAD' });
          const size = response.headers.get('content-length');
          if (size) {
            const sizeInBytes = parseInt(size);
            const formattedSize = sizeInBytes < 1024 * 1024
              ? `${(sizeInBytes / 1024).toFixed(0)} KB`
              : `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
            setFileSize(formattedSize);
          } else {
            // Fallback: try to get file size by fetching the file
            const fullResponse = await fetch(pdfUrl);
            const blob = await fullResponse.blob();
            const sizeInBytes = blob.size;
            const formattedSize = sizeInBytes < 1024 * 1024
              ? `${(sizeInBytes / 1024).toFixed(0)} KB`
              : `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
            setFileSize(formattedSize);
          }
        } catch (sizeError) {
          console.warn('Could not get file size:', sizeError);
          setFileSize('Unknown size');
        }
 
        // Try to get actual page count using PDF.js (if available)
        try {
          // Import PDF.js dynamically
          const pdfjsLib = await import('pdfjs-dist');
         
          // Set worker source
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
         
          // Load the PDF document
          const loadingTask = pdfjsLib.getDocument(pdfUrl);
          const pdf = await loadingTask.promise;
         
          // Get actual page count
          setTotalPages(pdf.numPages);
          setLoadingStatus(`PDF loaded successfully - ${pdf.numPages} pages`);
        } catch (pdfError) {
          console.warn('Could not get page count with PDF.js:', pdfError);
          // Fallback to estimated pages
          setTotalPages('Multiple');
          setLoadingStatus('PDF loaded successfully');
        }
 
        setPageCountLoading(false);
        setPdfLoaded(true);
      } catch (error) {
        console.error('Error loading PDF info:', error);
        setError(error.message);
        setLoadingStatus('Failed to load PDF');
        setPageCountLoading(false);
        setTotalPages('Error');
      }
    };
 
    if (pdfUrl) {
      loadPDFInfo();
    }
  }, [pdfUrl]);
 
  return (
    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm">
      {/* PDF Header */}
      <div className="flex justify-between items-center p-6 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <Eye className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">
              {actualFileName || 'Loading...'}
            </h3>
            <p className="text-xs text-slate-400">
              Generated {actualGeneratedTime || 'N/A'} • {pdfLoaded ? 'Read-only view' : loadingStatus} • {pageCountLoading ? 'Counting pages...' : totalPages ? `${totalPages} pages` : 'Unknown pages'} • {fileSize || 'Calculating...'}
            </p>
          </div>
        </div>
       
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded text-xs text-blue-600">
            <Eye className="w-3 h-3" />
            <span>Read Only</span>
          </div>
         
          <button
            title="Download PDF"
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            onClick={() => window.open(pdfUrl, '_blank')}
          >
            <Download className="w-4 h-4 text-slate-600" />
          </button>
         
          <button
            title="Refresh PDF Viewer"
            onClick={() => window.location.reload()}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-slate-600" />
          </button>
         
          <button
            title="Print Document"
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            onClick={() => window.print()}
          >
            <FileText className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>
 
      {/* PDF Viewer */}
      <div className="bg-slate-100 p-6">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Loading State */}
          {(!pdfLoaded && !error) && (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600 font-medium">Loading PDF Document...</p>
                <p className="text-slate-400 text-sm mt-2">{loadingStatus}</p>
              </div>
            </div>
          )}
 
          {/* Error State */}
          {error && (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <FileText className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-red-600 font-medium mb-2">Failed to load PDF</p>
                <p className="text-slate-400 text-sm mb-4">{error}</p>
                <div className="space-y-2">
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry
                  </button>
                  <br />
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </a>
                </div>
              </div>
            </div>
          )}
 
          {/* PDF Viewer - Embedded PDF (Read-only) */}
          {pdfLoaded && (
            <div className="bg-slate-50 p-4">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <embed
                  src={`${pdfUrl}#view=FitH&toolbar=0&navpanes=0&scrollbar=1`}
                  type="application/pdf"
                  width="100%"
                  height="600px"
                  className="border-0"
                  title="PDF Document - Read Only View"
                />
 
                {/* Footer with document info */}
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200 text-center">
                  <p className="text-sm text-blue-700">
                    📖 Read-only document • {totalPages === 'Multiple' ? 'All pages visible' : `${totalPages} pages`} • No editing allowed
                  </p>
                  <p className="text-xs text-blue-500 mt-1">
                    Use browser zoom controls for better viewing
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
 
export default PDFReadOnly;