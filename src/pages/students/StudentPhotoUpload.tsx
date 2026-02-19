import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSchool } from '../../context/SchoolContext';
import { useFirestore } from '../../hooks/useFirestore';
import { useAuth } from '../../context/AuthContext';
import { Search, Camera, Upload, CheckCircle, Loader2, User, Filter, Image as ImageIcon } from 'lucide-react';
import { db } from '../../lib/firebase';
import { compressImage } from '../../utils/imageUtils';
import { getActiveClasses } from '../../constants/app';

const StudentPhotoUpload: React.FC = () => {
    const { schoolId } = useParams();
    const { currentSchool } = useSchool();
    const { data: students, loading, update: updateStudent } = useFirestore<any>('students');
    const { data: allSettings } = useFirestore<any>('settings');

    const { user } = useAuth();
    const { data: teachers } = useFirestore<any>('teachers');

    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [successId, setSuccessId] = useState<string | null>(null);

    const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

    // Get authorized classes if user is teacher
    const teacherProfile = user?.role === 'TEACHER' ? teachers?.find((t: any) => t.mobile === user.mobile) : null;
    const authorizedClasses = teacherProfile?.teachingClasses || [];

    const activeClasses = getActiveClasses(allSettings?.filter((d: any) => d.type === 'class') || [])
        .filter((c: any) => {
            if (user?.role === 'TEACHER' && authorizedClasses.length > 0) {
                return authorizedClasses.includes(c.name);
            }
            return true;
        });

    const classesList = activeClasses.map((c: any) => c.name);
    const sectionsList = selectedClass ? (activeClasses.find((c: any) => c.name === selectedClass)?.sections || []) : [];

    const filteredStudents = (students || []).filter((s: any) => {
        const matchesClass = !selectedClass || s.class === selectedClass;
        const matchesSection = !selectedSection || s.section === selectedSection;
        const matchesSearch = !searchTerm ||
            (s.name || s.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.admissionNo || s.id || '').toLowerCase().includes(searchTerm.toLowerCase());

        const isAuthorized = user?.role !== 'TEACHER' || authorizedClasses.includes(s.class);

        return matchesClass && matchesSection && matchesSearch && (s.status === 'ACTIVE' || !s.status) && isAuthorized;
    }).sort((a: any, b: any) => {
        const rollA = parseInt(a.rollNo || a.classRollNo || '0');
        const rollB = parseInt(b.rollNo || b.classRollNo || '0');
        if (rollA !== rollB) return rollA - rollB;
        return (a.name || '').localeCompare(b.name || '');
    });

    const handlePhotoUpload = async (studentId: string, file: File) => {
        if (!file) return;

        setUploadingId(studentId);
        try {
            // 1. Compress image (max 300x300, 0.6 quality for small size but good visibility)
            const compressedBase64 = await compressImage(file, 300, 300, 0.6);

            // 2. Update Firestore (Storing as base64 in student doc for simplicity/cost as requested "space kam use ho")
            // Note: For regular apps we'd use Storage, but base64 strings under 300x300 are ~10-15KB which fits well in Firestore docs
            // and avoids the complexity of Storage permissions for teachers.
            await updateStudent(studentId, {
                photo: compressedBase64,
                photoUpdatedAt: new Date().toISOString()
            });

            setSuccessId(studentId);
            setTimeout(() => setSuccessId(null), 3000);
        } catch (error) {
            console.error('Error uploading photo:', error);
            alert('Failed to upload photo. Please try again.');
        } finally {
            setUploadingId(studentId);
            setUploadingId(null);
        }
    };

    return (
        <div className="animate-fade-in no-scrollbar" style={{ paddingBottom: '4rem' }}>
            <div style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontSize: '2.25rem', fontWeight: 900, marginBottom: '0.5rem', letterSpacing: '-0.025em' }}>
                    Student Photo Upload
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.0625rem', fontWeight: 500 }}>
                    Select a class to upload and update student profile photos.
                </p>
            </div>

            {/* Filter Bar */}
            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '1 1 200px' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search student name or ID..."
                            className="input-field"
                            style={{ paddingLeft: '2.75rem', width: '100%' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flex: '0 0 auto' }}>
                    <select
                        className="input-field"
                        style={{ width: '160px' }}
                        value={selectedClass}
                        onChange={(e) => {
                            setSelectedClass(e.target.value);
                            setSelectedSection('');
                        }}
                    >
                        <option value="">All Classes</option>
                        {classesList.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <select
                        className="input-field"
                        style={{ width: '140px' }}
                        value={selectedSection}
                        onChange={(e) => setSelectedSection(e.target.value)}
                        disabled={!selectedClass}
                    >
                        <option value="">All Sections</option>
                        {sectionsList.map((s: string) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem' }}>
                    <Loader2 className="animate-spin" size={40} color="var(--primary)" style={{ margin: '0 auto' }} />
                    <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Loading student list...</p>
                </div>
            ) : filteredStudents.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '5rem' }}>
                    <div style={{ background: 'var(--bg-main)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: 'var(--text-muted)' }}>
                        <User size={40} />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>No Students Found</h3>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Try adjusting your filters or search term.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    {filteredStudents.map((stu: any) => (
                        <div key={stu.id} className="glass-card hover-lift" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                            {successId === stu.id && (
                                <div style={{ position: 'absolute', top: '1rem', right: '1rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 800 }}>
                                    <CheckCircle size={16} /> Updated
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ position: 'relative' }}>
                                    <div style={{
                                        width: '100px',
                                        height: '100px',
                                        borderRadius: '24px',
                                        background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                                        border: '1px solid var(--border)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                        boxShadow: 'var(--shadow-sm)'
                                    }}>
                                        {stu.photo ? (
                                            <img src={stu.photo} alt={stu.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ color: 'var(--primary)', opacity: 0.3 }}>
                                                <User size={48} />
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => fileInputRefs.current[stu.id]?.click()}
                                        className="btn-icon"
                                        style={{
                                            position: 'absolute',
                                            bottom: '-5px',
                                            right: '-5px',
                                            background: 'var(--primary)',
                                            color: 'white',
                                            border: '3px solid white',
                                            width: '36px',
                                            height: '36px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '12px'
                                        }}
                                        disabled={uploadingId === stu.id}
                                    >
                                        {uploadingId === stu.id ? <Loader2 size={16} className="animate-spin" /> : <Camera size={18} />}
                                    </button>
                                </div>

                                <div style={{ textAlign: 'center' }}>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>{stu.name || stu.fullName}</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                                            {stu.class} {stu.section}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                            Roll: #{stu.rollNo || stu.classRollNo || '-'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                        Adm No: {stu.admissionNo || stu.id?.slice(-8)}
                                    </div>
                                </div>

                                <input
                                    type="file"
                                    ref={el => { fileInputRefs.current[stu.id] = el; }}
                                    style={{ display: 'none' }}
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handlePhotoUpload(stu.id, file);
                                    }}
                                />

                                <button
                                    onClick={() => fileInputRefs.current[stu.id]?.click()}
                                    className="btn btn-primary"
                                    style={{
                                        width: '100%',
                                        padding: '0.625rem',
                                        fontSize: '0.8125rem',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        marginTop: '0.5rem',
                                        background: stu.photo ? 'rgba(99, 102, 241, 0.05)' : 'var(--primary)',
                                        color: stu.photo ? 'var(--primary)' : 'white',
                                        border: stu.photo ? '1px solid rgba(99, 102, 241, 0.2)' : 'none',
                                    }}
                                    disabled={uploadingId === stu.id}
                                >
                                    {stu.photo ? (
                                        <><ImageIcon size={16} /> <span>Change Photo</span></>
                                    ) : (
                                        <><Upload size={16} /> <span>Upload Photo</span></>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                .glass-card {
                    background: rgba(255, 255, 255, 0.8);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 1.5rem;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
                }
                .hover-lift:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
                }
                .input-field {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 0.75rem 1rem;
                    font-weight: 600;
                    color: #1e293b;
                    transition: all 0.3s ease;
                }
                .input-field:focus {
                    background: white;
                    border-color: var(--primary);
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
                    outline: none;
                }
                .btn-primary {
                    background: var(--primary);
                    color: white;
                    font-weight: 700;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .btn-icon:hover {
                    filter: brightness(1.1);
                    transform: scale(1.1);
                }
            `}</style>
        </div>
    );
};

export default StudentPhotoUpload;
