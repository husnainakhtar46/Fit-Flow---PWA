import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        padding: 50,
        fontSize: 10,
        fontFamily: 'Helvetica',
    },
    // Header
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 5,
    },
    statusBadge: {
        fontSize: 14,
        fontFamily: 'Helvetica-Bold',
        textAlign: 'right',
        position: 'absolute',
        top: 0,
        right: 0,
    },
    // General Info
    infoContainer: {
        flexDirection: 'row',
        marginTop: 20,
        marginBottom: 20,
    },
    infoColumn: {
        width: '50%',
        flexDirection: 'column',
        gap: 5,
    },
    infoText: {
        fontSize: 12,
        fontFamily: 'Helvetica',
    },
    // Tables
    table: {
        width: 'auto',
        borderStyle: 'solid',
        borderWidth: 1,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        marginBottom: 20,
    },
    tableRow: {
        margin: 'auto',
        flexDirection: 'row',
    },
    tableColHeader: {
        width: '11.1%', // 9 columns roughly equal
        borderStyle: 'solid',
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        padding: 4,
        fontFamily: 'Helvetica-Bold',
        fontSize: 8,
    },
    tableCol: {
        width: '11.1%',
        borderStyle: 'solid',
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        padding: 4,
        fontSize: 8,
    },
    // Specific Table Columns
    colPom: { width: '30%' },
    colStd: { width: '8.75%' },

    // Comments
    sectionTitle: {
        fontSize: 12,
        fontFamily: 'Helvetica-Bold',
        marginTop: 15,
        marginBottom: 8,
    },
    commentBlock: {
        marginBottom: 10,
    },
    commentLabel: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 2,
    },
    custComment: {
        fontSize: 9,
        fontFamily: 'Helvetica-Oblique',
        color: '#996600', // Brown
        marginLeft: 10,
        marginBottom: 2,
    },
    qaComment: {
        fontSize: 9,
        fontFamily: 'Helvetica',
        color: '#000099', // Blue
        marginLeft: 10,
    },
    // Fabric & Accessories
    checkRow: {
        flexDirection: 'row',
        marginBottom: 5,
    },
    checkLabel: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        width: 80,
    },

    // Accessories Table
    accTable: {
        marginTop: 5,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderColor: '#000',
    },
    accHeader: {
        backgroundColor: '#e4e4e4',
        fontFamily: 'Helvetica-Bold',
        fontSize: 9,
        padding: 4,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#000',
    },
    accRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderColor: '#000',
    },
    accCell: {
        padding: 4,
        fontSize: 9,
        borderRightWidth: 1,
        borderColor: '#000',
    },

    // Utilities
    bold: { fontFamily: 'Helvetica-Bold' },
    red: { color: '#FF0000' },
    green: { color: '#008000' },
    orange: { color: '#FF8000' },
    gray: { color: '#555' },
});

interface EvaluationPDFReportProps {
    data: any;
    images: any[];
}

