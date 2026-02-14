import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    CreditCard,
    TrendingUp,
    Calendar,
    UserPlus,
    Bell,
    Image,
    GraduationCap,
    FileText
} from 'lucide-react';
import TeacherDashboard from './portals/TeacherDashboard';
import ParentDashboard from './portals/ParentDashboard';
import DriverDashboard from './portals/DriverDashboard';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useSchool } from '../context/SchoolContext';
import { useFirestore } from '../hooks/useFirestore';





const CountUp: React.FC<{ value: number, prefix?: string, suffix?: string, decimals?: number }> = ({ value, prefix = '', suffix = '', decimals = 0 }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        let startTimestamp: number | null = null;
        const duration = 1500; // 1.5 seconds
        const startValue = displayValue;

        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const current = progress * (value - startValue) + startValue;
            setDisplayValue(current);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };

        window.requestAnimationFrame(step);
    }, [value]);

    return (
        <span>
            {prefix}{displayValue.toLocaleString('en-IN', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            })}{suffix}
        </span>
    );
};


const AdminDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { currentSchool, loading: schoolLoading, updateSchoolData } = useSchool();
    const filterSchoolId = currentSchool?.id;
    const { data: academicYears, update: updateAcademicYear } = useFirestore<any>('academic_years');

    if (schoolLoading || !filterSchoolId) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
                <div style={{ display: 'inline-block', width: '40px', height: '40px', border: '4px solid var(--border)', borderTop: '4px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading dashboard...</p>
            </div>
        );
    }

    const { user } = useAuth();

    const [todayCollection, setTodayCollection] = useState(0);
    const [monthlyCollection, setMonthlyCollection] = useState(0);
    const [monthlyAdmissions, setMonthlyAdmissions] = useState(0);
    const [totalStudents, setTotalStudents] = useState(0);
    const [attendanceRate, setAttendanceRate] = useState(0);
    const [teacherAttendanceRate, setTeacherAttendanceRate] = useState(0);
    const [hostelCount, setHostelCount] = useState(0);
    const [transportCount, setTransportCount] = useState(0);
    const [girlsCount, setGirlsCount] = useState(0);
    const [boysCount, setBoysCount] = useState(0);
    const [totalHomework, setTotalHomework] = useState(0);
    const [switchingYear, setSwitchingYear] = useState(false);

    // Academic years for this school
    const schoolYears = (academicYears || []).filter((y: any) => y.schoolId === filterSchoolId && !y.isArchived).sort((a: any, b: any) => a.name.localeCompare(b.name));
    const activeFY = currentSchool?.activeFinancialYear || '';

    const handleSwitchYear = async (yearId: string, yearName: string) => {
        if (yearName === activeFY || switchingYear) return;
        setSwitchingYear(true);
        try {
            // Update isActive flags
            for (const year of schoolYears) {
                if (year.id === yearId) {
                    await updateAcademicYear(year.id, { isActive: true, updatedAt: new Date().toISOString() });
                } else if (year.isActive) {
                    await updateAcademicYear(year.id, { isActive: false, updatedAt: new Date().toISOString() });
                }
            }
            // Sync to school document
            if (updateSchoolData) {
                await updateSchoolData({ activeFinancialYear: yearName });
            }
        } catch (error) {
            console.error('Error switching year:', error);
            alert('Failed to switch academic year');
        } finally {
            setSwitchingYear(false);
        }
    };

    // Quick Access Items with icons
    const allQuickAccessItems = [
        { id: 1, title: 'New Admission', icon: UserPlus, color: 'var(--gradient-purple)', route: `/${filterSchoolId}/students/admission`, moduleId: 'students' },
        { id: 2, title: 'Pay Fee', icon: CreditCard, color: 'var(--gradient-cyan)', route: `/${filterSchoolId}/fees`, moduleId: 'fees' },
        { id: 3, title: 'Student Ledger', icon: Users, color: 'var(--gradient-orange)', route: `/${filterSchoolId}/students`, moduleId: 'students' },
        { id: 4, title: 'Collection Report', icon: TrendingUp, color: 'var(--gradient-pink)', route: `/${filterSchoolId}/fees/report`, moduleId: 'fees' },
        { id: 5, title: 'Homework Report', icon: FileText, color: 'var(--gradient-blue)', route: `/${filterSchoolId}/homework/report`, moduleId: 'homework' },
        { id: 6, title: 'Transport Area', icon: Bell, color: 'var(--gradient-orange)', route: `/${filterSchoolId}/transport`, moduleId: 'transport' },
    ];

    // Filter based on school entitlement
    const quickAccessItems = allQuickAccessItems.filter(item => {
        if (!currentSchool) return true;
        if (!currentSchool.allowedModules) return true;
        return currentSchool.allowedModules.includes(item.moduleId);
    });

    // Fetch dashboard data in real-time
    useEffect(() => {
        if (!filterSchoolId) {
            // Reset all states if no school context
            setTodayCollection(0);
            setMonthlyCollection(0);
            setMonthlyAdmissions(0);
            setTotalStudents(0);
            setAttendanceRate(0);
            setTeacherAttendanceRate(0);
            setHostelCount(0);
            setTransportCount(0);
            setGirlsCount(0);
            setBoysCount(0);
            return;
        }

        // Get today's date range - using local timezone
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

        // Debug logging
        console.log('=== DASHBOARD DATE RANGES ===');
        console.log('Current Time:', now.toISOString(), '|', now.toString());
        console.log('Start of Day:', startOfDay.toISOString(), '|', startOfDay.toString());
        console.log('End of Day:', endOfDay.toISOString(), '|', endOfDay.toString());
        console.log('Start of Month:', startOfMonth.toISOString(), '|', startOfMonth.toString());
        console.log('School ID:', filterSchoolId);
        console.log('============================');

        // Real-time listener for today's fee collections
        const feesQuery = query(
            collection(db, 'fee_collections'),
            where('schoolId', '==', filterSchoolId || 'NONE'),
            where('financialYear', '==', activeFY),
            where('date', '>=', Timestamp.fromDate(startOfDay)),
            where('date', '<=', Timestamp.fromDate(endOfDay))
        );
        const unsubscribeFees = onSnapshot(feesQuery, (snapshot) => {
            const total = snapshot.docs.reduce((sum, doc) => {
                const val = doc.data().paid;
                return sum + (Number(val) || 0);
            }, 0);
            console.log(`💰 Today's Collection: ₹${total} (${snapshot.docs.length} records)`);
            setTodayCollection(total);
        }, (err) => {
            console.error('❌ Fees index error:', err);
            setTodayCollection(0);
        });

        // Real-time listener for monthly fee collections
        const monthlyFeesQuery = query(
            collection(db, 'fee_collections'),
            where('schoolId', '==', filterSchoolId || 'NONE'),
            where('financialYear', '==', activeFY),
            where('date', '>=', Timestamp.fromDate(startOfMonth)),
            where('date', '<=', Timestamp.fromDate(endOfDay))
        );
        const unsubscribeMonthlyFees = onSnapshot(monthlyFeesQuery, (snapshot) => {
            const total = snapshot.docs.reduce((sum, doc) => {
                const val = doc.data().paid;
                return sum + (Number(val) || 0);
            }, 0);
            console.log(`💰 Monthly Collection: ₹${total} (${snapshot.docs.length} records)`);
            setMonthlyCollection(total);
        }, (err) => {
            console.error('❌ Monthly fees error:', err);
            setMonthlyCollection(0);
        });

        // Real-time listener for monthly admissions (createdAt is stored as ISO string)
        const admissionsQuery = query(
            collection(db, 'students'),
            where('schoolId', '==', filterSchoolId || 'NONE'),
            where('session', '==', activeFY)
        );
        const unsubscribeAdmissions = onSnapshot(admissionsQuery, (snapshot) => {
            // Filter students created this month (createdAt is ISO string)
            const thisMonthStudents = snapshot.docs.filter(doc => {
                const data = doc.data();
                if (data.createdAt) {
                    const created = new Date(data.createdAt);
                    return created >= startOfMonth && created <= endOfDay;
                }
                return false;
            });

            console.log(`📊 Monthly Admissions: ${thisMonthStudents.length}/${snapshot.size} students`);
            setMonthlyAdmissions(thisMonthStudents.length);
        }, (err) => {
            console.error('❌ Admissions query error:', err);
            setMonthlyAdmissions(0);
        });

        // Real-time listener for total students and categories
        const studentsQuery = query(
            collection(db, 'students'),
            where('schoolId', '==', filterSchoolId || 'NONE'),
            where('session', '==', activeFY)
        );
        const unsubscribeTotalStudents = onSnapshot(studentsQuery, (snapshot) => {
            setTotalStudents(snapshot.size);

            let hostel = 0;
            let transport = 0;
            let girls = 0;
            let boys = 0;

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.studentCategory === 'HOSTELER') hostel++;
                if (data.studentCategory === 'TRANSPORT') transport++;
                if (data.gender === 'Female') girls++;
                if (data.gender === 'Male') boys++;
            });

            setHostelCount(hostel);
            setTransportCount(transport);
            setGirlsCount(girls);
            setBoysCount(boys);
        }, (err) => {
            console.error('Students index missing? Link in console.', err);
            setTotalStudents(0);
        });

        // Real-time listener for today's attendance (date is stored as string YYYY-MM-DD)
        const todayDateString = now.toISOString().split('T')[0]; // "2026-01-23"
        const attendanceQuery = query(
            collection(db, 'attendance'),
            where('schoolId', '==', filterSchoolId || 'NONE'),
            where('date', '==', todayDateString)
        );
        const unsubscribeAttendance = onSnapshot(attendanceQuery, (snapshot) => {
            let totalPresent = 0;
            let totalRecords = 0;
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.status === 'PRESENT') totalPresent++;
                totalRecords++;
            });
            const rate = totalRecords > 0 ? (totalPresent / totalRecords) * 100 : 0;
            console.log(`👨‍🎓 Student Attendance: ${rate.toFixed(1)}% (${totalPresent}/${totalRecords})`);
            setAttendanceRate(rate);
        }, (err) => {
            console.error('❌ Student attendance error:', err);
            setAttendanceRate(0);
        });

        // Real-time listener for today's teacher attendance (date is stored as string YYYY-MM-DD)
        const teacherAttendanceQuery = query(
            collection(db, 'teacherAttendance'),
            where('schoolId', '==', filterSchoolId || 'NONE'),
            where('date', '==', todayDateString)
        );
        const unsubscribeTeacherAttendance = onSnapshot(teacherAttendanceQuery, (snapshot) => {
            let totalPresent = 0;
            let totalRecords = 0;
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.status === 'PRESENT') totalPresent++;
                totalRecords++;
            });
            const rate = totalRecords > 0 ? (totalPresent / totalRecords) * 100 : 0;
            console.log(`👨‍🏫 Teacher Attendance: ${rate.toFixed(1)}% (${totalPresent}/${totalRecords})`);
            setTeacherAttendanceRate(rate);
        }, (err) => {
            console.error('❌ Teacher attendance error:', err);
            setTeacherAttendanceRate(0);
        });

        // Real-time listener for total homework assigned this month
        const homeworkQuery = query(
            collection(db, 'homework'),
            where('schoolId', '==', filterSchoolId || 'NONE'),
            where('session', '==', activeFY)
        );
        const unsubscribeHomework = onSnapshot(homeworkQuery, (snapshot) => {
            const thisMonthHomework = snapshot.docs.filter(doc => {
                const data = doc.data();
                const assigned = new Date(data.assignedDate || data.createdAt);
                return assigned >= startOfMonth && assigned <= endOfDay;
            });
            setTotalHomework(thisMonthHomework.length);
        });

        return () => {
            unsubscribeFees();
            unsubscribeMonthlyFees();
            unsubscribeAdmissions();
            unsubscribeTotalStudents();
            unsubscribeAttendance();
            unsubscribeTeacherAttendance();
            unsubscribeHomework();
        };
    }, [filterSchoolId, activeFY]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    return (
        <div className="animate-fade-in no-scrollbar" style={{ paddingBottom: '2rem' }}>
            {/* Modern Welcome Banner */}
            <div className="animate-slide-up" style={{
                marginBottom: '1rem',
                padding: '0.5rem 0'
            }}>
                <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {getGreeting()}, {(user as any)?.name || 'Admin'}! 👋
                </h2>
            </div>

            {/* Academic Year Switcher Chips */}
            {schoolYears.length > 0 && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '1.5rem',
                    flexWrap: 'wrap'
                }}>
                    <Calendar size={16} style={{ color: '#6366f1', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>Session:</span>
                    {schoolYears.map((yr: any) => (
                        <button
                            key={yr.id}
                            onClick={() => handleSwitchYear(yr.id, yr.name)}
                            disabled={switchingYear}
                            style={{
                                padding: '0.375rem 0.875rem',
                                borderRadius: '20px',
                                border: yr.name === activeFY ? '2px solid #6366f1' : '1.5px solid var(--border)',
                                background: yr.name === activeFY ? '#6366f1' : 'white',
                                color: yr.name === activeFY ? 'white' : 'var(--text-main)',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                cursor: switchingYear ? 'wait' : 'pointer',
                                transition: 'all 0.2s',
                                opacity: switchingYear && yr.name !== activeFY ? 0.6 : 1,
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {yr.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Statistics Cards - Reordered as requested */}
            <div className="responsive-grid-auto" style={{ marginBottom: '2.5rem' }}>
                {/* 1. Today's Collection */}
                <div className="glass-card hover-lift animate-slide-up" style={{
                    padding: '1.5rem',
                    animationDelay: '0.1s',
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(251, 191, 36, 0.03))',
                    border: '1px solid rgba(245, 158, 11, 0.15)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Today's Collection</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b' }}>
                                <CountUp value={todayCollection} prefix="₹" />
                            </h3>
                        </div>
                        <div className="icon-float" style={{
                            width: '52px',
                            height: '52px',
                            background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                            borderRadius: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 16px rgba(245, 158, 11, 0.3)'
                        }}>
                            <CreditCard size={24} color="white" />
                        </div>
                    </div>
                </div>

                {/* Monthly Collection */}
                <div className="glass-card hover-lift animate-slide-up" style={{
                    padding: '1.5rem',
                    animationDelay: '0.15s',
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(79, 70, 229, 0.03))',
                    border: '1px solid rgba(99, 102, 241, 0.15)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Monthly Collection</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#6366f1' }}>
                                <CountUp value={monthlyCollection} prefix="₹" />
                            </h3>
                        </div>
                        <div className="icon-float" style={{
                            width: '52px',
                            height: '52px',
                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                            borderRadius: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 16px rgba(99, 102, 241, 0.3)'
                        }}>
                            <TrendingUp size={24} color="white" />
                        </div>
                    </div>
                </div>

                {/* 2. Today Attendance */}
                <div className="glass-card hover-lift animate-slide-up" style={{
                    padding: '1.5rem',
                    animationDelay: '0.2s',
                    background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.08), rgba(225, 29, 72, 0.03))',
                    border: '1px solid rgba(244, 63, 94, 0.15)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Today Attendance</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f43f5e' }}>
                                <CountUp value={attendanceRate} suffix="%" decimals={1} />
                            </h3>
                        </div>
                        <div className="icon-float" style={{
                            width: '52px',
                            height: '52px',
                            background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
                            borderRadius: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 16px rgba(244, 63, 94, 0.3)'
                        }}>
                            <Calendar size={24} color="white" />
                        </div>
                    </div>
                </div>

                {/* Teacher Attendance */}
                <div className="glass-card hover-lift animate-slide-up" style={{
                    padding: '1.5rem',
                    animationDelay: '0.25s',
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(124, 58, 237, 0.03))',
                    border: '1px solid rgba(139, 92, 246, 0.15)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Teacher Attendance</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#8b5cf6' }}>
                                <CountUp value={teacherAttendanceRate} suffix="%" decimals={1} />
                            </h3>
                        </div>
                        <div className="icon-float" style={{
                            width: '52px',
                            height: '52px',
                            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                            borderRadius: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 16px rgba(139, 92, 246, 0.3)'
                        }}>
                            <GraduationCap size={24} color="white" />
                        </div>
                    </div>
                </div>

                {/* 3. Monthly Admission */}
                <div className="glass-card hover-lift animate-slide-up" style={{
                    padding: '1.5rem',
                    animationDelay: '0.3s',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(5, 150, 105, 0.03))',
                    border: '1px solid rgba(16, 185, 129, 0.15)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Monthly Admission</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>
                                <CountUp value={monthlyAdmissions} />
                            </h3>
                        </div>
                        <div className="icon-float" style={{
                            width: '52px',
                            height: '52px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            borderRadius: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 16px rgba(16, 185, 129, 0.3)'
                        }}>
                            <UserPlus size={24} color="white" />
                        </div>
                    </div>
                </div>

                {/* Total Homework This Month */}
                <div className="glass-card hover-lift animate-slide-up" style={{
                    padding: '1.5rem',
                    animationDelay: '0.35s',
                    background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08), rgba(67, 56, 202, 0.03))',
                    border: '1px solid rgba(79, 70, 229, 0.15)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Homework Assigned</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary)' }}>
                                <CountUp value={totalHomework} />
                            </h3>
                        </div>
                        <div className="icon-float" style={{
                            width: '52px',
                            height: '52px',
                            background: 'var(--gradient-blue)',
                            borderRadius: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 16px rgba(99, 102, 241, 0.3)'
                        }}>
                            <FileText size={24} color="white" />
                        </div>
                    </div>
                </div>

            </div>

            {/* Student Overview Section */}
            <div className="responsive-grid-auto" style={{ marginBottom: '2.5rem' }}>
                {/* Total Students */}
                <div className="glass-card hover-lift animate-slide-up" style={{
                    padding: '1.5rem',
                    animationDelay: '0.4s',
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(79, 70, 229, 0.03))',
                    border: '1px solid rgba(99, 102, 241, 0.15)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Total Students</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#6366f1' }}>
                                <CountUp value={totalStudents} />
                            </h3>
                        </div>
                        <div className="icon-float" style={{
                            width: '52px',
                            height: '52px',
                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                            borderRadius: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 16px rgba(99, 102, 241, 0.3)'
                        }}>
                            <Users size={24} color="white" />
                        </div>
                    </div>
                </div>

                {/* Boys */}
                <div className="glass-card hover-lift animate-slide-up" style={{
                    padding: '1.5rem',
                    animationDelay: '0.45s',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(5, 150, 105, 0.03))',
                    border: '1px solid rgba(16, 185, 129, 0.15)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Boys</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>
                                <CountUp value={boysCount} />
                            </h3>
                        </div>
                        <div className="icon-float" style={{
                            width: '52px',
                            height: '52px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            borderRadius: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 16px rgba(16, 185, 129, 0.3)'
                        }}>
                            <Users size={24} color="white" />
                        </div>
                    </div>
                </div>

                {/* Girls */}
                <div className="glass-card hover-lift animate-slide-up" style={{
                    padding: '1.5rem',
                    animationDelay: '0.5s',
                    background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.08), rgba(225, 29, 72, 0.03))',
                    border: '1px solid rgba(244, 63, 94, 0.15)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Girls</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f43f5e' }}>
                                <CountUp value={girlsCount} />
                            </h3>
                        </div>
                        <div className="icon-float" style={{
                            width: '52px',
                            height: '52px',
                            background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
                            borderRadius: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 16px rgba(244, 63, 94, 0.3)'
                        }}>
                            <Users size={24} color="white" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Access Section - Moved Down */}
            <div style={{ marginBottom: '2.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-main)' }}>
                    Quick Access
                </h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: '1.5rem'
                }}>
                    {quickAccessItems.map((item, index) => (
                        <div
                            key={item.id}
                            className="glass-card hover-float hover-scale animate-slide-up"
                            onClick={() => navigate(item.route)}
                            style={{
                                padding: '1.75rem 1.25rem',
                                textAlign: 'center',
                                cursor: 'pointer',
                                animationDelay: `${index * 0.1}s`,
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            <div style={{
                                width: '64px',
                                height: '64px',
                                margin: '0 auto 1rem',
                                background: item.color,
                                borderRadius: '1.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 8px 20px rgba(0, 0, 0, 0.15)',
                                position: 'relative'
                            }}
                                className="icon-float"
                            >
                                <item.icon size={28} color="white" />
                            </div>
                            <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                {item.title}
                            </p>
                        </div>
                    ))}
                </div>
            </div>



            {/* Category Summary Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2.5rem'
            }}>
                {currentSchool?.allowedModules?.includes('hostel') && (
                    <div className="glass-card animate-slide-up hover-scale" style={{
                        padding: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.25rem',
                        animationDelay: '0.5s'
                    }}>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            background: 'linear-gradient(135deg, #667eea, #764ba2)',
                            borderRadius: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <Users size={28} color="white" />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>HOSTEL</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{hostelCount}</h3>
                        </div>
                    </div>
                )}

                {currentSchool?.allowedModules?.includes('transport') && (
                    <div className="glass-card animate-slide-up hover-scale" style={{
                        padding: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.25rem',
                        animationDelay: '0.6s'
                    }}>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            background: 'linear-gradient(135deg, #f093fb, #f5576c)',
                            borderRadius: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <Bell size={28} color="white" />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>TRANSPORT</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{transportCount}</h3>
                        </div>
                    </div>
                )}

                {/* The Girls and Boys cards have been moved to the student overview section above */}
            </div>
        </div>
    );
};


const Dashboard: React.FC = () => {
    const { user } = useAuth();

    if (user?.role === 'TEACHER') {
        return <TeacherDashboard />;
    }

    if (user?.role === 'PARENT') {
        return <ParentDashboard />;
    }

    if (user?.role === 'DRIVER') {
        return <DriverDashboard />;
    }

    return <AdminDashboard />;
};

export default Dashboard;
