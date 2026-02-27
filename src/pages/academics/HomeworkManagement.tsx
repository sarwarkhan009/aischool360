import React, { useState, useEffect } from 'react';
import {
    Plus,
    Trash2,
    Edit2,
    BookOpen,
    Calendar as CalendarIcon,
    User,
    Loader2,
    CheckCircle,
    X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    orderBy,
    setDoc,
    serverTimestamp,
    addDoc,
    getDoc,
    writeBatch
} from 'firebase/firestore';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';
import { sortClasses } from '../../constants/app';
import { toProperCase } from '../../utils/formatters';

interface Homework {
    id: string;
    class: string;
    section: string;
    subject: string;
    title: string;
    description: string;
    dueDate?: string;
    assignedDate: string;
    teacherName: string;
    teacherId: string;
    createdAt: string;
}

const HomeworkManagement: React.FC = () => {
    const { user } = useAuth();
    const { currentSchool } = useSchool();
    const [showModal, setShowModal] = useState(false);
    const [editingHomework, setEditingHomework] = useState<Homework | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [timeRange, setTimeRange] = useState<'TODAY' | 'THIS_MONTH' | 'LAST_MONTH' | 'LIFETIME'>('TODAY');
    const [academicStructure, setAcademicStructure] = useState<any>(null);
    const [submissionModal, setSubmissionModal] = useState<{ open: boolean; homeworkId: string; className: string; section: string } | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [studentsForSubmission, setStudentsForSubmission] = useState<any[]>([]);
    const [existingSubmissions, setExistingSubmissions] = useState<Record<string, string>>({});

    // Filter States
    const [filterClass, setFilterClass] = useState('');
    const [filterSection, setFilterSection] = useState('');
    const [filterTeacher, setFilterTeacher] = useState('');
    const [assignedClasses, setAssignedClasses] = useState<string[]>([]);
    const [isFetchingAssigned, setIsFetchingAssigned] = useState(false);

    useEffect(() => {
        if (!user?.id || user.role !== 'TEACHER' || !currentSchool?.id) return;

        const currentUserId = user.id;
        const currentSchoolId = currentSchool.id;

        const fetchAssigned = async () => {
            setIsFetchingAssigned(true);
            try {
                const classes = new Set<string>();

                // 1. Fetch from Routine
                const routineDoc = await getDoc(doc(db, 'settings', `school_routine_${currentSchoolId}`));
                if (routineDoc.exists()) {
                    const days = routineDoc.data().days || {};
                    Object.values(days).forEach((day: any) => {
                        day.periods?.forEach((period: any) => {
                            if (period.teacher === user.name || period.teacher === user.username) {
                                classes.add(period.className);
                            }
                        });
                    });
                }

                // 2. Fetch from Teacher Profile (Employee Management)
                const teacherDoc = await getDoc(doc(db, 'teachers', currentUserId));
                if (teacherDoc.exists()) {
                    const teacherData = teacherDoc.data();
                    if (teacherData.teachingClasses && Array.isArray(teacherData.teachingClasses)) {
                        teacherData.teachingClasses.forEach((cls: string) => classes.add(cls));
                    }
                }

                // 3. Fetch from Previous Homework History (as fallback or additional info)
                const q = query(
                    collection(db, 'homework'),
                    where('schoolId', '==', currentSchoolId),
                    where('teacherId', '==', currentUserId)
                );
                const snap = await getDocs(q);
                snap.docs.forEach(d => classes.add(d.data().class));

                setAssignedClasses(Array.from(classes));
            } catch (e) {
                console.error("Error fetching assigned:", e);
            } finally {
                setIsFetchingAssigned(false);
            }
        };
        fetchAssigned();
    }, [user, currentSchool?.id]);

    useEffect(() => {
        const fetchAcademic = async () => {
            if (!currentSchool?.id) return;
            const docRef = doc(db, 'settings', `academic_structure_${currentSchool.id}`);
            const snap = await getDoc(docRef);
            if (snap.exists()) setAcademicStructure(snap.data());
        };
        fetchAcademic();
    }, [currentSchool?.id]);

    // Form State
    const [formData, setFormData] = useState({
        class: '',
        section: '',
        subject: '',
        title: '',
        description: '',
        dueDate: new Date().toISOString().split('T')[0],
        assignedDate: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        setFormData(prev => ({ ...prev, subject: '' }));
    }, [formData.class]);

    const { data: allSettings } = useFirestore<any>('settings');
    const {
        data: rawHomeworks,
        loading: hookLoading,
        add: addHomework,
        update: updateHomework,
        remove: removeHomework
    } = useFirestore<any>('homework');

    const classSettings = sortClasses((allSettings?.filter((s: any) => s.type === 'class' && s.active !== false) || []).filter((c: any) => {
        if (user?.role === 'ADMIN' || user?.role === 'MANAGER') return true;
        if (user?.role === 'TEACHER') return assignedClasses.includes(c.name);
        return true;
    }));

    const availableSubjects = academicStructure?.subjects?.filter((s: any) => s.enabledFor?.includes(formData.class)) || [];

    // Process and sort in memory
    const homeworks = [...rawHomeworks]
        .filter(h => {
            // Role/Owner Filter
            if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER' && h.teacherId !== user?.id) return false;

            // Time Filter
            const date = new Date(h.assignedDate || h.createdAt || 0);
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const startOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
            const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

            if (timeRange === 'TODAY' && date < startOfToday) return false;
            if (timeRange === 'THIS_MONTH' && date < startOfThisMonth) return false;
            if (timeRange === 'LAST_MONTH' && (date < startOfLastMonth || date > endOfLastMonth)) return false;

            // Class Filter
            if (filterClass && h.class !== filterClass) return false;
            if (filterSection && h.section && h.section !== filterSection) return false;

            // Teacher Filter
            if (filterTeacher && h.teacherId !== filterTeacher) return false;

            return true;
        })
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const loading = hookLoading;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const dataToSave = {
                ...formData,
                teacherId: user?.id || 'admin',
                teacherName: user?.username || 'Admin',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            if (editingHomework) {
                await updateHomework(editingHomework.id, {
                    ...formData,
                    updatedAt: new Date().toISOString()
                });
            } else {
                await addHomework(dataToSave);
            }

            setShowModal(false);
            setEditingHomework(null);
        } catch (e) {
            alert('Failed to save homework');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this homework?')) return;
        try {
            await removeHomework(id);
        } catch (e) {
            alert('Failed to delete homework');
        }
    };

    const handleOpenSubmissionModal = async (hw: Homework) => {
        setSubmissionModal({ open: true, homeworkId: hw.id, className: hw.class, section: hw.section });
        setSubmitting(true);
        try {
            // Fetch students for this class/section
            const studentsRef = collection(db, 'students');
            let q = query(studentsRef, where('schoolId', '==', currentSchool?.id), where('class', '==', hw.class));
            if (hw.section && hw.section !== 'All Sections') q = query(q, where('section', '==', hw.section));
            const snap = await getDocs(q);
            const studentData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                .filter((s: any) => s.status !== 'INACTIVE')
                .sort((a: any, b: any) => {
                    const rollA = parseInt(a.classRollNo) || 0;
                    const rollB = parseInt(b.classRollNo) || 0;
                    return rollA - rollB;
                });
            setStudentsForSubmission(studentData);

            // Fetch existing submissions
            const subsRef = collection(db, 'homeworkSubmissions');
            const sq = query(subsRef, where('homeworkId', '==', hw.id));
            const ssnap = await getDocs(sq);
            const subRecords: Record<string, string> = {};
            ssnap.docs.forEach(d => {
                const data = d.data();
                subRecords[data.studentId] = data.status;
            });
            setExistingSubmissions(subRecords);
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const setStatus = (studentId: string, status: string) => {
        setExistingSubmissions(prev => ({
            ...prev,
            [studentId]: status
        }));
    };

    const saveSubmissions = async () => {
        if (!submissionModal) return;
        setSubmitting(true);
        try {
            const batch = writeBatch(db);
            studentsForSubmission.forEach(s => {
                const docId = `sub_${submissionModal.homeworkId}_${s.id}`;
                const subRef = doc(db, 'homeworkSubmissions', docId);

                batch.set(subRef, {
                    homeworkId: submissionModal.homeworkId || '',
                    studentId: s.id || '',
                    studentName: s.fullName || s.name || 'Student',
                    status: existingSubmissions[s.id] || 'PENDING',
                    markedAt: new Date().toISOString(),
                    markedBy: user?.username || 'Admin',
                    schoolId: currentSchool?.id || '',
                    updatedAt: serverTimestamp()
                }, { merge: true });
            });
            await batch.commit();
            alert('Submissions updated successfully!');
            setSubmissionModal(null);
        } catch (e: any) {
            console.error("Submission save error:", e);
            alert('Failed to update submissions: ' + (e.message || 'Unknown error'));
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusStyle = (currentStatus: string, buttonStatus: string) => {
        const isActive = currentStatus === buttonStatus;
        if (!isActive) return { background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0' };

        switch (buttonStatus) {
            case 'COMPLETED': return { background: '#10b981', color: 'white', border: '1px solid #10b981' };
            case 'PARTIAL': return { background: '#f59e0b', color: 'white', border: '1px solid #f59e0b' };
            case 'NOT_DONE': return { background: '#ef4444', color: 'white', border: '1px solid #ef4444' };
            default: return {};
        }
    };

    return (
        <div className="animate-fade-in no-scrollbar">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '0.25rem' }}>Homework Management</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Manage and assign daily homework tasks.</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditingHomework(null); setFormData({ ...formData, class: '', section: '', title: '', description: '', subject: '' }); setShowModal(true); }}>
                    <Plus size={20} /> Assign New Task
                </button>
            </div>

            {/* Filters Bar */}
            <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-end' }}>
                <div className="input-group" style={{ marginBottom: 0, minWidth: '200px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>Class</label>
                    <select
                        className="input-field"
                        value={filterClass}
                        onChange={e => { setFilterClass(e.target.value); setFilterSection(''); }}
                        style={{ background: '#f8fafc' }}
                    >
                        <option value="">All Classes</option>
                        {classSettings.map((c: any) => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                </div>

                {filterClass && (
                    <div className="input-group" style={{ marginBottom: 0, minWidth: '150px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>Section</label>
                        <select
                            className="input-field"
                            value={filterSection}
                            onChange={e => setFilterSection(e.target.value)}
                            style={{ background: '#f8fafc' }}
                        >
                            <option value="">All Sections</option>
                            {classSettings.find((c: any) => c.name === filterClass)?.sections?.map((s: string) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                )}

                {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                    <div className="input-group" style={{ marginBottom: 0, minWidth: '200px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>Teacher</label>
                        <select
                            className="input-field"
                            value={filterTeacher}
                            onChange={e => setFilterTeacher(e.target.value)}
                            style={{ background: '#f8fafc' }}
                        >
                            <option value="">All Teachers</option>
                            {Array.from(new Set(rawHomeworks.map(h => h.teacherId))).map(teacherId => {
                                const hw = rawHomeworks.find(h => h.teacherId === teacherId);
                                return <option key={teacherId} value={teacherId}>{hw?.teacherName || 'Unknown'}</option>;
                            })}
                        </select>
                    </div>
                )}

                <div style={{ marginLeft: 'auto' }}>
                    <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.35rem', borderRadius: '0.75rem', gap: '0.25rem' }}>
                        {(['TODAY', 'THIS_MONTH', 'LAST_MONTH', 'LIFETIME'] as const).map(range => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                style={{
                                    padding: '0.4rem 1rem',
                                    borderRadius: '0.5rem',
                                    border: 'none',
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    background: timeRange === range ? 'white' : 'transparent',
                                    color: timeRange === range ? 'var(--primary)' : '#64748b',
                                    boxShadow: timeRange === range ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    textTransform: 'uppercase'
                                }}
                            >
                                {range.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {
                loading ? (
                    <div style={{ textAlign: 'center', padding: '5rem' }}><Loader2 className="animate-spin" size={40} /></div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                        {homeworks.length > 0 ? homeworks.map((h) => (
                            <div key={h.id} className="glass-card" style={{ padding: '1.5rem', border: '1px solid var(--border)', position: 'relative' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <span style={{ padding: '0.25rem 0.75rem', borderRadius: '2rem', fontSize: '0.75rem', fontWeight: 800, background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)' }}>
                                            HOMEWORK
                                        </span>
                                        <span style={{ padding: '0.25rem 0.75rem', borderRadius: '2rem', fontSize: '0.75rem', fontWeight: 800, background: '#f1f5f9', color: '#64748b' }}>
                                            {h.class} {h.section && `- ${h.section}`}
                                        </span>
                                    </div>
                                    {(user?.role === 'ADMIN' || h.teacherId === user?.id) && (
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => { setEditingHomework(h); setFormData({ ...h } as any); setShowModal(true); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}><Edit2 size={16} /></button>
                                            <button onClick={() => handleDelete(h.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={16} /></button>
                                        </div>
                                    )}
                                </div>

                                <h3 style={{ fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem' }}>{h.title}</h3>
                                <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem', lineHeight: 1.5 }}>
                                    {h.description}
                                </p>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <BookOpen size={14} /> <b>{h.subject}</b>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <CalendarIcon size={14} /> Due: <b>{h.dueDate || 'N/A'}</b>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <User size={14} /> <b>{h.teacherName}</b>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <CalendarIcon size={14} /> Assigned: <b>{h.assignedDate}</b>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleOpenSubmissionModal(h)}
                                    className="btn btn-outline"
                                    style={{
                                        width: '100%',
                                        marginTop: '1.25rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        borderColor: 'var(--primary)',
                                        color: 'var(--primary)'
                                    }}
                                >
                                    <CheckCircle size={14} /> Mark Completion Status
                                </button>
                            </div>
                        )) : (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem', background: 'rgba(0,0,0,0.02)', borderRadius: '2rem' }}>
                                <BookOpen size={48} style={{ opacity: 0.1, margin: '0 auto 1.5rem' }} />
                                <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>No homework assignments found.</p>
                            </div>
                        )}
                    </div>
                )
            }

            {
                showModal && (
                    <div className="homework-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 2147483647, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0' }}>
                        <div className="glass-card animate-scale-in homework-modal-content" style={{
                            width: '100%',
                            maxWidth: '600px',
                            background: 'white',
                            height: '100%',
                            borderRadius: '0',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            padding: 0
                        }}>
                            {/* Modal Header */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '1rem 1.5rem',
                                borderBottom: '1px solid var(--border)',
                                flexShrink: 0,
                                background: 'white',
                                zIndex: 10
                            }}>
                                <h2 style={{ fontWeight: 900, fontSize: '1.25rem', margin: 0 }}>{editingHomework ? 'Edit Task' : 'New Assignment'}</h2>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="btn-icon"
                                    style={{
                                        width: '2.5rem',
                                        height: '2.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: '#f1f5f9',
                                        borderRadius: '50%',
                                        zIndex: 20
                                    }}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Scrollable Form Body */}
                            <div style={{ overflowY: 'auto', padding: '1.5rem', flex: 1, WebkitOverflowScrolling: 'touch' }}>
                                <form onSubmit={handleSave} style={{ display: 'grid', gap: '1.25rem' }}>
                                    <div className="homework-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="input-group">
                                            <label>Class</label>
                                            <select
                                                className="input-field"
                                                value={formData.class}
                                                onChange={e => setFormData({ ...formData, class: e.target.value })}
                                                required
                                            >
                                                <option value="">Select Class</option>
                                                {classSettings.map((c: any) => (
                                                    <option key={c.name} value={c.name}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="input-group">
                                            <label>Section (Optional)</label>
                                            <select
                                                className="input-field"
                                                value={formData.section}
                                                onChange={e => setFormData({ ...formData, section: e.target.value })}
                                            >
                                                <option value="">All Sections</option>
                                                {classSettings.find((c: any) => c.name === formData.class)?.sections?.map((s: string) => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="input-group">
                                        <label>Subject</label>
                                        <select
                                            className="input-field"
                                            value={formData.subject}
                                            onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                            required
                                        >
                                            <option value="">Select Subject</option>
                                            {availableSubjects.map((s: any) => (
                                                <option key={s.name} value={s.name}>{s.name}</option>
                                            ))}
                                            {!availableSubjects.length && formData.class && <option disabled>No subjects defined for this class</option>}
                                        </select>
                                    </div>

                                    <div className="input-group">
                                        <label>Title</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            placeholder="e.g. Algebra Exercise 2.1"
                                            value={formData.title}
                                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                                            onBlur={e => setFormData({ ...formData, title: toProperCase(e.target.value) })}
                                            required
                                        />
                                    </div>

                                    <div className="input-group">
                                        <label>Description / Details</label>
                                        <textarea
                                            className="input-field"
                                            style={{ minHeight: '120px' }}
                                            placeholder="Write details about the task..."
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            onBlur={e => setFormData({ ...formData, description: toProperCase(e.target.value) })}
                                            required
                                        />
                                    </div>

                                    <div className="homework-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="input-group">
                                            <label>Assigned Date</label>
                                            <input type="date" className="input-field" value={formData.assignedDate} onChange={e => setFormData({ ...formData, assignedDate: e.target.value })} required />
                                        </div>
                                        <div className="input-group">
                                            <label>Due Date</label>
                                            <input type="date" className="input-field" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} required />
                                        </div>
                                    </div>

                                    <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ width: '100%', height: '3.5rem', fontSize: '1.1rem', fontWeight: 800 }}>
                                        {isSaving ? <Loader2 className="animate-spin" /> : <><CheckCircle size={20} /> {editingHomework ? 'Update Task' : 'Publish Task'}</>}
                                    </button>
                                    <button type="button" onClick={() => setShowModal(false)} className="btn" style={{ width: '100%', padding: '1rem', background: '#f1f5f9', color: '#64748b', fontWeight: 700, borderRadius: '0.75rem', marginTop: '0.5rem' }}>
                                        Cancel
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div >
                )
            }

            {
                submissionModal?.open && (
                    <div className="submission-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }}>
                        <div className="glass-card animate-scale-in submission-modal-container" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'white', borderRadius: 'var(--radius-lg)', padding: 0 }}>
                            <div className="submission-modal-header" style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <h2 style={{ fontWeight: 900, fontSize: '1.125rem', marginBottom: '0.25rem' }}>Mark Completion</h2>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Class {submissionModal.className} {submissionModal.section ? `- ${submissionModal.section}` : ''}</p>
                                </div>
                                <button onClick={() => setSubmissionModal(null)} className="btn-icon" style={{ flexShrink: 0 }}><X size={20} /></button>
                            </div>

                            <div className="no-scrollbar submission-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
                                {submitting && studentsForSubmission.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 className="animate-spin" size={30} /></div>
                                ) : (
                                    <>
                                        {/* Desktop Table View */}
                                        <table className="homework-submission-table" style={{ width: '100%', borderCollapse: 'collapse', display: 'none' }}>
                                            <thead>
                                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                                    <th style={{ padding: '0.75rem' }}>Student Name</th>
                                                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Set Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {studentsForSubmission.map(s => (
                                                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '0.75rem' }}>
                                                            <div style={{ fontWeight: 700 }}>{s.fullName}</div>
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Roll: {s.classRollNo}</div>
                                                        </td>
                                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                                <button
                                                                    onClick={() => setStatus(s.id, 'COMPLETED')}
                                                                    style={{
                                                                        padding: '0.5rem 0.75rem',
                                                                        borderRadius: '0.5rem',
                                                                        fontSize: '0.65rem',
                                                                        fontWeight: 900,
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s',
                                                                        whiteSpace: 'nowrap',
                                                                        ...getStatusStyle(existingSubmissions[s.id] || 'PENDING', 'COMPLETED')
                                                                    }}
                                                                >
                                                                    Completed
                                                                </button>
                                                                <button
                                                                    onClick={() => setStatus(s.id, 'PARTIAL')}
                                                                    style={{
                                                                        padding: '0.5rem 0.75rem',
                                                                        borderRadius: '0.5rem',
                                                                        fontSize: '0.65rem',
                                                                        fontWeight: 900,
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s',
                                                                        whiteSpace: 'nowrap',
                                                                        ...getStatusStyle(existingSubmissions[s.id] || 'PENDING', 'PARTIAL')
                                                                    }}
                                                                >
                                                                    Partial
                                                                </button>
                                                                <button
                                                                    onClick={() => setStatus(s.id, 'NOT_DONE')}
                                                                    style={{
                                                                        padding: '0.5rem 0.75rem',
                                                                        borderRadius: '0.5rem',
                                                                        fontSize: '0.65rem',
                                                                        fontWeight: 900,
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s',
                                                                        whiteSpace: 'nowrap',
                                                                        ...getStatusStyle(existingSubmissions[s.id] || 'PENDING', 'NOT_DONE')
                                                                    }}
                                                                >
                                                                    Not Done
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* Mobile Card View */}
                                        <div className="homework-submission-cards" style={{ display: 'none', flexDirection: 'column', gap: '0.5rem' }}>
                                            {studentsForSubmission.map(s => (
                                                <div key={s.id} style={{
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '0.5rem',
                                                    padding: '0.5rem',
                                                    background: 'white'
                                                }}>
                                                    <div style={{ marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: '1.1' }}>{s.fullName}</div>
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Roll: {s.classRollNo}</div>
                                                        </div>
                                                        <div style={{
                                                            fontSize: '0.65rem',
                                                            padding: '0.2rem 0.5rem',
                                                            borderRadius: '1rem',
                                                            fontWeight: 700,
                                                            ...getStatusStyle(existingSubmissions[s.id] || 'PENDING', existingSubmissions[s.id] || 'PENDING')
                                                        }}>
                                                            {existingSubmissions[s.id]?.replace('_', ' ') || 'PENDING'}
                                                        </div>
                                                    </div>
                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                                        gap: '0.35rem'
                                                    }}>
                                                        <button
                                                            onClick={() => setStatus(s.id, 'COMPLETED')}
                                                            style={{
                                                                padding: '0.5rem 0.25rem',
                                                                borderRadius: '0.35rem',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 800,
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                                textAlign: 'center',
                                                                whiteSpace: 'nowrap',
                                                                ...getStatusStyle(existingSubmissions[s.id] || 'PENDING', 'COMPLETED')
                                                            }}
                                                        >
                                                            Done
                                                        </button>
                                                        <button
                                                            onClick={() => setStatus(s.id, 'PARTIAL')}
                                                            style={{
                                                                padding: '0.5rem 0.25rem',
                                                                borderRadius: '0.35rem',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 800,
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                                textAlign: 'center',
                                                                whiteSpace: 'nowrap',
                                                                ...getStatusStyle(existingSubmissions[s.id] || 'PENDING', 'PARTIAL')
                                                            }}
                                                        >
                                                            Partial
                                                        </button>
                                                        <button
                                                            onClick={() => setStatus(s.id, 'NOT_DONE')}
                                                            style={{
                                                                padding: '0.5rem 0.25rem',
                                                                borderRadius: '0.35rem',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 800,
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                                textAlign: 'center',
                                                                whiteSpace: 'nowrap',
                                                                ...getStatusStyle(existingSubmissions[s.id] || 'PENDING', 'NOT_DONE')
                                                            }}
                                                        >
                                                            Not Done
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="submission-modal-footer" style={{
                                padding: '0.75rem',
                                borderTop: '1px solid var(--border)',
                                display: 'flex',
                                flexDirection: 'row',
                                justifyContent: 'flex-end',
                                gap: '0.75rem'
                            }}>
                                <button className="btn" onClick={() => setSubmissionModal(null)} style={{ minWidth: '100px' }}>Cancel</button>
                                <button className="btn btn-primary" onClick={saveSubmissions} disabled={submitting} style={{ minWidth: '100px' }}>
                                    {submitting ? <Loader2 className="animate-spin" /> : 'Save Status'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <style>{`
                @media (min-width: 769px) {
                    .homework-submission-table {
                        display: table !important;
                    }
                    
                    .homework-submission-cards {
                        display: none !important;
                    }
                }

                @media (max-width: 768px) {
                    .submission-modal-overlay {
                        padding: 0 !important;
                        align-items: flex-end !important;
                    }
                    
                    .submission-modal-container {
                        width: 100% !important;
                        max-width: 100% !important;
                        height: 100% !important;
                        max-height: 100% !important;
                        border-radius: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important; /* Critical: Remove glass-card padding */
                        display: flex !important;
                        flex-direction: column !important;
                        overflow: hidden !important;
                    }
                    
                    .submission-modal-header {
                        padding: 0.75rem 1rem !important;
                        flex-shrink: 0;
                        background: white; /* Ensure standard background */
                    }

                    .submission-modal-header h2 {
                        font-size: 1.1rem !important;
                    }
                    
                    .submission-modal-body {
                        padding: 0.75rem 1rem !important;
                        flex: 1;
                        overflow-y: auto;
                    }
                    
                    .homework-submission-table {
                        display: none !important;
                    }
                    
                    .homework-submission-cards {
                        display: flex !important;
                    }

                    .submission-modal-footer {
                        padding: 0.75rem 1rem !important;
                        gap: 0.75rem !important;
                        background: white;
                        border-top: 1px solid #f1f5f9;
                        flex-shrink: 0;
                    }

                    .submission-modal-footer button {
                        flex: 1 !important;
                        padding: 0.75rem !important;
                    }

                    .homework-modal-overlay {
                        padding: 0 !important;
                    }
                    
                    .homework-modal-content {
                        width: 100% !important;
                        height: 100% !important;
                        max-height: 100% !important;
                        border-radius: 0 !important;
                        padding: 1rem !important;
                        margin: 0 !important;
                    }
                    
                    .homework-form-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div >
    );
};

export default HomeworkManagement;
