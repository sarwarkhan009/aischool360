import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, X, Check, GraduationCap, List, Save, Trash2, Search, Calendar } from 'lucide-react';
import RoutineManager from './RoutineManager';
import { useFirestore } from '../hooks/useFirestore';
import { db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { sortClasses } from '../constants/app';
import { useSchool } from '../context/SchoolContext';
import { seedSubjectList } from '../lib/dbSeeder';

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
    const { data: allSettings } = useFirestore<any>('settings');

    const [activeTab, setActiveTab] = useState<'subjects' | 'chapters' | 'routine'>('subjects');
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
        const activeClasses = sortClasses(
            allSettings?.filter((d: any) => d.type === 'class' && d.active !== false) || []
        );
        setClasses(activeClasses.map((c: any) => ({ name: c.name })));
    }, [allSettings]);

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
        return subjects.filter(s => s.enabledFor.includes(className));
    };

    const filteredSubjects = subjects.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ paddingBottom: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                        Academic Structure Manager
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Manage subjects and chapters for Question Generator and Exams
                    </p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={saveAcademicData}
                    disabled={isSaving}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <Save size={18} /> {isSaving ? 'Saving...' : 'Save All Data'}
                </button>
            </div>

            {/* Info Card */}
            <div style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '0.75rem', marginBottom: '2rem', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <GraduationCap size={20} style={{ color: 'var(--primary)' }} />
                    <strong style={{ color: 'var(--primary)' }}>Classes Auto-Loaded: {classes.length}</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    Classes are automatically loaded from Class & Section Master. To add/remove classes, go to Settings → Class & Section Master.
                </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '2px solid var(--border)' }}>
                <button
                    className={activeTab === 'subjects' ? 'btn btn-primary' : 'btn'}
                    onClick={() => setActiveTab('subjects')}
                    style={{ borderRadius: '0.5rem 0.5rem 0 0', border: 'none', borderBottom: activeTab === 'subjects' ? '2px solid var(--primary)' : 'none' }}
                >
                    <BookOpen size={18} style={{ marginRight: '0.5rem' }} />
                    Subjects ({subjects.length})
                </button>
                <button
                    className={activeTab === 'chapters' ? 'btn btn-primary' : 'btn'}
                    onClick={() => setActiveTab('chapters')}
                    style={{ borderRadius: '0.5rem 0.5rem 0 0', border: 'none', borderBottom: activeTab === 'chapters' ? '2px solid var(--primary)' : 'none' }}
                >
                    <List size={18} style={{ marginRight: '0.5rem' }} />
                    Chapters
                </button>
                {/* <button
                    className={activeTab === 'routine' ? 'btn btn-primary' : 'btn'}
                    onClick={() => setActiveTab('routine')}
                    style={{ borderRadius: '0.5rem 0.5rem 0 0', border: 'none', borderBottom: activeTab === 'routine' ? '2px solid var(--primary)' : 'none' }}
                >
                    <Calendar size={18} style={{ marginRight: '0.5rem' }} />
                    Routine AI
                </button> */}
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
                                                    enabledFor: [],
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
                        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
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

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
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
                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Existing Chapters</h3>

                            {subjects.filter(s => Object.values(s.chaptersPerClass).flat().length > 0).length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                                    No chapters added yet. Add chapters above after selecting class and subject.
                                </p>
                            ) : (
                                <div style={{ display: 'grid', gap: '2rem' }}>
                                    {subjects.filter(s => Object.values(s.chaptersPerClass).flat().length > 0).map((subject) => (
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
                                                                        <button
                                                                            className="btn"
                                                                            onClick={() => handleRemoveChapter(subject.name, className, chapter)}
                                                                            style={{ padding: '0.25rem 0.5rem', background: '#ef4444', color: 'white' }}
                                                                        >
                                                                            <X size={14} />
                                                                        </button>
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
            {/* {
                activeTab === 'routine' && (
                    <RoutineManager classesList={classes} subjectsData={subjects} />
                )
            } */}
        </div >
    );
};

export default AcademicDataManager;
