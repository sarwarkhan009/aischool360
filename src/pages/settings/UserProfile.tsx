import React, { useState, useEffect, useRef } from 'react';

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
import { useAuth } from '../../context/AuthContext';
import {
    User,
    Mail,
    Phone,
    MapPin,
    Shield,
    Camera,
    Save,
    Lock,
    CreditCard,
    FileText,
    Image as ImageIcon,
    Loader2,
    CheckCircle2,
    X,
    Briefcase,
    GraduationCap,
    Heart,
    ChevronRight,
    Search,
    Eye,
    TrendingUp,
    Info,
    AlertCircle,
    Fingerprint,
    Calendar,
    Users,
    BookOpen,
    Facebook,
    Twitter,
    Linkedin,
    Instagram,
    Landmark,
    Home,
    Globe,
    Building2,
    Clock,
    Edit2,
    Plus,
    Trash2,
    Upload,
    Award
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { compressImage } from '../../utils/imageUtils';
import { toProperCase } from '../../utils/formatters';
import ErrorBoundary from '../../components/ErrorBoundary';

type ProfileSection = 'GENERAL' | 'SECURITY' | 'KYC' | 'PROFESSIONAL' | 'ACADEMIC' | 'FAMILY' | 'FINANCIAL' | 'ADDRESS' | 'SOCIAL';

export default function UserProfile() {
    const { user, login } = useAuth();
    const [activeTab, setActiveTab] = useState<ProfileSection>('GENERAL');
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<{ url: string, label: string } | null>(null);

    // Form State
    const [profileData, setProfileData] = useState({
        name: '',
        email: '',
        mobile: '',
        address: '',
        bio: '',
        photo: '',
        aadharUrl: '',
        panUrl: '',
        addressProofUrl: '',
        aadharNo: '',
        panNo: '',
        alternatePhone: '',
        gender: '',
        dateOfBirth: '',
        // Employment Info
        designation: '',
        department: '',
        epfNo: '',
        basicSalary: '',
        contractType: '',
        workShift: '',
        location: '',
        dateOfJoining: '',
        // Personal Details
        emergencyPhone: '',
        maritalStatus: '',
        fatherName: '',
        motherName: '',
        qualification: '',
        experience: '',
        note: '',
        uid: '',
        // Address
        permanentAddress: '',
        // Bank Details
        accountTitle: '',
        bankName: '',
        bankBranch: '',
        accountNumber: '',
        ifscCode: '',
        upiId: '',
        // Social Media
        facebookUrl: '',
        twitterUrl: '',
        linkedinUrl: '',
        instagramUrl: '',
        // Other
        specialization: '',
        emergencyContact: '',
        pin: '',
        // Academic History
        academicHistory: [] as AcademicRecord[],
        activityCertificates: [] as string[],
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const getCollectionName = () => {
        if (user?.role === 'PARENT') return 'students';
        if (user?.role === 'TEACHER' || user?.role === 'DRIVER' || user?.role === 'ACCOUNTANT') return 'teachers';
        return 'users';
    };

    useEffect(() => {
        const fetchUserData = async () => {
            if (!user?.id && user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
                setProfileData(prev => ({
                    ...prev,
                    name: user?.username || '',
                    mobile: user?.mobile || '',
                }));
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const col = getCollectionName();
                let docExists = false;

                if (user?.id) {
                    console.log(`📡 Fetching profile for ${user.id} from ${col}`);
                    const userDoc = await getDoc(doc(db, col, user.id));

                    if (userDoc.exists()) {
                        docExists = true;
                        const data = userDoc.data();
                        console.log('📄 Document found:', {
                            name: data.name || data.fullName,
                            hasPhoto: !!data.photo,
                            hasAadhar: !!data.aadharUrl,
                            schoolId: data.schoolId
                        });
                        if (user.role === 'PARENT') {
                            const loggedInMobile = user.mobile;
                            let name = data.fullName || data.name || '';
                            let email = data.emailId || data.email || '';
                            let phone = data.mobileNo || data.mobile || data.phone || '';
                            let address = data.permanentAddress || data.address || '';
                            let aadharNo = data.aadharNo || '';

                            if (data.fatherContactNo === loggedInMobile) {
                                name = data.fatherName || name;
                                email = data.fatherEmailId || email;
                                phone = data.fatherContactNo;
                                address = data.fatherAddress || address;
                                aadharNo = data.fatherAadharNo || aadharNo;
                            } else if (data.motherContactNo === loggedInMobile) {
                                name = data.motherName || name;
                                email = data.motherEmailId || email;
                                phone = data.motherContactNo;
                                address = data.motherAddress || address;
                                aadharNo = data.motherAadharNo || aadharNo;
                            }

                            setProfileData(prev => ({
                                ...prev,
                                name,
                                email,
                                mobile: phone,
                                address,
                                photo: data.photo || data.photoUrl || '',
                                aadharUrl: data.aadharUrl || '',
                                panUrl: data.panUrl || '',
                                addressProofUrl: data.addressProofUrl || '',
                                aadharNo: aadharNo,
                                panNo: data.panNo || '',
                                bio: data.bio || '',
                                emergencyContact: data.emergencyContact || '',
                                emergencyPhone: data.emergencyPhone || '',
                                gender: data.gender || '',
                                dateOfBirth: data.dateOfBirth || '',
                                pin: data.pin || '',
                            }));
                        } else {
                            setProfileData(prev => ({
                                ...prev,
                                name: data.name || data.username || '',
                                email: data.email || '',
                                mobile: data.mobile || data.phone || '',
                                address: data.address || '',
                                photo: data.photo || data.photoUrl || '',
                                aadharUrl: data.aadharUrl || '',
                                panUrl: data.panUrl || '',
                                addressProofUrl: data.addressProofUrl || '',
                                aadharNo: data.aadharNo || '',
                                panNo: data.panNo || '',
                                bio: data.bio || '',
                                qualification: data.qualification || '',
                                experience: data.experience || '',
                                specialization: data.specialization || '',
                                gender: data.gender || '',
                                dateOfBirth: data.dateOfBirth || '',
                                pin: data.pin || '',

                                // Employment Info
                                designation: data.designation || '',
                                department: data.department || '',
                                epfNo: data.epfNo || '',
                                basicSalary: data.basicSalary || data.baseSalary || '',
                                contractType: data.contractType || '',
                                workShift: data.workShift || '',
                                location: data.location || '',
                                dateOfJoining: data.dateOfJoining || data.joiningDate || '',

                                // Personal Details
                                emergencyPhone: data.emergencyPhone || data.emergencyContactNumber || '',
                                maritalStatus: data.maritalStatus || '',
                                fatherName: data.fatherName || '',
                                motherName: data.motherName || '',
                                note: data.note || '',
                                uid: data.uid || data.employeeId || data.id || '',

                                // Address
                                permanentAddress: data.permanentAddress || '',

                                // Bank Details
                                accountTitle: data.accountTitle || '',
                                bankName: data.bankName || '',
                                bankBranch: data.bankBranch || data.branchName || '',
                                accountNumber: data.accountNumber || '',
                                ifscCode: data.ifscCode || '',
                                upiId: data.upiId || '',

                                // Social Media
                                facebookUrl: data.facebookUrl || '',
                                twitterUrl: data.twitterUrl || '',
                                linkedinUrl: data.linkedinUrl || '',
                                instagramUrl: data.instagramUrl || '',

                                // Academic History
                                academicHistory: data.academicHistory || [],
                                activityCertificates: data.activityCertificates || [],
                            }));
                        }
                    }
                }

                if (!docExists) {
                    if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
                        // Fetch Admin credentials specifically
                        const safeSchoolId = user.schoolId?.replace(/\//g, '') || '';
                        const adminDocId = user.role === 'ADMIN' ? `admin_credentials_${safeSchoolId}` : 'admin_credentials';
                        const adminDoc = await getDoc(doc(db, 'settings', adminDocId));
                        if (adminDoc.exists()) {
                            const adminData = adminDoc.data();
                            setProfileData(prev => ({
                                ...prev,
                                name: user.username || 'Administrator',
                                mobile: adminData.mobile || '',
                                pin: String(adminData.pin) || '',
                            }));
                        }
                    } else if (user?.id) {
                        console.warn(`⚠️ No document found for ID ${user.id} in collection ${col}`);
                    }
                }
            } catch (error) {
                console.error('❌ Error fetching user profile:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [user]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, field: string) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const compressed = await compressImage(file, 1000, 1000, 0.5);
            setProfileData(prev => ({ ...prev, [field]: compressed }));
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Failed to process image');
        }
    };

    const handleSave = async () => {
        if (!user?.id) {
            console.error('❌ Cannot save: No user ID found');
            return;
        }
        setIsSaving(true);
        const col = getCollectionName();
        console.log(`💾 Starting profile save for ${user.id} in collection ${col}`);

        try {
            let updateData: any = {
                ...profileData,
                updatedAt: new Date().toISOString()
            };

            // Ensure we don't accidentally wipe out schoolId if it was already there
            // Usually we shouldn't overwrite system fields like schoolId with profileData if it's not present
            if (user.schoolId && !updateData.schoolId) {
                updateData.schoolId = user.schoolId;
            }

            if (user?.role === 'PARENT') {
                const loggedInMobile = user.mobile;
                const studentDoc = await getDoc(doc(db, 'students', user.id));
                const studentData = studentDoc.data();

                if (studentData?.fatherContactNo === loggedInMobile) {
                    updateData = {
                        ...updateData,
                        fatherName: profileData.name,
                        fatherContactNo: profileData.mobile,
                        fatherEmailId: profileData.email,
                        fatherAddress: profileData.address,
                        fatherAadharNo: profileData.aadharNo
                    };
                } else if (studentData?.motherContactNo === loggedInMobile) {
                    updateData = {
                        ...updateData,
                        motherName: profileData.name,
                        motherContactNo: profileData.mobile,
                        motherEmailId: profileData.email,
                        motherAddress: profileData.address,
                        motherAadharNo: profileData.aadharNo
                    };
                }
            }

            console.log('📝 Payload to save:', {
                name: updateData.name,
                mobile: updateData.mobile,
                aadharEntered: !!updateData.aadharUrl,
                panEntered: !!updateData.panUrl,
                schoolId: updateData.schoolId
            });

            const docRef = doc(db, col, user.id);
            await updateDoc(docRef, updateData);
            console.log('✅ Save successful!');

            if (login && user) {
                login({ ...user, username: profileData.name });
            }

            setIsEditing(false);
            alert('Profile saved with premium precision!');
        } catch (error: any) {
            console.error('❌ Error updating profile:', error);
            alert(`Failed to save changes: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const calculateCompletion = () => {
        const fields = [
            'name', 'email', 'mobile', 'address', 'bio', 'photo', 'aadharUrl', 'gender', 'dateOfBirth',
            'designation', 'department', 'accountNumber', 'bankName', 'fatherName', 'motherName'
        ];
        const filled = fields.filter(f => !!(profileData as any)[f]).length;
        return Math.round((filled / fields.length) * 100);
    };

    const completionPercent = calculateCompletion();

    const [pinChangeData, setPinChangeData] = useState({ oldPin: '', newPin: '', confirmPin: '' });
    const [showPinForm, setShowPinForm] = useState(false);

    const handlePinChange = async () => {
        if (!user) return;

        if (pinChangeData.oldPin !== profileData.pin) {
            alert('❌ Old PIN is incorrect');
            return;
        }

        if (pinChangeData.newPin.length !== 4 || !/^\d{4}$/.test(pinChangeData.newPin)) {
            alert('❌ New PIN must be 4 digits');
            return;
        }

        if (pinChangeData.newPin !== pinChangeData.confirmPin) {
            alert('❌ PINs do not match');
            return;
        }

        try {
            if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
                const safeSchoolId = user.schoolId?.replace(/\//g, '') || '';
                const adminDocId = user.role === 'ADMIN' ? `admin_credentials_${safeSchoolId}` : 'admin_credentials';
                const adminRef = doc(db, 'settings', adminDocId);
                await updateDoc(adminRef, { pin: pinChangeData.newPin });
            } else {
                if (!user.id) return;
                const col = getCollectionName();
                const docRef = doc(db, col, user.id);
                await updateDoc(docRef, { pin: pinChangeData.newPin });
            }

            setProfileData(prev => ({ ...prev, pin: pinChangeData.newPin }));
            setPinChangeData({ oldPin: '', newPin: '', confirmPin: '' });
            setShowPinForm(false);
            alert('✅ PIN changed successfully!');
        } catch (error: any) {
            alert('❌ Failed to change PIN: ' + error.message);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: '1.5rem' }}>
                <div className="premium-loader">
                    <Loader2 className="animate-spin" size={48} color="var(--primary)" />
                </div>
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '0.25rem' }}>Configuring Profile</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Synchronizing your identity with the cloud...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-explorer no-scrollbar animate-fade-in">
            {/* Page Header */}
            <div className="explorer-header" style={{ marginBottom: '2.5rem' }}>
                <div>
                    <h1 className="explorer-title">Identity & Profile</h1>
                    <p className="explorer-subtitle">Manage your personal ecosystem and verification status.</p>
                </div>
                <div className="header-actions">
                    {!isEditing ? (
                        <button className="btn-premium" onClick={() => setIsEditing(true)}>
                            <Edit2 size={16} /> Edit Profile
                        </button>
                    ) : (
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="btn-premium-outline" onClick={() => setIsEditing(false)}>Cancel</button>
                            <button className="btn-premium" onClick={handleSave} disabled={isSaving}>
                                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> Save Changes</>}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="explorer-layout">
                {/* Lateral Sidebar */}
                <aside className="explorer-sidebar">
                    <div className="glass-card identity-card-main">
                        <div className="profile-completion">
                            <div className="completion-ring" style={{ '--percent': completionPercent } as any}>
                                <div className="avatar-canvas">
                                    <img
                                        src={profileData.photo || `https://ui-avatars.com/api/?name=${profileData.name}&background=6366f1&color=fff&size=512`}
                                        alt="User"
                                    />
                                    <button className="cam-trigger" disabled={!isEditing} onClick={() => fileInputRef.current?.click()}><Camera size={14} /></button>
                                </div>
                            </div>
                            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => handleFileUpload(e, 'photo')} />
                            <div className="name-plate">
                                <h3>{profileData.name}</h3>
                                <div className="role-tag">{user?.role}</div>
                            </div>
                        </div>

                        <div className="completion-stats">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)' }}>PROFILE STRENGTH</span>
                                <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--primary)' }}>{completionPercent}%</span>
                            </div>
                            <div className="progress-track">
                                <div className="progress-fill" style={{ width: `${completionPercent}%` }}></div>
                            </div>
                        </div>

                        <div className="sidebar-nav">
                            <button className={`nav-link ${activeTab === 'GENERAL' ? 'active' : ''}`} onClick={() => setActiveTab('GENERAL')}>
                                <User size={18} /> General Identity
                            </button>
                            <button className={`nav-link ${activeTab === 'ADDRESS' ? 'active' : ''}`} onClick={() => setActiveTab('ADDRESS')}>
                                <Home size={18} /> Address
                            </button>
                            <button className={`nav-link ${activeTab === 'KYC' ? 'active' : ''}`} onClick={() => setActiveTab('KYC')}>
                                <Shield size={18} /> Governance & KYC
                            </button>
                            {user?.role === 'TEACHER' && (
                                <>
                                    <button className={`nav-link ${activeTab === 'PROFESSIONAL' ? 'active' : ''}`} onClick={() => setActiveTab('PROFESSIONAL')}>
                                        <Briefcase size={18} /> Professional
                                    </button>
                                    <button className={`nav-link ${activeTab === 'ACADEMIC' ? 'active' : ''}`} onClick={() => setActiveTab('ACADEMIC')}>
                                        <Award size={18} /> Academic History
                                    </button>
                                </>
                            )}
                            {user?.role === 'TEACHER' && (
                                <button className={`nav-link ${activeTab === 'FINANCIAL' ? 'active' : ''}`} onClick={() => setActiveTab('FINANCIAL')}>
                                    <Landmark size={18} /> Financial Details
                                </button>
                            )}
                            {user?.role === 'TEACHER' && (
                                <button className={`nav-link ${activeTab === 'SOCIAL' ? 'active' : ''}`} onClick={() => setActiveTab('SOCIAL')}>
                                    <Globe size={18} /> Social Media
                                </button>
                            )}
                            {user?.role === 'PARENT' && (
                                <button className={`nav-link ${activeTab === 'FAMILY' ? 'active' : ''}`} onClick={() => setActiveTab('FAMILY')}>
                                    <Heart size={18} /> Emergency & Family
                                </button>
                            )}
                            <button className={`nav-link ${activeTab === 'SECURITY' ? 'active' : ''}`} onClick={() => setActiveTab('SECURITY')}>
                                <Lock size={18} /> Security
                            </button>
                        </div>
                    </div>

                    <div className="glass-card quick-links">
                        <h4 className="card-title-small">Quick Status</h4>
                        <div className="quick-item">
                            <div className="q-icon" style={{ background: '#dcfce7', color: '#16a34a' }}><CheckCircle2 size={14} /></div>
                            <div>
                                <span>Verified Mobile</span>
                                <p>{profileData.mobile || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="quick-item">
                            <div className="q-icon" style={{ background: '#ecfeff', color: '#0891b2' }}><Mail size={14} /></div>
                            <div>
                                <span>Email Primary</span>
                                <p>{profileData.email || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="explorer-content">
                    {activeTab === 'GENERAL' && (
                        <div className="explorer-section animate-slide-up">
                            <div className="glass-card section-card">
                                <div className="section-head">
                                    <div className="section-icon"><User size={20} /></div>
                                    <div>
                                        <h4>Biographical Information</h4>
                                        <p>Your public identity across the institution.</p>
                                    </div>
                                </div>

                                <div className="premium-form-grid">
                                    <div className="p-input-group">
                                        <label>Legal Full Name</label>
                                        <div className="input-with-icon">
                                            <User size={18} className="i-icon" />
                                            <input type="text" value={profileData.name} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, name: e.target.value })} onBlur={e => setProfileData({ ...profileData, name: toProperCase(e.target.value) })} placeholder="Full name as per Aadhar" />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Primary Email</label>
                                        <div className="input-with-icon">
                                            <Mail size={18} className="i-icon" />
                                            <input type="email" value={profileData.email} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, email: e.target.value })} placeholder="official.email@example.com" />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Mobile Number</label>
                                        <div className="input-with-icon">
                                            <Phone size={18} className="i-icon" />
                                            <input type="text" value={profileData.mobile} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, mobile: e.target.value })} placeholder="+91 XXXXX XXXXX" />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Gender</label>
                                        <select className="premium-select" value={profileData.gender} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, gender: e.target.value })}>
                                            <option value="">Select Gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Date of Birth</label>
                                        <input type="date" className="premium-input-date" style={{ width: '100%', padding: '0.85rem 1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0', outline: 'none' }} value={profileData.dateOfBirth} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, dateOfBirth: e.target.value })} />
                                    </div>
                                    <div className="p-input-group">
                                        <label>Marital Status</label>
                                        <select className="premium-select" value={profileData.maritalStatus} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, maritalStatus: e.target.value })}>
                                            <option value="">Select Status</option>
                                            <option value="Single">Single</option>
                                            <option value="Married">Married</option>
                                            <option value="Widowed">Widowed</option>
                                            <option value="Divorced">Divorced</option>
                                        </select>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Father's Name</label>
                                        <div className="input-with-icon">
                                            <User size={18} className="i-icon" />
                                            <input type="text" value={profileData.fatherName} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, fatherName: e.target.value })} onBlur={e => setProfileData({ ...profileData, fatherName: toProperCase(e.target.value) })} placeholder="Father's Name" />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Mother's Name</label>
                                        <div className="input-with-icon">
                                            <User size={18} className="i-icon" />
                                            <input type="text" value={profileData.motherName} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, motherName: e.target.value })} onBlur={e => setProfileData({ ...profileData, motherName: toProperCase(e.target.value) })} placeholder="Mother's Name" />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Emergency Contact No</label>
                                        <div className="input-with-icon">
                                            <Phone size={18} className="i-icon" />
                                            <input type="text" value={profileData.emergencyPhone} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, emergencyPhone: e.target.value })} placeholder="Emergency Contact No" />
                                        </div>
                                    </div>
                                    <div className="p-input-group full-width">
                                        <label>Short Bio / About Yourself</label>
                                        <textarea
                                            className="premium-textarea"
                                            rows={2}
                                            style={{ width: '100%', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0', outline: 'none', background: isEditing ? 'white' : '#f8fafc' }}
                                            value={profileData.bio}
                                            disabled={!isEditing}
                                            onChange={e => setProfileData({ ...profileData, bio: e.target.value })}
                                            placeholder="Tell us a bit about your professional journey or interests..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ADDRESS' && (
                        <div className="explorer-section animate-slide-up">
                            <div className="glass-card section-card">
                                <div className="section-head">
                                    <div className="section-icon" style={{ background: '#3b82f6' }}><Home size={20} /></div>
                                    <div>
                                        <h4>Residential Addresses</h4>
                                        <p>Current and permanent contact location details.</p>
                                    </div>
                                </div>
                                <div className="premium-form-grid">
                                    <div className="p-input-group full-width">
                                        <label>Current Address</label>
                                        <div className="input-with-icon">
                                            <MapPin size={18} className="i-icon" />
                                            <input type="text" value={profileData.address} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, address: e.target.value })} onBlur={e => setProfileData({ ...profileData, address: toProperCase(e.target.value) })} placeholder="Complete residential address" />
                                        </div>
                                    </div>
                                    <div className="p-input-group full-width">
                                        <label>Permanent Address</label>
                                        <div className="input-with-icon">
                                            <Home size={18} className="i-icon" />
                                            <input type="text" value={profileData.permanentAddress} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, permanentAddress: e.target.value })} onBlur={e => setProfileData({ ...profileData, permanentAddress: toProperCase(e.target.value) })} placeholder="Permanent home address" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'KYC' && (
                        <div className="explorer-section animate-slide-up">
                            <div className="glass-card section-card">
                                <div className="section-head">
                                    <div className="section-icon" style={{ background: '#10b981' }}><Fingerprint size={20} /></div>
                                    <div>
                                        <h4>Governance & Verification</h4>
                                        <p>Secure identity documents for institution compliance.</p>
                                    </div>
                                </div>

                                <div className="kyc-container">
                                    <div className="aadhar-pan-inputs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                                        <div className="p-input-group">
                                            <label>Aadhar Number</label>
                                            <div className="input-with-icon">
                                                <Fingerprint size={18} className="i-icon" />
                                                <input type="text" maxLength={12} value={profileData.aadharNo} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, aadharNo: e.target.value })} placeholder="XXXX XXXX XXXX" />
                                            </div>
                                        </div>
                                        <div className="p-input-group">
                                            <label>PAN Number</label>
                                            <div className="input-with-icon">
                                                <CreditCard size={18} className="i-icon" />
                                                <input type="text" maxLength={10} value={profileData.panNo} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, panNo: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="doc-uploader-grid">
                                        <KBDOcCard
                                            title="Aadhar Card"
                                            desc="Front/Back Combined"
                                            value={profileData.aadharUrl}
                                            isEditing={isEditing}
                                            icon={<CreditCard size={24} />}
                                            onUpload={(e: any) => handleFileUpload(e, 'aadharUrl')}
                                            onView={() => setPreviewDoc({ url: profileData.aadharUrl, label: 'Aadhar Card' })}
                                        />
                                        <KBDOcCard
                                            title="PAN Card"
                                            desc="Scanned Copy"
                                            value={profileData.panUrl}
                                            isEditing={isEditing}
                                            icon={<ImageIcon size={24} />}
                                            onUpload={(e: any) => handleFileUpload(e, 'panUrl')}
                                            onView={() => setPreviewDoc({ url: profileData.panUrl, label: 'PAN Card' })}
                                        />
                                        <KBDOcCard
                                            title="Address Proof"
                                            desc="Electricity/Rent/Gas"
                                            value={profileData.addressProofUrl}
                                            isEditing={isEditing}
                                            icon={<MapPin size={24} />}
                                            onUpload={(e: any) => handleFileUpload(e, 'addressProofUrl')}
                                            onView={() => setPreviewDoc({ url: profileData.addressProofUrl, label: 'Address Proof' })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'PROFESSIONAL' && user?.role === 'TEACHER' && (
                        <div className="explorer-section animate-slide-up">
                            <div className="glass-card section-card">
                                <div className="section-head">
                                    <div className="section-icon" style={{ background: '#f59e0b' }}><GraduationCap size={20} /></div>
                                    <div>
                                        <h4>Professional & Employment Portfolio</h4>
                                        <p>Your educational background and institutional details.</p>
                                    </div>
                                </div>
                                <div className="premium-form-grid">
                                    <div className="p-input-group">
                                        <label>UID / Employee ID</label>
                                        <div className="input-with-icon">
                                            <Fingerprint size={18} className="i-icon" />
                                            <input type="text" value={profileData.uid} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, uid: e.target.value })} placeholder="E12345" />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Designation</label>
                                        <div className="input-with-icon">
                                            <Briefcase size={18} className="i-icon" />
                                            <input type="text" value={profileData.designation} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, designation: e.target.value })} onBlur={e => setProfileData({ ...profileData, designation: toProperCase(e.target.value) })} placeholder="e.g. Senior Teacher" />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Department</label>
                                        <div className="input-with-icon">
                                            <Building2 size={18} className="i-icon" />
                                            <input type="text" value={profileData.department} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, department: e.target.value })} onBlur={e => setProfileData({ ...profileData, department: toProperCase(e.target.value) })} placeholder="e.g. Mathematics" />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Date of Joining</label>
                                        <input type="date" className="premium-input-date" style={{ width: '100%', padding: '0.85rem 1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0', outline: 'none' }} value={profileData.dateOfJoining} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, dateOfJoining: e.target.value })} />
                                    </div>
                                    <div className="p-input-group">
                                        <label>EPF Number</label>
                                        <div className="input-with-icon">
                                            <Shield size={18} className="i-icon" />
                                            <input type="text" value={profileData.epfNo} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, epfNo: e.target.value })} placeholder="EPF XXXXXX" />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Basic Salary</label>
                                        <div className="input-with-icon">
                                            <Landmark size={18} className="i-icon" />
                                            <input type="text" value={profileData.basicSalary} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, basicSalary: e.target.value })} placeholder="e.g. 25000" />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Contract Type</label>
                                        <select className="premium-select" value={profileData.contractType} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, contractType: e.target.value })}>
                                            <option value="">Select Type</option>
                                            <option value="Permanent">Permanent</option>
                                            <option value="Contractual">Contractual</option>
                                            <option value="Probation">Probation</option>
                                        </select>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Work Shift</label>
                                        <div className="input-with-icon">
                                            <Clock size={18} className="i-icon" />
                                            <input type="text" value={profileData.workShift} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, workShift: e.target.value })} placeholder="e.g. 9 am to 2 PM" />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Location</label>
                                        <div className="input-with-icon">
                                            <MapPin size={18} className="i-icon" />
                                            <input type="text" value={profileData.location} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, location: e.target.value })} placeholder="Campus Location" />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Highest Qualification</label>
                                        <div className="input-with-icon">
                                            <GraduationCap size={18} className="i-icon" />
                                            <input type="text" value={profileData.qualification} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, qualification: e.target.value })} onBlur={e => setProfileData({ ...profileData, qualification: toProperCase(e.target.value) })} placeholder="e.g. PhD in Physics, M.Ed" />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Total Experience (Years)</label>
                                        <div className="input-with-icon">
                                            <Calendar size={18} className="i-icon" />
                                            <input type="number" value={profileData.experience} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, experience: e.target.value })} placeholder="e.g. 5" />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Subjects / Specializations</label>
                                        <div className="input-with-icon">
                                            <BookOpen size={18} className="i-icon" />
                                            <input type="text" value={profileData.specialization} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, specialization: e.target.value })} onBlur={e => setProfileData({ ...profileData, specialization: toProperCase(e.target.value) })} placeholder="e.g. Calculus" />
                                        </div>
                                    </div>
                                    <div className="p-input-group full-width">
                                        <label>Notes</label>
                                        <textarea
                                            className="premium-textarea"
                                            rows={2}
                                            style={{ width: '100%', padding: '1rem', borderRadius: '1rem', border: '1px solid #e2e8f0', outline: 'none', background: isEditing ? 'white' : '#f8fafc' }}
                                            value={profileData.note}
                                            disabled={!isEditing}
                                            onChange={e => setProfileData({ ...profileData, note: e.target.value })}
                                            placeholder="Any additional notes..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ACADEMIC' && user?.role === 'TEACHER' && (
                        <ErrorBoundary>
                            <div className="explorer-section animate-slide-up">
                                <div className="glass-card section-card">
                                    <div className="section-head">
                                        <div className="section-icon" style={{ background: '#8b5cf6' }}><Award size={20} /></div>
                                        <div>
                                            <h4>Academic Qualifications</h4>
                                            <p>Your educational history and certifications.</p>
                                        </div>
                                    </div>

                                    {/* Qualifications Table */}
                                    <div style={{ overflowX: 'auto' }}>
                                        {profileData.academicHistory.length === 0 && !isEditing ? (
                                            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                                                <GraduationCap size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                                                <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>No qualifications added yet</p>
                                                <p style={{ fontSize: '0.8rem' }}>Click "Edit Profile" then add your academic records.</p>
                                            </div>
                                        ) : (
                                            <>
                                                {profileData.academicHistory.map((record, idx) => (
                                                    <div key={idx} style={{
                                                        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '1.25rem',
                                                        padding: '1.5rem', marginBottom: '1rem', position: 'relative'
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                            <h5 style={{ fontWeight: 800, fontSize: '0.85rem', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                                                                Qualification #{idx + 1}
                                                            </h5>
                                                            {isEditing && (
                                                                <button onClick={() => {
                                                                    const updated = profileData.academicHistory.filter((_, i) => i !== idx);
                                                                    setProfileData({ ...profileData, academicHistory: updated });
                                                                }} style={{
                                                                    background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444',
                                                                    padding: '0.4rem 0.75rem', borderRadius: '0.75rem', cursor: 'pointer',
                                                                    fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem'
                                                                }}>
                                                                    <Trash2 size={14} /> Remove
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                                                            <div className="p-input-group">
                                                                <label>Exam Passed</label>
                                                                <input type="text" className="academic-input" value={record.examPassed} disabled={!isEditing}
                                                                    onChange={e => {
                                                                        const updated = [...profileData.academicHistory];
                                                                        updated[idx] = { ...updated[idx], examPassed: e.target.value };
                                                                        setProfileData({ ...profileData, academicHistory: updated });
                                                                    }} placeholder="e.g. 10th, B.Ed" />
                                                            </div>
                                                            <div className="p-input-group">
                                                                <label>School / College</label>
                                                                <input type="text" className="academic-input" value={record.school} disabled={!isEditing}
                                                                    onChange={e => {
                                                                        const updated = [...profileData.academicHistory];
                                                                        updated[idx] = { ...updated[idx], school: e.target.value };
                                                                        setProfileData({ ...profileData, academicHistory: updated });
                                                                    }} placeholder="Institution Name" />
                                                            </div>
                                                            <div className="p-input-group">
                                                                <label>Board / University</label>
                                                                <input type="text" className="academic-input" value={record.board} disabled={!isEditing}
                                                                    onChange={e => {
                                                                        const updated = [...profileData.academicHistory];
                                                                        updated[idx] = { ...updated[idx], board: e.target.value };
                                                                        setProfileData({ ...profileData, academicHistory: updated });
                                                                    }} placeholder="e.g. CBSE, BSEB" />
                                                            </div>
                                                            <div className="p-input-group">
                                                                <label>Passing Year</label>
                                                                <input type="text" className="academic-input" value={record.passingYear} disabled={!isEditing}
                                                                    onChange={e => {
                                                                        const updated = [...profileData.academicHistory];
                                                                        updated[idx] = { ...updated[idx], passingYear: e.target.value };
                                                                        setProfileData({ ...profileData, academicHistory: updated });
                                                                    }} placeholder="e.g. 2018" maxLength={4} />
                                                            </div>
                                                            <div className="p-input-group">
                                                                <label>% Marks</label>
                                                                <input type="text" className="academic-input" value={record.percentage} disabled={!isEditing}
                                                                    onChange={e => {
                                                                        const updated = [...profileData.academicHistory];
                                                                        updated[idx] = { ...updated[idx], percentage: e.target.value };
                                                                        setProfileData({ ...profileData, academicHistory: updated });
                                                                    }} placeholder="e.g. 85.5" />
                                                            </div>
                                                            <div className="p-input-group">
                                                                <label>CGPA / Grade</label>
                                                                <input type="text" className="academic-input" value={record.cgpaGrade} disabled={!isEditing}
                                                                    onChange={e => {
                                                                        const updated = [...profileData.academicHistory];
                                                                        updated[idx] = { ...updated[idx], cgpaGrade: e.target.value };
                                                                        setProfileData({ ...profileData, academicHistory: updated });
                                                                    }} placeholder="e.g. 8.5 / A+" />
                                                            </div>
                                                        </div>

                                                        {/* Document Uploads */}
                                                        <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                                            {[0, 1].map(docIdx => {
                                                                const fieldKey = docIdx === 0 ? 'docUrl1' : 'docUrl2';
                                                                const docValue = (record as any)[fieldKey];
                                                                return (
                                                                    <div key={docIdx} style={{
                                                                        flex: '1 1 200px', maxWidth: '280px', background: 'white', border: '1px solid #e2e8f0',
                                                                        borderRadius: '1rem', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem'
                                                                    }}>
                                                                        {docValue ? (
                                                                            <>
                                                                                <img src={docValue} alt={`Doc ${docIdx + 1}`} style={{
                                                                                    width: '48px', height: '48px', objectFit: 'cover', borderRadius: '0.5rem', cursor: 'pointer',
                                                                                    border: '1px solid #e2e8f0'
                                                                                }} onClick={() => setPreviewDoc({ url: docValue, label: `Qualification #${idx + 1} — Document ${docIdx + 1}` })} />
                                                                                <div style={{ flex: 1 }}>
                                                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>Document {docIdx + 1} ✓</span>
                                                                                    <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: '0.15rem 0 0' }}>Click to preview</p>
                                                                                </div>
                                                                                {isEditing && (
                                                                                    <button onClick={() => {
                                                                                        const updated = [...profileData.academicHistory];
                                                                                        updated[idx] = { ...updated[idx], [fieldKey]: '' };
                                                                                        setProfileData({ ...profileData, academicHistory: updated });
                                                                                    }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}>
                                                                                        <X size={16} />
                                                                                    </button>
                                                                                )}
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <div style={{ width: '48px', height: '48px', background: '#f1f5f9', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                                                                    <FileText size={20} />
                                                                                </div>
                                                                                <div style={{ flex: 1 }}>
                                                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Document {docIdx + 1}</span>
                                                                                    <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: '0.15rem 0 0' }}>{isEditing ? 'Click upload' : 'Not uploaded'}</p>
                                                                                </div>
                                                                                {isEditing && (
                                                                                    <label style={{ cursor: 'pointer', background: 'rgba(99,102,241,0.1)', color: '#6366f1', padding: '0.4rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                                                        <Upload size={12} /> Upload
                                                                                        <input type="file" hidden accept="image/*" onChange={async (e) => {
                                                                                            const file = e.target.files?.[0];
                                                                                            if (!file) return;
                                                                                            try {
                                                                                                const compressed = await compressImage(file, 1000, 1000, 0.5);
                                                                                                const updated = [...profileData.academicHistory];
                                                                                                updated[idx] = { ...updated[idx], [fieldKey]: compressed };
                                                                                                setProfileData({ ...profileData, academicHistory: updated });
                                                                                            } catch (err) { alert('Failed to process image'); }
                                                                                        }} />
                                                                                    </label>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </>
                                        )}

                                        {isEditing && (
                                            <button onClick={() => {
                                                setProfileData({
                                                    ...profileData,
                                                    academicHistory: [...profileData.academicHistory, {
                                                        examPassed: '', school: '', board: '', passingYear: '', percentage: '', cgpaGrade: '', docUrl1: '', docUrl2: ''
                                                    }]
                                                });
                                            }} style={{
                                                background: 'rgba(99,102,241,0.1)', border: '2px dashed #6366f1', color: '#6366f1',
                                                padding: '1rem', borderRadius: '1rem', cursor: 'pointer', width: '100%',
                                                fontSize: '0.875rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                                marginTop: '0.5rem'
                                            }}>
                                                <Plus size={18} /> Add Qualification
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Activity Certificates */}
                                <div className="glass-card section-card" style={{ marginTop: '1.5rem' }}>
                                    <div className="section-head">
                                        <div className="section-icon" style={{ background: '#f59e0b' }}><Award size={20} /></div>
                                        <div>
                                            <h4>Other Activity Certificates</h4>
                                            <p>Upload certificates for workshops, training, sports, and extracurriculars.</p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                                        {profileData.activityCertificates.map((certUrl, idx) => (
                                            <div key={idx} style={{
                                                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '1rem',
                                                padding: '1rem', textAlign: 'center', position: 'relative'
                                            }}>
                                                {certUrl ? (
                                                    <>
                                                        <img src={certUrl} alt={`Certificate ${idx + 1}`} style={{
                                                            width: '100%', height: '120px', objectFit: 'cover', borderRadius: '0.75rem',
                                                            cursor: 'pointer', border: '1px solid #e2e8f0', marginBottom: '0.5rem'
                                                        }} onClick={() => setPreviewDoc({ url: certUrl, label: `Activity Certificate #${idx + 1}` })} />
                                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981' }}>Certificate #{idx + 1} ✓</span>
                                                        {isEditing && (
                                                            <button onClick={() => {
                                                                const updated = profileData.activityCertificates.filter((_, i) => i !== idx);
                                                                setProfileData({ ...profileData, activityCertificates: updated });
                                                            }} style={{
                                                                position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(239,68,68,0.9)',
                                                                border: 'none', color: 'white', width: '24px', height: '24px', borderRadius: '50%',
                                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                            }}>
                                                                <X size={14} />
                                                            </button>
                                                        )}
                                                    </>
                                                ) : (
                                                    <>
                                                        <div style={{
                                                            width: '100%', height: '120px', background: '#f1f5f9', borderRadius: '0.75rem',
                                                            display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
                                                            color: '#94a3b8', marginBottom: '0.5rem'
                                                        }}>
                                                            <FileText size={28} />
                                                            <span style={{ fontSize: '0.65rem', marginTop: '0.35rem' }}>Empty Slot</span>
                                                        </div>
                                                        {isEditing && (
                                                            <label style={{
                                                                cursor: 'pointer', background: 'rgba(99,102,241,0.1)', color: '#6366f1',
                                                                padding: '0.4rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.7rem',
                                                                fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
                                                            }}>
                                                                <Upload size={12} /> Upload
                                                                <input type="file" hidden accept="image/*" onChange={async (e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (!file) return;
                                                                    try {
                                                                        const compressed = await compressImage(file, 1000, 1000, 0.5);
                                                                        const updated = [...profileData.activityCertificates];
                                                                        updated[idx] = compressed;
                                                                        setProfileData({ ...profileData, activityCertificates: updated });
                                                                    } catch (err) { alert('Failed to process image'); }
                                                                }} />
                                                            </label>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        ))}

                                        {isEditing && (
                                            <div onClick={() => {
                                                setProfileData({
                                                    ...profileData,
                                                    activityCertificates: [...profileData.activityCertificates, '']
                                                });
                                            }} style={{
                                                background: 'rgba(245,158,11,0.05)', border: '2px dashed #f59e0b', borderRadius: '1rem',
                                                padding: '1rem', textAlign: 'center', cursor: 'pointer', minHeight: '160px',
                                                display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
                                                color: '#f59e0b', gap: '0.5rem', transition: 'all 0.2s'
                                            }}>
                                                <Plus size={24} />
                                                <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>Add Certificate</span>
                                            </div>
                                        )}
                                    </div>

                                    {profileData.activityCertificates.length === 0 && !isEditing && (
                                        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
                                            <Award size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                                            <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem' }}>No certificates uploaded</p>
                                            <p style={{ fontSize: '0.8rem' }}>Edit profile to upload your activity certificates.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </ErrorBoundary>
                    )}

                    {activeTab === 'FINANCIAL' && user?.role === 'TEACHER' && (
                        <div className="explorer-section animate-slide-up">
                            <div className="glass-card section-card">
                                <div className="section-head">
                                    <div className="section-icon" style={{ background: '#10b981' }}><Landmark size={20} /></div>
                                    <div>
                                        <h4>Bank Account Details</h4>
                                        <p>Secure financial information for payroll processing.</p>
                                    </div>
                                </div>
                                <div className="premium-form-grid">
                                    <div className="p-input-group">
                                        <label>Account Title</label>
                                        <div className="input-with-icon">
                                            <User size={18} className="i-icon" />
                                            <input type="text" value={profileData.accountTitle} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, accountTitle: e.target.value })} onBlur={e => setProfileData({ ...profileData, accountTitle: toProperCase(e.target.value) })} placeholder="Name as per Bank" />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Bank Name</label>
                                        <div className="input-with-icon">
                                            <Landmark size={18} className="i-icon" />
                                            <input type="text" value={profileData.bankName} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, bankName: e.target.value })} onBlur={e => setProfileData({ ...profileData, bankName: toProperCase(e.target.value) })} placeholder="e.g. State Bank of India" />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Bank Branch Name</label>
                                        <div className="input-with-icon">
                                            <MapPin size={18} className="i-icon" />
                                            <input type="text" value={profileData.bankBranch} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, bankBranch: e.target.value })} onBlur={e => setProfileData({ ...profileData, bankBranch: toProperCase(e.target.value) })} placeholder="Branch Location" />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Bank Account Number</label>
                                        <div className="input-with-icon">
                                            <CreditCard size={18} className="i-icon" />
                                            <input type="text" value={profileData.accountNumber} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, accountNumber: e.target.value })} placeholder="000000000000" />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>IFSC Code</label>
                                        <div className="input-with-icon">
                                            <Shield size={18} className="i-icon" />
                                            <input type="text" value={profileData.ifscCode} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, ifscCode: e.target.value.toUpperCase() })} placeholder="SBIN000XXXX" />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>UPI ID</label>
                                        <div className="input-with-icon">
                                            <Globe size={18} className="i-icon" />
                                            <input type="text" value={profileData.upiId} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, upiId: e.target.value })} placeholder="user@upi" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'SOCIAL' && user?.role === 'TEACHER' && (
                        <div className="explorer-section animate-slide-up">
                            <div className="glass-card section-card">
                                <div className="section-head">
                                    <div className="section-icon" style={{ background: '#6366f1' }}><Globe size={20} /></div>
                                    <div>
                                        <h4>Social Media Links</h4>
                                        <p>Connect your professional social presence.</p>
                                    </div>
                                </div>
                                <div className="premium-form-grid">
                                    <div className="p-input-group">
                                        <label>Facebook URL</label>
                                        <div className="input-with-icon">
                                            <Facebook size={18} className="i-icon" />
                                            <input type="text" value={profileData.facebookUrl} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, facebookUrl: e.target.value })} placeholder="https://facebook.com/..." />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Twitter URL</label>
                                        <div className="input-with-icon">
                                            <Twitter size={18} className="i-icon" />
                                            <input type="text" value={profileData.twitterUrl} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, twitterUrl: e.target.value })} placeholder="https://twitter.com/..." />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>LinkedIn URL</label>
                                        <div className="input-with-icon">
                                            <Linkedin size={18} className="i-icon" />
                                            <input type="text" value={profileData.linkedinUrl} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/in/..." />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Instagram URL</label>
                                        <div className="input-with-icon">
                                            <Instagram size={18} className="i-icon" />
                                            <input type="text" value={profileData.instagramUrl} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, instagramUrl: e.target.value })} placeholder="https://instagram.com/..." />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'FAMILY' && user?.role === 'PARENT' && (
                        <div className="explorer-section animate-slide-up">
                            <div className="glass-card section-card">
                                <div className="section-head">
                                    <div className="section-icon" style={{ background: '#fb7185' }}><Heart size={20} /></div>
                                    <div>
                                        <h4>Emergency Contacts</h4>
                                        <p>Critical contact information for school-to-home communication.</p>
                                    </div>
                                </div>

                                <div className="premium-form-grid">
                                    <div className="p-input-group">
                                        <label>Emergency Contact Person</label>
                                        <div className="input-with-icon">
                                            <Users size={18} className="i-icon" />
                                            <input type="text" value={profileData.emergencyContact} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, emergencyContact: e.target.value })} onBlur={e => setProfileData({ ...profileData, emergencyContact: toProperCase(e.target.value) })} placeholder="e.g. Uncle, Neighbour, Relative" />
                                        </div>
                                    </div>
                                    <div className="p-input-group">
                                        <label>Emergency Mobile</label>
                                        <div className="input-with-icon">
                                            <Phone size={18} className="i-icon" />
                                            <input type="text" value={profileData.emergencyPhone} disabled={!isEditing} onChange={e => setProfileData({ ...profileData, emergencyPhone: e.target.value })} placeholder="+91 XXXXX XXXXX" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'SECURITY' && (
                        <div className="explorer-section animate-slide-up">
                            <div className="glass-card section-card">
                                <div className="section-head">
                                    <div className="section-icon" style={{ background: '#6366f1' }}><Shield size={20} /></div>
                                    <div>
                                        <h4>Account Security</h4>
                                        <p>Manage passwords and account protection settings.</p>
                                    </div>
                                </div>

                                <div className="security-notice" style={{ background: '#eff6ff', padding: '1.25rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', color: '#312e81', fontSize: '0.875rem', marginBottom: '2rem' }}>
                                    <AlertCircle size={20} />
                                    <p style={{ margin: 0 }}>Your PIN is used for login access. {user?.role === 'ADMIN' && 'As admin, you can view employee PINs in Employee Management.'}</p>
                                </div>

                                {user?.role === 'ADMIN' && profileData.pin && (
                                    <div style={{ background: '#fef3c7', padding: '1.25rem', borderRadius: '1rem', marginBottom: '2rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                            <Fingerprint size={20} color="#d97706" />
                                            <span style={{ fontWeight: 800, color: '#92400e' }}>Your Current PIN</span>
                                        </div>
                                        <div style={{ fontSize: '2rem', fontWeight: 900, color: '#78350f', letterSpacing: '0.5rem', fontFamily: 'monospace' }}>
                                            {profileData.pin}
                                        </div>
                                    </div>
                                )}

                                {!showPinForm ? (
                                    <button className="btn-premium" style={{ width: 'auto' }} onClick={() => setShowPinForm(true)}>
                                        <Lock size={16} /> Change PIN
                                    </button>
                                ) : (
                                    <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: '1.25rem', border: '1px solid #e2e8f0' }}>
                                        <h5 style={{ fontSize: '1rem', fontWeight: 900, marginBottom: '1.5rem' }}>Change Your PIN</h5>
                                        <div style={{ display: 'grid', gap: '1.25rem', marginBottom: '1.5rem' }}>
                                            <div className="p-input-group">
                                                <label>Old PIN</label>
                                                <div className="input-with-icon">
                                                    <Lock size={18} className="i-icon" />
                                                    <input
                                                        type="password"
                                                        maxLength={4}
                                                        value={pinChangeData.oldPin}
                                                        onChange={e => setPinChangeData({ ...pinChangeData, oldPin: e.target.value.replace(/\D/g, '') })}
                                                        placeholder="Enter old 4-digit PIN"
                                                    />
                                                </div>
                                            </div>
                                            <div className="p-input-group">
                                                <label>New PIN</label>
                                                <div className="input-with-icon">
                                                    <Fingerprint size={18} className="i-icon" />
                                                    <input
                                                        type="password"
                                                        maxLength={4}
                                                        value={pinChangeData.newPin}
                                                        onChange={e => setPinChangeData({ ...pinChangeData, newPin: e.target.value.replace(/\D/g, '') })}
                                                        placeholder="Enter new 4-digit PIN"
                                                    />
                                                </div>
                                            </div>
                                            <div className="p-input-group">
                                                <label>Confirm New PIN</label>
                                                <div className="input-with-icon">
                                                    <Fingerprint size={18} className="i-icon" />
                                                    <input
                                                        type="password"
                                                        maxLength={4}
                                                        value={pinChangeData.confirmPin}
                                                        onChange={e => setPinChangeData({ ...pinChangeData, confirmPin: e.target.value.replace(/\D/g, '') })}
                                                        placeholder="Confirm new 4-digit PIN"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                                            <button className="btn-premium" onClick={handlePinChange}>
                                                <Save size={16} /> Save New PIN
                                            </button>
                                            <button className="btn-premium-outline" onClick={() => {
                                                setShowPinForm(false);
                                                setPinChangeData({ oldPin: '', newPin: '', confirmPin: '' });
                                            }}>
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Lightbox for Preview */}
            {previewDoc && (
                <div className="doc-lightbox" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }} onClick={() => setPreviewDoc(null)}>
                    <div className="lightbox-content animate-scale-in" style={{ background: 'white', borderRadius: '2rem', padding: '2rem', maxWidth: '800px', width: '100%', position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <div className="lightbox-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>{previewDoc.label}</h3>
                            <button className="close-btn" style={{ background: '#f1f5f9', border: 'none', width: '44px', height: '44px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setPreviewDoc(null)}><X size={24} /></button>
                        </div>
                        <img src={previewDoc.url} style={{ width: '100%', borderRadius: '1rem', maxHeight: '60vh', objectFit: 'contain' }} alt="KYC Doc" />
                    </div>
                </div>
            )}

            <style>{`
                .profile-explorer { padding: 2.5rem; max-width: 1400px; margin: 0 auto; color: #1e293b; }
                .explorer-title { font-size: 2.25rem; font-weight: 900; letter-spacing: -0.02em; margin-bottom: 0.5rem; color: #050a15; }
                .explorer-subtitle { color: #64748b; font-size: 1rem; font-weight: 500; }
                
                .explorer-layout { display: grid; grid-template-columns: 320px 1fr; gap: 2.5rem; align-items: start; }
                @media (max-width: 1024px) { .explorer-layout { grid-template-columns: 1fr; } }
                
                .explorer-sidebar { display: flex; flex-direction: column; gap: 1.5rem; position: sticky; top: 2rem; }
                .identity-card-main { padding: 2rem; text-align: center; background: white; border-radius: 1.5rem; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                
                .completion-ring { 
                    width: 160px; height: 160px; margin: 0 auto 1.5rem; border-radius: 50%; padding: 6px;
                    background: conic-gradient(var(--primary, #6366f1) calc(var(--percent) * 1%), #f1f5f9 0);
                    display: flex; align-items: center; justifyContent: center;
                }
                .avatar-canvas { 
                    width: 100%; height: 100%; border-radius: 50%; background: white; overflow: hidden; position: relative;
                    border: 4px solid white; box-shadow: inset 0 2px 10px rgba(0,0,0,0.1);
                }
                .avatar-canvas img { width: 100%; height: 100%; object-fit: cover; }
                .cam-trigger { 
                    position: absolute; bottom: 8px; right: 8px; background: var(--primary, #6366f1); color: white;
                    border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
                    display: flex; align-items: center; justifyContent: center; box-shadow: 0 4px 10px rgba(0,0,0,0.2);
                }
                
                .name-plate h3 { font-size: 1.5rem; font-weight: 900; margin: 0.5rem 0 0.25rem; }
                .role-tag { 
                    display: inline-block; padding: 0.25rem 0.75rem; background: #eff6ff; color: #2563eb; 
                    font-size: 0.65rem; font-weight: 900; text-transform: uppercase; border-radius: 2rem;
                }
                
                .sidebar-nav { margin-top: 2rem; display: flex; flex-direction: column; gap: 0.5rem; }
                .nav-link { 
                    display: flex; align-items: center; gap: 0.875rem; padding: 0.875rem 1.25rem; border: none;
                    background: transparent; color: #64748b; font-weight: 700; font-size: 0.875rem; border-radius: 0.85rem;
                    cursor: pointer; transition: all 0.2s; text-align: left;
                }
                .nav-link:hover { background: #f8fafc; color: #6366f1; }
                .nav-link.active { background: #eff6ff; color: #6366f1; }
                
                .quick-links { padding: 1.5rem; background: white; border-radius: 1.5rem; border: 1px solid #e2e8f0; }
                .card-title-small { font-size: 0.75rem; font-weight: 900; text-transform: uppercase; margin-bottom: 1.25rem; color: #94a3b8; }
                .quick-item { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem; }
                .q-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justifyContent: center; flex-shrink: 0; }
                
                .section-card { padding: 2.5rem; background: white; border-radius: 1.5rem; border: 1px solid #e2e8f0; }
                .section-head { display: flex; align-items: center; gap: 1.25rem; margin-bottom: 2.5rem; }
                .section-icon { width: 44px; height: 44px; background: #eff6ff; color: #6366f1; border-radius: 12px; display: flex; align-items: center; justifyContent: center; }
                
                .premium-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem 2rem; }
                @media (max-width: 640px) { .premium-form-grid { grid-template-columns: 1fr; } }
                .full-width { grid-column: 1 / -1; }
                
                .p-input-group label { font-size: 0.8125rem; font-weight: 800; color: #475569; margin-bottom: 0.65rem; display: block; text-transform: uppercase; }
                .input-with-icon { position: relative; }
                .i-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8; }
                .input-with-icon input { width: 100%; padding: 0.85rem 1.25rem 0.85rem 2.85rem; border: 1px solid #e2e8f0; border-radius: 1rem; outline: none; transition: all 0.2s; font-size: 0.9375rem; font-weight: 600; }
                .premium-select { width: 100%; padding: 0.85rem 1.25rem; border: 1px solid #e2e8f0; border-radius: 1rem; outline: none; font-size: 0.9375rem; font-weight: 600; background: white; }
                .academic-input { width: 100%; padding: 0.75rem 1rem; border: 1px solid #e2e8f0; border-radius: 0.75rem; outline: none; transition: all 0.2s; font-size: 0.875rem; font-weight: 600; background: white; }
                .academic-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
                .academic-input:disabled { background: #f8fafc; color: #475569; }
                
                .btn-premium { background: var(--primary, #6366f1); color: white; border: none; padding: 0.875rem 1.5rem; border-radius: 1rem; font-weight: 800; font-size: 0.875rem; cursor: pointer; display: flex; align-items: center; justifyContent: center; gap: 0.75rem; transition: all 0.2s; box-shadow: 0 4px 15px rgba(99,102,241,0.25); }
                .btn-premium-outline { background: white; border: 1px solid #e2e8f0; color: #1e293b; padding: 0.875rem 1.5rem; border-radius: 1rem; font-weight: 800; font-size: 0.875rem; cursor: pointer; transition: all 0.2s; }
                
                .doc-uploader-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; margin-top: 2rem; }
                .progress-track { width: 100%; height: 6px; background: #f1f5f9; border-radius: 10px; overflow: hidden; }
                .progress-fill { height: 100%; background: var(--primary, #6366f1); transition: width 0.6s ease; }
            `}</style>
        </div>
    );
}

const KBDOcCard = ({ title, desc, value, icon, onUpload, onView, isEditing }: any) => {
    const inputRef = useRef<HTMLInputElement>(null);
    return (
        <div style={{
            background: 'white', border: '1px solid #e2e8f0', borderRadius: '1.25rem', padding: '1.5rem',
            textAlign: 'center', transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden'
        }}>
            <div style={{
                width: '60px', height: '60px', background: value ? 'rgba(16, 185, 129, 0.1)' : '#f8fafc',
                color: value ? '#10b981' : '#94a3b8', borderRadius: '50%', margin: '0 auto 1.25rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                {value ? <CheckCircle2 size={30} /> : icon}
            </div>
            <h5 style={{ fontWeight: 900, fontSize: '1rem', marginBottom: '0.25rem', margin: '0 0 0.25rem 0' }}>{title}</h5>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '1.5rem' }}>{desc}</p>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                    onClick={() => inputRef.current?.click()}
                    className="btn-premium-outline"
                    disabled={!isEditing}
                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.7rem', opacity: isEditing ? 1 : 0.6, cursor: isEditing ? 'pointer' : 'not-allowed' }}
                >
                    {value ? 'Change' : 'Upload'}
                </button>
                {value && (
                    <button onClick={onView} className="btn-premium" style={{ padding: '0.5rem', borderRadius: '0.75rem', width: '36px' }}>
                        <Eye size={16} />
                    </button>
                )}
            </div>
            <input type="file" ref={inputRef} hidden accept="image/*" onChange={onUpload} />
        </div>
    );
};


