import React, { useState, useRef, useMemo } from 'react';
import { useFirestore } from '../../hooks/useFirestore';
import { UserPlus, Search, Calendar, Phone, Trash2, Loader2, MousePointer2, Filter, Printer } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc } from 'firebase/firestore';
import { guardedDeleteDoc } from '../../lib/firestoreWrite';
import { formatDateTimeDetailed } from '../../utils/formatters';

const RegistrationRequests: React.FC = () => {
    const navigate = useNavigate();
    const { schoolId } = useParams();
    const { data: registrations, loading } = useFirestore<any>('registrations');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const printRef = useRef<HTMLDivElement>(null);

    // Get unique classes from registrations
    const availableClasses = useMemo(() => {
        const classes = (registrations || [])
            .map((r: any) => r.classRequested)
            .filter(Boolean);
        return [...new Set(classes)].sort((a: any, b: any) => {
            // Sort: UKG, Nursery, Class 1, Class 2 etc.
            const order = ['nursery', 'lkg', 'ukg'];
            const aLow = a.toLowerCase();
            const bLow = b.toLowerCase();
            const aIdx = order.indexOf(aLow);
            const bIdx = order.indexOf(bLow);
            if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
            if (aIdx !== -1) return -1;
            if (bIdx !== -1) return 1;
            // Extract numbers
            const aNum = parseInt(a.replace(/\D/g, '')) || 0;
            const bNum = parseInt(b.replace(/\D/g, '')) || 0;
            return aNum - bNum;
        });
    }, [registrations]);

    const filtered = (registrations || [])
        .filter((r: any) => {
            const matchesSearch =
                r.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.fatherName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (r.fatherContactNo || r.mobileNo)?.includes(searchTerm);
            const matchesClass = selectedClass === '' || r.classRequested === selectedClass;
            return matchesSearch && matchesClass;
        })
        .sort((a: any, b: any) => {
            if (selectedClass) {
                // Class filter active ho to alphabetically sort by name
                return (a.fullName || '').localeCompare(b.fullName || '');
            }
            // Default: newest first
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this request?')) return;
        try {
            await guardedDeleteDoc(doc(db, 'registrations', id));
        } catch (err: any) {
            if (err?.message !== 'WRITE_DENIED') alert('Failed to delete: ' + err.message);
        }
    };

    const handleAdmit = (reg: any) => {
        const studentData = {
            ...reg,
            name: reg.fullName,
            parentName: reg.fatherName,
            phone: reg.fatherContactNo || reg.mobileNo,
            address: reg.presentAddress,
            admissionClass: reg.classRequested,
            fromRegistration: true,
            registrationId: reg.id,
            registrationNo: reg.registrationNo
        };
        navigate(`/${schoolId}/students/admission`, { state: { student: studentData, editMode: false } });
    };

    const handlePrint = () => {
        const printContents = printRef.current?.innerHTML;
        if (!printContents) return;
        const win = window.open('', '_blank', 'width=900,height=700');
        if (!win) return;
        win.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Registration Requests${selectedClass ? ' - ' + selectedClass : ''}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 20px; }
                    h2 { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
                    .subtitle { color: #666; font-size: 11px; margin-bottom: 16px; }
                    table { width: 100%; border-collapse: collapse; }
                    thead tr { background: #f1f5f9; }
                    th { padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #555; border-bottom: 2px solid #e2e8f0; }
                    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
                    .name { font-weight: 700; font-size: 13px; }
                    .sub { font-size: 10px; color: #777; margin-top: 2px; }
                    .reg-no { font-family: monospace; font-size: 10px; font-weight: 700; color: #4f46e5; background: #eef2ff; padding: 2px 6px; border-radius: 4px; }
                    .class-badge { background: #eef2ff; color: #4f46e5; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 800; }
                    .new-badge { background: #f59e0b; color: white; font-size: 9px; padding: 1px 5px; border-radius: 3px; font-weight: 900; margin-left: 5px; }
                    .footer { margin-top: 20px; font-size: 10px; color: #999; text-align: right; }
                    @media print {
                        body { padding: 10px; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                ${printContents}
                <div class="footer">Printed on: ${new Date().toLocaleString()}</div>
            </body>
            </html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => {
            win.print();
            win.close();
        }, 400);
    };

    return (
        <div className="animate-fade-in no-scrollbar">
            <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UserPlus size={24} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '0.25rem' }}>Registration Requests</h1>
                        <p style={{ color: 'var(--text-muted)' }}>Public admission requests from parents waiting for approval.</p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="search-container" style={{ position: 'relative', width: '280px' }}>
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

                    {/* Class Filter */}
                    <div style={{ position: 'relative' }}>
                        <Filter size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <select
                            className="input-field"
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            style={{ paddingLeft: '2.25rem', paddingRight: '1rem', minWidth: '160px', cursor: 'pointer', fontWeight: 600 }}
                        >
                            <option value="">All Classes</option>
                            {availableClasses.map((cls: any) => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                    </div>

                    {/* Print Button */}
                    <button
                        onClick={handlePrint}
                        className="btn"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.625rem 1.25rem',
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: 'white',
                            borderRadius: '0.625rem',
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            border: 'none',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <Printer size={16} />
                        Print
                        {filtered.length > 0 && (
                            <span style={{
                                background: 'rgba(255,255,255,0.25)',
                                borderRadius: '20px',
                                padding: '0.05rem 0.4rem',
                                fontSize: '0.75rem',
                                fontWeight: 800
                            }}>{filtered.length}</span>
                        )}
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            {!loading && (
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <div style={{
                        background: 'var(--card-bg)',
                        border: '1px solid var(--border)',
                        borderRadius: '0.625rem',
                        padding: '0.625rem 1rem',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                    }}>
                        Total: <span style={{ color: 'var(--text)', fontWeight: 800 }}>{(registrations || []).length}</span>
                    </div>
                    {selectedClass && (
                        <div style={{
                            background: 'rgba(99,102,241,0.08)',
                            border: '1px solid rgba(99,102,241,0.25)',
                            borderRadius: '0.625rem',
                            padding: '0.625rem 1rem',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}>
                            {selectedClass}: <span style={{ fontWeight: 800 }}>{filtered.length} requests</span>
                            <button
                                onClick={() => setSelectedClass('')}
                                style={{ marginLeft: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 800, fontSize: '1rem', lineHeight: 1 }}
                            >×</button>
                        </div>
                    )}
                </div>
            )}

            {/* Printable Content */}
            <div ref={printRef}>
                {/* Print Header (only shows when printing) */}
                <div className="print-only" style={{ display: 'none' }}>
                    <h2>Registration Requests{selectedClass ? ` — ${selectedClass}` : ''}</h2>
                    <p className="subtitle">
                        {selectedClass
                            ? `Showing ${filtered.length} request(s) for ${selectedClass}`
                            : `All classes — ${filtered.length} total request(s)`}
                    </p>
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
                                    <th className="no-print" style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actions</th>
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
                                                    <div className="name" style={{ fontWeight: 800, fontSize: '1rem' }}>{reg.fullName}</div>
                                                    {new Date().getTime() - new Date(reg.createdAt).getTime() < 86400000 && (
                                                        <span className="new-badge" style={{ background: '#f59e0b', color: 'white', fontSize: '0.6rem', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 900 }}>NEW</span>
                                                    )}
                                                </div>
                                                <div className="sub" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                    <Calendar size={12} /> {reg.dob} • <span style={{ textTransform: 'capitalize' }}>{reg.gender}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1.5rem' }}>
                                                <div className="reg-no" style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', background: 'rgba(99, 102, 241, 0.08)', padding: '0.375rem 0.5rem', borderRadius: '6px', display: 'inline-block' }}>
                                                    {reg.registrationNo || 'N/A'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1.5rem' }}>
                                                <span className="class-badge" style={{
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
                                                <div className="sub" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                    <Phone size={12} /> {reg.fatherContactNo || reg.mobileNo}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                                {formatDateTimeDetailed(reg.createdAt)}
                                            </td>
                                            <td className="no-print" style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
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
                                            <p style={{ fontWeight: 700, fontSize: '1.125rem' }}>
                                                {selectedClass
                                                    ? `No requests found for "${selectedClass}".`
                                                    : 'No registration requests found.'}
                                            </p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style>{`
                .hover-row:hover {
                    background: rgba(99, 102, 241, 0.02) !important;
                }
                @media print {
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    .glass-card {
                        box-shadow: none !important;
                        border: 1px solid #e2e8f0 !important;
                    }
                    .hover-row:hover {
                        background: transparent !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default RegistrationRequests;
