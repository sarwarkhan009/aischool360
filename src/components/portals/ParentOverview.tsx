import React from 'react';
import { X, School, User as UserIcon, Phone } from 'lucide-react';
import AnimatedPieChart from './AnimatedPieChart';
import { formatDate } from '../../utils/dateUtils';

interface Props {
    studentData: any;
    user: any;
    stats: {
        attPercent: number;
        attTotal: number;
        attPresent: number;
        attLate: number;
        attAbsent: number;
        hwRate: number;
        totalAssigned: number;
        totalCompleted: number;
        totalPartial: number;
        totalNotDone: number;
        totalPending: number;
    };
    performanceData: any[];
}

const ParentOverview: React.FC<Props> = ({ studentData, user, stats, performanceData }) => {
    return (
        <div className="animate-fade-in no-scrollbar" style={{ paddingTop: '0.5rem' }}>

            {/* NEW High-Fidelity Digital ID Card - Top Position */}
            <div style={{
                background: '#111827',
                borderRadius: '2.5rem',
                padding: '3rem 2rem',
                color: 'white',
                textAlign: 'center',
                marginBottom: '2rem',
                boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.4)',
                position: 'relative'
            }}>
                <div style={{
                    width: '240px',
                    height: '360px',
                    margin: '0 auto 2.5rem',
                    borderRadius: '4rem',
                    border: '10px solid #1f2937',
                    overflow: 'hidden',
                    background: '#1f2937'
                }}>
                    {studentData?.photo ? (
                        <img src={studentData.photo} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}>
                            <UserIcon size={100} />
                        </div>
                    )}
                </div>

                <h2 style={{
                    fontSize: '1.75rem',
                    fontWeight: 900,
                    fontStyle: 'italic',
                    textTransform: 'uppercase',
                    margin: '0 0 1rem 0',
                    letterSpacing: '-0.01em'
                }}>
                    {studentData?.fullName || studentData?.name}
                </h2>

                <div style={{ background: '#1e1b4b', color: '#818cf8', padding: '0.5rem 2rem', borderRadius: '2rem', display: 'inline-block', fontWeight: 900, fontSize: '1rem', marginBottom: '3rem' }}>
                    {studentData?.admissionNo || studentData?.id}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '350px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', fontWeight: 800 }}>
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.6rem', borderRadius: '12px' }}><School size={18} /></div>
                        <span>CLASS {studentData?.class || 'N/A'} • CURRENT SESSION</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', fontWeight: 800 }}>
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.6rem', borderRadius: '12px' }}><UserIcon size={18} /></div>
                        <span>GUARDIAN: {studentData?.fatherName || 'NOT SET'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', fontWeight: 800 }}>
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.6rem', borderRadius: '12px' }}><Phone size={18} /></div>
                        <span>CONTACT: {studentData?.fatherContactNo || 'NOT SET'}</span>
                    </div>
                </div>
            </div>

            {/* Stats Section Moved Below */}
            <div className="responsive-grid-auto" style={{ gap: '1rem', marginBottom: '2rem' }}>
                <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', justifyContent: 'center' }}>
                    <div style={{
                        position: 'relative',
                        width: '160px',
                        height: '160px',
                        perspective: '1000px',
                        flexShrink: 0
                    }}>
                        <div className="chart-3d-ring animated-fill" style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            background: `conic-gradient(
                                #10b981 0% ${(stats.attPresent / stats.attTotal) * 100}%, 
                                #f59e0b ${(stats.attPresent / stats.attTotal) * 100}% ${((stats.attPresent + stats.attLate) / stats.attTotal) * 100}%, 
                                #ef4444 ${((stats.attPresent + stats.attLate) / stats.attTotal) * 100}% 100%
                            )`,
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3), inset 0 0 30px rgba(0,0,0,0.1)',
                            transform: 'rotateX(25deg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {/* Fill Animation Overlay */}
                            <div className="chart-reveal-mask" />

                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transform: 'translateZ(35px)',
                                textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                                pointerEvents: 'none',
                                zIndex: 10
                            }}>
                                <span style={{ fontSize: '2rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>{Math.round(stats.attPercent)}%</span>
                                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Present</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '0 0 0.25rem 0' }}>ATTENDANCE</h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem' }}>Monthly Overview</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '2px' }} />
                                <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>On Time: {stats.attPresent}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '8px', height: '8px', background: '#f59e0b', borderRadius: '2px' }} />
                                <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>Late: {stats.attLate}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '2px' }} />
                                <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>Absent: {stats.attAbsent}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '8px', height: '8px', background: '#94a3b8', borderRadius: '2px' }} />
                                <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>Total: {stats.attTotal}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', justifyContent: 'center' }}>
                    <div style={{
                        position: 'relative',
                        width: '160px',
                        height: '160px',
                        perspective: '1000px',
                        flexShrink: 0
                    }}>
                        <div className="chart-3d-ring animated-fill" style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            background: `conic-gradient(
                                #10b981 0% ${(stats.totalCompleted / stats.totalAssigned) * 100}%, 
                                #f59e0b ${(stats.totalCompleted / stats.totalAssigned) * 100}% ${((stats.totalCompleted + stats.totalPartial) / stats.totalAssigned) * 100}%, 
                                #ef4444 ${((stats.totalCompleted + stats.totalPartial) / stats.totalAssigned) * 100}% ${((stats.totalCompleted + stats.totalPartial + stats.totalNotDone) / stats.totalAssigned) * 100}%,
                                #e2e8f0 ${((stats.totalCompleted + stats.totalPartial + stats.totalNotDone) / stats.totalAssigned) * 100}% 100%
                            )`,
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3), inset 0 0 30px rgba(0,0,0,0.1)',
                            transform: 'rotateX(25deg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {/* Fill Animation Overlay */}
                            <div className="chart-reveal-mask" />

                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transform: 'translateZ(35px)',
                                textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                                pointerEvents: 'none',
                                zIndex: 10
                            }}>
                                <span style={{ fontSize: '2rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>{Math.round(stats.hwRate)}%</span>
                                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Success</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '0 0 0.25rem 0' }}>HOMEWORK</h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem' }}>Success Analysis</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '2px' }} />
                                <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>Done: {stats.totalCompleted}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '8px', height: '8px', background: '#f59e0b', borderRadius: '2px' }} />
                                <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>Partial: {stats.totalPartial}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '2px' }} />
                                <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>Missed: {stats.totalNotDone}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '8px', height: '8px', background: '#e2e8f0', borderRadius: '2px' }} />
                                <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>Pending: {stats.totalPending}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <style>{`
                    .chart-reveal-mask {
                        position: absolute;
                        inset: 0;
                        background: #f8fafc;
                        border-radius: 50%;
                        z-index: 5;
                        transform-origin: center;
                        animation: reveal-data 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                    }
                    @keyframes reveal-data {
                        0% { clip-path: polygon(50% 50%, 50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%); }
                        25% { clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 0%, 100% 0%, 100% 0%); }
                        50% { clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 100% 100%, 100% 100%); }
                        75% { clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 100%); }
                        100% { clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 50% 0%); opacity: 0; }
                    }
                `}</style>
            </div>

            {/* Academic Progress */}
            <div className="glass-card" style={{ padding: '2rem' }}>
                <h2 style={{ fontWeight: 800, marginBottom: '1.5rem' }}>Academic Progress</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {performanceData.length > 0 ? performanceData.map((p, i) => (
                        <div key={i} style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 700 }}>
                                <span>{p.subject}</span>
                                <span style={{ color: p.color }}>{p.progress}%</span>
                            </div>
                            <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${p.progress}%`, height: '100%', background: p.color, borderRadius: '4px' }} />
                            </div>
                        </div>
                    )) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No data available.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ParentOverview;
