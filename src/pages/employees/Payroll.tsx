import React, { useState } from 'react';
import { Download, Search } from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { formatDate } from '../../utils/dateUtils';

interface EmployeePayroll {
    id: string;
    name: string;
    designation: string;
    baseSalary: number;
    payrollStatus: 'PAID' | 'PENDING';
    lastPayoutDate: string;
    email: string;
    employeeType?: string;
}

const Payroll: React.FC = () => {
    const { data: employees, loading } = useFirestore<EmployeePayroll>('teachers');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPayout = filteredEmployees.reduce((sum, t) => sum + (t.baseSalary || 0), 0);
    const paidCount = filteredEmployees.filter(t => t.payrollStatus === 'PAID').length;
    const processedPercentage = filteredEmployees.length > 0 ? Math.round((paidCount / filteredEmployees.length) * 100) : 0;

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '0.5rem' }}>Employee Payroll</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Manage monthly salaries and generate payslips for all staff members.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn" style={{ border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Download size={18} /> Export Salary Sheet
                    </button>
                    <button className="btn btn-primary">Process Next Month</button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Total Monthly Payout</p>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>₹{totalPayout.toLocaleString()}</h3>
                </div>
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Processed Slips</p>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{processedPercentage}%</h3>
                </div>
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Current Month</p>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                </div>
            </div>

            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ position: 'relative', width: '300px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Search employee..."
                            style={{ paddingLeft: '2.5rem' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700 }}>Employee Name</th>
                            <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700 }}>Role</th>
                            <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700 }}>Base Salary</th>
                            <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700 }}>Status</th>
                            <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700 }}>Last Payout</th>
                            <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700 }}>Slip</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center' }}>Loading payroll data...</td>
                            </tr>
                        ) : filteredEmployees.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center' }}>No employees found.</td>
                            </tr>
                        ) : (
                            filteredEmployees.map((s) => (
                                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {s.id}</div>
                                    </td>
                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                        <div style={{ fontSize: '0.875rem' }}>{s.designation || s.employeeType || 'Staff'}</div>
                                    </td>
                                    <td style={{ padding: '1.25rem 1.5rem' }}>₹{(s.baseSalary || 0).toLocaleString()}</td>
                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '0.5rem',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            background: s.payrollStatus === 'PAID' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                            color: s.payrollStatus === 'PAID' ? '#10b981' : '#f59e0b'
                                        }}>{s.payrollStatus || 'PENDING'}</span>
                                    </td>
                                    <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.875rem' }}>{s.lastPayoutDate ? formatDate(s.lastPayoutDate) : 'Not Paid'}</td>
                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                        <button className="btn" style={{ padding: '0.5rem', border: '1px solid var(--border)' }}>
                                            <Download size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Payroll;
