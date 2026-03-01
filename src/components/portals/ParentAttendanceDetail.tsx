import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon } from 'lucide-react';

// Helper: format date as YYYY-MM-DD using local timezone (avoids UTC shift from toISOString)
const toLocalDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

interface Props {
    studentId: string;
}

const ParentAttendanceDetail: React.FC<Props> = ({ studentId }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [attendance, setAttendance] = useState<Record<string, string>>({});
    const [studentIdField, setStudentIdField] = useState<string | null>(null);
    const [schoolId, setSchoolId] = useState<string | null>(null);

    useEffect(() => {
        const fetchStudentData = async () => {
            try {
                const studentRef = doc(db, 'students', studentId);
                const studentSnap = await getDoc(studentRef);
                if (studentSnap.exists()) {
                    const data = studentSnap.data();
                    setStudentIdField(data.id); // Old ID field
                    setSchoolId(data.schoolId);
                }
            } catch (e) {
                console.error('Error fetching student data:', e);
            }
        };
        fetchStudentData();
    }, [studentId]);

    // Real-time attendance listener
    useEffect(() => {
        if (!schoolId) return;

        setLoading(true);
        const startOfMonth = toLocalDateStr(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
        const endOfMonth = toLocalDateStr(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0));

        const q = query(
            collection(db, 'attendance'),
            where('schoolId', '==', schoolId)
        );

        const unsub = onSnapshot(q, (snap) => {
            const data: Record<string, string> = {};
            snap.docs.forEach(d => {
                const record = d.data();
                const recordDate = record.date.split('T')[0];

                // Filter by student ID (UID or old ID) and date range client-side
                if ((record.studentId === studentId || record.studentId === studentIdField) &&
                    recordDate >= startOfMonth &&
                    recordDate <= endOfMonth) {
                    data[recordDate] = record.status;
                }
            });
            setAttendance(data);
            setLoading(false);
        }, (error) => {
            console.error('Error listening to attendance:', error);
            setLoading(false);
        });

        return () => unsub();
    }, [currentDate, studentId, studentIdField, schoolId]);

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

    const changeMonth = (offset: number) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    };

    return (
        <div className="glass-card animate-fade-in" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', background: '#f8fafc' }} className="mobile-p-15">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CalendarIcon size={20} />
                    </div>
                    <h3 style={{ fontWeight: 900, color: '#1e293b', fontSize: '1.1rem' }}>Attendance</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.4rem 0.6rem', borderRadius: '1rem', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                    <button onClick={() => changeMonth(-1)} className="btn-icon-s" style={{ minWidth: '30px', minHeight: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={18} /></button>
                    <span style={{ fontWeight: 800, fontSize: '0.875rem', minWidth: '100px', textAlign: 'center', color: '#1e293b' }}>
                        {currentDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                    </span>
                    <button onClick={() => changeMonth(1)} className="btn-icon-s" style={{ minWidth: '30px', minHeight: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={18} /></button>
                </div>
            </div>

            <div style={{ padding: '2rem' }} className="mobile-p-1">
                {loading && Object.keys(attendance).length === 0 ? (
                    <div style={{ padding: '4rem', textAlign: 'center' }}><Loader2 className="animate-spin" color="var(--primary)" /></div>
                ) : (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', textAlign: 'center', marginBottom: '1rem' }}>
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                                <div key={`weekday-${idx}`} style={{ fontSize: '0.7rem', fontWeight: 900, color: '#94a3b8', padding: '0.5rem 0' }}>{d}</div>
                            ))}

                            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                                <div key={`empty-${i}`} />
                            ))}

                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1;
                                const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const status = attendance[dateStr];

                                return (
                                    <div key={day} style={{
                                        aspectRatio: '1',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '0.85rem',
                                        fontSize: '0.875rem',
                                        fontWeight: 800,
                                        background: status === 'PRESENT' ? '#ecfdf5' : status === 'ABSENT' ? '#fef2f2' : status === 'LATE' ? '#fffbeb' : 'transparent',
                                        color: status === 'PRESENT' ? '#10b981' : status === 'ABSENT' ? '#ef4444' : status === 'LATE' ? '#f59e0b' : '#64748b',
                                        border: '1px solid',
                                        borderColor: status ? 'transparent' : '#f1f5f9',
                                        position: 'relative',
                                        transition: 'all 0.2s'
                                    }}>
                                        {day}
                                        {status && (
                                            <div style={{
                                                width: '4px',
                                                height: '4px',
                                                borderRadius: '50%',
                                                background: status === 'PRESENT' ? '#10b981' : status === 'ABSENT' ? '#ef4444' : '#f59e0b',
                                                position: 'absolute',
                                                bottom: '6px'
                                            }} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
                            <LegendItem color="#10b981" label="Present" />
                            <LegendItem color="#ef4444" label="Absent" />
                            <LegendItem color="#f59e0b" label="Late" />
                            <LegendItem color="#cbd5e1" label="No Data" />
                        </div>
                    </>
                )}
            </div>

            <style>{`
                .btn-icon-s {
                    background: transparent;
                    border: none;
                    padding: 0.25rem;
                    cursor: pointer;
                    color: #64748b;
                    display: flex;
                    align-items: center;
                }
                .btn-icon-s:hover { color: var(--primary); }
                @media (max-width: 768px) {
                    .mobile-p-15 { padding: 1rem 1.5rem !important; }
                    .mobile-p-1 { padding: 1.25rem !important; }
                }
            `}</style>
        </div>
    );
};

const LegendItem = ({ color, label }: any) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} /> {label}
    </div>
);

export default ParentAttendanceDetail;
