import React, { useState, useEffect } from 'react';
import { Printer, MessageCircle, ArrowLeft, Check, Receipt, FileText } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import { amountToWords } from '../../utils/formatters';
import { useSchool } from '../../context/SchoolContext';

interface FeeReceiptProps {
    receipt: any;
    studentData: any;
    schoolInfo: any;
    onClose: () => void;
}

// Helper: convert an image URL to base64 data URL via canvas
const toBase64 = (url: string): Promise<string> => {
    return new Promise((resolve) => {
        if (!url || url.startsWith('data:')) { resolve(url); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const c = document.createElement('canvas');
                c.width = img.naturalWidth;
                c.height = img.naturalHeight;
                c.getContext('2d')?.drawImage(img, 0, 0);
                resolve(c.toDataURL('image/png'));
            } catch { resolve(url); }
        };
        img.onerror = () => {
            // Fallback: try using a CORS proxy if direct load fails
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            const proxyImg = new Image();
            proxyImg.crossOrigin = 'anonymous';
            proxyImg.onload = () => {
                try {
                    const c = document.createElement('canvas');
                    c.width = proxyImg.naturalWidth;
                    c.height = proxyImg.naturalHeight;
                    c.getContext('2d')?.drawImage(proxyImg, 0, 0);
                    resolve(c.toDataURL('image/png'));
                } catch { resolve(url); }
            };
            proxyImg.onerror = () => resolve(url);
            proxyImg.src = proxyUrl;
        };
        setTimeout(() => resolve(url), 6000);
        img.src = url;
    });
};

