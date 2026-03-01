import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BookOpen, Calendar, User, Loader2, Clock, ClipboardList } from 'lucide-react';

interface Props {
    studentId: string;
    studentClass: string;
    section: string;
    schoolId: string;
}

const ParentHomework: React.FC<Props> = ({ studentId, studentClass, section, schoolId }) => {
    const [tasks, setTasks] = useState<any[]>([]);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<'THIS_MONTH' | 'LAST_MONTH' | 'LIFETIME'>('THIS_MONTH');

    // Real-time listener for homework submissions
    useEffect(() => {
        if (!studentId) return;
        const subQ = query(collection(db, 'homeworkSubmissions'), where('studentId', '==', studentId));
        const unsub = onSnapshot(subQ, (snap) => {
            setSubmissions(snap.docs.map(d => d.data()));
        }, (err) => console.error('Submissions listener error:', err));
        return () => unsub();
    }, [studentId]);

    // Real-time listener for class homework
    useEffect(() => {
        if (!studentClass || !schoolId) return;
        setLoading(true);
        const q = query(
            collection(db, 'homework'),
            where('schoolId', '==', schoolId),
            where('class', '==', studentClass)
        );
        const unsub = onSnapshot(q, (snap) => {
            const allTasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));

            // Filter by Range & Section
            const filteredTasks = allTasks.filter((t: any) => {
                if (t.section && t.section !== 'All Sections' && t.section !== section) return false;

                const date = new Date(t.assignedDate || t.createdAt || 0);
                const now = new Date();
                const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const startOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
                const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

                if (timeRange === 'THIS_MONTH' && date < startOfThisMonth) return false;
                if (timeRange === 'LAST_MONTH' && (date < startOfLastMonth || date > endOfLastMonth)) return false;

                return true;
            });

            // Sort by createdAt timestamp (newest first)
            filteredTasks.sort((a, b) => {
                const aTime = new Date(a.createdAt || a.assignedDate || 0).getTime();
                const bTime = new Date(b.createdAt || b.assignedDate || 0).getTime();
                return bTime - aTime;
            });

            setTasks(filteredTasks);
            setLoading(false);
        }, (err) => {
            console.error('Homework listener error:', err);
            setLoading(false);
        });
        return () => unsub();
    }, [studentClass, section, schoolId, timeRange]);

    return (
        <div className="animate-fade-in no-scrollbar">
            {/* Time Filter Chips */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', padding: '0.35rem', background: 'rgba(0,0,0,0.02)', borderRadius: '1rem', width: 'fit-content' }}>
                {(['THIS_MONTH', 'LAST_MONTH', 'LIFETIME'] as const).map(range => (
                    <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        style={{
                            padding: '0.5rem 1.25rem',
                            borderRadius: '0.75rem',
                            border: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                            background: timeRange === range ? 'white' : 'transparent',
                            color: timeRange === range ? 'var(--primary)' : '#64748b',
                            boxShadow: timeRange === range ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
                            textTransform: 'uppercase'
                        }}
                    >
                        {range.replace('_', ' ')}
                    </button>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }} className="homework-grid">
                {loading ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem' }}><Loader2 className="animate-spin" size={40} color="var(--primary)" /></div>
                ) : tasks.length > 0 ? tasks.map((t, idx) => {
                    // Subject-based color palette
                    const getTheme = (subj: string) => {
                        const s = (subj || '').toLowerCase();
                        if (s.includes('math')) return { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' };
                        if (s.includes('sci')) return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
                        if (s.includes('eng')) return { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' };
                        if (s.includes('his')) return { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' };
                        return { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' };
                    };
                    const theme = getTheme(t.subject);

                    return (
                        <div key={idx} className="homework-tile animate-fade-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                            {/* Tile Header/Subject */}
                            <div className="tile-header" style={{ background: theme.bg, borderColor: theme.border }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: theme.text }}>
                                    <BookOpen size={16} />
                                    <span>{t.subject || 'General'}</span>
                                </div>
                                {(() => {
                                    const sub = submissions.find(s => s.homeworkId === t.id);
                                    const status = sub?.status || 'PENDING';
                                    const configMap: Record<string, { label: string; color: string; bg: string }> = {
                                        'COMPLETED': { label: 'Verified Done', color: '#10b981', bg: '#f0fdf4' },
                                        'PARTIAL': { label: 'Partially Done', color: '#f59e0b', bg: '#fffbeb' },
                                        'NOT_DONE': { label: 'Marked No', color: '#ef4444', bg: '#fef2f2' },
                                        'PENDING': { label: 'Pending / Unmarked', color: '#64748b', bg: '#f8fafc' }
                                    };
                                    const config = configMap[status] || { label: 'Pending', color: '#64748b', bg: '#f8fafc' };

                                    return (
                                        <div style={{
                                            padding: '0.25rem 0.6rem',
                                            borderRadius: '2rem',
                                            background: config.bg,
                                            color: config.color,
                                            fontSize: '0.6rem',
                                            fontWeight: 900,
                                            border: `1px solid ${config.color}33`,
                                            textTransform: 'uppercase'
                                        }}>
                                            {config.label}
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="tile-body">
                                <h3 className="tile-title">{t.title}</h3>
                                <p className="tile-desc">{t.description}</p>

                                <div className="tile-footer">
                                    <div className="info-row">
                                        <div className="icon-circle"><User size={14} /></div>
                                        <span>{t.teacherName || 'Admin'}</span>
                                    </div>
                                    <div className="info-row due-date">
                                        <Clock size={14} />
                                        <span>Due: {t.dueDate || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <div style={{ gridColumn: '1 / -1' }} className="empty-state">
                        <div className="empty-icon-box">
                            <ClipboardList size={48} />
                        </div>
                        <h3>All caught up!</h3>
                        <p>No pending homework assignments found for the selected period.</p>
                    </div>
                )}
            </div>

            <style>{`
                .homework-tile {
                    background: white;
                    border-radius: 1.5rem;
                    border: 1px solid #f1f5f9;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
                }
                .homework-tile:hover {
                    transform: translateY(-8px);
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.08);
                    border-color: var(--primary-light);
                }
                .tile-header {
                    padding: 0.75rem 1.25rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.6rem;
                    font-size: 0.75rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.025em;
                    border-bottom: 1px solid transparent;
                }
                .tile-body {
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                }
                .tile-title {
                    font-size: 1.125rem;
                    font-weight: 800;
                    color: #1e293b;
                    margin-bottom: 0.75rem;
                    line-height: 1.4;
                }
                .tile-desc {
                    font-size: 0.875rem;
                    color: #64748b;
                    line-height: 1.6;
                    margin-bottom: 1.5rem;
                    flex: 1;
                    display: -webkit-box;
                    -webkit-line-clamp: 3;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                .tile-footer {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    padding-top: 1.25rem;
                    border-top: 1px solid #f1f5f9;
                }
                .info-row {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    font-size: 0.8125rem;
                    font-weight: 700;
                    color: #475569;
                }
                .icon-circle {
                    width: 24px;
                    height: 24px;
                    background: #f1f5f9;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #64748b;
                }
                .due-date {
                    color: #ef4444;
                }
                
                .empty-state { text-align: center; padding: 6rem 2rem; background: #f8fafc; border-radius: 2.5rem; border: 2px dashed #e2e8f0; }
                .empty-icon-box { width: 80px; height: 80px; background: white; border-radius: 2rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; color: #cbd5e1; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
                .empty-state h3 { font-size: 1.5rem; font-weight: 900; color: #1e293b; margin-bottom: 0.5rem; }
                .empty-state p { color: #64748b; font-weight: 600; }
                
                @media (max-width: 768px) {
                    .homework-grid { grid-template-columns: 1fr; }
                    .tile-body { padding: 1.25rem; }
                }
            `}</style>
        </div>
    );
};

export default ParentHomework;
