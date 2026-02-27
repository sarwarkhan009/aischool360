import React, { useEffect, useState } from 'react';
import { CheckCircle, Clock, XCircle, Users } from 'lucide-react';

interface TeacherAttendanceData {
    present: number;
    late: number;
    absent: number;
    totalTeachers?: number;
}

interface TeacherAttendanceChartProps {
    data: TeacherAttendanceData;
    title?: string;
}

export default function TeacherAttendanceChart({ data, title = "Teacher Attendance Overview" }: TeacherAttendanceChartProps) {
    const [animatedData, setAnimatedData] = useState({ present: 0, late: 0, absent: 0 });

    const total = data.present + data.late + data.absent;
    const presentPercent = total > 0 ? (data.present / total) * 100 : 0;
    const latePercent = total > 0 ? (data.late / total) * 100 : 0;
    const absentPercent = total > 0 ? (data.absent / total) * 100 : 0;

    useEffect(() => {
        // Animate the percentages
        const duration = 1500; // 1.5 seconds
        const steps = 60;
        const stepDuration = duration / steps;
        let currentStep = 0;

        const timer = setInterval(() => {
            currentStep++;
            const progress = currentStep / steps;

            setAnimatedData({
                present: presentPercent * progress,
                late: latePercent * progress,
                absent: absentPercent * progress
            });

            if (currentStep >= steps) {
                clearInterval(timer);
                setAnimatedData({
                    present: presentPercent,
                    late: latePercent,
                    absent: absentPercent
                });
            }
        }, stepDuration);

        return () => clearInterval(timer);
    }, [presentPercent, latePercent, absentPercent]);

    return (
        <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontWeight: 800, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Users size={20} color="var(--primary)" /> {title}
            </h3>

            {/* Circular Progress Ring */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
                <div style={{ position: 'relative', width: '220px', height: '220px' }}>
                    <svg width="220" height="220" style={{ transform: 'rotate(-90deg)' }}>
                        {/* Background circle */}
                        <circle
                            cx="110"
                            cy="110"
                            r="95"
                            fill="none"
                            stroke="#f1f5f9"
                            strokeWidth="20"
                        />

                        {/* Present arc (green) */}
                        <circle
                            cx="110"
                            cy="110"
                            r="95"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="20"
                            strokeDasharray={`${(animatedData.present / 100) * 2 * Math.PI * 95} ${2 * Math.PI * 95}`}
                            strokeLinecap="round"
                        />

                        {/* Late arc (yellow/orange) */}
                        <circle
                            cx="110"
                            cy="110"
                            r="95"
                            fill="none"
                            stroke="#f59e0b"
                            strokeWidth="20"
                            strokeDasharray={`${(animatedData.late / 100) * 2 * Math.PI * 95} ${2 * Math.PI * 95}`}
                            strokeDashoffset={-((animatedData.present / 100) * 2 * Math.PI * 95)}
                            strokeLinecap="round"
                        />

                        {/* Absent arc (red) */}
                        <circle
                            cx="110"
                            cy="110"
                            r="95"
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth="20"
                            strokeDasharray={`${(animatedData.absent / 100) * 2 * Math.PI * 95} ${2 * Math.PI * 95}`}
                            strokeDashoffset={-(((animatedData.present + animatedData.late) / 100) * 2 * Math.PI * 95)}
                            strokeLinecap="round"
                        />
                    </svg>

                    {/* Center text */}
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#1e293b' }}>
                            {animatedData.present.toFixed(0)}%
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 600 }}>
                            Present
                        </div>
                    </div>
                </div>
            </div>

            {/* Legend with stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                {/* Present */}
                <div style={{
                    padding: '1.25rem',
                    background: 'rgba(16, 185, 129, 0.05)',
                    borderRadius: '1rem',
                    border: '2px solid rgba(16, 185, 129, 0.2)',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                }}
                    className="hover-lift"
                >
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 0.75rem'
                    }}>
                        <CheckCircle size={24} color="#10b981" />
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#10b981', marginBottom: '0.25rem' }}>
                        {animatedData.present.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 700 }}>
                        Present
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginTop: '0.25rem' }}>
                        {data.present} teachers
                    </div>
                </div>

                {/* Late */}
                <div style={{
                    padding: '1.25rem',
                    background: 'rgba(245, 158, 11, 0.05)',
                    borderRadius: '1rem',
                    border: '2px solid rgba(245, 158, 11, 0.2)',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                }}
                    className="hover-lift"
                >
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'rgba(245, 158, 11, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 0.75rem'
                    }}>
                        <Clock size={24} color="#f59e0b" />
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#f59e0b', marginBottom: '0.25rem' }}>
                        {animatedData.late.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 700 }}>
                        Late
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginTop: '0.25rem' }}>
                        {data.late} teachers
                    </div>
                </div>

                {/* Absent */}
                <div style={{
                    padding: '1.25rem',
                    background: 'rgba(239, 68, 68, 0.05)',
                    borderRadius: '1rem',
                    border: '2px solid rgba(239, 68, 68, 0.2)',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                }}
                    className="hover-lift"
                >
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 0.75rem'
                    }}>
                        <XCircle size={24} color="#ef4444" />
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ef4444', marginBottom: '0.25rem' }}>
                        {animatedData.absent.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 700 }}>
                        Absent
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginTop: '0.25rem' }}>
                        {data.absent} teachers
                    </div>
                </div>
            </div>

            {/* Total teachers info */}
            <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: '#f8fafc',
                borderRadius: '0.75rem',
                textAlign: 'center',
                fontWeight: 700,
                color: '#64748b'
            }}>
                Total Teachers: <span style={{ color: '#1e293b', fontWeight: 900 }}>{data.totalTeachers || total}</span>
            </div>
        </div>
    );
}
