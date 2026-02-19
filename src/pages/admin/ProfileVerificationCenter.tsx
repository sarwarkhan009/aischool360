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
    Mail,
    Trash2,
    Plus,
    Save,
    Edit2,
    Trash,
    Upload,
    Award
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { useSchool } from '../../context/SchoolContext';
import { compressImage } from '../../utils/imageUtils';

interface AcademicRecord {
    examPassed: string;
    school: string;
    board: string;
    passingYear: string;
    percentage: string;
    cgpaGrade: string;
    docUrl1: string;
    docUrl2: string;
}

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
    // Academic History
    academicHistory?: AcademicRecord[];
    activityCertificates?: string[];
    // Financial (part of 'sabhi chiz')
    accountTitle?: string;
    accountNo?: string;
    bankName?: string;
    ifscCode?: string;
    branchName?: string;
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
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);

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

                const combined = teacherData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

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

    const handleSelectProfile = (profile: ProfileData) => {
        setSelectedProfile(profile);
        setEditData({ ...profile });
        setIsEditing(false);
    };

    const handleSaveEdit = async () => {
        if (!selectedProfile) return;
        setIsSaving(true);
        try {
            const col = selectedProfile.role === 'TEACHER' ? 'teachers' : 'students';
            const { id, role, ...updatePayload } = editData;

            // Cleanup any undefined fields
            Object.keys(updatePayload).forEach(key => {
                if (updatePayload[key] === undefined) delete updatePayload[key];
            });

            await updateDoc(doc(db, col, id), {
                ...updatePayload,
                updatedAt: new Date().toISOString()
            });

            // Update local state
            setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...updatePayload } : p));
            setSelectedProfile({ ...selectedProfile, ...updatePayload });
            setIsEditing(false);
            alert('Profile updated successfully!');
        } catch (error) {
            console.error('Error saving profile:', error);
            alert('Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteProfile = async () => {
        if (!selectedProfile || !window.confirm(`Are you sure you want to PERMANENTLY DELETE the profile of ${selectedProfile.name}? This action cannot be undone.`)) return;

        setIsSaving(true);
        try {
            const col = selectedProfile.role === 'TEACHER' ? 'teachers' : 'students';
            // Actually delete it from Firestore
            const { deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, col, selectedProfile.id));

            // Remove from local list
            setProfiles(prev => prev.filter(p => p.id !== selectedProfile.id));
            setSelectedProfile(null);
            alert('Profile deleted successfully.');
        } catch (error) {
            console.error('Error deleting profile:', error);
            alert('Failed to delete profile');
        } finally {
            setIsSaving(false);
        }
    };

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
                                    <button className="btn-icon-action" onClick={() => handleSelectProfile(p)}>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <h2 style={{ fontWeight: 900, margin: 0 }}>Submission Details</h2>
                                {isEditing && <span style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontWeight: 800 }}>EDITING MODE</span>}
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                {!isEditing ? (
                                    <button className="btn-edit-toggle" onClick={() => setIsEditing(true)}>
                                        <Edit2 size={16} /> Edit Profile
                                    </button>
                                ) : (
                                    <button className="btn-edit-toggle active" onClick={() => setIsEditing(false)}>
                                        <X size={16} /> Cancel Editing
                                    </button>
                                )}
                                <button className="close-btn" onClick={() => setSelectedProfile(null)}><X size={24} /></button>
                            </div>
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
                                    {isEditing ? (
                                        <input type="text" className="v-input" value={editData.mobile} onChange={e => setEditData({ ...editData, mobile: e.target.value })} />
                                    ) : (
                                        <p>{selectedProfile.mobile}</p>
                                    )}
                                </div>
                                <div className="detail-item">
                                    <label><Mail size={14} /> Email</label>
                                    {isEditing ? (
                                        <input type="email" className="v-input" value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} />
                                    ) : (
                                        <p>{selectedProfile.email}</p>
                                    )}
                                </div>
                                <div className="detail-item full">
                                    <label><MapPin size={14} /> Address</label>
                                    {isEditing ? (
                                        <input type="text" className="v-input" value={editData.address || ''} onChange={e => setEditData({ ...editData, address: e.target.value })} />
                                    ) : (
                                        <p>{(selectedProfile as any).address || (selectedProfile as any).permanentAddress || 'Not provided'}</p>
                                    )}
                                </div>

                                {selectedProfile.role === 'TEACHER' && (
                                    <>
                                        <div className="detail-item">
                                            <label><GraduationCap size={14} /> Main Qualification</label>
                                            {isEditing ? (
                                                <input type="text" className="v-input" value={editData.qualification || ''} onChange={e => setEditData({ ...editData, qualification: e.target.value })} />
                                            ) : (
                                                <p>{selectedProfile.qualification || 'N/A'}</p>
                                            )}
                                        </div>
                                        <div className="detail-item">
                                            <label><Briefcase size={14} /> Experience</label>
                                            {isEditing ? (
                                                <input type="text" className="v-input" value={editData.experience || ''} onChange={e => setEditData({ ...editData, experience: e.target.value })} />
                                            ) : (
                                                <p>{selectedProfile.experience ? `${selectedProfile.experience} Years` : 'N/A'}</p>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="documents-viewer">
                                <h4 className="section-title">Governance Documents</h4>
                                <div className="doc-cards">
                                    <DocPreviewCard
                                        label="Aadhar Card"
                                        url={isEditing ? editData.aadharUrl : selectedProfile.aadharUrl}
                                        idNo={isEditing ? editData.aadharNo : selectedProfile.aadharNo}
                                        onView={() => setPreviewDoc({ url: (isEditing ? editData.aadharUrl : selectedProfile.aadharUrl)!, label: 'Aadhar Card' })}
                                        isEditing={isEditing}
                                        onEdit={(val: string) => setEditData({ ...editData, aadharNo: val })}
                                        onDelete={() => setEditData({ ...editData, aadharUrl: '' })}
                                        onUpload={async (file: File) => {
                                            const compressed = await compressImage(file, 1000, 1000, 0.5);
                                            setEditData({ ...editData, aadharUrl: compressed });
                                        }}
                                    />
                                    <DocPreviewCard
                                        label="PAN Card"
                                        url={isEditing ? editData.panUrl : selectedProfile.panUrl}
                                        idNo={isEditing ? editData.panNo : selectedProfile.panNo}
                                        onView={() => setPreviewDoc({ url: (isEditing ? editData.panUrl : selectedProfile.panUrl)!, label: 'PAN Card' })}
                                        isEditing={isEditing}
                                        onEdit={(val: string) => setEditData({ ...editData, panNo: val })}
                                        onDelete={() => setEditData({ ...editData, panUrl: '' })}
                                        onUpload={async (file: File) => {
                                            const compressed = await compressImage(file, 1000, 1000, 0.5);
                                            setEditData({ ...editData, panUrl: compressed });
                                        }}
                                    />
                                    <DocPreviewCard
                                        label="Address Proof"
                                        url={isEditing ? editData.addressProofUrl : selectedProfile.addressProofUrl}
                                        onView={() => setPreviewDoc({ url: (isEditing ? editData.addressProofUrl : selectedProfile.addressProofUrl)!, label: 'Address Proof' })}
                                        isEditing={isEditing}
                                        onDelete={() => setEditData({ ...editData, addressProofUrl: '' })}
                                        onUpload={async (file: File) => {
                                            const compressed = await compressImage(file, 1000, 1000, 0.5);
                                            setEditData({ ...editData, addressProofUrl: compressed });
                                        }}
                                    />
                                </div>
                            </div>

                            {selectedProfile.role === 'TEACHER' && (
                                <>
                                    <div className="documents-viewer" style={{ marginTop: '2rem' }}>
                                        <h4 className="section-title">Academic History</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '1rem' }}>
                                            {(isEditing ? editData.academicHistory || [] : selectedProfile.academicHistory || []).map((record: AcademicRecord, idx: number) => (
                                                <div key={idx} style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--primary)' }}>#QUALIFICATION {idx + 1}</span>
                                                        {isEditing && (
                                                            <button onClick={() => {
                                                                const updated = editData.academicHistory.filter((_: any, i: number) => i !== idx);
                                                                setEditData({ ...editData, academicHistory: updated });
                                                            }} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                                        {isEditing ? (
                                                            <>
                                                                <div className="v-input-group"><label>Exam</label><input type="text" value={record.examPassed} onChange={e => {
                                                                    const updated = [...editData.academicHistory];
                                                                    updated[idx] = { ...updated[idx], examPassed: e.target.value };
                                                                    setEditData({ ...editData, academicHistory: updated });
                                                                }} /></div>
                                                                <div className="v-input-group"><label>School</label><input type="text" value={record.school} onChange={e => {
                                                                    const updated = [...editData.academicHistory];
                                                                    updated[idx] = { ...updated[idx], school: e.target.value };
                                                                    setEditData({ ...editData, academicHistory: updated });
                                                                }} /></div>
                                                                <div className="v-input-group"><label>Board</label><input type="text" value={record.board} onChange={e => {
                                                                    const updated = [...editData.academicHistory];
                                                                    updated[idx] = { ...updated[idx], board: e.target.value };
                                                                    setEditData({ ...editData, academicHistory: updated });
                                                                }} /></div>
                                                                <div className="v-input-group"><label>Year</label><input type="text" value={record.passingYear} onChange={e => {
                                                                    const updated = [...editData.academicHistory];
                                                                    updated[idx] = { ...updated[idx], passingYear: e.target.value };
                                                                    setEditData({ ...editData, academicHistory: updated });
                                                                }} /></div>
                                                                <div className="v-input-group"><label>% Marks</label><input type="text" value={record.percentage} onChange={e => {
                                                                    const updated = [...editData.academicHistory];
                                                                    updated[idx] = { ...updated[idx], percentage: e.target.value };
                                                                    setEditData({ ...editData, academicHistory: updated });
                                                                }} /></div>
                                                                <div className="v-input-group"><label>CGPA</label><input type="text" value={record.cgpaGrade} onChange={e => {
                                                                    const updated = [...editData.academicHistory];
                                                                    updated[idx] = { ...updated[idx], cgpaGrade: e.target.value };
                                                                    setEditData({ ...editData, academicHistory: updated });
                                                                }} /></div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="v-label-v"><label>Exam</label><p>{record.examPassed}</p></div>
                                                                <div className="v-label-v"><label>School</label><p>{record.school}</p></div>
                                                                <div className="v-label-v"><label>Board</label><p>{record.board}</p></div>
                                                                <div className="v-label-v"><label>Year</label><p>{record.passingYear}</p></div>
                                                                <div className="v-label-v"><label>% Marks</label><p>{record.percentage}</p></div>
                                                                <div className="v-label-v"><label>CGPA</label><p>{record.cgpaGrade}</p></div>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                                        {[1, 2].map(dIdx => {
                                                            const key = `docUrl${dIdx}` as 'docUrl1' | 'docUrl2';
                                                            const url = record[key];
                                                            return (
                                                                <div key={dIdx} style={{ flex: 1, position: 'relative' }}>
                                                                    {url ? (
                                                                        <div onClick={() => setPreviewDoc({ url, label: `Qual Doc ${dIdx}` })} style={{ height: '60px', borderRadius: '0.5rem', overflow: 'hidden', cursor: 'pointer', border: '1px solid #e2e8f0' }}>
                                                                            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                        </div>
                                                                    ) : (
                                                                        <div style={{ height: '60px', borderRadius: '0.5rem', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.6rem' }}>Doc {dIdx} Empty</div>
                                                                    )}
                                                                    {isEditing && (
                                                                        <label style={{ cursor: 'pointer', position: 'absolute', bottom: -10, right: -5, background: 'var(--primary)', color: 'white', padding: '2px', borderRadius: '4px' }}>
                                                                            <Upload size={10} />
                                                                            <input type="file" hidden accept="image/*" onChange={async e => {
                                                                                const file = e.target.files?.[0];
                                                                                if (!file) return;
                                                                                const compressed = await compressImage(file, 1000, 1000, 0.5);
                                                                                const updated = [...editData.academicHistory];
                                                                                updated[idx] = { ...updated[idx], [key]: compressed };
                                                                                setEditData({ ...editData, academicHistory: updated });
                                                                            }} />
                                                                        </label>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                            {isEditing && (
                                                <button
                                                    onClick={() => setEditData({ ...editData, academicHistory: [...(editData.academicHistory || []), { examPassed: '', school: '', board: '', passingYear: '', percentage: '', cgpaGrade: '', docUrl1: '', docUrl2: '' }] })}
                                                    style={{ padding: '0.75rem', borderRadius: '0.75rem', border: '2px dashed var(--primary)', color: 'var(--primary)', background: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem' }}
                                                >
                                                    <Plus size={16} /> Add Qualification
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="documents-viewer" style={{ marginTop: '2rem' }}>
                                        <h4 className="section-title">Other Activity Certificates</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.75rem' }}>
                                            {(isEditing ? editData.activityCertificates || [] : selectedProfile.activityCertificates || []).map((url: string, idx: number) => (
                                                <div key={idx} style={{ position: 'relative' }}>
                                                    <div onClick={() => url && setPreviewDoc({ url, label: `Certificate ${idx + 1}` })} style={{ height: '100px', borderRadius: '1rem', overflow: 'hidden', cursor: 'pointer', border: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Award size={30} style={{ opacity: 0.2 }} />}
                                                    </div>
                                                    {isEditing && (
                                                        <button
                                                            onClick={() => {
                                                                const updated = editData.activityCertificates.filter((_: any, i: number) => i !== idx);
                                                                setEditData({ ...editData, activityCertificates: updated });
                                                            }}
                                                            style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: 'white', border: 'none', width: '20px', height: '20px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        >
                                                            <Trash size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            {isEditing && (
                                                <label style={{ height: '100px', borderRadius: '1rem', border: '2px dashed #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#f59e0b' }}>
                                                    <Plus size={24} />
                                                    <input type="file" hidden accept="image/*" onChange={async e => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        const compressed = await compressImage(file, 1000, 1000, 0.5);
                                                        setEditData({ ...editData, activityCertificates: [...(editData.activityCertificates || []), compressed] });
                                                    }} />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="drawer-footer">
                            <button className="btn-secondary" onClick={() => setSelectedProfile(null)}>Close</button>
                            {isEditing ? (
                                <>
                                    <button className="btn-delete-profile" disabled={isSaving} onClick={handleDeleteProfile}>
                                        <Trash2 size={18} /> Delete Profile
                                    </button>
                                    <button className="btn-primary" disabled={isSaving} onClick={handleSaveEdit}>
                                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Save Changes</>}
                                    </button>
                                </>
                            ) : (
                                <button
                                    className="btn-primary"
                                    disabled={isVerifying || (selectedProfile as any).kycVerified}
                                    onClick={() => handleVerify(selectedProfile.id, selectedProfile.role)}
                                >
                                    {(selectedProfile as any).kycVerified ? <><Check size={18} /> Already Verified</> : <><CheckCircle size={18} /> Mark as Verified</>}
                                </button>
                            )}
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

                .v-input { width: 100%; padding: 0.6rem 0.85rem; border: 1px solid #e2e8f0; border-radius: 0.75rem; background: #f8fafc; font-size: 0.9rem; font-weight: 700; color: #1e293b; outline: none; }
                .v-input:focus { border-color: var(--primary); background: white; }
                
                .v-input-group { display: flex; flexDirection: column; gap: 0.25rem; }
                .v-input-group label { font-size: 0.65rem; font-weight: 900; color: #64748b; text-transform: uppercase; }
                .v-input-group input { width: 100%; padding: 0.4rem 0.6rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-size: 0.8rem; font-weight: 700; outline: none; }
                
                .v-label-v label { font-size: 0.65rem; font-weight: 900; color: #94a3b8; text-transform: uppercase; margin-bottom: 0.1rem; }
                .v-label-v p { font-size: 0.75rem; font-weight: 700; color: #1e293b; margin: 0; }

                .btn-edit-toggle { display: flex; align-items: center; gap: 0.5rem; background: #eff6ff; color: var(--primary); border: 1px solid #bfdbfe; padding: 0.5rem 1rem; border-radius: 0.75rem; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: 0.2s; }
                .btn-edit-toggle.active { background: #fff1f2; color: #e11d48; border-color: #fecaca; }
                .btn-edit-toggle:hover { transform: translateY(-1px); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }

                .btn-delete-profile { display: flex; align-items: center; gap: 0.5rem; background: white; color: #ef4444; border: 1px solid #fecaca; padding: 0.85rem 1.5rem; border-radius: 1rem; font-weight: 800; font-size: 0.875rem; cursor: pointer; transition: 0.2s; }
                .btn-delete-profile:hover { background: #fff1f2; color: #ef4444; border-color: #ef4444; }
            `}</style>
        </div >
    );
}

const DocStatusIcon = ({ type, tooltip }: { type: string, tooltip: string }) => (
    <div className="doc-dot" title={tooltip}>
        {type}
    </div>
);

const DocPreviewCard = ({ label, url, idNo, onView, isEditing, onEdit, onDelete, onUpload }: any) => {
    return (
        <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: '1.25rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isEditing ? '0.75rem' : 0 }}>
                <div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 900, marginBottom: '0.25rem' }}>{label}</p>
                    {!isEditing && (
                        <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                            {idNo ? `No: ${idNo}` : url ? 'Scan Available' : 'No document uploaded'}
                        </p>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {url && (
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
                    )}
                    {isEditing && url && (
                        <button onClick={onDelete} style={{ width: '36px', height: '36px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Trash2 size={16} />
                        </button>
                    )}
                    {isEditing && !url && (
                        <label style={{ width: '36px', height: '36px', background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Upload size={16} />
                            <input type="file" hidden accept="image/*" onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) onUpload(file);
                            }} />
                        </label>
                    )}
                    {!url && !isEditing && <div style={{ color: '#ef4444' }}><XCircle size={20} /></div>}
                </div>
            </div>
            {isEditing && onEdit && (
                <input
                    type="text"
                    placeholder={`Enter ${label} No.`}
                    className="v-input"
                    style={{ background: 'white', fontSize: '0.8rem' }}
                    value={idNo || ''}
                    onChange={e => onEdit(e.target.value)}
                />
            )}
        </div>
    );
};
