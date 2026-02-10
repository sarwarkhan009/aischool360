import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';
import { formatClassSectionShort } from '../../utils/formatters';
import { SESSIONS } from '../../constants/app';
import {
    Home,
    ChevronRight,
    Building2,
    Bus,
    User,
    Filter,
    Download,
    UserRound
} from 'lucide-react';

const StudentReport: React.FC = () => {
    const { currentSchool } = useSchool();
    const { data: students } = useFirestore<any>('students');

    // Filter states
    const [selectedSession, setSelectedSession] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [selectedGender, setSelectedGender] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');

    // Summary calculations
    const summary = useMemo(() => {
        return {
            hostel: students.filter(s => s.isHostel || s.studentType === 'HOSTEL').length,
            transport: students.filter(s => s.transport || s.studentType === 'TRANSPORT').length,
            boys: students.filter(s => s.gender?.toLowerCase() === 'male').length,
            girls: students.filter(s => s.gender?.toLowerCase() === 'female').length
        };
    }, [students]);

    // Filtering logic
    const filteredStudents = useMemo(() => {
        return students.filter(s => {
            const matchesSession = !selectedSession || (s.session && s.session.includes(selectedSession));
            const matchesClass = !selectedClass || (s.class && s.class.includes(selectedClass));
            const matchesSection = !selectedSection || (s.section && s.section.toUpperCase() === selectedSection.toUpperCase());
            const matchesType = !selectedType || (s.studentType && s.studentType.toUpperCase() === selectedType.toUpperCase());
            const matchesGender = !selectedGender || (s.gender && s.gender.toUpperCase() === selectedGender.toUpperCase());
            const matchesCategory = !selectedCategory || (s.studentCategory && s.studentCategory.toUpperCase() === selectedCategory.toUpperCase());

            return matchesSession && matchesClass && matchesSection && matchesType && matchesGender && matchesCategory;
        });
    }, [students, selectedSession, selectedClass, selectedSection, selectedType, selectedGender, selectedCategory]);

    return (
        <div className="report-page animate-fade-in" style={{ padding: '1.5rem', background: '#f8fafc', minHeight: '100vh' }}>
            {/* Breadcrumbs & Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                <Home size={16} />
                <NavigateLink to="/dashboard">Home</NavigateLink>
                <ChevronRight size={14} />
                <NavigateLink to="/students">Student</NavigateLink>
                <ChevronRight size={14} />
                <span style={{ color: '#1e293b', fontWeight: 500 }}>Student Report</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.25rem 0' }}>Student Report</h1>
                    <p style={{ color: '#64748b', margin: 0 }}>Comprehensive records management system.</p>
                </div>
                <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', border: '1px solid #e2e8f0', padding: '0.625rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 500 }}>
                    <Download size={18} />
                    <span>Export</span>
                </button>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <SummaryCard
                    label="HOSTEL"
                    value={summary.hostel}
                    icon={<Building2 size={28} />}
                    color="#f59e0b"
                    bgColor="rgba(245, 158, 11, 0.1)"
                />
                <SummaryCard
                    label="TRANSPORT"
                    value={summary.transport}
                    icon={<Bus size={28} />}
                    color="#ef4444"
                    bgColor="rgba(239, 68, 68, 0.1)"
                />
                <SummaryCard
                    label="BOYS"
                    value={summary.boys}
                    icon={<User size={28} />}
                    color="#3b82f6"
                    bgColor="rgba(59, 130, 246, 0.1)"
                />
                <SummaryCard
                    label="GIRLS"
                    value={summary.girls}
                    icon={<UserRound size={28} />}
                    color="#10b981"
                    bgColor="rgba(16, 185, 129, 0.1)"
                />
            </div>

            {/* Filters Section */}
            <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', border: 'none', background: 'white', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                    <Filter size={18} style={{ color: '#9333ea' }} />
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>Filters</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
                    <FilterSelect label="Session" value={selectedSession} onChange={setSelectedSession} options={SESSIONS} />
                    <FilterSelect label="Class" value={selectedClass} onChange={setSelectedClass} options={['NUR', 'LKG', 'UKG', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']} />
                    <FilterSelect label="Section" value={selectedSection} onChange={setSelectedSection} options={['A', 'B', 'C', 'D']} />
                    <FilterSelect label="Student Type" value={selectedType} onChange={setSelectedType} options={['HOSTEL', 'TRANSPORT', 'NORMAL']} />
                    <FilterSelect label="Gender" value={selectedGender} onChange={setSelectedGender} options={['MALE', 'FEMALE']} />
                    <FilterSelect label="Category" value={selectedCategory} onChange={setSelectedCategory} options={['GENERAL', 'OBC', 'SC', 'ST']} />
                </div>
            </div>

            {/* Data Table */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden', background: 'white', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#1e293b', color: 'white' }}>
                                <Th>Adm No.</Th>
                                <Th>Class</Th>
                                <Th>Roll No.</Th>
                                <Th>Student Name</Th>
                                <Th>Father Name</Th>
                                <Th>Mother Name</Th>
                                <Th>DOB</Th>
                                <Th>Address</Th>
                                <Th>Student Type</Th>
                                <Th>Mobile No</Th>
                                <Th>Apaar No.</Th>
                                <Th>Aadhar No.</Th>
                                <Th>Pen No.</Th>
                                <Th>Parent Aadhar No</Th>
                                <Th>Parent Info</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudents.length > 0 ? filteredStudents.map((st, idx) => (
                                <tr
                                    key={st.id || idx}
                                    style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.2s' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <Td>{st.admissionNo || st.id}</Td>
                                    <Td>{formatClassSectionShort(st.class, st.section, currentSchool?.useRomanNumerals)}</Td>
                                    <Td>{st.classRollNo || st.rollNo || '-'}</Td>
                                    <Td style={{ fontWeight: 600, color: '#1e293b' }}>{st.fullName || st.name}</Td>
                                    <Td>{st.fatherName || st.parentName}</Td>
                                    <Td>{st.motherName || '-'}</Td>
                                    <Td>{st.dob || '-'}</Td>
                                    <Td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.presentAddress || st.permanentAddress || '-'}</Td>
                                    <Td>
                                        <span style={{ padding: '0.25rem 0.5rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600, background: '#f1f5f9', color: '#475569' }}>
                                            {st.studentType || 'NORMAL'}
                                        </span>
                                    </Td>
                                    <Td>{st.mobileNo || st.phone || '-'}</Td>
                                    <Td>{st.appaarNo || '-'}</Td>
                                    <Td>{st.aadharNo || '-'}</Td>
                                    <Td>{st.studentPenNo || '-'}</Td>
                                    <Td>{st.parentAadharNo || '-'}</Td>
                                    <Td>{st.parentOtherInfo || '-'}</Td>
                                </tr>
                            )) : (
                                <tr>
                                    <Td colSpan={15} style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
                                        No student records found.
                                    </Td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const Th: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{children}</th>
);

const Td: React.FC<{ children: React.ReactNode, style?: React.CSSProperties, colSpan?: number }> = ({ children, style, colSpan }) => (
    <td colSpan={colSpan} style={{ padding: '1rem', fontSize: '0.875rem', color: '#64748b', ...style }}>{children}</td>
);

const SummaryCard: React.FC<{ label: string, value: number, icon: React.ReactNode, color: string, bgColor: string }> = ({ label, value, icon, color, bgColor }) => (
    <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem', border: 'none', background: 'white', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
        <div style={{ padding: '1rem', borderRadius: '1rem', background: bgColor, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
        </div>
        <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginTop: '0.375rem', letterSpacing: '0.05em' }}>{label}</div>
        </div>
    </div>
);

const FilterSelect: React.FC<{ label: string, value: string, onChange: (v: string) => void, options: string[] }> = ({ label, value, onChange, options }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>{label}</span>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
                padding: '0.5rem 2rem 0.5rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid #e2e8f0',
                background: 'white',
                fontSize: '0.875rem',
                color: '#1e293b',
                cursor: 'pointer',
                outline: 'none',
                appearance: 'none',
                minWidth: '130px'
            }}
        >
            <option value="">All Session</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
    </div>
);

const NavigateLink: React.FC<{ to: string, children: React.ReactNode }> = ({ to, children }) => {
    const navigate = useNavigate();
    return (
        <span onClick={() => navigate(to)} style={{ cursor: 'pointer' }} className="hover-link">{children}</span>
    );
};

export default StudentReport;
