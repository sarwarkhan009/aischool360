import React, { useState, useMemo, useEffect } from 'react';
import { where } from 'firebase/firestore';
import {
    Download,
    Eye,
    Printer,
    Layout,
    Users,
    Award,
    TrendingUp,
    CheckCircle,
    X,
    FileText,
    BarChart3,
    Settings,
    ChevronDown,
    Star,
    Layers,
    PlusCircle,
    Trash2,
    GripVertical,
    Copy
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';
import { sortClasses } from '../../constants/app';
import { Link, useParams } from 'react-router-dom';
import { formatClassName, resolveClassName, subjectMatches } from '../../utils/formatters';

type ReportMode = 'single' | 'combined';

interface SelectedExam {
    id: string;
    name: string;
    displayName: string;
    termName: string;
    order: number;
}

const PrintReportCard2: React.FC = () => {
    const { schoolId } = useParams<{ schoolId: string }>();
    const { currentSchool } = useSchool();
    const { data: exams } = useFirestore<any>('exams');
    const { data: marksEntries } = useFirestore<any>('marks_entries');
    const { data: students } = useFirestore<any>('students');
    const { data: allSettings } = useFirestore<any>('settings');
    const { data: gradingSystems } = useFirestore<any>('grading_systems');
    const { data: academicYears } = useFirestore<any>('academic_years');

    // Report Card Configuration Persistence
    const { data: reportConfigs, add: addConfig, update: updateConfig } = useFirestore<any>('settings', [
        where('type', '==', 'report_card_config'),
        where('schoolId', '==', currentSchool?.id || '')
    ]);
    const reportConfig = reportConfigs?.[0];

    const activeClasses = sortClasses(allSettings?.filter((d: any) => d.type === 'class' && d.active !== false) || []);

    // Report Mode: single or combined
    const [reportMode, setReportMode] = useState<ReportMode>('single');

    // Single exam selection
    const [selectedExamId, setSelectedExamId] = useState('');

    // Combined exam selection
    const [selectedExams, setSelectedExams] = useState<SelectedExam[]>([]);
    const [examToAdd, setExamToAdd] = useState('');

    // Filters
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [selectedAcademicYear, setSelectedAcademicYear] = useState('');

    // Display options
    const [showPreview, setShowPreview] = useState(false);
    const [includeGraphs, setIncludeGraphs] = useState(true);
    const [includeRemarks, setIncludeRemarks] = useState(true);
    const [showGrandTotal, setShowGrandTotal] = useState(true);
    const [showStudentImage, setShowStudentImage] = useState(true);
    const [showOverallPercentage, setShowOverallPercentage] = useState(true);
    const [showOverallGrade, setShowOverallGrade] = useState(true);
    const [accentColor, setAccentColor] = useState('#1e40af');

    // School subtitle settings
    const [schoolSubtitle, setSchoolSubtitle] = useState('');
    const [subtitleFontSize, setSubtitleFontSize] = useState(12);

    // New features state
    const [enableWatermark, setEnableWatermark] = useState(false);
    const [watermarkSize, setWatermarkSize] = useState(100); // Watermark size in percentage
    const [principalSignatureUrl, setPrincipalSignatureUrl] = useState('');
    const [signatureHeight, setSignatureHeight] = useState(40); // Signature height in pixels
    const [showResultStatus, setShowResultStatus] = useState(true); // Pass/Fail
    const [showRank, setShowRank] = useState(true); // Rank 1-10 only
    const [subjectOrdering, setSubjectOrdering] = useState<Record<string, string[]>>({}); // examId -> ordered subject names
    const [managingSubjectsForExam, setManagingSubjectsForExam] = useState<string | null>(null);
    const [printSortMode, setPrintSortMode] = useState<'percentage' | 'roll'>('roll'); // Print sorting order
    const [examWeightages, setExamWeightages] = useState<Record<string, number>>({}); // examId -> weightage %

    // Student fields visibility
    const [studentFields, setStudentFields] = useState({
        name: true,
        class: true,
        rollNo: true,
        fatherName: true,
        admissionNo: false,
        dob: false,
        motherName: false,
        address: false,
        mobile: false
    });

    const schoolExams = exams?.filter((e: any) => e.schoolId === currentSchool?.id && e.status !== 'CANCELLED') || [];
    const schoolYears = academicYears?.filter((y: any) => y.schoolId === currentSchool?.id) || [];
    const defaultGrading = gradingSystems?.find((g: any) => g.schoolId === currentSchool?.id && g.isDefault) || gradingSystems?.find((g: any) => g.schoolId === currentSchool?.id);

    // Load persistent config
    useEffect(() => {
        if (reportConfig) {
            setSchoolSubtitle(reportConfig.subtitle || '');
            setSubtitleFontSize(reportConfig.subtitleFontSize || 12);
            setEnableWatermark(reportConfig.enableWatermark || false);
            setWatermarkSize(reportConfig.watermarkSize || 100);
            setPrincipalSignatureUrl(reportConfig.principalSignatureUrl || currentSchool?.principalSignatureUrl || '');
            setSignatureHeight(reportConfig.signatureHeight || 40);
            setSubjectOrdering(reportConfig.subjectOrdering || {});
            if (reportConfig.examWeightages) setExamWeightages(reportConfig.examWeightages);

            // New options to persist
            if (reportConfig.includeGraphs !== undefined) setIncludeGraphs(reportConfig.includeGraphs);
            if (reportConfig.includeRemarks !== undefined) setIncludeRemarks(reportConfig.includeRemarks);
            if (reportConfig.showGrandTotal !== undefined) setShowGrandTotal(reportConfig.showGrandTotal);
            if (reportConfig.showStudentImage !== undefined) setShowStudentImage(reportConfig.showStudentImage);
            if (reportConfig.showOverallPercentage !== undefined) setShowOverallPercentage(reportConfig.showOverallPercentage);
            if (reportConfig.showOverallGrade !== undefined) setShowOverallGrade(reportConfig.showOverallGrade);
            if (reportConfig.accentColor) setAccentColor(reportConfig.accentColor);
            if (reportConfig.showResultStatus !== undefined) setShowResultStatus(reportConfig.showResultStatus);
            if (reportConfig.showRank !== undefined) setShowRank(reportConfig.showRank);
            if (reportConfig.studentFields) setStudentFields(reportConfig.studentFields);
        }
        // Also load from school data if not in config
        if (currentSchool?.enableWatermark !== undefined && !reportConfig) setEnableWatermark(currentSchool.enableWatermark);
        if (currentSchool?.principalSignatureUrl && !reportConfig) setPrincipalSignatureUrl(currentSchool.principalSignatureUrl);
    }, [reportConfig, currentSchool]);

    // Auto-select current academic year
    useEffect(() => {
        if (!selectedAcademicYear && schoolYears.length > 0) {
            const activeYear = schoolYears.find((y: any) => y.isActive);
            if (activeYear) {
                setSelectedAcademicYear(activeYear.id);
            }
        }
    }, [schoolYears]);

    const handleSaveConfig = async () => {
        try {
            const configData = {
                subtitle: schoolSubtitle,
                subtitleFontSize,
                enableWatermark,
                watermarkSize,
                principalSignatureUrl,
                signatureHeight,
                subjectOrdering,
                examWeightages,
                includeGraphs,
                includeRemarks,
                showGrandTotal,
                showStudentImage,
                showOverallPercentage,
                showOverallGrade,
                accentColor,
                showResultStatus,
                showRank,
                studentFields,
                schoolId: currentSchool?.id
            };

            if (reportConfig) {
                await updateConfig(reportConfig.id, {
                    ...configData,
                    updatedAt: new Date().toISOString()
                });
            } else {
                await addConfig({
                    type: 'report_card_config',
                    ...configData,
                    createdAt: new Date().toISOString()
                });
            }
            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Error saving config:', error);
            alert('Failed to save settings');
        }
    };

    // Handle signature file upload
    const handleSignatureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Check if file is an image
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Check file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert('File size should be less than 2MB');
            return;
        }

        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setPrincipalSignatureUrl(base64String);
        };
        reader.readAsDataURL(file);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            const day = String(date.getDate()).padStart(2, '0');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = months[date.getMonth()];
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        } catch {
            return dateStr;
        }
    };

    // Filter exams by academic year
    const filteredExams = selectedAcademicYear
        ? schoolExams.filter((e: any) => e.academicYearId === selectedAcademicYear)
        : schoolExams;

    // Get class name from ID
    const getClassName = (classId: string) => {
        const cls = activeClasses.find((c: any) => c.id === classId || c.name === classId);
        return cls?.name || classId;
    };

    // Get subjects for an exam (handles classRoutines)
    const getExamSubjects = (exam: any) => {
        if (!exam) return [];
        const classRoutine = exam.classRoutines?.find((cr: any) =>
            cr.classId === selectedClass || cr.className === getClassName(selectedClass)
        );
        return (classRoutine && classRoutine.routine && classRoutine.routine.length > 0)
            ? classRoutine.routine
            : (exam.subjects || []);
    };

    // Filter students
    const filteredStudents = useMemo(() => {
        if (!students || !currentSchool || !selectedClass) return [];

        const selectedClassObj = activeClasses.find((c: any) => c.id === selectedClass);
        const selectedClassName = selectedClassObj?.name;

        // Resolve selected academic year name (e.g. "2025-2026") for session matching
        const selectedYearName = selectedAcademicYear
            ? schoolYears.find((y: any) => y.id === selectedAcademicYear)?.name
            : null;

        const filtered = students.filter((s: any) =>
            s.schoolId === currentSchool?.id &&
            s.status === 'ACTIVE' &&
            (s.class === selectedClass || s.class === selectedClassName) &&
            (!selectedSection || s.section === selectedSection) &&
            // Filter by academic year via student's 'session' field (same logic as StudentManagement)
            (selectedYearName ? s.session === selectedYearName : true)
        );

        // Sort based on printSortMode
        if (printSortMode === 'percentage') {
            return [...filtered].sort((a, b) => {
                const aRoll = parseInt(a.classRollNo || a.rollNo || '999');
                const bRoll = parseInt(b.classRollNo || b.rollNo || '999');
                return bRoll - aRoll;
            });
        } else {
            return [...filtered].sort((a, b) => {
                const aRoll = parseInt(a.classRollNo || a.rollNo || '999');
                const bRoll = parseInt(b.classRollNo || b.rollNo || '999');
                return aRoll - bRoll;
            });
        }
    }, [students, currentSchool, selectedClass, selectedSection, selectedAcademicYear, schoolYears, activeClasses, printSortMode]);

    // Add exam to combined selection
    const handleAddExam = () => {
        if (!examToAdd) return;
        const exam = schoolExams.find((e: any) => e.id === examToAdd);
        if (!exam || selectedExams.find(se => se.id === exam.id)) return;

        setSelectedExams(prev => [...prev, {
            id: exam.id,
            name: exam.name,
            displayName: exam.displayName || exam.name,
            termName: exam.termName || '',
            order: prev.length
        }]);
        setExamToAdd('');
    };

    // Remove exam from combined selection
    const handleRemoveExam = (examId: string) => {
        setSelectedExams(prev => prev.filter(e => e.id !== examId).map((e, idx) => ({ ...e, order: idx })));
    };

    // Move exam order
    const moveExam = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= selectedExams.length) return;

        setSelectedExams(prev => {
            const updated = [...prev];
            const temp = updated[index];
            updated[index] = { ...updated[newIndex], order: index };
            updated[newIndex] = { ...temp, order: newIndex };
            return updated.sort((a, b) => a.order - b.order);
        });
    };

    // Get student results for a specific exam
    const getStudentExamResult = (studentId: string, examId: string) => {
        const exam = schoolExams.find((e: any) => e.id === examId);
        if (!exam) return null;

        const selectedClassObj = activeClasses.find((c: any) => c.id === selectedClass);
        const selectedClassName = selectedClassObj?.name;

        // Pre-filter potential entries for this exam and class
        const allPotentialMarks = marksEntries?.filter((entry: any) =>
            entry.examId === examId &&
            (entry.status === 'APPROVED' || entry.status === 'SUBMITTED') &&
            (entry.classId === selectedClass || entry.className === selectedClassName || entry.class === selectedClass || entry.class === selectedClassName)
        ) || [];

        const subjectsResults: any = {};
        let totalObtained = 0;
        let totalMax = 0;

        // Iterate over exam definition to ensure all subjects are included even if marks are missing
        getExamSubjects(exam).forEach((sub: any) => {
            const subId = sub.subjectId;
            // Find ALL entries that match this subject (ID or Fuzzy Name)
            const subjectEntries = allPotentialMarks.filter(m => {
                if (m.subjectId === subId) return true;
                const mSubName = m.subjectName || '';
                return subjectMatches(mSubName, sub.subjectName || sub.name || '', sub.combinedSubjects);
            });

            // Robust search: Find the best matching entry for this student
            let bestMark: any = null;
            for (const entry of subjectEntries) {
                const sm = entry.marks?.find((m: any) => m.studentId === studentId);
                if (!sm) continue;

                // Priority: (Has Marks > No Marks) AND (Matches Section > No Section Match)
                const hasMarks = (sm.obtainedMarks !== undefined && sm.obtainedMarks > 0) || (sm.theoryMarks !== undefined && sm.theoryMarks > 0) || sm.grade || sm.isAbsent || sm.isNA;
                const isSectionMatch = !selectedSection || entry.sectionId === selectedSection || entry.sectionName === selectedSection;

                if (!bestMark || (hasMarks && !bestMark.hasMarks) || (isSectionMatch && !bestMark.isSectionMatch)) {
                    bestMark = { sm, hasMarks, isSectionMatch };
                }

                if (hasMarks && isSectionMatch) break; // Found exact match with data
            }

            const studentMark = bestMark?.sm;
            const isAbsent = studentMark?.isAbsent || false;
            const isNA = studentMark?.isNA || false;
            const isGradeOnly = sub.assessmentType === 'GRADE';
            const obtained = isNA ? 'NA' : (isAbsent ? 'AB' : (isGradeOnly ? (studentMark?.grade || '-') : (studentMark?.obtainedMarks ?? 0)));

            // If the subject is not split, we treat the total obtained as theory for display
            const isSplit = (sub.theoryMarks || 0) > 0 || (sub.practicalMarks || 0) > 0;
            const theoryMax = isSplit ? (sub.theoryMarks || 0) : (sub.maxMarks || 0);
            const practicalMax = sub.practicalMarks || 0;

            let theoryObt: any = studentMark?.theoryMarks ?? 0;
            let practicalObt: any = studentMark?.practicalMarks ?? 0;

            // Robust fallback: if split fields are 0 but total obtained is > 0, map to the non-zero component
            if (isSplit && theoryObt === 0 && practicalObt === 0 && typeof obtained === 'number' && obtained > 0) {
                if (theoryMax > 0 && practicalMax === 0) theoryObt = obtained;
                else if (practicalMax > 0 && theoryMax === 0) practicalObt = obtained;
                else theoryObt = obtained;
            } else if (!isSplit) {
                theoryObt = typeof obtained === 'number' ? obtained : 0;
                practicalObt = 0;
            }

            // Detailed marks info
            const res = {
                obtained,
                theory: isNA ? 'NA' : (isAbsent ? 'AB' : (isGradeOnly ? '' : theoryObt)),
                practical: isNA ? 'NA' : (isAbsent ? 'AB' : (isGradeOnly ? '' : practicalObt)),
                max: sub.maxMarks || 0,
                theoryMax,
                practicalMax,
                grade: '-',
                remark: '-',
                isAbsent,
                isNA,
                isGradeOnly,
                assessmentType: sub.assessmentType,
                displayName: (sub.subjectName || sub.name) + (sub.combinedSubjects && sub.combinedSubjects.length > 0 ? ` / ${sub.combinedSubjects.join(' / ')}` : '')
            };

            if (!isGradeOnly && !isAbsent && typeof res.obtained === 'number' && res.max > 0) {
                const subPercentage = (res.obtained / res.max) * 100;
                res.grade = getGrade(subPercentage);
                res.remark = getRemark(subPercentage);
            } else if (isGradeOnly) {
                res.grade = studentMark?.grade || '-';
                res.remark = studentMark?.remarks || '-';
            }

            subjectsResults[sub.subjectName] = res;

            if (!isGradeOnly && !isNA) {
                totalObtained += (typeof res.obtained === 'number' ? res.obtained : 0);
                totalMax += res.max;
            }
        });

        const percentage = totalMax > 0 ? (Number(totalObtained) / Number(totalMax)) * 100 : 0;

        return {
            subjects: subjectsResults,
            totalObtained,
            totalMax,
            percentage: percentage.toFixed(2),
            grade: getGrade(percentage)
        };
    };

    const getGrade = (percentage: number) => {
        if (!defaultGrading?.ranges) return '-';
        const range = defaultGrading.ranges.find((r: any) => Math.round(percentage) >= r.min && Math.round(percentage) <= r.max) ||
            defaultGrading.ranges.find((r: any) => percentage >= r.min && percentage <= r.max);
        return range?.grade || '-';
    };

    const getRemark = (percentage: number) => {
        if (!defaultGrading?.ranges) return '-';
        const range = defaultGrading.ranges.find((r: any) => Math.round(percentage) >= r.min && Math.round(percentage) <= r.max) ||
            defaultGrading.ranges.find((r: any) => percentage >= r.min && percentage <= r.max);
        return range?.description || range?.remarks || range?.remark || '-';
    };

    // Get all unique subjects across selected exams
    const getAllSubjects = () => {
        const subjectMap = new Map<string, any>();
        const examsToCheck = reportMode === 'single'
            ? [schoolExams.find((e: any) => e.id === selectedExamId)]
            : selectedExams.map(se => schoolExams.find((e: any) => e.id === se.id));

        examsToCheck.forEach(exam => {
            getExamSubjects(exam).forEach((s: any) => {
                if (!subjectMap.has(s.subjectName)) {
                    subjectMap.set(s.subjectName, s);
                }
            });
        });

        // Check if we have custom ordering for the current exam
        const relevantExamId = reportMode === 'single' ? selectedExamId : (selectedExams.length > 0 ? selectedExams[0].id : '');
        if (relevantExamId && subjectOrdering[relevantExamId]?.length > 0) {
            // Use custom ordering
            const customOrder = subjectOrdering[relevantExamId];

            // Get subjects from custom order that exist in subjectMap
            const orderedSubjects = customOrder.filter(name => subjectMap.has(name));

            // Get any remaining subjects that are not in custom order
            const remainingSubjects = Array.from(subjectMap.keys()).filter(name => !customOrder.includes(name));

            // Sort remaining subjects based on assessment type just in case
            const marksBasedRem = remainingSubjects.filter(name => subjectMap.get(name).assessmentType !== 'GRADE').sort((a, b) => a.localeCompare(b));
            const gradeBasedRem = remainingSubjects.filter(name => subjectMap.get(name).assessmentType === 'GRADE').sort((a, b) => a.localeCompare(b));

            return [...orderedSubjects, ...marksBasedRem, ...gradeBasedRem];
        }

        // Default behavior: Separate subjects into marks-based and grade-based
        const marksBased: string[] = [];
        const gradeBased: string[] = [];

        subjectMap.forEach((subject, name) => {
            if (subject.assessmentType === 'GRADE') {
                gradeBased.push(name);
            } else {
                marksBased.push(name);
            }
        });

        // Sort each category alphabetically
        marksBased.sort((a, b) => a.localeCompare(b));
        gradeBased.sort((a, b) => a.localeCompare(b));

        // Return marks-based first, then grade-based
        return [...marksBased, ...gradeBased];
    };

    // Check if weightages are enabled (total > 0)
    const isWeightageEnabled = Object.values(examWeightages).reduce((sum, w) => sum + (w || 0), 0) > 0;
    const totalWeightageSum = Object.values(examWeightages).reduce((sum, w) => sum + (w || 0), 0);

    // Calculate combined student result
    const getCombinedStudentResult = (studentId: string) => {
        const results = selectedExams.map(se => ({
            examId: se.id,
            examName: se.displayName,
            result: getStudentExamResult(studentId, se.id)
        }));

        let grandTotalObtained = 0;
        let grandTotalMax = 0;

        results.forEach(r => {
            if (r.result) {
                grandTotalObtained += r.result.totalObtained;
                grandTotalMax += r.result.totalMax;
            }
        });

        // Weighted percentage calculation
        let grandPercentage = 0;
        if (isWeightageEnabled && totalWeightageSum > 0) {
            // Calculate weighted percentage per exam
            let weightedSum = 0;
            results.forEach(r => {
                if (r.result && r.result.totalMax > 0) {
                    const examPct = (r.result.totalObtained / r.result.totalMax) * 100;
                    const weight = examWeightages[r.examId] || 0;
                    weightedSum += (examPct * weight) / 100;
                }
            });
            // Scale to 100 if total weightage is 100, otherwise proportional
            grandPercentage = weightedSum;
        } else {
            grandPercentage = grandTotalMax > 0 ? (grandTotalObtained / grandTotalMax) * 100 : 0;
        }

        return {
            examResults: results,
            grandTotalObtained,
            grandTotalMax,
            grandPercentage: grandPercentage.toFixed(2),
            grandGrade: getGrade(grandPercentage)
        };
    };

    // Calculate rank for students (only top 10)
    const calculateRank = (studentId: string): number | null => {
        if (!selectedClass) return null;

        // Get all students' percentages
        const studentPercentages = filteredStudents.map(student => {
            let percentage = 0;
            if (reportMode === 'single') {
                const result = getStudentExamResult(student.id, selectedExamId);
                percentage = result ? parseFloat(result.percentage) : 0;
            } else {
                const combined = getCombinedStudentResult(student.id);
                percentage = parseFloat(combined.grandPercentage);
            }
            return { studentId: student.id, percentage };
        });

        // Sort by percentage descending
        studentPercentages.sort((a, b) => b.percentage - a.percentage);

        // Find rank
        const rank = studentPercentages.findIndex(s => s.studentId === studentId) + 1;

        // Only return rank if it's in top 10
        return rank <= 10 ? rank : null;
    };

    // Determine pass/fail status (33% is typical passing percentage)
    const getResultStatus = (percentage: number): 'PASS' | 'FAIL' => {
        return percentage >= 33 ? 'PASS' : 'FAIL';
    };

    // Get sorted students based on printSortMode
    const sortedStudents = useMemo(() => {
        if (printSortMode === 'percentage') {
            // Sort by percentage descending
            return [...filteredStudents].sort((a, b) => {
                let aPercentage = 0;
                let bPercentage = 0;

                if (reportMode === 'single' && selectedExamId) {
                    const aResult = getStudentExamResult(a.id, selectedExamId);
                    const bResult = getStudentExamResult(b.id, selectedExamId);
                    aPercentage = aResult ? parseFloat(aResult.percentage) : 0;
                    bPercentage = bResult ? parseFloat(bResult.percentage) : 0;
                } else if (reportMode === 'combined' && selectedExams.length > 0) {
                    const aResult = getCombinedStudentResult(a.id);
                    const bResult = getCombinedStudentResult(b.id);
                    aPercentage = parseFloat(aResult.grandPercentage);
                    bPercentage = parseFloat(bResult.grandPercentage);
                }

                return bPercentage - aPercentage; // Descending
            });
        } else {
            // Already sorted by roll in filteredStudents
            return filteredStudents;
        }
    }, [filteredStudents, printSortMode, reportMode, selectedExamId, selectedExams]);

    const handlePrint = () => {
        // Validate students are available
        if (filteredStudents.length === 0) {
            alert('Please select a class and ensure students are available.');
            return;
        }

        console.log('Print initiated with', filteredStudents.length, 'students');

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

            console.log('Print section found with', printSection.children.length, 'cards');

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

    // Combined Report Card Component
    const CombinedCard = ({ student }: { student: any }) => {
        const combinedResult = getCombinedStudentResult(student.id);
        const subjects = getAllSubjects();

        if (!combinedResult.examResults.some(r => r.result)) {
            return <div className="p-8 text-center bg-white border border-dashed rounded-xl">No marks data found for {student.name}.</div>;
        }

        return (
            <div className="report-card-container" style={{
                width: '100%', maxWidth: '1100px', margin: '0 auto',
                padding: '1rem', backgroundColor: 'white', borderRadius: '0.5rem',
                border: `2px solid ${accentColor}`, position: 'relative',
                fontFamily: "'Inter', sans-serif", color: '#1f2937'
            }}>
                {/* Watermark */}
                {enableWatermark && (currentSchool?.logoUrl || currentSchool?.logo) && (
                    <div className="watermark-container" style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        opacity: 0.04,
                        pointerEvents: 'none',
                        zIndex: 0,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <img
                            src={currentSchool?.logoUrl || currentSchool?.logo}
                            alt="Watermark"
                            style={{
                                width: `${watermarkSize}%`,
                                height: `${watermarkSize}%`,
                                objectFit: 'contain'
                            }}
                        />
                    </div>
                )}
                {/* School Header */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                    borderBottom: `2px solid ${accentColor}`,
                    paddingBottom: '0.5rem',
                    position: 'relative'
                }}>
                    {(currentSchool?.logoUrl || currentSchool?.logo) && (
                        <div style={{ position: 'absolute', left: '0', top: '0', width: '100px', display: 'flex', justifyContent: 'flex-start' }}>
                            <img src={currentSchool?.logoUrl || currentSchool?.logo} alt="School Logo" style={{ height: '90px', maxWidth: '100px', objectFit: 'contain' }} />
                        </div>
                    )}
                    <div style={{ textAlign: 'center', width: '100%' }}>
                        <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0, color: accentColor, textTransform: 'uppercase', lineHeight: 1 }}>
                            {currentSchool?.name}
                        </h1>
                        {schoolSubtitle && (
                            <div style={{
                                margin: '0.25rem 0',
                                fontSize: `${subtitleFontSize}px`,
                                color: '#475569',
                                lineHeight: 1.3,
                                whiteSpace: 'pre-line'
                            }}>
                                {schoolSubtitle}
                            </div>
                        )}
                        <p style={{ margin: '0.25rem 0 0', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                            CONSOLIDATED PROGRESS REPORT
                        </p>
                        <p style={{ margin: '0.125rem 0 0', fontWeight: 600, color: '#94a3b8', fontSize: '0.75rem' }}>
                            {selectedExams.map(se => se.displayName).join(' | ')}
                        </p>
                    </div>
                </div>

                {/* Student Info */}
                <div style={{ display: 'flex', gap: '0.75rem', background: '#f8fafc', padding: '0.5rem', borderRadius: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', flex: 1 }}>
                        {studentFields.name && (
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Student Name</label>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{student.name}</div>
                            </div>
                        )}
                        {studentFields.class && (
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Class</label>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{formatClassName(student.class, true)} {student.section ? `- ${student.section}` : ''}</div>
                            </div>
                        )}
                        {studentFields.rollNo && (
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Roll No.</label>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{student.classRollNo || student.rollNo || '-'}</div>
                            </div>
                        )}
                        {studentFields.admissionNo && (
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Admission No.</label>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{student.admissionNo || '-'}</div>
                            </div>
                        )}
                        {studentFields.fatherName && (
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Father's Name</label>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{student.fatherName || '-'}</div>
                            </div>
                        )}
                        {studentFields.motherName && (
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Mother's Name</label>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{student.motherName || '-'}</div>
                            </div>
                        )}
                        {studentFields.dob && (
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Date of Birth</label>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{formatDate(student.dob)}</div>
                            </div>
                        )}
                        {studentFields.mobile && (
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Mobile No.</label>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{student.fatherContactNo || student.mobileNo || student.phone || '-'}</div>
                            </div>
                        )}
                        {studentFields.address && (
                            <div style={{ gridColumn: 'span 3' }}>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Address</label>
                                <div style={{ fontWeight: 800, fontSize: '0.8125rem' }}>{student.presentAddress || student.permanentAddress || '-'}</div>
                            </div>
                        )}
                    </div>
                    {showStudentImage && (
                        <div style={{ width: '90px', height: '110px', background: '#e2e8f0', borderRadius: '0.375rem', overflow: 'hidden', flexShrink: 0, border: '2px solid #cbd5e1' }}>
                            {student.photo ? (
                                <img src={student.photo} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.7rem', textAlign: 'center', padding: '0.25rem' }}>
                                    No Photo
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.25rem', color: accentColor, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Award size={16} /> SCHOLASTIC PERFORMANCE
                    </h4>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem', border: '2px solid #e2e8f0' }}>
                            <thead>
                                {/* Main Header Row */}
                                <tr style={{ background: accentColor, color: 'white' }}>
                                    <th style={{ padding: '0.4rem 0.3rem', textAlign: 'left', fontWeight: 700, borderRight: '2px solid rgba(255,255,255,0.3)', minWidth: '100px' }} rowSpan={2}>SUBJECTS</th>
                                    <th colSpan={3} style={{ padding: '0.4rem 0.3rem', textAlign: 'center', fontWeight: 700, borderRight: '2px solid rgba(255,255,255,0.3)' }}>MAX. MARKS</th>
                                    {selectedExams.map((exam, idx) => (
                                        <th key={exam.id} colSpan={3} style={{ padding: '0.4rem 0.3rem', textAlign: 'center', fontWeight: 700, borderRight: idx < selectedExams.length - 1 ? '2px solid rgba(255,255,255,0.3)' : '2px solid rgba(255,255,255,0.3)' }}>
                                            {exam.displayName}
                                        </th>
                                    ))}
                                    {showGrandTotal && (
                                        <th colSpan={2} style={{ padding: '0.4rem 0.3rem', textAlign: 'center', fontWeight: 700, background: '#1e293b' }}>GRAND TOTAL</th>
                                    )}
                                </tr>
                                {/* Sub Header Row */}
                                <tr style={{ background: '#f1f5f9' }}>
                                    <th style={{ padding: '0.3rem 0.2rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: 600, color: '#64748b', borderRight: '1px solid #cbd5e1' }}>Theory</th>
                                    <th style={{ padding: '0.3rem 0.2rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: 600, color: '#64748b', borderRight: '1px solid #cbd5e1' }}>Practical</th>
                                    <th style={{ padding: '0.3rem 0.2rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: 600, color: '#64748b', borderRight: '2px solid #cbd5e1' }}>Grand Total</th>
                                    {selectedExams.map((exam, idx) => (
                                        <React.Fragment key={exam.id}>
                                            <th style={{ padding: '0.3rem 0.2rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: 600, color: '#64748b', borderRight: '1px solid #cbd5e1' }}>Theory</th>
                                            <th style={{ padding: '0.3rem 0.2rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: 600, color: '#64748b', borderRight: '1px solid #cbd5e1' }}>Practical/ Oral</th>
                                            <th style={{ padding: '0.3rem 0.2rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: 600, color: '#64748b', borderRight: idx < selectedExams.length - 1 ? '2px solid #cbd5e1' : '2px solid #cbd5e1' }}>Grand Total</th>
                                        </React.Fragment>
                                    ))}
                                    {showGrandTotal && (
                                        <>
                                            <th style={{ padding: '0.3rem 0.2rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: 600, color: '#64748b', borderRight: '1px solid #cbd5e1' }}>Total</th>
                                            <th style={{ padding: '0.3rem 0.2rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: 600, color: '#64748b' }}>%</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {subjects.map((subject, subIdx) => {
                                    let grandTheoryTotal = 0;
                                    let grandPracticalTotal = 0;
                                    let grandObtainedTotal = 0;
                                    let maxTheory = 0;
                                    let maxPractical = 0;
                                    let maxTotal = 0;

                                    // Check if this subject has marks in at least one exam
                                    const hasMarksInAnyExam = selectedExams.some(exam => {
                                        const result = combinedResult.examResults.find(r => r.examId === exam.id)?.result;
                                        const subjectData = result?.subjects?.[subject];
                                        return subjectData && (typeof subjectData.obtained === 'number' || subjectData.obtained === 'AB' || subjectData.obtained === 'NA' || subjectData.isGradeOnly);
                                    });

                                    // Check if this is a grade-only subject
                                    const isGradeOnlySubject = (() => {
                                        const firstExamResult = combinedResult.examResults[0]?.result;
                                        const firstSubjectData = firstExamResult?.subjects?.[subject];
                                        return firstSubjectData?.isGradeOnly || firstSubjectData?.assessmentType === 'GRADE';
                                    })();

                                    // Skip subjects with no marks in any exam
                                    if (!hasMarksInAnyExam) return null;

                                    // Get max marks from first exam
                                    const firstExamResult = combinedResult.examResults[0]?.result;
                                    const firstSubjectData = firstExamResult?.subjects?.[subject];
                                    if (firstSubjectData && !isGradeOnlySubject) {
                                        maxTheory = firstSubjectData.theoryMax || 0;
                                        maxPractical = firstSubjectData.practicalMax || 0;
                                        maxTotal = firstSubjectData.max || 0;
                                    }

                                    return (
                                        <tr key={subject} style={{ borderBottom: '1px solid #e2e8f0', background: subIdx % 2 === 0 ? 'white' : '#fafafa' }}>
                                            <td style={{ padding: '0.35rem 0.4rem', fontWeight: 600, borderRight: '2px solid #e2e8f0' }}>{subject}</td>

                                            {/* Max Marks Columns */}
                                            <td style={{ padding: '0.25rem', textAlign: 'center', fontWeight: 600, color: '#64748b', borderRight: '1px solid #e2e8f0' }}>
                                                {isGradeOnlySubject ? '—' : (maxTheory || '—')}
                                            </td>
                                            <td style={{ padding: '0.25rem', textAlign: 'center', fontWeight: 600, color: '#64748b', borderRight: '1px solid #e2e8f0' }}>
                                                {isGradeOnlySubject ? '—' : (maxPractical || '—')}
                                            </td>
                                            <td style={{ padding: '0.25rem', textAlign: 'center', fontWeight: 700, color: '#1e293b', borderRight: '2px solid #e2e8f0' }}>
                                                {isGradeOnlySubject ? '—' : maxTotal}
                                            </td>

                                            {/* Individual Exam Columns */}
                                            {selectedExams.map((exam, idx) => {
                                                const result = combinedResult.examResults.find(r => r.examId === exam.id)?.result;
                                                const subjectData = result?.subjects?.[subject];

                                                const theory = subjectData?.theory ?? '—';
                                                const practical = subjectData?.practical ?? '—';
                                                const total = subjectData?.obtained ?? '—';
                                                const grade = subjectData?.grade;

                                                // Add to grand totals if numeric (but not for grade-only subjects)
                                                if (!isGradeOnlySubject) {
                                                    if (typeof theory === 'number') grandTheoryTotal += theory;
                                                    if (typeof practical === 'number') grandPracticalTotal += practical;
                                                    if (typeof total === 'number') grandObtainedTotal += total;
                                                }

                                                const isAbsent = subjectData?.isAbsent;
                                                const isNA = subjectData?.isNA;
                                                const cellColor = isAbsent ? '#ef4444' : (isNA ? '#94a3b8' : 'inherit');

                                                return (
                                                    <React.Fragment key={exam.id}>
                                                        <td style={{ padding: '0.25rem', textAlign: 'center', fontWeight: 600, color: cellColor, borderRight: '1px solid #e2e8f0' }}>
                                                            {isGradeOnlySubject ? '—' : theory}
                                                        </td>
                                                        <td style={{ padding: '0.25rem', textAlign: 'center', fontWeight: 600, color: cellColor, borderRight: '1px solid #e2e8f0' }}>
                                                            {isGradeOnlySubject ? '—' : practical}
                                                        </td>
                                                        <td style={{ padding: '0.25rem', textAlign: 'center', fontWeight: 700, color: cellColor, borderRight: idx < selectedExams.length - 1 ? '2px solid #e2e8f0' : '2px solid #e2e8f0' }}>
                                                            {isGradeOnlySubject ? (grade || '—') : total}
                                                        </td>
                                                    </React.Fragment>
                                                );
                                            })}

                                            {/* Grand Total for Subject */}
                                            {showGrandTotal && (
                                                <>
                                                    <td style={{ padding: '0.25rem', textAlign: 'center', fontWeight: 800, background: '#f8fafc', borderRight: '1px solid #e2e8f0' }}>
                                                        {isGradeOnlySubject ? '—' : grandObtainedTotal}
                                                    </td>
                                                    <td style={{ padding: '0.25rem', textAlign: 'center', fontWeight: 700, color: accentColor, background: '#f8fafc' }}>
                                                        {isGradeOnlySubject ? '—' : (maxTotal > 0 ? ((grandObtainedTotal / (maxTotal * selectedExams.length)) * 100).toFixed(1) + '%' : '—')}
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                {/* TOTAL Row */}
                                <tr style={{ background: '#f1f5f9', fontWeight: 900 }}>
                                    <td style={{ padding: '0.4rem 0.3rem', borderRight: '2px solid #e2e8f0' }}>TOTAL</td>

                                    {/* Max Totals */}
                                    <td style={{ padding: '0.3rem', textAlign: 'center', color: '#64748b', borderRight: '1px solid #cbd5e1' }}>
                                        {subjects.reduce((sum, sub) => {
                                            const firstExamResult = combinedResult.examResults[0]?.result;
                                            const subData = firstExamResult?.subjects?.[sub];
                                            // Only count non-grade subjects
                                            if (subData?.isGradeOnly || subData?.assessmentType === 'GRADE') return sum;
                                            return sum + (subData?.theoryMax || 0);
                                        }, 0)}
                                    </td>
                                    <td style={{ padding: '0.3rem', textAlign: 'center', color: '#64748b', borderRight: '1px solid #cbd5e1' }}>
                                        {subjects.reduce((sum, sub) => {
                                            const firstExamResult = combinedResult.examResults[0]?.result;
                                            const subData = firstExamResult?.subjects?.[sub];
                                            // Only count non-grade subjects
                                            if (subData?.isGradeOnly || subData?.assessmentType === 'GRADE') return sum;
                                            return sum + (subData?.practicalMax || 0);
                                        }, 0)}
                                    </td>
                                    <td style={{ padding: '0.3rem', textAlign: 'center', fontWeight: 900, borderRight: '2px solid #cbd5e1' }}>
                                        {subjects.reduce((sum, sub) => {
                                            const firstExamResult = combinedResult.examResults[0]?.result;
                                            const subData = firstExamResult?.subjects?.[sub];
                                            // Only count non-grade subjects
                                            if (subData?.isGradeOnly || subData?.assessmentType === 'GRADE') return sum;
                                            return sum + (subData?.theoryMax || 0) + (subData?.practicalMax || 0);
                                        }, 0)}
                                    </td>

                                    {/* Individual Exam Totals */}
                                    {selectedExams.map((exam, idx) => {
                                        const result = combinedResult.examResults.find(r => r.examId === exam.id)?.result;

                                        const totalTheory = subjects.reduce((sum, sub) => {
                                            const subData = result?.subjects?.[sub];
                                            // Only count non-grade subjects
                                            if (subData?.isGradeOnly || subData?.assessmentType === 'GRADE') return sum;
                                            return sum + (typeof subData?.theory === 'number' ? subData.theory : 0);
                                        }, 0);

                                        const totalPractical = subjects.reduce((sum, sub) => {
                                            const subData = result?.subjects?.[sub];
                                            // Only count non-grade subjects
                                            if (subData?.isGradeOnly || subData?.assessmentType === 'GRADE') return sum;
                                            return sum + (typeof subData?.practical === 'number' ? subData.practical : 0);
                                        }, 0);

                                        return (
                                            <React.Fragment key={exam.id}>
                                                <td style={{ padding: '0.3rem', textAlign: 'center', borderRight: '1px solid #cbd5e1' }}>{totalTheory}</td>
                                                <td style={{ padding: '0.3rem', textAlign: 'center', borderRight: '1px solid #cbd5e1' }}>{totalPractical}</td>
                                                <td style={{ padding: '0.3rem', textAlign: 'center', fontWeight: 900, borderRight: idx < selectedExams.length - 1 ? '2px solid #cbd5e1' : '2px solid #cbd5e1' }}>
                                                    {result?.totalObtained || 0}
                                                </td>
                                            </React.Fragment>
                                        );
                                    })}

                                    {/* Grand Grand Total */}
                                    {showGrandTotal && (
                                        <>
                                            <td style={{ padding: '0.3rem', textAlign: 'center', background: '#1e293b', color: 'white', fontWeight: 900, borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                                                {combinedResult.grandTotalObtained}
                                            </td>
                                            <td style={{ padding: '0.3rem', textAlign: 'center', background: '#1e293b', color: 'white' }}>
                                                {/* Total Max Placeholder */}
                                            </td>
                                        </>
                                    )}
                                </tr>

                                {/* PERCENTAGE Row */}
                                <tr style={{ background: accentColor, color: 'white', fontWeight: 900 }}>
                                    <td style={{ padding: '0.4rem 0.3rem', borderRight: '2px solid rgba(255,255,255,0.3)' }}>PERCENTAGE</td>
                                    <td colSpan={3} style={{ padding: '0.3rem', textAlign: 'center', borderRight: '2px solid rgba(255,255,255,0.3)' }}>—</td>

                                    {selectedExams.map((exam, idx) => {
                                        const result = combinedResult.examResults.find(r => r.examId === exam.id)?.result;
                                        return (
                                            <td key={exam.id} colSpan={3} style={{ padding: '0.3rem', textAlign: 'center', borderRight: idx < selectedExams.length - 1 ? '2px solid rgba(255,255,255,0.3)' : '2px solid rgba(255,255,255,0.3)' }}>
                                                {result?.percentage || '0'}%
                                            </td>
                                        );
                                    })}

                                    {showGrandTotal && (
                                        <td colSpan={2} style={{ padding: '0.3rem', textAlign: 'center', background: '#1e293b', color: '#fbbf24', fontWeight: 900, fontSize: '0.85rem' }}>
                                            {isWeightageEnabled ? `${combinedResult.grandPercentage}%` : `${combinedResult.grandPercentage}%`}
                                        </td>
                                    )}
                                </tr>

                                {/* PROMOTIONAL MARKS Row (Weighted) */}
                                {isWeightageEnabled && (
                                    <tr style={{ background: '#1e293b', color: 'white', fontWeight: 900 }}>
                                        <td style={{ padding: '0.4rem 0.3rem', borderRight: '2px solid rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>PROMOTIONAL<br />MARKS</td>
                                        <td colSpan={3} style={{ padding: '0.3rem', textAlign: 'center', borderRight: '2px solid rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>—</td>

                                        {selectedExams.map((exam, idx) => {
                                            const weight = examWeightages[exam.id] || 0;
                                            return (
                                                <td key={exam.id} colSpan={3} style={{ padding: '0.3rem', textAlign: 'center', borderRight: idx < selectedExams.length - 1 ? '2px solid rgba(255,255,255,0.3)' : '2px solid rgba(255,255,255,0.3)', fontSize: '0.75rem', color: '#94a3b8' }}>
                                                    {weight > 0 ? `${weight}%` : '—'}
                                                </td>
                                            );
                                        })}

                                        {showGrandTotal && (
                                            <td colSpan={2} style={{ padding: '0.3rem', textAlign: 'center', background: '#dc2626', color: 'white', fontWeight: 900, fontSize: '1rem' }}>
                                                {combinedResult.grandPercentage}%
                                            </td>
                                        )}
                                    </tr>
                                )}
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Result and Rank */}
                {(showResultStatus || showRank) && (
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        {showResultStatus && (
                            <div style={{
                                padding: '0.5rem 1.5rem',
                                borderRadius: '0.5rem',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                background: getResultStatus(parseFloat(combinedResult.grandPercentage)) === 'PASS' ? '#d1fae5' : '#fee2e2',
                                color: getResultStatus(parseFloat(combinedResult.grandPercentage)) === 'PASS' ? '#059669' : '#dc2626'
                            }}>
                                RESULT: {getResultStatus(parseFloat(combinedResult.grandPercentage))}
                            </div>
                        )}
                        {showRank && calculateRank(student.id) && (
                            <div style={{
                                padding: '0.5rem 1.5rem',
                                borderRadius: '0.5rem',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                background: '#fef3c7',
                                color: '#d97706'
                            }}>
                                RANK: {calculateRank(student.id)}
                            </div>
                        )}
                    </div>
                )}

                {/* Signatures */}
                <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 0.5rem' }}>
                    <div style={{ width: '180px', textAlign: 'center' }}>
                        {/* Spacer to match principal signature height for alignment */}
                        <div style={{ height: principalSignatureUrl ? `${signatureHeight}px` : '0px', marginBottom: principalSignatureUrl ? '0.25rem' : '0' }}></div>
                        <div style={{ borderTop: `1px solid ${accentColor}`, paddingTop: '0.25rem', fontWeight: 700, fontSize: '0.65rem' }}>CLASS TEACHER</div>
                    </div>
                    <div style={{ width: '180px', textAlign: 'center' }}>
                        {principalSignatureUrl ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <img src={principalSignatureUrl} alt="Principal Signature" style={{ height: `${signatureHeight}px`, objectFit: 'contain', marginBottom: '0.25rem' }} />
                                <div style={{ borderTop: `1px solid ${accentColor}`, paddingTop: '0.25rem', fontWeight: 700, fontSize: '0.65rem', width: '100%' }}>PRINCIPAL</div>
                            </div>
                        ) : (
                            <div style={{ borderTop: `1px solid ${accentColor}`, paddingTop: '0.25rem', fontWeight: 700, fontSize: '0.65rem' }}>PRINCIPAL</div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Single Exam Report Card (simplified version)
    const SingleCard = ({ student }: { student: any }) => {
        const result = getStudentExamResult(student.id, selectedExamId);
        const exam = schoolExams.find((e: any) => e.id === selectedExamId);

        if (!result) {
            return <div className="p-8 text-center bg-white border border-dashed rounded-xl">No marks data found for {student.name}.</div>;
        }

        return (
            <div className="report-card-container" style={{
                width: '100%', maxWidth: '950px', margin: '0 auto',
                padding: '1rem', backgroundColor: 'white', borderRadius: '0.5rem',
                border: `2px solid ${accentColor}`, position: 'relative',
                fontFamily: "'Inter', sans-serif", color: '#1f2937'
            }}>
                {/* Watermark */}
                {enableWatermark && (currentSchool?.logoUrl || currentSchool?.logo) && (
                    <div className="watermark-container" style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        opacity: 0.04,
                        pointerEvents: 'none',
                        zIndex: 0,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <img
                            src={currentSchool?.logoUrl || currentSchool?.logo}
                            alt="Watermark"
                            style={{
                                width: `${watermarkSize}%`,
                                height: `${watermarkSize}%`,
                                objectFit: 'contain'
                            }}
                        />
                    </div>
                )}
                {/* School Header */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                    borderBottom: `2px solid ${accentColor}`,
                    paddingBottom: '0.5rem',
                    position: 'relative'
                }}>
                    {(currentSchool?.logoUrl || currentSchool?.logo) && (
                        <div style={{ position: 'absolute', left: '0', top: '0', width: '100px', display: 'flex', justifyContent: 'flex-start' }}>
                            <img src={currentSchool?.logoUrl || currentSchool?.logo} alt="School Logo" style={{ height: '90px', maxWidth: '100px', objectFit: 'contain' }} />
                        </div>
                    )}
                    <div style={{ textAlign: 'center', width: '100%' }}>
                        <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0, color: accentColor, textTransform: 'uppercase', lineHeight: 1 }}>
                            {currentSchool?.name}
                        </h1>
                        {schoolSubtitle && (
                            <div style={{
                                margin: '0.25rem 0',
                                fontSize: `${subtitleFontSize}px`,
                                color: '#475569',
                                lineHeight: 1.3,
                                whiteSpace: 'pre-line'
                            }}>
                                {schoolSubtitle}
                            </div>
                        )}
                        <p style={{ margin: '0.25rem 0 0', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                            PROGRESS REPORT CARD
                        </p>
                        <p style={{ margin: '0.125rem 0 0', fontWeight: 700, color: accentColor, fontSize: '0.8rem' }}>
                            {exam?.displayName || exam?.name}
                        </p>
                    </div>
                </div>

                {/* Student Info */}
                <div style={{ display: 'flex', gap: '0.75rem', background: '#f8fafc', padding: '0.5rem', borderRadius: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', flex: 1 }}>
                        {studentFields.name && (
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Student Name</label>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{student.name}</div>
                            </div>
                        )}
                        {studentFields.class && (
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Class</label>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{formatClassName(student.class, true)} {student.section ? `- ${student.section}` : ''}</div>
                            </div>
                        )}
                        {studentFields.rollNo && (
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Roll No.</label>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{student.classRollNo || student.rollNo || '-'}</div>
                            </div>
                        )}
                        {studentFields.admissionNo && (
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Admission No.</label>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{student.admissionNo || '-'}</div>
                            </div>
                        )}
                        {studentFields.fatherName && (
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Father's Name</label>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{student.fatherName || '-'}</div>
                            </div>
                        )}
                        {studentFields.motherName && (
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Mother's Name</label>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{student.motherName || '-'}</div>
                            </div>
                        )}
                        {studentFields.dob && (
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Date of Birth</label>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{formatDate(student.dob)}</div>
                            </div>
                        )}
                        {studentFields.mobile && (
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Mobile No.</label>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{student.fatherContactNo || student.mobileNo || student.phone || '-'}</div>
                            </div>
                        )}
                        {studentFields.address && (
                            <div style={{ gridColumn: 'span 3' }}>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Address</label>
                                <div style={{ fontWeight: 800, fontSize: '0.8125rem' }}>{student.presentAddress || student.permanentAddress || '-'}</div>
                            </div>
                        )}
                    </div>
                    {showStudentImage && (
                        <div style={{ width: '90px', height: '110px', background: '#e2e8f0', borderRadius: '0.375rem', overflow: 'hidden', flexShrink: 0, border: '2px solid #cbd5e1' }}>
                            {student.photo ? (
                                <img src={student.photo} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.7rem', textAlign: 'center', padding: '0.25rem' }}>
                                    No Photo
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Marks Table */}
                {(() => {
                    const subjectNames = getAllSubjects();
                    const subjects = subjectNames
                        .map(name => ({
                            name,
                            data: result.subjects[name]
                        }))
                        .filter(sub => sub.data);

                    const rowColor = accentColor; // Blue theme from accentColor



                    return (
                        <table style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '0.75rem',
                            border: `2px solid ${rowColor}`,
                            marginBottom: '0.75rem',
                            color: '#1f2937'
                        }}>
                            <thead>
                                <tr style={{ color: rowColor, borderBottom: `1px solid ${rowColor}` }}>
                                    <th style={{ padding: '0.4rem', textAlign: 'center', borderRight: `1px solid ${rowColor}`, fontWeight: 800 }} rowSpan={2}>SUBJECTS</th>
                                    <th style={{ padding: '0.4rem', textAlign: 'center', borderRight: `1px solid ${rowColor}`, fontWeight: 800 }} colSpan={2}>THEORY</th>
                                    <th style={{ padding: '0.4rem', textAlign: 'center', borderRight: `1px solid ${rowColor}`, fontWeight: 800 }} colSpan={2}>PRACTICAL/ORAL</th>
                                    <th style={{ padding: '0.4rem', textAlign: 'center', borderRight: `1px solid ${rowColor}`, fontWeight: 800 }} rowSpan={2}>MARKS OBTAINED</th>
                                    <th style={{ padding: '0.4rem', textAlign: 'center', borderRight: `1px solid ${rowColor}`, fontWeight: 800 }} rowSpan={2}>GRADE</th>
                                    <th style={{ padding: '0.4rem', textAlign: 'center', fontWeight: 800 }} rowSpan={2}>REMARKS</th>
                                </tr>
                                <tr style={{ color: rowColor, borderBottom: `2px solid ${rowColor}` }}>
                                    <th style={{ padding: '0.3rem', textAlign: 'center', borderRight: `1px solid ${rowColor}`, fontWeight: 800 }}>Max.</th>
                                    <th style={{ padding: '0.3rem', textAlign: 'center', borderRight: `1px solid ${rowColor}`, fontWeight: 800 }}>Obt.</th>
                                    <th style={{ padding: '0.3rem', textAlign: 'center', borderRight: `1px solid ${rowColor}`, fontWeight: 800 }}>Max.</th>
                                    <th style={{ padding: '0.3rem', textAlign: 'center', borderRight: `1px solid ${rowColor}`, fontWeight: 800 }}>Obt.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {subjects.map((sub: any, idx) => {
                                    const isGradeOnly = sub.data.isGradeOnly;
                                    return (
                                        <tr key={sub.name} style={{ borderBottom: `1px solid ${rowColor}`, background: idx % 2 === 0 ? 'white' : '#fff9f9' }}>
                                            <td style={{ padding: '0.25rem 0.4rem', fontWeight: 700, borderRight: `1px solid ${rowColor}`, color: '#059669' }}>{sub.data.displayName || sub.name}</td>

                                            {/* Theory */}
                                            <td style={{ padding: '0.25rem', textAlign: 'center', borderRight: `1px solid ${rowColor}` }}>
                                                {!isGradeOnly ? sub.data.theoryMax : ''}
                                            </td>
                                            <td style={{ padding: '0.25rem', textAlign: 'center', borderRight: `1px solid ${rowColor}`, fontWeight: 600, color: sub.data.isAbsent ? '#ef4444' : (sub.data.isNA ? '#94a3b8' : 'inherit') }}>
                                                {!isGradeOnly ? sub.data.theory : ''}
                                            </td>

                                            {/* Practical / Internal */}
                                            <td style={{ padding: '0.25rem', textAlign: 'center', borderRight: `1px solid ${rowColor}` }}>
                                                {!isGradeOnly && sub.data.practicalMax > 0 ? sub.data.practicalMax : (isGradeOnly ? '' : '0')}
                                            </td>
                                            <td style={{ padding: '0.25rem', textAlign: 'center', borderRight: `1px solid ${rowColor}`, fontWeight: 600, color: sub.data.isAbsent ? '#ef4444' : (sub.data.isNA ? '#94a3b8' : 'inherit') }}>
                                                {!isGradeOnly ? sub.data.practical : ''}
                                            </td>

                                            {/* Total Obtained */}
                                            <td style={{ padding: '0.5rem', textAlign: 'center', borderRight: `1px solid ${rowColor}`, fontWeight: 800, color: sub.data.isAbsent ? '#ef4444' : (sub.data.isNA ? '#94a3b8' : 'inherit') }}>
                                                {isGradeOnly ? '' : sub.data.obtained}
                                            </td>

                                            {/* Grade */}
                                            <td style={{ padding: '0.5rem', textAlign: 'center', borderRight: `1px solid ${rowColor}`, fontWeight: 800, color: rowColor }}>
                                                {sub.data.grade}
                                            </td>

                                            {/* Remarks */}
                                            <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 500, fontSize: '0.75rem' }}>
                                                {sub.data.remark || '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot style={{ borderTop: `2px solid ${rowColor}` }}>
                                <tr style={{ color: rowColor, fontWeight: 900, borderBottom: `1px solid ${rowColor}` }}>
                                    <td style={{ padding: '0.6rem', borderRight: `1px solid ${rowColor}` }}>Grand Total</td>
                                    {(() => {
                                        let totalTheoryMax = 0;
                                        let totalTheoryObt = 0;
                                        let totalPracMax = 0;
                                        let totalPracObt = 0;

                                        subjects.forEach(s => {
                                            if (!s.data.isGradeOnly && !s.data.isNA) {
                                                totalTheoryMax += s.data.theoryMax;
                                                totalTheoryObt += (typeof s.data.theory === 'number' ? s.data.theory : 0);
                                                totalPracMax += s.data.practicalMax;
                                                totalPracObt += (typeof s.data.practical === 'number' ? s.data.practical : 0);
                                            }
                                        });

                                        return (
                                            <>
                                                <td style={{ padding: '0.6rem', textAlign: 'center', borderRight: `1px solid ${rowColor}` }}>{totalTheoryMax}</td>
                                                <td style={{ padding: '0.6rem', textAlign: 'center', borderRight: `1px solid ${rowColor}` }}>{totalTheoryObt}</td>
                                                <td style={{ padding: '0.6rem', textAlign: 'center', borderRight: `1px solid ${rowColor}` }}>{totalPracMax}</td>
                                                <td style={{ padding: '0.6rem', textAlign: 'center', borderRight: `1px solid ${rowColor}` }}>{totalPracObt}</td>
                                                <td style={{ padding: '0.6rem', textAlign: 'center', borderRight: `1px solid ${rowColor}`, fontWeight: 900 }}>{result.totalObtained} / {result.totalMax}</td>
                                                <td style={{ borderRight: `1px solid ${rowColor}` }}></td>
                                                <td></td>
                                            </>
                                        );
                                    })()}
                                </tr>
                                <tr style={{ color: rowColor, fontWeight: 900 }}>
                                    <td style={{ padding: '0.6rem', borderRight: `1px solid ${rowColor}` }}>Percentage</td>
                                    <td colSpan={4} style={{ borderRight: `1px solid ${rowColor}` }}></td>
                                    <td style={{ padding: '0.6rem', textAlign: 'center', borderRight: `1px solid ${rowColor}`, fontSize: '0.9rem' }}>{result.percentage}%</td>
                                    <td style={{ padding: '0.6rem', textAlign: 'center', borderRight: `1px solid ${rowColor}` }}>{result.grade}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    );
                })()}

                {/* Result and Rank */}
                {(showResultStatus || showRank) && (
                    <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        {showResultStatus && (
                            <div style={{
                                padding: '0.5rem 1.5rem',
                                borderRadius: '0.5rem',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                background: getResultStatus(parseFloat(result.percentage)) === 'PASS' ? '#d1fae5' : '#fee2e2',
                                color: getResultStatus(parseFloat(result.percentage)) === 'PASS' ? '#059669' : '#dc2626'
                            }}>
                                RESULT: {getResultStatus(parseFloat(result.percentage))}
                            </div>
                        )}
                        {showRank && calculateRank(student.id) && (
                            <div style={{
                                padding: '0.5rem 1.5rem',
                                borderRadius: '0.5rem',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                background: '#fef3c7',
                                color: '#d97706'
                            }}>
                                RANK: {calculateRank(student.id)}
                            </div>
                        )}
                    </div>
                )}

                {/* Signatures */}
                <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 0.5rem' }}>
                    <div style={{ width: '200px', textAlign: 'center' }}>
                        {/* Spacer to match principal signature height for alignment */}
                        <div style={{ height: principalSignatureUrl ? `${signatureHeight}px` : '0px', marginBottom: principalSignatureUrl ? '0.25rem' : '0' }}></div>
                        <div style={{ borderTop: `1px solid ${accentColor}`, paddingTop: '0.4rem', fontWeight: 700, fontSize: '0.7rem' }}>CLASS TEACHER</div>
                    </div>
                    <div style={{ width: '200px', textAlign: 'center' }}>
                        {principalSignatureUrl ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <img src={principalSignatureUrl} alt="Principal Signature" style={{ height: `${signatureHeight}px`, objectFit: 'contain', marginBottom: '0.25rem' }} />
                                <div style={{ borderTop: `1px solid ${accentColor}`, paddingTop: '0.4rem', fontWeight: 700, fontSize: '0.7rem', width: '100%' }}>PRINCIPAL</div>
                            </div>
                        ) : (
                            <div style={{ borderTop: `1px solid ${accentColor}`, paddingTop: '0.4rem', fontWeight: 700, fontSize: '0.7rem' }}>PRINCIPAL</div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const isReadyToPrint = reportMode === 'single' ? !!selectedExamId && !!selectedClass : selectedExams.length > 0 && !!selectedClass;

    return (
        <>
            <div className="page-container no-print" style={{ background: '#f8fafc' }}>
                {/* Header */}
                <div className="page-header" style={{ marginBottom: '2.5rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                            <div style={{
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                color: 'white', padding: '0.75rem', borderRadius: '1rem',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                            }}>
                                <FileText size={24} />
                            </div>
                            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Combined Report Card</h1>
                        </div>
                        <p className="page-subtitle">Generate single or combined multi-exam report cards with columnar layout</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        {/* Sort Mode Toggle */}
                        <div style={{ display: 'flex', gap: '0.5rem', background: 'white', padding: '0.375rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                            <button
                                onClick={() => setPrintSortMode('roll')}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '0.5rem',
                                    border: 'none',
                                    background: printSortMode === 'roll' ? '#6366f1' : 'transparent',
                                    color: printSortMode === 'roll' ? 'white' : '#64748b',
                                    fontWeight: 600,
                                    fontSize: '0.875rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Roll No. ↑
                            </button>
                            <button
                                onClick={() => setPrintSortMode('percentage')}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '0.5rem',
                                    border: 'none',
                                    background: printSortMode === 'percentage' ? '#6366f1' : 'transparent',
                                    color: printSortMode === 'percentage' ? 'white' : '#64748b',
                                    fontWeight: 600,
                                    fontSize: '0.875rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Marks % ↓
                            </button>
                        </div>
                        <button
                            onClick={() => setShowPreview(true)}
                            disabled={!isReadyToPrint || filteredStudents.length === 0}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                background: 'white', color: '#6366f1', border: '1px solid #6366f1',
                                borderRadius: '0.75rem', padding: '0.75rem 1.5rem', fontWeight: 600,
                                cursor: isReadyToPrint && filteredStudents.length > 0 ? 'pointer' : 'not-allowed',
                                opacity: isReadyToPrint && filteredStudents.length > 0 ? 1 : 0.5
                            }}
                        >
                            <Eye size={18} /> Preview
                        </button>
                        <Link
                            to={`/${schoolId}/exams/template-management`}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                                color: 'white', border: 'none',
                                borderRadius: '0.75rem', padding: '0.75rem 1.5rem', fontWeight: 600,
                                textDecoration: 'none',
                                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
                            }}
                        >
                            <Settings size={18} /> Manage Templates
                        </Link>
                        <button
                            onClick={handlePrint}
                            disabled={!isReadyToPrint || filteredStudents.length === 0}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                background: isReadyToPrint && filteredStudents.length > 0 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#cbd5e1',
                                color: 'white', border: 'none', borderRadius: '0.75rem',
                                padding: '0.75rem 1.5rem', fontWeight: 700,
                                boxShadow: isReadyToPrint && filteredStudents.length > 0 ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none',
                                cursor: isReadyToPrint && filteredStudents.length > 0 ? 'pointer' : 'not-allowed'
                            }}
                        >
                            <Printer size={18} /> Print All ({filteredStudents.length})
                        </button>
                    </div>
                </div>

                {/* Mode Selection - Step 1 */}
                <div className="card" style={{ padding: '2rem', marginBottom: '2rem', borderRadius: '1.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <div style={{ background: '#f0fdf4', color: '#10b981', padding: '0.5rem', borderRadius: '0.75rem' }}>
                            <Layers size={20} />
                        </div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0 }}>Step 1: Choose Report Type</h3>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <button
                            onClick={() => { setReportMode('single'); setSelectedExams([]); }}
                            style={{
                                padding: '2rem', textAlign: 'left', borderRadius: '1rem',
                                background: reportMode === 'single' ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.02) 100%)' : 'white',
                                border: `2px solid ${reportMode === 'single' ? '#6366f1' : '#e2e8f0'}`,
                                cursor: 'pointer', transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                <div style={{ width: '48px', height: '48px', background: reportMode === 'single' ? '#6366f1' : '#f1f5f9', color: reportMode === 'single' ? 'white' : '#64748b', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h4 style={{ margin: 0, fontWeight: 800, color: '#1e293b' }}>Single Exam Report</h4>
                                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#64748b' }}>Report card for one examination</p>
                                </div>
                            </div>
                            {reportMode === 'single' && <CheckCircle size={20} style={{ position: 'absolute', top: '1rem', right: '1rem', color: '#6366f1' }} />}
                        </button>

                        <button
                            onClick={() => { setReportMode('combined'); setSelectedExamId(''); }}
                            style={{
                                padding: '2rem', textAlign: 'left', borderRadius: '1rem',
                                background: reportMode === 'combined' ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.02) 100%)' : 'white',
                                border: `2px solid ${reportMode === 'combined' ? '#10b981' : '#e2e8f0'}`,
                                cursor: 'pointer', transition: 'all 0.2s', position: 'relative'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                <div style={{ width: '48px', height: '48px', background: reportMode === 'combined' ? '#10b981' : '#f1f5f9', color: reportMode === 'combined' ? 'white' : '#64748b', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Layers size={24} />
                                </div>
                                <div>
                                    <h4 style={{ margin: 0, fontWeight: 800, color: '#1e293b' }}>Combined Exams Report</h4>
                                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#64748b' }}>Multiple exams in columnar format</p>
                                </div>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                                ★ Best for Term-wise consolidated reports
                            </div>
                            {reportMode === 'combined' && <CheckCircle size={20} style={{ position: 'absolute', top: '1rem', right: '1rem', color: '#10b981' }} />}
                        </button>
                    </div>
                </div>

                {/* Exam Selection - Step 2 */}
                <div className="card" style={{ padding: '2rem', marginBottom: '2rem', borderRadius: '1.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <div style={{ background: '#fef3c7', color: '#f59e0b', padding: '0.5rem', borderRadius: '0.75rem' }}>
                            <Award size={20} />
                        </div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0 }}>Step 2: Select {reportMode === 'single' ? 'Exam' : 'Exams'} & Class</h3>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: reportMode === 'single' ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
                        {/* Class & Section Selection (common) */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                            <div className="form-group">
                                <label style={{ fontWeight: 700, fontSize: '0.875rem', color: '#475569', marginBottom: '0.5rem', display: 'block' }}>Academic Year</label>
                                <select
                                    className="input-field"
                                    value={selectedAcademicYear}
                                    onChange={e => setSelectedAcademicYear(e.target.value)}
                                    style={{ borderRadius: '0.75rem', padding: '0.75rem 1rem' }}
                                >
                                    <option value="">All Years</option>
                                    {schoolYears.map((y: any) => (
                                        <option key={y.id} value={y.id}>{y.name} {y.isActive && '(Current)'}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label style={{ fontWeight: 700, fontSize: '0.875rem', color: '#475569', marginBottom: '0.5rem', display: 'block' }}>Class *</label>
                                <select
                                    className="input-field"
                                    value={selectedClass}
                                    onChange={e => setSelectedClass(e.target.value)}
                                    style={{ borderRadius: '0.75rem', padding: '0.75rem 1rem' }}
                                >
                                    <option value="">Select Class</option>
                                    {activeClasses.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label style={{ fontWeight: 700, fontSize: '0.875rem', color: '#475569', marginBottom: '0.5rem', display: 'block' }}>Section (Optional)</label>
                                <select
                                    className="input-field"
                                    value={selectedSection}
                                    onChange={e => setSelectedSection(e.target.value)}
                                    style={{ borderRadius: '0.75rem', padding: '0.75rem 1rem' }}
                                >
                                    <option value="">All Sections</option>
                                    {['A', 'B', 'C', 'D', 'E'].map(s => (
                                        <option key={s} value={s}>Section {s}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Single Exam Selection */}
                        {reportMode === 'single' && (
                            <div className="form-group">
                                <label style={{ fontWeight: 700, fontSize: '0.875rem', color: '#475569', marginBottom: '0.5rem', display: 'block' }}>Target Exam *</label>
                                <select
                                    className="input-field"
                                    value={selectedExamId}
                                    onChange={e => setSelectedExamId(e.target.value)}
                                    style={{ borderRadius: '0.75rem', padding: '0.75rem 1rem' }}
                                >
                                    <option value="">Select Exam</option>
                                    {filteredExams.map((e: any) => (
                                        <option key={e.id} value={e.id}>
                                            {e.name}{e.displayName && e.displayName !== e.name ? ` (Print: ${e.displayName})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Combined Exams Selection */}
                    {reportMode === 'combined' && (
                        <div style={{ marginTop: '1.5rem' }}>
                            <label style={{ fontWeight: 700, fontSize: '0.875rem', color: '#475569', marginBottom: '0.75rem', display: 'block' }}>
                                Add Exams to Report (drag to reorder)
                            </label>

                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                                <select
                                    className="input-field"
                                    value={examToAdd}
                                    onChange={e => setExamToAdd(e.target.value)}
                                    style={{ flex: 1, borderRadius: '0.75rem', padding: '0.75rem 1rem' }}
                                >
                                    <option value="">Select exam to add...</option>
                                    {filteredExams
                                        .filter((e: any) => !selectedExams.find(se => se.id === e.id))
                                        .map((e: any) => (
                                            <option key={e.id} value={e.id}>
                                                {e.name}{e.termName ? ` (${e.termName})` : ''}
                                            </option>
                                        ))}
                                </select>
                                <button
                                    onClick={handleAddExam}
                                    disabled={!examToAdd}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        background: examToAdd ? '#6366f1' : '#e2e8f0',
                                        color: examToAdd ? 'white' : '#94a3b8',
                                        border: 'none', borderRadius: '0.75rem',
                                        padding: '0.75rem 1.5rem', fontWeight: 700,
                                        cursor: examToAdd ? 'pointer' : 'not-allowed'
                                    }}
                                >
                                    <PlusCircle size={18} /> Add
                                </button>
                            </div>

                            {/* Selected Exams List */}
                            {selectedExams.length > 0 && (
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', overflow: 'hidden' }}>
                                    {selectedExams.map((exam, idx) => (
                                        <div
                                            key={exam.id}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '0.75rem 1rem', background: idx % 2 === 0 ? 'white' : '#fafafa',
                                                borderBottom: idx < selectedExams.length - 1 ? '1px solid #e2e8f0' : 'none'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ color: '#94a3b8', cursor: 'grab' }}><GripVertical size={16} /></div>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6366f1', background: '#eff6ff', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                                                    {idx + 1}
                                                </span>
                                                <span style={{ fontWeight: 600 }}>{exam.displayName}</span>
                                                {exam.termName && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({exam.termName})</span>}
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                                                    Wt%:
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={100}
                                                        value={examWeightages[exam.id] || 0}
                                                        onChange={e => setExamWeightages(prev => ({ ...prev, [exam.id]: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }))}
                                                        style={{ width: '50px', padding: '0.25rem 0.375rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700, textAlign: 'center' }}
                                                    />
                                                </label>
                                                <button onClick={() => moveExam(idx, 'up')} disabled={idx === 0} style={{ background: '#f1f5f9', border: 'none', padding: '0.25rem', borderRadius: '4px', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.5 : 1 }}>↑</button>
                                                <button onClick={() => moveExam(idx, 'down')} disabled={idx === selectedExams.length - 1} style={{ background: '#f1f5f9', border: 'none', padding: '0.25rem', borderRadius: '4px', cursor: idx === selectedExams.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === selectedExams.length - 1 ? 0.5 : 1 }}>↓</button>
                                                <button onClick={() => handleRemoveExam(exam.id)} style={{ background: '#fef2f2', color: '#ef4444', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    ))}
                                    {/* Weightage Total Indicator */}
                                    {selectedExams.length > 0 && (
                                        <div style={{ padding: '0.5rem 1rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Total Weightage:</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: totalWeightageSum === 100 ? '#10b981' : totalWeightageSum > 0 ? '#f59e0b' : '#94a3b8' }}>
                                                {totalWeightageSum}%
                                                {totalWeightageSum === 100 && ' ✅'}
                                                {totalWeightageSum > 0 && totalWeightageSum !== 100 && ' ⚠️'}
                                            </span>
                                            {totalWeightageSum === 0 && <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>(raw marks mode)</span>}
                                        </div>
                                    )}
                                </div>
                            )}

                            {selectedExams.length === 0 && (
                                <div style={{ padding: '2rem', textAlign: 'center', border: '2px dashed #e2e8f0', borderRadius: '0.75rem', color: '#94a3b8' }}>
                                    <Layers size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                                    <p style={{ margin: 0, fontWeight: 600 }}>No exams selected yet</p>
                                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem' }}>Add exams in the order you want them to appear in columns</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Options */}
                <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem', borderRadius: '1.5rem', border: 'none' }}>
                    <h4 style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '1rem', color: '#1e293b' }}>📋 Display Options</h4>

                    {/* Row 1: Basic Options */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                            <input type="checkbox" checked={showGrandTotal} onChange={e => setShowGrandTotal(e.target.checked)} style={{ accentColor: '#6366f1' }} />
                            Grand Total
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                            <input type="checkbox" checked={showStudentImage} onChange={e => setShowStudentImage(e.target.checked)} style={{ accentColor: '#6366f1' }} />
                            Photo
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                            <input type="checkbox" checked={showOverallPercentage} onChange={e => setShowOverallPercentage(e.target.checked)} style={{ accentColor: '#6366f1' }} />
                            Overall %
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                            <input type="checkbox" checked={showOverallGrade} onChange={e => setShowOverallGrade(e.target.checked)} style={{ accentColor: '#6366f1' }} />
                            Overall Grade
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                            <input type="checkbox" checked={includeRemarks} onChange={e => setIncludeRemarks(e.target.checked)} style={{ accentColor: '#6366f1' }} />
                            Remarks
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                            <input type="checkbox" checked={enableWatermark} onChange={e => setEnableWatermark(e.target.checked)} style={{ accentColor: '#6366f1' }} />
                            Watermark
                        </label>
                        {enableWatermark && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.5rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.75rem', color: '#64748b', marginRight: '0.25rem' }}>Size (%):</span>
                                <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
                                    <button
                                        onClick={() => setWatermarkSize(Math.max(50, watermarkSize - 5))}
                                        style={{ border: 'none', background: '#f1f5f9', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 800, color: '#475569' }}
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        value={watermarkSize}
                                        onChange={e => setWatermarkSize(parseInt(e.target.value) || 0)}
                                        style={{ width: '50px', border: 'none', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', textAlign: 'center', height: '30px', fontWeight: 700, fontSize: '0.8125rem', appearance: 'none', WebkitAppearance: 'none', margin: 0 }}
                                    />
                                    <button
                                        onClick={() => setWatermarkSize(Math.min(200, watermarkSize + 5))}
                                        style={{ border: 'none', background: '#f1f5f9', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 800, color: '#475569' }}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        )}
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                            <input type="checkbox" checked={showResultStatus} onChange={e => setShowResultStatus(e.target.checked)} style={{ accentColor: '#6366f1' }} />
                            Result (Pass/Fail)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                            <input type="checkbox" checked={showRank} onChange={e => setShowRank(e.target.checked)} style={{ accentColor: '#6366f1' }} />
                            Rank (Top 10)
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Accent:</span>
                            {['#1e40af', '#10b981', '#6366f1', '#f59e0b', '#ef4444', '#1f2937'].map(color => (
                                <button
                                    key={color}
                                    onClick={() => setAccentColor(color)}
                                    style={{
                                        width: '24px', height: '24px', borderRadius: '50%',
                                        background: color, border: accentColor === color ? '3px solid white' : 'none',
                                        boxShadow: accentColor === color ? `0 0 0 2px ${color}` : 'none',
                                        cursor: 'pointer'
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Row 2: School Subtitle */}
                    <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                        <label style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#475569', display: 'block', marginBottom: '0.5rem' }}>
                            School Subtitle / Tagline (appears below school name)
                        </label>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                            <textarea
                                value={schoolSubtitle}
                                onChange={e => setSchoolSubtitle(e.target.value)}
                                placeholder="e.g., Run by ABC Trust&#10;An English Medium Co-educational School&#10;Affiliated to CBSE, New Delhi"
                                style={{
                                    flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0',
                                    fontSize: '0.875rem', minHeight: '70px', resize: 'vertical', fontFamily: 'inherit'
                                }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', justifyContent: 'center' }}>
                                <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Font Size</label>
                                <select
                                    value={subtitleFontSize}
                                    onChange={e => setSubtitleFontSize(Number(e.target.value))}
                                    style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0', fontSize: '0.875rem', marginBottom: '0.5rem' }}
                                >
                                    {[10, 11, 12, 13, 14, 16, 18, 20].map(size => (
                                        <option key={size} value={size}>{size}px</option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleSaveConfig}
                                    className="btn-primary"
                                    style={{
                                        padding: '0.5rem 1rem',
                                        fontSize: '0.75rem',
                                        borderRadius: '0.375rem',
                                        background: '#10b981',
                                        color: 'white',
                                        border: 'none',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Save Subtitle
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Row 2.5: Principal Signature & Subject Ordering */}
                    <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            {/* Principal Signature */}
                            <div>
                                <label style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#475569', display: 'block', marginBottom: '0.5rem' }}>
                                    Principal Signature Image
                                </label>
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <input
                                        type="text"
                                        value={principalSignatureUrl && !principalSignatureUrl.startsWith('data:') ? principalSignatureUrl : ''}
                                        onChange={e => setPrincipalSignatureUrl(e.target.value)}
                                        placeholder="Or paste image URL"
                                        style={{
                                            flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0',
                                            fontSize: '0.875rem', fontFamily: 'inherit'
                                        }}
                                    />
                                    <label style={{
                                        padding: '0.75rem 1rem',
                                        borderRadius: '0.5rem',
                                        background: '#10b981',
                                        color: 'white',
                                        fontWeight: 700,
                                        fontSize: '0.875rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        📤 Upload
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleSignatureUpload}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                </div>
                                {principalSignatureUrl && (
                                    <div>
                                        <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '0.375rem', textAlign: 'center' }}>
                                            <img src={principalSignatureUrl} alt="Preview" style={{ height: `${signatureHeight}px`, objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', padding: '0.25rem 0.5rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.75rem', color: '#64748b', marginRight: '0.25rem' }}>Height (px):</span>
                                            <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
                                                <button
                                                    onClick={() => setSignatureHeight(Math.max(10, signatureHeight - 5))}
                                                    style={{ border: 'none', background: '#f1f5f9', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 800, color: '#475569' }}
                                                >
                                                    -
                                                </button>
                                                <input
                                                    type="number"
                                                    value={signatureHeight}
                                                    onChange={e => setSignatureHeight(parseInt(e.target.value) || 0)}
                                                    style={{ width: '50px', border: 'none', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', textAlign: 'center', height: '30px', fontWeight: 700, fontSize: '0.8125rem' }}
                                                />
                                                <button
                                                    onClick={() => setSignatureHeight(Math.min(150, signatureHeight + 5))}
                                                    style={{ border: 'none', background: '#f1f5f9', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 800, color: '#475569' }}
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Subject Ordering Button */}
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                <label style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#475569', display: 'block', marginBottom: '0.5rem' }}>
                                    Subject Display Order
                                </label>
                                <button
                                    onClick={() => {
                                        const examId = reportMode === 'single' ? selectedExamId : (selectedExams.length > 0 ? selectedExams[0].id : '');
                                        if (!examId) {
                                            alert('Please select an exam first');
                                            return;
                                        }
                                        setManagingSubjectsForExam(examId);
                                    }}
                                    disabled={!selectedExamId && selectedExams.length === 0}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        fontSize: '0.875rem',
                                        borderRadius: '0.5rem',
                                        background: (selectedExamId || selectedExams.length > 0) ? '#6366f1' : '#e2e8f0',
                                        color: (selectedExamId || selectedExams.length > 0) ? 'white' : '#94a3b8',
                                        border: 'none',
                                        fontWeight: 700,
                                        cursor: (selectedExamId || selectedExams.length > 0) ? 'pointer' : 'not-allowed'
                                    }}
                                >
                                    📌 Manage Subject Order
                                </button>
                            </div>
                        </div>

                        {/* Subject Ordering Modal/Interface */}
                        {managingSubjectsForExam && (() => {
                            const exam = schoolExams.find((e: any) => e.id === managingSubjectsForExam);
                            if (!exam) return null;

                            const examSubjects = getExamSubjects(exam).map((s: any) => s.subjectName);
                            const currentOrder = subjectOrdering[managingSubjectsForExam] || examSubjects;

                            const moveSubject = (fromIndex: number, toIndex: number) => {
                                const newOrder = [...currentOrder];
                                const [moved] = newOrder.splice(fromIndex, 1);
                                newOrder.splice(toIndex, 0, moved);
                                setSubjectOrdering(prev => ({ ...prev, [managingSubjectsForExam]: newOrder }));
                            };

                            return (
                                <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <h5 style={{ margin: 0, fontWeight: 800, fontSize: '0.875rem' }}>
                                            Subject Order for: {exam.name || exam.displayName}
                                        </h5>
                                        <button
                                            onClick={async () => {
                                                await handleSaveConfig();
                                                setManagingSubjectsForExam(null);
                                            }}
                                            style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.375rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 700 }}
                                        >
                                            ✓ Save & Close
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {currentOrder.map((subject, idx) => (
                                            <div key={subject} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'white', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}>
                                                <span style={{ fontWeight: 700, color: '#6366f1', minWidth: '24px' }}>{idx + 1}.</span>
                                                <span style={{ flex: 1, fontWeight: 600, fontSize: '0.8125rem' }}>{subject}</span>
                                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                    <button
                                                        onClick={() => moveSubject(idx, idx - 1)}
                                                        disabled={idx === 0}
                                                        style={{ background: '#f1f5f9', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.5 : 1 }}
                                                    >
                                                        ↑
                                                    </button>
                                                    <button
                                                        onClick={() => moveSubject(idx, idx + 1)}
                                                        disabled={idx === currentOrder.length - 1}
                                                        style={{ background: '#f1f5f9', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: idx === currentOrder.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === currentOrder.length - 1 ? 0.5 : 1 }}
                                                    >
                                                        ↓
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Row 3: Student Fields */}
                    <div>
                        <label style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#475569', display: 'block', marginBottom: '0.75rem' }}>
                            Student Information Fields to Display
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                            {[
                                { key: 'name', label: 'Name' },
                                { key: 'class', label: 'Class' },
                                { key: 'rollNo', label: 'Roll No.' },
                                { key: 'fatherName', label: "Father's Name" },
                                { key: 'admissionNo', label: 'Admission No.' },
                                { key: 'dob', label: 'Date of Birth' },
                                { key: 'motherName', label: "Mother's Name" },
                                { key: 'address', label: 'Address' },
                                { key: 'mobile', label: 'Mobile No.' }
                            ].map(field => (
                                <label key={field.key} style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
                                    padding: '0.5rem 0.75rem', background: studentFields[field.key as keyof typeof studentFields] ? '#eff6ff' : '#f8fafc',
                                    borderRadius: '0.5rem', border: `1px solid ${studentFields[field.key as keyof typeof studentFields] ? '#6366f1' : '#e2e8f0'}`,
                                    fontSize: '0.8125rem', fontWeight: 600
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={studentFields[field.key as keyof typeof studentFields]}
                                        onChange={e => setStudentFields(prev => ({ ...prev, [field.key]: e.target.checked }))}
                                        style={{ accentColor: '#6366f1' }}
                                    />
                                    {field.label}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            onClick={handleSaveConfig}
                            style={{
                                padding: '0.875rem 2rem',
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.75rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
                            }}
                        >
                            💾 Save All Preferences
                        </button>
                    </div>
                </div>

                {/* Students Summary */}
                {selectedClass && (
                    <div className="card" style={{ padding: '1.5rem', borderRadius: '1.5rem' }}>
                        <h4 style={{ fontWeight: 800, marginBottom: '1rem' }}>Students Ready ({filteredStudents.length})</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                            {filteredStudents.map(student => (
                                <div key={student.id} style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid #e2e8f0' }}>
                                    <div style={{ width: '28px', height: '28px', background: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.7rem' }}>
                                        {student.classRollNo || '?'}
                                    </div>
                                    <span style={{ fontWeight: 600, fontSize: '0.875rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Print Only Section - Sibling to page-container, NOT inside it */}
            <div className="print-only">
                {reportMode === 'single' && sortedStudents.map(student => (
                    <SingleCard key={student.id} student={student} />
                ))}
                {reportMode === 'combined' && sortedStudents.map(student => (
                    <CombinedCard key={student.id} student={student} />
                ))}
            </div>

            {/* Preview Modal */}
            {showPreview && (
                <>
                    <div className="modal-overlay" onClick={() => setShowPreview(false)} />
                    <div className="modal" style={{ maxWidth: '1100px', padding: 0, height: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.25rem 2rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ fontWeight: 900, margin: 0 }}>Report Preview</h3>
                                <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '0.25rem 0 0' }}>
                                    {reportMode === 'combined' ? `Combined: ${selectedExams.length} exams` : 'Single Exam Report'}
                                </p>
                            </div>
                            <button onClick={() => setShowPreview(false)} className="btn-secondary" style={{ padding: '0.5rem' }}><X size={20} /></button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', background: '#f1f5f9', padding: '2rem' }}>
                            {filteredStudents.length > 0 ? (
                                reportMode === 'single'
                                    ? <SingleCard student={filteredStudents[0]} />
                                    : <CombinedCard student={filteredStudents[0]} />
                            ) : (
                                <div style={{ textAlign: 'center', padding: '4rem' }}>
                                    <Users size={48} style={{ margin: '0 auto', color: '#94a3b8', marginBottom: '1rem' }} />
                                    <p>Select class and exams to preview</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

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
                        margin: 0.3cm;
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
                        display: block;
                        max-width: 100% !important;
                        height: auto;
                    }

                    /* Watermark specific styles for print */
                    .watermark-container {
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        transform: none !important;
                        opacity: 0.04 !important;
                        pointer-events: none !important;
                        z-index: 0 !important;
                        width: 100% !important;
                        height: 100% !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    /* Watermark image should maintain its size */
                    .watermark-container img {
                        max-width: none !important;
                        width: ${watermarkSize}% !important;
                        height: ${watermarkSize}% !important;
                        object-fit: contain !important;
                        display: block !important;
                    }

                    /* Principal signature should maintain slider height */
                    .print-active img[alt="Principal Signature"],
                    .report-card-container img[alt="Principal Signature"] {
                        height: ${signatureHeight}px !important;
                        max-height: none !important;
                        width: auto !important;
                        max-width: none !important;
                        object-fit: contain !important;
                        display: block !important;
                    }

                    /* Style each report card for printing */
                    .report-card-container {
                        position: relative !important;
                        margin: 0 !important;
                        padding: 0.5cm !important;
                        page-break-after: always !important;
                        page-break-inside: avoid !important;
                        box-shadow: none !important;
                        border: 1px solid #000 !important;
                        width: 100% !important;
                        max-width: none !important;
                        background: white !important;
                        display: block !important;
                        box-sizing: border-box !important;
                        overflow: visible !important;
                    }

                    /* Ensure student info background prints */
                    .report-card-container > div {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* Last card should not have page break */
                    .report-card-container:last-child {
                        page-break-after: auto !important;
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

export default PrintReportCard2;
