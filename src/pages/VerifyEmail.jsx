// src/pages/VerifyEmail.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { sendEmailVerification } from 'firebase/auth';

const VerifyEmail = () => {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleResendEmail = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      if (!auth.currentUser) {
        setError('No user found. Please register again.');
        return;
      }
      
      await sendEmailVerification(auth.currentUser, {
        url: window.location.origin + '/login',
        handleCodeInApp: false
      });
      
      console.log('Resent verification email to:', auth.currentUser.email);
      setMessage('Verification email sent. Please check your inbox and spam folder.');
    } catch (error) {
      console.error('Resend email error:', error);
      setError('Failed to send verification email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Check if user is logged in
    if (!auth.currentUser) {
      console.log('No user found, redirecting to login');
      navigate('/login');
      return;
    }
    
    // Check if user is already verified
    if (auth.currentUser.emailVerified) {
      console.log('User already verified, redirecting to operations dashboard');
      navigate('/operations');
      return;
    }
    
    const interval = setInterval(async () => {
      if (auth.currentUser) {
        try {
          await auth.currentUser.reload();
          console.log('Checking verification status:', auth.currentUser.emailVerified);
          
          if (auth.currentUser.emailVerified) {
            clearInterval(interval);
            console.log('Email verified! Redirecting to operations dashboard...');
            navigate('/operations');
          }
        } catch (error) {
          console.error('Error checking verification status:', error);
          // If there's an error, the user might have been signed out
          if (error.code === 'auth/user-token-expired') {
            clearInterval(interval);
            navigate('/login');
          }
        }
      } else {
        // User signed out, redirect to login
        clearInterval(interval);
        navigate('/login');
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Verify Your Email
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {message ? (
            <p className="text-sm text-green-700 mb-4">{message}</p>
          ) : (
            <p className="text-sm text-gray-700 mb-4">
              A verification email has been sent to your email address. Please check your inbox and verify your email to continue.
            </p>
          )}

          <button
            onClick={handleResendEmail}
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Resend Verification Email'}
          </button>

          <div className="mt-4">
            <button
              onClick={() => auth.signOut()}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;