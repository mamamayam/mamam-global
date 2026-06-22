import { Capacitor } from '@capacitor/core';

const ensureBluetoothPermissions = () => {
    return new Promise((resolve) => {
        const permissions = window.cordova?.plugins?.permissions;
        if (!permissions) {
            resolve(true); // bukan native / plugin belum siap, lanjut aja
            return;
        }
        permissions.requestPermissions(
            ['android.permission.BLUETOOTH_CONNECT', 'android.permission.BLUETOOTH_SCAN'],
            (status) => resolve(!!status.hasPermission),
            () => resolve(false)
        );
    });
};

export const isNativePlatform = () => {
    return Capacitor.isNativePlatform();
};

const justifyBetween = (leftStr, rightStr, maxWidth = 32) => {
    const left = String(leftStr);
    const right = String(rightStr);
    const spacesNeeded = maxWidth - left.length - right.length;

    if (spacesNeeded > 0) {
        return left + ' '.repeat(spacesNeeded) + right;
    }
    return left + ' ' + right;
};

// 1. TAMBAHKAN PARAMETER 'sisaPoin' DI SINI
export const getESCPOSData = (data, storeSettings, kembalian, sisaPoin) => {
    const lines = [];
    const rp = (n) => Number(n).toLocaleString('id-ID');

    const isOpenBill = data.status === 'OPEN' || data.status === 'UNPAID';

    lines.push('\x1B\x40'); // Init Printer

    // --- HEADER STRUK ---
    lines.push('\x1B\x61\x31'); // Rata Tengah
    lines.push(`${storeSettings?.storeName || 'Mamam Ayam'}\n`);
    if (storeSettings?.storeAddress) lines.push(`${storeSettings.storeAddress}\n`);
    if (storeSettings?.storePhone) lines.push(`WA: ${storeSettings.storePhone}\n`);
    lines.push('--------------------------------\n');

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

    if (data.customerName) {
        lines.push(justifyBetween('Pelanggan:', data.customerName) + '\n');

        const pointsUsed = (data.pointDiscount || 0) / 100;

        // 2. GUNAKAN 'sisaPoin' YANG BERASAL DARI DATABASE
        const finalPoin = sisaPoin !== undefined ? sisaPoin : (data.customerPoints || 0);

        lines.push('\x1B\x61\x31'); // Set Rata Tengah
        lines.push('\x1B\x45\x31'); // Set Bold ON
        lines.push('\x1B\x21\x10'); // Set Font Double Height
        lines.push(`\nSISA POIN: ${finalPoin}\n\n`);
        lines.push('\x1B\x21\x00'); // Reset ukuran Font normal
        lines.push('\x1B\x45\x30'); // Reset Bold OFF

        if (pointsUsed > 0) {
            lines.push(`(Poin Dipakai: ${pointsUsed})\n`);
        }
        lines.push('\x1B\x61\x30'); // Set Rata Kiri kembali
    }

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
        lines.push('\n');
        lines.push('\x1B\x61\x31'); // Rata Tengah
        lines.push('[ B E L U M   L U N A S ]\n');
    }

    lines.push('--------------------------------\n');

    // --- FOOTER ---
    lines.push('\x1B\x61\x31'); // Rata Tengah
    if (isOpenBill) {
        lines.push(`Silakan bawa struk ini\n`);
        lines.push(`ke kasir untuk pembayaran\n\n`);
    } else {
        lines.push(`${storeSettings?.receiptFooter || 'Terima Kasih'}\n`);
        lines.push('Selamat Menikmati Hidangan Kami\n\n');
    }

    lines.push('--------------------------------\n');
    lines.push('Ketentuan Penukaran Poin:\n');
    lines.push('1 Poin = 100 Rupiah\n');
    lines.push('Setiap pembelian 10.000 dan\n');
    lines.push('kelipatannya mendapat 1 Poin\n');
    lines.push('--------------------------------\n\n\n\n');

    return lines.join('');
};

