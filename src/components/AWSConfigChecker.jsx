// src/components/AWSConfigChecker.jsx
import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Settings } from 'lucide-react';
import { uploadFileToS3 } from '../config/aws-config';

const AWSConfigChecker = () => {
  const [configStatus, setConfigStatus] = useState({
    region: null,
    identityPool: null,
    bucket: null,
    s3Access: null
  });
  const [isChecking, setIsChecking] = useState(false);
  const [showChecker, setShowChecker] = useState(false);

  const checkConfiguration = async () => {
    setIsChecking(true);
    const newStatus = { ...configStatus };

    // Check environment variables
    newStatus.region = process.env.REACT_APP_AWS_REGION ? 'configured' : 'missing';
    newStatus.identityPool = process.env.REACT_APP_AWS_IDENTITY_POOL_ID ? 'configured' : 'missing';
    newStatus.bucket = process.env.REACT_APP_S3_BUCKET_NAME ? 'configured' : 'missing';

    // Test S3 access with a small test file
    try {
      const testFile = new Blob(['test'], { type: 'text/plain' });
      const testFileName = `test-${Date.now()}.txt`;
      const result = await uploadFileToS3(testFile, testFileName, 'config-test');
      
      newStatus.s3Access = result.success ? 'working' : 'error';
    } catch (error) {
      console.error('S3 test failed:', error);
      newStatus.s3Access = 'error';
    }

    setConfigStatus(newStatus);
    setIsChecking(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'configured':
      case 'working':
        return <CheckCircle2 size={16} className="text-green-500" />;
      case 'missing':
      case 'error':
        return <XCircle size={16} className="text-red-500" />;
      default:
        return <AlertTriangle size={16} className="text-yellow-500" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'configured':
        return 'Configured';
      case 'working':
        return 'Working';
      case 'missing':
        return 'Missing';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {!showChecker ? (
        <button
          onClick={() => setShowChecker(true)}
          className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
          title="Check AWS Configuration"
        >
          <Settings size={20} />
        </button>
      ) : (
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">AWS Configuration</h3>
            <button
              onClick={() => setShowChecker(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">AWS Region</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(configStatus.region)}
                <span className="text-sm">{getStatusText(configStatus.region)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Identity Pool</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(configStatus.identityPool)}
                <span className="text-sm">{getStatusText(configStatus.identityPool)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">S3 Bucket</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(configStatus.bucket)}
                <span className="text-sm">{getStatusText(configStatus.bucket)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">S3 Access</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(configStatus.s3Access)}
                <span className="text-sm">{getStatusText(configStatus.s3Access)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={checkConfiguration}
              disabled={isChecking}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
            >
              {isChecking ? 'Checking...' : 'Test Configuration'}
            </button>
          </div>

          {Object.values(configStatus).some(status => status === 'missing' || status === 'error') && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800">
                ⚠️ Some configuration issues detected. Check the AWS_SETUP_GUIDE.md file for setup instructions.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AWSConfigChecker;