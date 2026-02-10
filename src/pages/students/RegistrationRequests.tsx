import React, { useState } from 'react';
import { useFirestore } from '../../hooks/useFirestore';
import { UserPlus, Search, Calendar, Phone, Trash2, Loader2, MousePointer2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { formatDateTimeDetailed } from '../../utils/formatters';

const RegistrationRequests: React.FC = () => {
    const navigate = useNavigate();
    const { schoolId } = useParams();
    const { data: registrations, loading } = useFirestore<any>('registrations');
    const [searchTerm, setSearchTerm] = useState('');

    const filtered = (registrations || [])
        .filter((r: any) =>
            r.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.fatherName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.fatherContactNo || r.mobileNo)?.includes(searchTerm)
        )
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this request?')) return;
        try {
            await deleteDoc(doc(db, 'registrations', id));
        } catch (err) {
            alert('Failed to delete: ' + (err as Error).message);
        }
    };

    const handleAdmit = (reg: any) => {
        // Map registration data to admission form data
        // We pass the entire reg object and explicitly map key fields to ensure StudentAdmission.tsx picks them up
        const studentData = {
            ...reg,
            name: reg.fullName,
            parentName: reg.fatherName,
            phone: reg.fatherContactNo || reg.mobileNo, // Support both naming conventions
            address: reg.presentAddress, // Legacy support
            admissionClass: reg.classRequested,
            fromRegistration: true,
            registrationId: reg.id,
            registrationNo: reg.registrationNo // Pass registration number
        };

        navigate(`/${schoolId}/students/admission`, { state: { student: studentData, editMode: false } });
    };

    return (
        <div className="animate-fade-in no-scrollbar">
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UserPlus size={24} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '0.25rem' }}>Registration Requests</h1>
                        <p style={{ color: 'var(--text-muted)' }}>Public admission requests from parents waiting for approval.</p>
                    </div>
                </div>

                <div className="search-container" style={{ position: 'relative', width: '350px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search by name, father or mobile..."
                        className="input-field"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: '2.75rem', width: '100%' }}
                    />
                </div>
            </div>

            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'rgba(99, 102, 241, 0.03)', borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Candidate Details</th>
                                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Reg. Number</th>
                                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Requested Class</th>
                                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Parent Info</th>
                                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date Submitted</th>
                                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '4rem', textAlign: 'center' }}>
                                        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary)', margin: '0 auto' }} />
                                        <p style={{ marginTop: '1rem', fontWeight: 600 }}>Loading requests...</p>
                                    </td>
                                </tr>
                            ) : filtered.length > 0 ? (
                                filtered.map((reg: any) => (
                                    <tr key={reg.id} className="hover-row" style={{ borderBottom: '1px solid var(--border)', transition: 'all 0.2s' }}>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ fontWeight: 800, fontSize: '1rem' }}>{reg.fullName}</div>
                                                {new Date().getTime() - new Date(reg.createdAt).getTime() < 86400000 && (
                                                    <span style={{ background: '#f59e0b', color: 'white', fontSize: '0.6rem', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 900 }}>NEW</span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                <Calendar size={12} /> {reg.dob} • <span style={{ textTransform: 'capitalize' }}>{reg.gender}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', background: 'rgba(99, 102, 241, 0.08)', padding: '0.375rem 0.5rem', borderRadius: '6px', display: 'inline-block' }}>
                                                {reg.registrationNo || 'N/A'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <span style={{
                                                padding: '0.375rem 0.75rem',
                                                borderRadius: '2rem',
                                                background: 'rgba(99, 102, 241, 0.1)',
                                                color: 'var(--primary)',
                                                fontSize: '0.75rem',
                                                fontWeight: 800
                                            }}>
                                                {reg.classRequested}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>F: {reg.fatherName}</div>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                <Phone size={12} /> {reg.fatherContactNo || reg.mobileNo}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                            {formatDateTimeDetailed(reg.createdAt)}
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                <button
                                                    onClick={() => handleAdmit(reg)}
                                                    className="btn btn-primary"
                                                    style={{
                                                        padding: '0.5rem 1rem',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 800,
                                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                                    }}
                                                >
                                                    <MousePointer2 size={14} /> Admit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(reg.id)}
                                                    style={{
                                                        padding: '0.5rem',
                                                        borderRadius: '0.5rem',
                                                        border: '1px solid #ef4444',
                                                        color: '#ef4444',
                                                        background: 'transparent',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                                        <p style={{ fontWeight: 700, fontSize: '1.125rem' }}>No registration requests found.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <style>{`
                .hover-row:hover {
                    background: rgba(99, 102, 241, 0.02) !important;
                }
            `}</style>
        </div>
    );
};

export default RegistrationRequests;
