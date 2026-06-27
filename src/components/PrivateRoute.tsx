/**
 * PrivateRoute — single authority for authentication + tenant routing.
 *
 * Routing priority:
 *   1. Not authenticated      → /auth
 *   2. Platform Owner         → /platform (all other paths blocked)
 *   3. User HAS a church      → allow admin/portal routes; block /setup-church
 *   4. User has NO church     → /setup-church (and nowhere else)
 *   5. Role enforcement       → admin/dept_head/member gates
 *
 * Routing is derived from `user.churchId` (the actual Firestore value),
 * NOT from `needsChurchSetup` (a derived state that can briefly be stale).
 * This guarantees an existing church member is never force-redirected to
 * the church creation flow, even after logout/login.
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

type RequiredRole = 'admin' | 'dept_head' | 'member';

interface PrivateRouteProps {
  children: React.ReactNode;
  role?: RequiredRole;
}

export default function PrivateRoute({ children, role }: PrivateRouteProps) {
  const {
    user, loading,
    isPlatformOwner, isAdmin, isDeptHead, isMember,
  } = useAuth();
  const location = useLocation();

  // ── Still loading auth state — show spinner ────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-church-soft flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-church-blue border-t-transparent" />
      </div>
    );
  }

  // ── Not authenticated → login ──────────────────────────────────────────────
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // ── Platform Owner: lives in /platform only ────────────────────────────────
  if (isPlatformOwner) {
    if (location.pathname.startsWith('/platform')) {
      return <>{children}</>;
    }
    return <Navigate to="/platform" replace />;
  }

  // ── Church membership — use `user.churchId` as the ground truth ───────────
  // This is the value written to Firestore; it cannot be stale the way
  // derived state (`needsChurchSetup`) can be.
  const userHasChurch = !!user.churchId;

  // Existing church member trying to reach /setup-church
  // (direct URL, bookmark, stale `from` redirect, etc.) → send to their dashboard.
  if (location.pathname === '/setup-church' && userHasChurch) {
    return <Navigate to={isAdmin ? '/admin' : '/portal'} replace />;
  }

  // User with no church association → must complete church setup first.
  // They cannot access any other route until they belong to a church.
  if (!userHasChurch && location.pathname !== '/setup-church') {
    return <Navigate to='/setup-church' replace />;
  }

  // ── Role enforcement for routes that require a specific level ──────────────
  if (role === 'admin' && !isAdmin) {
    return <Navigate to="/portal" replace />;
  }
  if (role === 'dept_head' && !isDeptHead) {
    return <Navigate to="/portal" replace />;
  }
  if (role === 'member' && !isMember) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
