import React, { useState } from 'react';
import {
    Bell,
    Search,
    Clock,
    User,
    AlertCircle,
    Info,
    Calendar,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';

interface Props {
    notices: any[];
}

const ParentNoticeBoard: React.FC<Props> = ({ notices }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const filteredNotices = notices.filter(n =>
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>School Notice Board</h2>
                <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Stay updated with the latest announcements from the school.</p>
            </div>

            <div style={{ position: 'relative', marginBottom: '2rem' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                    type="text"
                    placeholder="Search announcements..."
                    className="input-field"
                    style={{ paddingLeft: '3rem', borderRadius: '1.25rem' }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {filteredNotices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '5rem', background: 'rgba(0,0,0,0.02)', borderRadius: '2rem' }}>
                    <Bell size={48} style={{ opacity: 0.1, margin: '0 auto 1.5rem' }} />
                    <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>No notices available at this time.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredNotices.map((notice, index) => {
                        const isExpanded = expandedId === notice.id;
                        return (
                            <div
                                key={notice.id || index}
                                className="glass-card hover-lift"
                                style={{
                                    padding: '1.5rem',
                                    border: '1px solid var(--border)',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s'
                                }}
                                onClick={() => setExpandedId(isExpanded ? null : notice.id)}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: notice.type === 'URGENT' ? 'rgba(244, 63, 94, 0.1)' : notice.type === 'INFO' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                            color: notice.type === 'URGENT' ? '#f43f5e' : notice.type === 'INFO' ? 'var(--primary)' : '#10b981'
                                        }}>
                                            {notice.type === 'URGENT' ? <AlertCircle size={20} /> : notice.type === 'INFO' ? <Info size={20} /> : <Bell size={20} />}
                                        </div>
                                        <div>
                                            <h3 style={{ fontWeight: 800, fontSize: '1.1rem' }}>{notice.title}</h3>
                                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <Calendar size={14} /> {formatDate(notice.date || notice.createdAt)}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.6rem',
                                                    fontWeight: 900,
                                                    textTransform: 'uppercase',
                                                    background: notice.type === 'URGENT' ? '#f43f5e' : 'rgba(0,0,0,0.05)',
                                                    color: notice.type === 'URGENT' ? 'white' : 'inherit',
                                                    padding: '0.1rem 0.5rem',
                                                    borderRadius: '4px'
                                                }}>
                                                    {notice.type}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </div>

                                {isExpanded && (
                                    <div className="animate-fade-in" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                                        <p style={{ lineHeight: 1.7, color: 'var(--text-main)', fontSize: '1rem', whiteSpace: 'pre-wrap' }}>
                                            {notice.content}
                                        </p>
                                        <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                            <User size={14} /> Posted by {notice.author || 'School Administration'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ParentNoticeBoard;
