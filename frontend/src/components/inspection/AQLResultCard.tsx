/**
 * AQL Result Card - Displays Pass/Fail status with defect counts vs limits.
 * Extracted from FinalInspectionForm.tsx for better maintainability.
 */

import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ServerCalculations } from './types';

interface AQLResultCardProps {
    serverCalcs: ServerCalculations;
    critical: number;
    major: number;
    minor: number;
}

export function AQLResultCard({ serverCalcs, critical, major, minor }: AQLResultCardProps) {
    return (
        <Card className="border-t-4 border-t-blue-600">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>2. AQL Result (Server Verified)</CardTitle>
                <Badge
                    className={serverCalcs.result === 'Pass' ? 'bg-green-600' : 'bg-red-600'}
                    style={{ fontSize: '1.2rem', padding: '0.5rem 1.5rem' }}
                >
                    {serverCalcs.result.toUpperCase()}
                </Badge>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Critical Card */}
                    <div className={`p-4 rounded-lg border-2 transition-all ${critical > serverCalcs.maxCritical ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                        <div className="flex justify-between mb-2">
                            <span className="font-semibold text-gray-700">Critical</span>
                            <span className="text-xs font-mono bg-gray-200 px-2 py-1 rounded">Max: {serverCalcs.maxCritical}</span>
                        </div>
                        <div className="text-4xl font-bold text-gray-900">{critical}</div>
                        <p className={`text-xs mt-1 font-bold ${critical > serverCalcs.maxCritical ? 'text-red-600' : 'text-green-600'}`}>
                            {critical > serverCalcs.maxCritical ? 'FAILED' : 'WITHIN LIMIT'}
                        </p>
                    </div>

                    {/* Major Card */}
                    <div className={`p-4 rounded-lg border-2 transition-all ${major > serverCalcs.maxMajor ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                        <div className="flex justify-between mb-2">
                            <span className="font-semibold text-gray-700">Major</span>
                            <span className="text-xs font-mono bg-gray-200 px-2 py-1 rounded">Max: {serverCalcs.maxMajor}</span>
                        </div>
                        <div className="text-4xl font-bold text-gray-900">{major}</div>
                        <p className={`text-xs mt-1 font-bold ${major > serverCalcs.maxMajor ? 'text-red-600' : 'text-green-600'}`}>
                            {major > serverCalcs.maxMajor ? 'FAILED' : 'WITHIN LIMIT'}
                        </p>
                    </div>

                    {/* Minor Card */}
                    <div className={`p-4 rounded-lg border-2 transition-all ${minor > serverCalcs.maxMinor ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                        <div className="flex justify-between mb-2">
                            <span className="font-semibold text-gray-700">Minor</span>
                            <span className="text-xs font-mono bg-gray-200 px-2 py-1 rounded">Max: {serverCalcs.maxMinor}</span>
                        </div>
                        <div className="text-4xl font-bold text-gray-900">{minor}</div>
                        <p className={`text-xs mt-1 font-bold ${minor > serverCalcs.maxMinor ? 'text-red-600' : 'text-green-600'}`}>
                            {minor > serverCalcs.maxMinor ? 'FAILED' : 'WITHIN LIMIT'}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
