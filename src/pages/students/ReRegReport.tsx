import React, { useState } from 'react';
import { useFirestore } from '../../hooks/useFirestore';
import { FileDown, Search, Users } from 'lucide-react';
import { sortClasses, SESSIONS } from '../../constants/app';

const ReRegReport: React.FC = () => {
    const { data: students, loading } = useFirestore<any>('students');
    const { data: allSettings } = useFirestore<any>('settings');
    const activeClasses = sortClasses(allSettings?.filter((d: any) => d.type === 'class') || []);
    const classesList = activeClasses.map((c: any) => c.name);

    const [selectedSession, setSelectedSession] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Filter students who need re-registration (example: inactive or specific session)
    const studentsNeedingReReg = students.filter(s => {
        const matchesSession = !selectedSession || s.session === selectedSession;
        const matchesClass = !selectedClass || s.class === selectedClass;
        const matchesSearch = !searchQuery ||
            (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (s.id && String(s.id).toLowerCase().includes(searchQuery.toLowerCase()));

        // Logic: Students who need re-registration (can be customized)
        const currentActiveSession = SESSIONS[2]; // 2025-26
        const needsReReg = s.status !== 'ACTIVE' || !s.session || s.session !== currentActiveSession;

        return matchesSession && matchesClass && matchesSearch && needsReReg;
    });

    const handleExport = () => {
        const csvData = studentsNeedingReReg.map(s => ({
            'Admission No': s.id,
            'Name': s.name,
            'Class': s.class,
            'Section': s.section,
            'Status': s.status,
            'Session': s.session || 'N/A'
        }));

        const csv = [
            Object.keys(csvData[0]).join(','),
            ...csvData.map(row => Object.values(row).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `re-registration-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="animate-fade-in no-scrollbar">
            <div className="page-header">
                <div>
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Re-Registration Report</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.0625rem' }}>Students requiring re-registration for the new session</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={handleExport}
                    disabled={studentsNeedingReReg.length === 0}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <FileDown size={18} /> Export CSV
                </button>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="responsive-grid-auto" style={{ gap: '1rem' }}>
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Session</label>
                        <select
                            className="input-field"
                            value={selectedSession}
                            onChange={(e) => setSelectedSession(e.target.value)}
                        >
                            <option value="">All Session</option>
                            {SESSIONS.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Class</label>
                        <select
                            className="input-field"
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                        >
                            <option value="">All Classes</option>
                            {classesList.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Search</label>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Name or ID..."
                                className="input-field"
                                style={{ paddingLeft: '2.5rem' }}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass-card" style={{ padding: '0' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', background: '#f8f9fa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Users size={20} style={{ color: 'var(--primary)' }} />
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                            Students Requiring Re-Registration ({studentsNeedingReReg.length})
                        </h3>
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Loading...
                    </div>
                ) : studentsNeedingReReg.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No students found requiring re-registration
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', background: '#f8f9fa' }}>
                                    <th style={{ padding: '1rem' }}>Admission No</th>
                                    <th style={{ padding: '1rem' }}>Student Name</th>
                                    <th style={{ padding: '1rem' }}>Class</th>
                                    <th style={{ padding: '1rem' }}>Section</th>
                                    <th style={{ padding: '1rem' }}>Current Session</th>
                                    <th style={{ padding: '1rem' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {studentsNeedingReReg.map((student) => (
                                    <tr key={student.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--primary)' }}>{student.id}</td>
                                        <td style={{ padding: '1rem' }}>{student.name || student.fullName}</td>
                                        <td style={{ padding: '1rem' }}>{student.class}</td>
                                        <td style={{ padding: '1rem' }}>{student.section}</td>
                                        <td style={{ padding: '1rem' }}>{student.session || 'N/A'}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <span className={`badge ${student.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                                                {student.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReRegReport;
