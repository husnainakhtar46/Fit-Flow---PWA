/**
 * Shipment Details - Cartons, weights, and dimensions form section.
 * Extracted from FinalInspectionForm.tsx for better maintainability.
 */

import { UseFormRegister } from 'react-hook-form';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface ShipmentDetailsProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    register: UseFormRegister<any>;
}

export function ShipmentDetails({ register }: ShipmentDetailsProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>6. Shipment Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <Label>Total Cartons</Label>
                    <Input type="number" {...register('total_cartons', { valueAsNumber: true })} className="mt-1" />
                </div>
                <div>
                    <Label>Selected Cartons</Label>
                    <Input type="number" {...register('selected_cartons', { valueAsNumber: true })} className="mt-1" />
                </div>
                <div>
                    <Label>Gross Weight (kg)</Label>
                    <Input type="number" step="0.1" {...register('gross_weight', { valueAsNumber: true })} className="mt-1" />
                </div>
                <div>
                    <Label>Net Weight (kg)</Label>
                    <Input type="number" step="0.1" {...register('net_weight', { valueAsNumber: true })} className="mt-1" />
                </div>
                <div className="col-span-1 md:col-span-2 grid grid-cols-3 gap-2">
                    <div className="col-span-3 mb-1 text-sm font-medium">Carton Dimensions (cm)</div>
                    <Input placeholder="L" type="number" step="0.1" {...register('carton_length', { valueAsNumber: true })} />
                    <Input placeholder="W" type="number" step="0.1" {...register('carton_width', { valueAsNumber: true })} />
                    <Input placeholder="H" type="number" step="0.1" {...register('carton_height', { valueAsNumber: true })} />
                </div>
            </CardContent>
        </Card>
    );
}
