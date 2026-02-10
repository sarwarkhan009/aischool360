import React, { useState } from 'react';
import {
    Bell,
    Plus,
    Search,
    Clock,
    User,
    Send,
    AlertCircle,
    Info,
    Calendar,
    Trash
} from 'lucide-react';

import { useFirestore } from '../../hooks/useFirestore';
import { formatDate } from '../../utils/dateUtils';

const NoticeBoard: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('ALL');
    const [showModal, setShowModal] = useState(false);

    // Using useFirestore for shared database persistence
    const { data: notices, add: addNotice, remove: removeNotice, loading } = useFirestore<any>('notices');

    const [newNotice, setNewNotice] = useState({ title: '', content: '', target: 'All Students', type: 'REGULAR' });

    const handleCreate = async () => {
        if (!newNotice.title || !newNotice.content) return;

        try {
            await addNotice({
                ...newNotice,
                date: new Date().toISOString().split('T')[0],
                createdAt: new Date().toISOString(),
                author: 'Admin'
            });
            setShowModal(false);
            setNewNotice({ title: '', content: '', target: 'All Students', type: 'REGULAR' });
            alert('Notice posted successfully!');
        } catch (error) {
            console.error('Error adding notice:', error);
            alert('Failed to post notice.');
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this notice?')) {
            try {
                await removeNotice(id);
            } catch (error) {
                console.error('Error deleting notice:', error);
            }
        }
    };

    // Sort notices by creation date (newest first)
    const sortedNotices = [...notices].sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    const filteredNotices = sortedNotices.filter(n =>
        (filter === 'ALL' || n.type === filter) &&
        (n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            n.content.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '0.5rem' }}>Notice Board</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Important announcements and updates for students, parents, and teachers.</p>
                </div>
                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setShowModal(true)}>
                    <Plus size={18} /> Create New Notice
                </button>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search notices..."
                        className="input-field"
                        style={{ paddingLeft: '3rem' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="btn"
                    style={{ border: '1px solid var(--border)', background: 'white', padding: '0 1rem' }}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                >
                    <option value="ALL">All Categories</option>
                    <option value="REGULAR">Regular</option>
                    <option value="URGENT">Urgent</option>
                    <option value="INFO">Info</option>
                </select>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading notices...</div>
            ) : filteredNotices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '5rem', border: '1px dashed var(--border)', borderRadius: '1rem', color: 'var(--text-muted)' }}>
                    <Bell size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                    <p>No notices found.</p>
                </div>
            ) : (
                <div className="grid-cols-mobile" style={{ gap: '1.5rem' }}>
                    {filteredNotices.map((notice, index) => (
                        <div key={notice.id} className="glass-card hover-lift animate-slide-up" style={{
                            border: '1px solid var(--border)',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            position: 'relative',
                            animationDelay: `${index * 0.1}s`
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '0.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: notice.type === 'URGENT' ? 'rgba(244, 63, 94, 0.1)' : notice.type === 'INFO' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                        color: notice.type === 'URGENT' ? '#f43f5e' : notice.type === 'INFO' ? 'var(--primary)' : '#10b981'
                                    }}>
                                        {notice.type === 'URGENT' ? <AlertCircle size={20} /> : notice.type === 'INFO' ? <Info size={20} /> : <Bell size={20} />}
                                    </div>
                                    <span style={{
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '1rem',
                                        background: notice.type === 'URGENT' ? '#f43f5e' : 'rgba(99, 102, 241, 0.05)',
                                        color: notice.type === 'URGENT' ? 'white' : 'var(--primary)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>{notice.type}</span>
                                </div>
                                <button className="btn-icon" style={{ padding: '0.25rem' }} onClick={() => handleDelete(notice.id)}>
                                    <Trash size={18} color="#ef4444" />
                                </button>
                            </div>

                            <div>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>{notice.title}</h3>
                                <p style={{ fontSize: '0.9375rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{notice.content}</p>
                            </div>

                            <div style={{ marginTop: 'auto', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    <User size={14} color="var(--primary)" /> {notice.author}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', justifyContent: 'flex-end' }}>
                                    <Calendar size={14} color="var(--primary)" /> {formatDate(notice.date)}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    <Send size={14} color="var(--primary)" /> To: {notice.target}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', justifyContent: 'flex-end' }}>
                                    <Clock size={14} color="var(--primary)" /> Latest
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}


            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div className="glass-card animate-scale-in" style={{ padding: '2.5rem', width: '500px' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem' }}>Create New Notice</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div className="input-group">
                                <label>Title</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Notice Title"
                                    value={newNotice.title}
                                    onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
                                />
                            </div>
                            <div className="input-group">
                                <label>Target Audience</label>
                                <select
                                    className="input-field"
                                    value={newNotice.target}
                                    onChange={(e) => setNewNotice({ ...newNotice, target: e.target.value })}
                                >
                                    <option>All Students</option>
                                    <option>Parents</option>
                                    <option>Teachers</option>
                                    <option>Staff Only</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Type</label>
                                <select
                                    className="input-field"
                                    value={newNotice.type}
                                    onChange={(e) => setNewNotice({ ...newNotice, type: e.target.value })}
                                >
                                    <option value="REGULAR">Regular</option>
                                    <option value="URGENT">Urgent</option>
                                    <option value="INFO">Info</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Content</label>
                                <textarea
                                    className="input-field"
                                    style={{ minHeight: '120px' }}
                                    placeholder="Write your announcement here..."
                                    value={newNotice.content}
                                    onChange={(e) => setNewNotice({ ...newNotice, content: e.target.value })}
                                ></textarea>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button className="btn" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={() => setShowModal(false)}>Cancel</button>
                                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreate}>Post Notice</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NoticeBoard;
