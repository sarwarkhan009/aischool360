import React, { useState, useEffect } from 'react';
import {
    Upload,
    Download,
    BookOpen,
    CheckCircle,
    AlertCircle,
    X,
    FileSpreadsheet,
    ArrowLeft,
    Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSchool } from '../../context/SchoolContext';
import { useAuth } from '../../context/AuthContext';
import { useFirestore } from '../../hooks/useFirestore';
import { sortClasses } from '../../constants/app';
import {
    parseExcelFile,
    validateMarksData,
    convertToMarksData,
    findMatchingStudent,
    isGradeOnlySubject,
    isComputerSubject,
} from '../../utils/excelUtils';
import type {
    MarksExcelRow,
    ParsedMarks,
    ValidationResult
} from '../../utils/excelTypes';
import { collection, addDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import * as XLSX from 'xlsx';

interface StudentMarks {
    studentId: string;
    studentName: string;
    rollNumber: string;
    class: string;
    theoryMarks?: number;
    practicalMarks?: number;
    totalMarks: number;
    obtainedMarks: number;
    percentage: number;
    grade: string;
    remarks?: string;
    isAbsent: boolean;
    isNA?: boolean;
}

const BulkMarksUpload: React.FC = () => {
    const navigate = useNavigate();
    const { currentSchool } = useSchool();
    const { user } = useAuth();
    const { data: allSettings } = useFirestore<any>('settings');
    const { data: exams } = useFirestore<any>('exams');
    const { data: students } = useFirestore<any>('students');

    const activeClasses = sortClasses(allSettings?.filter((d: any) => d.type === 'class' && d.active !== false) || []);
    const schoolExams = exams?.filter(e => e.schoolId === currentSchool?.id) || [];

    const [selectedExam, setSelectedExam] = useState<string>('');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedSection, setSelectedSection] = useState<string>('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [excelData, setExcelData] = useState<MarksExcelRow[]>([]);
    const [parsedMarks, setParsedMarks] = useState<ParsedMarks[]>([]);
    const [validation, setValidation] = useState<ValidationResult | null>(null);
    const [matchedStudents, setMatchedStudents] = useState<Map<string, any>>(new Map());
    const [unmatchedStudents, setUnmatchedStudents] = useState<string[]>([]);
    const [subjectList, setSubjectList] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
    const [showPreview, setShowPreview] = useState(false);
    const [uploadComplete, setUploadComplete] = useState(false);

    const selectedExamData = schoolExams.find(e => e.id === selectedExam);
    const selectedClassObj = activeClasses.find((c: any) => c.id === selectedClass || c.name === selectedClass);
    const sectionsList = selectedClassObj?.sections || [];

    // Enhanced student matching to support both "Class 3" and "STD III" formats
    const classStudents = students?.filter((s: any) => {
        if (s.schoolId !== currentSchool?.id || s.status !== 'ACTIVE') return false;

        // Match class
        const studentClass = s.class || '';
        const selectedClassName = selectedClassObj?.name || selectedClass || '';
        const classMatch = studentClass === selectedClass ||
            studentClass === selectedClassName ||
            studentClass === `STD ${selectedClassName}` ||
            studentClass.replace('STD ', '') === selectedClassName.replace('Class ', '') ||
            studentClass.replace('Class ', '') === selectedClassName.replace('STD ', '');

        if (!classMatch) return false;

        // Match section if selected
        if (selectedSection && s.section !== selectedSection) return false;

        return true;
    }) || [];

    const handleExamSelect = (examId: string) => {
        setSelectedExam(examId);
        setSelectedClass('');
        resetUploadState();
    };

    const handleClassSelect = (classId: string) => {
        setSelectedClass(classId);
        setSelectedSection('');
        resetUploadState();
    };

    const resetUploadState = () => {
        setSelectedFile(null);
        setExcelData([]);
        setParsedMarks([]);
        setValidation(null);
        setMatchedStudents(new Map());
        setUnmatchedStudents([]);
        setSubjectList([]);
        setShowPreview(false);
        setUploadComplete(false);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!selectedExam || !selectedClass) {
            alert('Please select exam and class first');
            return;
        }

        setSelectedFile(file);
        setIsProcessing(true);

        try {
            // Parse Excel
            const data = await parseExcelFile(file);
            setExcelData(data);

            // Validate
            const validationResult = validateMarksData(data, classStudents);
            setValidation(validationResult);

            // Convert to marks data
            const marks = convertToMarksData(data);
            setParsedMarks(marks);

            // Extract subject list by matching Excel columns to Scheduled Exam Subjects
            if (data.length > 0 && selectedExamData?.subjects) {
                const excelKeys = Object.keys(data[0]);
                const examSubjects = selectedExamData.subjects;

                const activeSubjects = excelKeys.filter(key => {
                    const upKey = key.toUpperCase().trim();
                    const cleanUpKey = upKey.replace(/[\s./-]/g, '');

                    return examSubjects.some((s: any) => {
                        const sName = (s.subjectName || s.name).toUpperCase().trim();
                        const cleanSName = sName.replace(/[\s./-]/g, '');

                        // Handle Combined Subjects fuzzy matching
                        const combinedList = (s.combinedSubjects || []).map((c: string) => c.toUpperCase().trim().replace(/[\s./-]/g, ''));

                        // Check exact match first
                        if (cleanSName === cleanUpKey) return true;

                        // Check if Excel header is a substring of the schedule name or vice-versa
                        const isMainMatch = cleanSName.includes(cleanUpKey) || cleanUpKey.includes(cleanSName);
                        const isCombinedMatch = combinedList.some((c: string) => c.includes(cleanUpKey) || cleanUpKey.includes(c));

                        // Special abbreviations
                        const isAbbrevMatch = (cleanUpKey.includes('URDU') && cleanSName.includes('URDU')) ||
                            (cleanUpKey.includes('SANS') && cleanSName.includes('SANS')) ||
                            (cleanUpKey.includes('DEEN') && cleanSName.includes('DEEN')) ||
                            (cleanUpKey.includes('CONV') && cleanSName.includes('CONV')) ||
                            (cleanUpKey.includes('COMP') && cleanSName.includes('COMP'));

                        return isMainMatch || isCombinedMatch || isAbbrevMatch;
                    });
                });

                setSubjectList(activeSubjects);
            }

            // Match students
            const matched = new Map<string, any>();
            const unmatched: string[] = [];

            marks.forEach(mark => {
                const student = findMatchingStudent(mark.studentName, mark.rollNumber, classStudents);
                if (student) {
                    matched.set(mark.rollNumber, student);
                } else {
                    unmatched.push(`${mark.studentName} (Roll: ${mark.rollNumber})`);
                }
            });

            setMatchedStudents(matched);
            setUnmatchedStudents(unmatched);
            setShowPreview(true);
        } catch (error) {
            console.error('Error parsing Excel:', error);
            alert('Failed to parse Excel file. Please check the format.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpload = async () => {
        if (!currentSchool || !selectedExamData) {
            alert('Missing required data');
            return;
        }

        if (unmatchedStudents.length > 0) {
            const confirm = window.confirm(
                `${unmatchedStudents.length} students could not be matched. Continue uploading for ${matchedStudents.size} matched students?`
            );
            if (!confirm) return;
        }

        setIsProcessing(true);
        setUploadProgress({ current: 0, total: subjectList.length });

        try {
            const marksEntriesRef = collection(db, 'marks_entries');
            let successCount = 0;

            // Upload marks for each subject
            for (const subjectName of subjectList) {
                try {
                    // Get subject configuration from exam schedule BEFORE processing marks
                    const upSubjectName = subjectName.toUpperCase().trim();
                    const cleanUpSubjectName = upSubjectName.replace(/[\s.]/g, '');

                    const subjectConfig = selectedExamData.subjects?.find((s: any) => {
                        const sName = (s.subjectName || s.name).toUpperCase().trim();
                        const cleanSName = sName.replace(/[\s./-]/g, '');
                        const combinedList = (s.combinedSubjects || []).map((c: string) => c.toUpperCase().trim().replace(/[\s./-]/g, ''));

                        // Check exact match first
                        if (cleanSName === cleanUpSubjectName) return true;

                        // Check if Excel header is a substring of the schedule name or vice-versa
                        const isMainMatch = cleanSName.includes(cleanUpSubjectName) || cleanUpSubjectName.includes(cleanSName);

                        // Check combined subjects
                        const isCombinedMatch = combinedList.some((c: string) => c.includes(cleanUpSubjectName) || cleanUpSubjectName.includes(c));

                        // Special common school abbreviations
                        const isAbbrevMatch = (cleanUpSubjectName.includes('URDU') && cleanSName.includes('URDU')) ||
                            (cleanUpSubjectName.includes('SANS') && cleanSName.includes('SANS')) ||
                            (cleanUpSubjectName.includes('DEEN') && cleanSName.includes('DEEN')) ||
                            (cleanUpSubjectName.includes('CONV') && cleanSName.includes('CONV')) ||
                            (cleanUpSubjectName.includes('COMP') && cleanSName.includes('COMP'));

                        return isMainMatch || isCombinedMatch || isAbbrevMatch;
                    });

                    if (!subjectConfig) {
                        console.warn(`Subject config not found for: ${subjectName}`);
                        continue;
                    }

                    const isGradeOnly = subjectConfig.assessmentType === 'GRADE';
                    const maxMarks = (subjectConfig.theoryMarks || 0) + (subjectConfig.practicalMarks || 0) || 100;

                    // Prepare marks data for this subject
                    const subjectMarks: StudentMarks[] = [];

                    parsedMarks.forEach(mark => {
                        const student = matchedStudents.get(mark.rollNumber);
                        if (!student) return; // Skip unmatched

                        const subjectData = mark.subjects[subjectName];
                        if (!subjectData) return;

                        let obtainedMarks = 0;
                        let theoryMarks: number | undefined;
                        let practicalMarks: number | undefined;
                        let grade = '';
                        let isAbsent = false;
                        let isNA = false;

                        if (isGradeOnly) {
                            grade = subjectData.grade || '';
                            obtainedMarks = 0;
                            isAbsent = subjectData.isAbsent || false;
                            isNA = subjectData.isNA || false;
                        } else {
                            // Use the isAbsent/isNA flag from parsed data
                            isAbsent = subjectData.isAbsent || false;
                            isNA = subjectData.isNA || false;

                            if (isAbsent || isNA) {
                                theoryMarks = 0;
                                practicalMarks = 0;
                                obtainedMarks = 0;
                            } else {
                                theoryMarks = subjectData.theoryMarks || 0;
                                practicalMarks = subjectData.practicalMarks || 0;
                                obtainedMarks = theoryMarks + practicalMarks;
                            }
                            grade = '';
                        }

                        const percentage = maxMarks > 0 ? (obtainedMarks / maxMarks) * 100 : 0;

                        subjectMarks.push({
                            studentId: student.id,
                            studentName: student.name,
                            rollNumber: student.rollNo || student.classRollNo,
                            class: selectedClass,
                            theoryMarks: theoryMarks || 0,
                            practicalMarks: practicalMarks || 0,
                            totalMarks: maxMarks,
                            obtainedMarks,
                            percentage,
                            grade: isGradeOnly ? grade : '',
                            isAbsent: isAbsent,
                            isNA: isNA
                        });
                    });

                    if (subjectMarks.length === 0) continue;

                    // Check if marks entry already exists for this section/class
                    const existingQuery = query(
                        marksEntriesRef,
                        where('schoolId', '==', currentSchool.id),
                        where('examId', '==', selectedExam),
                        where('classId', '==', selectedClass),
                        where('sectionId', '==', selectedSection || ''),
                        where('subjectId', '==', subjectConfig.subjectId)
                    );

                    const existingDocs = await getDocs(existingQuery);
                    if (!existingDocs.empty) {
                        for (const doc of existingDocs.docs) {
                            await deleteDoc(doc.ref);
                        }
                        console.log(`Updating existing marks for ${subjectConfig.subjectName}...`);
                    }

                    // Create marks entry document
                    await addDoc(marksEntriesRef, {
                        schoolId: currentSchool.id,
                        academicYearId: selectedExamData.academicYearId || '',
                        examId: selectedExam,
                        examName: selectedExamData.name,
                        subjectId: subjectConfig.subjectId,
                        subjectName: subjectConfig.subjectName,
                        classId: selectedClass,
                        className: activeClasses.find(c => c.id === selectedClass)?.name || selectedClass,
                        sectionId: selectedSection || '',
                        sectionName: selectedSection || '',
                        maxMarks: maxMarks,
                        marks: subjectMarks,
                        enteredBy: user?.id || user?.username || '',
                        enteredByRole: user?.role || '',
                        entryDate: new Date().toISOString(),
                        status: 'SUBMITTED', // Set to SUBMITTED so it appears in results
                        isLocked: false,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });

                    successCount++;
                } catch (error) {
                    console.error(`Error uploading marks for ${subjectName}:`, error);
                }

                setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
            }

            setUploadComplete(true);
            alert(`Upload complete!\nSuccessfully uploaded marks for ${successCount} subjects.`);
        } catch (error) {
            console.error('Error during bulk marks upload:', error);
            alert('An error occurred during upload. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const calculateGrade = (percentage: number): string => {
        if (percentage >= 91) return 'A+';
        if (percentage >= 81) return 'A';
        if (percentage >= 71) return 'B+';
        if (percentage >= 61) return 'B';
        if (percentage >= 51) return 'C';
        if (percentage >= 41) return 'D';
        if (percentage >= 33) return 'E';
        return 'F';
    };

    const handleDownloadTemplate = () => {
        if (!selectedExamData || !selectedClass) {
            alert('Please select exam and class first');
            return;
        }

        // Get subjects for this exam
        const examSubjects = selectedExamData.subjects || [];

        // Create template rows with actual students or sample data
        const templateData = [];

        if (classStudents.length > 0) {
            // Use actual students
            classStudents.forEach((student: any, index: number) => {
                const row: any = {
                    'ROLL': student.rollNo || student.classRollNo || '',
                    'STUDENT NAME': student.name
                };

                // Add single column for each subject
                examSubjects.forEach((subject: any) => {
                    const sName = (subject.subjectName || subject.name).toUpperCase();
                    const combinedNames = subject.combinedSubjects && subject.combinedSubjects.length > 0
                        ? ` / ${subject.combinedSubjects.join(' / ')}`.toUpperCase()
                        : '';
                    const subjectName = (sName + combinedNames).trim();
                    row[subjectName] = '';
                });

                row['TOTAL %'] = '';
                row['RESULT'] = '';

                templateData.push(row);
            });
        } else {
            // Create sample data if no students
            for (let i = 1; i <= 2; i++) {
                const row: any = {
                    'ROLL': i.toString(),
                    'STUDENT NAME': `Sample Student ${i}`
                };

                examSubjects.forEach((subject: any) => {
                    const sName = (subject.subjectName || subject.name).toUpperCase();
                    const combinedNames = subject.combinedSubjects && subject.combinedSubjects.length > 0
                        ? ` / ${subject.combinedSubjects.join(' / ')}`.toUpperCase()
                        : '';
                    const subjectName = (sName + combinedNames).trim();

                    if (subject.assessmentType === 'GRADE') {
                        row[subjectName] = 'A';
                    } else if (subject.theoryMarks > 0 && subject.practicalMarks > 0) {
                        row[subjectName] = `${Math.floor(subject.theoryMarks * 0.8)} ${Math.floor(subject.practicalMarks * 0.8)} A`;
                    } else {
                        row[subjectName] = '80 20 A';
                    }
                });

                row['TOTAL %'] = '90.00';
                row['RESULT'] = 'Pass';

                templateData.push(row);
            }
        }

        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Marks Template");

        const className = activeClasses.find(c => c.id === selectedClass)?.name || selectedClass;
        const examName = selectedExamData.name || 'Exam';
        XLSX.writeFile(wb, `${className}_${examName}_Marks_Template.xlsx`);
    };

    const resetForm = () => {
        setSelectedExam('');
        setSelectedClass('');
        resetUploadState();
    };

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <button
                        onClick={() => navigate('/admin/exams/marks-entry')}
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
                        Back to Marks Entry
                    </button>
                    <h1 className="page-title">📊 Bulk Marks Upload</h1>
                    <p className="page-subtitle">Upload exam marks from Excel file</p>
                </div>
            </div>

            {/* School Info */}
            {currentSchool && (
                <div className="card" style={{ padding: '1rem', marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(79, 70, 229, 0.1) 100%)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                    <p style={{ margin: 0, color: 'var(--text-main)', fontWeight: 600 }}>
                        📚 Uploading for: <span style={{ color: 'var(--primary)' }}>{currentSchool.name}</span>
                    </p>
                </div>
            )}

            {/* Exam Selection */}
            <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BookOpen size={20} />
                    Step 1: Select Exam/Term
                </h3>
                <select
                    className="input-field"
                    value={selectedExam}
                    onChange={(e) => handleExamSelect(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                >
                    <option value="">Choose Exam</option>
                    {schoolExams.map(exam => (
                        <option key={exam.id} value={exam.id}>
                            {exam.name} ({exam.term || 'No Term'})
                        </option>
                    ))}
                </select>
            </div>

            {/* Class Selection */}
            {selectedExam && (
                <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Users size={20} />
                        Step 2: Select Class
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem' }}>
                        {activeClasses.map((cls: any) => (
                            <button
                                key={cls.id}
                                onClick={() => handleClassSelect(cls.id)}
                                className="btn"
                                style={{
                                    padding: '1rem',
                                    background: selectedClass === cls.id ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'white',
                                    color: selectedClass === cls.id ? 'white' : 'var(--text-main)',
                                    border: selectedClass === cls.id ? 'none' : '2px solid var(--border)',
                                    borderRadius: '0.5rem',
                                    fontWeight: 600
                                }}
                            >
                                {cls.name}
                            </button>
                        ))}
                    </div>
                    {selectedClass && (
                        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
                            📝 {classStudents.length} students found in {activeClasses.find(c => c.id === selectedClass)?.name}
                        </p>
                    )}
                </div>
            )}

            {/* Section Selection */}
            {selectedClass && sectionsList.length > 0 && (
                <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Users size={20} />
                        Step 2.5: Select Section (Optional)
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.75rem' }}>
                        <button
                            onClick={() => setSelectedSection('')}
                            className="btn"
                            style={{
                                padding: '0.75rem',
                                background: selectedSection === '' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'white',
                                color: selectedSection === '' ? 'white' : 'var(--text-main)',
                                border: selectedSection === '' ? 'none' : '2px solid var(--border)',
                                borderRadius: '0.5rem',
                                fontWeight: 600
                            }}
                        >
                            All
                        </button>
                        {sectionsList.map((sec: string) => (
                            <button
                                key={sec}
                                onClick={() => setSelectedSection(sec)}
                                className="btn"
                                style={{
                                    padding: '0.75rem',
                                    background: selectedSection === sec ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'white',
                                    color: selectedSection === sec ? 'white' : 'var(--text-main)',
                                    border: selectedSection === sec ? 'none' : '2px solid var(--border)',
                                    borderRadius: '0.5rem',
                                    fontWeight: 600
                                }}
                            >
                                {sec}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Download Template Button */}
            {selectedClass && (
                <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)' }}>
                    <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Download size={20} />
                        Download Template
                    </h3>
                    <button
                        onClick={handleDownloadTemplate}
                        className="btn"
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Download size={18} />
                        Download Excel Template
                    </button>
                    <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Format: Roll | Name | Subject1 (Written) | Subject1 (Oral) | Subject2 (Theory) | Subject2 (Practical) | ...
                    </p>
                </div>
            )}

            {/* File Upload */}
            {selectedClass && (
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
                        onClick={() => document.getElementById('marks-file-input')?.click()}
                    >
                        <Upload size={48} style={{ margin: '0 auto 1rem', color: 'var(--primary)' }} />
                        <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                            {selectedFile ? selectedFile.name : 'Click to upload marks Excel file'}
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Format: Roll, Name, Subjects, Total %, Result
                        </p>
                        <input
                            id="marks-file-input"
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
                                <span style={{ fontWeight: 600 }}>Matched Students</span>
                            </div>
                            <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0, color: '#10b981' }}>
                                {matchedStudents.size}
                            </p>
                        </div>

                        {unmatchedStudents.length > 0 && (
                            <div style={{ padding: '1rem', background: '#f59e0b10', borderRadius: '0.5rem', border: '1px solid #f59e0b' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <AlertCircle size={20} style={{ color: '#f59e0b' }} />
                                    <span style={{ fontWeight: 600 }}>Unmatched</span>
                                </div>
                                <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0, color: '#f59e0b' }}>
                                    {unmatchedStudents.length}
                                </p>
                            </div>
                        )}

                        <div style={{ padding: '1rem', background: '#6366f110', borderRadius: '0.5rem', border: '1px solid #6366f1' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <BookOpen size={20} style={{ color: '#6366f1' }} />
                                <span style={{ fontWeight: 600 }}>Subjects</span>
                            </div>
                            <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0, color: '#6366f1' }}>
                                {subjectList.length}
                            </p>
                        </div>
                    </div>

                    {unmatchedStudents.length > 0 && (
                        <div>
                            <h4 style={{ color: '#f59e0b', marginBottom: '0.5rem' }}>⚠️ Unmatched Students:</h4>
                            <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--text-main)' }}>
                                {unmatchedStudents.slice(0, 10).map((student, i) => (
                                    <li key={i} style={{ marginBottom: '0.25rem' }}>{student}</li>
                                ))}
                                {unmatchedStudents.length > 10 && (
                                    <li style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                        ... and {unmatchedStudents.length - 10} more
                                    </li>
                                )}
                            </ul>
                            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                💡 Tip: Ensure these students are uploaded in student data first
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Subject preview */}
            {showPreview && subjectList.length > 0 && (
                <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Detected Subjects ({subjectList.length})</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {subjectList.map((subject, index) => {
                            const upSubjectName = subject.toUpperCase().trim();
                            const cleanUpSubjectName = upSubjectName.replace(/[\s.]/g, '');

                            const subConfig = selectedExamData?.subjects?.find((s: any) => {
                                const sName = (s.subjectName || s.name).toUpperCase().trim();
                                const cleanSName = sName.replace(/[\s.]/g, '');

                                const combinedNames = s.combinedSubjects && s.combinedSubjects.length > 0
                                    ? ` / ${s.combinedSubjects.join(' / ')}`.toUpperCase()
                                    : '';
                                const fullSName = (sName + combinedNames).trim();
                                const cleanFullSName = fullSName.replace(/[\s.]/g, '');

                                return cleanSName === cleanUpSubjectName ||
                                    cleanFullSName === cleanUpSubjectName ||
                                    cleanUpSubjectName.startsWith(cleanSName + '/');
                            });
                            const isGradeOnly = subConfig?.assessmentType === 'GRADE';
                            const hasSplit = (subConfig?.theoryMarks > 0 && subConfig?.practicalMarks > 0);

                            return (
                                <span
                                    key={index}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        background: isGradeOnly ? '#f59e0b15' : '#6366f115',
                                        color: isGradeOnly ? '#f59e0b' : '#6366f1',
                                        borderRadius: '0.5rem',
                                        border: '1px solid currentColor',
                                        fontWeight: 600,
                                        fontSize: '0.875rem'
                                    }}
                                >
                                    {subject}
                                    {isGradeOnly ? ' (Grade)' : (hasSplit ? ' (Theory+Practical)' : ' (Marks)')}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Data Preview Table */}
            {showPreview && parsedMarks.length > 0 && (
                <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem', overflowX: 'auto' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Marks Preview (First 10 Students)</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                                <th style={{ padding: '0.75rem' }}>Status</th>
                                <th style={{ padding: '0.75rem' }}>ROLL</th>
                                <th style={{ padding: '0.75rem' }}>STUDENT NAME</th>
                                {subjectList.slice(0, 4).map(sub => (
                                    <th key={sub} style={{ padding: '0.75rem' }}>{sub}</th>
                                ))}
                                {subjectList.length > 4 && <th style={{ padding: '0.75rem' }}>...</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {parsedMarks.slice(0, 10).map((mark, i) => {
                                const isMatched = matchedStudents.has(mark.rollNumber);
                                return (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent' }}>
                                        <td style={{ padding: '0.75rem' }}>
                                            {isMatched ?
                                                <span style={{ color: '#10b981', fontWeight: 600 }}>✅</span> :
                                                <span style={{ color: '#ef4444', fontWeight: 600 }}>❌</span>
                                            }
                                        </td>
                                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>{mark.rollNumber}</td>
                                        <td style={{ padding: '0.75rem' }}>{mark.studentName}</td>
                                        {subjectList.slice(0, 4).map(sub => {
                                            const upSub = sub.toUpperCase().trim();
                                            const cleanUpSub = upSub.replace(/[\s.]/g, '');

                                            const subConfig = selectedExamData?.subjects?.find((s: any) => {
                                                const sName = (s.subjectName || s.name).toUpperCase().trim();
                                                const cleanSName = sName.replace(/[\s.]/g, '');

                                                const combinedNames = s.combinedSubjects && s.combinedSubjects.length > 0
                                                    ? ` / ${s.combinedSubjects.join(' / ')}`.toUpperCase()
                                                    : '';
                                                const fullSName = (sName + combinedNames).trim();
                                                const cleanFullSName = fullSName.replace(/[\s.]/g, '');

                                                return cleanSName === cleanUpSub ||
                                                    cleanFullSName === cleanUpSub ||
                                                    cleanUpSub.startsWith(cleanSName + '/');
                                            });

                                            const subData = mark.subjects[sub];
                                            if (!subData) return <td key={sub} style={{ padding: '0.75rem', color: '#ccc' }}>-</td>;

                                            if (subConfig?.assessmentType === 'GRADE') {
                                                return <td key={sub} style={{ padding: '0.75rem' }}>{subData.grade || '-'}</td>;
                                            }

                                            return (
                                                <td key={sub} style={{ padding: '0.75rem' }}>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        {subData.theoryMarks} + {subData.practicalMarks}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        {subjectList.length > 4 && <td style={{ padding: '0.75rem' }}>...</td>}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {parsedMarks.length > 10 && (
                        <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                            ... and {parsedMarks.length - 10} more students
                        </p>
                    )}
                </div>
            )}
            {isProcessing && uploadProgress.total > 0 && (
                <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Uploading Marks...</h3>
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
                            {uploadProgress.current} / {uploadProgress.total} subjects
                        </div>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            {showPreview && !uploadComplete && matchedStudents.size > 0 && (
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
                        disabled={isProcessing}
                    >
                        <Upload size={18} />
                        {isProcessing ? 'Uploading...' : `Upload Marks for ${subjectList.length} Subjects`}
                    </button>
                </div>
            )}

            {/* Success Message */}
            {uploadComplete && (
                <div className="card" style={{ padding: '2rem', textAlign: 'center', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)', border: '1px solid #10b981' }}>
                    <CheckCircle size={64} style={{ color: '#10b981', margin: '0 auto 1rem' }} />
                    <h2 style={{ color: '#10b981', marginBottom: '0.5rem' }}>Upload Complete!</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                        Marks have been successfully uploaded. Please review and approve them in Marks Entry.
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
                            onClick={() => navigate('/admin/exams/marks-entry')}
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
                            Go to Marks Entry
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BulkMarksUpload;


