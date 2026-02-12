import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Create styles
const styles = StyleSheet.create({
    page: {
        padding: 30,
        fontSize: 10,
        fontFamily: 'Helvetica',
    },
    header: {
        fontSize: 18,
        marginBottom: 20,
        textAlign: 'center',
        fontWeight: 'bold',
        textDecoration: 'underline',
    },
    section: {
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        padding: 5,
        marginBottom: 10,
        textDecoration: 'underline',
    },
    table: {
        display: 'flex',
        width: 'auto',
        borderStyle: 'solid',
        borderWidth: 1,
        borderRightWidth: 0,
        borderBottomWidth: 0,
    },
    tableRow: {
        margin: 'auto',
        flexDirection: 'row',
    },
    tableColHeader: {
        width: '12.5%',
        borderStyle: 'solid',
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        backgroundColor: '#e4e4e4',
        padding: 5,
        fontWeight: 'bold',
        fontSize: 9,
    },
    tableCol: {
        width: '12.5%',
        borderStyle: 'solid',
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        padding: 5,
        fontSize: 9,
    },
    tableColWide: {
        width: '25%',
        borderStyle: 'solid',
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        padding: 5,
    },
    oot: {
        color: 'red',
        fontWeight: 'bold',
    },
    photoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    photoItem: {
        width: '45%',
        marginBottom: 15,
    },
    image: {
        width: '100%',
        height: 150,
        objectFit: 'contain',
    },
    caption: {
        marginTop: 5,
        textAlign: 'center',
        fontSize: 8,
    },
    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    summaryItem: {
        width: '33%',
        marginBottom: 5,
    },
    bold: {
        fontWeight: 'bold',
    },
    pass: {
        color: 'green',
        fontWeight: 'bold',
    },
    fail: {
        color: 'red',
        fontWeight: 'bold',
    }
});

interface PDFReportProps {
    data: any;
    defects: any[];
    images: any[];
}

