import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, Plus, X, Check, GraduationCap, List, Save, Trash2, Search, ImagePlus, Loader2, FileText, AlertCircle, CheckCircle2, Upload, ChevronDown, ChevronUp } from 'lucide-react';
import { useFirestore } from '../hooks/useFirestore';
import { usePersistence } from '../hooks/usePersistence';
import { db } from '../lib/firebase';
import { doc, setDoc, getDoc, collection, addDoc, getDocs, query, orderBy, deleteDoc } from 'firebase/firestore';
import { sortClasses, getActiveClasses } from '../constants/app';
import { useSchool } from '../context/SchoolContext';
import { useAuth } from '../context/AuthContext';
import { seedSubjectList } from '../lib/dbSeeder';
import { extractQuestionsFromImage } from '../lib/gemini';

interface Subject {
    name: string;
    chaptersPerClass: { [className: string]: string[] }; // Chapters organized by class
    enabledFor: string[]; // List of class names this subject is enabled for
}

interface ClassData {
    name: string;
}

interface AcademicDataManagerProps {
    onDataChange?: () => void; // Callback when data is saved
}

const AcademicDataManager: React.FC<AcademicDataManagerProps> = ({ onDataChange }) => {
    const { currentSchool } = useSchool();
    const { user } = useAuth();
    const isTeacher = user?.role === 'TEACHER';
    const { data: allSettings } = useFirestore<any>('settings');

    const [activeTab, setActiveTab] = useState<'subjects' | 'chapters' | 'routine' | 'questionbank'>(isTeacher ? 'chapters' : 'subjects');
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [classes, setClasses] = useState<ClassData[]>([]);

    // Chapter management
    const [selectedClassForChapter, setSelectedClassForChapter] = useState('');
    const [selectedSubjectForChapter, setSelectedSubjectForChapter] = useState('');
    const [newChapterName, setNewChapterName] = useState('');
    const [bulkChapterMode, setBulkChapterMode] = useState(false);
    const [bulkChapterText, setBulkChapterText] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSeeding, setIsSeeding] = useState(false);

    // Load classes from Class & Section Master
    useEffect(() => {
        if (!allSettings) return;
        const rawClassSettings = allSettings.filter((d: any) => d.type === 'class');
        const activeClasses = getActiveClasses(rawClassSettings, currentSchool?.activeFinancialYear);
        setClasses(activeClasses.map((c: any) => ({ name: c.name })));
    }, [allSettings, currentSchool?.activeFinancialYear]);

    // Load existing academic data
    useEffect(() => {
        loadAcademicData();
    }, [currentSchool?.id]);

    const loadAcademicData = async () => {
        if (!currentSchool?.id) return;
        try {
            const docRef = doc(db, 'settings', `academic_structure_${currentSchool.id}`);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.subjects) {
                    // Migrate old data format to new format if needed
                    const migratedSubjects = data.subjects.map((subject: any) => {
                        // Check if subject has old format (chapters array) instead of new format (chaptersPerClass object)
                        if (subject.chapters && Array.isArray(subject.chapters)) {
                            console.log(`[Migration] Converting subject "${subject.name}" from old format to new format`);

                            // Create chaptersPerClass object from old chapters array
                            // Assign the same chapters to all enabled classes
                            const chaptersPerClass: { [className: string]: string[] } = {};
                            subject.enabledFor.forEach((className: string) => {
                                chaptersPerClass[className] = [...subject.chapters];
                            });

                            return {
                                name: subject.name,
                                chaptersPerClass,
                                enabledFor: subject.enabledFor
                            };
                        }

                        // Already in new format
                        return subject;
                    });

                    setSubjects(migratedSubjects);
                }
            }
        } catch (error) {
            console.error('Error loading academic data:', error);
        }
    };

    const saveAcademicData = async () => {
        if (!currentSchool?.id) return;
        setIsSaving(true);
        try {
            const docRef = doc(db, 'settings', `academic_structure_${currentSchool.id}`);
            await setDoc(docRef, {
                subjects,
                schoolId: currentSchool.id,
                updatedAt: new Date().toISOString()
            });
            alert('Academic data saved successfully!');
            if (onDataChange) onDataChange();
        } catch (error) {
            console.error('Error saving academic data:', error);
            alert('Failed to save data');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSeedSubjects = async () => {
        if (!currentSchool?.id) return;
        if (!confirm('Seed the master list of subjects for all active classes? This will merge with existing data.')) return;

        setIsSeeding(true);
        try {
            await seedSubjectList(currentSchool.id);
            await loadAcademicData(); // Reload
            alert('✅ Subject master list seeded successfully!');
        } catch (error) {
            console.error('Error seeding subjects:', error);
            alert('Failed to seed subjects: ' + (error as Error).message);
        } finally {
            setIsSeeding(false);
        }
    };

    const handleToggleSubjectForClass = (subjectName: string, className: string) => {
        setSubjects(subjects.map(s => {
            if (s.name === subjectName) {
                const isEnabled = s.enabledFor.includes(className);
                const updatedEnabledFor = isEnabled
                    ? s.enabledFor.filter(c => c !== className)
                    : [...s.enabledFor, className];

                const updatedChaptersPerClass = { ...s.chaptersPerClass };
                if (!isEnabled && !updatedChaptersPerClass[className]) {
                    updatedChaptersPerClass[className] = [];
                }

                return {
                    ...s,
                    enabledFor: updatedEnabledFor,
                    chaptersPerClass: updatedChaptersPerClass
                };
            }
            return s;
        }));
    };

    const handleRemoveSubject = (subjectName: string) => {
        if (confirm(`Remove subject "${subjectName}"? This will also remove all its chapters across all classes.`)) {
            setSubjects(subjects.filter(s => s.name !== subjectName));
        }
    };

    const handleToggleAllClasses = (subjectName: string) => {
        setSubjects(subjects.map(s => {
            if (s.name === subjectName) {
                const isAllSelected = s.enabledFor.length === classes.length;
                return {
                    ...s,
                    enabledFor: isAllSelected ? [] : classes.map(c => c.name)
                };
            }
            return s;
        }));
    };

    const handleRenameSubject = (oldName: string) => {
        const newName = prompt('Enter new name for subject:', oldName);
        if (newName && newName.trim() && newName.trim() !== oldName) {
            if (subjects.find(s => s.name.toLowerCase() === newName.trim().toLowerCase())) {
                alert('A subject with this name already exists');
                return;
            }
            setSubjects(subjects.map(s =>
                s.name === oldName ? { ...s, name: newName.trim() } : s
            ));
        }
    };

    const handleAddChapter = () => {
        if (!selectedClassForChapter || !selectedSubjectForChapter) {
            alert('Please select class and subject');
            return;
        }
        if (!newChapterName.trim()) {
            alert('Please enter chapter name');
            return;
        }

        setSubjects(subjects.map(s => {
            if (s.name === selectedSubjectForChapter) {
                const classChapters = s.chaptersPerClass[selectedClassForChapter] || [];
                // Add chapter if it doesn't already exist for this class
                if (!classChapters.includes(newChapterName.trim())) {
                    return {
                        ...s,
                        chaptersPerClass: {
                            ...s.chaptersPerClass,
                            [selectedClassForChapter]: [...classChapters, newChapterName.trim()]
                        }
                    };
                }
            }
            return s;
        }));

        setNewChapterName('');
    };

    const handleBulkAddChapters = () => {
        if (!selectedClassForChapter || !selectedSubjectForChapter) {
            alert('Please select class and subject');
            return;
        }
        if (!bulkChapterText.trim()) {
            alert('Please enter chapter names (one per line)');
            return;
        }

        // Parse the bulk text - split by newlines and filter out empty lines
        const chapterNames = bulkChapterText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (chapterNames.length === 0) {
            alert('No valid chapter names found');
            return;
        }

        setSubjects(subjects.map(s => {
            if (s.name === selectedSubjectForChapter) {
                const classChapters = s.chaptersPerClass[selectedClassForChapter] || [];
                // Add chapters that don't already exist for this class
                const newChapters = chapterNames.filter(name => !classChapters.includes(name));
                return {
                    ...s,
                    chaptersPerClass: {
                        ...s.chaptersPerClass,
                        [selectedClassForChapter]: [...classChapters, ...newChapters]
                    }
                };
            }
            return s;
        }));

        setBulkChapterText('');
        alert(`✅ ${chapterNames.length} chapter(s) added successfully!`);
    };

    const handleRemoveChapter = (subjectName: string, className: string, chapterName: string) => {
        setSubjects(subjects.map(s => {
            if (s.name === subjectName) {
                const classChapters = s.chaptersPerClass[className] || [];
                return {
                    ...s,
                    chaptersPerClass: {
                        ...s.chaptersPerClass,
                        [className]: classChapters.filter(c => c !== chapterName)
                    }
                };
            }
            return s;
        }));
    };

    // Get subjects available for selected class
    const getSubjectsForClass = (className: string) => {
        return subjects
            .filter(s => s.enabledFor.includes(className))
            .sort((a, b) => a.name.localeCompare(b.name));
    };

    const filteredSubjects = subjects
        .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div style={{ paddingBottom: '1rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: '0.15rem' }}>
                        Academic Structure Manager
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>
                        Manage subjects and chapters
                    </p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={saveAcademicData}
                    disabled={isSaving}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', padding: '0.5rem 0.875rem', whiteSpace: 'nowrap' }}
                >
                    <Save size={15} /> {isSaving ? 'Saving...' : 'Save'}
                </button>
            </div>

            {/* Info Card - compact */}
            <div style={{ padding: '0.5rem 0.875rem', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '0.625rem', marginBottom: '0.875rem', border: '1px solid rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GraduationCap size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <strong style={{ color: 'var(--primary)' }}>{classes.length} classes</strong> auto-loaded from Class &amp; Section Master.
                </p>
            </div>

            <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.875rem', borderBottom: '2px solid var(--border)' }}>
                {!isTeacher && (
                    <button
                        className={activeTab === 'subjects' ? 'btn btn-primary' : 'btn'}
                        onClick={() => setActiveTab('subjects')}
                        style={{ borderRadius: '0.5rem 0.5rem 0 0', border: 'none', borderBottom: activeTab === 'subjects' ? '2px solid var(--primary)' : 'none', fontSize: '0.8rem', padding: '0.45rem 0.7rem' }}
                    >
                        <BookOpen size={14} style={{ marginRight: '0.3rem' }} />
                        Subjects
                    </button>
                )}
                <button
                    className={activeTab === 'chapters' ? 'btn btn-primary' : 'btn'}
                    onClick={() => setActiveTab('chapters')}
                    style={{ borderRadius: '0.5rem 0.5rem 0 0', border: 'none', borderBottom: activeTab === 'chapters' ? '2px solid var(--primary)' : 'none', fontSize: '0.8rem', padding: '0.45rem 0.7rem' }}
                >
                    <List size={14} style={{ marginRight: '0.3rem' }} />
                    Chapters
                </button>
                <button
                    className={activeTab === 'questionbank' ? 'btn btn-primary' : 'btn'}
                    onClick={() => setActiveTab('questionbank')}
                    style={{ borderRadius: '0.5rem 0.5rem 0 0', border: 'none', borderBottom: activeTab === 'questionbank' ? '2px solid var(--primary)' : 'none', background: activeTab === 'questionbank' ? 'var(--primary)' : 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.1))', color: activeTab === 'questionbank' ? 'white' : '#059669', fontWeight: 700, fontSize: '0.8rem', padding: '0.45rem 0.7rem' }}
                >
                    <ImagePlus size={14} style={{ marginRight: '0.3rem' }} />
                    Question Bank
                </button>
            </div>

            {/* Subjects Tab */}
            {
                activeTab === 'subjects' && (
                    <div>
                        {/* Redesigned Subjects Mapping Area */}
                        <div style={{ display: 'grid', gap: '2rem' }}>
                            {/* Control Bar */}
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Search subjects..."
                                        style={{ paddingLeft: '2.75rem' }}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button
                                        className="btn"
                                        onClick={handleSeedSubjects}
                                        disabled={isSeeding || isSaving}
                                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--primary)', color: 'var(--primary)', fontWeight: 700 }}
                                    >
                                        {isSeeding ? 'Seeding...' : '🌱 Seed Master List'}
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => {
                                            const name = prompt('Enter new subject name:');
                                            if (name && name.trim()) {
                                                if (subjects.find(s => s.name.toLowerCase() === name.trim().toLowerCase())) {
                                                    alert('Subject already exists');
                                                    return;
                                                }
                                                setSubjects([...subjects, {
                                                    name: name.trim(),
                                                    enabledFor: classes.map(c => c.name),
                                                    chaptersPerClass: {}
                                                }]);
                                            }
                                        }}
                                    >
                                        <Plus size={18} /> Add Subject
                                    </button>
                                </div>
                            </div>

                            {/* Subject-Class Matrix */}
                            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                                            <tr>
                                                <th style={{ padding: '1rem', fontSize: '0.875rem', fontWeight: 800, position: 'sticky', left: 0, background: 'var(--bg-secondary)', zIndex: 10, minWidth: '200px' }}>Subject Name</th>
                                                <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 800, textAlign: 'center', minWidth: '80px', color: 'var(--primary)' }}>Toggle All</th>
                                                {classes.map(cls => (
                                                    <th key={cls.name} style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 800, textAlign: 'center', minWidth: '80px', whiteSpace: 'nowrap' }}>
                                                        {cls.name}
                                                    </th>
                                                ))}
                                                <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredSubjects.length === 0 ? (
                                                <tr>
                                                    <td colSpan={classes.length + 2} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                        {searchTerm ? 'No subjects found matching your search.' : 'No subjects added yet. Start by seeding or adding a subject.'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredSubjects.map((subject) => (
                                                    <tr key={subject.name} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover-row">
                                                        <td style={{ padding: '1rem', fontWeight: 700, fontSize: '0.9rem', position: 'sticky', left: 0, background: 'white', zIndex: 5, borderRight: '1px solid var(--border)' }}>
                                                            {subject.name}
                                                        </td>
                                                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                            <div
                                                                onClick={() => handleToggleAllClasses(subject.name)}
                                                                style={{
                                                                    width: '28px',
                                                                    height: '28px',
                                                                    borderRadius: '8px',
                                                                    margin: '0 auto',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    transition: 'all 0.2s',
                                                                    background: subject.enabledFor.length === classes.length ? 'var(--primary)' : subject.enabledFor.length > 0 ? 'rgba(99, 102, 241, 0.4)' : '#f1f5f9',
                                                                    color: 'white',
                                                                    boxShadow: subject.enabledFor.length > 0 ? '0 2px 4px rgba(99, 102, 241, 0.2)' : 'none'
                                                                }}
                                                                title={subject.enabledFor.length === classes.length ? 'Deselect All Classes' : 'Select All Classes'}
                                                            >
                                                                {subject.enabledFor.length === classes.length ? <Check size={18} /> : subject.enabledFor.length > 0 ? <Plus size={16} /> : <X size={16} style={{ color: '#94a3b8' }} />}
                                                            </div>
                                                        </td>
                                                        {classes.map(cls => (
                                                            <td key={cls.name} style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                                <div
                                                                    onClick={() => handleToggleSubjectForClass(subject.name, cls.name)}
                                                                    style={{
                                                                        width: '24px',
                                                                        height: '24px',
                                                                        borderRadius: '6px',
                                                                        margin: '0 auto',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        transition: 'all 0.2s',
                                                                        background: subject.enabledFor.includes(cls.name) ? 'var(--primary)' : '#f1f5f9',
                                                                        color: 'white',
                                                                        boxShadow: subject.enabledFor.includes(cls.name) ? '0 2px 4px rgba(99, 102, 241, 0.3)' : 'none'
                                                                    }}
                                                                >
                                                                    {subject.enabledFor.includes(cls.name) && <Check size={16} />}
                                                                </div>
                                                            </td>
                                                        ))}
                                                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                            <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                                                <button
                                                                    className="btn btn-ghost"
                                                                    onClick={() => handleRenameSubject(subject.name)}
                                                                    style={{ padding: '0.4rem', color: 'var(--primary)' }}
                                                                    title="Rename Subject"
                                                                >
                                                                    <Plus size={16} style={{ transform: 'rotate(45deg)' }} />
                                                                </button>
                                                                <button
                                                                    className="btn btn-ghost"
                                                                    onClick={() => handleRemoveSubject(subject.name)}
                                                                    style={{ color: '#ef4444', padding: '0.4rem' }}
                                                                    title="Delete Subject"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Summary Info */}
                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <div style={{ width: '12px', height: '12px', background: 'var(--primary)', borderRadius: '3px' }}></div>
                                    Enabled
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <div style={{ width: '12px', height: '12px', background: '#f1f5f9', borderRadius: '3px' }}></div>
                                    Disabled
                                </div>
                                <div style={{ marginLeft: 'auto' }}>
                                    Total Subjects: <strong>{subjects.length}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Chapters Tab */}
            {
                activeTab === 'chapters' && (
                    <div>
                        {/* Add Chapter Section */}
                        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontWeight: 700, margin: 0 }}>Add Chapter</h3>
                                <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: '0.5rem' }}>
                                    <button
                                        type="button"
                                        className={`btn ${!bulkChapterMode ? 'btn-primary' : 'btn-ghost'}`}
                                        onClick={() => setBulkChapterMode(false)}
                                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
                                    >
                                        Single
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn ${bulkChapterMode ? 'btn-primary' : 'btn-ghost'}`}
                                        onClick={() => setBulkChapterMode(true)}
                                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
                                    >
                                        Bulk Paste
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                <div className="input-group">
                                    <label className="field-label">Select Class *</label>
                                    <select
                                        className="input-field"
                                        value={selectedClassForChapter}
                                        onChange={(e) => {
                                            setSelectedClassForChapter(e.target.value);
                                            setSelectedSubjectForChapter('');
                                        }}
                                    >
                                        <option value="">Select Class</option>
                                        {classes.map((cls) => (
                                            <option key={cls.name} value={cls.name}>{cls.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="input-group">
                                    <label className="field-label">Select Subject *</label>
                                    <select
                                        className="input-field"
                                        value={selectedSubjectForChapter}
                                        onChange={(e) => setSelectedSubjectForChapter(e.target.value)}
                                        disabled={!selectedClassForChapter}
                                    >
                                        <option value="">Select Subject</option>
                                        {selectedClassForChapter && getSubjectsForClass(selectedClassForChapter).map((subj) => (
                                            <option key={subj.name} value={subj.name}>{subj.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {!bulkChapterMode ? (
                                // Single chapter mode
                                <>
                                    <div className="input-group" style={{ marginBottom: '1rem' }}>
                                        <label className="field-label">Chapter Name *</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            placeholder="e.g., Chapter 1: Introduction to Algebra"
                                            value={newChapterName}
                                            onChange={(e) => setNewChapterName(e.target.value)}
                                        />
                                    </div>

                                    <button
                                        className="btn btn-primary"
                                        onClick={handleAddChapter}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        <Plus size={18} /> Add Chapter
                                    </button>
                                </>
                            ) : (
                                // Bulk paste mode
                                <>
                                    <div className="input-group" style={{ marginBottom: '1rem' }}>
                                        <label className="field-label">Paste Chapter Names (One per line) *</label>
                                        <textarea
                                            className="input-field"
                                            placeholder={`Chapter 1: Chemical Reactions
Chapter 2: Acids and Bases
Chapter 3: Metals and Non-metals
Chapter 4: Carbon and its Compounds`}
                                            value={bulkChapterText}
                                            onChange={(e) => setBulkChapterText(e.target.value)}
                                            rows={8}
                                            style={{ fontFamily: 'monospace', resize: 'vertical' }}
                                        />
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                            💡 Tip: Paste chapter names from your document. Each line will be added as a separate chapter.
                                        </div>
                                    </div>

                                    <button
                                        className="btn btn-primary"
                                        onClick={handleBulkAddChapters}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        <Plus size={18} /> Add All Chapters
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Chapters List */}
                        <div className="glass-card" style={{ padding: '1rem' }}>
                            <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Existing Chapters</h3>

                            {subjects.filter(s => Object.values(s.chaptersPerClass).flat().length > 0).length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                                    No chapters added yet. Add chapters above after selecting class and subject.
                                </p>
                            ) : (
                                <div style={{ display: 'grid', gap: '2rem' }}>
                                    {subjects.filter(s => Object.values(s.chaptersPerClass).flat().length > 0).sort((a, b) => a.name.localeCompare(b.name)).map((subject) => (
                                        <div key={subject.name}>
                                            <h4 style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: '1rem', color: 'var(--primary)' }}>
                                                📚 {subject.name}
                                            </h4>

                                            {/* Group by class */}
                                            <div style={{ display: 'grid', gap: '1rem' }}>
                                                {Object.entries(subject.chaptersPerClass).map(([className, chapters]) => {
                                                    if (!chapters || chapters.length === 0) return null;

                                                    return (
                                                        <div key={className} style={{
                                                            padding: '1rem',
                                                            background: 'var(--bg-secondary)',
                                                            borderRadius: '0.75rem',
                                                            border: '1px solid var(--border)'
                                                        }}>
                                                            <div style={{
                                                                fontWeight: 600,
                                                                fontSize: '0.875rem',
                                                                color: 'var(--text-main)',
                                                                marginBottom: '0.75rem',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.5rem'
                                                            }}>
                                                                <GraduationCap size={16} />
                                                                {className} ({chapters.length} chapters)
                                                            </div>
                                                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                                                {chapters.map((chapter, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        style={{
                                                                            display: 'flex',
                                                                            justifyContent: 'space-between',
                                                                            alignItems: 'center',
                                                                            padding: '0.625rem 0.75rem',
                                                                            background: 'white',
                                                                            borderRadius: '0.5rem',
                                                                            border: '1px solid var(--border)',
                                                                            fontSize: '0.875rem'
                                                                        }}
                                                                    >
                                                                        <span>{chapter}</span>
                                                                        {!isTeacher && (
                                                                            <button
                                                                                className="btn"
                                                                                onClick={() => handleRemoveChapter(subject.name, className, chapter)}
                                                                                style={{ padding: '0.25rem 0.5rem', background: '#ef4444', color: 'white' }}
                                                                            >
                                                                                <X size={14} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
            {/* Question Bank Tab */}
            {activeTab === 'questionbank' && (
                <QuestionBankTab
                    classes={classes}
                    subjects={subjects}
                    getSubjectsForClass={getSubjectsForClass}
                    schoolId={currentSchool?.id || ''}
                    isTeacher={isTeacher}
                />
            )}
        </div>
    );
};

export default AcademicDataManager;

// Helper: Convert a File to base64 string (without the data URI prefix)
const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Strip the "data:image/...;base64," prefix
            resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

// ─────────────────────────────────────────────
// Question Bank Upload Tab Component
// ─────────────────────────────────────────────

interface UploadedImage {
    id: string;
    file: File;
    preview: string;
    status: 'pending' | 'processing' | 'done' | 'error';
    extractedText: string;
    errorMsg?: string;
}

interface SavedQuestion {
    id: string;
    className: string;
    subjectName: string;
    chapterName: string;
    extractedText: string;
    imageCount: number;
    createdAt: string;
}

interface QuestionBankTabProps {
    classes: ClassData[];
    subjects: Subject[];
    getSubjectsForClass: (className: string) => Subject[];
    schoolId: string;
    isTeacher?: boolean;
}

const QuestionBankTab: React.FC<QuestionBankTabProps> = ({ classes, subjects, getSubjectsForClass, schoolId, isTeacher }) => {
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedChapter, setSelectedChapter] = useState('');
    // Auto-load API key from localStorage (same key as QuestionGenerator)
    const [aiApiKey, setAiApiKey] = usePersistence<string>('aischool360_gemini_api_key', '');
    const [isLoadingApiKey, setIsLoadingApiKey] = useState(true); // start true — wait for Firestore check
    const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [savedQuestions, setSavedQuestions] = useState<SavedQuestion[]>([]);
    const [isLoadingSaved, setIsLoadingSaved] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Always fetch from Firestore to get admin-set API key (teacher won't have it in localStorage)
    useEffect(() => {
        if (schoolId) {
            setIsLoadingApiKey(true);
            getDoc(doc(db, 'settings', `gemini_${schoolId}`))
                .then(d => {
                    if (d.exists() && d.data().apiKey) setAiApiKey(d.data().apiKey);
                })
                .catch(e => console.error('Error fetching Gemini key:', e))
                .finally(() => setIsLoadingApiKey(false));
        } else {
            setIsLoadingApiKey(false);
        }
    }, [schoolId]);

    const availableSubjects = selectedClass ? getSubjectsForClass(selectedClass) : [];
    const availableChapters = selectedClass && selectedSubject
        ? (subjects.find(s => s.name === selectedSubject)?.chaptersPerClass[selectedClass] || [])
        : [];

    // Load saved questions
    const loadSavedQuestions = useCallback(async () => {
        if (!schoolId) return;
        setIsLoadingSaved(true);
        try {
            const colRef = collection(db, `question_bank_${schoolId}`);
            const snap = await getDocs(query(colRef, orderBy('createdAt', 'desc')));
            const items: SavedQuestion[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedQuestion));
            setSavedQuestions(items);
        } catch (e) {
            console.error('Error loading questions:', e);
        } finally {
            setIsLoadingSaved(false);
        }
    }, [schoolId]);

    useEffect(() => { loadSavedQuestions(); }, [loadSavedQuestions]);

    const handleFiles = (files: FileList | File[]) => {
        const fileArr = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (fileArr.length === 0) return;
        const newImages: UploadedImage[] = fileArr.map(f => ({
            id: `${Date.now()}_${Math.random()}`,
            file: f,
            preview: URL.createObjectURL(f),
            status: 'pending',
            extractedText: '',
        }));
        setUploadedImages(prev => [...prev, ...newImages]);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    const removeImage = (id: string) => {
        setUploadedImages(prev => {
            const img = prev.find(i => i.id === id);
            if (img) URL.revokeObjectURL(img.preview);
            return prev.filter(i => i.id !== id);
        });
    };

    const updateExtractedText = (id: string, text: string) => {
        setUploadedImages(prev => prev.map(i => i.id === id ? { ...i, extractedText: text } : i));
    };

    // Always get the latest API key — from state OR fresh Firestore fetch (for teachers)
    const getEffectiveApiKey = async (): Promise<string> => {
        console.log('[QuestionBank] getEffectiveApiKey called');
        console.log('[QuestionBank] schoolId:', schoolId);
        console.log('[QuestionBank] aiApiKey from state:', aiApiKey ? `"${aiApiKey.substring(0, 10)}..."` : '(empty)');
        console.log('[QuestionBank] localStorage aischool360_gemini_api_key:', localStorage.getItem('aischool360_gemini_api_key') ? 'present' : '(empty)');

        if (aiApiKey.trim()) {
            console.log('[QuestionBank] ✅ Using key from state');
            return aiApiKey.trim();
        }
        if (!schoolId) {
            console.warn('[QuestionBank] ❌ schoolId is empty, cannot fetch from Firestore');
            return '';
        }
        try {
            const docPath = `gemini_${schoolId}`;
            console.log('[QuestionBank] Fetching from Firestore path: settings/' + docPath);
            const d = await getDoc(doc(db, 'settings', docPath));
            console.log('[QuestionBank] Firestore doc exists:', d.exists());
            if (d.exists()) {
                console.log('[QuestionBank] Firestore doc data keys:', Object.keys(d.data()));
                console.log('[QuestionBank] apiKey in doc:', d.data().apiKey ? 'present' : 'MISSING');
            }
            if (d.exists() && d.data().apiKey) {
                const key = d.data().apiKey as string;
                setAiApiKey(key);
                console.log('[QuestionBank] ✅ Got key from Firestore');
                return key;
            }
        } catch (e) {
            console.error('[QuestionBank] ❌ Firestore fetch error:', e);
        }
        console.warn('[QuestionBank] ❌ No API key found anywhere');
        return '';
    };

    const extractFromImage = async (img: UploadedImage) => {
        const key = await getEffectiveApiKey();
        if (!key) {
            alert('Gemini API key not found. Please ask admin to set it in Settings → API Keys.');
            return;
        }
        setUploadedImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'processing' } : i));
        try {
            const base64 = await fileToBase64(img.file);
            const mimeType = img.file.type as 'image/jpeg' | 'image/png' | 'image/webp';
            const text = await extractQuestionsFromImage(base64, mimeType, key, {
                className: selectedClass,
                subjectName: selectedSubject,
                chapterName: selectedChapter,
            });
            setUploadedImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'done', extractedText: text } : i));
        } catch (err: any) {
            setUploadedImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'error', errorMsg: err.message } : i));
        }
    };

    const extractAll = async () => {
        const key = await getEffectiveApiKey();
        if (!key) { alert('Gemini API key not found. Please ask admin to set it in Settings → API Keys.'); return; }
        if (!selectedClass || !selectedSubject) { alert('Please select Class and Subject first.'); return; }
        const pending = uploadedImages.filter(i => i.status === 'pending');
        for (const img of pending) {
            await extractFromImage(img);
        }
    };

    const handleSave = async () => {
        if (!schoolId) { alert('School not loaded.'); return; }
        if (!selectedClass || !selectedSubject || !selectedChapter) {
            alert('Please select Class, Subject and Chapter before saving.'); return;
        }
        const doneImages = uploadedImages.filter(i => i.status === 'done' && i.extractedText.trim());
        if (doneImages.length === 0) { alert('No extracted questions to save. Please extract questions first.'); return; }

        const combinedText = doneImages.map((img, idx) =>
            `--- Image ${idx + 1} ---\n${img.extractedText.trim()}`
        ).join('\n\n');

        setIsSaving(true);
        try {
            await addDoc(collection(db, `question_bank_${schoolId}`), {
                className: selectedClass,
                subjectName: selectedSubject,
                chapterName: selectedChapter,
                extractedText: combinedText,
                imageCount: doneImages.length,
                createdAt: new Date().toISOString(),
            });
            alert(`✅ ${doneImages.length} image(s) worth of questions saved to Question Bank!`);
            setUploadedImages([]);
            await loadSavedQuestions();
        } catch (e: any) {
            alert('Failed to save: ' + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this question bank entry?')) return;
        try {
            await deleteDoc(doc(db, `question_bank_${schoolId}`, id));
            setSavedQuestions(prev => prev.filter(q => q.id !== id));
        } catch (e: any) {
            alert('Failed to delete: ' + e.message);
        }
    };

    const doneCount = uploadedImages.filter(i => i.status === 'done').length;
    const processingCount = uploadedImages.filter(i => i.status === 'processing').length;

    return (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
            {/* Info Banner */}
            <div style={{
                padding: '1rem 1.25rem',
                background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.08))',
                borderRadius: '0.75rem',
                border: '1px solid rgba(16,185,129,0.3)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
            }}>
                <ImagePlus size={20} style={{ color: '#059669', marginTop: '2px', flexShrink: 0 }} />
                <div>
                    <strong style={{ color: '#059669', fontSize: '0.9rem' }}>AI Question Bank Builder</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        Upload question paper images → AI extracts text → Save to database for use in Question Generator
                    </p>
                </div>
            </div>

            {/* Upload Card */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Upload size={18} />
                    Upload Question Images
                </h3>

                {/* Step 1: Selectors — 3 columns only, no API key field here */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div className="input-group">
                        <label className="field-label">Select Class *</label>
                        <select className="input-field" value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSubject(''); setSelectedChapter(''); }}>
                            <option value="">Select Class</option>
                            {classes.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="input-group">
                        <label className="field-label">Select Subject *</label>
                        <select className="input-field" value={selectedSubject} onChange={e => { setSelectedSubject(e.target.value); setSelectedChapter(''); }} disabled={!selectedClass}>
                            <option value="">Select Subject</option>
                            {availableSubjects.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="input-group">
                        <label className="field-label">Select Chapter *</label>
                        <select className="input-field" value={selectedChapter} onChange={e => setSelectedChapter(e.target.value)} disabled={!selectedSubject}>
                            <option value="">Select Chapter</option>
                            {availableChapters.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                        </select>
                    </div>
                </div>

                {/* API Key status indicator (read-only) — hidden for teachers */}
                {!isTeacher && !isLoadingApiKey && !aiApiKey && (
                    <div style={{ padding: '0.75rem 1rem', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '0.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: '#92400e' }}>
                        <AlertCircle size={16} />
                        <span>Gemini API key not configured. Please go to <strong>Settings → API Keys</strong> and add your Gemini API Key.</span>
                    </div>
                )}

                {/* Drag & Drop Zone */}
                <div
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        border: `2px dashed ${isDragging ? '#059669' : 'var(--border)'}`,
                        borderRadius: '0.75rem',
                        padding: '2.5rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: isDragging ? 'rgba(16,185,129,0.07)' : 'var(--bg-secondary)',
                        transition: 'all 0.2s',
                        marginBottom: '1.25rem',
                    }}
                >
                    <ImagePlus size={36} style={{ color: isDragging ? '#059669' : 'var(--text-muted)', marginBottom: '0.75rem' }} />
                    <p style={{ margin: 0, fontWeight: 600, color: isDragging ? '#059669' : 'var(--text-main)' }}>
                        {isDragging ? 'Drop images here!' : 'Drag & drop question images here'}
                    </p>
                    <p style={{ margin: '0.375rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        or click to browse — JPG, PNG, WEBP supported
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        style={{ display: 'none' }}
                        onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
                    />
                </div>

                {/* Images Grid */}
                {uploadedImages.length > 0 && (
                    <div style={{ display: 'grid', gap: '1.25rem' }}>
                        {/* Bulk Extract Button */}
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <button
                                className="btn btn-primary"
                                onClick={extractAll}
                                disabled={processingCount > 0 || uploadedImages.every(i => i.status !== 'pending')}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #059669, #10b981)' }}
                            >
                                {processingCount > 0 ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={16} />}
                                {processingCount > 0 ? `Extracting (${processingCount} left)...` : `Extract All Questions (${uploadedImages.filter(i => i.status === 'pending').length} pending)`}
                            </button>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                {doneCount}/{uploadedImages.length} extracted
                            </span>
                        </div>

                        {/* Each Image */}
                        {uploadedImages.map(img => (
                            <div key={img.id} style={{
                                border: '1px solid var(--border)',
                                borderRadius: '0.75rem',
                                overflow: 'hidden',
                                background: 'var(--bg-secondary)',
                            }}>
                                <div style={{ display: 'flex', gap: '1rem', padding: '1rem', alignItems: 'flex-start' }}>
                                    {/* Thumbnail */}
                                    <img
                                        src={img.preview}
                                        alt="Question"
                                        style={{ width: '100px', height: '80px', objectFit: 'cover', borderRadius: '0.5rem', flexShrink: 0, border: '1px solid var(--border)' }}
                                    />
                                    {/* Info & Actions */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)', wordBreak: 'break-all' }}>
                                                {img.file.name}
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                                                {img.status === 'pending' && (
                                                    <button
                                                        className="btn"
                                                        onClick={() => extractFromImage(img)}
                                                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem', background: 'linear-gradient(135deg, #059669, #10b981)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                                                    >
                                                        <FileText size={14} /> Extract
                                                    </button>
                                                )}
                                                <button
                                                    className="btn"
                                                    onClick={() => removeImage(img.id)}
                                                    style={{ padding: '0.375rem', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Status Badge */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            {img.status === 'pending' && <span style={{ fontSize: '0.75rem', color: '#6b7280', padding: '2px 8px', background: '#f3f4f6', borderRadius: '999px' }}>⏳ Pending</span>}
                                            {img.status === 'processing' && <span style={{ fontSize: '0.75rem', color: '#d97706', padding: '2px 8px', background: '#fef3c7', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '4px' }}><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</span>}
                                            {img.status === 'done' && <span style={{ fontSize: '0.75rem', color: '#059669', padding: '2px 8px', background: '#d1fae5', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> Extracted</span>}
                                            {img.status === 'error' && <span style={{ fontSize: '0.75rem', color: '#dc2626', padding: '2px 8px', background: '#fee2e2', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={12} /> {img.errorMsg || 'Error'}</span>}
                                        </div>

                                        {img.status === 'done' && img.extractedText && (
                                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                                {img.extractedText.split('\n').length} lines extracted
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Extracted Text Editor */}
                                {img.status === 'done' && (
                                    <div style={{ padding: '0 1rem 1rem' }}>
                                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                                            ✏️ Review & Edit Extracted Questions:
                                        </label>
                                        <textarea
                                            value={img.extractedText}
                                            onChange={e => updateExtractedText(img.id, e.target.value)}
                                            rows={8}
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                borderRadius: '0.5rem',
                                                border: '1px solid var(--border)',
                                                fontFamily: 'monospace',
                                                fontSize: '0.825rem',
                                                resize: 'vertical',
                                                background: 'white',
                                                color: 'var(--text-main)',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Save Button */}
                        {doneCount > 0 && (
                            <button
                                className="btn btn-primary"
                                onClick={handleSave}
                                disabled={isSaving}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', alignSelf: 'flex-start', padding: '0.75rem 1.5rem', fontWeight: 700 }}
                            >
                                <Save size={16} />
                                {isSaving ? 'Saving to Database...' : `Save ${doneCount} Image(s) to Question Bank`}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Saved Questions Section */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileText size={18} />
                        Saved Question Bank ({savedQuestions.length})
                    </h3>
                    <button className="btn" onClick={loadSavedQuestions} style={{ fontSize: '0.8125rem' }}>
                        🔄 Refresh
                    </button>
                </div>

                {isLoadingSaved ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.5rem' }} />
                        <p>Loading saved questions...</p>
                    </div>
                ) : savedQuestions.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No questions saved yet. Upload and extract questions above.
                    </p>
                ) : (
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {savedQuestions.map(q => (
                            <div key={q.id} style={{
                                border: '1px solid var(--border)',
                                borderRadius: '0.75rem',
                                overflow: 'hidden',
                                background: 'var(--bg-secondary)',
                            }}>
                                <div
                                    style={{ padding: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                    onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                                >
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                            📚 {q.className} → {q.subjectName} → {q.chapterName}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {q.imageCount} image(s) · {q.extractedText.split('\n').filter(l => l.trim()).length} lines ·
                                            &nbsp;{new Date(q.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        {!isTeacher && (
                                            <button
                                                className="btn"
                                                onClick={e => { e.stopPropagation(); handleDelete(q.id); }}
                                                style={{ padding: '0.375rem', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                        {expandedId === q.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </div>
                                </div>
                                {expandedId === q.id && (
                                    <div style={{ padding: '0 1rem 1rem' }}>
                                        <pre style={{
                                            background: 'white',
                                            border: '1px solid var(--border)',
                                            borderRadius: '0.5rem',
                                            padding: '1rem',
                                            fontFamily: 'monospace',
                                            fontSize: '0.8125rem',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            maxHeight: '400px',
                                            overflowY: 'auto',
                                            color: 'var(--text-main)',
                                            margin: 0,
                                        }}>
                                            {q.extractedText}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg) } }
            `}</style>
        </div>
    );
};

