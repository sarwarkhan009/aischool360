import React, { useState, useMemo } from 'react';
import { useFirestore } from '../hooks/useFirestore';
import { useSchool } from '../context/SchoolContext';
import { Search, Download, Calendar, Users, Filter, BarChart3 } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import StaffDetailsTab from '../components/attendance/StaffDetailsTab';
import TeacherAttendanceChart from '../components/TeacherAttendanceChart';

const StaffAttendanceReport: React.FC = () => {
    const { currentSchool } = useSchool();
    const { data: attendanceRecords, loading: loadingAttendance } = useFirestore<any>('teacherAttendance');
    const { data: staff, loading: loadingStaff } = useFirestore<any>('teachers');

    // Tab state
    const [activeTab, setActiveTab] = useState<'overview' | 'staff-details'>('overview');
    const [selectedStaffId, setSelectedStaffId] = useState<string>('');
    const [timePeriod, setTimePeriod] = useState<'this-month' | 'last-month' | 'lifetime'>('this-month');

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [designationFilter, setDesignationFilter] = useState('All');
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayOfMonth = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`;
    const [startDate, setStartDate] = useState(firstDayOfMonth);
    const [endDate, setEndDate] = useState(todayStr);

    // Get unique designations from staff
    const designations = useMemo(() => {
        const uniqueDesignations = [...new Set(staff.filter(s => s.status !== 'INACTIVE').map(s => s.designation || 'Staff'))];
        return ['All', ...uniqueDesignations.sort()];
    }, [staff]);

    // Process attendance data
    const reportData = useMemo(() => {
        if (loadingAttendance || loadingStaff) return [];

        // Filter staff - exclude inactive, apply search and designation filters
        let filteredStaff = staff
            .filter(s => s.status !== 'INACTIVE'); // Exclude inactive teachers

        // Apply search filter
        if (searchQuery) {
            filteredStaff = filteredStaff.filter(s =>
                (s.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                (s.id?.toLowerCase() || '').includes(searchQuery.toLowerCase())
            );
        }

        // Apply designation filter
        if (designationFilter !== 'All') {
            filteredStaff = filteredStaff.filter(s =>
                (s.designation || 'Staff') === designationFilter
            );
        }

        // Calculate statistics for each staff member
        const report = filteredStaff.map(member => {
            const memberAttendance = attendanceRecords.filter(record =>
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

        // Sort alphabetically by name
        return report.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [staff, attendanceRecords, searchQuery, designationFilter, startDate, endDate, loadingAttendance, loadingStaff]);

    // Calculate summary for chart
    const attendanceSummary = useMemo(() => {
        const totalPresent = reportData.reduce((sum, r) => sum + r.presentCount, 0);
        const totalLate = reportData.reduce((sum, r) => sum + r.lateCount, 0);
        const totalAbsent = reportData.reduce((sum, r) => sum + r.absentCount, 0);
        const totalStaff = reportData.length;

        return {
            present: totalPresent,
            late: totalLate,
            absent: totalAbsent,
            totalTeachers: totalStaff
        };
    }, [reportData]);

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

    return (
        <div className="animate-fade-in no-scrollbar" style={{ paddingBottom: '3rem' }}>
            <div className="page-header">
                <div>
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Staff Attendance Report</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.0625rem' }}>Analyze staff presence and punctuality.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn hover-lift" onClick={handleExport} style={{ border: '1px solid var(--border)', background: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Download size={18} /> Export CSV
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '2px solid var(--border)' }}>
                <button
                    onClick={() => setActiveTab('overview')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        fontSize: '0.9375rem',
                        fontWeight: 700,
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'overview' ? '3px solid var(--primary)' : '3px solid transparent',
                        color: activeTab === 'overview' ? 'var(--primary)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <BarChart3 size={18} /> Overview
                </button>
                <button
                    onClick={() => setActiveTab('staff-details')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        fontSize: '0.9375rem',
                        fontWeight: 700,
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'staff-details' ? '3px solid var(--primary)' : '3px solid transparent',
                        color: activeTab === 'staff-details' ? 'var(--primary)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Users size={18} /> Staff Details
                </button>
            </div>

            {activeTab === 'overview' ? (
                <>
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div className="glass-card hover-lift" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0.02) 100%)', border: '2px solid rgba(99, 102, 241, 0.2)' }}>
                            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 700, marginBottom: '0.5rem' }}>Total Staff</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--primary)' }}>{attendanceSummary.totalTeachers}</div>
                        </div>
                        <div className="glass-card hover-lift" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.02) 100%)', border: '2px solid rgba(16, 185, 129, 0.2)' }}>
                            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 700, marginBottom: '0.5rem' }}>Total Present</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#10b981' }}>{attendanceSummary.present}</div>
                        </div>
                        <div className="glass-card hover-lift" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(245, 158, 11, 0.02) 100%)', border: '2px solid rgba(245, 158, 11, 0.2)' }}>
                            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 700, marginBottom: '0.5rem' }}>Total Late</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f59e0b' }}>{attendanceSummary.late}</div>
                        </div>
                        <div className="glass-card hover-lift" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(239, 68, 68, 0.02) 100%)', border: '2px solid rgba(239, 68, 68, 0.2)' }}>
                            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 700, marginBottom: '0.5rem' }}>Total Absent</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ef4444' }}>{attendanceSummary.absent}</div>
                        </div>
                    </div>

                    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                        <div className="responsive-grid-auto" style={{ gap: '1.5rem' }}>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label className="label">From Date</label>
                                <input type="date" className="input-field" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                            </div>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label className="label">To Date</label>
                                <input type="date" className="input-field" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                            </div>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label className="label">Designation</label>
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
                            <div className="input-group" style={{ marginBottom: 0, flex: 2 }}>
                                <label className="label">Search Staff</label>
                                <div style={{ position: 'relative' }}>
                                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        className="input-field"
                                        style={{ paddingLeft: '3rem' }}
                                        placeholder="Name or Staff ID..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Attendance Chart */}
                    {!(loadingAttendance || loadingStaff) && attendanceSummary.present + attendanceSummary.late + attendanceSummary.absent > 0 && (
                        <div style={{ marginBottom: '2rem' }}>
                            <TeacherAttendanceChart
                                data={attendanceSummary}
                                title="Staff Attendance Distribution"
                            />
                        </div>
                    )}

                    <div className="glass-card" style={{ padding: '0' }}>
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
                                    {(loadingAttendance || loadingStaff) ? (
                                        <tr>
                                            <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading records...</td>
                                        </tr>
                                    ) : reportData.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No staff attendance records found.</td>
                                        </tr>
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
                                                <div style={{ width: '100px', height: '6px', background: '#e2e8f0', borderRadius: '3px', marginTop: '4px', margin: '4px auto 0' }}>
                                                    <div style={{ width: `${row.percentage}%`, height: '100%', background: parseFloat(row.percentage) > 85 ? '#10b981' : (parseFloat(row.percentage) > 70 ? '#f59e0b' : '#f43f5e'), borderRadius: '3px' }} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <StaffDetailsTab
                    staff={staff}
                    attendanceRecords={attendanceRecords}
                    selectedStaffId={selectedStaffId}
                    setSelectedStaffId={setSelectedStaffId}
                    timePeriod={timePeriod}
                    setTimePeriod={setTimePeriod}
                />
            )}
        </div>
    );
};

export default StaffAttendanceReport;
