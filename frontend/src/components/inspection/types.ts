/**
 * Shared types for Final Inspection form components.
 */

export interface Customer {
    id: string;
    name: string;
}

export interface TemplatePOM {
    id: string;
    name: string;
    default_tol: number;
    default_std: number;
}

export interface Template {
    customer: string;
    id: string;
    name: string;
    poms: TemplatePOM[];
}

export interface SizeCheck {
    size: string;
    order_qty: number;
    packed_qty: number;
}

export interface MeasurementInput {
    pom_name: string;
    spec: number;
    tol: number;
    s1: string;
    s2: string;
    s3: string;
    s4: string;
    s5: string;
    s6: string;
    size_name: string;
    size_field_id?: string;
}

export interface DefectCounts {
    [defect: string]: {
        critical: number;
        major: number;
        minor: number;
    };
}

export interface UploadedImage {
    file: File;
    caption: string;
    category: string;
    previewUrl?: string;
    id?: string;
    isExisting?: boolean;
    url?: string;
}

export interface ServerCalculations {
    sampleSize: number;
    maxCritical: number;
    maxMajor: number;
    maxMinor: number;
    result: string;
}
