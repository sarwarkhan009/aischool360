import React, { useState, useEffect } from 'react';
import { BookOpen, Users, GraduationCap, Filter, Calendar, Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSchool } from '../context/SchoolContext';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface TeachingLog {
    id: string;
    teacherId: string;
    teacherName: string;
    date: string;
    className: string;
    subject: string;
    topic: string;
    description: string;
}

type ViewMode = 'teacher' | 'class';

export default function TeachingLogReports() {
    const { currentSchool } = useSchool();

    const [logs, setLogs] = useState<TeachingLog[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<TeachingLog[]>([]);
    const [loading, setLoading] = useState(true);

    const [viewMode, setViewMode] = useState<ViewMode>('teacher');
    const [filterTeacher, setFilterTeacher] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [filterSubject, setFilterSubject] = useState('');
    const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
    const [searchTerm, setSearchTerm] = useState('');
    const [showWipeModal, setShowWipeModal] = useState(false);
    const [wipeConfirmationText, setWipeConfirmationText] = useState('');
    const [isWiping, setIsWiping] = useState(false);
    const [showWipeButton, setShowWipeButton] = useState(false);

    const [teachers, setTeachers] = useState<Array<{ id: string, name: string }>>([]);
    const [classes, setClasses] = useState<string[]>([]);
    const [subjects, setSubjects] = useState<string[]>([]);

    useEffect(() => {
        fetchTeachingLogs();
    }, [currentSchool?.id]);

    useEffect(() => {
        applyFilters();
    }, [logs, filterTeacher, filterClass, filterSubject, filterMonth, searchTerm]);

    const fetchTeachingLogs = async () => {
        if (!currentSchool?.id) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const logsRef = collection(db, 'teachingLogs');
            const q = query(logsRef, where('schoolId', '==', currentSchool.id));

            const snapshot = await getDocs(q);
            const logsData: TeachingLog[] = [];
            const teachersMap = new Map<string, string>();
            const classesSet = new Set<string>();
            const subjectsSet = new Set<string>();

            snapshot.forEach((doc) => {
                const data = doc.data();
                logsData.push({
                    id: doc.id,
                    teacherId: data.teacherId,
                    teacherName: data.teacherName,
                    date: data.date,
                    className: data.className,
                    subject: data.subject,
                    topic: data.topic,
                    description: data.description || ''
                });
                teachersMap.set(data.teacherId, data.teacherName);
                classesSet.add(data.className);
                subjectsSet.add(data.subject);
            });

            // Sort by date descending
            logsData.sort((a, b) => b.date.localeCompare(a.date));

            setLogs(logsData);
            setTeachers(Array.from(teachersMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
            setClasses(Array.from(classesSet).sort());
            setSubjects(Array.from(subjectsSet).sort());
        } catch (error) {
            console.error('Error fetching teaching logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleWipeAllLogs = async () => {
        if (wipeConfirmationText !== 'WIPE ALL TEACHING LOGS' || isWiping) return;

        setIsWiping(true);
        try {
            const logsRef = collection(db, 'teachingLogs');
            const q = query(logsRef, where('schoolId', '==', currentSchool?.id));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                alert('No teaching logs found for this school.');
                setShowWipeModal(false);
                setIsWiping(false);
                return;
            }

            const docs = snapshot.docs;
            const batchSize = 400;

            for (let i = 0; i < docs.length; i += batchSize) {
                const batch = writeBatch(db);
                const chunk = docs.slice(i, i + batchSize);
                chunk.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }

            alert(`Successfully wiped ${docs.length} teaching log entries.`);
            setShowWipeModal(false);
            setWipeConfirmationText('');
            // Refresh logs
            fetchTeachingLogs();
        } catch (error) {
            console.error('Error wiping teaching logs:', error);
            alert('An error occurred while wiping data. Please try again.');
        } finally {
            setIsWiping(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...logs];

        if (filterTeacher) {
            filtered = filtered.filter(log => log.teacherId === filterTeacher);
        }

        if (filterClass) {
            filtered = filtered.filter(log => log.className === filterClass);
        }

        if (filterSubject) {
            filtered = filtered.filter(log => log.subject === filterSubject);
        }

        if (filterMonth) {
            filtered = filtered.filter(log => log.date.startsWith(filterMonth));
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(log =>
                log.topic.toLowerCase().includes(term) ||
                log.description.toLowerCase().includes(term) ||
                log.teacherName.toLowerCase().includes(term)
            );
        }

        setFilteredLogs(filtered);
    };

    const resetFilters = () => {
        setFilterTeacher('');
        setFilterClass('');
        setFilterSubject('');
        setFilterMonth(new Date().toISOString().slice(0, 7));
        setSearchTerm('');
    };

    const handleMonthChange = (direction: 'prev' | 'next') => {
        const [year, month] = filterMonth.split('-').map(Number);
        const date = new Date(year, month - 1);

        if (direction === 'prev') {
            date.setMonth(date.getMonth() - 1);
        } else {
            date.setMonth(date.getMonth() + 1);
        }

        const newYear = date.getFullYear();
        const newMonth = String(date.getMonth() + 1).padStart(2, '0');
        setFilterMonth(`${newYear}-${newMonth}`);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Group logs based on view mode
    const groupedLogs = filteredLogs.reduce((acc, log) => {
        const key = viewMode === 'teacher' ? log.teacherName : log.className;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(log);
        return acc;
    }, {} as Record<string, TeachingLog[]>);

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 900, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <BookOpen
                            size={28}
                            color="var(--primary)"
                            strokeWidth={2.5}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setShowWipeButton(!showWipeButton)}
                        />
                        Teaching Log Reports
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                        View and analyze all teaching activities
                    </p>
                </div>
                {showWipeButton && (
                    <button
                        onClick={() => setShowWipeModal(true)}
                        className="btn"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: '#ef4444',
                            borderColor: '#fee2e2',
                            background: '#fff',
                            padding: '0.75rem 1.25rem',
                            fontWeight: 800,
                            borderRadius: '0.75rem',
                            boxShadow: '0 2px 4px rgba(239, 68, 68, 0.05)'
                        }}
                    >
                        <Trash2 size={18} /> Wipe All Logs
                    </button>
                )}
            </div>

            {/* View Mode Toggle */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <button
                    onClick={() => setViewMode('teacher')}
                    style={{
                        padding: '0.875rem 1.75rem',
                        background: viewMode === 'teacher'
                            ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                            : 'white',
                        color: viewMode === 'teacher' ? 'white' : '#64748b',
                        border: viewMode === 'teacher' ? 'none' : '2px solid #e2e8f0',
                        borderRadius: '0.75rem',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: viewMode === 'teacher' ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none'
                    }}
                    className="hover-lift"
                >
                    <Users size={20} />
                    Teacher-wise View
                </button>

                <button
                    onClick={() => setViewMode('class')}
                    style={{
                        padding: '0.875rem 1.75rem',
                        background: viewMode === 'class'
                            ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                            : 'white',
                        color: viewMode === 'class' ? 'white' : '#64748b',
                        border: viewMode === 'class' ? 'none' : '2px solid #e2e8f0',
                        borderRadius: '0.75rem',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: viewMode === 'class' ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none'
                    }}
                    className="hover-lift"
                >
                    <GraduationCap size={20} />
                    Class-wise View
                </button>
            </div>

            {/* Filters */}
            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <Filter size={20} color="var(--primary)" />
                    <h3 style={{ fontWeight: 800, fontSize: '1.125rem' }}>Filters</h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.875rem', color: '#64748b' }}>
                            Teacher
                        </label>
                        <select
                            value={filterTeacher}
                            onChange={(e) => setFilterTeacher(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                borderRadius: '0.5rem',
                                border: '2px solid #e2e8f0',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            <option value="">All Teachers</option>
                            {teachers.map((teacher) => (
                                <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.875rem', color: '#64748b' }}>
                            Class
                        </label>
                        <select
                            value={filterClass}
                            onChange={(e) => setFilterClass(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                borderRadius: '0.5rem',
                                border: '2px solid #e2e8f0',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            <option value="">All Classes</option>
                            {classes.map((cls) => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.875rem', color: '#64748b' }}>
                            Subject
                        </label>
                        <select
                            value={filterSubject}
                            onChange={(e) => setFilterSubject(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                borderRadius: '0.5rem',
                                border: '2px solid #e2e8f0',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            <option value="">All Subjects</option>
                            {subjects.map((subj) => (
                                <option key={subj} value={subj}>{subj}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.875rem', color: '#64748b' }}>
                            Month
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                                onClick={() => handleMonthChange('prev')}
                                className="btn-icon shadow-sm"
                                style={{ padding: '0.5rem', background: 'white', border: '2px solid #e2e8f0' }}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <input
                                type="month"
                                value={filterMonth}
                                onChange={(e) => setFilterMonth(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem 1rem',
                                    borderRadius: '0.5rem',
                                    border: '2px solid #e2e8f0',
                                    fontSize: '0.875rem',
                                    fontWeight: 600
                                }}
                            />
                            <button
                                onClick={() => handleMonthChange('next')}
                                className="btn-icon shadow-sm"
                                style={{ padding: '0.5rem', background: 'white', border: '2px solid #e2e8f0' }}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.875rem', color: '#64748b' }}>
                            Search
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search topics..."
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem 0.75rem 3rem',
                                    borderRadius: '0.5rem',
                                    border: '2px solid #e2e8f0',
                                    fontSize: '0.875rem',
                                    fontWeight: 600
                                }}
                            />
                        </div>
                    </div>
                </div>

                {(filterTeacher || filterClass || filterSubject || filterMonth || searchTerm) && (
                    <button
                        onClick={resetFilters}
                        style={{
                            padding: '0.625rem 1.25rem',
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            cursor: 'pointer'
                        }}
                        className="hover-lift"
                    >
                        Clear Filters
                    </button>
                )}
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div className="glass-card hover-lift" style={{ padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--primary)' }}>
                        {filteredLogs.length}
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#64748b', marginTop: '0.5rem' }}>
                        Total Entries
                    </div>
                </div>

                <div className="glass-card hover-lift" style={{ padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#10b981' }}>
                        {teachers.length}
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#64748b', marginTop: '0.5rem' }}>
                        Active Teachers
                    </div>
                </div>

                <div className="glass-card hover-lift" style={{ padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f59e0b' }}>
                        {classes.length}
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#64748b', marginTop: '0.5rem' }}>
                        Classes
                    </div>
                </div>

                <div className="glass-card hover-lift" style={{ padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#8b5cf6' }}>
                        {subjects.length}
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#64748b', marginTop: '0.5rem' }}>
                        Subjects
                    </div>
                </div>
            </div>

            {/* Grouped Logs */}
            {loading ? (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1rem', color: '#64748b', fontWeight: 600 }}>
                        Loading teaching logs...
                    </div>
                </div>
            ) : Object.keys(groupedLogs).length === 0 ? (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                    <BookOpen size={48} color="#cbd5e1" style={{ margin: '0 auto 1rem' }} />
                    <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem' }}>
                        No teaching logs found
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8', fontWeight: 600 }}>
                        {filterTeacher || filterClass || filterSubject || filterMonth || searchTerm
                            ? 'Try adjusting your filters'
                            : 'No teaching logs have been recorded yet'}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {Object.keys(groupedLogs).sort().map((group) => (
                        <div key={group} className="glass-card" style={{ padding: '2rem' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                marginBottom: '1.5rem',
                                paddingBottom: '1rem',
                                borderBottom: '2px solid #e2e8f0'
                            }}>
                                {viewMode === 'teacher' ? <Users size={24} color="var(--primary)" /> : <GraduationCap size={24} color="var(--primary)" />}
                                <h2 style={{ fontWeight: 900, fontSize: '1.5rem' }}>
                                    {group}
                                </h2>
                                <span style={{
                                    padding: '0.375rem 0.875rem',
                                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%)',
                                    color: 'var(--primary)',
                                    borderRadius: '0.5rem',
                                    fontWeight: 800,
                                    fontSize: '0.875rem'
                                }}>
                                    {groupedLogs[group].length} {groupedLogs[group].length === 1 ? 'entry' : 'entries'}
                                </span>
                            </div>

                            <div style={{ display: 'grid', gap: '1rem' }}>
                                {groupedLogs[group].map((log) => (
                                    <div key={log.id} style={{
                                        padding: '1.25rem',
                                        background: '#f8fafc',
                                        borderRadius: '0.75rem',
                                        border: '1px solid #e2e8f0'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                {viewMode === 'class' && (
                                                    <span style={{
                                                        padding: '0.375rem 0.875rem',
                                                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
                                                        color: '#7c3aed',
                                                        borderRadius: '0.5rem',
                                                        fontWeight: 800,
                                                        fontSize: '0.875rem'
                                                    }}>
                                                        {log.teacherName}
                                                    </span>
                                                )}
                                                {viewMode === 'teacher' && (
                                                    <span style={{
                                                        padding: '0.375rem 0.875rem',
                                                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%)',
                                                        color: 'var(--primary)',
                                                        borderRadius: '0.5rem',
                                                        fontWeight: 800,
                                                        fontSize: '0.875rem'
                                                    }}>
                                                        {log.className}
                                                    </span>
                                                )}
                                                <span style={{
                                                    padding: '0.375rem 0.875rem',
                                                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
                                                    color: '#059669',
                                                    borderRadius: '0.5rem',
                                                    fontWeight: 800,
                                                    fontSize: '0.875rem'
                                                }}>
                                                    {log.subject}
                                                </span>
                                            </div>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                color: '#64748b',
                                                fontSize: '0.875rem',
                                                fontWeight: 700
                                            }}>
                                                <Calendar size={16} />
                                                {formatDate(log.date)}
                                            </div>
                                        </div>

                                        <h4 style={{ fontWeight: 800, fontSize: '1.125rem', marginBottom: '0.5rem', color: '#1e293b' }}>
                                            {log.topic}
                                        </h4>

                                        {log.description && (
                                            <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.6 }}>
                                                {log.description}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Wipe Confirmation Modal */}
            {showWipeModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div className="glass-card" style={{
                        width: '100%',
                        maxWidth: '500px',
                        padding: '2rem',
                        position: 'relative',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                        animation: 'slideUp 0.3s ease-out'
                    }}>
                        <button
                            onClick={() => {
                                if (!isWiping) {
                                    setShowWipeModal(false);
                                    setWipeConfirmationText('');
                                }
                            }}
                            style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                        >
                            <X size={24} />
                        </button>

                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                background: '#fee2e2',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1rem',
                                color: '#ef4444'
                            }}>
                                <AlertTriangle size={36} />
                            </div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', marginBottom: '0.5rem' }}>Are you absolutely sure?</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                                This action <strong style={{ color: '#ef4444' }}>CANNOT BE UNDONE</strong>. It will permanently delete all teaching log entries for this school.
                            </p>
                        </div>

                        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                            <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '0.75rem', textAlign: 'center' }}>
                                To confirm, please type <strong style={{ color: '#111827', userSelect: 'all' }}>WIPE ALL TEACHING LOGS</strong> in the box below:
                            </p>
                            <input
                                type="text"
                                className="input-field"
                                autoFocus
                                value={wipeConfirmationText}
                                onChange={(e) => setWipeConfirmationText(e.target.value)}
                                placeholder="Type the text exactly..."
                                style={{
                                    textAlign: 'center',
                                    fontWeight: 700,
                                    borderColor: wipeConfirmationText === 'WIPE ALL TEACHING LOGS' ? '#22c55e' : 'var(--border)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                className="btn"
                                style={{ flex: 1, fontWeight: 700 }}
                                onClick={() => {
                                    setShowWipeModal(false);
                                    setWipeConfirmationText('');
                                }}
                                disabled={isWiping}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                style={{
                                    flex: 2,
                                    background: wipeConfirmationText === 'WIPE ALL TEACHING LOGS' ? '#ef4444' : '#fca5a5',
                                    border: 'none',
                                    fontWeight: 800,
                                    opacity: wipeConfirmationText === 'WIPE ALL TEACHING LOGS' ? 1 : 0.7,
                                    cursor: wipeConfirmationText === 'WIPE ALL TEACHING LOGS' ? 'pointer' : 'not-allowed'
                                }}
                                onClick={handleWipeAllLogs}
                                disabled={wipeConfirmationText !== 'WIPE ALL TEACHING LOGS' || isWiping}
                            >
                                {isWiping ? 'Wiping Logs...' : 'Confirm Wipe All Logs'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
