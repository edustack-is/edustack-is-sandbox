import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { Registry } from './pages/Registry';
import { Grading } from './pages/Grading';
import { Schedule } from './pages/Schedule';
import Users from './pages/Users';
import RoomsManagement from './pages/RoomsManagement';
import CurriculumManagement from './pages/CurriculumManagement';
import { Setup } from './pages/Setup';
import { DeputyYearSetup } from './pages/DeputyYearSetup';
import { SystemAdminSchools } from './pages/SystemAdminSchools';
import { SystemAdminUsers } from './pages/SystemAdminUsers';
import { SystemAdminAi } from './pages/SystemAdminAi';
import { ActivateAccount } from './pages/ActivateAccount';
import { SelectSchool } from './pages/SelectSchool';
import { Login } from './pages/Login';
import { ImpersonationBanner } from './components/ImpersonationBanner';
import { SchoolProvider } from './context/SchoolContext';
import { getInitStatus } from './api';
import { Toaster } from 'sonner';

const ProtectedRoute = () => {
  const token = localStorage.getItem('access_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return (
    <>
      <ImpersonationBanner />
      <Outlet />
    </>
  );
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
        <Toaster position="top-right" duration={5000} closeButton richColors />
        <Routes>
          <Route path="/setup" element={!initialized ? <Setup /> : <Navigate to="/login" />} />
          <Route path="/activate" element={<ActivateAccount />} />
          <Route path="/login" element={!initialized ? <Navigate to="/setup" /> : <Login />} />

          <Route element={!initialized ? <Navigate to="/setup" replace /> : <ProtectedRoute />}>
            <Route path="/select-school" element={<SelectSchool />} />
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="registry" element={<Registry />} />
              <Route path="grading" element={<Grading />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="school/users" element={<Users />} />
              <Route path="school/rooms" element={<RoomsManagement />} />
              <Route path="school/curriculum" element={<CurriculumManagement />} />
              <Route path="year-setup" element={<DeputyYearSetup />} />
              <Route path="system/schools" element={<SystemAdminSchools />} />
              <Route path="system/users" element={<SystemAdminUsers />} />
              <Route path="system/ai" element={<SystemAdminAi />} />
            </Route>
          </Route>

          <Route path="*" element={!initialized ? <Navigate to="/setup" /> : <Navigate to="/dashboard" />} />
        </Routes>
      </SchoolProvider>
    </BrowserRouter>
  );
}

export default App;
