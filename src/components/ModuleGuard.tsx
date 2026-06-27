import React from 'react';
import { ShieldX } from 'lucide-react';
import { useAuth } from './AuthContext';

interface ModuleGuardProps {
  moduleId: string;
  children: React.ReactNode;
}

/**
 * Wraps an admin page and renders "Access Denied" if the current user
 * has not been granted access to that module by the Super Admin.
 * Super Admins always pass through.
 */
export default function ModuleGuard({ moduleId, children }: ModuleGuardProps) {
  const { hasModule, isSuperAdmin, user } = useAuth();

  // Not yet authenticated — nothing to show
  if (!user) return null;

  // Super Admin bypasses all module checks
  if (isSuperAdmin || hasModule(moduleId)) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
        <ShieldX className="w-10 h-10 text-red-400" />
      </div>
      <h2 className="text-2xl font-display font-black text-church-black mb-2">Access Denied</h2>
      <p className="text-church-gray text-sm max-w-sm">
        You don't have permission to access this module. Contact your
        <strong> Super Administrator</strong> to request access.
      </p>
    </div>
  );
}
