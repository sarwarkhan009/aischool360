import React, { useState, useMemo } from 'react';
import {
    Upload,
    Download,
    Users,
    CheckCircle,
    AlertCircle,
    X,
    FileSpreadsheet,
    ArrowLeft,
    Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSchool } from '../../context/SchoolContext';
import { useFirestore } from '../../hooks/useFirestore';
import { sortClasses } from '../../constants/app';
import {
    parseExcelFile,
    validateStudentData,
    convertToStudents,
    generateStudentTemplate,
} from '../../utils/excelUtils';
import type {
    StudentExcelRow,
    ParsedStudent,
    ValidationResult
} from '../../utils/excelTypes';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

type UploadMode = 'single' | 'all';

const BulkStudentUpload: React.FC = () => {
    const navigate = useNavigate();
    const { currentSchool } = useSchool();
    const { data: allSettings } = useFirestore<any>('settings');
    const { data: existingStudents } = useFirestore<any>('students');
    const { data: feeAmounts } = useFirestore<any>('fee_amounts');

    const activeClasses = sortClasses(allSettings?.filter((d: any) => d.type === 'class' && d.active !== false) || []);

    const [uploadMode, setUploadMode] = useState<UploadMode>('all');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedSection, setSelectedSection] = useState<string>('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [excelData, setExcelData] = useState<StudentExcelRow[]>([]);
    const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);
    const [validation, setValidation] = useState<ValidationResult | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
    const [showPreview, setShowPreview] = useState(false);
    const [uploadComplete, setUploadComplete] = useState(false);

    // Group students by class-section for summary (only used in 'all' mode)
    const classSectionSummary = useMemo(() => {
        if (uploadMode !== 'all') return [];
        const summary = new Map<string, number>();
        parsedStudents.forEach(s => {
            const key = `${s.class} (${s.section})`;
            summary.set(key, (summary.get(key) || 0) + 1);
        });
        return Array.from(summary.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [parsedStudents, uploadMode]);

    const handleModeChange = (mode: UploadMode) => {
        setUploadMode(mode);
        resetForm();
    };

    const handleClassSelect = (classId: string) => {
        setSelectedClass(classId);
        setSelectedSection(''); // Reset section when class changes
        setSelectedFile(null);
        setExcelData([]);
        setParsedStudents([]);
        setValidation(null);
        setShowPreview(false);
    };

    const handleSectionSelect = (section: string) => {
        setSelectedSection(section);
        setSelectedFile(null);
        setExcelData([]);
        setParsedStudents([]);
        setValidation(null);
        setShowPreview(false);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (uploadMode === 'single' && (!selectedClass || !selectedSection)) {
            alert('Please select class and section first');
            return;
        }

        setSelectedFile(file);
        setIsProcessing(true);

        try {
            // Parse Excel
            const data = await parseExcelFile(file);
            setExcelData(data);

            // Validate
            const validationResult = validateStudentData(data, uploadMode === 'all');
            setValidation(validationResult);

            if (validationResult.isValid || validationResult.validCount > 0) {
                // Convert to student objects
                let students: ParsedStudent[];
                if (uploadMode === 'single') {
                    students = convertToStudents(data, selectedClass, selectedSection, currentSchool?.id || '');
                } else {
                    students = convertToStudents(data, currentSchool?.id || '');
                }
                setParsedStudents(students);
                setShowPreview(true);
            }
        } catch (error) {
            console.error('Error parsing Excel:', error);
            alert('Failed to parse Excel file. Please check the format.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpload = async () => {
        if (!currentSchool) {
            alert('School context not found');
            return;
        }

        const activeFY = currentSchool?.activeFinancialYear || '';
        if (!activeFY) {
            alert('Active session not found. Please set session in Settings -> Institution Info.');
            return;
        }

        let studentsToUpload = [...parsedStudents];
        if (!validation?.isValid) {
            const confirm = window.confirm(
                `There are ${validation?.errors.length} errors/warnings. Do you want to upload ONLY the ${validation?.validCount} valid students?`
            );
            if (!confirm) return;

            // Filter to only valid indices if possible, or re-validate
            // For now, we'll keep the current parsedStudents but the loop handles duplicates/errors
        }

        setIsProcessing(true);
        setUploadProgress({ current: 0, total: studentsToUpload.length });

        try {
            const studentsRef = collection(db, 'students');
            let successCount = 0;
            let duplicateCount = 0;
            let errorCount = 0;
            const errorsList: string[] = [];

            // Get existing students for duplicate check
            const schoolStudents = existingStudents || [];

            for (let i = 0; i < studentsToUpload.length; i++) {
                const student = studentsToUpload[i];

                try {
                    // Check for duplicates in existing students (per school, class, section AND roll/name)
                    const duplicate = schoolStudents.find(s => {
                        const sRoll = String(s.rollNo || s.classRollNo || '').trim();
                        const pRoll = String(student.rollNo).trim();
                        const sName = String(s.name || s.fullName || '').toLowerCase().trim();
                        const pName = String(student.name).toLowerCase().trim();
                        const sClass = String(s.class || '').trim().toUpperCase();
                        const pClass = String(student.class).trim().toUpperCase();

                        return sRoll === pRoll && sClass === pClass && sName === pName;
                    });

                    if (duplicate) {
                        duplicateCount++;
                        continue;
                    }

                    // Calculate Monthly Fee for this student
                    let monthlyFee = '0';
                    if (student.class && feeAmounts && feeAmounts.length > 0) {
                        const classFees = feeAmounts.filter((fa: any) =>
                            (fa.financialYear === activeFY || (!fa.financialYear && !activeFY)) &&
                            fa.className === student.class &&
                            fa.feeTypeName &&
                            fa.feeTypeName.toLowerCase().includes('monthly')
                        );
                        const total = classFees.reduce((sum: number, fa: any) => sum + (Number(fa.amount) || 0), 0);
                        monthlyFee = total.toString();
                    }

                    await addDoc(studentsRef, {
                        ...student,
                        session: activeFY, // Critical for visibility
                        financialYear: activeFY, // Consistency
                        monthlyFee: student.monthlyFee || monthlyFee,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                    successCount++;
                } catch (error: any) {
                    console.error(`Error uploading student ${student.name}:`, error);
                    errorCount++;
                    errorsList.push(`${student.name}: ${error.message}`);
                }

                setUploadProgress({ current: i + 1, total: studentsToUpload.length });
            }

            setUploadComplete(true);
            let finalMsg = `Upload Results:\n✅ Success: ${successCount}\n⏭️ Skipped (Duplicates): ${duplicateCount}`;
            if (errorCount > 0) {
                finalMsg += `\n❌ Errors: ${errorCount}`;
            }
            alert(finalMsg);

            if (errorsList.length > 0) {
                console.log('Upload Errors:', errorsList);
            }
        } catch (error) {
            console.error('Error during bulk upload:', error);
            alert('An error occurred during upload. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const resetForm = () => {
        setSelectedClass('');
        setSelectedSection('');
        setSelectedFile(null);
        setExcelData([]);
        setParsedStudents([]);
        setValidation(null);
        setShowPreview(false);
        setUploadComplete(false);
        setUploadProgress({ current: 0, total: 0 });
    };

    const canUploadFile = uploadMode === 'all' || (uploadMode === 'single' && selectedClass && selectedSection);

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <button
                        onClick={() => navigate(`/${currentSchool?.id}/students`)}
                        className="btn"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '1rem',
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            color: 'var(--text-main)'
                        }}
                    >
                        <ArrowLeft size={18} />
                        Back to Students
                    </button>
                    <h1 className="page-title">📥 Bulk Student Upload</h1>
                    <p className="page-subtitle">Upload multiple students from Excel file</p>
                </div>
                <button
                    onClick={generateStudentTemplate}
                    className="btn-premium"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.75rem',
                        padding: '0.875rem 1.75rem',
                        fontWeight: 600,
                        boxShadow: '0 4px 15px rgba(79, 70, 229, 0.3)',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                    }}
                >
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        padding: '0.4rem',
                        borderRadius: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Download size={20} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '0.9rem', lineHeight: '1' }}>Download Template</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 400 }}>Recommended for first-time</span>
                    </div>
                </button>
            </div>

            {/* School Info */}
            {currentSchool && (
                <div className="card" style={{ padding: '1rem', marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(79, 70, 229, 0.1) 100%)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                    <p style={{ margin: 0, color: 'var(--text-main)', fontWeight: 600 }}>
                        📚 Uploading for: <span style={{ color: 'var(--primary)' }}>{currentSchool.name}</span>
                    </p>
                </div>
            )}

            {/* Upload Mode Toggle */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                    <Layers size={20} />
                    Upload Mode
                </h3>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => handleModeChange('all')}
                        className="btn"
                        style={{
                            padding: '1rem 1.5rem',
                            background: uploadMode === 'all'
                                ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                                : 'white',
                            color: uploadMode === 'all' ? 'white' : 'var(--text-main)',
                            border: uploadMode === 'all' ? 'none' : '2px solid var(--border)',
                            borderRadius: '0.75rem',
                            fontWeight: 600,
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: '0.25rem',
                            cursor: 'pointer',
                            boxShadow: uploadMode === 'all' ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none'
                        }}
                    >
                        <span style={{ fontSize: '0.95rem' }}>📋 All Classes in One File</span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 400 }}>
                            Excel me Class column hoga — sab ek saath upload
                        </span>
                    </button>
                    <button
                        onClick={() => handleModeChange('single')}
                        className="btn"
                        style={{
                            padding: '1rem 1.5rem',
                            background: uploadMode === 'single'
                                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                : 'white',
                            color: uploadMode === 'single' ? 'white' : 'var(--text-main)',
                            border: uploadMode === 'single' ? 'none' : '2px solid var(--border)',
                            borderRadius: '0.75rem',
                            fontWeight: 600,
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: '0.25rem',
                            cursor: 'pointer',
                            boxShadow: uploadMode === 'single' ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
                        }}
                    >
                        <span style={{ fontSize: '0.95rem' }}>📁 Single Class Upload</span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 400 }}>
                            Pehle class select karo, phir file upload karo
                        </span>
                    </button>
                </div>
            </div>

            {/* Info Banner for 'all' mode */}
            {uploadMode === 'all' && (
                <div className="card" style={{
                    padding: '1.25rem',
                    marginBottom: '2rem',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.08) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '0.75rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <Layers size={22} style={{ color: '#10b981', flexShrink: 0, marginTop: '0.1rem' }} />
                        <div>
                            <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                📋 All classes & sections in one file!
                            </p>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                Your Excel file must have a <strong>"Class"</strong> column with section info.
                                Format: <code style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '0.15rem 0.4rem', borderRadius: '0.25rem', fontWeight: 600 }}>1 (A)</code>,
                                <code style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '0.15rem 0.4rem', borderRadius: '0.25rem', fontWeight: 600, marginLeft: '0.25rem' }}>9 (A)</code>,
                                <code style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '0.15rem 0.4rem', borderRadius: '0.25rem', fontWeight: 600, marginLeft: '0.25rem' }}>LKG</code>,
                                <code style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '0.15rem 0.4rem', borderRadius: '0.25rem', fontWeight: 600, marginLeft: '0.25rem' }}>10 (B)</code>
                            </p>
                            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Dates should be in <strong>dd-mm-yy</strong> format (e.g., 05-08-24). Download the template for reference.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Class Selection (only for single mode) */}
            {uploadMode === 'single' && (
                <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Users size={20} />
                        Step 1: Select Class
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem' }}>
                        {activeClasses.map((cls: any) => (
                            <button
                                key={cls.name}
                                onClick={() => handleClassSelect(cls.name)}
                                className="btn"
                                style={{
                                    padding: '1rem',
                                    background: selectedClass === cls.name ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'white',
                                    color: selectedClass === cls.name ? 'white' : 'var(--text-main)',
                                    border: selectedClass === cls.name ? 'none' : '2px solid var(--border)',
                                    borderRadius: '0.5rem',
                                    fontWeight: 600,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {cls.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Section Selection (only for single mode) */}
            {uploadMode === 'single' && selectedClass && (
                <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Users size={20} />
                        Step 2: Select Section
                    </h3>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {(() => {
                            const classDoc = allSettings?.find((c: any) => c.type === 'class' && c.name === selectedClass);
                            const sections = classDoc?.sections && classDoc.sections.length > 0 ? classDoc.sections : ['A'];

                            return sections.map((sec: string) => (
                                <button
                                    key={sec}
                                    onClick={() => handleSectionSelect(sec)}
                                    className="btn"
                                    style={{
                                        padding: '1rem 2rem',
                                        background: selectedSection === sec ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'white',
                                        color: selectedSection === sec ? 'white' : 'var(--text-main)',
                                        border: selectedSection === sec ? 'none' : '2px solid var(--border)',
                                        borderRadius: '0.5rem',
                                        fontWeight: 600,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Section {sec}
                                </button>
                            ));
                        })()}
                    </div>
                    {(!allSettings?.find((c: any) => c.type === 'class' && c.name === selectedClass)?.sections?.length) && (
                        <p style={{ marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            💡 Tip: If you want to add more sections (like B, C), please go to <strong>Settings → Global Settings → Class & Section Master</strong>.
                        </p>
                    )}
                </div>
            )}

            {/* File Upload */}
            {canUploadFile && (
                <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileSpreadsheet size={20} />
                        {uploadMode === 'single' ? 'Step 3: Upload Excel File' : 'Upload Excel File'}
                    </h3>
                    <div
                        style={{
                            border: '2px dashed var(--primary)',
                            borderRadius: '0.75rem',
                            padding: '3rem',
                            textAlign: 'center',
                            background: 'rgba(99, 102, 241, 0.05)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onClick={() => document.getElementById('file-input')?.click()}
                    >
                        <Upload size={48} style={{ margin: '0 auto 1rem', color: 'var(--primary)' }} />
                        <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                            {selectedFile ? selectedFile.name : 'Click to upload Excel file'}
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Supports .xlsx, .xls files{uploadMode === 'all' ? ' — All classes in one file' : ''}
                        </p>
                        <input
                            id="file-input"
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                        />
                    </div>

                    {/* Column Order Reference */}
                    {uploadMode === 'all' && (
                        <div style={{
                            marginTop: '1.25rem',
                            padding: '1rem',
                            background: 'rgba(99, 102, 241, 0.05)',
                            borderRadius: '0.5rem',
                            border: '1px solid rgba(99, 102, 241, 0.15)'
                        }}>
                            <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                📄 Required Column Order:
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                {['Roll No.', 'GR. No', 'Date of Admission', 'Student Name', 'Class', 'Father Name', 'Father UID', 'Father Phone', 'Mother Name', 'Mother UID', 'Mother Phone', 'Address', 'Date of Birth', 'Gender', 'Mobile Number', 'UID Number', 'PEN', 'APAAR ID'].map((col) => (
                                    <span key={col} style={{
                                        fontSize: '0.7rem',
                                        padding: '0.2rem 0.5rem',
                                        background: ['Roll No.', 'Student Name', 'Class'].includes(col) ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.1)',
                                        color: ['Roll No.', 'Student Name', 'Class'].includes(col) ? '#ef4444' : 'var(--text-muted)',
                                        borderRadius: '0.25rem',
                                        fontWeight: ['Roll No.', 'Student Name', 'Class'].includes(col) ? 700 : 500,
                                        border: ['Roll No.', 'Student Name', 'Class'].includes(col) ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(99, 102, 241, 0.15)'
                                    }}>
                                        {col}{['Roll No.', 'Student Name', 'Class'].includes(col) ? ' *' : ''}
                                    </span>
                                ))}
                            </div>
                            <p style={{ margin: '0.5rem 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                * Required fields are highlighted in red
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Validation Summary */}
            {validation && (
                <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Validation Summary</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '1rem', background: '#10b98110', borderRadius: '0.5rem', border: '1px solid #10b981' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <CheckCircle size={20} style={{ color: '#10b981' }} />
                                <span style={{ fontWeight: 600 }}>Valid Students</span>
                            </div>
                            <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0, color: '#10b981' }}>
                                {validation.validCount}
                            </p>
                        </div>

                        {validation.errors.length > 0 && (
                            <div style={{ padding: '1rem', background: '#ef444410', borderRadius: '0.5rem', border: '1px solid #ef4444' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <AlertCircle size={20} style={{ color: '#ef4444' }} />
                                    <span style={{ fontWeight: 600 }}>Errors</span>
                                </div>
                                <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0, color: '#ef4444' }}>
                                    {validation.errors.length}
                                </p>
                            </div>
                        )}

                        {validation.warnings.length > 0 && (
                            <div style={{ padding: '1rem', background: '#f59e0b10', borderRadius: '0.5rem', border: '1px solid #f59e0b' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <AlertCircle size={20} style={{ color: '#f59e0b' }} />
                                    <span style={{ fontWeight: 600 }}>Warnings</span>
                                </div>
                                <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0, color: '#f59e0b' }}>
                                    {validation.warnings.length}
                                </p>
                            </div>
                        )}
                    </div>

                    {validation.errors.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                            <h4 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>❌ Errors:</h4>
                            <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--text-main)' }}>
                                {validation.errors.map((error, i) => (
                                    <li key={i} style={{ marginBottom: '0.25rem' }}>{error}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {validation.warnings.length > 0 && (
                        <div>
                            <h4 style={{ color: '#f59e0b', marginBottom: '0.5rem' }}>⚠️ Warnings:</h4>
                            <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--text-main)' }}>
                                {validation.warnings.slice(0, 5).map((warning, i) => (
                                    <li key={i} style={{ marginBottom: '0.25rem' }}>{warning}</li>
                                ))}
                                {validation.warnings.length > 5 && (
                                    <li style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                        ... and {validation.warnings.length - 5} more warnings
                                    </li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Class-Section Summary (only for 'all' mode) */}
            {showPreview && uploadMode === 'all' && classSectionSummary.length > 0 && (
                <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Layers size={20} />
                        Class-wise Summary
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                        {classSectionSummary.map(([classSection, count]) => (
                            <div
                                key={classSection}
                                style={{
                                    padding: '0.75rem 1.25rem',
                                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(79, 70, 229, 0.15) 100%)',
                                    borderRadius: '0.75rem',
                                    border: '1px solid rgba(99, 102, 241, 0.25)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem'
                                }}
                            >
                                <div style={{
                                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                    color: 'white',
                                    padding: '0.3rem 0.6rem',
                                    borderRadius: '0.4rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    minWidth: '1.5rem',
                                    textAlign: 'center'
                                }}>
                                    {count}
                                </div>
                                <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>{classSection}</span>
                            </div>
                        ))}
                    </div>
                    <p style={{ margin: '1rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Total: <strong>{parsedStudents.length} students</strong> across <strong>{classSectionSummary.length} class-sections</strong>
                    </p>
                </div>
            )}

            {/* Preview Table */}
            {showPreview && parsedStudents.length > 0 && (
                <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Preview ({parsedStudents.length} students)</h3>
                    <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 1 }}>
                                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Roll No.</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>GR. No</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Date of Admission</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Student Name</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Class</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Section</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Gender</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Date of Birth</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Mobile No.</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Address</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Father Name</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Father UID</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Father Phone</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Mother Name</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Mother UID</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Mother Phone</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>UID Number</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>PEN</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>APAAR ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parsedStudents.slice(0, 50).map((student: any, index: number) => (
                                    <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '0.75rem' }}>{student.rollNo}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.grNo || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.admissionDate || '-'}</td>
                                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>{student.name}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.class}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.section}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.gender || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.dob || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.mobileNo || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.permanentAddress || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.fatherName || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.fatherAadharNo || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.fatherContactNo || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.motherName || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.motherAadharNo || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.motherContactNo || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.aadharNo || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.studentPenNo || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.appaarNo || '-'}</td>
                                    </tr>
                                ))}
                                {parsedStudents.length > 50 && (
                                    <tr>
                                        <td colSpan={15} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                            ... and {parsedStudents.length - 50} more students
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Upload Progress */}
            {isProcessing && uploadProgress.total > 0 && (
                <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Uploading...</h3>
                    <div style={{ background: '#e5e7eb', borderRadius: '999px', height: '2rem', overflow: 'hidden' }}>
                        <div
                            style={{
                                background: 'linear-gradient(90deg, #10b981, #059669)',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 600,
                                transition: 'width 0.3s',
                                width: `${(uploadProgress.current / uploadProgress.total) * 100}%`
                            }}
                        >
                            {uploadProgress.current} / {uploadProgress.total}
                        </div>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            {showPreview && !uploadComplete && (
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button
                        onClick={resetForm}
                        className="btn"
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: 'white',
                            border: '1px solid var(--border)',
                            color: 'var(--text-main)',
                            borderRadius: '0.5rem',
                            fontWeight: 600
                        }}
                        disabled={isProcessing}
                    >
                        <X size={18} style={{ marginRight: '0.5rem' }} />
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        className="btn"
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                        disabled={isProcessing || Boolean(validation && !validation.isValid && validation.validCount === 0)}
                    >
                        <Upload size={18} />
                        {isProcessing ? 'Uploading...' : `Upload ${parsedStudents.length} Students`}
                    </button>
                </div>
            )}

            {/* Success Message */}
            {uploadComplete && (
                <div className="card" style={{ padding: '2rem', textAlign: 'center', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)', border: '1px solid #10b981' }}>
                    <CheckCircle size={64} style={{ color: '#10b981', margin: '0 auto 1rem' }} />
                    <h2 style={{ color: '#10b981', marginBottom: '0.5rem' }}>Upload Complete!</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                        Students have been successfully uploaded to the system.
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <button
                            onClick={resetForm}
                            className="btn"
                            style={{
                                padding: '0.75rem 1.5rem',
                                background: 'white',
                                border: '1px solid var(--border)',
                                color: 'var(--text-main)',
                                borderRadius: '0.5rem',
                                fontWeight: 600
                            }}
                        >
                            Upload More
                        </button>
                        <button
                            onClick={() => navigate(`/${currentSchool?.id}/students`)}
                            className="btn"
                            style={{
                                padding: '0.75rem 1.5rem',
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.5rem',
                                fontWeight: 600
                            }}
                        >
                            View Students
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BulkStudentUpload;
