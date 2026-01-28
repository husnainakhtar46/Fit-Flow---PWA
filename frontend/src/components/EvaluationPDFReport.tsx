import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 10,
        fontFamily: 'Helvetica',
        paddingTop: 30,
        paddingBottom: 30,
    },
    // Header
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Helvetica-Bold',
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusLabel: {
        fontSize: 14,
        fontFamily: 'Helvetica-Bold',
        color: '#000',
    },
    statusValue: {
        fontSize: 14,
        fontFamily: 'Helvetica-Bold',
        marginLeft: 5,
    },
    // General Info
    infoContainer: {
        flexDirection: 'row',
        marginBottom: 15,
        justifyContent: 'space-between',
    },
    infoColumn: {
        width: '48%',
        flexDirection: 'column',
    },
    infoRow: {
        flexDirection: 'row',
        marginBottom: 2,
    },
    infoLabel: {
        fontSize: 10,
        fontFamily: 'Helvetica',
        width: 80,
    },
    infoValue: {
        fontSize: 10,
        fontFamily: 'Helvetica',
        flex: 1,
    },
    // Tables
    table: {
        width: 'auto',
        borderStyle: 'solid',
        borderWidth: 0,
        borderBottomWidth: 1,
        borderBottomColor: '#000',
        marginBottom: 20,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 0,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#000',
    },
    tableColHeader: {
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
        padding: 3,
        textAlign: 'left',
    },
    tableCol: {
        fontSize: 8,
        padding: 3,
        textAlign: 'left',
    },
    // Specific Table Columns
    colPom: { width: '35%' },
    colTol: { width: '10%' },
    colStd: { width: '10%' },
    colSample: { width: '10%' },

    // Comments
    sectionTitle: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        marginTop: 10,
        marginBottom: 5,
    },
    commentBlock: {
        marginBottom: 5,
    },
    commentLabel: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 1,
    },
    qaComment: {
        fontSize: 9,
        fontFamily: 'Helvetica',
        color: '#000099', // Blue
        marginLeft: 15,
    },

    // Fabric & Accessories
    fabricRow: {
        flexDirection: 'row',
        marginBottom: 5,
        alignItems: 'center',
    },
    fabricItem: {
        flexDirection: 'row',
        marginRight: 40,
        alignItems: 'center',
    },

    // Accessories Table
    accTable: {
        marginTop: 5,
        borderWidth: 1,
        borderColor: '#000',
    },
    accHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#e0e0e0', // Light gray background
        borderBottomWidth: 1,
        borderBottomColor: '#000',
    },
    accRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#000',
    },
    accRowLast: {
        flexDirection: 'row',
        borderBottomWidth: 0,
    },
    accHeaderCell: {
        fontFamily: 'Helvetica-Bold',
        fontSize: 9,
        padding: 4,
        borderRightWidth: 1,
        borderRightColor: '#000',
    },
    accCell: {
        padding: 4,
        fontSize: 9,
        borderRightWidth: 1,
        borderRightColor: '#000',
    },
    accCellLast: {
        padding: 4,
        fontSize: 9,
        borderRightWidth: 0,
    },

    // Bottom Section
    customerAddressed: {
        flexDirection: 'row',
        marginTop: 10,
        marginBottom: 10,
        alignItems: 'center',
    },
    finalRemarksLabel: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        marginTop: 10,
    },
    finalRemarksText: {
        fontSize: 9,
        fontFamily: 'Helvetica',
        marginTop: 2,
    },

    // Utilities
    bold: { fontFamily: 'Helvetica-Bold' },
    red: { color: '#FF0000' },
    green: { color: '#008000' },
    orange: { color: '#FF8000' },
});

interface EvaluationPDFReportProps {
    data: any;
    images: any[];
}

