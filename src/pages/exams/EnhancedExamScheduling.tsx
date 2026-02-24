import React, { useState, useEffect } from 'react';
import {
    Calendar,
    Plus,
    Edit2,
    Trash2,
    Copy,
    Eye,
    EyeOff,
    Search,
    Filter,
    BookOpen,
    Clock,
    Users,
    FileText,
    CheckCircle,
    AlertCircle,
    X,
    MapPin,
    ChevronDown,
    Printer
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';
import { useAuth } from '../../context/AuthContext';
import { sortClasses } from '../../constants/app';
import { toProperCase } from '../../utils/formatters';

interface ExamSubject {
    subjectId: string;
    subjectName: string;
    combinedSubjects?: string[]; // Array of subject IDs to combine (e.g., Urdu, Deeniyat, Sanskrit)
    assessmentType: 'MARKS' | 'GRADE'; // Marks-based or Grade-based assessment
    maxMarks: number;
    passingMarks: number;
    duration: number; // in minutes
    examDate: string;
    examTime: string;
    examiner: string;
    roomNumber?: string;
    venue?: string;
    theoryMarks?: number;
    practicalMarks?: number;
    internalMarks?: number;
    externalMarks?: number;
}

// Class-wise routine: each class has its own subjects + schedule
interface ClassRoutineEntry {
    subjectId: string;
    subjectName: string;
    combinedSubjects?: string[];
    assessmentType: 'MARKS' | 'GRADE';
    maxMarks: number;
    passingMarks: number; // percentage
    examDate: string;
    examTime: string;
    duration: number; // minutes
    venue?: string;
    roomNumber?: string;
    theoryMarks?: number;
    practicalMarks?: number;
}

interface ClassRoutine {
    classId: string;
    className: string;
    routine: ClassRoutineEntry[];
}

interface Exam {
    id: string;
    schoolId: string;
    name: string; // Internal name (e.g., Unit Test 3 (1-5))
    displayName: string; // Public name for printing (e.g., Unit Test 3)
    academicYearId: string;
    academicYearName: string;
    termId?: string;
    termName?: string;
    assessmentTypeId: string;
    assessmentTypeName: string;
    targetClasses: string[]; // Array of class IDs
    startDate: string;
    endDate: string;
    subjects: ExamSubject[];
    classRoutines?: ClassRoutine[]; // NEW: class-specific subjects + schedule
    instructions: string;
    syllabusAttachments: string[];
    status: 'DRAFT' | 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
    isPublished: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

const STATUS_COLORS = {
    DRAFT: '#6b7280',
    SCHEDULED: '#3b82f6',
    ONGOING: '#f59e0b',
    COMPLETED: '#10b981',
    CANCELLED: '#ef4444'
};

const EnhancedExamScheduling: React.FC = () => {
    // ─── Teacher-specific state ───────────────────────────────────
    const [teacherSelectedExamId, setTeacherSelectedExamId] = useState<string>('');
    const [teacherSelectedClassId, setTeacherSelectedClassId] = useState<string>('');
    const [teacherSaving, setTeacherSaving] = useState(false);
    const [teacherActiveView, setTeacherActiveView] = useState<'ENTRY' | 'ROUTINE'>('ENTRY');
    const [teacherAssignedClasses, setTeacherAssignedClasses] = useState<string[]>([]);
    const { currentSchool } = useSchool();
    const { user } = useAuth();
    const { data: exams, add: addDocument, update: updateDocument, remove: deleteDocument } = useFirestore<Exam>('exams');
    const { data: academicYears } = useFirestore<any>('academic_years');
    const { data: assessmentTypes } = useFirestore<any>('assessment_types');
    const { data: settings } = useFirestore<any>('settings');

    const [showModal, setShowModal] = useState(false);
    const [editingExam, setEditingExam] = useState<Exam | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [selectedClass, setSelectedClass] = useState<string>('ALL');
    const [modalTab, setModalTab] = useState<'GLOBAL' | 'ROUTINE'>('GLOBAL');
    const [activeView, setActiveView] = useState<'LIST' | 'PROGRAM'>('LIST');
    const [selectedProgramExamId, setSelectedProgramExamId] = useState<string>('');
    const [activeRoutineClassId, setActiveRoutineClassId] = useState<string>('');

    const [newExam, setNewExam] = useState<Partial<Exam>>({
        name: '',
        displayName: '',
        academicYearId: '',
        academicYearName: '',
        termId: '',
        termName: '',
        assessmentTypeId: '',
        assessmentTypeName: '',
        targetClasses: [],
        startDate: '',
        endDate: '',
        subjects: [],
        classRoutines: [],
        instructions: '',
        syllabusAttachments: [],
        status: 'DRAFT',
        isPublished: false
    });

    const isTeacher = user?.role === 'TEACHER';

    useEffect(() => {
        if (showModal && isTeacher) {
            setModalTab('ROUTINE');
            if (newExam.targetClasses?.length && !activeRoutineClassId) {
                setActiveRoutineClassId(newExam.targetClasses[0]);
            }
        }
    }, [showModal, isTeacher, newExam.targetClasses]);

    // Fetch teacher's assigned classes from school routine
    useEffect(() => {
        const fetchTeacherClasses = async () => {
            if (!isTeacher || !currentSchool?.id || !user?.name) return;
            try {
                const { doc: fbDoc, getDoc } = await import('firebase/firestore');
                const { db } = await import('../../lib/firebase');
                const routineRef = fbDoc(db, 'settings', `school_routine_${currentSchool.id}`);
                const routineSnap = await getDoc(routineRef);
                if (routineSnap.exists()) {
                    const routines = routineSnap.data().routines || [];
                    const teacherName = user.name || (user as any).username;
                    const classesSet = new Set<string>();
                    routines.forEach((r: any) => {
                        Object.values(r.schedule || {}).forEach((dayArr: any) => {
                            dayArr.forEach((p: any) => {
                                if (p.teacher && p.teacher.trim() === teacherName.trim()) {
                                    classesSet.add(r.className);
                                }
                            });
                        });
                    });
                    setTeacherAssignedClasses(Array.from(classesSet));
                }
            } catch (e) {
                console.error('Error fetching teacher assigned classes:', e);
            }
        };
        fetchTeacherClasses();
    }, [isTeacher, currentSchool?.id, user?.name]);

    // Filter data for current school
    const schoolExams = exams?.filter(e => e.schoolId === currentSchool?.id) || [];
    const schoolYears = academicYears?.filter(y => y.schoolId === currentSchool?.id && !y.isArchived) || [];
    const activeYear = schoolYears.find(y => y.isActive);
    const schoolAssessments = assessmentTypes?.filter(a => a.schoolId === currentSchool?.id && a.isActive) || [];
    const schoolClasses = sortClasses(settings?.filter(s => s.schoolId === currentSchool?.id && s.type === 'class' && s.active !== false) || []);


    // Get subjects from academic structure in settings
    // The academic structure document ID is: academic_structure_${schoolId}
    const academicStructure = settings?.find(s => s.id === `academic_structure_${currentSchool?.id}`);
    const schoolSubjects = (academicStructure?.subjects || []).map((s: any) => ({
        id: s.name,
        name: s.name
    })).sort((a: any, b: any) => a.name.localeCompare(b.name));

    // Filtered exams
    const filteredExams = schoolExams.filter(exam => {
        const matchesSearch = exam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            exam.assessmentTypeName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || exam.status === statusFilter;
        const matchesClass = selectedClass === 'ALL' || exam.targetClasses.includes(selectedClass);
        return matchesSearch && matchesStatus && matchesClass;
    });

    const handleSaveExam = async () => {
        if (!newExam.name || !newExam.academicYearId || !newExam.assessmentTypeId || !newExam.targetClasses?.length || !currentSchool?.id) {
            alert('Please fill in all required fields');
            return;
        }

        if (!newExam.startDate) {
            alert('Please select the exam start date');
            return;
        }

        try {
            // Firestore doesn't accept 'undefined' values. Strip them recursively.
            const cleanData = (obj: any): any => {
                if (obj === undefined) return undefined;
                if (obj === null) return null;
                if (typeof obj !== 'object') return obj;
                if (Array.isArray(obj)) {
                    return obj
                        .map(item => cleanData(item))
                        .filter(item => item !== undefined);
                }
                const newObj: any = {};
                Object.keys(obj).forEach(key => {
                    const val = obj[key];
                    if (val === undefined) return;
                    newObj[key] = cleanData(val);
                });
                return newObj;
            };

            const examData = cleanData({
                ...newExam,
                schoolId: currentSchool.id,
                updatedAt: new Date().toISOString()
            });

            if (editingExam) {
                await updateDocument(editingExam.id, examData);
            } else {
                await addDocument({
                    ...examData,
                    createdAt: new Date().toISOString(),
                    createdBy: user?.username || 'system'
                } as Exam);
            }

            setShowModal(false);
            setEditingExam(null);
            resetForm();
        } catch (error) {
            console.error('Error saving exam:', error);
            alert('Failed to save exam');
        }
    };

    const resetForm = () => {
        setNewExam({
            name: '',
            displayName: '',
            academicYearId: activeYear?.id || '',
            academicYearName: activeYear?.name || '',
            termId: '',
            termName: '',
            assessmentTypeId: '',
            assessmentTypeName: '',
            targetClasses: [],
            startDate: '',
            subjects: [],
            classRoutines: [],
            instructions: '',
            syllabusAttachments: [],
            status: 'DRAFT',
            isPublished: false
        });
        setModalTab('GLOBAL');
        setActiveRoutineClassId('');
    };

    // ─── Class Routine Handlers ───────────────────────────────────
    const getClassRoutine = (classId: string): ClassRoutine => {
        const cls = schoolClasses.find(c => c.id === classId);
        return newExam.classRoutines?.find(cr => cr.classId === classId) || {
            classId,
            className: cls?.name || classId,
            routine: []
        };
    };

    const updateClassRoutine = (classId: string, updatedRoutineOrFn: ClassRoutineEntry[] | ((prevRoutine: ClassRoutineEntry[]) => ClassRoutineEntry[])) => {
        const cls = schoolClasses.find(c => c.id === classId);
        setNewExam(prev => {
            const existing = prev.classRoutines || [];
            const idx = existing.findIndex(cr => cr.classId === classId);
            const updated = [...existing];

            const prevRoutine = idx >= 0 ? updated[idx].routine : [];
            const finalRoutine = typeof updatedRoutineOrFn === 'function' ? updatedRoutineOrFn(prevRoutine) : updatedRoutineOrFn;

            if (idx >= 0) {
                updated[idx] = { ...updated[idx], routine: finalRoutine };
            } else {
                updated.push({ classId, className: cls?.name || classId, routine: finalRoutine });
            }
            return { ...prev, classRoutines: updated };
        });
    };

    const handleAddRoutineEntry = (classId: string) => {
        const selectedAssessment = schoolAssessments.find(a => a.id === newExam.assessmentTypeId);
        const defaultPassMarks = selectedAssessment?.passingMarks ?? 33;

        updateClassRoutine(classId, prevRoutine => [
            ...prevRoutine,
            {
                subjectId: '',
                subjectName: '',
                assessmentType: 'MARKS',
                maxMarks: 100,
                passingMarks: defaultPassMarks,
                examDate: newExam.startDate || '',
                examTime: currentSchool?.examTimeMode === 'GLOBAL' ? (currentSchool.globalExamTime || '09:00') : '09:00',
                duration: 180,
                venue: ''
            }
        ]);
    };

    const handleRemoveRoutineEntry = (classId: string, entryIndex: number) => {
        updateClassRoutine(classId, prevRoutine => prevRoutine.filter((_, i) => i !== entryIndex));
    };

    const handleRoutineEntryChange = (classId: string, entryIndex: number, field: string, value: any) => {
        updateClassRoutine(classId, prevRoutine => {
            if (!prevRoutine[entryIndex]) return prevRoutine;
            const updated = [...prevRoutine];
            const entry = { ...updated[entryIndex] };

            if (field === 'subjectId') {
                const subject = schoolSubjects.find((s: any) => s.id === value);
                if (subject) entry.subjectName = subject.name;
                entry.subjectId = value;
            } else if (field === 'passMarksNumber') {
                const max = entry.maxMarks || 100;
                entry.passingMarks = Math.round((value / max) * 100);
            } else if (value === undefined) {
                delete (entry as any)[field];
            } else {
                (entry as any)[field] = value;
            }

            updated[entryIndex] = entry;
            return updated;
        });
    };

    const handleCopyRoutine = (fromClassId: string, toClassId: string) => {
        const source = getClassRoutine(fromClassId);
        if (source.routine.length === 0) {
            alert('Source class has no subjects to copy');
            return;
        }
        const toCls = schoolClasses.find(c => c.id === toClassId);
        if (!confirm(`Copy ${source.routine.length} subjects from ${source.className} to ${toCls?.name || toClassId}?`)) return;
        updateClassRoutine(toClassId, source.routine.map(entry => ({ ...entry })));
    };

    const handleDuplicateRoutineEntry = (classId: string, entryIndex: number) => {
        updateClassRoutine(classId, prevRoutine => {
            const entry = prevRoutine[entryIndex];
            if (!entry) return prevRoutine;

            let newDate = entry.examDate;
            if (newDate) {
                const d = new Date(newDate);
                d.setDate(d.getDate() + 1);
                newDate = d.toISOString().split('T')[0];
            }
            return [
                ...prevRoutine,
                { ...entry, subjectId: '', subjectName: '', examDate: newDate, theoryMarks: undefined, practicalMarks: undefined, combinedSubjects: undefined }
            ];
        });
    };

    const handleDeleteExam = async (id: string) => {
        if (!confirm('Are you sure you want to delete this exam?')) return;
        try {
            await deleteDocument(id);
        } catch (error) {
            console.error('Error deleting exam:', error);
            alert('Failed to delete exam');
        }
    };

    const handleDuplicateExam = async (exam: Exam) => {
        const duplicated = {
            ...exam,
            name: `${exam.name} (Copy)`,
            status: 'DRAFT' as const,
            isPublished: false
        };
        delete (duplicated as any).id;
        setEditingExam(null);
        setNewExam(duplicated);
        setShowModal(true);
    };

    const handleStatusChange = async (examId: string, newStatus: Exam['status']) => {
        try {
            await updateDocument(examId, { status: newStatus, updatedAt: new Date().toISOString() });
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update status');
        }
    };

    const handlePublishToggle = async (examId: string, currentPublishStatus: boolean) => {
        try {
            await updateDocument(examId, {
                isPublished: !currentPublishStatus,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error toggling publish status:', error);
            alert('Failed to update publish status');
        }
    };

    const handleAddSubject = () => {
        const selectedAssessment = schoolAssessments.find(a => a.id === newExam.assessmentTypeId);
        const defaultPassMarks = selectedAssessment?.passingMarks ?? 40;

        setNewExam(prev => ({
            ...prev,
            subjects: [
                ...(prev.subjects || []),
                {
                    subjectId: '',
                    subjectName: '',
                    assessmentType: 'MARKS',
                    maxMarks: 100,
                    passingMarks: defaultPassMarks,
                    duration: 180,
                    examDate: prev.startDate || '',
                    examTime: currentSchool?.examTimeMode === 'GLOBAL' ? (currentSchool.globalExamTime || '09:00') : '09:00',
                    examiner: '',
                    roomNumber: ''
                }
            ]
        }));
    };

    const handleRemoveSubject = (index: number) => {
        setNewExam(prev => ({
            ...prev,
            subjects: prev.subjects?.filter((_, i) => i !== index)
        }));
    };

    const handleDuplicateSubject = (index: number) => {
        setNewExam(prev => {
            const subjectToCopy = prev.subjects?.[index];
            if (!subjectToCopy) return prev;

            // Increment date by 1 day
            let newDate = subjectToCopy.examDate;
            if (newDate) {
                const currentDate = new Date(newDate);
                currentDate.setDate(currentDate.getDate() + 1);
                newDate = currentDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
            }

            return {
                ...prev,
                subjects: [
                    ...(prev.subjects || []),
                    {
                        ...subjectToCopy,
                        subjectId: '', // Clear subject selection for new entry
                        subjectName: '',
                        examDate: newDate, // Set date to +1 day
                        theoryMarks: undefined,
                        practicalMarks: undefined,
                        combinedSubjects: undefined
                    }
                ]
            };
        });
    };

    const handleSubjectChange = (index: number, field: string, value: any) => {
        setNewExam(prev => {
            if (!prev.subjects || !prev.subjects[index]) return prev;
            const updatedSubjects = [...prev.subjects];
            const subjectEntry = { ...updatedSubjects[index] };

            if (field === 'subjectId') {
                const subject = schoolSubjects.find((s: any) => s.id === value);
                if (subject) subjectEntry.subjectName = subject.name;
                subjectEntry.subjectId = value;
            } else if (field === 'passMarksNumber') {
                const max = subjectEntry.maxMarks || 100;
                subjectEntry.passingMarks = Math.round((value / max) * 100);
            } else if (value === undefined) {
                delete (subjectEntry as any)[field];
            } else {
                (subjectEntry as any)[field] = value;
            }

            updatedSubjects[index] = subjectEntry as ExamSubject;
            return { ...prev, subjects: updatedSubjects };
        });
    };

    // ─── Teacher Save Handler (only updates classRoutines on existing exam) ──
    const handleTeacherSaveRoutine = async () => {
        if (!teacherSelectedExamId || !teacherSelectedClassId) return;
        const exam = schoolExams.find(e => e.id === teacherSelectedExamId);
        if (!exam) return;

        setTeacherSaving(true);
        try {
            const cleanData = (obj: any): any => {
                if (obj === undefined) return undefined;
                if (obj === null) return null;
                if (typeof obj !== 'object') return obj;
                if (Array.isArray(obj)) {
                    return obj
                        .map(item => cleanData(item))
                        .filter(item => item !== undefined);
                }
                const newObj: any = {};
                Object.keys(obj).forEach(key => {
                    const val = obj[key];
                    if (val === undefined) return;
                    newObj[key] = cleanData(val);
                });
                return newObj;
            };

            // Merge the teacher's routine into the exam's classRoutines
            const existingRoutines = exam.classRoutines || [];
            const teacherRoutine = newExam.classRoutines || [];
            const mergedRoutines = [...existingRoutines];

            teacherRoutine.forEach(tr => {
                const idx = mergedRoutines.findIndex(r => r.classId === tr.classId);
                if (idx >= 0) {
                    mergedRoutines[idx] = tr;
                } else {
                    mergedRoutines.push(tr);
                }
            });

            await updateDocument(teacherSelectedExamId, cleanData({
                classRoutines: mergedRoutines,
                updatedAt: new Date().toISOString()
            }));
            alert('Exam schedule saved successfully!');
        } catch (error) {
            console.error('Error saving routine:', error);
            alert('Failed to save. Please try again.');
        } finally {
            setTeacherSaving(false);
        }
    };

    const handlePrintProgram = (examId: string) => {
        const exam = schoolExams.find(e => e.id === examId);
        if (!exam) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups to print');
            return;
        }

        const targetClasses = sortClasses(schoolClasses.filter(c => exam.targetClasses.includes(c.id)));

        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${exam.displayName || exam.name} - Exam Routine</title>
                <style>
                    @media print {
                        @page { margin: 1.5cm; size: A4; }
                        .page-break { page-break-after: always; }
                    }
                    body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1f2937; line-height: 1.5; padding: 20px; }
                    .school-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #4f46e5; padding-bottom: 20px; }
                    .school-name { font-size: 28px; font-weight: 900; margin: 0; color: #111827; text-transform: uppercase; letter-spacing: -0.01em; }
                    .exam-name { font-size: 18px; font-weight: 700; margin: 8px 0; color: #4f46e5; }
                    .routine-card { margin-bottom: 40px; page-break-inside: avoid; }
                    .class-header { background: #f8fafc; padding: 10px 15px; border-left: 5px solid #4f46e5; font-size: 16px; font-weight: 800; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
                    table { width: 100%; border-collapse: collapse; }
                    th { background: #f1f5f9; text-align: left; padding: 12px 10px; font-size: 11px; text-transform: uppercase; color: #64748b; border: 1px solid #e2e8f0; font-weight: 800; }
                    td { padding: 12px 10px; border: 1px solid #e2e8f0; font-size: 13px; }
                    .subject-name { font-weight: 700; color: #111827; }
                    .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
                </style>
            </head>
            <body>
                <div class="school-header">
                    <div class="school-name">${currentSchool?.name || 'School Name'}</div>
                    <div class="exam-name">${exam.displayName || exam.name} - Official Exam Routine</div>
                    <div style="font-size: 13px; color: #64748b; font-weight: 600;">Academic Session: ${exam.academicYearName}</div>
                </div>
        `;

        targetClasses.forEach((cls) => {
            const routine = exam.classRoutines?.find(r => r.classId === cls.id)?.routine ||
                (exam.subjects?.length > 0 ? exam.subjects : []);

            if (routine.length === 0) return;

            html += `
                <div class="routine-card">
                    <div class="class-header">
                        <span>Class: ${cls.name}</span>
                        <span style="font-size: 12px; color: #64748b; font-weight: 400;">Total Subjects: ${routine.length}</span>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 25%;">Day & Date</th>
                                <th style="width: 15%;">Time</th>
                                <th style="width: 35%;">Subject</th>
                                <th style="width: 15%;">Duration</th>
                                ${currentSchool?.showExamVenue !== false ? '<th style="width: 10%;">Venue</th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
            `;

            const sortedRoutine = [...routine].sort((a, b) => (a.examDate || '').localeCompare(b.examDate || ''));

            sortedRoutine.forEach(item => {
                html += `
                    <tr>
                        <td>${item.examDate ? new Date(item.examDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</td>
                        <td style="font-weight: 600;">${item.examTime || (currentSchool?.examTimeMode === 'GLOBAL' ? currentSchool.globalExamTime : 'N/A')}</td>
                        <td>
                            <div class="subject-name">${item.subjectName}</div>
                            ${(item.combinedSubjects?.length || 0) > 0 ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">Incl: ${item.combinedSubjects?.map((sid: string) => schoolSubjects.find((s: any) => s.id === sid)?.name || sid).join(', ')}</div>` : ''}
                        </td>
                        <td>${item.duration}m</td>
                        ${currentSchool?.showExamVenue !== false ? `<td>${item.roomNumber || item.venue || '-'}</td>` : ''}
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;
        });

        html += `
                <div class="footer">
                    Printed on ${new Date().toLocaleString('en-IN')} | System Generated by AI School 360
                </div>
                <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); }</script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    // ─── TEACHER VIEW ─────────────────────────────────────────────
    if (isTeacher) {
        const selectedExam = schoolExams.find(e => e.id === teacherSelectedExamId);
        const teacherTargetClasses = selectedExam ? sortClasses(
            schoolClasses.filter(c => selectedExam.targetClasses.includes(c.id))
        ) : [];

        // Filter classes to only those assigned to this teacher (by matching class name to class ID)
        const teacherScopedClasses = teacherAssignedClasses.length > 0
            ? schoolClasses.filter(c => teacherAssignedClasses.includes(c.name))
            : schoolClasses;

        // When exam changes, load its classRoutines into newExam state
        const handleExamChange = (examId: string) => {
            setTeacherSelectedExamId(examId);
            setTeacherSelectedClassId('');
            const exam = schoolExams.find(e => e.id === examId);
            if (exam) {
                setNewExam({
                    ...exam,
                    classRoutines: exam.classRoutines || []
                });
                setActiveRoutineClassId('');
            } else {
                resetForm();
            }
        };

        const handleClassChange = (classId: string) => {
            setTeacherSelectedClassId(classId);
            setActiveRoutineClassId(classId);
        };

        return (
            <div className="page-container">
                {/* Mobile-responsive styles for teacher view */}
                <style>{`
                    .teacher-exam-header { padding: 2rem; }
                    .teacher-exam-header-icon { width: 56px; height: 56px; border-radius: 16px; }
                    .teacher-exam-header-icon svg { width: 28px; height: 28px; }
                    .teacher-exam-title { font-size: 1.875rem; }
                    .teacher-exam-subtitle { font-size: 1rem; }
                    .teacher-select-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
                    .teacher-card-padding { padding: 1.75rem; overflow: visible !important; }
                    .teacher-marks-row { display: flex; gap: 1rem; flex: 1; flex-wrap: wrap; }
                    .teacher-marks-row > div { flex: 1; min-width: 0; }
                    .teacher-marks-row > div:first-child { flex: 1.5; }
                    .teacher-schedule-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 1rem; }
                    .teacher-entry-header { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
                    .teacher-program-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
                    .teacher-exam-info { display: flex; gap: 1.5rem; flex-wrap: wrap; }
                    .teacher-save-btn { padding: 0.875rem 2.5rem; font-size: 0.9375rem; width: auto; }
                    .teacher-entry-card { padding: 1.5rem; overflow: visible !important; }
                    .teacher-empty-state { padding: 5rem 2rem; }
                    .teacher-empty-icon { width: 80px; height: 80px; }

                    /* Ensure select dropdowns are not clipped by any parent */
                    .content-root, .content-root > .animate-fade-in,
                    .animate-slide-up,
                    .page-container, .page-container .glass-card,
                    .page-container .teacher-entry-card,
                    .page-container .teacher-marks-row,
                    .page-container .form-group {
                        overflow: visible !important;
                    }
                    /* Make native select dropdown work on mobile */
                    .teacher-entry-card select.input-field {
                        position: relative;
                        z-index: 10;
                    }

                    @media (max-width: 768px) {
                        .teacher-exam-header { padding: 1rem 1.125rem; }
                        .teacher-exam-header-icon { width: 36px; height: 36px; border-radius: 10px; min-width: 36px; }
                        .teacher-exam-header-icon svg { width: 18px; height: 18px; }
                        .teacher-exam-title { font-size: 1.125rem; }
                        .teacher-exam-subtitle { font-size: 0.75rem; }
                        .teacher-select-grid { grid-template-columns: 1fr; gap: 0.75rem; }
                        .teacher-card-padding { padding: 0.875rem; }

                        /* Marks row: Subject full-width, then 3 fields in one compact row */
                        .teacher-marks-row {
                            display: grid !important;
                            grid-template-columns: 1fr 1fr 1fr !important;
                            gap: 0.5rem !important;
                        }
                        .teacher-marks-row > div {
                            width: 100% !important;
                            flex: unset !important;
                            min-width: 0 !important;
                        }
                        .teacher-marks-row > div:first-child {
                            grid-column: 1 / -1 !important;
                        }
                        .teacher-marks-row .form-group label {
                            font-size: 0.625rem !important;
                            margin-bottom: 0.25rem !important;
                            letter-spacing: 0.06em !important;
                        }
                        .teacher-marks-row .input-field,
                        .teacher-marks-row select.input-field {
                            padding: 0.5rem 0.625rem !important;
                            font-size: 0.8125rem !important;
                            border-radius: 0.5rem !important;
                        }

                        /* Schedule grid: all fields in one row */
                        .teacher-schedule-grid {
                            grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)) !important;
                            gap: 0.5rem !important;
                            padding: 0.625rem !important;
                            border-radius: 0.625rem !important;
                        }
                        .teacher-schedule-grid .form-group label {
                            font-size: 0.625rem !important;
                            margin-bottom: 0.25rem !important;
                        }
                        .teacher-schedule-grid .input-field {
                            padding: 0.5rem 0.5rem !important;
                            font-size: 0.8125rem !important;
                            border-radius: 0.5rem !important;
                        }

                        .teacher-entry-header {
                            gap: 0.375rem;
                            margin-bottom: 0.75rem !important;
                            padding-bottom: 0.625rem !important;
                            border-bottom: 1.5px solid #e2e8f0 !important;
                        }
                        .teacher-program-header { flex-direction: column; align-items: stretch; gap: 0.625rem; }
                        .teacher-exam-info { gap: 0.5rem; font-size: 0.75rem; padding: 0.625rem 0.75rem !important; }
                        .teacher-save-btn { width: 100%; justify-content: center; padding: 0.75rem 1.25rem; font-size: 0.8125rem; }
                        .teacher-entry-card {
                            padding: 0.875rem !important;
                            border-radius: 0.875rem !important;
                            margin-bottom: 0.625rem !important;
                            border-left-width: 4px !important;
                        }
                        .teacher-empty-state { padding: 2.5rem 1.25rem; }
                        .teacher-empty-icon { width: 56px; height: 56px; }

                        .teacher-entry-header button { padding: 0.375rem !important; border-radius: 0.375rem !important; }
                        .teacher-entry-header button svg { width: 14px; height: 14px; }

                        /* Prevent iOS zoom on focus */
                        .teacher-entry-card select.input-field,
                        .teacher-entry-card input.input-field {
                            font-size: 16px;
                        }
                    }

                    @media (max-width: 480px) {
                        .teacher-exam-title { font-size: 1rem; }
                        .teacher-exam-subtitle { font-size: 0.6875rem; }
                        .teacher-card-padding { padding: 0.75rem; }
                        .teacher-entry-card { padding: 0.75rem !important; border-radius: 0.75rem !important; }
                        .teacher-empty-state { padding: 2rem 1rem; }
                        .teacher-marks-row { gap: 0.375rem !important; }
                        .teacher-schedule-grid { gap: 0.375rem !important; padding: 0.5rem !important; }
                    }
                `}</style>
                {/* Header */}
                <div className="page-header teacher-exam-header" style={{
                    background: 'white',
                    borderRadius: '1.25rem',
                    marginBottom: '1.5rem',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className="teacher-exam-header-icon" style={{
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.4)',
                            flexShrink: 0
                        }}>
                            <Calendar size={28} />
                        </div>
                        <div>
                            <h1 className="teacher-exam-title" style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>Exam Schedule</h1>
                            <p className="teacher-exam-subtitle" style={{ color: 'var(--text-muted)' }}>Enter schedule or view class-wise exam routine</p>
                        </div>
                    </div>
                </div>

                {/* Teacher View Tabs */}
                <div style={{
                    display: 'flex',
                    background: 'white',
                    padding: '0.4rem',
                    borderRadius: '1rem',
                    marginBottom: '1.5rem',
                    border: '1px solid var(--border)',
                    width: 'fit-content',
                    gap: '0.4rem'
                }}>
                    <button
                        onClick={() => setTeacherActiveView('ENTRY')}
                        style={{
                            padding: '0.625rem 1.25rem',
                            borderRadius: '0.75rem',
                            border: 'none',
                            background: teacherActiveView === 'ENTRY' ? '#6366f1' : 'transparent',
                            color: teacherActiveView === 'ENTRY' ? 'white' : 'var(--text-muted)',
                            fontWeight: 700,
                            fontSize: '0.8125rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <Calendar size={16} />
                        Schedule Entry
                    </button>
                    <button
                        onClick={() => setTeacherActiveView('ROUTINE')}
                        style={{
                            padding: '0.625rem 1.25rem',
                            borderRadius: '0.75rem',
                            border: 'none',
                            background: teacherActiveView === 'ROUTINE' ? '#6366f1' : 'transparent',
                            color: teacherActiveView === 'ROUTINE' ? 'white' : 'var(--text-muted)',
                            fontWeight: 700,
                            fontSize: '0.8125rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <BookOpen size={16} />
                        Exam Routine
                    </button>
                </div>

                {teacherActiveView === 'ENTRY' ? (
                    <>
                        {/* Step 1 & 2: Select Exam & Class */}
                        <div className="glass-card teacher-card-padding" style={{
                            marginBottom: '1.5rem',
                            border: '1px solid var(--border)',
                            background: 'rgba(255, 255, 255, 0.7)',
                            backdropFilter: 'blur(10px)'
                        }}>
                            <div className="teacher-select-grid">
                                <div>
                                    <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem', display: 'block' }}>
                                        Select Exam *
                                    </label>
                                    <select
                                        className="input-field"
                                        value={teacherSelectedExamId}
                                        onChange={(e) => handleExamChange(e.target.value)}
                                        style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem', background: 'white', border: '1px solid var(--border)' }}
                                    >
                                        <option value="">-- Choose Exam --</option>
                                        {schoolExams
                                            .filter(e => e.status !== 'CANCELLED')
                                            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                                            .map(exam => (
                                                <option key={exam.id} value={exam.id}>
                                                    {exam.name} ({exam.assessmentTypeName}) - {new Date(exam.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem', display: 'block' }}>
                                        Select Class *
                                    </label>
                                    <select
                                        className="input-field"
                                        value={teacherSelectedClassId}
                                        onChange={(e) => handleClassChange(e.target.value)}
                                        disabled={!teacherSelectedExamId}
                                        style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem', background: 'white', border: '1px solid var(--border)' }}
                                    >
                                        <option value="">-- Choose Class --</option>
                                        {teacherTargetClasses.map(cls => (
                                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                    {teacherSelectedExamId && (
                                        <button
                                            onClick={() => handlePrintProgram(teacherSelectedExamId)}
                                            className="btn"
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.625rem',
                                                padding: '0.875rem 1.5rem',
                                                borderRadius: '0.75rem',
                                                border: '1px solid #10b981',
                                                color: '#10b981',
                                                background: 'transparent',
                                                fontWeight: 700,
                                                fontSize: '0.875rem',
                                                height: '50px'
                                            }}
                                        >
                                            <Printer size={18} />
                                            Print Official Program
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Show selected exam info */}
                            {selectedExam && (
                                <div className="teacher-exam-info" style={{
                                    marginTop: '1.25rem',
                                    padding: '0.875rem 1rem',
                                    background: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '0.75rem',
                                    fontSize: '0.875rem'
                                }}>
                                    <span style={{ fontWeight: 700, color: '#15803d' }}>{selectedExam.name}</span>
                                    <span style={{ color: '#6b7280' }}>📅 {new Date(selectedExam.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    <span style={{ color: '#6b7280' }}>📝 {selectedExam.assessmentTypeName}</span>
                                    <span style={{ color: '#6b7280' }}>🏫 {selectedExam.targetClasses.length} Classes</span>
                                    <span style={{
                                        background: STATUS_COLORS[selectedExam.status] + '15',
                                        color: STATUS_COLORS[selectedExam.status],
                                        padding: '0.125rem 0.625rem',
                                        borderRadius: '6px',
                                        fontWeight: 700,
                                        fontSize: '0.75rem'
                                    }}>{selectedExam.status}</span>
                                </div>
                            )}
                        </div>

                        {/* Step 3: Routine Entry Form */}
                        {
                            teacherSelectedExamId && teacherSelectedClassId && activeRoutineClassId ? (
                                <div className="glass-card teacher-card-padding" style={{ border: '1px solid var(--border)' }}>
                                    <div className="teacher-program-header" style={{ marginBottom: '1.5rem' }}>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                                Program for {schoolClasses.find(c => c.id === activeRoutineClassId)?.name || activeRoutineClassId}
                                            </h4>
                                            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                Add subjects, date, time and other details for this class.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleAddRoutineEntry(activeRoutineClassId)}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                background: '#6366f1',
                                                color: 'white',
                                                border: 'none',
                                                padding: '0.625rem 1.25rem',
                                                borderRadius: '0.75rem',
                                                fontWeight: 700,
                                                fontSize: '0.875rem',
                                                cursor: 'pointer',
                                                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.2)',
                                                whiteSpace: 'nowrap',
                                                flexShrink: 0
                                            }}
                                        >
                                            <Plus size={18} />
                                            Add Subject
                                        </button>
                                    </div>

                                    {getClassRoutine(activeRoutineClassId).routine.length > 0 ? (
                                        <div style={{ display: 'grid', gap: '1rem' }}>
                                            {getClassRoutine(activeRoutineClassId).routine.map((entry, idx) => (
                                                <div key={idx} className="teacher-entry-card" style={{
                                                    border: '1px solid #e2e8f0',
                                                    borderLeft: '5px solid #6366f1',
                                                    borderRadius: '1rem',
                                                    background: '#f8fafc',
                                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                                                    marginBottom: '1rem',
                                                    padding: '1rem',
                                                    transition: 'all 0.2s ease'
                                                }}>
                                                    <div className="teacher-entry-header" style={{ marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px dashed #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{
                                                            width: '22px',
                                                            height: '22px',
                                                            borderRadius: '6px',
                                                            background: '#6366f1',
                                                            color: 'white',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 800,
                                                            boxShadow: '0 2px 4px rgba(99, 102, 241, 0.3)'
                                                        }}>
                                                            {idx + 1}
                                                        </div>
                                                        <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.8125rem', letterSpacing: '0.01em' }}>Subject Entry #{idx + 1}</span>
                                                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.375rem' }}>
                                                            <button
                                                                onClick={() => handleDuplicateRoutineEntry(activeRoutineClassId, idx)}
                                                                style={{
                                                                    background: '#6366f110',
                                                                    color: '#6366f1',
                                                                    border: 'none',
                                                                    padding: '0.375rem',
                                                                    borderRadius: '0.375rem',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                title="Duplicate"
                                                            >
                                                                <Copy size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleRemoveRoutineEntry(activeRoutineClassId, idx)}
                                                                style={{
                                                                    background: '#ef444410',
                                                                    color: '#ef4444',
                                                                    border: 'none',
                                                                    padding: '0.375rem',
                                                                    borderRadius: '0.375rem',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                title="Remove"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div style={{ marginBottom: '0.5rem' }}>
                                                        <div className="teacher-marks-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                                                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                                                <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block', letterSpacing: '0.04em' }}>Subject</label>
                                                                <select
                                                                    className="input-field"
                                                                    value={entry.subjectId}
                                                                    onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'subjectId', e.target.value)}
                                                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                                                                >
                                                                    <option value="">Select Subject</option>
                                                                    {schoolSubjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                                </select>
                                                            </div>
                                                            <div className="form-group">
                                                                <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block', letterSpacing: '0.04em' }}>Type</label>
                                                                <select
                                                                    className="input-field"
                                                                    value={entry.assessmentType || 'MARKS'}
                                                                    onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'assessmentType', e.target.value)}
                                                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                                                                >
                                                                    <option value="MARKS">Marks</option>
                                                                    <option value="GRADE">Grade</option>
                                                                </select>
                                                            </div>
                                                            {entry.assessmentType === 'GRADE' ? (
                                                                <div className="form-group">
                                                                    <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block', letterSpacing: '0.04em' }}>Grade</label>
                                                                    <div style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b', minHeight: '38px', display: 'flex', alignItems: 'center' }}>
                                                                        Configured
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="form-group">
                                                                        <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block', letterSpacing: '0.04em' }}>Max</label>
                                                                        <input
                                                                            type="number"
                                                                            className="input-field"
                                                                            value={entry.maxMarks}
                                                                            onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'maxMarks', e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
                                                                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                                                                        />
                                                                    </div>
                                                                    <div className="form-group">
                                                                        <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block', letterSpacing: '0.04em' }}>Pass %</label>
                                                                        <input
                                                                            type="number"
                                                                            className="input-field"
                                                                            value={entry.passingMarks}
                                                                            onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'passingMarks', e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
                                                                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                                                                        />
                                                                    </div>
                                                                    <div className="form-group">
                                                                        <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block', letterSpacing: '0.04em' }}>Pass Marks</label>
                                                                        <input
                                                                            type="number"
                                                                            className="input-field"
                                                                            value={Math.round((entry.passingMarks * entry.maxMarks) / 100)}
                                                                            onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'passMarksNumber', e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
                                                                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                                                                        />
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Marks Breakdown Section */}
                                                    {entry.assessmentType !== 'GRADE' && (
                                                        <div style={{
                                                            marginBottom: '0.75rem',
                                                            padding: '0.5rem 0.75rem',
                                                            background: '#fefce8',
                                                            borderRadius: '0.5rem',
                                                            border: '1px solid #e0e7ff'
                                                        }}>
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!(entry.theoryMarks !== undefined || entry.practicalMarks !== undefined)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) {
                                                                            handleRoutineEntryChange(activeRoutineClassId, idx, 'theoryMarks', 0);
                                                                            handleRoutineEntryChange(activeRoutineClassId, idx, 'practicalMarks', 0);
                                                                        } else {
                                                                            handleRoutineEntryChange(activeRoutineClassId, idx, 'theoryMarks', undefined);
                                                                            handleRoutineEntryChange(activeRoutineClassId, idx, 'practicalMarks', undefined);
                                                                        }
                                                                    }}
                                                                    style={{ accentColor: '#eab308', width: '14px', height: '14px' }}
                                                                />
                                                                <span>Enable Marks Breakdown <small style={{ fontWeight: 400, color: '#ca8a04' }}>(Theory/Practical)</small></span>
                                                            </label>
                                                            {(entry.theoryMarks !== undefined || entry.practicalMarks !== undefined) && (
                                                                <div style={{ marginTop: '0.5rem' }}>
                                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                                        <div className="form-group">
                                                                            <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block', letterSpacing: '0.04em' }}>Theory</label>
                                                                            <input
                                                                                type="number"
                                                                                className="input-field"
                                                                                placeholder="80"
                                                                                value={entry.theoryMarks || ''}
                                                                                onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'theoryMarks', e.target.value === '' ? 0 : parseInt(e.target.value))}
                                                                                style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                                                                            />
                                                                        </div>
                                                                        <div className="form-group">
                                                                            <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block', letterSpacing: '0.04em' }}>Practical</label>
                                                                            <input
                                                                                type="number"
                                                                                className="input-field"
                                                                                placeholder="20"
                                                                                value={entry.practicalMarks || ''}
                                                                                onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'practicalMarks', e.target.value === '' ? 0 : parseInt(e.target.value))}
                                                                                style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div style={{
                                                                        padding: '0.375rem 0.625rem',
                                                                        borderRadius: '0.375rem',
                                                                        background: ((entry.theoryMarks || 0) + (entry.practicalMarks || 0)) === entry.maxMarks ? '#10b98115' : '#ef444415',
                                                                        border: `1px solid ${((entry.theoryMarks || 0) + (entry.practicalMarks || 0)) === entry.maxMarks ? '#10b981' : '#ef4444'}`,
                                                                        fontSize: '0.7rem',
                                                                        fontWeight: 700,
                                                                        color: ((entry.theoryMarks || 0) + (entry.practicalMarks || 0)) === entry.maxMarks ? '#10b981' : '#ef4444'
                                                                    }}>
                                                                        Total: {(entry.theoryMarks || 0) + (entry.practicalMarks || 0)} / {entry.maxMarks}
                                                                        {((entry.theoryMarks || 0) + (entry.practicalMarks || 0)) === entry.maxMarks ? ' ✓' : ' ⚠ Must equal Max Marks'}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Combine Subjects Option */}
                                                    <div style={{
                                                        marginBottom: '0.75rem',
                                                        padding: '0.5rem 0.75rem',
                                                        background: '#f8fafc',
                                                        borderRadius: '0.5rem',
                                                        border: '1px solid #e2e8f0'
                                                    }}>
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={!!entry.combinedSubjects}
                                                                onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'combinedSubjects', e.target.checked ? [] : undefined)}
                                                                style={{ accentColor: '#6366f1', width: '14px', height: '14px' }}
                                                            />
                                                            <span>Combine Additional <small style={{ fontWeight: 400, color: '#6366f1' }}>(e.g. Phy+Che)</small></span>
                                                        </label>
                                                        {entry.combinedSubjects && (
                                                            <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem', maxHeight: '80px', overflowY: 'auto', padding: '0.125rem' }}>
                                                                {schoolSubjects.filter((s: any) => s.id !== entry.subjectId).map((s: any) => (
                                                                    <label key={s.id} style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.3rem',
                                                                        padding: '0.2rem 0.5rem',
                                                                        background: entry.combinedSubjects?.includes(s.id) ? '#6366f115' : 'white',
                                                                        border: `1px solid ${entry.combinedSubjects?.includes(s.id) ? '#6366f150' : '#e2e8f0'}`,
                                                                        borderRadius: '2rem',
                                                                        cursor: 'pointer',
                                                                        fontSize: '0.75rem'
                                                                    }}>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={entry.combinedSubjects?.includes(s.id) || false}
                                                                            onChange={(e) => {
                                                                                const updated = e.target.checked
                                                                                    ? [...(entry.combinedSubjects || []), s.id]
                                                                                    : (entry.combinedSubjects || []).filter(id => id !== s.id);
                                                                                handleRoutineEntryChange(activeRoutineClassId, idx, 'combinedSubjects', updated);
                                                                            }}
                                                                            style={{ display: 'none' }}
                                                                        />
                                                                        <span style={{ color: entry.combinedSubjects?.includes(s.id) ? '#6366f1' : 'var(--text-muted)' }}>{s.name}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="teacher-schedule-grid" style={{
                                                        background: 'white',
                                                        padding: '0.625rem',
                                                        borderRadius: '0.5rem',
                                                        border: '1px solid #e2e8f0',
                                                        display: 'grid',
                                                        gap: '0.625rem',
                                                        gridTemplateColumns: 'repeat(2, 1fr)'
                                                    }}>
                                                        <div className="form-group">
                                                            <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block', letterSpacing: '0.04em' }}>Date</label>
                                                            <input type="date" className="input-field" value={entry.examDate} onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'examDate', e.target.value)} style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }} />
                                                        </div>
                                                        {currentSchool?.examTimeMode !== 'GLOBAL' && (
                                                            <div className="form-group">
                                                                <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block', letterSpacing: '0.04em' }}>Time</label>
                                                                <input type="time" className="input-field" value={entry.examTime} onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'examTime', e.target.value)} style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }} />
                                                            </div>
                                                        )}
                                                        <div className="form-group">
                                                            <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block', letterSpacing: '0.04em' }}>Mins</label>
                                                            <input type="number" className="input-field" value={entry.duration} onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'duration', e.target.value === '' ? '' : (parseInt(e.target.value) || 0))} style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }} />
                                                        </div>
                                                        {currentSchool?.showExamVenue !== false && (
                                                            <div className="form-group">
                                                                <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block', letterSpacing: '0.04em' }}>Venue</label>
                                                                <input type="text" className="input-field" placeholder="Room" value={entry.venue} onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'venue', e.target.value)} style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="teacher-empty-state" style={{ textAlign: 'center', background: 'white', borderRadius: '1rem', border: '2px dashed var(--border)' }}>
                                            <BookOpen size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                                            <h5 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>No Program Defined</h5>
                                            <p style={{ margin: '0.5rem 0 1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Click "Add Subject" to start entering the exam schedule for this class.</p>
                                            <button onClick={() => handleAddRoutineEntry(activeRoutineClassId)} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem' }}>
                                                <Plus size={18} /> Add First Subject
                                            </button>
                                        </div>
                                    )}

                                    {/* Save Button */}
                                    {getClassRoutine(activeRoutineClassId).routine.length > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                                            <button
                                                onClick={handleTeacherSaveRoutine}
                                                disabled={teacherSaving}
                                                style={{
                                                    borderRadius: '0.75rem',
                                                    border: 'none',
                                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                                    color: 'white',
                                                    fontWeight: 700,
                                                    cursor: teacherSaving ? 'not-allowed' : 'pointer',
                                                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                                    opacity: teacherSaving ? 0.7 : 1,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem'
                                                }}
                                                className="teacher-save-btn"
                                            >
                                                {teacherSaving ? 'Saving...' : '💾 Save Schedule'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                !teacherSelectedExamId ? (
                                    <div className="teacher-empty-state" style={{
                                        textAlign: 'center',
                                        background: 'white',
                                        borderRadius: '2rem',
                                        border: '1px solid var(--border)'
                                    }}>
                                        <div className="teacher-empty-icon" style={{
                                            borderRadius: '24px',
                                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                            color: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 1.5rem',
                                            boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)'
                                        }}>
                                            <Calendar size={40} />
                                        </div>
                                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.75rem' }}>Select an Exam to Begin</h3>
                                        <p style={{ color: 'var(--text-muted)', maxWidth: '450px', margin: '0 auto', fontSize: '1rem', lineHeight: 1.6 }}>
                                            Choose an exam from the dropdown above, then select a class to enter the exam schedule.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="teacher-empty-state" style={{
                                        textAlign: 'center',
                                        background: 'white',
                                        borderRadius: '2rem',
                                        border: '1px solid var(--border)'
                                    }}>
                                        <div className="teacher-empty-icon" style={{
                                            borderRadius: '24px',
                                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                            color: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 1.5rem',
                                            boxShadow: '0 8px 16px rgba(16, 185, 129, 0.2)'
                                        }}>
                                            <Users size={40} />
                                        </div>
                                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.75rem' }}>Now Select a Class</h3>
                                        <p style={{ color: 'var(--text-muted)', maxWidth: '450px', margin: '0 auto', fontSize: '1rem', lineHeight: 1.6 }}>
                                            Choose a class from the dropdown above to enter its exam schedule.
                                        </p>
                                    </div>
                                )
                            )
                        }
                    </>
                ) : (
                    /* ─── TEACHER ROUTINE VIEW (read-only, scoped to assigned classes) ─── */
                    <div className="animate-fade-in">
                        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid var(--border)', background: 'white' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1.5rem', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '250px' }}>
                                    <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem', display: 'block' }}>
                                        Select Exam *
                                    </label>
                                    <select
                                        className="input-field"
                                        value={selectedProgramExamId}
                                        onChange={(e) => setSelectedProgramExamId(e.target.value)}
                                        style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem', background: '#f8fafc', border: '1px solid var(--border)' }}
                                    >
                                        <option value="">-- Choose Exam --</option>
                                        {schoolExams
                                            .filter(e => e.status !== 'CANCELLED')
                                            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                                            .map(exam => (
                                                <option key={exam.id} value={exam.id}>
                                                    {exam.name} ({exam.assessmentTypeName})
                                                </option>
                                            ))}
                                    </select>
                                </div>
                                {selectedProgramExamId && (
                                    <button
                                        onClick={() => handlePrintProgram(selectedProgramExamId)}
                                        className="btn"
                                        style={{
                                            padding: '0.875rem 1.5rem',
                                            borderRadius: '0.75rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.625rem',
                                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                            border: 'none',
                                            color: 'white',
                                            fontWeight: 700,
                                            fontSize: '0.875rem',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                                        }}
                                    >
                                        <Printer size={18} />
                                        Print Routine
                                    </button>
                                )}
                            </div>
                        </div>

                        {selectedProgramExamId ? (
                            <div style={{ display: 'grid', gap: '1.5rem' }}>
                                {(() => {
                                    const exam = schoolExams.find(e => e.id === selectedProgramExamId);
                                    if (!exam) return null;

                                    // Filter target classes to teacher's assigned classes only
                                    const allTargetClasses = sortClasses(schoolClasses.filter(c => exam.targetClasses.includes(c.id)));
                                    const scopedClasses = teacherAssignedClasses.length > 0
                                        ? allTargetClasses.filter(c => teacherAssignedClasses.includes(c.name))
                                        : allTargetClasses;

                                    if (scopedClasses.length === 0) return (
                                        <div style={{
                                            padding: '4rem 2rem',
                                            textAlign: 'center',
                                            background: 'white',
                                            borderRadius: '1.5rem',
                                            border: '1px solid var(--border)'
                                        }}>
                                            <AlertCircle size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>No Classes Found</h3>
                                            <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto', lineHeight: 1.6 }}>
                                                This exam doesn't cover any of your assigned classes, or class assignments haven't been set up yet.
                                            </p>
                                        </div>
                                    );

                                    return scopedClasses.map(cls => {
                                        const routine = exam.classRoutines?.find(r => r.classId === cls.id)?.routine ||
                                            (exam.subjects?.length > 0 ? exam.subjects : []);

                                        if (routine.length === 0) return (
                                            <div key={cls.id} className="glass-card" style={{ padding: '1.25rem', border: '1px solid var(--border)', background: 'white', opacity: 0.7 }}>
                                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)' }}>Class: {cls.name} (No Schedule Found)</h3>
                                            </div>
                                        );

                                        return (
                                            <div key={cls.id} className="glass-card" style={{ padding: '1.5rem', border: '1px solid var(--border)', background: 'white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    marginBottom: '1.25rem',
                                                    paddingBottom: '0.875rem',
                                                    borderBottom: '2px solid #f1f5f9'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{ padding: '0.5rem', background: '#6366f110', color: '#6366f1', borderRadius: '0.625rem' }}>
                                                            <Users size={18} />
                                                        </div>
                                                        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-main)' }}>Class: {cls.name}</h3>
                                                    </div>
                                                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', background: '#f8fafc', padding: '0.25rem 0.75rem', borderRadius: '2rem' }}>
                                                        {routine.length} Subjects
                                                    </div>
                                                </div>

                                                <div style={{ overflowX: 'auto', borderRadius: '0.625rem', border: '1px solid #e2e8f0' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                        <thead>
                                                            <tr style={{ background: '#f8fafc' }}>
                                                                <th style={{ padding: '0.875rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date & Day</th>
                                                                <th style={{ padding: '0.875rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time</th>
                                                                <th style={{ padding: '0.875rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject</th>
                                                                <th style={{ padding: '0.875rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</th>
                                                                {currentSchool?.showExamVenue !== false && (
                                                                    <th style={{ padding: '0.875rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Venue</th>
                                                                )}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {[...routine]
                                                                .sort((a, b) => (a.examDate || '').localeCompare(b.examDate || ''))
                                                                .map((item, idx) => (
                                                                    <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                                                                        <td style={{ padding: '0.875rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                                                            {item.examDate ? new Date(item.examDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' }) : 'N/A'}
                                                                        </td>
                                                                        <td style={{ padding: '0.875rem', fontSize: '0.875rem', fontWeight: 500, color: '#4f46e5' }}>
                                                                            {item.examTime || (currentSchool?.examTimeMode === 'GLOBAL' ? currentSchool.globalExamTime : 'N/A')}
                                                                        </td>
                                                                        <td style={{ padding: '0.875rem' }}>
                                                                            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-main)' }}>{item.subjectName}</div>
                                                                            {(item.combinedSubjects?.length || 0) > 0 && (
                                                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                                                    Includes: {item.combinedSubjects?.map((sid: string) => schoolSubjects.find((s: any) => s.id === sid)?.name || sid).join(', ')}
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '0.875rem', fontSize: '0.875rem', color: 'var(--text-main)' }}>{item.duration} mins</td>
                                                                        {currentSchool?.showExamVenue !== false && (
                                                                            <td style={{ padding: '0.875rem', fontSize: '0.875rem', color: 'var(--text-main)' }}>{item.roomNumber || item.venue || '-'}</td>
                                                                        )}
                                                                    </tr>
                                                                ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        ) : (
                            <div style={{
                                padding: '5rem 2rem',
                                textAlign: 'center',
                                background: 'white',
                                borderRadius: '1.5rem',
                                border: '1px solid var(--border)',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                            }}>
                                <div style={{
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: '24px',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 1.5rem',
                                    boxShadow: '0 10px 20px -5px rgba(99, 102, 241, 0.4)'
                                }}>
                                    <Printer size={40} />
                                </div>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.75rem' }}>View Class-Wise Routine</h3>
                                <p style={{ color: 'var(--text-muted)', maxWidth: '450px', margin: '0 auto', fontSize: '1rem', lineHeight: 1.6 }}>
                                    Select an exam from the dropdown above to view the exam schedule for your assigned classes.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div >
        );
    }

    // ─── ADMIN VIEW (original) ────────────────────────────────────
    return (
        <div className="page-container">
            <div className="page-header" style={{
                background: 'white',
                padding: '2rem',
                borderRadius: '1.25rem',
                marginBottom: '2rem',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.4)'
                    }}>
                        <Calendar size={28} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>Exam Scheduling</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Create and manage exams with detailed subject configuration</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        setEditingExam(null);
                        resetForm();
                        setShowModal(true);
                    }}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.625rem',
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '0.875rem 1.75rem',
                        borderRadius: '0.875rem',
                        fontWeight: 700,
                        fontSize: '0.9375rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                        transition: 'all 0.2s ease-in-out'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                    }}
                >
                    <Plus size={20} />
                    Schedule New Exam
                </button>
            </div>

            {/* View Tabs */}
            <div style={{
                display: 'flex',
                background: 'white',
                padding: '0.5rem',
                borderRadius: '1rem',
                marginBottom: '2rem',
                border: '1px solid var(--border)',
                width: 'fit-content',
                gap: '0.5rem'
            }}>
                <button
                    onClick={() => setActiveView('LIST')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.75rem',
                        border: 'none',
                        background: activeView === 'LIST' ? '#6366f1' : 'transparent',
                        color: activeView === 'LIST' ? 'white' : 'var(--text-muted)',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Calendar size={18} />
                    Manage Exams
                </button>
                <button
                    onClick={() => setActiveView('PROGRAM')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.75rem',
                        border: 'none',
                        background: activeView === 'PROGRAM' ? '#6366f1' : 'transparent',
                        color: activeView === 'PROGRAM' ? 'white' : 'var(--text-muted)',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <BookOpen size={18} />
                    Exam Routine (Class-Wise)
                </button>
            </div>

            {activeView === 'LIST' ? (
                <>
                    {/* Filters */}
                    <div className="glass-card" style={{
                        padding: '1.5rem',
                        marginBottom: '2.5rem',
                        border: '1px solid var(--border)',
                        background: 'rgba(255, 255, 255, 0.7)',
                        backdropFilter: 'blur(10px)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: '1.25rem',
                        alignItems: 'end'
                    }}>
                        <div style={{ position: 'relative' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block', textTransform: 'uppercase' }}>Search Exams</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#6366f1' }} />
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Type exam name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ paddingLeft: '2.75rem', background: 'white', border: '1px solid var(--border)', borderRadius: '0.75rem' }}
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block', textTransform: 'uppercase' }}>Filter by Status</label>
                            <select
                                className="input-field"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '0.75rem' }}
                            >
                                <option value="ALL">All Status</option>
                                <option value="DRAFT">Draft</option>
                                <option value="SCHEDULED">Scheduled</option>
                                <option value="ONGOING">Ongoing</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="CANCELLED">Cancelled</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block', textTransform: 'uppercase' }}>Filter by Class</label>
                            <select
                                className="input-field"
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '0.75rem' }}
                            >
                                <option value="ALL">All Classes</option>
                                {schoolClasses.map(cls => (
                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Exams List */}
                    {filteredExams.length === 0 ? (
                        <div style={{
                            padding: '5rem 2rem',
                            textAlign: 'center',
                            background: 'white',
                            borderRadius: '2rem',
                            border: '1px solid var(--border)',
                            marginTop: '2rem'
                        }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '24px',
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1.5rem',
                                boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)'
                            }}>
                                <Calendar size={40} />
                            </div>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                                {searchQuery || statusFilter !== 'ALL' || selectedClass !== 'ALL' ? 'No Exams Found' : 'Ready to Schedule Exams?'}
                            </h3>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem', maxWidth: '450px', margin: '0 auto 2.5rem', fontSize: '1rem', lineHeight: 1.6 }}>
                                {searchQuery || statusFilter !== 'ALL' || selectedClass !== 'ALL'
                                    ? 'Try adjusting your filters to find the exam you are looking for.'
                                    : 'Create comprehensive exam schedules with detailed subjects, class mappings, and status tracking in just a few clicks.'}
                            </p>
                            {!searchQuery && statusFilter === 'ALL' && selectedClass === 'ALL' && (
                                <button
                                    onClick={() => {
                                        setEditingExam(null);
                                        setNewExam({
                                            name: '',
                                            academicYearId: activeYear?.id || '',
                                            academicYearName: activeYear?.name || '',
                                            targetClasses: [],
                                            startDate: '',
                                            endDate: '',
                                            subjects: [],
                                            status: 'DRAFT'
                                        });
                                        setShowModal(true);
                                    }}
                                    className="btn btn-primary"
                                    style={{
                                        padding: '1.25rem 3rem',
                                        borderRadius: '1.25rem',
                                        fontWeight: 800,
                                        fontSize: '1.125rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        boxShadow: '0 10px 20px rgba(99, 102, 241, 0.3)',
                                        transform: 'translateY(0)',
                                        transition: 'all 0.3s'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.boxShadow = '0 15px 30px rgba(99, 102, 241, 0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 10px 20px rgba(99, 102, 241, 0.3)';
                                    }}
                                >
                                    <Plus size={24} />
                                    <span>Schedule New Exam</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '1.5rem' }}>
                            {filteredExams.map(exam => (
                                <div key={exam.id} className="glass-card hover-lift" style={{
                                    padding: '1.75rem',
                                    border: '1px solid var(--border)',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}>
                                    {/* Accent line based on status */}
                                    <div style={{
                                        position: 'absolute',
                                        left: 0,
                                        top: 0,
                                        bottom: 0,
                                        width: '4px',
                                        background: STATUS_COLORS[exam.status]
                                    }} />

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1.5rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                                                <h3 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                                                    {exam.name}
                                                    {exam.displayName && exam.displayName !== exam.name && (
                                                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '0.75rem' }}>
                                                            (Print: {exam.displayName})
                                                        </span>
                                                    )}
                                                </h3>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <span style={{
                                                        background: STATUS_COLORS[exam.status] + '15',
                                                        color: STATUS_COLORS[exam.status],
                                                        padding: '0.375rem 0.875rem',
                                                        borderRadius: '10px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 800,
                                                        letterSpacing: '0.025em',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.375rem'
                                                    }}>
                                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: STATUS_COLORS[exam.status] }} />
                                                        {exam.status}
                                                    </span>
                                                    {exam.isPublished && (
                                                        <span style={{
                                                            background: 'rgba(16, 185, 129, 0.1)',
                                                            color: '#10b981',
                                                            padding: '0.375rem 0.875rem',
                                                            borderRadius: '10px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 800,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.375rem'
                                                        }}>
                                                            <CheckCircle size={14} />
                                                            PUBLISHED
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '1.75rem', fontSize: '0.9375rem', color: 'var(--text-muted)', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                                    <div style={{ color: '#6366f1' }}><BookOpen size={18} /></div>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{exam.assessmentTypeName}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                                    <div style={{ color: '#f59e0b' }}><Calendar size={18} /></div>
                                                    <span>{new Date(exam.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                                    <div style={{ color: '#10b981' }}><Users size={18} /></div>
                                                    <span>{exam.targetClasses.length} Classes</span>
                                                </div>

                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
                                            <button
                                                onClick={() => handlePublishToggle(exam.id, exam.isPublished)}
                                                className="btn-icon"
                                                title={exam.isPublished ? 'Unpublish' : 'Publish'}
                                                style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '10px',
                                                    background: exam.isPublished ? '#10b98110' : '#f8fafc',
                                                    color: exam.isPublished ? '#10b981' : 'var(--text-muted)',
                                                    border: '1px solid var(--border)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {exam.isPublished ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                            <button
                                                onClick={() => handleDuplicateExam(exam)}
                                                className="btn-icon"
                                                title="Duplicate"
                                                style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '10px',
                                                    background: '#f8fafc',
                                                    color: 'var(--text-muted)',
                                                    border: '1px solid var(--border)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <Copy size={18} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditingExam(exam);
                                                    setNewExam(exam);
                                                    setShowModal(true);
                                                }}
                                                className="btn-icon"
                                                title="Edit"
                                                style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '10px',
                                                    background: '#6366f110',
                                                    color: '#6366f1',
                                                    border: '1px solid var(--border)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteExam(exam.id)}
                                                className="btn-icon"
                                                title="Delete"
                                                style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '10px',
                                                    background: '#ef444410',
                                                    color: '#ef4444',
                                                    border: '1px solid var(--border)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Quick Status Updates */}
                                    {exam.status !== 'COMPLETED' && exam.status !== 'CANCELLED' && (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '1rem',
                                            marginTop: '1.25rem',
                                            paddingTop: '1.25rem',
                                            borderTop: '1px dashed var(--border)'
                                        }}>
                                            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Step Up:
                                            </span>
                                            <div style={{ display: 'flex', gap: '0.625rem' }}>
                                                {exam.status === 'DRAFT' && (
                                                    <button
                                                        onClick={() => handleStatusChange(exam.id, 'SCHEDULED')}
                                                        style={{
                                                            fontSize: '0.75rem',
                                                            padding: '0.5rem 1rem',
                                                            borderRadius: '8px',
                                                            background: 'white',
                                                            border: '1px solid #6366f1',
                                                            color: '#6366f1',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = '#6366f1'; e.currentTarget.style.color = 'white'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#6366f1'; }}
                                                    >
                                                        Mark as Scheduled
                                                    </button>
                                                )}
                                                {exam.status === 'SCHEDULED' && (
                                                    <button
                                                        onClick={() => handleStatusChange(exam.id, 'ONGOING')}
                                                        style={{
                                                            fontSize: '0.75rem',
                                                            padding: '0.5rem 1rem',
                                                            borderRadius: '8px',
                                                            background: 'white',
                                                            border: '1px solid #f59e0b',
                                                            color: '#f59e0b',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f59e0b'; e.currentTarget.style.color = 'white'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#f59e0b'; }}
                                                    >
                                                        Start Exam
                                                    </button>
                                                )}
                                                {exam.status === 'ONGOING' && (
                                                    <button
                                                        onClick={() => handleStatusChange(exam.id, 'COMPLETED')}
                                                        style={{
                                                            fontSize: '0.75rem',
                                                            padding: '0.5rem 1rem',
                                                            borderRadius: '8px',
                                                            background: 'white',
                                                            border: '1px solid #10b981',
                                                            color: '#10b981',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = 'white'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#10b981'; }}
                                                    >
                                                        Complete Exam
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleStatusChange(exam.id, 'CANCELLED')}
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        padding: '0.5rem 1rem',
                                                        borderRadius: '8px',
                                                        background: 'white',
                                                        border: '1px solid #ef4444',
                                                        color: '#ef4444',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#ef4444'; }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <div className="animate-fade-in">
                    <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem', border: '1px solid var(--border)', background: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1.5rem', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '300px' }}>
                                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem', display: 'block' }}>
                                    Select Exam to View Schedule *
                                </label>
                                <select
                                    className="input-field"
                                    value={selectedProgramExamId}
                                    onChange={(e) => setSelectedProgramExamId(e.target.value)}
                                    style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem', background: '#f8fafc', border: '1px solid var(--border)' }}
                                >
                                    <option value="">-- Choose Exam --</option>
                                    {schoolExams
                                        .filter(e => e.status !== 'CANCELLED')
                                        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                                        .map(exam => (
                                            <option key={exam.id} value={exam.id}>
                                                {exam.name} ({exam.assessmentTypeName})
                                            </option>
                                        ))}
                                </select>
                            </div>
                            {selectedProgramExamId && (
                                <button
                                    onClick={() => handlePrintProgram(selectedProgramExamId)}
                                    className="btn btn-primary"
                                    style={{
                                        padding: '0.875rem 2rem',
                                        borderRadius: '0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.625rem',
                                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        border: 'none',
                                        color: 'white',
                                        fontWeight: 700
                                    }}
                                >
                                    <Printer size={18} />
                                    Print Official Routine
                                </button>
                            )}
                        </div>
                    </div>

                    {selectedProgramExamId ? (
                        <div style={{ display: 'grid', gap: '2rem' }}>
                            {(() => {
                                const exam = schoolExams.find(e => e.id === selectedProgramExamId);
                                if (!exam) return null;

                                const targetClasses = sortClasses(schoolClasses.filter(c => exam.targetClasses.includes(c.id)));

                                return targetClasses.map(cls => {
                                    const routine = exam.classRoutines?.find(r => r.classId === cls.id)?.routine ||
                                        (exam.subjects?.length > 0 ? exam.subjects : []);

                                    if (routine.length === 0) return (
                                        <div key={cls.id} className="glass-card" style={{ padding: '1.5rem', border: '1px solid var(--border)', background: 'white', opacity: 0.7 }}>
                                            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-muted)' }}>Class: {cls.name} (No Schedule Found)</h3>
                                        </div>
                                    );

                                    return (
                                        <div key={cls.id} className="glass-card" style={{ padding: '1.75rem', border: '1px solid var(--border)', background: 'white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                marginBottom: '1.5rem',
                                                paddingBottom: '1rem',
                                                borderBottom: '2px solid #f1f5f9'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div style={{ padding: '0.625rem', background: '#6366f110', color: '#6366f1', borderRadius: '0.75rem' }}>
                                                        <Users size={20} />
                                                    </div>
                                                    <h3 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-main)' }}>Class: {cls.name}</h3>
                                                </div>
                                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', background: '#f8fafc', padding: '0.375rem 0.875rem', borderRadius: '2rem' }}>
                                                    {routine.length} Subjects
                                                </div>
                                            </div>

                                            <div style={{ overflowX: 'auto', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr style={{ background: '#f8fafc' }}>
                                                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date & Day</th>
                                                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time</th>
                                                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject</th>
                                                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</th>
                                                            {currentSchool?.showExamVenue !== false && (
                                                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Venue</th>
                                                            )}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {[...routine]
                                                            .sort((a, b) => (a.examDate || '').localeCompare(b.examDate || ''))
                                                            .map((item, idx) => (
                                                                <tr key={idx} style={{ borderTop: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                                                                    <td style={{ padding: '1rem', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                                                        {item.examDate ? new Date(item.examDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' }) : 'N/A'}
                                                                    </td>
                                                                    <td style={{ padding: '1rem', fontSize: '0.9375rem', fontWeight: 500, color: '#4f46e5' }}>
                                                                        {item.examTime || (currentSchool?.examTimeMode === 'GLOBAL' ? currentSchool.globalExamTime : 'N/A')}
                                                                    </td>
                                                                    <td style={{ padding: '1rem' }}>
                                                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{item.subjectName}</div>
                                                                        {(item.combinedSubjects?.length || 0) > 0 && (
                                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                                                                Includes: {item.combinedSubjects?.map((sid: string) => schoolSubjects.find((s: any) => s.id === sid)?.name || sid).join(', ')}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td style={{ padding: '1rem', fontSize: '0.9375rem', color: 'var(--text-main)' }}>{item.duration} mins</td>
                                                                    {currentSchool?.showExamVenue !== false && (
                                                                        <td style={{ padding: '1rem', fontSize: '0.9375rem', color: 'var(--text-main)' }}>{item.roomNumber || item.venue || '-'}</td>
                                                                    )}
                                                                </tr>
                                                            ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    ) : (
                        <div style={{
                            padding: '6rem 2rem',
                            textAlign: 'center',
                            background: 'white',
                            borderRadius: '2rem',
                            border: '1px solid var(--border)',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                        }}>
                            <div style={{
                                width: '100px',
                                height: '100px',
                                borderRadius: '32px',
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 2rem',
                                boxShadow: '0 10px 20px -5px rgba(99, 102, 241, 0.4)'
                            }}>
                                <Printer size={48} />
                            </div>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>Print Official Routine</h3>
                            <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto', fontSize: '1.125rem', lineHeight: 1.6 }}>
                                Select an exam from the dropdown above to generate and print a professional class-wise exam schedule.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Create/Edit Exam Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    padding: '2rem 1rem',
                    overflowY: 'auto'
                }}>
                    <div className="modal-overlay"
                        onClick={() => setShowModal(false)}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: -1 }}
                    />
                    <div className="modal" style={{
                        position: 'relative',
                        maxWidth: '960px',
                        width: '100%',
                        maxHeight: 'none', // Remove limit to allow full visibility in scrollable container
                        borderRadius: '1.25rem',
                        border: 'none',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'white'
                    }}>
                        {/* Gradient Header */}
                        <div style={{
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: 'white',
                            padding: '1.75rem 2rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    padding: '0.75rem',
                                    borderRadius: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Calendar size={24} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.025em' }}>
                                        {editingExam ? 'Edit Exam Schedule' : 'Schedule New Exam'}
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.9, marginTop: '0.25rem' }}>
                                        Define parameters and subject timetable
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    border: 'none',
                                    color: 'white',
                                    padding: '0.5rem',
                                    borderRadius: '0.625rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {!isTeacher && (
                            <div style={{
                                display: 'flex',
                                background: 'white',
                                borderBottom: '1px solid var(--border)',
                                padding: '0 2rem'
                            }}>
                                <button
                                    onClick={() => setModalTab('GLOBAL')}
                                    style={{
                                        padding: '1rem 1.5rem',
                                        fontSize: '0.9375rem',
                                        fontWeight: 700,
                                        color: modalTab === 'GLOBAL' ? '#6366f1' : 'var(--text-muted)',
                                        borderBottom: `2px solid ${modalTab === 'GLOBAL' ? '#6366f1' : 'transparent'}`,
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Step 1: Exam Settings
                                </button>
                                <button
                                    onClick={() => {
                                        setModalTab('ROUTINE');
                                        if (newExam.targetClasses?.length && !activeRoutineClassId) {
                                            setActiveRoutineClassId(newExam.targetClasses[0]);
                                        }
                                    }}
                                    style={{
                                        padding: '1rem 1.5rem',
                                        fontSize: '0.9375rem',
                                        fontWeight: 700,
                                        color: modalTab === 'ROUTINE' ? '#6366f1' : 'var(--text-muted)',
                                        borderBottom: `2px solid ${modalTab === 'ROUTINE' ? '#6366f1' : 'transparent'}`,
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Step 2: Class-Wise Program
                                </button>
                            </div>
                        )}

                        <div className="modal-content" style={{ padding: '2rem', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
                            {modalTab === 'GLOBAL' && (
                                <div className="animate-fade-in">
                                    {/* Basic Information Section */}
                                    <div className="glass-card" style={{ padding: '1.75rem', marginBottom: '2rem', border: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#6366f115', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <FileText size={18} />
                                            </div>
                                            <h4 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-main)' }}>Exam Details</h4>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem', display: 'block' }}>
                                                    Internal Name * <small style={{ textTransform: 'none', color: '#6366f1' }}>(e.g. Unit Test 3 - Class 1-5)</small>
                                                </label>
                                                <input
                                                    type="text"
                                                    className="input-field"
                                                    placeholder="Only for dashboard identification"
                                                    value={newExam.name}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        // Sync display name if it was empty or identical
                                                        setNewExam(prev => ({
                                                            ...prev,
                                                            name: val,
                                                            displayName: (prev.displayName === prev.name || !prev.displayName) ? val : prev.displayName
                                                        }));
                                                    }}
                                                    onBlur={(e) => {
                                                        const val = toProperCase(e.target.value);
                                                        setNewExam(prev => ({
                                                            ...prev,
                                                            name: val,
                                                            displayName: (prev.displayName === prev.name || !prev.displayName) ? val : prev.displayName
                                                        }));
                                                    }}
                                                    style={{ fontSize: '1rem', padding: '0.875rem 1rem', borderRadius: '0.75rem' }}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem', display: 'block' }}>
                                                    Display Name * <small style={{ textTransform: 'none', color: '#10b981' }}>(This will be printed on Admit Cards/Result)</small>
                                                </label>
                                                <input
                                                    type="text"
                                                    className="input-field"
                                                    placeholder="e.g. Unit Test 3"
                                                    value={newExam.displayName}
                                                    onChange={(e) => setNewExam({ ...newExam, displayName: e.target.value })}
                                                    onBlur={(e) => setNewExam({ ...newExam, displayName: toProperCase(e.target.value) })}
                                                    style={{ fontSize: '1rem', padding: '0.875rem 1rem', borderRadius: '0.75rem' }}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem', display: 'block' }}>
                                                    Academic Year *
                                                </label>
                                                <select
                                                    className="input-field"
                                                    value={newExam.academicYearId}
                                                    onChange={(e) => {
                                                        const year = schoolYears.find(y => y.id === e.target.value);
                                                        setNewExam({
                                                            ...newExam,
                                                            academicYearId: e.target.value,
                                                            academicYearName: year?.name || '',
                                                            termId: '',
                                                            termName: ''
                                                        });
                                                    }}
                                                    style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem' }}
                                                >
                                                    <option value="">Select Session</option>
                                                    {schoolYears.map(year => (
                                                        <option key={year.id} value={year.id}>
                                                            Academic Year {year.name} {year.isActive && '(Current)'}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="form-group">
                                                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem', display: 'block' }}>
                                                    Select Term
                                                </label>
                                                <select
                                                    className="input-field"
                                                    value={newExam.termId}
                                                    onChange={(e) => {
                                                        const year = schoolYears.find(y => y.id === newExam.academicYearId);
                                                        const term = year?.terms?.find((t: any) => t.id === e.target.value);
                                                        setNewExam({
                                                            ...newExam,
                                                            termId: e.target.value,
                                                            termName: term?.name || ''
                                                        });
                                                    }}
                                                    disabled={!newExam.academicYearId}
                                                    style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem' }}
                                                >
                                                    <option value="">Choose Term</option>
                                                    {schoolYears.find(y => y.id === newExam.academicYearId)?.terms?.sort((a: any, b: any) => a.name.localeCompare(b.name)).map((term: any) => (
                                                        <option key={term.id} value={term.id}>{term.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem', display: 'block' }}>
                                                    Assessment Category *
                                                </label>
                                                <select
                                                    className="input-field"
                                                    value={newExam.assessmentTypeId}
                                                    onChange={(e) => {
                                                        const assessment = schoolAssessments.find(a => a.id === e.target.value);
                                                        const updatedSubjects = (newExam.subjects || []).map(sub => ({
                                                            ...sub,
                                                            passingMarks: assessment?.passingMarks ?? sub.passingMarks
                                                        }));
                                                        setNewExam({
                                                            ...newExam,
                                                            assessmentTypeId: e.target.value,
                                                            assessmentTypeName: assessment?.name || '',
                                                            subjects: updatedSubjects
                                                        });
                                                    }}
                                                    style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem' }}
                                                >
                                                    <option value="">Select Type</option>
                                                    {[...schoolAssessments].sort((a, b) => a.name.localeCompare(b.name)).map(assessment => (
                                                        <option key={assessment.id} value={assessment.id}>
                                                            {assessment.name} (Weightage: {assessment.weightage}%)
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="form-group">
                                                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem', display: 'block' }}>
                                                    Exam Start Date *
                                                </label>
                                                <input
                                                    type="date"
                                                    className="input-field"
                                                    value={newExam.startDate}
                                                    onChange={(e) => setNewExam({ ...newExam, startDate: e.target.value })}
                                                    style={{ padding: '0.8125rem 1rem', borderRadius: '0.75rem' }}
                                                />
                                            </div>
                                        </div>

                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                                                    Applicable Classes *
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const allSelected = newExam.targetClasses?.length === schoolClasses.length;
                                                        setNewExam({
                                                            ...newExam,
                                                            targetClasses: allSelected ? [] : schoolClasses.map(c => c.id)
                                                        });
                                                    }}
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700,
                                                        color: '#6366f1',
                                                        background: '#6366f110',
                                                        border: 'none',
                                                        padding: '0.375rem 0.75rem',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {newExam.targetClasses?.length === schoolClasses.length ? 'Deselect All' : 'Select All'}
                                                </button>
                                            </div>
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                                                gap: '0.75rem',
                                                maxHeight: '220px',
                                                overflowY: 'auto',
                                                padding: '1.25rem',
                                                background: 'white',
                                                border: '1px solid var(--border)',
                                                borderRadius: '1rem'
                                            }}>
                                                {schoolClasses.map(cls => (
                                                    <label
                                                        key={cls.id}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.625rem',
                                                            cursor: 'pointer',
                                                            padding: '0.75rem',
                                                            borderRadius: '0.75rem',
                                                            background: newExam.targetClasses?.includes(cls.id) ? '#6366f110' : 'transparent',
                                                            border: '1px solid',
                                                            borderColor: newExam.targetClasses?.includes(cls.id) ? '#6366f130' : 'transparent',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={newExam.targetClasses?.includes(cls.id) || false}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setNewExam({
                                                                        ...newExam,
                                                                        targetClasses: [...(newExam.targetClasses || []), cls.id]
                                                                    });
                                                                } else {
                                                                    setNewExam({
                                                                        ...newExam,
                                                                        targetClasses: newExam.targetClasses?.filter(id => id !== cls.id)
                                                                    });
                                                                }
                                                            }}
                                                            style={{ width: '1.125rem', height: '1.125rem', accentColor: '#6366f1' }}
                                                        />
                                                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: newExam.targetClasses?.includes(cls.id) ? '#4338ca' : 'var(--text-main)' }}>
                                                            {cls.name}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Subjects Configuration */}
                                    <div className="glass-card" style={{ padding: '1.75rem', border: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#8b5cf615', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <BookOpen size={18} />
                                                </div>
                                                <h4 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                                    Subject Timetable <span style={{ color: 'var(--text-muted)', fontWeight: 500, marginLeft: '0.25rem' }}>({newExam.subjects?.length || 0})</span>
                                                </h4>
                                            </div>
                                            <button
                                                onClick={handleAddSubject}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    background: '#f8fafc',
                                                    color: '#6366f1',
                                                    border: '1px solid #6366f1',
                                                    padding: '0.625rem 1.25rem',
                                                    borderRadius: '0.75rem',
                                                    fontWeight: 700,
                                                    fontSize: '0.875rem',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = '#6366f1'; e.currentTarget.style.color = 'white'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#6366f1'; }}
                                            >
                                                <Plus size={18} />
                                                Add Subject
                                            </button>
                                        </div>

                                        {newExam.subjects && newExam.subjects.length > 0 ? (
                                            <div style={{ display: 'grid', gap: '1.25rem' }}>
                                                {newExam.subjects.map((subject, index) => (
                                                    <div key={index} style={{
                                                        padding: '1.5rem',
                                                        border: '1px solid #e2e8f0',
                                                        borderLeft: '5px solid #6366f1',
                                                        borderRadius: '1rem',
                                                        background: '#f8fafc',
                                                        position: 'relative',
                                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
                                                        marginBottom: '0.5rem'
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                                                <div style={{
                                                                    width: '24px',
                                                                    height: '24px',
                                                                    borderRadius: '50%',
                                                                    background: '#6366f1',
                                                                    color: 'white',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 800
                                                                }}>
                                                                    {index + 1}
                                                                </div>
                                                                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Entry #{index + 1}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                <button
                                                                    onClick={() => handleDuplicateSubject(index)}
                                                                    style={{
                                                                        background: '#6366f110',
                                                                        color: '#6366f1',
                                                                        border: 'none',
                                                                        padding: '0.5rem',
                                                                        borderRadius: '0.5rem',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                    onMouseEnter={(e) => e.currentTarget.style.background = '#6366f120'}
                                                                    onMouseLeave={(e) => e.currentTarget.style.background = '#6366f110'}
                                                                    title="Duplicate this entry"
                                                                >
                                                                    <Copy size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRemoveSubject(index)}
                                                                    style={{
                                                                        background: '#ef444410',
                                                                        color: '#ef4444',
                                                                        border: 'none',
                                                                        padding: '0.5rem',
                                                                        borderRadius: '0.5rem',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                    onMouseEnter={(e) => e.currentTarget.style.background = '#ef444420'}
                                                                    onMouseLeave={(e) => e.currentTarget.style.background = '#ef444410'}
                                                                    title="Delete this entry"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                                                            <div className="form-group">
                                                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Subject</label>
                                                                <select
                                                                    className="input-field"
                                                                    value={subject.subjectId}
                                                                    onChange={(e) => handleSubjectChange(index, 'subjectId', e.target.value)}
                                                                    style={{ padding: '0.75rem', borderRadius: '0.625rem' }}
                                                                >
                                                                    <option value="">Select Subject</option>
                                                                    {[...schoolSubjects].sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="form-group">
                                                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Assessment Type</label>
                                                                <select
                                                                    className="input-field"
                                                                    value={subject.assessmentType || 'MARKS'}
                                                                    onChange={(e) => handleSubjectChange(index, 'assessmentType', e.target.value as 'MARKS' | 'GRADE')}
                                                                    style={{ padding: '0.75rem', borderRadius: '0.625rem' }}
                                                                >
                                                                    <option value="MARKS">Marks Based</option>
                                                                    <option value="GRADE">Grade Based</option>
                                                                </select>
                                                            </div>
                                                            {subject.assessmentType === 'MARKS' ? (
                                                                <div className="form-group">
                                                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Max Marks</label>
                                                                    <input
                                                                        type="number"
                                                                        className="input-field"
                                                                        placeholder="100"
                                                                        value={subject.maxMarks}
                                                                        onChange={(e) => handleSubjectChange(index, 'maxMarks', e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
                                                                        style={{ padding: '0.75rem', borderRadius: '0.625rem' }}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="form-group">
                                                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Grade</label>
                                                                    <div style={{ padding: '0.75rem', borderRadius: '0.625rem', background: '#f8fafc', border: '1px solid var(--border)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                                                        As per Exam Config
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Marks Breakdown Section */}
                                                        {subject.assessmentType === 'MARKS' && (
                                                            <div style={{ marginBottom: '1rem' }}>
                                                                <div style={{ border: '1px solid #e0e7ff', borderRadius: '0.625rem', padding: '0.75rem', background: '#fefce8' }}>
                                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={!!(subject.theoryMarks !== undefined || subject.practicalMarks !== undefined)}
                                                                            onChange={(e) => {
                                                                                if (e.target.checked) {
                                                                                    handleSubjectChange(index, 'theoryMarks', 0);
                                                                                    handleSubjectChange(index, 'practicalMarks', 0);
                                                                                } else {
                                                                                    const updated = [...(newExam.subjects || [])];
                                                                                    delete updated[index].theoryMarks;
                                                                                    delete updated[index].practicalMarks;
                                                                                    setNewExam({ ...newExam, subjects: updated });
                                                                                }
                                                                            }}
                                                                            style={{ accentColor: '#eab308', width: '16px', height: '16px' }}
                                                                        />
                                                                        <span>Enable Marks Breakdown <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#ca8a04' }}>(Theory/Practical)</span></span>
                                                                    </label>

                                                                    {(subject.theoryMarks !== undefined || subject.practicalMarks !== undefined) && (
                                                                        <div style={{ marginTop: '0.75rem' }}>
                                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                                                                                <div className="form-group">
                                                                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Theory Marks</label>
                                                                                    <input
                                                                                        type="number"
                                                                                        className="input-field"
                                                                                        placeholder="80"
                                                                                        value={subject.theoryMarks || ''}
                                                                                        onChange={(e) => handleSubjectChange(index, 'theoryMarks', e.target.value === '' ? 0 : parseInt(e.target.value))}
                                                                                        style={{ padding: '0.75rem', borderRadius: '0.625rem' }}
                                                                                    />
                                                                                </div>
                                                                                <div className="form-group">
                                                                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Practical Marks</label>
                                                                                    <input
                                                                                        type="number"
                                                                                        className="input-field"
                                                                                        placeholder="20"
                                                                                        value={subject.practicalMarks || ''}
                                                                                        onChange={(e) => handleSubjectChange(index, 'practicalMarks', e.target.value === '' ? 0 : parseInt(e.target.value))}
                                                                                        style={{ padding: '0.75rem', borderRadius: '0.625rem' }}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                            <div style={{
                                                                                padding: '0.5rem 0.75rem',
                                                                                borderRadius: '0.5rem',
                                                                                background: ((subject.theoryMarks || 0) + (subject.practicalMarks || 0)) === subject.maxMarks ? '#10b98115' : '#ef444415',
                                                                                border: `1px solid ${((subject.theoryMarks || 0) + (subject.practicalMarks || 0)) === subject.maxMarks ? '#10b981' : '#ef4444'}`,
                                                                                fontSize: '0.75rem',
                                                                                fontWeight: 600,
                                                                                color: ((subject.theoryMarks || 0) + (subject.practicalMarks || 0)) === subject.maxMarks ? '#10b981' : '#ef4444'
                                                                            }}>
                                                                                Total: {(subject.theoryMarks || 0) + (subject.practicalMarks || 0)} / {subject.maxMarks}
                                                                                {((subject.theoryMarks || 0) + (subject.practicalMarks || 0)) === subject.maxMarks ? ' ✓' : ' ⚠ Must equal Max Marks'}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Combined Subjects + Pass Marks */}
                                                        <div style={{ marginBottom: '1.25rem' }}>
                                                            {/* Pass % and Pass Marks */}
                                                            {subject.assessmentType === 'MARKS' && (
                                                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'end' }}>
                                                                    <div className="form-group" style={{ flex: 1, maxWidth: '200px' }}>
                                                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Pass %</label>
                                                                        <input
                                                                            type="number"
                                                                            className="input-field"
                                                                            placeholder="33"
                                                                            value={subject.passingMarks}
                                                                            onChange={(e) => {
                                                                                const pct = e.target.value === '' ? '' : (parseInt(e.target.value) || 0);
                                                                                handleSubjectChange(index, 'passingMarks', pct);
                                                                            }}
                                                                            style={{ padding: '0.75rem', borderRadius: '0.625rem' }}
                                                                        />
                                                                    </div>
                                                                    <div className="form-group" style={{ flex: 1, maxWidth: '200px' }}>
                                                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Pass Marks</label>
                                                                        <input
                                                                            type="number"
                                                                            className="input-field"
                                                                            placeholder={String(Math.ceil((subject.maxMarks * 33) / 100))}
                                                                            value={Math.ceil((subject.maxMarks * (subject.passingMarks || 0)) / 100)}
                                                                            onChange={(e) => {
                                                                                const marks = e.target.value === '' ? '' : (parseInt(e.target.value) || 0);
                                                                                const numericMarks = typeof marks === 'number' ? marks : 0;
                                                                                const pct = subject.maxMarks > 0 ? Math.round((numericMarks * 100) / subject.maxMarks) : 0;
                                                                                handleSubjectChange(index, 'passingMarks', pct);
                                                                            }}
                                                                            style={{ padding: '0.75rem', borderRadius: '0.625rem' }}
                                                                        />
                                                                    </div>
                                                                    <div style={{
                                                                        padding: '0.5rem 0.75rem',
                                                                        borderRadius: '0.5rem',
                                                                        background: '#f0fdf4',
                                                                        border: '1px solid #bbf7d0',
                                                                        fontSize: '0.75rem',
                                                                        fontWeight: 600,
                                                                        color: '#15803d',
                                                                        whiteSpace: 'nowrap',
                                                                        marginBottom: '0.25rem'
                                                                    }}>
                                                                        {Math.ceil((subject.maxMarks * (subject.passingMarks || 0)) / 100)} / {subject.maxMarks}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Collapsible Combined Subjects */}
                                                            <div style={{ border: '1px solid #e0e7ff', borderRadius: '0.625rem', padding: '0.75rem', background: '#f8fafc' }}>
                                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={!!subject.combinedSubjects}
                                                                        onChange={(e) => handleSubjectChange(index, 'combinedSubjects', e.target.checked ? [] : undefined)}
                                                                        style={{ accentColor: '#6366f1', width: '16px', height: '16px' }}
                                                                    />
                                                                    <span>Combine Additional Subjects <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#6366f1' }}>(e.g., Urdu, Deeniyat)</span></span>
                                                                </label>

                                                                {subject.combinedSubjects && (
                                                                    <div style={{ marginTop: '0.75rem', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.5rem', background: 'white', maxHeight: '120px', overflowY: 'auto' }}>
                                                                        {schoolSubjects.filter((s: any) => s.id !== subject.subjectId).map((s: any) => (
                                                                            <label
                                                                                key={s.id}
                                                                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem', cursor: 'pointer', borderRadius: '0.375rem', transition: 'background 0.2s' }}
                                                                                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={subject.combinedSubjects?.includes(s.id) || false}
                                                                                    onChange={(e) => {
                                                                                        const updated = e.target.checked
                                                                                            ? [...(subject.combinedSubjects || []), s.id]
                                                                                            : (subject.combinedSubjects || []).filter(id => id !== s.id);
                                                                                        handleSubjectChange(index, 'combinedSubjects', updated);
                                                                                    }}
                                                                                    style={{ accentColor: '#6366f1' }}
                                                                                />
                                                                                <span style={{ fontSize: '0.875rem' }}>{s.name}</span>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: `1.2fr repeat(${(currentSchool?.examTimeMode === 'GLOBAL' ? 0 : 1) + 1}, 1fr)${currentSchool?.showExamVenue !== false ? ' 1fr' : ''}`,
                                                            gap: '1.25rem'
                                                        }}>
                                                            <div className="form-group">
                                                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Exam Date</label>
                                                                <input
                                                                    type="date"
                                                                    className="input-field"
                                                                    value={subject.examDate}
                                                                    onChange={(e) => handleSubjectChange(index, 'examDate', e.target.value)}
                                                                    style={{ padding: '0.6875rem', borderRadius: '0.625rem' }}
                                                                />
                                                            </div>
                                                            {currentSchool?.examTimeMode !== 'GLOBAL' && (
                                                                <div className="form-group">
                                                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Start Time</label>
                                                                    <input
                                                                        type="time"
                                                                        className="input-field"
                                                                        value={subject.examTime}
                                                                        onChange={(e) => handleSubjectChange(index, 'examTime', e.target.value)}
                                                                        style={{ padding: '0.6875rem', borderRadius: '0.625rem' }}
                                                                    />
                                                                </div>
                                                            )}
                                                            <div className="form-group">
                                                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Duration (<small>mins</small>)</label>
                                                                <input
                                                                    type="number"
                                                                    className="input-field"
                                                                    placeholder="180"
                                                                    value={subject.duration}
                                                                    onChange={(e) => handleSubjectChange(index, 'duration', e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
                                                                    style={{ padding: '0.75rem', borderRadius: '0.625rem' }}
                                                                />
                                                            </div>
                                                        </div>

                                                        {currentSchool?.showExamVenue !== false && (
                                                            <div className="form-group">
                                                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Venue/Room</label>
                                                                <input
                                                                    type="text"
                                                                    className="input-field"
                                                                    placeholder="e.g., Room 101, Science Lab"
                                                                    value={subject.roomNumber}
                                                                    onChange={(e) => handleSubjectChange(index, 'roomNumber', e.target.value)}
                                                                    style={{ padding: '0.75rem', borderRadius: '0.625rem' }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{
                                                padding: '4rem 2rem',
                                                textAlign: 'center',
                                                border: '2px dashed var(--border)',
                                                borderRadius: '1.25rem',
                                                background: 'rgba(255, 255, 255, 0.5)'
                                            }}>
                                                <div style={{
                                                    width: '64px',
                                                    height: '64px',
                                                    borderRadius: '20px',
                                                    background: '#f1f5f9',
                                                    color: '#94a3b8',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    margin: '0 auto 1.25rem'
                                                }}>
                                                    <FileText size={32} />
                                                </div>
                                                <h5 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>No Subjects Scheduled</h5>
                                                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Add subjects to create the exam timetable for this schedule.</p>
                                                <button
                                                    onClick={handleAddSubject}
                                                    className="btn btn-primary"
                                                    style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem', fontWeight: 700 }}
                                                >
                                                    <Plus size={18} /> Add First Subject
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {modalTab === 'ROUTINE' && (
                                <div className="animate-fade-in">
                                    {/* Class Selection Tabs */}
                                    <div style={{
                                        display: 'flex',
                                        gap: '0.5rem',
                                        marginBottom: '2rem',
                                        overflowX: 'auto',
                                        paddingBottom: '0.5rem',
                                        borderBottom: '1px solid var(--border)'
                                    }}>
                                        {(newExam.targetClasses || []).map(classId => {
                                            const cls = schoolClasses.find(c => c.id === classId);
                                            const isActive = activeRoutineClassId === classId;
                                            const routineCount = getClassRoutine(classId).routine.length;
                                            return (
                                                <button
                                                    key={classId}
                                                    onClick={() => setActiveRoutineClassId(classId)}
                                                    style={{
                                                        padding: '0.75rem 1.25rem',
                                                        borderRadius: '0.75rem',
                                                        background: isActive ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'white',
                                                        color: isActive ? 'white' : 'var(--text-main)',
                                                        border: isActive ? 'none' : '1px solid var(--border)',
                                                        fontWeight: 700,
                                                        fontSize: '0.875rem',
                                                        whiteSpace: 'nowrap',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem',
                                                        boxShadow: isActive ? '0 4px 12px rgba(99, 102, 241, 0.2)' : 'none',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {cls?.name || classId}
                                                    {routineCount > 0 && (
                                                        <span style={{
                                                            background: isActive ? 'rgba(255,255,255,0.2)' : '#6366f115',
                                                            color: isActive ? 'white' : '#6366f1',
                                                            padding: '0.125rem 0.5rem',
                                                            borderRadius: '999px',
                                                            fontSize: '0.75rem'
                                                        }}>
                                                            {routineCount}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {activeRoutineClassId ? (
                                        <div className="glass-card" style={{ padding: '1.75rem', border: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                                <div>
                                                    <h4 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                                        Program for {schoolClasses.find(c => c.id === activeRoutineClassId)?.name || activeRoutineClassId}
                                                    </h4>
                                                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                        Define subjects and schedule for this specific class.
                                                    </p>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                                    {newExam.targetClasses && newExam.targetClasses.length > 1 && (
                                                        <div style={{ position: 'relative' }}>
                                                            <select
                                                                className="input-field"
                                                                style={{ padding: '0.625rem 2rem 0.625rem 1rem', fontSize: '0.8125rem', borderRadius: '0.75rem', width: 'auto' }}
                                                                onChange={(e) => {
                                                                    if (e.target.value) handleCopyRoutine(e.target.value, activeRoutineClassId);
                                                                    e.target.value = '';
                                                                }}
                                                            >
                                                                <option value="">Copy From...</option>
                                                                {newExam.targetClasses.filter(id => id !== activeRoutineClassId).map(id => (
                                                                    <option key={id} value={id}>{schoolClasses.find(c => c.id === id)?.name || id}</option>
                                                                ))}
                                                            </select>
                                                            <ChevronDown size={14} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => handleAddRoutineEntry(activeRoutineClassId)}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.5rem',
                                                            background: '#6366f1',
                                                            color: 'white',
                                                            border: 'none',
                                                            padding: '0.625rem 1.25rem',
                                                            borderRadius: '0.75rem',
                                                            fontWeight: 700,
                                                            fontSize: '0.875rem',
                                                            cursor: 'pointer',
                                                            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.2)'
                                                        }}
                                                    >
                                                        <Plus size={18} />
                                                        Add Subject
                                                    </button>
                                                </div>
                                            </div>

                                            {getClassRoutine(activeRoutineClassId).routine.length > 0 ? (
                                                <div style={{ display: 'grid', gap: '1rem' }}>
                                                    {getClassRoutine(activeRoutineClassId).routine.map((entry, idx) => (
                                                        <div key={idx} style={{
                                                            padding: '1.5rem',
                                                            border: '1px solid #e2e8f0',
                                                            borderLeft: '5px solid #6366f1',
                                                            borderRadius: '1.25rem',
                                                            background: '#f8fafc',
                                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
                                                            marginBottom: '1rem',
                                                            transition: 'all 0.2s ease'
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px dashed #e2e8f0' }}>
                                                                <div style={{
                                                                    width: '26px',
                                                                    height: '26px',
                                                                    borderRadius: '8px',
                                                                    background: '#6366f1',
                                                                    color: 'white',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 800,
                                                                    boxShadow: '0 2px 4px rgba(99, 102, 241, 0.3)'
                                                                }}>
                                                                    {idx + 1}
                                                                </div>
                                                                <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9375rem', letterSpacing: '0.01em' }}>Exam Subject Entry #{idx + 1}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                                                                <div style={{ display: 'flex', gap: '1.25rem', flex: 1, flexWrap: 'wrap' }}>
                                                                    <div className="form-group" style={{ flex: 1.5, minWidth: '180px' }}>
                                                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Subject</label>
                                                                        <select
                                                                            className="input-field"
                                                                            value={entry.subjectId}
                                                                            onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'subjectId', e.target.value)}
                                                                        >
                                                                            <option value="">Select Subject</option>
                                                                            {schoolSubjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                                        </select>
                                                                    </div>
                                                                    <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
                                                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Assessment Type</label>
                                                                        <select
                                                                            className="input-field"
                                                                            value={entry.assessmentType || 'MARKS'}
                                                                            onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'assessmentType', e.target.value)}
                                                                        >
                                                                            <option value="MARKS">Mark Based</option>
                                                                            <option value="GRADE">Grade Based</option>
                                                                        </select>
                                                                    </div>
                                                                    {entry.assessmentType === 'GRADE' ? (
                                                                        <div className="form-group" style={{ flex: 1, minWidth: '120px' }}>
                                                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Grade</label>
                                                                            <div style={{ padding: '0.75rem', borderRadius: '0.625rem', background: '#f8fafc', border: '1px solid var(--border)', fontSize: '0.875rem', color: 'var(--text-muted)', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
                                                                                As per Config
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            <div className="form-group" style={{ flex: 1, minWidth: '100px' }}>
                                                                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Max Marks</label>
                                                                                <input
                                                                                    type="number"
                                                                                    className="input-field"
                                                                                    value={entry.maxMarks}
                                                                                    onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'maxMarks', e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
                                                                                />
                                                                            </div>
                                                                            <div className="form-group" style={{ flex: 1, minWidth: '100px' }}>
                                                                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Pass %</label>
                                                                                <input
                                                                                    type="number"
                                                                                    className="input-field"
                                                                                    value={entry.passingMarks}
                                                                                    onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'passingMarks', e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
                                                                                />
                                                                            </div>
                                                                            <div className="form-group" style={{ flex: 1, minWidth: '100px' }}>
                                                                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Pass Marks</label>
                                                                                <input
                                                                                    type="number"
                                                                                    className="input-field"
                                                                                    value={Math.round((entry.passingMarks * entry.maxMarks) / 100)}
                                                                                    onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'passMarksNumber', e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
                                                                                />
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                                                                    <button
                                                                        onClick={() => handleDuplicateRoutineEntry(activeRoutineClassId, idx)}
                                                                        style={{
                                                                            background: '#6366f110',
                                                                            color: '#6366f1',
                                                                            border: 'none',
                                                                            padding: '0.5rem',
                                                                            borderRadius: '0.5rem',
                                                                            cursor: 'pointer',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            transition: 'all 0.2s'
                                                                        }}
                                                                        title="Duplicate"
                                                                    >
                                                                        <Copy size={16} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleRemoveRoutineEntry(activeRoutineClassId, idx)}
                                                                        style={{
                                                                            background: '#ef444410',
                                                                            color: '#ef4444',
                                                                            border: 'none',
                                                                            padding: '0.5rem',
                                                                            borderRadius: '0.5rem',
                                                                            cursor: 'pointer',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            transition: 'all 0.2s'
                                                                        }}
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Marks Breakdown Section */}
                                                            {entry.assessmentType !== 'GRADE' && (
                                                                <div style={{ marginBottom: '1rem' }}>
                                                                    <div style={{ border: '1px solid #e0e7ff', borderRadius: '0.625rem', padding: '0.75rem', background: '#fefce8' }}>
                                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={!!(entry.theoryMarks !== undefined || entry.practicalMarks !== undefined)}
                                                                                onChange={(e) => {
                                                                                    if (e.target.checked) {
                                                                                        handleRoutineEntryChange(activeRoutineClassId, idx, 'theoryMarks', 0);
                                                                                        handleRoutineEntryChange(activeRoutineClassId, idx, 'practicalMarks', 0);
                                                                                    } else {
                                                                                        handleRoutineEntryChange(activeRoutineClassId, idx, 'theoryMarks', undefined);
                                                                                        handleRoutineEntryChange(activeRoutineClassId, idx, 'practicalMarks', undefined);
                                                                                    }
                                                                                }}
                                                                                style={{ accentColor: '#eab308', width: '16px', height: '16px' }}
                                                                            />
                                                                            <span>Enable Marks Breakdown <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#ca8a04' }}>(Theory/Practical)</span></span>
                                                                        </label>

                                                                        {(entry.theoryMarks !== undefined || entry.practicalMarks !== undefined) && (
                                                                            <div style={{ marginTop: '0.75rem' }}>
                                                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                                                                                    <div className="form-group">
                                                                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Theory Marks</label>
                                                                                        <input
                                                                                            type="number"
                                                                                            className="input-field"
                                                                                            placeholder="80"
                                                                                            value={entry.theoryMarks || ''}
                                                                                            onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'theoryMarks', e.target.value === '' ? 0 : parseInt(e.target.value))}
                                                                                            style={{ padding: '0.75rem', borderRadius: '0.625rem' }}
                                                                                        />
                                                                                    </div>
                                                                                    <div className="form-group">
                                                                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Practical Marks</label>
                                                                                        <input
                                                                                            type="number"
                                                                                            className="input-field"
                                                                                            placeholder="20"
                                                                                            value={entry.practicalMarks || ''}
                                                                                            onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'practicalMarks', e.target.value === '' ? 0 : parseInt(e.target.value))}
                                                                                            style={{ padding: '0.75rem', borderRadius: '0.625rem' }}
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                                <div style={{
                                                                                    padding: '0.5rem 0.75rem',
                                                                                    borderRadius: '0.5rem',
                                                                                    background: ((entry.theoryMarks || 0) + (entry.practicalMarks || 0)) === entry.maxMarks ? '#10b98115' : '#ef444415',
                                                                                    border: `1px solid ${((entry.theoryMarks || 0) + (entry.practicalMarks || 0)) === entry.maxMarks ? '#10b981' : '#ef4444'}`,
                                                                                    fontSize: '0.75rem',
                                                                                    fontWeight: 600,
                                                                                    color: ((entry.theoryMarks || 0) + (entry.practicalMarks || 0)) === entry.maxMarks ? '#10b981' : '#ef4444'
                                                                                }}>
                                                                                    Total: {(entry.theoryMarks || 0) + (entry.practicalMarks || 0)} / {entry.maxMarks}
                                                                                    {((entry.theoryMarks || 0) + (entry.practicalMarks || 0)) === entry.maxMarks ? ' ✓' : ' ⚠ Must equal Max Marks'}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Combine Subjects Option */}
                                                            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={!!entry.combinedSubjects}
                                                                        onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'combinedSubjects', e.target.checked ? [] : undefined)}
                                                                        style={{ accentColor: '#6366f1', width: '16px', height: '16px' }}
                                                                    />
                                                                    <span>Combine Additional Subjects <small style={{ fontWeight: 400, color: '#6366f1' }}>(e.g. Phy+Che+Bio)</small></span>
                                                                </label>
                                                                {entry.combinedSubjects && (
                                                                    <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '100px', overflowY: 'auto', padding: '0.25rem' }}>
                                                                        {schoolSubjects.filter((s: any) => s.id !== entry.subjectId).map((s: any) => (
                                                                            <label key={s.id} style={{
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: '0.4rem',
                                                                                padding: '0.25rem 0.6rem',
                                                                                background: entry.combinedSubjects?.includes(s.id) ? '#6366f115' : 'white',
                                                                                border: `1px solid ${entry.combinedSubjects?.includes(s.id) ? '#6366f150' : '#e2e8f0'}`,
                                                                                borderRadius: '2rem',
                                                                                cursor: 'pointer',
                                                                                fontSize: '0.8125rem'
                                                                            }}>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={entry.combinedSubjects?.includes(s.id) || false}
                                                                                    onChange={(e) => {
                                                                                        const updated = e.target.checked
                                                                                            ? [...(entry.combinedSubjects || []), s.id]
                                                                                            : (entry.combinedSubjects || []).filter(id => id !== s.id);
                                                                                        handleRoutineEntryChange(activeRoutineClassId, idx, 'combinedSubjects', updated);
                                                                                    }}
                                                                                    style={{ display: 'none' }}
                                                                                />
                                                                                <span style={{ color: entry.combinedSubjects?.includes(s.id) ? '#6366f1' : 'var(--text-muted)' }}>{s.name}</span>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: `1.5fr 1fr 1fr${currentSchool?.showExamVenue !== false ? ' 1fr' : ''}`, gap: '1rem' }}>
                                                                <div className="form-group">
                                                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Date</label>
                                                                    <input type="date" className="input-field" value={entry.examDate} onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'examDate', e.target.value)} />
                                                                </div>
                                                                <div className="form-group">
                                                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Time</label>
                                                                    <input type="time" className="input-field" value={entry.examTime} onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'examTime', e.target.value)} />
                                                                </div>
                                                                <div className="form-group">
                                                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Mins</label>
                                                                    <input type="number" className="input-field" value={entry.duration} onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'duration', e.target.value === '' ? '' : (parseInt(e.target.value) || 0))} />
                                                                </div>
                                                                {currentSchool?.showExamVenue !== false && (
                                                                    <div className="form-group">
                                                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Venue</label>
                                                                        <input type="text" className="input-field" placeholder="Room" value={entry.venue} onChange={(e) => handleRoutineEntryChange(activeRoutineClassId, idx, 'venue', e.target.value)} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div style={{ padding: '3rem', textAlign: 'center', background: 'white', borderRadius: '1rem', border: '2px dashed var(--border)' }}>
                                                    <BookOpen size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                                                    <h5 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>No Program Defined</h5>
                                                    <p style={{ margin: '0.5rem 0 1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Add subjects or copy from another class to start.</p>
                                                    <button onClick={() => handleAddRoutineEntry(activeRoutineClassId)} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem' }}>
                                                        <Plus size={18} /> Add First Subject
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ padding: '4rem', textAlign: 'center' }}>
                                            <Users size={64} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                                            <h4>Select a Class</h4>
                                            <p style={{ color: 'var(--text-muted)' }}>Select a class from above to manage its specific exam routine.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="modal-footer" style={{
                            padding: '1.5rem 2rem',
                            background: 'white',
                            borderTop: '1px solid var(--border)',
                            display: 'flex',
                            gap: '1rem',
                            justifyContent: 'flex-end'
                        }}>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    padding: '0.875rem 1.75rem',
                                    borderRadius: '0.75rem',
                                    border: '1px solid var(--border)',
                                    background: 'white',
                                    color: 'var(--text-main)',
                                    fontWeight: 700,
                                    fontSize: '0.9375rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveExam}
                                style={{
                                    padding: '0.875rem 2rem',
                                    borderRadius: '0.75rem',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    color: 'white',
                                    fontWeight: 700,
                                    fontSize: '0.9375rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                                }}
                            >
                                {editingExam ? 'Update Exam Schedule' : 'Create Exam Schedule'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnhancedExamScheduling;

