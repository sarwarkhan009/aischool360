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
    Edit3
} from 'lucide-react';
import { useFirestore } from '../hooks/useFirestore';
import { useSchool } from '../context/SchoolContext';
import { useAuth } from '../context/AuthContext';

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

const AcademicCalendar: React.FC = () => {
    const { currentSchool } = useSchool();
    const { user } = useAuth();
    const schoolId = currentSchool?.id;
    const { data: events, add: addEvent, update: updateEvent, remove: removeEvent, loading } = useFirestore<any>('events');

    // Determine if user can edit calendar (ADMIN, MANAGER only)
    const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER';
    const { data: masterHolidays } = useFirestore<any>('master_holidays', [], { skipSchoolFilter: true });
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const [formData, setFormData] = useState({
        title: '',
        date: formatDate(new Date(), 'yyyy-MM-dd'),
        startDate: formatDate(new Date(), 'yyyy-MM-dd'),
        endDate: formatDate(new Date(), 'yyyy-MM-dd'),
        isMultiDay: false,
        type: 'ACADEMIC',
        description: '',
        color: '#4f46e5'
    });

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const EVENT_TYPES = [
        { id: 'ACADEMIC', label: 'Academic / Exams', color: '#4f46e5' },
        { id: 'EXTRACURRICULAR', label: 'Extracurricular', color: '#10b981' },
        { id: 'HOLIDAY', label: 'Holidays', color: '#f43f5e' },
        { id: 'OTHER', label: 'Other', color: '#64748b' }
    ];

    const currentYear = viewDate.getFullYear();
    const currentMonth = viewDate.getMonth();

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const handlePrevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));

    const openModal = (event: any = null, initialDate: string | null = null) => {
        // For view-only users, only allow viewing existing events, not creating new ones
        if (!canEdit && !event) {
            return; // Don't open modal for creating events if user can't edit
        }

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
                color: event.color || '#4f46e5'
            });
        } else {
            setSelectedEvent(null);
            setFormData({
                title: '',
                date: initialDate || formatDate(new Date(), 'yyyy-MM-dd'),
                startDate: initialDate || formatDate(new Date(), 'yyyy-MM-dd'),
                endDate: initialDate || formatDate(new Date(), 'yyyy-MM-dd'),
                isMultiDay: false,
                type: 'ACADEMIC',
                description: '',
                color: '#4f46e5'
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (selectedEvent) {
                await updateEvent(selectedEvent.id, { ...formData, schoolId });
            } else {
                await addEvent({ ...formData, schoolId });
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
            let data = masterHolidays?.filter(h => h.year === year || new Date(h.date).getFullYear() === year) || [];

            if (data.length === 0 && FALLBACK_HOLIDAYS[year]) {
                data = FALLBACK_HOLIDAYS[year];
            }

            if (data.length === 0) {
                alert(`No master holidays found for ${year}. Please upload them in Settings > Upload Master Holidays.`);
                return;
            }

            // Filter out holidays that already exist in the calendar (check title and date)
            const existingHolidays = events.filter(e => e.type === 'HOLIDAY');
            const newHolidays = data.filter((h: any) => {
                const hDate = h.date || h.startDate;
                return !existingHolidays.some(e => (e.date === hDate || e.startDate === hDate) && e.title === (h.title || h.localName || h.name));
            });

            if (newHolidays.length === 0) {
                alert(`All public holidays for ${year} are already in your calendar.`);
                return;
            }

            if (!window.confirm(`Found ${newHolidays.length} new holidays for ${year}. Do you want to add them all to your calendar?`)) {
                return;
            }

            let addedCount = 0;
            for (const holiday of newHolidays) {
                await addEvent({
                    title: holiday.title || holiday.localName || holiday.name,
                    date: holiday.date || holiday.startDate,
                    startDate: holiday.startDate || holiday.date,
                    endDate: holiday.endDate || holiday.date,
                    isMultiDay: !!holiday.isMultiDay,
                    type: holiday.type || 'HOLIDAY',
                    description: holiday.description || 'Public Holiday',
                    color: holiday.color || '#f43f5e',
                    schoolId
                });
                addedCount++;
            }

            alert(`Successfully added ${addedCount} holidays to your calendar.`);
        } catch (error) {
            console.error('Error fetching holidays:', error);
            alert('Unable to fetch holidays at this time.');
        } finally {
            setIsFetching(false);
        }
    };

    const nextEvent = useMemo(() => {
        const now = new Date();
        return events
            ?.filter(e => new Date(e.endDate || e.startDate || e.date) >= now)
            ?.sort((a, b) => new Date(a.startDate || a.date).getTime() - new Date(b.startDate || b.date).getTime())[0];
    }, [events]);

    return (
        <div className="animate-fade-in">
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
                            Fetch {isMobile ? 'Holidays' : 'Public Holidays'}
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

            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr',
                gap: '1.5rem'
            }}>
                {/* Calendar View */}
                <div className="glass-card" style={{ padding: isMobile ? '1rem' : '2rem', overflowX: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{months[currentMonth]} {currentYear}</h2>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn" onClick={handlePrevMonth} style={{ padding: '0.5rem', minWidth: 'auto', border: '1px solid var(--border)' }}><ChevronLeft size={18} /></button>
                            <button className="btn" onClick={handleNextMonth} style={{ padding: '0.5rem', minWidth: 'auto', border: '1px solid var(--border)' }}><ChevronRight size={18} /></button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)' }}>
                        {days.map(day => (
                            <div key={day} style={{
                                padding: isMobile ? '0.5rem 0.25rem' : '1rem',
                                background: 'var(--bg-main)',
                                textAlign: 'center',
                                fontWeight: 700,
                                fontSize: isMobile ? '0.65rem' : '0.875rem',
                                color: 'var(--text-muted)'
                            }}>
                                {isMobile ? day.substring(0, 1) : day}
                            </div>
                        ))}

                        {/* Empty slots before the first day */}
                        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                            <div key={`empty-${i}`} style={{ minHeight: isMobile ? '60px' : '100px', background: '#f8f9fa' }}></div>
                        ))}

                        {/* Calendar Days */}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const dateNum = i + 1;
                            const fullDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`;
                            const isToday = formatDate(new Date(), 'yyyy-MM-dd') === fullDateStr;
                            const isSunday = (firstDayOfMonth + i) % 7 === 0;

                            const dayEvents = events?.filter(e => {
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
                                        padding: isMobile ? '0.4rem' : '0.75rem',
                                        background: isToday ? 'rgba(99, 102, 241, 0.05)' : isSunday ? 'rgba(244, 63, 94, 0.02)' : 'white',
                                        position: 'relative',
                                        cursor: canEdit ? 'pointer' : 'default',
                                        border: isToday ? '2px solid var(--primary)' : 'none'
                                    }}
                                    className={canEdit ? "hover-lift" : ""}
                                >
                                    <span
                                        onClick={(e) => { if (canEdit) { e.stopPropagation(); openModal(null, fullDateStr); } }}
                                        style={{
                                            fontSize: isMobile ? '0.75rem' : '0.875rem',
                                            fontWeight: 800,
                                            color: isSunday ? '#f43f5e' : (isToday ? 'var(--primary)' : 'var(--text-main)')
                                        }}
                                    >
                                        {dateNum}
                                    </span>

                                    <div
                                        onClick={(e) => { if (canEdit && e.target === e.currentTarget) openModal(null, fullDateStr); }}
                                        style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}
                                    >
                                        {dayEvents.map((event, idx) => (
                                            <div
                                                key={idx}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Admins can click anything. Others can only click if it's NOT a holiday.
                                                    const isHoliday = event.type === 'HOLIDAY' || event.title?.toLowerCase().includes('holiday');
                                                    if (canEdit || !isHoliday) {
                                                        openModal(event);
                                                    }
                                                }}
                                                style={{
                                                    padding: isMobile ? '2px 4px' : '4px 8px',
                                                    borderRadius: '4px',
                                                    background: event.color || '#4f46e5',
                                                    color: 'white',
                                                    fontSize: isMobile ? '0.52rem' : '0.65rem',
                                                    fontWeight: 600,
                                                    whiteSpace: isMobile ? 'normal' : 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: isMobile ? 'initial' : 'ellipsis',
                                                    lineHeight: isMobile ? '1.1' : '1.2',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                                    position: 'relative',
                                                    zIndex: 2,
                                                    cursor: (canEdit || !(event.type === 'HOLIDAY' || event.title?.toLowerCase().includes('holiday'))) ? 'pointer' : 'default'
                                                }}
                                                title={event.title}
                                            >
                                                {event.title}
                                            </div>
                                        ))}
                                    </div>
                                    {isToday && <div style={{ position: 'absolute', top: '5px', right: '5px', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }}></div>}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Upcoming Events List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CalendarIcon size={20} color="var(--primary)" /> Legend
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem' }}>
                                <Circle size={10} fill="#4f46e5" color="#4f46e5" /> Academic / Exams
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem' }}>
                                <Circle size={10} fill="#10b981" color="#10b981" /> Extracurricular
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem' }}>
                                <Circle size={10} fill="#f43f5e" color="#f43f5e" /> Holidays
                            </div>
                        </div>
                    </div>

                    <div className="glass-card" style={{ padding: '1.5rem', background: 'var(--primary)', color: 'white' }}>
                        <p style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.5rem' }}>Next Event</p>
                        {nextEvent ? (
                            <>
                                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem' }}>{nextEvent.title}</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                                    <CalendarIcon size={16} />
                                    {nextEvent.startDate && nextEvent.endDate && nextEvent.startDate !== nextEvent.endDate ? (
                                        `${formatDate(nextEvent.startDate, 'dd-MMM')} to ${formatDate(nextEvent.endDate, 'dd-MMM-yy')}`
                                    ) : (
                                        formatDate(nextEvent.startDate || nextEvent.date, 'dd-MMM-yy')
                                    )}
                                </div>
                                {canEdit && (
                                    <button onClick={() => openModal(nextEvent)} className="btn" style={{ width: '100%', marginTop: '1.5rem', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white' }}>
                                        View Details
                                    </button>
                                )}
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '1rem', border: '1px dashed rgba(255,255,255,0.3)', borderRadius: '8px' }}>
                                <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>No upcoming events scheduled.</p>
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
                    padding: '1.5rem'
                }}>
                    <div className="glass-card animate-scale-up" style={{
                        width: '100%',
                        maxWidth: '500px',
                        padding: '2rem',
                        position: 'relative',
                        background: 'white'
                    }}>
                        <button
                            onClick={() => setIsModalOpen(false)}
                            style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', color: 'var(--text-muted)' }}
                            className="btn-icon"
                        >
                            <X size={20} />
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
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

                            <div className="input-group">
                                <label style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', display: 'block' }}>Event Duration</label>
                                <div style={{ display: 'flex', gap: '0.5rem', background: '#f8fafc', padding: '0.25rem', borderRadius: '10px', opacity: !canEdit ? 0.6 : 1, pointerEvents: !canEdit ? 'none' : 'auto' }}>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, isMultiDay: false })}
                                        disabled={!canEdit}
                                        style={{
                                            flex: 1,
                                            padding: '0.5rem',
                                            borderRadius: '8px',
                                            border: 'none',
                                            fontSize: '0.8125rem',
                                            fontWeight: 700,
                                            cursor: !canEdit ? 'not-allowed' : 'pointer',
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
                                            flex: 1,
                                            padding: '0.5rem',
                                            borderRadius: '8px',
                                            border: 'none',
                                            fontSize: '0.8125rem',
                                            fontWeight: 700,
                                            cursor: !canEdit ? 'not-allowed' : 'pointer',
                                            background: formData.isMultiDay ? 'white' : 'transparent',
                                            color: formData.isMultiDay ? 'var(--primary)' : 'var(--text-muted)',
                                            boxShadow: formData.isMultiDay ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                                        }}
                                    >
                                        Multi-Day
                                    </button>
                                </div>
                            </div>

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
                                            <input
                                                type="date"
                                                required
                                                className="input-field"
                                                value={formData.startDate}
                                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value, date: e.target.value })}
                                                disabled={!canEdit}
                                                style={{ cursor: !canEdit ? 'not-allowed' : 'text', opacity: !canEdit ? 0.7 : 1 }}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                                                <Clock size={16} color="var(--primary)" /> End Date
                                            </label>
                                            <input
                                                type="date"
                                                required
                                                className="input-field"
                                                value={formData.endDate}
                                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                                disabled={!canEdit}
                                                style={{ cursor: !canEdit ? 'not-allowed' : 'text', opacity: !canEdit ? 0.7 : 1 }}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

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
                                        setFormData({ ...formData, type, color });
                                    }}
                                    disabled={!canEdit}
                                    style={{ cursor: !canEdit ? 'not-allowed' : 'pointer', opacity: !canEdit ? 0.7 : 1 }}
                                >
                                    {EVENT_TYPES.map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

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

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
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
                                    style={{ flex: canEdit ? 1 : 1, border: '1px solid var(--border)', background: 'white' }}
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
                </div >
            )}
        </div >
    );
};

export default AcademicCalendar;
