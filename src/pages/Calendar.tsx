import React, { useState, useMemo } from 'react';
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Plus,
    Circle,
    X,
    Trash2,
    Clock,
    Tag,
    Info,
    Layers,
    RefreshCw,
    Users,
    UserCheck,
    BookOpen,
    Check,
    Copy,
    CalendarDays
} from 'lucide-react';
import { useFirestore } from '../hooks/useFirestore';
import { useSchool } from '../context/SchoolContext';
import { useAuth } from '../context/AuthContext';
import { getActiveClasses } from '../constants/app';
import { formatClassName } from '../utils/formatters';

// Helper to replace date-fns
const formatDate = (date: Date | string, pattern: string) => {
    const d = new Date(date);
    if (pattern === 'yyyy-MM-dd') {
        return d.toISOString().split('T')[0];
    }
    if (pattern === 'dd-MMM-yy') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const day = String(d.getDate()).padStart(2, '0');
        const month = months[d.getMonth()];
        const year = String(d.getFullYear()).slice(-2);
        return `${day}-${month}-${year}`;
    }
    if (pattern === 'dd-MMM') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const day = String(d.getDate()).padStart(2, '0');
        const month = months[d.getMonth()];
        return `${day}-${month}`;
    }
    return d.toLocaleDateString();
};

const FALLBACK_HOLIDAYS: Record<number, any[]> = {
    2025: [
        { date: '2025-01-26', name: 'Republic Day', localName: 'Republic Day' },
        { date: '2025-08-15', name: 'Independence Day', localName: 'Independence Day' },
        { date: '2025-10-02', name: 'Gandhi Jayanti', localName: 'Gandhi Jayanti' },
        { date: '2025-12-25', name: 'Christmas Day', localName: 'Christmas Day' }
    ],
    2026: [
        { date: '2026-01-26', name: 'Republic Day', localName: 'Republic Day' },
        { date: '2026-03-04', name: 'Holi', localName: 'Holi' },
        { date: '2026-03-21', name: 'Eid-ul-Fitr', localName: 'Eid-ul-Fitr' },
        { date: '2026-08-15', name: 'Independence Day', localName: 'Independence Day' },
        { date: '2026-10-02', name: 'Gandhi Jayanti', localName: 'Gandhi Jayanti' },
        { date: '2026-10-20', name: 'Dussehra', localName: 'Dussehra' },
        { date: '2026-11-08', name: 'Diwali', localName: 'Diwali' },
        { date: '2026-12-25', name: 'Christmas Day', localName: 'Christmas Day' }
    ]
};

// Audience config
const AUDIENCE_OPTIONS = [
    { id: 'ALL', label: 'Everyone (Students, Staff & Parents)', icon: '🏫', color: '#4f46e5' },
    { id: 'STAFF', label: 'Staff & Teachers Only', icon: '👩‍🏫', color: '#0891b2' },
    { id: 'CLASSES', label: 'Specific Classes', icon: '🎒', color: '#d97706' },
];

const STAFF_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'TEACHER', 'ACCOUNTANT'];

// Check if event is visible for the current user
const isEventVisibleForUser = (event: any, user: any) => {
    const audience = event.targetAudience || 'ALL';
    if (audience === 'ALL') return true;

    const role = user?.role || '';
    const isStaff = STAFF_ROLES.includes(role);
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

    // Admin/Manager sees everything
    if (isAdmin || role === 'MANAGER') return true;

    if (audience === 'STAFF') {
        return isStaff;
    }

    if (audience === 'CLASSES') {
        const appliesTo: string[] = event.appliesTo || [];
        if (appliesTo.length === 0) return true; // no restriction = all
        // Staff can see all class-specific events
        if (isStaff) return true;
        // Students/Parents: check their class
        const userClass = user?.class || '';
        if (!userClass) return false;
        return appliesTo.some(c => c.toLowerCase() === userClass.toLowerCase());
    }

    return true;
};

// Audience badge for admin view
const AudienceBadge: React.FC<{ event: any; small?: boolean }> = ({ event, small }) => {
    const audience = event.targetAudience || 'ALL';
    if (audience === 'ALL') return null;

    const opt = AUDIENCE_OPTIONS.find(o => o.id === audience);
    if (!opt) return null;

    const label = audience === 'CLASSES' && event.appliesTo?.length
        ? `${opt.icon} ${event.appliesTo.slice(0, 2).join(', ')}${event.appliesTo.length > 2 ? '...' : ''}`
        : `${opt.icon} ${small ? '' : opt.label}`;

    return (
        <span
            title={audience === 'CLASSES' ? `Applies to: ${(event.appliesTo || []).join(', ')}` : opt.label}
            style={{
                fontSize: small ? '0.55rem' : '0.625rem',
                fontWeight: 700,
                background: opt.color + '22',
                color: opt.color,
                border: `1px solid ${opt.color}44`,
                borderRadius: '4px',
                padding: small ? '1px 3px' : '2px 5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                marginLeft: '3px',
                whiteSpace: 'nowrap',
            }}
        >
            {label}
        </span>
    );
};

