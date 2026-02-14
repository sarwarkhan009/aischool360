import React, { useState } from 'react';
import {
    Calendar,
    Award,
    FileText,
    Plus,
    ChevronRight,
    ClipboardList,
    X,
    Save
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { sortClasses } from '../../constants/app';
import { formatDate } from '../../utils/dateUtils';
import { toProperCase } from '../../utils/formatters';

const ExamManagement: React.FC = () => {
    const { data: allSettings } = useFirestore<any>('settings');
    const { data: exams, add: addExam, update: updateExam, loading: examsLoading } = useFirestore<any>('exams');
    const { data: students, loading: studentsLoading } = useFirestore<any>('students');
    const { data: marksRecords, add: addMark, update: updateMark } = useFirestore<any>('exam_marks');

    const activeClasses = sortClasses(allSettings?.filter((d: any) => d.type === 'class' && d.active !== false) || []);
    const classesList = activeClasses.map((c: any) => c.name);

    const [view, setView] = useState<'dashboard' | 'markEntry' | 'examDetail'>('dashboard');
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedExam, setSelectedExam] = useState<any>(null);
    const [selectedClassForMarkEntry, setSelectedClassForMarkEntry] = useState('');
    const [selectedSubjectForMarkEntry, setSelectedSubjectForMarkEntry] = useState('');
    const [selectedExamForMarkEntry, setSelectedExamForMarkEntry] = useState('');

    const [marks, setMarks] = useState<Record<string, { marks: string; total: string }>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isScheduling, setIsScheduling] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [newExam, setNewExam] = useState({
        name: '',
        startDate: new Date().toISOString().split('T')[0],
        classes: [] as string[],
        subjects: [] as string[],
        status: 'PLANNING' as 'PLANNING' | 'ONGOING' | 'COMPLETED'
    });

    // Load subjects from Question Generator
    const questionGeneratorData = allSettings?.find((s: any) => s.id === 'question_generator');
    const availableSubjects = React.useMemo(() => {
        const subjectsSet = new Set<string>();
        questionGeneratorData?.classes?.forEach((cls: any) => {
            cls.subjects?.forEach((subject: any) => {
                subjectsSet.add(subject.name);
            });
        });
        return Array.from(subjectsSet).sort();
    }, [questionGeneratorData]);

    const handleScheduleExam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newExam.name || newExam.classes.length === 0) {
            alert('Please fill in Name and select at least one Class');
            return;
        }
        if (newExam.subjects.length === 0) {
            alert('Please select at least one Subject');
            return;
        }

        setIsScheduling(true);
        try {
            if (editMode && selectedExam) {
                await updateExam(selectedExam.id, {
                    ...newExam,
                    updatedAt: new Date().toISOString()
                });
                alert('Exam updated successfully!');
            } else {
                await addExam({
                    ...newExam,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                alert('Exam scheduled successfully!');
            }
            setShowScheduleModal(false);
            setEditMode(false);
            setSelectedExam(null);
            setNewExam({ name: '', startDate: new Date().toISOString().split('T')[0], classes: [], subjects: [], status: 'PLANNING' });
        } catch (error) {
            console.error('Error saving exam:', error);
            alert('Failed to save exam. Please check your permissions and try again.');
        } finally {
            setIsScheduling(false);
        }
    };

    const handleDeleteExam = async () => {
        if (!selectedExam) return;

        setIsDeleting(true);
        try {
            // Count marks that will be deleted
            const relatedMarks = marksRecords.filter(m => m.examId === selectedExam.id);

            // Delete marks first
            for (const mark of relatedMarks) {
                await updateMark(mark.id, { deleted: true }); // Soft delete
            }

            // Delete exam
            await updateExam(selectedExam.id, { deleted: true }); // Soft delete exam too

            alert(`Exam and ${relatedMarks.length} marks records deleted successfully!`);
            setShowDeleteModal(false);
            setView('dashboard');
        } catch (error) {
            console.error('Error deleting exam:', error);
            alert('Failed to delete exam. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleStatusChange = async (newStatus: 'PLANNING' | 'ONGOING' | 'COMPLETED') => {
        if (!selectedExam) return;

        try {
            await updateExam(selectedExam.id, {
                status: newStatus,
                updatedAt: new Date().toISOString()
            });
            setSelectedExam({ ...selectedExam, status: newStatus });
            alert(`Exam status changed to ${newStatus}`);
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update status. Please try again.');
        }
    };

    const handleEnterMarks = () => {
        if (!selectedClassForMarkEntry || !selectedSubjectForMarkEntry || !selectedExamForMarkEntry) {
            alert('Please select Exam, Class and Subject');
            return;
        }

        // Initialize marks state for existing records if any
        const filteredMarks = marksRecords.filter(m =>
            m.examId === selectedExamForMarkEntry &&
            m.class === selectedClassForMarkEntry &&
            m.subject === selectedSubjectForMarkEntry
        );

        const initialMarks: Record<string, { marks: string; total: string }> = {};
        filteredMarks.forEach(m => {
            initialMarks[m.studentId] = { marks: m.marks, total: m.maxMarks };
        });
        setMarks(initialMarks);

        setView('markEntry');
    };

    const calculateGrade = (percentage: number): string => {
        if (percentage >= 90) return 'A+';
        if (percentage >= 80) return 'A';
        if (percentage >= 70) return 'B';
        if (percentage >= 60) return 'C';
        if (percentage >= 50) return 'D';
        if (percentage >= 40) return 'E';
        return 'F';
    };

    const handleSaveMarks = async () => {
        // Validate all marks
        for (const [studentId, data] of Object.entries(marks)) {
            const obtainedMarks = parseFloat(data.marks || '0');
            const maxMarks = parseFloat(data.total || '100');

            if (obtainedMarks < 0 || obtainedMarks > maxMarks) {
                alert(`Invalid marks for student ${studentId}. Marks must be between 0 and ${maxMarks}.`);
                return;
            }
        }

        setIsSaving(true);
        try {
            const promises = Object.entries(marks).map(async ([studentId, data]) => {
                const obtainedMarks = parseFloat(data.marks || '0');
                const maxMarks = parseFloat(data.total || '100');
                const percentage = (obtainedMarks / maxMarks) * 100;
                const grade = calculateGrade(percentage);

                const existing = marksRecords.find(m =>
                    m.examId === selectedExamForMarkEntry &&
                    m.studentId === studentId &&
                    m.subject === selectedSubjectForMarkEntry
                );

                const markData = {
                    examId: selectedExamForMarkEntry,
                    studentId,
                    class: selectedClassForMarkEntry,
                    subject: selectedSubjectForMarkEntry,
                    marks: data.marks,
                    maxMarks: data.total,
                    percentage: percentage.toFixed(2),
                    grade,
                    updatedAt: new Date().toISOString()
                };

                if (existing) {
                    return updateMark(existing.id, markData);
                } else {
                    return addMark(markData);
                }
            });

            await Promise.all(promises);
            alert('Marks saved successfully!');
            setView('dashboard');
        } catch (error) {
            console.error('Error saving marks:', error);
            alert('Error saving marks. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    // Calculate analytics for exam detail view
    const calculateExamAnalytics = () => {
        if (!selectedExam) return null;

        const examMarks = marksRecords.filter(m => m.examId === selectedExam.id);
        const subjectStats: Record<string, { total: number; count: number; highest: number; lowest: number }> = {};

        examMarks.forEach(m => {
            const percentage = parseFloat(m.percentage || '0');
            if (!subjectStats[m.subject]) {
                subjectStats[m.subject] = { total: 0, count: 0, highest: 0, lowest: 100 };
            }
            subjectStats[m.subject].total += percentage;
            subjectStats[m.subject].count += 1;
            subjectStats[m.subject].highest = Math.max(subjectStats[m.subject].highest, percentage);
            subjectStats[m.subject].lowest = Math.min(subjectStats[m.subject].lowest, percentage);
        });

        return {
            totalMarksEntered: examMarks.length,
            subjectStats,
            overallAverage: examMarks.length > 0
                ? (examMarks.reduce((sum, m) => sum + parseFloat(m.percentage || '0'), 0) / examMarks.length).toFixed(2)
                : '0'
        };
    };

    // Exam Detail View
    if (view === 'examDetail' && selectedExam && !showScheduleModal && !showDeleteModal) {
        const analytics = calculateExamAnalytics();

        return (
            <div className="animate-fade-in">
                <div style={{ marginBottom: '2rem' }}>
                    <button
                        className="btn"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem', marginBottom: '1rem', border: '1px solid var(--border)' }}
                        onClick={() => setView('dashboard')}
                    >
                        ← Back to Dashboard
                    </button>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>{selectedExam.name}</h1>
                            <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
                                Scheduled for: {formatDate(selectedExam.startDate)}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <select
                                className="input-field"
                                value={selectedExam.status}
                                onChange={(e) => handleStatusChange(e.target.value as any)}
                                style={{ padding: '0.5rem 1rem', fontWeight: 700 }}
                            >
                                <option value="PLANNING">PLANNING</option>
                                <option value="ONGOING">ONGOING</option>
                                <option value="COMPLETED">COMPLETED</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '1.125rem' }}>Exam Information</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label className="field-label">Exam Name</label>
                                <p style={{ fontWeight: 600, marginTop: '0.25rem' }}>{selectedExam.name}</p>
                            </div>
                            <div>
                                <label className="field-label">Start Date</label>
                                <p style={{ fontWeight: 600, marginTop: '0.25rem' }}>{formatDate(selectedExam.startDate)}</p>
                            </div>
                            <div>
                                <label className="field-label">Subjects ({selectedExam.subjects?.length || 0})</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    {selectedExam.subjects?.map((subject: string) => (
                                        <span key={subject} style={{
                                            padding: '0.25rem 0.75rem',
                                            background: 'rgba(99, 102, 241, 0.1)',
                                            color: 'var(--primary)',
                                            borderRadius: '0.5rem',
                                            fontSize: '0.875rem',
                                            fontWeight: 600
                                        }}>
                                            {subject}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '1.125rem' }}>Target Classes</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {selectedExam.classes?.map((cls: string) => (
                                <span key={cls} style={{
                                    padding: '0.5rem 1rem',
                                    background: 'var(--bg-main)',
                                    borderRadius: '0.5rem',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    border: '1px solid var(--border)'
                                }}>
                                    {cls}
                                </span>
                            ))}
                        </div>
                        <div style={{ marginTop: '1.5rem' }}>
                            <label className="field-label">Total Classes</label>
                            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.25rem' }}>
                                {selectedExam.classes?.length || 0}
                            </p>
                        </div>
                    </div>
                </div>

                {analytics && analytics.totalMarksEntered > 0 && (
                    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                        <h3 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '1.125rem' }}>Performance Analytics</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                            <div>
                                <label className="field-label">Overall Average</label>
                                <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.25rem' }}>
                                    {analytics.overallAverage}%
                                </p>
                            </div>
                            <div>
                                <label className="field-label">Total Marks Entered</label>
                                <p style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
                                    {analytics.totalMarksEntered}
                                </p>
                            </div>
                        </div>
                        <div style={{ marginTop: '1.5rem' }}>
                            <label className="field-label">Subject-wise Performance</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem', marginTop: '0.75rem' }}>
                                {Object.entries(analytics.subjectStats).map(([subject, stats]) => (
                                    <div key={subject} style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                                        <h4 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>{subject}</h4>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                            <p>Average: <strong>{(stats.total / stats.count).toFixed(2)}%</strong></p>
                                            <p>Highest: <strong>{stats.highest.toFixed(2)}%</strong></p>
                                            <p>Lowest: <strong>{stats.lowest.toFixed(2)}%</strong></p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '1.125rem' }}>Quick Actions</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', justifyContent: 'center' }}
                            onClick={() => {
                                setSelectedExamForMarkEntry(selectedExam.id);
                                setView('dashboard');
                            }}
                        >
                            <ClipboardList size={18} /> Enter Marks
                        </button>
                        <button
                            className="btn"
                            style={{ width: '100%', justifyContent: 'center', border: '1px solid var(--border)' }}
                            onClick={() => {
                                setEditMode(true);
                                setNewExam({
                                    name: selectedExam.name,
                                    startDate: selectedExam.startDate,
                                    classes: selectedExam.classes || [],
                                    subjects: selectedExam.subjects || [],
                                    status: selectedExam.status
                                });
                                setShowScheduleModal(true);
                            }}
                        >
                            <FileText size={18} /> Edit Details
                        </button>
                        <button
                            className="btn"
                            style={{ width: '100%', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                            onClick={() => setShowDeleteModal(true)}
                        >
                            <X size={18} /> Delete Exam
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (view === 'markEntry') {
        const filteredStudents = students.filter(s => s.class === selectedClassForMarkEntry);
        const selectedExam = exams.find(e => e.id === selectedExamForMarkEntry);

        return (
            <div className="animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <button
                            className="btn"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem', marginBottom: '1rem', border: '1px solid var(--border)' }}
                            onClick={() => setView('dashboard')}
                        >
                            ← Back to Dashboard
                        </button>
                        <h1 style={{ fontSize: '1.875rem', fontWeight: 800 }}>Enter Marks: {selectedExam?.name}</h1>
                        <p style={{ color: 'var(--text-muted)' }}>Class: {selectedClassForMarkEntry} | Subject: {selectedSubjectForMarkEntry}</p>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={handleSaveMarks}
                        disabled={isSaving}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Save size={18} /> {isSaving ? 'Saving...' : 'Save All Marks'}
                    </button>
                </div>

                <div className="glass-card" style={{ padding: '0' }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', background: '#f8f9fa' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 120px 120px', gap: '1rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            <span>Student ID</span>
                            <span>Student Name</span>
                            <span>Section</span>
                            <span style={{ textAlign: 'center' }}>Marks Obtained</span>
                            <span style={{ textAlign: 'center' }}>Max Marks</span>
                        </div>
                    </div>

                    {studentsLoading ? (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading students...</div>
                    ) : filteredStudents.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No students found in this class.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {filteredStudents.sort((a, b) => (a.rollNo || 0) - (b.rollNo || 0)).map((student) => (
                                <div key={student.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 120px 120px', gap: '1rem', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{student.id}</span>
                                    <span>{student.fullName || student.name}</span>
                                    <span>{student.section}</span>
                                    <input
                                        type="number"
                                        className="input-field"
                                        style={{ textAlign: 'center', padding: '0.5rem' }}
                                        value={marks[student.id]?.marks || ''}
                                        onChange={(e) => setMarks({
                                            ...marks,
                                            [student.id]: { ...marks[student.id], marks: e.target.value, total: marks[student.id]?.total || '100' }
                                        })}
                                    />
                                    <input
                                        type="number"
                                        className="input-field"
                                        style={{ textAlign: 'center', padding: '0.5rem' }}
                                        value={marks[student.id]?.total || '100'}
                                        onChange={(e) => setMarks({
                                            ...marks,
                                            [student.id]: { ...marks[student.id], total: e.target.value }
                                        })}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '0.5rem' }}>Exam Management</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Schedule exams, manage results, and generate report cards.</p>
                </div>
                <button
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    onClick={() => setShowScheduleModal(true)}
                >
                    <Plus size={18} /> Schedule New Exam
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                {/* Active Exams */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {examsLoading ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading exams...</div>
                        ) : exams.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '1rem' }}>
                                <Calendar size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                                <p>No exams scheduled yet.</p>
                                <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowScheduleModal(true)}>Schedule Your First Exam</button>
                            </div>
                        ) : exams.map((exam) => (
                            <div
                                key={exam.id}
                                onClick={() => {
                                    setSelectedExam(exam);
                                    setView('examDetail');
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    padding: '1.25rem',
                                    borderRadius: '1rem',
                                    background: 'var(--bg-main)',
                                    border: '1px solid var(--border)',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s'
                                }} className="hover-lift">
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '0.75rem',
                                    background: 'white',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid var(--border)'
                                }}>
                                    <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
                                        {new Date(exam.startDate).toLocaleString('default', { month: 'short' })}
                                    </span>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                                        {new Date(exam.startDate).getDate()}
                                    </span>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{exam.name}</h4>
                                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><ClipboardList size={12} /> {exam.subjects?.length || '0'} Subjects</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Award size={12} /> {exam.classes?.join(', ') || 'N/A'}</span>
                                    </div>
                                </div>
                                <span style={{
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.25rem',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    background: exam.status === 'ONGOING' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                                    color: exam.status === 'ONGOING' ? '#10b981' : 'var(--primary)'
                                }}>{exam.status}</span>
                                <ChevronRight size={18} color="var(--text-muted)" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Results Entry */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ fontWeight: 700, marginBottom: '1.25rem' }}>Results Entry</h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Select an exam, class and subject to start entering marks.</p>

                        <div className="input-group" style={{ marginBottom: '1rem' }}>
                            <label className="field-label">Select Exam</label>
                            <select
                                className="input-field"
                                value={selectedExamForMarkEntry}
                                onChange={(e) => setSelectedExamForMarkEntry(e.target.value)}
                            >
                                <option value="">Select Exam</option>
                                {exams.map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="input-group" style={{ marginBottom: '1rem' }}>
                            <label className="field-label">Class</label>
                            <select
                                className="input-field"
                                value={selectedClassForMarkEntry}
                                onChange={(e) => setSelectedClassForMarkEntry(e.target.value)}
                            >
                                <option value="">Select Class</option>
                                {classesList.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                            <label className="field-label">Subject</label>
                            <select
                                className="input-field"
                                value={selectedSubjectForMarkEntry}
                                onChange={(e) => setSelectedSubjectForMarkEntry(e.target.value)}
                                disabled={!selectedExamForMarkEntry}
                            >
                                <option value="">Select Subject</option>
                                {selectedExamForMarkEntry && exams.find(e => e.id === selectedExamForMarkEntry)?.subjects?.map((subject: string) => (
                                    <option key={subject} value={subject}>{subject}</option>
                                ))}
                            </select>
                            {selectedExamForMarkEntry && !exams.find(e => e.id === selectedExamForMarkEntry)?.subjects?.length && (
                                <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.5rem' }}>
                                    No subjects configured for this exam
                                </p>
                            )}
                        </div>
                        <button
                            className="btn btn-primary"
                            style={{ width: '100%' }}
                            onClick={handleEnterMarks}
                        >
                            Enter Marks
                        </button>
                    </div>

                    <div className="glass-card" style={{ padding: '1.5rem', background: 'var(--bg-main)' }}>
                        <h4 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '0.875rem' }}>Report Card Template</h4>
                        <div style={{ padding: '1rem', background: 'white', borderRadius: '0.5rem', border: '1px dashed var(--border)', textAlign: 'center' }}>
                            <FileText size={32} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Standard Grade Sheet v2.1</p>
                            <button
                                className="btn"
                                style={{ marginTop: '0.75rem', padding: '0.4rem 1rem', fontSize: '0.75rem' }}
                                onClick={() => alert('Report Card Builder coming soon!')}
                            >
                                Edit Template
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Schedule/Edit Exam Modal */}
            {showScheduleModal && (
                <div className="auth-overlay" style={{ display: 'flex', zIndex: 1000, backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="animate-scale-in" style={{
                        width: '100%',
                        maxWidth: '550px',
                        padding: '2.5rem',
                        position: 'relative',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        background: 'white',
                        borderRadius: '24px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        border: '1px solid #eee'
                    }}>
                        <button
                            className="btn-icon"
                            style={{ position: 'absolute', right: '1.5rem', top: '1.5rem' }}
                            onClick={() => {
                                setShowScheduleModal(false);
                                setEditMode(false);
                                setNewExam({ name: '', startDate: new Date().toISOString().split('T')[0], classes: [], subjects: [], status: 'PLANNING' });
                            }}
                        >
                            <X size={20} />
                        </button>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-main)' }}>
                            <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.5rem', borderRadius: '12px', display: 'flex' }}>
                                <Calendar size={28} color="var(--primary)" />
                            </div>
                            {editMode ? 'Edit Exam' : 'Schedule New Exam'}
                        </h2>

                        <form onSubmit={handleScheduleExam}>
                            <div className="input-group-vertical" style={{ marginBottom: '1.5rem' }}>
                                <label className="field-label" style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.5rem' }}>Exam Name (e.g. Mid Term 2024)</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' }}
                                    placeholder="Enter exam name..."
                                    value={newExam.name}
                                    onChange={e => setNewExam({ ...newExam, name: e.target.value })}
                                    onBlur={e => setNewExam({ ...newExam, name: toProperCase(e.target.value) })}
                                    required
                                />
                            </div>

                            <div className="input-group-vertical" style={{ marginBottom: '1.5rem' }}>
                                <label className="field-label" style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.5rem' }}>Start Date</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' }}
                                    value={newExam.startDate}
                                    onChange={e => setNewExam({ ...newExam, startDate: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="input-group-vertical" style={{ marginBottom: '1.5rem' }}>
                                <label className="field-label" style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.5rem' }}>Select Target Classes</label>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                                    gap: '0.75rem',
                                    maxHeight: '160px',
                                    overflowY: 'auto',
                                    padding: '1rem',
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '16px'
                                }} className="no-scrollbar">
                                    {classesList.map(cls => (
                                        <label key={cls} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.6rem',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            padding: '0.6rem 0.75rem',
                                            background: newExam.classes.includes(cls) ? 'white' : 'transparent',
                                            borderRadius: '10px',
                                            boxShadow: newExam.classes.includes(cls) ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                            border: newExam.classes.includes(cls) ? '1px solid var(--primary)' : '1px solid transparent',
                                            transition: 'all 0.2s',
                                            color: newExam.classes.includes(cls) ? 'var(--primary)' : '#475569',
                                            fontWeight: newExam.classes.includes(cls) ? 700 : 500
                                        }}>
                                            <input
                                                type="checkbox"
                                                style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                                checked={newExam.classes.includes(cls)}
                                                onChange={e => {
                                                    const updated = e.target.checked
                                                        ? [...newExam.classes, cls]
                                                        : newExam.classes.filter(c => c !== cls);
                                                    setNewExam({ ...newExam, classes: updated });
                                                }}
                                            />
                                            {cls}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="input-group-vertical" style={{ marginBottom: '2rem' }}>
                                <label className="field-label" style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.5rem' }}>Select Subjects *</label>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                    gap: '0.75rem',
                                    maxHeight: '220px',
                                    overflowY: 'auto',
                                    padding: '1rem',
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '16px'
                                }} className="no-scrollbar">
                                    {availableSubjects.length > 0 ? (
                                        availableSubjects.map(subject => (
                                            <label key={subject} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.6rem',
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                padding: '0.6rem 0.75rem',
                                                background: newExam.subjects.includes(subject) ? 'white' : 'transparent',
                                                borderRadius: '10px',
                                                boxShadow: newExam.subjects.includes(subject) ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                                border: newExam.subjects.includes(subject) ? '1px solid var(--primary)' : '1px solid transparent',
                                                transition: 'all 0.2s',
                                                color: newExam.subjects.includes(subject) ? 'var(--primary)' : '#475569',
                                                fontWeight: newExam.subjects.includes(subject) ? 700 : 500
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                                    checked={newExam.subjects.includes(subject)}
                                                    onChange={e => {
                                                        const updated = e.target.checked
                                                            ? [...newExam.subjects, subject]
                                                            : newExam.subjects.filter(s => s !== subject);
                                                        setNewExam({ ...newExam, subjects: updated });
                                                    }}
                                                />
                                                {subject}
                                            </label>
                                        ))
                                    ) : (
                                        <p style={{ fontSize: '0.875rem', color: '#64748b', padding: '1rem', gridColumn: '1 / -1', textAlign: 'center' }}>
                                            No subjects available. Please add subjects in <br /><strong style={{ color: 'var(--primary)' }}>Master Control → Question Generator</strong>.
                                        </p>
                                    )}
                                </div>
                                {newExam.subjects.length > 0 && (
                                    <p style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <Award size={14} /> {newExam.subjects.length} subject(s) selected
                                    </p>
                                )}
                            </div>

                            <button type="submit" className="btn btn-primary" disabled={isScheduling} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', height: '3.5rem' }}>
                                <Save size={20} /> {isScheduling ? (editMode ? 'Updating...' : 'Scheduling...') : (editMode ? 'Update Exam' : 'Schedule Exam')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && selectedExam && (
                <div className="auth-overlay" style={{ display: 'flex', zIndex: 1000 }}>
                    <div className="glass-card animate-scale-in" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1rem', color: '#ef4444' }}>
                            Delete Exam?
                        </h2>
                        <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
                            Are you sure you want to delete "<strong>{selectedExam.name}</strong>"?
                        </p>
                        <div style={{ background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.2)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                            <p style={{ fontSize: '0.875rem', color: '#ea580c' }}>
                                ⚠️ This will also delete <strong>{marksRecords.filter(m => m.examId === selectedExam.id).length}</strong> marks record(s).
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                className="btn"
                                style={{ flex: 1, border: '1px solid var(--border)' }}
                                onClick={() => setShowDeleteModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn"
                                style={{ flex: 1, background: '#ef4444', color: 'white' }}
                                onClick={handleDeleteExam}
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExamManagement;
