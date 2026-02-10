import React, { useState, useEffect } from 'react';
import { BookOpen, Calendar, Save, X, Plus } from 'lucide-react';
import { collection, addDoc, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSchool } from '../../context/SchoolContext';

interface TeachingLogEntry {
    className: string;
    subject: string;
    topic: string;
    description: string;
}

export default function AddTeachingLog() {
    const { user } = useAuth();
    const { currentSchool } = useSchool();

    const [date, setDate] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });

    const [entries, setEntries] = useState<TeachingLogEntry[]>([{
        className: '',
        subject: '',
        topic: '',
        description: ''
    }]);

    const [classes, setClasses] = useState<string[]>([]);
    const [subjects, setSubjects] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchClassesAndSubjects();
    }, [currentSchool?.id]);

    const fetchClassesAndSubjects = async () => {
        if (!currentSchool?.id) return;

        setLoading(true);
        try {
            // Fetch classes from settings collection (Class & Section Master)
            const settingsRef = collection(db, 'settings');
            const settingsSnapshot = await getDocs(settingsRef);

            const classNames: string[] = [];
            settingsSnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                // Get active classes from Class & Section Master
                if (data.type === 'class' && data.active !== false && data.schoolId === currentSchool.id) {
                    classNames.push(data.name);
                }
            });

            setClasses(classNames.sort());

            // Fetch subjects from academic_structure document (Subjects & Chapters)
            const academicDocRef = doc(db, 'settings', `academic_structure_${currentSchool.id}`);
            const academicSnap = await getDoc(academicDocRef);

            if (academicSnap.exists()) {
                const academicData = academicSnap.data();
                if (academicData.subjects && Array.isArray(academicData.subjects)) {
                    // Get unique subject names from the subjects array
                    const subjectNames = academicData.subjects
                        .filter((s: any) => s.name && s.enabledFor && s.enabledFor.length > 0)
                        .map((s: any) => s.name);
                    setSubjects([...new Set(subjectNames)].sort());
                }
            }
        } catch (error) {
            console.error('Error fetching classes/subjects:', error);
        } finally {
            setLoading(false);
        }
    };

    const addEntry = () => {
        setEntries([...entries, {
            className: '',
            subject: '',
            topic: '',
            description: ''
        }]);
    };

    const removeEntry = (index: number) => {
        if (entries.length > 1) {
            setEntries(entries.filter((_, i) => i !== index));
        }
    };

    const updateEntry = (index: number, field: keyof TeachingLogEntry, value: string) => {
        const newEntries = [...entries];
        newEntries[index][field] = value;
        setEntries(newEntries);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user?.id || !currentSchool?.id) {
            setMessage({ type: 'error', text: 'User or school information missing' });
            return;
        }

        // Validate entries
        const validEntries = entries.filter(entry =>
            entry.className && entry.subject && entry.topic
        );

        if (validEntries.length === 0) {
            setMessage({ type: 'error', text: 'Please fill at least one complete entry (Class, Subject, Topic required)' });
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            const logsRef = collection(db, 'teachingLogs');

            // Save each entry
            for (const entry of validEntries) {
                await addDoc(logsRef, {
                    schoolId: currentSchool.id,
                    teacherId: user.id,
                    teacherName: user.name || user.username,
                    date: date,
                    className: entry.className,
                    subject: entry.subject,
                    topic: entry.topic,
                    description: entry.description || '',
                    createdAt: new Date().toISOString()
                });
            }

            setMessage({
                type: 'success',
                text: `Successfully saved ${validEntries.length} teaching log${validEntries.length > 1 ? 's' : ''}!`
            });

            // Reset form
            setEntries([{
                className: '',
                subject: '',
                topic: '',
                description: ''
            }]);

            // Clear message after 3 seconds
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Error saving teaching logs:', error);
            setMessage({ type: 'error', text: 'Failed to save teaching logs. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 900, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <BookOpen size={28} color="var(--primary)" strokeWidth={2.5} />
                    Add Teaching Log
                </h1>
                <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                    Record what you taught in each class today
                </p>
            </div>

            {message && (
                <div style={{
                    padding: '1rem 1.5rem',
                    borderRadius: '0.75rem',
                    marginBottom: '1.5rem',
                    background: message.type === 'success'
                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)'
                        : 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)',
                    border: `2px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    color: message.type === 'success' ? '#059669' : '#dc2626',
                    fontWeight: 700
                }}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="glass-card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <Calendar size={20} color="var(--primary)" />
                        <label style={{ fontWeight: 800, fontSize: '1rem' }}>Date</label>
                    </div>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        required
                        style={{
                            width: '100%',
                            padding: '0.875rem 1.25rem',
                            borderRadius: '0.75rem',
                            border: '2px solid #e2e8f0',
                            fontSize: '1rem',
                            fontWeight: 600,
                            outline: 'none',
                            transition: 'all 0.2s'
                        }}
                    />
                </div>

                {entries.map((entry, index) => (
                    <div key={index} className="glass-card" style={{ padding: '2rem', marginBottom: '1.5rem', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontWeight: 800, fontSize: '1.125rem' }}>
                                Entry {index + 1}
                            </h3>
                            {entries.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeEntry(index)}
                                    style={{
                                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                        color: 'white',
                                        border: 'none',
                                        padding: '0.5rem',
                                        borderRadius: '0.5rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontWeight: 700
                                    }}
                                    className="hover-lift"
                                >
                                    <X size={16} />
                                    Remove
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.875rem', color: '#64748b' }}>
                                    Class <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <select
                                    value={entry.className}
                                    onChange={(e) => updateEntry(index, 'className', e.target.value)}
                                    required
                                    disabled={loading}
                                    style={{
                                        width: '100%',
                                        padding: '0.875rem 1.25rem',
                                        borderRadius: '0.75rem',
                                        border: '2px solid #e2e8f0',
                                        fontSize: '1rem',
                                        fontWeight: 600,
                                        outline: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="">Select Class</option>
                                    {classes.map((cls) => (
                                        <option key={cls} value={cls}>{cls}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.875rem', color: '#64748b' }}>
                                    Subject <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <select
                                    value={entry.subject}
                                    onChange={(e) => updateEntry(index, 'subject', e.target.value)}
                                    required
                                    disabled={loading}
                                    style={{
                                        width: '100%',
                                        padding: '0.875rem 1.25rem',
                                        borderRadius: '0.75rem',
                                        border: '2px solid #e2e8f0',
                                        fontSize: '1rem',
                                        fontWeight: 600,
                                        outline: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="">Select Subject</option>
                                    {subjects.map((subj) => (
                                        <option key={subj} value={subj}>{subj}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{ marginTop: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.875rem', color: '#64748b' }}>
                                Topic/Chapter <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                                type="text"
                                value={entry.topic}
                                onChange={(e) => updateEntry(index, 'topic', e.target.value)}
                                placeholder="e.g., Linear Equations, Photosynthesis, World War II"
                                required
                                style={{
                                    width: '100%',
                                    padding: '0.875rem 1.25rem',
                                    borderRadius: '0.75rem',
                                    border: '2px solid #e2e8f0',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ marginTop: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.875rem', color: '#64748b' }}>
                                Description (Optional)
                            </label>
                            <textarea
                                value={entry.description}
                                onChange={(e) => updateEntry(index, 'description', e.target.value)}
                                placeholder="Additional details about what was covered..."
                                rows={3}
                                style={{
                                    width: '100%',
                                    padding: '0.875rem 1.25rem',
                                    borderRadius: '0.75rem',
                                    border: '2px solid #e2e8f0',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    outline: 'none',
                                    resize: 'vertical',
                                    fontFamily: 'inherit'
                                }}
                            />
                        </div>
                    </div>
                ))}

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={addEntry}
                        style={{
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '0.875rem 1.75rem',
                            borderRadius: '0.75rem',
                            cursor: 'pointer',
                            fontWeight: 800,
                            fontSize: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                        }}
                        className="hover-lift"
                    >
                        <Plus size={20} />
                        Add Another Entry
                    </button>

                    <button
                        type="submit"
                        disabled={saving}
                        style={{
                            background: saving
                                ? '#94a3b8'
                                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '0.875rem 2rem',
                            borderRadius: '0.75rem',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            fontWeight: 800,
                            fontSize: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: saving ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)',
                            flex: 1
                        }}
                        className={saving ? '' : 'hover-lift'}
                    >
                        <Save size={20} />
                        {saving ? 'Saving...' : 'Save Teaching Log'}
                    </button>
                </div>
            </form>
        </div>
    );
}
