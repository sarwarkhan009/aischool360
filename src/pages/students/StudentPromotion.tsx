import React, { useState, useMemo } from 'react';
import {
    Users,
    ChevronRight,
    Home,
    ArrowUpCircle,
    Check,
    AlertCircle,
    GraduationCap,
    Loader2,
    ToggleLeft,
    ToggleRight,
    ArrowRight
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';
import { useParams } from 'react-router-dom';
import { getActiveClasses, CLASS_ORDER, sortClasses } from '../../constants/app';
import { formatClassName } from '../../utils/formatters';

const StudentPromotion: React.FC = () => {
    const { schoolId } = useParams();
    const { currentSchool } = useSchool();
    const { data: students, update: updateStudent } = useFirestore<any>('students');
    const { data: allSettings } = useFirestore<any>('settings');
    const { data: academicYears } = useFirestore<any>('academic_years');

    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('ALL');
    const [promotionMap, setPromotionMap] = useState<Record<string, boolean>>({});
    const [newRollMap, setNewRollMap] = useState<Record<string, string>>({});
    const [newSectionMap, setNewSectionMap] = useState<Record<string, string>>({});
    const [promoting, setPromoting] = useState(false);
    const [promotionDone, setPromotionDone] = useState(false);
    const [promotedCount, setPromotedCount] = useState(0);
    const [alumniCount, setAlumniCount] = useState(0);

    const activeFY = currentSchool?.activeFinancialYear || '2025-26';

    // Get active classes from settings — filter by CURRENT year for the source class list
    const activeClassesData = getActiveClasses(allSettings?.filter((d: any) => d.type === 'class') || [], activeFY);
    const activeClassesList = activeClassesData.map(c => c.name);
    const sortedActiveClasses = sortClasses(activeClassesList);

    // Determine next FY from academic_years collection
    const schoolAcademicYears = academicYears?.filter((y: any) => y.schoolId === currentSchool?.id && !y.isArchived) || [];
    const activeAcademicYear = schoolAcademicYears.find((y: any) => y.isActive);
    const sortedYears = [...schoolAcademicYears].sort((a, b) => a.name.localeCompare(b.name));
    const activeIdx = sortedYears.findIndex(y => y.id === activeAcademicYear?.id);
    const nextAcademicYear = activeIdx >= 0 && activeIdx < sortedYears.length - 1
        ? sortedYears[activeIdx + 1]
        : null;
    const targetFY = nextAcademicYear?.name || '';

    // Get classes from the TARGET year (next FY) for section assignment and next-class lookup
    const targetClassesData = useMemo(() => {
        if (!targetFY) return [];
        return getActiveClasses(allSettings?.filter((d: any) => d.type === 'class') || [], targetFY);
    }, [allSettings, targetFY]);
    const targetClassesList = targetClassesData.map(c => c.name);

    // Get next class using CLASS_ORDER + target year's active classes (fallback to source year)
    const getNextClass = (currentClass: string): string | null => {
        const currentIdx = CLASS_ORDER.indexOf(currentClass);
        if (currentIdx === -1) return null;

        // Use target year classes if available, otherwise fallback to source year classes
        const classListToCheck = targetClassesList.length > 0 ? targetClassesList : activeClassesList;

        // Find next class in CLASS_ORDER that exists in the target active classes
        for (let i = currentIdx + 1; i < CLASS_ORDER.length; i++) {
            if (classListToCheck.includes(CLASS_ORDER[i])) {
                return CLASS_ORDER[i];
            }
        }
        // No next class available → ALUMNI
        return null;
    };

    // Filter students for selected class/section — sorted by roll number
    const classStudents = useMemo(() => {
        if (!selectedClass) return [];
        return students
            .filter((s: any) => {
                if (s.status === 'ALUMNI') return false;
                const matchClass = s.class === selectedClass;
                const matchSection = selectedSection === 'ALL' || s.section === selectedSection;
                return matchClass && matchSection;
            })
            .sort((a: any, b: any) => {
                const rollA = parseInt(a.rollNo) || 9999;
                const rollB = parseInt(b.rollNo) || 9999;
                if (rollA !== rollB) return rollA - rollB;
                return (a.fullName || a.name || '').localeCompare(b.fullName || b.name || '');
            });
    }, [students, selectedClass, selectedSection]);

    const nextClass = selectedClass ? getNextClass(selectedClass) : null;
    const isLastClass = selectedClass && nextClass === null;


    // Get sections defined for the TARGET class (class students are promoted into)
    const targetClassSections = useMemo(() => {
        if (!nextClass) return ['A'];
        const targetClassData = targetClassesData.find((c: any) => c.name === nextClass);
        const sections = targetClassData?.sections;
        return sections && sections.length > 0 ? sections : ['A'];
    }, [nextClass, targetClassesData]);

    const handleClassChange = (cls: string) => {
        setSelectedClass(cls);
        setSelectedSection('ALL');
        setPromotionDone(false);
        setNewRollMap({});
        // Populate promotion map (all ON) and default section to 'A'
        const studentsInClass = students.filter((s: any) => s.class === cls && s.status !== 'ALUMNI');
        const map: Record<string, boolean> = {};
        const secMap: Record<string, string> = {};
        studentsInClass.forEach((s: any) => {
            map[s.id] = true;
            secMap[s.id] = s.section || 'A'; // default to current section or 'A'
        });
        setPromotionMap(map);
        setNewSectionMap(secMap);
    };

    // Toggle a student
    const toggleStudent = (studentId: string) => {
        setPromotionMap(prev => ({ ...prev, [studentId]: !prev[studentId] }));
    };

    // Toggle all
    const toggleAll = () => {
        const allOn = classStudents.every(s => promotionMap[s.id]);
        const map: Record<string, boolean> = {};
        classStudents.forEach((s: any) => { map[s.id] = !allOn; });
        setPromotionMap(prev => ({ ...prev, ...map }));
    };

    // Get sections for selected class
    const sections = useMemo(() => {
        if (!selectedClass) return [];
        const set = new Set<string>();
        students.filter((s: any) => s.class === selectedClass && s.status !== 'ALUMNI')
            .forEach((s: any) => { if (s.section) set.add(s.section); });
        return Array.from(set).sort();
    }, [students, selectedClass]);

    const studentsToPromote = classStudents.filter(s => promotionMap[s.id]);

    // Handle Promotion
    const handlePromote = async () => {
        if (!targetFY) {
            alert('⚠️ No target financial year found. Please create the next academic year in Academic Year Manager first.');
            return;
        }

        if (studentsToPromote.length === 0) {
            alert('No students selected for promotion.');
            return;
        }

        const targetClassName = nextClass || 'ALUMNI';
        const confirmMessage = isLastClass
            ? `⚠️ ${studentsToPromote.length} student(s) will be marked as ALUMNI (no next class available).\n\nTarget FY: ${targetFY}\n\nThis action cannot be undone. Continue?`
            : `Promote ${studentsToPromote.length} student(s) from ${formatClassName(selectedClass, currentSchool?.useRomanNumerals)} → ${formatClassName(targetClassName, currentSchool?.useRomanNumerals)}?\n\nTarget FY: ${targetFY}\nAdmission Type: OLD\n\nThis action cannot be undone. Continue?`;

        if (!window.confirm(confirmMessage)) return;

        setPromoting(true);
        let promoted = 0;
        let alumni = 0;

        try {
            for (const student of studentsToPromote) {
                const updateData: any = {
                    previousClass: student.class,
                    previousSection: student.section || '',
                    previousRollNo: student.rollNo || '',
                    session: targetFY,
                    admissionType: 'OLD',
                    promotedAt: new Date().toISOString(),
                    promotedFromFY: activeFY,
                    updatedAt: new Date().toISOString()
                };

                // Set new roll number if provided
                const newRoll = newRollMap[student.id]?.trim();
                if (newRoll) {
                    updateData.rollNo = newRoll;
                }

                // Set new section
                const newSection = newSectionMap[student.id]?.trim();
                if (newSection) {
                    updateData.section = newSection;
                }

                if (isLastClass) {
                    updateData.status = 'ALUMNI';
                    alumni++;
                } else {
                    updateData.class = nextClass;
                    updateData.status = 'ACTIVE';
                    promoted++;
                }

                await updateStudent(student.id, updateData);
            }

            setPromotedCount(promoted);
            setAlumniCount(alumni);
            setPromotionDone(true);
        } catch (error) {
            console.error('Error promoting students:', error);
            alert('Error during promotion: ' + (error as Error).message);
        } finally {
            setPromoting(false);
        }
    };

    return (
        <div className="animate-fade-in no-scrollbar" style={{ paddingBottom: '4rem' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                padding: '1.25rem',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: 'white',
                boxShadow: '0 10px 25px rgba(99, 102, 241, 0.3)'
            }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.375rem', letterSpacing: '-0.025em' }}>
                        <ArrowUpCircle size={22} style={{ display: 'inline', verticalAlign: 'bottom', marginRight: '0.375rem' }} />
                        Promote Students
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', opacity: 0.9, flexWrap: 'wrap' }}>
                        <Home size={12} /> Home <ChevronRight size={10} /> Students <ChevronRight size={10} /> Promotion
                        <span style={{ background: 'rgba(255,255,255,0.25)', padding: '0.15rem 0.5rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.6875rem' }}>
                            {activeFY} → {targetFY || '?'}
                        </span>
                    </div>
                </div>
            </div>

            {/* No Target FY Warning */}
            {!targetFY && (
                <div className="glass-card" style={{
                    padding: '2rem',
                    marginBottom: '2rem',
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '2px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '16px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <AlertCircle size={32} style={{ color: '#ef4444', flexShrink: 0 }} />
                        <div>
                            <h3 style={{ color: '#ef4444', margin: 0, fontWeight: 800 }}>Target Financial Year Not Found</h3>
                            <p style={{ color: '#64748b', margin: '0.5rem 0 0', fontSize: '0.875rem' }}>
                                Please create the next academic year (e.g., {getNextFYName(activeFY)}) in the <strong>Academic Year Manager</strong> before promoting students.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Class & Section Selector */}
            <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={18} style={{ color: '#6366f1' }} />
                    Select Class
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))', gap: '0.5rem' }}>
                    {sortedActiveClasses.map(cls => (
                        <button
                            key={cls}
                            onClick={() => handleClassChange(cls)}
                            style={{
                                padding: '0.5rem 0.25rem',
                                borderRadius: '8px',
                                border: selectedClass === cls ? '2px solid #6366f1' : '1px solid var(--border)',
                                background: selectedClass === cls ? '#6366f1' : 'white',
                                color: selectedClass === cls ? 'white' : 'var(--text-main)',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                textAlign: 'center',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {formatClassName(cls, currentSchool?.useRomanNumerals)}
                        </button>
                    ))}
                </div>

                {/* Section filter */}
                {selectedClass && sections.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#64748b' }}>Section:</span>
                        <button
                            onClick={() => setSelectedSection('ALL')}
                            style={{
                                padding: '0.375rem 0.75rem',
                                borderRadius: '8px',
                                border: selectedSection === 'ALL' ? '2px solid #6366f1' : '1px solid var(--border)',
                                background: selectedSection === 'ALL' ? '#6366f1' : 'white',
                                color: selectedSection === 'ALL' ? 'white' : 'var(--text-main)',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                            }}
                        >
                            All
                        </button>
                        {sections.map(sec => (
                            <button
                                key={sec}
                                onClick={() => setSelectedSection(sec)}
                                style={{
                                    padding: '0.375rem 0.75rem',
                                    borderRadius: '8px',
                                    border: selectedSection === sec ? '2px solid #6366f1' : '1px solid var(--border)',
                                    background: selectedSection === sec ? '#6366f1' : 'white',
                                    color: selectedSection === sec ? 'white' : 'var(--text-main)',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    cursor: 'pointer'
                                }}
                            >
                                {sec}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Promotion Target Info */}
            {selectedClass && (
                <div className="glass-card" style={{
                    padding: '1.25rem 1.5rem',
                    marginBottom: '2rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    background: isLastClass ? 'rgba(245, 158, 11, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                    border: `2px solid ${isLastClass ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                    borderRadius: '14px'
                }}>
                    {isLastClass ? (
                        <>
                            <GraduationCap size={28} style={{ color: '#f59e0b', flexShrink: 0 }} />
                            <div>
                                <div style={{ fontWeight: 800, color: '#92400e', fontSize: '1rem' }}>
                                    {formatClassName(selectedClass, currentSchool?.useRomanNumerals)} → ALUMNI
                                </div>
                                <div style={{ fontSize: '0.8125rem', color: '#a16207' }}>
                                    This is the last class in your school. Students will be marked as <strong>ALUMNI</strong>.
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <ArrowRight size={28} style={{ color: '#10b981', flexShrink: 0 }} />
                            <div>
                                <div style={{ fontWeight: 800, color: '#065f46', fontSize: '1rem' }}>
                                    {formatClassName(selectedClass, currentSchool?.useRomanNumerals)} → {formatClassName(nextClass!, currentSchool?.useRomanNumerals)}
                                </div>
                                <div style={{ fontSize: '0.8125rem', color: '#047857' }}>
                                    Students will be promoted to {formatClassName(nextClass!, currentSchool?.useRomanNumerals)} • Session: {targetFY} • Type: OLD
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Student List */}
            {selectedClass && classStudents.length > 0 && !promotionDone && (
                <div className="glass-card" style={{ padding: 0, overflow: 'hidden', marginBottom: '2rem' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                        padding: '1rem 1.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <h3 style={{ color: 'white', margin: 0, fontWeight: 800, fontSize: '1rem' }}>
                            Students ({studentsToPromote.length}/{classStudents.length} selected)
                        </h3>
                        <button
                            onClick={toggleAll}
                            style={{
                                background: 'rgba(255,255,255,0.15)',
                                color: 'white',
                                border: '1px solid rgba(255,255,255,0.3)',
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem'
                            }}
                        >
                            {classStudents.every(s => promotionMap[s.id]) ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                            {classStudents.every(s => promotionMap[s.id]) ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    <div>
                        {classStudents.map((student: any, idx: number) => (
                            <div
                                key={student.id}
                                style={{
                                    padding: '0.75rem 1rem',
                                    borderBottom: idx < classStudents.length - 1 ? '1px solid var(--border)' : 'none',
                                    background: promotionMap[student.id] ? 'rgba(99, 102, 241, 0.03)' : 'rgba(239, 68, 68, 0.02)',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {/* Row 1: Roll + Toggle + Name + Status */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                    {/* Roll Number Badge */}
                                    <div style={{
                                        minWidth: '32px',
                                        textAlign: 'center',
                                        fontWeight: 800,
                                        fontSize: '0.8125rem',
                                        color: '#6366f1',
                                        background: 'rgba(99, 102, 241, 0.08)',
                                        borderRadius: '6px',
                                        padding: '0.2rem 0.375rem',
                                        flexShrink: 0
                                    }}>
                                        {student.rollNo || '—'}
                                    </div>

                                    {/* Toggle Switch */}
                                    <div
                                        onClick={() => toggleStudent(student.id)}
                                        style={{
                                            width: '40px',
                                            minWidth: '40px',
                                            height: '22px',
                                            borderRadius: '11px',
                                            background: promotionMap[student.id] ? '#6366f1' : '#e2e8f0',
                                            position: 'relative',
                                            transition: 'background 0.2s',
                                            cursor: 'pointer',
                                            flexShrink: 0
                                        }}>
                                        <div style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '50%',
                                            background: 'white',
                                            position: 'absolute',
                                            top: '2px',
                                            left: promotionMap[student.id] ? '20px' : '2px',
                                            transition: 'left 0.2s',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                        }} />
                                    </div>

                                    {/* Student Name + Info */}
                                    <div
                                        onClick={() => toggleStudent(student.id)}
                                        style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
                                    >
                                        <div style={{
                                            fontWeight: 700,
                                            fontSize: '0.8125rem',
                                            color: promotionMap[student.id] ? 'var(--text-main)' : '#94a3b8',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            {(student.fullName || student.name || 'N/A').toUpperCase()}
                                        </div>
                                        <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                                            {student.admissionNo}{student.section ? ` • ${student.section}` : ''}
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <span style={{
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: '6px',
                                        fontSize: '0.625rem',
                                        fontWeight: 700,
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                        background: promotionMap[student.id]
                                            ? (isLastClass ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)')
                                            : 'rgba(100, 116, 139, 0.1)',
                                        color: promotionMap[student.id]
                                            ? (isLastClass ? '#b45309' : '#059669')
                                            : '#94a3b8'
                                    }}>
                                        {promotionMap[student.id]
                                            ? (isLastClass ? 'ALUMNI' : `→ ${formatClassName(nextClass!, currentSchool?.useRomanNumerals)}`)
                                            : 'SKIP'}
                                    </span>
                                </div>

                                {/* Row 2: New Roll + Section */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', paddingLeft: '74px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', whiteSpace: 'nowrap' }}>New Roll:</span>
                                    <input
                                        type="text"
                                        placeholder="—"
                                        value={newRollMap[student.id] || ''}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setNewRollMap(prev => ({ ...prev, [student.id]: val }));
                                        }}
                                        style={{
                                            width: '70px',
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '6px',
                                            border: '1.5px solid var(--border)',
                                            fontSize: '0.8125rem',
                                            fontWeight: 700,
                                            textAlign: 'center',
                                            outline: 'none',
                                            background: newRollMap[student.id] ? 'rgba(99, 102, 241, 0.05)' : 'white',
                                            color: 'var(--text-main)',
                                            transition: 'border-color 0.2s'
                                        }}
                                        onFocus={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                                        onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                                    />

                                    {/* Section Chips */}
                                    {!isLastClass && targetClassSections.length > 0 && (
                                        <>
                                            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: '0.25rem' }}>Sec:</span>
                                            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                                {targetClassSections.map((sec: string) => {
                                                    const isSelected = (newSectionMap[student.id] || 'A') === sec;
                                                    return (
                                                        <button
                                                            key={sec}
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setNewSectionMap(prev => ({ ...prev, [student.id]: sec }));
                                                            }}
                                                            style={{
                                                                padding: '0.2rem 0.6rem',
                                                                borderRadius: '6px',
                                                                border: isSelected ? '2px solid #6366f1' : '1.5px solid var(--border)',
                                                                background: isSelected ? '#6366f1' : 'white',
                                                                color: isSelected ? 'white' : 'var(--text-main)',
                                                                fontWeight: 700,
                                                                fontSize: '0.6875rem',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.15s ease',
                                                                minWidth: '28px',
                                                                textAlign: 'center'
                                                            }}
                                                        >
                                                            {sec}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Promote Button */}
                    <div style={{
                        padding: '1rem',
                        borderTop: '2px solid var(--border)',
                        background: '#f8fafc',
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.75rem'
                    }}>
                        <div style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 600 }}>
                            {studentsToPromote.length} student(s) will be promoted
                        </div>
                        <button
                            onClick={handlePromote}
                            disabled={promoting || studentsToPromote.length === 0 || !targetFY}
                            style={{
                                background: (promoting || studentsToPromote.length === 0 || !targetFY) ? '#94a3b8' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                color: 'white',
                                padding: '0.75rem 1.5rem',
                                fontSize: '0.9375rem',
                                fontWeight: 800,
                                borderRadius: '12px',
                                border: 'none',
                                cursor: (promoting || studentsToPromote.length === 0 || !targetFY) ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
                                transition: 'all 0.3s',
                                width: '100%',
                                justifyContent: 'center'
                            }}
                        >
                            {promoting ? (
                                <><Loader2 size={18} className="animate-spin" /> Promoting...</>
                            ) : (
                                <><ArrowUpCircle size={18} /> Promote Students</>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {selectedClass && classStudents.length === 0 && !promotionDone && (
                <div className="glass-card" style={{ padding: '4rem', textAlign: 'center' }}>
                    <AlertCircle size={48} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: '1rem' }} />
                    <h3 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>No Students Found</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        No active students found in {formatClassName(selectedClass, currentSchool?.useRomanNumerals)}
                        {selectedSection !== 'ALL' ? ` Section ${selectedSection}` : ''}.
                    </p>
                </div>
            )}

            {/* Promotion Success */}
            {promotionDone && (
                <div className="glass-card" style={{
                    padding: '3rem',
                    textAlign: 'center',
                    background: 'rgba(16, 185, 129, 0.05)',
                    border: '2px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '20px'
                }}>
                    <div style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem'
                    }}>
                        <Check size={36} color="white" />
                    </div>
                    <h2 style={{ color: '#065f46', fontWeight: 900, fontSize: '1.5rem', marginBottom: '0.75rem' }}>
                        Promotion Complete! 🎉
                    </h2>
                    <p style={{ color: '#047857', fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
                        {promotedCount > 0 && `${promotedCount} student(s) promoted to ${formatClassName(nextClass || '', currentSchool?.useRomanNumerals)}`}
                        {promotedCount > 0 && alumniCount > 0 && ' • '}
                        {alumniCount > 0 && `${alumniCount} student(s) marked as ALUMNI`}
                    </p>
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                        Session: {targetFY} • Admission Type: OLD
                    </p>
                    <button
                        onClick={() => {
                            setPromotionDone(false);
                            setSelectedClass('');
                            setPromotionMap({});
                        }}
                        style={{
                            marginTop: '1.5rem',
                            background: '#6366f1',
                            color: 'white',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '10px',
                            border: 'none',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '0.875rem'
                        }}
                    >
                        Promote Another Class
                    </button>
                </div>
            )}
        </div>
    );
};

// Helper to generate next FY name
function getNextFYName(currentFY: string): string {
    const parts = currentFY.split('-');
    if (parts.length === 2) {
        const startYear = parseInt(parts[0]);
        const endYear = parseInt(parts[1]);
        if (!isNaN(startYear) && !isNaN(endYear)) {
            return `${startYear + 1}-${(endYear + 1).toString().padStart(2, '0')}`;
        }
    }
    return 'next year';
}

export default StudentPromotion;
