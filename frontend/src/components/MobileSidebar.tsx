import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, ClipboardCheck, Users, X, MessageSquare, LogOut, ClipboardList, Layers } from 'lucide-react';
import { cn } from '../lib/utils';
import { useEffect } from 'react';
import { useAuth } from '../lib/useAuth';

interface MobileSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const MobileSidebar = ({ isOpen, onClose }: MobileSidebarProps) => {
    const location = useLocation();
    const { canViewDashboard, canViewCustomers, canViewTemplates } = useAuth();

    const allLinks = [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, visible: canViewDashboard },
        { href: '/style-cycle', label: 'Style Cycle', icon: Layers, visible: true },
        { href: '/evaluation', label: 'Evaluation', icon: ClipboardCheck, visible: true },
        { href: '/final-inspections', label: 'Final Inspection', icon: ClipboardList, visible: true },
        { href: '/customer-feedback', label: 'Customer Feedback', icon: MessageSquare, visible: true },
        { href: '/templates', label: 'Templates', icon: FileText, visible: canViewTemplates },
        { href: '/customers', label: 'Customers', icon: Users, visible: canViewCustomers },
    ];


    const links = allLinks.filter(link => link.visible);

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('is_superuser');
        localStorage.removeItem('user_type');
        window.location.href = '/login';
    };

    // Close sidebar when route changes
    useEffect(() => {
        onClose();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

    // Prevent body scroll when sidebar is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-[110] md:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <div
                className={cn(
                    "fixed top-0 left-0 h-full w-64 bg-white z-[120] transform transition-transform duration-300 ease-in-out md:hidden",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                        <h1 className="text-2xl font-bold text-primary">Fit Flow</h1>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg touch-target"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Navigation Links */}
                    <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                        {links.map((link) => {
                            const Icon = link.icon;
                            const isActive = location.pathname.startsWith(link.href);
                            return (
                                <Link
                                    key={link.href}
                                    to={link.href}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors touch-target",
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

                    {/* Logout Button */}
                    <div className="p-4 border-t border-gray-200">
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-4 py-3 w-full text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-target"
                        >
                            <LogOut className="w-5 h-5" />
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default MobileSidebar;
