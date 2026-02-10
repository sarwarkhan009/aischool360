import React, { useState, useEffect } from 'react';
import { BookOpen, Calendar, Filter, Search, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSchool } from '../../context/SchoolContext';

interface TeachingLog {
    id: string;
    date: string;
    className: string;
    subject: string;
    topic: string;
    description: string;
    createdAt: string;
}

export default function MyTeachingLogs() {
    const { user } = useAuth();
    const { currentSchool } = useSchool();

    const [logs, setLogs] = useState<TeachingLog[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<TeachingLog[]>([]);
    const [loading, setLoading] = useState(true);

    const [filterClass, setFilterClass] = useState('');
    const [filterSubject, setFilterSubject] = useState('');
    const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
    const [searchTerm, setSearchTerm] = useState('');

    const [classes, setClasses] = useState<string[]>([]);
    const [subjects, setSubjects] = useState<string[]>([]);

    useEffect(() => {
        fetchTeachingLogs();
    }, [currentSchool?.id, user?.id]);

    useEffect(() => {
        applyFilters();
    }, [logs, filterClass, filterSubject, filterMonth, searchTerm]);

    const fetchTeachingLogs = async () => {
        if (!currentSchool?.id || !user?.id) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const logsRef = collection(db, 'teachingLogs');
            const q = query(
                logsRef,
                where('schoolId', '==', currentSchool.id),
                where('teacherId', '==', user.id)
            );

            const snapshot = await getDocs(q);
            const logsData: TeachingLog[] = [];
            const classesSet = new Set<string>();
            const subjectsSet = new Set<string>();

            snapshot.forEach((doc) => {
                const data = doc.data();
                logsData.push({
                    id: doc.id,
                    date: data.date,
                    className: data.className,
                    subject: data.subject,
                    topic: data.topic,
                    description: data.description || '',
                    createdAt: data.createdAt
                });
                classesSet.add(data.className);
                subjectsSet.add(data.subject);
            });

            // Sort by date descending
            logsData.sort((a, b) => b.date.localeCompare(a.date));

            setLogs(logsData);
            setClasses(Array.from(classesSet).sort());
            setSubjects(Array.from(subjectsSet).sort());
        } catch (error) {
            console.error('Error fetching teaching logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...logs];

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
                log.description.toLowerCase().includes(term)
            );
        }

        setFilteredLogs(filtered);
    };

    const resetFilters = () => {
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

    // Group logs by date
    const groupedLogs = filteredLogs.reduce((acc, log) => {
        if (!acc[log.date]) {
            acc[log.date] = [];
        }
        acc[log.date].push(log);
        return acc;
    }, {} as Record<string, TeachingLog[]>);

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 900, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <FileText size={28} color="var(--primary)" strokeWidth={2.5} />
                    My Teaching Logs
                </h1>
                <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                    View your class work history
                </p>
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
                            Search Topic
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

                {(filterClass || filterSubject || filterMonth || searchTerm) && (
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
                        {classes.length}
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#64748b', marginTop: '0.5rem' }}>
                        Classes Taught
                    </div>
                </div>

                <div className="glass-card hover-lift" style={{ padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f59e0b' }}>
                        {subjects.length}
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#64748b', marginTop: '0.5rem' }}>
                        Subjects Covered
                    </div>
                </div>
            </div>

            {/* Logs List */}
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
                        {filterClass || filterSubject || filterMonth || searchTerm
                            ? 'Try adjusting your filters'
                            : 'Start by adding your first teaching log'}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a)).map((date) => (
                        <div key={date}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                marginBottom: '1rem',
                                paddingBottom: '0.5rem',
                                borderBottom: '2px solid #e2e8f0'
                            }}>
                                <Calendar size={20} color="var(--primary)" />
                                <h3 style={{ fontWeight: 800, fontSize: '1.125rem' }}>
                                    {formatDate(date)}
                                </h3>
                                <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.875rem' }}>
                                    ({groupedLogs[date].length} {groupedLogs[date].length === 1 ? 'entry' : 'entries'})
                                </span>
                            </div>

                            <div style={{ display: 'grid', gap: '1rem' }}>
                                {groupedLogs[date].map((log) => (
                                    <div key={log.id} className="glass-card hover-lift" style={{ padding: '1.5rem' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
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

                                        <h4 style={{ fontWeight: 800, fontSize: '1.125rem', marginBottom: '0.75rem', color: '#1e293b' }}>
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
        </div>
    );
}
