import React, { useState, useMemo, useEffect } from 'react';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';
import { DollarSign, Calendar, User, Search, Download, AlertCircle, RefreshCw, Layers, ChevronDown, ChevronUp, Clock, CreditCard, Hash, MessageCircle, Table2, LayoutGrid, X } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { sortClasses } from '../../constants/app';
import { formatClassName } from '../../utils/formatters';
import { getMonthIndexMap, getAcademicYearMonths } from '../../utils/academicYear';
import FeeReceipt from '../../components/fees/FeeReceipt';

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
    rollNo?: string;
}

interface FeeCollection {
    id: string;
    admissionNo: string;
    paid: number;
    discount?: number;
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
    const { data: allFeeAmounts, loading: amountsLoading } = useFirestore<FeeAmount>('fee_amounts');

    const [searchTerm, setSearchTerm] = useState('');
    const [filterClass, setFilterClass] = useState('ALL');
    const [filterSection, setFilterSection] = useState('ALL');
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [paymentSettings, setPaymentSettings] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'detailed' | 'ledger'>('detailed');
    const [selectedReceipt, setSelectedReceipt] = useState<any>(null);

    const [isPrinting, setIsPrinting] = useState(false);
    const { currentSchool } = useSchool();
    const { data: schoolData } = useFirestore<any>('settings');
    const actualSchool = schoolData?.find((s: any) => s.id === `school_${schoolId}`);

    // Dynamic month index mapping
    const MONTH_MAP = getMonthIndexMap();
    const academicStartMonthIdx = MONTH_MAP[currentSchool?.academicYearStartMonth || 'April'];

    // Filter fee amounts by active financial year
    const activeFY = currentSchool?.activeFinancialYear || '2025-26';
    const feeAmounts = allFeeAmounts.filter(fa => ((fa as any).financialYear || '2025-26') === activeFY);

