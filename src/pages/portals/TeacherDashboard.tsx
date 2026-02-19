import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    BookOpen,
    UserCheck,
    CheckCircle,
    Calendar,
    Clock,
    MessageSquare,
    Users,
    LayoutDashboard,
    User,
    Loader2,
    FileText
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSchool } from '../../context/SchoolContext';
import TeacherChat from '../../components/portals/TeacherChat';
import UserProfile from '../settings/UserProfile';
import RoutineManager from '../../components/RoutineManager';
import TeacherPersonalAttendance from '../../components/TeacherPersonalAttendance';
import PersonalAttendanceChart from '../../components/PersonalAttendanceChart';
import AddTeachingLog from '../../components/teaching/AddTeachingLog';
import MyTeachingLogs from '../../components/teaching/MyTeachingLogs';
import { CountUpAnimation } from '../../components/CountUpAnimation';
import AcademicCalendar from '../Calendar';
import EnhancedExamScheduling from '../exams/EnhancedExamScheduling';
import AdvancedMarksEntry from '../exams/AdvancedMarksEntry';

/**
 * Teacher Dashboard Portal
 * Handles Dashboard, Messages, and Profile tabs for teachers.
 */
export default function TeacherDashboard() {
    const { user } = useAuth();
    const { currentSchool } = useSchool();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'ATTENDANCE' | 'ROUTINE' | 'ADD_TEACHING_LOG' | 'MY_TEACHING_LOGS' | 'EXAM_SCHEDULING' | 'MARKS_ENTRY' | 'MESSAGES' | 'PROFILE'>('DASHBOARD');

    // Sync tab with URL params
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['DASHBOARD', 'ATTENDANCE', 'ROUTINE', 'ADD_TEACHING_LOG', 'MY_TEACHING_LOGS', 'EXAM_SCHEDULING', 'MARKS_ENTRY', 'MESSAGES', 'PROFILE'].includes(tab)) {
            setActiveTab(tab as any);
        }
    }, [searchParams]);
    const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
    const [myClasses, setMyClasses] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [attendanceStats, setAttendanceStats] = useState({ present: 0, late: 0, absent: 0 });
    const [avgAttendance, setAvgAttendance] = useState<number>(0);
    const [pendingGrading, setPendingGrading] = useState<number>(0);
    const [statsLoading, setStatsLoading] = useState(true);

    useEffect(() => {
        const fetchTeacherRoutine = async () => {
            if (!currentSchool?.id || !user?.name) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const routineRef = doc(db, 'settings', `school_routine_${currentSchool.id}`);
                const routineSnap = await getDoc(routineRef);

                if (routineSnap.exists()) {
                    const routines = routineSnap.data().routines || [];
                    const teacherName = user.name || user.username;
                    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    const todayIndex = new Date().getDay();
                    const todayName = days[todayIndex];

                    const todayClasses: any[] = [];
                    const classesSet = new Set<string>();

                    routines.forEach((r: any) => {
                        // Check today's schedule
                        const daySchedule = r.schedule[todayName] || [];
                        daySchedule.forEach((p: any) => {
                            if (p.teacher && p.teacher.trim() === teacherName.trim()) {
                                todayClasses.push({
                                    time: p.startTime,
                                    endTime: p.endTime,
                                    subject: p.subject,
                                    class: r.className,
                                    color: p.type === 'lunch' || p.type === 'break' ? '#94a3b8' : '#6366f1'
                                });
                                classesSet.add(r.className);
                            }
                        });

                        // All classes this teacher is involved in (any day)
                        Object.values(r.schedule).forEach((dayArr: any) => {
                            dayArr.forEach((p: any) => {
                                if (p.teacher && p.teacher.trim() === teacherName.trim()) {
                                    classesSet.add(r.className);
                                }
                            });
                        });
                    });

                    // Sort today's classes by time
                    setTodaySchedule(todayClasses.sort((a, b) => (a.time || '').localeCompare(b.time || '')));
                    setMyClasses(Array.from(classesSet));
                }
            } catch (e) {
                console.error('Error fetching teacher routine:', e);
            } finally {
                setLoading(false);
            }
        };

        fetchTeacherRoutine();
    }, [currentSchool?.id, user?.name]);

    // Fetch dashboard stats (Avg Attendance & Pending Grading)
    useEffect(() => {
        const fetchDashboardStats = async () => {
            if (!currentSchool?.id || !user?.id) {
                setStatsLoading(false);
                return;
            }

            setStatsLoading(true);
            try {
                const { collection, query, where, getDocs } = await import('firebase/firestore');

                // 1. Calculate Avg Attendance (Last 30 days)
                // If routine is missing, we try to use classes from homework as a fallback
                let effectiveClasses = [...myClasses];

                const attendanceRef = collection(db, 'attendance');
                const attendanceQuery = query(
                    attendanceRef,
                    where('schoolId', '==', currentSchool.id),
                    where('date', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
                );

                const attSnap = await getDocs(attendanceQuery);
                let totalPresent = 0;
                let totalRecords = 0;

                // 2. Calculate Pending Grading
                const homeworkRef = collection(db, 'homework');
                const homeworkQuery = query(
                    homeworkRef,
                    where('schoolId', '==', currentSchool.id),
                    where('teacherId', '==', user.id)
                );

                const hwSnap = await getDocs(homeworkQuery);
                const homeworks = hwSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // If myClasses is empty, try to populate it from homework classes
                if (effectiveClasses.length === 0 && homeworks.length > 0) {
                    const hwClasses = new Set<string>();
                    homeworks.forEach((h: any) => h.class && hwClasses.add(h.class));
                    effectiveClasses = Array.from(hwClasses);
                }

                // Process Attendance Stats
                attSnap.docs.forEach(doc => {
                    const data = doc.data();
                    if (effectiveClasses.includes(data.class)) {
                        totalRecords++;
                        if (data.status === 'PRESENT' || data.status === 'LATE') totalPresent++;
                    }
                });

                setAvgAttendance(totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0);

                // Process Pending Grading
                if (homeworks.length === 0) {
                    setPendingGrading(0);
                } else {
                    // Fetch ALL students for the school once - filter in memory to avoid complex indices
                    const studentsRef = collection(db, 'students');
                    const studentsQuery = query(studentsRef, where('schoolId', '==', currentSchool.id));
                    const studentsSnap = await getDocs(studentsQuery);

                    const studentsByClass: Record<string, number> = {};
                    studentsSnap.docs.forEach(doc => {
                        const s = doc.data();
                        if (s.status !== 'INACTIVE') {
                            studentsByClass[s.class] = (studentsByClass[s.class] || 0) + 1;
                        }
                    });

                    // Fetch ALL submissions for these homeworks
                    const subsRef = collection(db, 'homeworkSubmissions');
                    // We'll fetch all and filter to avoid multiple small queries
                    // Actually, if there are many homeworks, we should be careful. 
                    // But for a single teacher, it should be manageable.
                    const subsSnap = await getDocs(query(subsRef, where('schoolId', '==', currentSchool.id)));
                    const subsByHw: Record<string, number> = {};
                    subsSnap.docs.forEach(d => {
                        const data = d.data();
                        subsByHw[data.homeworkId] = (subsByHw[data.homeworkId] || 0) + 1;
                    });

                    let totalPending = 0;
                    homeworks.forEach((hw: any) => {
                        const classSize = studentsByClass[hw.class] || 0;
                        const markedCount = subsByHw[hw.id] || 0;
                        const pending = Math.max(0, classSize - markedCount);
                        totalPending += pending;
                    });

                    setPendingGrading(totalPending);
                }
            } catch (error) {
                console.error('❌ TeacherDashboard Stats Error:', error);
            } finally {
                setStatsLoading(false);
            }
        };

        fetchDashboardStats();
    }, [currentSchool?.id, user?.id, myClasses]);

    // Fetch attendance stats for chart
    useEffect(() => {
        const fetchAttendanceStats = async () => {
            if (!currentSchool?.id || !user?.id) return;

            try {
                const { collection, query, where, getDocs } = await import('firebase/firestore');

                // Get current month date range
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

                const startDateStr = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-${String(startOfMonth.getDate()).padStart(2, '0')}`;
                const endDateStr = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

                const attendanceRef = collection(db, 'teacherAttendance');
                const q = query(
                    attendanceRef,
                    where('teacherId', '==', user.id),
                    where('date', '>=', startDateStr),
                    where('date', '<=', endDateStr)
                );

                const snapshot = await getDocs(q);
                let present = 0, late = 0, absent = 0;

                snapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.status === 'PRESENT') present++;
                    else if (data.status === 'LATE') late++;
                    else if (data.status === 'ABSENT') absent++;
                });

                setAttendanceStats({ present, late, absent });
            } catch (error) {
                console.error('Error fetching attendance stats:', error);
            }
        };

        fetchAttendanceStats();
    }, [currentSchool?.id, user?.id]);

    return (
        <div className="animate-fade-in no-scrollbar">
            {/* Tab Header */}
            {/* Tab Header - Responsive Scrollable */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '2rem',
                background: '#f1f5f9',
                padding: '0.4rem',
                borderRadius: '1rem',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                msOverflowStyle: 'none',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch'
            }} className="no-scrollbar">
                <button
                    onClick={() => setActiveTab('DASHBOARD')}
                    className={`nav-tab-btn ${activeTab === 'DASHBOARD' ? 'active' : ''}`}
                    style={{ flexShrink: 0, padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700, transition: 'all 0.3s' }}
                >
                    <LayoutDashboard size={18} /> Dashboard
                </button>
                <button
                    onClick={() => setActiveTab('ATTENDANCE')}
                    className={`nav-tab-btn ${activeTab === 'ATTENDANCE' ? 'active' : ''}`}
                    style={{ flexShrink: 0, padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700, transition: 'all 0.3s' }}
                >
                    <UserCheck size={18} /> Attendance
                </button>
                <button
                    onClick={() => setActiveTab('ROUTINE')}
                    className={`nav-tab-btn ${activeTab === 'ROUTINE' ? 'active' : ''}`}
                    style={{ flexShrink: 0, padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700, transition: 'all 0.3s' }}
                >
                    <Clock size={18} /> Routine
                </button>

                <button
                    onClick={() => setActiveTab('ADD_TEACHING_LOG')}
                    className={`nav-tab-btn ${activeTab === 'ADD_TEACHING_LOG' ? 'active' : ''}`}
                    style={{ flexShrink: 0, padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700, transition: 'all 0.3s' }}
                >
                    <BookOpen size={18} /> Class Work
                </button>
                <button
                    onClick={() => setActiveTab('MY_TEACHING_LOGS')}
                    className={`nav-tab-btn ${activeTab === 'MY_TEACHING_LOGS' ? 'active' : ''}`}
                    style={{ flexShrink: 0, padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700, transition: 'all 0.3s' }}
                >
                    <FileText size={18} /> My Logs
                </button>

                <button
                    onClick={() => setActiveTab('EXAM_SCHEDULING')}
                    className={`nav-tab-btn ${activeTab === 'EXAM_SCHEDULING' ? 'active' : ''}`}
                    style={{ flexShrink: 0, padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700, transition: 'all 0.3s' }}
                >
                    <Calendar size={18} /> Exam Schedule
                </button>

                <button
                    onClick={() => setActiveTab('MARKS_ENTRY')}
                    className={`nav-tab-btn ${activeTab === 'MARKS_ENTRY' ? 'active' : ''}`}
                    style={{ flexShrink: 0, padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700, transition: 'all 0.3s' }}
                >
                    <CheckCircle size={18} /> Marks Entry
                </button>
                <button
                    onClick={() => setActiveTab('MESSAGES')}
                    className={`nav-tab-btn ${activeTab === 'MESSAGES' ? 'active' : ''}`}
                    style={{ flexShrink: 0, padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700, transition: 'all 0.3s' }}
                >
                    <MessageSquare size={18} /> Messages
                </button>
                <button
                    onClick={() => setActiveTab('PROFILE')}
                    className={`nav-tab-btn ${activeTab === 'PROFILE' ? 'active' : ''}`}
                    style={{ flexShrink: 0, padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700, transition: 'all 0.3s' }}
                >
                    <User size={18} /> Profile
                </button>
            </div>

            {activeTab === 'DASHBOARD' ? (
                <>
                    <div style={{ marginBottom: '2rem' }}>
                        <h1 style={{ fontSize: '1.875rem', fontWeight: 900, marginBottom: '0.5rem' }}>
                            {(() => {
                                const hr = new Date().getHours();
                                if (hr < 12) return 'Good Morning';
                                if (hr < 17) return 'Good Afternoon';
                                return 'Good Evening';
                            })()}, {(user as any)?.name || user?.username || 'Teacher'}! 👋
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Here's what's happening in your classes today.</p>
                    </div>

                    <div className="responsive-grid-auto" style={{ gap: '1.5rem', marginBottom: '2.5rem' }}>
                        <div className="glass-card hover-lift" style={{ padding: '1.5rem', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.75rem', borderRadius: '0.75rem', color: 'var(--primary)' }}>
                                    <BookOpen size={24} />
                                </div>
                            </div>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 900 }}><CountUpAnimation end={todaySchedule.length} /></h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Classes Today</p>
                        </div>
                        <div className="glass-card hover-lift" style={{ padding: '1.5rem', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '0.75rem', color: '#10b981' }}>
                                    <UserCheck size={24} />
                                </div>
                            </div>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 900 }}>
                                {statsLoading ? <Loader2 size={24} className="animate-spin" /> : <CountUpAnimation end={avgAttendance} suffix="%" />}
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Avg. Attendance</p>
                        </div>
                        <div className="glass-card hover-lift" style={{ padding: '1.5rem', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '0.75rem', borderRadius: '0.75rem', color: '#f59e0b' }}>
                                    <CheckCircle size={24} />
                                </div>
                            </div>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 900 }}>
                                {statsLoading ? <Loader2 size={24} className="animate-spin" /> : <CountUpAnimation end={pendingGrading} />}
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Pending Grading</p>
                        </div>
                    </div>

                    {/* Personal Attendance Chart */}
                    {(attendanceStats.present + attendanceStats.late + attendanceStats.absent) > 0 && (
                        <div style={{ marginBottom: '2.5rem' }}>
                            <PersonalAttendanceChart
                                present={attendanceStats.present}
                                late={attendanceStats.late}
                                absent={attendanceStats.absent}
                            />
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                        <div className="glass-card" style={{ padding: '2rem' }}>
                            <h3 style={{ fontWeight: 800, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Calendar size={20} color=" var(--primary)" /> Today's Schedule
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {loading ? (
                                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                                        <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--primary)' }} />
                                    </div>
                                ) : todaySchedule.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                        No classes scheduled for today.
                                    </div>
                                ) : (
                                    todaySchedule.map((item, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.25rem', background: '#f8fafc', borderRadius: '1.25rem', border: '1px solid #f1f5f9' }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: item.color, width: '75px' }}>{item.time}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>{item.subject}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginTop: '0.2rem' }}>{item.class}</div>
                                            </div>
                                            <button className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', borderRadius: '0.75rem' }}>Attendance</button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="glass-card" style={{ padding: '2rem' }}>
                            <h3 style={{ fontWeight: 800, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Users size={20} color="var(--primary)" /> My Classes
                            </h3>
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                {loading ? (
                                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                                        <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--primary)' }} />
                                    </div>
                                ) : myClasses.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                        No classes assigned.
                                    </div>
                                ) : (
                                    myClasses.map((cls, i) => (
                                        <div key={i} style={{ padding: '1rem', border: '1px solid #f1f5f9', borderRadius: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 700 }}>{cls}</span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Assigned</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </>
            ) : activeTab === 'ATTENDANCE' ? (
                <div className="animate-slide-up">
                    <div style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>My Attendance</h2>
                        <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>View your personal attendance records and statistics.</p>
                    </div>
                    <TeacherPersonalAttendance />
                </div>
            ) : activeTab === 'MESSAGES' ? (
                <div className="animate-slide-up">
                    <div style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Communication Portal</h2>
                        <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Chat with parents and students about academic progress.</p>
                    </div>
                    <TeacherChat />
                </div>
            ) : activeTab === 'ROUTINE' ? (
                <div className="animate-slide-up">
                    <div style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Your Weekly Timetable</h2>
                        <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>See your full schedule for the week.</p>
                    </div>
                    <RoutineManager isReadOnly={true} fixedTeacherName={user?.name || user?.username || ''} />
                </div>
            ) : activeTab === 'ADD_TEACHING_LOG' ? (
                <div className="animate-slide-up">
                    <AddTeachingLog />
                </div>
            ) : activeTab === 'MY_TEACHING_LOGS' ? (
                <div className="animate-slide-up">
                    <MyTeachingLogs />
                </div>
            ) : activeTab === 'EXAM_SCHEDULING' ? (
                <div className="animate-slide-up">
                    <EnhancedExamScheduling />
                </div>
            ) : activeTab === 'MARKS_ENTRY' ? (
                <div className="animate-slide-up">
                    <AdvancedMarksEntry />
                </div>
            ) : (
                <div className="animate-slide-up">
                    <UserProfile />
                </div>
            )}
            <style>{`
                .nav-tab-btn { background: transparent; color: #64748b; }
                .nav-tab-btn.active { background: white; color: var(--primary); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            `}</style>
        </div>
    );
}
