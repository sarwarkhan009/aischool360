import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    ArrowRight,
    Bus,
    X,
    Clock,
    CreditCard,
    BookOpen,
    Bell,
    LayoutDashboard,
    CalendarCheck,
    Award,
    Image,
    Library,
    ChevronRight,
    MessageSquare,
    ClipboardList,
    TrendingUp,
    ShieldCheck,
    Wallet,
    Loader2,
    Send,
    User as UserIcon,
    Phone,
    MapPin,
    School,
    Info,
    AlertCircle
} from 'lucide-react';
import BusMap from '../../components/transport/BusMap';
import AnimatedPieChart from '../../components/portals/AnimatedPieChart';
import { useAuth } from '../../context/AuthContext';
import { useSchool } from '../../context/SchoolContext';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatDate } from '../../utils/dateUtils';

// New Portal Components
import ParentOverview from '../../components/portals/ParentOverview';
import ParentAttendanceDetail from '../../components/portals/ParentAttendanceDetail';
import ParentFeeLedger from '../../components/portals/ParentFeeLedger';
import ParentFeeInfo from '../../components/portals/ParentFeeInfo';
import ParentAcademicHistory from '../../components/portals/ParentAcademicHistory';
import ParentTimetable from '../../components/portals/ParentTimetable';
import ParentHomework from '../../components/portals/ParentHomework';
import ParentNoticeBoard from '../../components/portals/ParentNoticeBoard';
import ParentCommunication from '../../components/portals/ParentChat';
import ParentLibrary from '../../components/portals/ParentLibrary';
// import UserProfile from '../../pages/settings/UserProfile';
import ErrorBoundary from '../../components/ErrorBoundary';
import { useRealtimeUpdates } from '../../hooks/useRealtimeUpdates';
import { initializeNotifications, setupForegroundListener } from '../../lib/notifications';
import { Permission } from '../../types/rbac';

const ParentDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState('OVERVIEW');
    const [searchParams, setSearchParams] = useSearchParams();

    // Sync active tab with URL - runs whenever URL changes
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab) {
            if (tab === 'MESSAGES' || tab === 'COMMUNICATION') {
                setActiveTab('COMMUNICATION');
            } else if (TAB_CONFIG.some(t => t.id === tab)) {
                setActiveTab(tab);
            }
        } else {
            // If no tab param, ensure we're on OVERVIEW
            setActiveTab('OVERVIEW');
        }
    }, [searchParams]); // Dependency on searchParams ensures sync on URL changes

    const [showMap, setShowMap] = useState(false);
    const { user, hasPermission } = useAuth();
    const { currentSchool } = useSchool();

    const [studentData, setStudentData] = useState<any>(null);
    const [performanceData, setPerformanceData] = useState<any[]>([]);
    const [notices, setNotices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [moduleControls, setModuleControls] = useState<Record<string, boolean>>({});
    const [dismissedNoticeId, setDismissedNoticeId] = useState<string | null>(localStorage.getItem('dismissed_notice_id'));
    const [latestAssignment, setLatestAssignment] = useState<any>(null);
    const [dismissedHomeworkId, setDismissedHomeworkId] = useState<string | null>(localStorage.getItem('dismissed_homework_id'));
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const [showScrollIndicator, setShowScrollIndicator] = useState(true);
    const [feeBalance, setFeeBalance] = useState<number>(0);
    const [hasDiscountedFee, setHasDiscountedFee] = useState(false);

    // Real-time updates hook - enabled after studentData loads
    const realtimeUpdates = useRealtimeUpdates({
        userId: user?.id || '',
        userRole: 'PARENT',
        studentClass: studentData?.class || '',
        section: studentData?.section || '',
        schoolId: user?.schoolId || studentData?.schoolId || '',
        enabled: !!user?.id && !!user?.schoolId && !!studentData?.class // Enable only when studentData is loaded
    });

    const handleScroll = () => {
        if (!scrollContainerRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 10;
        setShowScrollIndicator(!isAtEnd);
    };

    const scrollNext = () => {
        if (!scrollContainerRef.current) return;
        scrollContainerRef.current.scrollBy({ left: 150, behavior: 'smooth' });
    };

    // Raw Data for Filtering
    const [rawAttendance, setRawAttendance] = useState<any[]>([]);
    const [rawSubmissions, setRawSubmissions] = useState<any[]>([]);
    const [allClassHw, setAllClassHw] = useState<any[]>([]);
    const [selectedRange, setSelectedRange] = useState<'THIS_MONTH' | 'LAST_MONTH' | 'LIFETIME'>('THIS_MONTH');

    const TAB_CONFIG = [
        { id: 'OVERVIEW', label: 'Overview', icon: LayoutDashboard },
        { id: 'ATTENDANCE', label: 'Attendance', icon: CalendarCheck, moduleId: 'attendance' },
        { id: 'FEES', label: 'Payments', icon: CreditCard, moduleId: 'fees' },
        { id: 'FEE_INFO', label: 'Fee Info', icon: Info, moduleId: 'fees' },
        { id: 'ACADEMICS', label: 'Results', icon: Award, moduleId: 'exams' },
        { id: 'HOMEWORK', label: 'Homework', icon: MessageSquare, moduleId: 'homework' },
        { id: 'TIMETABLE', label: 'Schedule', icon: Clock, moduleId: 'calendar' }, // Mapped to calendar module
        { id: 'COMMUNICATION', label: 'Chat', icon: MessageSquare, moduleId: 'communication' },
        { id: 'LIBRARY', label: 'Library', icon: Library, moduleId: 'library' },
        { id: 'NOTICES', label: 'Notices', icon: Bell, moduleId: 'notices' },
    ];

    // Initialize push notifications on mount
    useEffect(() => {
        if (user?.id) {
            // Request notification permission and setup
            initializeNotifications(user.id, db).then(token => {
                if (token) {
                    console.log('✅ Notifications initialized for parent');
                }
            }).catch(err => {
                console.warn('Notifications setup failed:', err.message);
            });

            // Setup foreground message listener
            try {
                const unsubscribe = setupForegroundListener((payload) => {
                    console.log('📬 New notification received:', payload);
                });

                return () => {
                    if (unsubscribe) unsubscribe();
                };
            } catch (err) {
                console.warn('Foreground listener setup failed:', err);
            }
        }
    }, [user?.id]);

    // Unlock audio on first user interaction
    useEffect(() => {
        const unlockAudio = () => {
            try {
                const audio = new Audio();
                audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
                audio.play().then(() => {
                    console.log('🔊 Audio unlocked - notifications will now play sound');
                }).catch(() => {
                    console.warn('⚠️ Click anywhere to enable notification sounds');
                });
            } catch (e) {
                // Silent fail
            }
        };

        document.addEventListener('click', unlockAudio, { once: true });
        document.addEventListener('touchstart', unlockAudio, { once: true });

        return () => {
            document.removeEventListener('click', unlockAudio);
            document.removeEventListener('touchstart', unlockAudio);
        };
    }, []);

    // Homework banner check - auto-clear dismissed ID when new homework arrives
    useEffect(() => {
        const firstHomeworkId = realtimeUpdates.homework[0]?.id;

        // Auto-clear dismissed ID if a newer homework has arrived
        if (dismissedHomeworkId && firstHomeworkId && firstHomeworkId !== dismissedHomeworkId) {
            console.log('✅ New homework detected, clearing dismissed ID');
            setDismissedHomeworkId(null);
            localStorage.removeItem('dismissed_homework_id');
        }

        console.log('🎯 Homework Banner Check:', {
            homeworkCount: realtimeUpdates.homework.length,
            firstHomework: realtimeUpdates.homework[0],
            firstHomeworkId,
            dismissedId: dismissedHomeworkId,
            willShow: realtimeUpdates.homework[0] && firstHomeworkId !== dismissedHomeworkId
        });
    }, [realtimeUpdates.homework, dismissedHomeworkId]);

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                if (!user?.id || user.role !== 'PARENT') {
                    setLoading(false);
                    return;
                }
                const filterId = user?.schoolId;
                const moduleRef = doc(db, 'settings', `module_controls_${filterId}`);
                const moduleSnap = await getDoc(moduleRef);
                if (moduleSnap.exists()) {
                    const controls = moduleSnap.data();
                    setModuleControls(controls);

                    // Safety check: If current active tab is now disabled, jump to Overview
                    const currentTabConfig = TAB_CONFIG.find(t => t.id === activeTab);
                    const isModuleDisabled = currentTabConfig?.moduleId && (
                        controls[currentTabConfig.moduleId] === false ||
                        (currentSchool?.allowedModules && !currentSchool.allowedModules.includes(currentTabConfig.moduleId))
                    );

                    if (isModuleDisabled) {
                        setActiveTab('OVERVIEW');
                    }
                }

                const studentRef = doc(db, 'students', user.id);
                const studentSnap = await getDoc(studentRef);
                let currentStudentData: any = null;
                let studentIdField = null;
                if (studentSnap.exists()) {
                    currentStudentData = studentSnap.data();
                    studentIdField = currentStudentData.id;
                    setStudentData(currentStudentData);

                    // Check if student has discounted fee
                    try {
                        const studentMonthlyFee = Number(currentStudentData.monthlyFee || 0);

                        if (studentMonthlyFee > 0) {
                            // Fetch fee_types to get default monthly fee for this class
                            const feeTypesSnap = await getDocs(collection(db, 'fee_types'));
                            const monthlyFeeType = feeTypesSnap.docs.find(d => {
                                const data = d.data();
                                // Find the fee type that is ACTIVE, applies to this student's class, and has monthly charges
                                return data.status === 'ACTIVE' &&
                                    data.classes?.includes(currentStudentData.class) &&
                                    data.months && data.months.length > 0; // Has monthly charges
                            });

                            if (monthlyFeeType) {
                                // Now get the actual amount for this class from fee_amounts
                                const feeAmountsSnap = await getDocs(collection(db, 'fee_amounts'));
                                const classMonthlyFee = feeAmountsSnap.docs.find(d => {
                                    const data = d.data();
                                    return data.feeTypeId === monthlyFeeType.id &&
                                        data.className === currentStudentData.class;
                                });

                                const defaultClassFee = classMonthlyFee ? Number(classMonthlyFee.data().amount || 0) : 0;

                                // If student has a custom fee AND it's less than class fee, mark as discounted
                                if (defaultClassFee > 0 && studentMonthlyFee < defaultClassFee) {
                                    setHasDiscountedFee(true);
                                    console.log('🔒 Discounted Fee Detected - Hiding Payment Tab', {
                                        studentFee: studentMonthlyFee,
                                        classFee: defaultClassFee,
                                        class: currentStudentData.class,
                                        feeType: monthlyFeeType.data().feeHeadName
                                    });
                                } else {
                                    setHasDiscountedFee(false);
                                    console.log('✅ Regular Fee - Showing Payment Tab', {
                                        studentFee: studentMonthlyFee,
                                        classFee: defaultClassFee
                                    });
                                }
                            } else {
                                setHasDiscountedFee(false);
                                console.warn('⚠️ No monthly fee type found for class:', currentStudentData.class);
                            }
                        } else {
                            setHasDiscountedFee(false);
                        }
                    } catch (feeCheckErr) {
                        console.warn('⚠️ Fee discount check failed:', feeCheckErr);
                        setHasDiscountedFee(false);
                    }
                }

                // Fetch All Attendance
                try {
                    const attQuery = query(collection(db, 'attendance'), where('schoolId', '==', currentStudentData?.schoolId || user?.schoolId));
                    const attSnap = await getDocs(attQuery);
                    const filteredAttendance = attSnap.docs
                        .map(d => {
                            const data = d.data();
                            const dateStr = data.date.split('T')[0];
                            return {
                                ...data,
                                studentId: data.studentId,
                                dateObject: new Date(dateStr)
                            };
                        })
                        .filter(att => att.studentId === user.id || att.studentId === studentIdField);
                    setRawAttendance(filteredAttendance);
                } catch (error) {
                    console.error('Error fetching attendance:', error);
                    setRawAttendance([]);
                }

                // Fetch All Homework Submissions & Class Homework
                try {
                    // Fetch submissions for both the Auth UID and the internal Student ID field just in case
                    const idToSearch = studentIdField || user.id;
                    const subsQuery = query(collection(db, 'homeworkSubmissions'), where('studentId', 'in', [user.id, idToSearch].filter(Boolean)));
                    const subsSnap = await getDocs(subsQuery);
                    const subs = subsSnap.docs.map(d => ({ ...d.data(), dateObject: d.data().updatedAt ? new Date(d.data().updatedAt) : new Date() }));
                    setRawSubmissions(subs);

                    if (currentStudentData?.class) {
                        const hwQuery = query(
                            collection(db, 'homework'),
                            where('schoolId', '==', (currentStudentData.schoolId || user.schoolId)),
                            where('class', '==', currentStudentData.class)
                        );
                        const hwSnap = await getDocs(hwQuery);
                        const classHw = hwSnap.docs.map(d => ({ id: d.id, ...d.data(), section: d.data().section }))
                            .filter(h => !h.section || h.section === 'All Sections' || h.section === currentStudentData.section);
                        setAllClassHw(classHw);
                    }
                } catch (e) {
                    console.warn('⚠️ Homework failed:', e);
                }

                try {
                    const idToSearch = studentIdField || user.id;
                    const marksQuery = query(collection(db, 'exam_marks'), where('studentId', 'in', [user.id, idToSearch].filter(Boolean)));
                    const marksSnap = await getDocs(marksQuery);
                    if (!marksSnap.empty) {
                        const subjectMap: Record<string, any> = {};
                        marksSnap.docs.forEach(d => {
                            const data = d.data();
                            if (!subjectMap[data.subject] || new Date(data.updatedAt) > new Date(subjectMap[data.subject].updatedAt)) {
                                subjectMap[data.subject] = data;
                            }
                        });
                        const performance = Object.values(subjectMap).map((m: any, i) => ({
                            subject: m.subject,
                            progress: parseFloat(m.percentage),
                            color: i % 3 === 0 ? '#6366f1' : i % 3 === 1 ? '#10b981' : '#f59e0b'
                        }));
                        setPerformanceData(performance);
                    }
                } catch (e) {
                    console.warn('⚠️ Exam marks failed:', e);
                }


                // Notices are now handled by real-time listener in useRealtimeUpdates hook
                // They will update automatically without refresh


                // Simplified Fee Calculation for Banner - Using ParentFeeLedger Logic
                try {
                    const studentId = user.id;
                    const admNo = currentStudentData?.admissionNo || studentId;

                    const [typesSnap, amountsSnap, collSnap] = await Promise.all([
                        getDocs(collection(db, 'fee_types')),
                        getDocs(collection(db, 'fee_amounts')),
                        getDocs(query(collection(db, 'fee_collections'), where('admissionNo', '==', admNo)))
                    ]);

                    const fTypes = typesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
                    const fAmounts = amountsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
                    const fHistory = collSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

                    const today = new Date();
                    const currentYear = today.getFullYear();
                    const currentMonth = today.getMonth(); // 0-11
                    const sessionStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
                    const sessionStartDate = new Date(sessionStartYear, 3, 1);

                    const admType = currentStudentData?.admissionType || 'NEW';
                    const admDateRaw = currentStudentData?.admissionDate ? new Date(currentStudentData.admissionDate) : null;

                    let startMonthIdx: number;
                    let startYear: number;

                    if (admType === 'NEW' && admDateRaw && admDateRaw >= sessionStartDate) {
                        startMonthIdx = admDateRaw.getMonth();
                        startYear = admDateRaw.getFullYear();
                    } else {
                        startMonthIdx = 3; // April
                        startYear = sessionStartYear;
                    }

                    let totalPayable = 0;
                    const MONTH_IDX: Record<string, number> = {
                        'April': 3, 'May': 4, 'June': 5, 'July': 6, 'August': 7, 'September': 8,
                        'October': 9, 'November': 10, 'December': 11, 'January': 0, 'February': 1, 'March': 2
                    };

                    const studentAdmMonth = admDateRaw ? admDateRaw.getMonth() : -1;
                    const studentAdmYear = admDateRaw ? admDateRaw.getFullYear() : -1;

                    fTypes.forEach(type => {
                        if (type.status !== 'ACTIVE') return;

                        const matchesAdmType = type.admissionTypes?.includes(admType);
                        if (!matchesAdmType) return;

                        const matchesClass = type.classes?.includes(currentStudentData?.class || '');
                        const matchesStudentType = type.studentTypes?.includes(currentStudentData?.studentCategory || 'GENERAL');

                        if (matchesClass && matchesStudentType) {
                            const amountConf = fAmounts.find(fa => fa.feeTypeId === type.id && fa.className === currentStudentData?.class);
                            if (!amountConf || !amountConf.amount) return;

                            type.months?.forEach((monthName: string) => {
                                let isDue = false;

                                if (monthName === 'Admission_month') {
                                    if (admType === 'NEW' && studentAdmYear === startYear && studentAdmMonth !== -1) {
                                        isDue = true;
                                    }
                                } else {
                                    const targetMonthIdx = MONTH_IDX[monthName];
                                    if (targetMonthIdx !== undefined) {
                                        const targetYear = targetMonthIdx < 3 ? sessionStartYear + 1 : sessionStartYear;
                                        const dueDate = new Date(targetYear, targetMonthIdx, 5);

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
                                    totalPayable += Number(amountConf.amount);
                                }
                            });
                        }
                    });

                    const totalPaid = fHistory
                        .filter(c => c.status !== 'CANCELLED' && (c.date?.toDate ? c.date.toDate() : new Date(c.paymentDate || c.date)) >= sessionStartDate)
                        .reduce((sum, c) => sum + (Number(c.paid) || 0), 0);

                    setFeeBalance(Math.max(0, totalPayable - totalPaid));
                } catch (feeErr) {
                    console.warn('⚠️ Fee banner calc failed:', feeErr);
                }

            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, [user]);

    // Real-time Fee Balance Listener
    useEffect(() => {
        if (!user?.id || !studentData) return;

        const studentId = user.id;
        const admNo = studentData?.admissionNo || studentId;
        const schoolId = studentData?.schoolId || user?.schoolId;

        const unsubs: any[] = [];

        // Listen to fee_types, fee_amounts, and fee_collections
        const typesUnsub = onSnapshot(collection(db, 'fee_types'), () => recalculateFees());
        const amountsUnsub = onSnapshot(collection(db, 'fee_amounts'), () => recalculateFees());
        const collUnsub = onSnapshot(
            query(collection(db, 'fee_collections'), where('admissionNo', '==', admNo)),
            () => recalculateFees()
        );

        unsubs.push(typesUnsub, amountsUnsub, collUnsub);

        const recalculateFees = async () => {
            try {
                const [typesSnap, amountsSnap, collSnap] = await Promise.all([
                    getDocs(collection(db, 'fee_types')),
                    getDocs(collection(db, 'fee_amounts')),
                    getDocs(query(collection(db, 'fee_collections'), where('admissionNo', '==', admNo)))
                ]);

                const fTypes = typesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
                const fAmounts = amountsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
                const fHistory = collSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

                const today = new Date();
                const currentYear = today.getFullYear();
                const currentMonth = today.getMonth(); // 0-11
                const sessionStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
                const sessionStartDate = new Date(sessionStartYear, 3, 1);

                const admType = studentData?.admissionType || 'NEW';
                const admDateRaw = studentData?.admissionDate ? new Date(studentData.admissionDate) : null;

                let startMonthIdx: number;
                let startYear: number;

                if (admType === 'NEW' && admDateRaw && admDateRaw >= sessionStartDate) {
                    startMonthIdx = admDateRaw.getMonth();
                    startYear = admDateRaw.getFullYear();
                } else {
                    startMonthIdx = 3; // April
                    startYear = sessionStartYear;
                }

                let totalPayable = 0;
                const MONTH_IDX: Record<string, number> = {
                    'April': 3, 'May': 4, 'June': 5, 'July': 6, 'August': 7, 'September': 8,
                    'October': 9, 'November': 10, 'December': 11, 'January': 0, 'February': 1, 'March': 2
                };

                const studentAdmMonth = admDateRaw ? admDateRaw.getMonth() : -1;
                const studentAdmYear = admDateRaw ? admDateRaw.getFullYear() : -1;

                fTypes.forEach(type => {
                    if (type.status !== 'ACTIVE') return;

                    const matchesAdmType = type.admissionTypes?.includes(admType);
                    if (!matchesAdmType) return;

                    const matchesClass = type.classes?.includes(studentData?.class || '');
                    const matchesStudentType = type.studentTypes?.includes(studentData?.studentCategory || 'GENERAL');

                    if (matchesClass && matchesStudentType) {
                        const amountConf = fAmounts.find(fa => fa.feeTypeId === type.id && fa.className === studentData?.class);
                        if (!amountConf || !amountConf.amount) return;

                        type.months?.forEach((monthName: string) => {
                            let isDue = false;

                            if (monthName === 'Admission_month') {
                                if (admType === 'NEW' && studentAdmYear === startYear && studentAdmMonth !== -1) {
                                    isDue = true;
                                }
                            } else {
                                const targetMonthIdx = MONTH_IDX[monthName];
                                if (targetMonthIdx !== undefined) {
                                    const targetYear = targetMonthIdx < 3 ? sessionStartYear + 1 : sessionStartYear;
                                    const dueDate = new Date(targetYear, targetMonthIdx, 5);

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
                                totalPayable += Number(amountConf.amount);
                            }
                        });
                    }
                });

                const totalPaid = fHistory
                    .filter(c => c.status !== 'CANCELLED' && (c.date?.toDate ? c.date.toDate() : new Date(c.paymentDate || c.date)) >= sessionStartDate)
                    .reduce((sum, c) => sum + (Number(c.paid) || 0), 0);

                setFeeBalance(Math.max(0, totalPayable - totalPaid));
            } catch (feeErr) {
                console.warn('⚠️ Fee banner real-time update failed:', feeErr);
            }
        };

        // Initial calculation
        recalculateFees();

        return () => {
            unsubs.forEach(u => u());
        };
    }, [user?.id, studentData]);

    // Note: Real-time homework and notices are now handled by useRealtimeUpdates hook
    // No need for separate listeners here

    if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><Loader2 className="animate-spin" size={40} color="var(--primary)" /></div>;

    const stats = (() => {
        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        let filteredAttendance = rawAttendance;
        let filteredClassHw = allClassHw;
        let filteredSubs = rawSubmissions;

        if (selectedRange === 'THIS_MONTH') {
            filteredAttendance = rawAttendance.filter(a => a.dateObject >= startOfThisMonth);
            filteredClassHw = allClassHw.filter(h => (new Date(h.assignedDate || h.createdAt)) >= startOfThisMonth);
        } else if (selectedRange === 'LAST_MONTH') {
            filteredAttendance = rawAttendance.filter(a => a.dateObject >= startOfLastMonth && a.dateObject <= endOfLastMonth);
            filteredClassHw = allClassHw.filter(h => {
                const date = (new Date(h.assignedDate || h.createdAt));
                return date >= startOfLastMonth && date <= endOfLastMonth;
            });
        }

        const totalAtt = filteredAttendance.length;
        const present = filteredAttendance.filter(a => a.status === 'PRESENT').length;
        const late = filteredAttendance.filter(a => a.status === 'LATE').length;
        const absent = filteredAttendance.filter(a => a.status === 'ABSENT').length;
        const attPercent = totalAtt > 0 ? ((present + late) / totalAtt) * 100 : 0;

        // Homework Advanced Logic
        const relevantSubmissions = filteredSubs.filter(s =>
            filteredClassHw.some(h => h.id === s.homeworkId) || filteredClassHw.some(h => h.homeworkId === s.homeworkId)
        );

        const totalAssigned = filteredClassHw.length;
        const totalCompleted = relevantSubmissions.filter(s => s.status === 'COMPLETED').length;
        const totalPartial = relevantSubmissions.filter(s => s.status === 'PARTIAL').length;
        const totalNotDone = relevantSubmissions.filter(s => s.status === 'NOT_DONE').length;
        const totalMarked = totalCompleted + totalPartial + totalNotDone;
        const totalPending = totalAssigned - totalMarked;
        const effectiveCompleted = totalCompleted + (totalPartial * 0.5);
        const rate = totalMarked > 0 ? (effectiveCompleted / totalMarked) * 100 : 0;

        return {
            attPercent,
            attTotal: totalAtt,
            attPresent: present,
            attLate: late,
            attAbsent: absent,
            hwRate: rate,
            totalAssigned,
            totalCompleted,
            totalPartial,
            totalNotDone,
            totalPending
        };
    })();

    const renderContent = () => {
        const resolvedStudentId = studentData?.id || user?.id;

        switch (activeTab) {
            case 'OVERVIEW': return <ParentOverview studentData={studentData} user={user} stats={stats} performanceData={performanceData} />;
            case 'NOTICES': return <ParentNoticeBoard notices={realtimeUpdates.notices} />;
            case 'ATTENDANCE': return <ParentAttendanceDetail studentId={resolvedStudentId} />;
            case 'FEES': return <ParentFeeLedger admissionNo={studentData?.admissionNo} studentData={studentData} />;
            case 'FEE_INFO': return <ParentFeeInfo />;
            case 'ACADEMICS': return <ParentAcademicHistory studentId={resolvedStudentId} />;
            case 'HOMEWORK': return <ParentHomework studentId={resolvedStudentId} studentClass={studentData?.class} section={studentData?.section} schoolId={user?.schoolId || ''} />;
            case 'TIMETABLE': return <ParentTimetable studentClass={studentData?.class} section={studentData?.section} />;
            case 'COMMUNICATION':
                return (
                    <ErrorBoundary
                        onError={() => {
                            console.error('Communication tab error - redirecting to Overview');
                            setTimeout(() => setActiveTab('OVERVIEW'), 1000);
                        }}
                        fallback={
                            <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                                <div style={{
                                    background: '#fef2f2',
                                    padding: '2rem',
                                    borderRadius: '1.5rem',
                                    border: '2px dashed #fca5a5',
                                    maxWidth: '500px',
                                    margin: '0 auto'
                                }}>
                                    <AlertCircle size={48} color="#dc2626" style={{ margin: '0 auto 1rem' }} />
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#991b1b', marginBottom: '0.5rem' }}>
                                        Unable to Load Chat
                                    </h3>
                                    <p style={{ fontSize: '0.875rem', color: '#dc2626', fontWeight: 600, marginBottom: '1rem' }}>
                                        The communication feature is temporarily unavailable.
                                    </p>
                                    <button
                                        onClick={() => setActiveTab('OVERVIEW')}
                                        style={{
                                            background: '#dc2626',
                                            color: 'white',
                                            border: 'none',
                                            padding: '0.75rem 1.5rem',
                                            borderRadius: '0.75rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            fontSize: '0.875rem'
                                        }}
                                    >
                                        Return to Overview
                                    </button>
                                </div>
                            </div>
                        }
                    >
                        <ParentCommunication studentClass={studentData?.class || user?.class} section={studentData?.section || user?.section} />
                    </ErrorBoundary>
                );
            case 'LIBRARY': return <ParentLibrary studentId={resolvedStudentId} />;
            default: return null;
        }
    };

    return (
        <div className="animate-fade-in no-scrollbar" style={{ paddingBottom: '6rem' }}>
            {/* Dues Banner - Show if permission enabled (even for discounted students) */}
            {feeBalance > 0 && hasPermission(Permission.PARENT_SHOW_DUES_BANNER) && (
                <div className="animate-pulse-subtle" style={{
                    marginBottom: '1.5rem',
                    background: 'linear-gradient(90deg, #ef4444, #f43f5e)',
                    padding: '1rem 1.5rem',
                    borderRadius: '1.25rem',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.4)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    position: 'relative',
                    zIndex: 1000
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.6rem', borderRadius: '0.75rem', display: 'flex' }}>
                            <Wallet size={22} strokeWidth={2.5} />
                        </div>
                        <div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', opacity: 0.9, display: 'block', letterSpacing: '0.05em' }}>
                                TO AVOID LATE FINE
                            </span>
                            <p style={{ margin: 0, fontWeight: 900, fontSize: '1.1rem' }}>
                                OUTSTANDING DUES: ₹{feeBalance.toLocaleString('en-IN')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => { setActiveTab('FEE_INFO'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        style={{
                            background: 'white',
                            color: '#ef4444',
                            border: 'none',
                            padding: '0.6rem 1.25rem',
                            borderRadius: '0.75rem',
                            fontWeight: 900,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                            flexShrink: 0
                        }}
                    >
                        PAY NOW
                    </button>
                </div>
            )}

            {/* Notices Ribbon - Real-time Updates */}
            {realtimeUpdates.notices[0] && realtimeUpdates.notices[0].id !== dismissedNoticeId && (
                <div className="animate-slide-down" style={{
                    marginBottom: '1.5rem',
                    background: realtimeUpdates.notices[0].data.type === 'URGENT' ? 'linear-gradient(90deg, #f43f5e, #fb7185)' : 'linear-gradient(90deg, #6366f1, #818cf8)',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '1.25rem',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    position: 'relative',
                    zIndex: 1001
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.4rem', borderRadius: '0.75rem', display: 'flex' }}>
                            {realtimeUpdates.notices[0].data.type === 'URGENT' ? <AlertCircle size={18} /> : <Bell size={18} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', opacity: 0.8, display: 'block', letterSpacing: '0.05em' }}>
                                Latest {realtimeUpdates.notices[0].data.type || 'Notice'}
                                {realtimeUpdates.notices[0].isNew && (
                                    <span style={{
                                        marginLeft: '0.5rem',
                                        background: '#fbbf24',
                                        color: '#78350f',
                                        padding: '0.1rem 0.4rem',
                                        borderRadius: '0.5rem',
                                        fontSize: '0.6rem',
                                        fontWeight: 900
                                    }}>NEW</span>
                                )}
                            </span>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {realtimeUpdates.notices[0].title}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, marginLeft: '0.5rem' }}>
                        <button onClick={() => { setActiveTab('NOTICES'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="btn-link" style={{ color: 'white', opacity: 0.9, fontSize: '0.7rem', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.1)', borderRadius: '0.5rem' }}>VIEW</button>
                        <button
                            onClick={() => {
                                setDismissedNoticeId(realtimeUpdates.notices[0].id);
                                localStorage.setItem('dismissed_notice_id', realtimeUpdates.notices[0].id);
                            }}
                            style={{
                                background: 'rgba(255,255,255,0.25)',
                                border: 'none',
                                color: 'white',
                                padding: '0.5rem',
                                borderRadius: '0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                transition: 'all 0.2s'
                            }}
                            className="hover-scale"
                        >
                            <X size={18} strokeWidth={3} />
                        </button>
                    </div>
                </div>
            )}

            {/* Homework Ribbon - Real-time Updates - Dismissible */}
            {realtimeUpdates.homework[0] && realtimeUpdates.homework[0].id !== dismissedHomeworkId && (
                <div className="animate-slide-down" style={{
                    marginBottom: '1.5rem',
                    background: 'linear-gradient(90deg, #10b981, #34d399)',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '1.25rem',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    position: 'relative',
                    zIndex: 1000
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.4rem', borderRadius: '0.75rem', display: 'flex', flexShrink: 0 }}>
                            <BookOpen size={18} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', opacity: 0.8, display: 'block', letterSpacing: '0.05em' }}>
                                Latest Assignment
                                {realtimeUpdates.homework[0].isNew && (
                                    <span style={{
                                        marginLeft: '0.5rem',
                                        background: '#fbbf24',
                                        color: '#78350f',
                                        padding: '0.1rem 0.4rem',
                                        borderRadius: '0.5rem',
                                        fontSize: '0.6rem',
                                        fontWeight: 900
                                    }}>NEW</span>
                                )}
                            </span>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {realtimeUpdates.homework[0].title}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, marginLeft: '0.5rem' }}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveTab('HOMEWORK');
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="btn-link"
                            style={{ color: 'white', opacity: 0.9, fontSize: '0.7rem', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.1)', borderRadius: '0.5rem' }}
                        >
                            VIEW
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setDismissedHomeworkId(realtimeUpdates.homework[0].id);
                                localStorage.setItem('dismissed_homework_id', realtimeUpdates.homework[0].id);
                            }}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                border: 'none',
                                color: 'white',
                                padding: '0.5rem',
                                borderRadius: '0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                            }}
                            className="hover-scale"
                            title="Dismiss"
                        >
                            <X size={18} strokeWidth={3} />
                        </button>
                    </div>
                </div>
            )}

            {/* Tabs Navigation */}
            <div style={{ position: 'relative' }}>
                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="tab-nav-container no-scrollbar"
                >
                    <div className="tab-nav-wrapper">
                        {TAB_CONFIG.map(tab => {
                            // 1. Global Master Control Check
                            if (tab.moduleId && moduleControls[tab.moduleId] === false) return null;

                            // 2. School-level Allowed Modules Check
                            if (tab.moduleId && currentSchool?.allowedModules && !currentSchool.allowedModules.includes(tab.moduleId)) return null;

                            // 3. Parent Permission Check for Fee Tabs
                            // FEES tab - Check both permission AND discount status
                            if (tab.id === 'FEES' && (!hasPermission(Permission.PARENT_SHOW_FEE_TAB) || hasDiscountedFee)) return null;

                            // FEE_INFO tab - Only check permission (always show for discounted students)
                            if (tab.id === 'FEE_INFO' && !hasPermission(Permission.PARENT_SHOW_FEE_TAB)) return null;

                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id);
                                        setSearchParams({ tab: tab.id });
                                    }}
                                    className={`tab-button ${isActive ? 'active' : ''}`}
                                >
                                    <Icon size={20} />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                {showScrollIndicator && (
                    <div className="mobile-scroll-indicator" onClick={scrollNext}>
                        <ChevronRight size={20} strokeWidth={3} />
                    </div>
                )}
            </div>

            {/* Main Content */}
            <main style={{ marginTop: '2rem' }}>
                {renderContent()}
            </main>

            <style>{`
                .tab-nav-container { position: sticky; top: 0; background: rgba(255,255,255,0.8); backdrop-filter: blur(12px); margin: 0 -2rem 2rem; padding: 1rem 2rem; z-index: 100; border-bottom: 1px solid #f1f5f9; overflow-x: auto; -webkit-overflow-scrolling: touch; }
                .tab-nav-wrapper { display: flex; gap: 0.5rem; min-width: max-content; }
                .tab-button { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1.5rem; border: none; background: transparent; color: #64748b; font-weight: 700; font-size: 0.875rem; border-radius: 1rem; cursor: pointer; transition: all 0.3s; white-space: nowrap; }
                .tab-button:hover { background: #f8fafc; color: var(--primary); }
                .tab-button.active { background: var(--primary); color: white; box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.3); }
                .btn-link { background: none; border: none; font-weight: 800; font-size: 0.75rem; cursor: pointer; text-transform: uppercase; letter-spacing: 0.05em; }
                .mobile-scroll-indicator {
                    position: absolute;
                    right: -1rem;
                    top: 0;
                    bottom: 0px;
                    width: 60px;
                    background: linear-gradient(to left, rgba(255,255,255,1) 50%, transparent);
                    display: none;
                    align-items: center;
                    justify-content: flex-end;
                    padding-right: 0.75rem;
                    pointer-events: auto;
                    cursor: pointer;
                    z-index: 101;
                    color: var(--primary);
                    animation: pulse-horizontal 2s infinite;
                }
                @keyframes pulse-horizontal {
                    0%, 100% { transform: translateX(0); opacity: 0.8; }
                    50% { transform: translateX(3px); opacity: 1; }
                }
                @media (max-width: 768px) {
                    .tab-nav-container { margin: 0 -1rem 1.5rem; padding: 0.75rem 1rem; }
                    .tab-button { padding: 0.6rem 1rem; font-size: 0.8rem; }
                    .tab-button span { display: none; }
                    .tab-button.active span { display: inline; }
                    .mobile-scroll-indicator { display: flex; }
                }
            `}</style>
        </div>
    );
};

export default ParentDashboard;
