import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Users, Sparkles, Loader2, Save, Trash2, Printer, Check, X, Info, Settings as SettingsIcon, Plus, Edit, ChevronDown } from 'lucide-react';
import { StyledSelect } from './StyledSelect';
import { useFirestore } from '../hooks/useFirestore';
import { useSchool } from '../context/SchoolContext';
import { analyzeRoutineWithGemini } from '../lib/gemini';
import { sortClasses } from '../constants/app';
import { usePersistence } from '../hooks/usePersistence';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import ManualRoutineEditor from './ManualRoutineEditor';

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

interface Period {
    id: string;
    startTime: string;
    endTime: string;
    subject: string;
    teacher: string;
    type: 'class' | 'lunch' | 'break' | 'off';
}

interface ClassRoutine {
    className: string;
    schedule: { [day: string]: Period[] };
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const RoutineManager: React.FC<{
    classesList?: any[],
    subjectsData?: any[],
    isReadOnly?: boolean,
    fixedTeacherName?: string
}> = ({ classesList = [], subjectsData = [], isReadOnly = false, fixedTeacherName }) => {
    const { currentSchool } = useSchool();
    const { data: teachers, loading: teachersLoading } = useFirestore<any>('teachers');
    const { data: allSettings } = useFirestore<any>('settings');

    const [subjects, setSubjects] = useState<any[]>(Array.isArray(subjectsData) ? subjectsData : []);
    const [classes, setClasses] = useState<any[]>(Array.isArray(classesList) ? classesList : []);

    // Load academic data if not provided
    useEffect(() => {
        const loadAcademicData = async () => {
            if (!currentSchool?.id) return;

            // Only fetch if data is missing

            try {
                // Fetch classes from allSettings (already being fetched by useFirestore)
                if (classes.length === 0 && allSettings) {
                    const fetchedClasses = sortClasses(allSettings.filter((d: any) => d.type === 'class' && d.active !== false) || []);
                    if (fetchedClasses.length > 0) {
                        setClasses(fetchedClasses);
                    }
                }

                // Fetch subjects from academic_structure document
                if (subjects.length === 0) {
                    const docRef = doc(db, 'settings', `academic_structure_${currentSchool.id}`);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        if (data.subjects) {
                            setSubjects(data.subjects);
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading academic data in RoutineManager:', error);
            }
        };

        loadAcademicData();
    }, [currentSchool?.id, allSettings, subjectsData, classesList]);

    const [settings, setSettings] = usePersistence<RoutineSettings>(`routine_settings_v2_${currentSchool?.id}`, {
        selectedClasses: [],
        rules: [{
            id: 'rule_1',
            days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'],
            startTime: '07:10',
            recessCount: 1,
            periodsBeforeFirstRecess: 3,
            periodDurationBeforeFirstRecess: 40,
            firstRecessDuration: 15,
            periodsAfterFirstRecess: 3,
            periodDurationAfterFirstRecess: 40,
            secondRecessDuration: 0,
            periodsAfterSecondRecess: 0,
            periodDurationAfterSecondRecess: 40
        }],
        specialInstructions: '',
        maxClassesPerTeacher: 5
    });

    const [generatedRoutines, setGeneratedRoutines] = useState<ClassRoutine[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeViewClass, setActiveViewClass] = useState('');
    const [showManualEditor, setShowManualEditor] = useState(false);
    const [manualEditClass, setManualEditClass] = useState('');

    // Teacher-wise view states
    const [viewMode, setViewMode] = useState<'class' | 'teacher'>(fixedTeacherName ? 'teacher' : 'class');
    const [selectedTeacher, setSelectedTeacher] = useState(fixedTeacherName || '');
    const [selectedViewDay, setSelectedViewDay] = useState<'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Weekly View'>('Weekly View');

    useEffect(() => {
        if (fixedTeacherName && fixedTeacherName.trim()) {
            setViewMode('teacher');
            setSelectedTeacher(fixedTeacherName.trim());
            setSelectedViewDay('Weekly View');
        }
    }, [fixedTeacherName]);

    const loadRoutine = async () => {
        if (!currentSchool?.id) return;
        try {
            const docRef = doc(db, 'settings', `school_routine_${currentSchool.id}`);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const routines = docSnap.data().routines || [];
                setGeneratedRoutines(routines);
                if (routines.length > 0 && !activeViewClass) {
                    setActiveViewClass(routines[0].className);
                }
            }
        } catch (error) {
            console.error('Error loading routine:', error);
        }
    };

    // Load saved routine if exists
    useEffect(() => {
        loadRoutine();
    }, [currentSchool?.id]);

    const handleClassToggle = (className: string) => {
        const current = [...settings.selectedClasses];
        if (current.includes(className)) {
            setSettings({ ...settings, selectedClasses: current.filter(c => c !== className) });
        } else {
            setSettings({ ...settings, selectedClasses: [...current, className] });
        }
    };

    const addRule = () => {
        const newRule: RoutineRule = {
            id: `rule_${Date.now()}`,
            days: [],
            startTime: '07:10',
            recessCount: 1,
            periodsBeforeFirstRecess: 3,
            periodDurationBeforeFirstRecess: 40,
            firstRecessDuration: 15,
            periodsAfterFirstRecess: 3,
            periodDurationAfterFirstRecess: 40,
            secondRecessDuration: 0,
            periodsAfterSecondRecess: 0,
            periodDurationAfterSecondRecess: 40
        };
        setSettings({ ...settings, rules: [...settings.rules, newRule] });
    };

    const removeRule = (id: string) => {
        if (settings.rules.length <= 1) return;
        setSettings({ ...settings, rules: settings.rules.filter(r => r.id !== id) });
    };

    const updateRule = (id: string, updates: Partial<RoutineRule>) => {
        setSettings({
            ...settings,
            rules: settings.rules.map(r => r.id === id ? { ...r, ...updates } : r)
        });
    };

    const toggleDayInRule = (ruleId: string, day: string) => {
        const rule = settings.rules.find(r => r.id === ruleId);
        if (!rule) return;

        let newDays = [...rule.days];
        if (newDays.includes(day)) {
            newDays = newDays.filter(d => d !== day);
        } else {
            // Remove day from other rules if it exists
            const filteredRules = settings.rules.map(r => ({
                ...r,
                days: r.days.filter(d => d !== day)
            }));
            newDays.push(day);
            setSettings({
                ...settings,
                rules: filteredRules.map(r => r.id === ruleId ? { ...r, days: newDays } : r)
            });
            return;
        }

        updateRule(ruleId, { days: newDays });
    };

    const autoFixConflicts = (routines: ClassRoutine[]): ClassRoutine[] => {
        const fixed = JSON.parse(JSON.stringify(routines)); // Deep clone
        const availableTeachers = teachers?.filter((t: any) => t.status === 'ACTIVE') || [];

        DAYS.forEach(day => {
            // Build time slot conflict map
            const conflicts: { [timeSlot: string]: Array<{ routine: ClassRoutine, periodIdx: number, period: Period }> } = {};

            fixed.forEach((routine: ClassRoutine) => {
                const daySchedule = routine.schedule[day] || [];
                daySchedule.forEach((period: Period, idx: number) => {
                    if (period.type === 'class' && period.teacher) {
                        const timeSlot = `${period.startTime}-${period.endTime}`;
                        if (!conflicts[timeSlot]) conflicts[timeSlot] = [];
                        conflicts[timeSlot].push({ routine, periodIdx: idx, period });
                    }
                });
            });

            // Fix conflicts in each time slot
            Object.values(conflicts).forEach(slotAssignments => {
                // Group by teacher
                const byTeacher: { [teacher: string]: typeof slotAssignments } = {};
                slotAssignments.forEach(assignment => {
                    const teacher = assignment.period.teacher;
                    if (!byTeacher[teacher]) byTeacher[teacher] = [];
                    byTeacher[teacher].push(assignment);
                });

                // Fix teachers assigned to multiple classes
                Object.entries(byTeacher).forEach(([teacher, assignments]) => {
                    if (assignments.length > 1) {
                        // Keep first assignment, reassign others
                        assignments.slice(1).forEach(conflict => {
                            const subject = conflict.period.subject;
                            const className = conflict.routine.className;

                            // Find alternative teacher
                            const alternativeTeacher = availableTeachers.find((t: any) =>
                                t.name !== teacher &&
                                t.subjects?.includes(subject) &&
                                t.teachingClasses?.includes(className) &&
                                !slotAssignments.some(sa => sa.period.teacher === t.name)
                            );

                            if (alternativeTeacher) {
                                // Update the period with new teacher
                                const routineToFix = fixed.find((r: ClassRoutine) => r.className === conflict.routine.className);
                                if (routineToFix) {
                                    routineToFix.schedule[day][conflict.periodIdx].teacher = alternativeTeacher.name;
                                }
                            }
                        });
                    }
                });
            });
        });

        return fixed;
    };

    const validateRoutine = (routines: ClassRoutine[]): { valid: boolean, errors: string[] } => {
        const errors: string[] = [];

        // Check for teacher time conflicts and workload violations
        DAYS.forEach(day => {
            // Track teacher assignments by time slot
            const timeSlotMap: { [timeSlot: string]: { [teacher: string]: string[] } } = {};
            // Track daily class count per teacher
            const dailyCount: { [teacher: string]: number } = {};

            routines.forEach(routine => {
                const daySchedule = routine.schedule[day] || [];

                daySchedule.forEach(period => {
                    if (period.type === 'class' && period.teacher && period.teacher !== 'N/A') {
                        const timeSlot = `${period.startTime}-${period.endTime}`;

                        // Initialize structures
                        if (!timeSlotMap[timeSlot]) timeSlotMap[timeSlot] = {};
                        if (!timeSlotMap[timeSlot][period.teacher]) timeSlotMap[timeSlot][period.teacher] = [];
                        if (!dailyCount[period.teacher]) dailyCount[period.teacher] = 0;

                        // Track assignment
                        timeSlotMap[timeSlot][period.teacher].push(routine.className);
                        dailyCount[period.teacher]++;
                    }
                });
            });

            // Check for time conflicts
            Object.entries(timeSlotMap).forEach(([timeSlot, teachers]) => {
                Object.entries(teachers).forEach(([teacher, classes]) => {
                    if (classes.length > 1) {
                        errors.push(`⚠️ ${day}: ${teacher} is assigned to ${classes.length} classes at ${timeSlot} (${classes.join(', ')})`);
                    }
                });
            });

            // Check for workload violations
            Object.entries(dailyCount).forEach(([teacher, count]) => {
                if (count > settings.maxClassesPerTeacher) {
                    errors.push(`⚠️ ${day}: ${teacher} has ${count} classes (max allowed: ${settings.maxClassesPerTeacher})`);
                }
            });
        });

        return { valid: errors.length === 0, errors };
    };

    const generateRoutine = async () => {
        if (settings.selectedClasses.length === 0) {
            alert('Please select at least one class');
            return;
        }

        const coveredDays = settings.rules.flatMap(r => r.days);
        if (coveredDays.length === 0) {
            alert('Please select days for at least one rule');
            return;
        }

        const apiKey = allSettings?.find((s: any) => s.id === `gemini_${currentSchool?.id}`)?.apiKey ||
            localStorage.getItem('aischool360_gemini_api_key');

        if (!apiKey) {
            alert('Gemini API key not configured. Please set it in Settings > API Keys');
            return;
        }

        setIsGenerating(true);

        const maxRetries = 3;
        let attempt = 0;
        let finalRoutine: ClassRoutine[] | null = null;

        try {
            const schoolContext = {
                classes: settings.selectedClasses,
                rules: settings.rules,
                instructions: settings.specialInstructions,
                maxClassesPerTeacher: settings.maxClassesPerTeacher,
                teachers: teachers?.filter((t: any) => t.status === 'ACTIVE').map((t: any) => ({
                    name: t.name,
                    subjects: t.subjects || [],
                    classes: t.teachingClasses || []
                })),
                academic_structure: subjects.filter(s =>
                    s.enabledFor.some((c: string) => settings.selectedClasses.includes(c))
                ).map(s => ({
                    name: s.name,
                    enabledFor: s.enabledFor
                }))
            };

            // Simplified, algorithm-based prompt
            const prompt = `You are creating a school timetable. Follow this EXACT algorithm:

CLASSES TO SCHEDULE: ${settings.selectedClasses.join(', ')}

TEACHERS AVAILABLE:
${teachers?.filter((t: any) => t.status === 'ACTIVE').map((t: any) =>
                `- ${t.name}: teaches ${(t.subjects || []).join(', ')} to classes ${(t.teachingClasses || []).join(', ')}`
            ).join('\n')}

DAY RULES:
${settings.rules.map((r) => {
                let summary = `${r.days.join(', ')}: Starting ${r.startTime}. `;
                summary += `${r.periodsBeforeFirstRecess} periods of ${r.periodDurationBeforeFirstRecess}min`;
                if (r.recessCount >= 1) summary += `, Recess (${r.firstRecessDuration}min), ${r.periodsAfterFirstRecess} periods of ${r.periodDurationAfterFirstRecess}min`;
                if (r.recessCount >= 2) summary += `, Recess (${r.secondRecessDuration}min), ${r.periodsAfterSecondRecess} periods of ${r.periodDurationAfterSecondRecess}min`;
                return summary;
            }).join('\n')}

ALGORITHM TO FOLLOW:
1. For each day and each period time slot:
   a. Create a list of ALL classes that need a teacher at this time
   b. For EACH class in the list:
      - Pick a teacher who:
        * Teaches a subject needed by this class
        * Is qualified for this class
        * Is NOT already assigned to ANY other class at this EXACT time slot
      - Assign that teacher to THIS class only
   c. Move to next time slot

2. Daily limit check: No teacher should have more than ${settings.maxClassesPerTeacher} classes per day

3. Subject priority: Prefer Maths, Science, English when choosing subjects

CRITICAL RULES:
- ONE teacher can only be in ONE place at a time
- Different classes at the same time MUST have different teachers
- Check your assignments: if you see the same teacher name at the same time for different classes, that's WRONG

OUTPUT: Return ONLY valid JSON array:
[
  {
    "className": "Class 5",
    "schedule": {
      "Monday": [
        { "startTime": "07:10", "endTime": "07:50", "subject": "Maths", "teacher": "Teacher1", "type": "class" },
        { "startTime": "07:50", "endTime": "08:30", "subject": "English", "teacher": "Teacher2", "type": "class" }
      ]
    }
  }
]`;

            while (attempt < maxRetries && !finalRoutine) {
                attempt++;
                console.log(`Generation attempt ${attempt}/${maxRetries}...`);

                try {
                    const result = await analyzeRoutineWithGemini(prompt, schoolContext, apiKey);

                    // Clean and sanitize the JSON response
                    let cleanJson = result.replace(/```json|```/g, '').trim();

                    // Remove any leading/trailing text that might not be JSON
                    const jsonStart = cleanJson.indexOf('[');
                    const jsonEnd = cleanJson.lastIndexOf(']');

                    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                        cleanJson = cleanJson.substring(jsonStart, jsonEnd + 1);
                    }

                    // Try to fix common JSON issues
                    cleanJson = cleanJson
                        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
                        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
                        .replace(/\n/g, ' ') // Replace newlines with spaces in strings
                        .replace(/\r/g, ''); // Remove carriage returns

                    let parsed;
                    try {
                        parsed = JSON.parse(cleanJson);
                    } catch (parseError: any) {
                        console.error('JSON parsing failed:', parseError.message);
                        console.log('Problematic JSON:', cleanJson.substring(0, 500));
                        throw new Error(`Failed to parse AI response: ${parseError.message}. The AI returned malformed JSON.`);
                    }

                    if (Array.isArray(parsed)) {
                        let routineToTest = parsed;
                        let validation = validateRoutine(routineToTest);

                        // Try auto-fix if conflicts exist
                        if (!validation.valid) {
                            console.log('Conflicts detected, applying auto-fix...');
                            routineToTest = autoFixConflicts(routineToTest);
                            validation = validateRoutine(routineToTest);
                        }

                        // If still invalid and we have retries left, try again
                        // If this is last attempt or validation passed, use this routine
                        if (validation.valid || attempt >= maxRetries) {
                            finalRoutine = routineToTest;
                            if (validation.valid) {
                                console.log('✓ Valid routine generated!');
                            } else {
                                console.warn('Max retries reached. Using best available routine.');
                                alert(`⚠️ Routine generated with conflicts after ${maxRetries} attempts. Please review manually or try again.\n\n${validation.errors.join('\n')}`);
                            }
                        } else {
                            console.log(`Validation failed (${validation.errors.length} errors). Retrying...`);
                        }
                    } else {
                        throw new Error('Invalid AI response format: expected an array');
                    }
                } catch (parseError: any) {
                    console.error(`Attempt ${attempt} failed:`, parseError);
                    if (attempt >= maxRetries) {
                        throw parseError;
                    }
                    // Continue to next retry
                }
            }

            if (finalRoutine) {
                setGeneratedRoutines(finalRoutine);
                if (finalRoutine.length > 0) setActiveViewClass(finalRoutine[0].className);
                if (validateRoutine(finalRoutine).valid) {
                    alert('✓ Routine generated successfully!');
                }
            } else {
                throw new Error('Failed to generate valid routine after multiple attempts');
            }

        } catch (error) {
            console.error('Error generating routine:', error);
            alert('Failed to generate routine: ' + (error as Error).message);
        } finally {
            setIsGenerating(false);
        }
    };

    const saveRoutine = async () => {
        if (generatedRoutines.length === 0) return;
        setIsSaving(true);
        try {
            const docRef = doc(db, 'settings', `school_routine_${currentSchool?.id}`);
            await setDoc(docRef, {
                routines: generatedRoutines,
                settings,
                updatedAt: new Date().toISOString(),
                schoolId: currentSchool?.id
            });
            alert('Routine saved successfully!');
        } catch (error) {
            console.error('Error saving routine:', error);
            alert('Failed to save routine');
        } finally {
            setIsSaving(false);
        }
    };

    const getMaxPeriodsAcrossDays = () => {
        if (!activeViewClass || generatedRoutines.length === 0) return 0;
        const schedule = generatedRoutines.find(r => r.className === activeViewClass)?.schedule || {};
        let max = 0;
        Object.values(schedule).forEach(periods => {
            if (periods.length > max) max = periods.length;
        });
        return max;
    };

    const getMaxPeriodsAcrossAllClasses = () => {
        if (generatedRoutines.length === 0) return 0;
        let max = 0;
        generatedRoutines.forEach(r => {
            Object.values(r.schedule).forEach(periods => {
                if (periods.length > max) max = periods.length;
            });
        });
        return max;
    };

    return (
        <div className="animate-fade-in" style={{ padding: '0.5rem', maxWidth: '100%', overflow: 'hidden' }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: isReadOnly ? '1fr' : '380px 1fr',
                gap: '2rem'
            }}>

                {/* Left Sidebar: Controls - HIDE IF READ ONLY */}
                {!isReadOnly && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* Multi-Rule Config Container */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <SettingsIcon size={20} color="var(--primary)" /> Routine Rules
                                </h3>
                                <button onClick={addRule} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Plus size={14} /> Add Rule
                                </button>
                            </div>

                            {settings.rules.map((rule, index) => (
                                <div key={rule.id} className="glass-card" style={{ padding: '1.25rem', background: '#f8fafc', position: 'relative', border: '1px solid var(--border)' }}>
                                    {settings.rules.length > 1 && (
                                        <button
                                            onClick={() => removeRule(rule.id)}
                                            style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}

                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '1rem' }}>GROUP {index + 1}</div>

                                    {/* Day Checkboxes */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                                        {DAYS.map(day => (
                                            <label key={day} style={{
                                                display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem',
                                                background: rule.days.includes(day) ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-secondary)',
                                                padding: '0.25rem 0.5rem', borderRadius: '0.25rem', cursor: 'pointer',
                                                border: `1px solid ${rule.days.includes(day) ? 'var(--primary)' : 'var(--border)'}`
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    checked={rule.days.includes(day)}
                                                    onChange={() => toggleDayInRule(rule.id, day)}
                                                    style={{ width: '12px', height: '12px' }}
                                                />
                                                {day.slice(0, 3)}
                                            </label>
                                        ))}
                                    </div>

                                    {/* Start Time */}
                                    <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                                        <label className="field-label" style={{ fontSize: '0.7rem' }}>Start Time of First Period</label>
                                        <input
                                            type="time"
                                            className="input-field"
                                            style={{ height: '2.5rem', fontSize: '0.875rem', color: '#1e293b', backgroundColor: 'white' }}
                                            value={rule.startTime}
                                            onChange={e => updateRule(rule.id, { startTime: e.target.value })}
                                        />
                                    </div>

                                    {/* Recess Count - Chips instead of dropdown */}
                                    <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                                        <label className="field-label" style={{ fontSize: '0.7rem' }}>How many Recess? (Maximum 2)</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            {[
                                                { value: 0, label: 'No Recess' },
                                                { value: 1, label: '1 Recess' },
                                                { value: 2, label: '2 Recess' }
                                            ].map(option => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => updateRule(rule.id, { recessCount: option.value })}
                                                    style={{
                                                        flex: 1,
                                                        padding: '0.75rem 1rem',
                                                        borderRadius: '0.5rem',
                                                        border: rule.recessCount === option.value ? '2px solid var(--primary)' : '2px solid #cbd5e1',
                                                        background: rule.recessCount === option.value ? 'var(--primary)' : 'white',
                                                        color: rule.recessCount === option.value ? 'white' : '#64748b',
                                                        fontSize: '0.875rem',
                                                        fontWeight: rule.recessCount === option.value ? 800 : 600,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        transform: rule.recessCount === option.value ? 'scale(1.02)' : 'scale(1)'
                                                    }}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* SECTION 1: Before First Recess */}
                                    {rule.recessCount >= 0 && (
                                        <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', marginBottom: '0.75rem', border: '1px solid var(--border)' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.75rem' }}>
                                                {rule.recessCount > 0 ? 'Section 1: Before First Recess' : 'All Periods (No Recess)'}
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                                <div className="input-group">
                                                    <label className="field-label" style={{ fontSize: '0.7rem' }}>
                                                        {rule.recessCount > 0 ? 'Periods before First Recess' : 'Total Periods'}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className="input-field"
                                                        style={{ height: '2.5rem', fontSize: '0.875rem', color: '#1e293b', backgroundColor: 'white' }}
                                                        value={rule.periodsBeforeFirstRecess}
                                                        onChange={e => updateRule(rule.id, { periodsBeforeFirstRecess: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                                                    />
                                                </div>
                                                <div className="input-group">
                                                    <label className="field-label" style={{ fontSize: '0.7rem' }}>Period Duration (mins)</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        className="input-field"
                                                        style={{ height: '2.5rem', fontSize: '0.875rem', color: '#1e293b', backgroundColor: 'white' }}
                                                        value={rule.periodDurationBeforeFirstRecess}
                                                        onChange={e => updateRule(rule.id, { periodDurationBeforeFirstRecess: e.target.value === '' ? 40 : parseInt(e.target.value) })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* First Recess Duration */}
                                    {rule.recessCount >= 1 && (
                                        <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                                            <label className="field-label" style={{ fontSize: '0.7rem' }}>First Recess Duration (mins)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                className="input-field"
                                                style={{ height: '2.5rem', fontSize: '0.875rem', color: '#1e293b', backgroundColor: 'white' }}
                                                value={rule.firstRecessDuration}
                                                onChange={e => updateRule(rule.id, { firstRecessDuration: e.target.value === '' ? 15 : parseInt(e.target.value) })}
                                            />
                                        </div>
                                    )}

                                    {/* SECTION 2: After First Recess */}
                                    {rule.recessCount >= 1 && (
                                        <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', marginBottom: '0.75rem', border: '1px solid var(--border)' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.75rem' }}>
                                                {rule.recessCount === 2 ? 'Section 2: Between First and Second Recess' : 'Section 2: After First Recess'}
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                                <div className="input-group">
                                                    <label className="field-label" style={{ fontSize: '0.7rem' }}>
                                                        {rule.recessCount === 2 ? 'Periods until Second Recess' : 'Periods after First Recess'}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className="input-field"
                                                        style={{ height: '2.5rem', fontSize: '0.875rem', color: '#1e293b', backgroundColor: 'white' }}
                                                        value={rule.periodsAfterFirstRecess}
                                                        onChange={e => updateRule(rule.id, { periodsAfterFirstRecess: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                                                    />
                                                </div>
                                                <div className="input-group">
                                                    <label className="field-label" style={{ fontSize: '0.7rem' }}>Period Duration (mins)</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        className="input-field"
                                                        style={{ height: '2.5rem', fontSize: '0.875rem', color: '#1e293b', backgroundColor: 'white' }}
                                                        value={rule.periodDurationAfterFirstRecess}
                                                        onChange={e => updateRule(rule.id, { periodDurationAfterFirstRecess: e.target.value === '' ? 40 : parseInt(e.target.value) })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Second Recess Duration */}
                                    {rule.recessCount >= 2 && (
                                        <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                                            <label className="field-label" style={{ fontSize: '0.7rem' }}>Second Recess Duration (mins)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                className="input-field"
                                                style={{ height: '2.5rem', fontSize: '0.875rem', color: '#1e293b', backgroundColor: 'white' }}
                                                value={rule.secondRecessDuration}
                                                onChange={e => updateRule(rule.id, { secondRecessDuration: e.target.value === '' ? 15 : parseInt(e.target.value) })}
                                            />
                                        </div>
                                    )}

                                    {/* SECTION 3: After Second Recess */}
                                    {rule.recessCount >= 2 && (
                                        <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', marginBottom: '0.75rem', border: '1px solid var(--border)' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.75rem' }}>
                                                Section 3: After Second Recess
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                                <div className="input-group">
                                                    <label className="field-label" style={{ fontSize: '0.7rem' }}>Periods after Second Recess</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className="input-field"
                                                        style={{ height: '2.5rem', fontSize: '0.875rem', color: '#1e293b', backgroundColor: 'white' }}
                                                        value={rule.periodsAfterSecondRecess}
                                                        onChange={e => updateRule(rule.id, { periodsAfterSecondRecess: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                                                    />
                                                </div>
                                                <div className="input-group">
                                                    <label className="field-label" style={{ fontSize: '0.7rem' }}>Period Duration (mins)</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        className="input-field"
                                                        style={{ height: '2.5rem', fontSize: '0.875rem', color: '#1e293b', backgroundColor: 'white' }}
                                                        value={rule.periodDurationAfterSecondRecess}
                                                        onChange={e => updateRule(rule.id, { periodDurationAfterSecondRecess: e.target.value === '' ? 40 : parseInt(e.target.value) })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Teacher Workload Limit */}
                        <div className="glass-card" style={{ padding: '1.25rem', background: 'white' }}>
                            <h3 style={{ fontSize: '0.875rem', fontWeight: 800, marginBottom: '0.75rem', textTransform: 'uppercase' }}>Teacher Workload Limit</h3>
                            <div className="input-group">
                                <label className="field-label" style={{ fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>
                                    Maximum Classes Per Teacher (Per Day)
                                </label>
                                <input
                                    type="number"
                                    className="input-field"
                                    min="1"
                                    max="10"
                                    style={{ height: '2.75rem', fontSize: '0.875rem', width: '100%' }}
                                    value={settings.maxClassesPerTeacher}
                                    onChange={e => setSettings({ ...settings, maxClassesPerTeacher: parseInt(e.target.value) || 5 })}
                                />
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                    AI will ensure no teacher is assigned more than this many classes in a single day.
                                </div>
                            </div>
                        </div>

                        {/* Special Instructions */}
                        <div className="glass-card" style={{ padding: '1.25rem', background: 'white' }}>
                            <h3 style={{ fontSize: '0.875rem', fontWeight: 800, marginBottom: '0.75rem', textTransform: 'uppercase' }}>Special AI Instructions</h3>
                            <textarea
                                className="input-field"
                                placeholder="e.g. Saturday classes: drawing, games, activity, storytelling. Focus on sports in last periods..."
                                style={{ minHeight: '100px', fontSize: '0.875rem', padding: '0.75rem', resize: 'vertical' }}
                                value={settings.specialInstructions}
                                onChange={e => setSettings({ ...settings, specialInstructions: e.target.value })}
                            />
                        </div>

                        <div className="glass-card" style={{ padding: '1.5rem', background: 'white' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '0.875rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>Target Classes</h3>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => setSettings({ ...settings, selectedClasses: classes.map(c => c.name) })}
                                        style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--primary)', color: 'var(--primary)', background: 'none', cursor: 'pointer' }}
                                    >
                                        Select All
                                    </button>
                                    <button
                                        onClick={() => setSettings({ ...settings, selectedClasses: [] })}
                                        style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'none', cursor: 'pointer' }}
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem' }}>
                                {classes.map(cls => (
                                    <label key={cls.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', cursor: 'pointer', padding: '0.4rem', borderRadius: '0.5rem', background: settings.selectedClasses.includes(cls.name) ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-secondary)', border: `1px solid ${settings.selectedClasses.includes(cls.name) ? 'var(--primary)' : 'var(--border)'}` }}>
                                        <input
                                            type="checkbox"
                                            checked={settings.selectedClasses.includes(cls.name)}
                                            onChange={() => handleClassToggle(cls.name)}
                                        />
                                        {cls.name}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Hidden: Apply Rules & Magic Generate button */}
                        {false && (
                            <>
                                <button
                                    className="btn btn-primary"
                                    style={{ width: '100%', height: '3.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', fontSize: '1rem', fontWeight: 800 }}
                                    onClick={generateRoutine}
                                    disabled={isGenerating}
                                >
                                    {isGenerating ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={24} />}
                                    {isGenerating ? 'Generating specialized routine...' : 'Apply Rules & Magic Generate'}
                                </button>

                                <div style={{ textAlign: 'center', margin: '1rem 0', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>OR</div>
                            </>
                        )}

                        <button
                            className="btn btn-secondary"
                            style={{ width: '100%', height: '3.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', fontSize: '1rem', fontWeight: 800, border: '2px solid var(--primary)', color: 'var(--primary)' }}
                            onClick={() => {
                                if (settings.selectedClasses.length === 0) {
                                    alert('Please select at least one class');
                                    return;
                                }
                                setManualEditClass(settings.selectedClasses[0]);
                                setShowManualEditor(true);
                            }}
                        >
                            <Edit size={24} />
                            Manual Entry (Create Routine Yourself)
                        </button>
                    </div>
                )}

                {/* Right Area: Preview */}
                <div style={{ minWidth: 0 }}>
                    {generatedRoutines.length === 0 ? (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.5)', borderRadius: '1.5rem', border: '2px dashed var(--border)', padding: '4rem', textAlign: 'center' }}>
                            <div style={{ padding: '2rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '50%', marginBottom: '1.5rem' }}>
                                <Calendar size={64} style={{ color: 'var(--primary)' }} />
                            </div>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '0.5rem' }}>Ready for Specialized Routing</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '450px' }}>
                                Define separate rules for your day groups (like Friday or Saturday) and provide special tokens. Our AI will handle the complexity.
                            </p>
                        </div>
                    ) : (
                        <div className="glass-card" style={{ padding: '2rem', background: 'white', minHeight: '600px' }}>
                            {/* View Mode Toggle - HIDE IF FIXED TEACHER */}
                            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', paddingBottom: '1rem' }}>
                                <button
                                    onClick={() => setViewMode('class')}
                                    style={{
                                        padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none',
                                        background: viewMode === 'class' ? 'var(--primary)' : 'transparent',
                                        color: viewMode === 'class' ? 'white' : 'var(--text-main)',
                                        fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    Class-wise View
                                </button>
                                <button
                                    onClick={() => {
                                        setViewMode('teacher');
                                        setSelectedViewDay('Weekly View');
                                    }}
                                    style={{
                                        padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none',
                                        background: viewMode === 'teacher' ? 'var(--primary)' : 'transparent',
                                        color: viewMode === 'teacher' ? 'white' : 'var(--text-main)',
                                        fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    {fixedTeacherName ? 'My Routine' : 'Teacher-wise View'}
                                </button>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
                                {viewMode === 'class' ? (
                                    <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', flex: 1 }} className="no-scrollbar">
                                        {generatedRoutines.map(r => (
                                            <button
                                                key={r.className}
                                                onClick={() => setActiveViewClass(r.className)}
                                                style={{
                                                    padding: '0.625rem 1.25rem',
                                                    borderRadius: '0.75rem',
                                                    border: 'none',
                                                    background: activeViewClass === r.className ? 'var(--primary)' : 'var(--bg-secondary)',
                                                    color: activeViewClass === r.className ? 'white' : 'var(--text-main)',
                                                    fontWeight: 700,
                                                    fontSize: '0.875rem',
                                                    whiteSpace: 'nowrap',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {r.className}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: '1rem', flex: 1, alignItems: 'center' }}>
                                        <div style={{ minWidth: '200px' }}>
                                            {(fixedTeacherName && fixedTeacherName.trim()) ? (
                                                <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.25rem' }}>
                                                    {fixedTeacherName}'s Timetable
                                                </div>
                                            ) : (
                                                <StyledSelect
                                                    value={selectedTeacher}
                                                    onChange={e => setSelectedTeacher(e.target.value)}
                                                    style={{ height: '2.5rem', fontSize: '0.875rem' }}
                                                >
                                                    <option value="">Select Teacher...</option>
                                                    {Array.from(new Set(
                                                        generatedRoutines.flatMap(r =>
                                                            Object.values(r.schedule).flatMap(day =>
                                                                day.filter(p => p.teacher && p.teacher !== 'N/A').map(p => p.teacher)
                                                            )
                                                        )
                                                    )).sort().map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </StyledSelect>
                                            )}
                                        </div>
                                        {(!fixedTeacherName || !fixedTeacherName.trim()) && (
                                            <div style={{ minWidth: '150px' }}>
                                                <StyledSelect
                                                    value={selectedViewDay}
                                                    onChange={e => setSelectedViewDay(e.target.value as any)}
                                                    style={{ height: '2.5rem', fontSize: '0.875rem' }}
                                                >
                                                    <option value="Weekly View">Weekly View</option>
                                                    {DAYS.map(day => (
                                                        <option key={day} value={day}>{day}</option>
                                                    ))}
                                                </StyledSelect>
                                            </div>
                                        )}
                                        {selectedTeacher && selectedViewDay !== 'Weekly View' && (
                                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                {generatedRoutines.reduce((acc, r) => {
                                                    const daySchedule = r.schedule[selectedViewDay as any] || [];
                                                    return acc + daySchedule.filter(p => p.teacher === selectedTeacher).length;
                                                }, 0)} classes on {selectedViewDay}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {!isReadOnly && (
                                        <button className="btn" style={{ border: '1px solid var(--primary)', color: 'var(--primary)', fontWeight: 700 }} onClick={saveRoutine} disabled={isSaving}>
                                            <Save size={18} /> {isSaving ? 'Saving...' : 'Save All'}
                                        </button>
                                    )}
                                    <button className="btn btn-secondary" onClick={() => window.print()}>
                                        <Printer size={18} /> Print
                                    </button>
                                </div>
                            </div>

                            {viewMode === 'class' ? (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc' }}>
                                                <th style={{ padding: '1rem', border: '1px solid var(--border)', textAlign: 'center', width: '100px' }}>Day</th>
                                                {Array.from({ length: getMaxPeriodsAcrossDays() }).map((_, i) => {
                                                    // Find if this slot is a break/lunch across any day for this class
                                                    const schedule = generatedRoutines.find(r => r.className === activeViewClass)?.schedule || {};
                                                    let isBreakSlot = false;
                                                    let slotLabel = '';

                                                    // Check all days to see if this index is consistently a break
                                                    for (const day of DAYS) {
                                                        const daySchedule = schedule[day] || [];
                                                        const period = daySchedule[i];
                                                        if (period && (period.type === 'break' || period.type === 'lunch')) {
                                                            isBreakSlot = true;
                                                            slotLabel = period.subject || (period.type === 'lunch' ? 'Lunch' : 'Break');
                                                            break;
                                                        }
                                                    }

                                                    return (
                                                        <th key={i} style={{ padding: '1rem', border: '1px solid var(--border)', textAlign: 'center' }}>
                                                            {isBreakSlot ? slotLabel : `Period ${i + 1 - Array.from({ length: i }).filter((_, idx) => {
                                                                for (const day of DAYS) {
                                                                    const daySchedule = schedule[day] || [];
                                                                    const p = daySchedule[idx];
                                                                    if (p && (p.type === 'break' || p.type === 'lunch')) return true;
                                                                }
                                                                return false;
                                                            }).length}`}
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {DAYS.map(day => {
                                                const daySchedule = generatedRoutines.find(r => r.className === activeViewClass)?.schedule[day] || [];
                                                return (
                                                    <tr key={day}>
                                                        <td style={{ padding: '1.25rem 1rem', border: '1px solid var(--border)', fontWeight: 800, background: '#f1f5f9', textAlign: 'center', fontSize: '0.8125rem' }}>
                                                            {day.toUpperCase()}
                                                        </td>
                                                        {Array.from({ length: getMaxPeriodsAcrossDays() }).map((_, idx) => {
                                                            const period = daySchedule[idx];
                                                            if (!period) return <td key={idx} style={{ border: '1px solid var(--border)', background: 'rgba(0,0,0,0.02)' }}></td>;

                                                            const isBreak = period.type === 'break' || period.type === 'lunch';
                                                            return (
                                                                <td key={idx} style={{
                                                                    padding: '0.75rem',
                                                                    border: '1px solid var(--border)',
                                                                    textAlign: 'center',
                                                                    background: isBreak ? 'rgba(245, 158, 11, 0.05)' : 'transparent'
                                                                }}>
                                                                    {isBreak ? (
                                                                        <div style={{ fontWeight: 800, color: '#f59e0b', fontSize: '0.75rem' }}>{period.subject.toUpperCase()}</div>
                                                                    ) : (
                                                                        <>
                                                                            <div style={{ fontWeight: 800, fontSize: '0.8125rem', color: 'var(--primary)' }}>{period.subject}</div>
                                                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{period.teacher}</div>
                                                                            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: '0.25rem', opacity: 0.6 }}>{period.startTime}-{period.endTime}</div>
                                                                        </>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    {!selectedTeacher ? (
                                        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            <Users size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                            <p>Please select a teacher to view their schedule.</p>
                                        </div>
                                    ) : selectedViewDay === 'Weekly View' ? (
                                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)' }}>
                                            <thead>
                                                <tr style={{ background: '#f8fafc' }}>
                                                    <th style={{ padding: '1rem', border: '1px solid var(--border)', textAlign: 'center', width: '100px' }}>Day</th>
                                                    {Array.from({ length: getMaxPeriodsAcrossAllClasses() }).map((_, i) => (
                                                        <th key={i} style={{ padding: '1rem', border: '1px solid var(--border)', textAlign: 'center' }}>
                                                            P{i + 1}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {DAYS.map(day => {
                                                    const dayClasses: any[] = [];
                                                    generatedRoutines.forEach(r => {
                                                        const schedule = r.schedule[day] || [];
                                                        schedule.forEach((p, idx) => {
                                                            if (p.teacher?.trim() === selectedTeacher.trim()) {
                                                                dayClasses.push({ ...p, className: r.className, periodIndex: idx });
                                                            }
                                                        });
                                                    });

                                                    return (
                                                        <tr key={day}>
                                                            <td style={{ padding: '1.25rem 1rem', border: '1px solid var(--border)', fontWeight: 800, background: '#f1f5f9', textAlign: 'center', fontSize: '0.8125rem' }}>
                                                                {day.toUpperCase()}
                                                            </td>
                                                            {Array.from({ length: getMaxPeriodsAcrossAllClasses() }).map((_, idx) => {
                                                                const period = dayClasses.find(p => p.periodIndex === idx);
                                                                if (!period) return <td key={idx} style={{ border: '1px solid var(--border)', background: 'rgba(0,0,0,0.02)' }}></td>;

                                                                return (
                                                                    <td key={idx} style={{
                                                                        padding: '0.75rem',
                                                                        border: '1px solid var(--border)',
                                                                        textAlign: 'center',
                                                                    }}>
                                                                        <div style={{ fontWeight: 800, fontSize: '0.8125rem', color: 'var(--primary)' }}>{period.className}</div>
                                                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{period.subject}</div>
                                                                        <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: '0.25rem', opacity: 0.6 }}>{period.startTime}-{period.endTime}</div>
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)' }}>
                                            <thead>
                                                <tr style={{ background: '#f8fafc' }}>
                                                    <th style={{ padding: '1rem', border: '1px solid var(--border)', textAlign: 'left' }}>Time Slot</th>
                                                    <th style={{ padding: '1rem', border: '1px solid var(--border)', textAlign: 'left' }}>Class</th>
                                                    <th style={{ padding: '1rem', border: '1px solid var(--border)', textAlign: 'left' }}>Subject</th>
                                                    <th style={{ padding: '1rem', border: '1px solid var(--border)', textAlign: 'center' }}>Period</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    const teacherSchedule: any[] = [];
                                                    generatedRoutines.forEach(r => {
                                                        const daySchedule = r.schedule[selectedViewDay as any] || [];
                                                        daySchedule.forEach((p, idx) => {
                                                            if (p.teacher?.trim() === selectedTeacher.trim()) {
                                                                teacherSchedule.push({
                                                                    ...p,
                                                                    className: r.className,
                                                                    periodIndex: idx + 1
                                                                });
                                                            }
                                                        });
                                                    });

                                                    // Sort by start time
                                                    teacherSchedule.sort((a, b) => a.startTime.localeCompare(b.startTime));

                                                    if (teacherSchedule.length === 0) {
                                                        return (
                                                            <tr>
                                                                <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                                    No classes assigned to {selectedTeacher} on {selectedViewDay}.
                                                                </td>
                                                            </tr>
                                                        );
                                                    }

                                                    return teacherSchedule.map((p, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                                            <td style={{ padding: '1rem', borderRight: '1px solid var(--border)', fontWeight: 700, color: 'var(--primary)' }}>
                                                                {p.startTime} - {p.endTime}
                                                            </td>
                                                            <td style={{ padding: '1rem', borderRight: '1px solid var(--border)', fontWeight: 600 }}>
                                                                {p.className}
                                                            </td>
                                                            <td style={{ padding: '1rem', borderRight: '1px solid var(--border)' }}>
                                                                {p.subject}
                                                            </td>
                                                            <td style={{ padding: '1rem', textAlign: 'center', background: '#f8fafc', fontWeight: 700 }}>
                                                                P{p.periodIndex}
                                                            </td>
                                                        </tr>
                                                    ));
                                                })()}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Manual Editor Modal */}
            {
                showManualEditor && (
                    <ManualRoutineEditor
                        selectedClass={manualEditClass}
                        settings={settings}
                        subjects={subjects}
                        onClose={() => {
                            setShowManualEditor(false);
                            loadRoutine();
                        }}
                    />
                )
            }

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                    .glass-card { border: none !important; box-shadow: none !important; }
                }
            `}</style>
        </div >
    );
};

export default RoutineManager;