const FeeReceipt: React.FC<FeeReceiptProps> = ({ receipt, studentData, schoolInfo, onClose }) => {
    const { currentSchool } = useSchool();

    // Pre-converted base64 images (ensures html2canvas can capture them)
    const [logoB64, setLogoB64] = useState('');
    const [headerB64, setHeaderB64] = useState('');

    if (!receipt) return null;

    const totalPaid = receipt.paid || 0;
    const previousDues = receipt.previousDues || 0;
    const grandTotal = receipt.total || 0;
    const discount = receipt.discount || 0;
    const netPayable = grandTotal - discount;
    const currentDues = netPayable - totalPaid;

    // Prioritize name and logo from currentSchool (SuperAdmin settings)
    const schoolName = currentSchool?.fullName || currentSchool?.name || schoolInfo?.name || schoolInfo?.schoolName || 'Millat Public School';
    const schoolAddress = currentSchool?.address || schoolInfo?.address || schoolInfo?.schoolAddress || 'Near Moti Nagar, Vickhara, PO-Tarwer, PS-Amnour, Saran Bihar';
    const schoolPhone = currentSchool?.phone || schoolInfo?.phone || schoolInfo?.contact || schoolInfo?.mobile || '';
    const schoolWebsite = currentSchool?.website || schoolInfo?.website || schoolInfo?.web || currentSchool?.web || 'www.millatschool.co.in';
    const schoolLogo = currentSchool?.logoUrl || currentSchool?.logo || schoolInfo?.logoUrl || schoolInfo?.logo || '/logo.png';
    const receiptHeaderImage = currentSchool?.receiptHeaderUrl || schoolInfo?.receiptHeaderUrl || '';

    // Pre-convert images to base64 on mount so html2canvas can always capture them
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (currentSchool?.logoBase64) {
            setLogoB64(currentSchool.logoBase64);
        } else {
            toBase64(schoolLogo).then(setLogoB64);
        }
    }, [schoolLogo, currentSchool?.logoBase64]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (currentSchool?.receiptHeaderBase64) {
            setHeaderB64(currentSchool.receiptHeaderBase64);
        } else if (receiptHeaderImage) {
            toBase64(receiptHeaderImage).then(setHeaderB64);
        } else {
            setHeaderB64('');
        }
    }, [receiptHeaderImage, currentSchool?.receiptHeaderBase64]);

    const handlePrint = () => {
        window.print();
    };

    const handleThermalPrint = () => {
        const dline = '--------------------------------';
        const pad = (label: string, val: string, w = 32) => {
            const gap = w - label.length - val.length;
            return label + (gap > 0 ? ' '.repeat(gap) : ' ') + val;
        };

        const dateStr = receipt.date?.seconds
            ? new Date(receipt.date.seconds * 1000).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })
            : new Date().toLocaleString('en-IN');

        let lines: string[] = [];

        // Header
        const centerLine = (text: string, w = 32) => {
            const gap = Math.max(0, Math.floor((w - text.length) / 2));
            return ' '.repeat(gap) + text;
        };
        lines.push(centerLine(schoolName.toUpperCase()));
        if (schoolAddress) {
            // Wrap address to ~32 chars
            const words = schoolAddress.split(' ');
            let addrLine = '';
            words.forEach((word: string) => {
                if ((addrLine + ' ' + word).trim().length > 32) {
                    lines.push(centerLine(addrLine.trim()));
                    addrLine = word;
                } else {
                    addrLine += ' ' + word;
                }
            });
            if (addrLine.trim()) lines.push(centerLine(addrLine.trim()));
        }
        if (schoolPhone) lines.push(centerLine('Ph: ' + schoolPhone));
        lines.push(dline);
        lines.push(centerLine('FEE RECEIPT'));
        lines.push(dline);

        // Receipt info
        lines.push(pad('Rcpt No:', receipt.receiptNo || ''));
        lines.push(pad('Date:', dateStr));
        lines.push(dline);

        // Student info
        const rollNo = receipt.rollNo || studentData?.classRollNo || studentData?.rollNo || 'N/A';
        lines.push('Name: ' + (receipt.studentName || '').toUpperCase());
        lines.push('ID: ' + (receipt.admissionNo || 'N/A'));
        lines.push('Class: ' + (receipt.class || '') + (receipt.section ? '-' + receipt.section : '') + '  Roll: ' + rollNo);
        lines.push('Mode: ' + (receipt.paymentMode || 'CASH'));
        if (receipt.paidFor) {
            lines.push('For: ' + receipt.paidFor);
        }
        lines.push(dline);

        // Fee items
        lines.push(pad('ITEM', 'AMT'));
        lines.push(dline);
        lines.push(pad('Previous Dues', previousDues.toFixed(2)));

        if (receipt.items && receipt.items.length > 0) {
            receipt.items.forEach((item: any) => {
                const amt = (item.price * item.qty).toFixed(2);
                const name = item.name.length > 20 ? item.name.substring(0, 19) + '.' : item.name;
                lines.push(pad(name, amt));
            });
        } else if (receipt.feeBreakdown) {
            Object.entries(receipt.feeBreakdown).forEach(([feeName, amount]: [string, any]) => {
                const displayName = feeName.toLowerCase().includes('monthly') ? 'Tuition Fee' : feeName;
                const name = displayName.length > 20 ? displayName.substring(0, 19) + '.' : displayName;
                lines.push(pad(name, Number(amount).toFixed(2)));
            });
        }

        lines.push(dline);

        // Totals
        lines.push(pad('Grand Total', grandTotal.toFixed(2)));
        if (discount > 0) {
            lines.push(pad('Discount (-)', '-' + discount.toFixed(2)));
        }
        lines.push(pad('Net Payable', netPayable.toFixed(2)));
        lines.push(dline);
        lines.push(pad('PAID', totalPaid.toFixed(2)));
        lines.push(pad('DUES', currentDues.toFixed(2)));
        lines.push(dline);

        // Amount in words
        const words = amountToWords(totalPaid);
        if (words) {
            lines.push('Amt: ' + words);
            lines.push(dline);
        }

        lines.push('');
        lines.push(centerLine('Thank You!'));
        lines.push(centerLine(schoolName));
        lines.push('');

        // Build HTML for thermal print window
        const thermalHTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Thermal Receipt</title>
<style>
  @page { margin: 0; size: 80mm auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', 'Lucida Console', monospace;
    font-size: 12px;
    line-height: 1.4;
    width: 72mm;
    max-width: 72mm;
    padding: 4mm;
    color: #000;
    background: #fff;
  }
  pre {
    font-family: inherit;
    font-size: inherit;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
  }
