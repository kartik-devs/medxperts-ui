// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();
  
  if (!currentUser) {
    // User is not logged in, redirect to login
    return <Navigate to="/login" replace />;
  }

  if (!currentUser.emailVerified) {
    // User is logged in but email is not verified
    return <Navigate to="/verify-email" replace />;
  }

  // User is logged in and email is verified
  return children;
};

export default ProtectedRoute;