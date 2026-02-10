import React, { useState, useEffect } from 'react';
import {
    Search,
    CheckCircle2,
    XCircle,
    Clock,
    Save,
} from 'lucide-react';
import { useFirestore } from '../hooks/useFirestore';
import { db } from '../lib/firebase';
import { doc, writeBatch, where } from 'firebase/firestore';
import { getActiveClasses } from '../constants/app';
import { useSchool } from '../context/SchoolContext';

const Attendance: React.FC = () => {
    const { currentSchool } = useSchool();
    const { data: allSettings } = useFirestore<any>('settings');
    const activeClasses = getActiveClasses(allSettings?.filter((d: any) => d.type === 'class') || []);

    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (activeClasses.length > 0 && !selectedClass) {
            setSelectedClass(activeClasses[0]?.name || '');
        }
    }, [activeClasses]);

    // Get sections for selected class
    const selectedClassData = activeClasses.find((c: any) => c.name === selectedClass);
    const availableSections = selectedClassData?.sections || [];

    // Reset section when class changes
    useEffect(() => {
        setSelectedSection('');
    }, [selectedClass]);

    // Build where clauses for filtering students
    const whereConditions = [where('class', '==', selectedClass)];
    if (selectedSection) {
        whereConditions.push(where('section', '==', selectedSection));
    }

    // Fetch existing attendance for this date and class to show previous records
    const attendanceWhere = [
        where('date', '==', attendanceDate),
        where('class', '==', selectedClass)
    ];
    if (selectedSection) attendanceWhere.push(where('section', '==', selectedSection));

    // Fetch students for the selected class (and section if specified) from Firestore
    const { data: students, loading: loadingStudents } = useFirestore<any>('students', whereConditions);
    const { data: existingRecords, loading: loadingExisting } = useFirestore<any>('attendance', attendanceWhere);

    const loading = loadingStudents || loadingExisting;

    // Manage current session attendance state locally before saving
    const [localAttendance, setLocalAttendance] = useState<any[]>([]);

    useEffect(() => {
        if (!loading && students.length > 0) {
            setLocalAttendance(students.map(s => {
                // Find existing record for this student
                const existing = existingRecords.find((r: any) => r.studentId === s.id);

                return {
                    id: s.id,
                    name: s.fullName,
                    class: s.class,
                    section: s.section,
                    rollNo: s.classRollNo,
                    admissionNo: s.admissionNo || s.id,
                    status: existing ? existing.status : 'PRESENT'
                };
            }));
        }
    }, [students, existingRecords, loading]);

    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredAttendance = localAttendance.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSaveAttendance = async () => {
        if (!selectedClass) {
            alert('Please select a class');
            return;
        }

        if (localAttendance.length === 0) {
            alert('No students found to mark attendance');
            return;
        }

        setSaving(true);
        setSaveStatus(null);
        try {
            const batch = writeBatch(db);
            const dateStr = attendanceDate;
            const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' });

            localAttendance.forEach(record => {
                const docId = `att_${record.id}_${dateStr}`;
                const attRef = doc(db, 'attendance', docId);

                batch.set(attRef, {
                    studentId: record.id,
                    studentName: record.name,
                    admissionNo: record.admissionNo,
                    class: record.class,
                    section: record.section || '',
                    date: dateStr,
                    day: dayName,
                    status: record.status,
                    markedBy: 'Admin',
                    markedAt: new Date().toISOString(),
                    schoolId: currentSchool?.id
                }, { merge: true });
            });

            await batch.commit();
            setSaveStatus({ type: 'success', message: `Attendance for ${selectedClass} saved successfully!` });
            setTimeout(() => setSaveStatus(null), 3000);
        } catch (error) {
            console.error('Error saving attendance:', error);
            setSaveStatus({ type: 'error', message: 'Failed to save attendance.' });
        } finally {
            setSaving(false);
        }
    };

    const stats = {
        total: localAttendance.length,
        present: localAttendance.filter(s => s.status === 'PRESENT').length,
        absent: localAttendance.filter(s => s.status === 'ABSENT').length,
        late: localAttendance.filter(s => s.status === 'LATE').length
    };

    const toggleStatus = (id: string, newStatus: string) => {
        setLocalAttendance(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
    };

    const markAllPresent = () => {
        setLocalAttendance(prev => prev.map(s => ({ ...s, status: 'PRESENT' })));
    };

    return (
        <div className="animate-fade-in no-scrollbar">
            <div className="page-header">
                <div>
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.025em' }}>Attendance</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.0625rem' }}>Roll call for {selectedClass}{selectedSection ? ` - Section ${selectedSection}` : ''}</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }} className="mobile-full-width">
                    <div className="input-group" style={{ marginBottom: 0, flex: 1, minWidth: '150px' }}>
                        <input
                            type="date"
                            className="input-field"
                            style={{ height: '3rem' }}
                            value={attendanceDate}
                            onChange={(e) => setAttendanceDate(e.target.value)}
                        />
                    </div>
                    <div className="input-group" style={{ marginBottom: 0, flex: 1, minWidth: '150px' }}>
                        <select
                            className="input-field"
                            style={{ height: '3rem' }}
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                        >
                            <option value="">Select Class</option>
                            {activeClasses.map(cls => (
                                <option key={cls.name} value={cls.name}>{cls.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="input-group" style={{ marginBottom: 0, flex: 1, minWidth: '130px' }}>
                        <select
                            className="input-field"
                            style={{ height: '3rem' }}
                            value={selectedSection}
                            onChange={(e) => setSelectedSection(e.target.value)}
                            disabled={!selectedClass || availableSections.length === 0}
                        >
                            <option value="">All Sections</option>
                            {availableSections.map((sec: string) => (
                                <option key={sec} value={sec}>{sec}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {saveStatus && (
                <div className={`animate-slide-up`} style={{
                    padding: '1rem 1.5rem',
                    borderRadius: '0.75rem',
                    marginBottom: '1.5rem',
                    background: saveStatus.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                    color: saveStatus.type === 'success' ? '#10b981' : '#f43f5e',
                    border: `1px solid ${saveStatus.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontWeight: 600
                }}>
                    {saveStatus.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                    {saveStatus.message}
                </div>
            )}

            {/* Stats Summary */}
            <div className="responsive-grid-auto" style={{ gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div className="glass-card animate-slide-up" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)', animationDelay: '0.1s' }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Total Students</p>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.total}</h3>
                </div>
                <div className="glass-card animate-slide-up" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981', animationDelay: '0.2s' }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Present</p>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>{stats.present}</h3>
                </div>
                <div className="glass-card animate-slide-up" style={{ padding: '1.5rem', borderLeft: '4px solid #f43f5e', animationDelay: '0.3s' }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Absent</p>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f43f5e' }}>{stats.absent}</h3>
                </div>
                <div className="glass-card animate-slide-up" style={{ padding: '1.5rem', borderLeft: '4px solid #f59e0b', animationDelay: '0.4s' }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Late</p>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b' }}>{stats.late}</h3>
                </div>
            </div>

            <div className="glass-card animate-slide-up" style={{ padding: '0', animationDelay: '0.5s' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ position: 'relative', width: '300px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search student name..."
                            className="input-field"
                            style={{ paddingLeft: '3rem', background: 'var(--bg-main)', border: 'none' }}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn hover-lift" onClick={markAllPresent} style={{ background: 'rgba(16, 185, 129, 0.05)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', fontWeight: 700, fontSize: '0.8125rem' }}>
                            Mark All Present
                        </button>
                        <button
                            className="btn btn-primary hover-glow"
                            onClick={handleSaveAttendance}
                            disabled={saving || localAttendance.length === 0}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1.25rem', opacity: saving ? 0.7 : 1 }}
                        >
                            {saving ? (
                                <>Processing...</>
                            ) : (
                                <><Save size={18} /> Save Records</>
                            )}
                        </button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading roll call...</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', background: 'rgba(248, 250, 252, 0.5)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    <th style={{ padding: '1.25rem 1.5rem' }}>Class - Roll</th>
                                    <th style={{ padding: '1.25rem 1.5rem' }}>Student Name</th>
                                    <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>Mark Attendance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAttendance.map((stu, index) => (
                                    <tr key={stu.id} style={{ borderBottom: '1px solid var(--border)', animationDelay: `${index * 0.05}s` }} className="animate-fade-in">
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.875rem' }}>{stu.class}-{stu.section}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Roll: {stu.rollNo || 'N/A'}</div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600 }}>{stu.name}</td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                                                <button
                                                    onClick={() => toggleStatus(stu.id, 'PRESENT')}
                                                    className="hover-lift"
                                                    style={{
                                                        padding: '0.625rem 1.25rem',
                                                        borderRadius: '0.75rem',
                                                        border: '1px solid var(--border)',
                                                        background: stu.status === 'PRESENT' ? '#10b981' : 'white',
                                                        color: stu.status === 'PRESENT' ? 'white' : 'var(--text-muted)',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem',
                                                        fontWeight: 700,
                                                        fontSize: '0.8125rem',
                                                        transition: 'all 0.2s',
                                                        boxShadow: stu.status === 'PRESENT' ? '0 4px 12px rgba(16, 185, 129, 0.2)' : 'none'
                                                    }}
                                                >
                                                    <CheckCircle2 size={16} /> Present
                                                </button>
                                                <button
                                                    onClick={() => toggleStatus(stu.id, 'ABSENT')}
                                                    className="hover-lift"
                                                    style={{
                                                        padding: '0.625rem 1.25rem',
                                                        borderRadius: '0.75rem',
                                                        border: '1px solid var(--border)',
                                                        background: stu.status === 'ABSENT' ? '#f43f5e' : 'white',
                                                        color: stu.status === 'ABSENT' ? 'white' : 'var(--text-muted)',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem',
                                                        fontWeight: 700,
                                                        fontSize: '0.8125rem',
                                                        transition: 'all 0.2s',
                                                        boxShadow: stu.status === 'ABSENT' ? '0 4px 12px rgba(244, 63, 94, 0.2)' : 'none'
                                                    }}
                                                >
                                                    <XCircle size={16} /> Absent
                                                </button>
                                                <button
                                                    onClick={() => toggleStatus(stu.id, 'LATE')}
                                                    className="hover-lift"
                                                    style={{
                                                        padding: '0.625rem 1.25rem',
                                                        borderRadius: '0.75rem',
                                                        border: '1px solid var(--border)',
                                                        background: stu.status === 'LATE' ? '#f59e0b' : 'white',
                                                        color: stu.status === 'LATE' ? 'white' : 'var(--text-muted)',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem',
                                                        fontWeight: 700,
                                                        fontSize: '0.8125rem',
                                                        transition: 'all 0.2s',
                                                        boxShadow: stu.status === 'LATE' ? '0 4px 12px rgba(245, 158, 11, 0.2)' : 'none'
                                                    }}
                                                >
                                                    <Clock size={16} /> Late
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Attendance;