const PDFReport = ({ data, defects, images }: PDFReportProps) => {
    const isOutOfTolerance = (value: string, spec: number, tol: number) => {
        if (!value || value === '') return false;
        const numVal = parseFloat(value);
        if (isNaN(numVal)) return false;
        return Math.abs(numVal - spec) > tol;
    };

    // Determine AQL labels based on standard (assuming 'standard' or 'strict')


    return (
        <Document>
            {/* Page 1: Summary */}
            <Page size="A4" style={styles.page}>
                <Text style={styles.header}>FINAL INSPECTION REPORT</Text>

                {/* Result Badge (approximated text) */}
                <Text style={{ textAlign: 'right', fontSize: 14, fontWeight: 'bold', marginBottom: 10 }}>
                    RESULT: <Text style={data.result === 'Pass' ? styles.pass : styles.fail}>{data.result?.toUpperCase() || 'PENDING'}</Text>
                </Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>1. General Information</Text>
                    <View style={styles.table}>
                        <View style={styles.tableRow}>
                            <View style={[styles.tableColHeader, { width: '16%' }]}><Text>Customer:</Text></View>
                            <View style={[styles.tableCol, { width: '36%' }]}><Text>{data.customer_name || 'N/A'}</Text></View>
                            <View style={[styles.tableColHeader, { width: '18%' }]}><Text>Inspection Date:</Text></View>
                            <View style={[styles.tableCol, { width: '30%' }]}><Text>{data.inspection_date}</Text></View>
                        </View>
                        <View style={styles.tableRow}>
                            <View style={[styles.tableColHeader, { width: '16%' }]}><Text>AQL Standard:</Text></View>
                            <View style={[styles.tableCol, { width: '36%' }]}><Text>{data.aql_standard}</Text></View>
                            <View style={[styles.tableColHeader, { width: '18%' }]}><Text>Order No:</Text></View>
                            <View style={[styles.tableCol, { width: '30%' }]}><Text>{data.order_no}</Text></View>
                        </View>
                        <View style={styles.tableRow}>
                            <View style={[styles.tableColHeader, { width: '16%' }]}><Text>Factory:</Text></View>
                            <View style={[styles.tableCol, { width: '36%' }]}><Text>{data.factory || 'N/A'}</Text></View>
                            <View style={[styles.tableColHeader, { width: '18%' }]}><Text>Style No:</Text></View>
                            <View style={[styles.tableCol, { width: '30%' }]}><Text>{data.style_no}</Text></View>
                        </View>
                        <View style={styles.tableRow}>
                            <View style={[styles.tableColHeader, { width: '16%' }]}><Text>Color:</Text></View>
                            <View style={[styles.tableCol, { width: '36%' }]}><Text>{data.color}</Text></View>
                            <View style={[styles.tableColHeader, { width: '18%' }]}><Text>Inspection Attempt:</Text></View>
                            <View style={[styles.tableCol, { width: '30%' }]}><Text>{data.inspection_attempt}</Text></View>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>2. AQL Result Summary</Text>
                    <View style={styles.table}>
                        <View style={styles.table}>
                            <View style={styles.tableRow}>
                                <View style={[styles.tableColHeader, { width: '40%' }]}><Text>Defect Type</Text></View>
                                <View style={[styles.tableColHeader, { width: '20%' }]}><Text>Allowed</Text></View>
                                <View style={[styles.tableColHeader, { width: '20%' }]}><Text>Found</Text></View>
                                <View style={[styles.tableColHeader, { width: '20%' }]}><Text>Status</Text></View>
                            </View>
                            <View style={styles.tableRow}>
                                <View style={[styles.tableCol, { width: '40%' }]}><Text>Critical</Text></View>
                                <View style={[styles.tableCol, { width: '20%' }]}><Text>{data.max_allowed_critical || 0}</Text></View>
                                <View style={[styles.tableCol, { width: '20%' }]}><Text>{data.critical_found || 0}</Text></View>
                                <View style={[styles.tableCol, { width: '20%' }]}><Text>{(data.critical_found || 0) <= (data.max_allowed_critical || 0) ? 'Pass' : 'Fail'}</Text></View>
                            </View>
                            <View style={styles.tableRow}>
                                <View style={[styles.tableCol, { width: '40%' }]}><Text>Major</Text></View>
                                <View style={[styles.tableCol, { width: '20%' }]}><Text>{data.max_allowed_major || 0}</Text></View>
                                <View style={[styles.tableCol, { width: '20%' }]}><Text>{data.major_found || 0}</Text></View>
                                <View style={[styles.tableCol, { width: '20%' }]}><Text>{(data.major_found || 0) <= (data.max_allowed_major || 0) ? 'Pass' : 'Fail'}</Text></View>
                            </View>
                            <View style={styles.tableRow}>
                                <View style={[styles.tableCol, { width: '40%' }]}><Text>Minor</Text></View>
                                <View style={[styles.tableCol, { width: '20%' }]}><Text>{data.max_allowed_minor || 0}</Text></View>
                                <View style={[styles.tableCol, { width: '20%' }]}><Text>{data.minor_found || 0}</Text></View>
                                <View style={[styles.tableCol, { width: '20%' }]}><Text>{(data.minor_found || 0) <= (data.max_allowed_minor || 0) ? 'Pass' : 'Fail'}</Text></View>
                            </View>
                        </View>
                    </View>
                </View>
            </Page>

            {/* Page 2: Measurements */}
            <Page size="A4" style={styles.page}>
                <Text style={styles.sectionTitle}>3. Measurement Report</Text>
                <View style={styles.table}>
                    <View style={styles.tableRow}>
                        <View style={[styles.tableColWide, { backgroundColor: '#e4e4e4', width: '20%' }]}><Text>POM</Text></View>
                        <View style={[styles.tableColHeader, { width: '10%' }]}><Text>Spec</Text></View>
                        <View style={[styles.tableColHeader, { width: '10%' }]}><Text>Tol</Text></View>
                        {Array.from({ length: Math.max(1, ...data.measurements?.map((m: any) => m.samples?.length || 0) || [1]) }, (_, i) => (
                            <View key={i} style={[styles.tableColHeader, { width: `${60 / (Math.max(1, ...data.measurements?.map((m: any) => m.samples?.length || 0) || [1]))}%` }]}><Text>S{i + 1}</Text></View>
                        ))}
                    </View>
                    {data.measurements?.map((m: any, i: number) => {
                        const maxSamples = Math.max(1, ...data.measurements?.map((meas: any) => meas.samples?.length || 0) || [1]);
                        const samples = m.samples || [];
                        const sampleWidth = `${60 / maxSamples}%`;

                        return (
                            <View key={i} style={styles.tableRow}>
                                <View style={[styles.tableColWide, { width: '20%' }]}><Text>{m.pom_name}</Text></View>
                                <View style={[styles.tableCol, { width: '10%' }]}><Text>{m.spec}</Text></View>
                                <View style={[styles.tableCol, { width: '10%' }]}><Text>{m.tol}</Text></View>
                                {Array.from({ length: maxSamples }, (_, idx) => {
                                    const sample = samples.find((s: any) => s.index === idx + 1);
                                    const val = sample?.value;
                                    return (
                                        <View key={idx} style={[styles.tableCol, { width: sampleWidth }]}>
                                            <Text style={isOutOfTolerance(val, m.spec, m.tol) ? styles.oot : {}}>
                                                {val || '-'}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        );
                    })}
                </View>
            </Page>

            {/* Page 3: Defects */}
            <Page size="A4" style={styles.page}>
                <Text style={styles.sectionTitle}>4. Defect Findings</Text>
                <View style={styles.table}>
                    <View style={styles.tableRow}>
                        <View style={[styles.tableColWide, { backgroundColor: '#e4e4e4', width: '60%' }]}><Text>Description</Text></View>
                        <View style={[styles.tableColHeader, { width: '20%' }]}><Text>Severity</Text></View>
                        <View style={[styles.tableColHeader, { width: '20%' }]}><Text>Count</Text></View>
                    </View>
                    {defects.map((d, i) => (
                        <View key={i} style={styles.tableRow}>
                            <View style={[styles.tableCol, { width: '60%' }]}><Text>{d.description}</Text></View>
                            <View style={[styles.tableCol, { width: '20%' }]}><Text>{d.severity}</Text></View>
                            <View style={[styles.tableCol, { width: '20%' }]}><Text>{d.count}</Text></View>
                        </View>
                    ))}
                </View>
            </Page>

            {/* Page 4: Photos */}
            <Page size="A4" style={styles.page}>
                <Text style={styles.sectionTitle}>5. Inspection Photos</Text>
                {images && images.length > 0 ? (
                    <View>
                        <Text style={{ marginBottom: 10 }}>Total Photos Attached: {images.length}</Text>
                        {images.map((img, i) => (
                            <View key={i} style={{ marginBottom: 5, padding: 5, backgroundColor: '#f5f5f5' }}>
                                <Text>📷 Photo {i + 1}: {img.caption || 'No caption'} ({img.category || 'General'})</Text>
                            </View>
                        ))}
                        <Text style={{ marginTop: 10, fontSize: 8, color: '#666' }}>
                            Note: Photos are saved locally and will be uploaded during sync.
                        </Text>
                    </View>
                ) : (
                    <Text>No photos attached.</Text>
                )}
            </Page>
        </Document>
    );
};

export default PDFReport;
