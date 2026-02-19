import React, { useState, useEffect, useMemo } from 'react';
import {
    Search,
    ArrowLeft,
    X,
    Check,
    ShoppingBag,
    ArrowUp,
    ArrowDown,
    ArrowUpDown
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { db } from '../../lib/firebase';
import { collection, Timestamp, query, where, getDocs, doc, orderBy, runTransaction } from 'firebase/firestore';
import { guardedAddDoc, guardedUpdateDoc } from '../../lib/firestoreWrite';
import { useSchool } from '../../context/SchoolContext';
import FeeReceipt from '../../components/fees/FeeReceipt';
import { getActiveClasses } from '../../constants/app';
import { formatClassName } from '../../utils/formatters';
import { getAcademicYearMonths, getMonthIndexMap } from '../../utils/academicYear';
import { useLocation, useNavigate, useParams } from 'react-router-dom';


// Helper function to format date with time
const formatDateTime = (date: any): string => {
    if (!date) return 'N/A';

    const d = date?.toDate ? date.toDate() : new Date(date);

    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${day}-${month}-${year} ${hours}:${minutes}`;
};

type ViewState = 'SEARCH' | 'PAY' | 'LEDGER' | 'SALE' | 'RECEIPT';

const FeeManagement: React.FC = () => {
    const { currentSchool } = useSchool();
    const { schoolId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [view, setView] = useState<ViewState>('SEARCH');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const { data: students } = useFirestore<any>('students');
    const { data: feeTypes } = useFirestore<any>('fee_types');
    const { data: allFeeAmounts } = useFirestore<any>('fee_amounts');
    const { data: feeCollections } = useFirestore<any>('fee_collections');

    const activeFY = currentSchool?.activeFinancialYear || '2025-26';
    const feeAmounts = allFeeAmounts.filter((fa: any) => fa.financialYear === activeFY || !fa.financialYear);
    const [ledgerHistory, setLedgerHistory] = useState<any[]>([]);
    const [loadingLedger, setLoadingLedger] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [cart, setCart] = useState<any[]>([]);
    const { data: dbItems } = useFirestore<any>('settings');
    const [paidMonthsMap, setPaidMonthsMap] = useState<Record<string, string>>({});
    const [currentReceipt, setCurrentReceipt] = useState<any>(null);
    const [dynamicFees, setDynamicFees] = useState<Record<string, number>>({});
    const [selectedClass, setSelectedClass] = useState('ALL');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'admissionNo', direction: 'asc' });
    const [saleDiscount, setSaleDiscount] = useState(0);

    // Fee Form State
    const [selectedMonths, setSelectedMonths] = useState<Record<string, Record<string, number>>>({});
    const [feeDetails, setFeeDetails] = useState({
        admissionFee: 0,
        annualFee: 0,
        transportFee: 0,
        tuitionFee: 0,
        miscellaneousFee: 0,
        previousDues: 0,
        discount: 0,
        amountReceived: 0,
        paymentMode: '',
        remarks: '',
        sendSMS: false,
        paymentDate: new Date().toISOString().split('T')[0]
    });

    // Handle incoming Form Sale data
    useEffect(() => {
        if (location.state?.formSaleData) {
            const data = location.state.formSaleData;

            // Synthesize a temporary student object
            const tempStudent = {
                id: 'FS-' + Date.now(),
                admissionNo: 'FORM-SALE',
                fullName: data.studentName,
                class: data.studentClass,
                section: '',
                mobileNo: data.whatsappNumber,
                financeType: 'GENERAL',
                isFormSale: true
            };

            setSelectedStudent(tempStudent);

            // Pre-select Form Sale fee
            const newMonths = {
                'Additional': {
                    'Form Sale': Number(data.formAmount)
                }
            };
            setSelectedMonths(newMonths);
            setDynamicFees({ 'Form Sale': Number(data.formAmount) });

            // Pre-populate payment details
            setFeeDetails({
                admissionFee: 0,
                annualFee: 0,
                transportFee: 0,
                tuitionFee: 0,
                miscellaneousFee: 0,
                previousDues: 0,
                discount: 0,
                amountReceived: Number(data.formAmount),
                paymentMode: 'Cash',
                remarks: 'Form Sale Payment',
                sendSMS: false,
                paymentDate: new Date().toISOString().split('T')[0]
            });

            // Set view to PAY
            setView('PAY');

            // Clear location state to prevent re-triggering on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.altKey && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                handleNewBill();
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);

    // Dynamic months based on academic year start month (excluding Admission_month for fee collection)
    const allMonths = getAcademicYearMonths(currentSchool?.academicYearStartMonth || 'April');
    const months = allMonths.filter(m => m !== 'Admission_month');

    // Calculate real-time dues for each student (same logic as DueReport)
    const studentDuesMap = useMemo(() => {
        const duesMap = new Map<string, number>();

        if (!students || !feeCollections || !feeTypes || !feeAmounts) return duesMap;

        // Dynamic month index mapping
        const MONTH_MAP = getMonthIndexMap();

        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        // Get academic year start month index (default April = 3)
        const academicStartMonthIdx = MONTH_MAP[currentSchool?.academicYearStartMonth || 'April'];
        const sessionStartYear = currentMonth >= academicStartMonthIdx ? currentYear : currentYear - 1;
        const sessionStartDate = new Date(sessionStartYear, academicStartMonthIdx, 1);

        students.forEach(student => {
            const admType = student.admissionType || 'NEW';
            const admDateRaw = student.admissionDate ? new Date(student.admissionDate) : null;

            let startMonthIdx: number;
            let startYear: number;

            if (admType === 'NEW' && admDateRaw && admDateRaw >= sessionStartDate) {
                startMonthIdx = admDateRaw.getMonth();
                startYear = admDateRaw.getFullYear();
            } else {
                startMonthIdx = academicStartMonthIdx;
                startYear = sessionStartYear;
            }

            let totalPayable = 0;

            feeTypes.forEach(type => {
                if (type.status !== 'ACTIVE') return;

                const matchesAdmType = type.admissionTypes?.includes(admType);
                if (!matchesAdmType) return;

                const matchesStudentType = type.studentTypes?.includes(student.studentCategory || 'GENERAL');

                // Check if fee type's classes array includes the student's class
                let matchesClass = type.classes?.includes(student.class || '');

                // Fallback for stale classes
                if (!matchesClass && student.class) {
                    const hasAmountForClass = feeAmounts.some(fa => fa.feeTypeId === type.id && fa.className === student.class);
                    if (hasAmountForClass) {
                        matchesClass = true;
                    }
                }

                if (matchesClass && matchesStudentType) {
                    const amountConfig = feeAmounts.find(fa => fa.feeTypeId === type.id && fa.className === student.class);
                    if (!amountConfig || !amountConfig.amount) return;

                    const headName = (type.feeHeadName || '').toLowerCase();
                    const isMonthlyFee = headName.includes('tuition') || headName.includes('tution') || headName.includes('monthly');
                    const studentMonthlyFee = student.monthlyFee ? parseFloat(student.monthlyFee) : null;
                    const useStudentFee = isMonthlyFee && studentMonthlyFee && studentMonthlyFee > 0;

                    type.months?.forEach((monthName: string) => {
                        let isDue = false;

                        if (monthName === 'Admission_month') {
                            if (admType === 'OLD') {
                                isDue = true;
                            } else if (admType === 'NEW' && admDateRaw) {
                                isDue = today >= admDateRaw;
                            }
                        } else {
                            const targetMonthIdx = MONTH_MAP[monthName];
                            if (targetMonthIdx !== undefined) {
                                // If month is before academic start month, it belongs to next calendar year
                                const targetYear = targetMonthIdx < academicStartMonthIdx ? sessionStartYear + 1 : sessionStartYear;
                                const dueDate = new Date(targetYear, targetMonthIdx, 5); // Using 5 as default due day

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
                            totalPayable += useStudentFee ? studentMonthlyFee : amountConfig.amount;
                        }
                    });
                }
            });

            const studentPayments = feeCollections
                .filter(c =>
                    c.admissionNo === student.admissionNo &&
                    c.status !== 'CANCELLED' &&
                    new Date(c.paymentDate) >= sessionStartDate
                );

            const totalPaid = studentPayments.reduce((sum, c) => sum + (Number(c.paid) || 0), 0);
            const totalDiscount = studentPayments.reduce((sum, c) => sum + (Number(c.discount) || 0), 0);
            const dues = totalPayable - totalPaid - totalDiscount;

            duesMap.set(student.admissionNo, dues);
        });

        return duesMap;
    }, [students, feeCollections, feeTypes, feeAmounts, currentSchool]);

    const processedStudents = useMemo(() => {
        if (!searchTerm && selectedClass === 'ALL') return [];

        let result = students.filter(stu => {
            const matchesSearch = !searchTerm || (
                (stu.admissionNo && stu.admissionNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (stu.fullName && stu.fullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (stu.fatherName && stu.fatherName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (stu.motherName && stu.motherName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (stu.mobileNo && stu.mobileNo.includes(searchTerm))
            );
            const matchesClass = selectedClass === 'ALL' || stu.class === selectedClass;
            const matchesSession = !activeFY || (stu.session && stu.session === activeFY);
            return matchesSearch && matchesClass && matchesSession;
        });

        // Apply Sorting
        if (sortConfig.key) {
            result.sort((a, b) => {
                let aValue: any;
                let bValue: any;

                if (sortConfig.key === 'tillDate') {
                    aValue = studentDuesMap.get(a.admissionNo) || 0;
                    bValue = studentDuesMap.get(b.admissionNo) || 0;
                } else if (sortConfig.key === 'fullName') {
                    aValue = (a.fullName || '').toLowerCase();
                    bValue = (b.fullName || '').toLowerCase();
                } else if (sortConfig.key === 'rollNo') {
                    aValue = parseInt(a.classRollNo) || 0;
                    bValue = parseInt(b.classRollNo) || 0;
                } else {
                    aValue = (a[sortConfig.key] || '').toString().toLowerCase();
                    bValue = (b[sortConfig.key] || '').toString().toLowerCase();
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result.slice(0, (searchTerm || selectedClass !== 'ALL') ? 100 : 10);
    }, [students, searchTerm, selectedClass, sortConfig, studentDuesMap]);

    const filteredStudents = processedStudents;

    const activeClasses = (dbItems && dbItems.length > 0) ? getActiveClasses(dbItems.filter((d: any) => d.type === 'class'), activeFY) : [];


    const handleNewBill = () => {
        setSelectedMonths({});
        setCart([]);
        setFeeDetails({
            admissionFee: 0,
            annualFee: 0,
            transportFee: 0,
            tuitionFee: 0,
            miscellaneousFee: 0,
            previousDues: 0,
            discount: 0,
            amountReceived: 0,
            paymentMode: 'Cash',
            remarks: '',
            sendSMS: true,
            paymentDate: new Date().toISOString().split('T')[0]
        });
        setDynamicFees({});
        setSelectedStudent(null);
        setSearchTerm('');
        setView('SEARCH');
        setCurrentReceipt(null);
    };

    // Calculate total receivable
    const totalReceivable = Object.entries(selectedMonths).reduce((total, [_month, fees]) => {
        return total + Object.values(fees as Record<string, number>).reduce((sum, amount) => sum + amount, 0);
    }, 0) + (feeDetails.previousDues || 0) - feeDetails.discount;

    // Sync amountReceived with totalReceivable when totals change
    useEffect(() => {
        setFeeDetails(prev => ({ ...prev, amountReceived: totalReceivable }));
    }, [totalReceivable]);

    const handleSelectStudent = async (stu: any, nextView: ViewState) => {
        // Clear previous state when selecting a NEW student for PAYMENT or SALE
        if (nextView === 'PAY' || nextView === 'SALE') {
            setSelectedMonths({});
            setCart([]);
        }

        setSelectedStudent(stu);
        setView(nextView);

        if (nextView === 'LEDGER' || nextView === 'PAY') {
            await fetchLedgerData(stu.admissionNo || stu.id);

            if (nextView === 'PAY') {
                // Fetch ledger data already called above, but we need to process it for the map
                // fetchLedgerData updates ledgerHistory state, but we might need it immediately
                const q = query(
                    collection(db, 'fee_collections'),
                    where('admissionNo', '==', stu.admissionNo || stu.id),
                    where('schoolId', '==', currentSchool?.id)
                );
                const snapshot = await getDocs(q);
                const history = snapshot.docs.map(doc => doc.data());

                const map: Record<string, string> = {};
                history.forEach((rec: any) => {
                    if (rec.status === 'CANCELLED') return;

                    if (rec.paidFor) {
                        const paidMonths = rec.paidFor.split(',').map((m: string) => m.trim());
                        paidMonths.forEach((m: string) => {
                            if (m) map[m] = rec.receiptNo;
                        });
                    }

                    // Also scan feeBreakdown for specific fee heads (Admission, Annual, etc.)
                    if (rec.feeBreakdown) {
                        Object.entries(rec.feeBreakdown).forEach(([feeName, amount]) => {
                            if (Number(amount) > 0) {
                                map[feeName] = rec.receiptNo;
                            }
                        });
                    }
                });
                setPaidMonthsMap(map);

                // Normalization helper
                const normalize = (s: string) => (s || '').toString().trim().replace(/\s+/g, ' ');
                const studentClass = normalize(stu.class);

                // Fetch configured fee amounts with normalized class matching
                const classFeeAmounts = feeAmounts.filter((fa: any) => normalize(fa.className) === studentClass);

                const fees: Record<string, number> = {};
                classFeeAmounts.forEach((fa: any) => {
                    fees[fa.feeTypeName] = fa.amount;
                });
                setDynamicFees(fees);

                // Helper for fuzzy matching fee types and getting actual key from dynamicFees
                const getFee = (search: string[]) => {
                    const key = Object.keys(fees).find(k =>
                        search.some(term => k.toLowerCase().includes(term))
                    );
                    return key ? fees[key] : 0;
                };

                // Auto-populate fee details with configured amounts
                setFeeDetails({
                    admissionFee: getFee(['admission']),
                    annualFee: getFee(['annual']),
                    transportFee: getFee(['transport']),
                    tuitionFee: (stu.monthlyFee && Number(stu.monthlyFee) > 0) ? Number(stu.monthlyFee) : getFee(['tuition', 'tution', 'monthly']),
                    miscellaneousFee: 0,
                    previousDues: studentDuesMap.get(stu.admissionNo || stu.id) || 0,
                    discount: 0,
                    paymentMode: 'Cash',
                    remarks: '',
                    sendSMS: true,
                    paymentDate: new Date().toISOString().split('T')[0],
                    amountReceived: 0
                });
            }
        }

        // Reset form when switching students
        if (nextView === 'SEARCH') {
            setSelectedMonths({});
            setCart([]);
            setDynamicFees({});
        }
    };

    const fetchLedgerData = async (admNo: string) => {
        setLoadingLedger(true);
        try {
            const q = query(
                collection(db, 'fee_collections'),
                where('admissionNo', '==', admNo),
                where('schoolId', '==', currentSchool?.id)
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Remove duplicates based on receiptNo
            const uniqueData = data.filter((item: any, index, self) =>
                index === self.findIndex((t: any) => t.receiptNo === item.receiptNo)
            );

            // Sort in memory by date (descending)
            uniqueData.sort((a: any, b: any) => {
                const dateA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date || 0).getTime();
                const dateB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date || 0).getTime();
                return dateB - dateA; // Descending order (newest first)
            });

            setLedgerHistory(uniqueData);
        } catch (error) {
            console.error("Error fetching ledger:", error);
        } finally {
            setLoadingLedger(false);
        }
    };

    const handlePayNow = async () => {
        // Allow if fees are selected OR if there are previous dues/paying amount
        const hasSelectedFees = Object.keys(selectedMonths).length > 0;
        const hasPreviousDues = (feeDetails.previousDues || 0) > 0;
        const isPaying = (feeDetails.amountReceived || 0) > 0;

        if (!selectedStudent || (!hasSelectedFees && !hasPreviousDues && !isPaying)) {
            alert("Please select a fee or make a payment for previous dues.");
            return;
        }

        if (!feeDetails.paymentMode) {
            alert("Please select payment mode.");
            return;
        }

        setProcessing(true);

        // Calculate totals from selected months and fees
        const totalAmount = Object.entries(selectedMonths).reduce((total, [_month, fees]) => {
            return total + Object.values(fees as Record<string, number>).reduce((sum, amount) => sum + amount, 0);
        }, 0) + (feeDetails.previousDues || 0);
        const paidAmount = feeDetails.amountReceived;
        const currentDues = totalAmount - feeDetails.discount - paidAmount;

        try {
            // Sequential Receipt Number Generation using Firestore Transaction
            const receiptNo = await runTransaction(db, async (transaction) => {
                const prefix = currentSchool?.admissionNumberPrefix ||
                    (currentSchool?.fullName || currentSchool?.name || 'SCH').substring(0, 3).toUpperCase();

                // Use a unified money_receipt_counter for all collections to avoid conflicts
                const counterDocRef = doc(db, 'settings', `money_receipt_counter_${schoolId}`);
                const counterSnap = await transaction.get(counterDocRef);

                let nextNumber = 1;
                if (counterSnap.exists()) {
                    nextNumber = (counterSnap.data().lastNumber || 0) + 1;
                }

                transaction.set(counterDocRef, {
                    lastNumber: nextNumber,
                    updatedAt: Timestamp.now(),
                    schoolId: schoolId,
                    type: 'money_receipt_counter'
                }, { merge: true });

                return `${prefix}-${nextNumber.toString().padStart(4, '0')}`;
            });

            // Prepare fee breakdown
            const feeBreakdown: Record<string, number> = {};
            Object.entries(selectedMonths).forEach(([_month, fees]) => {
                Object.entries(fees as Record<string, number>).forEach(([feeType, amount]) => {
                    if (!feeBreakdown[feeType]) {
                        feeBreakdown[feeType] = 0;
                    }
                    feeBreakdown[feeType] += amount;
                });
            });

            // 1. Save Collection Record
            const collectionData = {
                admissionNo: selectedStudent.admissionNo,
                studentName: selectedStudent.fullName,
                class: selectedStudent.class,
                section: selectedStudent.section,
                mobileNo: selectedStudent.mobileNo || '',
                date: Timestamp.now(), // Use Firestore Timestamp
                paymentDate: feeDetails.paymentDate,
                paidFor: Object.keys(selectedMonths).join(', '),
                feeBreakdown: feeBreakdown, // Store fee-wise breakdown
                ...feeBreakdown, // Also store individual fees for backward compatibility
                previousDues: feeDetails.previousDues || 0,
                discount: feeDetails.discount,
                total: totalAmount,
                paid: paidAmount,
                dues: currentDues,
                paymentMode: feeDetails.paymentMode,
                remarks: feeDetails.remarks,
                receiptNo,
                schoolId: currentSchool?.id,
                financialYear: activeFY,
                status: 'PAID'
            };

            await guardedAddDoc(collection(db, 'fee_collections'), collectionData);

            // 2. Update Student's Current Dues in their record (skip for Form Sale temporary students)
            if (selectedStudent.id && !selectedStudent.isFormSale) {
                await guardedUpdateDoc(doc(db, 'students', selectedStudent.id), {
                    basicDues: currentDues
                });
            }

            setCurrentReceipt(collectionData);
            setView('RECEIPT');
        } catch (error) {
            console.error("Payment failed:", error);
            alert("Payment failed. Please try again.");
        } finally {
            setProcessing(false);
        }
    };

    const handleShowReceipt = (receipt: any) => {
        setCurrentReceipt(receipt);
        setView('RECEIPT');
    };

    const handleAddToCart = (item: any) => {
        // Resolve price: for class-wise items, use the student's class price
        let resolvedPrice = item.price || 0;
        if (item.pricingType === 'classwise' && item.classPrices && selectedStudent?.class) {
            const classPrice = item.classPrices[selectedStudent.class];
            if (classPrice !== undefined && classPrice > 0) {
                resolvedPrice = classPrice;
            } else {
                alert(`No price configured for "${item.name}" in ${selectedStudent.class}. Please set the price in Inventory Master.`);
                return;
            }
        }

        const existing = cart.find(c => c.name === item.name);
        if (existing) {
            setCart(cart.map(c => c.name === item.name ? { ...c, qty: c.qty + 1 } : c));
        } else {
            setCart([...cart, { name: item.name, price: resolvedPrice, qty: 1 }]);
        }
    };

    const handleRemoveFromCart = (itemName: string) => {
        setCart(cart.filter(c => c.name !== itemName));
    };

    const handleSaleCheckout = async () => {
        if (cart.length === 0) return;
        setProcessing(true);
        const grossTotal = cart.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
        const finalTotal = Math.max(0, grossTotal - saleDiscount);

        try {
            // Sequential Sale Receipt Number Generation using Firestore Transaction
            const receiptNo = await runTransaction(db, async (transaction) => {
                const prefix = currentSchool?.admissionNumberPrefix ||
                    (currentSchool?.fullName || currentSchool?.name || 'SCH').substring(0, 3).toUpperCase();

                // Use the same unified counter as fees
                const counterDocRef = doc(db, 'settings', `money_receipt_counter_${schoolId}`);
                const counterSnap = await transaction.get(counterDocRef);

                let nextNumber = 1;
                if (counterSnap.exists()) {
                    nextNumber = (counterSnap.data().lastNumber || 0) + 1;
                }

                transaction.set(counterDocRef, {
                    lastNumber: nextNumber,
                    updatedAt: Timestamp.now(),
                    schoolId: schoolId,
                    type: 'money_receipt_counter'
                }, { merge: true });

                return `${prefix}-${nextNumber.toString().padStart(4, '0')}`;
            });
            // Build fee breakdown from cart items for receipt display
            const feeBreakdown: Record<string, number> = {};
            cart.forEach(item => {
                feeBreakdown[item.name] = item.price * item.qty;
            });

            const saleData = {
                admissionNo: selectedStudent.admissionNo,
                studentName: selectedStudent.fullName,
                class: selectedStudent.class || '',
                section: selectedStudent.section || '',
                mobileNo: selectedStudent.mobileNo || '',
                date: Timestamp.now(),
                items: cart,
                total: grossTotal, // Store gross total
                paid: finalTotal,  // Paid amount is the discounted net
                previousDues: 0,
                discount: saleDiscount,
                grossTotal: grossTotal,
                paymentMode: 'Cash', // Default
                receiptNo,
                feeBreakdown,
                paidFor: 'Inventory Sale',
                schoolId: currentSchool?.id,
                financialYear: activeFY,
                status: 'PAID',
                type: 'SALE'
            };

            await guardedAddDoc(collection(db, 'fee_collections'), saleData);
            setCart([]);
            setSaleDiscount(0);
            setCurrentReceipt(saleData);
            setView('RECEIPT');
        } catch (error) {
            console.error("Sale failed:", error);
        } finally {
            setProcessing(false);
        }
    };


    const inventoryItems = (dbItems && dbItems.length > 0) ? [...dbItems].filter(d => d.type === 'inventory' && (d.financialYear === activeFY || !d.financialYear)).sort((a, b) => a.name.localeCompare(b.name)) : [];

    const renderSearch = () => {
        return (
            <div className="animate-fade-in">
                <div className="page-header">
                    <div>
                        <h1 style={{ fontSize: '1.875rem', fontWeight: 800 }}>Fee Collection</h1>
                        <p style={{ color: 'var(--text-muted)' }}>Search student to manage fees, ledger or sales.</p>
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px', gap: '1.5rem', alignItems: 'center', maxWidth: '900px', margin: '0 auto' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search by Adm No, Name, Parents or Mobile..."
                                className="input-field"
                                style={{ padding: '0 1rem 0 3.5rem', height: '3.5rem', fontSize: '1.125rem', borderRadius: '1.25rem', lineHeight: '3.5rem' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div>
                            <select
                                className="input-field"
                                style={{ height: '3.5rem', borderRadius: '1.25rem', fontWeight: 600, padding: '0 2.5rem 0 1.25rem', lineHeight: 'normal' }}
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                            >
                                <option value="ALL">All Classes</option>
                                {activeClasses.map((cls: any) => (
                                    <option key={cls.id || cls.name} value={cls.name}>
                                        {formatClassName(cls.name, currentSchool?.useRomanNumerals)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="glass-card animate-slide-up" style={{ padding: '0', overflow: 'hidden' }}>
                    <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>
                            {searchTerm || selectedClass !== 'ALL' ? 'Search Results' : 'Students List'}
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', background: '#e2e8f0', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>
                                {filteredStudents.length} Students
                            </span>
                        </h3>
                        <p style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 500 }}>
                            {searchTerm || selectedClass !== 'ALL' ? 'Showing matches' : 'Select criteria to view students'}
                        </p>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: '#1e293b', color: 'white' }}>
                                <tr>
                                    {[
                                        { label: 'Adm No.', key: 'admissionNo' },
                                        { label: 'Student Name', key: 'fullName' },
                                        { label: 'Father Name', key: 'fatherName' },
                                        { label: 'Area/Fare', key: 'district' },
                                        { label: 'Class', key: 'class' },
                                        { label: 'Roll No.', key: 'rollNo' },
                                        { label: 'Student Type', key: 'financeType' },
                                        { label: 'Mobile No', key: 'mobileNo' },
                                        { label: 'Till Date', key: 'tillDate' }
                                    ].map((col) => (
                                        <th
                                            key={col.key}
                                            style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                                            onClick={() => {
                                                setSortConfig(prev => ({
                                                    key: col.key,
                                                    direction: prev.key === col.key && prev.direction === 'asc' ? 'desc' : 'asc'
                                                }));
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {col.label}
                                                {sortConfig.key === col.key ? (
                                                    sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                                ) : (
                                                    <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Operation</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.length > 0 ? filteredStudents.map((stu) => {
                                    const dues = studentDuesMap.get(stu.admissionNo) || 0;
                                    return (
                                        <tr key={stu.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover-row">
                                            <td style={{ padding: '0.75rem 1rem' }}>{stu.admissionNo}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{stu.fullName?.toUpperCase()}</td>
                                            <td style={{ padding: '0.75rem 1rem' }}>{stu.fatherName?.toUpperCase()}</td>
                                            <td style={{ padding: '0.75rem 1rem' }}>{stu.district?.toUpperCase()}</td>
                                            <td style={{ padding: '0.75rem 1rem' }}>{formatClassName(stu.class, currentSchool?.useRomanNumerals)}-{stu.section}</td>
                                            <td style={{ padding: '0.75rem 1rem' }}>{stu.classRollNo}</td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <span style={{
                                                    padding: '0.2rem 0.5rem',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    background: stu.financeType === 'TRANSPORT' ? '#fef3c7' : '#e0e7ff',
                                                    color: stu.financeType === 'TRANSPORT' ? '#92400e' : '#3730a3'
                                                }}>
                                                    {stu.financeType || 'GENERAL'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem' }}>{stu.mobileNo}</td>
                                            <td style={{ padding: '0.75rem 1rem', color: dues > 0 ? '#ef4444' : 'inherit', fontWeight: 700 }}>{dues.toFixed(2)}</td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                    <button onClick={() => handleSelectStudent(stu, 'PAY')} style={{ background: '#22c55e', color: 'white', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Rcpt</button>
                                                    <button onClick={() => handleSelectStudent(stu, 'LEDGER')} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Ledger</button>
                                                    <button onClick={() => handleSelectStudent(stu, 'SALE')} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Sale</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={10} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            {(!searchTerm && selectedClass === 'ALL')
                                                ? 'Please select a class or search to view students.'
                                                : 'No students found matching your search.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderPay = () => {
        // Get active fee types for this class
        const activeFeeTypesForClass = feeTypes
            .filter((ft: any) => ft.status === 'ACTIVE');

        // Get academic month order for sorting additional fees
        const academicMonthsOrder = getAcademicYearMonths(currentSchool?.academicYearStartMonth || 'April');
        const monthSortMap: Record<string, number> = {};
        academicMonthsOrder.forEach((m, idx) => { monthSortMap[m] = idx; });

        // Separate tuition fee from other fees
        const tuitionFee = activeFeeTypesForClass.find((ft: any) => {
            const name = (ft.feeHeadName || '').toLowerCase().trim();
            return name.includes('tuition') || name.includes('tution') || name.includes('monthly');
        });

        const additionalFees = activeFeeTypesForClass
            .filter((ft: any) => {
                const name = (ft.feeHeadName || '').toLowerCase().trim();
                return !(name.includes('tuition') || name.includes('tution') || name.includes('monthly'));
            })
            .sort((a: any, b: any) => {
                const nameA = (a.feeHeadName || '').toLowerCase().trim();
                const nameB = (b.feeHeadName || '').toLowerCase().trim();

                // 1. "Form Sale" always top priority
                if (nameA.includes('form sale')) return -1;
                if (nameB.includes('form sale')) return 1;

                // 2. Sort by earliest month in due
                const getMinMonthIdx = (ft: any) => {
                    if (!ft.months || ft.months.length === 0) return 999;
                    const indices = ft.months.map((m: string) => monthSortMap[m] !== undefined ? monthSortMap[m] : 999);
                    return Math.min(...indices);
                };

                const minIdxA = getMinMonthIdx(a);
                const minIdxB = getMinMonthIdx(b);

                if (minIdxA !== minIdxB) return minIdxA - minIdxB;

                // 3. Fallback to display order
                return Number(a.displayOrder || 0) - Number(b.displayOrder || 0);
            });

        return (
            <div className="animate-fade-in" style={{ paddingBottom: '4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button onClick={() => setView('SEARCH')} className="btn-icon" style={{ background: 'var(--bg-main)' }}><ArrowLeft size={20} /></button>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Fee Collection <span style={{ background: '#ef4444', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '1rem', marginLeft: '0.5rem' }}>{selectedStudent?.admissionNo}</span></h1>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={handleNewBill} className="btn" style={{ background: '#22c55e', color: 'white', fontWeight: 700 }}>Press Alt+C For New</button>
                        <button onClick={() => setView('LEDGER')} className="btn" style={{ background: '#3b82f6', color: 'white', fontWeight: 700 }}>Ledger</button>
                    </div>
                </div>

                <div style={{ background: '#f5f3ff', padding: '0.75rem 1.5rem', borderRadius: '8px', marginBottom: '1.5rem', color: '#5b21b6', fontWeight: 600 }}>
                    {selectedStudent?.fullName} [{selectedStudent?.class}-{selectedStudent?.section}] {selectedStudent?.financeType || 'GENERAL'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                    {/* Left Side - Fee Selection */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        {/* Tuition Fee - Monthly */}
                        <div className="glass-card" style={{ padding: '0', overflow: 'hidden', height: 'fit-content' }}>
                            <div style={{
                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                color: 'white',
                                padding: '1rem 1.5rem',
                                fontWeight: 800,
                                fontSize: '0.9375rem',
                                textAlign: 'center'
                            }}>
                                Tuition Fee
                            </div>

                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {months.map(month => {
                                    const receiptNo = paidMonthsMap[month];
                                    const isPaid = !!receiptNo;
                                    const feeHeadName = tuitionFee?.feeHeadName || 'Tuition Fee';

                                    // Robust lookup: try direct match first, then fuzzy match from feeDetails
                                    let tuitionAmount = (tuitionFee && dynamicFees[tuitionFee.feeHeadName])
                                        ? dynamicFees[tuitionFee.feeHeadName]
                                        : feeDetails.tuitionFee;

                                    // OVERRIDE: Use student specific monthly fee if available
                                    if (selectedStudent?.monthlyFee && Number(selectedStudent.monthlyFee) > 0) {
                                        tuitionAmount = Number(selectedStudent.monthlyFee);
                                    }

                                    const isSelected = selectedMonths[month]?.[feeHeadName] !== undefined;

                                    return (
                                        <div key={month} style={{ position: 'relative' }}>
                                            {isPaid ? (
                                                /* Paid month - use div to avoid nested buttons */
                                                <div
                                                    style={{
                                                        width: '100%',
                                                        padding: '0.75rem 1rem',
                                                        borderRadius: '8px',
                                                        border: '2px solid #22c55e',
                                                        background: 'rgba(34, 197, 94, 0.1)',
                                                        color: '#22c55e',
                                                        fontWeight: 700,
                                                        fontSize: '0.875rem',
                                                        transition: 'all 0.2s',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        textAlign: 'left'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ fontSize: '0.75rem' }}>✓</span>
                                                        <span>{month}</span>
                                                    </div>
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            try {
                                                                // Fetch receipt from Firestore
                                                                const q = query(
                                                                    collection(db, 'fee_collections'),
                                                                    where('schoolId', '==', currentSchool?.id),
                                                                    where('receiptNo', '==', receiptNo)
                                                                );
                                                                const snapshot = await getDocs(q);
                                                                if (!snapshot.empty) {
                                                                    const receiptData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
                                                                    handleShowReceipt(receiptData);
                                                                } else {
                                                                    alert('Receipt not found');
                                                                }
                                                            } catch (error) {
                                                                console.error('Error fetching receipt:', error);
                                                                alert('Failed to load receipt');
                                                            }
                                                        }}
                                                        style={{
                                                            fontSize: '0.6875rem',
                                                            fontWeight: 700,
                                                            background: '#22c55e',
                                                            color: 'white',
                                                            border: 'none',
                                                            padding: '0.25rem 0.5rem',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {receiptNo}
                                                    </button>
                                                </div>
                                            ) : (
                                                /* Unpaid month - use button */
                                                <button
                                                    onClick={() => {
                                                        const feeHeadName = tuitionFee?.feeHeadName || 'Tuition Fee';
                                                        const newMonths = { ...selectedMonths };
                                                        if (!newMonths[month]) newMonths[month] = {};

                                                        if (isSelected) {
                                                            delete newMonths[month][feeHeadName];
                                                            if (Object.keys(newMonths[month]).length === 0) {
                                                                delete newMonths[month];
                                                            }
                                                        } else {
                                                            // Use the found amount, ensuring it's not 0 if we know it should be tuitionFee
                                                            const actualAmount = tuitionAmount || feeDetails.tuitionFee;
                                                            newMonths[month][feeHeadName] = actualAmount;
                                                        }
                                                        setSelectedMonths(newMonths);
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        padding: '0.75rem 1rem',
                                                        borderRadius: '8px',
                                                        border: isSelected ? '2px solid #3b82f6' : '1px solid var(--border)',
                                                        background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'white',
                                                        color: isSelected ? '#3b82f6' : '#475569',
                                                        fontWeight: isSelected ? 700 : 600,
                                                        fontSize: '0.875rem',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        textAlign: 'left'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        {isSelected && <Check size={16} />}
                                                        <span>{month}</span>
                                                    </div>
                                                    {tuitionAmount > 0 ? (
                                                        <span style={{ fontSize: '0.8125rem', fontWeight: 800 }}>₹{tuitionAmount}</span>
                                                    ) : (
                                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</span>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Additional Fees - One Time */}
                        <div className="glass-card" style={{ padding: '0', overflow: 'hidden', height: 'fit-content' }}>
                            <div style={{
                                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                                color: 'white',
                                padding: '1rem 1.5rem',
                                fontWeight: 800,
                                fontSize: '0.9375rem',
                                textAlign: 'center'
                            }}>
                                Additional Fees
                            </div>

                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {additionalFees.length === 0 ? (
                                    <p style={{ fontSize: '0.875rem', color: '#94a3b8', textAlign: 'center', padding: '2rem 0' }}>
                                        No additional fees configured
                                    </p>
                                ) : (
                                    additionalFees.map((feeType: any) => {
                                        const headName = (feeType.feeHeadName || '').toLowerCase();
                                        const receiptNo = paidMonthsMap[feeType.feeHeadName];
                                        const isPaid = !!receiptNo;

                                        // Robust amount lookup
                                        let amount = dynamicFees[feeType.feeHeadName] || 0;

                                        // Fallback to pre-calculated specific fees from feeDetails if direct match fails
                                        if (amount === 0) {
                                            if (headName.includes('admission')) amount = feeDetails.admissionFee;
                                            else if (headName.includes('annual')) amount = feeDetails.annualFee;
                                            else if (headName.includes('transport')) amount = feeDetails.transportFee;
                                        }

                                        // Check if this fee is selected in any month
                                        const isSelected = Object.values(selectedMonths).some(
                                            (monthFees: any) => monthFees[feeType.feeHeadName] !== undefined
                                        );

                                        if (amount === 0) return null;

                                        return (
                                            <div key={feeType.id} style={{ position: 'relative' }}>
                                                {isPaid ? (
                                                    <div
                                                        style={{
                                                            width: '100%',
                                                            padding: '0.75rem 1rem',
                                                            borderRadius: '8px',
                                                            border: '2px solid #22c55e',
                                                            background: 'rgba(34, 197, 94, 0.1)',
                                                            color: '#22c55e',
                                                            fontWeight: 700,
                                                            fontSize: '0.875rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            textAlign: 'left'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <span>✓</span>
                                                            <span>{feeType.feeHeadName}</span>
                                                        </div>
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                try {
                                                                    const q = query(
                                                                        collection(db, 'fee_collections'),
                                                                        where('schoolId', '==', currentSchool?.id),
                                                                        where('receiptNo', '==', receiptNo)
                                                                    );
                                                                    const snapshot = await getDocs(q);
                                                                    if (!snapshot.empty) {
                                                                        const receiptData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
                                                                        handleShowReceipt(receiptData);
                                                                    } else {
                                                                        alert('Receipt not found');
                                                                    }
                                                                } catch (error) {
                                                                    console.error('Error fetching receipt:', error);
                                                                    alert('Failed to load receipt');
                                                                }
                                                            }}
                                                            style={{
                                                                fontSize: '0.6875rem',
                                                                fontWeight: 700,
                                                                background: '#22c55e',
                                                                color: 'white',
                                                                border: 'none',
                                                                padding: '0.25rem 0.5rem',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {receiptNo}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            const newMonths = { ...selectedMonths };

                                                            if (isSelected) {
                                                                // Remove from all months
                                                                Object.keys(newMonths).forEach(month => {
                                                                    if (newMonths[month][feeType.feeHeadName] !== undefined) {
                                                                        delete newMonths[month][feeType.feeHeadName];
                                                                        if (Object.keys(newMonths[month]).length === 0) {
                                                                            delete newMonths[month];
                                                                        }
                                                                    }
                                                                });
                                                            } else {
                                                                // Add to a special "additional" key
                                                                const targetMonth = 'Additional';
                                                                if (!newMonths[targetMonth]) newMonths[targetMonth] = {};
                                                                newMonths[targetMonth][feeType.feeHeadName] = amount;
                                                            }
                                                            setSelectedMonths(newMonths);
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            padding: '0.75rem 1rem',
                                                            borderRadius: '8px',
                                                            border: isSelected ? '2px solid #8b5cf6' : '1px solid var(--border)',
                                                            background: isSelected ? 'rgba(139, 92, 246, 0.1)' : 'white',
                                                            color: isSelected ? '#8b5cf6' : '#475569',
                                                            fontWeight: isSelected ? 800 : 600,
                                                            fontSize: '0.875rem',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            textAlign: 'left'
                                                        }}
                                                        title={`Click to add ₹${amount}`}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                                            {isSelected && <Check size={16} />}
                                                            <span>{feeType.feeHeadName}</span>
                                                        </div>
                                                        <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: isSelected ? '#8b5cf6' : '#4338ca' }}>
                                                            ₹{amount}
                                                        </span>
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Side - Payment Summary */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Selected Fees Summary */}
                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1rem', color: '#1e293b' }}>
                                Selected Fees
                            </h3>
                            <div style={{
                                maxHeight: '200px',
                                overflowY: 'auto',
                                marginBottom: '1rem',
                                borderBottom: '1px solid var(--border)',
                                paddingBottom: '1rem'
                            }}>
                                {Object.keys(selectedMonths).length === 0 ? (
                                    <p style={{ fontSize: '0.875rem', color: '#94a3b8', textAlign: 'center', padding: '1rem 0' }}>
                                        No fees selected
                                    </p>
                                ) : (
                                    Object.entries(selectedMonths).map(([month, fees]) => (
                                        <div key={month} style={{ marginBottom: '0.75rem' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6366f1', marginBottom: '0.25rem' }}>
                                                {month}
                                            </div>
                                            {Object.entries(fees as Record<string, number>).map(([feeName, amount]) => (
                                                <div key={feeName} style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    fontSize: '0.8125rem',
                                                    padding: '0.25rem 0',
                                                    paddingLeft: '0.5rem'
                                                }}>
                                                    <span style={{ color: '#64748b' }}>{feeName}</span>
                                                    <span style={{ fontWeight: 700, color: '#10b981' }}>₹{amount}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Previous Dues */}
                            <div className="input-group" style={{ marginBottom: '1rem' }}>
                                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#f59e0b' }}>Previous Dues</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    style={{ borderColor: '#fbbf24' }}
                                    value={feeDetails.previousDues || 0}
                                    onChange={e => setFeeDetails({ ...feeDetails, previousDues: Number(e.target.value) })}
                                />
                            </div>

                            {/* Discount */}
                            <div className="input-group" style={{ marginBottom: '1rem' }}>
                                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#ef4444' }}>Discount</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    style={{ borderColor: '#fca5a5' }}
                                    value={feeDetails.discount}
                                    onChange={e => setFeeDetails({ ...feeDetails, discount: Number(e.target.value) })}
                                />
                            </div>

                            {/* Total */}
                            <div style={{
                                background: '#f0fdf4',
                                border: '2px solid #22c55e',
                                borderRadius: '8px',
                                padding: '1rem',
                                marginBottom: '1rem'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span style={{ fontWeight: 600, color: '#064e3b' }}>Net Payable</span>
                                    <span style={{ fontWeight: 800, fontSize: '1.5rem', color: '#22c55e' }}>₹{totalReceivable}</span>
                                </div>
                            </div>
                        </div>

                        {/* Payment Details */}
                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1rem', color: '#1e293b' }}>
                                Payment Details
                            </h3>

                            <div className="input-group" style={{ marginBottom: '1rem' }}>
                                <label style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Date of Payment</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={feeDetails.paymentDate}
                                    onChange={e => setFeeDetails({ ...feeDetails, paymentDate: e.target.value })}
                                    style={{ background: '#f1f5f9' }}
                                />
                            </div>

                            <div className="input-group" style={{ marginBottom: '1rem' }}>
                                <label style={{ color: '#22c55e', fontWeight: 800 }}>Amount Received</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    style={{
                                        borderColor: '#22c55e',
                                        fontSize: '1.25rem',
                                        fontWeight: 800,
                                        color: '#22c55e'
                                    }}
                                    value={feeDetails.amountReceived}
                                    onChange={e => setFeeDetails({ ...feeDetails, amountReceived: Number(e.target.value) })}
                                />
                            </div>

                            <div className="input-group" style={{ marginBottom: '1rem' }}>
                                <label style={{ fontWeight: 700 }}>Payment Mode</label>
                                <select
                                    className="input-field"
                                    value={feeDetails.paymentMode}
                                    onChange={e => setFeeDetails({ ...feeDetails, paymentMode: e.target.value })}
                                >
                                    <option value="">Select</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Online">Online</option>
                                </select>
                            </div>

                            <div className="input-group" style={{ marginBottom: '1rem' }}>
                                <label style={{ fontWeight: 700 }}>Remarks (Payment Details)</label>
                                <textarea
                                    className="input-field"
                                    value={feeDetails.remarks}
                                    onChange={e => setFeeDetails({ ...feeDetails, remarks: e.target.value })}
                                    style={{ minHeight: '60px' }}
                                />
                            </div>



                            <button
                                className="btn btn-primary"
                                style={{
                                    width: '100%',
                                    height: '3.5rem',
                                    background: '#22c55e',
                                    fontSize: '1.125rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem'
                                }}
                                onClick={handlePayNow}
                                disabled={processing || (Object.keys(selectedMonths).length === 0 && (feeDetails.previousDues || 0) <= 0 && (feeDetails.amountReceived || 0) <= 0)}
                            >
                                {processing ? 'Processing...' : <>Generate Receipt</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderLedger = () => {
        // Helper to get fee amount by checking multiple possible keys
        const getFeeValue = (row: any, primaryKey: string, searchTerms: string[]) => {
            if (row[primaryKey] > 0) return row[primaryKey];
            if (!row.feeBreakdown) return 0;

            const found = Object.entries(row.feeBreakdown).find(([name]) =>
                searchTerms.some(term => name.toLowerCase().includes(term))
            );
            return found ? (found[1] as number) : 0;
        };

        const getOtherFees = (row: any) => {
            if (row.otherFee > 0) return row.otherFee;
            if (!row.feeBreakdown) return 0;

            // Sum everything else that isn't already categorized
            const categories = ['tuition', 'tution', 'monthly', 'admission', 'annual', 'transport'];
            return Object.entries(row.feeBreakdown).reduce((sum, [name, amount]) => {
                const isCategorized = categories.some(cat => name.toLowerCase().includes(cat));
                return isCategorized ? sum : sum + (amount as number);
            }, 0);
        };

        return (
            <div className="animate-fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button onClick={() => setView('SEARCH')} className="btn-icon" style={{ background: 'var(--bg-main)' }}><ArrowLeft size={20} /></button>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Payment History</h1>
                </div>

                <div style={{ background: '#f5f3ff', padding: '0.75rem 1.5rem', borderRadius: '8px', marginBottom: '1.5rem', color: '#5b21b6', fontWeight: 600 }}>
                    Payment History of {selectedStudent?.fullName} [{selectedStudent?.class}-{selectedStudent?.section}] {selectedStudent?.classRollNo} {selectedStudent?.financeType || 'GENERAL'}
                </div>

                <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                    <th style={{ padding: '1rem' }}>Date</th>
                                    <th style={{ padding: '1rem' }}>R. No.</th>
                                    <th style={{ padding: '1rem' }}>Paid For</th>
                                    <th style={{ padding: '1rem' }}>Admission Fee</th>
                                    <th style={{ padding: '1rem' }}>Annual Fee</th>
                                    <th style={{ padding: '1rem' }}>Transport Fee</th>
                                    <th style={{ padding: '1rem' }}>Tuition/Monthly Fee</th>
                                    <th style={{ padding: '1rem' }}>Other Fee</th>
                                    <th style={{ padding: '1rem' }}>Prev. Dues</th>
                                    <th style={{ padding: '1rem' }}>Discount</th>
                                    <th style={{ padding: '1rem' }}>Total</th>
                                    <th style={{ padding: '1rem' }}>Paid</th>
                                    <th style={{ padding: '1rem' }}>Dues</th>
                                    <th style={{ padding: '1rem' }}>Status</th>
                                    <th style={{ padding: '1rem' }}>Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingLedger ? (
                                    <tr><td colSpan={15} style={{ padding: '2rem', textAlign: 'center' }}>Loading history...</td></tr>
                                ) : ledgerHistory.length > 0 ? ledgerHistory.map((row, idx) => {
                                    const admFee = getFeeValue(row, 'admissionFee', ['admission']);
                                    const annFee = getFeeValue(row, 'annualFee', ['annual']);
                                    const transFee = getFeeValue(row, 'transportFee', ['transport']);
                                    const tuitFee = getFeeValue(row, 'tuitionFee', ['tuition', 'tution', 'monthly']);
                                    const otherFee = getOtherFees(row);

                                    return (
                                        <tr key={row.id || idx} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                                            <td style={{ padding: '1rem' }}>{formatDateTime(row.date || row.paymentDate)}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <button
                                                    onClick={() => handleShowReceipt(row)}
                                                    style={{
                                                        background: row.status === 'CANCEL' ? '#ef4444' : '#6366f1',
                                                        color: 'white',
                                                        padding: '0.15rem 0.6rem',
                                                        borderRadius: '4px',
                                                        fontWeight: 700,
                                                        border: 'none',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {row.receiptNo || 'N/A'}
                                                </button>
                                            </td>
                                            <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{row.paidFor}</td>
                                            <td style={{ padding: '1rem' }}>{admFee.toFixed(2)}</td>
                                            <td style={{ padding: '1rem' }}>{annFee.toFixed(2)}</td>
                                            <td style={{ padding: '1rem' }}>{transFee.toFixed(2)}</td>
                                            <td style={{ padding: '1rem' }}>{tuitFee.toFixed(2)}</td>
                                            <td style={{ padding: '1rem' }}>{otherFee.toFixed(2)}</td>
                                            <td style={{ padding: '1rem', color: '#f59e0b', fontWeight: 600 }}>{(row.previousDues || 0).toFixed(2)}</td>
                                            <td style={{ padding: '1rem', color: '#ef4444', fontWeight: 600 }}>{(row.discount || 0).toFixed(2)}</td>
                                            <td style={{ padding: '1rem', fontWeight: 700 }}>{(row.total || 0).toFixed(2)}</td>
                                            <td style={{ padding: '1rem', fontWeight: 700 }}>{(row.paid || 0).toFixed(2)}</td>
                                            <td style={{ padding: '1rem', fontWeight: 700 }}>{(row.dues || 0).toFixed(2)}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{ color: row.status === 'PAID' ? '#10b981' : '#ef4444', fontWeight: 800 }}>{row.status}</span>
                                            </td>
                                            <td style={{ padding: '1rem', color: '#ef4444' }}>{row.remarks}</td>
                                        </tr>
                                    );
                                }) : (
                                    <tr><td colSpan={15} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No payment records found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderSale = () => {
        const total = cart.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);

        return (
            <div className="animate-fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button onClick={() => setView('SEARCH')} className="btn-icon" style={{ background: 'var(--bg-main)' }}><ArrowLeft size={20} /></button>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>School Inventory Sale</h1>
                </div>

                <div style={{ background: '#f5f3ff', padding: '0.75rem 1.5rem', borderRadius: '8px', marginBottom: '1.5rem', color: '#5b21b6', fontWeight: 600 }}>
                    Point of Sale for {selectedStudent?.fullName} ({selectedStudent?.admissionNo})
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '2rem' }}>
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ fontWeight: 700, marginBottom: '1.5rem' }}>Available Items</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
                            {inventoryItems.map(item => {
                                const displayPrice = (item.pricingType === 'classwise' && item.classPrices && selectedStudent?.class)
                                    ? (item.classPrices[selectedStudent.class] || 0)
                                    : (item.price || 0);
                                return (displayPrice > 0) ? (
                                    <div
                                        key={item.name}
                                        className="hover-lift"
                                        onClick={() => handleAddToCart(item)}
                                        style={{ padding: '1.25rem', border: '1px solid var(--border)', borderRadius: '16px', textAlign: 'center', cursor: 'pointer', background: 'white' }}
                                    >
                                        <div style={{ width: '40px', height: '40px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', color: 'var(--primary)' }}>
                                            <ShoppingBag size={20} />
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.25rem' }}>{item.name}</div>
                                        <div style={{ color: '#10b981', fontWeight: 800 }}>₹{displayPrice}</div>
                                        {item.pricingType === 'classwise' && (
                                            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontWeight: 600 }}>Class-wise</div>
                                        )}
                                    </div>
                                ) : null;
                            })}
                        </div>
                    </div>

                    <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
                            Cart <span>{cart.length} items</span>
                        </h3>

                        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem' }}>
                            {cart.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                                    <ShoppingBag size={40} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                                    <p>Select items to add to cart</p>
                                </div>
                            ) : cart.map(item => (
                                <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>₹{item.price} x {item.qty}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span style={{ fontWeight: 700 }}>₹{item.price * item.qty}</span>
                                        <button onClick={() => handleRemoveFromCart(item.name)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={16} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {cart.length > 0 && (
                            <div style={{ borderTop: '2px solid var(--border)', paddingTop: '1.5rem' }}>
                                {/* Discount Input */}
                                <div className="input-group" style={{ marginBottom: '1rem' }}>
                                    <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)' }}>Discount (₹)</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        placeholder="Enter discount amount"
                                        value={saleDiscount || ''}
                                        onChange={e => setSaleDiscount(Number(e.target.value))}
                                        min={0}
                                        max={total}
                                        style={{ background: '#fff' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                        <span>Subtotal</span>
                                        <span>₹{total}</span>
                                    </div>
                                    {saleDiscount > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#ef4444' }}>
                                            <span>Discount</span>
                                            <span>-₹{saleDiscount}</span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 800, marginTop: '0.5rem', color: '#10b981' }}>
                                        <span>Total</span>
                                        <span>₹{Math.max(0, total - saleDiscount)}</span>
                                    </div>
                                </div>
                                <button
                                    className="btn btn-primary"
                                    style={{ width: '100%', height: '3.5rem', background: '#22c55e', fontSize: '1.125rem' }}
                                    onClick={handleSaleCheckout}
                                    disabled={processing}
                                >
                                    {processing ? 'Processing...' : <><Check size={20} /> Checkout Sale</>}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderReceipt = () => {
        if (!currentReceipt) return null;

        return (
            <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <FeeReceipt
                    receipt={currentReceipt}
                    studentData={selectedStudent}
                    schoolInfo={
                        dbItems?.find((item: any) => item.id === `school_info_${currentSchool?.id}`) ||
                        dbItems?.find((item: any) =>
                            item.id === 'school_info' ||
                            item.type === 'school_info' ||
                            item.type === 'institution' ||
                            item.type === 'Institution Information'
                        )
                    }
                    onClose={() => setView(currentReceipt?.type === 'SALE' ? 'SEARCH' : 'PAY')}
                />
            </div>
        );
    };

    return (
        <div className="no-scrollbar" style={{ paddingBottom: '3rem' }}>
            {view === 'SEARCH' && renderSearch()}
            {view === 'PAY' && renderPay()}
            {view === 'LEDGER' && renderLedger()}
            {view === 'SALE' && renderSale()}
            {view === 'RECEIPT' && renderReceipt()}
        </div>
    );
};

export default FeeManagement;
