import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, ReactNode } from 'react';
import { Toaster } from './components/ui/toaster';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { ForgotPassword } from './features/auth/components/ForgotPassword';
import { VerifyAndResetPassword } from './features/auth/components/VerifyAndResetPassword';
import Templates from './pages/Templates';
import EvaluationForm from './pages/EvaluationForm';
import Customers from './pages/Customers';
import CustomerFeedback from './pages/CustomerFeedback';
import FinalInspections from './pages/FinalInspections';
import StyleCycle from './pages/StyleCycle';
import Sidebar from './components/Sidebar';
import MobileHeader from './components/MobileHeader';
import MobileSidebar from './components/MobileSidebar';
import Resources from './pages/Resources';
import Factories from './pages/Factories';
import { useAuth } from './lib/useAuth';


const queryClient = new QueryClient();

// Protected route wrapper for role-based access
const ProtectedRoute = ({
    children,
    requiredPermission
}: {
    children: ReactNode;
    requiredPermission: boolean;
}) => {
    if (!requiredPermission) {
        return <Navigate to="/" replace />;
    }
    return <>{children}</>;
};

const Layout = () => {
    const token = localStorage.getItem('access_token');
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    if (!token) return <Navigate to="/login" />;

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Desktop Sidebar */}
            <Sidebar />

            {/* Mobile Navigation */}
            <MobileHeader onMenuClick={() => setMobileSidebarOpen(true)} />
            <MobileSidebar
                isOpen={mobileSidebarOpen}
                onClose={() => setMobileSidebarOpen(false)}
            />

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-16 pb-8 md:pt-8 md:pb-8 relative z-10">
                <Outlet />
            </main>
        </div>
    );
};

const HomeRedirect = () => {
    const { canViewDashboard } = useAuth();
    return <Navigate to={canViewDashboard ? "/dashboard" : "/evaluation"} />;
};

// Wrapper components for protected routes
const ProtectedDashboard = () => {
    const { canViewDashboard } = useAuth();
    return (
        <ProtectedRoute requiredPermission={canViewDashboard}>
            <Dashboard />
        </ProtectedRoute>
    );
};

const ProtectedTemplates = () => {
    const { canViewTemplates } = useAuth();
    return (
        <ProtectedRoute requiredPermission={canViewTemplates}>
            <Templates />
        </ProtectedRoute>
    );
};

const ProtectedCustomers = () => {
    const { canViewCustomers } = useAuth();
    return (
        <ProtectedRoute requiredPermission={canViewCustomers}>
            <Customers />
        </ProtectedRoute>
    );
};

const ProtectedResources = () => {
    const { canViewResources } = useAuth();
    return (
        <ProtectedRoute requiredPermission={canViewResources}>
            <Resources />
        </ProtectedRoute>
    );
};

const ProtectedFactories = () => {
    const { canViewResources } = useAuth();
    return (
        <ProtectedRoute requiredPermission={canViewResources}>
            <Factories />
        </ProtectedRoute>
    );
};

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <Router>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/verify-reset-password" element={<VerifyAndResetPassword />} />
                    <Route element={<Layout />}>
                        <Route path="/" element={<HomeRedirect />} />
                        <Route path="/dashboard" element={<ProtectedDashboard />} />
                        <Route path="/style-cycle" element={<StyleCycle />} />
                        <Route path="/templates" element={<ProtectedTemplates />} />
                        <Route path="/evaluation" element={<EvaluationForm />} />
                        <Route path="/final-inspections" element={<FinalInspections />} />
                        <Route path="/customer-feedback" element={<CustomerFeedback />} />
                        <Route path="/resources" element={<ProtectedResources />} />
                        <Route path="/factories" element={<ProtectedFactories />} />
                        <Route path="/customers" element={<ProtectedCustomers />} />
                    </Route>

                </Routes>
            </Router>
            <Toaster />
        </QueryClientProvider>
    );
}

export default App;
