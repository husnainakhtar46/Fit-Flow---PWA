import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

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
        backgroundColor: '#f0f0f0',
        padding: 5,
        marginBottom: 10,
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
    },
    tableCol: {
        width: '12.5%',
        borderStyle: 'solid',
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        padding: 5,
    },
    tableColWide: {
        width: '25%',
        borderStyle: 'solid',
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        padding: 5,
    },
    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    summaryItem: {
        width: '50%',
        marginBottom: 5,
    },
    bold: {
        fontWeight: 'bold',
    },
    oot: {
        color: 'red',
        fontWeight: 'bold',
    },
    commentBox: {
        marginBottom: 10,
        padding: 8,
        backgroundColor: '#f9f9f9',
        borderRadius: 3,
    }
});

interface EvaluationPDFReportProps {
    data: any;
    images: any[];
}

const EvaluationPDFReport = ({ data, images }: EvaluationPDFReportProps) => {
    const isOutOfTolerance = (value: any, std: any, tol: any) => {
        if (!value || value === '' || !std || std === '') return false;
        const numVal = parseFloat(value);
        const numStd = parseFloat(std);
        const numTol = parseFloat(tol);
        if (isNaN(numVal) || isNaN(numStd) || isNaN(numTol)) return false;
        return Math.abs(numVal - numStd) > numTol;
    };

    return (
        <Document>
            {/* Page 1: General Info */}
            <Page size="A4" style={styles.page}>
                <Text style={styles.header}>Sample Evaluation Report</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>General Information</Text>
                    <View style={styles.summaryGrid}>
                        <View style={styles.summaryItem}><Text><Text style={styles.bold}>Style:</Text> {data.style || 'N/A'}</Text></View>
                        <View style={styles.summaryItem}><Text><Text style={styles.bold}>Color:</Text> {data.color || 'N/A'}</Text></View>
                        <View style={styles.summaryItem}><Text><Text style={styles.bold}>PO Number:</Text> {data.po_number || 'N/A'}</Text></View>
                        <View style={styles.summaryItem}><Text><Text style={styles.bold}>Stage:</Text> {data.stage || 'N/A'}</Text></View>
                        <View style={styles.summaryItem}><Text><Text style={styles.bold}>Decision:</Text> {data.decision || 'Pending'}</Text></View>
                        <View style={styles.summaryItem}><Text><Text style={styles.bold}>Customer:</Text> {data.customer_name || 'N/A'}</Text></View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>QA Comments</Text>
                    {data.qa_fit_comments && (
                        <View style={styles.commentBox}>
                            <Text style={styles.bold}>Fit:</Text>
                            <Text>{data.qa_fit_comments}</Text>
                        </View>
                    )}
                    {data.qa_workmanship_comments && (
                        <View style={styles.commentBox}>
                            <Text style={styles.bold}>Workmanship:</Text>
                            <Text>{data.qa_workmanship_comments}</Text>
                        </View>
                    )}
                    {data.qa_wash_comments && (
                        <View style={styles.commentBox}>
                            <Text style={styles.bold}>Wash:</Text>
                            <Text>{data.qa_wash_comments}</Text>
                        </View>
                    )}
                    {data.qa_fabric_comments && (
                        <View style={styles.commentBox}>
                            <Text style={styles.bold}>Fabric:</Text>
                            <Text>{data.qa_fabric_comments}</Text>
                        </View>
                    )}
                    {data.remarks && (
                        <View style={styles.commentBox}>
                            <Text style={styles.bold}>General Remarks:</Text>
                            <Text>{data.remarks}</Text>
                        </View>
                    )}
                </View>

                {/* Accessories Section */}
                {data.accessories_data && data.accessories_data.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Accessories Checklist</Text>
                        <View style={styles.table}>
                            <View style={styles.tableRow}>
                                <View style={[styles.tableColWide, { backgroundColor: '#e4e4e4' }]}><Text>Item</Text></View>
                                <View style={[styles.tableCol, { width: '20%', backgroundColor: '#e4e4e4' }]}><Text>Status</Text></View>
                                <View style={[styles.tableCol, { width: '55%', backgroundColor: '#e4e4e4', borderRightWidth: 1 }]}><Text>Comment</Text></View>
                            </View>
                            {data.accessories_data.map((item: any, i: number) => (
                                <View key={i} style={styles.tableRow}>
                                    <View style={styles.tableColWide}><Text>{item.name}</Text></View>
                                    <View style={[styles.tableCol, { width: '20%' }]}>
                                        <Text style={{ color: item.status === 'Not OK' ? 'red' : item.status === 'OK' ? 'green' : 'black' }}>
                                            {item.status}
                                        </Text>
                                    </View>
                                    <View style={[styles.tableCol, { width: '55%', borderRightWidth: 1 }]}><Text>{item.comment}</Text></View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </Page>

            {/* Page 2: Measurements */}
            <Page size="A4" style={styles.page}>
                <Text style={styles.sectionTitle}>Measurements</Text>
                <View style={styles.table}>
                    <View style={styles.tableRow}>
                        <View style={[styles.tableColWide, { backgroundColor: '#e4e4e4' }]}><Text>POM</Text></View>
                        <View style={styles.tableColHeader}><Text>Tol</Text></View>
                        <View style={styles.tableColHeader}><Text>Std</Text></View>
                        <View style={styles.tableColHeader}><Text>S1</Text></View>
                        <View style={styles.tableColHeader}><Text>S2</Text></View>
                        <View style={styles.tableColHeader}><Text>S3</Text></View>
                        <View style={styles.tableColHeader}><Text>S4</Text></View>
                    </View>
                    {data.measurements?.map((m: any, i: number) => (
                        <View key={i} style={styles.tableRow}>
                            <View style={styles.tableColWide}><Text>{m.pom_name}</Text></View>
                            <View style={styles.tableCol}><Text>{m.tol}</Text></View>
                            <View style={styles.tableCol}><Text>{m.std}</Text></View>
                            {['s1', 's2', 's3', 's4'].map((s) => (
                                <View key={s} style={styles.tableCol}>
                                    <Text style={isOutOfTolerance(m[s], m.std, m.tol) ? styles.oot : {}}>
                                        {m[s]}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    ))}
                </View>
            </Page>

            {/* Page 3: Photos */}
            <Page size="A4" style={styles.page}>
                <Text style={styles.sectionTitle}>Attached Photos</Text>
                {images && images.filter(img => img.file).length > 0 ? (
                    <View>
                        <Text style={{ marginBottom: 10 }}>Total Photos: {images.filter(img => img.file).length}</Text>
                        {images.filter(img => img.file).map((img, i) => (
                            <View key={i} style={{ marginBottom: 5, padding: 5, backgroundColor: '#f5f5f5' }}>
                                <Text>📷 Photo {i + 1}: {img.caption || 'No caption'}</Text>
                            </View>
                        ))}
                        <Text style={{ marginTop: 10, fontSize: 8, color: '#666' }}>
                            Note: Photos saved locally will be uploaded during sync.
                        </Text>
                    </View>
                ) : (
                    <Text>No photos attached.</Text>
                )}
            </Page>
        </Document>
    );
};

export default EvaluationPDFReport;
