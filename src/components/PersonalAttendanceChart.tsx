import React, { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';

interface PersonalAttendanceChartProps {
    present: number;
    late: number;
    absent: number;
}

export default function PersonalAttendanceChart({ present, late, absent }: PersonalAttendanceChartProps) {
    const [animatedData, setAnimatedData] = useState({ present: 0, late: 0, absent: 0 });

    const total = present + late + absent;
    const presentPercent = total > 0 ? (present / total) * 100 : 0;
    const latePercent = total > 0 ? (late / total) * 100 : 0;
    const absentPercent = total > 0 ? (absent / total) * 100 : 0;

    // Calculate attendance rate (present only)
    const attendanceRate = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0';

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

    // Function to create filled pie slice
    const createPieSlice = (startAngle: number, endAngle: number) => {
        // SVG paths fail with a 360 arc if start and end points perfectly align. Handle full circles by leaving a tiny gap.
        if (endAngle - startAngle >= 360) {
            endAngle = startAngle + 359.99;
        }

        const size = 300;
        const radius = size / 2;
        const centerX = size / 2;
        const centerY = size / 2;

        // Adjust angles for proper orientation (start from top)
        const startRad = ((startAngle - 90) * Math.PI) / 180;
        const endRad = ((endAngle - 90) * Math.PI) / 180;

        const startX = centerX + radius * Math.cos(startRad);
        const startY = centerY + radius * Math.sin(startRad);
        const endX = centerX + radius * Math.cos(endRad);
        const endY = centerY + radius * Math.sin(endRad);

        const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

        return `M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
    };

    const size = 300;

    // Calculate angles for each segment
    let currentAngle = 0;
    const presentAngle = (animatedData.present / 100) * 360;
    const lateAngle = (animatedData.late / 100) * 360;
    const absentAngle = (animatedData.absent / 100) * 360;

    const presentPath = presentAngle > 0 ? createPieSlice(currentAngle, currentAngle + presentAngle) : '';
    currentAngle += presentAngle;

    const latePath = lateAngle > 0 ? createPieSlice(currentAngle, currentAngle + lateAngle) : '';
    currentAngle += lateAngle;

    const absentPath = absentAngle > 0 ? createPieSlice(currentAngle, currentAngle + absentAngle) : '';

    return (
        <div className="glass-card" style={{ padding: '2.5rem', background: 'rgba(255, 255, 255, 0.98)' }}>
            <h3 style={{
                fontWeight: 800,
                marginBottom: '2.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '1.5rem',
                color: '#1e293b'
            }}>
                <TrendingUp size={24} color="var(--primary)" strokeWidth={2.5} />
                My Attendance Overview
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4rem', flexWrap: 'wrap' }}>
                {/* Full Filled Pie Chart */}
                <div style={{ position: 'relative', width: `${size}px`, height: `${size}px` }}>
                    {/* Shadow underneath */}
                    <div style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.03) 70%, transparent 100%)',
                        filter: 'blur(20px)',
                        transform: 'translateY(12px)',
                        zIndex: 0
                    }} />

                    <svg
                        width={size}
                        height={size}
                        style={{
                            position: 'relative',
                            zIndex: 1,
                            filter: 'drop-shadow(0 15px 25px rgba(0, 0, 0, 0.2))'
                        }}
                    >
                        {/* 3D Sides / Extrusion Layers */}
                        {[16, 12, 8, 4].map(offset => (
                            <g key={offset} transform={`translate(0, ${offset})`}>
                                <circle cx={size / 2} cy={size / 2} r={size / 2} fill="#cbd5e1" />
                                {presentPath && <path d={presentPath} fill="#059669" />}
                                {latePath && <path d={latePath} fill="#d97706" />}
                                {absentPath && <path d={absentPath} fill="#dc2626" />}

                                {/* Side shading */}
                                <circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#sideShadow)" style={{ pointerEvents: 'none' }} />
                            </g>
                        ))}

                        {/* Top Surface Layer */}
                        <g>
                            {/* Background circle */}
                            <circle cx={size / 2} cy={size / 2} r={size / 2} fill="#f1f5f9" />

                            {/* Present slice (green) */}
                            {presentPath && <path d={presentPath} fill="#10b981" />}

                            {/* Late slice (yellow) */}
                            {latePath && <path d={latePath} fill="#fbbf24" />}

                            {/* Absent slice (red) */}
                            {absentPath && <path d={absentPath} fill="#ef4444" />}

                            {/* Lighting and Highlights for 3D effect */}
                            <circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#topLight)" style={{ pointerEvents: 'none' }} />
                            <circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#rimHighlight)" style={{ pointerEvents: 'none' }} />
                        </g>

                        <defs>
                            {/* Side shadow to add depth */}
                            <linearGradient id="sideShadow" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="rgba(0,0,0,0)" />
                                <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
                            </linearGradient>

                            {/* Top surface lighting (shiny plastic/glass look) */}
                            <radialGradient id="topLight" cx="35%" cy="30%" r="65%">
                                <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
                                <stop offset="40%" stopColor="rgba(255,255,255,0.05)" />
                                <stop offset="70%" stopColor="rgba(0,0,0,0.05)" />
                                <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
                            </radialGradient>

                            {/* Rim inner shadow and highlight */}
                            <radialGradient id="rimHighlight">
                                <stop offset="90%" stopColor="rgba(0,0,0,0)" />
                                <stop offset="96%" stopColor="rgba(255,255,255,0.3)" />
                                <stop offset="100%" stopColor="rgba(0,0,0,0.2)" />
                            </radialGradient>
                        </defs>
                    </svg>

                    {/* Center percentage text */}
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                        zIndex: 10
                    }}>
                        <div style={{
                            fontSize: '4rem',
                            fontWeight: 900,
                            color: 'white',
                            lineHeight: 1,
                            letterSpacing: '-0.02em',
                            textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
                            filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))'
                        }}>
                            {attendanceRate}%
                        </div>
                    </div>
                </div>

                {/* Legend Cards */}
                <div style={{ display: 'grid', gap: '1.25rem', minWidth: '280px' }}>
                    {/* Present */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '1.25rem 1.75rem',
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)',
                        borderRadius: '1.25rem',
                        border: '2px solid rgba(16, 185, 129, 0.15)',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)'
                    }}
                        className="hover-lift"
                    >
                        <div style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: '#10b981',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                            flexShrink: 0
                        }} />
                        <div style={{ flex: 1 }}>
                            <div style={{
                                fontSize: '2rem',
                                fontWeight: 900,
                                color: '#10b981',
                                lineHeight: 1
                            }}>
                                {present}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 600, marginTop: '0.25rem' }}>
                                Present Days
                            </div>
                        </div>
                        <div style={{
                            fontSize: '1.125rem',
                            fontWeight: 800,
                            color: '#10b981'
                        }}>
                            {animatedData.present.toFixed(1)}%
                        </div>
                    </div>

                    {/* Late */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '1.25rem 1.75rem',
                        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(251, 191, 36, 0.02) 100%)',
                        borderRadius: '1.25rem',
                        border: '2px solid rgba(251, 191, 36, 0.15)',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(251, 191, 36, 0.08)'
                    }}
                        className="hover-lift"
                    >
                        <div style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: '#fbbf24',
                            boxShadow: '0 4px 12px rgba(251, 191, 36, 0.35)',
                            flexShrink: 0
                        }} />
                        <div style={{ flex: 1 }}>
                            <div style={{
                                fontSize: '2rem',
                                fontWeight: 900,
                                color: '#fbbf24',
                                lineHeight: 1
                            }}>
                                {late}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 600, marginTop: '0.25rem' }}>
                                Late Days
                            </div>
                        </div>
                        <div style={{
                            fontSize: '1.125rem',
                            fontWeight: 800,
                            color: '#f59e0b'
                        }}>
                            {animatedData.late.toFixed(1)}%
                        </div>
                    </div>

                    {/* Absent */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '1.25rem 1.75rem',
                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.02) 100%)',
                        borderRadius: '1.25rem',
                        border: '2px solid rgba(239, 68, 68, 0.15)',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)'
                    }}
                        className="hover-lift"
                    >
                        <div style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: '#ef4444',
                            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.35)',
                            flexShrink: 0
                        }} />
                        <div style={{ flex: 1 }}>
                            <div style={{
                                fontSize: '2rem',
                                fontWeight: 900,
                                color: '#ef4444',
                                lineHeight: 1
                            }}>
                                {absent}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 600, marginTop: '0.25rem' }}>
                                Absent Days
                            </div>
                        </div>
                        <div style={{
                            fontSize: '1.125rem',
                            fontWeight: 800,
                            color: '#ef4444'
                        }}>
                            {animatedData.absent.toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>

            {/* Total Summary */}
            <div style={{
                marginTop: '2.5rem',
                padding: '1.5rem 2rem',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
                borderRadius: '1.25rem',
                border: '2px solid rgba(99, 102, 241, 0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.08)'
            }}>
                <div style={{
                    fontWeight: 800,
                    fontSize: '1.125rem',
                    color: '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'var(--primary)'
                    }} />
                    Total Working Days
                </div>
                <div style={{
                    fontSize: '2.25rem',
                    fontWeight: 900,
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.5rem'
                }}>
                    <span>{total}</span>
                    <span style={{ fontSize: '1rem', fontWeight: 600, color: '#64748b' }}>days</span>
                </div>
            </div>
        </div>
    );
}
