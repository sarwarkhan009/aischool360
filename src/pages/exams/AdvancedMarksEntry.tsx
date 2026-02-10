import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
    BookOpen,
    Users,
    Save,
    Check,
    X,
    Upload,
    Download,
    Filter,
    Search,
    Lock,
    Unlock,
    AlertCircle,
    CheckCircle,
    Clock,
    Edit2,
    Book
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { sortClasses } from '../../constants/app';
import { useSchool } from '../../context/SchoolContext';
import { useAuth } from '../../context/AuthContext';
import * as XLSX from 'xlsx';

interface StudentMarks {
    studentId: string;
    admissionNo?: string;
    studentName: string;
    rollNumber: string;
    class: string;
    theoryMarks?: number;
    practicalMarks?: number;
    internalMarks?: number;
    externalMarks?: number;
    totalMarks: number;
    obtainedMarks: number | string;
    percentage: number;
    grade: string;
    remarks?: string;
    isAbsent: boolean;
    isNA?: boolean;
}

interface MarksEntry {
    id: string;
    schoolId: string;
    examId: string;
    examName: string;
    subjectId: string;
    subjectName: string;
    classId: string;
    className: string;
    sectionId?: string;
    sectionName?: string;
    maxMarks: number;
    marks: StudentMarks[];
    enteredBy: string;
    enteredByRole: string;
    entryDate: string;
    status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    approvedBy?: string;
    approvalDate?: string;
    rejectionReason?: string;
    isLocked: boolean;
    createdAt: string;
    updatedAt: string;
}

