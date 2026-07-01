import React, { useState } from "react";
// Lo bisa panggil usePosStore di sini nanti kalau receiptModal ikut dipindah ke Zustand
// import { usePosStore } from '../../store/usePosStore'; 
import { useAppContext } from "../../context/AppContext";
import { Printer, Share2, Loader2 } from "lucide-react";
import { isNativePlatform, printNativeBluetooth } from '../../library/printer.js';
import { toPng, toBlob } from 'html-to-image';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

const ReceiptModal = () => {
    // ─── AMBIL DARI CONTEXT ───
    const { receiptModal, setReceiptModal, storeSettings, formatRupiah, printReceipt, customers } = useAppContext();
    const [isPrinting, setIsPrinting] = useState(false);

    if (!receiptModal.isOpen || !receiptModal.data) return null;
    const { data, kembalian } = receiptModal;

    const isOpenBill = data.status === 'OPEN' || data.status === 'UNPAID';

    const matchedCustomer = customers?.find(c => c.name === data.customerName);
    const sisaPoin = matchedCustomer ? matchedCustomer.points : (data.customerPoints || 0);
    const pointsUsed = (data.pointDiscount || 0) / 100;

    const handlePrint = async () => {
        if (isNativePlatform()) {
            setIsPrinting(true);
            try {
                await printNativeBluetooth(data, storeSettings, kembalian, sisaPoin);
            } finally {
                setIsPrinting(false);
            }
        } else {
            printReceipt();
        }
    };

    const handleShareImage = async () => {
        const receiptElement = document.getElementById('receipt-content');
        if (!receiptElement) {
            alert('Error: Elemen HTML struk tidak ditemukan.');
            return;
        }

        try {
            if (Capacitor.isNativePlatform()) {
                const dataUrl = await toPng(receiptElement, {
                    backgroundColor: '#ffffff',
                    pixelRatio: 3,
                    skipAutoScale: true,
                    style: { width: '300px' }
                });

                const base64Data = dataUrl.split(',')[1];
                const fileName = `struk-${data.id}-${Date.now()}.png`;

                const savedFile = await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: Directory.Cache
                });

                await Share.share({
                    title: 'Struk Pesanan',
                    text: `Terimakasih sudah order, ini struknya ya`,
                    url: savedFile.uri,
                    dialogTitle: 'Bagikan Struk via'
                });
            } else {
                const blob = await toBlob(receiptElement, {
                    backgroundColor: '#ffffff',
                    pixelRatio: 2,
                    skipAutoScale: true,
                    style: { width: '300px' }
                });

                if (!blob) return;
                const file = new File([blob], `struk-${data.id}.png`, { type: 'image/png' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `struk-${data.id}.png`;
                link.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Log Error Asli:', error);
            if (error.name !== 'AbortError') alert(`GAGAL SHARE!\n\nPesan Error: ${error.message || JSON.stringify(error)}`);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-start md:items-center justify-center p-4 bg-black/40 backdrop-blur-md overflow-y-auto py-10 transition-opacity duration-300 print:bg-white print:p-0">
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

            <div id="receipt-wrapper" className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-[300px] shadow-2xl relative font-mono text-sm animate-in zoom-in-95 duration-300 ease-out flex flex-col shrink-0 print:shadow-none print:w-[58mm] print:rounded-none overflow-hidden">

                <div id="receipt-content" className="w-[300px] bg-white dark:bg-slate-900 p-4 font-mono text-[11px] leading-tight text-black dark:text-white mx-auto relative">

                    {isOpenBill && (
                        <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none overflow-hidden">
                            <div className="border-4 border-gray-300 dark:border-slate-600 text-gray-300 dark:text-slate-600 text-3xl font-black uppercase tracking-widest p-2 rotate-[-35deg] opacity-60">
                                BELUM LUNAS
                            </div>
                        </div>
                    )}

                    <div className="relative z-10">
                        <div className="text-center mb-3">
                            <div className="font-bold text-lg uppercase tracking-wide">
                                {storeSettings?.storeName || "Mamam Ayam"}
                            </div>
                            {storeSettings?.storeAddress && <div className="text-[10px] mt-1">{storeSettings.storeAddress}</div>}
                            {storeSettings?.storePhone && <div className="text-[10px]">WA: {storeSettings.storePhone}</div>}
                        </div>

                        <div className="text-center font-bold mb-2 pb-2 border-b border-dashed border-gray-500 dark:border-slate-400">
                            {isOpenBill ? '*** BILL SEMENTARA ***' : '*** LUNAS ***'}
                        </div>

                        <div className="flex justify-between mb-1">
                            <span>{new Date(data.date).toLocaleString("id-ID", { dateStyle: 'short', timeStyle: 'short' }).replace(',', '')}</span>
                            <span>Kasir: Admin</span>
                        </div>
                        <div className="flex justify-between mb-1">
                            <span>No: {data.id}</span>
                            <span>{data.orderType}</span>
                        </div>

                        {data.customerName && (
                            <>
                                <div className="flex justify-between mb-1">
                                    <span>Pelanggan:</span>
                                    <span>{data.customerName}</span>
                                </div>

                                <div className="text-center my-3 py-2 border-y border-dashed border-gray-500 dark:border-slate-400">
                                    <div className="text-[10px] font-bold text-gray-600 dark:text-gray-300">SISA POIN ANDA</div>
                                    <div className="text-2xl font-black text-black dark:text-white">
                                        {sisaPoin}
                                    </div>
                                    {pointsUsed > 0 && (
                                        <div className="text-[9px] text-gray-500 dark:text-slate-400 mt-1">
                                            (Poin dipakai transaksi ini: {pointsUsed})
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        <div className="border-b border-dashed border-gray-500 dark:border-slate-400 my-2"></div>

                        <div className="mb-2">
                            {data.items.map((item, idx) => (
                                <div key={idx} className="mb-2">
                                    <div className="font-bold">{item.name}</div>
                                    {item.variantName && <div className="pl-2 text-[10px] text-gray-700 dark:text-slate-200">- {item.variantName}</div>}
                                    {item.note && <div className="pl-2 text-[10px] text-gray-700 dark:text-slate-200">* {item.note}</div>}
                                    <div className="flex justify-between pl-2 mt-0.5">
                                        <span>{item.qty} x {formatRupiah(item.price)}</span>
                                        <span>{formatRupiah(item.price * item.qty)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="border-b border-dashed border-gray-500 dark:border-slate-400 my-2"></div>

                        <div className="flex flex-col gap-1 mb-2">
                            <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span>{formatRupiah(data.subtotal)}</span>
                            </div>
                            {data.discount > 0 && <div className="flex justify-between"><span>Diskon Vcr</span><span>-{formatRupiah(data.discount)}</span></div>}
                            {data.pointDiscount > 0 && <div className="flex justify-between"><span>Potong Poin</span><span>-{formatRupiah(data.pointDiscount)}</span></div>}
                            {data.manualDiscountAmount > 0 && <div className="flex justify-between"><span>Diskon Man</span><span>-{formatRupiah(data.manualDiscountAmount)}</span></div>}
                            {data.taxAmount > 0 && <div className="flex justify-between"><span>Pajak</span><span>{formatRupiah(data.taxAmount)}</span></div>}
                            {data.serviceAmount > 0 && <div className="flex justify-between"><span>Service</span><span>{formatRupiah(data.serviceAmount)}</span></div>}
                            {data.deliveryFee > 0 && <div className="flex justify-between"><span>Ongkir</span><span>{formatRupiah(data.deliveryFee)}</span></div>}
                        </div>

                        <div className="border-b border-dashed border-gray-500 dark:border-slate-400 my-2"></div>

                        <div className="flex flex-col gap-1 mb-3">
                            <div className="flex justify-between font-bold text-[13px]">
                                <span>TOTAL TAGIHAN</span>
                                <span>{formatRupiah(data.total)}</span>
                            </div>

                            {!isOpenBill && (
                                <>
                                    {data.paymentMethod === "Split Payment" ? (
                                        data.splitDetails.map((p, i) => (
                                            <div key={i} className="flex justify-between">
                                                <span>Bayar ({p.method})</span>
                                                <span>{formatRupiah(p.amount)}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex justify-between">
                                            <span>Bayar ({data.paymentMethod})</span>
                                            <span>{formatRupiah(data.total + (kembalian || 0))}</span>
                                        </div>
                                    )}

                                    {kembalian > 0 && (
                                        <div className="flex justify-between">
                                            <span>Kembalian</span>
                                            <span>{formatRupiah(kembalian)}</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="border-b border-dashed border-gray-500 dark:border-slate-400 mb-3"></div>

                        <div className="text-center text-[10px]">
                            {isOpenBill ? (
                                <div className="font-bold text-gray-600 dark:text-slate-300">
                                    Silakan bayar di kasir<br />saat Anda selesai.
                                </div>
                            ) : (
                                <div className="whitespace-pre-wrap text-center">
                                    {storeSettings?.receiptFooter}
                                </div>
                            )}

                            <div className="mt-4 pt-3 border-t border-dotted border-gray-500 dark:border-slate-400 text-[9px] leading-relaxed text-gray-600 dark:text-slate-300">
                                <strong>Ketentuan Penukaran Poin:</strong><br />
                                1 Poin = 100 Rupiah<br />
                                Setiap pembelian 10.000 dan kelipatannya mendapatkan 1 Poin
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 rounded-b-xl flex flex-col gap-2 no-print relative z-20">
                    <div className="flex gap-2">
                        <button
                            onClick={handlePrint}
                            disabled={isPrinting}
                            className="flex-1 py-3 rounded-lg bg-slate-800 text-white font-bold shadow-sm hover:bg-slate-900 text-sm flex justify-center items-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isPrinting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Menghubungkan...
                                </>
                            ) : (
                                <>
                                    <Printer className="w-4 h-4" /> Cetak
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleShareImage}
                            disabled={isPrinting}
                            className="flex-1 py-3 rounded-lg bg-green-600 dark:bg-green-500 text-white font-bold shadow-sm hover:bg-green-700 dark:hover:bg-green-600 text-sm flex justify-center items-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <Share2 className="w-4 h-4" /> Bagikan
                        </button>
                    </div>
                    <button onClick={() => setReceiptModal({ isOpen: false, data: null })} className="w-full py-3 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 text-sm transition-colors border border-slate-200 dark:border-slate-700">
                        Tutup Selesai
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReceiptModal;