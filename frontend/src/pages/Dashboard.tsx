import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import api from '../lib/api';
import { SearchableSelect } from '../components/SearchableSelect';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// Helper to format date as YYYY-MM-DD (using local timezone)
const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Get start of week (Monday)
const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d;
};

// Get start of month
const getStartOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1);
};

const Dashboard = () => {
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [customerId, setCustomerId] = useState<string>('');
    const [factoryName, setFactoryName] = useState<string>('');

    // Fetch Factories for Filter
    const { data: factoriesData } = useQuery({
        queryKey: ['factories', 'all'],
        queryFn: async () => {
            const res = await api.get('/factories/?page_size=100');
            return res.data;
        }
    });

    const factories = Array.isArray(factoriesData) ? factoriesData : factoriesData?.results || [];

    // Fetch Customers for Filter
    const { data: customersData } = useQuery({
        queryKey: ['customers', 'all'], // Unique key to avoid collision with paginated lists
        queryFn: async () => {
            const res = await api.get('/customers/?page_size=100'); // Get all/many
            return res.data;
        }
    });

    // Handle both array and paginated response formats safely
    const customers = Array.isArray(customersData) ? customersData : customersData?.results || [];

    const { data, isLoading } = useQuery({
        queryKey: ['dashboard', startDate, endDate, customerId, factoryName],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            if (customerId) params.append('customer_id', customerId);
            if (factoryName) params.append('factory_name', factoryName);

            const url = `/dashboard/${params.toString() ? '?' + params.toString() : ''}`;
            const res = await api.get(url);
            return res.data;
        },
    });

    // Quick filter handlers
    const handleThisWeek = () => {
        const now = new Date();
        setStartDate(formatDate(getStartOfWeek(now)));
        setEndDate(formatDate(now));
    };

    const handleThisMonth = () => {
        const now = new Date();
        setStartDate(formatDate(getStartOfMonth(now)));
        setEndDate(formatDate(now));
    };

    const handleLast30Days = () => {
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        setStartDate(formatDate(thirtyDaysAgo));
        setEndDate(formatDate(now));
    };

    const handleAllTime = () => {
        setStartDate('');
        setEndDate('');
    };

    if (isLoading) return <div>Loading...</div>;

    const passFailData = [
        { name: 'Pass', value: data?.pass_count || 0, fill: '#22c55e' },
        { name: 'Fail', value: data?.fail_count || 0, fill: '#ef4444' },
    ];

    // 1. Stage Data
    const stageData = data?.inspections_by_stage?.map((item: any) => ({
        name: item.stage,
        value: item.count
    })) || [];

    // 2. Customer Data
    const customerData = data?.inspections_by_customer?.map((item: any) => ({
        name: item.customer__name || 'Unknown',
        value: item.count
    })) || [];

    // 3. Monthly Trend
    const trendData = data?.monthly_trend?.map((item: any) => ({
        name: new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        value: item.count
    })) || [];

    // 4. Decision Comparison
    // We need to merge internal and customer decisions or just show them side-by-side
    // Let's create a combined dataset if possible, or just two separate bars?
    // A simple way is to show counts of each decision type for Internal vs Customer
    // But the decision values might differ (e.g. "Accepted" vs "Accepted with Comments")
    // Let's just plot them as is.

    // Better approach for comparison: 
    // We can show a bar chart with "Internal Accepted", "Customer Accepted", etc.
    // Or just two simple bar charts side-by-side?
    // Let's try to combine them into categories: Accepted, Rejected, Other

    const processDecisions = (decisions: any[], key: string) => {
        const counts = { Accepted: 0, Rejected: 0, Other: 0 };
        decisions?.forEach((d: any) => {
            if (d[key] === 'Accepted') counts.Accepted += d.count;
            else if (d[key] === 'Rejected') counts.Rejected += d.count;
            else counts.Other += d.count;
        });
        return counts;
    };

    const internalCounts = processDecisions(data?.internal_decisions, 'decision');
    const customerCounts = processDecisions(data?.customer_decisions, 'customer_decision');

    const comparisonData = [
        { name: 'Accepted', Internal: internalCounts.Accepted, Customer: customerCounts.Accepted },
        { name: 'Rejected', Internal: internalCounts.Rejected, Customer: customerCounts.Rejected },
        { name: 'Other', Internal: internalCounts.Other, Customer: customerCounts.Other },
    ];

    // ==================== FINAL INSPECTION DATA ====================
    // 1. Combine Pass/Fail trends into single dataset
    const fiPassMap = new Map<string, number>();
    const fiFailMap = new Map<string, number>();

    data?.fi_monthly_pass?.forEach((item: any) => {
        const key = new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        fiPassMap.set(key, item.count);
    });
    data?.fi_monthly_fail?.forEach((item: any) => {
        const key = new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        fiFailMap.set(key, item.count);
    });

    const allMonths = new Set([...fiPassMap.keys(), ...fiFailMap.keys()]);
    const fiTrendData = Array.from(allMonths).sort().map(month => ({
        name: month,
        pass: fiPassMap.get(month) || 0,
        fail: fiFailMap.get(month) || 0,
    }));

    // 2. By Customer
    const fiCustomerData = data?.fi_by_customer?.map((item: any) => ({
        name: item.customer__name || 'Unknown',
        pass: item.pass_count || 0,
        fail: item.fail_count || 0,
    })) || [];

    // 3. Top Defects
    const fiDefectsData = data?.fi_top_defects?.map((item: any) => ({
        name: item.description || 'Unknown',
        value: item.total || 0,
    })) || [];

    return (
        <div className="space-y-4 md:space-y-6 pb-10">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Dashboard</h1>

            {/* Date Range Filter */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-gray-600">From:</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-gray-600">To:</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex items-center gap-2 min-w-[200px]">
                            <SearchableSelect
                                value={customerId}
                                onChange={(val) => setCustomerId(val)}
                                options={customers.map((c: any) => ({ value: c.id, label: c.name }))}
                                placeholder="Select Customer"
                            />
                        </div>
                        <div className="flex items-center gap-2 min-w-[200px]">
                            <SearchableSelect
                                value={factoryName}
                                onChange={(val) => setFactoryName(val)}
                                options={factories.map((f: any) => ({ value: f.name, label: f.name }))}
                                placeholder="Select Factory"
                            />
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                            <button
                                onClick={handleThisWeek}
                                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                            >
                                This Week
                            </button>
                            <button
                                onClick={handleThisMonth}
                                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                            >
                                This Month
                            </button>
                            <button
                                onClick={handleLast30Days}
                                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                            >
                                Last 30 Days
                            </button>
                            <button
                                onClick={handleAllTime}
                                className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors"
                            >
                                All Time
                            </button>
                        </div>
                    </div>
                    {(startDate || endDate) && (
                        <div className="mt-2 text-sm text-gray-500">
                            Showing data {startDate ? `from ${startDate}` : ''} {endDate ? `to ${endDate}` : ''}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Total Evaluations</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{data?.total_inspections}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Pass Rate</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-green-600">{data?.pass_rate}%</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Passed</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-green-600">{data?.pass_count}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Failed</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-red-600">{data?.fail_count}</div></CardContent>
                </Card>
            </div>

            {/* Row 2: Existing Charts */}
            <div className="grid grid-cols-1 gap-4 md:gap-6">
                <Card className="h-[350px]">
                    <CardHeader><CardTitle>Pass vs Fail</CardTitle></CardHeader>
                    <CardContent className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={passFailData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="value" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Row 3: Stage & Customer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* 1. Stage Distribution */}
                <Card className="h-[400px]">
                    <CardHeader><CardTitle>Evaluations by Stage</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stageData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {stageData.map((_: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 2. Customer Volume */}
                <Card className="h-[400px]">
                    <CardHeader><CardTitle>Evaluations by Customer</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={customerData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={100} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#8884d8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Row 4: Trend & Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* 3. Monthly Trend */}
                <Card className="h-[400px]">
                    <CardHeader><CardTitle>Monthly Trend</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 4. Decision Comparison */}
                <Card className="h-[400px]">
                    <CardHeader><CardTitle>Internal vs Customer Decisions</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={comparisonData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="Internal" fill="#82ca9d" />
                                <Bar dataKey="Customer" fill="#8884d8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* ==================== FINAL INSPECTION SECTION ==================== */}
            <div className="border-t-4 border-blue-500 pt-6 mt-8">
                <h2 className="text-xl md:text-2xl font-bold text-blue-800 mb-4">Final Inspection Analytics</h2>

                {/* FI KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Total Final Inspections</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold">{data?.fi_total || 0}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">FI Pass Rate</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-green-600">{data?.fi_pass_rate || 0}%</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">FI Passed</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-green-600">{data?.fi_pass || 0}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">FI Failed</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-red-600">{data?.fi_fail || 0}</div></CardContent>
                    </Card>
                </div>

                {/* FI Charts Row 1: Trend & By Customer */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
                    {/* 1. Pass/Fail Trend */}
                    <Card className="h-[400px]">
                        <CardHeader><CardTitle>Final Inspection Trend (Pass/Fail)</CardTitle></CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={fiTrendData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="pass" stroke="#22c55e" strokeWidth={2} name="Pass" />
                                    <Line type="monotone" dataKey="fail" stroke="#ef4444" strokeWidth={2} name="Fail" />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* 2. By Customer */}
                    <Card className="h-[400px]">
                        <CardHeader><CardTitle>Final Inspections by Customer</CardTitle></CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={fiCustomerData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={100} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="pass" stackId="a" fill="#22c55e" name="Pass" />
                                    <Bar dataKey="fail" stackId="a" fill="#ef4444" name="Fail" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                {/* FI Charts Row 2: Top Defects */}
                <div className="grid grid-cols-1 gap-4 md:gap-6">
                    <Card className="h-[400px]">
                        <CardHeader><CardTitle>Top Defect Types (Final Inspection)</CardTitle></CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={fiDefectsData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={150} />
                                    <Tooltip />
                                    <Bar dataKey="value" fill="#f97316" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div >
    );
};

export default Dashboard;