const EvaluationPDFReport = ({ data, images }: EvaluationPDFReportProps) => {

    // Helper to get status color
    const getDecisionColor = (d: string) => {
        if (d === 'Rejected') return styles.red;
        if (d === 'Accepted') return styles.green;
        if (d === 'Represent') return styles.orange;
        return { color: '#000' };
    };

    const isOutOfTolerance = (value: any, std: any, tol: any) => {
        if (value === null || value === '' || std === null || std === '') return false;
        const numVal = parseFloat(value);
        const numStd = parseFloat(std);
        const numTol = parseFloat(tol);
        if (isNaN(numVal) || isNaN(numStd) || isNaN(numTol)) return false;
        return Math.abs(numVal - numStd) > numTol;
    };

    return (
        <Document>
            <Page size="LETTER" style={styles.page}>

                {/* Header */}
                <View>
                    <Text style={styles.headerTitle}>SAMPLE EVALUATION REPORT</Text>
                    <Text style={[styles.statusBadge, getDecisionColor(data.decision)]}>
                        STATUS: {(data.decision || 'PENDING').toUpperCase()}
                    </Text>
                </View>

                {/* Info Block */}
                <View style={styles.infoContainer}>
                    <View style={styles.infoColumn}>
                        <Text style={styles.infoText}>Style: {data.style}</Text>
                        <Text style={styles.infoText}>Color: {data.color}</Text>
                        <Text style={styles.infoText}>PO #: {data.po_number}</Text>
                    </View>
                    <View style={styles.infoColumn}>
                        <Text style={styles.infoText}>Date: {new Date(data.created_at || Date.now()).toLocaleDateString()}</Text>
                        <Text style={styles.infoText}>Stage: {data.stage}</Text>
                        <Text style={styles.infoText}>Customer: {data.customer_name || 'N/A'}</Text>
                    </View>
                </View>

                {/* Measurement Table */}
                <View style={styles.table}>
                    <View style={styles.tableRow}>
                        <Text style={[styles.tableColHeader, styles.colPom]}>POM</Text>
                        <Text style={[styles.tableColHeader, styles.colStd]}>Tol</Text>
                        <Text style={[styles.tableColHeader, styles.colStd]}>Std</Text>
                        {Array.from({ length: Math.max(3, ...data.measurements?.map((m: any) => m.samples?.length || 0) || [3]) }, (_, i) => (
                            <Text key={i} style={[styles.tableColHeader, styles.colStd]}>S{i + 1}</Text>
                        ))}
                    </View>
                    {data.measurements?.map((m: any, i: number) => {
                        const maxSamples = Math.max(3, ...data.measurements?.map((meas: any) => meas.samples?.length || 0) || [3]);
                        const samples = m.samples || [];
                        return (
                            <View key={i} style={styles.tableRow}>
                                <Text style={[styles.tableCol, styles.colPom]}>{m.pom_name}</Text>
                                <Text style={[styles.tableCol, styles.colStd]}>{m.tol}</Text>
                                <Text style={[styles.tableCol, styles.colStd]}>{m.std || '-'}</Text>
                                {Array.from({ length: maxSamples }, (_, idx) => {
                                    const sample = samples.find((s: any) => s.index === idx + 1);
                                    const val = sample?.value;
                                    return (
                                        <Text key={idx} style={[styles.tableCol, styles.colStd, isOutOfTolerance(val, m.std, m.tol) ? styles.red : {}]}>
                                            {val || '-'}
                                        </Text>
                                    );
                                })}
                            </View>
                        );
                    })}
                </View>

                {/* Evaluation Comments (Comparison) */}
                <Text style={styles.sectionTitle}>Evaluation Comments (Customer → QA):</Text>
                {[
                    { label: 'Fit', cust: data.customer_fit_comments, qa: data.qa_fit_comments },
                    { label: 'Workmanship', cust: data.customer_workmanship_comments, qa: data.qa_workmanship_comments },
                    { label: 'Wash', cust: data.customer_wash_comments, qa: data.qa_wash_comments },
                    { label: 'Fabric', cust: data.customer_fabric_comments, qa: data.qa_fabric_comments },
                    { label: 'Accessories', cust: data.customer_accessories_comments, qa: data.qa_accessories_comments },
                ].map((item, idx) => {
                    if (!item.cust && !item.qa) return null;
                    return (
                        <View key={idx} style={styles.commentBlock}>
                            <Text style={styles.commentLabel}>{item.label}:</Text>
                            {item.cust && <Text style={styles.custComment}>Customer: {item.cust}</Text>}
                            {item.qa && <Text style={styles.qaComment}>QA: {item.qa}</Text>}
                        </View>
                    );
                })}

                {/* Legacy / General Remarks */}
                {data.customer_remarks && (
                    <View style={styles.commentBlock}>
                        <Text style={styles.commentLabel}>Customer Feedback Summary:</Text>
                        <Text style={{ fontSize: 9, marginLeft: 10 }}>{data.customer_remarks}</Text>
                    </View>
                )}
                {data.remarks && (
                    <View style={styles.commentBlock}>
                        <Text style={styles.commentLabel}>Final Remarks:</Text>
                        <Text style={{ fontSize: 9, marginLeft: 10 }}>{data.remarks}</Text>
                    </View>
                )}

            </Page>

            {/* Page 2: Fabric, Accessories, Images */}
            <Page size="LETTER" style={styles.page}>

                {/* Fabric Check */}
                <Text style={styles.sectionTitle}>Fabric Check:</Text>
                <View style={styles.checkRow}>
                    <Text style={styles.checkLabel}>Handfeel:</Text>
                    <Text style={(!data.fabric_handfeel || data.fabric_handfeel === 'OK') ? styles.green : styles.red}>
                        {data.fabric_handfeel || 'OK'}
                    </Text>
                </View>
                <View style={styles.checkRow}>
                    <Text style={styles.checkLabel}>Pilling:</Text>
                    <Text style={
                        data.fabric_pilling === 'High' ? styles.red :
                            data.fabric_pilling === 'Low' ? styles.orange : styles.green
                    }>
                        {data.fabric_pilling || 'None'}
                    </Text>
                </View>

                {data.accessories_data && data.accessories_data.length > 0 && (
                    <View>
                        <Text style={styles.sectionTitle}>Accessories Checklist:</Text>
                        <View style={styles.accTable}>
                            <View style={styles.accRow}>
                                <Text style={[styles.accHeader, { width: '50%' }]}>Item</Text>
                                <Text style={[styles.accHeader, { width: '50%' }]}>Remarks</Text>
                            </View>
                            {data.accessories_data.map((item: any, i: number) => (
                                <View key={i} style={styles.accRow}>
                                    <Text style={[styles.accCell, { width: '50%' }]}>{item.name}</Text>
                                    <Text style={[styles.accCell, { width: '50%' }]}>{item.comment}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Customer Comments Addressed */}
                <View style={{ marginTop: 20, flexDirection: 'row' }}>
                    <Text style={styles.bold}>Customer Comments Addressed: </Text>
                    {data.customer_comments_addressed ?
                        <Text style={[styles.green, styles.bold, { marginLeft: 10 }]}>✓ YES</Text> :
                        <Text style={[styles.orange, styles.bold, { marginLeft: 10 }]}>○ NO</Text>
                    }
                </View>

                {/* Images */}
                <Text style={[styles.sectionTitle, { marginTop: 30 }]}>INSPECTION IMAGES</Text>
                {images && images.filter(img => img.file).length > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                        {images.filter(img => img.file).map((img, i) => (
                            <View key={i} style={{ width: '45%', marginBottom: 20 }}>
                                <Image
                                    src={img.file}
                                    style={{ width: '100%', height: 150, objectFit: 'contain', backgroundColor: '#f0f0f0' }}
                                />
                                <Text style={{ fontSize: 8, marginTop: 5, textAlign: 'center' }}>
                                    {img.caption || `Image ${i + 1}`}
                                </Text>
                            </View>
                        ))}
                    </View>
                ) : (
                    <Text>No photos attached.</Text>
                )}
            </Page>
        </Document>
    );
};

export default EvaluationPDFReport;
