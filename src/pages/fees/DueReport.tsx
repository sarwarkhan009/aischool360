import React, { useState, useMemo, useEffect } from 'react';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';
import { DollarSign, Calendar, User, Search, Download, AlertCircle, RefreshCw, Layers, ChevronDown, ChevronUp, Clock, CreditCard, Hash, MessageCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface Student {
    id: string;
    fullName?: string;
    name?: string;
    admissionNo?: string;
    class?: string;
    section?: string;
    admissionDate?: string;
    admissionType?: string; // 'NEW' or 'OLD'
    studentCategory?: string;
    phone?: string;
    fatherContactNo?: string;
    fatherName?: string;
    monthlyFee?: string;
}

interface FeeCollection {
    id: string;
    admissionNo: string;
    paid: number;
    paymentDate: string;
    status: string;
    receiptNo: string;
    paymentMode: string;
}

interface FeeType {
    id: string;
    feeHeadName: string;
    months: string[];
    admissionTypes: string[];
    studentTypes: string[];
    classes: string[];
    status: string;
}

interface FeeAmount {
    id: string;
    feeTypeId: string;
    className: string;
    amount: number;
}

const DueReport: React.FC = () => {
    const { schoolId } = useParams();
    const { data: students, loading: studentsLoading } = useFirestore<Student>('students');
    const { data: feeCollections, loading: collectionsLoading } = useFirestore<FeeCollection>('fee_collections');
    const { data: feeTypes, loading: typesLoading } = useFirestore<FeeType>('fee_types');
    const { data: feeAmounts, loading: amountsLoading } = useFirestore<FeeAmount>('fee_amounts');

    const [searchTerm, setSearchTerm] = useState('');
    const [filterClass, setFilterClass] = useState('ALL');
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [paymentSettings, setPaymentSettings] = useState<any>(null);

    const [isPrinting, setIsPrinting] = useState(false);
    const { currentSchool } = useSchool();
    const { data: schoolData } = useFirestore<any>('settings');
    const actualSchool = schoolData?.find((s: any) => s.id === `school_${schoolId}`);

    const MONTH_MAP: Record<string, number> = {
        'April': 3, 'May': 4, 'June': 5, 'July': 6, 'August': 7, 'September': 8,
        'October': 9, 'November': 10, 'December': 11, 'January': 0, 'February': 1, 'March': 2
    };

    // Load WhatsApp templates from payment settings
    useEffect(() => {
        const fetchPaymentSettings = async () => {
            try {
                const docRef = doc(db, 'settings', 'payment_info');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setPaymentSettings(docSnap.data());
                }
            } catch (error) {
                console.error('Error fetching payment settings:', error);
            }
        };
        fetchPaymentSettings();
    }, []);

    const studentDues = useMemo(() => {
        if (studentsLoading || collectionsLoading || typesLoading || amountsLoading) return [];

        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-11
        const sessionStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
        const sessionStartDate = new Date(sessionStartYear, 3, 1);

        // Load fee settings
        const feeSettings = paymentSettings || {};
        const collectionType = feeSettings.feeCollectionType || 'ADVANCE';
        const dueDateOfMonth = feeSettings.monthlyFeeDueDate || 5;
        const startRule = feeSettings.admissionFeeStartRule || 'FROM_ADMISSION_MONTH';
        const cutoffDate = feeSettings.admissionFeeCutoffDate || 15;

        return students.map(student => {
            const admType = student.admissionType || 'NEW';
            const admDateRaw = student.admissionDate ? new Date(student.admissionDate) : null;

            let startMonthIdx: number;
            let startYear: number;

            if (admType === 'NEW' && admDateRaw && admDateRaw >= sessionStartDate) {
                if (startRule === 'ALWAYS_FROM_APRIL') {
                    // Always start from April
                    startMonthIdx = 3; // April
                    startYear = sessionStartYear;
                } else {
                    // FROM_ADMISSION_MONTH with cutoff
                    const admDay = admDateRaw.getDate();
                    if (admDay <= cutoffDate) {
                        // Admission before cutoff = start from admission month
                        startMonthIdx = admDateRaw.getMonth();
                        startYear = admDateRaw.getFullYear();
                    } else {
                        // Admission after cutoff = start from next month
                        let nextMonth = admDateRaw.getMonth() + 1;
                        let nextYear = admDateRaw.getFullYear();
                        if (nextMonth > 11) {
                            nextMonth = 0;
                            nextYear++;
                        }
                        startMonthIdx = nextMonth;
                        startYear = nextYear;
                    }
                }
            } else {
                startMonthIdx = 3; // April
                startYear = sessionStartYear;
            }

            let totalPayable = 0;
            const payableDetails: any[] = [];
            const studentAdmMonth = admDateRaw ? admDateRaw.getMonth() : -1;
            const studentAdmYear = admDateRaw ? admDateRaw.getFullYear() : -1;

            feeTypes.forEach(type => {
                if (type.status !== 'ACTIVE') return;

                const matchesAdmType = type.admissionTypes?.includes(admType);
                if (!matchesAdmType) return;

                const matchesClass = type.classes?.includes(student.class || '');
                const matchesStudentType = type.studentTypes?.includes(student.studentCategory || 'GENERAL');

                if (matchesClass && matchesStudentType) {
                    const amountConfig = feeAmounts.find(fa => fa.feeTypeId === type.id && fa.className === student.class);
                    if (!amountConfig || !amountConfig.amount) return;

                    // Check if student has custom monthly fee
                    const isMonthlyFee = type.feeHeadName?.toLowerCase().includes('monthly');
                    const studentMonthlyFee = student.monthlyFee ? parseFloat(student.monthlyFee) : null;
                    const useStudentFee = isMonthlyFee && studentMonthlyFee && studentMonthlyFee > 0;

                    type.months?.forEach(monthName => {
                        let isDue = false;

                        if (monthName === 'Admission_month') {
                            // One-time fees (Admission, Registration, Exam) should be charged 
                            // based on actual admission date, regardless of start rule
                            if (admType === 'NEW' && admDateRaw) {
                                // Fee is due if today is on or after admission date
                                isDue = today >= admDateRaw;
                            }
                        } else {
                            const targetMonthIdx = MONTH_MAP[monthName];
                            if (targetMonthIdx !== undefined) {
                                const targetYear = targetMonthIdx < 3 ? sessionStartYear + 1 : sessionStartYear;

                                // Calculate due date based on collection type
                                let dueDate;
                                if (collectionType === 'ADVANCE') {
                                    // Same month - Jan fee due on 5 Jan
                                    dueDate = new Date(targetYear, targetMonthIdx, dueDateOfMonth);
                                } else {
                                    // Next month (ARREARS) - Jan fee due on 5 Feb
                                    let nextMonth = targetMonthIdx + 1;
                                    let nextYear = targetYear;
                                    if (nextMonth > 11) {
                                        nextMonth = 0;
                                        nextYear++;
                                    }
                                    dueDate = new Date(nextYear, nextMonth, dueDateOfMonth);
                                }

                                if (today >= dueDate) {
                                    const monthDate = new Date(targetYear, targetMonthIdx, 1);
                                    const sessionStartCompareDate = new Date(startYear, startMonthIdx, 1);
                                    if (monthDate >= sessionStartCompareDate) {
                                        isDue = true;
                                    }
                                }
                            }
                        }

                        if (isDue) {
                            // Use student-specific monthly fee if available, otherwise use class-based fee
                            const finalAmount = useStudentFee ? studentMonthlyFee! : amountConfig.amount;
                            totalPayable += finalAmount;
                            payableDetails.push({
                                head: type.feeHeadName,
                                month: monthName.replace('_month', ' (Joining Month)'),
                                amount: finalAmount
                            });
                        }
                    });
                }
            });

            const studentPayments = feeCollections
                .filter(c =>
                    c.admissionNo === student.admissionNo &&
                    c.status !== 'CANCELLED' &&
                    new Date(c.paymentDate) >= sessionStartDate
                )
                .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

            const totalPaid = studentPayments.reduce((sum, c) => sum + (Number(c.paid) || 0), 0);
            const dues = totalPayable - totalPaid;

            if (dues <= 0) return null;

            const lastPayment = studentPayments[0]; // Already sorted by date desc

            return {
                id: student.id,
                name: (student.fullName || student.name || 'N/A').toUpperCase(),
                admissionNo: student.admissionNo || 'N/A',
                class: student.class || 'N/A',
                section: student.section || '',
                phone: student.fatherContactNo || student.phone || 'N/A',
                fatherName: student.fatherName || 'Parent',
                admissionType: admType,
                totalPayable,
                payableDetails,
                totalPaid,
                paidDetails: studentPayments,
                lastPaymentAmount: lastPayment ? lastPayment.paid : 0,
                lastPaymentDate: lastPayment ? lastPayment.paymentDate : null,
                lastPaymentReceipt: lastPayment ? lastPayment.receiptNo : null,
                dues,
                admissionDate: student.admissionDate
            };
        }).filter(Boolean);
    }, [students, feeCollections, feeTypes, feeAmounts, studentsLoading, collectionsLoading, typesLoading, amountsLoading, paymentSettings]);

    const filteredResults = useMemo(() => {
        return (studentDues as any[]).filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.admissionNo.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesClass = filterClass === 'ALL' || s.class === filterClass;
            return matchesSearch && matchesClass;
        });
    }, [studentDues, searchTerm, filterClass]);

    const stats = useMemo(() => {
        return {
            count: filteredResults.length,
            totalDues: filteredResults.reduce((sum, s) => sum + s.dues, 0)
        };
    }, [filteredResults]);

    const handlePrint = () => {
        setIsPrinting(true);
        setTimeout(() => {
            window.print();
            setIsPrinting(false);
        }, 500);
    };

    const sendWhatsApp = (s: any) => {
        const phone = s.phone.replace(/\D/g, '');
        if (!phone || phone === 'N/A') {
            alert('Phone number not available for this student.');
            return;
        }

        // Get the active template from payment settings
        let message = `Hello ${s.fatherName}, Greetings!\n\nThis is a friendly reminder regarding the outstanding school fees for ${s.name}. The total due amount is ₹${s.dues.toLocaleString('en-IN')}.\n\nWe request you to kindly clear the dues as soon as possible. Thank you!`;

        if (paymentSettings?.whatsappTemplates && paymentSettings?.activeTemplateId) {
            const activeTemplate = paymentSettings.whatsappTemplates.find((t: any) => t.id === paymentSettings.activeTemplateId);
            if (activeTemplate?.content) {
                // Replace placeholders in the template
                message = activeTemplate.content
                    .replace(/{father_name}/g, s.fatherName)
                    .replace(/{student_name}/g, s.name)
                    .replace(/{amount}/g, s.dues.toLocaleString('en-IN'))
                    .replace(/{school_name}/g, currentSchool?.fullName || currentSchool?.name || actualSchool?.schoolName || 'School');
            }
        }

        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/91${phone}?text=${encodedMessage}`, '_blank');
    };

    const uniqueClasses = useMemo(() => {
        const set = new Set(students.map(s => s.class).filter(Boolean));
        return Array.from(set).sort();
    }, [students]);

    if (studentsLoading || collectionsLoading || typesLoading || amountsLoading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem' }}>
                <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--primary)' }} />
                <p style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Fetching payment & payable details...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '4rem' }}>
            <div style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                padding: '1.5rem',
                borderRadius: '20px',
                color: 'white',
                marginBottom: '2rem',
                boxShadow: '0 10px 25px rgba(30, 41, 59, 0.2)'
            }} className="due-report-header">
                <div style={{ marginBottom: '1.5rem' }}>
                    <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2.25rem)', fontWeight: 900, margin: 0 }}>Detailed Due Report</h1>
                    <p style={{ opacity: 0.8, marginTop: '0.5rem', fontWeight: 600, fontSize: 'clamp(0.875rem, 2.5vw, 1rem)' }}>
                        Full Breakdown of Payables & Payments
                    </p>
                    <p style={{ opacity: 0.8, fontWeight: 600, fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>
                        Session 2025-26
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <button
                        onClick={handlePrint}
                        className="btn btn-primary no-print"
                        style={{
                            background: '#6366f1',
                            border: 'none',
                            padding: '0.875rem 1.25rem',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: 700,
                            color: 'white',
                            fontSize: 'clamp(0.75rem, 2.5vw, 1rem)',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                        }}
                    >
                        <Download size={18} /> PRINT REPORT
                    </button>
                    <div style={{ flex: 1, minWidth: '200px', textAlign: 'right' }}>
                        <div style={{ fontSize: 'clamp(1.75rem, 6vw, 2.5rem)', fontWeight: 900, color: '#f87171' }}>₹{stats.totalDues.toLocaleString('en-IN')}</div>
                        <div style={{ fontSize: 'clamp(0.7rem, 2vw, 0.875rem)', opacity: 0.8, fontWeight: 700 }}>COLLECTABLE BALANCE</div>
                    </div>
                </div>
            </div>

            <div className="glass-card due-report-filters" style={{
                padding: '1.5rem',
                marginBottom: '2rem',
                background: 'white',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label style={{ fontSize: 'clamp(0.75rem, 2vw, 0.8125rem)', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Search Student</label>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            placeholder="Type student name or admission no..."
                            style={{
                                width: '100%',
                                height: '48px',
                                paddingLeft: '2.75rem',
                                paddingRight: '1rem',
                                borderRadius: '12px',
                                border: '2px solid #e2e8f0',
                                fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
                                fontWeight: 500,
                                color: '#1e293b',
                                transition: 'all 0.2s ease',
                                outline: 'none',
                                background: '#f8fafc'
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = '#6366f1';
                                e.currentTarget.style.background = 'white';
                                e.currentTarget.style.boxShadow = '0 0 0 4px rgba(99, 102, 241, 0.1)';
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = '#e2e8f0';
                                e.currentTarget.style.background = '#f8fafc';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                    <label style={{ fontSize: 'clamp(0.75rem, 2vw, 0.8125rem)', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter by Class</label>
                    <select
                        style={{
                            width: '100%',
                            height: '48px',
                            padding: '0 1rem',
                            borderRadius: '12px',
                            border: '2px solid #e2e8f0',
                            fontSize: 'clamp(0.875rem, 2.5vw, 0.9375rem)',
                            fontWeight: 600,
                            color: '#1e293b',
                            background: '#f8fafc',
                            cursor: 'pointer',
                            outline: 'none',
                            appearance: 'none',
                            backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 1rem center',
                            backgroundSize: '1.25rem'
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                        onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                        value={filterClass}
                        onChange={e => setFilterClass(e.target.value)}
                    >
                        <option value="ALL">All Classes</option>
                        {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="glass-card desktop-only" style={{ padding: 0, overflow: 'hidden', display: 'none' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#334155', color: 'white' }}>
                            <th style={{ width: '50px', padding: '1rem' }}></th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800 }}>STUDENT</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800 }}>CLASS INFO</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800 }}>LAST PAYMENT</th>
                            <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 800 }}>PAYABLE</th>
                            <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 800 }}>PAID</th>
                            <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 800 }}>REMAINING DUES</th>
                            <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800 }}>ACTION</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredResults.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    <AlertCircle size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                                    <p style={{ fontWeight: 600 }}>No results for your search.</p>
                                </td>
                            </tr>
                        ) : (
                            filteredResults.map((s: any) => (
                                <React.Fragment key={s.id}>
                                    <tr
                                        onClick={() => setExpandedRow(expandedRow === s.id ? null : s.id)}
                                        style={{
                                            borderBottom: expandedRow === s.id ? 'none' : '1px solid var(--border)',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s'
                                        }}
                                        className="hover-row"
                                    >
                                        <td style={{ textAlign: 'center', padding: '1rem' }}>
                                            {expandedRow === s.id ? <ChevronUp size={20} color="#6366f1" /> : <ChevronDown size={20} color="var(--text-muted)" />}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9375rem' }}>{s.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <Calendar size={12} /> {s.admissionDate ? new Date(s.admissionDate).toLocaleDateString('en-GB') : 'N/A'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 700, color: '#4338ca', fontSize: '0.8125rem' }}>{s.admissionNo} • {s.class}-{s.section}</div>
                                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Ph: {s.phone}</div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            {s.lastPaymentAmount > 0 ? (
                                                <>
                                                    <div style={{ fontWeight: 800, color: '#059669', fontSize: '0.9375rem' }}>₹{s.lastPaymentAmount.toLocaleString('en-IN')}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Hash size={12} /> {s.lastPaymentReceipt} • {new Date(s.lastPaymentDate).toLocaleDateString('en-GB')}
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>No payments</div>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 800, color: '#1e293b', fontSize: '1rem' }}>₹{s.totalPayable.toLocaleString('en-IN')}</td>
                                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 800, color: '#10b981', fontSize: '1rem' }}>₹{s.totalPaid.toLocaleString('en-IN')}</td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <span style={{
                                                background: '#ef4444',
                                                color: 'white',
                                                padding: '0.6rem 1.25rem',
                                                borderRadius: '12px',
                                                fontWeight: 900,
                                                fontSize: '1.125rem',
                                                boxShadow: '0 4px 10px rgba(239, 68, 68, 0.2)',
                                                display: 'inline-block'
                                            }}>
                                                ₹{s.dues.toLocaleString('en-IN')}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    sendWhatsApp(s);
                                                }}
                                                className="btn-icon hover-lift"
                                                style={{
                                                    background: '#25D366',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    padding: '0.5rem',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    boxShadow: '0 2px 4px rgba(37, 211, 102, 0.3)',
                                                    cursor: 'pointer'
                                                }}
                                                title="Send WhatsApp Reminder"
                                            >
                                                <MessageCircle size={18} />
                                            </button>
                                        </td>
                                    </tr>

                                    {/* Breakdown Row */}
                                    {expandedRow === s.id && (
                                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                                            <td colSpan={7} style={{ padding: '1.5rem 2rem' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
                                                    {/* Payable Breakdown */}
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                                            <div style={{ background: '#1e293b', padding: '0.4rem', borderRadius: '8px' }}>
                                                                <Clock size={16} color="white" />
                                                            </div>
                                                            <h4 style={{ margin: 0, fontWeight: 800, color: '#1e293b', fontSize: '0.875rem', textTransform: 'uppercase' }}>Composition of Payable (₹{s.totalPayable.toLocaleString('en-IN')})</h4>
                                                        </div>
                                                        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                                            <table style={{ width: '100%', fontSize: '0.8125rem' }}>
                                                                <thead style={{ background: '#f1f5f9', borderBottom: '1px solid var(--border)' }}>
                                                                    <tr>
                                                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Fee Head</th>
                                                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Month</th>
                                                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Amount</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {s.payableDetails.map((pd: any, idx: number) => (
                                                                        <tr key={idx} style={{ borderBottom: idx === s.payableDetails.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                                                            <td style={{ padding: '0.75rem', fontWeight: 700, color: '#475569' }}>{pd.head}</td>
                                                                            <td style={{ padding: '0.75rem', color: '#64748b' }}>{pd.month}</td>
                                                                            <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 800, color: '#1e293b' }}>₹{pd.amount.toLocaleString('en-IN')}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                                <tfoot style={{ background: '#f8fafc', fontWeight: 800 }}>
                                                                    <tr>
                                                                        <td colSpan={2} style={{ padding: '0.75rem', textAlign: 'right' }}>TOTAL PAYABLE</td>
                                                                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1e293b' }}>₹{s.totalPayable.toLocaleString('en-IN')}</td>
                                                                    </tr>
                                                                </tfoot>
                                                            </table>
                                                        </div>
                                                    </div>

                                                    {/* Payment History */}
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                                            <div style={{ background: '#10b981', padding: '0.4rem', borderRadius: '8px' }}>
                                                                <CreditCard size={16} color="white" />
                                                            </div>
                                                            <h4 style={{ margin: 0, fontWeight: 800, color: '#1e293b', fontSize: '0.875rem', textTransform: 'uppercase' }}>Actual Payments Made (₹{s.totalPaid.toLocaleString('en-IN')})</h4>
                                                        </div>
                                                        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                                            {s.paidDetails.length === 0 ? (
                                                                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>No payments recorded this session.</div>
                                                            ) : (
                                                                <table style={{ width: '100%', fontSize: '0.8125rem' }}>
                                                                    <thead style={{ background: '#ecfdf5', borderBottom: '1px solid var(--border)' }}>
                                                                        <tr>
                                                                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Date</th>
                                                                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Receipt</th>
                                                                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Amount</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {s.paidDetails.map((pay: any, idx: number) => (
                                                                            <tr key={pay.id} style={{ borderBottom: idx === s.paidDetails.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                                                                <td style={{ padding: '0.75rem', color: '#64748b' }}>{new Date(pay.paymentDate).toLocaleDateString('en-IN')}</td>
                                                                                <td style={{ padding: '0.75rem', fontWeight: 700, color: '#059669' }}>{pay.receiptNo} <span style={{ fontSize: '0.625rem', opacity: 0.6 }}>({pay.paymentMode})</span></td>
                                                                                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 800, color: '#1e293b' }}>₹{pay.paid.toLocaleString('en-IN')}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                    <tfoot style={{ background: '#f8fafc', fontWeight: 800 }}>
                                                                        <tr>
                                                                            <td colSpan={2} style={{ padding: '0.75rem', textAlign: 'right' }}>TOTAL PAID</td>
                                                                            <td style={{ padding: '0.75rem', textAlign: 'right', color: '#10b981' }}>₹{s.totalPaid.toLocaleString('en-IN')}</td>
                                                                        </tr>
                                                                    </tfoot>
                                                                </table>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="mobile-only" style={{ width: '100%' }}>
                {filteredResults.length === 0 ? (
                    <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <AlertCircle size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p style={{ fontWeight: 600 }}>No results for your search.</p>
                    </div>
                ) : (
                    filteredResults.map((s: any) => (
                        <div key={s.id} className="glass-card" style={{
                            marginBottom: '1rem',
                            overflow: 'hidden',
                            border: '1px solid #e2e8f0',
                            borderRadius: '16px',
                            width: '100%'
                        }}>
                            {/* Card Header */}
                            <div
                                onClick={() => setExpandedRow(expandedRow === s.id ? null : s.id)}
                                style={{
                                    padding: '1rem',
                                    cursor: 'pointer',
                                    background: 'white'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 800, color: '#1e293b', fontSize: 'clamp(0.9375rem, 3vw, 1.125rem)', marginBottom: '0.25rem' }}>{s.name}</div>
                                        <div style={{ fontSize: 'clamp(0.75rem, 2vw, 0.8125rem)', color: '#4338ca', fontWeight: 700 }}>
                                            {s.admissionNo} • {s.class}-{s.section}
                                        </div>
                                    </div>
                                    <div style={{ flexShrink: 0 }}>
                                        {expandedRow === s.id ? <ChevronUp size={20} color="#6366f1" /> : <ChevronDown size={20} color="#94a3b8" />}
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                    <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                                        <div style={{ fontSize: 'clamp(0.625rem, 1.5vw, 0.6875rem)', color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Payable</div>
                                        <div style={{ fontSize: 'clamp(0.875rem, 2.5vw, 1rem)', fontWeight: 800, color: '#1e293b' }}>₹{s.totalPayable.toLocaleString('en-IN')}</div>
                                    </div>
                                    <div style={{ background: '#ecfdf5', padding: '0.75rem', borderRadius: '8px' }}>
                                        <div style={{ fontSize: 'clamp(0.625rem, 1.5vw, 0.6875rem)', color: '#10b981', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Paid</div>
                                        <div style={{ fontSize: 'clamp(0.875rem, 2.5vw, 1rem)', fontWeight: 800, color: '#10b981' }}>₹{s.totalPaid.toLocaleString('en-IN')}</div>
                                    </div>
                                </div>

                                {s.lastPaymentAmount > 0 && (
                                    <div style={{ fontSize: 'clamp(0.6875rem, 1.75vw, 0.75rem)', color: '#64748b', marginBottom: '0.75rem' }}>
                                        <span style={{ fontWeight: 700 }}>Last Payment:</span> ₹{s.lastPaymentAmount.toLocaleString('en-IN')} • {new Date(s.lastPaymentDate).toLocaleDateString('en-GB')}
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            sendWhatsApp(s);
                                        }}
                                        style={{
                                            background: '#25D366',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '10px',
                                            padding: '0.75rem 1rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            fontWeight: 700,
                                            fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
                                            boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)',
                                            cursor: 'pointer',
                                            flex: 1
                                        }}
                                    >
                                        <MessageCircle size={16} /> WhatsApp
                                    </button>
                                    <div style={{
                                        background: '#ef4444',
                                        color: 'white',
                                        padding: '0.75rem 1.25rem',
                                        borderRadius: '10px',
                                        fontWeight: 900,
                                        fontSize: 'clamp(1rem, 3vw, 1.25rem)',
                                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        ₹{s.dues.toLocaleString('en-IN')}
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {expandedRow === s.id && (
                                <div style={{ background: '#f8fafc', padding: '1rem', borderTop: '1px solid #e2e8f0' }}>
                                    {/* Payable Breakdown */}
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                            <div style={{ background: '#1e293b', padding: '0.4rem', borderRadius: '6px' }}>
                                                <Clock size={14} color="white" />
                                            </div>
                                            <h4 style={{ margin: 0, fontWeight: 800, color: '#1e293b', fontSize: 'clamp(0.75rem, 2vw, 0.875rem)', textTransform: 'uppercase' }}>
                                                Payable Details
                                            </h4>
                                        </div>
                                        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                            {s.payableDetails.map((pd: any, idx: number) => (
                                                <div key={idx} style={{
                                                    padding: '0.75rem',
                                                    borderBottom: idx === s.payableDetails.length - 1 ? 'none' : '1px solid #f1f5f9',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 700, color: '#475569', fontSize: 'clamp(0.75rem, 2vw, 0.8125rem)' }}>{pd.head}</div>
                                                        <div style={{ fontSize: 'clamp(0.6875rem, 1.75vw, 0.75rem)', color: '#94a3b8' }}>{pd.month}</div>
                                                    </div>
                                                    <div style={{ fontWeight: 800, color: '#1e293b', fontSize: 'clamp(0.875rem, 2.5vw, 1rem)' }}>₹{pd.amount.toLocaleString('en-IN')}</div>
                                                </div>
                                            ))}
                                            <div style={{ padding: '0.75rem', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                                                <span style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>TOTAL</span>
                                                <span style={{ fontSize: 'clamp(0.875rem, 2.5vw, 1rem)', color: '#1e293b' }}>₹{s.totalPayable.toLocaleString('en-IN')}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Payment History */}
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                            <div style={{ background: '#10b981', padding: '0.4rem', borderRadius: '6px' }}>
                                                <CreditCard size={14} color="white" />
                                            </div>
                                            <h4 style={{ margin: 0, fontWeight: 800, color: '#1e293b', fontSize: 'clamp(0.75rem, 2vw, 0.875rem)', textTransform: 'uppercase' }}>
                                                Payment History
                                            </h4>
                                        </div>
                                        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                            {s.paidDetails.length === 0 ? (
                                                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>
                                                    No payments recorded
                                                </div>
                                            ) : (
                                                <>
                                                    {s.paidDetails.map((pay: any, idx: number) => (
                                                        <div key={pay.id} style={{
                                                            padding: '0.75rem',
                                                            borderBottom: idx === s.paidDetails.length - 1 ? 'none' : '1px solid #f1f5f9',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center'
                                                        }}>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontWeight: 700, color: '#059669', fontSize: 'clamp(0.75rem, 2vw, 0.8125rem)' }}>
                                                                    {pay.receiptNo}
                                                                </div>
                                                                <div style={{ fontSize: 'clamp(0.6875rem, 1.75vw, 0.75rem)', color: '#94a3b8' }}>
                                                                    {new Date(pay.paymentDate).toLocaleDateString('en-IN')} • {pay.paymentMode}
                                                                </div>
                                                            </div>
                                                            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: 'clamp(0.875rem, 2.5vw, 1rem)' }}>
                                                                ₹{pay.paid.toLocaleString('en-IN')}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <div style={{ padding: '0.75rem', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                                                        <span style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>TOTAL</span>
                                                        <span style={{ fontSize: 'clamp(0.875rem, 2.5vw, 1rem)', color: '#10b981' }}>₹{s.totalPaid.toLocaleString('en-IN')}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div style={{ marginTop: '2rem', background: 'rgba(59, 130, 246, 0.05)', padding: '1.5rem', borderRadius: '16px', border: '1px dashed #3b82f6' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <AlertCircle size={24} style={{ color: '#3b82f6', flexShrink: 0 }} />
                    <div>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e40af' }}>Interactive Report Guide</h4>
                        <p style={{ fontSize: '0.875rem', color: '#1e40af', marginTop: '0.5rem', lineHeight: 1.6 }}>
                            Click on any student row to see the <strong>Breakdown</strong> of how their Payable and Paid amounts are calculated.
                            <br />• <strong>Composition of Payable:</strong> Shows every fee head and month included in the balance calculation based on the 5th-of-month policy.
                            <br />• <strong>Actual Payments:</strong> Lists all receipts and payment modes recorded during this session (April onwards).
                        </p>
                    </div>
                </div>
            </div>

            {isPrinting && (
                <div className="print-report-view" style={{
                    maxWidth: '210mm',
                    margin: '0 auto',
                    padding: '0 20mm'
                }}>
                    <div style={{ textAlign: 'center', borderBottom: '2px solid #334155', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>DUE PAYMENT REPORT</h1>
                        <p style={{ margin: '0.5rem 0', fontWeight: 700, fontSize: '1.125rem', color: '#1e293b' }}>{currentSchool?.fullName || currentSchool?.name || actualSchool?.schoolName || 'School Name'}</p>
                        <p style={{ margin: 0, fontSize: '0.8125rem', opacity: 0.7 }}>Report Date: {new Date().toLocaleDateString('en-GB')} | Class: {filterClass === 'ALL' ? 'All Classes' : filterClass}</p>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #334155' }}>
                                <th style={{ padding: '6px', textAlign: 'left' }}>S.No</th>
                                <th style={{ padding: '6px', textAlign: 'left' }}>Admission No</th>
                                <th style={{ padding: '6px', textAlign: 'left' }}>Student Name</th>
                                <th style={{ padding: '6px', textAlign: 'left' }}>Class</th>
                                <th style={{ padding: '6px', textAlign: 'left' }}>Phone</th>
                                <th style={{ padding: '6px', textAlign: 'left' }}>Last Pay Info</th>
                                <th style={{ padding: '6px', textAlign: 'right' }}>Dues</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredResults.map((s, idx) => (
                                <tr key={s.id} style={{ borderBottom: '0.5px solid #e2e8f0' }}>
                                    <td style={{ padding: '6px' }}>{idx + 1}</td>
                                    <td style={{ padding: '6px' }}>{s.admissionNo}</td>
                                    <td style={{ padding: '6px', fontWeight: 700 }}>{s.name}</td>
                                    <td style={{ padding: '6px' }}>{s.class}-{s.section}</td>
                                    <td style={{ padding: '6px' }}>{s.phone}</td>
                                    <td style={{ padding: '6px' }}>{s.lastPaymentAmount > 0 ? `₹${s.lastPaymentAmount} (#${s.lastPaymentReceipt}) on ${new Date(s.lastPaymentDate).toLocaleDateString('en-GB')}` : '-'}</td>
                                    <td style={{ padding: '6px', textAlign: 'right', fontWeight: 900 }}>₹{s.dues}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr style={{ borderTop: '2px solid #334155', fontWeight: 900 }}>
                                <td colSpan={6} style={{ padding: '6px', textAlign: 'right' }}>GRAND TOTAL:</td>
                                <td style={{ padding: '6px', textAlign: 'right' }}>₹{stats.totalDues.toLocaleString('en-IN')}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            <style>{`
                /* Desktop/Mobile Views */
                @media (min-width: 769px) {
                    .desktop-only {
                        display: block !important;
                    }
                    .mobile-only {
                        display: none !important;
                    }
                }

                @media (max-width: 768px) {
                    .desktop-only {
                        display: none !important;
                    }
                    .mobile-only {
                        display: block !important;
                    }

                    /* Mobile optimizations */
                    .animate-fade-in {
                        padding-left: 0.5rem;
                        padding-right: 0.5rem;
                    }

                    .due-report-header {
                        padding: 1rem !important;
                        border-radius: 16px !important;
                        margin-bottom: 1rem !important;
                    }

                    .due-report-filters {
                        padding: 1rem !important;
                        margin-bottom: 1rem !important;
                        border-radius: 12px !important;
                    }

                    /* Hide on mobile print */
                    .no-print {
                        display: none !important;
                    }
                }

                /* Touch-friendly interactions */
                @media (hover: none) {
                    button, .hover-row {
                        -webkit-tap-highlight-color: rgba(99, 102, 241, 0.1);
                    }
                }

                /* Print styles */
                @media print {
                    body * { visibility: hidden !important; }
                    .print-report-view, .print-report-view * { visibility: visible !important; }
                    .print-report-view {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    @page { 
                        margin: 15mm 20mm;
                        size: A4 portrait;
                    }
                    
                    /* Ensure content doesn't overflow */
                    table {
                        page-break-inside: auto;
                    }
                    tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                    thead {
                        display: table-header-group;
                    }
                    tfoot {
                        display: table-footer-group;
                    }
                }
            `}</style>
        </div>
    );
};

export default DueReport;
