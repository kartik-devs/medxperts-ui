import React, { useState, useEffect } from 'react';
import { FolderOpen, FileText, Eye, Edit3, X, Search, RefreshCw } from 'lucide-react';
 
const PDFFileBrowser = ({ onSelectPDF, onClose, currentPDF }) => {
  const [availablePDFs, setAvailablePDFs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
 
  // Simulate loading PDF files from directory
  useEffect(() => {
    const loadPDFFiles = async () => {
      setLoading(true);
     
      // Simulate API call to get PDF files from src/PDF directory
      // In a real app, this would be an API endpoint
      const mockPDFs = [
        {
          filename: 'Farhan Ghori.pdf',
          displayName: 'Farhan Ghori - Medical Document',
          path: '/src/PDF/Farhan Ghori.pdf',
          size: '125 KB',
          lastModified: '2024-12-18',
          type: 'Medical Record',
          pages: 8
        },
        {
          filename: 'Cloud Computing[1].pdf',
          displayName: 'Cloud Computing Document',
          path: '/src/PDF/Cloud Computing[1].pdf',
          size: '2.3 MB',
          lastModified: '2024-12-17',
          type: 'Technical Document',
          pages: 45
        },
        // Add more PDFs as they're discovered in the directory
        {
          filename: 'Sample Report.pdf',
          displayName: 'Sample Medical Report',
          path: '/src/PDF/Sample Report.pdf',
          size: '890 KB',
          lastModified: '2024-12-16',
          type: 'Report',
          pages: 12
        }
      ];
 
      // Filter to only show files that actually exist
      const existingPDFs = mockPDFs.filter(pdf =>
        pdf.filename === 'Farhan Ghori.pdf' || pdf.filename === 'Cloud Computing[1].pdf'
      );
 
      setAvailablePDFs(existingPDFs);
      setLoading(false);
    };
 
    loadPDFFiles();
  }, []);
 
  const filteredPDFs = availablePDFs.filter(pdf =>
    pdf.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pdf.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pdf.type.toLowerCase().includes(searchQuery.toLowerCase())
  );
 
  const handleSelectFile = (pdf) => {
    setSelectedFile(pdf);
  };
 
  const handleOpenPDF = (pdf, mode = 'view') => {
    onSelectPDF(pdf, mode);
    onClose();
  };
 
  const refreshFiles = () => {
    setLoading(true);
    // Simulate refresh
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };
 
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <FolderOpen className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">PDF File Browser</h2>
              <p className="text-sm text-slate-500">Select a PDF file to review</p>
            </div>
          </div>
         
          <div className="flex items-center gap-2">
            <button
              onClick={refreshFiles}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Refresh file list"
            >
              <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
 
        {/* Search Bar */}
        <div className="p-6 border-b border-slate-200">
          <div className="relative">
            <input
              type="text"
              placeholder="Search PDF files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
          </div>
        </div>
 
        {/* File List */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Loading PDF files...</p>
              </div>
            </div>
          ) : filteredPDFs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 font-medium">No PDF files found</p>
                <p className="text-slate-400 text-sm">Try adjusting your search or add PDF files to the directory</p>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="grid gap-4">
                {filteredPDFs.map((pdf) => (
                  <div
                    key={pdf.filename}
                    className={`border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                      selectedFile?.filename === pdf.filename
                        ? 'border-blue-300 bg-blue-50'
                        : currentPDF === pdf.path
                        ? 'border-green-300 bg-green-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    onClick={() => handleSelectFile(pdf)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-6 h-6 text-red-600" />
                        </div>
                       
                        <div className="flex-1">
                          <h3 className="font-bold text-slate-900">{pdf.displayName}</h3>
                          <p className="text-sm text-slate-500">{pdf.filename}</p>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-xs text-slate-400">{pdf.size}</span>
                            <span className="text-xs text-slate-400">{pdf.pages} pages</span>
                            <span className="text-xs text-slate-400">Modified: {pdf.lastModified}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              pdf.type === 'Medical Record' ? 'bg-green-100 text-green-700' :
                              pdf.type === 'Technical Document' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {pdf.type}
                            </span>
                          </div>
                        </div>
                      </div>
 
                      <div className="flex items-center gap-2">
                        {currentPDF === pdf.path && (
                          <span className="px-3 py-1 bg-green-100 border border-green-300 rounded-full text-xs font-bold text-green-700">
                            Currently Viewing
                          </span>
                        )}
                       
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPDF(pdf, 'view');
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 border border-blue-300 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-200 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                       
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPDF(pdf, 'edit');
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-100 border border-green-300 text-green-700 text-xs font-bold rounded-lg hover:bg-green-200 transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
 
        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-600">
              {filteredPDFs.length} PDF file{filteredPDFs.length !== 1 ? 's' : ''} available
            </p>
           
            {selectedFile && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenPDF(selectedFile, 'view')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Open for Review
                </button>
                <button
                  onClick={() => handleOpenPDF(selectedFile, 'edit')}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  Open for Editing
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
 
export default PDFFileBrowser;