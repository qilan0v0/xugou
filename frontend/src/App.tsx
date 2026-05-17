import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { useTranslation } from 'react-i18next';

import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/Dashboard';
import MonitorsList from './pages/monitors/MonitorsList';
import MonitorDetail from './pages/monitors/MonitorDetail';
import CreateMonitor from './pages/monitors/CreateMonitor';
import EditMonitor from './pages/monitors/EditMonitor';
import AgentsList from './pages/agents/AgentsList';
import AgentDetail from './pages/agents/AgentDetail';
import UsersList from './pages/users/UsersList';
import UserProfile from './pages/users/UserProfile';
import NotFound from './pages/NotFound';
import StatusPage from './pages/status/StatusPage';
import StatusPageConfig from './pages/status/StatusPageConfig';
import CreateAgent from './pages/agents/CreateAgent';
import EditAgent from './pages/agents/EditAgent';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();
  if (isLoading) return <div className="flex justify-center items-center min-h-[50vh]"><span className="text-slate-500">{t('common.loading')}</span></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { t } = useTranslation();
  if (isLoading) return <div className="flex justify-center items-center min-h-[50vh]"><span className="text-slate-500">{t('common.loading')}</span></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <LanguageProvider>
      <Routes>
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route path="/login" element={<Layout><Login /></Layout>} />
        <Route path="/register" element={<Layout><Register /></Layout>} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/status/config" element={<ProtectedRoute><Layout><StatusPageConfig /></Layout></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/monitors" element={<ProtectedRoute><Layout><MonitorsList /></Layout></ProtectedRoute>} />
        <Route path="/monitors/create" element={<ProtectedRoute><Layout><CreateMonitor /></Layout></ProtectedRoute>} />
        <Route path="/monitors/edit/:id" element={<ProtectedRoute><Layout><EditMonitor /></Layout></ProtectedRoute>} />
        <Route path="/monitors/:id" element={<ProtectedRoute><Layout><MonitorDetail /></Layout></ProtectedRoute>} />
        <Route path="/agents" element={<ProtectedRoute><Layout><AgentsList /></Layout></ProtectedRoute>} />
        <Route path="/agents/create" element={<ProtectedRoute><Layout><CreateAgent /></Layout></ProtectedRoute>} />
        <Route path="/agents/edit/:id" element={<ProtectedRoute><Layout><EditAgent /></Layout></ProtectedRoute>} />
        <Route path="/agents/:id" element={<ProtectedRoute><Layout><AgentDetail /></Layout></ProtectedRoute>} />
        <Route path="/users" element={<AdminRoute><Layout><UsersList /></Layout></AdminRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Layout><UserProfile /></Layout></ProtectedRoute>} />
        <Route path="*" element={<Layout><NotFound /></Layout>} />
      </Routes>
    </LanguageProvider>
  );
}

export default App;