    // Load WhatsApp templates from payment settings
    useEffect(() => {
        const fetchPaymentSettings = async () => {
            if (!schoolId && !currentSchool?.id) return;

            try {
                const schoolIdToUse = currentSchool?.id || schoolId;
                if (!schoolIdToUse) return;

                // Try school-specific payment_info first
                let docRef = doc(db, 'schools', schoolIdToUse, 'settings', 'payment_info');
                let docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setPaymentSettings(docSnap.data());
                } else {
                    // Fallback to global settings for backward compatibility
                    docRef = doc(db, 'settings', 'payment_info');
                    docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setPaymentSettings(docSnap.data());
                    }
                }
            } catch (error) {
                console.error('Error fetching payment settings:', error);
            }
        };
        fetchPaymentSettings();
    }, [schoolId, currentSchool?.id]);

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

        // Filter students to only current session (consistent with StudentManagement)
        const sessionStudents = students.filter(s => {
            const studentSession = (s as any).session;
            return studentSession === activeFY;
        });

        return sessionStudents.map(student => {
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
                startMonthIdx = academicStartMonthIdx;
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

                const matchesStudentType = type.studentTypes?.includes(student.studentCategory || 'GENERAL');

                // Check if fee type's classes array includes the student's class
                let matchesClass = type.classes?.includes(student.class || '');

                // Fallback: If fee type's classes list is stale (e.g. has "KG" instead of "LKG"),
                // check if a fee_amount entry exists for this student's class + fee type.
                // This handles cases where Class Master was updated but fee types weren't re-saved.
                if (!matchesClass && student.class) {
                    const hasAmountForClass = feeAmounts.some(fa => fa.feeTypeId === type.id && fa.className === student.class);
                    if (hasAmountForClass) {
                        matchesClass = true;
                    }
                }

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
                            // for NEW students on join, and OLD students at session start
                            if (admType === 'OLD') {
                                isDue = true;
                            } else if (admType === 'NEW' && admDateRaw) {
                                // Fee is due if today is on or after admission date
                                isDue = today >= admDateRaw;
                            }
                        } else {
                            const targetMonthIdx = MONTH_MAP[monthName];
                            if (targetMonthIdx !== undefined) {
                                const targetYear = targetMonthIdx < academicStartMonthIdx ? sessionStartYear + 1 : sessionStartYear;

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

            // Sort payableDetails: Admission/Annual Charges first, then by academic month order
            const academicStartMonth = currentSchool?.academicYearStartMonth || 'April';
            const startMonthIndex = MONTH_MAP[academicStartMonth] ?? 3;

            payableDetails.sort((a, b) => {
                const headA = a.head.toLowerCase();
                const headB = b.head.toLowerCase();

                // NEW Students: Admission Fee on top
                if (admType === 'NEW') {
                    const aIsAdmission = headA.includes('admission');
                    const bIsAdmission = headB.includes('admission');
                    if (aIsAdmission && !bIsAdmission) return -1;
                    if (!aIsAdmission && bIsAdmission) return 1;
                }
                // OLD Students: Annual Charges on top
                else {
                    const aIsAnnual = headA.includes('annual');
                    const bIsAnnual = headB.includes('annual');
                    if (aIsAnnual && !bIsAnnual) return -1;
                    if (!aIsAnnual && bIsAnnual) return 1;

                    // Fallback for old students if admission fee exists (rare but possible)
                    const aIsAdmission = headA.includes('admission');
                    const bIsAdmission = headB.includes('admission');
                    if (aIsAdmission && !bIsAdmission) return -1;
                    if (!aIsAdmission && bIsAdmission) return 1;
                }

                // Sort by month
                const getMonthSortValue = (monthStr: string) => {
                    // Check for Admission/Joining month specifically
                    if (monthStr.toLowerCase().includes('admission') || monthStr.toLowerCase().includes('joining month')) {
                        return -1;
                    }

                    const cleanMonth = monthStr.split(' ')[0];
                    const idx = MONTH_MAP[cleanMonth];
                    if (idx === undefined) return 100;

                    // Calculate position relative to academic start month
                    return (idx - startMonthIndex + 12) % 12;
                };

                const valA = getMonthSortValue(a.month);
                const valB = getMonthSortValue(b.month);

                if (valA !== valB) return valA - valB;

                return headA.localeCompare(headB);
            });

            const studentPayments = feeCollections
                .filter(c =>
                    c.admissionNo === student.admissionNo &&
                    c.status !== 'CANCELLED' &&
                    new Date(c.paymentDate) >= sessionStartDate
                )
                .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

            const totalPaid = studentPayments.reduce((sum, c) => sum + (Number(c.paid) || 0), 0);
            const totalDiscount = studentPayments.reduce((sum, c) => sum + (Number((c as any).discount) || 0), 0);
            const dues = totalPayable - totalPaid - totalDiscount;

            if (dues <= 0) return null;

            const lastPayment = studentPayments[0]; // Already sorted by date desc

            return {
                id: student.id,
                name: (student.fullName || student.name || 'N/A').toUpperCase(),
                admissionNo: student.admissionNo || 'N/A',
                rollNo: student.rollNo || '',
                class: student.class || 'N/A',
                section: student.section || '',
                phone: student.fatherContactNo || student.phone || 'N/A',
                fatherName: student.fatherName || 'Parent',
                admissionType: admType,
                totalPayable,
                payableDetails,
                totalPaid,
                totalDiscount,
                paidDetails: studentPayments,
                lastPaymentAmount: lastPayment ? lastPayment.paid : 0,
                lastPaymentDate: lastPayment ? lastPayment.paymentDate : null,
                lastPaymentReceipt: lastPayment ? lastPayment.receiptNo : null,
                dues,
                admissionDate: student.admissionDate
            };
        }).filter(Boolean);
    }, [students, feeCollections, feeTypes, feeAmounts, studentsLoading, collectionsLoading, typesLoading, amountsLoading, paymentSettings, activeFY]);

    const filteredResults = useMemo(() => {
        return (studentDues as any[]).filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.admissionNo.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesClass = filterClass === 'ALL' || s.class === filterClass;
            const matchesSection = filterSection === 'ALL' || s.section === filterSection;
            return matchesSearch && matchesClass && matchesSection;
        }).sort((a, b) => {
            const classDiff = (a.class || '').localeCompare(b.class || '');
            if (classDiff !== 0) return classDiff;
            const sectionDiff = (a.section || '').localeCompare(b.section || '');
            if (sectionDiff !== 0) return sectionDiff;
            const rollA = parseInt(a.rollNo) || 0;
            const rollB = parseInt(b.rollNo) || 0;
            if (rollA !== rollB) return rollA - rollB;
            return a.name.localeCompare(b.name);
        });
    }, [studentDues, searchTerm, filterClass, filterSection]);

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
        const set = new Set<string>(students.map(s => s.class).filter((c): c is string => Boolean(c)));
        return sortClasses(Array.from(set));
    }, [students]);

    const uniqueSections = useMemo(() => {
        if (filterClass === 'ALL') return [];
        const set = new Set<string>(students.filter(s => s.class === filterClass).map(s => s.section).filter((s): s is string => Boolean(s)));
        return Array.from(set).sort();
    }, [students, filterClass]);

    // Build ledger data for spreadsheet view
    const ledgerData = useMemo(() => {
        const emptyResult = { rows: [] as any[], columns: [] as { key: string; label: string; receivable: number; isNonMonthly: boolean }[] };
        if (studentsLoading || collectionsLoading || typesLoading || amountsLoading) return emptyResult;

        const today = new Date();
        const yr0 = today.getFullYear();
        const cm = today.getMonth();
        const academicStart = currentSchool?.academicYearStartMonth || 'April';
        const allMonths = getAcademicYearMonths(academicStart).filter(m => m !== 'Admission_month');
        const sesYr = cm >= (MONTH_MAP[academicStart] ?? 3) ? yr0 : yr0 - 1;
        const sesStart = new Date(sesYr, MONTH_MAP[academicStart] ?? 3, 1);
        const activeFT = feeTypes.filter(ft => ft.status === 'ACTIVE');
        const targetClass = filterClass !== 'ALL' ? filterClass : '';

        // Build columns with receivable amounts
        const nmHeads: { name: string; receivable: number }[] = [];
        const monthRcv: Record<string, number> = {};
        // Exam fee heads: fee types with "exam" in name, tied to specific months (not Admission_month)
        const examFeeHeads: { name: string; month: string; receivable: number }[] = [];

        activeFT.forEach(ft => {
            let amt = 0;
            if (targetClass) {
                const fa = feeAmounts.find(a => a.feeTypeId === ft.id && a.className === targetClass);
                amt = fa?.amount || 0;
            } else {
                const fas = feeAmounts.filter(a => a.feeTypeId === ft.id);
                amt = fas.length > 0 ? fas[0].amount : 0;
            }
            const isExamFee = ft.feeHeadName?.toLowerCase().includes('exam');
            if (ft.months?.includes('Admission_month')) {
                nmHeads.push({ name: ft.feeHeadName, receivable: amt });
            } else if (isExamFee) {
                // Exam fees get their own columns, placed before their associated month
                (ft.months || []).forEach(m => {
                    if (allMonths.includes(m)) {
                        examFeeHeads.push({ name: ft.feeHeadName, month: m, receivable: amt });
                    }
                });
            } else {
                (ft.months || []).forEach(m => { if (allMonths.includes(m)) monthRcv[m] = (monthRcv[m] || 0) + amt; });
            }
        });

        // Build exam fee lookup: month -> list of exam fee heads for that month
        const examFeesByMonth: Record<string, { name: string; receivable: number }[]> = {};
        examFeeHeads.forEach(ef => {
            if (!examFeesByMonth[ef.month]) examFeesByMonth[ef.month] = [];
            examFeesByMonth[ef.month].push({ name: ef.name, receivable: ef.receivable });
        });

        const columns: { key: string; label: string; receivable: number; isNonMonthly: boolean; isExamFee?: boolean }[] = [];
        nmHeads.forEach(h => columns.push({ key: `nm_${h.name}`, label: h.name, receivable: h.receivable, isNonMonthly: true }));
        allMonths.forEach(m => {
            const mi = MONTH_MAP[m]; if (mi === undefined) return;
            const y = mi < (MONTH_MAP[academicStart] ?? 3) ? sesYr + 1 : sesYr;
            // Insert exam fee columns BEFORE the month they belong to
            if (examFeesByMonth[m]) {
                examFeesByMonth[m].forEach(ef => {
                    columns.push({ key: `exam_${ef.name}_${m}`, label: ef.name, receivable: ef.receivable, isNonMonthly: true, isExamFee: true });
                });
            }
            columns.push({ key: `m_${m}`, label: `${m.substring(0, 3)}'${String(y).slice(-2)}`, receivable: monthRcv[m] || 0, isNonMonthly: false });
        });

        const nmNames = new Set(nmHeads.map(h => h.name));
        const examFeeNames = new Set(examFeeHeads.map(h => h.name));
        // Build reverse lookup: exam fee head name -> column key
        const examFeeColKey: Record<string, string> = {};
        examFeeHeads.forEach(ef => { examFeeColKey[ef.name] = `exam_${ef.name}_${ef.month}`; });

        const sessionStudents = students.filter(s => (s as any).session === activeFY);
        const filtered = sessionStudents.filter(s => {
            const ms = (s.fullName || s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (s.admissionNo || '').toLowerCase().includes(searchTerm.toLowerCase());
            return ms && (filterClass === 'ALL' || s.class === filterClass) && (filterSection === 'ALL' || s.section === filterSection);
        });

        filtered.sort((a, b) => {
            const d = (a.class || '').localeCompare(b.class || '');
            if (d !== 0) return d;
            const s = (a.section || '').localeCompare(b.section || '');
            if (s !== 0) return s;
            const rollA = parseInt(a.rollNo || '0') || 0;
            const rollB = parseInt(b.rollNo || '0') || 0;
            if (rollA !== rollB) return rollA - rollB;
            return (a.fullName || a.name || '').localeCompare(b.fullName || b.name || '');
        });

        const rows = filtered.map(student => {
            const cols = (feeCollections as any[]).filter(c => c.admissionNo === student.admissionNo && c.status !== 'CANCELLED' && new Date(c.paymentDate) >= sesStart);
            const payments: Record<string, { receiptNo: string; amount: number }[]> = {};
            cols.forEach((col: any) => {
                if (!col.paidFor) return;
                const pm = col.paidFor.split(',').map((m: string) => m.trim());
                const bd = col.feeBreakdown || {};
                pm.forEach((p: string) => {
                    if (allMonths.includes(p)) {
                        const k = `m_${p}`;
                        if (!payments[k]) payments[k] = [];
                        let ma = 0;
                        // Sum only non-admission & non-exam fee heads for the monthly column
                        Object.entries(bd).forEach(([fh, a]) => { if (!nmNames.has(fh) && !examFeeNames.has(fh)) { const rm = pm.filter((x: string) => allMonths.includes(x)); ma += (a as number) / (rm.length || 1); } });
                        if (ma === 0) {
                            // Fallback: only if no exam/non-monthly fees in breakdown at all
                            const hasSpecialFees = Object.keys(bd).some(fh => nmNames.has(fh) || examFeeNames.has(fh));
                            if (!hasSpecialFees) {
                                const rm = pm.filter((x: string) => allMonths.includes(x));
                                if (rm.length > 0) ma = col.paid / rm.length;
                            }
                        }
                        if (ma > 0) payments[k].push({ receiptNo: col.receiptNo || '', amount: Math.round(ma) });
                    }
                });
                // Map admission/non-monthly fee head payments
                Object.entries(bd).forEach(([fh, a]) => {
                    if (nmNames.has(fh)) {
                        const k = `nm_${fh}`;
                        if (!payments[k]) payments[k] = [];
                        payments[k].push({ receiptNo: col.receiptNo || '', amount: a as number });
                    }
                    // Map exam fee head payments to their own column
                    if (examFeeNames.has(fh)) {
                        const k = examFeeColKey[fh];
                        if (k) {
                            if (!payments[k]) payments[k] = [];
                            payments[k].push({ receiptNo: col.receiptNo || '', amount: a as number });
                        }
                    }
                });
            });
            return { id: student.id, name: (student.fullName || student.name || 'N/A').toUpperCase(), admissionNo: student.admissionNo || '', rollNo: student.rollNo || '', class: student.class || '', section: student.section || '', payments };
        });

        return { rows, columns };
    }, [students, feeCollections, feeTypes, feeAmounts, studentsLoading, collectionsLoading, typesLoading, amountsLoading, searchTerm, filterClass, filterSection, activeFY, currentSchool]);

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
                    <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2.25rem)', fontWeight: 900, margin: 0 }}>Due Report</h1>
                    <p style={{ opacity: 0.8, marginTop: '0.5rem', fontWeight: 600, fontSize: 'clamp(0.875rem, 2.5vw, 1rem)' }}>
                        {viewMode === 'ledger' ? 'Ledger View — Payment Tracker' : 'Full Breakdown of Payables & Payments'}
                    </p>
                    <p style={{ opacity: 0.8, fontWeight: 600, fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>
                        Session {activeFY}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
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
                        <button
                            onClick={() => setViewMode(viewMode === 'detailed' ? 'ledger' : 'detailed')}
                            className="btn no-print"
                            style={{
                                background: viewMode === 'ledger' ? '#f59e0b' : 'rgba(255,255,255,0.15)',
                                border: viewMode === 'ledger' ? '2px solid #f59e0b' : '2px solid rgba(255,255,255,0.3)',
                                padding: '0.875rem 1.25rem',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontWeight: 700,
                                color: 'white',
                                fontSize: 'clamp(0.75rem, 2.5vw, 1rem)',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            {viewMode === 'ledger' ? <LayoutGrid size={18} /> : <Table2 size={18} />}
                            {viewMode === 'ledger' ? 'DETAILED VIEW' : 'LEDGER VIEW'}
                        </button>
                    </div>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <label style={{ fontSize: 'clamp(0.75rem, 2vw, 0.8125rem)', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter by Class</label>
                        <select
                            style={{ width: '100%', height: '48px', padding: '0 1rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: 'clamp(0.875rem, 2.5vw, 0.9375rem)', fontWeight: 600, color: '#1e293b', background: '#f8fafc', cursor: 'pointer', outline: 'none', appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.25rem' }}
                            value={filterClass}
                            onChange={e => { setFilterClass(e.target.value); setFilterSection('ALL'); }}
                        >
                            <option value="ALL">All Classes</option>
                            {uniqueClasses.map(c => (
                                <option key={c} value={c}>{formatClassName(c, currentSchool?.useRomanNumerals)}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <label style={{ fontSize: 'clamp(0.75rem, 2vw, 0.8125rem)', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter by Section</label>
                        <select
                            style={{ width: '100%', height: '48px', padding: '0 1rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: 'clamp(0.875rem, 2.5vw, 0.9375rem)', fontWeight: 600, color: '#1e293b', background: '#f8fafc', cursor: 'pointer', outline: 'none', appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.25rem' }}
                            value={filterSection}
                            onChange={e => setFilterSection(e.target.value)}
                            disabled={filterClass === 'ALL'}
                        >
                            <option value="ALL">All Sections</option>
                            {uniqueSections.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Ledger Spreadsheet View */}
            {viewMode === 'ledger' && (
                <div className="glass-card ledger-view-container" style={{ padding: 0, overflow: 'hidden', marginBottom: '2rem' }}>
                    <div style={{ overflowX: 'auto', maxHeight: '75vh' }}>
                        <table className="ledger-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: '800px' }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                <tr style={{ background: '#1e293b', color: 'white' }}>
                                    <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 800, fontSize: '0.6875rem', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#1e293b', zIndex: 11, minWidth: '130px', borderRight: '2px solid #475569' }}>Roll / Student</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 800, fontSize: '0.6875rem', whiteSpace: 'nowrap', minWidth: '80px' }}>Class&Sec</th>
                                    {ledgerData.columns.map(col => (
                                        <th key={col.key} style={{ padding: '0.375rem 0.5rem', textAlign: 'center', fontWeight: 800, fontSize: '0.625rem', whiteSpace: 'nowrap', minWidth: '100px', background: (col as any).isExamFee ? '#134e4a' : col.isNonMonthly ? '#312e81' : '#1e293b', borderLeft: '1px solid #475569' }}>
                                            <div>{col.label}</div>
                                            {col.receivable > 0 && <div style={{ fontSize: '0.5625rem', opacity: 0.7, fontWeight: 600, marginTop: '2px' }}>₹{col.receivable.toLocaleString('en-IN')}</div>}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {ledgerData.rows.length === 0 ? (
                                    <tr><td colSpan={2 + ledgerData.columns.length} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}><AlertCircle size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} /><p style={{ fontWeight: 600 }}>No students found.</p></td></tr>
                                ) : ledgerData.rows.map((row: any, idx: number) => (
                                    <tr key={row.id} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                                        <td style={{ padding: '0.5rem', fontWeight: 700, color: '#1e293b', fontSize: '0.75rem', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: idx % 2 === 0 ? 'white' : '#f8fafc', zIndex: 5, borderRight: '2px solid #e2e8f0' }}>{row.rollNo ? `${row.rollNo}. ` : ''}{row.name}</td>
                                        <td style={{ padding: '0.5rem', fontWeight: 600, color: '#4338ca', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{formatClassName(row.class, currentSchool?.useRomanNumerals)} ({row.section})</td>
                                        {ledgerData.columns.map((col: any) => {
                                            const pays = row.payments[col.key];
                                            return (
                                                <td key={col.key} style={{ padding: '0.375rem 0.5rem', textAlign: 'center', fontSize: '0.6875rem', borderLeft: '1px solid #f1f5f9', background: pays && pays.length > 0 ? 'rgba(16, 185, 129, 0.06)' : undefined }}>
                                                    {pays && pays.length > 0 ? pays.map((py: any, i: number) => (
                                                        <div key={i} style={{ whiteSpace: 'nowrap' }}>
                                                            <span
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    // Find receipt from loaded feeCollections
                                                                    const receipt = (feeCollections as any[]).find(c => c.receiptNo === py.receiptNo);
                                                                    if (receipt) {
                                                                        // Find matching student data
                                                                        const stu = students.find(s => s.admissionNo === receipt.admissionNo);
                                                                        setSelectedReceipt({ ...receipt, _studentData: stu });
                                                                    }
                                                                }}
                                                                style={{ color: '#059669', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                                                            >{py.receiptNo}</span>
                                                            <span style={{ color: '#64748b', fontWeight: 600 }}> ({py.amount.toLocaleString('en-IN')})</span>
                                                        </div>
                                                    )) : null}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#64748b' }}>Showing {ledgerData.rows.length} students</span>
                        <button onClick={handlePrint} className="no-print" style={{ background: '#6366f1', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><Download size={14} /> PRINT LEDGER</button>
                    </div>
                </div>
            )}

            {/* Desktop Table View */}
            <div className="glass-card desktop-only" style={{ padding: 0, overflow: 'hidden', display: viewMode === 'ledger' ? 'none' : 'none' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#334155', color: 'white' }}>
                            <th style={{ width: '50px', padding: '1rem' }}></th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800 }}>ROLL / STUDENT</th>
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
                                            <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9375rem' }}>{s.rollNo ? `${s.rollNo}. ` : ''}{s.name}</div>
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
                                                                        <td colSpan={2} style={{ padding: '0.75rem', textAlign: 'right' }}>GROSS PAYABLE</td>
                                                                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1e293b' }}>₹{s.totalPayable.toLocaleString('en-IN')}</td>
                                                                    </tr>
                                                                    {s.totalDiscount > 0 && (
                                                                        <tr style={{ color: '#10b981' }}>
                                                                            <td colSpan={2} style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>DISCOUNT</td>
                                                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>- ₹{s.totalDiscount.toLocaleString('en-IN')}</td>
                                                                        </tr>
                                                                    )}
                                                                    {s.totalDiscount > 0 && (
                                                                        <tr>
                                                                            <td colSpan={2} style={{ padding: '0.75rem', textAlign: 'right', borderTop: '1px solid #e2e8f0' }}>NET PAYABLE</td>
                                                                            <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1e293b', borderTop: '1px solid #e2e8f0' }}>₹{(s.totalPayable - s.totalDiscount).toLocaleString('en-IN')}</td>
                                                                        </tr>
                                                                    )}
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
                                                                                <td style={{ padding: '0.75rem', fontWeight: 700, color: '#059669' }}>
                                                                                    <span
                                                                                        onClick={() => {
                                                                                            const stu = students.find(st => st.admissionNo === pay.admissionNo);
                                                                                            setSelectedReceipt({ ...pay, _studentData: stu });
                                                                                        }}
                                                                                        style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                                                                                    >{pay.receiptNo}</span>
                                                                                    {' '}<span style={{ fontSize: '0.625rem', opacity: 0.6 }}>({pay.paymentMode})</span>
                                                                                </td>
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
            {viewMode !== 'ledger' && <div className="mobile-only" style={{ width: '100%' }}>
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
                                        <div style={{ fontWeight: 800, color: '#1e293b', fontSize: 'clamp(0.9375rem, 3vw, 1.125rem)', marginBottom: '0.25rem' }}>{s.rollNo ? `${s.rollNo}. ` : ''}{s.name}</div>
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
                                                <span style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>GROSS PAYABLE</span>
                                                <span style={{ fontSize: 'clamp(0.875rem, 2.5vw, 1rem)', color: '#1e293b' }}>₹{s.totalPayable.toLocaleString('en-IN')}</span>
                                            </div>
                                            {s.totalDiscount > 0 && (
                                                <div style={{ padding: '0.5rem 0.75rem', background: '#ecfdf5', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#10b981' }}>
                                                    <span style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>DISCOUNT</span>
                                                    <span style={{ fontSize: 'clamp(0.875rem, 2.5vw, 1rem)' }}>- ₹{s.totalDiscount.toLocaleString('en-IN')}</span>
                                                </div>
                                            )}
                                            {s.totalDiscount > 0 && (
                                                <div style={{ padding: '0.75rem', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid #e2e8f0' }}>
                                                    <span style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>NET PAYABLE</span>
                                                    <span style={{ fontSize: 'clamp(0.875rem, 2.5vw, 1rem)', color: '#1e293b' }}>₹{(s.totalPayable - s.totalDiscount).toLocaleString('en-IN')}</span>
                                                </div>
                                            )}
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
            </div>}

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

            {isPrinting && viewMode !== 'ledger' && (
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
                                <th style={{ padding: '6px', textAlign: 'left' }}>Roll / Student Name</th>
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
                                    <td style={{ padding: '6px', fontWeight: 700 }}>{s.rollNo ? `${s.rollNo}. ` : ''}{s.name}</td>
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

            {isPrinting && viewMode === 'ledger' && (
                <div className="print-report-view" style={{ maxWidth: '297mm', margin: '0 auto', padding: '0 10mm' }}>
                    <div style={{ textAlign: 'center', borderBottom: '2px solid #334155', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase' }}>FEE PAYMENT LEDGER</h1>
                        <p style={{ margin: '0.25rem 0', fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>{currentSchool?.fullName || currentSchool?.name || actualSchool?.schoolName || 'School Name'}</p>
                        <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.7 }}>Report Date: {new Date().toLocaleDateString('en-GB')} | Class: {filterClass === 'ALL' ? 'All' : formatClassName(filterClass, currentSchool?.useRomanNumerals)}{filterSection !== 'ALL' ? ` (${filterSection})` : ''} | Session: {activeFY}</p>
                    </div>
                    <table className="ledger-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7px', border: '1px solid #94a3b8' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #334155' }}>
                                <th style={{ padding: '3px', textAlign: 'left', fontSize: '7px', border: '1px solid #94a3b8' }}>S.No</th>
                                <th style={{ padding: '3px', textAlign: 'left', fontSize: '7px', border: '1px solid #94a3b8' }}>Roll / Student</th>
                                <th style={{ padding: '3px', textAlign: 'left', fontSize: '7px', border: '1px solid #94a3b8' }}>Class</th>
                                {ledgerData.columns.map((col: any) => (
                                    <th key={col.key} style={{ padding: '3px', textAlign: 'center', fontSize: '6px', whiteSpace: 'nowrap', border: '1px solid #94a3b8' }}>
                                        {col.label}{col.receivable > 0 ? ` (₹${col.receivable})` : ''}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ledgerData.rows.map((row: any, idx: number) => (
                                <tr key={row.id} style={{ borderBottom: '0.5px solid #e2e8f0' }}>
                                    <td style={{ padding: '2px 3px', fontSize: '7px', border: '1px solid #cbd5e1' }}>{idx + 1}</td>
                                    <td style={{ padding: '2px 3px', fontSize: '7px', fontWeight: 700, border: '1px solid #cbd5e1' }}>{row.rollNo ? `${row.rollNo}. ` : ''}{row.name}</td>
                                    <td style={{ padding: '2px 3px', fontSize: '7px', border: '1px solid #cbd5e1' }}>{row.class}-{row.section}</td>
                                    {ledgerData.columns.map((col: any) => {
                                        const pays = row.payments[col.key];
                                        return (
                                            <td key={col.key} style={{ padding: '2px 3px', textAlign: 'center', fontSize: '6px', border: '1px solid #cbd5e1' }}>
                                                {pays && pays.length > 0 ? pays.map((py: any, i: number) => (
                                                    <div key={i}>{py.receiptNo} ({py.amount})</div>
                                                )) : ''}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
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
                    ${selectedReceipt ? `
                    /* Receipt modal print mode */
                    .printable-receipt, .printable-receipt * { visibility: visible !important; }
                    .printable-receipt {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        padding: 0.5cm !important;
                        box-sizing: border-box !important;
                    }
                    .printable-receipt > div {
                        width: 100% !important;
                        max-width: 100% !important;
                    }
                    .no-print { display: none !important; }
                    @page { 
                        size: A5;
                        margin: 0;
                    }
                    ` : `
                    /* Report print mode */
                    .print-report-view, .print-report-view * { visibility: visible !important; }
                    .print-report-view {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        padding: ${viewMode === 'ledger' ? '8mm 5mm' : '12mm 15mm'};
                        box-sizing: border-box;
                    }
                    @page { 
                        margin: 0;
                        size: ${viewMode === 'ledger' ? 'A4 landscape' : 'A4 portrait'};
                    }
                    `}
                    
                    /* Ensure content doesn't overflow */
                    table {
                        page-break-inside: auto;
                        border-collapse: collapse !important;
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
                    /* Vertical & horizontal grid lines for ledger */
                    .ledger-table th,
                    .ledger-table td {
                        border: 1px solid #cbd5e1 !important;
                    }
                    .ledger-table thead th {
                        border-color: #475569 !important;
                    }
                }
            `}</style>

            {/* Receipt Modal */}
            {selectedReceipt && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.6)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    overflowY: 'auto',
                    padding: '2rem 1rem'
                }} onClick={() => setSelectedReceipt(null)}>
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'white',
                            borderRadius: '16px',
                            maxWidth: '650px',
                            width: '100%',
                            padding: '1.5rem',
                            position: 'relative',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                            animation: 'fadeIn 0.2s ease-out'
                        }}
                    >
                        <FeeReceipt
                            receipt={selectedReceipt}
                            studentData={selectedReceipt._studentData || {
                                fullName: selectedReceipt.studentName,
                                admissionNo: selectedReceipt.admissionNo,
                                class: selectedReceipt.class,
                                section: selectedReceipt.section,
                                mobileNo: selectedReceipt.mobileNo || ''
                            }}
                            schoolInfo={
                                schoolData?.find((s: any) => s.id === `school_info_${currentSchool?.id}`) ||
                                schoolData?.find((s: any) =>
                                    s.id === 'school_info' ||
                                    s.type === 'school_info' ||
                                    s.type === 'institution' ||
                                    s.type === 'Institution Information'
                                )
                            }
                            onClose={() => setSelectedReceipt(null)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default DueReport;
