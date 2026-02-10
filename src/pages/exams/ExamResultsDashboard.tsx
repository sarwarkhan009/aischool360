import React, { useState, useMemo } from 'react';
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
    ChevronDown
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { sortClasses } from '../../constants/app';
import { useSchool } from '../../context/SchoolContext';
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
    const { currentSchool } = useSchool();
    const { data: exams, update: updateExam } = useFirestore<any>('exams');
    const { data: marksEntries } = useFirestore<any>('marks_entries');
    const { data: studentList } = useFirestore<any>('students');
    const { data: gradingSystems } = useFirestore<any>('grading_systems');
    const { data: allSettings } = useFirestore<any>('settings');

    const activeClasses = sortClasses(allSettings?.filter((d: any) => d.type === 'class' && d.active !== false) || []);

    const [selectedExamId, setSelectedExamId] = useState<string>('');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedSection, setSelectedSection] = useState<string>('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Helper to get class name from ID/Slug
    const getClassName = (classId: string) => {
        if (!classId) return '';
        const cls = activeClasses.find((c: any) => c.id === classId || c.name === classId);
        return cls?.name || classId;
    };
    const [searchQuery, setSearchQuery] = useState('');

    const schoolExams = exams?.filter((e: any) => e.schoolId === currentSchool?.id) || [];
    const selectedExam = schoolExams.find((e: any) => e.id === selectedExamId);
    const availableClasses = selectedExam?.targetClasses || [];
    const defaultGrading = gradingSystems?.find((g: any) => g.schoolId === currentSchool?.id && g.isDefault);

    // Calculate Results
    const calculatedResults = useMemo(() => {
        if (!selectedExamId || !selectedClass || !marksEntries || !studentList) return [];

        // Selected Class Name for matching (optional, some records might use name instead of ID)
        const selectedClassObj = activeClasses.find((c: any) => c.id === selectedClass);
        const selectedClassName = selectedClassObj?.name;

        // Marks are usually stored per class/subject. 
        // We filter students by section if selected.
        const examMarks = marksEntries.filter((m: any) =>
            m.examId === selectedExamId &&
            (m.classId === selectedClass || (selectedClassName && m.className === selectedClassName) || m.classId === selectedClassName) &&
            (m.status === 'APPROVED' || m.status === 'SUBMITTED') &&
            (!selectedSection || m.sectionId === selectedSection || m.sectionName === selectedSection)
        );

        const classStudents = studentList.filter((s: any) =>
            s.schoolId === currentSchool?.id &&
            (s.class === selectedClass || (selectedClassName && s.class === selectedClassName)) &&
            s.status === 'ACTIVE' &&
            (!selectedSection || s.section === selectedSection)
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

            selectedExam.subjects.forEach((sub: any) => {
                // Try to find marks entry by subjectId first, then fallback to subjectName matching
                let entry = studentSectionMarks.find((m: any) => m.subjectId === sub.subjectId);

                // Fallback: Try matching by subjectName if subjectId doesn't match
                if (!entry) {
                    const subName = (sub.subjectName || sub.name).toUpperCase().trim();
                    const cleanSubName = subName.replace(/[\s./-]/g, '');
                    const subCombined = (sub.combinedSubjects || []).map((c: string) => c.toUpperCase().trim().replace(/[\s./-]/g, ''));

                    entry = studentSectionMarks.find((m: any) => {
                        const mSubName = (m.subjectName || '').toUpperCase().trim();
                        const cleanMSubName = mSubName.replace(/[\s./-]/g, '');

                        // Exact match
                        if (cleanSubName === cleanMSubName) return true;

                        // Substring match (handles things like "Hindi (Marks)" matching "Hindi")
                        if (cleanSubName.includes(cleanMSubName) || cleanMSubName.includes(cleanSubName)) return true;

                        // Combined subjects match
                        if (subCombined.some((c: string) => cleanMSubName.includes(c) || c.includes(cleanMSubName))) return true;

                        // Abbreviations match
                        const isAbbrev = (cleanMSubName.includes('URDU') && cleanSubName.includes('URDU')) ||
                            (cleanMSubName.includes('SANS') && cleanSubName.includes('SANS')) ||
                            (cleanMSubName.includes('DEEN') && cleanSubName.includes('DEEN')) ||
                            (cleanMSubName.includes('CONV') && cleanSubName.includes('CONV')) ||
                            (cleanMSubName.includes('COMP') && cleanSubName.includes('COMP'));

                        return isAbbrev;
                    });
                }

                const studentMark = entry?.marks?.find((sm: any) => sm.studentId === student.id);
                const isAbsent = studentMark?.isAbsent || false;
                const isNA = studentMark?.isNA || false;

                const obtained = isNA ? 'NA' : (isAbsent ? 'AB' : (studentMark?.obtainedMarks || 0));
                const isGradeBased = sub.assessmentType === 'GRADE';

                marks[sub.subjectId] = isGradeBased ? (studentMark?.grade || 'N/A') : obtained;

                // Only add to totals if NOT grade-based and NOT NA
                if (!isGradeBased && !isNA) {
                    totalObtained += (typeof obtained === 'number' ? obtained : 0);
                    totalMax += sub.maxMarks;
                }

                const passThreshold = (sub.maxMarks * (sub.passingMarks || 0)) / 100;
                if (!isGradeBased && !isAbsent && (typeof obtained === 'number') && obtained < passThreshold) {
                    failedSubjects.push(sub.subjectName);
                }
            });

            const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;

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
                    const max = typeof r.max === 'string' ? parseFloat(r.max) : r.max;
                    const matches = percentage >= min && percentage <= max;

                    return matches;
                });

                grade = range?.grade || 'F';

            } else {

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
                status: failedSubjects.length === 0 ? 'PASS' : failedSubjects.length > 2 ? 'FAIL' : 'COMPARTMENT',
                failedSubjects
            };
        });

        // Calculate Ranks
        return results
            .sort((a, b) => b.percentage - a.percentage)
            .map((res, index) => ({ ...res, rank: index + 1 }));

    }, [selectedExamId, selectedClass, selectedSection, marksEntries, studentList, selectedExam, defaultGrading, currentSchool?.id, activeClasses]);

    // Sorting logic with numeric support
    const sortedResults = useMemo(() => {
        if (!sortConfig) return calculatedResults;

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
            const row: any = {
                'Rank': res.rank,
                'Roll No': res.rollNumber,
                'Student Name': res.studentName,
            };

            selectedExam.subjects.forEach((sub: any) => {
                const combinedNames = sub.combinedSubjects && sub.combinedSubjects.length > 0
                    ? ` / ${sub.combinedSubjects.join(' / ')}`
                    : '';
                const headerName = `${sub.subjectName}${combinedNames}`;
                row[headerName] = res.marks[sub.subjectId];
            });

            row['Total'] = `${res.totalObtained}/${res.totalMax}`;
            row['Percentage'] = res.percentage.toFixed(2) + '%';
            row['Grade'] = res.grade;
            row['Status'] = res.status;

            return row;
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Results");
        XLSX.writeFile(wb, `${selectedExam.displayName || selectedExam.name}_${selectedClass}_Results.xlsx`);
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

        const selectedClassObj = activeClasses.find((c: any) => c.id === selectedClass);
        const selectedClassName = selectedClassObj?.name;

        const marksToDelete = marksEntries?.filter((m: any) =>
            m.examId === selectedExamId &&
            (m.classId === selectedClass || (selectedClassName && m.className === selectedClassName) || m.classId === selectedClassName)
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
                    <h1 className="page-title">Exam Results & Analytics</h1>
                    <p className="page-subtitle">View and publish comprehensive exam results</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {selectedExamId && selectedClass && marksEntries?.some((m: any) => m.examId === selectedExamId && (m.classId === selectedClass || m.className === (activeClasses.find((c: any) => c.id === selectedClass)?.name))) && (
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
                        onClick={exportToExcel}
                        className="btn"
                        disabled={!filteredResults.length}
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
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
                            {schoolExams.map(exam => (
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

            {selectedExamId && selectedClass && calculatedResults.length > 0 && (
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
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border)' }}>
                                    <th
                                        style={{ padding: '1rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                                        onClick={() => handleSort('rank')}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            Rank
                                            {sortConfig?.key === 'rank' && (
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
                                    {selectedExam.subjects.map((sub: any) => {
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
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredResults.map((res) => (
                                    <tr key={res.studentId} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover-highlight">
                                        <td style={{ padding: '1rem' }}>
                                            {res.rank <= 3 ? (
                                                <div style={{
                                                    width: '24px',
                                                    height: '24px',
                                                    borderRadius: '50%',
                                                    background: res.rank === 1 ? '#fbbf24' : res.rank === 2 ? '#9ca3af' : '#b45309',
                                                    color: 'white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 800,
                                                    fontSize: '0.75rem'
                                                }}>
                                                    {res.rank}
                                                </div>
                                            ) : res.rank}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{res.studentName}</div>
                                        </td>
                                        <td style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                            {res.rollNumber}
                                        </td>
                                        {selectedExam.subjects.map((sub: any) => {
                                            const isGradeBased = sub.assessmentType === 'GRADE';
                                            const hasSplit = !isGradeBased && (sub.theoryMarks > 0 && sub.practicalMarks > 0);

                                            if (hasSplit) {
                                                // Find the marks entry to get theory and practical separately
                                                const upSubjectName = (sub.subjectName || sub.name).toUpperCase().trim();
                                                const cleanUpSubjectName = upSubjectName.replace(/[\s.]/g, '');

                                                // Find the student to get their section
                                                const currentStudent = studentList?.find((s: any) => s.id === res.studentId);

                                                const selectedClassObj = activeClasses.find((c: any) => c.id === selectedClass);
                                                const selectedClassName = selectedClassObj?.name;

                                                const examMarks = marksEntries?.filter((m: any) =>
                                                    m.examId === selectedExamId &&
                                                    (m.classId === selectedClass || (selectedClassName && m.className === selectedClassName) || m.classId === selectedClassName) &&
                                                    (m.status === 'APPROVED' || m.status === 'SUBMITTED') &&
                                                    // Filter by student's specific section
                                                    (currentStudent ? (m.sectionId === currentStudent.section || m.sectionName === currentStudent.section) : true)
                                                ) || [];

                                                let entry = examMarks.find((m: any) => m.subjectId === sub.subjectId);

                                                if (!entry) {
                                                    const subName = (sub.subjectName || sub.name).toUpperCase().trim();
                                                    const cleanSubName = subName.replace(/[\s./-]/g, '');
                                                    const subCombined = (sub.combinedSubjects || []).map((c: string) => c.toUpperCase().trim().replace(/[\s./-]/g, ''));

                                                    entry = examMarks.find((m: any) => {
                                                        const mSubName = (m.subjectName || '').toUpperCase().trim();
                                                        const cleanMSubName = mSubName.replace(/[\s./-]/g, '');

                                                        if (cleanSubName === cleanMSubName) return true;
                                                        if (cleanSubName.includes(cleanMSubName) || cleanMSubName.includes(cleanSubName)) return true;
                                                        if (subCombined.some((c: string) => cleanMSubName.includes(c) || c.includes(cleanMSubName))) return true;

                                                        const isAbbrev = (cleanMSubName.includes('URDU') && cleanSubName.includes('URDU')) ||
                                                            (cleanMSubName.includes('SANS') && cleanSubName.includes('SANS')) ||
                                                            (cleanMSubName.includes('DEEN') && cleanSubName.includes('DEEN')) ||
                                                            (cleanMSubName.includes('CONV') && cleanSubName.includes('CONV')) ||
                                                            (cleanMSubName.includes('COMP') && cleanSubName.includes('COMP'));
                                                        return isAbbrev;
                                                    });
                                                }

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
                                                                color: isAbsent ? '#6b7280' : (theoryFailed ? '#ef4444' : 'inherit'),
                                                                fontWeight: (theoryFailed || isAbsent) ? 700 : 500,
                                                                fontStyle: isAbsent ? 'italic' : 'normal'
                                                            }}>
                                                                {theoryVal}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                            <span style={{
                                                                color: isAbsent ? '#6b7280' : (practicalFailed ? '#ef4444' : 'inherit'),
                                                                fontWeight: (practicalFailed || isAbsent) ? 700 : 500,
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
                                            const isGrade = typeof val === 'string' && val !== 'AB';
                                            const passThreshold = (sub.maxMarks * (sub.passingMarks || 0)) / 100;
                                            const isFailed = !isGrade && !isAbsent && typeof val === 'number' && val < passThreshold;

                                            return (
                                                <td key={sub.subjectId} style={{ padding: '1rem', textAlign: 'center' }}>
                                                    <span style={{
                                                        color: isAbsent ? '#6b7280' : (isFailed ? '#ef4444' : 'inherit'),
                                                        fontWeight: (isFailed || isGrade || isAbsent) ? 700 : 500,
                                                        fontStyle: isAbsent ? 'italic' : 'normal'
                                                    }}>
                                                        {val}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                        <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 600 }}>
                                            {res.totalObtained}/{res.totalMax}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <div style={{ fontWeight: 700, color: res.percentage >= 33 ? 'var(--primary)' : '#ef4444' }}>
                                                {res.percentage.toFixed(1)}%
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '0.25rem 0.625rem',
                                                borderRadius: '999px',
                                                background: 'var(--bg-main)',
                                                border: '1px solid var(--border)',
                                                fontWeight: 700
                                            }}>
                                                {res.grade}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '999px',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                background: res.status === 'PASS' ? '#10b98120' : res.status === 'FAIL' ? '#ef444420' : '#f59e0b20',
                                                color: res.status === 'PASS' ? '#10b981' : res.status === 'FAIL' ? '#ef4444' : '#f59e0b'
                                            }}>
                                                {res.status}
                                            </span>
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
            )}

            {selectedExamId && selectedClass && calculatedResults.length === 0 && (
                <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
                    <Users size={64} style={{ margin: '0 auto', color: 'var(--text-muted)', marginBottom: '1.5rem' }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>No Results Calculated</h3>
                    <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '1rem auto' }}>
                        Make sure marks have been entered and approved for all subjects of this exam and class.
                    </p>
                </div>
            )}
        </div>
    );
};

export default ExamResultsDashboard;
