import { Link } from 'react-router-dom';
import { Users, Factory, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/useAuth';

const ResourceCard = ({
    to,
    title,
    description,
    icon: Icon,
    colorClass
}: {
    to: string;
    title: string;
    description: string;
    icon: any;
    colorClass: string;
}) => {
    return (
        <Link
            to={to}
            className="group relative flex flex-col justify-between p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 hover:-translate-y-1"
        >
            <div>
                <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-colors", colorClass)}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary transition-colors">
                    {title}
                </h3>
                <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                    {description}
                </p>
            </div>

            <div className="mt-6 flex items-center text-sm font-medium text-gray-400 group-hover:text-primary transition-colors">
                Manage
                <ArrowRight className="w-4 h-4 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
            </div>
        </Link>
    );
};

const Resources = () => {
    const { canViewCustomers } = useAuth();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Resources</h1>
                <p className="mt-2 text-gray-600">
                    Manage your application data and configurations from a central hub.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">


                {/* Customers Card */}
                {canViewCustomers && (
                    <ResourceCard
                        to="/customers"
                        title="Customers"
                        description="Manage customer profiles, contact details, and email distribution lists."
                        icon={Users}
                        colorClass="bg-green-500"
                    />
                )}

                {/* Factories Card - Everyone can view, edit restricted by page */}
                <ResourceCard
                    to="/factories"
                    title="Factories"
                    description="Maintain a registry of manufacturing factories and their details."
                    icon={Factory}
                    colorClass="bg-orange-500"
                />
            </div>
        </div>
    );
};

export default Resources;
