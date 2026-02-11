import React from 'react';
import { Printer, MessageCircle, ArrowLeft, Check } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import { amountToWords } from '../../utils/formatters';
import { useSchool } from '../../context/SchoolContext';

interface FeeReceiptProps {
    receipt: any;
    studentData: any;
    schoolInfo: any;
    onClose: () => void;
}

const FeeReceipt: React.FC<FeeReceiptProps> = ({ receipt, studentData, schoolInfo, onClose }) => {
    const { currentSchool } = useSchool();
    if (!receipt) return null;

    const totalPaid = receipt.paid || receipt.total || 0;
    const previousDues = receipt.previousDues || 0;
    const currentDues = ((receipt.total || 0) - (receipt.discount || 0)) - (receipt.paid || 0);

    // Prioritize name and logo from currentSchool (SuperAdmin settings)
    const schoolName = currentSchool?.fullName || currentSchool?.name || schoolInfo?.name || schoolInfo?.schoolName || 'Millat Public School';
    const schoolAddress = currentSchool?.address || schoolInfo?.address || schoolInfo?.schoolAddress || 'Near Moti Nagar, Vickhara, PO-Tarwer, PS-Amnour, Saran Bihar';
    const schoolPhone = currentSchool?.phone || currentSchool?.contactNumber || schoolInfo?.phone || schoolInfo?.contact || schoolInfo?.mobile || '9570656404';
    const schoolWebsite = currentSchool?.website || schoolInfo?.website || schoolInfo?.web || currentSchool?.web || 'www.millatschool.co.in';
    const schoolLogo = currentSchool?.logoUrl || currentSchool?.logo || schoolInfo?.logoUrl || schoolInfo?.logo || '/logo.png';

    const handlePrint = () => {
        window.print();
    };

    const handleWhatsAppReceipt = async () => {
        try {
            const html2canvas = (await import('html2canvas')).default;
            const receiptElement = document.querySelector('.printable-receipt') as HTMLElement;
            if (!receiptElement) return;

            // Debug: Log logo information
            console.log('WhatsApp Share - School Logo:', schoolLogo);
            console.log('WhatsApp Share - currentSchool:', currentSchool);
            console.log('WhatsApp Share - schoolInfo:', schoolInfo);

            // Try to preload the logo to ensure it's available for canvas
            const logoImg = receiptElement.querySelector('img[alt="Logo"]') as HTMLImageElement;
            if (logoImg && logoImg.src) {
                console.log('WhatsApp Share - Logo img src:', logoImg.src);
                console.log('WhatsApp Share - Logo complete:', logoImg.complete);
                console.log('WhatsApp Share - Logo naturalWidth:', logoImg.naturalWidth);

                // Convert relative URL to absolute if needed
                if (logoImg.src.startsWith('/')) {
                    const absoluteUrl = window.location.origin + logoImg.src;
                    console.log('Converting relative URL to absolute:', absoluteUrl);
                    logoImg.src = absoluteUrl;
                }

                try {
                    // Wait for image to be fully loaded
                    if (!logoImg.complete || logoImg.naturalWidth === 0) {
                        console.log('Waiting for logo to load...');
                        await new Promise((resolve) => {
                            logoImg.onload = () => {
                                console.log('Logo loaded successfully');
                                resolve(null);
                            };
                            logoImg.onerror = (e) => {
                                console.error('Logo failed to load:', e);
                                resolve(null);
                            };
                            // Timeout after 3 seconds
                            setTimeout(() => {
                                console.warn('Logo load timeout');
                                resolve(null);
                            }, 3000);
                        });
                    } else {
                        console.log('Logo already loaded');
                    }
                } catch (e) {
                    console.error('Logo load wait failed:', e);
                }
            } else {
                console.warn('Logo img element not found or no src');
            }


            const canvas = await html2canvas(receiptElement, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: false,
                allowTaint: true
            });

            canvas.toBlob(async (blob) => {
                if (!blob) return;
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    const mobileNumber = studentData?.mobileNo || '';
                    const message = encodeURIComponent('Thanks for payment, Find attached money receipt.');
                    const whatsappUrl = `https://wa.me/${mobileNumber.replace(/[^0-9]/g, '')}?text=${message}`;
                    window.open(whatsappUrl, '_blank');
                    alert('Receipt copied to clipboard! Paste it in WhatsApp chat.');
                } catch (e) {
                    alert('Clipboard access denied. Please allow permissions.');
                }
            }, 'image/png');
        } catch (error) {
            console.error('WhatsApp receipt error:', error);
            alert('Failed to generate receipt image.');
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
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={handleWhatsAppReceipt} className="btn" style={{ background: '#25D366', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <MessageCircle size={18} /> WhatsApp
                    </button>
                    <button onClick={handlePrint} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Printer size={18} /> Print
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
                    <div style={{ display: 'flex', alignItems: 'flex-start', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '10px' }}>
                        <div style={{ width: '50px', height: '50px', marginRight: '10px', flexShrink: 0 }}>
                            <img
                                src={schoolLogo}
                                alt="Logo"
                                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%', border: '2px solid #000' }}
                            />
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#8B0000' }}>{schoolName}</h2>
                            <p style={{ margin: '2px 0', fontSize: '10px' }}>{schoolAddress}</p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '3px', fontSize: '9px' }}>
                                <span>📱 {schoolPhone}</span>
                                <span>🌐 {schoolWebsite}</span>
                            </div>
                        </div>
                    </div>

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
                                    {receipt.class}{receipt.section ? `-${receipt.section}` : ''} <span style={{ float: 'right' }}><strong>Mode:</strong> {receipt.paymentMode || 'CASH'}</span>
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
                            {receipt.feeBreakdown ? (
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
                                                {feeName}
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
                            ) : (
                                <>
                                    {receipt.tuitionFee > 0 && (
                                        <tr>
                                            <td style={{ border: '1px solid #000', padding: '3px 6px' }}>Tuition Fee</td>
                                            <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>{receipt.tuitionFee.toFixed(2)}</td>
                                        </tr>
                                    )}
                                    {/* ... add more if needed, but breakdown is preferred */}
                                </>
                            )}
                            {receipt.discount > 0 && (
                                <tr>
                                    <td style={{ border: '1px solid #000', padding: '3px 6px', color: '#d00' }}>Discount (-)</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right', color: '#d00' }}>-{receipt.discount.toFixed(2)}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '10px' }}>
                        <tbody>
                            <tr style={{ fontWeight: 700 }}>
                                <td style={{ border: '1px solid #000', padding: '4px 6px', width: '50%' }}>Total Payable</td>
                                <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{((receipt.total || 0) - (receipt.discount || 0)).toFixed(2)}</td>
                            </tr>
                            <tr style={{ fontWeight: 700, background: '#f0f0f0' }}>
                                <td style={{ border: '1px solid #000', padding: '4px 6px' }}>Paid Amount</td>
                                <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{totalPaid.toFixed(2)}</td>
                            </tr>
                            <tr style={{ fontWeight: 700, background: currentDues > 0 ? '#ffe0e0' : '#f0f0f0' }}>
                                <td style={{ border: '1px solid #000', padding: '4px 6px' }}>Balance Dues</td>
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
