import React, { useState, useEffect } from 'react';
import { Save, X, Plus, Trash2, Clock } from 'lucide-react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSchool } from '../context/SchoolContext';
import { useFirestore } from '../hooks/useFirestore';
import { StyledSelect } from './StyledSelect';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Period {
    startTime: string;
    endTime: string;
    subject: string;
    teacher: string;
    type: 'class' | 'lunch' | 'break';
}

interface RoutineRule {
    id: string;
    days: string[];
    startTime: string;
    recessCount: number; // 0, 1, or 2
    // First section (before first recess)
    periodsBeforeFirstRecess: number;
    periodDurationBeforeFirstRecess: number;
    firstRecessDuration: number;
    // Second section (between first and second recess)
    periodsAfterFirstRecess: number;
    periodDurationAfterFirstRecess: number;
    secondRecessDuration: number;
    // Third section (after second recess)
    periodsAfterSecondRecess: number;
    periodDurationAfterSecondRecess: number;
}

interface RoutineSettings {
    selectedClasses: string[];
    rules: RoutineRule[];
    specialInstructions: string;
    maxClassesPerTeacher: number;
}

interface ManualRoutineEditorProps {
    selectedClass: string;
    settings: RoutineSettings;
    subjects: any[];
    onClose: () => void;
}

const ManualRoutineEditor: React.FC<ManualRoutineEditorProps> = ({ selectedClass, settings, subjects, onClose }) => {
    const { currentSchool } = useSchool();
    const { data: teachers } = useFirestore<any>('teachers');
    const { data: allSettings } = useFirestore<any>('settings');

    const [schedule, setSchedule] = useState<{ [day: string]: Period[] }>({});
    const [isSaving, setIsSaving] = useState(false);

    // Filter subjects and teachers
    // Unified data fetching and filtering

    // Filter teachers based on selected class - only show teachers who teach this class
    const activeTeachers = teachers ? teachers.filter((t: any) =>
        t.status === 'ACTIVE' &&
        t.teachingClasses &&
        t.teachingClasses.includes(selectedClass)
    ) : [];

    // Filter subjects based on selected class - only show subjects enabled for this class
    const activeSubjects = subjects.filter((s: any) =>
        s.enabledFor && s.enabledFor.includes(selectedClass)
    );

    // Use filtered subjects (no fallback to all subjects)
    const finalSubjects = activeSubjects;




    useEffect(() => {
        if (allSettings && allSettings.length > 0) {
            loadExistingRoutine();
        }
    }, [selectedClass, currentSchool?.id, allSettings?.length]);

    const calculateTimesForDay = (day: string) => {
        const rule = settings.rules.find(r => r.days.includes(day)) || settings.rules[0];
        if (!rule) return [];

        let periods: Period[] = [];
        let currentTime = rule.startTime;

        // Section 1: Periods before first recess (or all periods if no recess)
        for (let i = 0; i < rule.periodsBeforeFirstRecess; i++) {
            const start = currentTime;
            const end = addMinutes(start, rule.periodDurationBeforeFirstRecess);

            periods.push({
                startTime: start,
                endTime: end,
                subject: '',
                teacher: '',
                type: 'class'
            });

            currentTime = end;
        }

        // First Recess
        if (rule.recessCount >= 1 && rule.firstRecessDuration > 0) {
            const recessEnd = addMinutes(currentTime, rule.firstRecessDuration);
            periods.push({
                startTime: currentTime,
                endTime: recessEnd,
                subject: 'Recess',
                teacher: '',
                type: 'break'
            });
            currentTime = recessEnd;

            // Section 2: Periods after first recess (and before second if applicable)
            for (let i = 0; i < rule.periodsAfterFirstRecess; i++) {
                const start = currentTime;
                const end = addMinutes(start, rule.periodDurationAfterFirstRecess);

                periods.push({
                    startTime: start,
                    endTime: end,
                    subject: '',
                    teacher: '',
                    type: 'class'
                });

                currentTime = end;
            }

            // Second Recess
            if (rule.recessCount >= 2 && rule.secondRecessDuration > 0) {
                const recessEnd = addMinutes(currentTime, rule.secondRecessDuration);
                periods.push({
                    startTime: currentTime,
                    endTime: recessEnd,
                    subject: 'Recess',
                    teacher: '',
                    type: 'break'
                });
                currentTime = recessEnd;

                // Section 3: Periods after second recess
                for (let i = 0; i < rule.periodsAfterSecondRecess; i++) {
                    const start = currentTime;
                    const end = addMinutes(start, rule.periodDurationAfterSecondRecess);

                    periods.push({
                        startTime: start,
                        endTime: end,
                        subject: '',
                        teacher: '',
                        type: 'class'
                    });

                    currentTime = end;
                }
            }
        }

        return periods;
    };

    const addMinutes = (time: string, mins: number) => {
        const [h, m] = time.split(':').map(Number);
        const date = new Date();
        date.setHours(h, m + mins);
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    const loadExistingRoutine = async () => {
        if (!currentSchool?.id || !selectedClass) return;

        try {
            const docRef = doc(db, 'settings', `school_routine_${currentSchool.id}`);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const routines = docSnap.data().routines || [];
                const classRoutine = routines.find((r: any) => r.className === selectedClass);

                if (classRoutine && classRoutine.schedule) {
                    setSchedule(classRoutine.schedule);
                } else {
                    // Generate default structure based on rules
                    const initial: { [day: string]: Period[] } = {};
                    DAYS.forEach(day => {
                        initial[day] = calculateTimesForDay(day);
                    });
                    setSchedule(initial);
                }
            } else {
                const initial: { [day: string]: Period[] } = {};
                DAYS.forEach(day => {
                    initial[day] = calculateTimesForDay(day);
                });
                setSchedule(initial);
            }
        } catch (error) {
            console.error('Error loading routine:', error);
        }
    };

    const updatePeriod = (day: string, index: number, field: keyof Period, value: string) => {
        setSchedule(prev => ({
            ...prev,
            [day]: prev[day].map((period, i) =>
                i === index ? { ...period, [field]: value } : period
            )
        }));
    };

    const saveRoutine = async () => {
        if (!currentSchool?.id) return;
        setIsSaving(true);
        try {
            const docRef = doc(db, 'settings', `school_routine_${currentSchool.id}`);
            const docSnap = await getDoc(docRef);

            let allRoutines = docSnap.exists() ? (docSnap.data().routines || []) : [];
            const newRoutine = {
                className: selectedClass,
                schedule: schedule,
                updatedAt: new Date().toISOString(),
                type: 'manual'
            };

            const idx = allRoutines.findIndex((r: any) => r.className === selectedClass);
            if (idx >= 0) allRoutines[idx] = newRoutine;
            else allRoutines.push(newRoutine);

            await setDoc(docRef, {
                routines: allRoutines,
                lastUpdated: new Date().toISOString(),
                schoolId: currentSchool.id
            }, { merge: true });

            alert('✅ Routine saved successfully!');
            onClose();
        } catch (error) {
            alert('❌ Error: ' + (error as any).message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(8px)' }}>
            <div className="glass-card animate-scale-in" style={{ width: '100%', maxWidth: '1200px', maxHeight: '95vh', overflow: 'hidden', padding: '2rem', background: 'white', display: 'flex', flexDirection: 'column' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1e293b' }}>Manual Routine Editor</h2>
                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Editing for <strong>{selectedClass}</strong> • Times calculated from rules</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button onClick={saveRoutine} disabled={isSaving} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontWeight: 800 }}>
                            <Save size={18} /> {isSaving ? 'Saving...' : 'Save Routine'}
                        </button>
                        <button onClick={onClose} className="btn-icon" style={{ borderRadius: '50%' }}><X size={24} /></button>
                    </div>
                </div>

                <div style={{ overflow: 'auto', flex: 1, padding: '0.5rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.5rem' }}>
                        <thead>
                            <tr style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 800 }}>
                                <th style={{ textAlign: 'left', padding: '0.5rem 1rem', width: '120px' }}>Day</th>
                                <th style={{ textAlign: 'left', padding: '0.5rem 1rem' }}>Time Slot</th>
                                <th style={{ textAlign: 'left', padding: '0.5rem 1rem' }}>Subject</th>
                                <th style={{ textAlign: 'left', padding: '0.5rem 1rem' }}>Teacher</th>
                            </tr>
                        </thead>
                        <tbody>
                            {DAYS.map(day => (
                                <React.Fragment key={day}>
                                    {schedule[day]?.map((period, index) => (
                                        <tr key={`${day}-${index}`} style={{ background: (period.type === 'lunch' || period.type === 'break') ? '#f8fafc' : 'white' }}>
                                            <td style={{ padding: '0.5rem 1rem', fontWeight: 800, color: '#1e293b', verticalAlign: 'middle' }}>
                                                {index === 0 ? day : ''}
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f5f9', padding: '0.5rem 0.75rem', borderRadius: '0.75rem', width: 'fit-content' }}>
                                                    <Clock size={14} color="#64748b" />
                                                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155' }}>
                                                        {period.startTime} - {period.endTime}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <div style={{ position: 'relative' }}>
                                                    <select
                                                        className="input-field"
                                                        value={period.subject}
                                                        onChange={e => updatePeriod(day, index, 'subject', e.target.value)}
                                                        style={{
                                                            height: '2.75rem',
                                                            fontSize: '0.9rem',
                                                            color: '#1e293b',
                                                            WebkitTextFillColor: '#1e293b',
                                                            border: '2px solid #e2e8f0',
                                                            background: 'white',
                                                            backgroundColor: 'white',
                                                            opacity: 1,
                                                            textShadow: 'none',
                                                            width: '100%'
                                                        } as React.CSSProperties}
                                                        disabled={period.type === 'lunch' || period.type === 'break'}
                                                    >
                                                        <option value="" style={{ color: '#1e293b' }}>{(period.type === 'lunch' || period.type === 'break') ? (period.subject.toUpperCase() + ' BREAK') : 'Select Subject'}</option>
                                                        <option value="Lunch" style={{ color: '#1e293b' }}>Lunch Break</option>
                                                        <option value="Break" style={{ color: '#1e293b' }}>Short Break</option>
                                                        {finalSubjects.map((s: any) => (
                                                            <option key={s.id} value={s.name} style={{ color: '#1e293b' }}>{s.name}</option>
                                                        ))}
                                                    </select>
                                                    {/* Visible text overlay as fallback */}
                                                    {period.subject && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            left: '1rem',
                                                            top: '50%',
                                                            transform: 'translateY(-50%)',
                                                            color: '#1e293b',
                                                            fontSize: '0.9rem',
                                                            pointerEvents: 'none',
                                                            fontWeight: 600
                                                        }}>
                                                            {period.subject}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <div style={{ position: 'relative' }}>
                                                    <select
                                                        className="input-field"
                                                        value={period.teacher}
                                                        onChange={e => updatePeriod(day, index, 'teacher', e.target.value)}
                                                        style={{
                                                            height: '2.75rem',
                                                            fontSize: '0.9rem',
                                                            color: '#1e293b',
                                                            WebkitTextFillColor: '#1e293b',
                                                            border: '2px solid #e2e8f0',
                                                            background: 'white',
                                                            backgroundColor: 'white',
                                                            opacity: 1,
                                                            textShadow: 'none',
                                                            width: '100%'
                                                        } as React.CSSProperties}
                                                        disabled={period.type === 'lunch' || period.type === 'break' || period.subject === 'Lunch' || period.subject === 'Recess'}
                                                    >
                                                        <option value="" style={{ color: '#1e293b' }}>Select Teacher</option>
                                                        {activeTeachers.map((t: any) => (
                                                            <option key={t.id} value={t.name} style={{ color: '#1e293b' }}>{t.name}</option>
                                                        ))}
                                                    </select>
                                                    {/* Visible text overlay */}
                                                    {period.teacher && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            left: '1rem',
                                                            top: '50%',
                                                            transform: 'translateY(-50%)',
                                                            color: '#1e293b',
                                                            fontSize: '0.9rem',
                                                            pointerEvents: 'none',
                                                            fontWeight: 600
                                                        }}>
                                                            {period.teacher}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr><td colSpan={4} style={{ height: '1px', background: '#e2e8f0', margin: '0.5rem 0' }}></td></tr>
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f0f9ff', borderRadius: '1rem', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: '#0ea5e9', color: 'white', padding: '0.5rem', borderRadius: '0.5rem' }}><Clock size={20} /></div>
                    <p style={{ fontSize: '0.85rem', color: '#0369a1', margin: 0 }}>
                        <strong>Note:</strong> Time slots and periods are automatically generated based on the group rules you defined.
                        You only need to select subjects and teachers.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ManualRoutineEditor;
