import React, { useState } from 'react';
import { useFirestore } from '../../hooks/useFirestore';
import { FileDown, Search, IndianRupee, Trash2, AlertTriangle, X, Ban } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';
import { sortClasses } from '../../constants/app';

import { collection, query, where, getDocs, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useSchool } from '../../context/SchoolContext';
import FeeReceipt from '../../components/fees/FeeReceipt';

const toLocalISODate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const getLocalDateStr = (record: any): string => {
    let dateObj: Date | null = null;
    if (record.date?.toDate) {
        dateObj = record.date.toDate();
    } else if (typeof record.date === 'string') {
        dateObj = new Date(record.date);
    } else if (record.createdAt) {
        dateObj = new Date(record.createdAt);
    }

    if (dateObj && !isNaN(dateObj.getTime())) {
        return toLocalISODate(dateObj);
    }

    if (typeof record.date === 'string') return record.date.split('T')[0];
    if (typeof record.createdAt === 'string') return record.createdAt.split('T')[0];
    return '';
};

const FeeReport: React.FC = () => {
    const { currentSchool } = useSchool();
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
    const { data: feeRecords, loading } = useFirestore<any>('fee_collections');
    const { data: allSettings } = useFirestore<any>('settings');
    const activeClasses = sortClasses(allSettings?.filter((d: any) => d.type === 'class') || []);
    const classesList = activeClasses.map((c: any) => c.name);

    const [startDate, setStartDate] = useState(toLocalISODate(new Date()));
    const [endDate, setEndDate] = useState(toLocalISODate(new Date()));
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedPeriod, setSelectedPeriod] = useState('TODAY');
    const [selectedCategories, setSelectedCategories] = useState(['FEES', 'INVENTORY']);
    const [searchQuery, setSearchQuery] = useState('');
    const [view, setView] = useState('REPORT');
    const [currentReceipt, setCurrentReceipt] = useState<any>(null);
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [showWipeModal, setShowWipeModal] = useState(false);
    const [wipeConfirmationText, setWipeConfirmationText] = useState('');
    const [isWiping, setIsWiping] = useState(false);
    const [showWipeButton, setShowWipeButton] = useState(false);

    // Cancellation state
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelRecord, setCancelRecord] = useState<any>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);

    // Tab: 'ACTIVE' | 'CANCELLED'
    const [recordTab, setRecordTab] = useState<'ACTIVE' | 'CANCELLED'>('ACTIVE');
    const [reportMode, setReportMode] = useState<'DETAILED' | 'CONSOLIDATED'>('DETAILED');


    const getPeriodDates = (period: string) => {
        const today = new Date();

        let start = toLocalISODate(today);
        let end = toLocalISODate(today);

        if (period === 'THIS_MONTH') {
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            start = toLocalISODate(firstDay);
        } else if (period === 'LAST_MONTH') {
            const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            start = toLocalISODate(firstDayLastMonth);
            end = toLocalISODate(lastDayLastMonth);
        } else if (period === 'ACADEMIC_YEAR') {
            const MONTH_MAP: Record<string, number> = {
                'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
                'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
            };
            const institutionInfo = allSettings?.find((item: any) =>
                item.id === 'school_info' || item.type === 'school_info' || item.type === 'institution'
            );
            const academicStartMonthName = currentSchool?.academicYearStartMonth || institutionInfo?.sessionStartMonth || 'April';
            const sessionMonth = MONTH_MAP[academicStartMonthName] !== undefined ? MONTH_MAP[academicStartMonthName] : 3;

            const currentMonth = today.getMonth();
            const startYear = currentMonth < sessionMonth ? today.getFullYear() - 1 : today.getFullYear();
            const startDateObj = new Date(startYear, sessionMonth, 1);
            const endDateObj = new Date(startYear + 1, sessionMonth, 0);
            start = toLocalISODate(startDateObj);
            end = toLocalISODate(endDateObj);
        }
        return { startDate: start, endDate: end };
    };

    const getRecordTimestamp = (record: any): number => {
        if (record.date?.toDate) return record.date.toDate().getTime();
        if (typeof record.date === 'string') return new Date(record.date).getTime() || 0;
        if (record.createdAt) return new Date(record.createdAt).getTime() || 0;
        return 0;
    };

    const getRecordTime = (record: any): string => {
        try {
            if (record.date?.toDate) return record.date.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            if (typeof record.date === 'string' && record.date.includes('T')) return new Date(record.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            if (record.createdAt && record.createdAt.includes('T')) return new Date(record.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch { }
        return '';
    };

    // Base filter (date + class + category + search)
    const baseFilteredRecords = feeRecords.filter((record: any) => {
        const dateStr = getLocalDateStr(record);

        const isInventory = record.paidFor === 'Inventory Sale' || record.receiptNo?.startsWith('INV');
        const isFee = !isInventory;
        const matchesCategory = (selectedCategories.includes('FEES') && isFee) || (selectedCategories.includes('INVENTORY') && isInventory);
        const matchesDate = dateStr && dateStr >= startDate && dateStr <= endDate;
        const matchesClass = !selectedClass || record.class === selectedClass;
        const matchesSearch = !searchQuery ||
            (record.studentName && record.studentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (record.admissionNo && String(record.admissionNo).toLowerCase().includes(searchQuery.toLowerCase()));

        return matchesDate && matchesClass && matchesCategory && matchesSearch;
    }).sort((a: any, b: any) => getRecordTimestamp(b) - getRecordTimestamp(a));

    // Active = not cancelled
    const filteredRecords = baseFilteredRecords.filter((r: any) => r.status !== 'CANCELLED');

    const EXAM_FEE_TITLES = ['1st Term Exam Fee', '2nd Term Exam Fee', 'Annual Exam Fee', 'Practical Exam Fee', 'Exam Fee'];

    const getConsolidatedData = () => {
        const groups: Record<string, any> = {};
        const allDynamicHeads = new Set<string>();

        // Sort filteredRecords by date ascending for the report
        const sorted = [...filteredRecords].sort((a, b) => getRecordTimestamp(a) - getRecordTimestamp(b));

        sorted.forEach(record => {
            const dateKey = getLocalDateStr(record);

            if (!dateKey) return;

            if (!groups[dateKey]) {
                groups[dateKey] = {
                    date: dateKey,
                    values: {} as Record<string, number>,
                    total: 0
                };
            }

            const g = groups[dateKey];
            const breakdown = record.feeBreakdown || {};

            if (Object.keys(breakdown).length === 0) {
                const amount = parseFloat(record.paid || record.amount) || 0;
                let head = record.paidFor || 'Unknown';

                if (EXAM_FEE_TITLES.some(t => head.includes(t))) {
                    head = 'Exam Fees';
                }

                g.values[head] = (g.values[head] || 0) + amount;
                g.total += amount;
                allDynamicHeads.add(head);
            } else {
                Object.entries(breakdown).forEach(([head, amount]: [string, any]) => {
                    const val = parseFloat(amount) || 0;
                    let targetHead = head;

                    if (EXAM_FEE_TITLES.some(t => head.includes(t))) {
                        targetHead = 'Exam Fees';
                    }

                    g.values[targetHead] = (g.values[targetHead] || 0) + val;
                    allDynamicHeads.add(targetHead);
                });

                const discount = parseFloat(record.discount) || 0;
                if (discount > 0) {
                    g.values['Discount'] = (g.values['Discount'] || 0) - discount;
                    allDynamicHeads.add('Discount');
                }

                const prevDues = parseFloat(record.previousDues) || 0;
                if (prevDues > 0) {
                    g.values['Prev. Dues'] = (g.values['Prev. Dues'] || 0) + prevDues;
                    allDynamicHeads.add('Prev. Dues');
                }

                const actualPaid = parseFloat(record.paid || record.amount) || 0;
                g.total += actualPaid;
            }
        });

        // Filter heads that have a non-zero total
        const finalHeads = Array.from(allDynamicHeads).filter(head => {
            const headTotal = Object.values(groups).reduce((acc, g) => acc + (g.values[head] || 0), 0);
            return Math.abs(headTotal) > 0.01;
        }).sort((a, b) => {
            if (a === 'Monthly Fee') return -1;
            if (b === 'Monthly Fee') return 1;
            if (a === 'Admission Fees' || a === 'Admission Fee') return -1;
            if (b === 'Admission Fees' || b === 'Admission Fee') return 1;
            return a.localeCompare(b);
        });

        return { data: Object.values(groups), heads: finalHeads };
    };

    const { data: consolidatedData, heads: consolidatedHeads } = getConsolidatedData();
    // Cancelled records (date + class + category + search)
    const cancelledRecords = feeRecords.filter((record: any) => {
        if (record.status !== 'CANCELLED') return false;
        const dateStr = getLocalDateStr(record);
        const isInventory = record.paidFor === 'Inventory Sale' || record.receiptNo?.startsWith('INV');
        const isFee = !isInventory;
        const matchesCategory = (selectedCategories.includes('FEES') && isFee) || (selectedCategories.includes('INVENTORY') && isInventory);
        const matchesDate = dateStr && dateStr >= startDate && dateStr <= endDate;
        const matchesClass = !selectedClass || record.class === selectedClass;
        const matchesSearch = !searchQuery ||
            (record.studentName && record.studentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (record.admissionNo && String(record.admissionNo).toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesDate && matchesCategory && matchesClass && matchesSearch;
    }).sort((a: any, b: any) => getRecordTimestamp(b) - getRecordTimestamp(a));

    const cancelledTotalAmount = cancelledRecords.reduce((sum: number, r: any) => sum + (parseFloat(r.paid || r.amount) || 0), 0);

    const displayRecords = recordTab === 'ACTIVE' ? filteredRecords : cancelledRecords;

    const handleExportConsolidated = () => {
        const headers = ['Date', ...consolidatedHeads, 'Total'];
        const csvRows = consolidatedData.map(d => {
            const row = [
                formatDate(d.date),
                ...consolidatedHeads.map(h => d.values[h] || ''),
                d.total
            ];
            return row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        });

        const csvContent = [headers.join(','), ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Consolidated_Fee_Report_${startDate}_to_${endDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const totalAmount = filteredRecords.reduce((sum: number, r: any) => sum + (parseFloat(r.paid || r.amount) || 0), 0);
    const cashAmount = filteredRecords
        .filter((r: any) => !r.paymentMode || r.paymentMode === 'Cash')
        .reduce((sum: number, r: any) => sum + (parseFloat(r.paid || r.amount) || 0), 0);
    const onlineAmount = totalAmount - cashAmount;

    const handleExport = () => {
        if (reportMode === 'CONSOLIDATED') {
            handleExportConsolidated();
            return;
        }
        const csvData = displayRecords.map((r: any) => ({
            'Date': formatDate(r.date),
            'Receipt No': r.receiptNo || r.id,
            'Admission No': r.admissionNo,
            'Student Name': r.studentName,
            'Class': `${r.class || ''}${r.section ? ` - ${r.section}` : ''}`,
            'Fee Type': r.paidFor || 'Monthly Fee',
            'Amount': r.paid || r.amount,
            'Status': r.status,
            'Payment Mode': r.paymentMode || 'Cash',
            'Cancel Reason': r.cancellationReason || ''
        }));

        // Wrap each value in double-quotes so commas inside values (e.g. multi-month fee types) don't split columns
        const escapeCSV = (value: any) => {
            const str = String(value ?? '');
            return `"${str.replace(/"/g, '""')}"`;
        };

        const csv = [
            Object.keys(csvData[0] || {}).map(escapeCSV).join(','),
            ...csvData.map((row: any) => Object.values(row).map(escapeCSV).join(','))
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

    const renderReceipt = () => {
        if (!currentReceipt) return null;

        const institutionInfo = allSettings?.find((item: any) =>
            item.id === 'school_info' ||
            item.type === 'school_info' ||
            item.type === 'institution' ||
            item.type === 'Institution Information'
        );

        return (
            <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <FeeReceipt
                    receipt={currentReceipt}
                    studentData={selectedStudent}
                    schoolInfo={institutionInfo}
                    onClose={() => setView('REPORT')}
                />
            </div>
        );
    };

    // Open cancel modal
    const openCancelModal = (record: any) => {
        setCancelRecord(record);
        setCancelReason('');
        setShowCancelModal(true);
    };

    // Confirm cancel
    const handleConfirmCancel = async () => {
        if (!cancelRecord?.id || !cancelReason.trim()) return;
        setIsCancelling(true);
        try {
            await updateDoc(doc(db, 'fee_collections', cancelRecord.id), {
                status: 'CANCELLED',
                cancellationReason: cancelReason.trim(),
                cancelledAt: new Date().toISOString(),
                cancelledBy: user?.name || user?.username || 'Admin'
            });
            setShowCancelModal(false);
            setCancelRecord(null);
            setCancelReason('');
        } catch (error) {
            console.error('Error cancelling fee record:', error);
            alert('Record cancel करने में error आई। कृपया दोबारा try करें।');
        } finally {
            setIsCancelling(false);
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
        } catch (error) {
            console.error("Error wiping fee data:", error);
            alert('An error occurred while wiping data. Please try again.');
        } finally {
            setIsWiping(false);
        }
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
                                disabled={displayRecords.length === 0}
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
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>₹{totalAmount.toLocaleString('en-IN')}</div>
                        </div>
                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Cash / Online</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#22c55e' }}>₹{cashAmount.toLocaleString('en-IN')}</span>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>/</span>
                                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6366f1' }}>₹{onlineAmount.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Total Records</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>{filteredRecords.length}</div>
                        </div>
                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Cancelled</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444' }}>{cancelledRecords.length}</div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                            {['TODAY', 'THIS_MONTH', 'LAST_MONTH', 'ACADEMIC_YEAR'].map(period => (
                                <button
                                    key={period}
                                    onClick={() => {
                                        setSelectedPeriod(period);
                                        const { startDate, endDate } = getPeriodDates(period);
                                        setStartDate(startDate);
                                        setEndDate(endDate);
                                    }}
                                    style={{
                                        padding: '0.5rem 1.25rem',
                                        borderRadius: '2rem',
                                        border: '1px solid',
                                        borderColor: selectedPeriod === period ? 'var(--primary)' : 'var(--border)',
                                        background: selectedPeriod === period ? 'var(--primary)' : 'white',
                                        color: selectedPeriod === period ? 'white' : 'var(--text-muted)',
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: selectedPeriod === period ? '0 4px 12px var(--primary-glow)' : 'none',
                                        textTransform: 'capitalize'
                                    }}
                                >
                                    {period.replace('_', ' ').toLowerCase()}
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '0.5rem' }}>Category:</span>
                            {['FEES', 'INVENTORY'].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => {
                                        if (selectedCategories.includes(cat)) {
                                            if (selectedCategories.length > 1) {
                                                setSelectedCategories(selectedCategories.filter(c => c !== cat));
                                            }
                                        } else {
                                            setSelectedCategories([...selectedCategories, cat]);
                                        }
                                    }}
                                    style={{
                                        padding: '0.5rem 1.25rem',
                                        borderRadius: '2rem',
                                        border: '1px solid',
                                        borderColor: selectedCategories.includes(cat) ? 'var(--primary)' : 'var(--border)',
                                        background: selectedCategories.includes(cat) ? 'var(--primary)' : 'white',
                                        color: selectedCategories.includes(cat) ? 'white' : 'var(--text-muted)',
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: selectedCategories.includes(cat) ? '0 4px 12px var(--primary-glow)' : 'none'
                                    }}
                                >
                                    {cat.charAt(0) + cat.slice(1).toLowerCase()}
                                </button>
                            ))}
                        </div>

                        <div className="responsive-grid-auto" style={{ gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Start Date</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        setSelectedPeriod('CUSTOM');
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>End Date</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={endDate}
                                    onChange={(e) => {
                                        setEndDate(e.target.value);
                                        setSelectedPeriod('CUSTOM');
                                    }}
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
                        {/* Tab Header */}
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <IndianRupee size={20} style={{ color: 'var(--primary)' }} />
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                                        Fee Collection Records
                                    </h3>
                                </div>

                                {/* Report Style Toggle */}
                                {recordTab === 'ACTIVE' && (
                                    <div style={{
                                        display: 'flex',
                                        background: '#f1f5f9',
                                        padding: '0.25rem',
                                        borderRadius: '0.75rem',
                                        border: '1px solid #e2e8f0'
                                    }}>
                                        <button
                                            onClick={() => setReportMode('DETAILED')}
                                            style={{
                                                padding: '0.35rem 1rem',
                                                borderRadius: '0.5rem',
                                                border: 'none',
                                                background: reportMode === 'DETAILED' ? 'white' : 'transparent',
                                                color: reportMode === 'DETAILED' ? 'var(--primary)' : '#64748b',
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                boxShadow: reportMode === 'DETAILED' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            Detailed List
                                        </button>
                                        <button
                                            onClick={() => setReportMode('CONSOLIDATED')}
                                            style={{
                                                padding: '0.35rem 1rem',
                                                borderRadius: '0.5rem',
                                                border: 'none',
                                                background: reportMode === 'CONSOLIDATED' ? 'white' : 'transparent',
                                                color: reportMode === 'CONSOLIDATED' ? 'var(--primary)' : '#64748b',
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                boxShadow: reportMode === 'CONSOLIDATED' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            Consolidated Report
                                        </button>
                                    </div>
                                )}
                            </div>
                            {/* Tab switcher */}
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={() => setRecordTab('ACTIVE')}
                                    style={{
                                        padding: '0.4rem 1.1rem',
                                        borderRadius: '2rem',
                                        border: '1.5px solid',
                                        borderColor: recordTab === 'ACTIVE' ? 'var(--primary)' : 'var(--border)',
                                        background: recordTab === 'ACTIVE' ? 'var(--primary)' : 'white',
                                        color: recordTab === 'ACTIVE' ? 'white' : 'var(--text-muted)',
                                        fontWeight: 600,
                                        fontSize: '0.82rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem'
                                    }}
                                >
                                    Active ({filteredRecords.length})
                                </button>
                                <button
                                    onClick={() => setRecordTab('CANCELLED')}
                                    style={{
                                        padding: '0.4rem 1.1rem',
                                        borderRadius: '2rem',
                                        border: '1.5px solid',
                                        borderColor: recordTab === 'CANCELLED' ? '#ef4444' : 'var(--border)',
                                        background: recordTab === 'CANCELLED' ? '#ef4444' : 'white',
                                        color: recordTab === 'CANCELLED' ? 'white' : '#ef4444',
                                        fontWeight: 600,
                                        fontSize: '0.82rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem'
                                    }}
                                >
                                    <Ban size={13} />
                                    Cancelled ({cancelledRecords.length}) — ₹{cancelledTotalAmount.toLocaleString('en-IN')}
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Loading fee records...
                            </div>
                        ) : displayRecords.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                {recordTab === 'CANCELLED'
                                    ? 'कोई cancelled receipt नहीं मिली।'
                                    : 'No fee records found for the selected criteria'}
                            </div>
                        ) : reportMode === 'CONSOLIDATED' && recordTab === 'ACTIVE' ? (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '1rem', fontWeight: 800 }}>Date</th>
                                            {consolidatedHeads.map(head => (
                                                <th key={head} style={{ padding: '1rem', fontWeight: 800 }}>{head}</th>
                                            ))}
                                            <th style={{ padding: '1rem', fontWeight: 800, background: '#f1f5f9' }}>Day Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {consolidatedData.map((d: any, idx: number) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover-row">
                                                <td style={{ padding: '1rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatDate(d.date)}</td>
                                                {consolidatedHeads.map(head => (
                                                    <td key={head}
                                                        style={{
                                                            padding: '1rem',
                                                            color: d.values[head] > 0 ? (
                                                                head.includes('Monthly') ? '#0284c7' :
                                                                    head.includes('Exam') ? '#7c3aed' :
                                                                        head.includes('Admission') ? '#059669' : '#4b5563'
                                                            ) : '#94a3b8'
                                                        }}
                                                    >
                                                        {d.values[head] > 0 ? `₹${d.values[head]}` : '-'}
                                                    </td>
                                                ))}
                                                <td style={{ padding: '1rem', fontWeight: 800, background: '#f1f5f9' }}>₹{d.total}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot style={{ background: '#f8fafc', fontWeight: 800 }}>
                                        <tr>
                                            <td style={{ padding: '1.25rem 1rem' }}>GRAND TOTAL</td>
                                            {consolidatedHeads.map(head => (
                                                <td key={head} style={{ padding: '1.25rem 1rem' }}>
                                                    ₹{consolidatedData.reduce((s, d) => s + (d.values[head] || 0), 0).toFixed(0)}
                                                </td>
                                            ))}
                                            <td style={{ padding: '1.25rem 1rem', background: 'var(--primary)', color: 'white' }}>₹{consolidatedData.reduce((s, d) => s + d.total, 0).toFixed(0)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', background: '#f8f9fa' }}>
                                            <th style={{ padding: '1rem' }}>Date &amp; Time</th>
                                            <th style={{ padding: '1rem' }}>Receipt No</th>
                                            <th style={{ padding: '1rem' }}>Student</th>
                                            <th style={{ padding: '1rem' }}>Class</th>
                                            <th style={{ padding: '1rem' }}>Fee Type</th>
                                            <th style={{ padding: '1rem' }}>Amount</th>
                                            <th style={{ padding: '1rem' }}>Status</th>
                                            <th style={{ padding: '1rem' }}>Mode</th>
                                            {recordTab === 'CANCELLED' && (
                                                <th style={{ padding: '1rem', color: '#ef4444' }}>Cancel Reason</th>
                                            )}
                                            {isAdmin && recordTab === 'ACTIVE' && (
                                                <th style={{ padding: '1rem' }}>Action</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayRecords.map((record: any, idx: number) => (
                                            <tr
                                                key={record.id || idx}
                                                style={{
                                                    borderBottom: '1px solid var(--border)',
                                                    background: record.status === 'CANCELLED' ? '#fff5f5' : 'white',
                                                    opacity: record.status === 'CANCELLED' ? 0.85 : 1
                                                }}
                                            >
                                                <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                                                    <div style={{ fontWeight: 600 }}>{formatDate(record.date)}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        {getRecordTime(record)}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <button
                                                        onClick={() => handleShowReceipt(record)}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            color: record.status === 'CANCELLED' ? '#ef4444' : 'var(--primary)',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            padding: 0,
                                                            textDecoration: record.status === 'CANCELLED' ? 'line-through' : 'none'
                                                        }}
                                                    >
                                                        {record.receiptNo || record.id}
                                                    </button>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <div>{record.studentName}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{record.admissionNo}</div>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    {record.class}
                                                    {record.section && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{record.section}</div>}
                                                </td>
                                                <td style={{ padding: '1rem' }}>{record.paidFor || 'Monthly Fee'}</td>
                                                <td style={{ padding: '1rem', fontWeight: 600 }}>₹{parseFloat(record.paid || record.amount || 0).toFixed(2)}</td>
                                                <td style={{ padding: '1rem' }}>
                                                    <span className={`badge ${record.status === 'PAID' ? 'badge-success' :
                                                        record.status === 'CANCELLED' ? 'badge-danger' :
                                                            record.status === 'PARTIAL' ? 'badge-warning' :
                                                                'badge-danger'
                                                        }`}>
                                                        {record.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem' }}>{record.paymentMode || 'Cash'}</td>

                                                {/* Cancel Reason column — only in cancelled tab */}
                                                {recordTab === 'CANCELLED' && (
                                                    <td style={{ padding: '1rem', maxWidth: '220px' }}>
                                                        <div style={{
                                                            fontSize: '0.82rem',
                                                            color: '#b91c1c',
                                                            background: '#fee2e2',
                                                            borderRadius: '0.4rem',
                                                            padding: '0.3rem 0.6rem',
                                                            display: 'inline-block',
                                                            fontWeight: 500
                                                        }}>
                                                            {record.cancellationReason || '—'}
                                                        </div>
                                                        {record.cancelledBy && (
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                                by {record.cancelledBy}
                                                            </div>
                                                        )}
                                                    </td>
                                                )}

                                                {/* Cancel action button — only in active tab, only for admin */}
                                                {isAdmin && recordTab === 'ACTIVE' && (
                                                    <td style={{ padding: '1rem' }}>
                                                        <button
                                                            onClick={() => openCancelModal(record)}
                                                            title="Cancel this receipt"
                                                            style={{
                                                                background: '#fff7ed',
                                                                border: '1px solid #fed7aa',
                                                                color: '#c2410c',
                                                                borderRadius: '0.4rem',
                                                                padding: '0.35rem 0.7rem',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.3rem',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 600,
                                                                transition: 'all 0.2s',
                                                                whiteSpace: 'nowrap'
                                                            }}
                                                        >
                                                            <Ban size={13} />
                                                            Cancel
                                                        </button>
                                                    </td>
                                                )}
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

            {/* ── Cancel Receipt Modal ── */}
            {showCancelModal && cancelRecord && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.55)',
                    backdropFilter: 'blur(6px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '1rem'
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '500px',
                        background: '#ffffff',
                        borderRadius: '1.25rem',
                        boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
                        overflow: 'hidden',
                        animation: 'slideUp 0.25s ease-out'
                    }}>
                        {/* Orange header strip */}
                        <div style={{
                            background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                            borderBottom: '1px solid #fed7aa',
                            padding: '1.25rem 1.5rem',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '1rem'
                        }}>
                            <div style={{
                                width: '42px', height: '42px', flexShrink: 0,
                                background: '#ffedd5', border: '2px solid #fb923c',
                                borderRadius: '50%', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', color: '#c2410c'
                            }}>
                                <Ban size={20} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#7c2d12', margin: 0, marginBottom: '0.3rem' }}>
                                    Receipt Cancel करें
                                </h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <span style={{
                                        background: '#fef3c7', border: '1px solid #fde68a',
                                        borderRadius: '0.35rem', padding: '0.1rem 0.5rem',
                                        fontSize: '0.76rem', fontWeight: 700, color: '#92400e'
                                    }}>
                                        {cancelRecord.receiptNo || cancelRecord.id}
                                    </span>
                                    <span style={{ fontSize: '0.8rem', color: '#9a3412', fontWeight: 600 }}>
                                        {cancelRecord.studentName}
                                    </span>
                                    {cancelRecord.class && (
                                        <span style={{ fontSize: '0.76rem', color: '#b45309' }}>· {cancelRecord.class}</span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => { if (!isCancelling) { setShowCancelModal(false); setCancelReason(''); } }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a3412', padding: '0.2rem', display: 'flex', alignItems: 'center', marginTop: '-2px' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '1.5rem' }}>
                            {/* Amount row */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: '#f9fafb', borderRadius: '0.65rem', padding: '0.65rem 1rem',
                                marginBottom: '1.25rem', border: '1px solid #e5e7eb'
                            }}>
                                <span style={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 600 }}>Amount to be Cancelled</span>
                                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111827' }}>
                                    ₹{parseFloat(cancelRecord.paid || cancelRecord.amount || 0).toFixed(2)}
                                </span>
                            </div>

                            {/* Quick reason chips */}
                            <div style={{ marginBottom: '0.75rem' }}>
                                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', margin: 0, marginBottom: '0.5rem' }}>Quick Select:</p>
                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                    {['Duplicate entry', 'Wrong amount', 'Student withdrew', 'Data correction', 'Other'].map(chip => (
                                        <button
                                            key={chip}
                                            onClick={() => setCancelReason(chip)}
                                            style={{
                                                padding: '0.28rem 0.7rem',
                                                borderRadius: '2rem',
                                                border: '1.5px solid',
                                                borderColor: cancelReason === chip ? '#c2410c' : '#e5e7eb',
                                                background: cancelReason === chip ? '#fff7ed' : '#f9fafb',
                                                color: cancelReason === chip ? '#c2410c' : '#6b7280',
                                                fontSize: '0.74rem', fontWeight: 600,
                                                cursor: 'pointer', transition: 'all 0.15s'
                                            }}
                                        >
                                            {chip}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Reason textarea */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', display: 'block', color: '#374151' }}>
                                    Cancellation Reason <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <textarea
                                    rows={3}
                                    autoFocus
                                    placeholder="Cancel करने का विस्तृत कारण लिखें..."
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                    style={{
                                        width: '100%',
                                        resize: 'vertical',
                                        minHeight: '90px',
                                        padding: '0.65rem 0.9rem',
                                        borderRadius: '0.6rem',
                                        border: `1.5px solid ${cancelReason.trim().length >= 5 ? '#fb923c' : '#d1d5db'}`,
                                        outline: 'none',
                                        fontSize: '0.88rem',
                                        fontFamily: 'inherit',
                                        background: '#ffffff',
                                        color: '#111827',
                                        boxSizing: 'border-box',
                                        transition: 'border-color 0.2s'
                                    }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
                                    {cancelReason.trim().length > 0 && cancelReason.trim().length < 5 ? (
                                        <span style={{ fontSize: '0.74rem', color: '#ef4444' }}>कम से कम 5 characters जरूरी हैं।</span>
                                    ) : <span />}
                                    <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{cancelReason.trim().length} chars</span>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button
                                    onClick={() => { setShowCancelModal(false); setCancelReason(''); }}
                                    disabled={isCancelling}
                                    style={{
                                        flex: 1, padding: '0.7rem 1rem',
                                        borderRadius: '0.6rem',
                                        border: '1.5px solid #d1d5db',
                                        background: '#ffffff', color: '#374151',
                                        fontWeight: 700, fontSize: '0.88rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleConfirmCancel}
                                    disabled={cancelReason.trim().length < 5 || isCancelling}
                                    style={{
                                        flex: 2, padding: '0.7rem 1rem',
                                        borderRadius: '0.6rem', border: 'none',
                                        background: cancelReason.trim().length >= 5
                                            ? 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)'
                                            : '#fde8d8',
                                        color: cancelReason.trim().length >= 5 ? '#ffffff' : '#c2410c',
                                        fontWeight: 700, fontSize: '0.88rem',
                                        cursor: cancelReason.trim().length >= 5 && !isCancelling ? 'pointer' : 'not-allowed',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
                                        boxShadow: cancelReason.trim().length >= 5 ? '0 4px 14px rgba(194,65,12,0.3)' : 'none',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Ban size={15} />
                                    {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Wipe Confirmation Modal ── */}
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
