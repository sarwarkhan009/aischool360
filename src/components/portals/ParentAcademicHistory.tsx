import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Trophy, BookOpen, Download, Loader2, Award, Star } from 'lucide-react';

interface Props {
    studentId: string;
}

const ParentAcademicHistory: React.FC<Props> = ({ studentId }) => {
    const [marks, setMarks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Real-time listener for exam marks
    useEffect(() => {
        if (!studentId) return;
        setLoading(true);

        const idsToCheck = [studentId];
        // If studentId contains underscore, also check the part before it
        if (studentId.includes('_')) {
            idsToCheck.push(studentId.split('_')[0]);
        }

        const q = query(
            collection(db, 'exam_marks'),
            where('studentId', 'in', idsToCheck)
        );
        const unsub = onSnapshot(q, (snap) => {
            let marksList = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            // Sort in memory
            marksList.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
            setMarks(marksList);
            setLoading(false);
        }, (err) => {
            console.error('Exam marks listener error:', err);
            setLoading(false);
        });
        return () => unsub();
    }, [studentId]);

    const groupedMarks = marks.reduce((acc: any, mark: any) => {
        const examName = mark.examName || 'Internal Assessment';
        if (!acc[examName]) acc[examName] = [];
        acc[examName].push(mark);
        return acc;
    }, {});

    return (
        <div className="academic-history-container animate-fade-in">
            {loading ? (
                <div style={{ textAlign: 'center', padding: '5rem' }}><Loader2 className="animate-spin" color="var(--primary)" /></div>
            ) : Object.keys(groupedMarks).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                    {Object.entries(groupedMarks).map(([examName, examMarks]: [string, any]) => {
                        const totalMarks = examMarks.reduce((sum: number, m: any) => sum + parseFloat(m.marksObtained || 0), 0);
                        const totalMax = examMarks.reduce((sum: number, m: any) => sum + parseFloat(m.maxMarks || 0), 0);
                        const avgPercent = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0;

                        return (
                            <div key={examName} className="exam-section">
                                <div className="exam-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div className="exam-icon-badge">
                                            <Trophy size={20} />
                                        </div>
                                        <div>
                                            <h4 className="exam-title">{examName}</h4>
                                            <p className="exam-meta">Scored {avgPercent}% Overall</p>
                                        </div>
                                    </div>
                                    <button className="btn-download-premium">
                                        <Download size={16} /> <span className="hide-mobile">Full Report</span>
                                    </button>
                                </div>

                                <div className="subject-grid">
                                    {examMarks.map((m: any, idx: number) => (
                                        <div key={idx} className="glass-card subject-card" style={{ padding: '1.5rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span className="subject-name">{m.subject}</span>
                                                    <span className="grade-pill">Grade {m.grade || 'N/A'}</span>
                                                </div>
                                                <div className="score-badge" style={{
                                                    padding: '0.35rem 0.75rem',
                                                    borderRadius: '0.75rem',
                                                    fontWeight: 900,
                                                    fontSize: '0.875rem',
                                                    background: parseFloat(m.percentage) > 85 ? '#ccfbf1' : parseFloat(m.percentage) > 60 ? '#e0e7ff' : '#ffedd5',
                                                    color: parseFloat(m.percentage) > 85 ? '#0f766e' : parseFloat(m.percentage) > 60 ? '#4338ca' : '#9a3412'
                                                }}>
                                                    {m.percentage}%
                                                </div>
                                            </div>

                                            <div className="performance-track">
                                                <div className="track-rail">
                                                    <div className="track-fill" style={{
                                                        width: `${m.percentage}%`,
                                                        background: parseFloat(m.percentage) > 85 ? '#10b981' : parseFloat(m.percentage) > 60 ? '#6366f1' : '#f59e0b'
                                                    }} />
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>Marks: <b>{m.marksObtained}/{m.maxMarks}</b></span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)' }}>
                                                    <Star size={12} fill="currentColor" />
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 900 }}>{parseFloat(m.percentage) > 90 ? 'Excellent' : parseFloat(m.percentage) > 75 ? 'Very Good' : 'Good'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-icon-box">
                        <Award size={48} />
                    </div>
                    <h3>No results found</h3>
                    <p>Academic performance records will appear here once examinations are graded.</p>
                </div>
            )}

            <style>{`
                .academic-history-container { width: 100%; }
                .exam-section { background: white; border-radius: 2rem; border: 1px solid #f1f5f9; overflow: hidden; }
                .exam-header { padding: 1.5rem 2rem; background: #f8fafc; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
                .exam-icon-badge { width: 44px; height: 44px; background: #fffbeb; color: #f59e0b; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 1px solid #fef3c7; }
                .exam-title { font-weight: 900; font-size: 1.15rem; color: #1e293b; margin: 0; }
                .exam-meta { font-size: 0.8rem; font-weight: 700; color: #64748b; }
                
                .btn-download-premium { display: flex; align-items: center; gap: 0.6rem; padding: 0.75rem 1.25rem; background: var(--primary); color: white; border: none; border-radius: 1rem; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 10px rgba(99,102,241,0.2); }
                .btn-download-premium:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(99,102,241,0.3); }
                
                .subject-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; padding: 2rem; }
                .subject-card { border: 1px solid #f1f5f9; transition: all 0.3s; }
                .subject-card:hover { transform: translateY(-5px); border-color: var(--primary-glow); box-shadow: 0 15px 30px -10px rgba(0,0,0,0.05); }
                
                .subject-name { font-weight: 900; color: #1e293b; font-size: 1rem; }
                .grade-pill { font-size: 0.7rem; font-weight: 900; color: #94a3b8; text-transform: uppercase; margin-top: 0.2rem; }
                
                .performance-track { margin: 1.25rem 0; }
                .track-rail { height: 6px; background: #f1f5f9; border-radius: 10px; overflow: hidden; }
                .track-fill { height: 100%; border-radius: 10px; transition: width 1s cubic-bezier(0.17, 0.67, 0.83, 0.67); }
                
                .empty-state { text-align: center; padding: 6rem 2rem; background: #f8fafc; border-radius: 2.5rem; border: 2px dashed #e2e8f0; }
                .empty-icon-box { width: 80px; height: 80px; background: white; border-radius: 2rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; color: #cbd5e1; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
                .empty-state h3 { font-size: 1.5rem; font-weight: 900; color: #1e293b; margin-bottom: 0.5rem; }
                .empty-state p { color: #64748b; font-weight: 600; }
            `}</style>
        </div>
    );
};

export default ParentAcademicHistory;
