import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Download,
    Calendar,
    CreditCard,
    GraduationCap,
    Filter,
    ChevronDown,
    FileText
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { getActiveClasses } from '../../constants/app';

interface Student {
    id: string;
    fullName: string;
    name?: string;
    class: string;
    section: string;
    fatherName?: string;
    parentName?: string;
    phone?: string;
    mobileNo?: string;
    status: 'ACTIVE' | 'INACTIVE';
}

interface ReportStudent extends Student {
    totalFee: number;
    paidAmount: number;
    dueBalance: number;
}

const ReportsCenter: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('ATTENDANCE');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');

    const { data: allSettings } = useFirestore<any>('settings');
    const activeClasses = getActiveClasses(allSettings?.filter((d: any) => d.type === 'class') || []);

    // Attendance date filters
    const today = new Date().toISOString().split('T')[0];
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const defaultStart = oneMonthAgo.toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(defaultStart);
    const [endDate, setEndDate] = useState(today);

    // Firestore data
    const { data: students } = useFirestore<Student>('students');
    const { data: feeRecords } = useFirestore<any>('fees');

    const tabs = [
        { id: 'ATTENDANCE', label: 'Attendance Report', icon: Calendar },
        { id: 'FINANCE', label: 'Fee Report', icon: CreditCard },
        { id: 'ACADEMIC', label: 'Academic Performance', icon: GraduationCap },
        { id: 'DATABASE', label: 'Student Database', icon: FileText, to: '/students/report' },
    ];

    const classesList = activeClasses.map((cls: any) => cls.name);
    const sectionsList = activeClasses.find((cls: any) => cls.name === selectedClass)?.sections || [];

    // Filtered data for reports
    // When section is empty, include ALL students from the selected class
    const filteredStudents = useMemo(() => {
        if (!selectedClass) return [];
        if (selectedSection) {
            // Filter by both class and section
            return students.filter(s => s.class === selectedClass && s.section === selectedSection);
        } else {
            // Filter by class only - includes ALL students regardless of section
            return students.filter(s => s.class === selectedClass);
        }
    }, [students, selectedClass, selectedSection]);

    const reportData = useMemo(() => {
        if (activeTab === 'FINANCE') {
            return filteredStudents.map(student => {
                const record = feeRecords.find(f => f.studentId === student.id);
                const total = record?.total || 5000;
                const paid = record?.paid || 0;
                return {
                    ...student,
                    totalFee: total,
                    paidAmount: paid,
                    dueBalance: total - paid
                } as ReportStudent;
            });
        }
        return filteredStudents;
    }, [activeTab, filteredStudents, feeRecords]);

    const activeReportData = reportData as ReportStudent[];

    return (
        <div className="animate-fade-in no-scrollbar" style={{ paddingBottom: '3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.025em' }}>Reports Center</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.0625rem' }}>Detailed analytics and lists based on Class & Section.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn hover-lift" style={{ border: '1px solid var(--border)', background: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                        <Download size={18} /> Export Excel
                    </button>
                    <button className="btn btn-primary hover-glow">Print Report</button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', overflowX: 'auto' }} className="no-scrollbar">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => tab.to ? navigate(tab.to) : setActiveTab(tab.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.625rem',
                                padding: '1rem 1.5rem',
                                border: 'none',
                                background: 'transparent',
                                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                borderBottom: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <Icon size={20} /> {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Filter Bar */}
            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="input-group" style={{ marginBottom: 0, flex: 1, minWidth: '180px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.5rem' }}>Class</label>
                    <div style={{ position: 'relative' }}>
                        <select
                            className="input-field"
                            value={selectedClass}
                            onChange={(e) => {
                                setSelectedClass(e.target.value);
                                setSelectedSection('');
                            }}
                        >
                            <option value="">Select Class</option>
                            {classesList.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <ChevronDown size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                    </div>
                </div>
                <div className="input-group" style={{ marginBottom: 0, flex: 1, minWidth: '120px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.5rem' }}>Section</label>
                    <div style={{ position: 'relative' }}>
                        <select
                            className="input-field"
                            value={selectedSection}
                            onChange={(e) => setSelectedSection(e.target.value)}
                            disabled={!selectedClass}
                        >
                            <option value="">Select Section</option>
                            {sectionsList.map((s: string) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <ChevronDown size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                    </div>
                </div>

                {activeTab === 'ATTENDANCE' && (
                    <>
                        <div className="input-group" style={{ marginBottom: 0, flex: 1, minWidth: '160px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.5rem' }}>From Date</label>
                            <input type="date" className="input-field" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                        <div className="input-group" style={{ marginBottom: 0, flex: 1, minWidth: '160px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.5rem' }}>To Date</label>
                            <input type="date" className="input-field" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                    </>
                )}

                <button className="btn btn-primary hover-lift" style={{ height: '3rem', whiteSpace: 'nowrap' }}>
                    <Filter size={18} /> Apply Filters
                </button>
            </div>

            {/* Attendance Report Content */}
            {activeTab === 'ATTENDANCE' && (
                <div className="animate-slide-up">
                    <div className="grid-cols-mobile" style={{ gap: '1.5rem', marginBottom: '2rem' }}>
                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Avg. Attendance ({selectedClass})</p>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>92.4%</h2>
                        </div>
                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Present Days</p>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>24/26</h2>
                        </div>
                    </div>

                    <div className="glass-card" style={{ padding: '0' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', background: 'rgba(248, 250, 252, 0.5)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <th style={{ padding: '1.25rem 1.5rem' }}>Student Name</th>
                                        <th style={{ padding: '1.25rem 1.5rem' }}>Roll No</th>
                                        <th style={{ padding: '1.25rem 1.5rem' }}>Present Days</th>
                                        <th style={{ padding: '1.25rem 1.5rem' }}>Absent Days</th>
                                        <th style={{ padding: '1.25rem 1.5rem' }}>Percentage</th>
                                        <th style={{ padding: '1.25rem 1.5rem' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeReportData.length > 0 ? (activeReportData as any[]).map((stu) => (
                                        <tr key={stu.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover-row">
                                            <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600 }}>{stu.name}</td>
                                            <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)' }}>{stu.id.slice(-3)}</td>
                                            <td style={{ padding: '1.25rem 1.5rem', color: '#10b981', fontWeight: 700 }}>24</td>
                                            <td style={{ padding: '1.25rem 1.5rem', color: '#f43f5e', fontWeight: 700 }}>2</td>
                                            <td style={{ padding: '1.25rem 1.5rem', fontWeight: 800 }}>92.3%</td>
                                            <td style={{ padding: '1.25rem 1.5rem' }}>
                                                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 800, background: '#ecfdf5', color: '#10b981' }}>EXCELLENT</span>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No students found for {selectedClass} {selectedSection}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Finance / Fee Report Content */}
            {activeTab === 'FINANCE' && (
                <div className="animate-slide-up">
                    <div className="grid-cols-mobile" style={{ gap: '1.5rem', marginBottom: '2rem' }}>
                        <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981' }}>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Collected Fee</p>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>₹{activeReportData.reduce((acc, curr) => acc + curr.paidAmount, 0).toLocaleString()}</h2>
                        </div>
                        <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid #f43f5e' }}>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Total Dues</p>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f43f5e' }}>₹{activeReportData.reduce((acc, curr) => acc + curr.dueBalance, 0).toLocaleString()}</h2>
                        </div>
                    </div>

                    <div className="glass-card" style={{ padding: '0' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', background: 'rgba(248, 250, 252, 0.5)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <th style={{ padding: '1.25rem 1.5rem' }}>Student Name</th>
                                        <th style={{ padding: '1.25rem 1.5rem' }}>Student ID</th>
                                        <th style={{ padding: '1.25rem 1.5rem' }}>Total Fee</th>
                                        <th style={{ padding: '1.25rem 1.5rem' }}>Paid Amount</th>
                                        <th style={{ padding: '1.25rem 1.5rem' }}>Due Balance</th>
                                        <th style={{ padding: '1.25rem 1.5rem' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeReportData.length > 0 ? activeReportData.map((stu) => (
                                        <tr key={stu.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover-row">
                                            <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600 }}>{stu.name}</td>
                                            <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)' }}>{stu.id}</td>
                                            <td style={{ padding: '1.25rem 1.5rem' }}>₹{stu.totalFee.toLocaleString()}</td>
                                            <td style={{ padding: '1.25rem 1.5rem', color: '#10b981', fontWeight: 700 }}>₹{stu.paidAmount.toLocaleString()}</td>
                                            <td style={{ padding: '1.25rem 1.5rem', color: '#f43f5e', fontWeight: 900 }}>₹{stu.dueBalance.toLocaleString()}</td>
                                            <td style={{ padding: '1.25rem 1.5rem' }}>
                                                <span style={{
                                                    padding: '0.25rem 0.75rem',
                                                    borderRadius: '1rem',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 800,
                                                    background: stu.dueBalance === 0 ? '#ecfdf5' : stu.paidAmount > 0 ? '#fffbeb' : '#fef2f2',
                                                    color: stu.dueBalance === 0 ? '#10b981' : stu.paidAmount > 0 ? '#f59e0b' : '#f43f5e'
                                                }}>
                                                    {stu.dueBalance === 0 ? 'PAID' : stu.paidAmount > 0 ? 'PARTIAL' : 'DUE'}
                                                </span>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No records found for {selectedClass} {selectedSection}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Academic Analytics Placeholder */}
            {/* Academic Analytics Content */}
            {activeTab === 'ACADEMIC' && (
                <div className="animate-slide-up">
                    <div className="grid-cols-mobile" style={{ gap: '1.5rem', marginBottom: '2rem' }}>
                        <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid #6366f1' }}>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Class Average</p>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#6366f1' }}>78.5%</h2>
                        </div>
                        <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid #8b5cf6' }}>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Top Performer</p>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#8b5cf6' }}>96.2%</h2>
                        </div>
                    </div>

                    <div className="glass-card" style={{ padding: '0' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', background: 'rgba(248, 250, 252, 0.5)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <th style={{ padding: '1.25rem 1.5rem' }}>Student Name</th>
                                        <th style={{ padding: '1.25rem 1.5rem' }}>Math</th>
                                        <th style={{ padding: '1.25rem 1.5rem' }}>Science</th>
                                        <th style={{ padding: '1.25rem 1.5rem' }}>English</th>
                                        <th style={{ padding: '1.25rem 1.5rem' }}>Total %</th>
                                        <th style={{ padding: '1.25rem 1.5rem' }}>Result</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeReportData.length > 0 ? activeReportData.map((stu, idx) => (
                                        <tr key={stu.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover-row">
                                            <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600 }}>{stu.name}</td>
                                            <td style={{ padding: '1.25rem 1.5rem' }}>{85 + (idx % 10)}%</td>
                                            <td style={{ padding: '1.25rem 1.5rem' }}>{78 + (idx % 15)}%</td>
                                            <td style={{ padding: '1.25rem 1.5rem' }}>{82 + (idx % 8)}%</td>
                                            <td style={{ padding: '1.25rem 1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                                                {Math.round(((85 + (idx % 10) + 78 + (idx % 15) + 82 + (idx % 8)) / 3) * 10) / 10}%
                                            </td>
                                            <td style={{ padding: '1.25rem 1.5rem' }}>
                                                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 800, background: '#ecfdf5', color: '#10b981' }}>PASSED</span>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No academic records found for {selectedClass} {selectedSection}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportsCenter;
