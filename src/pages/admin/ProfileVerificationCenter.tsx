import React, { useState, useEffect } from 'react';
import {
    Search,
    CheckCircle,
    XCircle,
    Eye,
    User,
    Shield,
    FileText,
    CreditCard,
    MoreVertical,
    Check,
    X,
    Loader2,
    Calendar,
    Briefcase,
    GraduationCap,
    MapPin,
    ExternalLink,
    Phone,
    Mail
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useSchool } from '../../context/SchoolContext';

interface ProfileData {
    id: string;
    name: string;
    role: 'TEACHER' | 'PARENT' | 'DRIVER';
    mobile: string;
    email: string;
    aadharNo?: string;
    panNo?: string;
    aadharUrl?: string;
    panUrl?: string;
    addressProofUrl?: string;
    qualification?: string;
    experience?: string;
    updatedAt?: any;
    // For Parent profile mapping
    fatherName?: string;
    motherName?: string;
    fatherContactNo?: string;
    motherContactNo?: string;
}

export default function ProfileVerificationCenter() {
    const { currentSchool } = useSchool();
    const [profiles, setProfiles] = useState<ProfileData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProfile, setSelectedProfile] = useState<ProfileData | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<{ url: string, label: string } | null>(null);

    useEffect(() => {
        if (!currentSchool?.id) return;

        setLoading(true);

        // We need to fetch from both 'teachers' and 'students' collections
        const fetchAllProfiles = async () => {
            try {
                // 1. Fetch Teachers
                const teacherQuery = query(collection(db, 'teachers'), where('schoolId', '==', currentSchool.id));
                const teacherSnap = await getDocs(teacherQuery);
                console.log(`🔍 VerificationCenter: Found ${teacherSnap.docs.length} teachers for school ${currentSchool.id}`);

                const teacherData = teacherSnap.docs.map(doc => {
                    const data = doc.data();
                    console.log(`   - Teacher: ${data.name || 'No Name'} (${doc.id}), schoolId: ${data.schoolId}`);
                    return {
                        ...data,
                        id: doc.id,
                        role: 'TEACHER'
                    };
                }) as any[];

                const combined = teacherData.sort((a, b) => {
                    const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                    const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                    return dateB - dateA;
                });

                setProfiles(combined);
            } catch (error) {
                console.error('Error loading profiles:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAllProfiles();
    }, [currentSchool?.id]);

    const filteredProfiles = profiles.filter(p => {
        const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.mobile?.includes(searchTerm) ||
            p.email?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    const handleVerify = async (profileId: string, role: string) => {
        setIsVerifying(true);
        try {
            const col = role === 'TEACHER' ? 'teachers' : 'students';
            await updateDoc(doc(db, col, profileId), {
                kycVerified: true,
                kycVerifiedAt: new Date().toISOString()
            });
            alert('Profile marked as verified!');
            setSelectedProfile(null);
            // Refresh local state
            setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, kycVerified: true } : p));
        } catch (error) {
            console.error('Error verifying:', error);
            alert('Failed to verify');
        } finally {
            setIsVerifying(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem' }}>
                <Loader2 className="animate-spin" size={40} color="var(--primary)" />
                <p style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Loading verification queue...</p>
            </div>
        );
    }

    return (
        <div className="verification-center animate-fade-in no-scrollbar">
            <div className="header-section">
                <div>
                    <h1 className="page-title">Teacher Profile Verification</h1>
                    <p className="page-subtitle">Review and approve document submissions from teachers.</p>
                </div>

                <div className="stats-strip">
                    <div className="stat-box">
                        <span className="s-label">Total Submissions</span>
                        <span className="s-value">{profiles.length}</span>
                    </div>
                </div>
            </div>

            <div className="controls-bar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search by name, phone or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* List Table */}
            <div className="glass-card submissions-card">
                <table className="premium-table">
                    <thead>
                        <tr>
                            <th>User Details</th>
                            <th>Role</th>
                            <th>Identity Info</th>
                            <th>Docs Status</th>
                            <th>Last Update</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredProfiles.map((p, idx) => (
                            <tr key={p.id || idx}>
                                <td>
                                    <div className="user-cell">
                                        <div className="u-avatar">
                                            {(p as any).photo ? <img src={(p as any).photo} alt="" /> : <User size={20} />}
                                        </div>
                                        <div>
                                            <p className="u-name">{p.name || 'No Name'}</p>
                                            <p className="u-sub">{p.mobile || 'No Mobile'}</p>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span className={`role-badge ${p.role.toLowerCase()}`}>{p.role}</span>
                                </td>
                                <td>
                                    <div className="kyc-indicators">
                                        <p style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                            <CreditCard size={12} style={{ marginRight: '4px' }} />
                                            {p.aadharNo ? `Aadhar: ${p.aadharNo}` : 'Aadhar: Pending'}
                                        </p>
                                        <p style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                            <Shield size={12} style={{ marginRight: '4px' }} />
                                            {p.panNo ? `PAN: ${p.panNo}` : 'PAN: Pending'}
                                        </p>
                                    </div>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {p.aadharUrl && <DocStatusIcon type="AD" tooltip="Aadhar" />}
                                        {p.panUrl && <DocStatusIcon type="PN" tooltip="PAN" />}
                                        {p.addressProofUrl && <DocStatusIcon type="AP" tooltip="Address" />}
                                        {!p.aadharUrl && !p.panUrl && !p.addressProofUrl && <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>No Docs</span>}
                                    </div>
                                </td>
                                <td>
                                    <p className="u-sub">{p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : 'N/A'}</p>
                                </td>
                                <td>
                                    <button className="btn-icon-action" onClick={() => setSelectedProfile(p)}>
                                        <Eye size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Verification Drawer/Modal */}
            {selectedProfile && (
                <div className="drawer-overlay" onClick={() => setSelectedProfile(null)}>
                    <div className="drawer-content animate-slide-left" onClick={e => e.stopPropagation()}>
                        <div className="drawer-header">
                            <h2 style={{ fontWeight: 900 }}>Submission Details</h2>
                            <button className="close-btn" onClick={() => setSelectedProfile(null)}><X size={24} /></button>
                        </div>

                        <div className="drawer-body no-scrollbar">
                            <div className="profile-hero">
                                <div className="hero-avatar">
                                    {(selectedProfile as any).photo ? <img src={(selectedProfile as any).photo} alt="" /> : <User size={40} />}
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <h3>{selectedProfile.name}</h3>
                                    <div className={`role-badge ${selectedProfile.role.toLowerCase()}`}>{selectedProfile.role}</div>
                                </div>
                            </div>

                            <div className="detail-grid">
                                <div className="detail-item">
                                    <label><Phone size={14} /> Mobile</label>
                                    <p>{selectedProfile.mobile}</p>
                                </div>
                                <div className="detail-item">
                                    <label><Mail size={14} /> Email</label>
                                    <p>{selectedProfile.email}</p>
                                </div>
                                <div className="detail-item full">
                                    <label><MapPin size={14} /> Address</label>
                                    <p>{(selectedProfile as any).address || (selectedProfile as any).permanentAddress || 'Not provided'}</p>
                                </div>

                                {selectedProfile.role === 'TEACHER' && (
                                    <>
                                        <div className="detail-item">
                                            <label><GraduationCap size={14} /> Qualification</label>
                                            <p>{selectedProfile.qualification || 'N/A'}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label><Briefcase size={14} /> Experience</label>
                                            <p>{selectedProfile.experience ? `${selectedProfile.experience} Years` : 'N/A'}</p>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="documents-viewer">
                                <h4 className="section-title">Uploaded Governance Documents</h4>
                                <div className="doc-cards">
                                    <DocPreviewCard label="Aadhar Card" url={selectedProfile.aadharUrl} idNo={selectedProfile.aadharNo} onView={() => setPreviewDoc({ url: selectedProfile.aadharUrl!, label: 'Aadhar Card' })} />
                                    <DocPreviewCard label="PAN Card" url={selectedProfile.panUrl} idNo={selectedProfile.panNo} onView={() => setPreviewDoc({ url: selectedProfile.panUrl!, label: 'PAN Card' })} />
                                    <DocPreviewCard label="Address Proof" url={selectedProfile.addressProofUrl} onView={() => setPreviewDoc({ url: selectedProfile.addressProofUrl!, label: 'Address Proof' })} />
                                </div>
                            </div>
                        </div>

                        <div className="drawer-footer">
                            <button className="btn-secondary" onClick={() => setSelectedProfile(null)}>Close</button>
                            <button
                                className="btn-primary"
                                disabled={isVerifying || (selectedProfile as any).kycVerified}
                                onClick={() => handleVerify(selectedProfile.id, selectedProfile.role)}
                            >
                                {(selectedProfile as any).kycVerified ? <><Check size={18} /> Already Verified</> : <><CheckCircle size={18} /> Mark as Verified</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox for Preview */}
            {previewDoc && (
                <div className="doc-lightbox" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }} onClick={() => setPreviewDoc(null)}>
                    <div className="lightbox-content animate-scale-in" style={{ background: 'white', borderRadius: '2rem', padding: '2rem', maxWidth: '800px', width: '100%', position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <div className="lightbox-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>{previewDoc.label}</h3>
                            <button className="close-btn" style={{ background: '#f1f5f9', border: 'none', width: '44px', height: '44px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setPreviewDoc(null)}><X size={24} /></button>
                        </div>
                        <img src={previewDoc.url} style={{ width: '100%', borderRadius: '1rem', maxHeight: '70vh', objectFit: 'contain' }} alt="KYC Doc" />
                    </div>
                </div>
            )}

            <style>{`
                .verification-center { padding: 2rem; max-width: 1400px; margin: 0 auto; color: #1e293b; }
                .header-section { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2.5rem; }
                .page-title { font-size: 2rem; font-weight: 900; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
                .page-subtitle { color: #64748b; font-size: 0.95rem; font-weight: 500; }
                
                .stat-box { background: white; padding: 1.25rem 2rem; border-radius: 1.25rem; border: 1px solid #e2e8f0; text-align: right; }
                .s-label { font-size: 0.7rem; font-weight: 900; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 0.25rem; }
                .s-value { font-size: 1.5rem; font-weight: 900; color: var(--primary); }

                .controls-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; gap: 2rem; }
                @media (max-width: 768px) { .controls-bar { flex-direction: column; align-items: stretch; } }
                
                .search-box { position: relative; flex: 1; }
                .search-box svg { position: absolute; left: 1.25rem; top: 50%; transform: translateY(-50%); color: #94a3b8; }
                .search-box input { width: 100%; padding: 0.85rem 1.25rem 0.85rem 3rem; border: 1px solid #e2e8f0; border-radius: 1rem; outline: none; transition: 0.2s; font-weight: 600; font-size: 0.9rem; background: white; }
                .search-box input:focus { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1); }

                .filter-tabs { display: flex; background: #f1f5f9; padding: 0.35rem; border-radius: 0.85rem; gap: 0.25rem; }
                .filter-tabs button { padding: 0.5rem 1.25rem; border: none; background: transparent; color: #64748b; font-weight: 700; font-size: 0.85rem; border-radius: 0.65rem; cursor: pointer; transition: 0.2s; }
                .filter-tabs button.active { background: white; color: var(--primary); box-shadow: 0 2px 8px rgba(0,0,0,0.05); }

                .submissions-card { padding: 0; overflow: hidden; border-radius: 1.5rem; }
                .premium-table { width: 100%; border-collapse: collapse; text-align: left; }
                .premium-table th { background: #f8fafc; padding: 1.25rem 1.5rem; font-size: 0.75rem; font-weight: 900; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
                .premium-table td { padding: 1.25rem 1.5rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
                .premium-table tr:hover { background: #fcfdfe; }

                .user-cell { display: flex; align-items: center; gap: 1rem; }
                .u-avatar { width: 44px; height: 44px; border-radius: 12px; background: #eff6ff; color: var(--primary); display: flex; align-items: center; justifyContent: center; overflow: hidden; }
                .u-avatar img { width: 100%; height: 100%; object-fit: cover; }
                .u-name { font-weight: 800; font-size: 0.9375rem; margin-bottom: 0.125rem; }
                .u-sub { font-size: 0.75rem; color: #64748b; font-weight: 500; }

                .role-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 0.5rem; font-size: 0.7rem; font-weight: 900; letter-spacing: 0.02em; }
                .role-badge.teacher { background: #ecfeff; color: #0891b2; }
                .role-badge.parent { background: #fff1f2; color: #e11d48; }

                .doc-dot { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justifyContent: center; font-size: 0.65rem; font-weight: 900; background: #dcfce7; color: #16a34a; }
                .btn-icon-action { background: #f1f5f9; border: none; width: 36px; height: 36px; border-radius: 10px; color: #64748b; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justifyContent: center; }
                .btn-icon-action:hover { background: var(--primary); color: white; transform: translateY(-2px); }

                .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 2000; display: flex; justify-content: flex-end; }
                .drawer-content { width: 100%; max-width: 550px; background: white; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
                .drawer-header { padding: 1.5rem 2rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
                .drawer-body { padding: 2rem; flex: 1; overflow-y: auto; }
                .drawer-footer { padding: 1.5rem 2rem; border-top: 1px solid #e2e8f0; display: flex; gap: 1rem; }

                .profile-hero { margin-bottom: 2.5rem; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
                .hero-avatar { width: 100px; height: 100px; border-radius: 2rem; background: #f1f5f9; display: flex; align-items: center; justifyContent: center; overflow: hidden; border: 4px solid white; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); }
                .hero-avatar img { width: 100%; height: 100%; object-fit: cover; }

                .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 3rem; }
                .detail-item label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; font-weight: 900; color: #94a3b8; text-transform: uppercase; margin-bottom: 0.5rem; }
                .detail-item p { font-size: 1rem; font-weight: 700; color: #1e293b; margin: 0; }
                .detail-item.full { grid-column: 1 / -1; }

                .section-title { font-size: 0.85rem; font-weight: 900; text-transform: uppercase; color: #64748b; margin-bottom: 1.5rem; border-left: 4px solid var(--primary); padding-left: 1rem; }
                .doc-cards { display: grid; gap: 1rem; }
                
                .btn-primary { background: var(--primary); color: white; border: none; display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1.5rem; border-radius: 1rem; font-weight: 800; cursor: pointer; transition: 0.2s; flex: 1; justify-content: center; }
                .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
                .btn-secondary { background: #f1f5f9; color: #475569; border: none; padding: 0.85rem 1.5rem; border-radius: 1rem; font-weight: 800; cursor: pointer; }
            `}</style>
        </div >
    );
}

const DocStatusIcon = ({ type, tooltip }: { type: string, tooltip: string }) => (
    <div className="doc-dot" title={tooltip}>
        {type}
    </div>
);

const DocPreviewCard = ({ label, url, idNo, onView }: any) => {
    return (
        <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: '1.25rem', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 900, marginBottom: '0.25rem' }}>{label}</p>
                <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                    {idNo ? `No: ${idNo}` : url ? 'Scan Available' : 'No document uploaded'}
                </p>
            </div>
            {url ? (
                <button
                    onClick={onView}
                    className="hover-scale"
                    style={{
                        width: '36px', height: '36px', background: 'white', borderRadius: '10px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--primary)', border: 'none', cursor: 'pointer',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                    }}
                >
                    <Eye size={18} />
                </button>
            ) : (
                <div style={{ color: '#ef4444' }}><XCircle size={20} /></div>
            )}
        </div>
    );
};
