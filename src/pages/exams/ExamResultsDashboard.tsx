import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Trophy,
    Users,
    Download,
    Eye,
    EyeOff,
    Search,
    Filter,
    BarChart2,
    CheckCircle,
    XCircle,
    Printer,
    FileText,
    TrendingUp,
    Award,
    Trash2,
    Edit,
    ChevronUp,
    ChevronDown,
    Settings,
    X
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { sortClasses } from '../../constants/app';
import { useSchool } from '../../context/SchoolContext';
import { toProperCase, formatClassName, resolveClassName, subjectMatches } from '../../utils/formatters';
import * as XLSX from 'xlsx';

interface StudentResult {
    studentId: string;
    studentName: string;
    rollNumber: string;
    marks: { [subjectId: string]: any };
    totalObtained: number;
    totalMax: number;
    percentage: number;
    grade: string;
    rank: number;
    status: 'PASS' | 'FAIL' | 'COMPARTMENT';
    failedSubjects: string[];
}

const ExamResultsDashboard: React.FC = () => {
    const navigate = useNavigate();
    // Normalize for fuzzy class name comparisons ("Pre-Nursery" == "Pre Nursery")
    const normalizeClass = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const { currentSchool } = useSchool();
    const { data: exams, update: updateExam } = useFirestore<any>('exams');
    const { data: marksEntries } = useFirestore<any>('marks_entries');
    const { data: studentList } = useFirestore<any>('students');
    const { data: gradingSystems } = useFirestore<any>('grading_systems');
    const { data: allSettings } = useFirestore<any>('settings');
    const { data: academicYears } = useFirestore<any>('academic_years');

    const activeClasses = sortClasses(allSettings?.filter((d: any) => d.type === 'class' && d.active !== false) || []);

    // Get report card config for principal signature
    const reportCardConfig = allSettings?.find((s: any) => s.type === 'report_card_config' && s.schoolId === currentSchool?.id);
    const principalSignatureUrl = reportCardConfig?.principalSignatureUrl || currentSchool?.principalSignatureUrl || '';
    const schoolSubtitle = reportCardConfig?.subtitle || '';
    const signatureHeight = reportCardConfig?.signatureHeight || 40;

    const printRef = useRef<HTMLDivElement>(null);

    const schoolAcademicYears = (academicYears?.filter((y: any) => y.schoolId === currentSchool?.id && !y.isArchived) || [])
        .sort((a: any, b: any) => (b.name || '').localeCompare(a.name || ''));
    const activeYear = schoolAcademicYears.find((y: any) => y.isActive);

    const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('');
    const [selectedExamId, setSelectedExamId] = useState<string>('');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedSection, setSelectedSection] = useState<string>('');
    const [nameCase, setNameCase] = useState<'UPPER' | 'PROPER'>('UPPER');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [showPrintConfig, setShowPrintConfig] = useState(false);
    const [showDeleteBtn, setShowDeleteBtn] = useState(false);

    // Auto-select active academic year on first load
    React.useEffect(() => {
        if (!selectedAcademicYear && activeYear?.id) {
            setSelectedAcademicYear(activeYear.id);
        }
    }, [activeYear?.id]);

    // Print header config – persisted per school in localStorage
    const printConfigKey = `printHeaderConfig_${currentSchool?.id || 'default'}`;
    const [printHeaderConfig, setPrintHeaderConfig] = useState(() => {
        try {
            const saved = localStorage.getItem(printConfigKey);
            if (saved) return JSON.parse(saved);
        } catch { }
        return {
            showLogo: true,
            showSchoolName: true,
            showSubtitle: true,
            showAddress: true,
            showPhone: false,
            showEmail: false,
            showWebsite: false,
            showUdiseCode: false,
            showSchoolCode: false,
            showRunAndManagedBy: false
        };
    });

    const updatePrintConfig = (key: string, val: boolean) => {
        setPrintHeaderConfig((prev: any) => {
            const updated = { ...prev, [key]: val };
            localStorage.setItem(printConfigKey, JSON.stringify(updated));
            return updated;
        });
    };

    // Helper to get class name from ID/Slug
    const getClassName = (classId: string) => {
        if (!classId) return '';
        const cls = activeClasses.find((c: any) => c.id === classId || c.name === classId);
        return cls?.name || classId;
    };
    const [searchQuery, setSearchQuery] = useState('');

    // Helper to find marks entry for a student and subject
    const findMarksEntry = (student: any, subject: any, allMarks: any[]) => {
        if (!allMarks || !student || !subject) return null;

        // First filter by student's section (allowing global class marks)
        // Global marks often have empty/missing sectionId
        const studentSection = student.section;

        // Exact subjectId match first
        let entry = allMarks.find(m =>
            m.subjectId === subject.subjectId &&
            (!m.sectionId || m.sectionId === studentSection || m.sectionName === studentSection)
        );

        // Fallback: Try matching by subjectName if subjectId doesn't match
        if (!entry) {
            const subCombined = subject.combinedSubjects || [];
            entry = allMarks.find(m => {
                const mSubName = m.subjectName || '';
                // Must still match section/class
                const sectionMatch = !m.sectionId || m.sectionId === studentSection || m.sectionName === studentSection;
                if (!sectionMatch) return false;

                return subjectMatches(mSubName, subject.subjectName || subject.name || '', subCombined);
            });
        }

        return entry;
    };

    // Filter schoolExams by academic year
    const schoolExams = exams?.filter((e: any) =>
        e.schoolId === currentSchool?.id &&
        (selectedAcademicYear ? e.academicYearId === selectedAcademicYear : true)
    ) || [];
    const selectedExam = schoolExams.find((e: any) => e.id === selectedExamId);

    // Resolve a class ID to a human-readable name (handles legacy-format IDs).
    const resolveClass = (id: string) => resolveClassName(id, activeClasses);

    // All stored targetClass IDs — no filter by activeClasses ID match.
    const availableClasses: string[] = selectedExam?.targetClasses || [];
    const defaultGrading = gradingSystems?.find((g: any) => g.schoolId === currentSchool?.id && g.isDefault);

    // Get subjects for the selected class (handling classRoutines)
    const availableSubjects = useMemo(() => {
        if (!selectedExam || !selectedClass) return [];

        const classRoutine = selectedExam.classRoutines?.find((cr: any) =>
            cr.classId === selectedClass || cr.className === resolveClass(selectedClass) || resolveClass(cr.classId) === resolveClass(selectedClass)
        );

        return (classRoutine && classRoutine.routine && classRoutine.routine.length > 0)
            ? classRoutine.routine
            : (selectedExam.subjects || []);
    }, [selectedExam, selectedClass, activeClasses]);

    const examMarks = useMemo(() => {
        if (!selectedExamId || !selectedClass || !marksEntries) return [];

        const selectedClassName = resolveClass(selectedClass);
        const normalizedSelected = normalizeClass(selectedClassName);

        return marksEntries.filter((m: any) =>
            m.examId === selectedExamId &&
            (m.classId === selectedClass || (selectedClassName && m.className === selectedClassName) || m.classId === selectedClassName || resolveClass(m.classId) === selectedClassName || normalizeClass(m.className || '') === normalizedSelected || normalizeClass(m.classId || '') === normalizedSelected) &&
            (m.status === 'APPROVED' || m.status === 'SUBMITTED') &&
            (!selectedSection || m.sectionId === selectedSection || m.sectionName === selectedSection)
        );
    }, [selectedExamId, selectedClass, selectedSection, marksEntries, activeClasses]);

    // Calculate Results
    const calculatedResults = useMemo(() => {
        if (!selectedExamId || !selectedClass || !examMarks || !studentList) return [];

        // Selected Class Name for matching (handles legacy IDs via resolveClass)
        const selectedClassName = resolveClass(selectedClass);
        const normalizedSelected = normalizeClass(selectedClassName);

        const classStudents = studentList.filter((s: any) =>
            s.schoolId === currentSchool?.id &&
            (s.class === selectedClass || (selectedClassName && s.class === selectedClassName) || normalizeClass(s.class || '') === normalizedSelected) &&
            s.status === 'ACTIVE' &&
            (!selectedSection || s.section === selectedSection) &&
            // Filter by academic year using student's 'session' field (year name like "2026-2027")
            // This matches the same logic used in StudentManagement.tsx
            (selectedAcademicYear
                ? (s.session === (schoolAcademicYears.find((y: any) => y.id === selectedAcademicYear)?.name))
                : true)
        );

        const results: StudentResult[] = classStudents.map((student: any) => {
            let totalObtained = 0;
            let totalMax = 0;
            const marks: { [key: string]: number | string } = {};
            const failedSubjects: string[] = [];

            // Filter marks entries specific to this student's section
            // This is crucial when "All Sections" is selected to avoid mixing marks from different sections
            const studentSectionMarks = examMarks.filter((m: any) =>
                m.sectionId === student.section || m.sectionName === student.section
            );

            availableSubjects.forEach((sub: any) => {
                const entry = findMarksEntry(student, sub, examMarks);
                const studentMark = entry?.marks?.find((sm: any) => sm.studentId === student.id);
                const isAbsent = studentMark?.isAbsent || false;
                const isNA = studentMark?.isNA || false;

                const obtained = isNA ? 'NA' : (isAbsent ? 'AB' : (studentMark?.obtainedMarks || 0));
                const isGradeBased = sub.assessmentType === 'GRADE';

                marks[sub.subjectId] = isGradeBased ? (studentMark?.grade || 'N/A') : obtained;

                // Only add to totals if NOT grade-based and NOT NA
                if (!isGradeBased && !isNA) {
                    totalObtained += (typeof obtained === 'number' ? obtained : 0);
                    totalMax += (sub.maxMarks || 0);
                }

                // Only mark as failed if explicitly failed or absent in a numeric subject
                const passThreshold = (sub.maxMarks * (sub.passingMarks || 0)) / 100;
                if (!isGradeBased && !isNA && (isAbsent || (typeof obtained === 'number' && obtained < passThreshold))) {
                    failedSubjects.push(sub.subjectName);
                }
            });

            const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
            const isFullyAbsent = totalObtained === 0 && totalMax > 0;

            // Calculate Grade
            let grade = 'F';
            // Try to get exam-specific grading system first
            let gradingSystem = defaultGrading;

            if (selectedExam?.gradingSystemId) {
                const examGrading = gradingSystems?.find((g: any) => g.id === selectedExam.gradingSystemId);
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

            if (gradingSystem?.ranges) {
                // Sort ranges in descending order of max value
                const sortedRanges = [...gradingSystem.ranges].sort((a: any, b: any) => {
                    const maxA = typeof a.max === 'string' ? parseFloat(a.max) : a.max;
                    const maxB = typeof b.max === 'string' ? parseFloat(b.max) : b.max;
                    return maxB - maxA;
                });

                const range = sortedRanges.find((r: any) => {
                    const min = typeof r.min === 'string' ? parseFloat(r.min) : r.min;
                    // Use a small epsilon or floor/round if necessary, but >= min is most robust for descending ranges
                    return percentage >= (min - 0.01);
                });

                grade = range?.grade || 'F';
            }

            return {
                studentId: student.id,
                studentName: student.name,
                rollNumber: student.classRollNo || student.rollNo || student.admissionNumber || '-',
                marks,
                totalObtained,
                totalMax,
                percentage,
                grade,
                rank: 0,
                status: (failedSubjects.length === 0 && percentage >= 33 && !isFullyAbsent) ? 'PASS' : (failedSubjects.length > 1 || percentage < 33 || isFullyAbsent) ? 'FAIL' : 'COMPARTMENT',
                failedSubjects
            };
        });

        // Calculate Ranks — Dense Ranking (1, 2, 3… no skipping)
        // Same totalObtained+totalMax → same rank; next unique score → next rank
        const sorted = results.sort((a, b) => b.percentage - a.percentage);
        const ranks: number[] = [];
        let denseRank = 0;
        sorted.forEach((res, index) => {
            if (
                index > 0 &&
                res.totalObtained === sorted[index - 1].totalObtained &&
                res.totalMax === sorted[index - 1].totalMax
            ) {
                ranks.push(ranks[index - 1]); // same marks → same rank
            } else {
                denseRank += 1; // new score group → next rank
                ranks.push(denseRank);
            }
        });
        return sorted.map((res, index) => ({ ...res, rank: ranks[index] }));

    }, [selectedExamId, selectedClass, selectedSection, marksEntries, studentList, selectedExam, defaultGrading, currentSchool?.id, activeClasses]);

    // Sorting logic with numeric support
    const sortedResults = useMemo(() => {
        if (!sortConfig) {
            // Default: sort by roll number ascending
            return [...calculatedResults].sort((a: any, b: any) => {
                const aNum = parseFloat(a.rollNumber);
                const bNum = parseFloat(b.rollNumber);
                if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
                return (a.rollNumber || '').localeCompare(b.rollNumber || '');
            });
        }

        const sorted = [...calculatedResults].sort((a: any, b: any) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];

            // Check if both values are numeric strings (like roll numbers)
            const aNum = parseFloat(aVal);
            const bNum = parseFloat(bVal);
            const bothNumeric = !isNaN(aNum) && !isNaN(bNum);

            if (bothNumeric) {
                // Numeric comparison
                return sortConfig.direction === 'asc'
                    ? aNum - bNum
                    : bNum - aNum;
            } else if (typeof aVal === 'string' && typeof bVal === 'string') {
                // String comparison
                return sortConfig.direction === 'asc'
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            }

            // Default numeric comparison
            return sortConfig.direction === 'asc'
                ? (aVal > bVal ? 1 : -1)
                : (bVal > aVal ? 1 : -1);
        });

        return sorted;
    }, [calculatedResults, sortConfig]);

    const filteredResults = sortedResults.filter(res =>
        res.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        res.rollNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const exportToExcel = () => {
        if (!selectedExam || !filteredResults.length) return;

        const data = filteredResults.map(res => {
            const displayStudentName = nameCase === 'UPPER'
                ? (res.studentName || '').toUpperCase()
                : toProperCase(res.studentName || '');

            const row: any = {
                'Rank': res.rank,
                'Roll No': res.rollNumber,
                'Student Name': displayStudentName,
            };

            // Student object dhundhte hain taake entry lookup ho sake
            const student = studentList?.find((s: any) => s.id === res.studentId);

            availableSubjects.forEach((sub: any) => {
                const combinedNames = sub.combinedSubjects && sub.combinedSubjects.length > 0
                    ? ` / ${sub.combinedSubjects.join(' / ')}`
                    : '';
                const baseName = `${sub.subjectName}${combinedNames}`;
                const isGradeBased = sub.assessmentType === 'GRADE';
                const hasSplit = !isGradeBased && (sub.theoryMarks > 0 && sub.practicalMarks > 0);

                if (hasSplit) {
                    // Theory aur Practical alag columns
                    const entry = findMarksEntry(student, sub, examMarks);
                    const studentMark = entry?.marks?.find((sm: any) => sm.studentId === res.studentId);
                    const isAbsent = studentMark?.isAbsent || false;
                    const isNA = studentMark?.isNA || false;

                    if (isNA) {
                        row[`${baseName} (Theory)`] = 'NA';
                        row[`${baseName} (Practical)`] = 'NA';
                    } else if (isAbsent) {
                        row[`${baseName} (Theory)`] = 'AB';
                        row[`${baseName} (Practical)`] = 'AB';
                    } else {
                        row[`${baseName} (Theory)`] = studentMark?.theoryMarks ?? studentMark?.obtainedMarks ?? 0;
                        row[`${baseName} (Practical)`] = studentMark?.practicalMarks ?? 0;
                    }
                } else {
                    // Normal single column
                    row[baseName] = isGradeBased
                        ? (res.marks[sub.subjectId] || 'N/A')
                        : res.marks[sub.subjectId];
                }
            });

            row['Total'] = `${res.totalObtained}/${res.totalMax}`;
            row['Percentage'] = res.percentage.toFixed(2) + '%';
            row['Grade'] = res.grade;
            row['Status'] = res.status;

            return row;
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Results');
        XLSX.writeFile(wb, `${selectedExam.displayName || selectedExam.name}_${resolveClass(selectedClass)}_Results.xlsx`);
    };

    // ─── Full Exam Export: har class ka alag sheet ───────────────────────────
    const exportFullExamToExcel = () => {
        if (!selectedExam || !selectedExamId) {
            alert('Pehle koi exam select karein.');
            return;
        }

        const wb = XLSX.utils.book_new();
        const examClasses: string[] = selectedExam.targetClasses || [];

        if (examClasses.length === 0) {
            alert('Is exam mein koi class nahi mili.');
            return;
        }

        let totalSheetsAdded = 0;

        examClasses.forEach((clsId: string) => {
            const resolvedClassName = resolveClassName(clsId, activeClasses);
            const sheetLabel = resolvedClassName || clsId;

            // Us class ke subjects nikalo
            const classRoutine = selectedExam.classRoutines?.find((cr: any) =>
                cr.classId === clsId || cr.className === resolvedClassName
            );
            const classSubjects: any[] = (classRoutine?.routine?.length > 0)
                ? classRoutine.routine
                : (selectedExam.subjects || []);

            // Us class ke approved/submitted marks nikalo
            const normalizedResolved = normalizeClass(resolvedClassName);
            const classMarks = (marksEntries || []).filter((m: any) =>
                m.examId === selectedExamId &&
                (m.classId === clsId || (resolvedClassName && (m.className === resolvedClassName || m.classId === resolvedClassName)) || normalizeClass(m.className || '') === normalizedResolved || normalizeClass(m.classId || '') === normalizedResolved) &&
                (m.status === 'APPROVED' || m.status === 'SUBMITTED')
            );

            // Us class ke active students nikalo
            const selectedYearName = schoolAcademicYears.find((y: any) => y.id === selectedAcademicYear)?.name;
            const classStudents = (studentList || []).filter((s: any) =>
                s.schoolId === currentSchool?.id &&
                (s.class === clsId || (resolvedClassName && s.class === resolvedClassName) || normalizeClass(s.class || '') === normalizedResolved) &&
                s.status === 'ACTIVE' &&
                (selectedAcademicYear ? s.session === selectedYearName : true)
            );

            if (classStudents.length === 0) return; // koi student nahi, skip

            // Grading system
            let gradingSystem = defaultGrading;
            if (selectedExam?.gradingSystemId) {
                const eg = gradingSystems?.find((g: any) => g.id === selectedExam.gradingSystemId);
                if (eg) gradingSystem = eg;
            }
            if (!gradingSystem?.ranges) {
                gradingSystem = {
                    type: 'LETTER', name: 'Fallback',
                    ranges: [
                        { grade: 'A+', min: 91, max: 100 }, { grade: 'A', min: 81, max: 90 },
                        { grade: 'B+', min: 71, max: 80 }, { grade: 'B', min: 61, max: 70 },
                        { grade: 'C', min: 51, max: 60 }, { grade: 'D', min: 41, max: 50 },
                        { grade: 'E', min: 33, max: 40 }, { grade: 'F', min: 0, max: 32 }
                    ]
                };
            }

            // Har student ka result calculate karo
            const results: any[] = classStudents.map((student: any) => {
                let totalObtained = 0;
                let totalMax = 0;
                const failedSubjects: string[] = [];
                const marksForRow: any = {};

                classSubjects.forEach((sub: any) => {
                    const entry = findMarksEntry(student, sub, classMarks);
                    const studentMark = entry?.marks?.find((sm: any) => sm.studentId === student.id);
                    const isAbsent = studentMark?.isAbsent || false;
                    const isNA = studentMark?.isNA || false;
                    const isGradeBased = sub.assessmentType === 'GRADE';
                    const hasSplit = !isGradeBased && (sub.theoryMarks > 0 && sub.practicalMarks > 0);

                    const obtained = isNA ? 'NA' : (isAbsent ? 'AB' : (studentMark?.obtainedMarks || 0));
                    const combinedNames = sub.combinedSubjects?.length > 0 ? ` / ${sub.combinedSubjects.join(' / ')}` : '';
                    const baseName = `${sub.subjectName}${combinedNames}`;

                    if (isGradeBased) {
                        marksForRow[baseName] = studentMark?.grade || 'N/A';
                    } else if (hasSplit) {
                        // Theory aur Practical alag columns
                        if (isNA) {
                            marksForRow[`${baseName} (Theory)`] = 'NA';
                            marksForRow[`${baseName} (Practical)`] = 'NA';
                        } else if (isAbsent) {
                            marksForRow[`${baseName} (Theory)`] = 'AB';
                            marksForRow[`${baseName} (Practical)`] = 'AB';
                        } else {
                            marksForRow[`${baseName} (Theory)`] = studentMark?.theoryMarks ?? studentMark?.obtainedMarks ?? 0;
                            marksForRow[`${baseName} (Practical)`] = studentMark?.practicalMarks ?? 0;
                        }
                    } else {
                        marksForRow[baseName] = obtained;
                    }

                    if (!isGradeBased && !isNA) {
                        totalObtained += (typeof obtained === 'number' ? obtained : 0);
                        totalMax += (sub.maxMarks || 0);
                    }

                    const passThreshold = (sub.maxMarks * (sub.passingMarks || 0)) / 100;
                    if (!isGradeBased && !isNA && (isAbsent || (typeof obtained === 'number' && obtained < passThreshold))) {
                        failedSubjects.push(sub.subjectName);
                    }
                });

                const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
                const isFullyAbsent = totalObtained === 0 && totalMax > 0;

                const sortedRanges = [...(gradingSystem?.ranges || [])].sort((a: any, b: any) =>
                    (typeof b.max === 'string' ? parseFloat(b.max) : b.max) -
                    (typeof a.max === 'string' ? parseFloat(a.max) : a.max)
                );
                const range = sortedRanges.find((r: any) => percentage >= ((typeof r.min === 'string' ? parseFloat(r.min) : r.min) - 0.01));
                const grade = range?.grade || 'F';
                const status = (failedSubjects.length === 0 && percentage >= 33 && !isFullyAbsent) ? 'PASS'
                    : (failedSubjects.length > 1 || percentage < 33 || isFullyAbsent) ? 'FAIL' : 'COMPARTMENT';

                return {
                    student,
                    rollNumber: student.classRollNo || student.rollNo || student.admissionNumber || '-',
                    totalObtained, totalMax, percentage, grade, status, marksForRow
                };
            });

            // Dense ranking
            const sorted = [...results].sort((a, b) => b.percentage - a.percentage);
            const ranks: number[] = [];
            let denseRank = 0;
            sorted.forEach((res, idx) => {
                if (idx > 0 && res.totalObtained === sorted[idx - 1].totalObtained && res.totalMax === sorted[idx - 1].totalMax) {
                    ranks.push(ranks[idx - 1]);
                } else {
                    denseRank++;
                    ranks.push(denseRank);
                }
            });

            // Sort by roll number for sheet
            const finalRows = sorted
                .map((res, idx) => ({ ...res, rank: ranks[idx] }))
                .sort((a, b) => {
                    const an = parseFloat(a.rollNumber), bn = parseFloat(b.rollNumber);
                    return (!isNaN(an) && !isNaN(bn)) ? an - bn : (a.rollNumber || '').localeCompare(b.rollNumber || '');
                });

            // Build sheet rows
            const sheetData = finalRows.map(res => {
                const displayStudentName = nameCase === 'UPPER'
                    ? (res.student.name || '').toUpperCase()
                    : toProperCase(res.student.name || '');

                const row: any = {
                    'Rank': res.rank,
                    'Roll No': res.rollNumber,
                    'Student Name': displayStudentName,
                    'Section': res.student.section || '-',
                };
                Object.assign(row, res.marksForRow);
                row['Total'] = `${res.totalObtained}/${res.totalMax}`;
                row['%'] = res.percentage.toFixed(2) + '%';
                row['Grade'] = res.grade;
                row['Status'] = res.status;
                return row;
            });

            const ws = XLSX.utils.json_to_sheet(sheetData);

            // Safe sheet name (max 31 chars, no special chars)
            const safeName = sheetLabel.replace(/[:\\/?*\[\]]/g, '').slice(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, safeName);
            totalSheetsAdded++;
        });

        if (totalSheetsAdded === 0) {
            alert('Koi bhi class ka data nahi mila export ke liye.');
            return;
        }

        const examName = selectedExam.displayName || selectedExam.name || 'Exam';
        XLSX.writeFile(wb, `${examName}_Full_Results.xlsx`);
    };

    const publishResults = async () => {
        if (!selectedExamId || !selectedExam) {
            alert('Please select an exam first');
            return;
        }

        if (calculatedResults.length === 0) {
            alert('No results available to publish. Please ensure marks have been entered and approved.');
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to publish results for "${selectedExam.displayName || selectedExam.name}"?\n\n` +
            `This will make the results visible to students and parents in their portals.`
        );

        if (!confirmed) return;

        try {
            await updateExam(selectedExamId, {
                resultsPublished: true,
                resultsPublishedDate: new Date().toISOString(),
                resultsPublishedBy: currentSchool?.id,
                updatedAt: new Date().toISOString()
            });
            alert('✅ Results published successfully! Students and parents can now view their results.');
        } catch (error) {
            console.error('Error publishing results:', error);
            alert('Failed to publish results. Please try again.');
        }
    };

    const { remove: removeMarkEntry } = useFirestore<any>('marks_entries');

    const handleDeleteMarks = async () => {
        if (!selectedExamId || !selectedClass) return;

        const selectedClassName = resolveClass(selectedClass);
        const normalizedSelected = normalizeClass(selectedClassName);

        const marksToDelete = marksEntries?.filter((m: any) =>
            m.examId === selectedExamId &&
            (m.classId === selectedClass || (selectedClassName && m.className === selectedClassName) || m.classId === selectedClassName || normalizeClass(m.className || '') === normalizedSelected)
        ) || [];

        if (marksToDelete.length === 0) {
            alert('No marks found to delete.');
            return;
        }

        let message = `Are you sure you want to PERMANENTLY DELETE all marks for ${selectedClassName || selectedClass} in "${selectedExam?.name}"?\n\n` +
            `This action cannot be undone and will delete marks for ${marksToDelete.length} subject entries.`;

        if (selectedSection) {
            message += `\n\nNOTE: Marks are stored per class. Deleting will remove marks for ALL sections of this class, not just section ${selectedSection}.`;
        }

        const confirmed = window.confirm(message);

        if (!confirmed) return;

        try {
            const deletePromises = marksToDelete.map(m => removeMarkEntry(m.id));
            await Promise.all(deletePromises);
            alert('✅ All marks for this class and exam have been deleted successfully.');
        } catch (error) {
            console.error('Error deleting marks:', error);
            alert('Failed to delete marks. Please try again.');
        }
    };

    // Print handler for results table — opens a new window for a clean single-copy print
    const handlePrintResults = () => {
        if (!filteredResults.length) return;

        const printContent = printRef.current;
        if (!printContent) return;

        // Temporarily show the hidden div so we can read its innerHTML
        printContent.style.display = 'block';
        const html = printContent.innerHTML;
        printContent.style.display = 'none';

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow pop-ups to print results.');
            return;
        }

        printWindow.document.write(`<html><head><title>Exam Results</title>
            <style>
                @page { size: landscape; margin: 8mm; }
                body { margin: 10mm; font-family: Arial, Helvetica, sans-serif; }
                table { page-break-inside: auto; }
                tr { page-break-inside: avoid; page-break-after: auto; }
                img { display: inline-block; }
            </style>
        </head><body>${html}</body></html>`);
        printWindow.document.close();

        // Wait for ALL images inside the print window to fully load before printing
        const waitForImagesAndPrint = () => {
            const imgs = Array.from(printWindow.document.querySelectorAll('img'));
            if (imgs.length === 0) {
                // No images, print immediately
                setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                    printWindow.close();
                }, 200);
                return;
            }

            let resolved = false;
            const doPrint = () => {
                if (resolved) return;
                resolved = true;
                printWindow.focus();
                printWindow.print();
                printWindow.close();
            };

            // Track loading of each image
            let loadedCount = 0;
            const checkAllLoaded = () => {
                loadedCount++;
                if (loadedCount >= imgs.length) {
                    setTimeout(doPrint, 300);
                }
            };

            imgs.forEach(img => {
                if (img.complete && img.naturalWidth > 0) {
                    // Already loaded (cached)
                    checkAllLoaded();
                } else {
                    img.addEventListener('load', checkAllLoaded);
                    img.addEventListener('error', checkAllLoaded);
                }
            });

            // Safety fallback — print even if images are slow (3 seconds max)
            setTimeout(doPrint, 3000);
        };

        // Give the document a moment to parse, then wait for images
        setTimeout(waitForImagesAndPrint, 100);
    };

    const stats = {
        total: calculatedResults.length,
        passed: calculatedResults.filter(r => r.status === 'PASS').length,
        failed: calculatedResults.filter(r => r.status === 'FAIL').length,
        compartment: calculatedResults.filter(r => r.status === 'COMPARTMENT').length,
        avgPercentage: calculatedResults.length > 0
            ? calculatedResults.reduce((sum, r) => sum + r.percentage, 0) / calculatedResults.length
            : 0
    };


    return (
        <div className="page-container">
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <h1 className="page-title" onClick={() => setShowDeleteBtn(prev => !prev)} style={{ cursor: 'pointer' }}>Exam Results & Analytics</h1>
                    <p className="page-subtitle">View and publish comprehensive exam results</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {showDeleteBtn && selectedExamId && selectedClass && marksEntries?.some((m: any) => m.examId === selectedExamId && (m.classId === selectedClass || m.className === (activeClasses.find((c: any) => c.id === selectedClass)?.name))) && (
                        <button
                            onClick={handleDeleteMarks}
                            className="btn"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: '#fee2e2',
                                color: '#ef4444',
                                border: '1px solid #fca5a5',
                                borderRadius: '0.5rem',
                                padding: '0.6rem 1rem',
                                fontWeight: 600,
                            }}
                        >
                            <Trash2 size={18} />
                            Delete Marks
                        </button>
                    )}
                    <button
                        onClick={() => setNameCase(prev => prev === 'UPPER' ? 'PROPER' : 'UPPER')}
                        className="btn"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'white',
                            color: '#6366f1',
                            border: '1px solid #6366f1',
                            borderRadius: '0.5rem',
                            padding: '0.6rem 1rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>Aa</span>
                        {nameCase === 'UPPER' ? 'Upper Case' : 'Proper Case'}
                    </button>
                    <button
                        onClick={handlePrintResults}
                        className="btn"
                        disabled={!filteredResults.length}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'white',
                            color: '#6366f1',
                            border: '1px solid #6366f1',
                            borderRadius: '0.5rem',
                            padding: '0.6rem 1rem',
                            fontWeight: 600,
                            opacity: !filteredResults.length ? 0.5 : 1,
                            cursor: !filteredResults.length ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <Printer size={18} />
                        Print Results
                    </button>
                    <button
                        onClick={() => setShowPrintConfig(true)}
                        className="btn"
                        title="Print Heading Settings"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'white',
                            color: '#475569',
                            border: '1px solid #cbd5e1',
                            borderRadius: '0.5rem',
                            padding: '0.6rem 0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        <Settings size={18} />
                    </button>
                    <button
                        onClick={exportToExcel}
                        className="btn"
                        disabled={!filteredResults.length}
                        title="Sirf current class ka data export karo"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'white',
                            color: 'var(--primary)',
                            border: '1px solid var(--primary)',
                            borderRadius: '0.5rem',
                            padding: '0.6rem 1rem',
                            fontWeight: 600,
                            opacity: !filteredResults.length ? 0.5 : 1
                        }}
                    >
                        <Download size={18} />
                        Export to Excel
                    </button>
                    {/* Full Exam Export — puri exam ka sara data, har class alag sheet */}
                    <button
                        onClick={exportFullExamToExcel}
                        className="btn"
                        disabled={!selectedExamId}
                        title="Is exam ki sari classes ka data ek Excel file mein export karo (har class = alag sheet)"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: !selectedExamId ? '#f1f5f9' : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                            color: !selectedExamId ? '#94a3b8' : 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            padding: '0.6rem 1rem',
                            fontWeight: 700,
                            cursor: !selectedExamId ? 'not-allowed' : 'pointer',
                            boxShadow: selectedExamId ? '0 2px 8px -1px rgba(5,150,105,0.4)' : 'none',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <FileText size={18} />
                        Export Full Exam
                    </button>
                    <button
                        onClick={publishResults}
                        className="btn"
                        disabled={!selectedExamId || calculatedResults.length === 0}
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
                            fontSize: '0.95rem',
                            boxShadow: '0 4px 12px -2px rgba(16, 185, 129, 0.5)',
                            opacity: (!selectedExamId || calculatedResults.length === 0) ? 0.5 : 1,
                            cursor: (!selectedExamId || calculatedResults.length === 0) ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => {
                            if (selectedExamId && calculatedResults.length > 0) {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 16px -2px rgba(16, 185, 129, 0.6)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 12px -2px rgba(16, 185, 129, 0.5)';
                        }}
                    >
                        <BarChart2 size={20} />
                        Publish Results
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card" style={{ padding: '1.5rem', marginBottom: '2.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                        <label>Academic Year</label>
                        <select
                            className="input-field"
                            value={selectedAcademicYear}
                            onChange={(e) => {
                                setSelectedAcademicYear(e.target.value);
                                setSelectedExamId('');
                                setSelectedClass('');
                                setSelectedSection('');
                            }}
                        >
                            <option value="">All Years</option>
                            {schoolAcademicYears.map((yr: any) => (
                                <option key={yr.id} value={yr.id}>
                                    {yr.name}{yr.isActive ? ' (Current)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Select Exam</label>
                        <select
                            className="input-field"
                            value={selectedExamId}
                            onChange={(e) => {
                                setSelectedExamId(e.target.value);
                                setSelectedClass('');
                                setSelectedSection('');
                            }}
                        >
                            <option value="">Choose Exam</option>
                            {schoolExams.map((exam: any) => (
                                <option key={exam.id} value={exam.id}>
                                    {exam.name}{exam.displayName && exam.displayName !== exam.name ? ` (Print: ${exam.displayName})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Select Class</label>
                        <select
                            className="input-field"
                            value={selectedClass}
                            onChange={(e) => {
                                setSelectedClass(e.target.value);
                                setSelectedSection('');
                            }}
                            disabled={!selectedExamId}
                        >
                            <option value="">Choose Class</option>
                            {sortClasses(availableClasses.map((id: string) => ({ id, name: resolveClass(id) }))).map((c: any) => c.id).map((clsId: string) => (
                                <option key={clsId} value={clsId}>{resolveClass(clsId)}</option>
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
                            {(() => {
                                // Merge sections from ALL class settings documents for the resolved class name.
                                // This matches the approach in AdvancedMarksEntry to avoid missing sections
                                // when class config is split across multiple financial-year documents.
                                const resolvedName = resolveClass(selectedClass);
                                const normalizedResolved = normalizeClass(resolvedName);
                                const rawClasses = allSettings?.filter((d: any) => d.type === 'class' && d.active !== false) || [];
                                const mergedSections = new Set<string>();
                                for (const cls of rawClasses) {
                                    const clsNorm = normalizeClass(cls.name || '');
                                    if (cls.id === selectedClass || clsNorm === normalizedResolved) {
                                        // Optionally filter by exam's academic year
                                        if (selectedExam?.academicYearName && cls.financialYear && cls.financialYear !== selectedExam.academicYearName) continue;
                                        (cls.sections || []).forEach((s: string) => mergedSections.add(s));
                                    }
                                }
                                return Array.from(mergedSections).sort().map((sec: string) => (
                                    <option key={sec} value={sec}>{sec}</option>
                                ));
                            })()}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Search Student</label>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                className="input-field"
                                style={{ paddingLeft: '2.75rem' }}
                                placeholder="Name or Roll No..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {
                selectedExamId && selectedClass && calculatedResults.length > 0 && (
                    <div className="animate-fade-in">
                        {/* Stats Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
                            <div className="card" style={{ padding: '1.5rem', border: 'none', background: 'white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#3b82f6' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: '0.75rem' }}>
                                        <Users size={24} color="#3b82f6" />
                                    </div>
                                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Students</span>
                                </div>
                                <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.total}</h2>
                            </div>
                            <div className="card" style={{ padding: '1.5rem', border: 'none', background: 'white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#10b981' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '0.75rem' }}>
                                        <CheckCircle size={24} color="#10b981" />
                                    </div>
                                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Passed</span>
                                </div>
                                <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.passed}</h2>
                                <p style={{ fontSize: '0.875rem', color: '#10b981', marginTop: '0.5rem', fontWeight: 700 }}>
                                    {((stats.passed / stats.total) * 100).toFixed(1)}% Pass Rate
                                </p>
                            </div>
                            <div className="card" style={{ padding: '1.5rem', border: 'none', background: 'white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#6366f1' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.75rem', borderRadius: '0.75rem' }}>
                                        <TrendingUp size={24} color="#6366f1" />
                                    </div>
                                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Average %</span>
                                </div>
                                <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.avgPercentage.toFixed(1)}%</h2>
                            </div>
                            <div className="card" style={{ padding: '1.5rem', border: 'none', background: 'white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#ef4444' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '0.75rem' }}>
                                        <Award size={24} color="#ef4444" />
                                    </div>
                                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Failed/Comp.</span>
                                </div>
                                <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.failed + stats.compartment}</h2>
                            </div>
                        </div>

                        {/* Results Table */}
                        <div className="card" style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1rem', fontWeight: 600 }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border)' }}>
                                        <th
                                            style={{ padding: '1rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                                            onClick={() => handleSort('rollNumber')}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                Roll No
                                                {sortConfig?.key === 'rollNumber' && (
                                                    sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                                )}
                                            </div>
                                        </th>
                                        <th
                                            style={{ padding: '1rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                                            onClick={() => handleSort('studentName')}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                Student
                                                {sortConfig?.key === 'studentName' && (
                                                    sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                                )}
                                            </div>
                                        </th>
                                        {availableSubjects.map((sub: any) => {
                                            const combinedNames = sub.combinedSubjects && sub.combinedSubjects.length > 0
                                                ? ` / ${sub.combinedSubjects.join(' / ')}`
                                                : '';
                                            const isGradeBased = sub.assessmentType === 'GRADE';
                                            const hasSplit = !isGradeBased && (sub.theoryMarks > 0 && sub.practicalMarks > 0);

                                            if (hasSplit) {
                                                // Two columns for theory and practical
                                                return (
                                                    <React.Fragment key={sub.subjectId}>
                                                        <th style={{ padding: '0.75rem', textAlign: 'center', minWidth: '100px' }}>
                                                            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                                                                {sub.subjectName}{combinedNames} (Theory)
                                                            </div>
                                                            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                                                ({sub.theoryMarks} marks)
                                                            </div>
                                                        </th>
                                                        <th style={{ padding: '0.75rem', textAlign: 'center', minWidth: '100px' }}>
                                                            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                                                                {sub.subjectName}{combinedNames} (Practical)
                                                            </div>
                                                            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                                                ({sub.practicalMarks} marks)
                                                            </div>
                                                        </th>
                                                    </React.Fragment>
                                                );
                                            }

                                            return (
                                                <th key={sub.subjectId} style={{ padding: '0.75rem', textAlign: 'center', minWidth: '120px' }}>
                                                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                                                        {sub.subjectName}{combinedNames}
                                                    </div>
                                                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                                        {isGradeBased ? '(Grade)' : `(${sub.maxMarks} marks)`}
                                                    </div>
                                                </th>
                                            );
                                        })}
                                        <th
                                            style={{ padding: '1rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                                            onClick={() => handleSort('totalObtained')}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                                                Total
                                                {sortConfig?.key === 'totalObtained' && (
                                                    sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                                )}
                                            </div>
                                        </th>
                                        <th
                                            style={{ padding: '1rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                                            onClick={() => handleSort('percentage')}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                                                %
                                                {sortConfig?.key === 'percentage' && (
                                                    sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                                )}
                                            </div>
                                        </th>
                                        <th
                                            style={{ padding: '1rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                                            onClick={() => handleSort('grade')}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                                                Grade
                                                {sortConfig?.key === 'grade' && (
                                                    sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                                )}
                                            </div>
                                        </th>
                                        <th
                                            style={{ padding: '1rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                                            onClick={() => handleSort('status')}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                                                Status
                                                {sortConfig?.key === 'status' && (
                                                    sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                                )}
                                            </div>
                                        </th>
                                        <th
                                            style={{ padding: '1rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                                            onClick={() => handleSort('rank')}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                                                Rank
                                                {sortConfig?.key === 'rank' && (
                                                    sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                                )}
                                            </div>
                                        </th>
                                        <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredResults.map((res) => (
                                        <tr key={res.studentId} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover-highlight">
                                            <td style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                                {res.rollNumber}
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                                                    {nameCase === 'UPPER' ? (res.studentName || '').toUpperCase() : toProperCase(res.studentName || '')}
                                                </div>
                                            </td>
                                            {availableSubjects.map((sub: any) => {
                                                const isGradeBased = sub.assessmentType === 'GRADE';
                                                const hasSplit = !isGradeBased && (sub.theoryMarks > 0 && sub.practicalMarks > 0);

                                                if (hasSplit) {
                                                    // Find the marks entry to get theory and practical separately
                                                    const upSubjectName = (sub.subjectName || sub.name).toUpperCase().trim();
                                                    const cleanUpSubjectName = upSubjectName.replace(/[\s.]/g, '');

                                                    // Find the student to get their section
                                                    const currentStudent = studentList?.find((s: any) => s.id === res.studentId);
                                                    const entry = findMarksEntry(currentStudent, sub, examMarks);
                                                    const studentMark = entry?.marks?.find((sm: any) => sm.studentId === res.studentId);
                                                    const isAbsent = studentMark?.isAbsent || false;
                                                    const theoryVal = isAbsent ? 'AB' : (studentMark?.theoryMarks || 0);
                                                    const practicalVal = isAbsent ? 'AB' : (studentMark?.practicalMarks || 0);

                                                    const theoryFailed = !isAbsent && typeof theoryVal === 'number' && theoryVal < (sub.theoryMarks * 0.33);
                                                    const practicalFailed = !isAbsent && typeof practicalVal === 'number' && practicalVal < (sub.practicalMarks * 0.33);

                                                    return (
                                                        <React.Fragment key={sub.subjectId}>
                                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                                <span style={{
                                                                    color: isAbsent ? '#ef4444' : (theoryFailed ? '#ef4444' : 'inherit'),
                                                                    fontWeight: 800,
                                                                    fontStyle: isAbsent ? 'italic' : 'normal'
                                                                }}>
                                                                    {theoryVal}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                                <span style={{
                                                                    color: isAbsent ? '#ef4444' : (practicalFailed ? '#ef4444' : 'inherit'),
                                                                    fontWeight: 800,
                                                                    fontStyle: isAbsent ? 'italic' : 'normal'
                                                                }}>
                                                                    {practicalVal}
                                                                </span>
                                                            </td>
                                                        </React.Fragment>
                                                    );
                                                }

                                                const val = res.marks[sub.subjectId];
                                                const isAbsent = val === 'AB';
                                                const isNA = val === 'NA';
                                                const isGrade = typeof val === 'string' && val !== 'AB' && val !== 'NA';
                                                const passThreshold = (sub.maxMarks * (sub.passingMarks || 0)) / 100;
                                                const isFailed = !isGrade && !isAbsent && !isNA && typeof val === 'number' && val < passThreshold;

                                                return (
                                                    <td key={sub.subjectId} style={{
                                                        padding: '1rem',
                                                        textAlign: 'center',
                                                        fontWeight: 800,
                                                        color: isAbsent ? '#ef4444' : (isNA ? 'var(--text-muted)' : (isFailed ? '#ef4444' : 'inherit'))
                                                    }}>
                                                        <span style={{ fontStyle: isAbsent ? 'italic' : 'normal' }}>
                                                            {val}
                                                        </span>
                                                    </td>
                                                );
                                            })}
                                            <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 800, color: 'var(--primary)' }}>
                                                {res.totalObtained}/{res.totalMax}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 800, color: res.percentage >= 33 ? '#10b981' : '#ef4444' }}>
                                                {res.percentage.toFixed(1)}%
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 800 }}>
                                                {res.grade}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <span style={{
                                                    padding: '0.35rem 0.75rem',
                                                    borderRadius: '2rem',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 900,
                                                    background: res.status === 'PASS' ? '#ecfdf5' : '#fef2f2',
                                                    color: res.status === 'PASS' ? '#10b981' : '#ef4444'
                                                }}>
                                                    {res.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                {res.rank <= 3 ? (
                                                    <div style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '50%',
                                                        background: res.rank === 1 ? '#fbbf24' : res.rank === 2 ? '#9ca3af' : '#b45309',
                                                        color: 'white',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontWeight: 800,
                                                        fontSize: '0.75rem'
                                                    }}>
                                                        {res.rank}
                                                    </div>
                                                ) : <span style={{ fontWeight: 800 }}>{res.rank}</span>}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => {
                                                        navigate('../advanced-marks-entry', {
                                                            state: {
                                                                preSelectedExam: selectedExamId,
                                                                preSelectedClass: selectedClass,
                                                                preSelectedSection: selectedSection || '',
                                                                editStudentId: res.studentId
                                                            }
                                                        });
                                                    }}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.375rem',
                                                        background: '#f3f4f6',
                                                        color: '#6366f1',
                                                        border: '1px solid #e5e7eb',
                                                        padding: '0.375rem 0.75rem',
                                                        borderRadius: '0.375rem',
                                                        fontSize: '0.8125rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = '#6366f1';
                                                        e.currentTarget.style.color = 'white';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = '#f3f4f6';
                                                        e.currentTarget.style.color = '#6366f1';
                                                    }}
                                                >
                                                    <Edit size={14} />
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }

            {
                selectedExamId && selectedClass && calculatedResults.length === 0 && (
                    <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
                        <Users size={64} style={{ margin: '0 auto', color: 'var(--text-muted)', marginBottom: '1.5rem' }} />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>No Results Calculated</h3>
                        <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '1rem auto' }}>
                            Make sure marks have been entered and approved for all subjects of this exam and class.
                        </p>
                    </div>
                )
            }

            {/* ===== HIDDEN PRINT-ONLY SECTION ===== */}
            <div ref={printRef} data-print-section style={{ display: 'none' }}>
                {/* School Header */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    marginBottom: '8px',
                    borderBottom: '2px solid #1e40af',
                    paddingBottom: '6px',
                    position: 'relative'
                }}>
                    {printHeaderConfig.showLogo && (currentSchool?.logoUrl || currentSchool?.logo) && (
                        <div style={{ position: 'absolute', left: '0', top: '0', width: '80px', display: 'flex', justifyContent: 'flex-start' }}>
                            <img src={currentSchool?.logoUrl || currentSchool?.logo} alt="School Logo" style={{ height: '70px', maxWidth: '80px', objectFit: 'contain' }} />
                        </div>
                    )}
                    <div style={{ textAlign: 'center', width: '100%' }}>
                        {printHeaderConfig.showSchoolName && (
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, color: '#1e40af', textTransform: 'uppercase', lineHeight: 1 }}>
                                {currentSchool?.fullName || currentSchool?.name}
                            </h1>
                        )}
                        {printHeaderConfig.showRunAndManagedBy && (currentSchool as any)?.runAndManagedBy && (
                            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#475569', fontWeight: 600 }}>
                                Run & Managed By: {(currentSchool as any).runAndManagedBy}
                            </p>
                        )}
                        {printHeaderConfig.showSubtitle && schoolSubtitle && (
                            <div style={{
                                margin: '2px 0',
                                fontSize: '10px',
                                color: '#475569',
                                lineHeight: 1.3,
                                whiteSpace: 'pre-line'
                            }}>
                                {schoolSubtitle}
                            </div>
                        )}
                        {printHeaderConfig.showAddress && currentSchool?.address && (
                            <p style={{ margin: '2px 0', fontSize: '10px', color: '#64748b', fontWeight: 500 }}>
                                {currentSchool.address}
                            </p>
                        )}
                        {/* UDISE Code & School Code */}
                        {(printHeaderConfig.showUdiseCode || printHeaderConfig.showSchoolCode) && (
                            <p style={{ margin: '1px 0', fontSize: '9px', color: '#475569', fontWeight: 600 }}>
                                {[printHeaderConfig.showUdiseCode && (currentSchool as any)?.udiseCode ? `UDISE: ${(currentSchool as any).udiseCode}` : '',
                                printHeaderConfig.showSchoolCode && (currentSchool as any)?.schoolCode ? `School Code: ${(currentSchool as any).schoolCode}` : ''
                                ].filter(Boolean).join('  |  ')}
                            </p>
                        )}
                        {/* Inline info line: Phone, Email, Website */}
                        {(printHeaderConfig.showPhone || printHeaderConfig.showEmail || printHeaderConfig.showWebsite) && (
                            <p style={{ margin: '1px 0', fontSize: '9px', color: '#64748b', fontWeight: 500 }}>
                                {[printHeaderConfig.showPhone && currentSchool?.phone ? `Phone: ${currentSchool.phone}` : '',
                                printHeaderConfig.showEmail && currentSchool?.email ? `Email: ${currentSchool.email}` : '',
                                printHeaderConfig.showWebsite && (currentSchool?.website || (currentSchool as any)?.web) ? `Web: ${currentSchool?.website || (currentSchool as any)?.web}` : ''
                                ].filter(Boolean).join('  |  ')}
                            </p>
                        )}
                        {(() => {
                            // Compute exam date range from classRoutines for the selected class
                            const classRoutine = selectedExam?.classRoutines?.find((cr: any) =>
                                cr.classId === selectedClass || cr.className === getClassName(selectedClass)
                            );
                            const examDates = (classRoutine?.routine || selectedExam?.subjects || [])
                                .map((entry: any) => entry.examDate)
                                .filter((d: string) => d)
                                .sort();
                            const firstDate = examDates.length > 0 ? examDates[0] : selectedExam?.startDate;
                            const lastDate = examDates.length > 1 ? examDates[examDates.length - 1] : (selectedExam?.endDate || firstDate);
                            const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                            const examName = selectedExam?.displayName || selectedExam?.name || 'Exam Results';
                            const dateStr = firstDate ? (lastDate && lastDate !== firstDate ? `${fmt(firstDate)} to ${fmt(lastDate)}` : fmt(firstDate)) : '';
                            return (
                                <p style={{ margin: '4px 0 0', fontSize: '15px', fontWeight: 900, color: '#000', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    {examName}{dateStr ? ` - ${dateStr}` : ''}
                                </p>
                            );
                        })()}
                        <p style={{ margin: '4px 0 0', fontSize: '13px', fontWeight: 900, color: '#000' }}>
                            Class: {formatClassName(getClassName(selectedClass), true)}{selectedSection ? ` - Section: ${selectedSection}` : ''}
                        </p>
                    </div>
                </div>

                {/* Results Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '6px' }}>
                    <thead>
                        <tr style={{ background: '#f1f5f9' }}>
                            <th style={{ border: '2px solid #000', padding: '5px 3px', textAlign: 'center', fontWeight: 900, fontSize: '11px', color: '#000' }}>Roll No</th>
                            <th style={{ border: '2px solid #000', padding: '5px 3px', textAlign: 'left', fontWeight: 900, fontSize: '11px', color: '#000' }}>Student Name</th>
                            {availableSubjects.map((sub: any) => {
                                const combinedNames = sub.combinedSubjects && sub.combinedSubjects.length > 0
                                    ? ` / ${sub.combinedSubjects.join(' / ')}`
                                    : '';
                                const isGradeBased = sub.assessmentType === 'GRADE';
                                return (
                                    <th key={sub.subjectId} style={{ border: '2px solid #000', padding: '5px 2px', textAlign: 'center', fontWeight: 900, fontSize: '10px', minWidth: '40px', color: '#000' }}>
                                        {sub.subjectName}{combinedNames}
                                        <div style={{ fontSize: '9px', color: '#000', fontWeight: 700 }}>
                                            {isGradeBased ? '(Grade)' : `(${sub.maxMarks})`}
                                        </div>
                                    </th>
                                );
                            })}
                            <th style={{ border: '2px solid #000', padding: '5px 3px', textAlign: 'center', fontWeight: 900, fontSize: '11px', color: '#000' }}>Total</th>
                            <th style={{ border: '2px solid #000', padding: '5px 3px', textAlign: 'center', fontWeight: 900, fontSize: '11px', color: '#000' }}>%</th>
                            <th style={{ border: '2px solid #000', padding: '5px 3px', textAlign: 'center', fontWeight: 900, fontSize: '11px', color: '#000' }}>Grade</th>
                            <th style={{ border: '2px solid #000', padding: '5px 2px', textAlign: 'center', fontWeight: 900, fontSize: '10px', color: '#000', maxWidth: '52px' }}>Status</th>
                            <th style={{ border: '2px solid #000', padding: '5px 3px', textAlign: 'center', fontWeight: 900, fontSize: '11px', color: '#000' }}>Rank</th>
                            <th style={{ border: '2px solid #000', padding: '5px 3px', textAlign: 'center', fontWeight: 900, fontSize: '11px', minWidth: '100px', color: '#000' }}>Parent's Sign</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredResults.map((res, idx) => (
                            <tr key={res.studentId} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                <td style={{ border: '2px solid #000', padding: '4px', textAlign: 'center', fontSize: '11px', fontWeight: 900, color: '#000' }}>{res.rollNumber}</td>
                                <td style={{ border: '2px solid #000', padding: '4px 6px', textAlign: 'left', fontWeight: 900, fontSize: '11px', whiteSpace: 'nowrap', color: '#000' }}>{res.studentName}</td>
                                {availableSubjects.map((sub: any) => {
                                    const val = res.marks[sub.subjectId];
                                    const isAbsent = val === 'AB';
                                    const isNA = val === 'NA';
                                    const isGradeBased = sub.assessmentType === 'GRADE';
                                    // Underline if numeric marks are below passing threshold (33%)
                                    const passThreshold = (sub.maxMarks * (sub.passingMarks || 33)) / 100;
                                    const isFailing = !isGradeBased && !isAbsent && !isNA && typeof val === 'number' && val < passThreshold;
                                    return (
                                        <td key={sub.subjectId} style={{
                                            border: '2px solid #000',
                                            padding: '4px',
                                            textAlign: 'center',
                                            fontSize: '11px',
                                            fontWeight: 900,
                                            color: isAbsent ? '#ef4444' : (isNA ? '#6b7280' : '#000'),
                                            fontStyle: isAbsent ? 'italic' : 'normal',
                                            textDecoration: isFailing ? 'underline' : 'none',
                                            textDecorationStyle: isFailing ? 'solid' : undefined,
                                            textUnderlineOffset: isFailing ? '2px' : undefined,
                                        }}>
                                            {val}
                                        </td>
                                    );
                                })}
                                <td style={{ border: '2px solid #000', padding: '4px', textAlign: 'center', fontWeight: 900, fontSize: '11px', color: '#000' }}>
                                    {res.totalObtained}/{res.totalMax}
                                </td>
                                <td style={{ border: '2px solid #000', padding: '4px', textAlign: 'center', fontWeight: 900, fontSize: '11px', color: res.percentage >= 33 ? '#059669' : '#000' }}>
                                    {res.percentage.toFixed(1)}%
                                </td>
                                <td style={{ border: '2px solid #000', padding: '4px', textAlign: 'center', fontWeight: 900, fontSize: '11px', color: '#000' }}>
                                    {res.grade}
                                </td>
                                <td style={{ border: '2px solid #000', padding: '4px', textAlign: 'center', fontWeight: 900, fontSize: '10px', color: res.status === 'PASS' ? '#059669' : '#000', maxWidth: '52px' }}>
                                    {res.status === 'COMPARTMENT' ? 'COMPART' : res.status}
                                </td>
                                <td style={{ border: '2px solid #000', padding: '4px', textAlign: 'center', fontWeight: 900, fontSize: '11px', color: '#000' }}>
                                    {res.rank}
                                </td>
                                <td style={{ border: '2px solid #000', padding: '4px', textAlign: 'center', fontSize: '11px', minWidth: '100px', fontWeight: 900, color: '#000' }}></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Footer: Class Teacher + Principal */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    marginTop: '50px',
                    paddingTop: '0px'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ borderTop: '2px solid #000', paddingTop: '6px', minWidth: '180px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 900, color: '#000' }}>Class Teacher</span>
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        {principalSignatureUrl && (
                            <img src={principalSignatureUrl} alt="Principal Signature" style={{ height: `${signatureHeight}px`, objectFit: 'contain', marginBottom: '2px', display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
                        )}
                        <div style={{ borderTop: '2px solid #000', paddingTop: '6px', minWidth: '180px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 900, color: '#000' }}>Principal</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            {/* Print styles no longer needed - using new window approach */}

            {/* ===== PRINT HEADER SETTINGS MODAL ===== */}
            {
                showPrintConfig && (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.45)',
                        zIndex: 10000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1rem'
                    }} onClick={() => setShowPrintConfig(false)}>
                        <div
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: 'white',
                                borderRadius: '1rem',
                                padding: '1.75rem',
                                width: '100%',
                                maxWidth: '440px',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                                maxHeight: '90vh',
                                overflowY: 'auto'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Settings size={20} color="#6366f1" />
                                    Print Heading Settings
                                </h3>
                                <button onClick={() => setShowPrintConfig(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem', lineHeight: 1.5 }}>
                                Select which Institution Info fields should appear in the print heading.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                                {[
                                    { key: 'showLogo', label: 'School Logo', icon: '🖼️' },
                                    { key: 'showSchoolName', label: 'School Name', icon: '🏫' },
                                    { key: 'showSubtitle', label: 'Subtitle / Affiliation', icon: '📝' },
                                    { key: 'showAddress', label: 'Address', icon: '📍' },
                                    { key: 'showPhone', label: 'Phone Number', icon: '📞' },
                                    { key: 'showEmail', label: 'Email', icon: '📧' },
                                    { key: 'showWebsite', label: 'Website', icon: '🌐' },
                                    { key: 'showUdiseCode', label: 'UDISE Code', icon: '🆔' },
                                    { key: 'showSchoolCode', label: 'School Code', icon: '🔢' },
                                    { key: 'showRunAndManagedBy', label: 'Run and Managed By', icon: '🏛️' }
                                ].map(item => (
                                    <label
                                        key={item.key}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.625rem 0.875rem',
                                            borderRadius: '0.625rem',
                                            border: `1px solid ${(printHeaderConfig as any)[item.key] ? '#c7d2fe' : '#e2e8f0'}`,
                                            background: (printHeaderConfig as any)[item.key] ? '#eef2ff' : '#f8fafc',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={(printHeaderConfig as any)[item.key]}
                                            onChange={e => updatePrintConfig(item.key, e.target.checked)}
                                            style={{ width: '1.125rem', height: '1.125rem', accentColor: '#6366f1', flexShrink: 0 }}
                                        />
                                        <span style={{ fontSize: '0.925rem' }}>{item.icon}</span>
                                        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>{item.label}</span>
                                    </label>
                                ))}
                            </div>
                            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
                                <button
                                    onClick={() => {
                                        const allOn: any = {};
                                        ['showLogo', 'showSchoolName', 'showSubtitle', 'showAddress', 'showPhone', 'showEmail', 'showWebsite', 'showUdiseCode', 'showSchoolCode', 'showRunAndManagedBy'].forEach(k => allOn[k] = true);
                                        setPrintHeaderConfig(allOn);
                                        localStorage.setItem(printConfigKey, JSON.stringify(allOn));
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        borderRadius: '0.5rem',
                                        border: '1px solid #e2e8f0',
                                        background: 'white',
                                        fontWeight: 600,
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        color: '#475569'
                                    }}
                                >
                                    Select All
                                </button>
                                <button
                                    onClick={() => {
                                        const allOff: any = {};
                                        ['showLogo', 'showSchoolName', 'showSubtitle', 'showAddress', 'showPhone', 'showEmail', 'showWebsite', 'showUdiseCode', 'showSchoolCode', 'showRunAndManagedBy'].forEach(k => allOff[k] = false);
                                        setPrintHeaderConfig(allOff);
                                        localStorage.setItem(printConfigKey, JSON.stringify(allOff));
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        borderRadius: '0.5rem',
                                        border: '1px solid #e2e8f0',
                                        background: 'white',
                                        fontWeight: 600,
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        color: '#475569'
                                    }}
                                >
                                    Deselect All
                                </button>
                            </div>
                            <button
                                onClick={() => setShowPrintConfig(false)}
                                style={{
                                    marginTop: '0.75rem',
                                    width: '100%',
                                    padding: '0.625rem',
                                    borderRadius: '0.5rem',
                                    border: 'none',
                                    background: '#6366f1',
                                    color: 'white',
                                    fontWeight: 700,
                                    fontSize: '0.9rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default ExamResultsDashboard;
