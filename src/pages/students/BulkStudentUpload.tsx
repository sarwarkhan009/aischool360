import React, { useState } from 'react';
import {
    Upload,
    Download,
    Users,
    CheckCircle,
    AlertCircle,
    X,
    FileSpreadsheet,
    ArrowLeft
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

const BulkStudentUpload: React.FC = () => {
    const navigate = useNavigate();
    const { currentSchool } = useSchool();
    const { data: allSettings } = useFirestore<any>('settings');
    const { data: existingStudents } = useFirestore<any>('students');

    const activeClasses = sortClasses(allSettings?.filter((d: any) => d.type === 'class' && d.active !== false) || []);

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

        if (!selectedClass || !selectedSection) {
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
            const validationResult = validateStudentData(data);
            setValidation(validationResult);

            if (validationResult.isValid || validationResult.validCount > 0) {
                // Convert to student objects
                const students = convertToStudents(data, selectedClass, selectedSection, currentSchool?.id || '');
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

        if (!validation?.isValid) {
            const confirm = window.confirm(
                `There are ${validation?.errors.length} errors. Do you want to upload only the valid ${validation?.validCount} students?`
            );
            if (!confirm) return;
        }

        setIsProcessing(true);
        setUploadProgress({ current: 0, total: parsedStudents.length });

        try {
            const studentsRef = collection(db, 'students');
            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < parsedStudents.length; i++) {
                const student = parsedStudents[i];

                try {
                    // Check for duplicates in existing students
                    const schoolStudents = existingStudents?.filter(s => s.schoolId === currentSchool.id) || [];
                    const duplicate = schoolStudents.find(s =>
                        s.rollNo === student.rollNo &&
                        s.class === student.class &&
                        s.section === student.section &&
                        s.name.toLowerCase() === student.name.toLowerCase()
                    );

                    if (duplicate) {
                        console.log(`Skipping duplicate: ${student.name} (Roll: ${student.rollNo})`);
                        errorCount++;
                    } else {
                        await addDoc(studentsRef, {
                            ...student,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        });
                        successCount++;
                    }
                } catch (error) {
                    console.error(`Error uploading student ${student.name}:`, error);
                    errorCount++;
                }

                setUploadProgress({ current: i + 1, total: parsedStudents.length });
            }

            setUploadComplete(true);
            alert(`Upload complete!\nSuccess: ${successCount}\nSkipped/Failed: ${errorCount}`);
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

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <button
                        onClick={() => navigate('/admin/students')}
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
                    className="btn"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        padding: '0.75rem 1.5rem',
                        fontWeight: 600
                    }}
                >
                    <Download size={18} />
                    Download Template
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

            {/* Class Selection */}
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

            {/* Section Selection */}
            {selectedClass && (
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
            {selectedClass && selectedSection && (
                <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileSpreadsheet size={20} />
                        Step 3: Upload Excel File
                    </h3>
                    <div
                        style={{
                            border: '2px dashed var(--primary)',
                            borderRadius: '0.5rem',
                            padding: '3rem',
                            textAlign: 'center',
                            background: 'rgba(99, 102, 241, 0.05)',
                            cursor: 'pointer'
                        }}
                        onClick={() => document.getElementById('file-input')?.click()}
                    >
                        <Upload size={48} style={{ margin: '0 auto 1rem', color: 'var(--primary)' }} />
                        <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                            {selectedFile ? selectedFile.name : 'Click to upload Excel file'}
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Supports .xlsx, .xls files
                        </p>
                        <input
                            id="file-input"
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                        />
                    </div>
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

            {/* Preview Table */}
            {showPreview && parsedStudents.length > 0 && (
                <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Preview ({parsedStudents.length} students)</h3>
                    <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 1 }}>
                                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Class</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Section</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Roll No.</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>GR. No</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Student Name</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Father Phone</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Mobile No</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>UID Number</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Father UID</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Mother UID</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>PEN</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parsedStudents.slice(0, 50).map((student: any, index: number) => (
                                    <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '0.75rem' }}>{student.class}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.section}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.rollNo}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.grNo || '-'}</td>
                                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>{student.name}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.fatherContactNo || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.mobileNo || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.aadharNo || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.fatherAadharNo || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.motherAadharNo || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{student.studentPenNo || '-'}</td>
                                    </tr>
                                ))}
                                {parsedStudents.length > 50 && (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
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
                            onClick={() => navigate('/admin/students')}
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
