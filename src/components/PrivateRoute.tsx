import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function PrivateRoute({ children, role }: { children: React.ReactNode, role?: 'admin' | 'member' }) {
  const { user, loading, isAdmin, isMember } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-church-soft flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-church-blue border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (role === 'admin' && !isAdmin) {
    // During vetting phase, anyone authenticated is allowed
    return <Navigate to="/portal" replace />;
  }

  if (role === 'member' && !isMember) {
    return <Navigate to="/" replace />;
  }

  // Allow users to freely choose between dashboard and portal
  // No role-based redirection - users can access both interfaces

  return <>{children}</>;
}
