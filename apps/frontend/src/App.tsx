import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { Registry } from './pages/Registry';
import { Grading } from './pages/Grading';
import { ReportCards } from './pages/ReportCards';
import { Schedule } from './pages/Schedule';
import { SchedulePlanner } from './pages/SchedulePlanner';
import { ScheduleSubstitutions } from './pages/ScheduleSubstitutions';
import Users from './pages/Users';
import RoomsManagement from './pages/RoomsManagement';
import SchoolEvents from './pages/SchoolEvents';
import CurriculumManagement from './pages/CurriculumManagement';
import WhiteBook from './pages/WhiteBook';
import ThematicPlans from './pages/ThematicPlans';
import LessonPreparations from './pages/LessonPreparations';
import BellSchedule from './pages/BellSchedule';
import RecurringEvents from './pages/RecurringEvents';
import ScheduleDiff from './pages/ScheduleDiff';
import EducationalMeasures from './pages/EducationalMeasures';
import AttendancePage from './pages/Attendance';
import TeachingMaterials from './pages/TeachingMaterials';
import CompetencyMapping from './pages/CompetencyMapping';
import { Setup } from './pages/Setup';
import { DeputyYearSetup } from './pages/DeputyYearSetup';
import { AuditLog } from './pages/AuditLog';
import { SystemAdminSchools } from './pages/SystemAdminSchools';
import { SystemAdminUsers } from './pages/SystemAdminUsers';
import { SystemAdminSettings } from './pages/SystemAdminSettings';
import { ActivateAccount } from './pages/ActivateAccount';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { SelectSchool } from './pages/SelectSchool';
import { UserProfile } from './pages/UserProfile';
import { Login } from './pages/Login';
import { ImpersonationBanner } from './components/ImpersonationBanner';
import { SchoolProvider, useSchool } from './context/SchoolContext';
import Messages from './pages/Messages';
import { TaskQueueProvider } from './context/TaskQueueContext';
import { getInitStatus } from './api';
import { Toaster } from 'sonner';

const ProtectedRoute = () => {
  const token = localStorage.getItem('access_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <ImpersonationBanner />
      <div className="flex-1 min-h-0">
        <Outlet />
      </div>
    </div>
  );
};

/**
 * Ensures system admin routes are always rendered in GLOBAL context.
 * If the user is in a school (TENANT) context, it automatically leaves the school.
 * Non-system-admins are redirected to /dashboard.
 */
const SystemAdminGuard = () => {
  const { tokenType, isSystemAdmin, leaveSchool } = useSchool();
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (tokenType === 'TENANT' && isSystemAdmin && !switching) {
      setSwitching(true);
      leaveSchool().finally(() => setSwitching(false));
    }
  }, [tokenType, isSystemAdmin, leaveSchool, switching]);

  if (!isSystemAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Still in TENANT mode – wait for leaveSchool to complete
  if (tokenType === 'TENANT' || switching) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return <Outlet />;
};

function App() {
  const [initialized, setInitialized] = useState<boolean | null>(null);

  useEffect(() => {
    getInitStatus()
      .then((res) => setInitialized(res.initialized))
      .catch((err) => {
        console.error('Failed to get init status', err);
        setInitialized(false);
      });
  }, []);

  if (initialized === null) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <SchoolProvider>
        <TaskQueueProvider>
          <Toaster position="top-right" duration={5000} closeButton richColors />
          <Routes>
            <Route path="/setup" element={!initialized ? <Setup /> : <Navigate to="/login" />} />
            <Route path="/activate" element={<ActivateAccount />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/login" element={!initialized ? <Navigate to="/setup" /> : <Login />} />

            <Route element={!initialized ? <Navigate to="/setup" replace /> : <ProtectedRoute />}>
              <Route path="/select-school" element={<SelectSchool />} />
              <Route path="/" element={<MainLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="registry" element={<Registry />} />
                <Route path="grading" element={<Grading />} />
                <Route path="grading/report-cards" element={<ReportCards />} />
                <Route path="schedule" element={<Schedule />} />
                <Route path="schedule/planner" element={<SchedulePlanner />} />
                <Route path="schedule/substitutions" element={<ScheduleSubstitutions />} />
                <Route path="schedule/bell" element={<BellSchedule />} />
                <Route path="schedule/diff" element={<ScheduleDiff />} />
                <Route path="schedule/recurring-events" element={<RecurringEvents />} />
                <Route path="grading/measures" element={<EducationalMeasures />} />
                <Route path="attendance" element={<AttendancePage />} />
                <Route path="school/users" element={<Users />} />
                <Route path="school/rooms" element={<RoomsManagement />} />
                <Route path="school/events" element={<SchoolEvents />} />
                <Route path="school/thematic-plans" element={<ThematicPlans />} />
                <Route path="school/lesson-preparations" element={<LessonPreparations />} />
                <Route path="school/teaching-materials" element={<TeachingMaterials />} />
                <Route path="school/competency-mapping" element={<CompetencyMapping />} />
                <Route path="school/curriculum" element={<CurriculumManagement />} />
                <Route path="school/white-book" element={<WhiteBook />} />
                <Route path="year-setup" element={<DeputyYearSetup />} />
                <Route path="school/audit-log" element={<AuditLog />} />
                <Route path="messages" element={<Messages />} />
                <Route element={<SystemAdminGuard />}>
                  <Route path="system/schools" element={<SystemAdminSchools />} />
                  <Route path="system/users" element={<SystemAdminUsers />} />
                  <Route path="system/settings" element={<SystemAdminSettings />} />
                </Route>
                <Route path="profile" element={<UserProfile />} />
              </Route>
            </Route>

            <Route path="*" element={!initialized ? <Navigate to="/setup" /> : <Navigate to="/dashboard" />} />
          </Routes>
        </TaskQueueProvider>
      </SchoolProvider>
    </BrowserRouter>
  );
}

export default App;
