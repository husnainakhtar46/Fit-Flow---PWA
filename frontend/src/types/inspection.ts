export interface FinalInspectionFormProps {
    inspectionId?: string;
    onClose: () => void;
}

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

export interface MeasurementSample {
    index: number;
    value: number | string | null;
}

export interface MeasurementInput {
    pom_name: string;
    spec: number;
    tol: number;
    samples: MeasurementSample[];
    size_name: string;
    size_field_id?: string;
}

export interface FormData {
    customer: string;
    factory: string;
    template: string; // Added template selection
    inspection_date: string;
    order_no: string;
    style_no: string;
    color: string;
    inspection_attempt: '1st' | '2nd' | '3rd';
    aql_standard: 'strict' | 'standard';
    total_order_qty: number;
    presented_qty: number;
    sample_size: number;
    total_cartons: number;
    selected_cartons: number;
    carton_length: number;
    carton_width: number;
    carton_height: number;
    gross_weight: number;
    net_weight: number;
    remarks: string;
    size_checks: SizeCheck[]; // For Quantity Breakdown
    measurements: MeasurementInput[]; // For Garment Dimensions
}

export const INITIAL_FORM_STATE: FormData = {
    customer: '',
    factory: '',
    template: '',
    order_no: '',
    style_no: '',
    color: '',
    remarks: '',
    inspection_date: new Date().toISOString().split('T')[0],
    inspection_attempt: '1st',
    aql_standard: 'standard',
    sample_size: 0,
    total_order_qty: 0,
    presented_qty: 0,
    total_cartons: 0,
    selected_cartons: 0,
    carton_length: 0,
    carton_width: 0,
    carton_height: 0,
    gross_weight: 0,
    net_weight: 0,
    size_checks: [{ size: '', order_qty: 0, packed_qty: 0 }],
    measurements: [],
};
