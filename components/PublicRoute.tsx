import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface PublicRouteProps {
  children: React.ReactNode;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { user } = useAuth();

  // If user is already authenticated, redirect them to dashboard
  if (user) return <Navigate to="/dashboard" replace />;

  // Always render public pages (login, signup, landing) immediately
  return <>{children}</>;
};

export default PublicRoute;


