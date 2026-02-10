import React, { useState } from 'react';
import { useFirestore } from '../../hooks/useFirestore';
import { FileDown, Search, IndianRupee, ArrowLeft, Printer, MessageCircle } from 'lucide-react';

import { formatDate } from '../../utils/dateUtils';
import { sortClasses } from '../../constants/app';
import { amountToWords } from '../../utils/formatters';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useSchool } from '../../context/SchoolContext';
import { Trash2, AlertTriangle, X } from 'lucide-react';

const FeeReport: React.FC = () => {
    const { currentSchool } = useSchool();
    const { data: feeRecords, loading } = useFirestore<any>('fee_collections');
    const { data: allSettings } = useFirestore<any>('settings');
    const activeClasses = sortClasses(allSettings?.filter((d: any) => d.type === 'class') || []);
    const classesList = activeClasses.map((c: any) => c.name);

    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedClass, setSelectedClass] = useState('');
    const [paymentStatus, setPaymentStatus] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [view, setView] = useState('REPORT');
    const [currentReceipt, setCurrentReceipt] = useState<any>(null);
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [showWipeModal, setShowWipeModal] = useState(false);
    const [wipeConfirmationText, setWipeConfirmationText] = useState('');
    const [isWiping, setIsWiping] = useState(false);
    const [showWipeButton, setShowWipeButton] = useState(false);

    const filteredRecords = feeRecords.filter(record => {
        // Extract date for filtering (need ISO format for comparison)
        let dateStr = '';
        if (record.date?.toDate) {
            dateStr = record.date.toDate().toISOString().split('T')[0];
        } else if (typeof record.date === 'string') {
            dateStr = record.date.split('T')[0];
        } else if (record.createdAt) {
            dateStr = record.createdAt.split('T')[0];
        }

        const matchesDate = dateStr && dateStr >= startDate && dateStr <= endDate;
        const matchesClass = !selectedClass || record.class === selectedClass;
        const matchesStatus = !paymentStatus || record.status === paymentStatus;
        const matchesSearch = !searchQuery ||
            (record.studentName && record.studentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (record.admissionNo && String(record.admissionNo).toLowerCase().includes(searchQuery.toLowerCase()));

        return matchesDate && matchesClass && matchesStatus && matchesSearch;
    });

    const totalAmount = filteredRecords.reduce((sum, r) => sum + (parseFloat(r.paid || r.amount) || 0), 0);
    const paidAmount = filteredRecords
        .filter(r => r.status === 'PAID')
        .reduce((sum, r) => sum + (parseFloat(r.paid || r.amount) || 0), 0);
    const pendingAmount = totalAmount - paidAmount;

    const handleExport = () => {
        const csvData = filteredRecords.map(r => ({
            'Date': formatDate(r.date),
            'Receipt No': r.receiptNo || r.id,
            'Admission No': r.admissionNo,
            'Student Name': r.studentName,
            'Class': r.class,
            'Fee Type': r.paidFor || 'Monthly Fee',
            'Amount': r.paid || r.amount,
            'Status': r.status,
            'Payment Mode': r.paymentMode || 'Cash'
        }));

        const csv = [
            Object.keys(csvData[0] || {}).join(','),
            ...csvData.map(row => Object.values(row).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fee-report-${startDate}-to-${endDate}.csv`;
        a.click();
    };

    const handleShowReceipt = async (record: any) => {
        setCurrentReceipt(record);
        // Fetch student details for additional info on receipt
        try {
            const studentQuery = query(
                collection(db, 'students'),
                where('admissionNo', '==', record.admissionNo),
                where('schoolId', '==', currentSchool?.id)
            );
            const studentSnapshot = await getDocs(studentQuery);
            if (!studentSnapshot.empty) {
                setSelectedStudent({ id: studentSnapshot.docs[0].id, ...studentSnapshot.docs[0].data() });
            } else {
                setSelectedStudent(null);
            }
        } catch (error) {
            console.error("Error fetching student for receipt:", error);
            setSelectedStudent(null);
        }
        setView('RECEIPT');
    };

    const handlePrint = () => {
        window.print();
    };

    const handleWhatsAppReceipt = async () => {
        try {
            const html2canvas = (await import('html2canvas')).default;
            const receiptElement = document.querySelector('.printable-receipt') as HTMLElement;
            if (!receiptElement) {
                alert('Receipt not found');
                return;
            }

            const canvas = await html2canvas(receiptElement, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false
            });

            canvas.toBlob(async (blob) => {
                if (!blob) {
                    alert('Failed to generate receipt image');
                    return;
                }

                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);

                    const mobileNumber = selectedStudent?.mobileNo || '';
                    const message = encodeURIComponent('Thanks for payment, Find attached money receipt.');
                    const whatsappUrl = `https://wa.me/${mobileNumber.replace(/[^0-9]/g, '')}?text=${message}`;
                    window.open(whatsappUrl, '_blank');
                    alert('Receipt copied to clipboard! Paste it in WhatsApp chat.');
                } catch (clipboardError) {
                    console.error('Clipboard error:', clipboardError);
                    alert('Receipt image generated but clipboard access denied.');
                }
            }, 'image/png');
        } catch (error) {
            console.error('Error generating WhatsApp receipt:', error);
            alert('Failed to generate receipt image.');
        }
    };

    const handleWipeAllData = async () => {
        if (wipeConfirmationText !== 'WIPE ALL DATA' || isWiping) return;

        setIsWiping(true);
        try {
            const q = query(
                collection(db, 'fee_collections'),
                where('schoolId', '==', currentSchool?.id)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                alert('No fee records found for this school.');
                setShowWipeModal(false);
                setIsWiping(false);
                return;
            }

            // Partition into batches of 400 (safety margin under 500)
            const docs = snapshot.docs;
            const batchSize = 400;

            for (let i = 0; i < docs.length; i += batchSize) {
                const batch = writeBatch(db);
                const chunk = docs.slice(i, i + batchSize);
                chunk.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }

            alert(`Successfully wiped ${docs.length} fee collection records.`);
            setShowWipeModal(false);
            setWipeConfirmationText('');
            // The useFirestore hook will automatically update the UI
        } catch (error) {
            console.error("Error wiping fee data:", error);
            alert('An error occurred while wiping data. Please try again.');
        } finally {
            setIsWiping(false);
        }
    };

    const renderReceipt = () => {
        if (!currentReceipt) return null;

        const receipt = currentReceipt;
        const totalPaid = receipt.paid || receipt.total || 0;
        const previousDues = receipt.previousDues || 0;
        const currentDues = (receipt.total || 0) - (receipt.paid || 0);

        const institutionInfo = allSettings?.find((item: any) =>
            item.id === 'school_info' ||
            item.type === 'school_info' ||
            item.type === 'institution' ||
            item.type === 'Institution Information'
        );

        const schoolName = currentSchool?.fullName || currentSchool?.name || institutionInfo?.name || institutionInfo?.schoolName || 'Millat Public School';
        const schoolAddress = currentSchool?.address || institutionInfo?.address || institutionInfo?.schoolAddress || 'Near Moti Nagar, Vickhara, PO-Tarwer, PS-Amnour, Saran Bihar';
        const schoolPhone = currentSchool?.phone || currentSchool?.contactNumber || institutionInfo?.phone || institutionInfo?.contact || institutionInfo?.mobile || '9570656404';
        const schoolWebsite = currentSchool?.website || institutionInfo?.website || institutionInfo?.web || 'www.millatschool.co.in';
        const schoolLogo = currentSchool?.logoUrl || currentSchool?.logo || institutionInfo?.logo || '/logo.png';

        return (
            <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <style>
                    {`
                        @media print {
                            body * { visibility: hidden; }
                            .printable-receipt, .printable-receipt * { visibility: visible; }
                            .printable-receipt { position: absolute; left: 0; top: 0; width: 100%; }
                            .no-print { display: none !important; }
                            @page { size: A5; margin: 0.5cm; }
                        }
                    `}
                </style>

                <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button onClick={() => setView('REPORT')} className="btn-icon"><ArrowLeft size={20} /></button>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Fee Receipt</h1>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={() => setView('REPORT')} className="btn">Back</button>
                        <button onClick={handleWhatsAppReceipt} className="btn" style={{ background: '#25D366', color: 'white' }}>
                            <MessageCircle size={18} /> WhatsApp
                        </button>
                        <button onClick={handlePrint} className="btn btn-primary"><Printer size={18} /> Print</button>
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
                        {/* Header with School Info */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '10px' }}>
                            <div style={{ width: '50px', height: '50px', marginRight: '10px', flexShrink: 0 }}>
                                <img
                                    src={schoolLogo}
                                    style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%', border: '2px solid #000' }}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        (e.target as HTMLImageElement).parentElement!.innerHTML = '<div style="width:50px;height:50px;border:2px solid #000;borderRadius:50%;display:flex;alignItems:center;justifyContent:center;fontSize:8px;fontWeight:700;textAlign:center">LOGO</div>';
                                    }}
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

                        {/* Receipt Info Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginBottom: '8px', fontSize: '10px' }}>
                            <div style={{ border: '1px solid #000', padding: '3px 6px' }}>
                                <strong>Receipt No:</strong> {receipt.receiptNo}
                            </div>
                            <div style={{ border: '1px solid #000', padding: '3px 6px', minWidth: '150px' }}>
                                {formatDate(receipt.date)} {new Date(receipt.date?.seconds * 1000 || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </div>
                        </div>

                        {/* For PARENT Label */}
                        <div style={{ textAlign: 'center', margin: '6px 0', fontSize: '9px', fontStyle: 'italic' }}>
                            For PARENT - Fee Details of {receipt.paidFor || 'Current Month'}
                        </div>

                        {/* Student Details Table */}
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
                                    <td style={{ border: '1px solid #000', padding: '3px 6px' }}><strong>Father's Name</strong></td>
                                    <td style={{ border: '1px solid #000', padding: '3px 6px' }}>{selectedStudent?.fatherName?.toUpperCase() || 'N/A'}</td>
                                </tr>
                                <tr>
                                    <td style={{ border: '1px solid #000', padding: '3px 6px' }}><strong>Class</strong></td>
                                    <td style={{ border: '1px solid #000', padding: '3px 6px' }}>
                                        {receipt.class}-{receipt.section} ({selectedStudent?.financeType || 'GENERAL'}) <span style={{ float: 'right' }}><strong>Roll No:</strong> {selectedStudent?.rollNo || 'N/A'}</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Fee Details Table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '10px' }}>
                            <tbody>
                                <tr>
                                    <td style={{ border: '1px solid #000', padding: '3px 6px', width: '50%' }}><strong>Previous Dues</strong></td>
                                    <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>{Number(previousDues).toFixed(2)}</td>
                                </tr>
                                {receipt.feeBreakdown && Object.entries(receipt.feeBreakdown).map(([feeName, amount]: [string, any]) => (
                                    <tr key={feeName}>
                                        <td style={{ border: '1px solid #000', padding: '3px 6px' }}>{feeName}</td>
                                        <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>{Number(amount).toFixed(2)}</td>
                                    </tr>
                                ))}
                                {receipt.discount > 0 && (
                                    <tr>
                                        <td style={{ border: '1px solid #000', padding: '3px 6px', color: '#d00' }}>Discount (-)</td>
                                        <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right', color: '#d00' }}>-{Number(receipt.discount).toFixed(2)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* Totals */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '10px' }}>
                            <tbody>
                                <tr style={{ fontWeight: 700 }}>
                                    <td style={{ border: '1px solid #000', padding: '4px 6px', width: '50%' }}>Total</td>
                                    <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{(receipt.total || 0).toFixed(2)}</td>
                                </tr>
                                <tr style={{ fontWeight: 700, background: '#f0f0f0' }}>
                                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>Paid Amount (in {receipt.paymentMode || 'CASH'})</td>
                                    <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{totalPaid.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}><strong>Amount In Words:</strong> {amountToWords(totalPaid)} Only</td>
                                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}></td>
                                </tr>
                                <tr style={{ fontWeight: 700, background: currentDues > 0 ? '#ffe0e0' : '#f0f0f0' }}>
                                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>Current Dues</td>
                                    <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', color: currentDues > 0 ? '#d00' : '#000' }}>{currentDues.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Instructions */}
                        <div style={{ fontSize: '8px', marginTop: '8px', padding: '6px', border: '1px solid #ccc', background: '#fafafa' }}>
                            <strong>Instructions:</strong><br />
                            • Please pay before 10th of every month.<br />
                            • Always update your mobile number for SMS notification.<br />
                            • This receipt is auto generated by computer only for information purpose.
                        </div>

                        {/* Footer */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ borderTop: '1px solid #000', width: '150px', paddingTop: '3px', fontSize: '9px', fontWeight: 700 }}>
                                    Authorised Signatory
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="no-scrollbar" style={{ paddingBottom: '3rem' }}>
            {view === 'REPORT' && (
                <div className="animate-fade-in">
                    <div className="page-header">
                        <div>
                            <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <IndianRupee
                                    size={32}
                                    color="var(--primary)"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setShowWipeButton(!showWipeButton)}
                                />
                                Fee Collection Report
                            </h1>
                            <p style={{ color: 'var(--text-muted)', fontSize: '1.0625rem' }}>View and analyze fee collection records</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            {showWipeButton && (
                                <button
                                    className="btn"
                                    onClick={() => setShowWipeModal(true)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        color: '#ef4444',
                                        borderColor: '#fee2e2',
                                        background: '#fff',
                                        fontWeight: 700
                                    }}
                                >
                                    <Trash2 size={18} /> Wipe All Data
                                </button>
                            )}
                            <button
                                className="btn btn-primary"
                                onClick={handleExport}
                                disabled={filteredRecords.length === 0}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                                <FileDown size={18} /> Export Report
                            </button>
                        </div>
                    </div>

                    {/* Statistics Cards */}
                    <div className="responsive-grid-auto" style={{ marginBottom: '2rem' }}>
                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Total Collections</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>₹{totalAmount.toFixed(2)}</div>
                        </div>
                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Paid</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#22c55e' }}>₹{paidAmount.toFixed(2)}</div>
                        </div>
                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Pending</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444' }}>₹{pendingAmount.toFixed(2)}</div>
                        </div>
                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Total Records</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>{filteredRecords.length}</div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                        <div className="responsive-grid-auto" style={{ gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Start Date</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>End Date</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Class</label>
                                <select
                                    className="input-field"
                                    value={selectedClass}
                                    onChange={(e) => setSelectedClass(e.target.value)}
                                >
                                    <option value="">All Classes</option>
                                    {classesList.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Payment Status</label>
                                <select
                                    className="input-field"
                                    value={paymentStatus}
                                    onChange={(e) => setPaymentStatus(e.target.value)}
                                >
                                    <option value="">All Status</option>
                                    <option value="PAID">Paid</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="PARTIAL">Partial</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Search</label>
                                <div style={{ position: 'relative' }}>
                                    <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        placeholder="Name or ID..."
                                        className="input-field"
                                        style={{ paddingLeft: '2.5rem' }}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Results Table */}
                    <div className="glass-card" style={{ padding: '0' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', background: '#f8f9fa' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <IndianRupee size={20} style={{ color: 'var(--primary)' }} />
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                                    Fee Collection Records ({filteredRecords.length})
                                </h3>
                            </div>
                        </div>

                        {loading ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Loading fee records...
                            </div>
                        ) : filteredRecords.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No fee records found for the selected criteria
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', background: '#f8f9fa' }}>
                                            <th style={{ padding: '1rem' }}>Date</th>
                                            <th style={{ padding: '1rem' }}>Receipt No</th>
                                            <th style={{ padding: '1rem' }}>Student</th>
                                            <th style={{ padding: '1rem' }}>Class</th>
                                            <th style={{ padding: '1rem' }}>Fee Type</th>
                                            <th style={{ padding: '1rem' }}>Amount</th>
                                            <th style={{ padding: '1rem' }}>Status</th>
                                            <th style={{ padding: '1rem' }}>Mode</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRecords.map((record, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '1rem' }}>{formatDate(record.date)}</td>
                                                <td style={{ padding: '1rem' }}>
                                                    <button
                                                        onClick={() => handleShowReceipt(record)}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            color: 'var(--primary)',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            padding: 0
                                                        }}
                                                    >
                                                        {record.receiptNo || record.id}
                                                    </button>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <div>{record.studentName}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{record.admissionNo}</div>
                                                </td>
                                                <td style={{ padding: '1rem' }}>{record.class}</td>
                                                <td style={{ padding: '1rem' }}>{record.paidFor || 'Monthly Fee'}</td>
                                                <td style={{ padding: '1rem', fontWeight: 600 }}>₹{parseFloat(record.paid || record.amount || 0).toFixed(2)}</td>
                                                <td style={{ padding: '1rem' }}>
                                                    <span className={`badge ${record.status === 'PAID' ? 'badge-success' :
                                                        record.status === 'PARTIAL' ? 'badge-warning' :
                                                            'badge-danger'
                                                        }`}>
                                                        {record.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem' }}>{record.paymentMode || 'Cash'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {view === 'RECEIPT' && renderReceipt()}

            {/* Wipe Confirmation Modal */}
            {showWipeModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div className="glass-card" style={{
                        width: '100%',
                        maxWidth: '500px',
                        padding: '2rem',
                        position: 'relative',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                        animation: 'slideUp 0.3s ease-out'
                    }}>
                        <button
                            onClick={() => {
                                if (!isWiping) {
                                    setShowWipeModal(false);
                                    setWipeConfirmationText('');
                                }
                            }}
                            style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                        >
                            <X size={24} />
                        </button>

                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                background: '#fee2e2',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1rem',
                                color: '#ef4444'
                            }}>
                                <AlertTriangle size={36} />
                            </div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', marginBottom: '0.5rem' }}>Are you absolutely sure?</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                                This action <strong style={{ color: '#ef4444' }}>CANNOT BE UNDONE</strong>. It will permanently delete all fee collection records for this school.
                            </p>
                        </div>

                        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                            <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '0.75rem', textAlign: 'center' }}>
                                To confirm, please type <strong style={{ color: '#111827', userSelect: 'all' }}>WIPE ALL DATA</strong> in the box below:
                            </p>
                            <input
                                type="text"
                                className="input-field"
                                autoFocus
                                value={wipeConfirmationText}
                                onChange={(e) => setWipeConfirmationText(e.target.value)}
                                placeholder="Type the text exactly..."
                                style={{
                                    textAlign: 'center',
                                    fontWeight: 700,
                                    borderColor: wipeConfirmationText === 'WIPE ALL DATA' ? '#22c55e' : 'var(--border)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                className="btn"
                                style={{ flex: 1, fontWeight: 700 }}
                                onClick={() => {
                                    setShowWipeModal(false);
                                    setWipeConfirmationText('');
                                }}
                                disabled={isWiping}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                style={{
                                    flex: 2,
                                    background: wipeConfirmationText === 'WIPE ALL DATA' ? '#ef4444' : '#fca5a5',
                                    border: 'none',
                                    fontWeight: 800,
                                    opacity: wipeConfirmationText === 'WIPE ALL DATA' ? 1 : 0.7,
                                    cursor: wipeConfirmationText === 'WIPE ALL DATA' ? 'pointer' : 'not-allowed'
                                }}
                                onClick={handleWipeAllData}
                                disabled={wipeConfirmationText !== 'WIPE ALL DATA' || isWiping}
                            >
                                {isWiping ? 'Wiping Records...' : 'Confirm Wipe All Data'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FeeReport;