// 3. TAMBAHKAN PARAMETER 'sisaPoin' JUGA DI SINI
export const printNativeBluetooth = async (data, storeSettings, kembalian, sisaPoin) => {
    if (!window.bluetoothSerial) {
        alert('Plugin Bluetooth tidak terdeteksi di HP ini.');
        return false;
    }

    const granted = await ensureBluetoothPermissions();
    if (!granted) {
        alert('Izin Bluetooth belum diaktifkan. Buka Settings > Apps > Mamam Kasir > Permissions, aktifkan "Nearby devices".');
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
                        // TUNGGU 500ms SEBELUM MENGIRIM DATA BIAR NGGAK CRASH
                        setTimeout(() => {
                            const encoder = new TextEncoder();
                            const rawText = getESCPOSData(data, storeSettings, kembalian, sisaPoin);
                            const binaryData = encoder.encode(rawText);

                            window.bluetoothSerial.write(
                                binaryData,
                                () => {
                                    // TUNGGU 500ms SEBELUM DISCONNECT BIAR KERTAS SELESAI KELUAR
                                    setTimeout(() => {
                                        window.bluetoothSerial.disconnect();
                                        resolve(true);
                                    }, 500);
                                },
                                (err) => {
                                    alert(`Gagal mengirim data ke printer: ${err}`);
                                    window.bluetoothSerial.disconnect();
                                    resolve(false);
                                }
                            );
                        }, 500); // <-- Jeda 500 milidetik
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

export const printShiftNativeBluetooth = async (shiftData, storeSettings) => {
    if (!window.bluetoothSerial) {
        alert('Plugin Bluetooth tidak terdeteksi di HP ini.');
        return false;
    }

    const granted = await ensureBluetoothPermissions();
    if (!granted) {
        alert('Izin Bluetooth belum diaktifkan. Buka Settings > Apps > Mamam Kasir > Permissions, aktifkan "Nearby devices".');
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
                        // 1. TUNGGU 500ms SETELAH CONNECT BIAR MESIN ANDROID STABIL & NGGAK CRASH
                        setTimeout(() => {
                            const encoder = new TextEncoder();
                            const rawText = getShiftESCPOSData(shiftData, storeSettings);
                            const binaryData = encoder.encode(rawText);

                            window.bluetoothSerial.write(
                                binaryData,
                                () => {
                                    // 2. TUNGGU 500ms SEBELUM DISCONNECT BIAR BUFFER PRINTER SELESAI NYETAK
                                    setTimeout(() => {
                                        window.bluetoothSerial.disconnect();
                                        resolve(true);
                                    }, 500);
                                },
                                (err) => {
                                    alert(`Gagal mengirim data ke printer: ${err}`);
                                    window.bluetoothSerial.disconnect();
                                    resolve(false);
                                }
                            );
                        }, 500); // <-- Jeda napas setelah connect
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
    const rp = (n) => Number(n).toLocaleString('id-ID');

    lines.push('\x1B\x40');

    lines.push('\x1B\x61\x31');
    lines.push(`DOMPET\n`);
    lines.push(`LAPORAN TUTUP DOMPET\n`);
    lines.push(`ID: ${shiftData.id}\n`);
    lines.push('--------------------------------\n');

    lines.push('\x1B\x61\x30');
    lines.push(justifyBetween('Buka:', new Date(shiftData.startTime).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }).replace(',', '')) + '\n');
    lines.push(justifyBetween('Tutup:', new Date(shiftData.endTime).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }).replace(',', '')) + '\n');
    lines.push('--------------------------------\n');

    lines.push(justifyBetween('Saldo Awal', rp(shiftData.stats.initialCash)) + '\n');
    lines.push(justifyBetween('Penjualan Tunai', rp(shiftData.stats.cashSales)) + '\n');
    lines.push(justifyBetween('Pemasukan Lain', rp(shiftData.stats.cashIncomes)) + '\n');
    lines.push(justifyBetween('Pengeluaran', '-' + rp(shiftData.stats.cashExpenses)) + '\n');
    lines.push('--------------------------------\n');

    lines.push(justifyBetween('Total Seharusnya', rp(shiftData.stats.expectedCash)) + '\n');
    lines.push(justifyBetween('Saldo Aktual', rp(shiftData.actualCash)) + '\n');
    lines.push('\n');

    let selisihLabel = 'BALANCE (PAS)';
    if (shiftData.difference < 0) selisihLabel = 'SELISIH MINUS';
    else if (shiftData.difference > 0) selisihLabel = 'SELISIH LEBIH';

    lines.push(justifyBetween(selisihLabel, rp(shiftData.difference)) + '\n');
    lines.push('--------------------------------\n');

    lines.push('\x1B\x61\x31');
    lines.push('-- Akhir Laporan --\n\n\n\n\n');

    return lines.join('');
};