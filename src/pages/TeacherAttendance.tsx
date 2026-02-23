import React, { useState, useEffect, useMemo } from 'react';
import {
    collection,
    getDocs,
    query,
    where,
    writeBatch,
    doc,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSchool } from '../context/SchoolContext';
import {
    Search,
    Save,
    Users,
    Calendar,
    Filter,
    Download,
    BarChart3
} from 'lucide-react';
import { useFirestore } from '../hooks/useFirestore';
import StaffDetailsTab from '../components/attendance/StaffDetailsTab';
import { formatDate } from '../utils/dateUtils';

const TeacherAttendance: React.FC = () => {
    const { currentSchool } = useSchool();
    const { data: teachers } = useFirestore<any>('teachers');
    const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
    const [teacherSearch, setTeacherSearch] = useState('');
    const [designationFilter, setDesignationFilter] = useState('All');
    const [teacherAttendance, setTeacherAttendance] = useState<Record<string, string>>({});
    const [activeTab, setActiveTab] = useState<'mark' | 'overview' | 'staff-details'>('mark');
    const [loading, setLoading] = useState(false);

    // Report Tab States
    const { data: allAttendanceRecords, loading: loadingAllAttendance } = useFirestore<any>('teacherAttendance');
    const [selectedStaffId, setSelectedStaffId] = useState<string>('');
    const [timePeriod, setTimePeriod] = useState<'this-month' | 'last-month' | 'lifetime'>('this-month');
    const [reportSearchQuery, setReportSearchQuery] = useState('');

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayOfMonth = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`;
    const [startDate, setStartDate] = useState(firstDayOfMonth);
    const [endDate, setEndDate] = useState(todayStr);

    // Get unique designations from active teachers
    const designations = useMemo(() => {
        const uniqueDesignations = [...new Set(teachers.filter(t => t.status !== 'INACTIVE').map(t => t.designation || 'Staff'))];
        return ['All', ...uniqueDesignations.sort()];
    }, [teachers]);

    useEffect(() => {
        if (currentSchool?.id && teachers.length > 0) {
            fetchTeacherAttendance();
        }
    }, [currentDate, teachers, currentSchool?.id]);

    const fetchTeacherAttendance = async () => {
        try {
            const q = query(
                collection(db, 'teacherAttendance'),
                where('schoolId', '==', currentSchool?.id)
            );
            const snap = await getDocs(q);
            const existing: Record<string, string> = {};
            snap.docs.forEach(d => {
                const data = d.data();
                if (data.date === currentDate) {
                    existing[data.teacherId] = data.status;
                }
            });
            const merged: Record<string, string> = {};
            // Only initialize attendance for active teachers
            teachers.filter(t => t.status !== 'INACTIVE').forEach(t => {
                merged[t.id] = existing[t.id] || '';
            });
            setTeacherAttendance(merged);
        } catch (error) {
            console.error("Teacher attendance fetch error:", error);
        }
    };

    const saveTeacherAttendance = async () => {
        const activeTeachers = teachers.filter(t => t.status !== 'INACTIVE');
        const unmarked = activeTeachers.filter(t => !teacherAttendance[t.id]);

        if (unmarked.length > 0) {
            const confirmSave = window.confirm(`${unmarked.length} staff members are not marked. Do you want to save anyway? (Unmarked ones will stay empty)`);
            if (!confirmSave) return;
        }

        setLoading(true);
        try {
            const batch = writeBatch(db);

            activeTeachers.forEach(t => {
                const status = teacherAttendance[t.id];
                if (!status) return; // Skip saving if not marked (optional, or save as empty)

                const docId = `tatt_${t.id}_${currentDate}`;
                const attRef = doc(db, 'teacherAttendance', docId);
                batch.set(attRef, {
                    teacherId: t.id,
                    teacherName: t.name,
                    date: currentDate,
                    status: status,
                    schoolId: currentSchool?.id,
                    updatedAt: serverTimestamp()
                }, { merge: true });
            });
            await batch.commit();
            alert("Staff attendance saved successfully!");
        } catch (error) {
            console.error("Error saving staff attendance:", error);
            alert("Error saving staff attendance: " + (error as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const filteredTeachers = useMemo(() => {
        return teachers
            .filter(t => t.status !== 'INACTIVE') // Exclude inactive teachers
            .filter(t => {
                // Apply designation filter
                if (designationFilter !== 'All' && (t.designation || 'Staff') !== designationFilter) {
                    return false;
                }
                // Apply search filter
                return (t.name?.toLowerCase() || '').includes(teacherSearch.toLowerCase()) ||
                    (t.id?.toLowerCase() || '').includes(teacherSearch.toLowerCase());
            })
            .sort((a, b) => (a.name || '').localeCompare(b.name || '')); // Sort alphabetically
    }, [teachers, teacherSearch, designationFilter]);

    // Process report data for Overview tab
    const reportData = useMemo(() => {
        if (!teachers.length || !allAttendanceRecords.length) return [];

        let filteredStaff = teachers.filter(s => s.status !== 'INACTIVE');

        if (reportSearchQuery) {
            filteredStaff = filteredStaff.filter(s =>
                (s.name?.toLowerCase() || '').includes(reportSearchQuery.toLowerCase()) ||
                (s.id?.toLowerCase() || '').includes(reportSearchQuery.toLowerCase())
            );
        }

        if (designationFilter !== 'All') {
            filteredStaff = filteredStaff.filter(s =>
                (s.designation || 'Staff') === designationFilter
            );
        }

        const report = filteredStaff.map(member => {
            const memberAttendance = allAttendanceRecords.filter(record =>
                record.teacherId === member.id &&
                record.date >= startDate &&
                record.date <= endDate
            );

            const totalDays = memberAttendance.length;
            const presentCount = memberAttendance.filter(r => r.status === 'PRESENT').length;
            const lateCount = memberAttendance.filter(r => r.status === 'LATE').length;
            const absentCount = memberAttendance.filter(r => r.status === 'ABSENT').length;
            const percentage = totalDays > 0 ? (presentCount / totalDays) * 100 : 0;

            return {
                id: member.id,
                name: member.name,
                designation: member.designation || 'Staff',
                totalDays,
                presentCount,
                lateCount,
                absentCount,
                percentage: percentage.toFixed(1)
            };
        });

        return report.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [teachers, allAttendanceRecords, reportSearchQuery, designationFilter, startDate, endDate]);

    const handleExport = () => {
        const csvContent = "data:text/csv;charset=utf-8,"
            + ["Name,Staff ID,Designation,Total Days,Present,Late,Absent,Percentage"]
                .concat(reportData.map(r => `${r.name},${r.id},${r.designation},${r.totalDays},${r.presentCount},${r.lateCount},${r.absentCount},${r.percentage}%`))
                .join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `staff_attendance_report.csv`);
        document.body.appendChild(link);
        link.click();
    };

    const stats = useMemo(() => {
        const activeTeachers = teachers.filter(t => t.status !== 'INACTIVE');
        const total = activeTeachers.length;
        const present = Object.values(teacherAttendance).filter(s => s === 'PRESENT').length;
        const absent = Object.values(teacherAttendance).filter(s => s === 'ABSENT').length;
        const late = Object.values(teacherAttendance).filter(s => s === 'LATE').length;
        return { total, present, absent, late };
    }, [teachers, teacherAttendance]);

    const markAllPresent = () => {
        const allPresent: Record<string, string> = {};
        teachers.filter(t => t.status !== 'INACTIVE').forEach(t => {
            allPresent[t.id] = 'PRESENT';
        });
        setTeacherAttendance(allPresent);
    };

    const markAllAbsent = () => {
        const allAbsent: Record<string, string> = {};
        teachers.filter(t => t.status !== 'INACTIVE').forEach(t => {
            allAbsent[t.id] = 'ABSENT';
        });
        setTeacherAttendance(allAbsent);
    };

    return (
        <div className="animate-fade-in no-scrollbar" style={{ paddingBottom: '3rem' }}>
            <div className="page-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.25rem)', fontWeight: 800, marginBottom: '0.5rem' }}>Staff Attendance</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(0.875rem, 2.5vw, 1.0625rem)' }}>Mark and track staff presence.</p>
                </div>
                <div style={{
                    display: 'flex',
                    background: 'white',
                    padding: '0.4rem',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)',
                    gap: '0.5rem',
                    overflowX: 'auto',
                    width: '100%',
                    maxWidth: '100%',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                }} className="no-scrollbar">
                    {(['mark', 'overview', 'staff-details'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`btn ${activeTab === tab ? 'btn-primary' : ''}`}
                            style={{
                                padding: '0.5rem 1rem',
                                border: 'none',
                                background: activeTab === tab ? 'var(--primary)' : 'transparent',
                                color: activeTab === tab ? 'white' : 'var(--text-muted)',
                                whiteSpace: 'nowrap',
                                minWidth: 'fit-content'
                            }}
                        >
                            {tab === 'staff-details' ? 'Staff Details' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'mark' && (
                <>

                    <div className="responsive-grid-auto" style={{ gap: '1rem', marginBottom: '2rem' }}>
                        <div className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Present</div>
                            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.present}</div>
                        </div>
                        <div className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Late</div>
                            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.late}</div>
                        </div>
                        <div className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid #f43f5e' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f43f5e', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Absent</div>
                            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.absent}</div>
                        </div>
                        <div className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--primary)' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total</div>
                            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.total}</div>
                        </div>
                    </div>

                    <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label className="field-label">Date</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={currentDate}
                                    onChange={(e) => setCurrentDate(e.target.value)}
                                />
                            </div>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label className="field-label">Designation</label>
                                <div style={{ position: 'relative' }}>
                                    <Filter size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                    <select
                                        className="input-field"
                                        style={{ paddingLeft: '3rem' }}
                                        value={designationFilter}
                                        onChange={(e) => setDesignationFilter(e.target.value)}
                                    >
                                        {designations.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label className="field-label">Search Staff</label>
                                <div style={{ position: 'relative' }}>
                                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        className="input-field"
                                        style={{ paddingLeft: '3rem' }}
                                        placeholder="Name or ID..."
                                        value={teacherSearch}
                                        onChange={(e) => setTeacherSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <button
                            onClick={markAllPresent}
                            className="btn btn-success"
                            style={{
                                padding: '0.625rem 1rem',
                                fontSize: '0.8125rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <Users size={16} />
                            All Present
                        </button>
                        <button
                            onClick={markAllAbsent}
                            className="btn"
                            style={{
                                padding: '0.625rem 1rem',
                                fontSize: '0.8125rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                background: '#f43f5e',
                                color: 'white',
                                borderColor: '#f43f5e'
                            }}
                        >
                            <Users size={16} />
                            All Absent
                        </button>
                    </div>

                    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                        {/* Desktop View */}
                        <div className="attendance-table-desktop">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ background: '#1e293b', color: 'white' }}>
                                    <tr style={{ textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <th style={{ padding: '1.25rem 1.5rem' }}>Staff Member</th>
                                        <th style={{ padding: '1.25rem 1.5rem' }}>Designation</th>
                                        <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>Mark Attendance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTeachers.map((t) => (
                                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <div style={{ fontWeight: 700 }}>{t.name}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {t.id}</div>
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.designation || 'Faculty'}</td>
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                                    {(['PRESENT', 'LATE', 'ABSENT'] as const).map(status => (
                                                        <button
                                                            key={status}
                                                            onClick={() => setTeacherAttendance(prev => ({ ...prev, [t.id]: status }))}
                                                            className="btn"
                                                            style={{
                                                                fontSize: '0.7rem',
                                                                padding: '0.4rem 0.8rem',
                                                                background: teacherAttendance[t.id] === status
                                                                    ? (status === 'PRESENT' ? '#10b981' : (status === 'LATE' ? '#f59e0b' : '#f43f5e'))
                                                                    : 'transparent',
                                                                color: teacherAttendance[t.id] === status ? 'white' : 'var(--text-muted)',
                                                                borderColor: status === 'PRESENT' ? '#10b981' : (status === 'LATE' ? '#f59e0b' : '#f43f5e'),
                                                                borderWidth: '1px',
                                                                borderStyle: 'solid',
                                                                fontWeight: 700
                                                            }}
                                                        >
                                                            {status}
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile View */}
                        <div className="attendance-cards-mobile" style={{ flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
                            {filteredTeachers.map((t) => (
                                <div key={t.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem', background: 'white' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{t.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {t.id}</div>
                                            <div style={{ fontSize: '0.8125rem', color: 'var(--primary)', fontWeight: 600, marginTop: '0.25rem' }}>{t.designation || 'Faculty'}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                                        {(['PRESENT', 'LATE', 'ABSENT'] as const).map(status => (
                                            <button
                                                key={status}
                                                onClick={() => setTeacherAttendance(prev => ({ ...prev, [t.id]: status }))}
                                                style={{
                                                    fontSize: '0.7rem',
                                                    padding: '0.625rem 0.25rem',
                                                    borderRadius: '0.5rem',
                                                    background: teacherAttendance[t.id] === status
                                                        ? (status === 'PRESENT' ? '#10b981' : (status === 'LATE' ? '#f59e0b' : '#f43f5e'))
                                                        : 'transparent',
                                                    color: teacherAttendance[t.id] === status ? 'white' : 'var(--text-muted)',
                                                    borderColor: status === 'PRESENT' ? '#10b981' : (status === 'LATE' ? '#f59e0b' : '#f43f5e'),
                                                    borderWidth: '1px',
                                                    borderStyle: 'solid',
                                                    fontWeight: 700,
                                                    textAlign: 'center'
                                                }}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {filteredTeachers.length === 0 && (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No staff members found.</div>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                        <button
                            onClick={saveTeacherAttendance}
                            disabled={loading}
                            className="btn btn-primary"
                            style={{ padding: '0.875rem 2.5rem', borderRadius: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', maxWidth: '400px' }}
                        >
                            <Save size={20} />
                            {loading ? 'Saving...' : 'Save Staff Attendance'}
                        </button>
                    </div>
                </>
            )}

            {activeTab === 'overview' && (
                <>
                    <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
                            <h3 style={{ fontWeight: 800 }}>Attendance Overview</h3>
                            <button className="btn" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border)', width: '100%', maxWidth: '200px' }}>
                                <Download size={18} /> Export CSV
                            </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label className="field-label">From</label>
                                <input type="date" className="input-field" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                            </div>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label className="field-label">To</label>
                                <input type="date" className="input-field" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                            </div>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label className="field-label">Designation</label>
                                <div style={{ position: 'relative' }}>
                                    <Filter size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                    <select
                                        className="input-field"
                                        style={{ paddingLeft: '3rem' }}
                                        value={designationFilter}
                                        onChange={(e) => setDesignationFilter(e.target.value)}
                                    >
                                        {designations.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label className="field-label">Search Staff</label>
                                <div style={{ position: 'relative' }}>
                                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        className="input-field"
                                        style={{ paddingLeft: '3rem' }}
                                        placeholder="Name or ID..."
                                        value={reportSearchQuery}
                                        onChange={(e) => setReportSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                        {/* Desktop Table */}
                        <div className="report-table-desktop">
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', background: '#1e293b', color: 'white', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            <th style={{ padding: '1.25rem 1.5rem' }}>Staff Member</th>
                                            <th style={{ padding: '1.25rem 1.5rem' }}>Designation</th>
                                            <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>Total Days</th>
                                            <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>Present</th>
                                            <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>Late</th>
                                            <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>Absent</th>
                                            <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>Percentage</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingAllAttendance ? (
                                            <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading records...</td></tr>
                                        ) : reportData.length === 0 ? (
                                            <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No records found.</td></tr>
                                        ) : reportData.map((row) => (
                                            <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '1.25rem 1.5rem' }}>
                                                    <div style={{ fontWeight: 700 }}>{row.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {row.id}</div>
                                                </td>
                                                <td style={{ padding: '1.25rem 1.5rem' }}>{row.designation}</td>
                                                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>{row.totalDays}</td>
                                                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center', color: '#10b981', fontWeight: 700 }}>{row.presentCount}</td>
                                                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center', color: '#f59e0b', fontWeight: 700 }}>{row.lateCount}</td>
                                                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center', color: '#f43f5e', fontWeight: 700 }}>{row.absentCount}</td>
                                                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                                                    <div style={{ fontWeight: 800 }}>{row.percentage}%</div>
                                                    <div style={{ width: '80px', height: '4px', background: '#e2e8f0', borderRadius: '2px', marginTop: '4px', margin: '0 auto' }}>
                                                        <div style={{ width: `${row.percentage}%`, height: '100%', background: parseFloat(row.percentage) > 85 ? '#10b981' : (parseFloat(row.percentage) > 70 ? '#f59e0b' : '#f43f5e'), borderRadius: '2px' }} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile Views */}
                        <div className="report-cards-mobile" style={{ flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
                            {loadingAllAttendance ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading records...</div>
                            ) : reportData.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No records found.</div>
                            ) : reportData.map((row) => (
                                <div key={row.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem', background: 'white' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{row.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {row.id} • {row.designation}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.1rem' }}>{row.percentage}%</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center', background: 'var(--bg-main)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                                        <div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total</div>
                                            <div style={{ fontWeight: 700 }}>{row.totalDays}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pres</div>
                                            <div style={{ fontWeight: 700, color: '#10b981' }}>{row.presentCount}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Late</div>
                                            <div style={{ fontWeight: 700, color: '#f59e0b' }}>{row.lateCount}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Abs</div>
                                            <div style={{ fontWeight: 700, color: '#f43f5e' }}>{row.absentCount}</div>
                                        </div>
                                    </div>
                                    <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', marginTop: '0.75rem' }}>
                                        <div style={{ width: `${row.percentage}%`, height: '100%', background: parseFloat(row.percentage) > 85 ? '#10b981' : (parseFloat(row.percentage) > 70 ? '#f59e0b' : '#f43f5e'), borderRadius: '3px' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'staff-details' && (
                <StaffDetailsTab
                    staff={teachers}
                    attendanceRecords={allAttendanceRecords}
                    selectedStaffId={selectedStaffId}
                    setSelectedStaffId={setSelectedStaffId}
                    timePeriod={timePeriod}
                    setTimePeriod={setTimePeriod}
                />
            )}
        </div>
    );
};

export default TeacherAttendance;
