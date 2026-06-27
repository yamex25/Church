/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import LandingPage from '@/src/pages/LandingPage';
import AuthPage from '@/src/pages/AuthPage';
import SetupChurch from '@/src/pages/SetupChurch';
import Dashboard from '@/src/pages/admin/Dashboard';
import MemberList from '@/src/pages/admin/MemberList';
import HomeCell from '@/src/pages/admin/HomeCell';
import AttendanceScan from '@/src/pages/admin/AttendanceScan';
import FinanceModule from '@/src/pages/admin/FinanceModule';
import EventsList from '@/src/pages/admin/EventsList';
import PrayerRequests from '@/src/pages/admin/PrayerRequests';
import Requisitions from '@/src/pages/admin/Requisitions';
import Communications from '@/src/pages/admin/Communications';
import Configurations from '@/src/pages/admin/Configurations';
import PledgeTracker from '@/src/pages/admin/PledgeTracker';
import VisitorManagement from '@/src/pages/admin/VisitorManagement';
import AttendanceTracker from '@/src/pages/admin/AttendanceTracker';
import AssetInventory from '@/src/pages/admin/AssetInventory';
import HRManagement from '@/src/pages/admin/HRManagement';
import DailyExpenseModule from '@/src/pages/admin/DailyExpenseModule';
import AskQuestion from '@/src/pages/admin/AskQuestion';
import Settings from '@/src/pages/admin/Settings';
import MemberAccounts from '@/src/pages/admin/MemberAccounts';
import UserManagement from '@/src/pages/admin/UserManagement';
import AuditLog from '@/src/pages/admin/AuditLog';
import PlatformLayout from '@/src/components/PlatformLayout';
import PlatformDashboard from '@/src/pages/platform/PlatformDashboard';
import ActivationCodes from '@/src/pages/platform/ActivationCodes';
import PlanManager from '@/src/pages/platform/PlanManager';
import MemberPortal from '@/src/pages/portal/MemberPortal';
import PortalProfile from '@/src/pages/portal/PortalProfile';
import PortalContributions from '@/src/pages/portal/PortalContributions';
import PortalPrayerRequests from '@/src/pages/portal/PortalPrayerRequests';
import PortalRequisitions from '@/src/pages/portal/PortalRequisitions';
import PortalEvents from '@/src/pages/portal/PortalEvents';
import PortalCell from '@/src/pages/portal/PortalCell';
import PortalFinance from '@/src/pages/portal/PortalFinance';
import PrivateRoute from '@/src/components/PrivateRoute';
import ModuleGuard from '@/src/components/ModuleGuard';
import AdminLayout from '@/src/components/AdminLayout';
import PortalLayout from '@/src/components/PortalLayout';

// Shorthand wrapper: wraps a page in ModuleGuard so unauthorized users
// see "Access Denied" instead of the page content.
const G = (moduleId: string, Page: React.ComponentType) => (
  <ModuleGuard moduleId={moduleId}><Page /></ModuleGuard>
);

export default function App() {
  return (
    <Router>
      <AnimatePresence mode="wait">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />

          {/* Church Setup */}
          <Route path="/setup-church" element={<PrivateRoute><SetupChurch /></PrivateRoute>} />

          {/* Admin Routes — ADMIN or SUPER_ADMIN at the layout level;
              each child is further guarded by ModuleGuard for granular access */}
          <Route path="/admin" element={<PrivateRoute role="admin"><AdminLayout /></PrivateRoute>}>
            <Route index element={G('dashboard', Dashboard)} />
            <Route path="members"         element={G('members',        MemberList)} />
            <Route path="home-cell"       element={G('home_cell',      HomeCell)} />
            <Route path="attendance"      element={G('attendance',     AttendanceTracker)} />
            <Route path="attendance-scan" element={G('attendance',     AttendanceScan)} />
            <Route path="finance"         element={G('finance',        FinanceModule)} />
            <Route path="daily-expenses"  element={G('daily_expenses', DailyExpenseModule)} />
            <Route path="hr"              element={G('hr',             HRManagement)} />
            <Route path="events"          element={G('events',         EventsList)} />
            <Route path="prayer-requests" element={G('prayer',         PrayerRequests)} />
            <Route path="requisitions"    element={G('requisitions',   Requisitions)} />
            <Route path="communications"  element={G('communications', Communications)} />
            <Route path="configurations"  element={G('dashboard',      Configurations)} />
            <Route path="pledges"         element={G('pledges',        PledgeTracker)} />
            <Route path="visitors"        element={G('visitors',       VisitorManagement)} />
            <Route path="assets"          element={G('assets',         AssetInventory)} />
            <Route path="ask"             element={G('ask',            AskQuestion)} />
            {/* Settings — enforced internally by isSuperAdmin */}
            <Route path="settings" element={<Settings />} />
            {/* Member Accounts — requires members:manage_accounts action or Super Admin */}
            <Route path="member-accounts" element={<MemberAccounts />} />
            {/* User Management */}
            <Route path="users" element={G('users', UserManagement)} />
            {/* Audit Trail */}
            <Route path="audit" element={G('audit', AuditLog)} />
          </Route>

          {/* Platform Owner Routes — all-church oversight */}
          <Route path="/platform" element={<PrivateRoute><PlatformLayout /></PrivateRoute>}>
            <Route index element={<PlatformDashboard />} />
            <Route path="activation-codes" element={<ActivationCodes />} />
            <Route path="plans" element={<PlanManager />} />
          </Route>

          {/* Member Portal Routes */}
          <Route path="/portal" element={<PrivateRoute role="member"><PortalLayout /></PrivateRoute>}>
            <Route index element={<MemberPortal />} />
            <Route path="profile"         element={<PortalProfile />} />
            <Route path="contributions"   element={<PortalContributions />} />
            <Route path="prayer-requests" element={<PortalPrayerRequests />} />
            <Route path="requisitions"    element={<PortalRequisitions />} />
            <Route path="events"          element={<PortalEvents />} />
            <Route path="cell"            element={<PortalCell />} />
            <Route path="finance"         element={<PortalFinance />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Router>
  );
}
