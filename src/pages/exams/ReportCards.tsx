import React, { useState, useMemo, useEffect } from 'react';
import {
    Download,
    Eye,
    Printer,
    Layout,
    Search,
    Users,
    Award,
    TrendingUp,
    CheckCircle,
    X,
    FileText,
    BarChart3,
    Settings,
    ChevronDown,
    ArrowRight,
    Star
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';
import { sortClasses } from '../../constants/app';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

interface ReportTemplate {
    id: string;
    name: string;
    description: string;
    accentColor: string;
}

const ReportCards: React.FC = () => {
    const { currentSchool } = useSchool();
    const { data: exams } = useFirestore<any>('exams');
    const { data: marksEntries } = useFirestore<any>('marks_entries');
    const { data: students } = useFirestore<any>('students');
    const { data: allSettings } = useFirestore<any>('settings');
    const { data: gradingSystems } = useFirestore<any>('grading_systems');
    const { data: reportTemplates } = useFirestore<any>('report_card_templates');

    const activeClasses = sortClasses(allSettings?.filter((d: any) => d.type === 'class' && d.active !== false) || []);

    // Get available templates (public + school's own)
    const availableTemplates = reportTemplates?.filter((t: any) =>
        t.isPublic || t.schoolId === currentSchool?.id
    ) || [];

    // Get selected template (from school settings or default)
    const schoolSelectedTemplateId = currentSchool?.selectedReportCardTemplateId;
    const defaultTemplate = availableTemplates.find((t: any) => t.isDefault) || availableTemplates[0];

    const [selectedExamId, setSelectedExamId] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState(schoolSelectedTemplateId || defaultTemplate?.id || '');
    const [showPreview, setShowPreview] = useState(false);

    const currentTemplate = availableTemplates.find((t: any) => t.id === selectedTemplate) || defaultTemplate;

    const [includeGraphs, setIncludeGraphs] = useState(currentTemplate?.includeGraphs ?? true);
    const [includeRemarks, setIncludeRemarks] = useState(currentTemplate?.includeRemarks ?? true);
    const [customAccentColor, setCustomAccentColor] = useState('');
    const [customMessage, setCustomMessage] = useState(currentTemplate?.customMessage || '');
    const [signatures, setSignatures] = useState(currentTemplate?.signatures || {
        teacher: 'CLASS TEACHER',
        incharge: 'EXAMINATION IN-CHARGE',
        principal: 'PRINCIPAL / HEADMASTER'
    });
    const [showLogo, setShowLogo] = useState(currentTemplate?.showLogo ?? true);

    // Update state when school's selected template changes
    React.useEffect(() => {
        if (schoolSelectedTemplateId && schoolSelectedTemplateId !== selectedTemplate) {
            setSelectedTemplate(schoolSelectedTemplateId);
        }
    }, [schoolSelectedTemplateId]);

    // Helper to get class name from ID/Slug
    const getClassName = (classId: string) => {
        if (!classId) return '';
        const cls = activeClasses.find((c: any) => c.id === classId || c.name === classId);
        return cls?.name || classId;
    };

    const schoolExams = exams?.filter((e: any) => e.schoolId === currentSchool?.id) || [];
    const selectedExam = schoolExams.find((e: any) => e.id === selectedExamId);
    const defaultGrading = gradingSystems?.find((g: any) => g.schoolId === currentSchool?.id && g.isDefault);

    const filteredStudents = useMemo(() => {
        if (!students || !currentSchool) return [];

        const selectedClassObj = activeClasses.find((c: any) => c.id === selectedClass);
        const selectedClassName = selectedClassObj?.name;

        return students.filter((s: any) =>
            s.schoolId === currentSchool?.id &&
            s.status === 'ACTIVE' &&
            (!selectedClass || s.class === selectedClass || s.class === selectedClassName)
        );
    }, [students, currentSchool, selectedClass, activeClasses]);

    const getStudentResult = (studentId: string) => {
        if (!selectedExamId) return null;

        // Selected Class Name for matching
        const selectedClassObj = activeClasses.find((c: any) => c.id === selectedClass);
        const selectedClassName = selectedClassObj?.name;

        // Find all approved or submitted marks entries for this exam and class
        const examMarks = marksEntries?.filter((entry: any) =>
            entry.examId === selectedExamId &&
            (entry.status === 'APPROVED' || entry.status === 'SUBMITTED') &&
            (entry.classId === selectedClass || (selectedClassName && entry.className === selectedClassName))
        ) || [];

        const subjectsResults = examMarks.map((entry: any) => {
            const studentMark = entry.marks.find((m: any) => m.studentId === studentId);
            return {
                subjectName: entry.subjectName,
                maxMarks: entry.maxMarks,
                obtainedMarks: studentMark?.obtainedMarks || 0,
                percentage: studentMark?.percentage || 0,
                grade: studentMark?.grade || 'F',
                isAbsent: studentMark?.isAbsent || false,
                isNA: studentMark?.isNA || false
            };
        });

        if (subjectsResults.length === 0) return null;

        const totalObtained = subjectsResults.reduce((sum: number, s: any) => sum + (s.isNA ? 0 : s.obtainedMarks), 0);
        const totalMax = subjectsResults.reduce((sum: number, s: any) => sum + (s.isNA ? 0 : s.maxMarks), 0);
        const overallPercentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;

        // Calculate overall grade
        let overallGrade = 'F';
        if (defaultGrading?.ranges) {
            const range = defaultGrading.ranges.find((r: any) => overallPercentage >= r.min && overallPercentage <= r.max);
            overallGrade = range?.grade || 'F';
        }

        return {
            subjects: subjectsResults,
            totalObtained,
            totalMax,
            overallPercentage: overallPercentage.toFixed(2),
            overallGrade,
            status: overallPercentage >= 33 ? 'PASS' : 'FAIL' // Simple pass logic
        };
    };

    const handlePrint = () => {
        window.print();
    };

    const ReportCard = ({ student, result, templateId }: { student: any, result: any, templateId: string }) => {
        if (!result) return <div className="p-8 text-center bg-white border border-dashed rounded-xl">No marks data found for this student.</div>;

        const template = availableTemplates.find(t => t.id === templateId) || currentTemplate;
        const accentColor = customAccentColor || template?.accentColor || '#1e40af';

        // Chart Data
        const chartData = result.subjects.map((s: any) => ({
            subject: s.subjectName.substring(0, 5) + '.',
            score: s.obtainedMarks,
            max: s.maxMarks,
            percent: s.percentage
        }));

        return (
            <div className={`report-card-container ${templateId}`} style={{
                width: '100%', maxWidth: '900px', margin: '2rem auto',
                padding: '3rem', backgroundColor: 'white', borderRadius: '1rem',
                border: `2px solid ${template.accentColor}`, position: 'relative',
                fontFamily: "'Inter', sans-serif", color: '#1f2937'
            }}>
                {/* School Header */}
                <div style={{ textAlign: 'center', marginBottom: '2.5rem', borderBottom: `2px solid ${template.accentColor}`, paddingBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
                        {showLogo && (
                            <div style={{ width: '80px', height: '80px', background: template.accentColor, borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '2rem' }}>
                                {currentSchool?.name?.charAt(0) || 'S'}
                            </div>
                        )}
                        <div style={{ textAlign: showLogo ? 'left' : 'center' }}>
                            <h1 style={{ fontSize: '2.25rem', fontWeight: 900, margin: 0, color: template.accentColor, textTransform: 'uppercase' }}>{currentSchool?.name}</h1>
                            <p style={{ margin: '0.25rem 0 0', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.875rem', fontWeight: 600 }}>PROGRESS REPORT CARD</p>
                            <p style={{ margin: '0.25rem 0 0', fontWeight: 700, color: '#64748b' }}>ACADEMIC SESSION {selectedExam?.academicYearName || '2025-2026'}</p>
                        </div>
                    </div>
                </div>

                {/* Profile Section */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', background: '#f8fafc', padding: '1.5rem', borderRadius: '0.75rem', marginBottom: '2rem' }}>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Student Name</label>
                        <div style={{ fontWeight: 800 }}>{student.name}</div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Admission No.</label>
                        <div style={{ fontWeight: 800 }}>{student.admissionNo || 'N/A'}</div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Roll No.</label>
                        <div style={{ fontWeight: 800 }}>{student.rollNumber || 'N/A'}</div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Class & Section</label>
                        <div style={{ fontWeight: 800 }}>{student.class}</div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Examination</label>
                        <div style={{ fontWeight: 800 }}>{selectedExam?.name}</div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Attendance</label>
                        <div style={{ fontWeight: 800 }}>96% (210/218)</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: includeGraphs ? '1fr 1fr' : '1fr', gap: '2rem' }}>
                    {/* Marks Table */}
                    <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1rem', color: template.accentColor, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Award size={18} /> SCHOLASTIC PERFORMANCE
                        </h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ background: '#f1f5f9', borderBottom: `2px solid ${template.accentColor}` }}>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>SUBJECT</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>MAX</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>OBT</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>GR</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.subjects.map((s: any, idx: number) => (
                                    <tr key={idx} style={{ borderBottom: '1px dotted #cbd5e1' }}>
                                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>{s.subjectName}</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>{s.maxMarks}</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 800, color: s.isAbsent ? '#ef4444' : (s.isNA ? '#94a3b8' : 'inherit') }}>
                                            {s.isNA ? 'NA' : (s.isAbsent ? 'AB' : s.obtainedMarks)}
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 800, color: template.accentColor }}>{s.grade}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ background: '#f8fafc', fontWeight: 900 }}>
                                    <td style={{ padding: '0.75rem' }}>TOTAL</td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{result.totalMax}</td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{result.totalObtained}</td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center', color: template.accentColor }}>{result.overallGrade}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Chart Section */}
                    {includeGraphs && (
                        <div>
                            <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1rem', color: template.accentColor, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <TrendingUp size={18} /> PERFORMANCE ANALYSIS
                            </h4>
                            <div style={{ height: '300px', width: '100%', background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                        <XAxis dataKey="subject" fontSize={10} axisLine={false} tickLine={false} />
                                        <YAxis domain={[0, 100]} hide />
                                        <Tooltip cursor={{ fill: '#e2e8f0' }} />
                                        <Bar dataKey="percent" radius={[4, 4, 0, 0]}>
                                            {chartData.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={entry.percent >= 80 ? '#10b981' : entry.percent >= 40 ? '#3b82f6' : '#ef4444'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '1.5rem', textAlign: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>PERCENTAGE</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: template.accentColor }}>{result.overallPercentage}%</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>OVERALL GRADE</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: template.accentColor }}>{result.overallGrade}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>STATUS</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: result.status === 'PASS' ? '#10b981' : '#ef4444' }}>{result.status}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Remarks Section */}
                {includeRemarks && (
                    <div style={{ marginTop: '2.5rem', padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '1rem', background: '#f8fafc' }}>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 800, marginBottom: '0.75rem', color: template.accentColor, borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>CLASS TEACHER'S REMARKS</h4>
                        <div style={{ fontStyle: 'italic', color: '#1e293b', fontSize: '1rem', minHeight: '60px', lineHeight: 1.6 }}>
                            {customMessage ?
                                customMessage.replace('{name}', student.name).replace('{percentage}', result.overallPercentage) :
                                `${student.name} is a hardworking and dedicated student. ${result.overallPercentage >= 80 ? "Excellent performance this term." : "Shows good progress but needs more focus on core subjects."} Keep it up!`
                            }
                        </div>
                    </div>
                )}

                {/* Footer Signatures */}
                <div style={{ marginTop: '4rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', textAlign: 'center' }}>
                    <div>
                        <div style={{ borderTop: `2px solid ${template.accentColor}`, paddingTop: '0.5rem', fontWeight: 700, fontSize: '0.8125rem' }}>{signatures.teacher}</div>
                    </div>
                    <div>
                        <div style={{ borderTop: `2px solid ${template.accentColor}`, paddingTop: '0.5rem', fontWeight: 700, fontSize: '0.8125rem' }}>{signatures.incharge}</div>
                    </div>
                    <div>
                        <div style={{ borderTop: `2px solid ${template.accentColor}`, paddingTop: '0.5rem', fontWeight: 700, fontSize: '0.8125rem' }}>{signatures.principal}</div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="page-container no-print" style={{ background: '#f8fafc' }}>
            <div className="page-header" style={{ marginBottom: '3rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                        <div style={{
                            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                            color: 'white',
                            padding: '0.6rem',
                            borderRadius: '1rem',
                            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                        }}>
                            <FileText size={24} />
                        </div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Digital Result Portal</h1>
                    </div>
                    <p className="page-subtitle">Generate high-fidelity report cards with performance visualization</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={() => setShowPreview(true)}
                        className="btn"
                        disabled={!selectedExamId || !selectedClass}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'white',
                            color: '#1e293b',
                            border: '1px solid #e2e8f0',
                            borderRadius: '0.75rem',
                            padding: '0.7rem 1.25rem',
                            fontWeight: 600,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            opacity: (!selectedExamId || !selectedClass) ? 0.5 : 1
                        }}
                    >
                        <Eye size={18} />
                        Live Preview
                    </button>
                    <button
                        onClick={handlePrint}
                        className="btn"
                        disabled={!selectedExamId || !selectedClass}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.75rem',
                            padding: '0.7rem 1.25rem',
                            fontWeight: 700,
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                            opacity: (!selectedExamId || !selectedClass) ? 0.5 : 1
                        }}
                    >
                        <Printer size={18} />
                        Bulk Print
                    </button>
                    <button
                        className="btn"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: '#f1f5f9',
                            color: '#475569',
                            border: 'none',
                            borderRadius: '0.75rem',
                            padding: '0.7rem 1.25rem',
                            fontWeight: 600
                        }}
                    >
                        <Download size={18} />
                        Export All
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Setup Panel */}
                    <div className="card" style={{ padding: '2rem', borderRadius: '1.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                                    Target Examination
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <select className="input-field" value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)} style={{ paddingRight: '2.5rem', borderRadius: '0.75rem' }}>
                                        <option value="">Select Exam</option>
                                        {schoolExams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                    </select>
                                    <ChevronDown size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                                    Selection Class
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <select className="input-field" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={{ paddingRight: '2.5rem', borderRadius: '0.75rem' }}>
                                        <option value="">Select Class</option>
                                        {activeClasses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <ChevronDown size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }} />
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '2rem' }}>
                            <label style={{ fontWeight: 700, display: 'block', marginBottom: '1rem' }}>Report Card Options</label>
                            <div style={{ display: 'flex', gap: '2rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={includeGraphs} onChange={e => setIncludeGraphs(e.target.checked)} />
                                    Include Analytics Graphs
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={includeRemarks} onChange={e => setIncludeRemarks(e.target.checked)} />
                                    Include Teacher Remarks
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Template Selection */}
                    <div className="card" style={{ padding: '2rem', borderRadius: '1.5rem', border: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ background: '#fef2f2', color: '#ef4444', padding: '0.5rem', borderRadius: '0.75rem' }}>
                                    <Layout size={20} />
                                </div>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0 }}>Select Design Template</h3>
                            </div>
                            <a
                                href="/exams/template-management"
                                style={{
                                    fontSize: '0.875rem',
                                    fontWeight: 700,
                                    color: '#6366f1',
                                    textDecoration: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                }}
                            >
                                Manage Templates →
                            </a>
                        </div>
                        {availableTemplates.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
                                {availableTemplates.map(template => (
                                    <button
                                        key={template.id}
                                        onClick={() => {
                                            setSelectedTemplate(template.id);
                                            setCustomAccentColor(''); // Reset custom color when switching base template
                                        }}
                                        style={{
                                            padding: '1.5rem', textAlign: 'left', borderRadius: '1rem',
                                            background: selectedTemplate === template.id ? `${template.accentColor}08` : 'white',
                                            border: `2px solid ${selectedTemplate === template.id ? template.accentColor : '#f1f5f9'}`,
                                            transition: 'all 0.2s',
                                            boxShadow: selectedTemplate === template.id ? `0 4px 12px ${template.accentColor}15` : 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: template.accentColor, marginBottom: '1rem', opacity: 0.8 }} />
                                        <div style={{ fontWeight: 800, fontSize: '0.875rem', color: '#1e293b' }}>{template.name}</div>
                                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.25rem 0 1rem' }}>{template.description}</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: template.accentColor }}>
                                            {selectedTemplate === template.id ? <CheckCircle size={16} /> : <div style={{ width: 16, height: 16 }} />}
                                            {selectedTemplate === template.id ? 'Active' : 'Select'}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                                <p>No templates available. Please create one from the Template Management page.</p>
                            </div>
                        )}
                    </div>

                    {/* Design Customizer */}
                    <div className="card" style={{ padding: '2rem', borderRadius: '1.5rem', border: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                            <div style={{ background: '#f0f9ff', color: '#0ea5e9', padding: '0.5rem', borderRadius: '0.75rem' }}>
                                <Settings size={20} />
                            </div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0 }}>Customize Design</h3>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.875rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '1rem' }}>Theme Accent Color</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                                        {['#1e40af', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#1f2937', '#7c3aed'].map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setCustomAccentColor(color)}
                                                style={{
                                                    width: '32px', height: '32px', borderRadius: '50%',
                                                    background: color,
                                                    border: (customAccentColor || availableTemplates.find((t: any) => t.id === selectedTemplate)?.accentColor) === color ? '3px solid white' : 'none',
                                                    boxShadow: (customAccentColor || availableTemplates.find((t: any) => t.id === selectedTemplate)?.accentColor) === color ? '0 0 0 2px #4f46e5' : 'none',
                                                    cursor: 'pointer', transition: 'transform 0.2s'
                                                }}
                                            />
                                        ))}
                                        <input
                                            type="color"
                                            value={customAccentColor || availableTemplates.find((t: any) => t.id === selectedTemplate)?.accentColor || '#1e40af'}
                                            onChange={e => setCustomAccentColor(e.target.value)}
                                            style={{ width: '32px', height: '32px', padding: 0, border: 'none', borderRadius: '50%', cursor: 'pointer' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '2rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                                        <input type="checkbox" checked={showLogo} onChange={e => setShowLogo(e.target.checked)} />
                                        Show School Logo
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                                        <input type="checkbox" checked={includeGraphs} onChange={e => setIncludeGraphs(e.target.checked)} />
                                        Analytics Charts
                                    </label>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.875rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.5rem' }}>Custom Remarks Template</label>
                                    <textarea
                                        className="input-field"
                                        rows={3}
                                        placeholder="{name} is a dedicated student..."
                                        value={customMessage}
                                        onChange={e => setCustomMessage(e.target.value)}
                                        style={{ fontSize: '0.8125rem', borderRadius: '0.75rem' }}
                                    />
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Use {'{name}'} and {'{percentage}'} for auto-fill</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '2.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '1rem' }}>Signature Titles</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                                <input className="input-field" value={signatures.teacher} onChange={e => setSignatures({ ...signatures, teacher: e.target.value })} style={{ fontSize: '0.75rem' }} />
                                <input className="input-field" value={signatures.incharge} onChange={e => setSignatures({ ...signatures, incharge: e.target.value })} style={{ fontSize: '0.75rem' }} />
                                <input className="input-field" value={signatures.principal} onChange={e => setSignatures({ ...signatures, principal: e.target.value })} style={{ fontSize: '0.75rem' }} />
                            </div>
                        </div>
                    </div>

                    {/* Students Summary */}
                    {selectedClass && (
                        <div className="card" style={{ padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h4 style={{ fontWeight: 800 }}>Student Ready List ({filteredStudents.length})</h4>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Only students with approved marks appear here</div>
                            </div>
                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                {filteredStudents.slice(0, 10).map(student => {
                                    const hasResult = getStudentResult(student.id);
                                    return (
                                        <div key={student.id} style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{ width: '32px', height: '32px', background: 'var(--border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem' }}>
                                                    {student.rollNumber || '?'}
                                                </div>
                                                <div style={{ fontWeight: 700 }}>{student.name}</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                                {hasResult ? (
                                                    <>
                                                        <div style={{ fontSize: '0.875rem' }}>Score: <strong style={{ color: 'var(--primary)' }}>{hasResult.overallPercentage}%</strong></div>
                                                        <span style={{ background: '#10b98120', color: '#10b981', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.625rem', fontWeight: 800 }}>READY</span>
                                                    </>
                                                ) : (
                                                    <span style={{ background: '#f59e0b20', color: '#f59e0b', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.625rem', fontWeight: 800 }}>MARKS PENDING</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredStudents.length > 10 && <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>+ {filteredStudents.length - 10} more students</div>}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="card" style={{
                        padding: '1.75rem',
                        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(79, 70, 229, 0.02) 100%)',
                        border: '1px solid rgba(79, 70, 229, 0.1)',
                        borderRadius: '1.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                            <div style={{ background: 'white', color: '#4f46e5', padding: '0.5rem', borderRadius: '0.75rem', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
                                <TrendingUp size={20} />
                            </div>
                            <h4 style={{ fontWeight: 800, color: '#1e293b', margin: 0 }}>Release Statistics</h4>
                        </div>
                        <div style={{ display: 'grid', gap: '1rem', fontSize: '0.875rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#64748b', fontWeight: 600 }}>Total Students</span>
                                <strong style={{ color: '#1e293b', fontSize: '1rem' }}>{filteredStudents.length}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#64748b', fontWeight: 600 }}>Results Ready</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <strong style={{ color: '#10b981', fontSize: '1rem' }}>{filteredStudents.filter(s => getStudentResult(s.id)).length}</strong>
                                    <span style={{ fontSize: '0.75rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                        {filteredStudents.length > 0 ? ((filteredStudents.filter(s => getStudentResult(s.id)).length / filteredStudents.length) * 100).toFixed(0) : 0}%
                                    </span>
                                </div>
                            </div>
                            <div style={{ marginTop: '0.5rem', width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                <div
                                    style={{
                                        width: `${filteredStudents.length > 0 ? (filteredStudents.filter(s => getStudentResult(s.id)).length / filteredStudents.length) * 100 : 0}%`,
                                        height: '100%',
                                        background: '#10b981',
                                        transition: 'width 0.5s ease-out'
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="card" style={{ padding: '1.75rem', borderRadius: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                            <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '0.5rem', borderRadius: '0.75rem' }}>
                                <Star size={20} />
                            </div>
                            <h4 style={{ fontWeight: 800, color: '#1e293b', margin: 0 }}>Power Tips</h4>
                        </div>
                        <ul style={{ padding: 0, margin: 0, listStyle: 'none', fontSize: '0.8125rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <li style={{ display: 'flex', gap: '0.75rem' }}>
                                <div style={{ minWidth: '4px', height: '4px', background: '#f59e0b', borderRadius: '50%', marginTop: '0.6rem' }} />
                                <span>Marks from <strong>"Submitted"</strong> status are now visible during generation.</span>
                            </li>
                            <li style={{ display: 'flex', gap: '0.75rem' }}>
                                <div style={{ minWidth: '4px', height: '4px', background: '#f59e0b', borderRadius: '50%', marginTop: '0.6rem' }} />
                                <span>The <strong>Premium Template</strong> includes dynamic performance analytics.</span>
                            </li>
                            <li style={{ display: 'flex', gap: '0.75rem' }}>
                                <div style={{ minWidth: '4px', height: '4px', background: '#f59e0b', borderRadius: '50%', marginTop: '0.6rem' }} />
                                <span>Use <strong>Bulk Print</strong> to generate cards for the entire class at once.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Print Section */}
            <div className="print-only">
                {filteredStudents.map(student => {
                    const result = getStudentResult(student.id);
                    return result && <ReportCard key={student.id} student={student} result={result} templateId={selectedTemplate} />;
                })}
            </div>

            {/* Preview Modal */}
            {
                showPreview && (
                    <>
                        <div className="modal-overlay" onClick={() => setShowPreview(false)} />
                        <div className="modal" style={{ maxWidth: '1000px', padding: 0, height: '90vh', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '1.25rem 2rem', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100 }}>
                                <h3 style={{ fontWeight: 900 }}>Sample Preview: Standard View</h3>
                                <button onClick={() => setShowPreview(false)} className="btn-secondary" style={{ padding: '0.5rem' }}><X size={20} /></button>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', background: '#f1f5f9', padding: '2rem' }}>
                                {filteredStudents.length > 0 ? (
                                    <ReportCard student={filteredStudents[0]} result={getStudentResult(filteredStudents[0].id)} templateId={selectedTemplate} />
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                                        <BarChart3 size={48} style={{ margin: '0 auto', color: '#94a3b8', marginBottom: '1rem' }} />
                                        <p>Select an exam and class to view preview.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )
            }

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .print-only { display: block !important; padding: 0 !important; margin: 0 !important; }
                    .report-card-container { 
                        margin: 0 !important; 
                        padding: 2.5rem !important; 
                        width: 100% !important; 
                        height: 297mm !important; /* A4 height */
                        page-break-after: always !important; 
                        border: 1px solid #000 !important;
                        box-shadow: none !important;
                    }
                    body { background: white !important; margin: 0 !important; }
                }
                .print-only { display: none; }
            `}</style>
        </div >
    );
};

export default ReportCards;
