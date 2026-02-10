import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, CheckCircle, Clock, XCircle, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSchool } from '../context/SchoolContext';
import { useAuth } from '../context/AuthContext';
import { CountUpAnimation } from './CountUpAnimation';

interface DailyAttendance {
    date: string;
    status: 'PRESENT' | 'LATE' | 'ABSENT';
}

export default function TeacherPersonalAttendance() {
    const { currentSchool } = useSchool();
    const { user } = useAuth();
    const [attendanceData, setAttendanceData] = useState<DailyAttendance[]>([]);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAttendanceData();
    }, [currentSchool?.id, user?.id, currentMonth]);

    const fetchAttendanceData = async () => {
        if (!currentSchool?.id || !user?.id) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // user.id already contains the teacher's document ID from login
            const teacherId = user.id;

            // Get start and end of current month
            const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

            const startDateStr = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-${String(startOfMonth.getDate()).padStart(2, '0')}`;
            const endDateStr = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

            console.log('Fetching attendance for teacher:', teacherId, 'from', startDateStr, 'to', endDateStr);

            // Fetch teacher's attendance records
            const attendanceRef = collection(db, 'teacherAttendance');
            const q = query(
                attendanceRef,
                where('teacherId', '==', teacherId),
                where('date', '>=', startDateStr),
                where('date', '<=', endDateStr)
            );

            const snapshot = await getDocs(q);
            const records: DailyAttendance[] = [];

            console.log('Found', snapshot.size, 'attendance records for teacher', teacherId);

            snapshot.forEach((doc) => {
                const data = doc.data();
                console.log('Record:', data);
                records.push({
                    date: data.date,
                    status: data.status
                });
            });

            // Sort by date descending
            records.sort((a, b) => b.date.localeCompare(a.date));
            setAttendanceData(records);
        } catch (error) {
            console.error('Error fetching teacher attendance:', error);
        } finally {
            setLoading(false);
        }
    };

    const summary = useMemo(() => {
        const present = attendanceData.filter(r => r.status === 'PRESENT').length;
        const late = attendanceData.filter(r => r.status === 'LATE').length;
        const absent = attendanceData.filter(r => r.status === 'ABSENT').length;
        const total = attendanceData.length;
        const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0';

        return { present, late, absent, total, percentage };
    }, [attendanceData]);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const previousMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    };

    const getMonthYear = () => {
        return currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PRESENT':
                return {
                    color: '#10b981',
                    bg: 'rgba(16, 185, 129, 0.1)',
                    label: 'Present'
                };
            case 'LATE':
                return {
                    color: '#f59e0b',
                    bg: 'rgba(245, 158, 11, 0.1)',
                    label: 'Late'
                };
            case 'ABSENT':
                return {
                    color: '#ef4444',
                    bg: 'rgba(239, 68, 68, 0.1)',
                    label: 'Absent'
                };
            default:
                return {
                    color: '#64748b',
                    bg: 'rgba(100, 116, 139, 0.1)',
                    label: '-'
                };
        }
    };

    return (
        <div className="animate-slide-up">
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Attendance Percentage */}
                <div className="glass-card hover-lift" style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0.02) 100%)',
                    border: '2px solid rgba(99, 102, 241, 0.2)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'rgba(99, 102, 241, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <TrendingUp size={24} color="var(--primary)" strokeWidth={2.5} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 700 }}>
                                Attendance Rate
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--primary)' }}>
                                <CountUpAnimation end={parseFloat(summary.percentage)} decimals={1} suffix="%" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Total Present */}
                <div className="glass-card hover-lift" style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.02) 100%)',
                    border: '2px solid rgba(16, 185, 129, 0.2)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <CheckCircle size={24} color="#10b981" strokeWidth={2.5} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 700 }}>
                                Present Days
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981' }}>
                                <CountUpAnimation end={summary.present} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Total Late */}
                <div className="glass-card hover-lift" style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(245, 158, 11, 0.02) 100%)',
                    border: '2px solid rgba(245, 158, 11, 0.2)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'rgba(245, 158, 11, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Clock size={24} color="#f59e0b" strokeWidth={2.5} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 700 }}>
                                Late Days
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f59e0b' }}>
                                <CountUpAnimation end={summary.late} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Total Absent */}
                <div className="glass-card hover-lift" style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(239, 68, 68, 0.02) 100%)',
                    border: '2px solid rgba(239, 68, 68, 0.2)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <XCircle size={24} color="#ef4444" strokeWidth={2.5} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 700 }}>
                                Absent Days
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ef4444' }}>
                                <CountUpAnimation end={summary.absent} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Monthly Attendance Records */}
            <div className="glass-card" style={{ padding: '2rem' }}>
                {/* Month Navigation */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '2rem',
                    paddingBottom: '1.5rem',
                    borderBottom: '2px solid #f1f5f9'
                }}>
                    <h3 style={{ fontWeight: 800, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
                        <Calendar size={24} color="var(--primary)" />
                        My Attendance Records
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            onClick={previousMonth}
                            className="btn btn-secondary"
                            style={{
                                padding: '0.5rem 0.75rem',
                                borderRadius: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span style={{ fontWeight: 800, fontSize: '1.125rem', minWidth: '160px', textAlign: 'center' }}>
                            {getMonthYear()}
                        </span>
                        <button
                            onClick={nextMonth}
                            className="btn btn-secondary"
                            style={{
                                padding: '0.5rem 0.75rem',
                                borderRadius: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>

                {/* Attendance List */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        Loading your attendance records...
                    </div>
                ) : attendanceData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No attendance records found for this month.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {attendanceData.map((record, index) => {
                            const badge = getStatusBadge(record.status);
                            return (
                                <div
                                    key={index}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '1.25rem',
                                        background: index % 2 === 0 ? '#f8fafc' : 'white',
                                        borderRadius: '1rem',
                                        border: '1px solid #f1f5f9',
                                        transition: 'all 0.3s ease'
                                    }}
                                    className="hover-lift"
                                >
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>
                                            {formatDate(record.date)}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                                            {record.date}
                                        </div>
                                    </div>
                                    <div style={{
                                        padding: '0.5rem 1.25rem',
                                        background: badge.bg,
                                        borderRadius: '2rem',
                                        fontWeight: 800,
                                        fontSize: '0.875rem',
                                        color: badge.color,
                                        border: `2px solid ${badge.color}40`
                                    }}>
                                        {badge.label}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Total Summary */}
            <div className="glass-card" style={{
                padding: '1.5rem',
                marginTop: '2rem',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0.02) 100%)',
                border: '2px solid rgba(99, 102, 241, 0.2)'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem'
                }}>
                    <div style={{ fontWeight: 700, fontSize: '1.125rem', color: '#1e293b' }}>
                        Monthly Summary for {getMonthYear()}
                    </div>
                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                        <div>
                            <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600 }}>Total Days: </span>
                            <span style={{ fontWeight: 900, fontSize: '1.125rem', color: '#1e293b' }}>{summary.total}</span>
                        </div>
                        <div>
                            <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600 }}>Attendance: </span>
                            <span style={{ fontWeight: 900, fontSize: '1.125rem', color: 'var(--primary)' }}>{summary.percentage}%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