const AdvancedMarksEntry: React.FC = () => {
    const { currentSchool } = useSchool();
    const { user } = useAuth();
    const location = useLocation();
    const preSelectionData = location.state as any;
    const { data: marksEntries, add: addDocument, update } = useFirestore<MarksEntry>('marks_entries');
    const { data: exams } = useFirestore<any>('exams');
    const { data: students } = useFirestore<any>('students');
    const { data: gradingSystems } = useFirestore<any>('grading_systems');
    const { data: allSettings } = useFirestore<any>('settings');

    const activeClasses = sortClasses(allSettings?.filter((d: any) => d.type === 'class' && d.active !== false) || []);

    const [selectedExam, setSelectedExam] = useState<string>('');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedSection, setSelectedSection] = useState<string>('');
    const [importPreview, setImportPreview] = useState<{
        matches: any[];
        errors: string[];
        show: boolean;
    }>({ matches: [], errors: [], show: false });

    // Handle pre-selection from navigation state
    useEffect(() => {
        if (preSelectionData) {
            if (preSelectionData.preSelectedExam) setSelectedExam(preSelectionData.preSelectedExam);
            if (preSelectionData.preSelectedClass) setSelectedClass(preSelectionData.preSelectedClass);
            if (preSelectionData.preSelectedSection) setSelectedSection(preSelectionData.preSelectedSection);
        }
    }, [preSelectionData]);

    // Helper to get class name from ID/Slug
    const getClassName = (classId: string) => {
        if (!classId) return '';
        const cls = activeClasses.find((c: any) => c.id === classId || c.name === classId);
        return cls?.name || classId;
    };
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [marksData, setMarksData] = useState<StudentMarks[]>([]);
    const [filterQuery, setFilterQuery] = useState('');
    const [showBulkImport, setShowBulkImport] = useState(false);
    const [currentEntry, setCurrentEntry] = useState<MarksEntry | null>(null);

    const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
    const schoolExams = exams?.filter(e => e.schoolId === currentSchool?.id && e.status !== 'CANCELLED') || [];
    const defaultGrading = gradingSystems?.find((g: any) => g.schoolId === currentSchool?.id && g.isDefault);

    // Get selected exam details
    const examDetails = schoolExams.find(e => e.id === selectedExam);
    const availableClasses = examDetails?.targetClasses || [];
    const availableSubjects = examDetails?.subjects?.filter((s: any) =>
        selectedClass ? examDetails.targetClasses.includes(selectedClass) : true
    ) || [];

    // Get selected subject details
    const subjectDetails = availableSubjects.find((s: any) => s.subjectId === selectedSubject);

    // Load students for selected class
    const selectedClassObj = activeClasses.find((c: any) => c.id === selectedClass);
    const selectedClassName = selectedClassObj?.name;

    const classStudents = students?.filter((s: any) =>
        s.schoolId === currentSchool?.id &&
        (s.class === selectedClass || (selectedClassName && s.class === selectedClassName)) &&
        s.status === 'ACTIVE' &&
        (!selectedSection || s.section === selectedSection)
    ) || [];

    // Check if marks already exist for this combination
    useEffect(() => {
        if (selectedExam && selectedClass && selectedSubject) {
            const existing = marksEntries?.find(entry =>
                entry.examId === selectedExam &&
                entry.classId === selectedClass &&
                (!selectedSection || entry.sectionId === selectedSection || entry.sectionName === selectedSection) &&
                entry.subjectId === selectedSubject &&
                entry.schoolId === currentSchool?.id
            );

            if (existing) {
                setCurrentEntry(existing);
                // Recalculate grades for existing marks
                const updatedMarks = existing.marks.map((student: StudentMarks) => ({
                    ...student,
                    grade: student.isAbsent ? 'AB' :
                        student.isNA ? 'NA' :
                            calculateGrade(student.percentage)
                }));
                setMarksData(updatedMarks);
            } else {
                setCurrentEntry(null);
                initializeMarksData();
            }
        }
    }, [selectedExam, selectedClass, selectedSubject, marksEntries]);

    const initializeMarksData = () => {
        const subjectDetails = availableSubjects.find((s: any) => s.subjectId === selectedSubject);
        if (!subjectDetails || !classStudents.length) {
            setMarksData([]);
            return;
        }

        const initialized: StudentMarks[] = classStudents.map(student => ({
            studentId: student.id,
            admissionNo: student.admissionNo || student.id,
            studentName: student.name,
            rollNumber: student.classRollNo || student.rollNo || student.admissionNumber || '-',
            class: student.class,
            totalMarks: subjectDetails.maxMarks,
            obtainedMarks: 0,
            percentage: 0,
            grade: 'F',
            isAbsent: false,
            isNA: false
        }));

        setMarksData(initialized);
    };

    const calculateGrade = (percentage: number): string => {
        // Try to get exam-specific grading system first
        let gradingSystem = defaultGrading;

        if (examDetails?.gradingSystemId) {
            const examGrading = gradingSystems?.find((g: any) => g.id === examDetails.gradingSystemId);
            if (examGrading) {
                gradingSystem = examGrading;
            }
        }

        // Fallback to standard grading if no system is configured
        if (!gradingSystem?.ranges) {
            gradingSystem = {
                type: 'LETTER',
                name: 'Standard Grading (Fallback)',
                ranges: [
                    { grade: 'A+', min: 91, max: 100 },
                    { grade: 'A', min: 81, max: 90 },
                    { grade: 'B+', min: 71, max: 80 },
                    { grade: 'B', min: 61, max: 70 },
                    { grade: 'C', min: 51, max: 60 },
                    { grade: 'D', min: 41, max: 50 },
                    { grade: 'E', min: 33, max: 40 },
                    { grade: 'F', min: 0, max: 32 }
                ]
            };
        }

        if (!gradingSystem || !gradingSystem.ranges) {
            console.log('No grading system found');
            return 'N/A';
        }

        // Sort ranges in descending order of max value to check from highest first
        const sortedRanges = [...gradingSystem.ranges].sort((a: any, b: any) => {
            const maxA = typeof a.max === 'string' ? parseFloat(a.max) : a.max;
            const maxB = typeof b.max === 'string' ? parseFloat(b.max) : b.max;
            return maxB - maxA;
        });

        // Find matching range
        const range = sortedRanges.find((r: any) => {
            const min = typeof r.min === 'string' ? parseFloat(r.min) : r.min;
            const max = typeof r.max === 'string' ? parseFloat(r.max) : r.max;
            return percentage >= min && percentage <= max;
        });


        return range?.grade || 'F';
    };

    const handleMarksChange = (index: number, field: keyof StudentMarks, value: any) => {
        const updated = [...marksData];
        updated[index] = { ...updated[index], [field]: value };

        // Recalculate obtained marks and percentage
        if (field === 'obtainedMarks' || field === 'theoryMarks' || field === 'practicalMarks' || field === 'internalMarks' || field === 'externalMarks') {
            const obtained = field === 'obtainedMarks' ? value : (
                (updated[index].theoryMarks || 0) +
                (updated[index].practicalMarks || 0) +
                (updated[index].internalMarks || 0) +
                (updated[index].externalMarks || 0)
            );

            updated[index].obtainedMarks = obtained;
            updated[index].percentage = updated[index].totalMarks > 0
                ? (obtained / updated[index].totalMarks) * 100
                : 0;
            updated[index].grade = calculateGrade(updated[index].percentage);

            // Reset absent and NA status when marks are entered
            if (obtained > 0) {
                updated[index].isAbsent = false;
                updated[index].isNA = false;
            }
        }

        setMarksData(updated);
    };

    const handleNAToggle = (index: number) => {
        const updated = [...marksData];
        updated[index].isNA = !updated[index].isNA;

        if (updated[index].isNA) {
            updated[index].isAbsent = false;
            updated[index].theoryMarks = 0;
            updated[index].practicalMarks = 0;
            updated[index].internalMarks = 0;
            updated[index].externalMarks = 0;
            updated[index].obtainedMarks = 0;
            updated[index].percentage = 0;
            updated[index].grade = 'NA';
        }

        setMarksData(updated);
    };

    const handleAbsentToggle = (index: number) => {
        const updated = [...marksData];
        updated[index].isAbsent = !updated[index].isAbsent;

        if (updated[index].isAbsent) {
            updated[index].isNA = false;
            updated[index].theoryMarks = 0;
            updated[index].practicalMarks = 0;
            updated[index].internalMarks = 0;
            updated[index].externalMarks = 0;
            updated[index].obtainedMarks = 0;
            updated[index].percentage = 0;
            updated[index].grade = 'AB';
        }

        setMarksData(updated);
    };

    const handleSaveMarks = async (status: 'DRAFT' | 'SUBMITTED') => {
        if (!selectedExam || !selectedClass || !selectedSubject) {
            alert('Please select exam, class, and subject');
            return;
        }

        try {
            const subjectDetails = availableSubjects.find((s: any) => s.subjectId === selectedSubject);
            const exam = schoolExams.find(e => e.id === selectedExam);

            const entryData: Partial<MarksEntry> = {
                schoolId: currentSchool?.id,
                examId: selectedExam,
                examName: exam?.name || '',
                subjectId: selectedSubject,
                subjectName: subjectDetails?.subjectName || '',
                classId: selectedClass,
                className: getClassName(selectedClass),
                sectionId: selectedSection,
                sectionName: selectedSection,
                maxMarks: subjectDetails?.maxMarks || 100,
                marks: marksData,
                enteredBy: user?.id || user?.username || '',
                enteredByRole: user?.role || '',
                entryDate: new Date().toISOString(),
                status,
                isLocked: status === 'SUBMITTED',
                updatedAt: new Date().toISOString()
            };

            if (currentEntry) {
                await update(currentEntry.id, entryData);
            } else {
                await addDocument({
                    ...entryData,
                    createdAt: new Date().toISOString()
                } as MarksEntry);
            }

            alert(`Marks ${status === 'DRAFT' ? 'saved as draft' : 'submitted'} successfully!`);
        } catch (error) {
            console.error('Error saving marks:', error);
            alert('Failed to save marks');
        }
    };

    const handleApprove = async () => {
        if (!currentEntry || !isAdmin) {
            console.log('Cannot approve - currentEntry:', currentEntry, 'isAdmin:', isAdmin);
            return;
        }

        // Use user.id if available, otherwise fallback to username
        const approvedById = user?.id || user?.username;

        if (!approvedById) {
            alert('User information is missing. Please log in again.');
            return;
        }

        console.log('Attempting to approve marks for entry:', currentEntry.id);
        console.log('Approved by:', approvedById);

        try {
            await update(currentEntry.id, {
                status: 'APPROVED',
                approvedBy: approvedById,
                approvalDate: new Date().toISOString(),
                isLocked: true,
                updatedAt: new Date().toISOString()
            });
            console.log('Marks approved successfully!');
            alert('Marks approved successfully!');
        } catch (error: any) {
            console.error('Error approving marks:', error);
            console.error('Error message:', error?.message);
            console.error('Error code:', error?.code);
            alert(`Failed to approve marks: ${error?.message || 'Unknown error'}`);
        }
    };

    const handleReject = async () => {
        if (!currentEntry || !isAdmin) return;

        const reason = prompt('Enter rejection reason:');
        if (!reason) return;

        // Use user.id if available, otherwise fallback to username
        const rejectedById = user?.id || user?.username;

        try {
            await update(currentEntry.id, {
                status: 'REJECTED',
                rejectionReason: reason,
                isLocked: false,
                updatedAt: new Date().toISOString()
            });
            alert('Marks rejected');
        } catch (error) {
            console.error('Error rejecting marks:', error);
            alert('Failed to reject marks');
        }
    };

    const handleExportTemplate = () => {
        if (!marksData.length) return;

        const data = marksData.map(m => ({
            'Admission No': m.admissionNo || m.studentId,
            'Roll Number': m.rollNumber,
            'Student Name': m.studentName,
            'Obtained Marks': m.obtainedMarks,
            'Is Absent (Y/N)': m.isAbsent ? 'Y' : 'N'
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Marks Template");
        XLSX.writeFile(wb, `${selectedClass}_${selectedSubject}_Template.xlsx`);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data: any[] = XLSX.utils.sheet_to_json(ws);

            const subjectName = subjectDetails?.subjectName || '';
            const alternativeSubjectNames = [
                subjectName, subjectName.toUpperCase(), subjectName.toLowerCase(),
                subjectName.replace(/\s+/g, ''), subjectName.replace(/[^a-zA-Z0-9]/g, ''),
                subjectName.includes('Conversation') ? 'ENG. CONV.' : null,
                subjectName.includes('Urdu') ? 'URDU/DEEN.' : null,
                subjectName.includes('Mathematics') ? 'MATHS' : null,
                subjectName.includes('Environmental') ? 'E V S' : null,
                subjectName.includes('Knowledge') ? 'G. K.' : null
            ].filter(Boolean);

            const newMatches: any[] = [];
            const newErrors: string[] = [];

            data.forEach((row, rowIndex) => {
                const idFromRow = row['Admission No'] || row['Admission Number'] || row['Student ID'] || row['Student ID (DO NOT CHANGE)'];
                const rollFromRow = row['Roll Number'] || row['Roll No'] || row['Roll #'] || row['ROLL#'] || row['Roll#'];
                const nameFromRow = row['Student Name'] || row['Name'] || row['STUDENT NAME'] || row['StudentName'];

                let index = -1;
                if (idFromRow) {
                    const searchId = String(idFromRow).trim();
                    index = marksData.findIndex(m =>
                        (m.admissionNo && m.admissionNo.toString().trim() === searchId) || m.studentId === searchId
                    );
                }
                if (index === -1 && rollFromRow) {
                    const searchRoll = String(rollFromRow).trim().replace(/^#/, '');
                    index = marksData.findIndex(m => String(m.rollNumber || '').replace(/^#/, '').trim() === searchRoll);
                }
                if (index === -1 && nameFromRow) {
                    const searchName = String(nameFromRow).toLowerCase().trim();
                    index = marksData.findIndex(m =>
                        m.studentName.toLowerCase().trim() === searchName ||
                        m.studentName.toLowerCase().replace(/\s+/g, '') === searchName.replace(/\s+/g, '')
                    );
                }

                if (index !== -1) {
                    const student = marksData[index];
                    let rawMarks = row['Obtained Marks'] || row['Marks'];
                    if (rawMarks === undefined) {
                        for (const altName of alternativeSubjectNames) {
                            if (row[altName!] !== undefined) { rawMarks = row[altName!]; break; }
                        }
                    }

                    const isAbsent = row['Is Absent (Y/N)']?.toString().toUpperCase() === 'Y' ||
                        String(rawMarks).toUpperCase() === 'AB' ||
                        String(rawMarks).toUpperCase() === 'A';

                    let theory = 0, practical = 0, total = 0;
                    if (!isAbsent && rawMarks !== undefined) {
                        const parts = String(rawMarks).trim().match(/\d+(\.\d+)?/g);
                        if (parts && parts.length >= 2 && (student.theoryMarks !== undefined || student.practicalMarks !== undefined)) {
                            theory = parseFloat(parts[0]) || 0;
                            practical = parseFloat(parts[1]) || 0;
                            total = theory + practical;
                        } else if (parts && parts.length >= 1) {
                            total = Math.min(parseFloat(parts[0]) || 0, student.totalMarks);
                            if (student.theoryMarks !== undefined) theory = total;
                        }
                    }

                    newMatches.push({
                        index,
                        studentName: student.studentName,
                        admissionNo: student.admissionNo,
                        oldMarks: student.obtainedMarks,
                        newMarks: isAbsent ? 'ABSENT' : total,
                        theory,
                        practical,
                        isAbsent
                    });
                } else {
                    newErrors.push(`Row ${rowIndex + 2}: Student "${nameFromRow || idFromRow || 'Unknown'}" not found in current Section ${selectedSection || 'All'}.`);
                }
            });

            setImportPreview({ matches: newMatches, errors: newErrors, show: true });
            e.target.value = ''; // Reset input
        };
        reader.readAsBinaryString(file);
    };

    const confirmImport = () => {
        const updatedMarks = [...marksData];
        importPreview.matches.forEach(m => {
            const student = updatedMarks[m.index];
            student.obtainedMarks = m.isAbsent ? 0 : m.newMarks;
            student.theoryMarks = m.theory;
            student.practicalMarks = m.practical;
            student.isAbsent = m.isAbsent;
            student.percentage = student.totalMarks > 0 ? (Number(student.obtainedMarks) / student.totalMarks) * 100 : 0;
            student.grade = calculateGrade(student.percentage);
        });
        setMarksData(updatedMarks);
        setImportPreview({ matches: [], errors: [], show: false });
        alert(`Successfully imported ${importPreview.matches.length} marks!`);
    };

    const filteredMarks = marksData.filter(m =>
        m.studentName.toLowerCase().includes(filterQuery.toLowerCase()) ||
        m.rollNumber.toLowerCase().includes(filterQuery.toLowerCase())
    );

    const canEdit = !currentEntry ||
        currentEntry.status === 'DRAFT' ||
        (currentEntry.status === 'REJECTED' && currentEntry.enteredBy === user?.id) ||
        isAdmin;

    return (
        <div className="page-container">
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <h1 className="page-title">Marks Entry</h1>
                    <p className="page-subtitle">Enter and manage student marks for exams</p>
                </div>
                {currentEntry && (
                    <div style={{
                        display: 'flex',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                        justifyContent: 'flex-start'
                    }}>
                        {currentEntry.status === 'SUBMITTED' && isAdmin && (
                            <>
                                <button
                                    onClick={handleApprove}
                                    className="btn"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '0.5rem',
                                        padding: '0.6rem 1.2rem',
                                        fontWeight: 600,
                                        fontSize: '0.9rem',
                                        boxShadow: '0 4px 12px -2px rgba(16, 185, 129, 0.5)',
                                        transition: 'all 0.3s ease',
                                        cursor: 'pointer',
                                        flex: '1 1 auto',
                                        minWidth: 'fit-content',
                                        justifyContent: 'center'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 6px 16px -2px rgba(16, 185, 129, 0.6)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px -2px rgba(16, 185, 129, 0.5)';
                                    }}
                                >
                                    <CheckCircle size={18} />
                                    <span style={{ whiteSpace: 'nowrap' }}>Approve Marks</span>
                                </button>
                                <button
                                    onClick={handleReject}
                                    className="btn"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        background: 'white',
                                        color: '#ef4444',
                                        border: '2px solid #ef4444',
                                        borderRadius: '0.5rem',
                                        padding: '0.6rem 1.2rem',
                                        fontWeight: 600,
                                        fontSize: '0.9rem',
                                        transition: 'all 0.3s ease',
                                        cursor: 'pointer',
                                        flex: '1 1 auto',
                                        minWidth: 'fit-content',
                                        justifyContent: 'center'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#ef4444';
                                        e.currentTarget.style.color = 'white';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 6px 16px -2px rgba(239, 68, 68, 0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'white';
                                        e.currentTarget.style.color = '#ef4444';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <X size={18} />
                                    <span style={{ whiteSpace: 'nowrap' }}>Reject</span>
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Selection Panel */}
            <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                        <label>Select Exam *</label>
                        <select
                            className="input-field"
                            value={selectedExam}
                            onChange={(e) => {
                                setSelectedExam(e.target.value);
                                setSelectedClass('');
                                setSelectedSubject('');
                                setMarksData([]);
                            }}
                        >
                            <option value="">Choose Exam</option>
                            {schoolExams.map(exam => (
                                <option key={exam.id} value={exam.id}>
                                    {exam.name} ({exam.status})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Select Class *</label>
                        <select
                            className="input-field"
                            value={selectedClass}
                            onChange={(e) => {
                                setSelectedClass(e.target.value);
                                setSelectedSubject('');
                                setMarksData([]);
                            }}
                            disabled={!selectedExam}
                        >
                            <option value="">Choose Class</option>
                            {availableClasses.map((clsId: string) => (
                                <option key={clsId} value={clsId}>{getClassName(clsId)}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Select Section</label>
                        <select
                            className="input-field"
                            value={selectedSection}
                            onChange={(e) => setSelectedSection(e.target.value)}
                            disabled={!selectedClass}
                        >
                            <option value="">All Sections</option>
                            {activeClasses.find((c: any) => c.id === selectedClass || c.name === selectedClass)?.sections?.map((sec: string) => (
                                <option key={sec} value={sec}>{sec}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Select Subject *</label>
                        <select
                            className="input-field"
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            disabled={!selectedClass}
                        >
                            <option value="">Choose Subject</option>
                            {availableSubjects.map((subject: any) => {
                                const combinedNames = subject.combinedSubjects && subject.combinedSubjects.length > 0
                                    ? ` / ${subject.combinedSubjects.join(' / ')}`
                                    : '';
                                return (
                                    <option key={subject.subjectId} value={subject.subjectId}>
                                        {subject.subjectName}{combinedNames} (Max: {subject.maxMarks})
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                </div>

                {currentEntry && (
                    <div style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        background: currentEntry.status === 'APPROVED' ? '#10b98120' :
                            currentEntry.status === 'REJECTED' ? '#ef444420' :
                                currentEntry.status === 'SUBMITTED' ? '#3b82f620' : '#6b728020',
                        border: `1px solid ${currentEntry.status === 'APPROVED' ? '#10b981' :
                            currentEntry.status === 'REJECTED' ? '#ef4444' :
                                currentEntry.status === 'SUBMITTED' ? '#3b82f6' : '#6b7280'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                    }}>
                        {currentEntry.status === 'APPROVED' && <CheckCircle size={20} style={{ color: '#10b981' }} />}
                        {currentEntry.status === 'REJECTED' && <AlertCircle size={20} style={{ color: '#ef4444' }} />}
                        {currentEntry.status === 'SUBMITTED' && <Clock size={20} style={{ color: '#3b82f6' }} />}
                        {currentEntry.status === 'DRAFT' && <Edit2 size={20} style={{ color: '#6b7280' }} />}

                        <div style={{ flex: 1, fontSize: '0.875rem' }}>
                            <strong>Status:</strong> {currentEntry.status} •
                            <strong> Entered by:</strong> {currentEntry.enteredByRole} •
                            <strong> Date:</strong> {new Date(currentEntry.entryDate).toLocaleDateString()}

                            {currentEntry.status === 'REJECTED' && currentEntry.rejectionReason && (
                                <div style={{ marginTop: '0.25rem', color: '#ef4444' }}>
                                    <strong>Reason:</strong> {currentEntry.rejectionReason}
                                </div>
                            )}
                        </div>

                        {currentEntry.isLocked && <Lock size={18} />}
                    </div>
                )}
            </div>

            {/* Marks Entry Table */}
            {marksData.length > 0 && (
                <>
                    <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            marginBottom: '1rem'
                        }}>
                            <div style={{ position: 'relative', width: '100%' }}>
                                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Search students..."
                                    value={filterQuery}
                                    onChange={(e) => setFilterQuery(e.target.value)}
                                    style={{ paddingLeft: '2.75rem', width: '100%' }}
                                />
                            </div>
                            <div style={{
                                display: 'flex',
                                gap: '0.75rem',
                                flexWrap: 'wrap'
                            }}>
                                <button
                                    onClick={handleExportTemplate}
                                    className="btn"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        background: 'rgba(99, 102, 241, 0.1)',
                                        color: 'var(--primary)',
                                        border: '1px solid var(--primary)',
                                        borderRadius: '0.5rem',
                                        padding: '0.6rem 1rem',
                                        fontWeight: 600,
                                        transition: 'all 0.2s',
                                        flex: '1 1 auto',
                                        minWidth: 'fit-content',
                                        justifyContent: 'center'
                                    }}
                                    title="Download Excel Template"
                                >
                                    <Download size={18} />
                                    <span style={{ whiteSpace: 'nowrap' }}>Export Template</span>
                                </button>
                                <div style={{ position: 'relative', flex: '1 1 auto', minWidth: 'fit-content' }}>
                                    <button
                                        className="btn"
                                        onClick={() => document.getElementById('bulk-import')?.click()}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '0.5rem',
                                            padding: '0.6rem 1rem',
                                            fontWeight: 600,
                                            boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.4)',
                                            transition: 'all 0.2s',
                                            width: '100%',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <Upload size={18} />
                                        <span style={{ whiteSpace: 'nowrap' }}>Import Marks</span>
                                    </button>
                                    <input
                                        type="file"
                                        id="bulk-import"
                                        hidden
                                        accept=".xlsx,.xls,.csv"
                                        onChange={handleFileUpload}
                                        disabled={!canEdit}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Desktop Table View */}
                        <div style={{ overflowX: 'auto', display: 'block' }} className="desktop-only">
                            <style>{`
                                @media (max-width: 768px) {
                                    .desktop-only {
                                        display: none !important;
                                    }
                                    .mobile-only {
                                        display: block !important;
                                    }
                                }
                                @media (min-width: 769px) {
                                    .desktop-only {
                                        display: block !important;
                                    }
                                    .mobile-only {
                                        display: none !important;
                                    }
                                }
                            `}</style>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border)' }}>
                                        <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700 }}>Roll No.</th>
                                        <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700 }}>Student Name</th>
                                        <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>Total Marks</th>
                                        <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>Obtained</th>
                                        <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>%</th>
                                        <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>Grade</th>
                                        <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMarks.map((student, index) => {
                                        const actualIndex = marksData.findIndex(m => m.studentId === student.studentId);
                                        return (
                                            <tr key={student.studentId} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                                                <td style={{ padding: '1rem' }}>
                                                    <span style={{ background: '#f3f4f6', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 700 }}>
                                                        {student.rollNumber}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{student.studentName}</div>
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>
                                                    {student.totalMarks}
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                    {student.isAbsent ? (
                                                        <span style={{ color: '#ef4444', fontWeight: 700 }}>AB</span>
                                                    ) : student.isNA ? (
                                                        <span style={{ color: '#6366f1', fontWeight: 700 }}>NA</span>
                                                    ) : subjectDetails?.assessmentType === 'GRADE' ? (
                                                        <select
                                                            className="input-field"
                                                            style={{
                                                                width: '100px',
                                                                textAlign: 'center',
                                                                fontWeight: 700,
                                                                border: '2px solid var(--primary)',
                                                                borderRadius: '0.5rem',
                                                                color: 'var(--primary)'
                                                            }}
                                                            value={student.grade === 'N/A' ? '' : student.grade}
                                                            onChange={(e) => {
                                                                const updated = [...marksData];
                                                                updated[actualIndex].grade = e.target.value;
                                                                updated[actualIndex].obtainedMarks = 0;
                                                                updated[actualIndex].percentage = 0;
                                                                setMarksData(updated);
                                                            }}
                                                            disabled={!canEdit}
                                                        >
                                                            <option value="">Grade</option>
                                                            {['A+', 'A', 'B+', 'B', 'C', 'D', 'E', 'F'].map(g => (
                                                                <option key={g} value={g}>{g}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            type="number"
                                                            className="input-field"
                                                            style={{
                                                                width: '85px',
                                                                textAlign: 'center',
                                                                padding: '0.5rem',
                                                                fontSize: '1rem',
                                                                fontWeight: 700,
                                                                border: '2px solid var(--primary)',
                                                                borderRadius: '0.5rem',
                                                                color: 'var(--primary)'
                                                            }}
                                                            min="0"
                                                            max={student.totalMarks}
                                                            value={student.obtainedMarks === 0 ? '' : student.obtainedMarks}
                                                            onChange={(e) => {
                                                                const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                                handleMarksChange(actualIndex, 'obtainedMarks', val);
                                                            }}
                                                            onFocus={(e) => e.target.select()}
                                                            disabled={!canEdit}
                                                        />
                                                    )}
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                    <span style={{
                                                        fontWeight: 800,
                                                        fontSize: '0.9rem',
                                                        color: student.isAbsent || student.isNA ? '#9ca3af' :
                                                            student.percentage >= 90 ? '#10b981' :
                                                                student.percentage >= 75 ? '#3b82f6' :
                                                                    student.percentage >= 60 ? '#f59e0b' :
                                                                        student.percentage >= 40 ? '#ef4444' : '#6b7280'
                                                    }}>
                                                        {student.isAbsent || student.isNA ? '—' : `${student.percentage.toFixed(1)}%`}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                    <span style={{
                                                        padding: '0.4rem 0.8rem',
                                                        borderRadius: '0.5rem',
                                                        background: student.grade === 'AB' ? '#ef444415' :
                                                            student.grade === 'NA' ? '#6366f115' :
                                                                student.grade === 'A+' || student.grade === 'A' ? '#10b98115' :
                                                                    student.grade === 'B+' || student.grade === 'B' ? '#3b82f615' :
                                                                        student.grade === 'C' ? '#f59e0b15' : '#ef444415',
                                                        color: student.grade === 'AB' ? '#ef4444' :
                                                            student.grade === 'NA' ? '#6366f1' :
                                                                student.grade === 'A+' || student.grade === 'A' ? '#10b981' :
                                                                    student.grade === 'B+' || student.grade === 'B' ? '#3b82f6' :
                                                                        student.grade === 'C' ? '#f59e0b' : '#ef4444',
                                                        fontWeight: 800,
                                                        fontSize: '0.85rem',
                                                        border: `1px solid currentColor`
                                                    }}>
                                                        {student.grade}
                                                    </span>
                                                </td>
                                                <td style={{
                                                    padding: '1rem',
                                                    textAlign: 'center',
                                                    background: preSelectionData?.editStudentId === student.studentId ? '#fef9c3' : 'transparent',
                                                    borderLeft: preSelectionData?.editStudentId === student.studentId ? '4px solid #facc15' : 'none'
                                                }}>
                                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                        <button
                                                            onClick={() => handleAbsentToggle(actualIndex)}
                                                            disabled={!canEdit || student.isNA}
                                                            style={{
                                                                padding: '0.4rem 0.8rem',
                                                                borderRadius: '0.5rem',
                                                                fontWeight: 700,
                                                                fontSize: '0.7rem',
                                                                cursor: canEdit && !student.isNA ? 'pointer' : 'not-allowed',
                                                                background: student.isAbsent
                                                                    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2))'
                                                                    : 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.2))',
                                                                backdropFilter: 'blur(10px)',
                                                                color: student.isAbsent ? '#ef4444' : '#10b981',
                                                                border: `1.5px solid ${student.isAbsent ? '#ef4444' : '#10b981'}`,
                                                                transition: 'all 0.2s',
                                                                boxShadow: student.isAbsent
                                                                    ? '0 2px 8px rgba(239, 68, 68, 0.3)'
                                                                    : '0 2px 8px rgba(16, 185, 129, 0.3)',
                                                                opacity: student.isNA ? 0.5 : 1
                                                            }}
                                                        >
                                                            {student.isAbsent ? 'ABSENT' : 'PRESENT'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleNAToggle(actualIndex)}
                                                            disabled={!canEdit || student.isAbsent}
                                                            style={{
                                                                padding: '0.4rem 0.8rem',
                                                                borderRadius: '0.5rem',
                                                                fontWeight: 700,
                                                                fontSize: '0.7rem',
                                                                cursor: canEdit && !student.isAbsent ? 'pointer' : 'not-allowed',
                                                                background: student.isNA
                                                                    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2))'
                                                                    : 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.2))',
                                                                backdropFilter: 'blur(10px)',
                                                                color: student.isNA ? '#ef4444' : '#10b981',
                                                                border: `1.5px solid ${student.isNA ? '#ef4444' : '#10b981'}`,
                                                                transition: 'all 0.2s',
                                                                boxShadow: student.isNA
                                                                    ? '0 2px 8px rgba(239, 68, 68, 0.3)'
                                                                    : '0 2px 8px rgba(16, 185, 129, 0.3)',
                                                                opacity: student.isAbsent ? 0.5 : 1
                                                            }}
                                                        >
                                                            {student.isNA ? 'N.A.' : 'APPLICABLE'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div style={{ display: 'none' }} className="mobile-only">
                            {filteredMarks.map((student, index) => {
                                const actualIndex = marksData.findIndex(m => m.studentId === student.studentId);
                                return (
                                    <div
                                        key={student.studentId}
                                        style={{
                                            background: preSelectionData?.editStudentId === student.studentId
                                                ? 'linear-gradient(135deg, rgba(254, 249, 195, 0.3), rgba(250, 204, 21, 0.1))'
                                                : 'var(--bg-card)',
                                            borderRadius: '1rem',
                                            padding: '1.25rem',
                                            marginBottom: '1rem',
                                            border: preSelectionData?.editStudentId === student.studentId
                                                ? '2px solid #facc15'
                                                : '1px solid var(--border)',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                                        }}
                                    >
                                        {/* Student Header */}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: '1rem',
                                            paddingBottom: '0.75rem',
                                            borderBottom: '1px solid var(--border)'
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                                                    {student.studentName}
                                                </div>
                                                <span style={{
                                                    background: '#f3f4f6',
                                                    padding: '0.25rem 0.6rem',
                                                    borderRadius: '0.4rem',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    color: '#6b7280'
                                                }}>
                                                    Roll: {student.rollNumber}
                                                </span>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Total</div>
                                                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>{student.totalMarks}</div>
                                            </div>
                                        </div>

                                        {/* Marks Input */}
                                        <div style={{ marginBottom: '1rem' }}>
                                            <label style={{
                                                display: 'block',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                color: 'var(--text-muted)',
                                                marginBottom: '0.5rem'
                                            }}>
                                                Obtained Marks
                                            </label>
                                            {student.isAbsent ? (
                                                <div style={{
                                                    padding: '0.75rem',
                                                    textAlign: 'center',
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    borderRadius: '0.5rem',
                                                    color: '#ef4444',
                                                    fontWeight: 700,
                                                    fontSize: '1.1rem'
                                                }}>
                                                    AB (Absent)
                                                </div>
                                            ) : student.isNA ? (
                                                <div style={{
                                                    padding: '0.75rem',
                                                    textAlign: 'center',
                                                    background: 'rgba(99, 102, 241, 0.1)',
                                                    borderRadius: '0.5rem',
                                                    color: '#6366f1',
                                                    fontWeight: 700,
                                                    fontSize: '1.1rem'
                                                }}>
                                                    NA (Not Applicable)
                                                </div>
                                            ) : subjectDetails?.assessmentType === 'GRADE' ? (
                                                <select
                                                    className="input-field"
                                                    style={{
                                                        width: '100%',
                                                        textAlign: 'center',
                                                        fontWeight: 700,
                                                        fontSize: '1.1rem',
                                                        border: '2px solid var(--primary)',
                                                        borderRadius: '0.5rem',
                                                        padding: '0.75rem',
                                                        color: 'var(--primary)'
                                                    }}
                                                    value={student.grade === 'N/A' ? '' : student.grade}
                                                    onChange={(e) => {
                                                        const updated = [...marksData];
                                                        updated[actualIndex].grade = e.target.value;
                                                        updated[actualIndex].obtainedMarks = 0;
                                                        updated[actualIndex].percentage = 0;
                                                        setMarksData(updated);
                                                    }}
                                                    disabled={!canEdit}
                                                >
                                                    <option value="">Select Grade</option>
                                                    {['A+', 'A', 'B+', 'B', 'C', 'D', 'E', 'F'].map(g => (
                                                        <option key={g} value={g}>{g}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    style={{
                                                        width: '100%',
                                                        textAlign: 'center',
                                                        padding: '0.75rem',
                                                        fontSize: '1.3rem',
                                                        fontWeight: 700,
                                                        border: '2px solid var(--primary)',
                                                        borderRadius: '0.5rem',
                                                        color: 'var(--primary)'
                                                    }}
                                                    min="0"
                                                    max={student.totalMarks}
                                                    placeholder="Enter marks"
                                                    value={student.obtainedMarks === 0 ? '' : student.obtainedMarks}
                                                    onChange={(e) => {
                                                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                        handleMarksChange(actualIndex, 'obtainedMarks', val);
                                                    }}
                                                    onFocus={(e) => e.target.select()}
                                                    disabled={!canEdit}
                                                />
                                            )}
                                        </div>

                                        {/* Stats Row */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '0.75rem',
                                            marginBottom: '1rem'
                                        }}>
                                            <div style={{
                                                background: 'var(--bg-main)',
                                                padding: '0.75rem',
                                                borderRadius: '0.5rem',
                                                textAlign: 'center'
                                            }}>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Percentage</div>
                                                <div style={{
                                                    fontWeight: 800,
                                                    fontSize: '1.1rem',
                                                    color: student.isAbsent || student.isNA ? '#9ca3af' :
                                                        student.percentage >= 90 ? '#10b981' :
                                                            student.percentage >= 75 ? '#3b82f6' :
                                                                student.percentage >= 60 ? '#f59e0b' :
                                                                    student.percentage >= 40 ? '#ef4444' : '#6b7280'
                                                }}>
                                                    {student.isAbsent || student.isNA ? '—' : `${student.percentage.toFixed(1)}%`}
                                                </div>
                                            </div>
                                            <div style={{
                                                background: 'var(--bg-main)',
                                                padding: '0.75rem',
                                                borderRadius: '0.5rem',
                                                textAlign: 'center'
                                            }}>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Grade</div>
                                                <div style={{
                                                    fontWeight: 800,
                                                    fontSize: '1.1rem',
                                                    color: student.grade === 'AB' ? '#ef4444' :
                                                        student.grade === 'NA' ? '#6366f1' :
                                                            student.grade === 'A+' || student.grade === 'A' ? '#10b981' :
                                                                student.grade === 'B+' || student.grade === 'B' ? '#3b82f6' :
                                                                    student.grade === 'C' ? '#f59e0b' : '#ef4444'
                                                }}>
                                                    {student.grade}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Buttons */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '0.75rem'
                                        }}>
                                            <button
                                                onClick={() => handleAbsentToggle(actualIndex)}
                                                disabled={!canEdit || student.isNA}
                                                style={{
                                                    padding: '0.75rem',
                                                    borderRadius: '0.75rem',
                                                    fontWeight: 700,
                                                    fontSize: '0.85rem',
                                                    cursor: canEdit && !student.isNA ? 'pointer' : 'not-allowed',
                                                    background: student.isAbsent
                                                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2))'
                                                        : 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.2))',
                                                    backdropFilter: 'blur(10px)',
                                                    color: student.isAbsent ? '#ef4444' : '#10b981',
                                                    border: `2px solid ${student.isAbsent ? '#ef4444' : '#10b981'}`,
                                                    transition: 'all 0.2s',
                                                    boxShadow: student.isAbsent
                                                        ? '0 4px 12px rgba(239, 68, 68, 0.3)'
                                                        : '0 4px 12px rgba(16, 185, 129, 0.3)',
                                                    opacity: student.isNA ? 0.5 : 1,
                                                    transform: student.isAbsent ? 'scale(1.02)' : 'scale(1)'
                                                }}
                                            >
                                                {student.isAbsent ? '🔴 ABSENT' : '🟢 PRESENT'}
                                            </button>
                                            <button
                                                onClick={() => handleNAToggle(actualIndex)}
                                                disabled={!canEdit || student.isAbsent}
                                                style={{
                                                    padding: '0.75rem',
                                                    borderRadius: '0.75rem',
                                                    fontWeight: 700,
                                                    fontSize: '0.85rem',
                                                    cursor: canEdit && !student.isAbsent ? 'pointer' : 'not-allowed',
                                                    background: student.isNA
                                                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2))'
                                                        : 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.2))',
                                                    backdropFilter: 'blur(10px)',
                                                    color: student.isNA ? '#ef4444' : '#10b981',
                                                    border: `2px solid ${student.isNA ? '#ef4444' : '#10b981'}`,
                                                    transition: 'all 0.2s',
                                                    boxShadow: student.isNA
                                                        ? '0 4px 12px rgba(239, 68, 68, 0.3)'
                                                        : '0 4px 12px rgba(16, 185, 129, 0.3)',
                                                    opacity: student.isAbsent ? 0.5 : 1,
                                                    transform: student.isNA ? 'scale(1.02)' : 'scale(1)'
                                                }}
                                            >
                                                {student.isNA ? '🔴 N.A.' : '🟢 APPLICABLE'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {canEdit && (
                        <div style={{
                            display: 'flex',
                            gap: '1rem',
                            flexWrap: 'wrap',
                            justifyContent: 'flex-end',
                            marginTop: '2rem'
                        }}>
                            <button
                                onClick={() => handleSaveMarks('DRAFT')}
                                className="btn"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: 'white',
                                    color: '#6b7280',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '0.5rem',
                                    padding: '0.75rem 1.5rem',
                                    fontWeight: 600,
                                    transition: 'all 0.2s',
                                    flex: '1 1 auto',
                                    minWidth: 'fit-content',
                                    justifyContent: 'center'
                                }}
                            >
                                <Save size={18} />
                                <span style={{ whiteSpace: 'nowrap' }}>Save as Draft</span>
                            </button>
                            <button
                                onClick={() => handleSaveMarks('SUBMITTED')}
                                className="btn"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    padding: '0.75rem 1.5rem',
                                    fontWeight: 600,
                                    boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.4)',
                                    transition: 'all 0.2s',
                                    flex: '1 1 auto',
                                    minWidth: 'fit-content',
                                    justifyContent: 'center'
                                }}
                            >
                                <Check size={18} />
                                <span style={{ whiteSpace: 'nowrap' }}>Submit for Approval</span>
                            </button>
                        </div>
                    )}
                </>
            )}

            {marksData.length === 0 && selectedExam && selectedClass && selectedSubject && (
                <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                    <Users size={64} style={{ margin: '0 auto', color: 'var(--text-muted)', marginBottom: '1rem' }} />
                    <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>No Students Found</h3>
                    <p style={{ color: 'var(--text-muted)' }}>
                        There are no active students in the selected class
                    </p>
                </div>
            )}
            {/* Import Preview Modal */}
            {importPreview.show && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 1000, padding: '2rem'
                }}>
                    <div className="glass-card" style={{
                        maxWidth: '900px', width: '100%', maxHeight: '90vh',
                        display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden'
                    }}>
                        <div style={{ padding: '1.5rem', background: 'var(--primary)', color: 'white', display: 'flex', justifyContent: 'space-between' }}>
                            <h2 style={{ margin: 0 }}>Import Preview ({selectedSection || 'All Sections'})</h2>
                            <button onClick={() => setImportPreview({ matches: [], errors: [], show: false })} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>✕</button>
                        </div>

                        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                            {importPreview.errors.length > 0 && (
                                <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                                    <h4 style={{ color: '#991b1b', margin: '0 0 0.5rem 0' }}>⚠️ These students were in Excel but not in Section "{selectedSection || 'All'}":</h4>
                                    <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#b91c1c' }}>
                                        {importPreview.errors.map((err, i) => <li key={i}>{err}</li>)}
                                    </ul>
                                    <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontStyle: 'italic' }}>Note: They will be ignored. Correct the section or the Excel file if this is wrong.</p>
                                </div>
                            )}

                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                                        <th style={{ padding: '0.75rem' }}>Student</th>
                                        <th style={{ padding: '0.75rem' }}>Adm No</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Old Marks</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>New Marks</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {importPreview.matches.map((m, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '0.75rem' }}>{m.studentName}</td>
                                            <td style={{ padding: '0.75rem' }}>{m.admissionNo}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'center', color: '#6b7280' }}>{m.oldMarks}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>{m.newMarks}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                <span style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem', borderRadius: '1rem', background: '#dcfce7', color: '#166534' }}>MATCHED</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button className="btn" onClick={() => setImportPreview({ matches: [], errors: [], show: false })} style={{ border: '1px solid var(--border)' }}>Cancel</button>
                            <button className="btn" onClick={confirmImport} style={{ background: 'var(--primary)', color: 'white' }}>Confirm & Update {importPreview.matches.length} Records</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdvancedMarksEntry;
