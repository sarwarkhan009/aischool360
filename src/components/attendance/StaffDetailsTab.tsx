import React, { useMemo, useRef, useEffect, useState } from 'react';
import { User, Calendar, Search } from 'lucide-react';

interface StaffDetailsTabProps {
    staff: any[];
    attendanceRecords: any[];
    selectedStaffId: string;
    setSelectedStaffId: (id: string) => void;
    timePeriod: 'this-month' | 'last-month' | 'lifetime';
    setTimePeriod: (period: 'this-month' | 'last-month' | 'lifetime') => void;
}

const StaffDetailsTab: React.FC<StaffDetailsTabProps> = ({
    staff,
    attendanceRecords,
    selectedStaffId,
    setSelectedStaffId,
    timePeriod,
    setTimePeriod
}) => {
    const activeStaff = useMemo(() => staff.filter(s => s.status !== 'INACTIVE').sort((a, b) => (a.name || '').localeCompare(b.name || '')), [staff]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const [dropdownStyle, setDropdownStyle] = useState<any>({});

    // Calculate dropdown position
    useEffect(() => {
        if (showSuggestions && searchQuery.length > 0 && inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            setDropdownStyle({
                position: 'fixed',
                top: `${rect.bottom + 4}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                zIndex: 99999
            });
        }
    }, [showSuggestions, searchQuery]);

    // Filter staff based on search
    const filteredStaff = useMemo(() => {
        if (!searchQuery) return activeStaff;
        return activeStaff.filter(s =>
            (s.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (s.id?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (s.designation?.toLowerCase() || '').includes(searchQuery.toLowerCase())
        );
    }, [activeStaff, searchQuery]);

    // Get selected staff for display
    const selectedStaff = activeStaff.find(s => s.id === selectedStaffId);
    const displayValue = selectedStaff && !showSuggestions ?
        `${selectedStaff.name} (${selectedStaff.designation || 'Staff'})` :
        searchQuery;

    const handleSelectStaff = (staffMember: any) => {
        setSelectedStaffId(staffMember.id);
        setSearchQuery('');
        setShowSuggestions(false);
    };

    const handleInputFocus = () => {
        setSearchQuery('');
        setShowSuggestions(true);
    };

    // Calculate date range based on time period
    const dateRange = useMemo(() => {
        const today = new Date();
        let startDate: string;
        let endDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        if (timePeriod === 'this-month') {
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            startDate = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`;
        } else if (timePeriod === 'last-month') {
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
            startDate = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;
            endDate = `${lastMonthEnd.getFullYear()}-${String(lastMonthEnd.getMonth() + 1).padStart(2, '0')}-${String(lastMonthEnd.getDate()).padStart(2, '0')}`;
        } else {
            startDate = '2020-01-01'; // Lifetime
        }

        return { startDate, endDate };
    }, [timePeriod]);

    // Calculate staff statistics
    const staffStats = useMemo(() => {
        if (!selectedStaffId) return null;

        const staffAttendance = attendanceRecords.filter(record =>
            record.teacherId === selectedStaffId &&
            record.date >= dateRange.startDate &&
            record.date <= dateRange.endDate
        );

        const totalDays = staffAttendance.length;
        const presentCount = staffAttendance.filter(r => r.status === 'PRESENT').length;
        const lateCount = staffAttendance.filter(r => r.status === 'LATE').length;
        const absentCount = staffAttendance.filter(r => r.status === 'ABSENT').length;

        const presentPercent = totalDays > 0 ? ((presentCount / totalDays) * 100).toFixed(1) : '0';
        const latePercent = totalDays > 0 ? ((lateCount / totalDays) * 100).toFixed(1) : '0';
        const absentPercent = totalDays > 0 ? ((absentCount / totalDays) * 100).toFixed(1) : '0';

        return {
            totalDays,
            presentCount,
            lateCount,
            absentCount,
            presentPercent,
            latePercent,
            absentPercent,
            history: staffAttendance.sort((a, b) => b.date.localeCompare(a.date))
        };
    }, [selectedStaffId, attendanceRecords, dateRange]);

    return (
        <div>
            {/* Staff Selector & Time Period Chips */}
            <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', overflow: 'visible', position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="input-group" style={{ marginBottom: 0, width: '100%', position: 'relative' }}>
                        <label className="field-label">Search Staff Member</label>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 2, pointerEvents: 'none' }} />
                            <input
                                ref={inputRef}
                                type="text"
                                className="input-field"
                                style={{ paddingLeft: '3rem' }}
                                placeholder="Type name or ID..."
                                value={displayValue}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setShowSuggestions(true);
                                }}
                                onFocus={handleInputFocus}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                        {(['this-month', 'last-month', 'lifetime'] as const).map(period => (
                            <button
                                key={period}
                                onClick={() => setTimePeriod(period)}
                                className="btn"
                                style={{
                                    padding: '0.625rem 0.25rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    background: timePeriod === period ? 'var(--primary)' : 'white',
                                    color: timePeriod === period ? 'white' : 'var(--text-muted)',
                                    border: '1px solid var(--border)',
                                    textAlign: 'center',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {period === 'this-month' ? 'Current' : period === 'last-month' ? 'Previous' : 'All Time'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Fixed Position Dropdown - Renders at root level */}
            {showSuggestions && searchQuery.length > 0 && (
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 99998 }}
                        onClick={() => setShowSuggestions(false)}
                    />
                    <div style={{
                        ...dropdownStyle,
                        background: 'white',
                        border: '1px solid var(--border)',
                        borderRadius: '0.5rem',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                        maxHeight: '300px',
                        overflowY: 'auto'
                    }}>
                        {filteredStaff.length === 0 ? (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                No staff found matching "{searchQuery}"
                            </div>
                        ) : (
                            <>
                                {filteredStaff.slice(0, 20).map(s => (
                                    <div
                                        key={s.id}
                                        onClick={() => handleSelectStaff(s)}
                                        style={{
                                            padding: '0.875rem 1rem',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid var(--border)',
                                            transition: 'background 0.2s',
                                            background: selectedStaffId === s.id ? 'rgba(99, 102, 241, 0.1)' : 'white'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = selectedStaffId === s.id ? 'rgba(99, 102, 241, 0.1)' : 'white'}
                                    >
                                        <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{s.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                                            {s.designation || 'Staff'} • ID: {s.id}
                                        </div>
                                    </div>
                                ))}
                                {filteredStaff.length > 20 && (
                                    <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px solid var(--border)', background: 'rgba(248, 250, 252, 0.5)' }}>
                                        +{filteredStaff.length - 20} more results. Continue typing to narrow search.
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}

            {!selectedStaffId ? (
                <div className="glass-card" style={{ padding: '4rem', textAlign: 'center' }}>
                    <User size={64} color="var(--text-muted)" style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <h3 style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Search and select a staff member to view detailed attendance</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>You can search by name, ID, or designation</p>
                </div>
            ) : !staffStats ? (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
                </div>
            ) : (
                <>
                    {/* Staff Info & Pie Chart */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        {/* Staff Info Card */}
                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '1.5rem',
                                    fontWeight: 800
                                }}>
                                    {selectedStaff?.name?.charAt(0).toUpperCase() || 'S'}
                                </div>
                                <div>
                                    <h3 style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: '0.25rem' }}>{selectedStaff?.name}</h3>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{selectedStaff?.designation || 'Staff'}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {selectedStaff?.id}</div>
                                </div>
                            </div>

                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Total Days</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{staffStats.totalDays}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Time Period</div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'capitalize' }}>
                                            {timePeriod.replace('-', ' ')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Animated Pie Chart */}
                        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <h4 style={{ fontWeight: 800, marginBottom: '1.5rem' }}>Attendance Distribution</h4>
                            <div style={{ position: 'relative', width: '200px', height: '200px' }}>
                                <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                                    {/* Present - Green */}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="40"
                                        fill="none"
                                        stroke="#10b981"
                                        strokeWidth="20"
                                        strokeDasharray={`${parseFloat(staffStats.presentPercent) * 2.51} ${251 - parseFloat(staffStats.presentPercent) * 2.51}`}
                                        style={{ transition: 'stroke-dasharray 1s ease-in-out' }}
                                    />
                                    {/* Late - Orange */}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="40"
                                        fill="none"
                                        stroke="#f59e0b"
                                        strokeWidth="20"
                                        strokeDasharray={`${parseFloat(staffStats.latePercent) * 2.51} ${251 - parseFloat(staffStats.latePercent) * 2.51}`}
                                        strokeDashoffset={-parseFloat(staffStats.presentPercent) * 2.51}
                                        style={{ transition: 'stroke-dasharray 1s ease-in-out, stroke-dashoffset 1s ease-in-out' }}
                                    />
                                    {/* Absent - Red */}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="40"
                                        fill="none"
                                        stroke="#f43f5e"
                                        strokeWidth="20"
                                        strokeDasharray={`${parseFloat(staffStats.absentPercent) * 2.51} ${251 - parseFloat(staffStats.absentPercent) * 2.51}`}
                                        strokeDashoffset={-(parseFloat(staffStats.presentPercent) + parseFloat(staffStats.latePercent)) * 2.51}
                                        style={{ transition: 'stroke-dasharray 1s ease-in-out, stroke-dashoffset 1s ease-in-out' }}
                                    />
                                </svg>
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1.5rem', justifyContent: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981' }}></div>
                                    <span style={{ fontWeight: 600 }}>Present: {staffStats.presentPercent}%</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }}></div>
                                    <span style={{ fontWeight: 600 }}>Late: {staffStats.latePercent}%</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f43f5e' }}></div>
                                    <span style={{ fontWeight: 600 }}>Absent: {staffStats.absentPercent}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Attendance History Table */}
                    <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
                            <h3 style={{ fontWeight: 800, fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Calendar size={20} /> Attendance History
                            </h3>
                        </div>

                        {/* Desktop Table */}
                        <div className="report-table-desktop">
                            <div style={{ overflowX: 'auto' }}>
                                {staffStats.history.length === 0 ? (
                                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No attendance records found for the selected period
                                    </div>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ textAlign: 'left', background: 'rgba(248, 250, 252, 0.5)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                <th style={{ padding: '1rem 1.5rem' }}>Date</th>
                                                <th style={{ padding: '1rem 1.5rem' }}>Day</th>
                                                <th style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {staffStats.history.map((record: any, idx: number) => {
                                                const date = new Date(record.date);
                                                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

                                                return (
                                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>
                                                            {new Date(record.date).toLocaleDateString('en-IN')}
                                                        </td>
                                                        <td style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)' }}>{dayName}</td>
                                                        <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                                                            <div style={{ display: 'inline-flex', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 700, background: record.status === 'PRESENT' ? '#dcfce7' : record.status === 'LATE' ? '#fef3c7' : '#fee2e2', color: record.status === 'PRESENT' ? '#166534' : record.status === 'LATE' ? '#92400e' : '#991b1b' }}>
                                                                {record.status}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* Mobile View */}
                        <div className="report-cards-mobile" style={{ flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
                            {staffStats.history.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No records found.
                                </div>
                            ) : (
                                staffStats.history.map((record: any, idx: number) => {
                                    const date = new Date(record.date);
                                    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });

                                    return (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'white' }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{new Date(record.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{dayName}</div>
                                            </div>
                                            <div style={{ padding: '0.4rem 0.8rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontWeight: 800, background: record.status === 'PRESENT' ? '#10b981' : record.status === 'LATE' ? '#f59e0b' : '#f43f5e', color: 'white' }}>
                                                {record.status}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default StaffDetailsTab;
