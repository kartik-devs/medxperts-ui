import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  Mail,
  Calendar,
  Shield,
  Edit3,
} from 'lucide-react';

const Profile = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const dropdownRef = useRef(null);

  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Not available';
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <>
      {/* Profile Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowProfileDropdown(!showProfileDropdown)}
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            {currentUser?.displayName ? (
              <span className="text-white text-sm font-semibold">
                {currentUser.displayName.charAt(0).toUpperCase()}
              </span>
            ) : (
              <User className="w-4 h-4 text-white" />
            )}
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>

        {/* Dropdown Menu */}
        {showProfileDropdown && (
          <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
            <div className="p-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900">
                {currentUser?.displayName || 'User'}
              </p>
              <p className="text-xs text-slate-500">
                {currentUser?.email}
              </p>
            </div>
            
            <div className="py-1">
              <button
                onClick={() => {
                  setShowProfileDropdown(false);
                  setShowProfileModal(true);
                }}
                className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <User className="w-4 h-4" />
                Quick View
              </button>
              
              <button
                onClick={() => {
                  setShowProfileDropdown(false);
                  navigate('/profile');
                }}
                className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Settings className="w-4 h-4" />
                Full Profile
              </button>
              
              <button
                onClick={() => {
                  setShowProfileDropdown(false);
                  handleSignOut();
                }}
                className="flex items-center gap-3 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Profile Information</h2>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Profile Avatar */}
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center">
                  {currentUser?.displayName ? (
                    <span className="text-white text-2xl font-bold">
                      {currentUser.displayName.charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    <User className="w-10 h-10 text-white" />
                  )}
                </div>
              </div>

              {/* User Information */}
              <div className="space-y-4">
                {/* Display Name */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <User className="w-5 h-5 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Display Name</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {currentUser?.displayName || 'Not set'}
                    </p>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Mail className="w-5 h-5 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Email</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {currentUser?.email}
                    </p>
                  </div>
                </div>

                {/* Account Created */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Account Created</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatDate(currentUser?.metadata?.creationTime)}
                    </p>
                  </div>
                </div>

                {/* Last Sign In */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Shield className="w-5 h-5 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Last Sign In</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatDate(currentUser?.metadata?.lastSignInTime)}
                    </p>
                  </div>
                </div>

                {/* Email Verified */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Shield className="w-5 h-5 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Email Verified</p>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        currentUser?.emailVerified ? 'bg-green-500' : 'bg-red-500'
                      }`}></span>
                      <p className="text-sm font-semibold text-slate-900">
                        {currentUser?.emailVerified ? 'Verified' : 'Not Verified'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* User ID */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Edit3 className="w-5 h-5 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">User ID</p>
                    <p className="text-xs font-mono text-slate-700 break-all">
                      {currentUser?.uid}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-slate-200">
              <button
                onClick={() => setShowProfileModal(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  // Add edit profile functionality here
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Profile;