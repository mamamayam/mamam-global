import { Capacitor } from '@capacitor/core';

export const isNativePlatform = () => {
    return Capacitor.isNativePlatform();
};

// Fungsi Ajaib untuk bikin rata kanan-kiri ala Alfamart
const justifyBetween = (leftStr, rightStr, maxWidth = 32) => {
    const left = String(leftStr);
    const right = String(rightStr);
    const spacesNeeded = maxWidth - left.length - right.length;
    
    // Kalau muat, sisipkan spasi di tengah. Kalau kepanjangan, pisah dengan 1 spasi aja.
    if (spacesNeeded > 0) {
        return left + ' '.repeat(spacesNeeded) + right;
    }
    return left + ' ' + right; 
};

export const getESCPOSData = (data, storeSettings, kembalian) => {
    const lines = [];
    const rp = (n) => Number(n).toLocaleString('id-ID');

    // Cek Status
    const isOpenBill = data.status === 'OPEN' || data.status === 'UNPAID';

    lines.push('\x1B\x40'); // Init Printer

    // --- HEADER STRUK ---
    lines.push('\x1B\x61\x31'); // Rata Tengah
    lines.push(`${storeSettings?.storeName || 'Mamam Ayam'}\n`);
    if (storeSettings?.storeAddress) lines.push(`${storeSettings.storeAddress}\n`);
    if (storeSettings?.storePhone) lines.push(`WA: ${storeSettings.storePhone}\n`);
    lines.push('--------------------------------\n');
    
    // JUDUL OPEN BILL JIKA STATUS TERBUKA
    if (isOpenBill) {
        lines.push('*** BILL SEMENTARA ***\n');
        lines.push('--------------------------------\n');
    }
    
    // --- INFO TRANSAKSI ---
    lines.push('\x1B\x61\x30'); // Rata Kiri
    lines.push(justifyBetween(
        new Date(data.date).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }).replace(',', ''), 
        'Kasir: Admin'
    ) + '\n');
    lines.push(justifyBetween(`No: ${data.id}`, data.orderType) + '\n');
    if (data.customerName) lines.push(justifyBetween('Pelanggan:', data.customerName) + '\n');
    lines.push('--------------------------------\n');

    // --- DAFTAR BARANG ---
    data.items.forEach(item => {
        lines.push(`${item.name}\n`); 
        if (item.variantName) lines.push(`  - ${item.variantName}\n`);
        if (item.note) lines.push(`  * ${item.note}\n`);
        
        const qtyPrice = `  ${item.qty} x ${rp(item.price)}`;
        const totalItem = rp(item.price * item.qty);
        lines.push(justifyBetween(qtyPrice, totalItem) + '\n');
    });

    lines.push('--------------------------------\n');

    // --- TOTALAN ---
    lines.push(justifyBetween('Subtotal', rp(data.subtotal)) + '\n');
    if (data.discount > 0) lines.push(justifyBetween('Diskon Vcr', '-' + rp(data.discount)) + '\n');
    if (data.pointDiscount > 0) lines.push(justifyBetween('Potong Poin', '-' + rp(data.pointDiscount)) + '\n');
    if (data.manualDiscountAmount > 0) lines.push(justifyBetween('Diskon Man', '-' + rp(data.manualDiscountAmount)) + '\n');
    if (data.taxAmount > 0) lines.push(justifyBetween('Pajak', rp(data.taxAmount)) + '\n');
    if (data.serviceAmount > 0) lines.push(justifyBetween('Service', rp(data.serviceAmount)) + '\n');
    if (data.deliveryFee > 0) lines.push(justifyBetween('Ongkir', rp(data.deliveryFee)) + '\n');

    lines.push('--------------------------------\n');

    // --- PEMBAYARAN ---
    lines.push(justifyBetween('TOTAL TAGIHAN', rp(data.total)) + '\n');

    // Logika Kondisional Pembayaran
    if (!isOpenBill) {
        if (data.paymentMethod === 'Split Payment') {
            data.splitDetails.forEach(p => {
                lines.push(justifyBetween(`Bayar (${p.method})`, rp(p.amount)) + '\n');
            });
        } else {
            const uangDiterima = data.total + (kembalian || 0);
            lines.push(justifyBetween(`Bayar (${data.paymentMethod})`, rp(uangDiterima)) + '\n');
        }

        if (kembalian > 0) lines.push(justifyBetween('Kembali', rp(kembalian)) + '\n');
    } else {
        // Teks penanda Belum Lunas jika Open Bill
        lines.push('\n');
        lines.push('\x1B\x61\x31'); // Rata Tengah
        lines.push('[ B E L U M   L U N A S ]\n');
    }

    lines.push('--------------------------------\n');

    // --- FOOTER ---
    lines.push('\x1B\x61\x31'); // Rata Tengah
    if (isOpenBill) {
        lines.push(`Silakan bawa struk ini\n`);
        lines.push(`ke kasir untuk pembayaran\n\n\n\n`);
    } else {
        lines.push(`${storeSettings?.receiptFooter || 'Terima Kasih'}\n`);
        lines.push('Selamat Menikmati Hidangan Kami\n\n\n\n'); 
    }

    return lines.join('');
};

