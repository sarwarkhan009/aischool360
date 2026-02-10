import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Library, Book, Loader2, Calendar, Bookmark, BookOpen } from 'lucide-react';

interface Props {
    studentId: string;
}

const ParentLibrary: React.FC<Props> = ({ studentId }) => {
    const [books, setBooks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBooks = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, 'library_issues'), where('studentId', '==', studentId || ''), where('status', '==', 'ISSUED'));
                const snap = await getDocs(q);
                setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchBooks();
    }, [studentId]);

    return (
        <div className="library-container animate-fade-in">
            {loading ? (
                <div style={{ textAlign: 'center', padding: '5rem' }}><Loader2 className="animate-spin" size={40} color="var(--primary)" /></div>
            ) : books.length > 0 ? (
                <div className="library-grid">
                    {books.map((b, i) => (
                        <div key={i} className="glass-card library-item-card">
                            <div className="book-icon-wrapper">
                                <BookOpen size={28} />
                                <div className="status-dot"></div>
                            </div>
                            <div className="book-details">
                                <div className="flex-between mb-05">
                                    <span className="book-id">#{b.bookId || 'LIB-001'}</span>
                                    <div className="due-tag">
                                        <Clock size={12} />
                                        <span>Due: {b.dueDate || 'N/A'}</span>
                                    </div>
                                </div>
                                <h3 className="book-title">{b.bookTitle || b.title || 'Unknown Title'}</h3>
                                <p className="book-author">By {b.author || 'School Library'}</p>

                                <div className="issue-meta">
                                    <div className="meta-row">
                                        <Calendar size={14} />
                                        <span>Issued on {b.issueDate || 'N/A'}</span>
                                    </div>
                                    <div className="meta-row">
                                        <Bookmark size={14} />
                                        <span>Category: General</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-icon-box">
                        <Library size={48} />
                    </div>
                    <h3>No Books Issued</h3>
                    <p>When your child borrows a book from the library, it will show up here with the due date.</p>
                </div>
            )}

            <style>{`
                .library-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }
                .library-item-card { padding: 1.5rem; border: 1px solid #f1f5f9; display: flex; gap: 1.5rem; transition: all 0.3s; position: relative; }
                .library-item-card:hover { transform: translateY(-5px); border-color: var(--primary); box-shadow: 0 15px 30px -10px rgba(0,0,0,0.05); }
                
                .book-icon-wrapper { min-width: 60px; height: 80px; background: #eff6ff; color: #3b82f6; borderRadius: 1rem; display: flex; align-items: center; justify-content: center; border: 1px solid #dbeafe; position: relative; }
                .status-dot { position: absolute; top: -4px; right: -4px; width: 12px; height: 12px; background: #10b981; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(16, 185, 129, 0.4); }
                
                .book-details { flex: 1; }
                .book-id { font-size: 0.7rem; font-weight: 900; color: #94a3b8; letter-spacing: 0.05em; }
                .due-tag { display: flex; align-items: center; gap: 0.35rem; padding: 0.25rem 0.6rem; background: #fff1f2; color: #ef4444; border-radius: 2rem; font-size: 0.7rem; font-weight: 900; }
                
                .book-title { font-size: 1.1rem; font-weight: 900; color: #1e293b; margin-bottom: 0.25rem; }
                .book-author { font-size: 0.8rem; font-weight: 700; color: #64748b; margin-bottom: 1.25rem; }
                
                .issue-meta { display: grid; gap: 0.5rem; }
                .meta-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; font-weight: 700; color: #94a3b8; }
                
                .empty-state { text-align: center; padding: 6rem 2rem; background: #f8fafc; border-radius: 2.5rem; border: 2px dashed #e2e8f0; }
                .empty-icon-box { width: 80px; height: 80px; background: white; border-radius: 2rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; color: #cbd5e1; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
                
                .clock-icon-small { min-width: 14px; }

                @media (max-width: 768px) {
                    .library-grid { grid-template-columns: 1fr; }
                    .library-item-card { padding: 1.25rem; gap: 1rem; }
                    .book-icon-wrapper { min-width: 50px; height: 70px; }
                }
            `}</style>
        </div>
    );
};

const Clock = ({ size, className }: any) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
);

export default ParentLibrary;
