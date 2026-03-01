import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Image as ImageIcon, Loader2, Calendar, ZoomIn } from 'lucide-react';

const ParentGallery: React.FC = () => {
    const [images, setImages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Real-time listener for gallery
    useEffect(() => {
        const q = query(collection(db, 'gallery'), orderBy('eventDate', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            setImages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error('Gallery listener error:', err);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    return (
        <div className="gallery-container animate-fade-in">
            {loading ? (
                <div style={{ textAlign: 'center', padding: '5rem' }}><Loader2 className="animate-spin" size={40} color="var(--primary)" /></div>
            ) : images.length > 0 ? (
                <div className="gallery-grid">
                    {images.map((img, idx) => (
                        <div key={idx} className="gallery-item-card glass-card">
                            <div className="image-wrapper">
                                <img
                                    src={img.imageUrl}
                                    alt={img.title}
                                    loading="lazy"
                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Gallery+Image'; }}
                                />
                                <div className="image-overlay">
                                    <div className="zoom-btn"><ZoomIn size={20} /></div>
                                    <div className="date-chip">
                                        <Calendar size={12} />
                                        <span>{new Date(img.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="gallery-info">
                                <h3 className="img-title">{img.title}</h3>
                                {img.description && <p className="img-desc">{img.description}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-icon-box">
                        <ImageIcon size={48} />
                    </div>
                    <h3>No Memories Yet</h3>
                    <p>School event photos and highlights will appear here soon.</p>
                </div>
            )}

            <style>{`
                .gallery-container { width: 100%; }
                .gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
                .gallery-item-card { padding: 0; overflow: hidden; border: 1px solid #f1f5f9; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
                .gallery-item-card:hover { transform: translateY(-8px); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
                
                .image-wrapper { position: relative; width: 100%; padding-top: 75%; background: #f8fafc; overflow: hidden; }
                .image-wrapper img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
                .gallery-item-card:hover .image-wrapper img { transform: scale(1.1); }
                
                .image-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%); opacity: 0; transition: opacity 0.3s; display: flex; flex-direction: column; justify-content: space-between; padding: 1rem; }
                .gallery-item-card:hover .image-overlay { opacity: 1; }
                
                .zoom-btn { align-self: flex-end; width: 36px; height: 36px; background: rgba(255,255,255,0.2); backdrop-filter: blur(8px); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; cursor: pointer; border: 1px solid rgba(255,255,255,0.3); }
                .date-chip { align-self: flex-start; display: flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.75rem; background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); color: white; border-radius: 2rem; font-size: 0.7rem; font-weight: 800; border: 1px solid rgba(255,255,255,0.3); }
                
                .gallery-info { padding: 1.5rem; }
                .img-title { font-size: 1.1rem; font-weight: 900; color: #1e293b; margin-bottom: 0.5rem; line-height: 1.3; }
                .img-desc { font-size: 0.85rem; color: #64748b; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
                
                .empty-state { text-align: center; padding: 6rem 2rem; background: #f8fafc; border-radius: 2.5rem; border: 2px dashed #e2e8f0; }
                .empty-icon-box { width: 80px; height: 80px; background: white; border-radius: 2rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; color: #cbd5e1; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }

                @media (max-width: 768px) {
                    .gallery-grid { grid-template-columns: 1fr 1fr; gap: 1rem; }
                    .gallery-info { padding: 1rem; }
                    .img-title { font-size: 1rem; }
                }
                @media (max-width: 480px) {
                    .gallery-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default ParentGallery;
