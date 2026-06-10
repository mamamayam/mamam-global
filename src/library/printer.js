import { Capacitor } from '@capacitor/core';

export const isNativePlatform = () => {
    return Capacitor.isNativePlatform();
};

// Fungsi untuk merakit struktur Struk sesuai data keranjang aplikasi lu
export const getESCPOSData = (data, storeSettings, kembalian) => {
    const lines = [];

    // --- HEADER STRUK ---
    lines.push('\x1B\x61\x01'); // Rata Tengah (Center align)
    lines.push(`${storeSettings?.storeName || 'Mamam Drink'}\n`);
    if (storeSettings?.storeAddress) lines.push(`${storeSettings.storeAddress}\n`);
    if (storeSettings?.storePhone) lines.push(`WA - ${storeSettings.storePhone}\n`);
    lines.push('--------------------------------\n');
    lines.push(`ID: ${data.id} | Kasir: Admin\n`);
    lines.push(`${new Date(data.date).toLocaleString('id-ID')}\n`);
    if (data.customerName) lines.push(`Pelanggan: ${data.customerName}\n`);
    lines.push(`Tipe: ${data.orderType}\n`);
    lines.push('--------------------------------\n');

    // --- DAFTAR BARANG ---
    lines.push('\x1B\x61\x00'); // Rata Kiri (Left align)
    const rp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;

    data.items.forEach(item => {
        lines.push(`${item.name}\n`);
        if (item.variantName) lines.push(`  - ${item.variantName}\n`);
        if (item.note) lines.push(`  * ${item.note}\n`);
        lines.push(`  ${item.qty}x ${rp(item.price)}  ${rp(item.price * item.qty)}\n`);
    });

    // --- TOTALAN & PAJAK ---
    lines.push('--------------------------------\n');
    lines.push(`Subtotal:    ${rp(data.subtotal)}\n`);
    if (data.discount > 0) lines.push(`Diskon Vcr: -${rp(data.discount)}\n`);
    if (data.pointDiscount > 0) lines.push(`Potong Poin:-${rp(data.pointDiscount)}\n`);
    if (data.manualDiscountAmount > 0) lines.push(`Diskon Man: -${rp(data.manualDiscountAmount)}\n`);

    if (data.taxAmount > 0) lines.push(`Pajak:       ${rp(data.taxAmount)}\n`);
    if (data.serviceAmount > 0) lines.push(`Service:     ${rp(data.serviceAmount)}\n`);
    if (data.deliveryFee > 0) lines.push(`Ongkir:      ${rp(data.deliveryFee)}\n`);

    // --- PEMBAYARAN ---
    lines.push('--------------------------------\n');
    lines.push(`TOTAL:       ${rp(data.total)}\n`);

    if (data.paymentMethod === 'Split Payment') {
        data.splitDetails.forEach(p => {
            lines.push(`- ${p.method}:  ${rp(p.amount)}\n`);
        });
    } else {
        lines.push(`Bayar (${data.paymentMethod}): ${rp(data.total)}\n`);
    }

    if (kembalian > 0) lines.push(`Kembalian:   ${rp(kembalian)}\n`);

    // --- FOOTER ---
    lines.push('--------------------------------\n');
    lines.push('\x1B\x61\x01'); // Rata Tengah (Center align)
    lines.push(`${storeSettings?.receiptFooter || 'Terima Kasih'}\n\n\n`); // \n\n\n untuk ngeluarin kertas sisa biar gampang disobek

    return lines.join('');
};

export const printNativeBluetooth = async (data, storeSettings, kembalian) => {
    if (!window.bluetoothSerial) {
        alert('Plugin Bluetooth tidak terdeteksi di HP ini.');
        return false;
    }

    // 1. Ambil Mac Address printer yang udah di-set dari UI SettingsView tadi
    const savedAddress = localStorage.getItem('my_printer_mac');
    const savedName = localStorage.getItem('my_printer_name');

    if (!savedAddress) {
        alert('Printer belum diatur! Silakan pergi ke menu Pengaturan > Scan Printer Bluetooth terlebih dahulu.');
        return false;
    }

    return new Promise((resolve) => {
        window.bluetoothSerial.isEnabled(
            () => {
                // 2. Langsung hajar konek pakai address yang disimpen, GAK PERLU SCAN LAGI
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
                        // Kalau gagal konek (misal printernya mati), hapus memori biar user setting ulang
                        localStorage.removeItem('my_printer_mac');
                        localStorage.removeItem('my_printer_name');
                        alert(`Gagal terhubung ke Printer "${savedName}". Pastikan printernya nyala!\n\nError: ${err}`);
                        resolve(false);
                    }
                );
            },
            () => {
                alert('Bluetooth HP lu mati. Nyalain dulu bos!');
                resolve(false);
            }
        );
    });
};