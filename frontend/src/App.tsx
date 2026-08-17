import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import LoadingSpinner from './components/LoadingSpinner';

// Critical pages — eager loaded
import StatusPage from './pages/status/StatusPage';
import NotFound from './pages/NotFound';

// Secondary pages — lazy loaded
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const MonitorDetail = lazy(() => import('./pages/monitors/MonitorDetail'));
const MonitorsList = lazy(() => import('./pages/monitors/MonitorsList'));
const CreateMonitor = lazy(() => import('./pages/monitors/CreateMonitor'));
const EditMonitor = lazy(() => import('./pages/monitors/EditMonitor'));
const AgentDetail = lazy(() => import('./pages/agents/AgentDetail'));
const AgentsList = lazy(() => import('./pages/agents/AgentsList'));
const CreateAgent = lazy(() => import('./pages/agents/CreateAgent'));
const EditAgent = lazy(() => import('./pages/agents/EditAgent'));
const GroupsList = lazy(() => import('./pages/agents/GroupsList'));
const TerminalPage = lazy(() => import('./pages/TerminalPage'));
const UserProfile = lazy(() => import('./pages/users/UserProfile'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const StatusPageConfig = lazy(() => import('./pages/status/StatusPageConfig'));

const Lazy = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="flex justify-center items-center min-h-[50vh]"><LoadingSpinner /></div>}>
    {children}
  </Suspense>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="flex justify-center items-center min-h-[50vh]"><LoadingSpinner /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// 后台页面统一包一层 AdminLayout（侧边栏 + 顶栏）
const AdminPage = ({ children }: { children: React.ReactNode }) => (
  <AdminLayout><Lazy>{children}</Lazy></AdminLayout>
);

function App() {
  return (
    <LanguageProvider>
      <Routes>
        {/* 公开页面 */}
        <Route path="/" element={<StatusPage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/login" element={<Layout><Lazy><Login /></Lazy></Layout>} />
        <Route path="/register" element={<Layout><Lazy><Register /></Lazy></Layout>} />

        {/* 管理后台 */}
        <Route path="/monitors" element={<ProtectedRoute><AdminPage><MonitorsList /></AdminPage></ProtectedRoute>} />
        <Route path="/monitors/create" element={<ProtectedRoute><AdminPage><CreateMonitor /></AdminPage></ProtectedRoute>} />
        <Route path="/monitors/edit/:id" element={<ProtectedRoute><AdminPage><EditMonitor /></AdminPage></ProtectedRoute>} />
        <Route path="/monitors/:id" element={<ProtectedRoute><AdminPage><MonitorDetail /></AdminPage></ProtectedRoute>} />
        <Route path="/agents" element={<ProtectedRoute><AdminPage><AgentsList /></AdminPage></ProtectedRoute>} />
        <Route path="/agents/create" element={<ProtectedRoute><AdminPage><CreateAgent /></AdminPage></ProtectedRoute>} />
        <Route path="/agents/edit/:id" element={<ProtectedRoute><AdminPage><EditAgent /></AdminPage></ProtectedRoute>} />
        <Route path="/agents/groups" element={<ProtectedRoute><AdminPage><GroupsList /></AdminPage></ProtectedRoute>} />
        <Route path="/agents/:id" element={<ProtectedRoute><AdminPage><AgentDetail /></AdminPage></ProtectedRoute>} />
        <Route path="/status/config" element={<ProtectedRoute><AdminPage><StatusPageConfig /></AdminPage></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><AdminPage><UserProfile /></AdminPage></ProtectedRoute>} />
        <Route path="/terminal/:id" element={<ProtectedRoute><AdminPage><TerminalPage /></AdminPage></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><AdminPage><SettingsPage /></AdminPage></ProtectedRoute>} />

        {/* 404 */}
        <Route path="*" element={<Layout><NotFound /></Layout>} />
      </Routes>
    </LanguageProvider>
  );
}

export default App;