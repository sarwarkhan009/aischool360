import React, { useState, useEffect, useMemo } from 'react';
import {
    collection,
    getDocs,
    getDoc,
    query,
    where,
    writeBatch,
    doc,
    setDoc,
    deleteDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
    CalendarCheck,
    Search,
    Filter,
    CheckCircle2,
    XCircle,
    X,
    Download,
    CalendarDays,
    RefreshCcw,
    Plus,
    Upload,
    Edit,
    Trash2,
    Save,
    Clock,
    Users
} from 'lucide-react';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid
} from 'recharts';

const COLORS = ['#10b981', '#f43f5e', '#f59e0b']; // Green, Red, Orange
import { useSchool } from '../context/SchoolContext';
import { useFirestore } from '../hooks/useFirestore';
import { getActiveClasses, CLASS_ORDER } from '../constants/app';
import { useAuth } from '../context/AuthContext';

// Helper functions for date manipulation
const formatDate = (date: Date | string, pattern: string) => {
    const d = new Date(date);
    if (pattern === 'yyyy-MM-dd') {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    if (pattern === 'MMM yyyy') {
        return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    }
    if (pattern === 'MMMM yyyy') {
        return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }
    return d.toLocaleDateString();
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const eachDayOfInterval = ({ start, end }: { start: Date, end: Date }) => {
    const dates = [];
    let curr = new Date(start);
    while (curr <= end) {
        dates.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
    }
    return dates;
};

const AttendanceManagement: React.FC = () => {
    const { user } = useAuth();
    const { currentSchool } = useSchool();
    const { data: allSettings } = useFirestore<any>('settings');
    const { data: academicYears } = useFirestore<any>('academic_years');
    const activeFY = currentSchool?.activeFinancialYear || '';
    const schoolYears = (academicYears || []).filter((y: any) => y.schoolId === currentSchool?.id && !y.isArchived).map((y: any) => y.name).sort();
    const [selectedSession, setSelectedSession] = useState('');
    const activeClasses = getActiveClasses(allSettings?.filter((d: any) => d.type === 'class') || [], activeFY);

    const [assignedClasses, setAssignedClasses] = useState<string[]>([]);
    const [assignedLoading, setAssignedLoading] = useState(false);

    useEffect(() => {
        const fetchAssigned = async () => {
            if (user?.role === 'TEACHER' && currentSchool?.id) {
                setAssignedLoading(true);
                try {
                    const classesSet = new Set<string>();
                    const teacherName = (user as any).name || (user as any).fullName || user.username;

                    // 1. Check School Routine
                    try {
                        const routineRef = doc(db, 'settings', `school_routine_${currentSchool.id}`);
                        const routineSnap = await getDoc(routineRef);

                        if (routineSnap.exists()) {
                            const data = routineSnap.data();
                            // Check for 'routines' array format
                            if (data.routines && Array.isArray(data.routines)) {
                                data.routines.forEach((r: any) => {
                                    if (r.schedule) {
                                        Object.values(r.schedule).forEach((dayArr: any) => {
                                            if (Array.isArray(dayArr)) {
                                                dayArr.forEach((p: any) => {
                                                    if (p.teacher && p.teacher.trim().toLowerCase() === teacherName.trim().toLowerCase()) {
                                                        classesSet.add(r.className);
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                            // Check for 'days' object format (alternative structure)
                            else if (data.days) {
                                Object.values(data.days).forEach((day: any) => {
                                    if (day.periods && Array.isArray(day.periods)) {
                                        day.periods.forEach((period: any) => {
                                            if (period.teacher && period.teacher.trim().toLowerCase() === teacherName.trim().toLowerCase()) {
                                                classesSet.add(period.className);
                                            }
                                        });
                                    }
                                });
                            }
                        }
                    } catch (err) {
                        console.error("Routine fetch error", err);
                    }

                    // 2. Check Homework (Always check this as well)
                    try {
                        const { collection, query, where, getDocs } = await import('firebase/firestore');
                        const hwQ = query(
                            collection(db, 'homework'),
                            where('schoolId', '==', currentSchool.id),
                            where('teacherId', '==', user.id)
                        );
                        const hwSnap = await getDocs(hwQ);
                        hwSnap.docs.forEach(d => {
                            if (d.data().class) classesSet.add(d.data().class);
                        });
                    } catch (err) {
                        console.error("Homework fetch error", err);
                    }

                    // 3. Check Employee Profile (Explicitly assigned teaching classes)
                    try {
                        const { collection, query, where, getDocs } = await import('firebase/firestore');
                        // Try to find the teacher profile by referencing the user's ID or name
                        // We check 'uid' first (ideal linkage), then mobile if available
                        const teachersRef = collection(db, 'teachers');
                        let q = query(teachersRef, where('schoolId', '==', currentSchool.id), where('uid', '==', user.id));
                        let snap = await getDocs(q);

                        if (snap.empty) {
                            // Fallback: try matching by mobile number if associated with the auth user
                            if ((user as any).mobile) {
                                q = query(teachersRef, where('schoolId', '==', currentSchool.id), where('mobile', '==', (user as any).mobile));
                                snap = await getDocs(q);
                            }
                        }

                        if (!snap.empty) {
                            const teacherData = snap.docs[0].data();
                            if (teacherData.teachingClasses && Array.isArray(teacherData.teachingClasses)) {
                                teacherData.teachingClasses.forEach((c: string) => classesSet.add(c));
                            }
                        }
                    } catch (err) {
                        console.error("Teacher profile fetch error", err);
                    }

                    // 4. Check Past Attendance Marked by this teacher (Optional but helpful)
                    try {
                        const { collection, query, where, getDocs, limit } = await import('firebase/firestore');
                        // This might be expensive, so limit it or skip if we already have classes? 
                        // Actually, let's skip checking attendance history for now to avoid specific index requirement errors
                        // as 'markedBy' might not be indexed with schoolId properly.
                    } catch (err) {
                        // ignore
                    }

                    // Sort assigned classes by the canonical CLASS_ORDER
                    const sortedClasses = Array.from(classesSet).sort(
                        (a, b) => CLASS_ORDER.indexOf(a) - CLASS_ORDER.indexOf(b)
                    );
                    setAssignedClasses(sortedClasses);
                } catch (e) {
                    console.error("Error fetching assigned classes:", e);
                } finally {
                    setAssignedLoading(false);
                }
            }
        };
        fetchAssigned();
    }, [user, currentSchool?.id]);

    const classesList = useMemo(() => {
        if (user?.role === 'TEACHER') {
            // Sort by canonical CLASS_ORDER (already sorted on set, but guard here too)
            return [...assignedClasses].sort(
                (a, b) => CLASS_ORDER.indexOf(a) - CLASS_ORDER.indexOf(b)
            );
        }
        return activeClasses.map(c => c.name);
    }, [activeClasses, assignedClasses, user?.role]);

    const [students, setStudents] = useState<any[]>([]);
    const [attendance, setAttendance] = useState<Record<string, string>>({}); // {studentId: 'PRESENT' | 'ABSENT' | 'LATE'}
    const [loading, setLoading] = useState(false);
    const [filterClass, setFilterClass] = useState('');
    const [filterSection, setFilterSection] = useState('');
    const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);

    // Sync selectedSession when activeFY loads from Firestore
    useEffect(() => {
        if (activeFY && !selectedSession) {
            setSelectedSession(activeFY);
        }
    }, [activeFY]);
    const [activeTab, setActiveTab] = useState<'mark' | 'summary' | 'student' | 'report' | 'entry' | 'show'>('mark');

    // Attendance Entry Tab States
    const ACADEMIC_MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
    const [entryClass, setEntryClass] = useState('');
    const [entrySection, setEntrySection] = useState('');
    const [entryStudent, setEntryStudent] = useState<any>(null);
    const [entryData, setEntryData] = useState<Record<string, string>>({}); // { April: '22', May: '20', ... }
    const [workingDays, setWorkingDays] = useState<Record<string, string>>({}); // { April: '25', May: '26', ... }
    const [savingEntry, setSavingEntry] = useState(false);
    const [entryEditMode, setEntryEditMode] = useState(false);
    const [showWorkingDaysModal, setShowWorkingDaysModal] = useState(false);
    const [tempWorkingDays, setTempWorkingDays] = useState<Record<string, string>>({});
    const [workingDaysSaved, setWorkingDaysSaved] = useState(false);
    const [monthlyRecords, setMonthlyRecords] = useState<any[]>([]);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryType, setSummaryType] = useState<'student'>('student');

    // Show Attendance Tab States
    const [showClass, setShowClass] = useState('');
    const [showSection, setShowSection] = useState('');
    const [showData, setShowData] = useState<any[]>([]);
    const [showWorkingDays, setShowWorkingDays] = useState<Record<string, string>>({});
    const [showLoading, setShowLoading] = useState(false);

    // Report Tab States
    const [reportClass, setReportClass] = useState('');
    const [reportSection, setReportSection] = useState('');
    const [reportSearch, setReportSearch] = useState('');
    const [startDateReport, setStartDateReport] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [endDateReport, setEndDateReport] = useState(new Date().toISOString().split('T')[0]);

    // Student-wise states
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [timeRange, setTimeRange] = useState<'month' | 'lastMonth' | 'lifetime'>('month');
    const [studentRecords, setStudentRecords] = useState<any[]>([]);
    const [studentSearch, setStudentSearch] = useState('');

    // Fetch all attendance for report processing
    const { data: allAttendanceRecords, loading: loadingAllAttendance } = useFirestore<any>('attendance');

    // Process Report Data
    const reportData = useMemo(() => {
        if (!students.length || activeTab !== 'report') return [];

        let filtered = students;

        // Report-specific role filtering
        if (user?.role === 'TEACHER') {
            filtered = filtered.filter(s => classesList.includes(s.class));
        }

        if (reportClass && reportClass !== 'All') filtered = filtered.filter(s => s.class === reportClass);
        if (reportSection) filtered = filtered.filter(s => s.section === reportSection);
        if (reportSearch) {
            const queryReport = reportSearch.toLowerCase();
            filtered = filtered.filter(s =>
                s.fullName?.toLowerCase().includes(queryReport) ||
                s.admissionNo?.toLowerCase().includes(queryReport) ||
                s.id?.toLowerCase().includes(queryReport)
            );
        }

        // Sort by Roll Number
        filtered.sort((a, b) => {
            const rollA = parseInt(a.classRollNo) || 0;
            const rollB = parseInt(b.classRollNo) || 0;
            if (rollA !== rollB) return rollA - rollB;
            return (a.fullName || '').localeCompare(b.fullName || '');
        });

        return filtered.map(student => {
            const studentAtt = allAttendanceRecords.filter(r =>
                (r.studentId === student.uid || r.studentId === student.id) &&
                r.date >= startDateReport &&
                r.date <= endDateReport &&
                r.schoolId === currentSchool?.id
            );

            const total = studentAtt.length;
            const present = studentAtt.filter(r => r.status === 'PRESENT').length;
            const late = studentAtt.filter(r => r.status === 'LATE').length;
            const absent = studentAtt.filter(r => r.status === 'ABSENT').length;
            const percentage = total > 0 ? (present / total) * 100 : 0;

            return {
                ...student,
                total,
                present,
                late,
                absent,
                percentage: percentage.toFixed(1)
            };
        });
    }, [students, allAttendanceRecords, reportClass, reportSection, reportSearch, startDateReport, endDateReport, activeTab, currentSchool?.id]);

    // Chart data for Attendance Overview pie chart (Monthly Summary)
    const monthlyChartData = useMemo(() => {
        const presentCount = monthlyRecords.filter(r => r.status === 'PRESENT').length;
        const absentCount = monthlyRecords.filter(r => r.status === 'ABSENT').length;
        const lateCount = monthlyRecords.filter(r => r.status === 'LATE').length;

        return [
            { name: 'Present', value: presentCount },
            { name: 'Absent', value: absentCount },
            { name: 'Late', value: lateCount }
        ];
    }, [monthlyRecords]);

    // Initial Data Fetch (on mount, school change, or session change)
    useEffect(() => {
        if (currentSchool?.id) {
            fetchStudents();
        }
    }, [currentSchool?.id, selectedSession]);

    // 2. Fetch attendance for 'Mark' tab
    useEffect(() => {
        if (currentSchool?.id && activeTab === 'mark') {
            fetchExistingAttendance(students);
        }
    }, [currentDate, activeTab, students, currentSchool?.id, filterClass, filterSection]);

    // 3. Fetch summary for 'Summary' tab
    useEffect(() => {
        if (currentSchool?.id && activeTab === 'summary') {
            fetchMonthlySummary();
        }
    }, [currentDate, activeTab, filterClass, currentSchool?.id]);

    // 4. Fetch specific student records
    useEffect(() => {
        if (currentSchool?.id && activeTab === 'student' && selectedStudent) {
            fetchStudentRecords();
        }
    }, [selectedStudent, timeRange, activeTab, currentSchool?.id]);

    // 5. Reset attendance state immediately when class/section changes to avoid stale data
    useEffect(() => {
        setAttendance({});
    }, [filterClass, filterSection, currentDate]);

    // 6. Fetch data for 'Show' tab
    useEffect(() => {
        if (activeTab === 'show' && showClass && currentSchool?.id && activeFY) {
            const fetchShowData = async () => {
                setShowLoading(true);
                try {
                    // Fetch working days
                    const wdRef = doc(db, 'attendance_working_days', `${currentSchool.id}_${activeFY}`);
                    const wdSnap = await getDoc(wdRef);
                    if (wdSnap.exists()) {
                        setShowWorkingDays(wdSnap.data().workingDays || {});
                    } else {
                        setShowWorkingDays({});
                    }

                    // Fetch attendance manual entries
                    const q = query(
                        collection(db, 'attendance_manual_entry'),
                        where('schoolId', '==', currentSchool.id),
                        where('financialYear', '==', activeFY),
                        where('class', '==', showClass)
                    );
                    const snap = await getDocs(q);
                    let records = snap.docs.map(d => d.data());
                    if (showSection) {
                        records = records.filter(r => r.section === showSection);
                    }
                    setShowData(records);
                } catch (error) {
                    console.error("Error fetching show attendance data:", error);
                } finally {
                    setShowLoading(false);
                }
            };
            fetchShowData();
        } else if (activeTab === 'show' && !showClass) {
            setShowData([]);
            setShowWorkingDays({});
        }
    }, [activeTab, showClass, showSection, currentSchool?.id, activeFY]);

    const handleExportReport = () => {
        const csvContent = "data:text/csv;charset=utf-8,"
            + ["Name,Admission No,Class,Section,Total Days,Present,Late,Absent,Percentage"]
                .concat(reportData.map(r => `${r.fullName},${r.admissionNo || r.id},${r.class},${r.section || ''},${r.total},${r.present},${r.late},${r.absent},${r.percentage}%`))
                .join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `attendance_report_${reportClass || 'all'}.csv`);
        document.body.appendChild(link);
        link.click();
    };

    const filteredStudents = useMemo(() => {
        if (!filterClass || filterClass === 'All') {
            if (user?.role !== 'TEACHER' && filterClass === 'All') {
                return students;
            }
            return []; // Don't show students if no class selected
        }
        let filtered = students.filter(s => s.class === filterClass);
        if (filterSection) filtered = filtered.filter(s => s.section === filterSection);
        if (studentSearch && activeTab === 'student') {
            const searchLower = studentSearch.toLowerCase();
            filtered = filtered.filter(s =>
                (s.fullName?.toLowerCase() || '').includes(searchLower) ||
                (s.id?.toLowerCase() || '').includes(searchLower) ||
                (s.admissionNo?.toLowerCase() || '').includes(searchLower)
            );
        }
        // Sort by Roll Number
        filtered.sort((a, b) => {
            const rollA = parseInt(a.classRollNo) || 0;
            const rollB = parseInt(b.classRollNo) || 0;
            if (rollA !== rollB) return rollA - rollB;
            return (a.fullName || '').localeCompare(b.fullName || '');
        });

        return filtered;
    }, [students, filterClass, filterSection, activeTab, studentSearch, user?.role]);

    const showStudentsList = useMemo(() => {
        if (!showClass) return [];
        return students
            .filter(s => s.class === showClass && (showSection ? s.section === showSection : true))
            .sort((a, b) => {
                const rollA = parseInt(a.classRollNo) || 0;
                const rollB = parseInt(b.classRollNo) || 0;
                if (rollA !== rollB) return rollA - rollB;
                return (a.fullName || '').localeCompare(b.fullName || '');
            });
    }, [students, showClass, showSection]);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'students'), where('schoolId', '==', currentSchool?.id));
            const snap = await getDocs(q);
            const data = snap.docs
                .map(doc => ({ uid: doc.id, ...doc.data() }))
                .filter((s: any) => s.status !== 'INACTIVE')
                .filter((s: any) => {
                    const session = selectedSession || activeFY;
                    if (!session || selectedSession === 'ALL') return true;
                    return s.session === session || !s.session;
                })
                .sort((a: any, b: any) => a.fullName?.localeCompare(b.fullName));
            setStudents(data);
        } catch (error) {
            console.error("Fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchExistingAttendance = async (studentList: any[]) => {
        try {
            const q = query(
                collection(db, 'attendance'),
                where('schoolId', '==', currentSchool?.id),
                where('date', '==', currentDate)
            );
            const snap = await getDocs(q);
            const existing: Record<string, string> = {};
            snap.docs.forEach(d => {
                const data = d.data();
                existing[data.studentId] = data.status;
            });

            const merged: Record<string, string> = {};
            studentList.forEach(s => {
                // Only set from DB — empty string means "not yet marked" (unchecked)
                merged[s.uid] = existing[s.uid] || existing[s.id] || '';
            });
            setAttendance(merged);
        } catch (error) {
            console.error("Existing attendance fetch error:", error);
        }
    };

    const handleMark = (studentId: string, status: string) => {
        setAttendance(prev => ({ ...prev, [studentId]: status }));
    };

    const markAll = (status: string) => {
        const next = { ...attendance };
        filteredStudents.forEach(s => next[s.uid] = status);
        setAttendance(next);
    };

    const saveAttendance = async () => {
        // Check if any students are still unmarked
        const unmarked = filteredStudents.filter(s => !attendance[s.uid]);
        if (unmarked.length > 0) {
            const confirm = window.confirm(
                `${unmarked.length} student(s) have not been marked yet.\nThey will be saved as PRESENT by default.\n\nDo you want to continue?`
            );
            if (!confirm) return;
        }

        setLoading(true);
        try {
            const batch = writeBatch(db);
            const dayName = new Date(currentDate).toLocaleDateString('en-US', { weekday: 'long' });

            filteredStudents.forEach(s => {
                const status = attendance[s.uid];
                // Skip entirely if no status is set AND user hasn't acknowledged
                // (but at this point we already confirmed, so default to PRESENT)
                const finalStatus = status || 'PRESENT';
                const docId = `att_${s.uid}_${currentDate}`;
                const attRef = doc(db, 'attendance', docId);
                batch.set(attRef, {
                    studentId: s.uid,
                    studentName: s.fullName,
                    admissionNo: s.admissionNo || s.id,
                    class: s.class,
                    section: s.section || '',
                    date: currentDate,
                    day: dayName,
                    status: finalStatus,
                    markedBy: 'Admin',
                    markedAt: new Date().toISOString(),
                    schoolId: currentSchool?.id,
                    updatedAt: serverTimestamp()
                }, { merge: true });
            });
            await batch.commit();
            alert("Attendance saved successfully!");
        } catch (error: any) {
            alert("Save error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchMonthlySummary = async () => {
        setSummaryLoading(true);
        try {
            const start = formatDate(startOfMonth(new Date(currentDate)), 'yyyy-MM-dd');
            const end = formatDate(endOfMonth(new Date(currentDate)), 'yyyy-MM-dd');

            const collectionName = 'attendance';
            // Query by schoolId only to avoid composite index requirement
            const q = query(
                collection(db, collectionName),
                where('schoolId', '==', currentSchool?.id)
            );

            const snap = await getDocs(q);
            // Filter by date range client-side
            let records = snap.docs
                .map(doc => doc.data())
                .filter(r => r.date >= start && r.date <= end);

            records = records.filter(r => !filterClass || filterClass === 'All' || r.class === filterClass);
            setMonthlyRecords(records);
        } catch (error) {
            console.error("Summary fetch error:", error);
        } finally {
            setSummaryLoading(false);
        }
    };

    const fetchStudentRecords = async () => {
        if (!selectedStudent) return;
        setSummaryLoading(true);
        try {
            // Query by schoolId only to avoid composite index requirement
            const q = query(
                collection(db, 'attendance'),
                where('schoolId', '==', currentSchool?.id)
            );

            const snap = await getDocs(q);
            // Filter by studentId (check both UID and old ID) and date client-side
            let records = snap.docs
                .map(doc => doc.data())
                .filter(r => r.studentId === selectedStudent.uid || r.studentId === selectedStudent.id);

            if (timeRange !== 'lifetime') {
                const now = new Date();
                let start, end;
                if (timeRange === 'month') {
                    start = formatDate(startOfMonth(now), 'yyyy-MM-dd');
                    end = formatDate(endOfMonth(now), 'yyyy-MM-dd');
                } else {
                    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    start = formatDate(startOfMonth(last), 'yyyy-MM-dd');
                    end = formatDate(endOfMonth(last), 'yyyy-MM-dd');
                }
                records = records.filter(r => r.date >= start && r.date <= end);
            }

            records.sort((a: any, b: any) => b.date.localeCompare(a.date));
            setStudentRecords(records);
        } catch (error) {
            console.error("Student records fetch error:", error);
        } finally {
            setSummaryLoading(false);
        }
    };





    const availableSections = useMemo(() => {
        if (!filterClass || filterClass === 'All') return [];
        const sections = students
            .filter(s => s.class === filterClass && s.section)
            .map(s => s.section);
        return Array.from(new Set(sections)).sort();
    }, [students, filterClass]);

    const reportSections = useMemo(() => {
        if (!reportClass) return [];
        const sections = students
            .filter(s => (reportClass === 'All' ? true : s.class === reportClass) && s.section)
            .map(s => s.section);
        return Array.from(new Set(sections)).sort();
    }, [students, reportClass]);

    const stats = useMemo(() => {
        const currentList = filteredStudents;
        const currentAtt = attendance;
        const idKey = 'uid';

        const counts = { present: 0, absent: 0, late: 0, total: currentList.length };
        currentList.forEach(item => {
            const status = currentAtt[item[idKey]];
            if (status === 'PRESENT') counts.present++;
            else if (status === 'ABSENT') counts.absent++;
            else if (status === 'LATE') counts.late++;
        });
        return counts;
    }, [activeTab, filteredStudents, attendance]);

    const liveChartData = [
        { name: 'Present', value: stats.present },
        { name: 'Absent', value: stats.absent },
        { name: 'Late', value: stats.late },
    ];

    return (
        <div className="animate-fade-in no-scrollbar" style={{ paddingBottom: '3rem' }}>
            <div className="page-header" style={{ flexDirection: 'column', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2.25rem)', fontWeight: 800, marginBottom: '0.5rem' }}>Attendance Management</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(0.875rem, 2.5vw, 1.0625rem)' }}>
                        Mark and track student presence with visualized reports.
                    </p>
                </div>
                <div style={{
                    display: 'flex',
                    background: 'white',
                    padding: '0.4rem',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)',
                    gap: '0.5rem',
                    overflowX: 'auto',
                    width: '100%',
                    maxWidth: '100%'
                }}>
                    {(['mark', 'summary', 'student', 'report', 'entry', 'show'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`btn ${activeTab === tab ? 'btn-primary' : ''}`}
                            style={{
                                padding: '0.5rem 1rem',
                                border: 'none',
                                background: activeTab === tab ? 'var(--primary)' : 'transparent',
                                color: activeTab === tab ? 'white' : 'var(--text-muted)',
                                whiteSpace: 'nowrap',
                                minWidth: 'fit-content'
                            }}
                        >
                            {tab === 'entry' ? 'Attendance Entry' : tab === 'show' ? 'Show Attendance' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {activeTab === 'mark' && (
                    <>
                        <div className="glass-card" style={{
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            gridColumn: '1 / -1'
                        }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '1rem',
                                width: '100%'
                            }}>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label className="field-label">SESSION</label>
                                    <select
                                        className="input-field"
                                        value={selectedSession}
                                        onChange={(e) => setSelectedSession(e.target.value)}
                                    >
                                        <option value="ALL">All Sessions</option>
                                        {schoolYears.map(s => (
                                            <option key={s} value={s}>{s}{s === activeFY ? ' (Active)' : ''}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label className="field-label">DATE</label>
                                    <input
                                        type="date"
                                        className="input-field"
                                        value={currentDate}
                                        onChange={(e) => setCurrentDate(e.target.value)}
                                    />
                                </div>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label className="field-label">CLASS FILTER</label>
                                    <select
                                        className="input-field"
                                        value={filterClass}
                                        onChange={(e) => {
                                            setFilterClass(e.target.value);
                                            setFilterSection('');
                                        }}
                                        style={!filterClass ? { borderColor: 'var(--primary)', boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.1)' } : {}}
                                    >
                                        <option value="">{assignedLoading ? 'Loading Classes...' : 'Choose Class'}</option>
                                        {user?.role !== 'TEACHER' && <option value="All">All Classes (Admin Only)</option>}
                                        {classesList.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label className="field-label">SECTION FILTER</label>
                                    <select
                                        className="input-field"
                                        value={filterSection}
                                        onChange={(e) => setFilterSection(e.target.value)}
                                        disabled={!filterClass || filterClass === 'All'}
                                    >
                                        <option value="">All Sections</option>
                                        {availableSections.map(sec => <option key={sec} value={sec}>Section {sec}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                gap: '0.75rem',
                                width: '100%'
                            }}>
                                <button
                                    onClick={() => markAll('PRESENT')}
                                    className="btn"
                                    style={{
                                        color: '#10b981',
                                        borderColor: 'rgba(16, 185, 129, 0.3)',
                                        fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
                                        padding: '0.75rem 1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <CheckCircle2 size={16} /> All Present
                                </button>
                                <button
                                    onClick={() => markAll('ABSENT')}
                                    className="btn"
                                    style={{
                                        color: '#f43f5e',
                                        borderColor: 'rgba(244, 63, 94, 0.3)',
                                        fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
                                        padding: '0.75rem 1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <XCircle size={16} /> All Absent
                                </button>
                            </div>
                        </div>

                        {/* Live Attendance Count Summary */}
                        {filterClass && filterClass !== 'All' && filteredStudents.length > 0 && (
                            <div style={{
                                gridColumn: '1 / -1',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                gap: '0.75rem',
                            }}>
                                {/* Present */}
                                <div style={{
                                    background: 'rgba(16, 185, 129, 0.08)',
                                    border: '2px solid rgba(16, 185, 129, 0.35)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: '0.875rem 1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                }}>
                                    <div style={{
                                        width: '2.5rem', height: '2.5rem', borderRadius: '50%',
                                        background: '#10b981', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', flexShrink: 0
                                    }}>
                                        <CheckCircle2 size={16} color="white" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Present</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', lineHeight: 1 }}>{stats.present}</div>
                                    </div>
                                </div>
                                {/* Absent */}
                                <div style={{
                                    background: 'rgba(244, 63, 94, 0.08)',
                                    border: '2px solid rgba(244, 63, 94, 0.35)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: '0.875rem 1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                }}>
                                    <div style={{
                                        width: '2.5rem', height: '2.5rem', borderRadius: '50%',
                                        background: '#f43f5e', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', flexShrink: 0
                                    }}>
                                        <XCircle size={16} color="white" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#f43f5e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Absent</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f43f5e', lineHeight: 1 }}>{stats.absent}</div>
                                    </div>
                                </div>
                                {/* Late */}
                                <div style={{
                                    background: 'rgba(245, 158, 11, 0.08)',
                                    border: '2px solid rgba(245, 158, 11, 0.35)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: '0.875rem 1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                }}>
                                    <div style={{
                                        width: '2.5rem', height: '2.5rem', borderRadius: '50%',
                                        background: '#f59e0b', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', flexShrink: 0
                                    }}>
                                        <Clock size={16} color="white" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Late</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>{stats.late}</div>
                                    </div>
                                </div>
                                {/* Total */}
                                <div style={{
                                    background: 'rgba(99, 102, 241, 0.08)',
                                    border: '2px solid rgba(99, 102, 241, 0.35)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: '0.875rem 1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                }}>
                                    <div style={{
                                        width: '2.5rem', height: '2.5rem', borderRadius: '50%',
                                        background: 'var(--primary)', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', flexShrink: 0
                                    }}>
                                        <Users size={16} color="white" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>{stats.total}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="glass-card" style={{ gridColumn: '1 / -1', padding: 0, overflow: 'hidden' }}>
                            {/* Desktop Table */}
                            <div className="attendance-table-desktop" style={{ display: 'none' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ background: 'rgba(248, 250, 252, 0.5)', borderBottom: '1px solid var(--border)' }}>
                                        <tr style={{ textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                                            <th style={{ padding: '1.25rem 1.5rem' }}>Student Details</th>
                                            <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>Status Control</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStudents.map((s, idx) => (
                                            <tr key={s.uid} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '1rem 1.5rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '2rem' }}>{idx + 1}.</span>
                                                        <div>
                                                            <div style={{ fontWeight: 700 }}>{s.fullName}</div>
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Roll: {s.classRollNo} • {s.class}-{s.section}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem 1.5rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                                        {(['PRESENT', 'ABSENT', 'LATE'] as const).map(status => (
                                                            <button
                                                                key={status}
                                                                onClick={() => handleMark(s.uid, status)}
                                                                className={`btn ${attendance[s.uid] === status ? '' : 'btn-outline'}`}
                                                                style={{
                                                                    fontSize: '0.7rem',
                                                                    padding: '0.4rem 0.8rem',
                                                                    background: attendance[s.uid] === status ? (status === 'PRESENT' ? '#10b981' : (status === 'ABSENT' ? '#f43f5e' : '#f59e0b')) : 'transparent',
                                                                    color: attendance[s.uid] === status ? 'white' : 'var(--text-muted)',
                                                                    borderColor: status === 'PRESENT' ? '#10b981' : (status === 'ABSENT' ? '#f43f5e' : '#f59e0b')
                                                                }}
                                                            >
                                                                {status}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredStudents.length === 0 && (
                                            <tr>
                                                <td colSpan={2} style={{ padding: '5rem 1.5rem', textAlign: 'center' }}>
                                                    {!filterClass ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                                            <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '50%', color: 'var(--primary)' }}>
                                                                <Users size={32} />
                                                            </div>
                                                            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1e293b' }}>Select a class to start marking</div>
                                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Choose your assigned class from the filter above.</div>
                                                        </div>
                                                    ) : (
                                                        "No students found for this class."
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="attendance-cards-mobile" style={{ display: 'none', padding: '1rem', gap: '1rem', flexDirection: 'column' }}>
                                {filteredStudents.map((s, idx) => (
                                    <div key={s.uid} style={{
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '1rem',
                                        background: 'white'
                                    }}>
                                        <div style={{ marginBottom: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                <span style={{
                                                    fontSize: '0.65rem',
                                                    color: 'var(--text-muted)',
                                                    background: 'var(--bg-main)',
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '0.25rem',
                                                    fontWeight: 600
                                                }}>#{idx + 1}</span>
                                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{s.fullName}</div>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                                                <div>Roll: {s.classRollNo} • {s.class}-{s.section}</div>
                                            </div>
                                        </div>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(3, 1fr)',
                                            gap: '0.5rem',
                                            borderTop: '1px solid var(--border)',
                                            paddingTop: '0.75rem'
                                        }}>
                                            {(['PRESENT', 'ABSENT', 'LATE'] as const).map(status => (
                                                <button
                                                    key={status}
                                                    onClick={() => handleMark(s.uid, status)}
                                                    className={`btn ${attendance[s.uid] === status ? '' : 'btn-outline'}`}
                                                    style={{
                                                        fontSize: '0.7rem',
                                                        padding: '0.6rem 0.4rem',
                                                        background: attendance[s.uid] === status ? (status === 'PRESENT' ? '#10b981' : (status === 'ABSENT' ? '#f43f5e' : '#f59e0b')) : 'transparent',
                                                        color: attendance[s.uid] === status ? 'white' : 'var(--text-muted)',
                                                        borderColor: status === 'PRESENT' ? '#10b981' : (status === 'ABSENT' ? '#f43f5e' : '#f59e0b'),
                                                        borderWidth: '2px',
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    {status}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {filteredStudents.length === 0 && (
                                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No students found for this class.</div>
                                )}
                            </div>
                        </div>

                        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                            <button
                                onClick={saveAttendance}
                                disabled={loading}
                                className="btn btn-primary"
                                style={{
                                    padding: 'clamp(0.75rem, 2vw, 1rem) clamp(2rem, 5vw, 3rem)',
                                    borderRadius: '2rem',
                                    display: 'flex',
                                    gap: '0.75rem',
                                    fontSize: 'clamp(0.875rem, 2vw, 1rem)',
                                    width: '100%',
                                    maxWidth: '400px',
                                    justifyContent: 'center'
                                }}
                            >
                                <Save size={20} /> Save Daily Attendance
                            </button>
                        </div>
                    </>
                )}



                {activeTab === 'summary' && (
                    <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                        <div className="glass-card" style={{ padding: '1.5rem', gridColumn: '1 / -1', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label className="field-label">Viewing Month</label>
                                <input type="month" className="input-field" value={currentDate.substring(0, 7)} onChange={(e) => setCurrentDate(e.target.value + '-01')} />
                            </div>
                        </div>

                        <div className="glass-card" style={{ padding: '1.5rem', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ marginBottom: '1.5rem', fontWeight: 800 }}>Attendance Overview</h3>
                            <div style={{ flex: 1, minHeight: '300px', position: 'relative' }}>
                                {summaryLoading ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><RefreshCcw className="animate-spin" /></div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={300}>
                                        {monthlyChartData.some(d => d.value > 0) ? (
                                            <PieChart>
                                                <Pie
                                                    data={monthlyChartData}
                                                    cx="50%"
                                                    cy="45%"
                                                    innerRadius={60}
                                                    outerRadius={90}
                                                    paddingAngle={0}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    isAnimationActive={false}
                                                    label={({ name, percent }) => percent && percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                                                >
                                                    {monthlyChartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend verticalAlign="bottom" height={36} />
                                            </PieChart>
                                        ) : (
                                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
                                                <Users size={32} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
                                                <div style={{ fontSize: '0.875rem' }}>No records found for this selection</div>
                                            </div>
                                        )}
                                    </ResponsiveContainer>
                                )}
                            </div>
                            {monthlyChartData.some(d => d.value > 0) && (
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
                                    {monthlyChartData.map((d, i) => (
                                        <div key={i} style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{d.name}</div>
                                            <div style={{ fontSize: '1rem', fontWeight: 800, color: COLORS[i] }}>{d.value}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ marginBottom: '1.5rem', fontWeight: 800 }}>Daily Trends</h3>
                            <div style={{ width: '100%', height: '300px' }}>
                                <ResponsiveContainer width="99%" height="100%">
                                    <BarChart data={eachDayOfInterval({ start: startOfMonth(new Date(currentDate)), end: endOfMonth(new Date(currentDate)) }).map(day => {
                                        const dateStr = formatDate(day, 'yyyy-MM-dd');
                                        const dayRecords = monthlyRecords.filter(r => r.date === dateStr);
                                        return {
                                            day: day.getDate(),
                                            Present: dayRecords.filter(r => r.status === 'PRESENT').length,
                                            Absent: dayRecords.filter(r => r.status === 'ABSENT').length
                                        };
                                    })}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="day" fontSize={10} />
                                        <YAxis fontSize={10} />
                                        <Tooltip />
                                        <Bar dataKey="Present" fill="#10b981" radius={[2, 2, 0, 0]} />
                                        <Bar dataKey="Absent" fill="#f43f5e" radius={[2, 2, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'student' && (
                    <div style={{ gridColumn: '1 / -1' }} className="student-tab-container">
                        <div className="glass-card" style={{ padding: 'clamp(1rem, 3vw, 2rem)', marginBottom: '1.5rem' }}>
                            <div className="input-group" style={{ marginBottom: 0, maxWidth: '100%' }}>
                                <label className="field-label">SEARCH STUDENT BY NAME OR ID</label>
                                <div style={{ position: 'relative' }}>
                                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        className="input-field"
                                        style={{ paddingLeft: '3rem' }}
                                        placeholder="Type student name or admission number..."
                                        value={studentSearch}
                                        onChange={(e) => setStudentSearch(e.target.value)}
                                    />
                                </div>
                                {studentSearch && filteredStudents.length > 0 && (
                                    <div style={{
                                        position: 'relative',
                                        marginTop: '0.5rem',
                                        background: 'white',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-md)',
                                        maxHeight: '300px',
                                        overflowY: 'auto',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                        zIndex: 10
                                    }}>
                                        {filteredStudents.slice(0, 10).map(s => (
                                            <button
                                                key={s.uid}
                                                onClick={() => {
                                                    setSelectedStudent(s);
                                                    setStudentSearch('');
                                                }}
                                                style={{
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    padding: 'clamp(0.75rem, 2vw, 1rem)',
                                                    border: 'none',
                                                    borderBottom: '1px solid var(--border)',
                                                    background: 'transparent',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 'clamp(0.875rem, 2vw, 1rem)' }}>{s.fullName}</span>
                                                <span style={{ fontSize: 'clamp(0.7rem, 1.5vw, 0.75rem)', color: 'var(--text-muted)' }}>
                                                    Roll: {s.classRollNo} • {s.class}
                                                </span>
                                            </button>
                                        ))}
                                        {filteredStudents.length > 10 && (
                                            <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                Showing 10 of {filteredStudents.length} results. Type more to narrow down...
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="glass-card" style={{ padding: 'clamp(1rem, 3vw, 2rem)' }}>
                            {selectedStudent ? (
                                <>
                                    <div className="student-header" style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        marginBottom: '1.5rem',
                                        gap: '1rem'
                                    }}>
                                        <div>
                                            <h2 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.5rem)', fontWeight: 800, marginBottom: '0.5rem' }}>{selectedStudent.fullName}</h2>
                                            <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(0.75rem, 2vw, 0.875rem)', lineHeight: '1.4' }}>
                                                Roll No: {selectedStudent.classRollNo} • {selectedStudent.class}
                                            </p>
                                        </div>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                                            gap: '0.5rem',
                                            width: '100%'
                                        }}>
                                            {(['month', 'lastMonth', 'lifetime'] as const).map(range => (
                                                <button
                                                    key={range}
                                                    onClick={() => setTimeRange(range)}
                                                    className={`btn ${timeRange === range ? 'btn-primary' : ''}`}
                                                    style={{
                                                        fontSize: 'clamp(0.7rem, 1.8vw, 0.75rem)',
                                                        padding: '0.5rem 0.75rem',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    {range === 'month' ? 'This Month' : range === 'lastMonth' ? 'Last Month' : 'Lifetime'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="attendance-stats-grid" style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                        gap: 'clamp(0.75rem, 2vw, 1.5rem)',
                                        marginBottom: '1.5rem'
                                    }}>
                                        <div style={{ padding: 'clamp(1rem, 2.5vw, 1.5rem)', background: 'rgba(16, 185, 129, 0.05)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                                            <span style={{ fontSize: 'clamp(0.65rem, 1.5vw, 0.75rem)', fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>Present</span>
                                            <div style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, color: '#10b981' }}>{studentRecords.filter(r => r.status === 'PRESENT').length}</div>
                                        </div>
                                        <div style={{ padding: 'clamp(1rem, 2.5vw, 1.5rem)', background: 'rgba(245, 158, 11, 0.05)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                                            <span style={{ fontSize: 'clamp(0.65rem, 1.5vw, 0.75rem)', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>Late</span>
                                            <div style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, color: '#f59e0b' }}>{studentRecords.filter(r => r.status === 'LATE').length}</div>
                                        </div>
                                        <div style={{ padding: 'clamp(1rem, 2.5vw, 1.5rem)', background: 'rgba(244, 63, 94, 0.05)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(244, 63, 94, 0.1)' }}>
                                            <span style={{ fontSize: 'clamp(0.65rem, 1.5vw, 0.75rem)', fontWeight: 800, color: '#f43f5e', textTransform: 'uppercase' }}>Absent</span>
                                            <div style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, color: '#f43f5e' }}>{studentRecords.filter(r => r.status === 'ABSENT').length}</div>
                                        </div>
                                        <div style={{ padding: 'clamp(1rem, 2.5vw, 1.5rem)', background: 'rgba(99, 102, 241, 0.05)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                                            <span style={{ fontSize: 'clamp(0.65rem, 1.5vw, 0.75rem)', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>Attendance %</span>
                                            <div style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, color: 'var(--primary)' }}>
                                                {studentRecords.length > 0 ? Math.round((studentRecords.filter(r => r.status === 'PRESENT').length / studentRecords.length) * 100) : 0}%
                                            </div>
                                        </div>
                                    </div>

                                    {/* Desktop Table View */}
                                    <div className="student-attendance-table" style={{ overflowX: 'auto', display: 'none' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                                            <thead style={{ borderBottom: '1px solid var(--border)' }}>
                                                <tr style={{ textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                                    <th style={{ padding: '1rem' }}>Date</th>
                                                    <th style={{ padding: '1rem' }}>Day</th>
                                                    <th style={{ padding: '1rem' }}>Status</th>
                                                    <th style={{ padding: '1rem' }}>Marked By</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {studentRecords.length > 0 ? studentRecords.map(r => (
                                                    <tr key={r.date} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '1rem', fontWeight: 600 }}>{r.date}</td>
                                                        <td style={{ padding: '1rem' }}>{r.day}</td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <span style={{
                                                                padding: '0.3rem 0.6rem',
                                                                borderRadius: '1rem',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 800,
                                                                background: r.status === 'PRESENT' ? '#10b981' : (r.status === 'ABSENT' ? '#f43f5e' : '#f59e0b'),
                                                                color: 'white'
                                                            }}>
                                                                {r.status}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{r.markedBy}</td>
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                            No attendance records found for the selected period.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile Card View */}
                                    <div className="student-attendance-cards" style={{ display: 'none', flexDirection: 'column', gap: '0.75rem' }}>
                                        {studentRecords.length > 0 ? studentRecords.map(r => (
                                            <div key={r.date} style={{
                                                border: '1px solid var(--border)',
                                                borderRadius: 'var(--radius-md)',
                                                padding: '1rem',
                                                background: 'white'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{r.date}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.day}</div>
                                                    </div>
                                                    <span style={{
                                                        padding: '0.4rem 0.75rem',
                                                        borderRadius: '1rem',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 800,
                                                        background: r.status === 'PRESENT' ? '#10b981' : (r.status === 'ABSENT' ? '#f43f5e' : '#f59e0b'),
                                                        color: 'white'
                                                    }}>
                                                        {r.status}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                                                    Marked by: {r.markedBy}
                                                </div>
                                            </div>
                                        )) : (
                                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                No attendance records found for the selected period.
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div style={{ height: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                                    <Users size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                    <p style={{ fontSize: 'clamp(0.875rem, 2vw, 1rem)', fontWeight: 600, textAlign: 'center' }}>Search and select a student to view attendance history</p>
                                    <p style={{ fontSize: 'clamp(0.75rem, 1.8vw, 0.875rem)', marginTop: '0.5rem', textAlign: 'center' }}>Start typing in the search box above</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === 'report' && (
                    <div style={{ gridColumn: '1 / -1' }} className="animate-fade-in">
                        {/* Filters */}
                        <div className="glass-card" style={{ padding: 'clamp(1rem, 3vw, 2rem)', marginBottom: '1.5rem' }}>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem',
                                marginBottom: '1.5rem'
                            }}>
                                <h3 style={{ fontWeight: 800, fontSize: 'clamp(1.125rem, 3vw, 1.25rem)' }}>Attendance Analytics Report</h3>
                                <button
                                    className="btn"
                                    onClick={handleExportReport}
                                    style={{
                                        background: 'var(--primary)',
                                        color: 'white',
                                        border: 'none',
                                        width: '100%',
                                        maxWidth: '200px',
                                        fontSize: 'clamp(0.8rem, 2vw, 0.875rem)'
                                    }}
                                >
                                    <Download size={18} /> Export CSV
                                </button>
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '1rem'
                            }}>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label className="field-label">CLASS</label>
                                    <select className="input-field" value={reportClass} onChange={(e) => {
                                        setReportClass(e.target.value);
                                        setReportSection('');
                                    }}>
                                        <option value="">{assignedLoading ? 'Loading Classes...' : 'Choose Class'}</option>
                                        {user?.role !== 'TEACHER' && <option value="All">All Classes</option>}
                                        {classesList.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label className="field-label">SECTION</label>
                                    <select className="input-field" value={reportSection} onChange={(e) => setReportSection(e.target.value)} disabled={!reportClass || reportClass === 'All'}>
                                        <option value="">All Sections</option>
                                        {reportSections.map(sec => <option key={sec} value={sec}>Section {sec}</option>)}
                                    </select>
                                </div>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label className="field-label">FROM DATE</label>
                                    <input type="date" className="input-field" value={startDateReport} onChange={(e) => setStartDateReport(e.target.value)} />
                                </div>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label className="field-label">TO DATE</label>
                                    <input type="date" className="input-field" value={endDateReport} onChange={(e) => setEndDateReport(e.target.value)} />
                                </div>
                                <div className="input-group" style={{ marginBottom: 0, gridColumn: 'span 1' }}>
                                    <label className="field-label">SEARCH STUDENT</label>
                                    <div style={{ position: 'relative' }}>
                                        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input
                                            type="text"
                                            className="input-field"
                                            style={{ paddingLeft: '3rem' }}
                                            placeholder="Name or Admission No..."
                                            value={reportSearch}
                                            onChange={(e) => setReportSearch(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Desktop Table */}
                        <div className="glass-card report-table-desktop" style={{ padding: 0, overflow: 'hidden', display: 'none' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', background: 'rgba(248, 250, 252, 0.5)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            <th style={{ padding: '1.25rem 1.5rem' }}>Student</th>
                                            <th style={{ padding: '1.25rem 1.5rem' }}>Class/Sec</th>
                                            <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>Total Days</th>
                                            <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>Present</th>
                                            <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>Late</th>
                                            <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>Absent</th>
                                            <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>Percentage</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingAllAttendance ? (
                                            <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading analytical records...</td></tr>
                                        ) : reportData.length === 0 ? (
                                            <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No records matching the filters.</td></tr>
                                        ) : reportData.map((row: any) => (
                                            <tr key={row.uid || row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '1.25rem 1.5rem' }}>
                                                    <div style={{ fontWeight: 700 }}>{row.fullName}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        Roll: {row.classRollNo}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600 }}>{row.class} - {row.section || '-'}</td>
                                                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>{row.total}</td>
                                                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center', color: '#10b981', fontWeight: 700 }}>{row.present}</td>
                                                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center', color: '#f59e0b', fontWeight: 700 }}>{row.late}</td>
                                                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center', color: '#f43f5e', fontWeight: 700 }}>{row.absent}</td>
                                                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                                                    <div style={{ fontWeight: 800 }}>{row.percentage}%</div>
                                                    <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '2px', marginTop: '4px' }}>
                                                        <div style={{ width: `${row.percentage}%`, height: '100%', background: parseFloat(row.percentage) > 75 ? '#10b981' : '#f43f5e', borderRadius: '2px' }} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile Card View */}
                        <div className="report-cards-mobile" style={{ display: 'none', flexDirection: 'column', gap: '1rem' }}>
                            {loadingAllAttendance ? (
                                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading analytical records...</div>
                            ) : reportData.length === 0 ? (
                                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No records matching the filters.</div>
                            ) : reportData.map((row: any) => (
                                <div key={row.uid || row.id} className="glass-card" style={{ padding: '1rem', background: 'white' }}>
                                    <div style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>{row.fullName}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            Roll: {row.classRollNo} • {row.class} - {row.section || '-'}
                                        </div>
                                    </div>

                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(2, 1fr)',
                                        gap: '0.75rem',
                                        marginBottom: '0.75rem'
                                    }}>
                                        <div style={{ background: 'rgba(248, 250, 252, 0.5)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Days</div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{row.total}</div>
                                        </div>
                                        <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                                            <div style={{ fontSize: '0.65rem', color: '#10b981', textTransform: 'uppercase', fontWeight: 700 }}>Present</div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>{row.present}</div>
                                        </div>
                                        <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                                            <div style={{ fontSize: '0.65rem', color: '#f59e0b', textTransform: 'uppercase', fontWeight: 700 }}>Late</div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>{row.late}</div>
                                        </div>
                                        <div style={{ background: 'rgba(244, 63, 94, 0.05)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                                            <div style={{ fontSize: '0.65rem', color: '#f43f5e', textTransform: 'uppercase', fontWeight: 700 }}>Absent</div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f43f5e' }}>{row.absent}</div>
                                        </div>
                                    </div>

                                    <div style={{
                                        background: 'rgba(99, 102, 241, 0.05)',
                                        padding: '0.75rem',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid rgba(99, 102, 241, 0.1)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>Attendance</span>
                                            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>{row.percentage}%</span>
                                        </div>
                                        <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px' }}>
                                            <div style={{
                                                width: `${row.percentage}%`,
                                                height: '100%',
                                                background: parseFloat(row.percentage) > 75 ? '#10b981' : '#f43f5e',
                                                borderRadius: '3px',
                                                transition: 'width 0.3s ease'
                                            }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ===================== ATTENDANCE ENTRY TAB ===================== */}
                {activeTab === 'entry' && (
                    <div style={{ gridColumn: '1 / -1' }}>

                        {/* Working Days Modal */}
                        {showWorkingDaysModal && (
                            <div style={{
                                position: 'fixed', inset: 0,
                                background: 'rgba(15, 23, 42, 0.7)',
                                backdropFilter: 'blur(8px)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                zIndex: 1000, padding: '1.5rem'
                            }}>
                                <div style={{
                                    width: '100%',
                                    maxWidth: '700px',
                                    background: 'white',
                                    borderRadius: '1.25rem',
                                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                                    maxHeight: '90vh',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}>
                                    {/* Modal Header */}
                                    <div style={{
                                        padding: '1.5rem 2rem',
                                        borderBottom: '1px solid #f1f5f9',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        background: '#fff'
                                    }}>
                                        <div>
                                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <CalendarDays size={24} color="var(--primary)" />
                                                Total Working Days
                                            </h3>
                                            <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>Set academic year working days for Session {activeFY}</p>
                                        </div>
                                        <button
                                            onClick={() => setShowWorkingDaysModal(false)}
                                            style={{
                                                background: '#f1f5f9',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: '32px',
                                                height: '32px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                color: '#64748b',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = '#e2e8f0'}
                                            onMouseOut={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    {/* Modal Body */}
                                    <div style={{ padding: '2rem', overflowY: 'auto' }}>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                            gap: '1.5rem 1rem'
                                        }}>
                                            {ACADEMIC_MONTHS.map(month => (
                                                <div key={month} className="input-group" style={{ marginBottom: 0 }}>
                                                    <label className="field-label" style={{
                                                        color: '#475569',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.05em',
                                                        marginBottom: '0.5rem'
                                                    }}>{month}</label>
                                                    <div style={{ position: 'relative' }}>
                                                        <input
                                                            type="number"
                                                            className="input-field"
                                                            placeholder="0"
                                                            min={0}
                                                            max={31}
                                                            value={tempWorkingDays[month] || ''}
                                                            onChange={e => setTempWorkingDays(prev => ({ ...prev, [month]: e.target.value }))}
                                                            style={{
                                                                background: '#f8fafc',
                                                                border: '2px solid #e2e8f0',
                                                                padding: '0.75rem 1rem',
                                                                fontSize: '1rem',
                                                                fontWeight: 600,
                                                                transition: 'all 0.2s'
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Modal Footer */}
                                    <div style={{
                                        padding: '1.25rem 2rem',
                                        borderTop: '1px solid #f1f5f9',
                                        display: 'flex',
                                        gap: '1rem',
                                        justifyContent: 'flex-end',
                                        background: '#f8fafc'
                                    }}>
                                        <button
                                            className="btn"
                                            onClick={() => setShowWorkingDaysModal(false)}
                                            style={{
                                                background: 'white',
                                                color: '#64748b',
                                                border: '1px solid #e2e8f0',
                                                padding: '0.625rem 1.5rem'
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            style={{
                                                padding: '0.625rem 2rem',
                                                boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.4)'
                                            }}
                                            onClick={async () => {
                                                try {
                                                    const docRef = doc(db, 'attendance_working_days', `${currentSchool?.id}_${activeFY}`);
                                                    await setDoc(docRef, {
                                                        schoolId: currentSchool?.id,
                                                        financialYear: activeFY,
                                                        workingDays: tempWorkingDays,
                                                        updatedAt: serverTimestamp()
                                                    }, { merge: true });
                                                    setWorkingDays(tempWorkingDays);
                                                    setWorkingDaysSaved(true);
                                                    setShowWorkingDaysModal(false);
                                                } catch (e: any) {
                                                    alert('Error saving: ' + e.message);
                                                }
                                            }}
                                        >
                                            <Save size={18} style={{ marginRight: '0.5rem' }} /> Save Working Days
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Header with Working Days button */}
                        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.125rem' }}>Manual Attendance Entry</h3>
                                    <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Enter month-wise present days for each student</p>
                                </div>
                                <button
                                    className="btn btn-primary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem' }}
                                    onClick={async () => {
                                        // Load existing working days
                                        try {
                                            const docRef = doc(db, 'attendance_working_days', `${currentSchool?.id}_${activeFY}`);
                                            const snap = await getDoc(docRef);
                                            if (snap.exists()) {
                                                setTempWorkingDays(snap.data().workingDays || {});
                                                setWorkingDays(snap.data().workingDays || {});
                                            } else {
                                                setTempWorkingDays({});
                                            }
                                        } catch { }
                                        setShowWorkingDaysModal(true);
                                    }}
                                >
                                    <CalendarDays size={16} /> Enter Total Working Days
                                </button>
                            </div>

                            {/* Working Days Summary */}
                            {Object.keys(workingDays).length > 0 && (
                                <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {ACADEMIC_MONTHS.map(month => workingDays[month] ? (
                                        <span key={month} style={{
                                            background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)',
                                            border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 'var(--radius-sm)',
                                            padding: '0.25rem 0.625rem', fontSize: '0.75rem', fontWeight: 600
                                        }}>
                                            {month}: {workingDays[month]} days
                                        </span>
                                    ) : null)}
                                </div>
                            )}
                        </div>

                        {/* Class & Section Selector */}
                        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label className="field-label">SELECT CLASS</label>
                                    <select
                                        className="input-field"
                                        value={entryClass}
                                        onChange={e => {
                                            setEntryClass(e.target.value);
                                            setEntrySection('');
                                            setEntryStudent(null);
                                            setEntryData({});
                                        }}
                                    >
                                        <option value="">-- Choose Class --</option>
                                        {classesList.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                {entryClass && (
                                    <div className="input-group" style={{ marginBottom: 0 }}>
                                        <label className="field-label">SELECT SECTION</label>
                                        <select
                                            className="input-field"
                                            value={entrySection}
                                            onChange={e => {
                                                setEntrySection(e.target.value);
                                                setEntryStudent(null);
                                                setEntryData({});
                                            }}
                                        >
                                            <option value="">All Sections</option>
                                            {Array.from(new Set(students.filter(s => s.class === entryClass && s.section).map(s => s.section))).sort().map(sec => (
                                                <option key={String(sec)} value={String(sec)}>Section {sec}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Student Dropdown */}
                            {entryClass && (() => {
                                const entryStudentList = students
                                    .filter(s => s.class === entryClass && (entrySection ? s.section === entrySection : true))
                                    .sort((a, b) => (parseInt(a.classRollNo) || 0) - (parseInt(b.classRollNo) || 0));
                                return entryStudentList.length > 0 ? (
                                    <div className="input-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                                        <label className="field-label">SELECT STUDENT</label>
                                        <select
                                            className="input-field"
                                            value={entryStudent?.uid || entryStudent?.id || ''}
                                            onChange={async (e) => {
                                                const stu = entryStudentList.find(s => (s.uid || s.id) === e.target.value);
                                                if (!stu) { setEntryStudent(null); setEntryData({}); return; }
                                                setEntryStudent(stu);
                                                setEntryEditMode(false);
                                                try {
                                                    const entryRef = doc(db, 'attendance_manual_entry', `${currentSchool?.id}_${activeFY}_${stu.admissionNo || stu.uid}`);
                                                    const snap = await getDoc(entryRef);
                                                    if (snap.exists()) {
                                                        setEntryData(snap.data().presentDays || {});
                                                        setEntryEditMode(false);
                                                    } else {
                                                        setEntryData({});
                                                        setEntryEditMode(true);
                                                    }
                                                } catch {
                                                    setEntryData({});
                                                    setEntryEditMode(true);
                                                }
                                            }}
                                            style={{ fontSize: '0.9375rem', fontWeight: 600 }}
                                        >
                                            <option value="">-- Choose Student --</option>
                                            {entryStudentList.map(stu => (
                                                <option key={stu.uid || stu.id} value={stu.uid || stu.id}>
                                                    {stu.classRollNo ? `#${stu.classRollNo} ` : ''}{stu.fullName} ({stu.admissionNo})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ) : <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>No students found for selected class.</p>;
                            })()}
                        </div>

                        {/* Month-wise Present Days Entry */}
                        {entryStudent && (
                            <div className="glass-card" style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontWeight: 700 }}>
                                            {entryStudent.fullName}
                                            <span style={{ marginLeft: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                                {entryStudent.class}{entryStudent.section ? ` - ${entryStudent.section}` : ''} | {entryStudent.admissionNo}
                                            </span>
                                        </h3>
                                        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                            Enter number of present days for each month (Apr – Mar)
                                        </p>
                                    </div>
                                    {!entryEditMode && (
                                        <button
                                            className="btn"
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                                            onClick={() => setEntryEditMode(true)}
                                        >
                                            <Edit size={14} /> Edit
                                        </button>
                                    )}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                                    {ACADEMIC_MONTHS.map(month => (
                                        <div key={month} style={{
                                            background: 'rgba(248, 250, 252, 0.8)',
                                            border: '1px solid var(--border)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: '0.875rem',
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>{month}</span>
                                                {workingDays[month] && (
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>/ {workingDays[month]} days</span>
                                                )}
                                            </div>
                                            {entryEditMode ? (
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    style={{ marginBottom: 0, padding: '0.5rem 0.75rem', fontSize: '1rem', fontWeight: 700 }}
                                                    placeholder="0"
                                                    min={0}
                                                    max={workingDays[month] ? parseInt(workingDays[month]) : 31}
                                                    value={entryData[month] || ''}
                                                    onChange={e => setEntryData(prev => ({ ...prev, [month]: e.target.value }))}
                                                />
                                            ) : (
                                                <div style={{
                                                    fontSize: '1.5rem', fontWeight: 800,
                                                    color: entryData[month] ? 'var(--primary)' : 'var(--text-muted)'
                                                }}>
                                                    {entryData[month] || '—'}
                                                </div>
                                            )}
                                            {/* Percentage bar */}
                                            {workingDays[month] && entryData[month] && (
                                                <div style={{ marginTop: '0.5rem' }}>
                                                    <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '2px' }}>
                                                        <div style={{
                                                            width: `${Math.min(100, (parseInt(entryData[month]) / parseInt(workingDays[month])) * 100)}%`,
                                                            height: '100%',
                                                            background: (parseInt(entryData[month]) / parseInt(workingDays[month])) >= 0.75 ? '#10b981' : '#f43f5e',
                                                            borderRadius: '2px'
                                                        }} />
                                                    </div>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                        {((parseInt(entryData[month]) / parseInt(workingDays[month])) * 100).toFixed(0)}%
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {entryEditMode && (
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                                        <button
                                            className="btn"
                                            onClick={() => {
                                                setEntryEditMode(false);
                                                // reload
                                                const reload = async () => {
                                                    const entryRef = doc(db, 'attendance_manual_entry', `${currentSchool?.id}_${activeFY}_${entryStudent.admissionNo || entryStudent.uid}`);
                                                    const snap = await getDoc(entryRef);
                                                    if (snap.exists()) setEntryData(snap.data().presentDays || {});
                                                };
                                                reload();
                                            }}
                                        >Cancel</button>
                                        <button
                                            className="btn btn-primary"
                                            disabled={savingEntry}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                            onClick={async () => {
                                                setSavingEntry(true);
                                                try {
                                                    const entryRef = doc(db, 'attendance_manual_entry', `${currentSchool?.id}_${activeFY}_${entryStudent.admissionNo || entryStudent.uid}`);
                                                    await setDoc(entryRef, {
                                                        schoolId: currentSchool?.id,
                                                        financialYear: activeFY,
                                                        studentId: entryStudent.uid || entryStudent.id,
                                                        admissionNo: entryStudent.admissionNo,
                                                        studentName: entryStudent.fullName,
                                                        class: entryStudent.class,
                                                        section: entryStudent.section || '',
                                                        presentDays: entryData,
                                                        updatedAt: serverTimestamp()
                                                    }, { merge: true });
                                                    setEntryEditMode(false);
                                                    alert('Attendance entry saved!');
                                                } catch (e: any) {
                                                    alert('Error: ' + e.message);
                                                } finally {
                                                    setSavingEntry(false);
                                                }
                                            }}
                                        >
                                            <Save size={14} /> {savingEntry ? 'Saving...' : 'Save Entry'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ===================== SHOW ATTENDANCE TAB ===================== */}
                {activeTab === 'show' && (
                    <div style={{ gridColumn: '1 / -1' }}>
                        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label className="field-label">SELECT CLASS</label>
                                    <select
                                        className="input-field"
                                        value={showClass}
                                        onChange={e => {
                                            setShowClass(e.target.value);
                                            setShowSection('');
                                        }}
                                    >
                                        <option value="">-- Choose Class --</option>
                                        {classesList.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                {showClass && (
                                    <div className="input-group" style={{ marginBottom: 0 }}>
                                        <label className="field-label">SELECT SECTION</label>
                                        <select
                                            className="input-field"
                                            value={showSection}
                                            onChange={e => setShowSection(e.target.value)}
                                        >
                                            <option value="">All Sections</option>
                                            {Array.from(new Set(students.filter(s => s.class === showClass && s.section).map(s => s.section))).sort().map(sec => (
                                                <option key={String(sec)} value={String(sec)}>Section {sec}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        {showClass && (
                            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                                {showLoading ? (
                                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading attendance data...</div>
                                ) : showStudentsList.length === 0 ? (
                                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No students found in this class/section.</div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                                            <thead>
                                                <tr style={{ background: 'rgba(248, 250, 252, 0.5)', borderBottom: '1px solid var(--border)' }}>
                                                    <th style={{ padding: '1.25rem 1rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', minWidth: '200px', position: 'sticky', left: 0, background: 'rgba(248, 250, 252, 0.95)', zIndex: 10 }}>Student Name</th>
                                                    {ACADEMIC_MONTHS.map(month => (
                                                        <th key={month} style={{ padding: '1.25rem 1rem', textAlign: 'center', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                                            {month} <br />
                                                            <span style={{ fontSize: '0.65rem' }}>({showWorkingDays[month] || 0} days)</span>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {showStudentsList.map((student, idx) => {
                                                    const studentRecord = showData.find(r => r.studentId === student.uid || r.studentId === student.id);
                                                    const presentDays = studentRecord?.presentDays || {};
                                                    return (
                                                        <tr key={student.uid || student.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                            <td style={{ padding: '1rem', position: 'sticky', left: 0, background: 'white', zIndex: 5, borderRight: '1px solid var(--border)' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '2rem' }}>{idx + 1}.</span>
                                                                    <div>
                                                                        <div style={{ fontWeight: 700 }}>{student.fullName}</div>
                                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Roll: {student.classRollNo} • {student.admissionNo}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            {ACADEMIC_MONTHS.map(month => (
                                                                <td key={month} style={{ padding: '1rem', textAlign: 'center', fontWeight: 600, color: presentDays[month] ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                                                    {presentDays[month] || '-'}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div >
    );
};

export default AttendanceManagement;
