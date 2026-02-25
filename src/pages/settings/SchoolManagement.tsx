import React, { useState } from 'react';
import { Shield, Save, Loader2, Plus, Building2, Globe, Check, X, Upload, Trash2, User, Phone, MapPin, Mail, Layout, ChevronDown, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { db, storage } from '../../lib/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, Timestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useFirestore } from '../../hooks/useFirestore';

const MODULE_STRUCTURE = [
    {
        id: 'students',
        label: 'Student Management',
        children: [
            { id: '/students/admission', label: 'Add Student' },
            { id: '/students/form-sale', label: 'Form Sale' },
            { id: '/students/bulk-upload', label: 'Bulk Student Upload' },
            { id: '/students/registrations', label: 'Registration Requests' },
            { id: '/students', label: 'Manage Students' },
            { id: '/students/report', label: 'Student Report' },
            { id: '/students/re-reg', label: 'Re-Registration Report' },
            { id: '/students/dues', label: 'Dues List' },
            { id: '/students/promotion', label: 'Promote Students' },
            { id: '/students/photos', label: 'Student Photo Upload' },
        ]
    },
    {
        id: 'attendance',
        label: 'Attendance Management',
        children: [
            { id: '/attendance', label: 'Mark Attendance' },
            { id: '/attendance/staff', label: 'Staff Attendance' },
            { id: '/attendance/report', label: 'Student Report' },
            { id: '/attendance/staff-report', label: 'Staff Attendance Report' },
        ]
    },
    {
        id: 'employees',
        label: 'Employee Management',
        children: [
            { id: '/teachers', label: 'Employees List' },
            { id: '/teachers/payroll', label: 'Payroll Management' },
            { id: '/teaching-logs', label: 'Teaching Logs' },
        ]
    },
    {
        id: 'fees',
        label: 'Fee Management',
        children: [
            { id: '/fees', label: 'Collect Fees' },
            { id: '/fees/structure', label: 'Fee Structure Old' },
            { id: '/fees/set-amount', label: 'Set Fee Amount' },
            { id: '/fees/report', label: 'Fee Report' },
            { id: '/fees/dues', label: 'Due Report' },
        ]
    },
    {
        id: 'accounts',
        label: 'Accounts & Expenses',
        children: [
            { id: '/accounts/dashboard', label: 'Accounts Dashboard' },
            { id: '/accounts/expenses', label: 'Expense Entry' },
        ]
    },
    {
        id: 'exams',
        label: 'Exams & Results',
        children: [
            { id: '/exams', label: 'Exam Dashboard' },
            { id: '/exams/academic-year', label: 'Academic Year & Terms' },
            { id: '/exams/configuration', label: 'Exam Configuration' },
            { id: '/exams/scheduling', label: 'Schedule Exams' },
            { id: '/exam-timetable', label: 'Exam Timetable' },
            { id: '/admit-cards', label: 'Print Admit Card' },
            { id: '/marks-entry', label: 'Marks Entry' },
            { id: '/exams/bulk-marks-upload', label: 'Bulk Marks Upload' },
            { id: '/exams/results', label: 'View Results' },
            { id: '/exams/analytics', label: 'Performance Analytics' },
            { id: '/exams/syllabus', label: 'Manage Syllabus' },
            { id: '/exams/templates', label: 'Customize Templates' },
            { id: '/report-cards', label: 'Print Report Card' },
            { id: '/question-generator', label: 'Question Generator' },
        ]
    },
    {
        id: 'homework',
        label: 'Homework Management',
        children: [
            { id: '/homework', label: 'Assign Homework' },
            { id: '/homework/report', label: 'Homework Report' },
        ]
    },
    { id: 'routine', label: 'Routine Management' },
    { id: 'gallery', label: 'Gallery Management' },
    { id: 'transport', label: 'Transport Management' },
    { id: 'hostel', label: 'Hostel Management' },
    { id: 'inventory', label: 'Inventory Management' },
    { id: 'library', label: 'Library Management' },
    { id: 'notices', label: 'Notice Board' },
    { id: 'communication', label: 'Message Center' },
    { id: 'calendar', label: 'Academic Calendar' },
    { id: 'reports', label: 'Advanced Reports' },
    {
        id: 'settings',
        label: 'Settings',
        children: [
            { id: '/settings/class-master', label: 'Class & Section Master' },
            { id: '/settings/inventory', label: 'Inventory Master' },
            { id: '/settings/institution', label: 'Institution Info' },
            { id: '/settings/registration-fields', label: 'Public Registration Fields' },
            { id: '/settings/student-admission-fields', label: 'Internal Admission Fields' },
            { id: '/settings/print-design', label: 'Print Form Designer' },
            { id: '/settings/api-keys', label: 'API Keys' },
            { id: '/settings/data-seeder', label: 'Data Seeder' },
            { id: '/settings/master-control', label: 'Master Control' },
            { id: '/settings/payments', label: 'Payment Settings' },
            { id: '/settings/subjects-chapters', label: 'Subjects & Chapters' },
            { id: '/settings/roles', label: 'Roles & Permissions' },
        ]
    },
    {
        id: 'super_admin',
        label: 'Super Admin',
        children: [
            { id: '/settings/schools', label: 'Manage Schools' }
        ]
    },
    { id: 'ai-assistant', label: 'AI Assistant' },
    { id: 'profile', label: 'Profile Management' },
];

interface School {
    id: string; // Document ID (slug)
    name: string;
    fullName?: string;
    logoUrl?: string;
    logo?: string; // Backwards compatibility
    status: 'ACTIVE' | 'INACTIVE';
    allowedModules: string[];
    contactPerson?: string;
    contactNumber?: string;
    address?: string;
    email?: string;
    phone?: string;
    website?: string;
    customTitle?: string;
    createdAt: any;
}

const Toggle: React.FC<{ checked: boolean; onChange: () => void; size?: 'sm' | 'md' }> = ({ checked, onChange, size = 'md' }) => (
    <div
        onClick={(e) => { e.stopPropagation(); onChange(); }}
        style={{
            width: size === 'md' ? '44px' : '36px',
            height: size === 'md' ? '24px' : '20px',
            borderRadius: '100px',
            background: checked ? '#10b981' : '#e2e8f0',
            position: 'relative',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: checked ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'none'
        }}
    >
        <div style={{
            width: size === 'md' ? '18px' : '14px',
            height: size === 'md' ? '18px' : '14px',
            borderRadius: '50%',
            background: 'white',
            position: 'absolute',
            top: size === 'md' ? '3px' : '3px',
            left: checked ? (size === 'md' ? '23px' : '19px') : '3px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }} />
    </div>
);

const SchoolManagement: React.FC = () => {
    const { data: schools, loading } = useFirestore<School>('schools');
    const [isSaving, setIsSaving] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingSchool, setEditingSchool] = useState<School | null>(null);
    const [expandedModules, setExpandedModules] = useState<string[]>([]);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string>('');
    const [uploadProgress, setUploadProgress] = useState<number>(0);

    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        fullName: '',
        logoUrl: '',
        contactPerson: '',
        contactNumber: '',
        adminPin: '',
        address: '',
        email: '',
        phone: '',
        website: '',
        customTitle: '',
        allowedModules: [] as string[]
    });


    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type
            const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                alert('Please select a valid image file (PNG, JPG, SVG, or WebP)');
                return;
            }
            // Validate file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                alert('Logo file size must be less than 2MB');
                return;
            }
            setLogoFile(file);
            // Create preview URL
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleOpenModal = (school?: School) => {
        if (school) {
            setEditingSchool(school);
            setFormData({
                name: school.name,
                fullName: school.fullName || '',
                slug: school.id,
                logoUrl: school.logoUrl || school.logo || '',
                contactPerson: school.contactPerson || '',
                contactNumber: school.contactNumber || '',
                adminPin: '',
                address: school.address || '',
                email: school.email || '',
                phone: school.phone || '',
                website: school.website || '',
                customTitle: school.customTitle || '',
                allowedModules: school.allowedModules || []
            });
            // Set preview to existing logo
            setLogoPreview(school.logoUrl || school.logo || '');
            setLogoFile(null);
        } else {
            setEditingSchool(null);
            // Default: All modules enabled for new school
            const allModuleIds: string[] = [];
            MODULE_STRUCTURE.forEach(m => {
                allModuleIds.push(m.id);
                if (m.children) m.children.forEach(c => allModuleIds.push(c.id));
            });
            setFormData({
                name: '',
                slug: '',
                fullName: '',
                logoUrl: '',
                contactPerson: '',
                contactNumber: '',
                adminPin: '',
                address: '',
                email: '',
                phone: '',
                website: '',
                customTitle: '',
                allowedModules: allModuleIds
            });
            setLogoPreview('');
            setLogoFile(null);
        }
        setUploadProgress(0);
        setShowModal(true);
    };


    const toggleModule = (moduleId: string, isParent: boolean = false, children?: any[]) => {
        setFormData(prev => {
            const isCurrentlyEnabled = prev.allowedModules.includes(moduleId);
            let newAllowed = [...prev.allowedModules];

            if (isCurrentlyEnabled) {
                // Disable it
                newAllowed = newAllowed.filter(id => id !== moduleId);
                if (isParent && children) {
                    // Also disable all children
                    const childIds = children.map(c => c.id);
                    newAllowed = newAllowed.filter(id => !childIds.includes(id));
                }
            } else {
                // Enable it
                newAllowed.push(moduleId);
                if (isParent && children) {
                    // Also enable all children
                    const childIds = children.map(c => c.id);
                    childIds.forEach(cid => {
                        if (!newAllowed.includes(cid)) newAllowed.push(cid);
                    });
                }
            }
            return { ...prev, allowedModules: newAllowed };
        });
    };

    const toggleExpansion = (id: string) => {
        setExpandedModules(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        // Sanitize slug: lowercase, replace spaces with hyphen, and REMOVE ALL SLASHES
        const schoolSlug = formData.slug.toLowerCase().trim().replace(/\s+/g, '-').replace(/\//g, '');

        if (!schoolSlug) return alert('School URL/ID is required (letters and numbers only)');
        if (!editingSchool && formData.adminPin && formData.adminPin.length !== 4) {
            return alert('Admin PIN must be exactly 4 digits');
        }


        setIsSaving(true);
        try {
            let finalLogoUrl = formData.logoUrl;

            // Upload logo file if one was selected
            if (logoFile) {
                console.log('Starting logo upload...', { fileName: logoFile.name, size: logoFile.size });
                const fileExtension = logoFile.name.split('.').pop();
                const storagePath = `schools/${schoolSlug}/logo.${fileExtension}`;
                const storageRef = ref(storage, storagePath);

                console.log('Storage path:', storagePath);

                // Upload with progress tracking and timeout
                const uploadTask = uploadBytesResumable(storageRef, logoFile);

                await new Promise<void>((resolve, reject) => {
                    // Set timeout for upload (30 seconds)
                    const timeout = setTimeout(() => {
                        reject(new Error('Upload timeout - please check Firebase Storage rules in Firebase Console'));
                    }, 30000);

                    uploadTask.on(
                        'state_changed',
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            console.log('Upload progress:', progress.toFixed(2) + '%');
                            setUploadProgress(progress);
                        },
                        (error) => {
                            clearTimeout(timeout);
                            console.error('Upload error:', error);
                            console.error('Error code:', error.code);
                            console.error('Error message:', error.message);
                            reject(new Error(`Upload failed: ${error.message}`));
                        },
                        async () => {
                            clearTimeout(timeout);
                            try {
                                // Upload completed successfully, get download URL
                                finalLogoUrl = await getDownloadURL(uploadTask.snapshot.ref);
                                console.log('Upload successful! Download URL:', finalLogoUrl);
                                resolve();
                            } catch (error) {
                                console.error('Error getting download URL:', error);
                                reject(error);
                            }
                        }
                    );
                });
            }


            const schoolData = {
                name: formData.name,
                fullName: formData.fullName,
                logoUrl: finalLogoUrl,
                contactPerson: formData.contactPerson,
                contactNumber: formData.contactNumber,
                address: formData.address,
                email: formData.email,
                phone: formData.phone,
                website: formData.website,
                customTitle: formData.customTitle,
                allowedModules: formData.allowedModules,
                status: editingSchool?.status || 'ACTIVE',
                updatedAt: Timestamp.now()
            };


            if (editingSchool) {
                await updateDoc(doc(db, 'schools', editingSchool.id), schoolData);

                // Update admin credentials if PIN provided
                if (formData.adminPin && formData.contactNumber) {
                    await setDoc(doc(db, 'settings', `admin_credentials_${editingSchool.id}`), {
                        mobile: formData.contactNumber,
                        pin: formData.adminPin,
                        schoolId: editingSchool.id,
                        updatedAt: new Date().toISOString()
                    });
                }
            } else {
                // Create new school
                const docRef = doc(db, 'schools', schoolSlug);
                await setDoc(docRef, {
                    ...schoolData,
                    id: schoolSlug,
                    createdAt: Timestamp.now()
                });

                // Create admin credentials if PIN and mobile provided
                if (formData.adminPin && formData.contactNumber) {
                    await setDoc(doc(db, 'settings', `admin_credentials_${schoolSlug}`), {
                        mobile: formData.contactNumber,
                        pin: formData.adminPin,
                        schoolId: schoolSlug,
                        updatedAt: new Date().toISOString()
                    });
                }
            }

            alert('✅ School Configuration Saved!');
            setShowModal(false);
        } catch (err) {
            alert('Error: ' + (err as Error).message);
        } finally {
            setIsSaving(false);
            setUploadProgress(0);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this school? All data will be lost.')) return;
        try {
            await deleteDoc(doc(db, 'schools', id));
        } catch (err) {
            alert('Delete failed');
        }
    };

    return (
        <div className="animate-fade-in no-scrollbar">
            <div className="page-header">
                <div>
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>School Management</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Manage multi-tenant schools and their feature access.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="btn btn-primary shadow-lg hover-lift"
                    style={{ gap: '0.5rem' }}
                >
                    <Plus size={20} /> Add New School
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', gridColumn: '1/-1' }}>
                        <Loader2 className="animate-spin" size={40} color="var(--primary)" />
                    </div>
                ) : schools.length === 0 ? (
                    <div style={{ padding: '4rem', textAlign: 'center', gridColumn: '1/-1', background: 'rgba(255,255,255,0.5)', borderRadius: '2rem' }}>
                        <Building2 size={64} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.3 }} />
                        <h3 style={{ color: 'var(--text-muted)' }}>No schools registered yet.</h3>
                    </div>
                ) : schools.map(school => (
                    <div key={school.id} className="glass-card hover-lift" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '50%',
                                    background: 'var(--bg-main)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid var(--border)',
                                    overflow: 'hidden'
                                }}>
                                    {school.logoUrl ? (
                                        <img src={school.logoUrl} alt={school.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        <Building2 size={24} color="var(--primary)" />
                                    )}
                                </div>
                                <div>
                                    <h3 style={{ fontWeight: 800, fontSize: '1.125rem' }}>{school.name}</h3>
                                    <code style={{ fontSize: '0.75rem', color: 'var(--primary)', background: 'rgba(99, 102, 241, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                        /{school.id}
                                    </code>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => handleOpenModal(school)} className="btn-icon shadow-sm" style={{ color: 'var(--primary)' }}><Shield size={18} /></button>
                                <button onClick={() => handleDelete(school.id)} className="btn-icon shadow-sm" style={{ color: '#ef4444' }}><Trash2 size={18} /></button>
                            </div>
                        </div>

                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <User size={14} /> {school.contactPerson || 'No contact person'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Phone size={14} /> {school.contactNumber || 'No number'}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {MODULE_STRUCTURE.map(m => {
                                if (school.allowedModules?.includes(m.id)) {
                                    return (
                                        <span key={m.id} style={{
                                            fontSize: '0.65rem',
                                            fontWeight: 700,
                                            padding: '0.2rem 0.6rem',
                                            background: 'rgba(99, 102, 241, 0.1)',
                                            color: 'var(--primary)',
                                            borderRadius: '100px',
                                            textTransform: 'uppercase'
                                        }}>
                                            {m.label}
                                        </span>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Creation/Edition Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', backdropFilter: 'blur(4px)' }}>
                    <div className="glass-card animate-scale-in" style={{ width: '100%', maxWidth: '1100px', maxHeight: '90vh', overflowY: 'auto', padding: '2.5rem', background: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{editingSchool ? 'Configuration: ' + editingSchool.name : 'Register New School'}</h2>
                            <button onClick={() => setShowModal(false)} className="btn-icon"><X size={24} /></button>
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2.5rem' }}>
                            {/* LEFT SIDE: SCHOOL INFO */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <div className="input-group" style={{ marginBottom: 0 }}>
                                        <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Building2 size={16} /> Display Name *</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            required
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g. Millat Public School"
                                        />
                                    </div>
                                    <div className="input-group" style={{ marginBottom: 0 }}>
                                        <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Globe size={16} /> School URL Slug (ID) *</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            required
                                            disabled={!!editingSchool}
                                            value={formData.slug}
                                            onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '') })}
                                            placeholder="e.g. millat-public"
                                        />
                                    </div>
                                </div>

                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Building2 size={16} /> School Full Name (Official)</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={formData.fullName}
                                        onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                        placeholder="Full Official School Name"
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <div className="input-group" style={{ marginBottom: 0 }}>
                                        <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><User size={16} /> Contact Person</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            value={formData.contactPerson}
                                            onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                                            placeholder="Name of Contact Person"
                                        />
                                    </div>
                                    <div className="input-group" style={{ marginBottom: 0 }}>
                                        <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Phone size={16} /> Contact Number</label>
                                        <input
                                            type="tel"
                                            className="input-field"
                                            value={formData.contactNumber}
                                            onChange={e => setFormData({ ...formData, contactNumber: e.target.value })}
                                            placeholder="Mobile Number"
                                        />
                                    </div>
                                </div>

                                <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '1.25rem', borderRadius: '12px', border: '1px dashed var(--primary)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                        <Shield size={18} color="var(--primary)" />
                                        <label className="field-label" style={{ margin: 0, color: 'var(--primary)', fontWeight: 800 }}>Admin Login PIN (4 digits)</label>
                                    </div>
                                    <input
                                        type="password"
                                        className="input-field"
                                        value={formData.adminPin}
                                        onChange={e => setFormData({ ...formData, adminPin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                                        placeholder="••••"
                                        maxLength={4}
                                        style={{ fontSize: '1.5rem', letterSpacing: '0.5rem', textAlign: 'center', fontWeight: 900 }}
                                    />
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: 0 }}>
                                        {editingSchool ? 'Leave empty to keep current PIN unchanged' : 'This will be used with Contact Number to login as admin'}
                                    </p>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <div className="input-group" style={{ marginBottom: 0 }}>
                                        <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Mail size={16} /> School Email</label>
                                        <input
                                            type="email"
                                            className="input-field"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="school@example.com"
                                        />
                                    </div>
                                    <div className="input-group" style={{ marginBottom: 0 }}>
                                        <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Phone size={16} /> School Phone/Landline</label>
                                        <input
                                            type="tel"
                                            className="input-field"
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="Landline Number"
                                        />
                                    </div>
                                </div>

                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MapPin size={16} /> School Address</label>
                                    <textarea
                                        className="input-field"
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        placeholder="Complete address of the school"
                                        rows={2}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    {/* Logo Upload Section */}
                                    <div className="input-group" style={{ marginBottom: 0, gridColumn: '1/-1' }}>
                                        <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                            <ImageIcon size={16} /> School Logo
                                        </label>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            {/* Preview Box */}
                                            <div style={{
                                                width: '120px',
                                                height: '120px',
                                                borderRadius: '12px',
                                                border: '2px dashed var(--border)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                background: 'var(--bg-main)',
                                                overflow: 'hidden'
                                            }}>
                                                {logoPreview ? (
                                                    <img src={logoPreview} alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                ) : (
                                                    <ImageIcon size={48} color="var(--text-muted)" style={{ opacity: 0.3 }} />
                                                )}
                                            </div>
                                            {/* Upload Controls */}
                                            <div style={{ flex: 1 }}>
                                                <input
                                                    type="file"
                                                    id="logo-upload"
                                                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                                                    onChange={handleLogoChange}
                                                    style={{ display: 'none' }}
                                                />
                                                <label
                                                    htmlFor="logo-upload"
                                                    className="btn"
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem',
                                                        cursor: 'pointer',
                                                        padding: '0.75rem 1.25rem',
                                                        border: '1px solid var(--border)',
                                                        borderRadius: '8px',
                                                        background: 'white',
                                                        fontWeight: 600,
                                                        fontSize: '0.9rem'
                                                    }}
                                                >
                                                    <Upload size={18} />
                                                    {logoPreview ? 'Change Logo' : 'Upload Logo'}
                                                </label>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: '1rem' }}>
                                                    Accepted: PNG, JPG, SVG, WebP (max 2MB)
                                                </p>

                                                <div className="input-group" style={{ marginBottom: 0 }}>
                                                    <label className="field-label" style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.7 }}>Or enter Logo URL manually:</label>
                                                    <input
                                                        type="text"
                                                        className="input-field"
                                                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                                                        value={formData.logoUrl}
                                                        onChange={e => {
                                                            const url = e.target.value;
                                                            setFormData({ ...formData, logoUrl: url });
                                                            if (!logoFile) setLogoPreview(url);
                                                        }}
                                                        placeholder="https://example.com/logo.png"
                                                    />
                                                </div>
                                                {/* Upload Progress Bar */}
                                                {uploadProgress > 0 && uploadProgress < 100 && (
                                                    <div style={{ marginTop: '0.5rem' }}>
                                                        <div style={{
                                                            width: '100%',
                                                            height: '6px',
                                                            background: 'var(--bg-main)',
                                                            borderRadius: '100px',
                                                            overflow: 'hidden'
                                                        }}>
                                                            <div style={{
                                                                width: `${uploadProgress}%`,
                                                                height: '100%',
                                                                background: 'var(--primary)',
                                                                transition: 'width 0.3s ease'
                                                            }} />
                                                        </div>
                                                        <p style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: '0.25rem' }}>
                                                            Uploading: {Math.round(uploadProgress)}%
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="input-group" style={{ marginBottom: 0 }}>
                                        <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Globe size={16} /> School Website</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            value={formData.website}
                                            onChange={e => setFormData({ ...formData, website: e.target.value })}
                                            placeholder="www.school.com"
                                        />
                                    </div>
                                    <div className="input-group" style={{ marginBottom: 0 }}>
                                        <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Layout size={16} /> Custom Browser Title</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            value={formData.customTitle}
                                            onChange={e => setFormData({ ...formData, customTitle: e.target.value })}
                                            placeholder="Custom title for browser tab"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT SIDE: FEATURE GATE */}
                            <div style={{ background: 'var(--bg-main)', borderRadius: '1.5rem', padding: '1.5rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                                <h4 style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Shield size={18} /> Feature Gate (Menus & Submenus)
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }} className="no-scrollbar">
                                    {MODULE_STRUCTURE.map(mod => {
                                        const isEnabled = formData.allowedModules.includes(mod.id);
                                        const isExpanded = expandedModules.includes(mod.id);

                                        return (
                                            <div key={mod.id} style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div
                                                    onClick={() => toggleExpansion(mod.id)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '1rem',
                                                        background: 'white',
                                                        borderRadius: isExpanded ? '12px 12px 0 0' : '12px',
                                                        border: '1px solid var(--border)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        zIndex: 2
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        {mod.children ? (isExpanded ? <ChevronDown size={18} color="var(--text-muted)" /> : <ChevronRight size={18} color="var(--text-muted)" />) : <div style={{ width: '18px' }} />}
                                                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: isEnabled ? 'var(--text-main)' : 'var(--text-muted)' }}>{mod.label}</span>
                                                    </div>
                                                    <Toggle checked={isEnabled} onChange={() => toggleModule(mod.id, true, mod.children)} />
                                                </div>

                                                {mod.children && isExpanded && (
                                                    <div style={{
                                                        padding: '0.5rem 0.5rem 0.5rem 2.5rem',
                                                        background: 'rgba(255,255,255,0.5)',
                                                        border: '1px solid var(--border)',
                                                        borderTop: 'none',
                                                        borderRadius: '0 0 12px 12px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '0.5rem',
                                                        marginBottom: '0.5rem'
                                                    }}>
                                                        {mod.children.map(child => (
                                                            <div key={child.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem' }}>
                                                                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: formData.allowedModules.includes(child.id) ? 'var(--text-main)' : 'var(--text-muted)' }}>{child.label}</span>
                                                                <Toggle
                                                                    size="sm"
                                                                    checked={formData.allowedModules.includes(child.id)}
                                                                    onChange={() => toggleModule(child.id)}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ gridColumn: '1/-1', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" onClick={() => setShowModal(false)} className="btn" style={{ flex: 1, border: '1px solid var(--border)', height: '3.5rem', borderRadius: '1rem', fontWeight: 700 }}>Cancel</button>
                                <button type="submit" disabled={isSaving} className="btn btn-primary" style={{ flex: 2, height: '3.5rem', borderRadius: '1rem', fontWeight: 800, fontSize: '1.1rem' }}>
                                    {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                                    {editingSchool ? 'Save Changes' : 'Register & Enable Features'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SchoolManagement;
