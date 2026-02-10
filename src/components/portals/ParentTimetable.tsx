import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Calendar, Clock, Loader2, BookOpen, AlertCircle, Info } from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';

interface Props {
    studentClass: string;
    section: string;
}

const ParentTimetable: React.FC<Props> = ({ studentClass, section }) => {
    const { currentSchool } = useSchool();
    const [regularTimetable, setRegularTimetable] = useState<any>(null);
    const [examTimetable, setExamTimetable] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'REGULAR' | 'EXAMS'>('REGULAR');

    useEffect(() => {
        if (studentClass && currentSchool?.id) {
            fetchTimetables();
        }
    }, [studentClass, section, currentSchool?.id]);

    const fetchTimetables = async () => {
        if (!currentSchool?.id) return;
        setLoading(true);
        try {
            // 1. Fetch Regular Timetable from global school routine
            const routineRef = doc(db, 'settings', `school_routine_${currentSchool.id}`);
            const routineSnap = await getDoc(routineRef);

            if (routineSnap.exists()) {
                const routines = routineSnap.data().routines || [];
                // Match class (could be "Class 4" or "Class 4-A")
                const myRoutine = routines.find((r: any) =>
                    r.className === studentClass ||
                    (section && r.className === `${studentClass}-${section}`) ||
                    r.className.toLowerCase() === studentClass.toLowerCase()
                );

                if (myRoutine) {
                    // Transform day-major to period-major for existing UI
                    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    const schedule = myRoutine.schedule || {};

                    // Find max periods across all days
                    let maxPeriods = 0;
                    days.forEach(day => {
                        const count = (schedule[day] || []).length;
                        if (count > maxPeriods) maxPeriods = count;
                    });

                    const periods: any[] = [];
                    for (let i = 0; i < maxPeriods; i++) {
                        const periodObj: any = {
                            time: '', // Will get from first available day
                            monday: {}, tuesday: {}, wednesday: {}, thursday: {}, friday: {}, saturday: {}
                        };

                        days.forEach(day => {
                            const dayLower = day.toLowerCase();
                            const p = (schedule[day] || [])[i];
                            if (p) {
                                if (!periodObj.time && p.startTime) {
                                    periodObj.time = `${p.startTime} - ${p.endTime}`;
                                }
                                periodObj[dayLower] = {
                                    subject: p.subject,
                                    teacher: p.teacher,
                                    type: p.type
                                };
                            }
                        });
                        periods.push(periodObj);
                    }
                    setRegularTimetable({ periods });
                } else {
                    // Fallback to legacy location if not found in global
                    const legacyRef = doc(db, 'timetables', `${studentClass}_${section || 'ALL'}`);
                    const legacySnap = await getDoc(legacyRef);
                    if (legacySnap.exists()) setRegularTimetable(legacySnap.data());
                }
            }

            // 2. Fetch Exam Timetable
            const hRef = collection(db, 'exam_timetables');
            const q = query(hRef, where('class', '==', studentClass));
            const snap = await getDocs(q);
            const exams = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            exams.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setExamTimetable(exams);
        } catch (e) {
            console.error('Error fetching timetable:', e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="timetable-container animate-fade-in">
            <div className="tab-switcher">
                <button
                    onClick={() => setActiveTab('REGULAR')}
                    className={`tab-link ${activeTab === 'REGULAR' ? 'active' : ''}`}
                >
                    <BookOpen size={18} /> Class Schedule
                </button>
                <button
                    onClick={() => setActiveTab('EXAMS')}
                    className={`tab-link ${activeTab === 'EXAMS' ? 'active' : ''}`}
                >
                    <Calendar size={18} /> Exam Dates
                </button>
            </div>

            <div className="timetable-content">
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '5rem' }}><Loader2 className="animate-spin" size={40} color="var(--primary)" /></div>
                ) : activeTab === 'REGULAR' ? (
                    regularTimetable ? (
                        <div className="regular-view">
                            <div className="scroll-hint">
                                <Info size={14} /> Scroll horizontally or swipe to see the full week
                            </div>
                            <div className="table-wrapper">
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <th>Time</th>
                                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                                <th key={d}>{d}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(regularTimetable.periods || []).map((p: any, idx: number) => {
                                            // Check if this is a recess period by checking any day
                                            const isRecess = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].some(
                                                day => p[day]?.subject?.toLowerCase().includes('recess')
                                            );

                                            // Calculate period number by counting non-Recess periods before this one
                                            const periodNumber = regularTimetable.periods
                                                .slice(0, idx)
                                                .filter((prev: any) => !['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].some(
                                                    day => prev[day]?.subject?.toLowerCase().includes('recess')
                                                ))
                                                .length + 1;

                                            return (
                                                <tr key={idx}>
                                                    <td className="period-cell">
                                                        <div className="time-box">
                                                            <Clock size={12} /> {p.time}
                                                        </div>
                                                        {!isRecess && <span className="period-num">#{periodNumber}</span>}
                                                    </td>
                                                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map(day => (
                                                        <td key={day} className="subject-cell">
                                                            {p[day]?.subject ? (
                                                                <div className="subject-info">
                                                                    <p className="sub-title">{p[day].subject}</p>
                                                                    <p className="sub-teacher">{p[day].teacher}</p>
                                                                </div>
                                                            ) : (
                                                                <span className="empty-period">-</span>
                                                            )}
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <AlertCircle size={48} />
                            <h3>No Schedule Found</h3>
                            <p>Class schedule hasn't been shared yet.</p>
                        </div>
                    )
                ) : (
                    examTimetable.length > 0 ? (
                        <div className="exam-view">
                            {examTimetable.map((e, idx) => (
                                <div key={idx} className="exam-card glass-card">
                                    <div className="date-badge">
                                        <span className="date-num">{new Date(e.date).getDate()}</span>
                                        <span className="date-month">{new Date(e.date).toLocaleDateString('en-IN', { month: 'short' })}</span>
                                    </div>
                                    <div className="exam-details">
                                        <div className="exam-type-row">
                                            <span className="type-tag">{e.examType || 'Regular'}</span>
                                            <span className="day-text">{new Date(e.date).toLocaleDateString('en-IN', { weekday: 'long' })}</span>
                                        </div>
                                        <h4 className="exam-subject">{e.subject}</h4>
                                        <div className="exam-meta-row">
                                            <div className="meta-item"><Clock size={14} /> {e.time || '10:00 AM'}</div>
                                            {e.roomNo && <div className="meta-item">Room {e.roomNo}</div>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <Calendar size={48} />
                            <h3>No Exams Scheduled</h3>
                            <p>Great! No upcoming exams at the moment.</p>
                        </div>
                    )
                )}
            </div>

            <style>{`
                .timetable-container { width: 100%; }
                .tab-switcher { display: flex; gap: 0.5rem; background: #f1f5f9; padding: 0.4rem; borderRadius: 1rem; margin-bottom: 2rem; maxWidth: 500px; }
                .tab-link { flex: 1; border: none; padding: 0.85rem; borderRadius: 0.75rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.6rem; transition: all 0.3s; background: transparent; color: #64748b; font-size: 0.85rem; }
                .tab-link.active { background: white; color: var(--primary); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
                
                .scroll-hint { padding: 0.5rem 1rem; background: #eff6ff; color: #3b82f6; borderRadius: 0.75rem; font-size: 0.7rem; font-weight: 700; margin-bottom: 1rem; display: none; align-items: center; gap: 0.5rem; }
                .table-wrapper { overflow-x: auto; background: white; borderRadius: 1.5rem; border: 1px solid #f1f5f9; }
                .premium-table { width: 100%; border-collapse: collapse; minWidth: 900px; }
                .premium-table th { padding: 1.25rem; background: #f8fafc; border-bottom: 1px solid #f1f5f9; text-align: left; font-size: 0.75rem; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
                .premium-table td { padding: 1.25rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
                .period-cell { background: #f8fafc; border-right: 1px solid #f1f5f9; width: 140px; }
                .time-box { display: flex; align-items: center; gap: 0.4rem; color: var(--primary); font-weight: 900; font-size: 0.85rem; margin-bottom: 0.25rem; }
                .period-num { font-size: 0.65rem; font-weight: 900; color: #94a3b8; display: block; }
                
                .sub-title { font-weight: 900; color: #1e293b; font-size: 0.9375rem; margin-bottom: 0.2rem; }
                .sub-teacher { font-size: 0.75rem; fontWeight: 700; color: #94a3b8; }
                .empty-period { color: #e2e8f0; font-size: 0.9rem; }
                
                .exam-view { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }
                .exam-card { display: flex; gap: 1.5rem; padding: 1.5rem; border: 1px solid #f1f5f9; transition: all 0.3s; }
                .exam-card:hover { transform: scale(1.02); border-color: var(--primary); }
                .date-badge { min-width: 80px; height: 80px; background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%); borderRadius: 1.25rem; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; box-shadow: 0 10px 15px -3px rgba(99,102,241,0.25); }
                .date-num { font-size: 1.75rem; font-weight: 900; line-height: 1; }
                .date-month { font-size: 0.7rem; font-weight: 900; text-transform: uppercase; opacity: 0.8; margin-top: 0.1rem; }
                
                .exam-details { flex: 1; }
                .exam-type-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; }
                .type-tag { font-size: 0.65rem; font-weight: 900; padding: 0.2rem 0.5rem; background: rgba(99,102,241,0.1); color: #6366f1; borderRadius: 0.4rem; text-transform: uppercase; }
                .day-text { font-size: 0.75rem; fontWeight: 700; color: #94a3b8; }
                .exam-subject { font-size: 1.15rem; font-weight: 900; color: #1e293b; margin-bottom: 0.75rem; }
                .exam-meta-row { display: flex; gap: 1.25rem; }
                .meta-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; font-weight: 800; color: #64748b; }
                
                .empty-state { text-align: center; padding: 6rem 2rem; background: #f8fafc; border-radius: 2.5rem; border: 2px dashed #e2e8f0; }
                
                @media (max-width: 992px) {
                    .scroll-hint { display: flex; }
                }
                @media (max-width: 768px) {
                    .tab-switcher { max-width: 100%; }
                    .exam-card { padding: 1.25rem; }
                    .date-badge { min-width: 70px; height: 70px; }
                    .date-num { font-size: 1.5rem; }
                }
            `}</style>
        </div>
    );
};

export default ParentTimetable;
