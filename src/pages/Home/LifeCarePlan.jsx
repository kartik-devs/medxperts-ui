import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, CheckCircle2, Copy, ChevronDown, Zap } from 'lucide-react';
import { searchCaseIds, addCaseToLocalStorage, getAllCaseIds, testAPIConnection } from '../../contexts/search-case';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export default function LifeCarePlanPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('upload');
  
  // Form fields
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [ethnicity, setEthnicity] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [email, setEmail] = useState('');
  const [files, setFiles] = useState([]);
  
  // 2-Step Flow State
  const [generatedCaseId, setGeneratedCaseId] = useState(null); // Step 1: Generated caseId
  const [isGenerating, setIsGenerating] = useState(false);       // Step 1: Loading state
  const [isUploading, setIsUploading] = useState(false);         // Step 2: Loading state
  const [uploadComplete, setUploadComplete] = useState(false);   // Step 2: Success state
  
  const [copied, setCopied] = useState(false);
  
  // Report tab state
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [caseSuggestions, setCaseSuggestions] = useState([]);
  const [searchingCases, setSearchingCases] = useState(false);
  const [reportStatus, setReportStatus] = useState('IDLE');

  // Add to Existing Case state
  const [existingCaseId, setExistingCaseId] = useState('');
  const [existingCaseSuggestions, setExistingCaseSuggestions] = useState([]);
  const [searchingExistingCases, setSearchingExistingCases] = useState(false);
  const [existingFiles, setExistingFiles] = useState([]);
  const [isUploadingExisting, setIsUploadingExisting] = useState(false);
  const [existingUploadComplete, setExistingUploadComplete] = useState(false);

  const MAX_FILES = 10;

  // ============ FILE HANDLING ============
  const handleFiles = async (e) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;
    const arr = Array.from(selected);

    const validFiles = arr.filter(file => {
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'image/jpg'];
      const maxSize = 10 * 1024 * 1024;

      if (!validTypes.includes(file.type)) {
        alert(`File ${file.name} is not a supported format.`);
        return false;
      }
      if (file.size > maxSize) {
        alert(`File ${file.name} is too large. Maximum 10MB.`);
        return false;
      }
      return true;
    });

    setFiles((prev) => [...prev, ...validFiles].slice(0, MAX_FILES));
    if (e?.currentTarget) e.currentTarget.value = '';
  };

  const removeFile = (index) => setFiles((prev) => prev.filter((_, i) => i !== index));

  // ============ VALIDATION ============
  const validateForm = () => {
    if (!fullName.trim()) return 'Please enter full name.';
    if (!gender) return 'Please select gender.';
    if (!maritalStatus) return 'Please select marital status.';
    if (!ethnicity) return 'Please select ethnicity.';
    if (!dateOfBirth) return 'Please enter date of birth.';
    if (!email) return 'Please enter email address.';
    if (!/^\S+@\S+\.\S+$/.test(email)) return 'Please enter a valid email address.';
    return null;
  };

  // ============ STEP 1: GENERATE CASE ID ============
  const handleGenerate = async () => {
    const err = validateForm();
    if (err) {
      alert(err);
      return;
    }

    setIsGenerating(true);
    setGeneratedCaseId(null);
    setUploadComplete(false);

    try {
      const res = await fetch(`${API_BASE}/api/mcp-generate-case`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          gender,
          maritalStatus,
          ethnicity,
          dateOfBirth,
          email
        }),
      });

      const data = await res.json();
      console.log('[LCP] Generate case response:', data);

      if (!res.ok || !data.caseId) {
        throw new Error(data.error || 'Failed to generate case ID');
      }

      setGeneratedCaseId(data.caseId);
      
      // Store in localStorage for future use
      addCaseToLocalStorage({
        caseId: data.caseId,
        patientName: fullName,
        submittedAt: new Date().toISOString(),
        gender,
        maritalStatus,
        dateOfBirth,
        email,
        ethnicity
      });

    } catch (err) {
      console.error('Generate error:', err);
      alert(`Failed to generate case: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ============ STEP 2: UPLOAD FILES ============
const handleUpload = async () => {
  if (!generatedCaseId) {
    alert('Please generate a Case ID first');
    return;
  }
  if (files.length === 0) {
    alert('Please select at least one file');
    return;
  }

  setIsUploading(true);

  try {
    const formData = new FormData();
    formData.append('caseId', generatedCaseId);
    formData.append('fullName', fullName);
    formData.append('gender', gender);
    formData.append('maritalStatus', maritalStatus);
    formData.append('ethnicity', ethnicity);
    formData.append('dateOfBirth', dateOfBirth);
    formData.append('email', email);
    
    // Add all files to FormData
    files.forEach((file) => {
      formData.append('file', file);
    });

    console.log('Sending files to n8n webhook...', {
      caseId: generatedCaseId,
      fileCount: files.length,
      fileNames: files.map(f => f.name)
    });

    const res = await fetch('https://n8n.datakernels.in/webhook/awscrm', {
      method: 'POST',
      body: formData,
    });

    // Handle empty or non-JSON response
    const responseText = await res.text();
    let responseData = {};
    
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      console.log('Non-JSON response:', responseText);
      // If the response is not JSON but the status is OK, consider it a success
      if (res.ok) {
        setUploadComplete(true);
        console.log('Files uploaded successfully to n8n, caseId:', generatedCaseId);
        return;
      }
    }

    console.log('[LCP] n8n webhook response:', responseData);

    if (!res.ok) {
      throw new Error(responseData.error || `Upload failed with status ${res.status}`);
    }

    // If we get here, the upload was successful
    setUploadComplete(true);
    console.log('Files uploaded successfully to n8n, caseId:', generatedCaseId);

  } catch (err) {
    console.error('Upload error:', err);
    const errorMessage = err.message || 'Unknown error occurred during upload';
    alert(`Upload failed: ${errorMessage}`);
    
    console.error('Upload error details:', {
      caseId: generatedCaseId,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  } finally {
    setIsUploading(false);
  }
};
  // ============ RESET FORM ============
  const handleReset = () => {
    setGeneratedCaseId(null);
    setUploadComplete(false);
    setFiles([]);
    setFullName('');
    setGender('');
    setMaritalStatus('');
    setEthnicity('');
  };

  // ============ COPY TO CLIPBOARD ============
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('Unable to copy');
    }
  };

  // ============ CASE SEARCH (Report Tab) ============
  const handleCaseSearch = async (value) => {
    setSearchingCases(true);
    try {
      const results = await searchCaseIds(value);
      setCaseSuggestions(results || []);
    } catch (err) {
      console.error('Case search failed:', err);
      setCaseSuggestions([]);
    } finally {
      setSearchingCases(false);
    }
  };

  const handleInputFocus = async () => {
    if (caseSuggestions.length === 0) {
      setSearchingCases(true);
      try {
        const allCases = await getAllCaseIds();
        setCaseSuggestions(allCases || []);
      } catch (err) {
        console.error('Failed to load cases:', err);
      } finally {
        setSearchingCases(false);
      }
    }
  };

  // ============ GENERATE REPORT (Report Tab) ============
  const generateLCPRedactedReport = async () => {
    if (!selectedCaseId.trim()) {
      alert('Please enter or select a Case ID');
      return;
    }

    try {
      setReportStatus('PROCESSING');
      localStorage.setItem('lcp_case_id', selectedCaseId);

      await fetch('https://n8n.datakernels.in/webhook/mainworkflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: selectedCaseId,
          patientName: '', // Patient name removed from UI
          reportType: 'LCP_REDACTED', // Added to identify the report type
        }),
      });

      navigate('/lcp-progress');
    } catch (err) {
      console.error(err);
      setReportStatus('FAILED');
      alert('Failed to start report generation');
    }
  };

  // ============ EXISTING CASE FILE HANDLING ============
  const handleExistingFiles = async (e) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;
    const arr = Array.from(selected);

    const validFiles = arr.filter(file => {
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'image/jpg'];
      const maxSize = 10 * 1024 * 1024;

      if (!validTypes.includes(file.type)) {
        alert(`File ${file.name} is not a supported format.`);
        return false;
      }
      if (file.size > maxSize) {
        alert(`File ${file.name} is too large. Maximum 10MB.`);
        return false;
      }
      return true;
    });

    setExistingFiles((prev) => [...prev, ...validFiles].slice(0, MAX_FILES));
    if (e?.currentTarget) e.currentTarget.value = '';
  };

  const removeExistingFile = (index) => setExistingFiles((prev) => prev.filter((_, i) => i !== index));

  // ============ EXISTING CASE SEARCH ============
  const handleExistingCaseSearch = async (value) => {
    setSearchingExistingCases(true);
    try {
      const results = await searchCaseIds(value);
      setExistingCaseSuggestions(results || []);
    } catch (err) {
      console.error('Case search failed:', err);
      setExistingCaseSuggestions([]);
    } finally {
      setSearchingExistingCases(false);
    }
  };

  const handleExistingInputFocus = async () => {
    if (existingCaseSuggestions.length === 0) {
      setSearchingExistingCases(true);
      try {
        const allCases = await getAllCaseIds();
        setExistingCaseSuggestions(allCases || []);
      } catch (err) {
        console.error('Failed to load cases:', err);
      } finally {
        setSearchingExistingCases(false);
      }
    }
  };

  // ============ UPLOAD TO EXISTING CASE ============
  const handleUploadToExisting = async () => {
    if (!existingCaseId.trim()) {
      alert('Please select a Case ID');
      return;
    }
    // Removed file count validation - allow 0 files

    setIsUploadingExisting(true);

    try {
      const fd = new FormData();
      fd.append('caseId', existingCaseId);
      fd.append('isAdditionalUpload', 'true');
      
      // Add files if any exist
      existingFiles.forEach((file) => {
        fd.append('attachments', file);
      });

      // Use the working webhook URL
      const res = await fetch('https://n8n.datakernels.in/webhook/awscrm', {
        method: 'POST',
        body: fd,
      });

      const data = await res.json();
      console.log('[LCP] Upload to existing case response:', data);

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setExistingUploadComplete(true);

    } catch (err) {
      console.error('Upload error:', err);
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploadingExisting(false);
    }
  };

  // ============ RESET EXISTING CASE FORM ============
  const handleResetExisting = () => {
    setExistingCaseId('');
    setExistingFiles([]);
    setExistingUploadComplete(false);
  };

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Life Care Plan</h1>
          <p className="text-slate-600">Upload your information and documents to generate a detailed analysis</p>
        </div>

        {/* Tab Toggle */}
        <div className="mb-8 bg-slate-100 rounded-2xl p-1 border border-slate-200 inline-flex gap-1 flex-wrap">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-3 rounded-lg font-semibold transition text-sm ${activeTab === 'upload'
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
              : 'bg-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            1. New Case
          </button>
          <button
            onClick={() => setActiveTab('addDocs')}
            className={`px-4 py-3 rounded-lg font-semibold transition text-sm ${activeTab === 'addDocs'
              ? 'bg-gradient-to-r from-green-600 to-green-700 text-white'
              : 'bg-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Add Documents
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-4 py-3 rounded-lg font-semibold transition text-sm ${activeTab === 'report'
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
              : 'bg-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Generate Report
          </button>
        </div>

        {/* ============ UPLOAD TAB ============ */}
        {activeTab === 'upload' && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6 border border-slate-200">

            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Full name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                placeholder="Enter patient full name"
                disabled={!!generatedCaseId}
              />
            </div>

            {/* Gender & Marital Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Gender</label>
                <div className="space-y-2">
                  {['male', 'female', 'other'].map((opt) => (
                    <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name="gender"
                        checked={gender === opt}
                        onChange={() => setGender(opt)}
                        className="w-4 h-4 accent-blue-500"
                        disabled={!!generatedCaseId}
                      />
                      <span className="text-slate-700 capitalize">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Marital status</label>
                <select
                  className="w-full px-4 py-3 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  value={maritalStatus}
                  onChange={(e) => setMaritalStatus(e.target.value)}
                  disabled={!!generatedCaseId}
                >
                  <option value="">Select status</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                </select>
              </div>
            </div>

            {/* Ethnicity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Ethnicity</label>
                <select
                  className="w-full px-4 py-3 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  value={ethnicity}
                  onChange={(e) => setEthnicity(e.target.value)}
                  disabled={!!generatedCaseId}
                >
                  <option value="">Select ethnicity</option>
                  <option value="asian">Asian</option>
                  <option value="black">Black / African descent</option>
                  <option value="hispanic">Hispanic / Latino</option>
                  <option value="white">White / Caucasian</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Date of Birth</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  max={new Date().toISOString().split('T')[0]}
                  disabled={!!generatedCaseId}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                placeholder="Enter patient's email address"
                disabled={!!generatedCaseId}
              />
            </div>

            {/* STEP 1: Generate Case ID */}
            {!generatedCaseId && (
              <div className="pt-6 border-t border-slate-200">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full px-6 py-4 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Zap size={20} />
                  {isGenerating ? 'Generating Case ID...' : 'Step 1: Generate Case ID'}
                </button>
                <p className="text-xs text-slate-500 mt-2 text-center">
                  This will create a unique Case ID for this patient
                </p>
              </div>
            )}

            {/* Case ID Generated - Show Upload Section */}
            {generatedCaseId && !uploadComplete && (
              <>
                {/* Success: Case ID Generated */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-green-600" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-green-800">Case ID Generated</p>
                      <p className="font-mono text-lg text-green-900">{generatedCaseId}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(generatedCaseId)}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* File Upload Section */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Step 2: Attach Documents
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-slate-100 border border-slate-300 hover:border-blue-500 hover:bg-slate-200 transition text-slate-700 font-medium">
                      <Upload size={18} />
                      <span>SELECT FILES</span>
                      <input type="file" multiple onChange={handleFiles} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" />
                    </label>
                    <p className="text-sm text-slate-600">Max {MAX_FILES} files • PDF, DOC, DOCX, PNG, JPG</p>
                  </div>

                  {/* File List */}
                  {files.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{f.name}</p>
                            <p className="text-xs text-slate-600">{Math.round(f.size / 1024)} KB</p>
                          </div>
                          <button onClick={() => removeFile(i)} className="ml-4 p-1 hover:bg-slate-200 rounded">
                            <X size={18} className="text-slate-600 hover:text-red-600" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                <div className="pt-4 flex gap-3">
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition font-medium"
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={isUploading || files.length === 0}
                    className="flex-1 px-6 py-4 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <Upload size={20} />
                    {isUploading ? 'Uploading to S3...' : `Step 2: Upload ${files.length} File(s)`}
                  </button>
                </div>
              </>
            )}

            {/* Upload Complete */}
            {uploadComplete && (
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border border-green-200">
                <div className="flex items-start gap-4">
                  <CheckCircle2 size={28} className="text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Upload Complete!</h3>
                    <p className="text-sm text-green-700 mb-3">
                      Case ID: <span className="font-mono font-bold">{generatedCaseId}</span>
                    </p>
                    <p className="text-sm text-slate-600 mb-4">
                      {files.length} file(s) uploaded successfully to S3.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => copyToClipboard(generatedCaseId)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 flex items-center gap-2"
                      >
                        <Copy size={16} />
                        {copied ? 'Copied!' : 'Copy Case ID'}
                      </button>
                      <button
                        onClick={handleReset}
                        className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700"
                      >
                        New Case
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCaseId(generatedCaseId);
                          setActiveTab('report');
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                      >
                        Generate Report →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============ ADD DOCUMENTS TAB ============ */}
        {activeTab === 'addDocs' && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6 border border-slate-200">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Add Documents to Existing Case</h2>
              <p className="text-slate-600">Upload additional documents to an existing case ID.</p>
            </div>

            {!existingUploadComplete ? (
              <>
                {/* Case ID Search */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Select Case ID</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={existingCaseId}
                      onChange={(e) => {
                        setExistingCaseId(e.target.value);
                        handleExistingCaseSearch(e.target.value);
                      }}
                      onFocus={handleExistingInputFocus}
                      placeholder="Enter or search Case ID"
                      className="w-full px-4 py-3 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 transition pr-10"
                    />
                    <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                  </div>

                  {/* Search Results */}
                  {existingCaseSuggestions.length > 0 && (
                    <div className="mt-2 bg-white border border-slate-300 rounded-lg max-h-40 overflow-auto shadow-lg">
                      {existingCaseSuggestions.map((id) => (
                        <button
                          key={id}
                          onClick={() => {
                            setExistingCaseId(id);
                            setExistingCaseSuggestions([]);
                          }}
                          className="block w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-100"
                        >
                          {id}
                        </button>
                      ))}
                    </div>
                  )}

                  {searchingExistingCases && (
                    <p className="mt-1 text-xs text-slate-600">Searching cases…</p>
                  )}
                </div>

                {/* Selected Case Display */}
                {existingCaseId && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={20} className="text-green-600" />
                      <div>
                        <p className="text-sm font-semibold text-green-800">Selected Case</p>
                        <p className="font-mono text-lg text-green-900">{existingCaseId}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* File Upload Section */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Select Documents to Add
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-slate-100 border border-slate-300 hover:border-green-500 hover:bg-slate-200 transition text-slate-700 font-medium">
                      <Upload size={18} />
                      <span>SELECT FILES</span>
                      <input type="file" multiple onChange={handleExistingFiles} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" />
                    </label>
                    <p className="text-sm text-slate-600">Max {MAX_FILES} files • PDF, DOC, DOCX, PNG, JPG</p>
                  </div>

                  {/* File List */}
                  {existingFiles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {existingFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{f.name}</p>
                            <p className="text-xs text-slate-600">{Math.round(f.size / 1024)} KB</p>
                          </div>
                          <button onClick={() => removeExistingFile(i)} className="ml-4 p-1 hover:bg-slate-200 rounded">
                            <X size={18} className="text-slate-600 hover:text-red-600" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                <div className="pt-4 flex gap-3">
                  <button
                    onClick={handleResetExisting}
                    className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition font-medium"
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleUploadToExisting}
                    disabled={isUploadingExisting || !existingCaseId}
                    className="flex-1 px-6 py-4 rounded-lg bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <Upload size={20} />
                    {isUploadingExisting ? 'Uploading...' : `Upload ${existingFiles.length} File(s) to Case`}
                  </button>
                </div>
              </>
            ) : (
              /* Upload Complete */
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border border-green-200">
                <div className="flex items-start gap-4">
                  <CheckCircle2 size={28} className="text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Documents Added Successfully!</h3>
                    <p className="text-sm text-green-700 mb-3">
                      Case ID: <span className="font-mono font-bold">{existingCaseId}</span>
                    </p>
                    <p className="text-sm text-slate-600 mb-4">
                      {existingFiles.length} file(s) added to the existing case.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => copyToClipboard(existingCaseId)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 flex items-center gap-2"
                      >
                        <Copy size={16} />
                        {copied ? 'Copied!' : 'Copy Case ID'}
                      </button>
                      <button
                        onClick={handleResetExisting}
                        className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700"
                      >
                        Add More Documents
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCaseId(existingCaseId);
                          setActiveTab('report');
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                      >
                        Generate Report →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============ REPORT TAB ============ */}
        {activeTab === 'report' && (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-2xl space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Generate Case Report</h2>
              <p className="text-slate-600">Enter your Case ID to generate a comprehensive LCP report.</p>
            </div>

            {/* Status Messages */}
            {reportStatus === 'PROCESSING' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
                <h3 className="text-yellow-800 font-semibold text-lg">⏳ Report Processing</h3>
                <p className="text-slate-700 mt-2">This may take up to <b>2 hours</b>.</p>
                <p className="text-sm text-slate-600 mt-1">Case ID: <code>{selectedCaseId}</code></p>
              </div>
            )}

            {reportStatus === 'FAILED' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <h3 className="text-red-800 font-semibold text-lg">❌ Generation Failed</h3>
                <button
                  onClick={generateLCPRedactedReport}
                  className="mt-4 px-5 py-3 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Report Type Badge */}
            <div className="bg-slate-100 rounded-xl px-3 py-2">
              <div className="flex justify-center">
                <div className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold flex items-center gap-2 shadow-sm">
                 ✏️ LCP Redacted
                </div>
              </div>
            </div>

            {/* Case ID Search */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">Case ID</label>
              <div className="relative">
                <input
                  type="text"
                  value={selectedCaseId}
                  onChange={(e) => {
                    setSelectedCaseId(e.target.value);
                    handleCaseSearch(e.target.value);
                  }}
                  onFocus={handleInputFocus}
                  placeholder="Enter or search Case ID"
                  className="w-full px-4 py-3 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition pr-10"
                />
                <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
              </div>

              {/* Search Results */}
              {caseSuggestions.length > 0 && (
                <div className="mt-2 bg-white border border-slate-300 rounded-lg max-h-40 overflow-auto shadow-lg">
                  {caseSuggestions.map((id) => (
                    <button
                      key={id}
                      onClick={() => {
                        setSelectedCaseId(id);
                        setCaseSuggestions([]);
                      }}
                      className="block w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-100"
                    >
                      {id}
                    </button>
                  ))}
                </div>
              )}

              {searchingCases && (
                <p className="mt-1 text-xs text-slate-600">Searching cases…</p>
              )}

              {/* Test API Button */}
              <button
                onClick={async () => {
                  const isConnected = await testAPIConnection();
                  alert(isConnected ? '✅ API Connection Successful!' : '❌ API Connection Failed');
                }}
                className="mt-2 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border text-gray-600"
              >
                🧪 Test API Connection
              </button>
            </div>

            {/* Generate Button */}
            <div className="flex gap-3 pt-6 border-t border-slate-200">
              <button
                onClick={() => setActiveTab('upload')}
                className="flex-1 px-6 py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={generateLCPRedactedReport}
                disabled={reportStatus === 'PROCESSING' || !selectedCaseId.trim()}
                className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white disabled:opacity-50 font-semibold"
              >
                🔒 Generate LCP Redacted Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
