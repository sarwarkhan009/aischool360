import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, Clock, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSchool } from '../context/SchoolContext';

interface DailyAttendance {
    date: string;
    present: number;
    late: number;
    absent: number;
    total: number;
}

interface AttendanceSummary {
    totalPresent: number;
    totalLate: number;
    totalAbsent: number;
}

export default function DateWiseAttendance() {
    const { currentSchool } = useSchool();
    const [attendanceData, setAttendanceData] = useState<DailyAttendance[]>([]);
    const [summary, setSummary] = useState<AttendanceSummary>({
        totalPresent: 0,
        totalLate: 0,
        totalAbsent: 0
    });
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAttendanceData();
    }, [currentSchool?.id, currentMonth]);

    const fetchAttendanceData = async () => {
        if (!currentSchool?.id) return;

        setLoading(true);
        try {
            // Get start and end of current month
            const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

            // Fetch attendance records for the month
            const attendanceRef = collection(db, 'attendance');
            const q = query(
                attendanceRef,
                where('schoolId', '==', currentSchool.id),
                where('date', '>=', Timestamp.fromDate(startOfMonth)),
                where('date', '<=', Timestamp.fromDate(endOfMonth))
            );

            const snapshot = await getDocs(q);
            const dailyMap = new Map<string, { present: number; late: number; absent: number; total: number }>();

            let totalPresent = 0;
            let totalLate = 0;
            let totalAbsent = 0;

            snapshot.forEach((doc) => {
                const data = doc.data();
                const dateStr = data.date.toDate().toLocaleDateString('en-CA'); // YYYY-MM-DD format

                if (!dailyMap.has(dateStr)) {
                    dailyMap.set(dateStr, { present: 0, late: 0, absent: 0, total: 0 });
                }

                const dayData = dailyMap.get(dateStr)!;

                // Count attendance statuses
                Object.values(data.students || {}).forEach((status: any) => {
                    if (status === 'present') {
                        dayData.present++;
                        totalPresent++;
                    } else if (status === 'late') {
                        dayData.late++;
                        totalLate++;
                    } else if (status === 'absent') {
                        dayData.absent++;
                        totalAbsent++;
                    }
                    dayData.total++;
                });
            });

            // Convert map to array and sort by date
            const dailyArray: DailyAttendance[] = Array.from(dailyMap.entries())
                .map(([date, data]) => ({ date, ...data }))
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setAttendanceData(dailyArray);
            setSummary({ totalPresent, totalLate, totalAbsent });
        } catch (error) {
            console.error('Error fetching attendance data:', error);
        } finally {
            setLoading(false);
        }
    };

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

    const totalStudents = summary.totalPresent + summary.totalLate + summary.totalAbsent;

    return (
        <div className="animate-slide-up">
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Total Present */}
                <div className="glass-card hover-lift" style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.02) 100%)',
                    border: '2px solid rgba(16, 185, 129, 0.2)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '14px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <CheckCircle size={28} color="#10b981" strokeWidth={2.5} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 700, marginBottom: '0.25rem' }}>
                                Total Present
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981' }}>
                                {summary.totalPresent}
                            </div>
                        </div>
                    </div>
                    <div style={{
                        display: 'inline-block',
                        padding: '0.4rem 0.75rem',
                        background: 'rgba(16, 185, 129, 0.15)',
                        borderRadius: '2rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#10b981'
                    }}>
                        Present
                    </div>
                </div>

                {/* Total Late */}
                <div className="glass-card hover-lift" style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(245, 158, 11, 0.02) 100%)',
                    border: '2px solid rgba(245, 158, 11, 0.2)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '14px',
                            background: 'rgba(245, 158, 11, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Clock size={28} color="#f59e0b" strokeWidth={2.5} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 700, marginBottom: '0.25rem' }}>
                                Total Late
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f59e0b' }}>
                                {summary.totalLate}
                            </div>
                        </div>
                    </div>
                    <div style={{
                        display: 'inline-block',
                        padding: '0.4rem 0.75rem',
                        background: 'rgba(245, 158, 11, 0.15)',
                        borderRadius: '2rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#f59e0b'
                    }}>
                        Late
                    </div>
                </div>

                {/* Total Absent */}
                <div className="glass-card hover-lift" style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(239, 68, 68, 0.02) 100%)',
                    border: '2px solid rgba(239, 68, 68, 0.2)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '14px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <XCircle size={28} color="#ef4444" strokeWidth={2.5} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 700, marginBottom: '0.25rem' }}>
                                Total Absent
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ef4444' }}>
                                {summary.totalAbsent}
                            </div>
                        </div>
                    </div>
                    <div style={{
                        display: 'inline-block',
                        padding: '0.4rem 0.75rem',
                        background: 'rgba(239, 68, 68, 0.15)',
                        borderRadius: '2rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#ef4444'
                    }}>
                        Absent
                    </div>
                </div>
            </div>

            {/* Date-wise Attendance Table */}
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
                        Date-wise Attendance
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

                {/* Table */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        Loading attendance data...
                    </div>
                ) : attendanceData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No attendance records found for this month.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.75rem' }}>
                            <thead>
                                <tr>
                                    <th style={{
                                        textAlign: 'left',
                                        padding: '1rem',
                                        fontSize: '0.875rem',
                                        fontWeight: 800,
                                        color: '#64748b',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>
                                        Date
                                    </th>
                                    <th style={{
                                        textAlign: 'center',
                                        padding: '1rem',
                                        fontSize: '0.875rem',
                                        fontWeight: 800,
                                        color: '#64748b',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>
                                        Present
                                    </th>
                                    <th style={{
                                        textAlign: 'center',
                                        padding: '1rem',
                                        fontSize: '0.875rem',
                                        fontWeight: 800,
                                        color: '#64748b',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>
                                        Late
                                    </th>
                                    <th style={{
                                        textAlign: 'center',
                                        padding: '1rem',
                                        fontSize: '0.875rem',
                                        fontWeight: 800,
                                        color: '#64748b',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>
                                        Absent
                                    </th>
                                    <th style={{
                                        textAlign: 'center',
                                        padding: '1rem',
                                        fontSize: '0.875rem',
                                        fontWeight: 800,
                                        color: '#64748b',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>
                                        Total
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {attendanceData.map((day, index) => (
                                    <tr key={day.date} style={{
                                        background: index % 2 === 0 ? '#f8fafc' : 'white',
                                        transition: 'all 0.3s ease'
                                    }}
                                        className="table-row-hover"
                                    >
                                        <td style={{
                                            padding: '1.25rem 1rem',
                                            fontWeight: 700,
                                            color: '#1e293b',
                                            borderRadius: '1rem 0 0 1rem'
                                        }}>
                                            {formatDate(day.date)}
                                        </td>
                                        <td style={{
                                            padding: '1.25rem 1rem',
                                            textAlign: 'center'
                                        }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '0.5rem 1rem',
                                                background: 'rgba(16, 185, 129, 0.1)',
                                                borderRadius: '0.75rem',
                                                fontWeight: 800,
                                                color: '#10b981'
                                            }}>
                                                {day.present}
                                            </span>
                                        </td>
                                        <td style={{
                                            padding: '1.25rem 1rem',
                                            textAlign: 'center'
                                        }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '0.5rem 1rem',
                                                background: 'rgba(245, 158, 11, 0.1)',
                                                borderRadius: '0.75rem',
                                                fontWeight: 800,
                                                color: '#f59e0b'
                                            }}>
                                                {day.late}
                                            </span>
                                        </td>
                                        <td style={{
                                            padding: '1.25rem 1rem',
                                            textAlign: 'center'
                                        }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '0.5rem 1rem',
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                borderRadius: '0.75rem',
                                                fontWeight: 800,
                                                color: '#ef4444'
                                            }}>
                                                {day.absent}
                                            </span>
                                        </td>
                                        <td style={{
                                            padding: '1.25rem 1rem',
                                            textAlign: 'center',
                                            fontWeight: 800,
                                            color: '#1e293b',
                                            borderRadius: '0 1rem 1rem 0'
                                        }}>
                                            {day.total}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <style>{`
                .table-row-hover:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                }
            `}</style>
        </div>
    );
}
