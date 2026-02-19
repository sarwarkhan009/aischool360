import React, { useState } from 'react';
import { useFirestore } from '../../hooks/useFirestore';
import { FileDown, Search, IndianRupee, ArrowLeft, Trash2, AlertTriangle, X } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import { sortClasses } from '../../constants/app';

import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useSchool } from '../../context/SchoolContext';
import FeeReceipt from '../../components/fees/FeeReceipt';

const FeeReport: React.FC = () => {
    const { currentSchool } = useSchool();
    const { data: feeRecords, loading } = useFirestore<any>('fee_collections');
    const { data: allSettings } = useFirestore<any>('settings');
    const activeClasses = sortClasses(allSettings?.filter((d: any) => d.type === 'class') || []);
    const classesList = activeClasses.map((c: any) => c.name);

    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
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

    const getPeriodDates = (period: string) => {
        const today = new Date();
        const toISOLocal = (date: Date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        let start = toISOLocal(today);
        let end = toISOLocal(today);

        if (period === 'THIS_MONTH') {
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            start = toISOLocal(firstDay);
        } else if (period === 'LAST_MONTH') {
            const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            start = toISOLocal(firstDayLastMonth);
            end = toISOLocal(lastDayLastMonth);
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
            start = toISOLocal(startDateObj);
            end = toISOLocal(endDateObj);
        }
        return { startDate: start, endDate: end };
    };

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

        const isInventory = record.paidFor === 'Inventory Sale' || record.receiptNo?.startsWith('INV');
        const isFee = !isInventory;
        const matchesCategory = (selectedCategories.includes('FEES') && isFee) || (selectedCategories.includes('INVENTORY') && isInventory);

        const matchesDate = dateStr && dateStr >= startDate && dateStr <= endDate;
        const matchesClass = !selectedClass || record.class === selectedClass;
        const matchesSearch = !searchQuery ||
            (record.studentName && record.studentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (record.admissionNo && String(record.admissionNo).toLowerCase().includes(searchQuery.toLowerCase()));

        return matchesDate && matchesClass && matchesCategory && matchesSearch;
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
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Total Records</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>{filteredRecords.length}</div>
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
