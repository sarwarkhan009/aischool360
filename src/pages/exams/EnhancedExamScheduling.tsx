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
    X
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
    theoryMarks?: number;
    practicalMarks?: number;
    internalMarks?: number;
    externalMarks?: number;
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
        instructions: '',
        syllabusAttachments: [],
        status: 'DRAFT',
        isPublished: false
    });

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
        id: s.name, // Use name as ID for simplicity since it's unique in academic structure
        name: s.name
    }));

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

        if (!newExam.startDate || !newExam.endDate) {
            alert('Please select start and end dates');
            return;
        }

        try {
            const examData = {
                ...newExam,
                schoolId: currentSchool.id,
                updatedAt: new Date().toISOString()
            };

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
            endDate: '',
            subjects: [],
            instructions: '',
            syllabusAttachments: [],
            status: 'DRAFT',
            isPublished: false
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

        setNewExam({
            ...newExam,
            subjects: [
                ...(newExam.subjects || []),
                {
                    subjectId: '',
                    subjectName: '',
                    assessmentType: 'MARKS',
                    maxMarks: 100,
                    passingMarks: defaultPassMarks,
                    duration: 180,
                    examDate: newExam.startDate || '',
                    examTime: '09:00',
                    examiner: '',
                    roomNumber: ''
                }
            ]
        });
    };

    const handleRemoveSubject = (index: number) => {
        setNewExam({
            ...newExam,
            subjects: newExam.subjects?.filter((_, i) => i !== index)
        });
    };

    const handleDuplicateSubject = (index: number) => {
        const subjectToCopy = newExam.subjects?.[index];
        if (subjectToCopy) {
            // Increment date by 1 day
            let newDate = subjectToCopy.examDate;
            if (newDate) {
                const currentDate = new Date(newDate);
                currentDate.setDate(currentDate.getDate() + 1);
                newDate = currentDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
            }

            setNewExam({
                ...newExam,
                subjects: [
                    ...(newExam.subjects || []),
                    {
                        ...subjectToCopy,
                        subjectId: '', // Clear subject selection for new entry
                        subjectName: '',
                        examDate: newDate // Set date to +1 day
                    }
                ]
            });
        }
    };

    const handleSubjectChange = (index: number, field: keyof ExamSubject, value: any) => {
        const updatedSubjects = [...(newExam.subjects || [])];
        updatedSubjects[index] = { ...updatedSubjects[index], [field]: value };

        // Auto-populate subject name when subject is selected
        if (field === 'subjectId') {
            const subject = schoolSubjects.find((s: any) => s.id === value);
            if (subject) {
                updatedSubjects[index].subjectName = subject.name;
            }
        }

        setNewExam({ ...newExam, subjects: updatedSubjects });
    };

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
                                            <span>{new Date(exam.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - {new Date(exam.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                            <div style={{ color: '#10b981' }}><Users size={18} /></div>
                                            <span>{exam.targetClasses.length} Classes</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                            <div style={{ color: '#8b5cf6' }}><FileText size={18} /></div>
                                            <span>{exam.subjects.length} Subjects</span>
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

            {/* Create/Edit Exam Modal */}
            {showModal && (
                <>
                    <div className="modal-overlay" onClick={() => setShowModal(false)} />
                    <div className="modal" style={{
                        maxWidth: '960px',
                        width: '95%',
                        maxHeight: '92vh',
                        borderRadius: '1.25rem',
                        border: 'none',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
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

                        <div className="modal-content" style={{ padding: '2rem', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
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

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="form-group">
                                            <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem', display: 'block' }}>
                                                Start Date *
                                            </label>
                                            <input
                                                type="date"
                                                className="input-field"
                                                value={newExam.startDate}
                                                onChange={(e) => setNewExam({ ...newExam, startDate: e.target.value })}
                                                style={{ padding: '0.8125rem 1rem', borderRadius: '0.75rem' }}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem', display: 'block' }}>
                                                End Date *
                                            </label>
                                            <input
                                                type="date"
                                                className="input-field"
                                                value={newExam.endDate}
                                                onChange={(e) => setNewExam({ ...newExam, endDate: e.target.value })}
                                                style={{ padding: '0.8125rem 1rem', borderRadius: '0.75rem' }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', display: 'block' }}>
                                        Applicable Classes *
                                    </label>
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
                                                border: '1px solid var(--border)',
                                                borderRadius: '1rem',
                                                background: 'white',
                                                position: 'relative',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
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
                                                                onChange={(e) => handleSubjectChange(index, 'maxMarks', parseInt(e.target.value) || 0)}
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
                                                                                value={subject.theoryMarks || 0}
                                                                                onChange={(e) => handleSubjectChange(index, 'theoryMarks', parseInt(e.target.value) || 0)}
                                                                                style={{ padding: '0.75rem', borderRadius: '0.625rem' }}
                                                                            />
                                                                        </div>
                                                                        <div className="form-group">
                                                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Practical Marks</label>
                                                                            <input
                                                                                type="number"
                                                                                className="input-field"
                                                                                placeholder="20"
                                                                                value={subject.practicalMarks || 0}
                                                                                onChange={(e) => handleSubjectChange(index, 'practicalMarks', parseInt(e.target.value) || 0)}
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
                                                    {/* Pass Marks */}
                                                    {subject.assessmentType === 'MARKS' && (
                                                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Pass %</label>
                                                            <input
                                                                type="number"
                                                                className="input-field"
                                                                placeholder="33"
                                                                value={subject.passingMarks}
                                                                onChange={(e) => handleSubjectChange(index, 'passingMarks', parseInt(e.target.value) || 0)}
                                                                style={{ padding: '0.75rem', borderRadius: '0.625rem', maxWidth: '200px' }}
                                                            />
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

                                                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '1.25rem' }}>
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
                                                    <div className="form-group">
                                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Duration (<small>mins</small>)</label>
                                                        <input
                                                            type="number"
                                                            className="input-field"
                                                            placeholder="180"
                                                            value={subject.duration}
                                                            onChange={(e) => handleSubjectChange(index, 'duration', parseInt(e.target.value) || 0)}
                                                            style={{ padding: '0.75rem', borderRadius: '0.625rem' }}
                                                        />
                                                    </div>
                                                </div>
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
                </>
            )
            }
        </div >
    );
};

export default EnhancedExamScheduling;

