import React, { useState, useEffect } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { useFirestore } from '../../hooks/useFirestore';
import { Cake, MessageCircle, Users, GraduationCap, Settings, Phone, Edit3, Save, X } from 'lucide-react';

interface BirthdayPerson {
    id: string;
    name: string;
    mobile: string;
    type: 'student' | 'staff';
    class?: string;
    section?: string;
    designation?: string;
    dob: string;
    admissionNo?: string;
    fatherName?: string;
    fatherContactNo?: string;
    mobileNo?: string;
    phone?: string;
}

const DEFAULT_STUDENT_MSG = `🎂 *Happy Birthday {name}!* 🎉

Dear {name},

Wishing you a wonderful birthday filled with joy and happiness! 🌟

May this special day bring you all the success and happiness you deserve.

*Happy Birthday once again!* 🎈

With Best Wishes,
*{school}*`;

const DEFAULT_STAFF_MSG = `🎂 *Happy Birthday {name} Ji!* 🎉

Dear {name},

On behalf of *{school}*, we extend our heartfelt birthday wishes to you!

Your dedication and hard work inspire everyone around you. May this year bring you tremendous joy, good health, and continued success.

*Happy Birthday!* 🌟🎈

With Warm Regards,
*{school} Family*`;

const BirthdayManager: React.FC = () => {
    const { currentSchool } = useSchool();
    const { data: students } = useFirestore<any>('students');
    const { data: employees } = useFirestore<any>('teachers');
    const { data: allSettings, update: updateSettings, add: addSettings } = useFirestore<any>('settings');

    const [activeTab, setActiveTab] = useState<'students' | 'staff' | 'message'>('students');
    const [studentMsg, setStudentMsg] = useState(DEFAULT_STUDENT_MSG);
    const [staffMsg, setStaffMsg] = useState(DEFAULT_STAFF_MSG);
    const [editingMsg, setEditingMsg] = useState<'student' | 'staff' | null>(null);
    const [tempMsg, setTempMsg] = useState('');
    const [savingMsg, setSavingMsg] = useState(false);

    const schoolId = currentSchool?.id || '';
    const activeFY = currentSchool?.activeFinancialYear || '';

    // Load saved messages from settings
    useEffect(() => {
        if (allSettings) {
            const birthdaySettings = allSettings.find((s: any) => s.id === `birthday_messages_${schoolId}`);
            if (birthdaySettings) {
                if (birthdaySettings.studentMessage) setStudentMsg(birthdaySettings.studentMessage);
                if (birthdaySettings.staffMessage) setStaffMsg(birthdaySettings.staffMessage);
            }
        }
    }, [allSettings, schoolId]);

    // Get today's date info
    const today = new Date();
    const todayMonth = today.getMonth() + 1; // 1-12
    const todayDay = today.getDate();

    // Helper: check if given dob (YYYY-MM-DD or DD/MM/YYYY) matches today
    const isTodayBirthday = (dob: string): boolean => {
        if (!dob) return false;
        try {
            let month: number, day: number;
            if (dob.includes('-')) {
                const parts = dob.split('-');
                if (parts.length === 3) {
                    // YYYY-MM-DD
                    month = parseInt(parts[1]);
                    day = parseInt(parts[2]);
                } else return false;
            } else if (dob.includes('/')) {
                const parts = dob.split('/');
                if (parts.length === 3) {
                    // DD/MM/YYYY
                    day = parseInt(parts[0]);
                    month = parseInt(parts[1]);
                } else return false;
            } else return false;
            return month === todayMonth && day === todayDay;
        } catch {
            return false;
        }
    };

    // Filter today's birthdays for students
    const studentBirthdays: BirthdayPerson[] = (students || [])
        .filter((s: any) => {
            if (s.status === 'INACTIVE') return false;
            if (activeFY && s.session && s.session !== activeFY) return false;
            return isTodayBirthday(s.dob);
        })
        .map((s: any) => ({
            id: s.id,
            name: s.name || s.fullName || 'Unknown',
            mobile: s.fatherContactNo || s.mobileNo || s.phone || s.whatsappNo || '',
            type: 'student' as const,
            class: s.class,
            section: s.section,
            dob: s.dob,
            admissionNo: s.admissionNo,
            fatherName: s.fatherName,
            fatherContactNo: s.fatherContactNo,
            mobileNo: s.mobileNo,
        }))
        .sort((a: BirthdayPerson, b: BirthdayPerson) => a.name.localeCompare(b.name));

    // Filter today's birthdays for staff
    const staffBirthdays: BirthdayPerson[] = (employees || [])
        .filter((e: any) => {
            if (e.status === 'INACTIVE') return false;
            if (!e.schoolId || e.schoolId === schoolId) {
                return isTodayBirthday(e.dob);
            }
            return false;
        })
        .map((e: any) => ({
            id: e.uid || e.id,
            name: e.name || 'Unknown',
            mobile: e.mobile || '',
            type: 'staff' as const,
            designation: e.designation || e.employeeType,
            dob: e.dob,
        }))
        .sort((a: BirthdayPerson, b: BirthdayPerson) => a.name.localeCompare(b.name));

    const buildWhatsAppMessage = (person: BirthdayPerson): string => {
        const schoolName = currentSchool?.fullName || currentSchool?.name || 'Our School';
        const template = person.type === 'student' ? studentMsg : staffMsg;
        return template
            .replace(/{name}/g, person.name)
            .replace(/{school}/g, schoolName)
            .replace(/{class}/g, person.class || '')
            .replace(/{designation}/g, person.designation || '');
    };

    const handleWhatsApp = (person: BirthdayPerson) => {
        const mobile = person.mobile?.replace(/\D/g, '');
        if (!mobile || mobile.length < 10) {
            alert(`No valid mobile number for ${person.name}`);
            return;
        }
        const msg = buildWhatsAppMessage(person);
        const encoded = encodeURIComponent(msg);
        const number = mobile.startsWith('91') ? mobile : `91${mobile.slice(-10)}`;
        window.open(`https://wa.me/${number}?text=${encoded}`, '_blank');
    };

    const handleSaveMessage = async () => {
        setSavingMsg(true);
        try {
            const docId = `birthday_messages_${schoolId}`;
            const existing = allSettings?.find((s: any) => s.id === docId);
            const payload = {
                id: docId,
                studentMessage: editingMsg === 'student' ? tempMsg : studentMsg,
                staffMessage: editingMsg === 'staff' ? tempMsg : staffMsg,
                updatedAt: new Date().toISOString(),
            };
            if (existing) {
                await updateSettings(docId, payload);
            } else {
                await addSettings({ ...payload, createdAt: new Date().toISOString() });
            }
            if (editingMsg === 'student') setStudentMsg(tempMsg);
            if (editingMsg === 'staff') setStaffMsg(tempMsg);
            setEditingMsg(null);
        } catch (err) {
            alert('Failed to save message');
        } finally {
            setSavingMsg(false);
        }
    };

    const totalBirthdays = studentBirthdays.length + staffBirthdays.length;

    return (
        <div className="animate-fade-in no-scrollbar" style={{ paddingBottom: '2rem' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '1.25rem',
                        background: 'linear-gradient(135deg, #f43f5e, #fb923c)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 20px rgba(244, 63, 94, 0.3)'
                    }}>
                        <Cake size={28} color="white" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                            Today's Birthdays 🎂
                        </h1>
                        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9375rem' }}>
                            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                </div>

                {/* Summary banner */}
                {totalBirthdays > 0 && (
                    <div className="animate-slide-up" style={{
                        background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.1), rgba(251, 146, 60, 0.07))',
                        border: '1px solid rgba(244, 63, 94, 0.2)',
                        borderRadius: '1rem',
                        padding: '1rem 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        marginTop: '1rem',
                        flexWrap: 'wrap'
                    }}>
                        <span style={{ fontSize: '1.5rem' }}>🎉</span>
                        <div>
                            <p style={{ margin: 0, fontWeight: 700, color: '#f43f5e', fontSize: '1rem' }}>
                                {totalBirthdays} {totalBirthdays === 1 ? 'person has' : 'people have'} a birthday today!
                            </p>
                            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                {studentBirthdays.length} Students · {staffBirthdays.length} Teachers/Staff
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1.5rem',
                padding: '0.375rem',
                background: 'var(--bg-main)',
                borderRadius: '1rem',
                border: '1px solid var(--border)',
                width: 'fit-content'
            }}>
                {[
                    { key: 'students', label: 'Students', icon: GraduationCap, count: studentBirthdays.length },
                    { key: 'staff', label: 'Teachers/Staff', icon: Users, count: staffBirthdays.length },
                    { key: 'message', label: 'Custom Message', icon: Settings, count: null },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.625rem 1.25rem',
                            borderRadius: '0.75rem',
                            border: 'none',
                            background: activeTab === tab.key ? 'white' : 'transparent',
                            color: activeTab === tab.key ? '#f43f5e' : 'var(--text-muted)',
                            fontWeight: activeTab === tab.key ? 700 : 500,
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            boxShadow: activeTab === tab.key ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                            transition: 'all 0.25s ease',
                        }}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                        {tab.count !== null && (
                            <span style={{
                                background: activeTab === tab.key ? '#f43f5e' : 'var(--border)',
                                color: activeTab === tab.key ? 'white' : 'var(--text-muted)',
                                borderRadius: '999px',
                                padding: '0.125rem 0.5rem',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                minWidth: '22px',
                                textAlign: 'center',
                                transition: 'all 0.25s'
                            }}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'students' && (
                <BirthdayList
                    people={studentBirthdays}
                    emptyMessage="No student birthdays today 🎈"
                    onWhatsApp={handleWhatsApp}
                />
            )}

            {activeTab === 'staff' && (
                <BirthdayList
                    people={staffBirthdays}
                    emptyMessage="No teacher/staff birthdays today 🎈"
                    onWhatsApp={handleWhatsApp}
                />
            )}

            {activeTab === 'message' && (
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                    {/* Student Message */}
                    <MessageEditor
                        title="Student Birthday Message"
                        icon={GraduationCap}
                        iconColor="#6366f1"
                        message={studentMsg}
                        isEditing={editingMsg === 'student'}
                        tempMsg={tempMsg}
                        saving={savingMsg}
                        onEdit={() => { setEditingMsg('student'); setTempMsg(studentMsg); }}
                        onCancel={() => setEditingMsg(null)}
                        onTempChange={setTempMsg}
                        onSave={handleSaveMessage}
                        hint="Use {name} for person's name, {school} for school name, {class} for class."
                    />

                    {/* Staff Message */}
                    <MessageEditor
                        title="Staff/Teacher Birthday Message"
                        icon={Users}
                        iconColor="#8b5cf6"
                        message={staffMsg}
                        isEditing={editingMsg === 'staff'}
                        tempMsg={tempMsg}
                        saving={savingMsg}
                        onEdit={() => { setEditingMsg('staff'); setTempMsg(staffMsg); }}
                        onCancel={() => setEditingMsg(null)}
                        onTempChange={setTempMsg}
                        onSave={handleSaveMessage}
                        hint="Use {name} for person's name, {school} for school name, {designation} for their role."
                    />

                    <div style={{
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.07), rgba(139,92,246,0.04))',
                        border: '1px solid rgba(99,102,241,0.15)',
                        borderRadius: '1rem',
                        padding: '1.25rem 1.5rem',
                        fontSize: '0.8125rem',
                        color: 'var(--text-muted)',
                        lineHeight: 1.7
                    }}>
                        <strong style={{ color: 'var(--text-main)' }}>💡 Available Placeholders:</strong>
                        <br />
                        <code style={{ background: 'rgba(99,102,241,0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px', margin: '0 0.25rem' }}>{'{name}'}</code> — Person's full name
                        <code style={{ background: 'rgba(99,102,241,0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px', margin: '0 0.25rem' }}>{'{school}'}</code> — School name
                        <code style={{ background: 'rgba(99,102,241,0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px', margin: '0 0.25rem' }}>{'{class}'}</code> — Student's class
                        <code style={{ background: 'rgba(99,102,241,0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px', margin: '0 0.25rem' }}>{'{designation}'}</code> — Staff designation
                    </div>
                </div>
            )}
        </div>
    );
};

// Birthday list component
const BirthdayList: React.FC<{
    people: BirthdayPerson[];
    emptyMessage: string;
    onWhatsApp: (p: BirthdayPerson) => void;
}> = ({ people, emptyMessage, onWhatsApp }) => {
    if (people.length === 0) {
        return (
            <div className="glass-card animate-slide-up" style={{
                padding: '3rem',
                textAlign: 'center',
                color: 'var(--text-muted)'
            }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎈</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                    {emptyMessage}
                </h3>
                <p style={{ fontSize: '0.875rem' }}>Check back tomorrow for more celebrations!</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'grid', gap: '1rem' }}>
            {people.map((person, idx) => (
                <div
                    key={person.id}
                    className="glass-card animate-slide-up hover-lift"
                    style={{
                        padding: '1.25rem 1.5rem',
                        animationDelay: `${idx * 0.05}s`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        flexWrap: 'wrap',
                        background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.04), rgba(251, 146, 60, 0.02))',
                        border: '1px solid rgba(244, 63, 94, 0.12)'
                    }}
                >
                    {/* Avatar */}
                    <div style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '1rem',
                        background: person.type === 'student'
                            ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                            : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        flexShrink: 0,
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                    }}>
                        {person.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                                {person.name}
                            </span>
                            <span style={{ fontSize: '1.25rem' }}>🎂</span>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                            {person.type === 'student' && person.class && (
                                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <GraduationCap size={12} />
                                    Class {person.class}{person.section ? ` - ${person.section}` : ''}
                                </span>
                            )}
                            {person.type === 'staff' && person.designation && (
                                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Users size={12} />
                                    {person.designation}
                                </span>
                            )}
                            {person.admissionNo && (
                                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                    Adm: {person.admissionNo}
                                </span>
                            )}
                        </div>
                        {/* Mobile numbers */}
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                            {person.mobile && (
                                <span style={{ fontSize: '0.8125rem', color: '#6366f1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <Phone size={12} />
                                    {person.mobile}
                                </span>
                            )}
                            {person.fatherContactNo && person.fatherContactNo !== person.mobile && (
                                <span style={{ fontSize: '0.8125rem', color: '#8b5cf6', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <Phone size={12} />
                                    Father: {person.fatherContactNo}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* WhatsApp button */}
                    <button
                        onClick={() => onWhatsApp(person)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.625rem 1.25rem',
                            borderRadius: '0.75rem',
                            border: 'none',
                            background: 'linear-gradient(135deg, #25D366, #128C7E)',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)',
                            transition: 'all 0.2s ease',
                            flexShrink: 0
                        }}
                        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                        title={`Send birthday wish via WhatsApp to ${person.name}`}
                    >
                        <MessageCircle size={16} />
                        WhatsApp
                    </button>
                </div>
            ))}
        </div>
    );
};

