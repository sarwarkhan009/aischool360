import React, { useState, useMemo } from 'react';
import { useFirestore } from '../hooks/useFirestore';
import { useSchool } from '../context/SchoolContext';
import { Search, Calendar, Users, ArrowLeft, Download, Filter } from 'lucide-react';
import { getActiveClasses } from '../constants/app';
import { formatDate } from '../utils/dateUtils';

const AttendanceReport: React.FC = () => {
    const { currentSchool } = useSchool();
    const { data: allSettings } = useFirestore<any>('settings');
    const { data: attendanceRecords, loading: loadingAttendance } = useFirestore<any>('attendance');
    const { data: students, loading: loadingStudents } = useFirestore<any>('students');

    const activeClasses = getActiveClasses(allSettings?.filter((d: any) => d.type === 'class') || []);

    // Filters
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayOfMonth = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`;
    const [startDate, setStartDate] = useState(firstDayOfMonth);
    const [endDate, setEndDate] = useState(todayStr);

    const classesList = activeClasses.map(c => c.name);
    const selectedClassData = activeClasses.find(c => c.name === selectedClass);
    const sectionsList = selectedClassData?.sections || [];

    // Process attendance data
    const reportData = useMemo(() => {
        if (loadingAttendance || loadingStudents) return [];

        // Filter students by class/section
        let filteredStudents = students;
        if (selectedClass) {
            filteredStudents = filteredStudents.filter(s => s.class === selectedClass);
        }
        if (selectedSection) {
            filteredStudents = filteredStudents.filter(s => s.section === selectedSection);
        }

        // Filter by search query
        if (searchQuery) {
            filteredStudents = filteredStudents.filter(s =>
                s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.admissionNo?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Calculate statistics for each student
        return filteredStudents.map(student => {
            const studentAttendance = attendanceRecords.filter(record =>
                (record.studentId === student.uid || record.studentId === student.id) &&
                record.date >= startDate &&
                record.date <= endDate
            );

            const totalClasses = studentAttendance.length;
            const presentCount = studentAttendance.filter(r => r.status === 'PRESENT').length;
            const lateCount = studentAttendance.filter(r => r.status === 'LATE').length;
            const absentCount = studentAttendance.filter(r => r.status === 'ABSENT').length;
            const percentage = totalClasses > 0 ? (presentCount / totalClasses) * 100 : 0;

            return {
                id: student.id,
                name: student.fullName,
                admissionNo: student.admissionNo,
                class: student.class,
                section: student.section,
                totalClasses,
                presentCount,
                lateCount,
                absentCount,
                percentage: percentage.toFixed(1)
            };
        });
    }, [students, attendanceRecords, selectedClass, selectedSection, searchQuery, startDate, endDate, loadingAttendance, loadingStudents]);

    const handleExport = () => {
        const csvContent = "data:text/csv;charset=utf-8,"
            + ["Name,Admission No,Class,Section,Total Classes,Present,Late,Absent,Percentage"]
                .concat(reportData.map(r => `${r.name},${r.admissionNo},${r.class},${r.section},${r.totalClasses},${r.presentCount},${r.lateCount},${r.absentCount},${r.percentage}%`))
                .join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `attendance_report_${selectedClass || 'all'}.csv`);
        document.body.appendChild(link);
        link.click();
    };

    return (
        <div className="animate-fade-in no-scrollbar" style={{ paddingBottom: '3rem' }}>
            <div className="page-header">
                <div>
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Attendance Report</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.0625rem' }}>View student attendance statistics and analytics</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn hover-lift" onClick={handleExport} style={{ border: '1px solid var(--border)', background: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Download size={18} /> Export CSV
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <div className="responsive-grid-auto" style={{ gap: '1.5rem' }}>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="label">Class</label>
                        <select className="input-field" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                            <option value="">All Classes</option>
                            {classesList.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="label">Section</label>
                        <select className="input-field" value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} disabled={!selectedClass}>
                            <option value="">All Sections</option>
                            {sectionsList.map((s: string) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="label">From Date</label>
                        <input type="date" className="input-field" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="label">To Date</label>
                        <input type="date" className="input-field" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                    <div className="input-group" style={{ marginBottom: 0, flex: 2 }}>
                        <label className="label">Search Student</label>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                className="input-field"
                                style={{ paddingLeft: '3rem' }}
                                placeholder="Name or Admission No..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Attendance Table */}
            <div className="glass-card" style={{ padding: '0' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', background: 'rgba(248, 250, 252, 0.5)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <th style={{ padding: '1.25rem 1.5rem' }}>Student</th>
                                <th style={{ padding: '1.25rem 1.5rem' }}>Class/Sec</th>
                                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>Total Days</th>
                                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>Present</th>
                                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>Late</th>
                                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>Absent</th>
                                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>Percentage</th>
                                <th style={{ padding: '1.25rem 1.5rem' }}>Analysis</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(loadingAttendance || loadingStudents) ? (
                                <tr>
                                    <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading records...</td>
                                </tr>
                            ) : reportData.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No records found for the selected filters</td>
                                </tr>
                            ) : reportData.map((row) => (
                                <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                        <div style={{ fontWeight: 700 }}>{row.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {row.admissionNo}</div>
                                    </td>
                                    <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600 }}>{row.class} - {row.section}</td>
                                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>{row.totalClasses}</td>
                                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center', color: '#10b981', fontWeight: 700 }}>{row.presentCount}</td>
                                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center', color: '#f59e0b', fontWeight: 700 }}>{row.lateCount}</td>
                                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center', color: '#f43f5e', fontWeight: 700 }}>{row.absentCount}</td>
                                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                                        <div style={{ fontWeight: 800 }}>{row.percentage}%</div>
                                        <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '2px', marginTop: '4px' }}>
                                            <div style={{ width: `${row.percentage}%`, height: '100%', background: parseFloat(row.percentage) > 75 ? '#10b981' : '#f43f5e', borderRadius: '2px' }} />
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                        <span className={`badge ${parseFloat(row.percentage) >= 90 ? 'badge-success' : parseFloat(row.percentage) >= 75 ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                                            {parseFloat(row.percentage) >= 90 ? 'EXCELLENT' : parseFloat(row.percentage) >= 75 ? 'GOOD' : 'POOR'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AttendanceReport;
