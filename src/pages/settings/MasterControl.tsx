import React, { useState, useEffect } from 'react';
import { Shield, Save, Loader2, ChevronRight, Check, X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';

const MODULE_STRUCTURE = [
    {
        id: 'students',
        label: 'Student Management',
        icon: '🧑‍🎓',
        children: [
            { id: '/students/admission', label: 'Add Student' },
            { id: '/students/form-sale', label: 'Form Sale' },
            { id: '/students/registrations', label: 'Registration Requests' },
            { id: '/students', label: 'Manage Students' },
            { id: '/students/report', label: 'Student Report' },
            { id: '/students/re-reg', label: 'Re-Registration Report' },
            { id: '/students/dues', label: 'Dues List' },
            { id: '/students/promotion', label: 'Promote Students' },
            { id: '/students/photos', label: 'Student Photo Upload' },
        ]
    },
    {
        id: 'attendance',
        label: 'Attendance Management',
        icon: '✅',
        children: [
            { id: '/attendance', label: 'Daily Attendance' },
            { id: '/attendance/report', label: 'Attendance Report' },
        ]
    },
    {
        id: 'employees',
        label: 'Employee Management',
        icon: '👥',
        children: [
            { id: '/teachers', label: 'Employees List' },
            { id: '/teachers/payroll', label: 'Payroll Management' },
            { id: '/teaching-logs', label: 'Teaching Logs' },
        ]
    },
    {
        id: 'fees',
        label: 'Fee Management',
        icon: '💳',
        children: [
            { id: '/fees', label: 'Collect Fees' },
            { id: '/fees/structure', label: 'Fee Structure Old' },
            { id: '/fees/set-amount', label: 'Set Fee Amount' },
            { id: '/fees/report', label: 'Fee Report' },
            { id: '/fees/dues', label: 'Due Report' },
        ]
    },
    {
        id: 'accounts',
        label: 'Accounts & Expenses',
        icon: '💰',
        children: [
            { id: '/accounts/dashboard', label: 'Accounts Dashboard' },
            { id: '/accounts/expenses', label: 'Expense Entry' },
        ]
    },
    {
        id: 'exams',
        label: 'Exams & Results',
        icon: '📝',
        children: [
            { id: '/exams', label: 'Exam Dashboard' },
            { id: '/exams/academic-year', label: 'Academic Year & Terms' },
            { id: '/exams/configuration', label: 'Exam Configuration' },
            { id: '/exams/scheduling', label: 'Schedule Exams' },
            { id: '/exam-timetable', label: 'Exam Timetable' },
            { id: '/admit-cards', label: 'Print Admit Card' },
            { id: '/marks-entry', label: 'Marks Entry' },
            { id: '/exams/results', label: 'View Results' },
            { id: '/exams/analytics', label: 'Performance Analytics' },
            { id: '/exams/syllabus', label: 'Manage Syllabus' },
            { id: '/exams/templates', label: 'Customize Templates' },
            { id: '/report-cards', label: 'Print Report Card' },
            { id: '/question-generator', label: 'Question Generator' },
        ]
    },
    { id: 'transport', label: 'Transport Management', icon: '🚍' },
    { id: 'library', label: 'Library Management', icon: '📚' },
    { id: 'notices', label: 'Notice Board', icon: '📢' },
    { id: 'communication', label: 'Message Center', icon: '💬' },
    { id: 'calendar', label: 'Academic Calendar', icon: '📅' },
    { id: 'reports', label: 'Advanced Reports', icon: '📊' },
];

// Helper: check if a module/sub-module is allowed by the school's Feature Gate.
// Strict exact match only — Feature Gate stores explicit IDs for every enabled item.
// No base-module fallback here (that is only for legacy sidebar logic in DashboardLayout).
const isFeatureAllowed = (moduleId: string, allowedModules?: string[]): boolean => {
    if (!allowedModules || allowedModules.length === 0) return true; // no restriction = allow all
    return allowedModules.includes(moduleId); // strict match only
};

const MasterControl: React.FC = () => {
    const { currentSchool } = useSchool();
    const { data: allSettings, loading } = useFirestore<any>('settings');
    const [controls, setControls] = useState<Record<string, boolean>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const docId = `module_controls_${currentSchool?.id}`;
        const moduleDoc = allSettings?.find(s => s.id === docId);
        const initialControls: Record<string, boolean> = {};

        MODULE_STRUCTURE.forEach(m => {
            initialControls[m.id] = moduleDoc ? (moduleDoc[m.id] !== false) : true;
            if (m.children) {
                m.children.forEach(child => {
                    initialControls[child.id] = moduleDoc ? (moduleDoc[child.id] !== false) : true;
                });
            }
        });

        setControls(initialControls);
    }, [allSettings]);

    const toggleFeature = (id: string, isParent: boolean = false, children?: any[]) => {
        setControls(prev => {
            const newState = { ...prev, [id]: !prev[id] };

            // If parent is disabled, we don't necessarily disable children in state,
            // but the UI/Logic will hide them. However, for "all submenu" requirement,
            // it's cleaner to keep them independent or explicitly toggle them.
            // Let's keep them independent but UI-linked.

            return newState;
        });
    };

    const handleSaveModules = async () => {
        if (!currentSchool?.id) return alert('No school selected');
        setIsSaving(true);
        try {
            const docId = `module_controls_${currentSchool.id}`;
            await setDoc(doc(db, 'settings', docId), {
                ...controls,
                schoolId: currentSchool.id,
                updatedAt: new Date().toISOString(),
                type: 'control'
            });
            alert('✅ Master Control settings saved! Changes will take effect immediately.');
            window.location.reload();
        } catch (err) {
            alert('Failed to save settings: ' + (err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}><Loader2 className="animate-spin" /> Loading controls...</div>;

    return (
        <div className="animate-fade-in no-scrollbar" style={{ paddingBottom: '4rem' }}>
            <div className="page-header" style={{ marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.4)'
                    }}>
                        <Shield size={28} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.25rem', letterSpacing: '-0.025em' }}>Master Control</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Enterprise-level module and feature management.</p>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                {MODULE_STRUCTURE.filter(module => isFeatureAllowed(module.id, currentSchool?.allowedModules)).map(module => (
                    <div key={module.id} className="glass-card" style={{
                        padding: '0',
                        overflow: 'hidden',
                        border: controls[module.id] ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid var(--border)',
                        background: controls[module.id] ? 'rgba(255, 255, 255, 0.6)' : 'rgba(241, 245, 249, 0.4)'
                    }}>
                        {/* Parent Module Header */}
                        <div style={{
                            padding: '1.5rem 2rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: controls[module.id] ? 'rgba(99, 102, 241, 0.03)' : 'transparent',
                            borderBottom: '1px solid var(--border)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                <span style={{ fontSize: '2rem', filter: controls[module.id] ? 'none' : 'grayscale(1)' }}>{module.icon}</span>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: controls[module.id] ? 'var(--text-main)' : 'var(--text-muted)' }}>{module.label}</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                        <div style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            background: controls[module.id] ? '#10b981' : '#ef4444'
                                        }} />
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: controls[module.id] ? '#059669' : '#dc2626' }}>
                                            {controls[module.id] ? 'Whole Module Enabled' : 'Whole Module Disabled'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => toggleFeature(module.id)}
                                style={{
                                    width: '64px',
                                    height: '32px',
                                    borderRadius: '16px',
                                    border: 'none',
                                    background: controls[module.id] ? '#10b981' : '#cbd5e1',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: controls[module.id] ? '0 4px 12px rgba(16, 185, 129, 0.2)' : 'none'
                                }}
                            >
                                <div style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '50%',
                                    background: 'white',
                                    position: 'absolute',
                                    top: '3px',
                                    left: controls[module.id] ? '35px' : '3px',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {controls[module.id] ? <Check size={14} color="#10b981" strokeWidth={3} /> : <X size={14} color="#64748b" strokeWidth={3} />}
                                </div>
                            </button>
                        </div>

                        {/* Sub-menus Grid */}
                        {module.children && (
                            <div style={{
                                padding: '1.5rem 2rem',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                                gap: '1rem',
                                background: controls[module.id] ? 'transparent' : 'rgba(241, 245, 249, 0.2)',
                                opacity: controls[module.id] ? 1 : 0.6,
                                pointerEvents: controls[module.id] ? 'all' : 'none'
                            }}>
                                {module.children.filter(child => isFeatureAllowed(child.id, currentSchool?.allowedModules)).map(child => (
                                    <div key={child.id} style={{
                                        padding: '1rem',
                                        borderRadius: '0.75rem',
                                        background: controls[child.id] ? 'white' : 'transparent',
                                        border: '1px solid',
                                        borderColor: controls[child.id] ? 'rgba(99, 102, 241, 0.1)' : 'var(--border)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        transition: 'all 0.2s ease',
                                        boxShadow: controls[child.id] ? '0 2px 4px rgba(0,0,0,0.02)' : 'none'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <ChevronRight size={14} color="var(--primary)" />
                                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: controls[child.id] ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                                {child.label}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => toggleFeature(child.id)}
                                            style={{
                                                width: '40px',
                                                height: '20px',
                                                borderRadius: '10px',
                                                border: 'none',
                                                background: controls[child.id] ? '#10b981' : '#cbd5e1',
                                                position: 'relative',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            <div style={{
                                                width: '16px',
                                                height: '16px',
                                                borderRadius: '50%',
                                                background: 'white',
                                                position: 'absolute',
                                                top: '2px',
                                                left: controls[child.id] ? '22px' : '2px',
                                                transition: 'all 0.3s ease'
                                            }} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Floating Action Button for Save */}
            <div style={{
                position: 'fixed',
                bottom: '2rem',
                right: '2rem',
                zIndex: 1000,
                display: 'flex',
                gap: '1rem'
            }}>
                <button
                    onClick={handleSaveModules}
                    disabled={isSaving || loading}
                    className="btn btn-primary shadow-2xl hover-lift"
                    style={{
                        padding: '1rem 2.5rem',
                        gap: '0.75rem',
                        fontSize: '1.125rem',
                        height: 'auto',
                        borderRadius: '100px',
                        background: 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)',
                        boxShadow: '0 12px 24px -6px rgba(99, 102, 241, 0.5)'
                    }}
                >
                    {isSaving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
                    Apply Global Settings
                </button>
            </div>

            {/* Admin Alert */}
            <div style={{
                marginTop: '3rem',
                padding: '2rem',
                borderRadius: '1.5rem',
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.1)',
                color: '#991b1b',
                display: 'flex',
                gap: '1.5rem',
                alignItems: 'flex-start'
            }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                }}>
                    <Shield size={24} />
                </div>
                <div>
                    <h4 style={{ fontWeight: 800, fontSize: '1.125rem', marginBottom: '0.5rem' }}>Administrator Warning</h4>
                    <p style={{ fontSize: '1rem', lineHeight: 1.6, opacity: 0.9 }}>
                        These are global overrides. Disabling a module or submenu will immediately hide it for <strong>every user</strong> in the school, regardless of their individual roles or permissions. This is useful for pruning unused features or performing maintenance.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MasterControl;
