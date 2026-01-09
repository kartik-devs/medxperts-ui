// src/pages/AuthTest.jsx
import { useState } from 'react';
import { auth } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';

const AuthTest = () => {
  const { currentUser } = useAuth();
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('testpassword123');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const testRegistration = async () => {
    try {
      setError('');
      setMessage('Testing registration...');
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      
      setMessage('✅ Registration test successful! Verification email sent.');
      console.log('Registration test passed:', userCredential.user);
    } catch (error) {
      setError(`❌ Registration test failed: ${error.message}`);
      console.error('Registration test error:', error);
    }
  };

  const testLogin = async () => {
    try {
      setError('');
      setMessage('Testing login...');
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setMessage('✅ Login test successful!');
      console.log('Login test passed:', userCredential.user);
    } catch (error) {
      setError(`❌ Login test failed: ${error.message}`);
      console.error('Login test error:', error);
    }
  };

  const testSignOut = async () => {
    try {
      setError('');
      setMessage('Testing sign out...');
      
      await auth.signOut();
      setMessage('✅ Sign out test successful!');
      console.log('Sign out test passed');
    } catch (error) {
      setError(`❌ Sign out test failed: ${error.message}`);
      console.error('Sign out test error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Firebase Authentication Test</h1>
          
          {/* Current User Status */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Current User Status:</h3>
            {currentUser ? (
              <div className="text-sm text-blue-800">
                <p>✅ User logged in</p>
                <p>Email: {currentUser.email}</p>
                <p>Email Verified: {currentUser.emailVerified ? '✅ Yes' : '❌ No'}</p>
                <p>UID: {currentUser.uid}</p>
              </div>
            ) : (
              <p className="text-sm text-blue-800">❌ No user logged in</p>
            )}
          </div>

          {/* Test Credentials */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Test Credentials:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email:</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password:</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Test Buttons */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Authentication Tests:</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={testRegistration}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Test Registration
              </button>
              <button
                onClick={testLogin}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Test Login
              </button>
              <button
                onClick={testSignOut}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Test Sign Out
              </button>
            </div>
          </div>

          {/* Messages */}
          {message && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800">{message}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-semibold text-yellow-900 mb-2">Test Instructions:</h4>
            <ol className="text-sm text-yellow-800 space-y-1">
              <li>1. Click "Test Registration" to create a test account</li>
              <li>2. Check your email for verification link (including spam folder)</li>
              <li>3. Click "Test Login" to verify login works</li>
              <li>4. Check if email verification is required</li>
              <li>5. Click "Test Sign Out" to verify logout works</li>
            </ol>
          </div>

          {/* Firebase Config Info */}
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">Firebase Configuration:</h4>
            <div className="text-sm text-gray-700 space-y-1">
              <p>Project ID: medtry-96b07</p>
              <p>Auth Domain: medtry-96b07.firebaseapp.com</p>
              <p>Storage Bucket: medtry-96b07.appspot.com</p>
              <p>Status: {auth ? '✅ Connected' : '❌ Not Connected'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthTest;