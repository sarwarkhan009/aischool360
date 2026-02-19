import React, { useState, useEffect } from 'react';
import {
    Book,
    Plus,
    Trash2,
    Save,
    FileText,
    Download,
    Eye,
    ChevronRight,
    Search,
    Edit3
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';
import { sortClasses } from '../../constants/app';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface SyllabusTopic {
    id: string;
    title: string;
    description: string;
    isCompleted: boolean;
    weightage?: number;
}

interface ExamSyllabus {
    id: string;
    schoolId: string;
    examId: string;
    examName: string;
    classId: string;
    subjectId: string;
    subjectName: string;
    topics: SyllabusTopic[];
    instructions: string;
    attachments: string[];
    createdAt: string;
    updatedAt: string;
}

interface AcademicSubject {
    name: string;
    chaptersPerClass: { [className: string]: string[] };
    enabledFor: string[];
}

const SyllabusManager: React.FC = () => {
    const { currentSchool } = useSchool();
    const { data: exams } = useFirestore<any>('exams');
    const { data: syllabuses, add: addDocument, update, remove: deleteDocument } = useFirestore<ExamSyllabus>('exam_syllabus');
    const { data: allSettings } = useFirestore<any>('settings');

    const activeClasses = getActiveClasses(
        allSettings?.filter((d: any) => d.type === 'class') || [],
        currentSchool?.activeFinancialYear
    );

    const [selectedExamId, setSelectedExamId] = useState<string>('');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
    const [academicSubjects, setAcademicSubjects] = useState<AcademicSubject[]>([]);

    const [syllabusState, setSyllabusState] = useState<{
        topics: SyllabusTopic[],
        instructions: string
    }>({
        topics: [],
        instructions: ''
    });

    const [isSaving, setIsSaving] = useState(false);

    // Helper to get class name from ID/Slug
    const getClassName = (classId: string) => {
        if (!classId) return '';
        const cls = activeClasses.find((c: any) => c.id === classId || c.name === classId);
        return cls?.name || classId;
    };

    const schoolExams = exams?.filter((e: any) => e.schoolId === currentSchool?.id) || [];
    const selectedExam = schoolExams.find((e: any) => e.id === selectedExamId);
    const availableClasses = selectedExam?.targetClasses || [];
    const availableSubjects = selectedExam?.subjects || [];

    const existingSyllabus = syllabuses?.find(s =>
        s.examId === selectedExamId &&
        s.classId === selectedClass &&
        s.subjectId === selectedSubjectId
    );

    // Sync from Firestore to Local State
    useEffect(() => {
        if (existingSyllabus) {
            setSyllabusState({
                topics: existingSyllabus.topics || [],
                instructions: existingSyllabus.instructions || ''
            });
        } else {
            setSyllabusState({
                topics: [],
                instructions: ''
            });
        }
    }, [existingSyllabus]);

    // Load academic structure data
    useEffect(() => {
        const loadAcademicData = async () => {
            if (!currentSchool?.id) return;
            try {
                const docRef = doc(db, 'settings', `academic_structure_${currentSchool.id}`);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.subjects) {
                        setAcademicSubjects(data.subjects);
                    }
                }
            } catch (error) {
                console.error('Error loading academic data:', error);
            }
        };
        loadAcademicData();
    }, [currentSchool?.id]);

    // Auto-populate chapters when subject is selected if topics are empty
    useEffect(() => {
        if (selectedSubjectId && selectedClass && academicSubjects.length > 0 && syllabusState.topics.length === 0) {
            const subjectDetails = availableSubjects.find((s: any) => s.subjectId === selectedSubjectId);
            if (!subjectDetails) return;

            const className = getClassName(selectedClass);

            // Try matching by name (trimmed and lowercased)
            const academicSubject = academicSubjects.find(
                (s: AcademicSubject) => s.name.trim().toLowerCase() === subjectDetails.subjectName.trim().toLowerCase()
            );

            if (academicSubject && academicSubject.chaptersPerClass[className]) {
                const chapters = academicSubject.chaptersPerClass[className];
                if (chapters.length > 0) {
                    const autoTopics: SyllabusTopic[] = chapters.map((chapterName) => ({
                        id: Math.random().toString(36).substr(2, 9),
                        title: chapterName,
                        description: '',
                        isCompleted: false
                    }));

                    setSyllabusState(prev => ({ ...prev, topics: autoTopics }));
                }
            }
        }
    }, [selectedSubjectId, selectedClass, academicSubjects, syllabusState.topics.length, availableSubjects]);

    const handleAddTopic = () => {
        setSyllabusState(prev => ({
            ...prev,
            topics: [...prev.topics, {
                id: Math.random().toString(36).substr(2, 9),
                title: '',
                description: '',
                isCompleted: false
            }]
        }));
    };

    const handleTopicChange = (id: string, field: keyof SyllabusTopic, value: any) => {
        setSyllabusState(prev => ({
            ...prev,
            topics: prev.topics.map(t => t.id === id ? { ...t, [field]: value } : t)
        }));
    };

    const handleRemoveTopic = (id: string) => {
        setSyllabusState(prev => ({
            ...prev,
            topics: prev.topics.filter(t => t.id !== id)
        }));
    };

    const handleSaveSyllabus = async () => {
        if (!selectedExamId || !selectedClass || !selectedSubjectId) {
            alert('Please select all required fields');
            return;
        }

        setIsSaving(true);
        try {
            const data = {
                topics: syllabusState.topics,
                instructions: syllabusState.instructions,
                schoolId: currentSchool?.id,
                examId: selectedExamId,
                examName: selectedExam?.name || '',
                classId: selectedClass,
                subjectId: selectedSubjectId,
                subjectName: availableSubjects.find((s: any) => s.subjectId === selectedSubjectId)?.subjectName || '',
                updatedAt: new Date().toISOString(),
                createdAt: existingSyllabus?.createdAt || new Date().toISOString()
            } as ExamSyllabus;

            if (existingSyllabus) {
                await update(existingSyllabus.id, data);
            } else {
                await addDocument(data);
            }
            alert('✅ Syllabus saved successfully!');
        } catch (error) {
            console.error('Error saving syllabus:', error);
            alert('❌ Failed to save syllabus');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="page-container" style={{ background: 'var(--bg-main)', minHeight: '100vh', padding: '1.5rem 2rem' }}>
            <div className="page-header" style={{
                marginBottom: '2.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'white',
                padding: '1.5rem 2rem',
                borderRadius: '1.5rem',
                boxShadow: '0 4px 20px -5px rgba(0,0,0,0.05)',
                border: '1px solid var(--border)'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                        <div style={{ background: 'var(--primary)', padding: '0.5rem', borderRadius: '0.75rem', color: 'white' }}>
                            <Book size={24} />
                        </div>
                        <h1 className="page-title" style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>Syllabus Manager</h1>
                    </div>
                    <p className="page-subtitle" style={{ color: 'var(--text-muted)', margin: 0 }}>Define, track, and publish examination syllabus</p>
                </div>
                {selectedExamId && selectedClass && selectedSubjectId && (
                    <button
                        onClick={handleSaveSyllabus}
                        disabled={isSaving}
                        className="btn"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.625rem',
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: 'white',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '1rem',
                            fontWeight: 700,
                            border: 'none',
                            boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.4)',
                            transition: 'all 0.3s ease',
                            cursor: isSaving ? 'not-allowed' : 'pointer'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 12px 20px -3px rgba(79, 70, 229, 0.5)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(79, 70, 229, 0.4)'; }}
                    >
                        <Save size={20} />
                        {isSaving ? 'Saving...' : 'Save Syllabus'}
                    </button>
                )}
            </div>

            {/* Selection filters */}
            <div className="card glass-card" style={{
                padding: '2rem',
                marginBottom: '2rem',
                borderRadius: '1.5rem',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.75rem', display: 'block' }}>Select Exam</label>
                        <select
                            className="input-field"
                            style={{ borderRadius: '1rem', padding: '0.875rem 1rem', border: '1px solid var(--border)', background: 'white', fontWeight: 600 }}
                            value={selectedExamId}
                            onChange={e => { setSelectedExamId(e.target.value); setSelectedClass(''); setSelectedSubjectId(''); }}
                        >
                            <option value="">Choose Exam</option>
                            {schoolExams.map(e => (
                                <option key={e.id} value={e.id}>
                                    {e.name}{e.displayName && e.displayName !== e.name ? ` (Print: ${e.displayName})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.75rem', display: 'block' }}>Select Class</label>
                        <select
                            className="input-field"
                            style={{ borderRadius: '1rem', padding: '0.875rem 1rem', border: '1px solid var(--border)', background: 'white', fontWeight: 600 }}
                            value={selectedClass}
                            onChange={e => { setSelectedClass(e.target.value); setSelectedSubjectId(''); }}
                            disabled={!selectedExamId}
                        >
                            <option value="">Choose Class</option>
                            {availableClasses.map((clsId: string) => <option key={clsId} value={clsId}>{getClassName(clsId)}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.75rem', display: 'block' }}>Select Subject</label>
                        <select
                            className="input-field"
                            style={{ borderRadius: '1rem', padding: '0.875rem 1rem', border: '1px solid var(--border)', background: 'white', fontWeight: 600 }}
                            value={selectedSubjectId}
                            onChange={e => setSelectedSubjectId(e.target.value)}
                            disabled={!selectedClass}
                        >
                            <option value="">Choose Subject</option>
                            {availableSubjects.map((s: any) => <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {selectedExamId && selectedClass && selectedSubjectId ? (
                <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
                    <div className="card" style={{
                        padding: '2.5rem',
                        borderRadius: '2rem',
                        background: 'white',
                        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
                        border: '1px solid var(--border)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>Syllabus Content</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{syllabusState.topics.length} Topics Added</span>
                                    {existingSyllabus && (
                                        <span style={{
                                            fontSize: '0.75rem',
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            color: '#10b981',
                                            padding: '0.25rem 0.6rem',
                                            borderRadius: '0.5rem',
                                            fontWeight: 700
                                        }}>Saved</span>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button
                                    onClick={() => {
                                        if (window.confirm('This will clear current topics and reload from Settings. Continue?')) {
                                            setSyllabusState(prev => ({ ...prev, topics: [] }));
                                        }
                                    }}
                                    className="btn"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        background: 'rgba(239, 68, 68, 0.05)',
                                        color: '#ef4444',
                                        padding: '0.625rem 1.25rem',
                                        borderRadius: '0.875rem',
                                        fontWeight: 700,
                                        border: '1px solid rgba(239, 68, 68, 0.1)',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    Reset
                                </button>
                                <button
                                    onClick={handleAddTopic}
                                    className="btn"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        background: 'rgba(99, 102, 241, 0.1)',
                                        color: 'var(--primary)',
                                        padding: '0.625rem 1.25rem',
                                        borderRadius: '0.875rem',
                                        fontWeight: 700,
                                        border: '1px solid rgba(99, 102, 241, 0.2)',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; e.currentTarget.style.color = 'var(--primary)'; }}
                                >
                                    <Plus size={18} />
                                    Add Topic
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '3rem' }}>
                            {syllabusState.topics.map((topic, index) => (
                                <div
                                    key={topic.id}
                                    className="topic-card"
                                    style={{
                                        background: 'var(--bg-main)',
                                        borderRadius: '1.25rem',
                                        padding: '1.5rem',
                                        border: '1px solid var(--border)',
                                        transition: 'all 0.3s ease',
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.25rem' }}>
                                        <div style={{
                                            background: 'white',
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '10px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 800,
                                            fontSize: '0.875rem',
                                            color: 'var(--primary)',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                            flexShrink: 0
                                        }}>
                                            {index + 1}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <input
                                                type="text"
                                                className="input-field"
                                                style={{
                                                    width: '100%',
                                                    border: 'none',
                                                    background: 'transparent',
                                                    padding: '0 0 0.5rem 0',
                                                    borderRadius: 0,
                                                    borderBottom: '2px solid rgba(0,0,0,0.05)',
                                                    fontWeight: 700,
                                                    fontSize: '1.25rem',
                                                    color: 'var(--text-main)',
                                                    outline: 'none',
                                                    transition: 'border-color 0.2s'
                                                }}
                                                placeholder="Topic Title (Chapter Name...)"
                                                value={topic.title}
                                                onChange={e => handleTopicChange(topic.id, 'title', e.target.value)}
                                                onFocus={(e) => e.target.style.borderBottomColor = 'var(--primary)'}
                                                onBlur={(e) => e.target.style.borderBottomColor = 'rgba(0,0,0,0.05)'}
                                            />
                                        </div>
                                        <button
                                            onClick={() => handleRemoveTopic(topic.id)}
                                            style={{
                                                color: '#ef4444',
                                                border: 'none',
                                                background: 'white',
                                                cursor: 'pointer',
                                                padding: '0.5rem',
                                                borderRadius: '0.75rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#ef4444'; }}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                    <textarea
                                        className="input-field"
                                        style={{
                                            resize: 'none',
                                            borderRadius: '1rem',
                                            padding: '1rem',
                                            background: 'white',
                                            border: '1px solid var(--border)',
                                            fontSize: '0.95rem',
                                            lineHeight: 1.5
                                        }}
                                        rows={3}
                                        placeholder="Add details, sub-topics, or focus areas..."
                                        value={topic.description}
                                        onChange={e => handleTopicChange(topic.id, 'description', e.target.value)}
                                    />
                                </div>
                            ))}

                            {syllabusState.topics.length === 0 && (
                                <div style={{
                                    padding: '5rem 3rem',
                                    textAlign: 'center',
                                    background: 'var(--bg-main)',
                                    borderRadius: '2rem',
                                    border: '3px dashed var(--border)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center'
                                }}>
                                    <div style={{
                                        width: '80px',
                                        height: '80px',
                                        borderRadius: '50%',
                                        background: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: '1.5rem',
                                        color: 'var(--text-muted)'
                                    }}>
                                        <Book size={40} />
                                    </div>
                                    <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 800 }}>No Subjects Defined</h4>
                                    <p style={{ color: 'var(--text-muted)', margin: 0, maxWidth: '300px' }}>
                                        Click 'Add Topic' or wait for auto-population to begin defining the syllabus.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div style={{
                            marginTop: '2rem',
                            padding: '2rem',
                            background: 'var(--bg-main)',
                            borderRadius: '1.5rem',
                            border: '1px solid var(--border)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                <FileText size={20} color="var(--primary)" />
                                <h4 style={{ fontWeight: 800, margin: 0, fontSize: '1.1rem' }}>Special Instructions</h4>
                            </div>
                            <textarea
                                className="input-field"
                                rows={4}
                                style={{
                                    borderRadius: '1rem',
                                    padding: '1rem',
                                    background: 'white',
                                    border: '1px solid var(--border)',
                                    resize: 'none',
                                    fontSize: '0.95rem'
                                }}
                                placeholder="Any general instructions for students, parents, or teachers regarding this subject syllabus..."
                                value={syllabusState.instructions}
                                onChange={e => setSyllabusState(prev => ({ ...prev, instructions: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card glass-card" style={{
                    padding: '6rem 4rem',
                    textAlign: 'center',
                    borderRadius: '2rem',
                    background: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}>
                    <div style={{
                        width: '100px',
                        height: '100px',
                        borderRadius: '32px',
                        background: 'rgba(99, 102, 241, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)',
                        marginBottom: '2rem',
                        transform: 'rotate(-5deg)'
                    }}>
                        <Edit3 size={48} />
                    </div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.75rem' }}>Ready to Configure Syllabus?</h3>
                    <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: 0, fontSize: '1.05rem', lineHeight: 1.6 }}>
                        Select an <strong>Exam</strong>, <strong>Class</strong>, and <strong>Subject</strong> to begin defining or managing the examination syllabus.
                    </p>
                </div>
            )}
        </div>
    );
};

export default SyllabusManager;
