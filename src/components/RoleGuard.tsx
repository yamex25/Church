import React from 'react';
import { useAuth } from './AuthContext';
import { UserRole } from '@/src/types';

interface RoleGuardProps {
  children: React.ReactNode;
  /** Minimum role required. Hierarchy: SUPER_ADMIN > ADMIN > DEPARTMENT_HEAD > MEMBER */
  minRole?: UserRole;
  /** Explicit list of allowed roles */
  allowedRoles?: UserRole[];
  /** Rendered instead of children when access is denied. Null = render nothing. */
  fallback?: React.ReactNode;
}

const ROLE_LEVEL: Record<UserRole, number> = {
  [UserRole.PLATFORM_OWNER]: 5,
  [UserRole.SUPER_ADMIN]: 4,
  [UserRole.ADMIN]: 3,
  [UserRole.DEPARTMENT_HEAD]: 2,
  [UserRole.MEMBER]: 1,
};

export default function RoleGuard({ children, minRole, allowedRoles, fallback = null }: RoleGuardProps) {
  const { user } = useAuth();

  if (!user) return <>{fallback}</>;

  const userLevel = ROLE_LEVEL[user.role] ?? 0;

  if (minRole !== undefined) {
    if (userLevel < ROLE_LEVEL[minRole]) {
      return <>{fallback}</>;
    }
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}
