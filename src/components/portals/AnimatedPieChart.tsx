import React, { useState, useEffect } from 'react';

interface AnimatedPieChartProps {
    completed?: number;
    total?: number;
    value?: number; // Shorthand for percentage
    label1?: string;
    label2?: string;
    label3?: string;
    color1?: string;
    color2?: string;
    color3?: string;
    size?: number;
    lateCount?: number;
    absentCount?: number;
    showLegend?: boolean;
}

const AnimatedPieChart: React.FC<AnimatedPieChartProps> = ({
    completed = 0,
    total = 0,
    value,
    label1 = "Completed",
    label2 = "Remaining",
    label3,
    color1 = "#10b981", // Emerald
    color2 = "#f43f5e", // Rose
    color3,
    size = 180,
    lateCount,
    absentCount,
    showLegend = true
}) => {
    const [displayPercentage, setDisplayPercentage] = useState(0);
    const targetPercentage = value !== undefined ? value : (total > 0 ? Math.round((completed / total) * 100) : 0);

    // Three-way split or two-way split
    const hasThreeCategories = label3 && color3 && lateCount !== undefined && absentCount !== undefined;

    let notCompleted = 0;
    let latePercentage = 0;
    let absentPercentage = 0;
    let gradient: string;

    if (hasThreeCategories) {
        const presentPercentage = targetPercentage;
        latePercentage = total > 0 ? Math.round((lateCount! / total) * 100) : 0;
        absentPercentage = total > 0 ? Math.round((absentCount! / total) * 100) : 0;

        // Create a three-segment gradient
        const segment1End = presentPercentage;
        const segment2End = segment1End + latePercentage;

        gradient = `conic-gradient(
            ${color1} 0% ${segment1End}%, 
            ${color2} ${segment1End}% ${segment2End}%, 
            ${color3} ${segment2End}% 100%
        )`;
        notCompleted = total - completed - lateCount! - absentCount!;
    } else {
        notCompleted = total > 0 ? total - completed : 0;
        gradient = `conic-gradient(${color1} 0% ${displayPercentage}%, ${color2} ${displayPercentage}% 100%)`;
    }

    useEffect(() => {
        let start = 0;
        const duration = 1500; // 1.5 seconds for smoother animation
        const increment = targetPercentage / (duration / 16); // ~60fps

        const timer = setInterval(() => {
            start += increment;
            if (start >= targetPercentage) {
                setDisplayPercentage(targetPercentage);
                clearInterval(timer);
            } else {
                setDisplayPercentage(Math.floor(start));
            }
        }, 16);

        return () => clearInterval(timer);
    }, [targetPercentage]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
                style={{
                    position: 'relative',
                    width: `${size}px`,
                    height: `${size}px`,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: gradient,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 40px rgba(0,0,0,0.1)',
                    transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    cursor: 'default'
                }}
                className="hover-lift"
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
                {/* Inner Circle with Enhanced Glassmorphism */}
                <div style={{
                    position: 'absolute',
                    inset: '1rem',
                    background: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    borderRadius: '50%',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.1)'
                }}>
                    <div style={{
                        fontSize: `${size / 4.5}px`,
                        fontWeight: 900,
                        color: '#ffffff',
                        textShadow: '0 2px 4px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.3)',
                        letterSpacing: '-0.02em'
                    }}>
                        {displayPercentage}%
                    </div>
                </div>
            </div>

            {showLegend && (
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: 'default',
                            transition: 'transform 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <div style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: color1,
                            boxShadow: `0 0 12px ${color1}60, 0 2px 4px ${color1}40`,
                            transition: 'transform 0.2s'
                        }}></div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>
                            <span style={{ color: '#1e293b' }}>{total > 0 ? completed : `${targetPercentage}%`}</span>
                            <span style={{ color: '#64748b', marginLeft: '0.25rem' }}>{label1}</span>
                            {hasThreeCategories && <span style={{ color: '#10b981', marginLeft: '0.25rem', fontWeight: 900 }}>({targetPercentage}%)</span>}
                        </div>
                    </div>

                    {hasThreeCategories ? (
                        <>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    cursor: 'default',
                                    transition: 'transform 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <div style={{
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    background: color2,
                                    boxShadow: `0 0 12px ${color2}60, 0 2px 4px ${color2}40`,
                                    transition: 'transform 0.2s'
                                }}></div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>
                                    <span style={{ color: '#1e293b' }}>{lateCount}</span>
                                    <span style={{ color: '#64748b', marginLeft: '0.25rem' }}>{label2}</span>
                                    <span style={{ color: '#f59e0b', marginLeft: '0.25rem', fontWeight: 900 }}>({latePercentage}%)</span>
                                </div>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    cursor: 'default',
                                    transition: 'transform 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <div style={{
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    background: color3,
                                    boxShadow: `0 0 12px ${color3}60, 0 2px 4px ${color3}40`,
                                    transition: 'transform 0.2s'
                                }}></div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>
                                    <span style={{ color: '#1e293b' }}>{absentCount}</span>
                                    <span style={{ color: '#64748b', marginLeft: '0.25rem' }}>{label3}</span>
                                    <span style={{ color: '#f43f5e', marginLeft: '0.25rem', fontWeight: 900 }}>({absentPercentage}%)</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: 'default',
                                transition: 'transform 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: color2,
                                boxShadow: `0 0 12px ${color2}60, 0 2px 4px ${color2}40`,
                                transition: 'transform 0.2s'
                            }}></div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>
                                <span style={{ color: '#1e293b' }}>{total > 0 ? (notCompleted < 0 ? 0 : notCompleted) : `${100 - targetPercentage}%`}</span>
                                <span style={{ color: '#64748b', marginLeft: '0.25rem' }}>{label2}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AnimatedPieChart;
