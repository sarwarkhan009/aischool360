import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Calendar, Clock, Loader2, BookOpen, AlertCircle, Info, MapPin, FileText, AlertTriangle } from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';

interface Props {
    studentClass: string;
    section: string;
}

const ParentTimetable: React.FC<Props> = ({ studentClass, section }) => {
    const { currentSchool } = useSchool();
    const [regularTimetable, setRegularTimetable] = useState<any>(null);
    const [examTimetable, setExamTimetable] = useState<any[]>([]);
    const [ongoingExams, setOngoingExams] = useState<any[]>([]);
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
            // 1. Fetch Regular Timetable
            const routineRef = doc(db, 'settings', `school_routine_${currentSchool.id}`);
            const routineSnap = await getDoc(routineRef);

            if (routineSnap.exists()) {
                const routines = routineSnap.data().routines || [];
                const myRoutine = routines.find((r: any) =>
                    r.className === studentClass ||
                    (section && r.className === `${studentClass}-${section}`) ||
                    r.className.toLowerCase() === studentClass.toLowerCase()
                );

                if (myRoutine) {
                    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    const schedule = myRoutine.schedule || {};
                    let maxPeriods = 0;
                    days.forEach(day => {
                        const count = (schedule[day] || []).length;
                        if (count > maxPeriods) maxPeriods = count;
                    });

                    const periods: any[] = [];
                    for (let i = 0; i < maxPeriods; i++) {
                        const periodObj: any = {
                            time: '',
                            monday: {}, tuesday: {}, wednesday: {}, thursday: {}, friday: {}, saturday: {}
                        };

                        days.forEach(day => {
                            const p = (schedule[day] || [])[i];
                            if (p) {
                                if (!periodObj.time && p.startTime) {
                                    periodObj.time = `${p.startTime} - ${p.endTime}`;
                                }
                                periodObj[day.toLowerCase()] = {
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
                    const legacyRef = doc(db, 'timetables', `${studentClass}_${section || 'ALL'}`);
                    const legacySnap = await getDoc(legacyRef);
                    if (legacySnap.exists()) setRegularTimetable(legacySnap.data());
                }
            }

            // 2. Fetch all Possible IDs for this Class Name
            const settingsQuery = query(
                collection(db, 'settings'),
                where('schoolId', '==', currentSchool.id),
                where('type', '==', 'class')
            );
            const settingsSnap = await getDocs(settingsQuery);
            const classNameToIds = new Map<string, string[]>();

            settingsSnap.docs.forEach(d => {
                const data = d.data();
                if (data.name) {
                    const name = data.name.trim().toLowerCase();
                    const ids = classNameToIds.get(name) || [];
                    classNameToIds.set(name, [...ids, d.id]);
                }
            });

            const normClass = studentClass?.trim().toLowerCase();
            const myIds = classNameToIds.get(normClass) || [];
            const matchCriteria = [...myIds, studentClass, normClass];

            // 3. Fetch Exams
            const examsColRef = collection(db, 'exams');
            const examQuery = query(examsColRef, where('schoolId', '==', currentSchool.id));
            const examSnap = await getDocs(examQuery);
            const allExamsData = examSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

            const myExams = allExamsData.filter(exam => {
                if (exam.status === 'COMPLETED' || exam.status === 'CANCELLED') return false;
                if (!exam.isPublished && exam.status !== 'ONGOING' && exam.status !== 'SCHEDULED') return false;
                if (!exam.targetClasses) return false;
                return exam.targetClasses.some((tId: string) =>
                    matchCriteria.includes(tId) ||
                    (typeof tId === 'string' && tId.toLowerCase() === normClass)
                );
            });

            const flattenedSchedule: any[] = [];
            const ongoingExamsList: any[] = [];

            myExams.forEach(exam => {
                const myRoutine = (exam.classRoutines || []).find((cr: any) =>
                    matchCriteria.includes(cr.classId) ||
                    matchCriteria.includes(cr.className) ||
                    (cr.className && cr.className.trim().toLowerCase() === normClass)
                );

                let hasSubjectDates = false;
                const source = (myRoutine?.routine?.length > 0) ? myRoutine.routine : (exam.subjects || []);

                source.forEach((entry: any) => {
                    if (entry.examDate) {
                        hasSubjectDates = true;
                        flattenedSchedule.push({
                            id: `${exam.id}_${entry.subjectId || Math.random()}`,
                            examName: exam.displayName || exam.name,
                            subject: entry.subjectName + (entry.combinedSubjects?.length ? ` + ${entry.combinedSubjects.join(' + ')}` : ''),
                            date: entry.examDate,
                            time: entry.examTime,
                            duration: entry.duration,
                            venue: entry.venue,
                            examType: exam.assessmentTypeName || 'Regular'
                        });
                    }
                });

                if (exam.status === 'ONGOING' || exam.status === 'SCHEDULED') {
                    const classRoutine = (exam.classRoutines || []).find((cr: any) =>
                        matchCriteria.includes(cr.classId) ||
                        matchCriteria.includes(cr.className) ||
                        (cr.className && cr.className.trim().toLowerCase() === normClass)
                    );
                    const subjectCount = classRoutine?.routine?.length || exam.subjects?.length || 0;

                    ongoingExamsList.push({
                        id: exam.id,
                        name: exam.displayName || exam.name,
                        type: exam.assessmentTypeName || 'Exam',
                        status: exam.status,
                        startDate: exam.startDate,
                        endDate: exam.endDate,
                        subjectCount,
                        hasSubjectDates,
                        instructions: exam.instructions
                    });
                }
            });

            flattenedSchedule.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setExamTimetable(flattenedSchedule);
            setOngoingExams(ongoingExamsList);
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
                    {ongoingExams.length > 0 && (
                        <span className="badge-count">{ongoingExams.length}</span>
                    )}
                </button>
            </div>

            <div className="timetable-content">
                {loading ? (
                    <div className="loader-container"><Loader2 className="animate-spin" size={40} /></div>
                ) : activeTab === 'REGULAR' ? (
                    regularTimetable ? (
                        <div className="regular-view">
                            <div className="scroll-hint">
                                <Info size={14} /> Scroll horizontally to see full week
                            </div>
                            <div className="table-wrapper">
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <th>Time</th>
                                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <th key={d}>{d}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(regularTimetable.periods || []).map((p: any, idx: number) => {
                                            const isRecess = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].some(
                                                day => p[day]?.subject?.toLowerCase().includes('recess')
                                            );
                                            return (
                                                <tr key={idx}>
                                                    <td className="period-cell">
                                                        <div className="time-box"><Clock size={12} /> {p.time}</div>
                                                        {!isRecess && <span className="period-num">#{idx + 1}</span>}
                                                    </td>
                                                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map(day => (
                                                        <td key={day} className="subject-cell">
                                                            {p[day]?.subject ? (
                                                                <div className="subject-info">
                                                                    <p className="sub-title">{p[day].subject}</p>
                                                                    <p className="sub-teacher">{p[day].teacher}</p>
                                                                </div>
                                                            ) : <span className="empty-period">-</span>}
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
                        </div>
                    )
                ) : (
                    <div className="exam-tab-content">
                        {ongoingExams.map((exam, idx) => (
                            <div key={idx} className={`exam-banner ${exam.status.toLowerCase()}`}>
                                <div className="banner-icon">
                                    {exam.status === 'ONGOING' ? <AlertTriangle size={24} /> : <Calendar size={24} />}
                                </div>
                                <div className="banner-details">
                                    <div className="banner-tags">
                                        <span className="status-tag">{exam.status}</span>
                                        <span className="type-tag">{exam.type}</span>
                                    </div>
                                    <h4>{exam.name}</h4>
                                    <div className="banner-meta">
                                        <span><Calendar size={12} /> {new Date(exam.startDate).toLocaleDateString()}</span>
                                        <span><FileText size={12} /> {exam.subjectCount} Subjects</span>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div className="exam-grid">
                            {examTimetable.map((e, idx) => (
                                <div key={idx} className="exam-card">
                                    <div className="date-badge">
                                        <span className="date-num">{new Date(e.date).getDate()}</span>
                                        <span className="date-month">{new Date(e.date).toLocaleDateString('en-IN', { month: 'short' })}</span>
                                    </div>
                                    <div className="exam-info">
                                        <div className="info-top">
                                            <span className="info-tag">{e.examType}</span>
                                            <span className="info-day">{new Date(e.date).toLocaleDateString('en-IN', { weekday: 'long' })}</span>
                                        </div>
                                        <h4>{e.subject}</h4>
                                        <p className="info-exam-name">{e.examName}</p>
                                        <div className="info-meta">
                                            <span className="meta-time"><Clock size={12} /> {e.time}</span>
                                            {e.venue && <span className="meta-venue"><MapPin size={12} /> {e.venue}</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {examTimetable.length === 0 && ongoingExams.length === 0 && (
                            <div className="empty-state">
                                <Calendar size={48} />
                                <h3>No Exams Scheduled</h3>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                .timetable-container { width: 100%; font-family: 'Inter', system-ui, sans-serif; }
                .tab-switcher { display: flex; gap: 0.5rem; background: #f1f5f9; padding: 0.4rem; border-radius: 1rem; margin-bottom: 2rem; max-width: 400px; }
                .tab-link { flex: 1; border: none; padding: 0.75rem; border-radius: 0.75rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s; background: transparent; color: #64748b; font-size: 0.85rem; }
                .tab-link.active { background: white; color: #4f46e5; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
                .badge-count { background: #ef4444; color: white; font-size: 0.65rem; padding: 0.1rem 0.4rem; border-radius: 1rem; }
                
                .loader-container { padding: 5rem; text-align: center; color: #4f46e5; }
                .table-wrapper { overflow-x: auto; background: white; border-radius: 1rem; border: 1px solid #e2e8f0; }
                .premium-table { width: 100%; border-collapse: collapse; min-width: 800px; }
                .premium-table th { padding: 1rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 0.75rem; color: #64748b; text-transform: uppercase; }
                .premium-table td { padding: 1rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
                .period-cell { background: #f8fafc; width: 120px; border-right: 1px solid #e2e8f0; }
                .time-box { display: flex; align-items: center; gap: 0.3rem; color: #4f46e5; font-weight: 700; font-size: 0.8rem; }
                .period-num { font-size: 0.65rem; color: #94a3b8; font-weight: 600; }
                .sub-title { font-weight: 700; color: #1e293b; margin: 0; font-size: 0.9rem; }
                .sub-teacher { font-size: 0.75rem; color: #64748b; margin: 0; }
                
                .exam-banner { display: flex; gap: 1rem; padding: 1.25rem; border-radius: 1rem; margin-bottom: 1rem; border: 1px solid transparent; }
                .exam-banner.ongoing { background: #fffbeb; border-color: #fcd34d; color: #92400e; }
                .exam-banner.scheduled { background: #eff6ff; border-color: #bfdbfe; color: #1e40af; }
                .banner-icon { width: 48px; height: 48px; border-radius: 0.75rem; display: flex; align-items: center; justify-content: center; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                .banner-tags { display: flex; gap: 0.5rem; margin-bottom: 0.25rem; }
                .status-tag { font-size: 0.6rem; font-weight: 800; text-transform: uppercase; padding: 0.1rem 0.4rem; border-radius: 0.3rem; background: currentColor; color: white; }
                .banner-meta { display: flex; gap: 1rem; font-size: 0.75rem; font-weight: 600; opacity: 0.8; }
                
                .exam-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; margin-top: 2rem; }
                .exam-card { display: flex; gap: 1rem; padding: 1.25rem; background: white; border-radius: 1rem; border: 1px solid #e2e8f0; transition: transform 0.2s; }
                .exam-card:hover { transform: translateY(-2px); border-color: #4f46e5; }
                .date-badge { width: 60px; height: 60px; background: #4f46e5; color: white; border-radius: 0.75rem; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
                .date-num { font-size: 1.25rem; font-weight: 800; }
                .date-month { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; }
                .info-top { display: flex; justify-content: space-between; font-size: 0.65rem; font-weight: 700; color: #94a3b8; margin-bottom: 0.25rem; }
                .info-tag { color: #4f46e5; text-transform: uppercase; }
                .exam-info h4 { margin: 0 0 0.25rem; font-size: 1rem; color: #1e293b; }
                .info-exam-name { font-size: 0.75rem; color: #64748b; margin: 0 0 0.75rem; font-weight: 500; }
                .info-meta { display: flex; gap: 0.75rem; font-size: 0.75rem; font-weight: 600; color: #64748b; }
                
                .empty-state { text-align: center; padding: 4rem; background: #f8fafc; border-radius: 1.5rem; border: 2px dashed #e2e8f0; color: #94a3b8; }
                @media (max-width: 640px) { .exam-banner { flex-direction: column; text-align: center; align-items: center; } }
            `}</style>
        </div>
    );
};

export default ParentTimetable;
