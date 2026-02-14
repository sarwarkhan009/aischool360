import React, { useState } from 'react';
import {
    Book,
    Search,
    Plus,
    Filter,
    Bookmark,
    Calendar,
    Clock,
    BookOpen,
    X,
    Save
} from 'lucide-react';
import { toProperCase } from '../../utils/formatters';

const LibraryManagement: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newBook, setNewBook] = useState({
        title: '',
        author: '',
        category: 'Fiction',
        isbn: ''
    });

    // Mock Book Data
    const books = [
        { id: 'BK001', title: 'Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle', category: 'Fiction', status: 'AVAILABLE', dueDate: null },
        { id: 'BK002', title: 'Introduction to Quantum Physics', author: 'David Griffiths', category: 'Science', status: 'ISSUED', dueDate: '2025-01-05' },
        { id: 'BK003', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', category: 'Literature', status: 'ISSUED', dueDate: '2024-12-30' },
        { id: 'BK004', title: 'History of Ancient Civilizations', author: 'Will Durant', category: 'History', status: 'RESERVED', dueDate: null },
        { id: 'BK005', title: 'Clean Code: A Handbook', author: 'Robert C. Martin', category: 'Technology', status: 'AVAILABLE', dueDate: null },
        { id: 'BK006', title: 'The Art of War', author: 'Sun Tzu', category: 'Philosophy', status: 'ISSUED', dueDate: '2024-12-28' },
        { id: 'BK007', title: 'Cosmos', author: 'Carl Sagan', category: 'Science', status: 'AVAILABLE', dueDate: null },
        { id: 'BK008', title: '1984', author: 'George Orwell', category: 'Fiction', status: 'RESERVED', dueDate: null },
    ];

    const handleAddBook = (e: React.FormEvent) => {
        e.preventDefault();
        alert(`Adding book: ${newBook.title} by ${newBook.author}`);
        setShowAddModal(false);
        setNewBook({ title: '', author: '', category: 'Fiction', isbn: '' });
    };

    return (
        <div className="animate-fade-in no-scrollbar">
            <div className="page-header">
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '0.5rem' }}>Library Management</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Manage school library catalog, track book issuance and returns.</p>
                </div>
                <button
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    onClick={() => setShowAddModal(true)}
                >
                    <Plus size={18} /> Add New Book
                </button>
            </div>

            <div className="responsive-grid-auto" style={{ marginBottom: '2rem' }}>
                <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                    <Book size={24} color="var(--primary)" style={{ margin: '0 auto 0.5rem' }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>1,254</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Books</p>
                </div>
                <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                    <BookOpen size={24} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>342</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Issued</p>
                </div>
                <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                    <Bookmark size={24} color="#f59e0b" style={{ margin: '0 auto 0.5rem' }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>15</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reserved</p>
                </div>
                <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                    <Clock size={24} color="#f43f5e" style={{ margin: '0 auto 0.5rem' }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>42</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Overdue</p>
                </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search by title, author, or ISBN..."
                            className="input-field"
                            style={{ paddingLeft: '3rem' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button className="btn" style={{ border: '1px solid var(--border)', background: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Filter size={18} /> Category
                    </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                <th style={{ padding: '1rem' }}>Book Details</th>
                                <th style={{ padding: '1rem' }}>Category</th>
                                <th style={{ padding: '1rem' }}>Status</th>
                                <th style={{ padding: '1rem' }}>Due Date</th>
                                <th style={{ padding: '1rem' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {books.map((book) => (
                                <tr key={book.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover-row">
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '54px',
                                                borderRadius: '4px',
                                                background: 'var(--bg-main)',
                                                border: '1px solid var(--border)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--primary)'
                                            }}>
                                                <Book size={20} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{book.title}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{book.author} • {book.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{book.category}</span>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.6rem',
                                            borderRadius: '1rem',
                                            fontSize: '0.7rem',
                                            fontWeight: 800,
                                            background: book.status === 'AVAILABLE' ? 'rgba(16, 185, 129, 0.1)' : book.status === 'RESERVED' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                                            color: book.status === 'AVAILABLE' ? '#10b981' : book.status === 'RESERVED' ? '#f59e0b' : 'var(--primary)'
                                        }}>{book.status}</span>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontSize: '0.875rem' }}>
                                            {book.dueDate ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f43f5e' }}>
                                                    <Calendar size={14} /> {book.dueDate}
                                                </span>
                                            ) : '-'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <button className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                                            {book.status === 'AVAILABLE' ? 'Issue Book' : 'Return Book'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add New Book Modal */}
            {showAddModal && (
                <div className="auth-overlay" style={{ display: 'flex', zIndex: 1000, backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="animate-scale-in" style={{
                        width: '100%',
                        maxWidth: '500px',
                        padding: '2.5rem',
                        background: 'white',
                        borderRadius: '24px',
                        position: 'relative',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                    }}>
                        <button
                            className="btn-icon"
                            style={{ position: 'absolute', right: '1.5rem', top: '1.5rem' }}
                            onClick={() => setShowAddModal(false)}
                        >
                            <X size={20} />
                        </button>

                        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.5rem', borderRadius: '12px', display: 'flex' }}>
                                <Book size={28} color="var(--primary)" />
                            </div>
                            Add New Book
                        </h2>

                        <form onSubmit={handleAddBook}>
                            <div className="input-group-vertical" style={{ marginBottom: '1.25rem' }}>
                                <label className="field-label">Book Title *</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    required
                                    value={newBook.title}
                                    onChange={e => setNewBook({ ...newBook, title: e.target.value })}
                                    onBlur={e => setNewBook({ ...newBook, title: toProperCase(e.target.value) })}
                                    placeholder="e.g. The Adventures of Tom Sawyer"
                                />
                            </div>

                            <div className="input-group-vertical" style={{ marginBottom: '1.25rem' }}>
                                <label className="field-label">Author Name *</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    required
                                    value={newBook.author}
                                    onChange={e => setNewBook({ ...newBook, author: e.target.value })}
                                    onBlur={e => setNewBook({ ...newBook, author: toProperCase(e.target.value) })}
                                    placeholder="e.g. Mark Twain"
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                                <div className="input-group-vertical">
                                    <label className="field-label">Category</label>
                                    <select
                                        className="input-field"
                                        value={newBook.category}
                                        onChange={e => setNewBook({ ...newBook, category: e.target.value })}
                                    >
                                        <option value="Fiction">Fiction</option>
                                        <option value="Science">Science</option>
                                        <option value="History">History</option>
                                        <option value="Literature">Literature</option>
                                        <option value="Technology">Technology</option>
                                    </select>
                                </div>
                                <div className="input-group-vertical">
                                    <label className="field-label">ISBN (Optional)</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={newBook.isbn}
                                        onChange={e => setNewBook({ ...newBook, isbn: e.target.value.toUpperCase() })}
                                        placeholder="ISBN-13"
                                    />
                                </div>
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: '3.5rem', fontSize: '1.1rem' }}>
                                <Save size={20} /> Save Book to Catalog
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LibraryManagement;

