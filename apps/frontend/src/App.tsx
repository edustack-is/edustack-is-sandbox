import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Registry } from './pages/Registry';
import { Grading } from './pages/Grading';
import { Schedule } from './pages/Schedule';
import Users from './pages/Users';
import { ImpersonationBanner } from './components/ImpersonationBanner';

function App() {
  return (
    <BrowserRouter>
      <ImpersonationBanner />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="registry" element={<Registry />} />
          <Route path="grading" element={<Grading />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="users" element={<Users />} />
          <Route path="*" element={<div>Not Found</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