// Message editor component
const MessageEditor: React.FC<{
    title: string;
    icon: any;
    iconColor: string;
    message: string;
    isEditing: boolean;
    tempMsg: string;
    saving: boolean;
    onEdit: () => void;
    onCancel: () => void;
    onTempChange: (v: string) => void;
    onSave: () => void;
    hint?: string;
}> = ({ title, icon: Icon, iconColor, message, isEditing, tempMsg, saving, onEdit, onCancel, onTempChange, onSave, hint }) => {
    return (
        <div className="glass-card animate-slide-up" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '0.75rem',
                        background: iconColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: 0.9
                    }}>
                        <Icon size={20} color="white" />
                    </div>
                    <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0, color: 'var(--text-main)' }}>{title}</h3>
                </div>
                {!isEditing ? (
                    <button
                        onClick={onEdit}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.625rem',
                            border: '1.5px solid var(--border)',
                            background: 'white',
                            color: 'var(--text-main)',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                        }}
                    >
                        <Edit3 size={14} /> Edit
                    </button>
                ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={onCancel}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.25rem',
                                padding: '0.5rem 1rem', borderRadius: '0.625rem',
                                border: '1.5px solid var(--border)', background: 'white',
                                color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                            }}
                        >
                            <X size={14} /> Cancel
                        </button>
                        <button
                            onClick={onSave}
                            disabled={saving}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.25rem',
                                padding: '0.5rem 1rem', borderRadius: '0.625rem',
                                border: 'none', background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                color: 'white', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                                opacity: saving ? 0.7 : 1
                            }}
                        >
                            <Save size={14} /> {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                )}
            </div>

            {hint && !isEditing && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontStyle: 'italic' }}>{hint}</p>
            )}

            {isEditing ? (
                <textarea
                    value={tempMsg}
                    onChange={e => onTempChange(e.target.value)}
                    style={{
                        width: '100%',
                        minHeight: '200px',
                        padding: '1rem',
                        borderRadius: '0.75rem',
                        border: '1.5px solid var(--border)',
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        lineHeight: 1.7,
                        resize: 'vertical',
                        background: '#fafbfc',
                        color: 'var(--text-main)',
                        outline: 'none',
                        boxSizing: 'border-box',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                />
            ) : (
                <pre style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: '0.875rem',
                    lineHeight: 1.7,
                    color: 'var(--text-main)',
                    background: '#f8fafc',
                    padding: '1rem',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--border)',
                    margin: 0,
                    fontFamily: 'inherit',
                    maxHeight: '250px',
                    overflowY: 'auto',
                }}>
                    {message}
                </pre>
            )}
        </div>
    );
};

export default BirthdayManager;
