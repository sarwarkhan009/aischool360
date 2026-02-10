import React, { useState, useEffect } from 'react';
import {
    Plus,
    Trash2,
    Image as ImageIcon,
    Loader2,
    X,
    Save,
    Calendar,
    Type
} from 'lucide-react';
import { db } from '../../lib/firebase';
import {
    collection,
    query,
    getDocs,
    doc,
    orderBy,
    serverTimestamp,
    where
} from 'firebase/firestore';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';

interface GalleryItem {
    id: string;
    title: string;
    description?: string;
    imageUrl: string;
    eventDate: string;
    createdAt: any;
}

const GalleryManagement: React.FC = () => {
    const { currentSchool } = useSchool();
    const [images, setImages] = useState<GalleryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { add: addImage, remove: removeImage } = useFirestore<any>('gallery');

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        imageUrl: '',
        eventDate: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchImages();
    }, []);

    const fetchImages = async () => {
        if (!currentSchool?.id) return;
        setLoading(true);
        try {
            const q = query(
                collection(db, 'gallery'),
                where('schoolId', '==', currentSchool.id),
                orderBy('eventDate', 'desc')
            );
            const snap = await getDocs(q);
            setImages(snap.docs.map(d => ({ id: d.id, ...d.data() } as GalleryItem)));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.imageUrl) return alert('Please provide an image URL');

        setIsSaving(true);
        try {
            await addImage({
                ...formData,
                createdAt: serverTimestamp()
            });
            setShowModal(false);
            setFormData({ title: '', description: '', imageUrl: '', eventDate: new Date().toISOString().split('T')[0] });
            fetchImages();
        } catch (e) {
            alert('Failed to upload image');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this image?')) return;
        try {
            await removeImage(id);
            fetchImages();
        } catch (e) {
            alert('Failed to delete image');
        }
    };

    return (
        <div className="animate-fade-in no-scrollbar">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '0.25rem' }}>School Event Gallery</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Manage photos and highlights from school events.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={20} /> Add New Photo
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '5rem' }}><Loader2 className="animate-spin" size={40} /></div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {images.length > 0 ? images.map((img) => (
                        <div key={img.id} className="glass-card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border)' }}>
                            <div style={{ position: 'relative', width: '100%', paddingTop: '66%', background: '#f1f5f9' }}>
                                <img
                                    src={img.imageUrl}
                                    alt={img.title}
                                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Image+Not+Found'; }}
                                />
                                <button
                                    onClick={() => handleDelete(img.id)}
                                    style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', padding: '0.5rem', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                                    className="hover-glow"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            <div style={{ padding: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                    <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>{img.title}</h3>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)', background: 'rgba(99,102,241,0.1)', padding: '0.2rem 0.5rem', borderRadius: '0.5rem' }}>
                                        {new Date(img.eventDate).toLocaleDateString()}
                                    </span>
                                </div>
                                <p style={{ fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.5 }}>{img.description}</p>
                            </div>
                        </div>
                    )) : (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem', background: 'rgba(0,0,0,0.02)', borderRadius: '2rem' }}>
                            <ImageIcon size={48} style={{ opacity: 0.1, margin: '0 auto 1.5rem' }} />
                            <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>No gallery images found.</p>
                        </div>
                    )}
                </div>
            )}

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                    <div className="glass-card animate-scale-in" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem', background: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h2 style={{ fontWeight: 900 }}>Add Event Photo</h2>
                            <button onClick={() => setShowModal(false)} className="btn-icon"><X size={24} /></button>
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'grid', gap: '1.25rem' }}>
                            <div className="input-group">
                                <label><Type size={16} /> Event Title</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="e.g. Annual Sport Meet 2025"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label><ImageIcon size={16} /> Image URL</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="https://example.com/photo.jpg"
                                    value={formData.imageUrl}
                                    onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                                    required
                                />
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                    Tip: You can upload to Imgur or similar and paste the direct link.
                                </p>
                            </div>

                            <div className="input-group">
                                <label><Calendar size={16} /> Event Date</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={formData.eventDate}
                                    onChange={e => setFormData({ ...formData, eventDate: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label>Short Description</label>
                                <textarea
                                    className="input-field"
                                    style={{ minHeight: '80px' }}
                                    placeholder="Describe the highlight..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ width: '100%', height: '3.5rem', fontWeight: 800 }}>
                                {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={20} /> Save Photo</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GalleryManagement;
