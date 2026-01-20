import { useEffect, useState } from 'react';
import { ChevronLeft, CheckCircle2, AlertCircle } from 'lucide-react';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 
  import.meta.env.VITE_API_BASE_URL_PRODUCTION || 
  'https://medxperts-ui.onrender.com';

console.log('LCP API_BASE configured as:', API_BASE);

/* ------------------------------------------------------------------ */
/* -------------------------- LCP MILESTONES ------------------------- */
/* ------------------------------------------------------------------ */
const lcpMilestones = [
  { value: 10, softCap: 9, label: 'Validating' },
  { value: 25, softCap: 24, label: 'OCR Extraction' },
  { value: 40, softCap: 39, label: 'Patient Interview Fetch' },
  { value: 55, softCap: 54, label: 'LCP Generation Started' },
  { value: 90, softCap: 89, label: 'Generating Cost Table' },
  { value: 100, softCap: 100, label: 'Complete' }
];

/* ------------------------------------------------------------------ */
/* -------------------------- LCP TIMELINE STEPS -------------------- */
/* ------------------------------------------------------------------ */
const lcpSteps = [
  { label: 'Validating', icon: '🔍', min: 0, max: 10 },
  { label: 'OCR Extraction', icon: '📄', min: 10, max: 25 },
  { label: 'Patient Interview Fetch', icon: '🗣️', min: 25, max: 40 },
  { label: 'LCP Generation Started', icon: '⚡', min: 40, max: 55 },
  { label: 'Generating Cost Table', icon: '💰', min: 55, max: 90 },
  { label: 'Complete', icon: '✅', min: 90, max: 100 }
];