const EvaluationPDFReport = ({ data, images }: EvaluationPDFReportProps) => {

    const getDecisionColor = (d: string) => {
        if (!d) return styles.statusValue; // Default black
        const lower = d.toLowerCase();
        if (lower === 'rejected') return styles.red;
        if (lower === 'accepted') return styles.green;
        if (lower === 'represent') return styles.orange;
        return styles.statusValue;
    };

    const isOutOfTolerance = (value: any, std: any, tol: any) => {
        if (value === null || value === '' || std === null || std === '') return false;
        const numVal = parseFloat(value);
        const numStd = parseFloat(std);
        const numTol = parseFloat(tol);
        if (isNaN(numVal) || isNaN(numStd) || isNaN(numTol)) return false;
        return Math.abs(numVal - numStd) > numTol;
    };

    // Determine max samples for table columns
    const maxSamples = Math.max(3, ...data.measurements?.map((m: any) => m.samples?.length || 0) || [3]);

    return (
        <Document>
            <Page size="LETTER" style={styles.page}>

                {/* Header */}
                <View style={styles.headerContainer}>
                    <Text style={styles.headerTitle}>SAMPLE EVALUATION REPORT</Text>
                    <View style={styles.statusContainer}>
                        <Text style={styles.statusLabel}>STATUS: </Text>
                        <Text style={[styles.statusValue, getDecisionColor(data.decision)]}>
                            {(data.decision || 'PENDING').toUpperCase()}
                        </Text>
                    </View>
                </View>

                {/* Info Block */}
                <View style={styles.infoContainer}>
                    <View style={styles.infoColumn}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Style:</Text>
                            <Text style={styles.infoValue}>{data.style}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Color:</Text>
                            <Text style={styles.infoValue}>{data.color}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>PO #:</Text>
                            <Text style={styles.infoValue}>{data.po_number}</Text>
                        </View>
                    </View>
                    <View style={styles.infoColumn}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Date:</Text>
                            <Text style={styles.infoValue}>{new Date(data.created_at || Date.now()).toISOString().split('T')[0]}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Stage:</Text>
                            <Text style={styles.infoValue}>{data.stage}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Customer:</Text>
                            <Text style={styles.infoValue}>{data.customer_name || 'N/A'}</Text>
                        </View>
                    </View>
                </View>

                {/* Measurement Table */}
                <View style={styles.table}>
                    <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableColHeader, styles.colPom]}>POM</Text>
                        <Text style={[styles.tableColHeader, styles.colTol]}>Tol</Text>
                        <Text style={[styles.tableColHeader, styles.colStd]}>Std</Text>
                        {Array.from({ length: maxSamples }, (_, i) => (
                            <Text key={i} style={[styles.tableColHeader, styles.colSample]}>S{i + 1}</Text>
                        ))}
                    </View>
                    {data.measurements?.map((m: any, i: number) => {
                        const samples = m.samples || [];
                        return (
                            <View key={i} style={styles.tableRow}>
                                <Text style={[styles.tableCol, styles.colPom]}>{m.pom_name}</Text>
                                <Text style={[styles.tableCol, styles.colTol]}>{m.tol}</Text>
                                <Text style={[styles.tableCol, styles.colStd]}>{m.std || '-'}</Text>
                                {Array.from({ length: maxSamples }, (_, idx) => {
                                    const sample = samples.find((s: any) => s.index === idx + 1);
                                    const val = sample?.value;
                                    return (
                                        <Text key={idx} style={[styles.tableCol, styles.colSample, isOutOfTolerance(val, m.std, m.tol) ? styles.red : {}]}>
                                            {val || '-'}
                                        </Text>
                                    );
                                })}
                            </View>
                        );
                    })}
                </View>

                {/* Fabric Check */}
                <Text style={styles.sectionTitle}>Fabric Check:</Text>
                <View style={styles.fabricRow}>
                    <View style={styles.fabricItem}>
                        <Text style={{ fontFamily: 'Helvetica', fontSize: 10 }}>Handfeel:  </Text>
                        <Text style={[{ fontSize: 10, fontFamily: 'Helvetica' }, (!data.fabric_handfeel || data.fabric_handfeel === 'OK') ? styles.green : styles.red]}>
                            {data.fabric_handfeel || 'OK'}
                        </Text>
                    </View>
                    <View style={styles.fabricItem}>
                        <Text style={{ fontFamily: 'Helvetica', fontSize: 10 }}>Pilling:  </Text>
                        <Text style={[{ fontSize: 10, fontFamily: 'Helvetica' }, data.fabric_pilling === 'High' ? styles.red : data.fabric_pilling === 'Low' ? styles.orange : styles.green]}>
                            {data.fabric_pilling || 'None'}
                        </Text>
                    </View>
                </View>

                {/* Accessories Checklist */}
                <Text style={styles.sectionTitle}>Accessories Checklist:</Text>
                {data.accessories_data && data.accessories_data.length > 0 ? (
                    <View style={styles.accTable}>
                        <View style={styles.accHeaderRow}>
                            <Text style={[styles.accHeaderCell, { width: '40%' }]}>Item</Text>
                            <Text style={[styles.accHeaderCell, { width: '60%', borderRightWidth: 0 }]}>Remarks</Text>
                        </View>
                        {data.accessories_data.map((item: any, i: number) => {
                            const isLast = i === data.accessories_data.length - 1;
                            return (
                                <View key={i} style={isLast ? styles.accRowLast : styles.accRow}>
                                    <Text style={[styles.accCell, { width: '40%' }]}>{item.name}</Text>
                                    <Text style={[styles.accCellLast, { width: '60%' }]}>{item.comment}</Text>
                                </View>
                            );
                        })}
                    </View>
                ) : (
                    <Text style={{ fontSize: 9, fontStyle: 'italic', color: '#555' }}>No accessories checked.</Text>
                )}

                {/* Customer Comments Addressed */}
                <View style={styles.customerAddressed}>
                    <Text style={styles.bold}>Customer Comments Addressed:  </Text>
                    <Text style={[styles.bold, { fontSize: 10 }, data.customer_comments_addressed ? styles.green : styles.orange]}>
                        {data.customer_comments_addressed ? 'YES' : 'NO'}
                    </Text>
                    {/* Visual square block style as seen in reference could be done with a View, 
                        but standard text is safer/cleaner. Reference has "NO" in orange block-like text.
                        The logic above colors the text itself.
                    */}
                </View>


                {/* Evaluation Comments (Customer -> QA) */}
                <Text style={styles.sectionTitle}>Evaluation Comments (Customer → QA):</Text>
                {[
                    { label: 'Fit', cust: data.customer_fit_comments, qa: data.qa_fit_comments },
                    { label: 'Workmanship', cust: data.customer_workmanship_comments, qa: data.qa_workmanship_comments },
                    { label: 'Wash', cust: data.customer_wash_comments, qa: data.qa_wash_comments },
                    { label: 'Fabric', cust: data.customer_fabric_comments, qa: data.qa_fabric_comments },
                    { label: 'Accessories', cust: data.customer_accessories_comments, qa: data.qa_accessories_comments },
                ].map((item, idx) => (
                    <View key={idx} style={styles.commentBlock}>
                        <Text style={styles.commentLabel}>{item.label}:</Text>
                        {/* Only show QA comment as per reference image ("QA: OK"), 
                             but if there WAS a customer comment, usually it's shown too. 
                             Reference image only shows "QA: OK" in blue. 
                             If we assume this replaces the old logic, we'll focus on the QA part being prominent.
                        */}
                        <Text style={styles.qaComment}>QA: {item.qa || 'OK'}</Text>
                    </View>
                ))}

                {/* Footers */}
                <View>
                    <Text style={styles.finalRemarksLabel}>Customer Feedback Summary:</Text>
                    <Text style={styles.finalRemarksText}>{data.customer_remarks || 'NA'}</Text>
                </View>

                <View>
                    <Text style={styles.finalRemarksLabel}>Final Remarks:</Text>
                    <Text style={styles.finalRemarksText}>{data.remarks || 'OK to send'}</Text>
                </View>

            </Page>

            {/* Page 2: Images (if any) */}
            {images && images.filter(img => img.file).length > 0 && (
                <Page size="LETTER" style={styles.page}>
                    <Text style={[styles.sectionTitle, { marginTop: 0 }]}>INSPECTION IMAGES</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                        {images.filter(img => img.file).map((img, i) => (
                            <View key={i} style={{ width: '45%', marginBottom: 20 }}>
                                <Image
                                    src={img.file}
                                    style={{ width: '100%', height: 200, objectFit: 'contain', backgroundColor: '#f0f0f0' }}
                                />
                                <Text style={{ fontSize: 9, marginTop: 5, textAlign: 'center' }}>
                                    {img.caption || `Image ${i + 1}`}
                                </Text>
                            </View>
                        ))}
                    </View>
                </Page>
            )}
        </Document>
    );
};

export default EvaluationPDFReport;
