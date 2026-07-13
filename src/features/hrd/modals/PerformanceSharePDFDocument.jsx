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
    width: 100,
    color: '#64748b',
  },
  infoColon: {
    width: 10,
    color: '#64748b',
  },
  infoValue: {
    fontFamily: 'Helvetica-Bold',
  },

  // KPI GRID
  kpiTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '1px solid #e2e8f0',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  kpiCard: {
    width: '25%',
    padding: 4,
  },
  kpiCardInner: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    padding: 8,
  },
  kpiLabel: {
    fontSize: 7,
    color: '#64748b',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },

  // RINCIAN LIST (telat / lembur)
  listTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginBottom: 6,
    marginTop: 4,
  },
  listWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  listChip: {
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    padding: '4px 6px',
    margin: 2,
    flexDirection: 'row',
  },
  listChipDate: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
  },
  listChipValue: {
    fontSize: 8,
    marginLeft: 4,
  },

  // RINGKASAN
  summaryWrapper: {
    alignItems: 'flex-end',
    marginBottom: 20,
    marginTop: 4,
  },
  summaryBox: {
    width: '55%',
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

  footer: {
    marginTop: 20,
    fontSize: 7,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

const PerformanceSharePDFDocument = ({ p, rangeLabel, formatRupiah }) => {
  const fmtJam = (n) => `${Number(n || 0).toFixed(1).replace('.', ',')} Jam`;

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* HEADER */}
        <View style={S.header}>
          <Text style={S.headerTitle}>LAPORAN KINERJA KARYAWAN</Text>
          <Text style={S.headerCompany}>MAMAM AYAM</Text>
          <Text style={S.headerPeriode}>Periode: {rangeLabel}</Text>
        </View>

        {/* INFO KARYAWAN */}
        <View style={S.infoSection}>
          <View>
            <View style={S.infoRow}>
              <Text style={S.infoLabel}>Nama</Text>
              <Text style={S.infoColon}>:</Text>
              <Text style={S.infoValue}>{p.employee.name}</Text>
            </View>
            <View style={S.infoRow}>
              <Text style={S.infoLabel}>Hari Masuk</Text>
              <Text style={S.infoColon}>:</Text>
              <Text style={S.infoValue}>{p.hariMasuk} Hari</Text>
            </View>
            <View style={S.infoRow}>
              <Text style={S.infoLabel}>Hari Libur</Text>
              <Text style={S.infoColon}>:</Text>
              <Text style={S.infoValue}>{p.hariLibur} Hari</Text>
            </View>
          </View>
        </View>

        {/* RINGKASAN KPI */}
        <Text style={S.kpiTitle}>Ringkasan Kinerja</Text>
        <View style={S.kpiGrid}>
          {[
            ['Hari Masuk', `${p.hariMasuk} Hari`],
            ['Hari Libur', `${p.hariLibur} Hari`],
            ['Telat', `${p.hariTelat} Kali`],
            ['Rata² Jam/Hari Masuk', fmtJam(p.avgHoursPerWorkDay)],
            ['Total Jam Kerja', fmtJam(p.totalHours)],
            ['Total Lembur', p.totalOvertimeMinutes > 0 ? fmtJam(p.totalOvertimeMinutes / 60) : '-'],
            ['Upah Pokok', formatRupiah(p.basicPay)],
            ['Bonus Full Time', p.fullTimeBonusTotal > 0 ? formatRupiah(p.fullTimeBonusTotal) : '-'],
            ['Uang Lembur', p.overtimePay > 0 ? formatRupiah(p.overtimePay) : '-'],
            ['Tambahan Lain', formatRupiah(Math.max(0, p.totalAdditions - (p.fullTimeBonusTotal || 0) - (p.overtimePay || 0)))],
            ['Kasbon', p.totalKasbon > 0 ? formatRupiah(p.totalKasbon) : '-'],
            ['Potongan Lain', (p.totalDeductions - (p.totalKasbon || 0)) > 0 ? formatRupiah(p.totalDeductions - (p.totalKasbon || 0)) : '-'],
          ].map(([label, value]) => (
            <View key={label} style={S.kpiCard}>
              <View style={S.kpiCardInner}>
                <Text style={S.kpiLabel}>{label}</Text>
                <Text style={S.kpiValue}>{value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* RINCIAN HARI TELAT */}
        {p.hariTelat > 0 && (p.lateDays || []).length > 0 && (
          <>
            <Text style={S.listTitle}>Rincian Hari Telat</Text>
            <View style={S.listWrapper}>
              {p.lateDays.map(d => (
                <View key={d.dateStr} style={S.listChip}>
                  <Text style={S.listChipDate}>{d.dateStr}</Text>
                  <Text style={[S.listChipValue, { color: '#dc2626', fontFamily: 'Helvetica-Bold' }]}>Masuk {d.clockIn}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* RINCIAN LEMBUR */}
        {p.totalOvertimeMinutes > 0 && (p.overtimeByDay || []).length > 0 && (
          <>
            <Text style={S.listTitle}>Rincian Lembur Harian (Rp{Number(p.overtimeRate || 0).toLocaleString('id-ID')}/30 menit)</Text>
            <View style={S.listWrapper}>
              {p.overtimeByDay.map(d => (
                <View key={d.dateStr} style={S.listChip}>
                  <Text style={S.listChipDate}>{d.dateStr}</Text>
                  <Text style={[S.listChipValue, { color: '#d97706', fontFamily: 'Helvetica-Bold' }]}>{fmtJam(d.overtimeMinutes / 60)}</Text>
                  <Text style={[S.listChipValue, { color: '#94a3b8' }]}>({formatRupiah(d.pay)})</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* RINGKASAN PENDAPATAN */}
        <View style={S.summaryWrapper}>
          <View style={S.summaryBox}>
            <View style={S.summaryRow}>
              <Text>Total Upah Dasar</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{formatRupiah(p.basicPay)}</Text>
            </View>
            <View style={S.summaryRow}>
              <Text>Total Tambahan</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', color: '#16a34a' }}>(+) {formatRupiah(p.totalAdditions)}</Text>
            </View>
            <View style={S.summaryRow}>
              <Text>Total Potongan</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', color: '#dc2626' }}>(-) {formatRupiah(p.totalDeductions)}</Text>
            </View>
            <View style={S.summaryTotalRow}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10 }}>PENDAPATAN BERSIH</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10 }}>{formatRupiah(p.netPay)}</Text>
            </View>
          </View>
        </View>

        <Text style={S.footer}>Laporan kinerja ini digenerate otomatis oleh sistem Mamam Ayam.</Text>

      </Page>
    </Document>
  );
};

export default PerformanceSharePDFDocument;