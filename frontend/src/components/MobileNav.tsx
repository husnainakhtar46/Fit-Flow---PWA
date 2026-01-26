import { Link, useLocation } from 'react-router-dom';
import { FileText, ClipboardCheck, MessageSquare, ClipboardList } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/useAuth';

const MobileNav = () => {
    const location = useLocation();
    const { canViewTemplates } = useAuth();

    // Core pages for bottom navigation with role filtering
    const allLinks = [
        { href: '/evaluation', label: 'Evaluation', icon: ClipboardCheck, visible: true },
        { href: '/final-inspections', label: 'Inspection', icon: ClipboardList, visible: true },
        { href: '/customer-feedback', label: 'Feedback', icon: MessageSquare, visible: true },
        { href: '/templates', label: 'Templates', icon: FileText, visible: canViewTemplates },
    ];

    const links = allLinks.filter(link => link.visible);

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-gray-200 md:hidden safe-bottom">
            <div className="flex justify-around items-center h-16">
                {links.map((link) => {
                    const Icon = link.icon;
                    const isActive = location.pathname.startsWith(link.href);
                    return (
                        <Link
                            key={link.href}
                            to={link.href}
                            className={cn(
                                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors touch-target",
                                isActive
                                    ? "text-primary"
                                    : "text-gray-600"
                            )}
                        >
                            <Icon className={cn("w-6 h-6", isActive && "stroke-[2.5]")} />
                            <span className="text-xs font-medium">{link.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default MobileNav;