</style>
</head><body>
<pre>${lines.join('\n')}</pre>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}<\/script>
</body></html>`;

        const thermalWin = window.open('', '_blank', 'width=320,height=600');
        if (thermalWin) {
            thermalWin.document.write(thermalHTML);
            thermalWin.document.close();
        }
    };

    const handleWhatsAppReceipt = async () => {
        try {
            const html2canvas = (await import('html2canvas')).default;
            const receiptElement = document.querySelector('.printable-receipt') as HTMLElement;
            if (!receiptElement) return;

            // Images are already base64 via useEffect, no CORS issues
            const canvas = await html2canvas(receiptElement, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
                allowTaint: true
            });

            canvas.toBlob(async (blob) => {
                if (!blob) return;
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    const mobileNumber = studentData?.mobileNo || '';
                    const message = encodeURIComponent('Thanks for payment, find attached money receipt.');
                    const whatsappUrl = `https://wa.me/${mobileNumber.replace(/[^0-9]/g, '')}?text=${message}`;
                    window.open(whatsappUrl, '_blank');
                    alert('Receipt copied to clipboard! Paste it in WhatsApp chat.');
                } catch {
                    alert('Clipboard access denied. Please allow permissions.');
                }
            }, 'image/png');
        } catch (error) {
            console.error('WhatsApp receipt error:', error);
            alert('Failed to generate receipt image.');
        }
    };

    const handleWhatsAppPDF = async () => {
        try {
            const html2canvas = (await import('html2canvas')).default;
            const jsPDF = (await import('jspdf')).jsPDF;
            const receiptElement = document.querySelector('.printable-receipt') as HTMLElement;
            if (!receiptElement) return;

            const canvas = await html2canvas(receiptElement, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
                allowTaint: true
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a5'
            });

            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

            const fileName = `Receipt_${receipt.receiptNo || 'Fee'}.pdf`;
            const pdfBlob = pdf.output('blob');
            const studentMobile = (studentData?.mobileNo || receipt.mobile || '').replace(/[^0-9]/g, '');
            const message = encodeURIComponent(`Fee receipt for ${receipt.studentName || 'Student'}. PDF attached.`);

            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

            // Mobile sharing
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'Fee Receipt',
                        text: `Fee receipt for ${receipt.studentName}`,
                    });
                } catch (shareError) {
                    console.error('Share failed:', shareError);
                    // Fallback to download if share canceled or failed
                    pdf.save(fileName);
                }
            } else {
                // Desktop fallback: Download and open WhatsApp
                pdf.save(fileName);
                if (studentMobile) {
                    const whatsappUrl = `https://wa.me/${studentMobile}?text=${message}`;
                    window.open(whatsappUrl, '_blank');
                    alert('PDF downloaded! Please attach it to the WhatsApp chat.');
                } else {
                    alert('PDF downloaded! (Student mobile number not found)');
                }
            }
        } catch (error) {
            console.error('WhatsApp PDF error:', error);
            alert('Failed to generate PDF receipt. Make sure jspdf is installed.');
        }
    };

    const handleDone = () => {
        console.log('Done button clicked');
        console.log('Current School:', currentSchool);
        const schoolId = currentSchool?.id || (currentSchool as any)?.schoolId || '';
        console.log('School ID:', schoolId);
        if (schoolId) {
            const targetPath = `/${schoolId}/fees`;
            console.log('Navigating to:', targetPath);
            // Use window.location.href for direct navigation
            window.location.href = targetPath;
        } else {
            console.error('School ID not found');
            alert('Unable to navigate: School ID not found');
        }
    };

    return (
        <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <style>
                {`
                    @media print {
                        body * { visibility: hidden; }
                        .printable-receipt, .printable-receipt * { visibility: visible; }
                        .printable-receipt { position: absolute; left: 0; top: 0; width: 100%; }
                        .no-print { display: none !important; }
                        @page { 
                            size: A5;
                            margin: 0.5cm;
                        }
                    }
                `}
            </style>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={onClose} className="btn-icon"><ArrowLeft size={20} /></button>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Fee Receipt</h1>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={handleWhatsAppReceipt} className="btn" style={{ background: '#25D366', color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                        <MessageCircle size={16} /> WhatsApp
                    </button>
                    <button onClick={handleWhatsAppPDF} className="btn" style={{ background: '#075E54', color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                        <FileText size={16} /> WhatsApp PDF
                    </button>
                    <button onClick={handlePrint} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Printer size={18} /> Print
                    </button>
                    <button onClick={handleThermalPrint} className="btn" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                        <Receipt size={18} /> Thermal
                    </button>
                    <button onClick={handleDone} className="btn" style={{ background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Check size={18} /> Done
                    </button>
                </div>
            </div>

            <div className="printable-receipt">
                <div style={{
                    border: '2px solid #000',
                    padding: '15px',
                    background: 'white',
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '11px',
                    width: '148mm',
                    minHeight: '200mm',
                    margin: '0 auto'
                }}>
                    {(() => {
                        const hf = currentSchool?.receiptHeaderFields || schoolInfo?.receiptHeaderFields || { showLogo: true, showSchoolName: true, showAddress: true, showPhone: true, showEmail: false, showWebsite: true };

                        // Items for the small row at the bottom
                        const getContactRow = (includeAddress: boolean) => {
                            const items: string[] = [];
                            if (includeAddress && hf.showAddress !== false && schoolAddress) items.push(`📍 ${schoolAddress}`);
                            if (hf.showPhone !== false && schoolPhone) items.push(`📱 ${schoolPhone}`);
                            if (hf.showEmail !== false && (currentSchool?.email || schoolInfo?.email)) items.push(`✉ ${currentSchool?.email || schoolInfo?.email}`);
                            if (hf.showWebsite !== false && schoolWebsite) items.push(`🌐 ${schoolWebsite}`);
                            return items;
                        };

                        const imageHeight = currentSchool?.receiptHeaderImageHeight || schoolInfo?.receiptHeaderImageHeight || 120;
                        const schoolFontSize = currentSchool?.receiptSchoolNameFontSize || schoolInfo?.receiptSchoolNameFontSize || 16;

                        const headerMode = currentSchool?.receiptHeaderMode || schoolInfo?.receiptHeaderMode || (receiptHeaderImage ? 'image' : 'text');

                        return (headerMode === 'image' && receiptHeaderImage) ? (
                            /* Header Image Mode */
                            <div style={{ borderBottom: '2px solid #000', paddingBottom: '4px', marginBottom: '10px', textAlign: 'center' }}>
                                <img src={headerB64 || receiptHeaderImage} alt="School Header" style={{ width: '100%', maxHeight: `${imageHeight}px`, objectFit: 'contain' }} />
                                {getContactRow(true).length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '3px', fontSize: '9px' }}>
                                        {getContactRow(true).map((item, i) => <span key={i}>{item}</span>)}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Text-based Header Mode */
                            <div style={{ display: 'flex', alignItems: 'flex-start', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '10px' }}>
                                {hf.showLogo !== false && (
                                    <div style={{ width: '50px', height: '50px', marginRight: '10px', flexShrink: 0 }}>
                                        <img src={logoB64 || schoolLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%', border: '2px solid #000' }} />
                                    </div>
                                )}
                                <div style={{ flex: 1, textAlign: 'center' }}>
                                    {hf.showSchoolName !== false && (
                                        <h2 style={{ margin: 0, fontSize: `${schoolFontSize}px`, fontWeight: 900, color: '#8B0000' }}>{schoolName}</h2>
                                    )}
                                    {hf.showAddress !== false && schoolAddress && (
                                        <p style={{ margin: '2px 0', fontSize: '10px', fontWeight: 600 }}>{schoolAddress}</p>
                                    )}
                                    {getContactRow(false).length > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '3px', fontSize: '9px' }}>
                                            {getContactRow(false).map((item, i) => <span key={i}>{item}</span>)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginBottom: '8px', fontSize: '10px' }}>
                        <div style={{ border: '1px solid #000', padding: '3px 6px' }}>
                            <strong>Receipt No:</strong> {receipt.receiptNo}
                        </div>
                        <div style={{ border: '1px solid #000', padding: '3px 6px', minWidth: '150px' }}>
                            {formatDate(receipt.date)} {new Date(receipt.date?.seconds * 1000 || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </div>
                    </div>

                    <div style={{ textAlign: 'center', margin: '6px 0', fontSize: '9px', fontStyle: 'italic' }}>
                        For PARENT - Fee Details of {receipt.paidFor || 'Current Month'}
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '10px' }}>
                        <tbody>
                            <tr>
                                <td style={{ border: '1px solid #000', padding: '3px 6px', width: '100px' }}><strong>Name</strong></td>
                                <td style={{ border: '1px solid #000', padding: '3px 6px' }}>{receipt.studentName?.toUpperCase()}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #000', padding: '3px 6px' }}><strong>Student ID</strong></td>
                                <td style={{ border: '1px solid #000', padding: '3px 6px' }}>{receipt.admissionNo}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #000', padding: '3px 6px' }}><strong>Class</strong></td>
                                <td style={{ border: '1px solid #000', padding: '3px 6px' }}>
                                    {receipt.class}{receipt.section ? `-${receipt.section}` : ''} <span style={{ float: 'right' }}><strong>Roll No:</strong> {receipt.rollNo || studentData?.classRollNo || studentData?.rollNo || 'N/A'}</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '10px' }}>
                        <tbody>
                            <tr>
                                <td style={{ border: '1px solid #000', padding: '3px 6px', width: '50%' }}><strong>Previous Dues</strong></td>
                                <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>{previousDues.toFixed(2)}</td>
                            </tr>
                            {receipt.items && receipt.items.length > 0 ? (
                                receipt.items.map((item: any, idx: number) => (
                                    <tr key={idx}>
                                        <td style={{ border: '1px solid #000', padding: '3px 6px' }}>
                                            {item.name}
                                            <span style={{ fontSize: '9px', fontWeight: 'normal', display: 'inline-block', marginLeft: '4px' }}>
                                                (₹{item.price} x {item.qty})
                                            </span>
                                        </td>
                                        <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>{(item.price * item.qty).toFixed(2)}</td>
                                    </tr>
                                ))
                            ) : receipt.feeBreakdown ? (
                                Object.entries(receipt.feeBreakdown).map(([feeName, amount]: [string, any]) => {
                                    const isMonthlyFee = feeName.toLowerCase().includes('monthly') ||
                                        feeName.toLowerCase().includes('tuition') ||
                                        feeName.toLowerCase().includes('tution');

                                    // Filter out "Additional" from paidFor string for display
                                    const displayPaidFor = receipt.paidFor
                                        ? receipt.paidFor.split(',')
                                            .map((s: string) => s.trim())
                                            .filter((s: string) => s !== 'Additional')
                                            .join(', ')
                                        : '';

                                    return (
                                        <tr key={feeName}>
                                            <td style={{ border: '1px solid #000', padding: '3px 6px' }}>
                                                {feeName.toLowerCase().includes('monthly') ? 'Tuition Fee' : feeName}
                                                {isMonthlyFee && displayPaidFor && (
                                                    <span style={{ fontSize: '9px', fontWeight: 'normal', display: 'inline-block', marginLeft: '4px' }}>
                                                        ({displayPaidFor})
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>{Number(amount).toFixed(2)}</td>
                                        </tr>
                                    );
                                })
                            ) : null}
                        </tbody>
                    </table>

                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '10px' }}>
                        <tbody>
                            <tr style={{ fontWeight: 700 }}>
                                <td style={{ border: '1px solid #000', padding: '4px 6px', width: '50%' }}>Grand Total</td>
                                <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{grandTotal.toFixed(2)}</td>
                            </tr>
                            {discount > 0 && (
                                <tr style={{ fontWeight: 700, color: '#d00' }}>
                                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>Discount (-)</td>
                                    <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>-{discount.toFixed(2)}</td>
                                </tr>
                            )}
                            <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                                <td style={{ border: '1px solid #000', padding: '4px 6px' }}>Net Payable</td>
                                <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{netPayable.toFixed(2)}</td>
                            </tr>
                            <tr style={{ fontWeight: 700, background: '#f0f0f0' }}>
                                <td style={{ border: '1px solid #000', padding: '4px 6px' }}>Paid Amount</td>
                                <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{totalPaid.toFixed(2)}</td>
                            </tr>
                            <tr style={{ fontWeight: 700, background: currentDues > 0 ? '#ffe0e0' : '#f0f0f0' }}>
                                <td style={{ border: '1px solid #000', padding: '4px 6px' }}>Current Dues</td>
                                <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', color: currentDues > 0 ? '#d00' : '#000' }}>{currentDues.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style={{ fontSize: '9px', marginTop: '5px' }}>
                        <strong>Words:</strong> {amountToWords(totalPaid)}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ borderTop: '1px solid #000', width: '120px', paddingTop: '3px', fontSize: '8px', fontWeight: 700 }}>
                                Office Seal & Sign
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FeeReceipt;