export const printNativeBluetooth = async (data, storeSettings, kembalian) => {
    if (!window.bluetoothSerial) {
        alert('Plugin Bluetooth tidak terdeteksi di HP ini.');
        return false;
    }

    const savedAddress = localStorage.getItem('my_printer_mac');
    const savedName = localStorage.getItem('my_printer_name');

    if (!savedAddress) {
        alert('Printer belum diatur! Silakan pergi ke menu Pengaturan > Scan Printer Bluetooth terlebih dahulu.');
        return false;
    }

    return new Promise((resolve) => {
        window.bluetoothSerial.isEnabled(
            () => {
                window.bluetoothSerial.connect(
                    savedAddress,
                    () => {
                        const encoder = new TextEncoder();
                        const rawText = getESCPOSData(data, storeSettings, kembalian);
                        const binaryData = encoder.encode(rawText);

                        window.bluetoothSerial.write(
                            binaryData,
                            () => {
                                window.bluetoothSerial.disconnect(); 
                                resolve(true);
                            },
                            (err) => {
                                alert(`Gagal mengirim data ke printer: ${err}`);
                                window.bluetoothSerial.disconnect();
                                resolve(false);
                            }
                        );
                    },
                    (err) => {
                        localStorage.removeItem('my_printer_mac');
                        localStorage.removeItem('my_printer_name');
                        alert(`Gagal terhubung ke Printer "${savedName}". Pastikan printernya nyala!\n\nError: ${err}`);
                        resolve(false);
                    }
                );
            },
            () => {
                alert('Bluetooth HP mati. Nyalain dulu!');
                resolve(false);
            }
        );
    });
};

export const getShiftESCPOSData = (shiftData, storeSettings) => {
    const lines = [];
    const rp = (n) => Number(n).toLocaleString('id-ID'); // Format angka

    lines.push('\x1B\x40'); // Init Printer

    // --- HEADER ---
    lines.push('\x1B\x61\x31'); // Rata Tengah
    lines.push(`DOMPET\n`);
    lines.push(`LAPORAN TUTUP DOMPET\n`);
    lines.push(`ID: ${shiftData.id}\n`);
    lines.push('--------------------------------\n');
    
    // --- INFO WAKTU ---
    lines.push('\x1B\x61\x30'); // Rata Kiri
    lines.push(justifyBetween('Buka:', new Date(shiftData.startTime).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }).replace(',', '')) + '\n');
    lines.push(justifyBetween('Tutup:', new Date(shiftData.endTime).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }).replace(',', '')) + '\n');
    lines.push('--------------------------------\n');

    // --- RINCIAN KAS ---
    lines.push(justifyBetween('Saldo Awal', rp(shiftData.stats.initialCash)) + '\n');
    lines.push(justifyBetween('Penjualan Tunai', rp(shiftData.stats.cashSales)) + '\n');
    lines.push(justifyBetween('Pemasukan Lain', rp(shiftData.stats.cashIncomes)) + '\n');
    lines.push(justifyBetween('Pengeluaran', '-' + rp(shiftData.stats.cashExpenses)) + '\n');
    lines.push('--------------------------------\n');

    // --- TOTALAN & SELISIH ---
    lines.push(justifyBetween('Total Seharusnya', rp(shiftData.stats.expectedCash)) + '\n');
    lines.push(justifyBetween('Saldo Aktual', rp(shiftData.actualCash)) + '\n');
    lines.push('\n');

    let selisihLabel = 'BALANCE (PAS)';
    if (shiftData.difference < 0) selisihLabel = 'SELISIH MINUS';
    else if (shiftData.difference > 0) selisihLabel = 'SELISIH LEBIH';

    lines.push(justifyBetween(selisihLabel, rp(shiftData.difference)) + '\n');
    lines.push('--------------------------------\n');

    // --- FOOTER ---
    lines.push('\x1B\x61\x31'); // Rata Tengah
    lines.push('-- Akhir Laporan --\n\n\n\n\n'); 

    return lines.join('');
};

export const printShiftNativeBluetooth = async (shiftData, storeSettings) => {
    if (!window.bluetoothSerial) {
        alert('Plugin Bluetooth tidak terdeteksi di HP ini.');
        return false;
    }

    const savedAddress = localStorage.getItem('my_printer_mac');
    const savedName = localStorage.getItem('my_printer_name');

    if (!savedAddress) {
        alert('Printer belum diatur! Silakan pergi ke menu Pengaturan > Scan Printer Bluetooth terlebih dahulu.');
        return false;
    }

    return new Promise((resolve) => {
        window.bluetoothSerial.isEnabled(
            () => {
                window.bluetoothSerial.connect(
                    savedAddress,
                    () => {
                        const encoder = new TextEncoder();
                        const rawText = getShiftESCPOSData(shiftData, storeSettings);
                        const binaryData = encoder.encode(rawText);

                        window.bluetoothSerial.write(
                            binaryData,
                            () => {
                                window.bluetoothSerial.disconnect(); 
                                resolve(true);
                            },
                            (err) => {
                                alert(`Gagal mengirim data ke printer: ${err}`);
                                window.bluetoothSerial.disconnect();
                                resolve(false);
                            }
                        );
                    },
                    (err) => {
                        localStorage.removeItem('my_printer_mac');
                        localStorage.removeItem('my_printer_name');
                        alert(`Gagal terhubung ke Printer "${savedName}". Pastikan printernya nyala!\n\nError: ${err}`);
                        resolve(false);
                    }
                );
            },
            () => {
                alert('Bluetooth HP mati. Nyalain dulu!');
                resolve(false);
            }
        );
    });
};