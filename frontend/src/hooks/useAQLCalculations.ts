import { useState, useCallback, useEffect } from 'react';
import { UseFormSetValue } from 'react-hook-form';
import api from '../lib/api';
import { FormData } from '../types/inspection';
import { ServerCalculations } from '../components/inspection';

interface UseAQLCalculationsProps {
    presentedQty: number;
    aqlStandard: 'strict' | 'standard';
    critical: number;
    major: number;
    minor: number;
    setValue: UseFormSetValue<FormData>;
}

export const useAQLCalculations = ({
    presentedQty,
    aqlStandard,
    critical,
    major,
    minor,
    setValue
}: UseAQLCalculationsProps) => {
    const [serverCalcs, setServerCalcs] = useState<ServerCalculations>({
        sampleSize: 0,
        maxCritical: 0,
        maxMajor: 0,
        maxMinor: 0,
        result: 'Pending'
    });

    const performCalculation = useCallback(async () => {
        if (!presentedQty) return;

        try {
            const response = await api.post(
                '/final-inspections/calculate_aql/',
                {
                    qty: presentedQty,
                    standard: aqlStandard,
                    critical: critical,
                    major: major,
                    minor: minor
                }
            );

            const data = response.data;

            setServerCalcs({
                sampleSize: data.sample_size,
                maxCritical: data.limits.critical,
                maxMajor: data.limits.major,
                maxMinor: data.limits.minor,
                result: data.result
            });

            setValue('sample_size', data.sample_size);
        } catch (error) {
            console.error("Calculation failed", error);
        }
    }, [presentedQty, aqlStandard, critical, major, minor, setValue]);

    useEffect(() => {
        const timer = setTimeout(() => {
            performCalculation();
        }, 500);
        return () => clearTimeout(timer);
    }, [performCalculation]);

    return { serverCalcs };
};
