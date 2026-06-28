import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const S = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    color: '#1a1a1a',
    fontFamily: 'Helvetica',
  },

  // HEADER
  header: {
    alignItems: 'center',
    borderBottom: '2px solid #334155',
    paddingBottom: 10,
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2,
    marginBottom: 3,
  },
  headerCompany: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    marginBottom: 2,
  },
  headerPeriode: {
    fontSize: 9,
    color: '#64748b',
  },

  // INFO KARYAWAN
  infoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 5,
    alignItems: 'flex-start',
  },
  infoLabel: {
    width: 85,
    color: '#64748b',
  },
  infoLabelWide: {
    width: 95,
    color: '#64748b',
  },
  infoColon: {
    width: 10,
    color: '#64748b',
  },
  infoValue: {
    fontFamily: 'Helvetica-Bold',
  },

  // TABEL
  tableTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottom: '1px solid #e2e8f0',
  },
  tableWrapper: {
    borderTop: '1px solid #cbd5e1',
    borderLeft: '1px solid #cbd5e1',
    marginBottom: 16,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
  },
  tableRow: {
    flexDirection: 'row',
  },

  // Lebar kolom tabel
  colDate: { width: '22%' },
  colDesc: { width: '38%' },
  colIn: { width: '20%' },
  colOut: { width: '20%' },

  th: {
    padding: '5px 4px',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    borderRight: '1px solid #cbd5e1',
    borderBottom: '1px solid #cbd5e1',
  },
  thLast: {
    padding: '5px 4px',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    borderBottom: '1px solid #cbd5e1',
  },
  td: {
    padding: '4px 4px',
    fontSize: 8,
    borderRight: '1px solid #cbd5e1',
    borderBottom: '1px solid #cbd5e1',
  },
  tdLast: {
    padding: '4px 4px',
    fontSize: 8,
    borderBottom: '1px solid #cbd5e1',
  },
  emptyCell: {
    borderRight: '1px solid #cbd5e1',
    borderBottom: '1px solid #cbd5e1',
  },
  emptyCellLast: {
    borderBottom: '1px solid #cbd5e1',
  },

  // RINGKASAN
  summaryWrapper: {
    alignItems: 'flex-end',
    marginBottom: 28,
    marginTop: 4,
  },
  summaryBox: {
    width: '50%',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottom: '1px solid #e2e8f0',
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginTop: 2,
    borderTop: '2px solid #1e293b',
  },

  // TANDA TANGAN
  signatureSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
  },
  signatureBox: {
    width: '33%',
    alignItems: 'center',
  },
  signatureSpacer: { height: 52 },
  signatureLine: {
    borderBottom: '1px solid #000',
    width: '90%',
    marginBottom: 3,
  },
  signatureName: {
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    fontSize: 9,
  },
});

