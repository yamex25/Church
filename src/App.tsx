/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import LandingPage from '@/src/pages/LandingPage';
import AuthPage from '@/src/pages/AuthPage';
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
import MemberPortal from '@/src/pages/portal/MemberPortal';
import PortalProfile from '@/src/pages/portal/PortalProfile';
import PortalContributions from '@/src/pages/portal/PortalContributions';
import PortalPrayerRequests from '@/src/pages/portal/PortalPrayerRequests';
import PortalRequisitions from '@/src/pages/portal/PortalRequisitions';
import PortalEvents from '@/src/pages/portal/PortalEvents';
import PrivateRoute from '@/src/components/PrivateRoute';
import AdminLayout from '@/src/components/AdminLayout';
import PortalLayout from '@/src/components/PortalLayout';

export default function App() {
  return (
    <Router>
      <AnimatePresence mode="wait">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<PrivateRoute role="admin"><AdminLayout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="members" element={<MemberList />} />
            <Route path="home-cell" element={<HomeCell />} />
            <Route path="attendance" element={<AttendanceTracker />} />
            <Route path="attendance-scan" element={<AttendanceScan />} />
            <Route path="finance" element={<FinanceModule />} />
            <Route path="daily-expenses" element={<DailyExpenseModule />} />
            <Route path="hr" element={<HRManagement />} />
            <Route path="events" element={<EventsList />} />
            <Route path="prayer-requests" element={<PrayerRequests />} />
            <Route path="requisitions" element={<Requisitions />} />
            <Route path="communications" element={<Communications />} />
            <Route path="configurations" element={<Configurations />} />
            <Route path="pledges" element={<PledgeTracker />} />
            <Route path="visitors" element={<VisitorManagement />} />
            <Route path="assets" element={<AssetInventory />} />
            <Route path="ask" element={<AskQuestion />} />
          </Route>

          {/* Member Portal Routes */}
          <Route path="/portal" element={<PrivateRoute role="member"><PortalLayout /></PrivateRoute>}>
            <Route index element={<MemberPortal />} />
            <Route path="profile" element={<PortalProfile />} />
            <Route path="contributions" element={<PortalContributions />} />
            <Route path="prayer-requests" element={<PortalPrayerRequests />} />
            <Route path="requisitions" element={<PortalRequisitions />} />
            <Route path="events" element={<PortalEvents />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Router>
  );
}
