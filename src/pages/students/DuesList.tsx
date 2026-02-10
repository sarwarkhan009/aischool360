import React, { useState } from 'react';
import { useFirestore } from '../../hooks/useFirestore';
import { Search, Printer } from 'lucide-react';
import { getActiveClasses } from '../../constants/app';

const DuesList: React.FC = () => {
    const { data: students, loading } = useFirestore<any>('students');
    const { data: allSettings } = useFirestore<any>('settings');

    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [minAmount, setMinAmount] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    const activeClasses = getActiveClasses(allSettings?.filter((d: any) => d.type === 'class') || []);
    const classesList = activeClasses.map((c: any) => c.name);
    const sectionsList = selectedClass ? (activeClasses.find((c: any) => c.name === selectedClass)?.sections || []) : [];

    const filteredStudents = students.filter(stu => {
        const dues = Number(stu.basicDues) || 0;
        if (dues <= 0) return false;

        const matchesClass = !selectedClass || stu.class === selectedClass;
        const matchesSection = !selectedSection || stu.section === selectedSection;
        const matchesMin = !minAmount || dues >= Number(minAmount);

        const q = searchQuery.toLowerCase();
        const matchesSearch = !q ||
            (stu.name || stu.fullName || '').toLowerCase().includes(q) ||
            (stu.admissionNo || '').toLowerCase().includes(q);

        return matchesClass && matchesSection && matchesMin && matchesSearch;
    }).sort((a, b) => (Number(b.basicDues) || 0) - (Number(a.basicDues) || 0));

    const totalDues = filteredStudents.reduce((sum, stu) => sum + (Number(stu.basicDues) || 0), 0);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="animate-fade-in no-scrollbar">
            <div style={{ display: 'none' }} className="print-only">
                <h1 style={{ textAlign: 'center', fontSize: '24px', marginBottom: '20px', textTransform: 'uppercase' }}>
                    {selectedClass ? `${selectedClass} Dues List` : 'All Students Dues List'}
                </h1>
            </div>

            <div className="no-print">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                            {selectedClass ? `${selectedClass} Dues List` : 'Student Dues List'}
                        </h1>
                        <p style={{ color: 'var(--text-muted)' }}>View and print pending fee details.</p>
                    </div>
                    <button className="btn btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Printer size={18} /> Print Dues List
                    </button>
                </div>

                <div className="glass-card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div className="input-group">
                            <label className="field-label">Class</label>
                            <select className="input-field" value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setSelectedSection(''); }}>
                                <option value="">All Classes</option>
                                {classesList.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="input-group">
                            <label className="field-label">Section</label>
                            <select className="input-field" value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} disabled={!selectedClass}>
                                <option value="">All Sections</option>
                                {sectionsList.map((s: string) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="input-group">
                            <label className="field-label">Dues Greater Than (₹)</label>
                            <input type="number" className="input-field" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0" />
                        </div>
                        <div className="input-group">
                            <label className="field-label">Search Student</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input type="text" className="input-field" style={{ paddingLeft: '2.5rem' }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Name or ID..." />
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div className="glass-card" style={{ flex: 1, padding: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Filtered Students</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{filteredStudents.length}</h3>
                    </div>
                    <div className="glass-card" style={{ flex: 1, padding: '1.5rem', borderLeft: '4px solid #ef4444' }}>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Total Pending Amount</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>₹{totalDues.toLocaleString()}</h3>
                    </div>
                </div>
            </div>

            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '1rem 1.5rem' }}>#</th>
                            <th style={{ padding: '1rem 1.5rem' }}>Student Name</th>
                            <th style={{ padding: '1rem 1.5rem' }}>Adm No.</th>
                            <th style={{ padding: '1rem 1.5rem' }}>Class & Section</th>
                            <th style={{ padding: '1rem 1.5rem' }}>Parent Name</th>
                            <th style={{ padding: '1rem 1.5rem' }}>Mobile</th>
                            <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Dues Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center' }}>Loading...</td></tr>
                        ) : filteredStudents.length === 0 ? (
                            <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center' }}>No records found with pending dues.</td></tr>
                        ) : (
                            filteredStudents.map((stu, index) => (
                                <tr key={stu.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '1rem 1.5rem' }}>{index + 1}</td>
                                    <td style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>{stu.name || stu.fullName}</td>
                                    <td style={{ padding: '1rem 1.5rem' }}>{stu.admissionNo || stu.id}</td>
                                    <td style={{ padding: '1rem 1.5rem' }}>{stu.class} - {stu.section}</td>
                                    <td style={{ padding: '1rem 1.5rem' }}>{stu.fatherName || stu.parentName}</td>
                                    <td style={{ padding: '1rem 1.5rem' }}>{stu.mobileNo || stu.phone}</td>
                                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>
                                        ₹{(Number(stu.basicDues) || 0).toLocaleString()}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    {filteredStudents.length > 0 && (
                        <tfoot>
                            <tr style={{ background: '#fff1f2', fontWeight: 800 }}>
                                <td colSpan={6} style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>GRAND TOTAL DUES:</td>
                                <td style={{ padding: '1rem 1.5rem', textAlign: 'right', color: '#ef4444' }}>₹{totalDues.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            <style>{`
                @media print {
                    @page { size: portrait; margin: 1cm; }
                    body { background: white !important; }
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    .glass-card { border: none !important; box-shadow: none !important; background: white !important; }
                    table { border: 1px solid #000 !important; width: 100% !important; }
                    th, td { border: 1px solid #000 !important; padding: 8px !important; color: black !important; -webkit-print-color-adjust: exact; }
                    thead { background: #f0f0f0 !important; }
                    tfoot { background: #f0f0f0 !important; }
                }
            `}</style>
        </div>
    );
};

export default DuesList;
