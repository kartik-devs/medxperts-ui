import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserPermissions } from '../contexts/search-case';
import { User, Shield, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

const UserPermissionsInfo = () => {
  const { currentUser } = useAuth();
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const fetchPermissions = async () => {
    if (!currentUser?.email) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getUserPermissions();
      if (data.success) {
        setPermissions(data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-sm font-semibold text-red-800">Not Authenticated</span>
        </div>
        <p className="text-xs text-red-600 mt-1">Please log in to access case data</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-semibold text-slate-800">User Access</span>
        </div>
        <button
          onClick={fetchPermissions}
          disabled={loading}
          className="p-1 hover:bg-slate-100 rounded transition-colors"
        >
          <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Email:</span>
          <span className="text-xs font-mono text-slate-700">{currentUser.email}</span>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs">{error}</span>
          </div>
        )}

        {permissions && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-xs text-slate-600">
                Access to <strong>{permissions.caseCount}</strong> case{permissions.caseCount !== 1 ? 's' : ''}
              </span>
            </div>

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-blue-600 hover:text-blue-700 underline"
            >
              {showDetails ? 'Hide' : 'Show'} case list
            </button>

            {showDetails && permissions.cases && (
              <div className="mt-2 p-2 bg-slate-50 rounded border max-h-32 overflow-auto">
                <div className="text-xs text-slate-600 space-y-1">
                  {permissions.cases.map((caseId, index) => (
                    <div key={index} className="font-mono text-xs">
                      {caseId}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-slate-600">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-xs">Loading permissions...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserPermissionsInfo;