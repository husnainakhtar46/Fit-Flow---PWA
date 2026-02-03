import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardCheck, LogOut, MessageSquare, ClipboardList, Layers, FileText, Database } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/useAuth';

const Sidebar = () => {
    const location = useLocation();
    const {
        canViewDashboard,
        canViewTemplates,
        canViewResources
    } = useAuth();

    // Define all navigation links with role-based visibility
    const allLinks = [
        {
            href: '/dashboard',
            label: 'Dashboard',
            icon: LayoutDashboard,
            visible: canViewDashboard
        },
        {
            href: '/style-cycle',
            label: 'Style Cycle',
            icon: Layers,
            visible: true // Everyone can see style cycle
        },
        {
            href: '/evaluation',
            label: 'Evaluation',
            icon: ClipboardCheck,
            visible: true // Everyone can see evaluations
        },
        {
            href: '/final-inspections',
            label: 'Final Inspection',
            icon: ClipboardList,
            visible: true // Everyone can see final inspections
        },
        {
            href: '/customer-feedback',
            label: 'Customer Feedback',
            icon: MessageSquare,
            visible: true // Everyone can see feedback
        },
        {
            href: '/templates',
            label: 'Style Templates',
            icon: FileText,
            visible: canViewTemplates
        },

        {
            href: '/resources',
            label: 'Resources',
            icon: Database,
            visible: canViewResources
        },
    ];


    const links = allLinks.filter(link => link.visible);

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('is_superuser');
        localStorage.removeItem('user_type');
        window.location.href = '/login';
    };

    return (
        <div className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col">
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <img src="/icon-192.png" alt="Fit Flow Logo" className="w-8 h-8" />
                    <h1 className="text-2xl font-bold text-primary">Fit Flow</h1>
                </div>
            </div>
            <nav className="flex-1 p-4 space-y-2">
                {links.map((link) => {
                    const Icon = link.icon;
                    const isActive = location.pathname.startsWith(link.href);
                    return (
                        <Link
                            key={link.href}
                            to={link.href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-primary text-primary-foreground"
                                    : "text-gray-600 hover:bg-gray-100"
                            )}
                        >
                            <Icon className="w-5 h-5" />
                            {link.label}
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 border-t border-gray-200">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 w-full text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    Logout
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
