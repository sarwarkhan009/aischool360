import React, { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, Calendar, Clock, Users, Award, MapPin, X, Trash2, Save, Printer } from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { db } from '../../lib/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { sortClasses } from '../../constants/app';
import { useSchool } from '../../context/SchoolContext';

interface ExamSlot {
    id: string;
    schoolId?: string;
    examId: string;
    examName: string;
    class: string;
    subject: string;
    date: string;
    startTime: string;
    duration: number; // minutes
    endTime?: string;
    venue?: string;
    invigilators?: string[];
    maxMarks: number;
    createdAt: string;
}

const ExamTimeTable: React.FC = () => {
    const { currentSchool } = useSchool();
    const { data: allSettings } = useFirestore<any>('settings');
    const { data: exams } = useFirestore<any>('exams');
    const { data: examSlots } = useFirestore<ExamSlot>('exam_slots');

    const [selectedExamId, setSelectedExamId] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [showSlotModal, setShowSlotModal] = useState(false);
    const [editingSlot, setEditingSlot] = useState<ExamSlot | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const activeClasses = sortClasses(allSettings?.filter((d: any) => d.type === 'class' && d.active !== false) || []);
    const classesList = activeClasses.map((c: any) => c.name);

    // Filter available exams (only published and scheduled ones)
    const availableExams = exams?.filter((e: any) =>
        e.schoolId === currentSchool?.id &&
        e.status !== 'CANCELLED' &&
        e.status !== 'DRAFT'
    ) || [];
    const selectedExam = availableExams.find((e: any) => e.id === selectedExamId);

    // Helper to get class name from ID/Slug
    const getClassName = (classId: string) => {
        if (!classId) return '';
        const cls = activeClasses.find((c: any) => c.id === classId || c.name === classId);
        return cls?.name || classId;
    };

    // Filter slots for selected exam, class and school
    const filteredSlots = examSlots?.filter(slot =>
        slot.schoolId === currentSchool?.id &&
        (!selectedExamId || slot.examId === selectedExamId) &&
        (!selectedClass || slot.class === selectedClass)
    ) || [];

    // Generate calendar days for current month
    const generateCalendarDays = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDay = firstDay.getDay();

        const days: (Date | null)[] = [];
        // Add empty slots for days before month starts
        for (let i = 0; i < startDay; i++) {
            days.push(null);
        }
        // Add all days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    };

    const getSlotForDate = (date: Date | null) => {
        if (!date) return [];
        // Use local date format to avoid timezone issues
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        return filteredSlots.filter(slot => slot.date === dateStr);
    };

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const handlePrintTimetable = (groupBy: 'date' | 'class' = 'date') => {
        // Create a new window for printing
        const printWindow = window.open('', '', 'width=800,height=600');
        if (!printWindow) {
            alert('Please allow popups to print the timetable');
            return;
        }

        // Sort slots
        const sortedSlots = [...filteredSlots].sort((a, b) => {
            if (groupBy === 'date') {
                const dateCompare = a.date.localeCompare(b.date);
                if (dateCompare !== 0) return dateCompare;
                return a.startTime.localeCompare(b.startTime);
            } else {
                const classCompare = a.class.localeCompare(b.class);
                if (classCompare !== 0) return classCompare;
                return a.date.localeCompare(b.date);
            }
        });

        // Group slots
        const groupedSlots: { [key: string]: ExamSlot[] } = {};
        sortedSlots.forEach(slot => {
            const key = groupBy === 'date' ? slot.date : slot.class;
            if (!groupedSlots[key]) {
                groupedSlots[key] = [];
            }
            groupedSlots[key].push(slot);
        });

        // Generate HTML
        const filterInfo = [];
        if (selectedExam) filterInfo.push(`Exam: ${selectedExam.name}`);
        if (selectedClass) filterInfo.push(`Class: ${getClassName(selectedClass)}`);
        const filterText = filterInfo.length > 0 ? filterInfo.join(' | ') : 'All Exams & Classes';

        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Exam Timetable - ${currentSchool?.name || 'School'}</title>
                <style>
                    @media print {
                        @page { 
                            margin: 0; 
                            size: auto;
                        }
                        body {
                            margin: 0;
                            padding: 1.5cm; /* Compounding padding for content area */
                        }
                        .no-print { display: none !important; }
                    }
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        padding: 30px;
                        max-width: 1000px;
                        margin: 0 auto;
                        color: #1f2937;
                    }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #6366f1; padding-bottom: 20px; }
                    h1 { margin: 0; color: #111827; font-size: 24px; }
                    h3 { margin: 10px 0 5px; color: #4b5563; }
                    .filters { color: #6b7280; font-size: 14px; margin-top: 5px; }
                    
                    .group-section { margin-bottom: 40px; page-break-inside: avoid; }
                    .group-header { 
                        background-color: #f3f4f6; 
                        padding: 10px 15px; 
                        font-weight: 800; 
                        font-size: 16px;
                        color: #1f2937;
                        border-left: 4px solid #6366f1;
                        margin-bottom: 10px;
                    }
                    
                    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; background: white; }
                    th, td { border: 1px solid #e5e7eb; padding: 10px 12px; text-align: left; font-size: 13px; }
                    th { background-color: #6366f1; color: white; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
                    tr:nth-child(even) { background-color: #f9fafb; }
                    
                    .no-data { text-align: center; padding: 40px; color: #9ca3af; border: 2px dashed #e5e7eb; borderRadius: 8px; }
                    .print-btn {
                        background: #6366f1;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 15px;
                        font-weight: 600;
                        margin-bottom: 30px;
                        box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.2);
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .footer { margin-top: 40px; text-align: center; color: #9ca3af; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📅 Exam Timetable (${groupBy === 'date' ? 'Date-wise' : 'Class-wise'})</h1>
                    <h3>${currentSchool?.name || 'School Name'}</h3>
                    <div class="filters">${filterText}</div>
                </div>
                <div class="no-print">
                    <button class="print-btn" onclick="window.print()">🖨️ Print Timetable PDF</button>
                    <p style="font-size: 12px; color: #666; margin-bottom: 30px;">Tip: You can change the layout to Portrait or Landscape in the print dialog.</p>
                </div>
        `;

        const groupKeys = Object.keys(groupedSlots).sort();

        if (groupKeys.length === 0) {
            html += '<div class="no-data">No exam slots found for the selected filters.</div>';
        } else {
            groupKeys.forEach(key => {
                let displayHeader = '';
                if (groupBy === 'date') {
                    displayHeader = new Date(key + 'T00:00:00').toLocaleDateString('en-IN', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                } else {
                    displayHeader = `Class: ${getClassName(key)}`;
                }

                html += `
                    <div class="group-section">
                        <div class="group-header">${displayHeader}</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>${groupBy === 'date' ? 'Time' : 'Date'}</th>
                                    <th>${groupBy === 'date' ? 'Class' : 'Time'}</th>
                                    <th>Subject</th>
                                    <th>Duration</th>
                                    <th>Max Marks</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                groupedSlots[key].forEach(slot => {
                    const firstCol = groupBy === 'date'
                        ? slot.startTime
                        : new Date(slot.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

                    const secondCol = groupBy === 'date'
                        ? getClassName(slot.class)
                        : slot.startTime;

                    html += `
                        <tr>
                            <td>${firstCol}</td>
                            <td>${secondCol}</td>
                            <td><strong>${slot.subject}</strong></td>
                            <td>${slot.duration}m</td>
                            <td>${slot.maxMarks}</td>
                        </tr>
                    `;
                });

                html += `
                            </tbody>
                        </table>
                    </div>
                `;
            });
        }

        html += `
                <div class="footer">
                    Generated on ${new Date().toLocaleString('en-IN')} | Powered by AI School 360
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handleAddSlot = (date?: Date) => {
        setEditingSlot({
            id: '',
            examId: selectedExamId || '',
            examName: selectedExam?.name || '',
            class: '',
            subject: '',
            date: date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            startTime: '09:00',
            duration: 180,
            maxMarks: 100,
            createdAt: new Date().toISOString()
        });
        setShowSlotModal(true);
    };

    const handleEditSlot = (slot: ExamSlot) => {
        setEditingSlot(slot);
        setShowSlotModal(true);
    };

    const handleDeleteSlot = async (slotId: string) => {
        if (!confirm('Delete this exam slot?')) return;
        try {
            await deleteDoc(doc(db, 'exam_slots', slotId));
            alert('Exam slot deleted successfully!');
        } catch (error) {
            console.error('Error deleting slot:', error);
            alert('Failed to delete slot');
        }
    };

    const calculateEndTime = (startTime: string, duration: number) => {
        const [hours, minutes] = startTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + duration;
        const endHours = Math.floor(totalMinutes / 60) % 24;
        const endMinutes = totalMinutes % 60;
        return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
    };

    const handleSaveSlot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSlot) return;

        if (!editingSlot.examId || !editingSlot.class || !editingSlot.subject) {
            alert('Please fill all required fields');
            return;
        }

        try {
            const slotData = {
                ...editingSlot,
                endTime: calculateEndTime(editingSlot.startTime, editingSlot.duration),
                updatedAt: new Date().toISOString()
            };

            const slotId = editingSlot.id || `slot_${Date.now()}`;
            await setDoc(doc(db, 'exam_slots', slotId), {
                ...slotData,
                id: slotId,
                schoolId: currentSchool?.id
            });

            alert('Exam slot saved successfully!');
            setShowSlotModal(false);
            setEditingSlot(null);
        } catch (error) {
            console.error('Error saving slot:', error);
            alert('Failed to save slot');
        }
    };

    const calendarDays = generateCalendarDays();

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '2rem' }}>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                        📅 Exam Time Table Designer
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>
                        Schedule individual exam dates and times for each subject
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <select
                            className="input-field"
                            onChange={(e) => {
                                if (e.target.value) handlePrintTimetable(e.target.value as any);
                                e.target.value = ''; // Reset
                            }}
                            defaultValue=""
                            style={{
                                background: 'white',
                                border: '1px solid var(--primary)',
                                color: 'var(--primary)',
                                fontWeight: 600
                            }}
                        >
                            <option value="" disabled>🖨️ Print Timetable PDF</option>
                            <option value="date">Print Date-Wise</option>
                            <option value="class">Print Class-Wise</option>
                        </select>
                    </div>
                    <button className="btn btn-primary" onClick={() => handleAddSlot()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={18} /> Add Exam Slot
                    </button>
                </div>
            </div>

            {/* Auto-Sync Feature */}
            {selectedExamId && selectedExam?.subjects && selectedExam.subjects.length > 0 && (
                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h4 style={{ fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--primary)' }}>🚀 Auto-Sync Available</h4>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
                                This exam has {selectedExam.subjects.length} subjects with dates/times configured. Generate calendar entries automatically.
                            </p>
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={async () => {
                                if (!confirm(`Generate ${selectedExam.subjects.length} timetable slots from exam data?`)) return;
                                try {
                                    const targetClasses = selectedExam.targetClasses || selectedExam.classes || [];
                                    for (const subject of selectedExam.subjects) {
                                        for (const classId of targetClasses) {
                                            const slotData = {
                                                id: `slot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                                schoolId: currentSchool?.id,
                                                examId: selectedExam.id,
                                                examName: selectedExam.name,
                                                class: classId,
                                                subject: subject.subjectName,
                                                date: subject.examDate,
                                                startTime: subject.examTime,
                                                duration: subject.duration || 180,
                                                maxMarks: subject.maxMarks || 100,
                                                venue: subject.roomNumber || '',
                                                createdAt: new Date().toISOString()
                                            };
                                            await setDoc(doc(db, 'exam_slots', slotData.id), slotData);
                                        }
                                    }
                                    alert('Timetable slots generated successfully!');
                                } catch (error) {
                                    console.error('Error generating slots:', error);
                                    alert('Failed to generate some slots');
                                }
                            }}
                            style={{ whiteSpace: 'nowrap' }}
                        >
                            <Plus size={16} style={{ marginRight: '0.5rem' }} />
                            Auto-Generate Slots
                        </button>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                    <div className="input-group">
                        <label className="field-label">Filter by Exam</label>
                        <select
                            className="input-field"
                            value={selectedExamId}
                            onChange={(e) => setSelectedExamId(e.target.value)}
                        >
                            <option value="">All Exams</option>
                            {availableExams.map((exam: any) => (
                                <option key={exam.id} value={exam.id}>{exam.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="input-group">
                        <label className="field-label">Filter by Class</label>
                        <select
                            className="input-field"
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                        >
                            <option value="">All Classes</option>
                            {activeClasses.map((cls: any) => (
                                <option key={cls.id} value={cls.id}>{cls.name}</option>
                            ))}
                        </select>
                    </div>
                    {selectedExam && (
                        <div style={{ padding: '0.75rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '0.75rem', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Selected Exam Details</div>
                            <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{selectedExam.name}</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                {selectedExam.classes?.length || 0} classes · {selectedExam.subjects?.length || 0} subjects
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Calendar */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
                {/* Month Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <button className="btn" onClick={handlePrevMonth} style={{ padding: '0.5rem', border: '1px solid var(--border)' }}>
                        <ChevronLeft size={20} />
                    </button>
                    <h3 style={{ fontWeight: 700, fontSize: '1.25rem' }}>
                        {currentMonth.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button className="btn" onClick={handleNextMonth} style={{ padding: '0.5rem', border: '1px solid var(--border)' }}>
                        <ChevronRight size={20} />
                    </button>
                </div>

                {/* Day Headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-muted)', padding: '0.5rem' }}>
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
                    {calendarDays.map((date, idx) => {
                        const slots = getSlotForDate(date);
                        const isToday = date && date.toDateString() === new Date().toDateString();

                        return (
                            <div
                                key={idx}
                                style={{
                                    minHeight: '100px',
                                    padding: '0.5rem',
                                    background: date ? (isToday ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-main)') : 'transparent',
                                    border: `1px solid ${isToday ? 'var(--primary)' : 'var(--border)'}`,
                                    borderRadius: '0.5rem',
                                    cursor: date ? 'pointer' : 'default',
                                    transition: 'all 0.2s'
                                }}
                                onClick={() => date && handleAddSlot(date)}
                            >
                                {date && (
                                    <>
                                        <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: isToday ? 'var(--primary)' : 'inherit' }}>
                                            {date.getDate()}
                                        </div>
                                        {slots.map(slot => (
                                            <div
                                                key={slot.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditSlot(slot);
                                                }}
                                                style={{
                                                    padding: '0.25rem 0.5rem',
                                                    background: 'var(--primary)',
                                                    color: 'white',
                                                    borderRadius: '0.25rem',
                                                    fontSize: '0.7rem',
                                                    marginBottom: '0.25rem',
                                                    cursor: 'pointer',
                                                    wordBreak: 'break-word'
                                                }}
                                            >
                                                <div style={{ fontWeight: 700 }}>{getClassName(slot.class)}</div>
                                                <div>{slot.subject}</div>
                                                <div style={{ opacity: 0.9 }}>{slot.startTime}</div>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Exam Slot Modal */}
            {showSlotModal && editingSlot && (() => {
                // Look up the exam for the modal based on editingSlot.examId
                const modalExam = availableExams.find((e: any) => e.id === editingSlot.examId);

                return (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '1rem'
                    }}>
                        <div className="animate-scale-in" style={{
                            width: '100%',
                            maxWidth: '650px',
                            background: 'white',
                            borderRadius: '1rem',
                            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            {/* Modal Header */}
                            <div style={{
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                color: 'white',
                                padding: '1.5rem 2rem',
                                borderRadius: '1rem 1rem 0 0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{
                                        background: 'rgba(255, 255, 255, 0.2)',
                                        padding: '0.75rem',
                                        borderRadius: '0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Calendar size={24} />
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
                                            {editingSlot.id ? 'Edit Exam Slot' : 'Add Exam Slot'}
                                        </h2>
                                        <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: '0.25rem 0 0' }}>
                                            Schedule individual exam dates and times
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowSlotModal(false);
                                        setEditingSlot(null);
                                    }}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.2)',
                                        border: 'none',
                                        color: 'white',
                                        padding: '0.5rem',
                                        borderRadius: '0.5rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div style={{ padding: '2rem' }}>

                                <form onSubmit={handleSaveSlot}>
                                    {/* Exam Selection Section */}
                                    <div style={{
                                        background: 'rgba(99, 102, 241, 0.05)',
                                        border: '1px solid rgba(99, 102, 241, 0.1)',
                                        borderRadius: '0.75rem',
                                        padding: '1.5rem',
                                        marginBottom: '1.5rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                            <Calendar size={18} style={{ color: 'var(--primary)' }} />
                                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Exam Details</h3>
                                        </div>
                                        <div className="input-group">
                                            <label className="field-label" style={{ fontSize: '0.875rem', fontWeight: 600 }}>Select Exam *</label>
                                            <select
                                                className="input-field"
                                                value={editingSlot.examId}
                                                onChange={(e) => {
                                                    const exam = availableExams.find((ex: any) => ex.id === e.target.value);
                                                    setEditingSlot({ ...editingSlot, examId: e.target.value, examName: exam?.name || '' });
                                                }}
                                                required
                                                style={{ fontSize: '0.9375rem' }}
                                            >
                                                <option value="">Select Exam</option>
                                                {availableExams.map((exam: any) => (
                                                    <option key={exam.id} value={exam.id}>{exam.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Class & Subject Section */}
                                    <div style={{
                                        background: 'rgba(16, 185, 129, 0.05)',
                                        border: '1px solid rgba(16, 185, 129, 0.1)',
                                        borderRadius: '0.75rem',
                                        padding: '1.5rem',
                                        marginBottom: '1.5rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                            <Users size={18} style={{ color: '#10b981' }} />
                                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Class & Subject</h3>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div className="input-group">
                                                <label className="field-label" style={{ fontSize: '0.875rem', fontWeight: 600 }}>Class *</label>
                                                <select
                                                    className="input-field"
                                                    value={editingSlot.class}
                                                    onChange={(e) => setEditingSlot({ ...editingSlot, class: e.target.value })}
                                                    required
                                                    style={{ fontSize: '0.9375rem' }}
                                                >
                                                    <option value="">Select Class</option>
                                                    {activeClasses.map((cls: any) => (
                                                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="input-group">
                                                <label className="field-label" style={{ fontSize: '0.875rem', fontWeight: 600 }}>Subject *</label>
                                                <select
                                                    className="input-field"
                                                    value={editingSlot.subject}
                                                    onChange={(e) => setEditingSlot({ ...editingSlot, subject: e.target.value })}
                                                    required
                                                    style={{ fontSize: '0.9375rem' }}
                                                >
                                                    <option value="">Select Subject</option>
                                                    {modalExam?.subjects?.map((subj: any) => (
                                                        <option key={subj.subjectId} value={subj.subjectName}>{subj.subjectName}</option>
                                                    )) || <option disabled>Select exam first</option>}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Date & Time Section */}
                                    <div style={{
                                        background: 'rgba(245, 158, 11, 0.05)',
                                        border: '1px solid rgba(245, 158, 11, 0.1)',
                                        borderRadius: '0.75rem',
                                        padding: '1.5rem',
                                        marginBottom: '1.5rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                            <Clock size={18} style={{ color: '#f59e0b' }} />
                                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Schedule</h3>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div className="input-group">
                                                <label className="field-label" style={{ fontSize: '0.875rem', fontWeight: 600 }}>Exam Date *</label>
                                                <input
                                                    type="date"
                                                    className="input-field"
                                                    value={editingSlot.date}
                                                    onChange={(e) => setEditingSlot({ ...editingSlot, date: e.target.value })}
                                                    required
                                                    style={{ fontSize: '0.9375rem' }}
                                                />
                                            </div>

                                            <div className="input-group">
                                                <label className="field-label" style={{ fontSize: '0.875rem', fontWeight: 600 }}>Start Time *</label>
                                                <input
                                                    type="time"
                                                    className="input-field"
                                                    value={editingSlot.startTime}
                                                    onChange={(e) => setEditingSlot({ ...editingSlot, startTime: e.target.value })}
                                                    required
                                                    style={{ fontSize: '0.9375rem' }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Duration & Marks Section */}
                                    <div style={{
                                        background: 'rgba(139, 92, 246, 0.05)',
                                        border: '1px solid rgba(139, 92, 246, 0.1)',
                                        borderRadius: '0.75rem',
                                        padding: '1.5rem',
                                        marginBottom: '1.5rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                            <Award size={18} style={{ color: '#8b5cf6' }} />
                                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Exam Parameters</h3>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div className="input-group">
                                                <label className="field-label" style={{ fontSize: '0.875rem', fontWeight: 600 }}>Duration (minutes) *</label>
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    value={editingSlot.duration}
                                                    onChange={(e) => setEditingSlot({ ...editingSlot, duration: parseInt(e.target.value) })}
                                                    min="30"
                                                    step="15"
                                                    required
                                                    style={{ fontSize: '0.9375rem' }}
                                                />
                                            </div>

                                            <div className="input-group">
                                                <label className="field-label" style={{ fontSize: '0.875rem', fontWeight: 600 }}>Maximum Marks *</label>
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    value={editingSlot.maxMarks}
                                                    onChange={(e) => setEditingSlot({ ...editingSlot, maxMarks: parseInt(e.target.value) })}
                                                    min="1"
                                                    required
                                                    style={{ fontSize: '0.9375rem' }}
                                                />
                                            </div>
                                        </div>
                                    </div>



                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                        {editingSlot.id && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleDeleteSlot(editingSlot.id);
                                                    setShowSlotModal(false);
                                                }}
                                                style={{
                                                    flex: 1,
                                                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '0.875rem 1.5rem',
                                                    borderRadius: '0.75rem',
                                                    fontWeight: 600,
                                                    fontSize: '0.9375rem',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                                                    transition: 'all 0.2s ease',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.5rem'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.4)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                                                }}
                                            >
                                                <Trash2 size={18} />
                                                Delete Slot
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowSlotModal(false);
                                                setEditingSlot(null);
                                            }}
                                            style={{
                                                flex: 1,
                                                background: 'white',
                                                color: 'var(--text-main)',
                                                border: '2px solid var(--border)',
                                                padding: '0.875rem 1.5rem',
                                                borderRadius: '0.75rem',
                                                fontWeight: 600,
                                                fontSize: '0.9375rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'var(--bg-main)';
                                                e.currentTarget.style.borderColor = 'var(--primary)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'white';
                                                e.currentTarget.style.borderColor = 'var(--border)';
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            style={{
                                                flex: 1,
                                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                                color: 'white',
                                                border: 'none',
                                                padding: '0.875rem 1.5rem',
                                                borderRadius: '0.75rem',
                                                fontWeight: 600,
                                                fontSize: '0.9375rem',
                                                cursor: 'pointer',
                                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                                            }}
                                        >
                                            <Save size={18} />
                                            Save Slot
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default ExamTimeTable;