const PayslipPDFDocument = ({ data, monthLabel, formatRupiah }) => {
  const basicPay = data.totalHours * data.employee.hourlyRate;
  const overtimePay = data.overtimePay || 0;
  const sortedRecords = [...data.records].sort((a, b) => new Date(a.date) - new Date(b.date));
  const totalHariKerja = sortedRecords.filter(r => r.hoursWorked > 0).length;

  // Flatten semua baris tabel
  const tableRows = sortedRecords.flatMap((rec, i) => {
    const items = [];
    if (rec.hoursWorked > 0) {
      items.push({
        desc: `Upah Jam Kerja (${rec.hoursWorked} Jam)`,
        in: rec.hoursWorked * data.employee.hourlyRate,
        out: 0,
      });
    }
    rec.additions?.forEach(a =>
      items.push({ desc: a.category + (a.note ? ` (${a.note})` : ''), in: a.amount, out: 0 })
    );
    rec.deductions?.forEach(d =>
      items.push({ desc: d.category + (d.note ? ` (${d.note})` : ''), in: 0, out: d.amount })
    );

    return items.map((item, j) => ({
      rec,
      item,
      isFirst: j === 0,
      isLastOfRec: j === items.length - 1,
      key: `${i}-${j}`,
    }));
  });

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* HEADER */}
        <View style={S.header}>
          <Text style={S.headerTitle}>SLIP GAJI KARYAWAN</Text>
          <Text style={S.headerCompany}>MAMAM AYAM</Text>
          <Text style={S.headerPeriode}>Periode: {monthLabel}</Text>
        </View>

        {/* INFO KARYAWAN */}
        <View style={S.infoSection}>
          <View>
            {[
              ['Nama', data.employee.name],
              ['Posisi', 'Karyawan'],
              ['Hari Kerja Masuk', `${totalHariKerja} Hari`],
            ].map(([label, value]) => (
              <View key={label} style={S.infoRow}>
                <Text style={S.infoLabel}>{label}</Text>
                <Text style={S.infoColon}>:</Text>
                <Text style={S.infoValue}>{value}</Text>
              </View>
            ))}
          </View>
          <View>
            {[
              ['Total Jam Kerja', `${data.totalHours} Jam`],
              ['Upah per Jam', formatRupiah(data.employee.hourlyRate)],
              ['Bonus Full Time', formatRupiah(data.employee.fullTimeBonus || 0)],
            ].map(([label, value]) => (
              <View key={label} style={S.infoRow}>
                <Text style={S.infoLabelWide}>{label}</Text>
                <Text style={S.infoColon}>:</Text>
                <Text style={S.infoValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* TABEL RINCIAN HARIAN */}
        <Text style={S.tableTitle}>Rincian Pemasukan & Pengeluaran Harian</Text>
        <View style={S.tableWrapper}>

          {/* Header tabel */}
          <View style={S.tableHeaderRow}>
            <View style={[S.colDate, S.th]}><Text>Tanggal & Jam</Text></View>
            <View style={[S.colDesc, S.th]}><Text>Keterangan</Text></View>
            <View style={[S.colIn, S.th]}><Text style={{ textAlign: 'right' }}>Pemasukan (+)</Text></View>
            <View style={[S.colOut, S.thLast]}><Text style={{ textAlign: 'right' }}>Pengeluaran (-)</Text></View>
          </View>

          {/* Baris data */}
          {tableRows.length > 0 ? tableRows.map(({ rec, item, isFirst, key }) => (
            <View key={key} style={S.tableRow}>

              {/* Kolom tanggal: hanya tampil di baris pertama per record */}
              <View style={[S.colDate, isFirst ? S.td : S.emptyCell]}>
                {isFirst && (
                  <>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8 }}>{rec.dateStr}</Text>
                    <Text style={{ fontSize: 7, color: '#64748b', marginTop: 1 }}>
                      {rec.clockIn || '--:--'} s/d {rec.clockOut || '--:--'}
                    </Text>
                  </>
                )}
              </View>

              <View style={[S.colDesc, S.td]}><Text>{item.desc}</Text></View>

              <View style={[S.colIn, S.td]}>
                <Text style={{ textAlign: 'right', color: item.in > 0 ? '#16a34a' : '#1a1a1a' }}>
                  {item.in > 0 ? formatRupiah(item.in) : '-'}
                </Text>
              </View>

              <View style={[S.colOut, S.tdLast]}>
                <Text style={{ textAlign: 'right', color: item.out > 0 ? '#dc2626' : '#1a1a1a' }}>
                  {item.out > 0 ? formatRupiah(item.out) : '-'}
                </Text>
              </View>

            </View>
          )) : (
            <View style={S.tableRow}>
              <View style={{ flex: 1, padding: 8, borderBottom: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1' }}>
                <Text style={{ textAlign: 'center', color: '#64748b' }}>Tidak ada data harian.</Text>
              </View>
            </View>
          )}
        </View>

        {/* RINGKASAN */}
        <View style={S.summaryWrapper}>
          <View style={S.summaryBox}>
            <View style={S.summaryRow}>
              <Text>Total Upah Dasar</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{formatRupiah(basicPay)}</Text>
            </View>
            <View style={S.summaryRow}>
              <Text>Total Tambahan</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', color: '#16a34a' }}>(+) {formatRupiah(data.totalAdditions)}</Text>
            </View>
            {/* TAMBAHAN KODE BARU: Baris Uang Lembur di Dokumen PDF */}
            {overtimePay > 0 && (
              <View style={S.summaryRow}>
                <Text style={{ color: '#e67e22', fontFamily: 'Helvetica-Bold' }}>
                  Uang Lembur ({((data.totalOvertimeMinutes || 0) / 60).toFixed(1).replace('.', ',')} jam)
                </Text>
                <Text style={{ color: '#e67e22', fontFamily: 'Helvetica-Bold' }}>
                  {formatRupiah(overtimePay)}
                </Text>
              </View>
            )}
            <View style={S.summaryRow}>
              <Text>Total Potongan</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', color: '#dc2626' }}>(-) {formatRupiah(data.totalDeductions)}</Text>
            </View>
            <View style={S.summaryTotalRow}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10 }}>TOTAL DITERIMA</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10 }}>{formatRupiah(data.netPay)}</Text>
            </View>
          </View>
        </View>

        {/* TANDA TANGAN */}
        <View style={S.signatureSection}>
          <View style={S.signatureBox}>
            <Text>Penerima,</Text>
            <View style={S.signatureSpacer} />
            <View style={S.signatureLine} />
            <Text style={S.signatureName}>({data.employee.name})</Text>
          </View>
          <View style={S.signatureBox}>
            <Text>Mengetahui,</Text>
            <View style={S.signatureSpacer} />
            <View style={S.signatureLine} />
            <Text style={S.signatureName}>( HRD / Manajemen )</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
};

export default PayslipPDFDocument;