export default function LCPProgressPage() {
  /* ------------------------------------------------------------------ */
  /* ------------------------------ STATE ------------------------------ */
  /* ------------------------------------------------------------------ */
  const [actualProgress, setActualProgress] = useState(0);   // backend truth
  const [displayProgress, setDisplayProgress] = useState(0); // animated UI
  const [currentStep, setCurrentStep] = useState('');
  const [status, setStatus] = useState('PROCESSING');
  const [eta, setEta] = useState('');
  const [caseId, setCaseId] = useState('');
  const [hasActiveCase, setHasActiveCase] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');

  /* ------------------------------------------------------------------ */
  /* -------------------------- HELPERS -------------------------------- */
  /* ------------------------------------------------------------------ */
  const getAllowedMax = (actual) => {
    for (const m of lcpMilestones) {
      if (actual < m.value) return m.softCap;
    }
    return actual;
  };

  const getStepFromProgress = (progress) => {
    return (
      lcpSteps.find(
        step => progress >= step.min && progress < step.max
      )?.label || 'Complete'
    );
  };

  /* ------------------------------------------------------------------ */
  /* -------------------------- POLLING -------------------------------- */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const storedCaseId = localStorage.getItem('lcp_case_id');
    const storedGenerationId = localStorage.getItem('lcp_generation_id');
    const storedUniqueKey = localStorage.getItem('lcp_unique_key');

    if (!storedCaseId) return;

    setCaseId(storedCaseId);
    setHasActiveCase(true);
    setStatus('PROCESSING');

    const startTime = Date.now();

    const fetchProgress = async () => {
      try {
        // Poll backend API for LCP progress with generation tracking
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
        
        // Build query parameters for LCP progress
        const params = new URLSearchParams({
          caseId: storedCaseId,
          reportType: 'LCP'
        });
        
        // Include generation ID if available for specific generation tracking
        if (storedGenerationId) {
          params.append('generationId', storedGenerationId);
        }
        
        const res = await fetch(
          `${API_BASE}/api/case-status?${params.toString()}`,
          { 
            cache: 'no-store',
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (!res.ok) {
          console.warn('LCP Polling non-200:', res.status);
          return 'PROCESSING';
        }

        const data = await res.json();

        setActualProgress(prev => {
          const next = Math.max(prev, data.progress ?? 0);
          setCurrentStep(getStepFromProgress(next));
          return next;
        });

        setStatus(data.status ?? 'PROCESSING');

        if (data.status === 'COMPLETED' && data.pdf_url) {
          setPdfUrl(data.pdf_url);
          if (window.refreshReportHistory) {
            console.log('🔄 Triggering report history refresh - LCP report completed');
            window.refreshReportHistory();
          }
        }

        // Stop polling if we have a PDF URL even without COMPLETED status (backend-bug tolerant)
        if (data.pdf_url && !pdfUrl) {
          setPdfUrl(data.pdf_url);
          setStatus('COMPLETED');
          if (window.refreshReportHistory) {
            console.log('🔄 Triggering report history refresh - LCP PDF available');
            window.refreshReportHistory();
          }
        }

        if (data.status === 'FAILED') {
          setEta('Failed');
          if (window.refreshReportHistory) {
            console.log('🔄 Triggering report history refresh - LCP report failed');
            window.refreshReportHistory();
          }
          return 'FAILED';
        }

        if (data.progress > 0 && data.progress < 100) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = elapsed > 3 ? data.progress / elapsed : 0;

          if (!isFinite(rate) || rate <= 0) {
            setEta('Processing...');
          } else {
            const remaining = (100 - data.progress) / rate;
            setEta(
              remaining < 60
                ? `${Math.round(remaining)}s`
                : remaining < 3600
                ? `${Math.ceil(remaining / 60)}m`
                : 'Processing...'
            );
          }
        }

        return data.status;
      } catch (err) {
        if (err.name === 'AbortError') {
          console.warn('⏰ LCP Progress polling request timed out');
          return 'PROCESSING';
        }
        console.error('LCP Polling error (non-fatal):', err.message);
        return 'PROCESSING';
      }
    };

    fetchProgress();
    const interval = setInterval(async () => {
      const status = await fetchProgress();
      if (status === 'COMPLETED' || status === 'FAILED') {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [API_BASE]);

  /* ------------------------------------------------------------------ */
  /* --------------------- SMOOTH UI PROGRESS -------------------------- */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!hasActiveCase) return;

    const interval = setInterval(() => {
      setDisplayProgress(prev => {
        const allowedMax = getAllowedMax(actualProgress);

        if (prev < allowedMax) return prev + 1;
        if (prev < actualProgress) return actualProgress;

        return prev;
      });
    }, 120);

    return () => clearInterval(interval);
  }, [actualProgress, hasActiveCase]);

  /* ------------------------------------------------------------------ */
  /* ------------------------------- UI -------------------------------- */
  /* ------------------------------------------------------------------ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => window.history.back()}
            className="p-2 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">
              Processing LCP Workflow
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Case ID:{' '}
              <span className="font-mono bg-white px-2 py-0.5 rounded">
                {caseId || 'Loading...'}
              </span>
            </p>
          </div>

          {/* Reset Button */}
          <button
            onClick={() => {
              if (confirm('Are you sure you want to reset and start a new LCP case? This will clear the current progress.')) {
                // Clear localStorage for LCP generation tracking
                localStorage.removeItem('lcp_case_id');
                localStorage.removeItem('lcp_generation_id');
                localStorage.removeItem('lcp_unique_key');

                // Reset state
                setActualProgress(0);
                setDisplayProgress(0);
                setCurrentStep('');
                setStatus('PROCESSING');
                setEta('');
                setCaseId('');
                setPdfUrl('');

                // Navigate back to LCP generate page
                window.location.href = '/lifecareplan';
              }
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">

          {/* Progress Header */}
          <div className="p-8 border-b border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-slate-600 uppercase">
                  LCP Progress
                </p>
                <p className="text-4xl font-bold text-slate-900 mt-2">
                  {Math.round(displayProgress)}%
                </p>
                <p className="text-xs text-green-600 mt-1">{currentStep}</p>
              </div>
              <div className="text-right text-sm text-slate-600">
                {status === 'PROCESSING' && eta && `~${eta} remaining`}
                {status === 'COMPLETED' && 'Completed'}
                {status === 'FAILED' && 'Failed'}
              </div>
            </div>

            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full"
                style={{ width: `${displayProgress}%` }}
              />
            </div>
          </div>

          {/* Steps Timeline */}
          <div className="p-8 overflow-x-auto">
            <div className="relative min-w-max">
              <div className="absolute top-6 left-0 right-0 h-1 bg-slate-300" />

              <div className="flex gap-6 pb-4">
                {lcpSteps.map((step, index) => {
                  const isCompleted = actualProgress >= step.max;
                  const isCurrent =
                    actualProgress >= step.min &&
                    actualProgress < step.max;

                  return (
                    <div key={index} className="relative flex flex-col items-center min-w-max">
                      <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shadow-lg mb-4 transition-all
                          ${isCompleted
                            ? 'bg-green-500 text-white'
                            : isCurrent
                              ? 'bg-emerald-500 text-white animate-pulse ring-4 ring-emerald-300'
                              : 'bg-slate-200 text-slate-400'
                          }`}
                      >
                        {isCompleted ? '✓' : step.icon}
                      </div>

                      <div
                        className={`text-center px-3 py-2 rounded-lg max-w-[120px]
                          ${isCurrent ? 'bg-emerald-50 ring-2 ring-emerald-300' : ''}`}
                      >
                        <p className="font-bold text-xs leading-tight">{step.label}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {step.min}–{step.max}%
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-6 bg-slate-50 border-t border-slate-200">
            {status === 'PROCESSING' && (
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-slate-700">
                  ⏳ Processing your LCP workflow…
                </p>

                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to cancel this LCP workflow and start over?')) {
                      // Clear localStorage for LCP generation tracking
                      localStorage.removeItem('lcp_case_id');
                      localStorage.removeItem('lcp_generation_id');
                      localStorage.removeItem('lcp_unique_key');

                      // Navigate back to LCP generate page
                      window.location.href = '/lifecareplan';
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-xs font-medium transition-colors"
                >
                  Cancel & Reset
                </button>
              </div>
            )}

            {status === 'COMPLETED' && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 size={20} />
                  <p className="text-sm font-medium">
                    LCP workflow completed successfully
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      console.log('Opening LCP PDF via proxy for caseId:', caseId);
                      window.open(pdfUrl, '_blank')
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                  >
                    View LCP Report
                  </button>
                </div>
              </div>
            )}

            {status === 'FAILED' && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle size={20} />
                  <p className="text-sm font-medium">
                    LCP workflow failed
                  </p>
                </div>

                <button
                  onClick={() => {
                    // Clear localStorage for LCP generation tracking
                    localStorage.removeItem('lcp_case_id');
                    localStorage.removeItem('lcp_generation_id');
                    localStorage.removeItem('lcp_unique_key');

                    // Navigate back to LCP generate page
                    window.location.href = '/lifecareplan';
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                >
                  Start New LCP Case
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}