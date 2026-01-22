/**
 * Defect Counter - Displays and manages defect counts with +/- buttons.
 * Extracted from FinalInspectionForm.tsx for better maintainability.
 */

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Plus, Minus } from 'lucide-react';
import { DefectCounts } from './types';

interface DefectCounterProps {
    defectCounts: DefectCounts;
    onUpdateCount: (defect: string, severity: 'critical' | 'major' | 'minor', delta: number) => void;
    customDefect: string;
    onCustomDefectChange: (value: string) => void;
    onAddCustomDefect: () => void;
}

export function DefectCounter({
    defectCounts,
    onUpdateCount,
    customDefect,
    onCustomDefectChange,
    onAddCustomDefect,
}: DefectCounterProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>5. Defect Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {Object.keys(defectCounts).map(defect => (
                    <div key={defect} className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-3 bg-white border rounded hover:shadow-sm transition-all">
                        <span className="font-medium flex-1 text-gray-700">{defect}</span>
                        <div className="flex gap-4">
                            {/* Critical */}
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-red-600 w-10 font-bold uppercase">Critical</span>
                                <Button type="button" size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => onUpdateCount(defect, 'critical', -1)}>
                                    <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-6 text-center font-bold">{defectCounts[defect].critical}</span>
                                <Button type="button" size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => onUpdateCount(defect, 'critical', 1)}>
                                    <Plus className="h-3 w-3" />
                                </Button>
                            </div>

                            <div className="w-px bg-gray-200 h-6 mx-1"></div>

                            {/* Major */}
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-orange-600 w-10 font-bold uppercase">Major</span>
                                <Button type="button" size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => onUpdateCount(defect, 'major', -1)}>
                                    <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-6 text-center font-bold">{defectCounts[defect].major}</span>
                                <Button type="button" size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => onUpdateCount(defect, 'major', 1)}>
                                    <Plus className="h-3 w-3" />
                                </Button>
                            </div>

                            <div className="w-px bg-gray-200 h-6 mx-1"></div>

                            {/* Minor */}
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-600 w-10 font-bold uppercase">Minor</span>
                                <Button type="button" size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => onUpdateCount(defect, 'minor', -1)}>
                                    <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-6 text-center font-bold">{defectCounts[defect].minor}</span>
                                <Button type="button" size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => onUpdateCount(defect, 'minor', 1)}>
                                    <Plus className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Add Custom Defect */}
                <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Input
                        placeholder="Add custom defect type..."
                        value={customDefect}
                        onChange={(e) => onCustomDefectChange(e.target.value)}
                    />
                    <Button type="button" onClick={onAddCustomDefect} variant="secondary">Add</Button>
                </div>
            </CardContent>
        </Card>
    );
}
