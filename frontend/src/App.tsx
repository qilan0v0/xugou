import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';

// Critical pages — eager loaded
import StatusPage from './pages/status/StatusPage';
import MonitorsList from './pages/monitors/MonitorsList';
import AgentsList from './pages/agents/AgentsList';
import NotFound from './pages/NotFound';

// Secondary pages — lazy loaded
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const MonitorDetail = lazy(() => import('./pages/monitors/MonitorDetail'));
const CreateMonitor = lazy(() => import('./pages/monitors/CreateMonitor'));
const EditMonitor = lazy(() => import('./pages/monitors/EditMonitor'));
const AgentDetail = lazy(() => import('./pages/agents/AgentDetail'));
const CreateAgent = lazy(() => import('./pages/agents/CreateAgent'));
const EditAgent = lazy(() => import('./pages/agents/EditAgent'));
const GroupsList = lazy(() => import('./pages/agents/GroupsList'));
const UserProfile = lazy(() => import('./pages/users/UserProfile'));
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

function App() {
  return (
    <LanguageProvider>
      <Routes>
        <Route path="/" element={<StatusPage />} />
        <Route path="/login" element={<Layout><Lazy><Login /></Lazy></Layout>} />
        <Route path="/register" element={<Layout><Lazy><Register /></Lazy></Layout>} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/status/config" element={<ProtectedRoute><Layout><Lazy><StatusPageConfig /></Lazy></Layout></ProtectedRoute>} />
        <Route path="/monitors" element={<ProtectedRoute><Layout><MonitorsList /></Layout></ProtectedRoute>} />
        <Route path="/monitors/create" element={<ProtectedRoute><Layout><Lazy><CreateMonitor /></Lazy></Layout></ProtectedRoute>} />
        <Route path="/monitors/edit/:id" element={<ProtectedRoute><Layout><Lazy><EditMonitor /></Lazy></Layout></ProtectedRoute>} />
        <Route path="/monitors/:id" element={<ProtectedRoute><Layout><Lazy><MonitorDetail /></Lazy></Layout></ProtectedRoute>} />
        <Route path="/agents" element={<ProtectedRoute><Layout><AgentsList /></Layout></ProtectedRoute>} />
        <Route path="/agents/create" element={<ProtectedRoute><Layout><Lazy><CreateAgent /></Lazy></Layout></ProtectedRoute>} />
        <Route path="/agents/edit/:id" element={<ProtectedRoute><Layout><Lazy><EditAgent /></Lazy></Layout></ProtectedRoute>} />
        <Route path="/agents/groups" element={<ProtectedRoute><Layout><Lazy><GroupsList /></Lazy></Layout></ProtectedRoute>} />
        <Route path="/agents/:id" element={<ProtectedRoute><Layout><Lazy><AgentDetail /></Lazy></Layout></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Layout><Lazy><UserProfile /></Lazy></Layout></ProtectedRoute>} />
        <Route path="*" element={<Layout><NotFound /></Layout>} />
      </Routes>
    </LanguageProvider>
  );
}

export default App;
