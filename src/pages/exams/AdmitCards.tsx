import React, { useState } from 'react';
import {
    Download,
    Eye,
    Printer,
    Layout,
    Search,
    Users,
    FileText,
    Calendar,
    ChevronDown,
    X,
    CheckCircle
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';
import { sortClasses } from '../../constants/app';

interface AdmitCardTemplate {
    id: string;
    name: string;
    description: string;
    previewColor: string;
}

const TEMPLATES: AdmitCardTemplate[] = [
    { id: 'basic', name: 'Classic Blue', description: 'Clean and professional layout', previewColor: '#1e40af' },
    { id: 'modern', name: 'Modern Dark', description: 'Sleek dark theme with accents', previewColor: '#1f2937' },
    { id: 'premium', name: 'Premium Gold', description: 'Elegant design for special exams', previewColor: '#b45309' }
];

const AdmitCards: React.FC = () => {
    const { currentSchool } = useSchool();
    const { data: exams } = useFirestore<any>('exams');
    const { data: students } = useFirestore<any>('students');
    const { data: allSettings } = useFirestore<any>('settings');
    const { data: examTemplates } = useFirestore<any>('exam_templates');

    const [selectedExamId, setSelectedExamId] = useState('');
    const [selectedClass, setSelectedClass] = useState('ALL');
    const [selectedTemplate, setSelectedTemplate] = useState('basic');
    const [generationMode, setGenerationMode] = useState<'single' | 'class' | 'exam'>('class');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const schoolExams = exams?.filter((e: any) => e.schoolId === currentSchool?.id && e.status !== 'CANCELLED') || [];
    const selectedExam = schoolExams.find((e: any) => e.id === selectedExamId);

    const activeClasses = sortClasses(allSettings?.filter((d: any) => d.type === 'class' && d.active !== false) || []);
    const classesList = activeClasses.map((c: any) => c.name);

    // Create a map of class name to class ID for filtering
    const classNameToId = new Map();
    activeClasses.forEach((cls: any) => {
        classNameToId.set(cls.name, cls.id);
    });

    const savedConfig = examTemplates?.find((t: any) => t.schoolId === currentSchool?.id && t.type === 'admit_card');

    React.useEffect(() => {
        if (savedConfig?.templateId) {
            setSelectedTemplate(savedConfig.templateId);
        }
    }, [savedConfig]);

    // Filter students based on selection
    const filteredStudents = students?.filter((s: any) => {
        if (s.schoolId !== currentSchool?.id || s.status !== 'ACTIVE') return false;

        const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.rollNo || s.classRollNo || '').toLowerCase().includes(searchQuery.toLowerCase());

        // Get student's class ID from their class name
        const studentClassId = classNameToId.get(s.class);

        if (generationMode === 'single') {
            // In single mode, if a student is selected, show only that student
            // Otherwise show all students that match the search
            if (selectedStudentId) {
                return s.id === selectedStudentId;
            }
            // Show students from exam's target classes if exam is selected
            if (selectedExam?.targetClasses && studentClassId) {
                return selectedExam.targetClasses.includes(studentClassId) && matchesSearch;
            }
            return matchesSearch;
        }

        if (generationMode === 'class') {
            // First check if student's class matches the selected class dropdown
            const matchesClass = selectedClass === 'ALL' ? true : s.class === selectedClass;

            // Then check if student's class is in exam's targetClasses
            if (selectedExam?.targetClasses && studentClassId) {
                const isInExamClasses = selectedExam.targetClasses.includes(studentClassId);
                return matchesClass && isInExamClasses && matchesSearch;
            }

            // If no exam selected, just use class filter
            return matchesClass && matchesSearch;
        }

        if (generationMode === 'exam') {
            // Match using class ID, not class name
            if (selectedExam?.targetClasses && studentClassId) {
                return selectedExam.targetClasses.includes(studentClassId) && matchesSearch;
            }
            return false;
        }
        return false;
    }) || [];

    const handlePrint = () => {
        // Validate students are selected
        if (!selectedExamId || filteredStudents.length === 0) {
            alert('Please select an exam and ensure students are available.');
            return;
        }

        console.log('Print initiated with', filteredStudents.length, 'students');
        console.log('Students:', filteredStudents.map(s => s.name));

        // Close preview first if it's open
        if (showPreview) {
            setShowPreview(false);
        }

        // Wait for render, then manipulate DOM for printing
        setTimeout(() => {
            const printSection = document.querySelector('.print-only');

            if (!printSection) {
                console.error('Print section not found!');
                alert('Print content not ready. Please try again.');
                return;
            }

            console.log('Print section found:', printSection);
            console.log('Print section children:', printSection.children.length);

            // Clone the print section
            const printClone = printSection.cloneNode(true) as HTMLElement;
            printClone.className = 'print-active';

            // Add print clone to body
            document.body.appendChild(printClone);

            // Add class to body to trigger print styles
            document.body.classList.add('printing');

            // Small delay to ensure styles applied
            setTimeout(() => {
                console.log('Opening print dialog...');
                window.print();

                // Cleanup after print dialog closes
                setTimeout(() => {
                    document.body.classList.remove('printing');
                    if (printClone && printClone.parentNode) {
                        document.body.removeChild(printClone);
                    }
                }, 500);
            }, 100);
        }, 500);
    };

    const AdmitCard = ({ student, exam, templateId }: { student: any, exam: any, templateId: string }) => {
        // Create QR code data - formatted for readability when scanned
        const qrDataLines = [
            `Student: ${student.name}`,
            `Class: ${student.class || '-'}`,
            `Roll No: ${student.rollNo || student.classRollNo || ''}`
        ];

        if (exam?.displayName || exam?.name) {
            qrDataLines.push(`Exam: ${exam.displayName || exam.name}`);
        }

        if (currentSchool?.name) {
            qrDataLines.push(`School: ${currentSchool.name}`);
        }

        const qrData = qrDataLines.join('\n');
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`;

        const getTemplateStyles = () => {
            const accent = savedConfig?.accentColor || (templateId === 'modern' ? '#3b82f6' : templateId === 'premium' ? '#b45309' : '#1e40af');

            switch (templateId) {
                case 'modern':
                    return {
                        container: { border: 'none', background: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
                        header: { background: '#1f2937', color: 'white' },
                        accent
                    };
                case 'premium':
                    return {
                        container: { border: `2px solid ${accent}`, background: '#fff' },
                        header: { background: '#78350f', color: 'white' },
                        accent
                    };
                default:
                    return {
                        container: { border: `2px solid ${accent}`, background: '#fff' },
                        header: { background: accent, color: 'white' },
                        accent
                    };
            }
        };

        const styles = getTemplateStyles();

        return (
            <div className={`admit-card-container ${templateId}`} style={{
                width: '100%',
                maxWidth: '800px',
                margin: '2rem auto',
                padding: '2rem',
                backgroundColor: 'white',
                fontFamily: "'Inter', sans-serif",
                color: '#1f2937',
                ...styles.container,
                borderRadius: '1rem',
                position: 'relative',
                overflow: 'visible', /* Changed to visible to ensure no clipping */
                minHeight: '450px' /* Ensure enough space for absolute elements */
            }}>
                {/* Header Section */}
                <div style={{
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    textAlign: 'center',
                    marginBottom: '1.25rem',
                    background: 'white',
                    border: `3px solid ${styles.accent}`,
                    borderBottom: `5px solid ${styles.accent}`
                }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', color: styles.accent }}>
                        {currentSchool?.name || 'SCHOOL NAME'}
                    </h2>
                    {currentSchool?.address && (
                        <p style={{ margin: '0.15rem 0 0', color: '#6b7280', fontSize: '0.7rem', fontWeight: 400 }}>
                            {currentSchool.address}
                        </p>
                    )}
                    <p style={{ margin: '0.35rem 0 0', color: styles.accent, fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                        ADMIT CARD - {exam?.displayName || exam?.name || 'EXAMINATION'}
                    </p>
                </div>

                {/* Body Content - Positioned Container */}
                <div className="admit-body" style={{ position: 'relative', marginTop: '1rem' }}>
                    <div className="student-info-grid" style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '1rem 0', /* Vertical gap between rows */
                        width: '75%',
                    }}>
                        <div className="info-item" style={{ width: '48%' }}>
                            <label style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Student Name</label>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '0.15rem' }}>{student.name}</div>
                        </div>
                        <div className="info-item" style={{ width: '48%' }}>
                            <label style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Roll Number</label>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '0.15rem' }}>{student.rollNo || student.classRollNo || 'N/A'}</div>
                        </div>
                        <div className="info-item" style={{ width: '48%' }}>
                            <label style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Father's Name</label>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '0.15rem' }}>{student.fatherName || '-'}</div>
                        </div>
                        <div className="info-item" style={{ width: '48%' }}>
                            <label style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Class & Section</label>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '0.15rem' }}>{student.class}</div>
                        </div>
                        <div className="info-item" style={{ width: '48%' }}>
                            <label style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Academic Year</label>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '0.15rem' }}>{exam?.academicYearName || '2024-25'}</div>
                        </div>
                    </div>

                    <div className="photo-qr-section" style={{
                        position: 'absolute',
                        top: '0',
                        right: '0',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1.2rem',
                        width: '120px'
                    }}>
                        {/* Student Photo */}
                        {student.photo ? (
                            <img
                                src={student.photo}
                                alt={student.name}
                                style={{
                                    width: '100px',
                                    height: '125px',
                                    border: `2px solid ${styles.accent}`,
                                    borderRadius: '0.4rem',
                                    objectFit: 'cover'
                                }}
                            />
                        ) : (
                            <div style={{
                                width: '100px', height: '125px',
                                border: `2px dashed ${styles.accent}`,
                                borderRadius: '0.4rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.65rem', color: '#9ca3af', textAlign: 'center'
                            }}>
                                AFFIX PHOTO HERE
                            </div>
                        )}
                        {/* QR Code with top margin for reliable print gap */}
                        {savedConfig?.showQrCode !== false && (
                            <div style={{ marginTop: '2.5rem' }}>
                                <img src={qrUrl} alt="QR Code" style={{ width: '75px', height: '75px' }} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Timetable Table */}
                <div style={{ marginTop: '1.25rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: styles.accent, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Calendar size={16} />
                        EXAMINATION SCHEDULE
                    </h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb', borderBottom: `2px solid ${styles.accent}` }}>
                                <th style={{ padding: '0.4rem', textAlign: 'left', fontSize: '0.65rem', color: '#6b7280' }}>DATE</th>
                                <th style={{ padding: '0.4rem', textAlign: 'left', fontSize: '0.65rem', color: '#6b7280' }}>SUBJECT</th>
                                <th style={{ padding: '0.4rem', textAlign: 'center', fontSize: '0.65rem', color: '#6b7280' }}>TIME</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(exam?.subjects || []).sort((a: any, b: any) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime()).map((subject: any, idx: number) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '0.4rem', fontSize: '0.75rem', fontWeight: 600 }}>{new Date(subject.examDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                    <td style={{ padding: '0.4rem', fontSize: '0.75rem' }}>{subject.subjectName}</td>
                                    <td style={{ padding: '0.4rem', fontSize: '0.75rem', textAlign: 'center' }}>{subject.examTime} ({subject.duration}m)</td>
                                </tr>
                            ))}
                            {(!exam?.subjects || exam.subjects.length === 0) && (
                                <tr>
                                    <td colSpan={3} style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.75rem' }}>Schedule not yet published</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Section */}
                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>
                        <p style={{ margin: 0 }}><strong>Important:</strong> {savedConfig?.customMessage || 'Please report 15 minutes before exam.'}</p>
                        <p style={{ margin: '0.15rem 0 0' }}>Valid only with school seal and principal signature.</p>
                    </div>
                    <div style={{ textAlign: 'center', borderTop: `1px solid ${styles.accent}`, minWidth: '140px', paddingTop: '0.35rem' }}>
                        <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 700 }}>PRINCIPAL'S SIGNATURE</p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="page-container no-print">
                <div className="page-header" style={{ marginBottom: '2rem' }}>
                    <div>
                        <h1 className="page-title">Admit Card Center</h1>
                        <p className="page-subtitle">Generate and print examination hall tickets for students</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            onClick={() => setShowPreview(true)}
                            disabled={!selectedExamId || filteredStudents.length === 0}
                            style={{
                                padding: '0.75rem 1.5rem',
                                borderRadius: '0.75rem',
                                border: '1px solid #6366f1',
                                background: 'white',
                                color: '#6366f1',
                                fontWeight: 600,
                                fontSize: '0.9375rem',
                                cursor: selectedExamId && filteredStudents.length > 0 ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                transition: 'all 0.2s',
                                opacity: selectedExamId && filteredStudents.length > 0 ? 1 : 0.5
                            }}
                            onMouseEnter={(e) => {
                                if (selectedExamId && filteredStudents.length > 0) {
                                    e.currentTarget.style.background = '#eff6ff';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'white';
                            }}
                        >
                            <Eye size={18} />
                            Preview
                        </button>
                        <button
                            onClick={handlePrint}
                            disabled={!selectedExamId || filteredStudents.length === 0}
                            style={{
                                padding: '0.75rem 1.5rem',
                                borderRadius: '0.75rem',
                                border: 'none',
                                background: selectedExamId && filteredStudents.length > 0 ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : '#cbd5e1',
                                color: 'white',
                                fontWeight: 700,
                                fontSize: '0.9375rem',
                                cursor: selectedExamId && filteredStudents.length > 0 ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                boxShadow: selectedExamId && filteredStudents.length > 0 ? '0 4px 6px -1px rgba(99, 102, 241, 0.3)' : 'none',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                if (selectedExamId && filteredStudents.length > 0) {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 12px -2px rgba(99, 102, 241, 0.4)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (selectedExamId && filteredStudents.length > 0) {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(99, 102, 241, 0.3)';
                                }
                            }}
                        >
                            <Printer size={18} />
                            Print All ({filteredStudents.length} Cards)
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Setup Card */}
                        <div className="card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Layout size={20} style={{ color: 'var(--primary)' }} />
                                1. Generation Settings
                            </h3>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                <div className="form-group">
                                    <label>Selection Mode</label>
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                        {(['class', 'exam', 'single'] as const).map(mode => (
                                            <button
                                                key={mode}
                                                onClick={() => setGenerationMode(mode)}
                                                style={{
                                                    flex: 1, padding: '0.5rem', border: '1px solid var(--border)',
                                                    borderRadius: '0.5rem', fontSize: '0.875rem',
                                                    background: generationMode === mode ? 'var(--primary)' : 'transparent',
                                                    color: generationMode === mode ? 'white' : 'var(--text-main)',
                                                    fontWeight: generationMode === mode ? 700 : 500,
                                                    textTransform: 'capitalize'
                                                }}
                                            >
                                                {mode === 'single' ? 'Student' : mode}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Target Examination *</label>
                                    <select className="input-field" value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)}>
                                        <option value="">Select Exam</option>
                                        {schoolExams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                {generationMode === 'class' && (
                                    <div className="form-group">
                                        <label>Select Class</label>
                                        <select className="input-field" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                                            <option value="ALL">All Available Classes</option>
                                            {classesList.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                )}
                                {generationMode === 'single' && (
                                    <div className="form-group">
                                        <label>Search Student</label>
                                        <div style={{ position: 'relative' }}>
                                            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                            <input
                                                type="text"
                                                className="input-field"
                                                placeholder="Name or Roll No..."
                                                style={{ paddingLeft: '2.5rem' }}
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Template Gallery */}
                        <div className="card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Layout size={20} style={{ color: 'var(--primary)' }} />
                                2. Select Template
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                {TEMPLATES.map(template => (
                                    <button
                                        key={template.id}
                                        onClick={() => setSelectedTemplate(template.id)}
                                        style={{
                                            position: 'relative', padding: '1rem', textAlign: 'left',
                                            border: `2px solid ${selectedTemplate === template.id ? 'var(--primary)' : 'var(--border)'}`,
                                            borderRadius: '0.75rem', background: 'var(--bg-main)',
                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                    >
                                        <div style={{
                                            height: '60px', borderRadius: '0.375rem', background: template.previewColor,
                                            marginBottom: '0.75rem', opacity: 0.8
                                        }} />
                                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main)' }}>{template.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{template.description}</div>
                                        {selectedTemplate === template.id && (
                                            <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', color: 'var(--primary)' }}>
                                                <CheckCircle size={18} />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Student List */}
                        {selectedExamId && (
                            <div className="card" style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Total Students Selected: {filteredStudents.length}</h3>
                                    {generationMode === 'single' && searchQuery && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            Click a student to select
                                        </div>
                                    )}
                                </div>

                                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '0.5rem' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-main)', borderBottom: '1px solid var(--border)' }}>
                                            <tr>
                                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Roll No</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Class</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredStudents.map(student => (
                                                <tr key={student.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: '0.75rem' }}>{student.rollNo || student.classRollNo || '-'}</td>
                                                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{student.name}</td>
                                                    <td style={{ padding: '0.75rem' }}>{student.class}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedStudentId(student.id);
                                                                setGenerationMode('single');
                                                            }}
                                                            className="btn-secondary"
                                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                                        >
                                                            Select
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Info Panel */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="card" style={{ padding: '1.5rem', background: 'var(--primary-glow)', border: '1px solid var(--primary-border)' }}>
                            <h4 style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '0.75rem' }}>Quick Summary</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Exam:</span>
                                    <span style={{ fontWeight: 600 }}>{selectedExam?.displayName || selectedExam?.name || 'Not Selected'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Template:</span>
                                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{selectedTemplate}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Cards to generate:</span>
                                    <span style={{ fontWeight: 600 }}>{filteredStudents.length}</span>
                                </div>
                            </div>
                        </div>

                        <div className="card" style={{ padding: '1.5rem' }}>
                            <h4 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Printing Instructions</h4>
                            <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <li>Use <strong>A4 sized</strong> paper for best results.</li>
                                <li>Enable <strong>'Background Graphics'</strong> in print settings.</li>
                                <li>Set margins to <strong>'None'</strong> or <strong>'Minimum'</strong>.</li>
                                <li>QR Codes are unique to each student and can be scanned for verification.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Preview Modal */}
                {showPreview && (
                    <>
                        <div className="modal-overlay" onClick={() => setShowPreview(false)} />
                        <div className="modal" style={{ maxWidth: '900px', padding: '0' }}>
                            <div style={{
                                padding: '1.25rem 2rem', borderBottom: '1px solid var(--border)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 10
                            }}>
                                <div>
                                    <h3 style={{ fontWeight: 800 }}>Sample Preview</h3>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Showing preview for first student</p>
                                </div>
                                <button onClick={() => setShowPreview(false)} className="btn-secondary" style={{ padding: '0.5rem' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div style={{ padding: '1rem', maxHeight: '80vh', overflowY: 'auto', background: '#f3f4f6' }}>
                                {filteredStudents.length > 0 ? (
                                    <AdmitCard student={filteredStudents[0]} exam={selectedExam} templateId={selectedTemplate} />
                                ) : (
                                    <div style={{ padding: '4rem', textAlign: 'center' }}>
                                        <Users size={48} style={{ margin: '0 auto', color: '#9ca3af', marginBottom: '1rem' }} />
                                        <p>Please select students to see a preview</p>
                                    </div>
                                )}
                            </div>
                            <div style={{
                                padding: '1.25rem 2rem',
                                borderTop: '1px solid var(--border)',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '1rem',
                                background: '#f9fafb'
                            }}>
                                <button
                                    onClick={() => setShowPreview(false)}
                                    style={{
                                        padding: '0.75rem 2rem',
                                        borderRadius: '0.75rem',
                                        border: '1px solid var(--border)',
                                        background: 'white',
                                        color: 'var(--text-main)',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                >
                                    <X size={18} />
                                    Close Preview
                                </button>
                                <button
                                    onClick={handlePrint}
                                    style={{
                                        padding: '0.75rem 2rem',
                                        borderRadius: '0.75rem',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                        color: 'white',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.3)',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 6px 12px -2px rgba(99, 102, 241, 0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(99, 102, 241, 0.3)';
                                    }}
                                >
                                    <Printer size={18} />
                                    Print All ({filteredStudents.length} Cards)
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Print Only Section - Sibling to page-container, NOT inside it */}
            <div className="print-only">
                {selectedExam && filteredStudents.length > 0 && (
                    <>
                        {console.log('Rendering print section with', filteredStudents.length, 'students')}
                        {filteredStudents.map(student => {
                            console.log('Rendering admit card for:', student.name);
                            return <AdmitCard key={student.id} student={student} exam={selectedExam} templateId={selectedTemplate} />;
                        })}
                    </>
                )}
            </div>

            <style>{`
                /* Hide print section on screen */
                .print-only {
                    display: none !important;
                }

                /* Hide print-active initially */
                .print-active {
                    display: none !important;
                }

                /* Print-specific styles */
                @media print {
                    /* Remove browser default margins and headers/footers */
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }

                    /* When printing, hide EVERYTHING except print-active */
                    body.printing > *:not(.print-active) {
                        display: none !important;
                        visibility: hidden !important;
                    }

                    /* Show ONLY print-active and its children */
                    body.printing .print-active {
                        display: block !important;
                        visibility: visible !important;
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }

                    /* Make all children of print-active visible */
                    body.printing .print-active * {
                        visibility: visible !important;
                    }

                    /* Reset body and html for clean printing */
                    html, body {
                        width: 100% !important;
                        height: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        overflow: visible !important;
                    }

                    /* Fix specific elements that need different display */
                    .print-active div {
                        display: block !important;
                    }

                    .print-active h1, .print-active h2, .print-active h3, .print-active h4,
                    .print-active p, .print-active span, .print-active label {
                        display: block !important;
                    }

                    .print-active th, .print-active td {
                        display: table-cell !important;
                    }

                    .print-active table {
                        display: table !important;
                        width: 100% !important;
                        border-collapse: collapse !important;
                        page-break-inside: avoid !important;
                    }

                    .print-active thead {
                        display: table-header-group !important;
                    }

                    .print-active tbody {
                        display: table-row-group !important;
                    }

                    .print-active tr {
                        display: table-row !important;
                    }

                    .print-active img {
                        display: block !important;
                        max-width: 100% !important;
                        height: auto !important;
                    }

                    /* Position photo and QR code in top right corner */
                    .admit-body {
                        position: relative !important;
                        display: block !important;
                        width: 100% !important;
                        min-height: 180px !important; /* Reduced to move schedule up */
                    }

                    .student-info-grid {
                        width: 70% !important;
                        display: flex !important;
                        flex-wrap: wrap !important;
                        margin: 0 !important;
                        gap: 0 !important; /* Managed by item margins */
                    }

                    .student-info-grid .info-item {
                        width: 48% !important;
                        display: inline-block !important;
                        margin-bottom: 1rem !important;
                        margin-right: 2% !important;
                    }

                    .photo-qr-section {
                        position: absolute !important;
                        top: 0 !important;
                        right: 0 !important;
                        width: 120px !important;
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                    }

                    .photo-qr-section > div {
                        margin-top: 1.5rem !important; /* Force space for QR */
                    }

                    .photo-qr-section img {
                        display: block !important;
                        margin: 0 auto !important;
                        object-fit: cover !important;
                    }

                    /* Move table up */
                    .admit-card-container table {
                        width: 100% !important;
                        margin-top: 0.5rem !important;
                        border: 1.5px solid #e5e7eb !important;
                    }

                    .admit-card-container h4 {
                        margin-top: 0 !important;
                        margin-bottom: 0.3rem !important;
                    }

                    .admit-card-container table th {
                        background-color: #f9fafb !important;
                        -webkit-print-color-adjust: exact !important;
                    }

                    /* Style each admit card for printing */
                    .admit-card-container {
                        margin: 1.5cm auto !important;
                        padding: 1.5cm !important;
                        page-break-after: always !important;
                        page-break-inside: avoid !important;
                        box-shadow: none !important;
                        border: 3px solid #000 !important;
                        max-width: 18cm !important;
                        width: 18cm !important;
                        min-height: 25cm !important;
                        background: white !important;
                        display: block !important;
                        box-sizing: border-box !important;
                    }

                    /* Last card should not have page break */
                    .admit-card-container:last-child {
                        page-break-after: auto !important;
                        margin-bottom: 1.5cm !important;
                    }

                    /* Better spacing for print */
                    .admit-card-container > div {
                        margin-bottom: 1.2rem !important;
                    }

                    .admit-card-container table {
                        margin-top: 1.5rem !important;
                    }

                    .admit-card-container h2 {
                        font-size: 1.75rem !important;
                        line-height: 1.3 !important;
                    }

                    .admit-card-container .info-item {
                        margin-bottom: 1rem !important;
                    }

                    /* Footer - ensure signature on right */
                    .admit-card-container > div:last-child {
                        display: flex !important;
                        justify-content: space-between !important;
                        align-items: flex-end !important;
                        width: 100% !important;
                        margin-top: 2rem !important;
                    }

                    .admit-card-container > div:last-child > div:last-child {
                        text-align: right !important;
                        border-top: 1.5px solid #000 !important;
                        min-width: 160px !important;
                        padding-top: 5px !important;
                    }

                    /* Ensure colors print properly */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                }
            `}</style>
        </>
    );
};

export default AdmitCards;

