import React, { useState } from 'react';
import {
    Settings,
    Plus,
    Edit2,
    Trash2,
    Award,
    TrendingUp,
    Check,
    X,
    AlertCircle,
    Database
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';
import { toProperCase } from '../../utils/formatters';

interface AssessmentType {
    id: string;
    schoolId: string;
    name: string; // e.g., "Unit Test", "Mid-Term", "Final Exam"
    shortName: string; // e.g., "UT", "MT", "FE"
    weightage: number; // Percentage contribution to final grade
    color: string; // For UI distinction
    icon: string; // Icon name
    passingMarks: number; // Minimum percentage to pass
    isActive: boolean;
    order: number; // Display order
    createdAt: string;
    updatedAt: string;
}

interface GradeRange {
    min: number;
    max: number;
    grade: string;
    gradePoint?: number;
    description: string;
}

interface GradingSystem {
    id: string;
    schoolId: string;
    name: string; // e.g., "10-Point GPA", "Letter Grades", "Percentage"
    type: 'PERCENTAGE' | 'LETTER' | 'GPA' | 'MARKS';
    ranges: GradeRange[];
    isDefault: boolean;
    applicableClasses: string[]; // Empty means all classes
    createdAt: string;
    updatedAt: string;
}

const AVAILABLE_COLORS = [
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Orange', value: '#f59e0b' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Teal', value: '#14b8a6' }
];

const DEFAULT_GRADING_TEMPLATES = {
    PERCENTAGE: [
        { min: 90, max: 100, grade: 'A+', description: 'Outstanding' },
        { min: 80, max: 89, grade: 'A', description: 'Excellent' },
        { min: 70, max: 79, grade: 'B+', description: 'Very Good' },
        { min: 60, max: 69, grade: 'B', description: 'Good' },
        { min: 50, max: 59, grade: 'C', description: 'Average' },
        { min: 40, max: 49, grade: 'D', description: 'Pass' },
        { min: 0, max: 39, grade: 'F', description: 'Fail' }
    ],
    GPA: [
        { min: 90, max: 100, grade: 'A+', gradePoint: 10, description: 'Outstanding' },
        { min: 80, max: 89, grade: 'A', gradePoint: 9, description: 'Excellent' },
        { min: 70, max: 79, grade: 'B+', gradePoint: 8, description: 'Very Good' },
        { min: 60, max: 69, grade: 'B', gradePoint: 7, description: 'Good' },
        { min: 50, max: 59, grade: 'C', gradePoint: 6, description: 'Average' },
        { min: 40, max: 49, grade: 'D', gradePoint: 5, description: 'Pass' },
        { min: 0, max: 39, grade: 'F', gradePoint: 0, description: 'Fail' }
    ]
};

const DEFAULT_LETTER_GRADE: Omit<GradingSystem, 'id' | 'schoolId' | 'createdAt' | 'updatedAt'> = {
    name: 'Letter Grade',
    type: 'LETTER',
    isDefault: true,
    applicableClasses: [],
    ranges: [
        { min: 91, max: 100, grade: 'A+', description: 'Excellent' },
        { min: 81, max: 90, grade: 'A', description: 'Very Good' },
        { min: 71, max: 80, grade: 'B+', description: 'Good' },
        { min: 61, max: 70, grade: 'B', description: 'Average' },
        { min: 51, max: 60, grade: 'C', description: 'Satisfactory' },
        { min: 41, max: 50, grade: 'D', description: 'Poor' },
        { min: 33, max: 40, grade: 'E', description: 'Very Poor' },
        { min: 0, max: 32, grade: 'F', description: 'Fail' }
    ]
};

const ExamConfiguration: React.FC = () => {
    const { currentSchool } = useSchool();
    const { data: assessmentTypes, add: addAssessment, update: updateAssessment, remove: deleteAssessment } = useFirestore<AssessmentType>('assessment_types');
    const { data: gradingSystems, add: addGrading, update: updateGrading, remove: deleteGrading } = useFirestore<GradingSystem>('grading_systems');

    const [activeTab, setActiveTab] = useState<'ASSESSMENT' | 'GRADING'>('ASSESSMENT');

    // Assessment Type State
    const [showAssessmentModal, setShowAssessmentModal] = useState(false);
    const [editingAssessment, setEditingAssessment] = useState<AssessmentType | null>(null);
    const [newAssessment, setNewAssessment] = useState<Partial<AssessmentType>>({
        name: '',
        shortName: '',
        weightage: 0,
        color: AVAILABLE_COLORS[0].value,
        icon: 'BookOpen',
        passingMarks: 40,
        isActive: true,
        order: 0
    });

    // Grading System State
    const [showGradingModal, setShowGradingModal] = useState(false);
    const [editingGrading, setEditingGrading] = useState<GradingSystem | null>(null);
    const [newGrading, setNewGrading] = useState<Partial<GradingSystem>>({
        name: '',
        type: 'PERCENTAGE',
        ranges: DEFAULT_GRADING_TEMPLATES.PERCENTAGE,
        isDefault: false,
        applicableClasses: []
    });

    // Filter for current school
    const schoolAssessments = assessmentTypes?.filter(a => a.schoolId === currentSchool?.id)?.sort((a, b) => a.order - b.order) || [];
    const schoolGradingSystems = gradingSystems?.filter(g => g.schoolId === currentSchool?.id) || [];
    const defaultGradingSystem = schoolGradingSystems.find(g => g.isDefault);

    // Assessment Type Handlers
    const handleSaveAssessment = async () => {
        if (!newAssessment.name || !newAssessment.shortName || !currentSchool?.id) {
            alert('Please fill in all required fields');
            return;
        }

        // Validate weightage total
        const totalWeightage = schoolAssessments.reduce((sum, a) => {
            if (editingAssessment && a.id === editingAssessment.id) return sum;
            return sum + a.weightage;
        }, 0) + (newAssessment.weightage || 0);

        if (totalWeightage > 100) {
            const proceed = window.confirm(`Note: Total weightage of all types is ${totalWeightage}%, which exceeds 100%. \n\nThis is normal if you are configuring multiple terms (e.g., Term 1 and Term 2 both having 100% separately). \n\nDo you want to proceed?`);
            if (!proceed) return;
        }

        try {
            const assessmentData = {
                ...newAssessment,
                schoolId: currentSchool.id,
                updatedAt: new Date().toISOString()
            };

            if (editingAssessment) {
                await updateAssessment(editingAssessment.id, assessmentData);
            } else {
                await addAssessment({
                    ...assessmentData,
                    order: schoolAssessments.length,
                    createdAt: new Date().toISOString()
                } as AssessmentType);
            }

            setShowAssessmentModal(false);
            setEditingAssessment(null);
            setNewAssessment({
                name: '',
                shortName: '',
                weightage: 0,
                color: AVAILABLE_COLORS[0].value,
                icon: 'BookOpen',
                passingMarks: 40,
                isActive: true,
                order: 0
            });
        } catch (error) {
            console.error('Error saving assessment type:', error);
            alert('Failed to save assessment type');
        }
    };

    const handleDeleteAssessment = async (id: string) => {
        if (!confirm('Are you sure you want to delete this assessment type?')) return;
        try {
            await deleteAssessment(id);
        } catch (error) {
            console.error('Error deleting assessment type:', error);
            alert('Failed to delete assessment type');
        }
    };

    // Grading System Handlers
    const handleSaveGrading = async () => {
        if (!newGrading.name || !currentSchool?.id) {
            alert('Please fill in all required fields');
            return;
        }

        // Validate ranges
        if (!newGrading.ranges || newGrading.ranges.length === 0) {
            alert('Please add at least one grade range');
            return;
        }

        try {
            const gradingData = {
                ...newGrading,
                schoolId: currentSchool.id,
                updatedAt: new Date().toISOString()
            };

            if (editingGrading) {
                await updateGrading(editingGrading.id, gradingData);
            } else {
                await addGrading({
                    ...gradingData,
                    createdAt: new Date().toISOString()
                } as GradingSystem);
            }

            setShowGradingModal(false);
            setEditingGrading(null);
            setNewGrading({
                name: '',
                type: 'PERCENTAGE',
                ranges: DEFAULT_GRADING_TEMPLATES.PERCENTAGE,
                isDefault: false,
                applicableClasses: []
            });
        } catch (error) {
            console.error('Error saving grading system:', error);
            alert('Failed to save grading system');
        }
    };

    const handleSetDefaultGrading = async (id: string) => {
        try {
            // Set all to non-default
            const promises = schoolGradingSystems.map(async (g) => {
                if (g.id === id) {
                    await updateGrading(g.id, { isDefault: true, updatedAt: new Date().toISOString() });
                } else if (g.isDefault) {
                    await updateGrading(g.id, { isDefault: false, updatedAt: new Date().toISOString() });
                }
            });
            await Promise.all(promises);
        } catch (error) {
            console.error('Error setting default grading system:', error);
            alert('Failed to set default grading system');
        }
    };

    const handleDeleteGrading = async (id: string) => {
        if (!confirm('Are you sure you want to delete this grading system?')) return;
        try {
            await deleteGrading(id);
        } catch (error) {
            console.error('Error deleting grading system:', error);
            alert('Failed to delete grading system');
        }
    };

    const [seedingId, setSeedingId] = useState<string | null>(null);

    const handleSeedGrading = async (grading: GradingSystem) => {
        if (!currentSchool?.id) return;
        if (!confirm(`Seed "${grading.name}" grades to the database? This will update the stored grade ranges.`)) return;
        setSeedingId(grading.id);
        try {
            await updateGrading(grading.id, {
                ...grading,
                schoolId: currentSchool.id,
                updatedAt: new Date().toISOString()
            });
            alert(`"${grading.name}" seeded successfully!`);
        } catch (error) {
            console.error('Error seeding grading system:', error);
            alert('Failed to seed grading system');
        } finally {
            setSeedingId(null);
        }
    };

    const handleSeedDefaultLetterGrade = async () => {
        if (!currentSchool?.id) return;
        if (!confirm('Seed the default Letter Grade system to the database? This will add a new Letter Grade grading system.')) return;
        setSeedingId('__default__');
        try {
            // If a default already exists, unset it first
            const existingDefault = schoolGradingSystems.find(g => g.isDefault);
            if (existingDefault) {
                await updateGrading(existingDefault.id, { isDefault: false, updatedAt: new Date().toISOString() });
            }
            await addGrading({
                ...DEFAULT_LETTER_GRADE,
                schoolId: currentSchool.id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            } as GradingSystem);
            alert('Default Letter Grade seeded successfully!');
        } catch (error) {
            console.error('Error seeding default letter grade:', error);
            alert('Failed to seed default letter grade');
        } finally {
            setSeedingId(null);
        }
    };

    const totalWeightage = schoolAssessments.reduce((sum, a) => sum + a.weightage, 0);

    return (
        <div className="page-container">
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <h1 className="page-title">Exam Configuration</h1>
                    <p className="page-subtitle">Configure assessment types and grading systems</p>
                </div>
            </div>

            <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '2rem',
                borderBottom: '2px solid var(--border)',
                paddingBottom: '0'
            }}>
                <button
                    onClick={() => setActiveTab('ASSESSMENT')}
                    style={activeTab === 'ASSESSMENT' ? {
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '0.875rem 1.75rem',
                        borderRadius: '0.75rem 0.75rem  0',
                        fontWeight: 600,
                        fontSize: '0.9375rem',
                        cursor: 'pointer',
                        boxShadow: '0 -2px 8px rgba(99, 102, 241, 0.2)',
                        transition: 'all 0.2s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    } : {
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        border: 'none',
                        padding: '0.875rem 1.75rem',
                        borderRadius: '0.75rem 0.75rem 0 0',
                        fontWeight: 600,
                        fontSize: '0.9375rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <TrendingUp size={20} />
                    Assessment Types
                </button>
                <button
                    onClick={() => setActiveTab('GRADING')}
                    style={activeTab === 'GRADING' ? {
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '0.875rem 1.75rem',
                        borderRadius: '0.75rem 0.75rem 0 0',
                        fontWeight: 600,
                        fontSize: '0.9375rem',
                        cursor: 'pointer',
                        boxShadow: '0 -2px 8px rgba(99, 102, 241, 0.2)',
                        transition: 'all 0.2s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    } : {
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        border: 'none',
                        padding: '0.875rem 1.75rem',
                        borderRadius: '0.75rem 0.75rem 0 0',
                        fontWeight: 600,
                        fontSize: '0.9375rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Award size={20} />
                    Grading Systems
                </button>
            </div>

            {/* Assessment Types Tab */}
            {activeTab === 'ASSESSMENT' && (
                <div className="animate-fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                                Assessment Types
                            </h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                Total Weightage:
                                <strong style={{
                                    color: totalWeightage % 100 === 0 && totalWeightage > 0 ? '#10b981' : '#f59e0b',
                                    padding: '0.125rem 0.5rem',
                                    borderRadius: '0.25rem',
                                    background: (totalWeightage % 100 === 0 && totalWeightage > 0) ? '#10b98110' : '#f59e0b10'
                                }}>
                                    {totalWeightage}%
                                </strong>
                                {totalWeightage > 100 && (
                                    <span style={{ fontSize: '0.75rem', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <AlertCircle size={14} />
                                        Note: {Math.ceil(totalWeightage / 100)} terms configured (100% per term)
                                    </span>
                                )}
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                setEditingAssessment(null);
                                setNewAssessment({
                                    name: '',
                                    shortName: '',
                                    weightage: 0,
                                    color: AVAILABLE_COLORS[0].value,
                                    icon: 'BookOpen',
                                    passingMarks: 40,
                                    isActive: true,
                                    order: schoolAssessments.length
                                });
                                setShowAssessmentModal(true);
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '0.75rem',
                                fontWeight: 600,
                                fontSize: '0.9375rem',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                            }}
                        >
                            <Plus size={20} />
                            Add Assessment Type
                        </button>
                    </div>

                    {schoolAssessments.length === 0 ? (
                        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                            <TrendingUp size={64} style={{ margin: '0 auto', color: 'var(--text-muted)', marginBottom: '1rem' }} />
                            <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>No Assessment Types Yet</h3>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                                Create assessment types like Unit Tests, Mid-Terms, and Final Exams
                            </p>
                            <button
                                onClick={() => setShowAssessmentModal(true)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '0.75rem',
                                    fontWeight: 600,
                                    fontSize: '0.9375rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                                }}
                            >
                                <Plus size={20} />
                                Add Assessment Type
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            {schoolAssessments.map(assessment => (
                                <div key={assessment.id} className="card" style={{ padding: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1 }}>
                                            <div style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '12px',
                                                background: assessment.color + '20',
                                                border: `2px solid ${assessment.color}`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: assessment.color,
                                                fontWeight: 800,
                                                fontSize: '0.875rem'
                                            }}>
                                                {assessment.shortName}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                                        {assessment.name}
                                                    </h3>
                                                    {!assessment.isActive && (
                                                        <span style={{
                                                            background: '#6b7280',
                                                            color: 'white',
                                                            padding: '0.125rem 0.5rem',
                                                            borderRadius: '999px',
                                                            fontSize: '0.625rem',
                                                            fontWeight: 700
                                                        }}>
                                                            INACTIVE
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                                    <div>
                                                        <strong>Weightage:</strong> {assessment.weightage}%
                                                    </div>
                                                    <div>
                                                        <strong>Passing:</strong> {assessment.passingMarks}%
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => {
                                                    setEditingAssessment(assessment);
                                                    setNewAssessment(assessment);
                                                    setShowAssessmentModal(true);
                                                }}
                                                className="btn-secondary"
                                                style={{ padding: '0.5rem' }}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteAssessment(assessment.id)}
                                                className="btn-secondary"
                                                style={{ padding: '0.5rem', color: '#ef4444' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {totalWeightage !== 100 && schoolAssessments.length > 0 && (
                        <div style={{
                            background: '#f59e0b20',
                            border: '1px solid #f59e0b40',
                            borderRadius: '0.75rem',
                            padding: '1rem',
                            display: 'flex',
                            gap: '0.75rem',
                            marginTop: '1.5rem'
                        }}>
                            <AlertCircle size={20} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '0.125rem' }} />
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-main)' }}>
                                <strong>Warning:</strong> Total weightage is {totalWeightage}%. It should be exactly 100% for accurate result calculation.
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Grading Systems Tab */}
            {activeTab === 'GRADING' && (
                <div className="animate-fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                                Grading Systems
                            </h2>
                            {defaultGradingSystem && (
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                    Default: <strong style={{ color: '#10b981' }}>{defaultGradingSystem.name}</strong>
                                </p>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button
                                onClick={handleSeedDefaultLetterGrade}
                                disabled={seedingId === '__default__'}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: seedingId === '__default__' ? '#6b7280' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '0.75rem',
                                    fontWeight: 600,
                                    fontSize: '0.9375rem',
                                    cursor: seedingId === '__default__' ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                                    transition: 'all 0.2s ease',
                                    opacity: seedingId === '__default__' ? 0.7 : 1
                                }}
                                onMouseEnter={(e) => {
                                    if (seedingId !== '__default__') {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                                }}
                            >
                                <Database size={18} />
                                {seedingId === '__default__' ? 'Seeding...' : 'Seed Default Letter Grade'}
                            </button>
                            <button
                                onClick={() => {
                                    setEditingGrading(null);
                                    setNewGrading({
                                        name: '',
                                        type: 'PERCENTAGE',
                                        ranges: DEFAULT_GRADING_TEMPLATES.PERCENTAGE,
                                        isDefault: false,
                                        applicableClasses: []
                                    });
                                    setShowGradingModal(true);
                                }}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '0.75rem',
                                    fontWeight: 600,
                                    fontSize: '0.9375rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                                }}
                            >
                                <Plus size={20} />
                                Add Grading System
                            </button>
                        </div>
                    </div>

                    {schoolGradingSystems.length === 0 ? (
                        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                            <Award size={64} style={{ margin: '0 auto', color: 'var(--text-muted)', marginBottom: '1rem' }} />
                            <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>No Grading Systems Yet</h3>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                                Create grading systems with custom grade ranges
                            </p>
                            <button
                                onClick={() => setShowGradingModal(true)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '0.75rem',
                                    fontWeight: 600,
                                    fontSize: '0.9375rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                                }}
                            >
                                <Plus size={20} />
                                Add Grading System
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '1.5rem' }}>
                            {schoolGradingSystems.map(grading => (
                                <div key={grading.id} className="card" style={{ padding: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                                    {grading.name}
                                                </h3>
                                                {grading.isDefault && (
                                                    <span style={{
                                                        background: '#10b981',
                                                        color: 'white',
                                                        padding: '0.25rem 0.75rem',
                                                        borderRadius: '999px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700
                                                    }}>
                                                        DEFAULT
                                                    </span>
                                                )}
                                            </div>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                                Type: {grading.type} • {grading.ranges.length} Grade Ranges
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            {!grading.isDefault && (
                                                <button
                                                    onClick={() => handleSetDefaultGrading(grading.id)}
                                                    className="btn-secondary"
                                                    style={{ fontSize: '0.875rem' }}
                                                >
                                                    <Check size={16} />
                                                    Set Default
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleSeedGrading(grading)}
                                                disabled={seedingId === grading.id}
                                                className="btn-secondary"
                                                style={{
                                                    fontSize: '0.875rem',
                                                    color: seedingId === grading.id ? '#6b7280' : '#10b981',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.375rem',
                                                    opacity: seedingId === grading.id ? 0.6 : 1,
                                                    cursor: seedingId === grading.id ? 'not-allowed' : 'pointer'
                                                }}
                                            >
                                                <Database size={15} />
                                                {seedingId === grading.id ? 'Seeding...' : 'Seed to DB'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditingGrading(grading);
                                                    setNewGrading(grading);
                                                    setShowGradingModal(true);
                                                }}
                                                className="btn-secondary"
                                                style={{ padding: '0.5rem' }}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteGrading(grading.id)}
                                                className="btn-secondary"
                                                style={{ padding: '0.5rem', color: '#ef4444' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Grade Ranges Table */}
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border)' }}>
                                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700 }}>Grade</th>
                                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700 }}>Range</th>
                                                    {grading.type === 'GPA' && <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700 }}>Grade Point</th>}
                                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700 }}>Description</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {grading.ranges.sort((a, b) => b.min - a.min).map((range, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>{range.grade}</td>
                                                        <td style={{ padding: '0.75rem' }}>{range.min}% - {range.max}%</td>
                                                        {grading.type === 'GPA' && <td style={{ padding: '0.75rem' }}>{range.gradePoint}</td>}
                                                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{range.description}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Assessment Type Modal */}
            {showAssessmentModal && (
                <>
                    <div className="modal-overlay" onClick={() => setShowAssessmentModal(false)} />
                    <div className="modal" style={{ maxWidth: '600px' }}>
                        {/* Modern Header */}
                        <div style={{
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: 'white',
                            padding: '1.5rem',
                            borderRadius: '1rem 1rem 0 0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    padding: '0.625rem',
                                    borderRadius: '0.625rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <TrendingUp size={22} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                                        {editingAssessment ? 'Edit Assessment Type' : 'Add Assessment Type'}
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.8125rem', opacity: 0.9, marginTop: '0.125rem' }}>
                                        {editingAssessment ? 'Update assessment parameters' : 'Create a new type of assessment'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAssessmentModal(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    border: 'none',
                                    color: 'white',
                                    padding: '0.5rem',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Form Content */}
                        <div style={{ padding: '1.75rem' }}>
                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                                    Assessment Name *
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="e.g., Unit Test 1, Mid-Term Exam"
                                    value={newAssessment.name}
                                    onChange={(e) => setNewAssessment({ ...newAssessment, name: e.target.value })}
                                    onBlur={(e) => {
                                        setNewAssessment({ ...newAssessment, name: toProperCase(e.target.value) });
                                        e.currentTarget.style.borderColor = '#e5e7eb';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '0.625rem',
                                        border: '2px solid #e5e7eb',
                                        fontSize: '0.9375rem',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#6366f1';
                                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                                    }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                                    Short Name *
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="e.g., UT1, MT"
                                    maxLength={5}
                                    value={newAssessment.shortName}
                                    onChange={(e) => setNewAssessment({ ...newAssessment, shortName: e.target.value.toUpperCase() })}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '0.625rem',
                                        border: '2px solid #e5e7eb',
                                        fontSize: '0.9375rem',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#6366f1';
                                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = '#e5e7eb';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                                        Weightage (%) *
                                    </label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        min="0"
                                        max="100"
                                        value={newAssessment.weightage}
                                        onChange={(e) => setNewAssessment({ ...newAssessment, weightage: parseFloat(e.target.value) || 0 })}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '0.625rem',
                                            border: '2px solid #e5e7eb',
                                            fontSize: '0.9375rem',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = '#6366f1';
                                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = '#e5e7eb';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                                        Passing Marks (%) *
                                    </label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        min="0"
                                        max="100"
                                        value={newAssessment.passingMarks}
                                        onChange={(e) => setNewAssessment({ ...newAssessment, passingMarks: parseFloat(e.target.value) || 0 })}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '0.625rem',
                                            border: '2px solid #e5e7eb',
                                            fontSize: '0.9375rem',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = '#6366f1';
                                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = '#e5e7eb';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                                    Theme Color
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                                    {AVAILABLE_COLORS.map(color => (
                                        <button
                                            key={color.value}
                                            onClick={() => setNewAssessment({ ...newAssessment, color: color.value })}
                                            style={{
                                                padding: '0.625rem',
                                                borderRadius: '0.625rem',
                                                border: newAssessment.color === color.value ? `2px solid ${color.value}` : '2px solid transparent',
                                                background: newAssessment.color === color.value ? color.value + '20' : '#f9fafb',
                                                color: newAssessment.color === color.value ? color.value : '#64748b',
                                                fontWeight: 600,
                                                fontSize: '0.8125rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (newAssessment.color !== color.value) {
                                                    e.currentTarget.style.background = '#f1f5f9';
                                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (newAssessment.color !== color.value) {
                                                    e.currentTarget.style.background = '#f9fafb';
                                                    e.currentTarget.style.borderColor = 'transparent';
                                                }
                                            }}
                                        >
                                            <div style={{
                                                width: '12px',
                                                height: '12px',
                                                borderRadius: '50%',
                                                background: color.value
                                            }} />
                                            {color.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Active Toggle */}
                            <div style={{
                                padding: '1rem',
                                background: '#f9fafb',
                                borderRadius: '0.75rem',
                                border: '1px solid #e5e7eb'
                            }}>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.625rem',
                                    cursor: 'pointer',
                                    userSelect: 'none'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={newAssessment.isActive || false}
                                        onChange={(e) => setNewAssessment({ ...newAssessment, isActive: e.target.checked })}
                                        style={{
                                            width: '18px',
                                            height: '18px',
                                            cursor: 'pointer',
                                            accentColor: '#6366f1'
                                        }}
                                    />
                                    <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9375rem' }}>
                                        Status: {newAssessment.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                    {newAssessment.isActive && (
                                        <span style={{
                                            background: '#10b981',
                                            color: 'white',
                                            padding: '0.125rem 0.5rem',
                                            borderRadius: '999px',
                                            fontSize: '0.6875rem',
                                            fontWeight: 700
                                        }}>
                                            AVAILABLE FOR EXAMS
                                        </span>
                                    )}
                                </label>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            borderTop: '1px solid #e5e7eb',
                            display: 'flex',
                            gap: '0.75rem',
                            justifyContent: 'flex-end'
                        }}>
                            <button
                                onClick={() => setShowAssessmentModal(false)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '0.625rem',
                                    border: '2px solid #e5e7eb',
                                    background: 'white',
                                    color: '#6b7280',
                                    fontWeight: 600,
                                    fontSize: '0.9375rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f9fafb';
                                    e.currentTarget.style.borderColor = '#d1d5db';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'white';
                                    e.currentTarget.style.borderColor = '#e5e7eb';
                                }}
                            >
                                <X size={18} />
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveAssessment}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '0.625rem',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    color: 'white',
                                    fontWeight: 600,
                                    fontSize: '0.9375rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                                }}
                            >
                                <Check size={18} />
                                {editingAssessment ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Grading System Modal */}
            {showGradingModal && (
                <>
                    <div className="modal-overlay" onClick={() => setShowGradingModal(false)} />
                    <div className="modal" style={{ maxWidth: '600px' }}>
                        {/* Modern Header */}
                        <div style={{
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: 'white',
                            padding: '1.5rem',
                            borderRadius: '1rem 1rem 0 0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    padding: '0.625rem',
                                    borderRadius: '0.625rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Award size={22} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                                        {editingGrading ? 'Edit Grading System' : 'Add Grading System'}
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.8125rem', opacity: 0.9, marginTop: '0.125rem' }}>
                                        {editingGrading ? 'Update grading logic parameters' : 'Define a new grading scale'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowGradingModal(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    border: 'none',
                                    color: 'white',
                                    padding: '0.5rem',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Form Content */}
                        <div style={{ padding: '1.75rem' }}>
                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                                    System Name *
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="e.g., 10-Point GPA, Letter Grades"
                                    value={newGrading.name}
                                    onChange={(e) => setNewGrading({ ...newGrading, name: e.target.value })}
                                    onBlur={(e) => {
                                        setNewGrading({ ...newGrading, name: toProperCase(e.target.value) });
                                        e.currentTarget.style.borderColor = '#e5e7eb';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '0.625rem',
                                        border: '2px solid #e5e7eb',
                                        fontSize: '0.9375rem',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#6366f1';
                                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                                    }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                                    Grading Type *
                                </label>
                                <select
                                    className="input-field"
                                    value={newGrading.type}
                                    onChange={(e) => {
                                        const type = e.target.value as 'PERCENTAGE' | 'LETTER' | 'GPA' | 'MARKS';
                                        setNewGrading({
                                            ...newGrading,
                                            type,
                                            ranges: type === 'GPA' ? DEFAULT_GRADING_TEMPLATES.GPA : DEFAULT_GRADING_TEMPLATES.PERCENTAGE
                                        });
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '0.625rem',
                                        border: '2px solid #e5e7eb',
                                        fontSize: '0.9375rem',
                                        background: 'white',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#6366f1';
                                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = '#e5e7eb';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <option value="PERCENTAGE">Percentage (%)</option>
                                    <option value="LETTER">Letter Grades (A, B, C...)</option>
                                    <option value="GPA">Grade Point Average (GPA)</option>
                                    <option value="MARKS">Marks Based</option>
                                </select>
                            </div>

                            {/* Range Editor Section */}
                            <div style={{ marginTop: '2rem' }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '1rem'
                                }}>
                                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                        Grade Ranges
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const ranges = [...(newGrading.ranges || [])];
                                            ranges.push({ min: 0, max: 0, grade: '', description: '' });
                                            setNewGrading({ ...newGrading, ranges });
                                        }}
                                        style={{
                                            padding: '0.4rem 0.75rem',
                                            borderRadius: '0.5rem',
                                            border: '1px solid #6366f1',
                                            background: '#6366f110',
                                            color: '#6366f1',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem'
                                        }}
                                    >
                                        <Plus size={14} /> Add Range
                                    </button>
                                </div>

                                <div style={{
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '0.75rem',
                                    overflow: 'hidden'
                                }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                        <thead>
                                            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Grade</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Min%</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Max%</th>
                                                {newGrading.type === 'GPA' && <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Points</th>}
                                                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Description</th>
                                                <th style={{ padding: '0.75rem', width: '40px' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {newGrading.ranges?.sort((a, b) => b.min - a.min).map((range, idx) => (
                                                <tr key={idx} style={{ borderBottom: idx === (newGrading.ranges?.length || 0) - 1 ? 'none' : '1px solid #e5e7eb' }}>
                                                    <td style={{ padding: '0.5rem' }}>
                                                        <input
                                                            type="text"
                                                            value={range.grade}
                                                            onChange={(e) => {
                                                                const ranges = [...(newGrading.ranges || [])];
                                                                ranges[idx].grade = e.target.value.toUpperCase();
                                                                setNewGrading({ ...newGrading, ranges });
                                                            }}
                                                            style={{ width: '100%', padding: '0.4rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '0.5rem' }}>
                                                        <input
                                                            type="number"
                                                            value={range.min}
                                                            onChange={(e) => {
                                                                const ranges = [...(newGrading.ranges || [])];
                                                                ranges[idx].min = parseFloat(e.target.value) || 0;
                                                                setNewGrading({ ...newGrading, ranges });
                                                            }}
                                                            style={{ width: '100%', padding: '0.4rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '0.5rem' }}>
                                                        <input
                                                            type="number"
                                                            value={range.max}
                                                            onChange={(e) => {
                                                                const ranges = [...(newGrading.ranges || [])];
                                                                ranges[idx].max = parseFloat(e.target.value) || 0;
                                                                setNewGrading({ ...newGrading, ranges });
                                                            }}
                                                            style={{ width: '100%', padding: '0.4rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}
                                                        />
                                                    </td>
                                                    {newGrading.type === 'GPA' && (
                                                        <td style={{ padding: '0.5rem' }}>
                                                            <input
                                                                type="number"
                                                                value={range.gradePoint || 0}
                                                                onChange={(e) => {
                                                                    const ranges = [...(newGrading.ranges || [])];
                                                                    ranges[idx].gradePoint = parseFloat(e.target.value) || 0;
                                                                    setNewGrading({ ...newGrading, ranges });
                                                                }}
                                                                style={{ width: '100%', padding: '0.4rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}
                                                            />
                                                        </td>
                                                    )}
                                                    <td style={{ padding: '0.5rem' }}>
                                                        <input
                                                            type="text"
                                                            value={range.description}
                                                            onChange={(e) => {
                                                                const ranges = [...(newGrading.ranges || [])];
                                                                ranges[idx].description = e.target.value;
                                                                setNewGrading({ ...newGrading, ranges });
                                                            }}
                                                            style={{ width: '100%', padding: '0.4rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '0.5rem' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const ranges = (newGrading.ranges || []).filter((_, i) => i !== idx);
                                                                setNewGrading({ ...newGrading, ranges });
                                                            }}
                                                            style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            borderTop: '1px solid #e5e7eb',
                            display: 'flex',
                            gap: '0.75rem',
                            justifyContent: 'flex-end'
                        }}>
                            <button
                                onClick={() => setShowGradingModal(false)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '0.625rem',
                                    border: '2px solid #e5e7eb',
                                    background: 'white',
                                    color: '#6b7280',
                                    fontWeight: 600,
                                    fontSize: '0.9375rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f9fafb';
                                    e.currentTarget.style.borderColor = '#d1d5db';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'white';
                                    e.currentTarget.style.borderColor = '#e5e7eb';
                                }}
                            >
                                <X size={18} />
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveGrading}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '0.625rem',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    color: 'white',
                                    fontWeight: 600,
                                    fontSize: '0.9375rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                                }}
                            >
                                <Check size={18} />
                                {editingGrading ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ExamConfiguration;
