import { Menu } from 'lucide-react';
import { Button } from './ui/button';

interface MobileHeaderProps {
    onMenuClick: () => void;
}

const MobileHeader = ({ onMenuClick }: MobileHeaderProps) => {
    const handleMenuClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onMenuClick();
    };

    return (
        <header className="fixed top-0 left-0 right-0 z-[100] bg-white border-b border-gray-200 md:hidden">
            <div className="flex items-center justify-between h-14 px-4">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleMenuClick}
                    className="touch-target"
                >
                    <Menu className="w-6 h-6" />
                </Button>

                <h1 className="text-lg font-bold text-primary">Fit Flow</h1>

                {/* Empty div for layout balance */}
                <div className="w-10"></div>
            </div>
        </header>
    );
};

export default MobileHeader;
