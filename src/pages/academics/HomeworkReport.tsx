import React, { useState, useEffect, useMemo } from 'react';
import {
    FileText,
    Search,
    Calendar,
    BookOpen,
    User,
    Filter,
    ArrowDownToLine,
    Loader2,
    CheckCircle,
    X,
    XCircle,
    Clock,
    BarChart3,
    PieChart as PieIcon
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';
import { formatDate } from '../../utils/dateUtils';
import { db } from '../../lib/firebase';
import { doc, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

const HomeworkReport: React.FC = () => {
    const { user } = useAuth();
    const { currentSchool } = useSchool();
    const schoolFilter = useMemo(() => {
        const id = currentSchool?.id || user?.schoolId;
        return id ? [where('schoolId', '==', id)] : [];
    }, [currentSchool?.id, user?.schoolId]);

    const { data: allSettings } = useFirestore<any>('settings', schoolFilter, { skipSchoolFilter: true });
    const { data: rawHomeworks, loading } = useFirestore<any>('homework', schoolFilter, { skipSchoolFilter: true });

    const [activeTab, setActiveTab] = useState<'tasks' | 'overview' | 'student'>('tasks');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [timeRange, setTimeRange] = useState<'THIS_MONTH' | 'LAST_MONTH' | 'LIFETIME'>('THIS_MONTH');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewDetail, setViewDetail] = useState<{ className: string, section: string } | null>(null);

    // Student Analysis States
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [studentSearch, setStudentSearch] = useState('');

    const { data: allSubmissions, loading: loadingSubs } = useFirestore<any>('homeworkSubmissions', schoolFilter, { skipSchoolFilter: true });
    const { data: allStudents } = useFirestore<any>('students', schoolFilter, { skipSchoolFilter: true });

    const classSettings = allSettings?.filter((s: any) => s.type === 'class' && s.active !== false) || [];

    // Process Overview Data (Class-wise)
    const classOverview = useMemo(() => {
        if (loading || loadingSubs) return [];

        const classes = selectedClass ? classSettings.filter(c => c.name === selectedClass) : classSettings;

        const normalize = (val: string) => String(val || '').toLowerCase().replace(/class/gi, '').trim();
        const isClassMatch = (c1: string, c2: string) => normalize(c1) === normalize(c2) && normalize(c1) !== '';
        const isSectionMatch = (hwSec: string, classSec: string) => {
            if (!hwSec || hwSec === 'All Sections' || !classSec || classSec === 'All Sections') return true;
            return normalize(hwSec) === normalize(classSec);
        };

        return classes.map(cls => {
            const sections = (cls.sections && cls.sections.length > 0) ? cls.sections : [''];

            return sections.map((sec: string) => {
                // Find homeworks that match this class and section
                const hwForClass = rawHomeworks.filter(h => {
                    const classMatch = isClassMatch(h.class, cls.name);
                    const secMatch = isSectionMatch(h.section, sec);

                    // Apply Time Filter
                    // Robust Date Parsing
                    const getRawDate = (h: any) => {
                        if (h.assignedDate) return new Date(h.assignedDate);
                        if (h.createdAt?.toDate) return h.createdAt.toDate();
                        if (h.createdAt) return new Date(h.createdAt);
                        return new Date(0);
                    };
                    const date = getRawDate(h);
                    const now = new Date();
                    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    const startOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
                    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

                    let timeMatch = true;
                    if (timeRange === 'THIS_MONTH') timeMatch = date >= startOfThisMonth;
                    else if (timeRange === 'LAST_MONTH') timeMatch = date >= startOfLastMonth && date <= endOfLastMonth;

                    return classMatch && secMatch && timeMatch;
                });

                const totalTasks = hwForClass.length;
                if (totalTasks === 0 && !selectedClass) return null; // Hide empty unless specifically filtered

                const classStudents = allStudents.filter(st =>
                    isClassMatch(st.class, cls.name) && isSectionMatch(st.section, sec)
                );
                const studentCount = classStudents.length;

                const subsForClass = allSubmissions.filter(s =>
                    hwForClass.some(h => h.id === s.homeworkId)
                );

                const totalStudentTasks = totalTasks * studentCount;
                const completedCount = subsForClass.filter(s => s.status === 'COMPLETED').length;
                const partialCount = subsForClass.filter(s => s.status === 'PARTIAL').length;
                const effectiveCompleted = completedCount + (partialCount * 0.5);

                const completionRate = totalStudentTasks > 0 ? (effectiveCompleted / totalStudentTasks) * 100 : 0;

                const studentBreakdown = classStudents.map(student => {
                    const studentSubs = subsForClass.filter(s => s.studentId === student.id);
                    const studentCompleted = studentSubs.filter(s => s.status === 'COMPLETED').length;
                    const studentPartial = studentSubs.filter(s => s.status === 'PARTIAL').length;
                    const studentNotDone = studentSubs.filter(s => s.status === 'NOT_DONE').length;
                    const studentEffective = studentCompleted + (studentPartial * 0.5);
                    const totalMarked = studentCompleted + studentPartial + studentNotDone;
                    const rate = totalMarked > 0 ? (studentEffective / totalMarked) * 100 : 0;
                    return {
                        id: student.id,
                        name: student.fullName || student.name,
                        rollNo: student.classRollNo || 'N/A',
                        total: totalTasks,
                        completed: studentCompleted,
                        partial: studentPartial,
                        notDone: studentNotDone,
                        pending: totalTasks - totalMarked,
                        rate: rate.toFixed(1)
                    };
                }).sort((a, b) => (a.rollNo === 'N/A' ? 1 : b.rollNo === 'N/A' ? -1 : parseInt(a.rollNo) - parseInt(b.rollNo)));

                return {
                    className: cls.name,
                    section: sec,
                    totalTasks,
                    studentCount,
                    totalStudentTasks,
                    completedCount,
                    partialCount,
                    completionRate: completionRate.toFixed(1),
                    studentBreakdown
                };
            });
        }).flat().filter(Boolean);
    }, [rawHomeworks, allSubmissions, allStudents, classSettings, selectedClass, timeRange, loading, loadingSubs]);

    // Student Analysis Data
    const studentHistory = useMemo(() => {
        if (!selectedStudentId || loadingSubs) return [];

        const student = allStudents.find(s => s.id === selectedStudentId);
        if (!student) return [];

        const normalize = (val: string) => String(val || '').toLowerCase().replace(/class/gi, '').trim();
        const isClassMatch = (c1: string, c2: string) => normalize(c1) === normalize(c2) && normalize(c1) !== '';
        const isSectionMatch = (hwSec: string, classSec: string) => {
            if (!hwSec || hwSec === 'All Sections' || !classSec || classSec === 'All Sections') return true;
            return normalize(hwSec) === normalize(classSec);
        };

        // Get ALL homework assigned to this student's class/section
        const studentAssignedHw = rawHomeworks.filter(h =>
            isClassMatch(h.class, student.class) && isSectionMatch(h.section, student.section)
        );

        const studentSubs = allSubmissions.filter(s => s.studentId === selectedStudentId);

        const history = studentAssignedHw.map(hw => {
            const sub = studentSubs.find(s => s.homeworkId === hw.id);
            return {
                id: hw.id,
                subject: hw.subject || 'N/A',
                title: hw.title || 'Unknown',
                dueDate: hw.dueDate || 'N/A',
                status: sub?.status || 'PENDING',
                markedAt: sub?.markedAt || '',
                markedBy: sub?.markedBy || ''
            };
        }).sort((a, b) => {
            if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
            if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
            return b.dueDate.localeCompare(a.dueDate);
        });

        const totalAssigned = studentAssignedHw.length;
        const totalCompleted = studentSubs.filter(s => s.status === 'COMPLETED').length;
        const totalPartial = studentSubs.filter(s => s.status === 'PARTIAL').length;
        const totalNotDone = studentSubs.filter(s => s.status === 'NOT_DONE').length;
        const totalMarked = totalCompleted + totalPartial + totalNotDone;
        const totalPending = totalAssigned - totalMarked;
        const effectiveCompleted = totalCompleted + (totalPartial * 0.5);
        const rate = totalMarked > 0 ? (effectiveCompleted / totalMarked) * 100 : 0;

        return {
            history,
            stats: {
                totalAssigned,
                totalCompleted,
                totalPartial,
                totalNotDone,
                totalPending,
                rate: rate.toFixed(1)
            }
        };
    }, [selectedStudentId, allSubmissions, rawHomeworks, allStudents, loadingSubs]);

    const studentStats = (studentHistory as any).stats || { totalAssigned: 0, totalCompleted: 0, rate: 0 };
    const studentHistoryList = (studentHistory as any).history || [];

    const filteredStudents = useMemo(() => {
        if (!studentSearch) return [];
        const lowerSearch = studentSearch.toLowerCase();
        return allStudents.filter(s => {
            const sName = (s.fullName || s.name || s.studentName || '').toLowerCase();
            const sId = (s.id || s.admissionNo || '').toLowerCase();
            return sName.includes(lowerSearch) || sId.includes(lowerSearch);
        }).slice(0, 50);
    }, [allStudents, studentSearch]);

    const updateSubmissionStatus = async (homeworkId: string, studentId: string, studentName: string, newStatus: string) => {
        const docId = `sub_${homeworkId}_${studentId}`;
        const subRef = doc(db, 'homeworkSubmissions', docId);

        try {
            const dataToUpdate = {
                homeworkId: homeworkId,
                studentId: studentId,
                studentName: studentName || 'Student',
                schoolId: currentSchool?.id || '',
                status: newStatus,
                updatedAt: serverTimestamp(),
                markedAt: new Date().toISOString(),
                markedBy: user?.username || 'Admin'
            };

            await setDoc(subRef, dataToUpdate, { merge: true });
        } catch (e: any) {
            console.error("Submission save error:", e);
        }
    };

    const stats = {
        total: rawHomeworks.length,
        submissions: allSubmissions.filter(s => s.status === 'COMPLETED').length,
    };

    // Filter Logic
    const filteredHomeworks = rawHomeworks.filter(h => {
        // Class Filter
        if (selectedClass && h.class !== selectedClass) return false;
        if (selectedSection && h.section && h.section !== selectedSection) return false;

        // Time Range Filter
        // Time Range Filter
        const getRawDate = (h: any) => {
            if (h.assignedDate) return new Date(h.assignedDate);
            if (h.createdAt?.toDate) return h.createdAt.toDate();
            if (h.createdAt) return new Date(h.createdAt);
            return new Date(0);
        };
        const date = getRawDate(h);
        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        if (timeRange === 'THIS_MONTH' && date < startOfThisMonth) return false;
        if (timeRange === 'LAST_MONTH' && (date < startOfLastMonth || date > endOfLastMonth)) return false;

        // Search Query - now includes title, subject, and teacher name
        if (searchQuery &&
            !h.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !h.subject.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !(h.teacherName || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;

        return true;
    }).sort((a, b) => new Date(b.assignedDate || b.createdAt || 0).getTime() - new Date(a.assignedDate || a.createdAt || 0).getTime());


    return (
        <div className="animate-fade-in no-scrollbar" style={{ paddingBottom: '4rem' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '0.25rem' }}>Homework Report</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Detailed analysis of assigned homework tasks.</p>
                </div>
                <div style={{ display: 'flex', background: 'white', padding: '0.4rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', gap: '0.5rem' }}>
                    {(['tasks', 'overview', 'student'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`btn ${activeTab === tab ? 'btn-primary' : ''}`}
                            style={{
                                padding: '0.5rem 1rem',
                                border: 'none',
                                background: activeTab === tab ? 'var(--primary)' : 'transparent',
                                color: activeTab === tab ? 'white' : 'var(--text-muted)',
                                textTransform: 'capitalize'
                            }}
                        >
                            {tab === 'student' ? 'Student Analysis' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'tasks' && (
                <>

                    {/* Quick Stats */}
                    <div className="responsive-grid-auto" style={{ marginBottom: '2rem' }}>
                        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '1rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FileText size={24} />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Assigned</p>
                                <h4 style={{ fontSize: '1.5rem', fontWeight: 900 }}>{stats.total}</h4>
                            </div>
                        </div>
                        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <BookOpen size={24} />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Classes Covered</p>
                                <h4 style={{ fontSize: '1.5rem', fontWeight: 900 }}>{[...new Set(filteredHomeworks.map(h => h.class))].length}</h4>
                            </div>
                        </div>
                    </div>

                    {/* Filters Bar */}
                    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'flex-end' }}>
                            <div className="input-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Filter size={14} /> Class</label>
                                <select className="input-field" value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); }}>
                                    <option value="">All Classes</option>
                                    {classSettings.map((c: any) => <option key={c.name} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>

                            {selectedClass && (
                                <div className="input-group">
                                    <label>Section</label>
                                    <select className="input-field" value={selectedSection} onChange={e => setSelectedSection(e.target.value)}>
                                        <option value="">All Sections</option>
                                        {classSettings.find((c: any) => c.name === selectedClass)?.sections?.map((s: string) => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="input-group" style={{ gridColumn: 'span 1' }}>
                                <label>Search Task</label>
                                <div style={{ position: 'relative' }}>
                                    <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                    <input
                                        type="text"
                                        className="input-field"
                                        style={{ paddingLeft: '2.75rem' }}
                                        placeholder="Search by title, subject, or teacher..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', background: '#f8fafc', padding: '0.35rem', borderRadius: '1rem', border: '1px solid #e2e8f0', gap: '0.25rem' }}>
                                {(['THIS_MONTH', 'LAST_MONTH', 'LIFETIME'] as const).map(range => (
                                    <button
                                        key={range}
                                        onClick={() => setTimeRange(range)}
                                        style={{
                                            flex: 1,
                                            padding: '0.6rem 1rem',
                                            borderRadius: '0.75rem',
                                            border: 'none',
                                            fontSize: '0.7rem',
                                            fontWeight: 900,
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
                        </div>
                    </div>

                    {/* Attendance Table */}
                    <div className="glass-card no-scrollbar" style={{ overflowX: 'auto', padding: '1rem' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Class</th>
                                    <th>Subject</th>
                                    <th>Title</th>
                                    <th>Assigned By</th>
                                    <th>Due Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '4rem' }}><Loader2 className="animate-spin" size={30} color="var(--primary)" /></td></tr>
                                ) : filteredHomeworks.length > 0 ? filteredHomeworks.map((h, idx) => (
                                    <tr key={h.id || idx}>
                                        <td style={{ fontWeight: 800 }}>{formatDate(h.assignedDate || h.createdAt)}</td>
                                        <td><span style={{ fontWeight: 700, color: 'var(--primary)' }}>{h.class}</span> {h.section && `(${h.section})`}</td>
                                        <td style={{ fontWeight: 700 }}>{h.subject}</td>
                                        <td style={{ maxWidth: '300px' }}>
                                            <div style={{ fontWeight: 800, marginBottom: '0.25rem' }}>{h.title}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.description}</div>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{h.teacherName}</td>
                                        <td style={{ fontWeight: 800, color: '#f43f5e' }}>{h.dueDate || 'N/A'}</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>No records found for the selected criteria.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {activeTab === 'overview' && (
                <div className="animate-fade-in">
                    {!viewDetail ? (
                        <>
                            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
                                    <div className="input-group" style={{ marginBottom: 0, minWidth: '250px' }}>
                                        <label>Filter Class</label>
                                        <select className="input-field" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                                            <option value="">All Classes</option>
                                            {classSettings.map((c: any) => <option key={c.name} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </div>

                                    {/* Time Range Chips */}
                                    <div style={{ display: 'flex', background: '#f8fafc', padding: '0.35rem', borderRadius: '1rem', border: '1px solid #e2e8f0', gap: '0.25rem' }}>
                                        {(['THIS_MONTH', 'LAST_MONTH', 'LIFETIME'] as const).map(range => (
                                            <button
                                                key={range}
                                                onClick={() => setTimeRange(range)}
                                                style={{
                                                    padding: '0.6rem 1.25rem',
                                                    borderRadius: '0.75rem',
                                                    border: 'none',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 900,
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
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                                {classOverview.length > 0 ? classOverview.map((item: any, idx) => (
                                    <div
                                        key={idx}
                                        className="glass-card hover-lift"
                                        style={{ padding: '1.25rem', border: '1px solid var(--border)', cursor: 'pointer' }}
                                        onClick={() => setViewDetail({ className: item.className, section: item.section })}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                            <div>
                                                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>Class {item.className}</h3>
                                                {item.section && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.1rem 0 0 0' }}>Section {item.section}</p>}
                                            </div>
                                            <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.4rem', borderRadius: '0.75rem' }}>
                                                <BarChart3 size={20} />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '1rem', border: '1px solid #f1f5f9' }}>
                                                <p style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Assigned</p>
                                                <p style={{ fontSize: '1rem', fontWeight: 900, color: '#1e293b', margin: 0 }}>{item.totalStudentTasks}</p>
                                            </div>
                                            <div style={{ background: '#f0fdf4', padding: '0.75rem', borderRadius: '1rem', border: '1px solid #dcfce7' }}>
                                                <p style={{ fontSize: '0.6rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Done</p>
                                                <p style={{ fontSize: '1rem', fontWeight: 900, color: '#065f46', margin: 0 }}>{item.completedCount}</p>
                                            </div>
                                            <div style={{ background: '#fffbeb', padding: '0.75rem', borderRadius: '1rem', border: '1px solid #fef3c7' }}>
                                                <p style={{ fontSize: '0.6rem', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Partial</p>
                                                <p style={{ fontSize: '1rem', fontWeight: 900, color: '#92400e', margin: 0 }}>{item.partialCount}</p>
                                            </div>
                                            <div style={{ background: '#fef2f2', padding: '0.75rem', borderRadius: '1rem', border: '1px solid #fee2e2' }}>
                                                <p style={{ fontSize: '0.6rem', fontWeight: 800, color: '#b91c1c', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Missed</p>
                                                <p style={{ fontSize: '1rem', fontWeight: 900, color: '#991b1b', margin: 0 }}>{item.totalStudentTasks - (item.completedCount + item.partialCount)}</p>
                                            </div>
                                        </div>

                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>Completion Score</p>
                                                <p style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--primary)' }}>{item.completionRate}%</p>
                                            </div>
                                            <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex' }}>
                                                <div style={{ width: `${(item.completedCount / item.totalStudentTasks) * 100}%`, height: '100%', background: '#10b981' }}></div>
                                                <div style={{ width: `${(item.partialCount / item.totalStudentTasks) * 100}%`, height: '100%', background: '#f59e0b' }}></div>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Click to view Students →</span>
                                        </div>
                                    </div>
                                )) : (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem' }} className="glass-card">
                                        <Clock size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                        <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>No homework history found for analysis.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="detail-view animate-slide-up">
                            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <button className="btn btn-outline" onClick={() => setViewDetail(null)} style={{ padding: '0.5rem 1rem' }}>← Back to Grid</button>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>
                                    Class {viewDetail.className} {viewDetail.section ? `(${viewDetail.section})` : ''} - Student Report
                                </h2>
                            </div>

                            {/* Time Range Chips inside Detail */}
                            <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                                <div style={{ display: 'flex', background: '#f8fafc', padding: '0.35rem', borderRadius: '1rem', border: '1px solid #e2e8f0', gap: '0.25rem' }}>
                                    {(['THIS_MONTH', 'LAST_MONTH', 'LIFETIME'] as const).map(range => (
                                        <button
                                            key={range}
                                            onClick={() => setTimeRange(range)}
                                            style={{
                                                padding: '0.6rem 1.5rem',
                                                borderRadius: '0.75rem',
                                                border: 'none',
                                                fontSize: '0.8rem',
                                                fontWeight: 900,
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
                            </div>

                            <div className="glass-card no-scrollbar" style={{ overflowX: 'auto', padding: '0' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Roll No</th>
                                            <th>Student Name</th>
                                            <th style={{ textAlign: 'center' }}>Assigned</th>
                                            <th style={{ textAlign: 'center' }}>Done</th>
                                            <th style={{ textAlign: 'center' }}>Partial</th>
                                            <th style={{ textAlign: 'center' }}>Success %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {classOverview.find(o => o.className === viewDetail.className && o.section === viewDetail.section)?.studentBreakdown?.map((s: any) => (
                                            <tr key={s.id}>
                                                <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{s.rollNo}</td>
                                                <td style={{ fontWeight: 700 }}>{s.name}</td>
                                                <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.total}</td>
                                                <td style={{ textAlign: 'center', fontWeight: 700, color: '#10b981' }}>{s.completed}</td>
                                                <td style={{ textAlign: 'center', fontWeight: 700, color: '#f59e0b' }}>{s.partial}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                                                        <div style={{ width: '100px', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                                                            <div style={{ width: `${(s.completed / s.total) * 100}%`, height: '100%', background: '#10b981' }}></div>
                                                            <div style={{ width: `${(s.partial / s.total) * 100}%`, height: '100%', background: '#f59e0b' }}></div>
                                                        </div>
                                                        <span style={{ fontWeight: 900, fontSize: '0.9rem', minWidth: '50px' }}>{s.rate}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )) || (
                                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '4rem' }}>No student data available.</td></tr>
                                            )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'student' && (
                <div className="animate-fade-in">
                    <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem', overflow: 'visible', position: 'relative', zIndex: 10 }}>
                        <div className="input-group" style={{ marginBottom: 0, maxWidth: '500px', overflow: 'visible' }}>
                            <label>Search Student for Detailed Report</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    className="input-field"
                                    style={{ paddingLeft: '3rem' }}
                                    placeholder="Type student name or ID..."
                                    value={studentSearch}
                                    onChange={(e) => {
                                        setStudentSearch(e.target.value);
                                        if (e.target.value === '') setSelectedStudentId('');
                                    }}
                                />
                                {studentSearch && filteredStudents.length > 0 && (activeTab === 'student') && !selectedStudentId && (
                                    <div style={{
                                        position: 'absolute',
                                        width: '100%',
                                        background: 'white',
                                        border: '1px solid var(--border)',
                                        borderRadius: '0.5rem',
                                        marginTop: '0.5rem',
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                        zIndex: 1000,
                                        maxHeight: '300px',
                                        overflowY: 'auto'
                                    }}>
                                        {filteredStudents.map(s => (
                                            <button
                                                key={s.id}
                                                onClick={() => {
                                                    const sName = s.fullName || s.name || s.studentName || 'Student';
                                                    setSelectedStudentId(s.id);
                                                    setStudentSearch(sName);
                                                }}
                                                style={{ width: '100%', textAlign: 'left', padding: '1rem', border: 'none', background: 'transparent', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                                            >
                                                <div style={{ fontWeight: 700 }}>{s.fullName || s.name || s.studentName || s.id}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                    {s.class ? (s.class.toString().toLowerCase().includes('class') ? s.class : `Class ${s.class}`) : 'No Class'}
                                                    {s.classRollNo ? ` • Roll ${s.classRollNo}` : ''}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {selectedStudentId ? (
                        <div className="animate-slide-up">
                            {/* Individual Student Header Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.1rem' }}>Assigned</p>
                                        <h4 style={{ fontSize: '1.1rem', fontWeight: 900 }}>{studentStats.totalAssigned} Tasks</h4>
                                    </div>
                                </div>
                                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <CheckCircle size={20} />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.1rem' }}>Verified Done</p>
                                        <h4 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981' }}>{studentStats.totalCompleted}</h4>
                                    </div>
                                </div>
                                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.1rem' }}>Partial</p>
                                        <h4 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f59e0b' }}>{studentStats.totalPartial}</h4>
                                    </div>
                                </div>
                                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <X size={20} />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.6rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', marginBottom: '0.1rem' }}>Marked No</p>
                                        <h4 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ef4444' }}>{studentStats.totalNotDone || 0}</h4>
                                    </div>
                                </div>
                                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f1f5f9', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.1rem' }}>Pending</p>
                                        <h4 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#64748b' }}>{studentStats.totalPending || 0}</h4>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem', alignItems: 'start' }}>
                                {/* Left Side: 3D Chart Card */}
                                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', position: 'sticky', top: '2rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '2rem' }}>Completion Score</h3>

                                    <div style={{
                                        position: 'relative',
                                        width: '200px',
                                        height: '200px',
                                        margin: '0 auto',
                                        perspective: '1000px'
                                    }}>
                                        {/* 3D Visual Effect Layers */}
                                        <div className="chart-3d-ring" style={{
                                            width: '100%',
                                            height: '100%',
                                            borderRadius: '50%',
                                            background: `conic-gradient(
                                                #10b981 0% ${(studentStats.totalCompleted / studentStats.totalAssigned) * 100}%, 
                                                #f59e0b ${(studentStats.totalCompleted / studentStats.totalAssigned) * 100}% ${((studentStats.totalCompleted + studentStats.totalPartial) / studentStats.totalAssigned) * 100}%, 
                                                #ef4444 ${((studentStats.totalCompleted + studentStats.totalPartial) / studentStats.totalAssigned) * 100}% ${((studentStats.totalCompleted + studentStats.totalPartial + studentStats.totalNotDone) / studentStats.totalAssigned) * 100}%,
                                                #e2e8f0 ${((studentStats.totalCompleted + studentStats.totalPartial + studentStats.totalNotDone) / studentStats.totalAssigned) * 100}% 100%
                                            )`,
                                            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2), inset 0 0 40px rgba(0,0,0,0.1)',
                                            transform: 'rotateX(20deg)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            animation: 'float 3s ease-in-out infinite'
                                        }}>
                                            <div style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transform: 'translateZ(40px)',
                                                textShadow: '0 4px 15px rgba(0,0,0,0.4)',
                                                pointerEvents: 'none'
                                            }}>
                                                <span style={{ fontSize: '3rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>{Math.round(studentStats.rate)}%</span>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.25rem' }}>Success</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '2.5rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left', background: '#f8fafc', padding: '1rem', borderRadius: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', fontWeight: 800 }}>
                                                <div style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '3px' }}></div>
                                                <span style={{ color: '#475569' }}>Verified Done: {studentStats.totalCompleted}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', fontWeight: 800 }}>
                                                <div style={{ width: '12px', height: '12px', background: '#f59e0b', borderRadius: '3px' }}></div>
                                                <span style={{ color: '#475569' }}>Partially Done: {studentStats.totalPartial}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', fontWeight: 800 }}>
                                                <div style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '3px' }}></div>
                                                <span style={{ color: '#475569' }}>Marked No: {studentStats.totalNotDone || 0}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', fontWeight: 800 }}>
                                                <div style={{ width: '12px', height: '12px', background: '#e2e8f0', borderRadius: '3px' }}></div>
                                                <span style={{ color: '#475569' }}>Unmarked/Pending: {studentStats.totalPending || 0}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '2rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                                            <span style={{ fontWeight: 700 }}>Success Performance</span>
                                            <span style={{ fontWeight: 900, color: parseFloat(studentStats.rate) > 75 ? '#10b981' : parseFloat(studentStats.rate) > 40 ? '#f59e0b' : '#ef4444' }}>
                                                {parseFloat(studentStats.rate) > 75 ? 'Excellent' : parseFloat(studentStats.rate) > 40 ? 'Average' : 'Needs Focus'}
                                            </span>
                                        </div>
                                        <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                                            <div style={{ width: `${(studentStats.totalCompleted / studentStats.totalAssigned) * 100}%`, height: '100%', background: '#10b981' }}></div>
                                            <div style={{ width: `${(studentStats.totalPartial / studentStats.totalAssigned) * 100}%`, height: '100%', background: '#f59e0b' }}></div>
                                            <div style={{ width: `${(studentStats.totalNotDone / studentStats.totalAssigned) * 100}%`, height: '100%', background: '#ef4444' }}></div>
                                            <div style={{ width: `${(studentStats.totalPending / studentStats.totalAssigned) * 100}%`, height: '100%', background: '#e2e8f0' }}></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Table Card */}
                                <div className="glass-card" style={{ padding: '0' }}>
                                    <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{ fontWeight: 800 }}>Submission History</h3>
                                    </div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Subject</th>
                                                    <th>Task Title</th>
                                                    <th>Due Date</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {studentHistoryList.length > 0 ? studentHistoryList.map((h: any, idx: number) => (
                                                    <tr key={h.id || idx}>
                                                        <td style={{ fontWeight: 700 }}>{h.subject}</td>
                                                        <td>
                                                            <div style={{ fontWeight: 800 }}>{h.title}</div>
                                                            {h.markedAt && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Verified: {formatDate(h.markedAt)}</div>}
                                                        </td>
                                                        <td style={{ fontWeight: 800 }}>{h.dueDate}</td>
                                                        <td>
                                                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                                                                {[
                                                                    { id: 'COMPLETED', label: 'Done', color: '#10b981' },
                                                                    { id: 'PARTIAL', label: 'Partial', color: '#f59e0b' },
                                                                    { id: 'NOT_DONE', label: 'No', color: '#ef4444' }
                                                                ].map(btn => (
                                                                    <button
                                                                        key={btn.id}
                                                                        onClick={() => updateSubmissionStatus(h.id, selectedStudentId, studentSearch, btn.id)}
                                                                        style={{
                                                                            padding: '0.35rem 0.6rem',
                                                                            borderRadius: '0.4rem',
                                                                            fontSize: '0.6rem',
                                                                            fontWeight: 900,
                                                                            border: '1px solid',
                                                                            borderColor: h.status === btn.id ? btn.color : '#e2e8f0',
                                                                            background: h.status === btn.id ? btn.color : 'transparent',
                                                                            color: h.status === btn.id ? 'white' : '#94a3b8',
                                                                            cursor: 'pointer',
                                                                            transition: 'all 0.2s'
                                                                        }}
                                                                    >
                                                                        {btn.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )) : (
                                                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>No assigned tasks found for this student.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="glass-card" style={{ padding: '5rem', textAlign: 'center' }}>
                            <PieIcon size={48} style={{ opacity: 0.1, margin: '0 auto 1.5rem' }} />
                            <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Please search and select a student to view their history.</p>
                        </div>
                    )}
                </div>
            )}

            <style>{`
                .data-table { width: 100%; border-collapse: separate; border-spacing: 0; }
                .data-table th { background: #f8fafc; color: #64748b; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 1.25rem 1.5rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
                .data-table td { padding: 1.25rem 1.5rem; font-size: 0.875rem; border-bottom: 1px solid #f1f5f9; }
                .data-table tr:last-child td { border-bottom: none; }
                .data-table tr:hover td { background: #f8fafc; }
                .hover-lift { transition: transform 0.2s, box-shadow 0.2s; }
                .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 12px 20px -5px rgba(0,0,0,0.1); }
                .animate-slide-up { animation: slideUp 0.4s ease-out; }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes float { 
                    0%, 100% { transform: rotateX(20deg) translateY(0); }
                    50% { transform: rotateX(20deg) translateY(-10px); }
                }
                .chart-3d-ring { transition: all 0.5s ease; }
                .chart-3d-ring:hover { transform: rotateX(10deg) scale(1.05) !important; }
            `}</style>
        </div>
    );
};

export default HomeworkReport;