const AcademicCalendar: React.FC = () => {
    const { currentSchool } = useSchool();
    const { user } = useAuth();
    const schoolId = currentSchool?.id;
    const { data: events, add: addEvent, update: updateEvent, remove: removeEvent, loading } = useFirestore<any>('events');

    // Determine if user can edit calendar (ADMIN, MANAGER only)
    const canEdit = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
    const isAdmin = canEdit;
    const { data: masterHolidays } = useFirestore<any>('master_holidays', [], { skipSchoolFilter: true });
    const { data: allSettings } = useFirestore<any>('settings');

    const activeFY = currentSchool?.activeFinancialYear || '';
    const activeClasses = useMemo(
        () => getActiveClasses(allSettings?.filter((d: any) => d.type === 'class') || [], activeFY).map((c: any) => c.name),
        [allSettings, activeFY]
    );

    const [viewDate, setViewDate] = useState(new Date());
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    // Calendar view filter: 'STAFF' | 'CLASSES' (no All Events tab — each is independent)
    const [viewFilter, setViewFilter] = useState<'STAFF' | 'CLASSES'>('STAFF');
    // Multi-select class filter for CLASSES view (empty = show all class-targeted events)
    const [viewClasses, setViewClasses] = useState<string[]>([]);
    // Copy holidays modal
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
    const [copySourceClass, setCopySourceClass] = useState('');
    const [copyTargetClasses, setCopyTargetClasses] = useState<string[]>([]);
    const [copySelectedEvents, setCopySelectedEvents] = useState<string[]>([]);
    const [isCopying, setIsCopying] = useState(false);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const defaultFormData = {
        title: '',
        date: formatDate(new Date(), 'yyyy-MM-dd'),
        startDate: formatDate(new Date(), 'yyyy-MM-dd'),
        endDate: formatDate(new Date(), 'yyyy-MM-dd'),
        isMultiDay: false,
        type: 'ACADEMIC',
        description: '',
        color: '#4f46e5',
        targetAudience: 'ALL' as 'ALL' | 'STAFF' | 'CLASSES',
        appliesTo: [] as string[],
    };

    const [formData, setFormData] = useState(defaultFormData);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const EVENT_TYPES = [
        { id: 'ACADEMIC', label: 'Academic / Exams', color: '#4f46e5' },
        { id: 'EXTRACURRICULAR', label: 'Extracurricular', color: '#10b981' },
        { id: 'HOLIDAY', label: 'Holidays', color: '#f43f5e' },
        { id: 'STAFF_HOLIDAY', label: 'Staff Holiday', color: '#f43f5e' },
        { id: 'OTHER', label: 'Other', color: '#64748b' },
    ];

    const currentYear = viewDate.getFullYear();
    const currentMonth = viewDate.getMonth();

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const handlePrevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));

    const openModal = (event: any = null, initialDate: string | null = null) => {
        if (!canEdit && !event) return;

        if (event) {
            setSelectedEvent(event);
            setFormData({
                title: event.title,
                date: event.date || event.startDate,
                startDate: event.startDate || event.date,
                endDate: event.endDate || event.date,
                isMultiDay: !!event.isMultiDay,
                type: event.type || 'ACADEMIC',
                description: event.description || '',
                color: event.color || '#4f46e5',
                targetAudience: event.targetAudience || 'ALL',
                appliesTo: event.appliesTo || [],
            });
        } else {
            setSelectedEvent(null);
            // Auto-set audience based on active view tab
            const defaultAudience =
                viewFilter === 'STAFF' ? 'STAFF' :
                    viewFilter === 'CLASSES' ? 'CLASSES' : 'ALL';
            const defaultAppliesTo =
                viewFilter === 'CLASSES' && viewClasses.length > 0
                    ? [...viewClasses]
                    : [];
            setFormData({
                ...defaultFormData,
                date: initialDate || formatDate(new Date(), 'yyyy-MM-dd'),
                startDate: initialDate || formatDate(new Date(), 'yyyy-MM-dd'),
                endDate: initialDate || formatDate(new Date(), 'yyyy-MM-dd'),
                targetAudience: defaultAudience as any,
                appliesTo: defaultAppliesTo,
                type: viewFilter === 'STAFF' ? 'STAFF_HOLIDAY' : 'ACADEMIC',
                color: viewFilter === 'STAFF' ? '#f43f5e' : '#4f46e5',
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                // If STAFF type selected, auto-set audience to STAFF if it's still ALL
                targetAudience: formData.type === 'STAFF_HOLIDAY' && formData.targetAudience === 'ALL'
                    ? 'STAFF'
                    : formData.targetAudience,
                appliesTo: formData.targetAudience === 'CLASSES' ? formData.appliesTo : [],
                schoolId
            };
            if (selectedEvent) {
                await updateEvent(selectedEvent.id, payload);
            } else {
                await addEvent(payload);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving event:', error);
            alert('Failed to save event');
        }
    };

    const handleDelete = async () => {
        if (selectedEvent && window.confirm('Are you sure you want to delete this event?')) {
            await removeEvent(selectedEvent.id);
            setIsModalOpen(false);
        }
    };

    const fetchPublicHolidays = async () => {
        if (!events || !schoolId) return;
        setIsFetching(true);
        try {
            const year = currentYear;
            let data = masterHolidays?.filter((h: any) => h.year === year || new Date(h.date).getFullYear() === year) || [];

            if (data.length === 0 && FALLBACK_HOLIDAYS[year]) {
                data = FALLBACK_HOLIDAYS[year];
            }

            if (data.length === 0) {
                alert(`No master holidays found for ${year}. Please upload them in Settings > Upload Master Holidays.`);
                return;
            }

            // Check existing staff holidays
            const existingStaff = events.filter((e: any) => e.targetAudience === 'STAFF' && (e.type === 'HOLIDAY' || e.type === 'STAFF_HOLIDAY'));
            const newForStaff = data.filter((h: any) => {
                const hDate = h.date || h.startDate;
                const hTitle = h.title || h.localName || h.name;
                return !existingStaff.some((e: any) => (e.date === hDate || e.startDate === hDate) && e.title === hTitle);
            });

            // For classes: check per-class existing holidays
            const classEvents = events.filter((e: any) => e.targetAudience === 'CLASSES');
            const classHolidayPairs: { holiday: any; cls: string }[] = [];
            for (const holiday of data) {
                const hDate = holiday.date || holiday.startDate;
                const hTitle = holiday.title || holiday.localName || holiday.name;
                for (const cls of activeClasses) {
                    const alreadyExists = classEvents.some((e: any) => {
                        const appliesTo: string[] = e.appliesTo || [];
                        const matchesClass = appliesTo.length === 0 || appliesTo.includes(cls);
                        return matchesClass && (e.date === hDate || e.startDate === hDate) && e.title === hTitle;
                    });
                    if (!alreadyExists) {
                        classHolidayPairs.push({ holiday, cls });
                    }
                }
            }

            if (newForStaff.length === 0 && classHolidayPairs.length === 0) {
                alert(`All public holidays for ${year} are already in your calendar (Staff & all classes).`);
                return;
            }

            const summary: string[] = [];
            if (newForStaff.length > 0) summary.push(`${newForStaff.length} for Staff`);
            if (classHolidayPairs.length > 0) summary.push(`${classHolidayPairs.length} entries across ${activeClasses.length} classes`);
            if (!window.confirm(`Found holidays to add:\n• ${summary.join('\n• ')}\n\nEach class will get its own independent copy.\nContinue?`)) {
                return;
            }

            let addedCount = 0;
            // Add STAFF copies
            for (const holiday of newForStaff) {
                await addEvent({
                    title: holiday.title || holiday.localName || holiday.name,
                    date: holiday.date || holiday.startDate,
                    startDate: holiday.startDate || holiday.date,
                    endDate: holiday.endDate || holiday.date,
                    isMultiDay: !!holiday.isMultiDay,
                    type: 'STAFF_HOLIDAY',
                    description: holiday.description || 'Public Holiday (Staff)',
                    color: '#f43f5e',
                    targetAudience: 'STAFF',
                    appliesTo: [],
                    schoolId
                });
                addedCount++;
            }
            // Add independent per-class copies
            for (const { holiday, cls } of classHolidayPairs) {
                await addEvent({
                    title: holiday.title || holiday.localName || holiday.name,
                    date: holiday.date || holiday.startDate,
                    startDate: holiday.startDate || holiday.date,
                    endDate: holiday.endDate || holiday.date,
                    isMultiDay: !!holiday.isMultiDay,
                    type: 'HOLIDAY',
                    description: holiday.description || 'Public Holiday',
                    color: '#f43f5e',
                    targetAudience: 'CLASSES',
                    appliesTo: [cls],
                    schoolId
                });
                addedCount++;
            }

            alert(`Successfully added ${addedCount} holiday entries (${newForStaff.length} Staff + ${classHolidayPairs.length} class-wise).\n\nEach class now has independent holidays you can customize.`);
        } catch (error) {
            console.error('Error fetching holidays:', error);
            alert('Unable to fetch holidays at this time.');
        } finally {
            setIsFetching(false);
        }
    };

    // Filter events — 2 independent tabs only
    const filteredEvents = useMemo(() => {
        if (!events) return [];
        let filtered = events.filter((event: any) => {
            const audience = event.targetAudience || 'ALL';

            if (isAdmin) {
                if (viewFilter === 'STAFF') {
                    return audience === 'STAFF';
                }
                if (viewFilter === 'CLASSES') {
                    if (audience !== 'CLASSES') return false;
                    if (viewClasses.length > 0) {
                        const appliesTo: string[] = event.appliesTo || [];
                        if (appliesTo.length === 0) return true;
                        return viewClasses.some(c => appliesTo.includes(c));
                    }
                    return true;
                }
                return false;
            }

            // Non-admin: role-based visibility filter
            return isEventVisibleForUser(event, user);
        });

        // For non-admin: deduplicate events with same title
        // If both a generic (appliesTo=[]) and class-specific version exist, keep the class-specific one
        if (!isAdmin) {
            const seen = new Map<string, any>();
            for (const evt of filtered) {
                const key = evt.title;
                const existing = seen.get(key);
                if (!existing) {
                    seen.set(key, evt);
                } else {
                    // Prefer the one with specific appliesTo (class-specific) over generic
                    const existingSpecific = (existing.appliesTo || []).length > 0;
                    const evtSpecific = (evt.appliesTo || []).length > 0;
                    if (evtSpecific && !existingSpecific) {
                        seen.set(key, evt);
                    }
                }
            }
            filtered = Array.from(seen.values());
        }

        return filtered;
    }, [events, user, isAdmin, viewFilter, viewClasses]);

    const nextEvent = useMemo(() => {
        const now = new Date();
        return filteredEvents
            ?.filter((e: any) => new Date(e.endDate || e.startDate || e.date) >= now)
            ?.sort((a: any, b: any) => new Date(a.startDate || a.date).getTime() - new Date(b.startDate || b.date).getTime())[0];
    }, [filteredEvents]);

    // Toggle class in appliesTo
    const toggleClass = (cls: string) => {
        setFormData(prev => ({
            ...prev,
            appliesTo: prev.appliesTo.includes(cls)
                ? prev.appliesTo.filter(c => c !== cls)
                : [...prev.appliesTo, cls]
        }));
    };

    // Working days count for current month (excludes Sundays + holidays)
    const workingDaysInMonth = useMemo(() => {
        let total = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const dayOfWeek = new Date(currentYear, currentMonth, d).getDay();
            if (dayOfWeek === 0) continue; // Sunday
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const hasHoliday = filteredEvents.some((e: any) => {
                const start = e.startDate || e.date;
                const end = e.endDate || start;
                return dateStr >= start && dateStr <= end && (e.type === 'HOLIDAY' || e.type === 'STAFF_HOLIDAY');
            });
            if (!hasHoliday) total++;
        }
        return total;
    }, [daysInMonth, currentYear, currentMonth, filteredEvents]);

    // Get events for a specific class in the current month
    const getClassMonthEvents = (cls: string) => {
        if (!events) return [];
        const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const monthEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
        return events.filter((e: any) => {
            if (e.targetAudience !== 'CLASSES') return false;
            const appliesTo: string[] = e.appliesTo || [];
            if (appliesTo.length > 0 && !appliesTo.includes(cls)) return false;
            const start = e.startDate || e.date;
            return start >= monthStart && start <= monthEnd;
        });
    };

    // Open copy modal — must have exactly 1 class selected
    const openCopyModal = () => {
        const sourceClass = viewClasses.length === 1 ? viewClasses[0] : '';
        if (!sourceClass) {
            alert('Please select exactly ONE class to copy holidays from.');
            return;
        }
        const monthEvents = getClassMonthEvents(sourceClass);
        if (monthEvents.length === 0) {
            alert(`No holidays/events found for ${formatClassName(sourceClass, currentSchool?.useRomanNumerals)} in ${months[currentMonth]} ${currentYear}.`);
            return;
        }
        setCopySourceClass(sourceClass);
        setCopySelectedEvents(monthEvents.map((e: any) => e.id));
        setCopyTargetClasses([]);
        setIsCopyModalOpen(true);
    };

    // Copy selected holidays to target classes
    const handleCopyHolidays = async () => {
        if (copyTargetClasses.length === 0) {
            alert('Please select at least one target class.');
            return;
        }
        if (copySelectedEvents.length === 0) {
            alert('Please select at least one holiday to copy.');
            return;
        }
        setIsCopying(true);
        try {
            const eventsToCopy = (events || []).filter((e: any) => copySelectedEvents.includes(e.id));
            let copiedCount = 0;
            let skippedCount = 0;
            let updatedCount = 0;
            for (const targetCls of copyTargetClasses) {
                for (const evt of eventsToCopy) {
                    // Find existing event with same title for the target class
                    const existing = (events || []).find((e: any) => {
                        const appliesTo: string[] = e.appliesTo || [];
                        return e.targetAudience === 'CLASSES' &&
                            (appliesTo.includes(targetCls) || appliesTo.length === 0) &&
                            e.title === evt.title;
                    });

                    if (existing) {
                        // Check if dates are exactly the same → true duplicate, skip
                        const sameStart = (existing.startDate || existing.date) === (evt.startDate || evt.date);
                        const sameEnd = (existing.endDate || existing.date) === (evt.endDate || evt.date);
                        if (sameStart && sameEnd) {
                            skippedCount++;
                            continue;
                        }
                        // Title matches but dates differ → UPDATE the existing event
                        await updateEvent(existing.id, {
                            date: evt.date,
                            startDate: evt.startDate || evt.date,
                            endDate: evt.endDate || evt.date,
                            isMultiDay: !!evt.isMultiDay,
                            description: evt.description || existing.description || '',
                            color: evt.color || existing.color || '#f43f5e',
                        });
                        updatedCount++;
                    } else {
                        // No match → create new
                        await addEvent({
                            title: evt.title,
                            date: evt.date,
                            startDate: evt.startDate || evt.date,
                            endDate: evt.endDate || evt.date,
                            isMultiDay: !!evt.isMultiDay,
                            type: evt.type || 'HOLIDAY',
                            description: evt.description || '',
                            color: evt.color || '#f43f5e',
                            targetAudience: 'CLASSES',
                            appliesTo: [targetCls],
                            schoolId
                        });
                        copiedCount++;
                    }
                }
            }
            const parts: string[] = [];
            if (copiedCount > 0) parts.push(`${copiedCount} created`);
            if (updatedCount > 0) parts.push(`${updatedCount} updated`);
            if (skippedCount > 0) parts.push(`${skippedCount} unchanged`);
            alert(`Done! ${parts.join(', ')} across ${copyTargetClasses.length} class${copyTargetClasses.length > 1 ? 'es' : ''}.`);
            setIsCopyModalOpen(false);
        } catch (error) {
            console.error('Error copying holidays:', error);
            alert('Failed to copy holidays. Please try again.');
        } finally {
            setIsCopying(false);
        }
    };

    // Toggle a class in copy target list
    const toggleCopyTarget = (cls: string) => {
        setCopyTargetClasses(prev =>
            prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
        );
    };

    // Toggle a holiday in copy selection
    const toggleCopyEvent = (id: string) => {
        setCopySelectedEvents(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'flex-start' : 'center',
                marginBottom: '2rem',
                gap: '1rem'
            }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '1.5rem' : '1.875rem', fontWeight: 800, marginBottom: '0.5rem' }}>Academic Calendar</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: isMobile ? '0.8125rem' : '1rem' }}>Stay updated with holidays, exams, and school events.</p>
                </div>
                {canEdit && (
                    <div style={{
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'center',
                        width: isMobile ? '100%' : 'auto',
                        flexWrap: 'wrap'
                    }}>
                        <button
                            className="btn"
                            onClick={fetchPublicHolidays}
                            disabled={isFetching}
                            style={{
                                flex: isMobile ? 1 : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                border: '1px solid var(--primary)',
                                color: 'var(--primary)',
                                background: 'transparent',
                                fontSize: isMobile ? '0.75rem' : '0.875rem',
                                padding: isMobile ? '0.5rem' : '0.625rem 1.25rem'
                            }}
                        >
                            {isFetching ? <RefreshCw size={16} className="animate-spin" /> : <Layers size={16} />}
                            Fetch {isMobile ? '' : `${currentYear} `}Holidays
                        </button>
                        <button
                            className="btn"
                            onClick={async () => {
                                const target = viewFilter === 'STAFF' ? 'Staff' : 'Class-wise';
                                const toRemove = (events || []).filter((e: any) => {
                                    if (viewFilter === 'STAFF') return e.targetAudience === 'STAFF';
                                    if (viewFilter === 'CLASSES') {
                                        if (e.targetAudience !== 'CLASSES') return false;
                                        if (viewClasses.length > 0) {
                                            const appliesTo: string[] = e.appliesTo || [];
                                            if (appliesTo.length === 0) return true;
                                            return viewClasses.some(c => appliesTo.includes(c));
                                        }
                                        return true;
                                    }
                                    return false;
                                });
                                if (toRemove.length === 0) {
                                    alert('No holidays to remove in the current view.');
                                    return;
                                }
                                const classInfo = viewFilter === 'CLASSES' && viewClasses.length > 0
                                    ? ` for ${viewClasses.map(c => formatClassName(c, currentSchool?.useRomanNumerals)).join(', ')}`
                                    : '';
                                if (!window.confirm(`Remove ALL ${toRemove.length} holidays from ${target}${classInfo}?\n\nThis cannot be undone.`)) return;
                                for (const evt of toRemove) {
                                    await removeEvent(evt.id);
                                }
                                alert(`Removed ${toRemove.length} holidays.`);
                            }}
                            style={{
                                flex: isMobile ? 1 : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                border: '1px solid #dc2626',
                                color: '#dc2626',
                                background: 'transparent',
                                fontSize: isMobile ? '0.75rem' : '0.875rem',
                                padding: isMobile ? '0.5rem' : '0.625rem 1.25rem'
                            }}
                        >
                            <Trash2 size={16} /> Clear {isMobile ? '' : 'All '}Holidays
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={() => openModal()}
                            style={{
                                flex: isMobile ? 1 : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: isMobile ? '0.75rem' : '0.875rem',
                                padding: isMobile ? '0.5rem' : '0.625rem 1.25rem'
                            }}
                        >
                            <Plus size={16} /> Add Event
                        </button>
                    </div>
                )}
            </div>

            {/* Admin View Filter Tabs — 2 independent tabs */}
            {isAdmin && (
                <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: viewFilter === 'CLASSES' ? '0.75rem' : '0' }}>
                        {[
                            { id: 'STAFF', label: 'Staff Only', icon: <UserCheck size={13} />, activeColor: '#0891b2' },
                            { id: 'CLASSES', label: 'Class-wise', icon: <BookOpen size={13} />, activeColor: '#d97706' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => { setViewFilter(tab.id as any); setViewClasses(tab.id === 'CLASSES' && activeClasses.length > 0 ? [activeClasses[0]] : []); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                                    padding: '0.4rem 0.875rem', borderRadius: '20px',
                                    border: viewFilter === tab.id ? `2px solid ${tab.activeColor}` : '1px solid var(--border)',
                                    background: viewFilter === tab.id ? `${tab.activeColor}15` : 'white',
                                    color: viewFilter === tab.id ? tab.activeColor : 'var(--text-muted)',
                                    fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
                                }}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>
                            {viewFilter === 'STAFF'
                                ? '👩‍🏫 Visible to Teachers & Staff only'
                                : '🎒 Visible to Students & Parents by class'}
                        </span>
                    </div>

                    {/* Class Chips — single-select, one at a time */}
                    {viewFilter === 'CLASSES' && (
                        <div style={{
                            display: 'flex', flexWrap: 'wrap', gap: '0.4rem',
                            padding: '0.75rem 1rem',
                            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px',
                            alignItems: 'center',
                        }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#92400e', marginRight: '0.25rem' }}>
                                Select Class:
                            </span>
                            {activeClasses.map((cls: string) => {
                                const isSel = viewClasses.includes(cls);
                                return (
                                    <button
                                        key={cls}
                                        onClick={() => setViewClasses([cls])}
                                        style={{
                                            padding: '0.25rem 0.65rem', borderRadius: '20px',
                                            border: isSel ? '2px solid #d97706' : '1px solid #fde68a',
                                            background: isSel ? '#d97706' : 'white',
                                            color: isSel ? 'white' : '#92400e',
                                            fontSize: '0.7rem', fontWeight: isSel ? 700 : 500,
                                            cursor: 'pointer', transition: 'all 0.15s',
                                            display: 'flex', alignItems: 'center', gap: '3px',
                                        }}
                                    >
                                        {isSel && <Check size={10} />}
                                        {formatClassName(cls, currentSchool?.useRomanNumerals)}
                                    </button>
                                );
                            })}
                            {activeClasses.length === 0 && (
                                <span style={{ fontSize: '0.7rem', color: '#92400e', fontStyle: 'italic' }}>No classes found in settings.</span>
                            )}
                            {/* Copy button */}
                            {viewClasses.length === 1 && canEdit && (
                                <button
                                    onClick={openCopyModal}
                                    style={{
                                        padding: '0.3rem 0.75rem', borderRadius: '20px',
                                        border: '2px solid #7c3aed',
                                        background: '#7c3aed', color: 'white',
                                        fontSize: '0.7rem', fontWeight: 700,
                                        cursor: 'pointer', transition: 'all 0.15s',
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        marginLeft: '0.5rem',
                                    }}
                                    title={`Copy ${formatClassName(viewClasses[0], currentSchool?.useRomanNumerals)}'s ${months[currentMonth]} holidays to other classes`}
                                >
                                    <Copy size={11} /> Copy {months[currentMonth]} → Other Classes
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr',
                gap: '1.5rem'
            }}>
                {/* Calendar View */}
                <div className="glass-card" style={{ padding: isMobile ? '1rem' : '1.75rem', overflowX: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <h2 style={{ fontSize: isMobile ? '1.1rem' : '1.4rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>{months[currentMonth]} <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{currentYear}</span></h2>
                            <span style={{
                                fontSize: '0.68rem', fontWeight: 700,
                                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                color: 'white', padding: '0.3rem 0.75rem',
                                borderRadius: '20px', display: 'inline-flex',
                                alignItems: 'center', gap: '4px',
                                boxShadow: '0 2px 8px rgba(79,70,229,0.25)',
                            }}>
                                <CalendarDays size={11} />
                                {workingDaysInMonth} Working Days
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            <button className="btn" onClick={handlePrevMonth} style={{ padding: '0.45rem', minWidth: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}><ChevronLeft size={18} /></button>
                            <button
                                className="btn"
                                onClick={() => setViewDate(new Date())}
                                style={{
                                    padding: '0.35rem 0.85rem', minWidth: 'auto',
                                    background: 'linear-gradient(135deg, var(--primary), #7c3aed)',
                                    color: 'white', fontSize: '0.72rem', fontWeight: 700,
                                    border: 'none', borderRadius: '10px',
                                    boxShadow: '0 2px 6px rgba(99,102,241,0.3)',
                                }}
                            >
                                Today
                            </button>
                            <button className="btn" onClick={handleNextMonth} style={{ padding: '0.45rem', minWidth: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}><ChevronRight size={18} /></button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: '#e5e7eb', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                        {days.map((day, idx) => (
                            <div key={day} style={{
                                padding: isMobile ? '0.6rem 0.25rem' : '0.75rem',
                                background: 'linear-gradient(180deg, #f8fafc, #f1f5f9)',
                                textAlign: 'center',
                                fontWeight: 800,
                                fontSize: isMobile ? '0.6rem' : '0.75rem',
                                color: idx === 0 ? '#f43f5e' : '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            }}>
                                {isMobile ? day.substring(0, 1) : day}
                            </div>
                        ))}

                        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                            <div key={`empty-${i}`} style={{ minHeight: isMobile ? '60px' : '100px', background: '#fafbfc' }}></div>
                        ))}

                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const dateNum = i + 1;
                            const fullDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`;
                            const isToday = formatDate(new Date(), 'yyyy-MM-dd') === fullDateStr;
                            const isSunday = (firstDayOfMonth + i) % 7 === 0;

                            const dayEvents = filteredEvents?.filter((e: any) => {
                                const start = e.startDate || e.date;
                                const end = e.endDate || start;
                                return fullDateStr >= start && fullDateStr <= end;
                            }) || [];

                            return (
                                <div key={i}
                                    onClick={(e) => {
                                        if (canEdit && e.target === e.currentTarget) openModal(null, fullDateStr);
                                    }}
                                    style={{
                                        minHeight: isMobile ? '60px' : '100px',
                                        padding: isMobile ? '0.4rem' : '0.6rem',
                                        background: isToday
                                            ? 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(124,58,237,0.04))'
                                            : isSunday ? '#fffbfb' : 'white',
                                        position: 'relative',
                                        cursor: canEdit ? 'pointer' : 'default',
                                        borderLeft: isToday ? '3px solid var(--primary)' : 'none',
                                        transition: 'background 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => { if (!isToday) (e.currentTarget as HTMLElement).style.background = '#f8faff'; }}
                                    onMouseLeave={(e) => { if (!isToday) (e.currentTarget as HTMLElement).style.background = isSunday ? '#fffbfb' : 'white'; }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                                        <span
                                            onClick={(e) => { if (canEdit) { e.stopPropagation(); openModal(null, fullDateStr); } }}
                                            style={{
                                                fontSize: isMobile ? '0.72rem' : '0.82rem',
                                                fontWeight: isToday ? 900 : 700,
                                                color: isSunday ? '#f43f5e' : (isToday ? 'white' : '#374151'),
                                                ...(isToday ? {
                                                    background: 'linear-gradient(135deg, var(--primary), #7c3aed)',
                                                    width: '26px', height: '26px', borderRadius: '50%',
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.72rem', boxShadow: '0 2px 6px rgba(99,102,241,0.35)',
                                                } : {})
                                            }}
                                        >
                                            {dateNum}
                                        </span>
                                    </div>

                                    <div
                                        onClick={(e) => { if (canEdit && e.target === e.currentTarget) openModal(null, fullDateStr); }}
                                        style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
                                    >
                                        {dayEvents.map((event: any, idx: number) => (
                                            <div
                                                key={idx}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const isHoliday = event.type === 'HOLIDAY' || event.title?.toLowerCase().includes('holiday');
                                                    if (canEdit || !isHoliday) {
                                                        openModal(event);
                                                    }
                                                }}
                                                style={{
                                                    padding: isMobile ? '2px 5px' : '3px 8px',
                                                    borderRadius: '6px',
                                                    background: `linear-gradient(135deg, ${event.color || '#4f46e5'}, ${event.color || '#4f46e5'}dd)`,
                                                    color: 'white',
                                                    fontSize: isMobile ? '0.5rem' : '0.65rem',
                                                    fontWeight: 600,
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    lineHeight: '1.4',
                                                    boxShadow: `0 1px 4px ${event.color || '#4f46e5'}40`,
                                                    position: 'relative',
                                                    zIndex: 2,
                                                    cursor: (canEdit || !(event.type === 'HOLIDAY' || event.title?.toLowerCase().includes('holiday'))) ? 'pointer' : 'default',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '3px',
                                                    transition: 'transform 0.1s, box-shadow 0.1s',
                                                }}
                                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'; }}
                                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                                                title={`${event.title}${event.targetAudience && event.targetAudience !== 'ALL' ? ` (${event.targetAudience === 'CLASSES' ? (event.appliesTo || []).join(', ') : 'Staff Only'})` : ''}`}
                                            >
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {event.title}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Legend */}
                    <div className="glass-card" style={{ padding: '1.25rem', borderTop: '3px solid var(--primary)' }}>
                        <h3 style={{ fontWeight: 800, marginBottom: '1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                            <CalendarIcon size={18} color="var(--primary)" /> Legend
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {[
                                { color: '#4f46e5', label: 'Academic / Exams' },
                                { color: '#10b981', label: 'Extracurricular' },
                                { color: '#f43f5e', label: 'Holidays' },
                                { color: '#64748b', label: 'Other' },
                            ].map(item => (
                                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem' }}>
                                    <span style={{
                                        width: '24px', height: '8px', borderRadius: '4px',
                                        background: `linear-gradient(135deg, ${item.color}, ${item.color}cc)`,
                                        boxShadow: `0 1px 3px ${item.color}30`,
                                        flexShrink: 0,
                                    }} />
                                    <span style={{ fontWeight: 600, color: '#475569' }}>{item.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* How It Works (Admin only) */}
                    {isAdmin && (
                        <div className="glass-card" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #faf5ff, #f5f3ff)' }}>
                            <h3 style={{ fontWeight: 800, marginBottom: '0.875rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6d28d9' }}>
                                <Users size={16} color="#7c3aed" /> How It Works
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                    <span style={{ background: '#7c3aed', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, flexShrink: 0 }}>1</span>
                                    <span><strong>Fetch</strong> — Auto-creates holidays for Staff + all classes</span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                    <span style={{ background: '#7c3aed', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, flexShrink: 0 }}>2</span>
                                    <span><strong>Select</strong> — Pick a class & customize its holidays</span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                    <span style={{ background: '#7c3aed', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, flexShrink: 0 }}>3</span>
                                    <span><strong>Copy</strong> — Replicate to other classes</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Next Event */}
                    <div className="glass-card" style={{
                        padding: '1.5rem', color: 'white',
                        background: 'linear-gradient(135deg, #4f46e5, #7c3aed, #6d28d9)',
                        borderRadius: '16px',
                        boxShadow: '0 8px 25px rgba(99,102,241,0.3)',
                        position: 'relative', overflow: 'hidden',
                    }}>
                        <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                        <div style={{ position: 'absolute', bottom: '-30px', left: '-10px', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                        <p style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.85, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>⚡ Next Event</p>
                        {nextEvent ? (
                            <>
                                <h4 style={{ fontSize: '1.15rem', fontWeight: 900, marginBottom: '0.5rem', letterSpacing: '-0.01em' }}>{nextEvent.title}</h4>
                                {isAdmin && nextEvent.targetAudience && nextEvent.targetAudience !== 'ALL' && (
                                    <div style={{ marginBottom: '0.75rem' }}>
                                        <AudienceBadge event={nextEvent} />
                                    </div>
                                )}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    fontSize: '0.85rem', marginBottom: '1rem',
                                    background: 'rgba(255,255,255,0.15)', borderRadius: '10px',
                                    padding: '0.5rem 0.75rem',
                                }}>
                                    <CalendarIcon size={15} />
                                    {nextEvent.startDate && nextEvent.endDate && nextEvent.startDate !== nextEvent.endDate ? (
                                        `${formatDate(nextEvent.startDate, 'dd-MMM')} to ${formatDate(nextEvent.endDate, 'dd-MMM-yy')}`
                                    ) : (
                                        formatDate(nextEvent.startDate || nextEvent.date, 'dd-MMM-yy')
                                    )}
                                </div>
                                {canEdit && (
                                    <button onClick={() => openModal(nextEvent)} className="btn" style={{
                                        width: '100%', background: 'rgba(255,255,255,0.2)',
                                        border: '1px solid rgba(255,255,255,0.25)', color: 'white',
                                        borderRadius: '10px', fontWeight: 700, fontSize: '0.8rem',
                                        backdropFilter: 'blur(4px)',
                                    }}>
                                        View Details
                                    </button>
                                )}
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '1.25rem', border: '1px dashed rgba(255,255,255,0.25)', borderRadius: '10px' }}>
                                <p style={{ fontSize: '0.82rem', opacity: 0.8 }}>No upcoming events</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Event Management Modal */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1.5rem',
                    overflowY: 'auto',
                }}>
                    <div className="glass-card animate-scale-up" style={{
                        width: '100%',
                        maxWidth: '540px',
                        padding: '2rem',
                        position: 'relative',
                        background: 'white',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                    }}>
                        <button
                            onClick={() => setIsModalOpen(false)}
                            style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', color: 'var(--text-muted)' }}
                            className="btn-icon"
                        >
                            <X size={20} />
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
                            <div style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '12px',
                                background: 'rgba(99, 102, 241, 0.1)',
                                color: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <CalendarIcon size={22} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{!canEdit ? 'Event Details' : (selectedEvent ? 'Edit Event' : 'Add New Event')}</h2>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{!canEdit ? 'View event details below.' : 'Fill in the details for the school calendar.'}</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Title */}
                            <div className="input-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                                    <Tag size={16} color="var(--primary)" /> Event Title
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Enter event name (e.g., Science Fair)"
                                    className="input-field"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    disabled={!canEdit}
                                    style={{ cursor: !canEdit ? 'not-allowed' : 'text', opacity: !canEdit ? 0.7 : 1 }}
                                />
                            </div>

                            {/* Duration Toggle */}
                            <div className="input-group">
                                <label style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', display: 'block' }}>Event Duration</label>
                                <div style={{ display: 'flex', gap: '0.5rem', background: '#f8fafc', padding: '0.25rem', borderRadius: '10px', opacity: !canEdit ? 0.6 : 1, pointerEvents: !canEdit ? 'none' : 'auto' }}>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, isMultiDay: false })}
                                        disabled={!canEdit}
                                        style={{
                                            flex: 1, padding: '0.5rem', borderRadius: '8px', border: 'none',
                                            fontSize: '0.8125rem', fontWeight: 700, cursor: !canEdit ? 'not-allowed' : 'pointer',
                                            background: !formData.isMultiDay ? 'white' : 'transparent',
                                            color: !formData.isMultiDay ? 'var(--primary)' : 'var(--text-muted)',
                                            boxShadow: !formData.isMultiDay ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                                        }}
                                    >
                                        One Day
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, isMultiDay: true })}
                                        disabled={!canEdit}
                                        style={{
                                            flex: 1, padding: '0.5rem', borderRadius: '8px', border: 'none',
                                            fontSize: '0.8125rem', fontWeight: 700, cursor: !canEdit ? 'not-allowed' : 'pointer',
                                            background: formData.isMultiDay ? 'white' : 'transparent',
                                            color: formData.isMultiDay ? 'var(--primary)' : 'var(--text-muted)',
                                            boxShadow: formData.isMultiDay ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                                        }}
                                    >
                                        Multi-Day
                                    </button>
                                </div>
                            </div>

                            {/* Dates */}
                            <div style={{ display: 'grid', gridTemplateColumns: formData.isMultiDay ? '1fr 1fr' : '1fr', gap: '1rem' }}>
                                {!formData.isMultiDay ? (
                                    <div className="input-group">
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                                            <Clock size={16} color="var(--primary)" /> Date
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            className="input-field"
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value, startDate: e.target.value, endDate: e.target.value })}
                                            disabled={!canEdit}
                                            style={{ cursor: !canEdit ? 'not-allowed' : 'text', opacity: !canEdit ? 0.7 : 1 }}
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <div className="input-group">
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                                                <Clock size={16} color="var(--primary)" /> Start Date
                                            </label>
                                            <input type="date" required className="input-field" value={formData.startDate}
                                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value, date: e.target.value })}
                                                disabled={!canEdit} style={{ cursor: !canEdit ? 'not-allowed' : 'text', opacity: !canEdit ? 0.7 : 1 }} />
                                        </div>
                                        <div className="input-group">
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                                                <Clock size={16} color="var(--primary)" /> End Date
                                            </label>
                                            <input type="date" required className="input-field" value={formData.endDate}
                                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                                disabled={!canEdit} style={{ cursor: !canEdit ? 'not-allowed' : 'text', opacity: !canEdit ? 0.7 : 1 }} />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Category */}
                            <div className="input-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                                    <Layers size={16} color="var(--primary)" /> Category
                                </label>
                                <select
                                    className="input-field"
                                    value={formData.type}
                                    onChange={(e) => {
                                        const type = e.target.value;
                                        const color = EVENT_TYPES.find(t => t.id === type)?.color || '#4f46e5';
                                        // Auto-set audience for STAFF_HOLIDAY
                                        const targetAudience = type === 'STAFF_HOLIDAY' ? 'STAFF' : formData.targetAudience;
                                        setFormData({ ...formData, type, color, targetAudience });
                                    }}
                                    disabled={!canEdit}
                                    style={{ cursor: !canEdit ? 'not-allowed' : 'pointer', opacity: !canEdit ? 0.7 : 1 }}
                                >
                                    {EVENT_TYPES.map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* ===== TARGET AUDIENCE (Admin only) ===== */}
                            {canEdit && (
                                <div className="input-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                                        <Users size={16} color="var(--primary)" /> Who can see this event?
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {AUDIENCE_OPTIONS.map(opt => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, targetAudience: opt.id as any, appliesTo: opt.id !== 'CLASSES' ? [] : formData.appliesTo })}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.75rem',
                                                    padding: '0.625rem 0.875rem',
                                                    borderRadius: '10px',
                                                    border: formData.targetAudience === opt.id ? `2px solid ${opt.color}` : '1px solid var(--border)',
                                                    background: formData.targetAudience === opt.id ? `${opt.color}10` : 'white',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    fontSize: '0.8125rem',
                                                    fontWeight: formData.targetAudience === opt.id ? 700 : 500,
                                                    color: formData.targetAudience === opt.id ? opt.color : 'var(--text-main)',
                                                    transition: 'all 0.2s',
                                                }}
                                            >
                                                <span style={{ fontSize: '1.1rem' }}>{opt.icon}</span>
                                                <span style={{ flex: 1 }}>{opt.label}</span>
                                                {formData.targetAudience === opt.id && (
                                                    <Check size={14} />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Class selector — shown only when CLASSES is selected */}
                            {canEdit && formData.targetAudience === 'CLASSES' && (
                                <div className="input-group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <BookOpen size={16} color="#d97706" /> Select Classes
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({
                                                ...prev,
                                                appliesTo: prev.appliesTo.length === activeClasses.length ? [] : [...activeClasses]
                                            }))}
                                            style={{ fontSize: '0.7rem', fontWeight: 700, color: '#d97706', border: 'none', background: 'none', cursor: 'pointer' }}
                                        >
                                            {formData.appliesTo.length === activeClasses.length ? 'Clear All' : 'Select All'}
                                        </button>
                                    </div>
                                    {activeClasses.length === 0 ? (
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                            No classes found. Please add classes in Settings &gt; Class Settings.
                                        </p>
                                    ) : (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '150px', overflowY: 'auto' }}>
                                            {activeClasses.map((cls: string) => (
                                                <button
                                                    key={cls}
                                                    type="button"
                                                    onClick={() => toggleClass(cls)}
                                                    style={{
                                                        padding: '0.3rem 0.65rem',
                                                        borderRadius: '6px',
                                                        border: formData.appliesTo.includes(cls) ? '2px solid #d97706' : '1px solid var(--border)',
                                                        background: formData.appliesTo.includes(cls) ? '#d9770610' : 'white',
                                                        color: formData.appliesTo.includes(cls) ? '#d97706' : 'var(--text-main)',
                                                        fontSize: '0.75rem',
                                                        fontWeight: formData.appliesTo.includes(cls) ? 700 : 500,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        transition: 'all 0.15s',
                                                    }}
                                                >
                                                    {formData.appliesTo.includes(cls) && <Check size={10} />}
                                                    {formatClassName(cls, currentSchool?.useRomanNumerals)}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {formData.appliesTo.length > 0 && (
                                        <p style={{ fontSize: '0.72rem', color: '#d97706', marginTop: '0.5rem', fontWeight: 600 }}>
                                            ✓ {formData.appliesTo.length} class{formData.appliesTo.length > 1 ? 'es' : ''} selected
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Description */}
                            <div className="input-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                                    <Info size={16} color="var(--primary)" /> Description
                                </label>
                                <textarea
                                    placeholder="Optional details about the event..."
                                    className="input-field"
                                    style={{ height: '80px', resize: 'none', paddingTop: '0.75rem', cursor: !canEdit ? 'not-allowed' : 'text', opacity: !canEdit ? 0.7 : 1 }}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    disabled={!canEdit}
                                />
                            </div>

                            {/* Buttons */}
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                                {canEdit && selectedEvent && (
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        className="btn hover-lift"
                                        style={{ background: '#fee2e2', color: '#dc2626', border: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="btn hover-lift"
                                    style={{ flex: 1, border: '1px solid var(--border)', background: 'white' }}
                                >
                                    {canEdit ? 'Cancel' : 'Close'}
                                </button>
                                {canEdit && (
                                    <button
                                        type="submit"
                                        className="btn btn-primary hover-lift hover-glow"
                                        style={{ flex: 2 }}
                                    >
                                        {selectedEvent ? 'Update Event' : 'Create Event'}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== COPY HOLIDAYS MODAL ===== */}
            {isCopyModalOpen && (
                <div style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1001, padding: '1.5rem', overflowY: 'auto',
                }}>
                    <div className="glass-card animate-scale-up" style={{
                        width: '100%', maxWidth: '560px', padding: '2rem',
                        position: 'relative', background: 'white',
                        maxHeight: '90vh', overflowY: 'auto',
                    }}>
                        <button
                            onClick={() => setIsCopyModalOpen(false)}
                            style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', color: 'var(--text-muted)' }}
                            className="btn-icon"
                        >
                            <X size={20} />
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
                            <div style={{
                                width: '42px', height: '42px', borderRadius: '12px',
                                background: 'linear-gradient(135deg, #7c3aed22, #7c3aed11)',
                                color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Copy size={22} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Copy Holidays</h2>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {formatClassName(copySourceClass, currentSchool?.useRomanNumerals)}'s {months[currentMonth]} {currentYear} → other classes
                                </p>
                            </div>
                        </div>

                        {/* Select holidays to copy */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <label style={{ fontSize: '0.875rem', fontWeight: 700 }}>Select Holidays to Copy</label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const all = getClassMonthEvents(copySourceClass).map((e: any) => e.id);
                                        setCopySelectedEvents(prev => prev.length === all.length ? [] : all);
                                    }}
                                    style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7c3aed', border: 'none', background: 'none', cursor: 'pointer' }}
                                >
                                    {copySelectedEvents.length === getClassMonthEvents(copySourceClass).length ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                            <div style={{
                                display: 'flex', flexDirection: 'column', gap: '0.4rem',
                                maxHeight: '180px', overflowY: 'auto',
                                border: '1px solid var(--border)', borderRadius: '10px',
                                padding: '0.75rem',
                            }}>
                                {getClassMonthEvents(copySourceClass).map((evt: any) => {
                                    const isSelected = copySelectedEvents.includes(evt.id);
                                    return (
                                        <button
                                            key={evt.id}
                                            type="button"
                                            onClick={() => toggleCopyEvent(evt.id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                padding: '0.5rem 0.75rem', borderRadius: '8px',
                                                border: isSelected ? '2px solid #7c3aed' : '1px solid var(--border)',
                                                background: isSelected ? '#7c3aed10' : 'white',
                                                cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem',
                                                fontWeight: isSelected ? 700 : 500, transition: 'all 0.15s',
                                                color: isSelected ? '#7c3aed' : 'var(--text-main)',
                                            }}
                                        >
                                            {isSelected ? <Check size={13} /> : <div style={{ width: 13, height: 13, border: '2px solid var(--border)', borderRadius: '3px' }} />}
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: evt.color || '#f43f5e', flexShrink: 0 }} />
                                            <span style={{ flex: 1 }}>{evt.title}</span>
                                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                                {formatDate(evt.startDate || evt.date, 'dd-MMM')}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            <p style={{ fontSize: '0.72rem', color: '#7c3aed', marginTop: '0.4rem', fontWeight: 600 }}>
                                {copySelectedEvents.length} of {getClassMonthEvents(copySourceClass).length} selected
                            </p>
                        </div>

                        {/* Select target classes */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <label style={{ fontSize: '0.875rem', fontWeight: 700 }}>Copy To Classes</label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const available = activeClasses.filter((c: string) => c !== copySourceClass);
                                        setCopyTargetClasses(prev => prev.length === available.length ? [] : available);
                                    }}
                                    style={{ fontSize: '0.7rem', fontWeight: 700, color: '#d97706', border: 'none', background: 'none', cursor: 'pointer' }}
                                >
                                    {copyTargetClasses.length === activeClasses.filter((c: string) => c !== copySourceClass).length ? 'Clear All' : 'Select All'}
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {activeClasses.filter((c: string) => c !== copySourceClass).map((cls: string) => {
                                    const isSel = copyTargetClasses.includes(cls);
                                    return (
                                        <button
                                            key={cls}
                                            type="button"
                                            onClick={() => toggleCopyTarget(cls)}
                                            style={{
                                                padding: '0.3rem 0.65rem', borderRadius: '20px',
                                                border: isSel ? '2px solid #d97706' : '1px solid var(--border)',
                                                background: isSel ? '#d97706' : 'white',
                                                color: isSel ? 'white' : 'var(--text-main)',
                                                fontSize: '0.75rem', fontWeight: isSel ? 700 : 500,
                                                cursor: 'pointer', transition: 'all 0.15s',
                                                display: 'flex', alignItems: 'center', gap: '3px',
                                            }}
                                        >
                                            {isSel && <Check size={10} />}
                                            {formatClassName(cls, currentSchool?.useRomanNumerals)}
                                        </button>
                                    );
                                })}
                            </div>
                            {copyTargetClasses.length > 0 && (
                                <p style={{ fontSize: '0.72rem', color: '#d97706', marginTop: '0.5rem', fontWeight: 600 }}>
                                    ✓ {copyTargetClasses.length} class{copyTargetClasses.length > 1 ? 'es' : ''} selected
                                </p>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                type="button"
                                onClick={() => setIsCopyModalOpen(false)}
                                className="btn hover-lift"
                                style={{ flex: 1, border: '1px solid var(--border)', background: 'white' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleCopyHolidays}
                                disabled={isCopying || copyTargetClasses.length === 0 || copySelectedEvents.length === 0}
                                className="btn hover-lift hover-glow"
                                style={{
                                    flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                                    color: 'white', border: 'none',
                                    opacity: (isCopying || copyTargetClasses.length === 0 || copySelectedEvents.length === 0) ? 0.5 : 1,
                                }}
                            >
                                {isCopying ? <RefreshCw size={16} className="animate-spin" /> : <Copy size={16} />}
                                {isCopying ? 'Copying...' : `Copy ${copySelectedEvents.length} Holidays`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AcademicCalendar;
