import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Registry } from './pages/Registry';
import { Grading } from './pages/Grading';
import { Schedule } from './pages/Schedule';
import Users from './pages/Users';
import { Setup } from './pages/Setup';
import { Login } from './pages/Login';
import { ImpersonationBanner } from './components/ImpersonationBanner';
import { getInitStatus } from './api';

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
        setInitialized(false); // Fallback to setup if check fails (e.g. backend down or 404)
      });
  }, []);

  if (initialized === null) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/setup" element={!initialized ? <Setup /> : <Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="registry" element={<Registry />} />
            <Route path="grading" element={<Grading />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="users" element={<Users />} />
          </Route>
        </Route>

        <Route path="*" element={!initialized ? <Navigate to="/setup" /> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
