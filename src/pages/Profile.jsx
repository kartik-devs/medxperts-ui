import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateProfile } from 'firebase/auth';
import {
  User,
  Mail,
  Calendar,
  Shield,
  Edit3,
  Save,
  X,
  Camera,
  Settings,
  Bell,
  Lock,
} from 'lucide-react';

const ProfilePage = () => {
  const { currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleUpdateProfile = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      await updateProfile(currentUser, {
        displayName: displayName,
      });
      setMessage('Profile updated successfully!');
      setIsEditing(false);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage('Error updating profile. Please try again.');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Not available';
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Profile Settings</h1>
          <p className="text-slate-600">Manage your account information and preferences</p>
        </div>

        {/* Success/Error Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.includes('Error') 
              ? 'bg-red-50 text-red-700 border border-red-200' 
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="text-center">
                {/* Profile Avatar */}
                <div className="relative inline-block mb-4">
                  <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center">
                    {currentUser?.displayName ? (
                      <span className="text-white text-3xl font-bold">
                        {currentUser.displayName.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <User className="w-12 h-12 text-white" />
                    )}
                  </div>
                  <button className="absolute bottom-0 right-0 w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center hover:bg-slate-700 transition-colors">
                    <Camera className="w-4 h-4 text-white" />
                  </button>
                </div>

                <h2 className="text-xl font-bold text-slate-900 mb-1">
                  {currentUser?.displayName || 'User'}
                </h2>
                <p className="text-slate-500 text-sm mb-4">{currentUser?.email}</p>

                {/* Status Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  {currentUser?.emailVerified ? 'Verified Account' : 'Unverified Account'}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mt-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="flex items-center gap-3 w-full p-3 text-left hover:bg-slate-50 rounded-lg transition-colors">
                  <Settings className="w-5 h-5 text-slate-500" />
                  <span className="text-sm text-slate-700">Account Settings</span>
                </button>
                <button className="flex items-center gap-3 w-full p-3 text-left hover:bg-slate-50 rounded-lg transition-colors">
                  <Bell className="w-5 h-5 text-slate-500" />
                  <span className="text-sm text-slate-700">Notifications</span>
                </button>
                <button className="flex items-center gap-3 w-full p-3 text-left hover:bg-slate-50 rounded-lg transition-colors">
                  <Lock className="w-5 h-5 text-slate-500" />
                  <span className="text-sm text-slate-700">Privacy & Security</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Personal Information</h3>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setDisplayName(currentUser?.displayName || '');
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateProfile}
                      disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {loading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Display Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Display Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your display name"
                    />
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <User className="w-5 h-5 text-slate-500" />
                      <span className="text-slate-900">
                        {currentUser?.displayName || 'Not set'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email Address
                  </label>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <Mail className="w-5 h-5 text-slate-500" />
                    <span className="text-slate-900">{currentUser?.email}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">Account Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Account Created */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Account Created
                  </label>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-slate-500" />
                    <span className="text-slate-900">
                      {formatDate(currentUser?.metadata?.creationTime)}
                    </span>
                  </div>
                </div>

                {/* Last Sign In */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Last Sign In
                  </label>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <Shield className="w-5 h-5 text-slate-500" />
                    <span className="text-slate-900">
                      {formatDate(currentUser?.metadata?.lastSignInTime)}
                    </span>
                  </div>
                </div>

                {/* Email Verification */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email Verification
                  </label>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <Shield className="w-5 h-5 text-slate-500" />
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        currentUser?.emailVerified ? 'bg-green-500' : 'bg-red-500'
                      }`}></span>
                      <span className="text-slate-900">
                        {currentUser?.emailVerified ? 'Verified' : 'Not Verified'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* User ID */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    User ID
                  </label>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <Edit3 className="w-5 h-5 text-slate-500" />
                    <span className="text-xs font-mono text-slate-700 break-all">
                      {currentUser?.uid}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;