import React, { useState } from 'react';
import {
    Upload,
    FileJson,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Calendar as CalendarIcon,
    Plus,
    X,
    Trash2,
    Check
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';

const UploadHolidays: React.FC = () => {
    const { currentSchool } = useSchool();
    const schoolId = currentSchool?.id;
    const { add: addMasterHoliday, data: existingMaster } = useFirestore<any>('master_holidays', [], { skipSchoolFilter: true });
    const { data: existingEvents } = useFirestore<any>('events');
    const [jsonInput, setJsonInput] = useState('');
    const [parsedHolidays, setParsedHolidays] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const formatDate = (date: Date | string) => {
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    };

    const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setJsonInput(content);
            processJson(content);
        };
        reader.readAsText(file);
    };

    const processJson = (content: string) => {
        setError(null);
        setSuccess(null);
        if (!content.trim()) {
            setError('Please provide JSON content.');
            return;
        }
        try {
            const data = JSON.parse(content);
            if (!Array.isArray(data)) {
                throw new Error('JSON must be an array of holiday objects.');
            }

            // Check if already exists in master list
            const validated = data.map((h: any, idx: number) => {
                if (!h.date || !h.title) {
                    throw new Error(`Item at index ${idx} is missing 'date' or 'title'.`);
                }
                const exists = existingMaster?.some(e => e.date === h.date && e.title === h.title);
                return {
                    ...h,
                    type: h.type || 'HOLIDAY',
                    description: h.description || 'Public Holiday',
                    color: h.color || '#f43f5e',
                    id: `temp-${idx}`,
                    status: exists ? 'EXISTS' : 'PENDING'
                };
            });

            setParsedHolidays(validated);
            if (activeTab === 'paste') setSuccess('JSON parsed successfully!');
        } catch (err: any) {
            setError(err.message || 'Invalid JSON format.');
            setParsedHolidays([]);
        }
    };

    const approveHoliday = async (holiday: any) => {
        try {
            await addMasterHoliday({
                title: holiday.title,
                date: holiday.date,
                type: holiday.type,
                description: holiday.description,
                color: holiday.color,
                year: selectedYear
            });
            setParsedHolidays(prev => prev.map(h => h.id === holiday.id ? { ...h, status: 'APPROVED' } : h));
        } catch (error) {
            console.error('Error adding to master list:', error);
        }
    };

    const approveAll = async () => {
        const pending = parsedHolidays.filter(h => h.status === 'PENDING');
        if (pending.length === 0) return;

        setIsProcessing(true);
        try {
            for (const h of pending) {
                await approveHoliday(h);
            }
            setSuccess(`Success! ${pending.length} holidays added to master list.`);
        } finally {
            setIsProcessing(false);
        }
    };

    const sampleJson = JSON.stringify([
        {
            "date": "2026-01-26",
            "title": "Republic Day",
            "description": "National Holiday",
            "type": "HOLIDAY"
        },
        {
            "date": "2026-08-15",
            "title": "Independence Day",
            "description": "National Holiday",
            "type": "HOLIDAY"
        }
    ], null, 2);

    return (
        <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '0.5rem' }}>Upload Master Holidays</h1>
                <p style={{ color: 'var(--text-muted)' }}>Bulk import school holidays from a JSON file or by pasting raw JSON.</p>
            </div>

            {/* Year Selector */}
            <div className="glass-card" style={{
                padding: '1rem 1.5rem', marginBottom: '1.5rem',
                display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap'
            }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Select Year:</span>
                {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1, new Date().getFullYear() + 2].map(yr => (
                    <button
                        key={yr}
                        onClick={() => setSelectedYear(yr)}
                        style={{
                            padding: '0.4rem 1.25rem', borderRadius: '20px',
                            border: selectedYear === yr ? '2px solid var(--primary)' : '1px solid var(--border)',
                            background: selectedYear === yr ? 'var(--primary)' : 'white',
                            color: selectedYear === yr ? 'white' : 'var(--text-main)',
                            fontWeight: 700, fontSize: '0.875rem',
                            cursor: 'pointer', transition: 'all 0.15s',
                        }}
                    >
                        {yr}
                    </button>
                ))}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Holidays uploaded will be tagged to year <strong>{selectedYear}</strong>
                </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '2rem' }}>
                {/* Left Column: Instructions & Upload */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="glass-card" style={{ padding: '0.5rem', display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.5)' }}>
                        <button
                            onClick={() => setActiveTab('upload')}
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                borderRadius: '0.75rem',
                                border: 'none',
                                background: activeTab === 'upload' ? 'white' : 'transparent',
                                color: activeTab === 'upload' ? 'var(--primary)' : 'var(--text-muted)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: activeTab === 'upload' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                            }}
                        >
                            <Upload size={18} style={{ marginBottom: '-4px', marginRight: '6px' }} /> Upload File
                        </button>
                        <button
                            onClick={() => setActiveTab('paste')}
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                borderRadius: '0.75rem',
                                border: 'none',
                                background: activeTab === 'paste' ? 'white' : 'transparent',
                                color: activeTab === 'paste' ? 'var(--primary)' : 'var(--text-muted)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: activeTab === 'paste' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                            }}
                        >
                            <FileJson size={18} style={{ marginBottom: '-4px', marginRight: '6px' }} /> Paste JSON
                        </button>
                    </div>

                    {activeTab === 'upload' ? (
                        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', border: '2px dashed #e2e8f0', minHeight: '260px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <input
                                type="file"
                                id="holiday-upload"
                                accept=".json"
                                onChange={handleFileUpload}
                                style={{ display: 'none' }}
                            />
                            <label htmlFor="holiday-upload" style={{ cursor: 'pointer', display: 'block' }}>
                                <div style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    background: 'rgba(99, 102, 241, 0.1)',
                                    color: 'var(--primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 1.5rem'
                                }}>
                                    <Upload size={32} />
                                </div>
                                <h4 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.5rem' }}>Choose JSON File</h4>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Click to browse or drag and drop</p>
                            </label>
                        </div>
                    ) : (
                        <div className="glass-card" style={{ padding: '1.5rem', minHeight: '260px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <textarea
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                placeholder='Paste your holiday JSON here...'
                                style={{
                                    flex: 1,
                                    width: '100%',
                                    minHeight: '200px',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    background: '#f8fafc',
                                    fontFamily: 'monospace',
                                    fontSize: '0.8125rem',
                                    resize: 'none',
                                    outline: 'none'
                                }}
                            />
                            <button
                                onClick={() => processJson(jsonInput)}
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '0.75rem' }}
                            >
                                Parse JSON content
                            </button>
                        </div>
                    )}

                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertCircle size={18} color="var(--primary)" /> Format Reference
                        </h3>
                        <pre style={{
                            background: '#0f172a',
                            color: '#e2e8f0',
                            padding: '1rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            overflowX: 'auto',
                            border: '1px solid #1e293b'
                        }}>
                            {sampleJson}
                        </pre>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                            Required fields: <code>date</code> (YYYY-MM-DD), <code>title</code>.
                        </p>
                    </div>

                    {error && (
                        <div style={{
                            padding: '1rem',
                            background: '#fee2e2',
                            color: '#dc2626',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            fontSize: '0.875rem'
                        }}>
                            <AlertCircle size={20} /> {error}
                        </div>
                    )}

                    {success && (
                        <div style={{
                            padding: '1rem',
                            background: '#dcfce7',
                            color: '#16a34a',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            fontSize: '0.875rem'
                        }}>
                            <CheckCircle2 size={20} /> {success}
                        </div>
                    )}
                </div>

                {/* Right Column: Preview of Master List */}
                <div className="glass-card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Global List Preview</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Year: <strong>{selectedYear}</strong></p>
                        </div>
                        {parsedHolidays.filter(h => h.status === 'PENDING').length > 0 && (
                            <button
                                onClick={approveAll}
                                disabled={isProcessing}
                                className="btn btn-primary"
                                style={{ padding: '0.6rem 2rem', background: 'linear-gradient(135deg, var(--primary), var(--primary-glow))' }}
                            >
                                {isProcessing ? 'Saving...' : 'Save All to Master List'}
                            </button>
                        )}
                    </div>

                    {parsedHolidays.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-muted)' }}>
                            <CalendarIcon size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                            <p>Import JSON to see the global holiday preview.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {parsedHolidays.map((holiday, idx) => (
                                <div key={idx} style={{
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: holiday.status === 'APPROVED' ? '#f0fdf4' : holiday.status === 'EXISTS' ? '#f8fafc' : 'white',
                                    opacity: holiday.status === 'EXISTS' ? 0.7 : 1
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {holiday.title}
                                            {holiday.status === 'APPROVED' && <CheckCircle2 size={16} color="#16a34a" />}
                                            {holiday.status === 'EXISTS' && <span style={{ fontSize: '0.65rem', background: '#e2e8f0', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Already in Master Database</span>}
                                        </div>
                                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                                            <CalendarIcon size={14} /> {holiday.date} • {holiday.description}
                                        </div>
                                    </div>

                                    <div>
                                        {holiday.status === 'APPROVED' ? (
                                            <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.75rem', background: '#dcfce7', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>SAVED</span>
                                        ) : holiday.status === 'PENDING' ? (
                                            <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.65rem', border: '1px solid var(--primary-glow)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>PENDING</span>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UploadHolidays;
