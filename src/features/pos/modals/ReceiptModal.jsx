import React from "react";
import { useAppContext } from "../../../context/AppContext";
import { Printer, Share2 } from "lucide-react";
import { isNativePlatform, printNativeBluetooth } from '../../../library/printer.js';
import { toPng, toBlob } from 'html-to-image';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

const ReceiptModal = () => {
    const { receiptModal, setReceiptModal, storeSettings, formatRupiah, printReceipt } = useAppContext();
    if (!receiptModal.isOpen || !receiptModal.data) return null;
    const { data, kembalian } = receiptModal;
    
    const handleShareImage = async () => {
        const receiptElement = document.getElementById('receipt-content');
        if (!receiptElement) {
            alert('Error: Elemen HTML struk tidak ditemukan.');
            return;
        }

        try {
            if (Capacitor.isNativePlatform()) {
                // ==========================================
                // JALUR 1: LOGIKA KHUSUS HP (CAPACITOR NATIVE)
                // ==========================================
                // Render elemen jadi format Base64
                const dataUrl = await toPng(receiptElement, {
                    backgroundColor: '#ffffff',
                    pixelRatio: 2,
                    skipAutoScale: true
                });

                const base64Data = dataUrl.split(',')[1];
                const fileName = `struk-${data.id}-${Date.now()}.png`;

                // TAHAP KRUSIAL: Simpan ke folder CACHE 
                // (Ini adalah folder resmi yang direstui Android untuk dibagikan ke WhatsApp)
                const savedFile = await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: Directory.Cache
                });

                // Trigger Native Share bawaan sistem operasi HP lu
                await Share.share({
                    title: 'Struk Pesanan',
                    text: `Terima kasih! Berikut adalah struk pesanan Anda (ID: ${data.id})`,
                    url: savedFile.uri, // Sistem Android akan ngebaca ini sebagai file gambar fisik
                    dialogTitle: 'Bagikan Struk via'
                });

            } else {
                // ==========================================
                // JALUR 2: LOGIKA KHUSUS LOCALHOST (PC)
                // ==========================================
                const blob = await toBlob(receiptElement, {
                    backgroundColor: '#ffffff',
                    pixelRatio: 2,
                    skipAutoScale: true
                });

                if (!blob) return;
                const file = new File([blob], `struk-${data.id}.png`, { type: 'image/png' });

                // Kalau di PC, langsung unduh gambarnya
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `struk-${data.id}.png`;
                link.click();
                URL.revokeObjectURL(url);
            }

        } catch (error) {
            console.error('Log Error Asli:', error);
            if (error.name !== 'AbortError') {
                alert(`GAGAL SHARE!\n\nPesan Error: ${error.message || JSON.stringify(error)}`);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-start md:items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto py-10 transition-opacity duration-300 print:bg-white print:p-0">

            <style dangerouslySetInnerHTML={{
                __html: `
        @media print {
          body * { visibility: hidden; }
          #receipt-wrapper, #receipt-wrapper * { visibility: visible; }
          #receipt-wrapper { position: absolute; left: 0; top: 0; width: ${storeSettings.paperSize === '80mm' ? '80mm' : '58mm'}; margin: 0; padding: 0; box-shadow: none; }
          .no-print { display: none !important; }
          @page { margin: 0; }
        }
      `}} />

            {/* Wrapper Utama (Kotak Putih) */}
            <div id="receipt-wrapper" className="bg-white rounded-xl w-full max-w-[320px] shadow-2xl relative font-mono text-sm animate-in zoom-in-95 duration-300 ease-out flex flex-col shrink-0 print:shadow-none print:w-[58mm] print:rounded-none">

                {/* --- AREA YANG AKAN DIJADIKAN GAMBAR STRUK --- */}
                <div id="receipt-content" className="p-6 bg-white rounded-t-xl print:p-2">
                    <div className="text-center border-b-2 border-dashed border-slate-300 pb-4 mb-4 print:pb-2 print:mb-2">
                        <div className="text-center mb-2">
                            <h2 className="font-bold text-lg">
                                {storeSettings?.storeName || 'Mamam Drink'}
                            </h2>

                            {storeSettings?.storeAddress && (
                                <p className="text-xs">
                                    {storeSettings.storeAddress}
                                </p>
                            )}

                            {storeSettings?.storePhone && (
                                <p className="text-xs">
                                    WA - {storeSettings.storePhone}
                                </p>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 print:mt-1 print:text-black">{data.date.toLocaleString('id-ID')}</p>
                        <p className="text-[10px] text-slate-500 print:text-black">ID: {data.id} | Kasir: Admin</p>
                    </div>

                    <div className="mb-4 text-[11px] space-y-1 print:mb-2 print:text-black">
                        <div className="flex justify-between"><span>Pelanggan:</span> <span className="font-bold">{data.customerName}</span></div>
                        <div className="flex justify-between"><span>Tipe Pesanan:</span> <span className="font-bold">{data.orderType}</span></div>
                    </div>

                    <div className="border-b-2 border-dashed border-slate-300 pb-4 mb-4 print:pb-2 print:mb-2 print:text-black">
                        <table className="w-full text-[11px]">
                            <tbody>
                                {data.items.map((item, idx) => (
                                    <React.Fragment key={idx}>
                                        <tr><td colSpan="3" className="font-bold pt-2">{item.name}</td></tr>
                                        {item.variantName && <tr><td colSpan="3" className="pl-2 pb-1 text-slate-500 print:text-black">- {item.variantName}</td></tr>}
                                        {item.note && <tr><td colSpan="3" className="pl-2 pb-1 italic text-slate-500 print:text-black">* {item.note}</td></tr>}
                                        <tr>
                                            <td className="w-8">{item.qty}x</td>
                                            <td className="text-right pr-2">{formatRupiah(item.price)}</td>
                                            <td className="text-right font-bold">{formatRupiah(item.price * item.qty)}</td>
                                        </tr>
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="space-y-1 text-[11px] print:text-black border-b-2 border-dashed border-slate-300 pb-4 mb-4 print:pb-2 print:mb-2">
                        <div className="flex justify-between"><span>Subtotal</span> <span>{formatRupiah(data.subtotal)}</span></div>
                        {data.discount > 0 && <div className="flex justify-between"><span>Diskon Voucher</span> <span>-{formatRupiah(data.discount)}</span></div>}
                        {data.pointDiscount > 0 && <div className="flex justify-between"><span>Potongan Poin</span> <span>-{formatRupiah(data.pointDiscount)}</span></div>}
                        {data.manualDiscountAmount > 0 && <div className="flex justify-between"><span>Diskon Manual</span> <span>-{formatRupiah(data.manualDiscountAmount)}</span></div>}

                        {data.taxAmount > 0 && <div className="flex justify-between"><span>Pajak</span> <span>{formatRupiah(data.taxAmount)}</span></div>}
                        {data.serviceAmount > 0 && <div className="flex justify-between"><span>Service Chg</span> <span>{formatRupiah(data.serviceAmount)}</span></div>}
                        {data.deliveryFee > 0 && <div className="flex justify-between"><span>Ongkir</span> <span>{formatRupiah(data.deliveryFee)}</span></div>}
                        {data.roundingAdjustment !== 0 && (
                            <>
                                <div className="flex justify-between text-xs">
                                    <span>Subtotal Akhir</span>
                                    <span>{formatRupiah(data.originalTotal)}</span>
                                </div>

                                <div className="flex justify-between text-xs">
                                    <span>Pembulatan</span>
                                    <span>{formatRupiah(data.roundingAdjustment)}</span>
                                </div>
                            </>
                        )}
                        <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-slate-200 print:border-black">
                            <span>TOTAL</span> <span>{formatRupiah(data.total)}</span>
                        </div>
                    </div>

                    <div className="space-y-1 text-[11px] print:text-black">
                        <div className="flex justify-between font-bold mb-1"><span>Pembayaran</span></div>
                        {data.paymentMethod === 'Split Payment' ? (
                            <>
                                {data.splitDetails.map((p, i) => (
                                    <div key={i} className="flex justify-between"><span>- {p.method}</span> <span>{formatRupiah(p.amount)}</span></div>
                                ))}
                            </>
                        ) : (
                            <>
                                <div className="flex justify-between"><span>- {data.paymentMethod}</span> <span>{formatRupiah(data.total)}</span></div>
                                {data.paymentMethod === 'Ojol' && data.ojolName && (
                                    <div className="flex justify-between text-slate-500 mt-1"><span>Aplikasi:</span> <span>{data.ojolName}</span></div>
                                )}
                                {data.paymentMethod === 'Ojol' && data.orderNumber && (
                                    <div className="flex justify-between text-slate-500"><span>No. Order:</span> <span>{data.orderNumber}</span></div>
                                )}
                            </>
                        )}

                        {kembalian > 0 && (
                            <div className="flex justify-between mt-2 font-bold"><span>Kembalian</span> <span>{formatRupiah(kembalian)}</span></div>
                        )}
                    </div>

                    <div className="text-center mt-3 text-xs">
                        {storeSettings?.receiptFooter}
                    </div>
                </div>

                {/* --- AREA TOMBOL --- */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 rounded-b-xl flex flex-col gap-2 no-print">
                    <div className="flex gap-2">
                        <button
                            onClick={async () => {
                                if (isNativePlatform()) {
                                    // Jalankan mesin thermal Bluetooth kalau di HP (Capacitor)
                                    await printNativeBluetooth(data, storeSettings, kembalian);
                                } else {
                                    // Gunakan print browser biasa kalau dites di PC
                                    printReceipt();
                                }
                            }}
                            className="flex-1 py-3 rounded-lg bg-slate-800 text-white font-bold shadow-sm hover:bg-slate-900 text-sm flex justify-center items-center gap-2 transition-colors"
                        >
                            <Printer className="w-4 h-4" /> Cetak
                        </button>
                        <button onClick={handleShareImage} className="flex-1 py-3 rounded-lg bg-green-600 text-white font-bold shadow-sm hover:bg-green-700 text-sm flex justify-center items-center gap-2 transition-colors">
                            <Share2 className="w-4 h-4" /> Bagikan
                        </button>
                    </div>
                    <button onClick={() => setReceiptModal({ isOpen: false, data: null })} className="w-full py-3 rounded-lg bg-white text-slate-800 font-bold shadow-sm hover:bg-slate-100 text-sm transition-colors border border-slate-200">
                        Tutup Selesai
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ReceiptModal;