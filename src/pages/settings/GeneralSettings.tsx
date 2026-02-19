import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Edit2, Plus, BrainCircuit, Database, Save, Loader2, ShoppingBag, Shield, CreditCard, Image as ImageIcon, FileText, BookOpen, Upload, Copy, Check } from 'lucide-react';
import { usePersistence } from '../../hooks/usePersistence';
import { seedDatabase, clearDatabase } from '../../lib/dbSeeder';
import { APP_CONFIG, CLASS_ORDER, getActiveClasses } from '../../constants/app';
import { db, storage } from '../../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, updateDoc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';
import { formatClassName, toProperCase } from '../../utils/formatters';

/**
 * Main Settings Page (Legacy/Overview)
 */
const GeneralSettings: React.FC = () => {
    return (
        <div className="animate-fade-in no-scrollbar">
            <div className="page-header">
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '0.25rem' }}>Global Settings</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Configure classes, sections, and other school-wide parameters.</p>
                </div>
            </div>

            <div className="responsive-grid-auto" style={{ marginBottom: '2rem' }}>
                <ClassMaster />
                <InstitutionInfo />
            </div>

            <InventoryMaster />

            <div className="responsive-grid-auto" style={{ marginTop: '2rem' }}>
                <DataSeeder />
                <PinManagement />
                <AdminSecurityMaster />
                <BankSettings />
                <AdmissionNoSync />
                <PrintFormSettings />
            </div>
        </div>
    );
};

export function BankSettings() {
    const { currentSchool } = useSchool();
    const [config, setConfig] = useState({
        accountName: '',
        accountNumber: '',
        ifscCode: '',
        bankName: '',
        branch: '',
        qrCodeUrl: ''
    });
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchBank = async () => {
            if (!currentSchool?.id) return;
            const d = await getDoc(doc(db, 'settings', `bank_details_${currentSchool.id}`));
            if (d.exists()) {
                setConfig(d.data() as any);
            }
            setLoading(false);
        };
        fetchBank();
    }, [currentSchool?.id]);

    const handleSave = async () => {
        if (!currentSchool?.id) return;
        setIsSaving(true);
        try {
            await setDoc(doc(db, 'settings', `bank_details_${currentSchool.id}`), {
                ...config,
                schoolId: currentSchool.id,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            alert('Bank details updated successfully!');
        } catch (e) {
            alert('Failed to update bank details');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return null;

    return (
        <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(59, 130, 246, 0.2)', background: 'rgba(59, 130, 246, 0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CreditCard size={20} />
                </div>
                <h3 style={{ fontWeight: 700 }}>School Bank Details</h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Configure bank account info and QR code for parent fee payments.
            </p>
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="input-group">
                    <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>ACCOUNT NAME</label>
                    <input
                        type="text" className="input-field"
                        value={config.accountName}
                        onChange={e => setConfig({ ...config, accountName: e.target.value })}
                        onBlur={e => setConfig({ ...config, accountName: toProperCase(e.target.value) })}
                    />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>ACCOUNT NUMBER</label>
                        <input
                            type="text" className="input-field"
                            value={config.accountNumber} onChange={e => setConfig({ ...config, accountNumber: e.target.value })}
                        />
                    </div>
                    <div className="input-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>IFSC CODE</label>
                        <input
                            type="text" className="input-field"
                            value={config.ifscCode} onChange={e => setConfig({ ...config, ifscCode: e.target.value.toUpperCase() })}
                        />
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>BANK NAME</label>
                        <input
                            type="text" className="input-field"
                            value={config.bankName}
                            onChange={e => setConfig({ ...config, bankName: e.target.value })}
                            onBlur={e => setConfig({ ...config, bankName: toProperCase(e.target.value) })}
                        />
                    </div>
                    <div className="input-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>BRANCH</label>
                        <input
                            type="text" className="input-field"
                            value={config.branch}
                            onChange={e => setConfig({ ...config, branch: e.target.value })}
                            onBlur={e => setConfig({ ...config, branch: toProperCase(e.target.value) })}
                        />
                    </div>
                </div>
                <div className="input-group">
                    <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>QR CODE URL / IMAGE BASE64</label>
                    <input
                        type="text" className="input-field"
                        placeholder="https://example.com/qr.png or paste base64"
                        value={config.qrCodeUrl} onChange={e => setConfig({ ...config, qrCodeUrl: e.target.value })}
                    />
                    {config.qrCodeUrl && (
                        <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                            <img src={config.qrCodeUrl} alt="QR Preview" style={{ maxWidth: '120px', borderRadius: '0.5rem', border: '1px solid var(--border)' }} />
                        </div>
                    )}
                </div>
            </div>
            <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={isSaving}
                style={{ width: '100%', fontWeight: 700, background: '#3b82f6' }}
            >
                {isSaving ? <Loader2 className="animate-spin" /> : 'Save Bank Details'}
            </button>
        </div>
    );
}

export function AdminSecurityMaster() {
    const { currentSchool } = useSchool();
    const [config, setConfig] = useState({ mobile: '', pin: '' });
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchAdmin = async () => {
            if (!currentSchool?.id) return;
            const d = await getDoc(doc(db, 'settings', `admin_credentials_${currentSchool.id}`));
            if (d.exists()) {
                setConfig({ mobile: d.data().mobile, pin: d.data().pin });
            }
            setLoading(false);
        };
        fetchAdmin();
    }, [currentSchool?.id]);

    const handleSave = async () => {
        if (!currentSchool?.id) return;
        if (config.mobile.length !== 10) return alert('Mobile must be 10 digits');
        if (config.pin.length !== 4) return alert('PIN must be 4 digits');

        setIsSaving(true);
        try {
            await setDoc(doc(db, 'settings', `admin_credentials_${currentSchool.id}`), {
                ...config,
                schoolId: currentSchool.id,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            alert('Admin credentials updated successfully!');
        } catch (e) {
            alert('Failed to update admin credentials');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return null;

    return (
        <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(99, 102, 241, 0.2)', background: 'rgba(99, 102, 241, 0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shield size={20} />
                </div>
                <h3 style={{ fontWeight: 700 }}>Root Admin Security</h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Configure the primary administrator's mobile and 4-digit PIN for system-wide access.
            </p>
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="input-group">
                    <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>ADMIN MOBILE</label>
                    <input
                        type="tel" className="input-field" maxLength={10}
                        value={config.mobile} onChange={e => setConfig({ ...config, mobile: e.target.value.replace(/\D/g, '') })}
                    />
                </div>
                <div className="input-group">
                    <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>ADMIN PIN (4 DIGITS)</label>
                    <input
                        type="password" className="input-field" maxLength={4}
                        value={config.pin} onChange={e => setConfig({ ...config, pin: e.target.value.replace(/\D/g, '') })}
                    />
                </div>
            </div>
            <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={isSaving}
                style={{ width: '100%', fontWeight: 700 }}
            >
                {isSaving ? <Loader2 className="animate-spin" /> : 'Save Credentials'}
            </button>
        </div>
    );
}

export function DataSeeder() {
    const { currentSchool } = useSchool();
    return (
        <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Database size={20} />
                </div>
                <h3 style={{ fontWeight: 700 }}>Database Maintenance</h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Populate your database with sample students, attendance, and fee records for testing.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                <button
                    className="btn"
                    onClick={async () => {
                        if (!currentSchool?.id) return alert('No school selected');
                        if (confirm('Are you sure you want to seed the database? This will add new records.')) {
                            try {
                                await seedDatabase(currentSchool.id);
                                alert('Database seeded successfully!');
                            } catch (e) {
                                alert('Seeding failed: ' + (e as Error).message);
                            }
                        }
                    }}
                    style={{
                        width: '100%',
                        background: 'white',
                        border: '1px solid #10b981',
                        color: '#10b981',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Database size={18} /> Run Data Seeder
                </button>

                <button
                    className="btn"
                    onClick={async () => {
                        if (!currentSchool?.id) return alert('No school selected');
                        if (confirm('Seed the master list of subjects for all active classes? This will merge with existing data.')) {
                            try {
                                const { seedSubjectList } = await import('../../lib/dbSeeder');
                                await seedSubjectList(currentSchool.id);
                                alert('Subject master list seeded successfully!');
                            } catch (e) {
                                alert('Failed: ' + (e as Error).message);
                            }
                        }
                    }}
                    style={{
                        width: '100%',
                        background: 'white',
                        border: '1px solid #10b981',
                        color: '#10b981',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <BookOpen size={18} /> Seed Subject Master List
                </button>

                <button
                    className="btn"
                    onClick={async () => {
                        if (!currentSchool?.id) return alert('No school selected');
                        if (confirm('Seed Class 8, 9, 10 Science subjects and chapters?')) {
                            try {
                                const { seedAcademicStructure } = await import('../../lib/dbSeeder');
                                await seedAcademicStructure(currentSchool.id);
                                alert('Academic structure seeded successfully!');
                            } catch (e) {
                                alert('Failed: ' + (e as Error).message);
                            }
                        }
                    }}
                    style={{
                        width: '100%',
                        background: 'white',
                        border: '1px solid #6366f1',
                        color: '#6366f1',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <BookOpen size={18} /> Seed Science Chapters (8-10)
                </button>

                <button
                    className="btn"
                    onClick={async () => {
                        if (!currentSchool?.id) return alert('No school selected');
                        if (confirm('Create 10 common school expense ledgers?')) {
                            try {
                                const { db } = await import('../../lib/firebase');
                                const { collection, addDoc } = await import('firebase/firestore');
                                const commonLedgers = [
                                    'Electricity Bill',
                                    'Water & Municipal Taxes',
                                    'Stationery & Printing',
                                    'Maintenance & Repairs',
                                    'Internet & Telephone',
                                    'Marketing & Advertisement',
                                    'School Events & Festivals',
                                    'Library Books & Resources',
                                    'Lab Consumables',
                                    'Cleaning & Sanitation'
                                ];

                                for (const name of commonLedgers) {
                                    await addDoc(collection(db, 'ledger_masters'), {
                                        name: name,
                                        type: 'GENERAL',
                                        schoolId: currentSchool.id,
                                        createdAt: new Date().toISOString()
                                    });
                                }
                                alert('Common ledgers created successfully!');
                            } catch (e) {
                                alert('Failed to create ledgers: ' + (e as Error).message);
                            }
                        }
                    }}
                    style={{
                        width: '100%',
                        background: 'white',
                        border: '1px solid var(--primary)',
                        color: 'var(--primary)',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Plus size={18} /> Seed Expense Ledgers
                </button>

                <button
                    className="btn"
                    onClick={async () => {
                        if (!currentSchool?.id) return alert('No school selected');
                        if (confirm('⚠️ CRITICAL ACTION: Are you sure you want to delete ALL data? This will wipe students, attendance, and fees. This cannot be undone!')) {
                            try {
                                await clearDatabase(currentSchool.id);
                                alert('Database wiped successfully!');
                            } catch (e) {
                                alert('Wipe failed: ' + (e as Error).message);
                            }
                        }
                    }}
                    style={{
                        width: '100%',
                        background: 'rgba(239, 68, 68, 0.05)',
                        border: '1px solid #ef4444',
                        color: '#ef4444',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Trash2 size={18} /> Wipe Database (Danger)
                </button>
            </div>
        </div>
    );
}

export function PinManagement() {
    const { currentSchool } = useSchool();
    return (
        <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(249, 115, 22, 0.2)', background: 'rgba(249, 115, 22, 0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f97316', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                    🔐
                </div>
                <h3 style={{ fontWeight: 700 }}>PIN Management</h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Generate 4-digit login PINs for all students who don't have one yet. Existing PINs will not be changed.
            </p>
            <button
                className="btn"
                onClick={async () => {
                    if (!currentSchool?.id) return;
                    if (confirm('Generate PINs for all students without one? This will NOT change existing PINs.')) {
                        try {
                            const { db } = await import('../../lib/firebase');
                            const { collection, getDocs, updateDoc, doc, query, where } = await import('firebase/firestore');

                            const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();
                            const studentsRef = collection(db, 'students');
                            const q = query(studentsRef, where('schoolId', '==', currentSchool.id));
                            const snapshot = await getDocs(q);

                            let updatedCount = 0;

                            for (const studentDoc of snapshot.docs) {
                                const studentData = studentDoc.data();

                                if (!studentData.pin) {
                                    const newPin = generatePin();
                                    await updateDoc(doc(db, 'students', studentDoc.id), {
                                        pin: newPin,
                                        updatedAt: new Date().toISOString()
                                    });
                                    updatedCount++;
                                }
                            }

                            alert(`✅ Success! Generated PINs for ${updatedCount} students.`);
                        } catch (e) {
                            alert('Failed to generate PINs: ' + (e as Error).message);
                        }
                    }
                }}
                style={{
                    width: '100%',
                    background: 'white',
                    border: '1px solid #f97316',
                    color: '#f97316',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                }}
            >
                🔐 Generate Missing PINs
            </button>
        </div>
    );
}

export function AdmissionNoSync() {
    const { currentSchool } = useSchool();
    return (
        <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(99, 102, 241, 0.2)', background: 'rgba(99, 102, 241, 0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Database size={20} />
                </div>
                <h3 style={{ fontWeight: 700 }}>Admission Number Sync</h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Populate missing admission numbers with standardized MIL-sequence (starting MIL1551).
            </p>
            <button
                className="btn"
                onClick={async () => {
                    if (!currentSchool?.id) return;
                    if (confirm('Standardize admission numbers for all students? Existing MIL-numbers will be preserved.')) {
                        try {
                            const { db } = await import('../../lib/firebase');
                            const { collection, getDocs, updateDoc, doc, query, where } = await import('firebase/firestore');

                            const studentsRef = collection(db, 'students');
                            const q = query(studentsRef, where('schoolId', '==', currentSchool.id));
                            const snapshot = await getDocs(q);
                            const students = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

                            // 1. Find the current highest MIL number
                            const milStudents = students.filter((s: any) => s.admissionNo?.startsWith('MIL'));
                            const numbers = milStudents
                                .map((s: any) => parseInt(s.admissionNo.replace('MIL', '')))
                                .filter((n: any) => !isNaN(n));

                            let maxMil = numbers.length > 0 ? Math.max(...numbers) : 1550;
                            let updatedCount = 0;

                            // 2. Sort remaining students (maybe by admissionDate or name) to have a consistency
                            const studentsToUpdate = students.filter((s: any) => !s.admissionNo?.startsWith('MIL'));

                            for (const student of studentsToUpdate) {
                                maxMil++;
                                const newAdmNo = `MIL${maxMil}`;
                                await updateDoc(doc(db, 'students', (student as any).id), {
                                    admissionNo: newAdmNo,
                                    updatedAt: new Date().toISOString()
                                });
                                updatedCount++;
                            }

                            alert(`✅ Success! Standardized admission numbers for ${updatedCount} students.`);
                        } catch (e) {
                            alert('Failed to sync admission numbers: ' + (e as Error).message);
                        }
                    }
                }}
                style={{
                    width: '100%',
                    background: 'white',
                    border: '1px solid var(--primary)',
                    color: 'var(--primary)',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                }}
            >
                🔢 Sync Admission Numbers
            </button>
        </div>
    );
}

export function ClassMaster() {
    const { currentSchool } = useSchool();
    const { data: allSettings, loading } = useFirestore<any>('settings');
    const { data: academicYears } = useFirestore<any>('academic_years');
    const [isSaving, setIsSaving] = useState<string | null>(null);

    const activeFY = currentSchool?.activeFinancialYear || '';
    const schoolYears = (academicYears || [])
        .filter((y: any) => y.schoolId === currentSchool?.id && !y.isArchived)
        .map((y: any) => y.name)
        .sort();
    const [selectedSession, setSelectedSession] = useState(activeFY);

    // Sync selectedSession when activeFY loads
    useEffect(() => {
        if (activeFY && !selectedSession) {
            setSelectedSession(activeFY);
        }
    }, [activeFY]);

    const PRESET_CLASSES = CLASS_ORDER;
    const PRESET_SECTIONS = ['A', 'B', 'C', 'D'];

    // Get class settings for the selected session
    const allClassSettings = allSettings?.filter((d: any) => d.type === 'class') || [];
    const classSettings = allClassSettings.filter((c: any) => c.financialYear === selectedSession);

    // Check if there are any untagged (legacy) class settings
    const untaggedClasses = allClassSettings.filter((c: any) => !c.financialYear);

    // Helper to generate doc ID for a class in a specific session
    const getDocId = (className: string, fy: string) => {
        const classKey = className.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const fyKey = fy.replace(/[^a-z0-9]/g, '_');
        return `class_${classKey}_${currentSchool?.id}_${fyKey}`;
    };

    // Legacy doc ID (without financial year)
    const getLegacyDocId = (className: string) => {
        return `class_${className.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${currentSchool?.id}`;
    };

    const toggleClass = async (className: string) => {
        if (!currentSchool?.id || !selectedSession) return;
        const docId = getDocId(className, selectedSession);
        const existingClass = classSettings.find((c: any) => c.name === className);

        setIsSaving(`toggle-${className}`);
        try {
            if (existingClass) {
                await updateDoc(doc(db, 'settings', docId), {
                    active: !existingClass.active,
                    updatedAt: new Date().toISOString()
                });
            } else {
                await setDoc(doc(db, 'settings', docId), {
                    name: className,
                    sections: [],
                    active: true,
                    type: 'class',
                    schoolId: currentSchool.id,
                    financialYear: selectedSession,
                    createdAt: new Date().toISOString()
                });
            }
        } catch (err) {
            alert('Failed to toggle class: ' + (err as Error).message);
        } finally {
            setIsSaving(null);
        }
    };

    const toggleSection = async (className: string, section: string) => {
        if (!currentSchool?.id || !selectedSession) return;
        const docId = getDocId(className, selectedSession);
        const existingClass = classSettings.find((c: any) => c.name === className);

        if (!existingClass?.active) {
            alert('Please activate the class first before adding sections.');
            return;
        }

        setIsSaving(`${className}-${section}`);
        try {
            let updatedSections = [...(existingClass.sections || [])];
            if (updatedSections.includes(section)) {
                updatedSections = updatedSections.filter(s => s !== section);
            } else {
                updatedSections.push(section);
            }

            await updateDoc(doc(db, 'settings', docId), {
                sections: updatedSections.sort(),
                updatedAt: new Date().toISOString()
            });
        } catch (err) {
            alert('Failed to update section: ' + (err as Error).message);
        } finally {
            setIsSaving(null);
        }
    };

    // Migrate untagged classes to a specific session
    const handleMigrateUntagged = async (targetSession: string) => {
        if (!currentSchool?.id || untaggedClasses.length === 0) return;

        const confirmMsg = `This will tag ${untaggedClasses.length} existing class settings to session "${targetSession}". Continue?`;
        if (!window.confirm(confirmMsg)) return;

        setIsSaving('migrating');
        try {
            const batch = writeBatch(db);
            for (const cls of untaggedClasses) {
                const newDocId = getDocId(cls.name, targetSession);
                batch.set(doc(db, 'settings', newDocId), {
                    name: cls.name,
                    sections: cls.sections || [],
                    active: cls.active !== false,
                    type: 'class',
                    schoolId: currentSchool.id,
                    financialYear: targetSession,
                    createdAt: new Date().toISOString()
                });
                // Delete old untagged doc
                const legacyId = getLegacyDocId(cls.name);
                batch.delete(doc(db, 'settings', legacyId));
            }
            await batch.commit();
            alert(`✅ Successfully migrated ${untaggedClasses.length} classes to session ${targetSession}`);
        } catch (err) {
            alert('Migration failed: ' + (err as Error).message);
        } finally {
            setIsSaving(null);
        }
    };

    // Copy class-section config from one session to another
    const handleCopyFromPreviousYear = async () => {
        if (!currentSchool?.id) return;

        const otherYears = schoolYears.filter((y: string) => y !== selectedSession);
        if (otherYears.length === 0) {
            alert('No other academic years found to copy from.');
            return;
        }

        const sourceYear = window.prompt(
            `Enter the session to copy FROM (available: ${otherYears.join(', ')}):`,
            otherYears[otherYears.length - 1]
        );
        if (!sourceYear || !otherYears.includes(sourceYear)) {
            if (sourceYear) alert('Invalid session. Please enter one of: ' + otherYears.join(', '));
            return;
        }

        const sourceClasses = allClassSettings.filter((c: any) => c.financialYear === sourceYear);
        if (sourceClasses.length === 0) {
            alert(`No class settings found for session ${sourceYear}.`);
            return;
        }

        if (classSettings.length > 0) {
            if (!window.confirm(`Session ${selectedSession} already has ${classSettings.length} class configs. Copying will OVERWRITE existing settings. Continue?`)) return;
        }

        setIsSaving('copying');
        try {
            const batch = writeBatch(db);

            for (const cls of classSettings) {
                const docId = getDocId(cls.name, selectedSession);
                batch.delete(doc(db, 'settings', docId));
            }

            for (const cls of sourceClasses) {
                const newDocId = getDocId(cls.name, selectedSession);
                batch.set(doc(db, 'settings', newDocId), {
                    name: cls.name,
                    sections: cls.sections || [],
                    active: cls.active !== false,
                    type: 'class',
                    schoolId: currentSchool.id,
                    financialYear: selectedSession,
                    createdAt: new Date().toISOString()
                });
            }

            await batch.commit();
            alert(`✅ Successfully copied ${sourceClasses.length} class configs from ${sourceYear} to ${selectedSession}`);
        } catch (err) {
            alert('Copy failed: ' + (err as Error).message);
        } finally {
            setIsSaving(null);
        }
    };

    return (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={20} />
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <h3 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Class & Section Master</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                        Enable classes your school offers and add sections as needed — per session
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        className="input-field"
                        style={{ padding: '0.5rem', width: 'auto', background: 'white', fontWeight: 700, border: '2px solid var(--primary)' }}
                        value={selectedSession}
                        onChange={(e) => setSelectedSession(e.target.value)}
                    >
                        {schoolYears.map((s: string) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>

                    <button
                        onClick={handleCopyFromPreviousYear}
                        disabled={loading || !!isSaving}
                        style={{
                            padding: '0.5rem 1rem',
                            background: '#f59e0b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            opacity: isSaving === 'copying' ? 0.5 : 1
                        }}
                    >
                        <Copy size={14} />
                        {isSaving === 'copying' ? 'Copying...' : 'Copy from Previous Year'}
                    </button>

                    <button
                        onClick={async () => {
                            if (!currentSchool?.id) return;
                            setIsSaving('toggle-roman');
                            try {
                                await updateDoc(doc(db, 'schools', currentSchool.id), {
                                    useRomanNumerals: !currentSchool.useRomanNumerals,
                                    updatedAt: new Date().toISOString()
                                });
                            } catch (err) {
                                alert('Failed to toggle Roman numerals: ' + (err as Error).message);
                            } finally {
                                setIsSaving(null);
                            }
                        }}
                        style={{
                            padding: '0.5rem 1rem',
                            background: currentSchool?.useRomanNumerals ? '#6366f1' : 'white',
                            color: currentSchool?.useRomanNumerals ? 'white' : '#6366f1',
                            border: '1px solid #6366f1',
                            borderRadius: '0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        {isSaving === 'toggle-roman' ? <Loader2 size={14} className="animate-spin" /> : (currentSchool?.useRomanNumerals ? 'Disable Roman Numerals' : 'Enable Roman Numerals (STD I, II...)')}
                    </button>

                    <button
                        onClick={async () => {
                            if (!confirm(`Enable ALL classes for session ${selectedSession}? This will activate every class from Pre-Nursery to Class 12.`)) return;
                            setIsSaving('enable-all');
                            try {
                                if (!currentSchool?.id) return;
                                const batch = writeBatch(db);
                                for (const className of PRESET_CLASSES) {
                                    const docId = getDocId(className, selectedSession);
                                    batch.set(doc(db, 'settings', docId), {
                                        name: className,
                                        sections: [],
                                        active: true,
                                        type: 'class',
                                        schoolId: currentSchool.id,
                                        financialYear: selectedSession,
                                        updatedAt: new Date().toISOString()
                                    }, { merge: true });
                                }
                                await batch.commit();
                                alert('✅ All classes enabled successfully!');
                            } catch (err) {
                                alert('Failed to enable classes: ' + (err as Error).message);
                            } finally {
                                setIsSaving(null);
                            }
                        }}
                        disabled={loading || !!isSaving}
                        style={{
                            padding: '0.5rem 1rem',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            opacity: isSaving === 'enable-all' ? 0.5 : 1
                        }}
                    >
                        {isSaving === 'enable-all' ? 'Enabling...' : 'Enable All Classes'}
                    </button>
                </div>
            </div>

            {/* Migration banner for untagged classes */}
            {untaggedClasses.length > 0 && (
                <div style={{
                    background: '#fef3c7',
                    border: '1px solid #f59e0b',
                    borderRadius: '12px',
                    padding: '1rem 1.5rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap'
                }}>
                    <div>
                        <p style={{ fontWeight: 700, color: '#92400e', margin: 0, fontSize: '0.9rem' }}>
                            ⚠️ {untaggedClasses.length} class settings found without session tag
                        </p>
                        <p style={{ fontSize: '0.75rem', color: '#a16207', margin: '0.25rem 0 0' }}>
                            These are from before session-aware management. Tag them to a session to continue.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {schoolYears.map((yr: string) => (
                            <button
                                key={yr}
                                onClick={() => handleMigrateUntagged(yr)}
                                disabled={!!isSaving}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: '#f59e0b',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    opacity: isSaving === 'migrating' ? 0.5 : 1
                                }}
                            >
                                {isSaving === 'migrating' ? 'Migrating...' : `Tag as ${yr}`}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {PRESET_CLASSES.map(clsName => {
                    const classData = classSettings.find((c: any) => c.name === clsName);
                    const isClassActive = !!classData && classData.active !== false;
                    const isToggling = isSaving === `toggle-${clsName}`;

                    return (
                        <div key={clsName} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            padding: '1rem',
                            background: isClassActive ? 'rgba(99, 102, 241, 0.05)' : '#f8fafc',
                            borderRadius: '12px',
                            border: '1px solid',
                            borderColor: isClassActive ? 'rgba(99, 102, 241, 0.2)' : '#e2e8f0',
                            transition: 'all 0.2s ease',
                            opacity: isClassActive ? 1 : 0.6
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '200px' }}>
                                <button
                                    onClick={() => toggleClass(clsName)}
                                    disabled={loading || !!isSaving}
                                    style={{
                                        width: '48px',
                                        height: '26px',
                                        borderRadius: '13px',
                                        border: 'none',
                                        background: isClassActive ? '#10b981' : '#cbd5e1',
                                        position: 'relative',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        opacity: isToggling ? 0.5 : 1
                                    }}
                                    title={isClassActive ? 'Click to disable' : 'Click to enable'}
                                >
                                    <div style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        background: 'white',
                                        position: 'absolute',
                                        top: '3px',
                                        left: isClassActive ? '25px' : '3px',
                                        transition: 'all 0.3s ease',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                    }} />
                                </button>
                                <span style={{
                                    fontWeight: 700,
                                    fontSize: '0.95rem',
                                    color: isClassActive ? 'var(--primary)' : '#64748b'
                                }}>
                                    {formatClassName(clsName, currentSchool?.useRomanNumerals)}
                                </span>
                            </div>

                            {isClassActive ? (
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '0.25rem' }}>
                                        Sections:
                                    </span>
                                    {PRESET_SECTIONS.map(sec => {
                                        const isSectionActive = classData?.sections?.includes(sec);
                                        const savingKey = `${clsName}-${sec}`;
                                        const processing = isSaving === savingKey;

                                        return (
                                            <button
                                                key={sec}
                                                disabled={loading || !!isSaving}
                                                onClick={() => toggleSection(clsName, sec)}
                                                style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: isSectionActive ? 'var(--primary)' : 'white',
                                                    color: isSectionActive ? 'white' : 'var(--text-muted)',
                                                    border: isSectionActive ? 'none' : '1px solid var(--border)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.875rem',
                                                    fontWeight: 800,
                                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    boxShadow: isSectionActive ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none',
                                                    position: 'relative'
                                                }}
                                                className={isSectionActive ? 'hover-glow' : 'hover-lift'}
                                            >
                                                {processing ? <Loader2 size={14} className="animate-spin" /> : sec}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    Enable class to add sections
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div >
    );
}


export function InstitutionInfo() {
    const { currentSchool, updateSchoolData } = useSchool();
    const [info, setInfo] = useState({
        name: '',
        fullName: '',
        email: '',
        address: '',
        phone: '',
        website: '',
        contactPerson: '',
        contactNumber: '',
        logoUrl: '',
        customTitle: '',
        admissionNumberPrefix: '',
        admissionNumberStartNumber: '',
        academicYearStartMonth: 'April',
        receiptHeaderUrl: '',
        showExamVenue: true,
        udiseCode: '',
        schoolCode: '',
        runAndManagedBy: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string>('');
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [headerFile, setHeaderFile] = useState<File | null>(null);
    const [headerPreview, setHeaderPreview] = useState<string>('');
    const [headerUploadProgress, setHeaderUploadProgress] = useState<number>(0);
    const [receiptFields, setReceiptFields] = useState({
        showLogo: true,
        showSchoolName: true,
        showAddress: true,
        showPhone: true,
        showEmail: false,
        showWebsite: true
    });
    const [headerImageHeight, setHeaderImageHeight] = useState(120);
    const [schoolNameFontSize, setSchoolNameFontSize] = useState(18);
    const [receiptHeaderMode, setReceiptHeaderMode] = useState<'image' | 'text'>('text');

    const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                alert('Please select a valid image file (PNG, JPG, SVG, or WebP)');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                alert('Header image must be less than 5MB');
                return;
            }
            setHeaderFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setHeaderPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                alert('Please select a valid image file (PNG, JPG, SVG, or WebP)');
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                alert('Logo file size must be less than 2MB');
                return;
            }
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Load school data from currentSchool context
    useEffect(() => {
        if (currentSchool) {
            setInfo({
                name: currentSchool.name || '',
                fullName: currentSchool.fullName || currentSchool.name || '',
                email: currentSchool.email || '',
                address: currentSchool.address || '',
                phone: currentSchool.phone || '',
                website: currentSchool.website || '',
                contactPerson: currentSchool.contactPerson || '',
                contactNumber: currentSchool.contactNumber || '',
                logoUrl: currentSchool.logoUrl || currentSchool.logo || '',
                customTitle: currentSchool.customTitle || '',
                admissionNumberPrefix: currentSchool.admissionNumberPrefix || '',
                admissionNumberStartNumber: currentSchool.admissionNumberStartNumber || '',
                academicYearStartMonth: currentSchool.academicYearStartMonth || 'April',
                receiptHeaderUrl: currentSchool.receiptHeaderUrl || '',
                showExamVenue: currentSchool.showExamVenue !== false,
                udiseCode: (currentSchool as any).udiseCode || '',
                schoolCode: (currentSchool as any).schoolCode || '',
                runAndManagedBy: (currentSchool as any).runAndManagedBy || ''
            });
            setLogoPreview(currentSchool.logoUrl || currentSchool.logo || '');
            setHeaderPreview(currentSchool.receiptHeaderUrl || '');
            if (currentSchool.receiptHeaderFields) {
                setReceiptFields(prev => ({ ...prev, ...currentSchool.receiptHeaderFields }));
            }
            setHeaderImageHeight(currentSchool.receiptHeaderImageHeight || 120);
            setSchoolNameFontSize(currentSchool.receiptSchoolNameFontSize || 18);
            setReceiptHeaderMode(currentSchool.receiptHeaderMode || (currentSchool.receiptHeaderUrl ? 'image' : 'text'));
            setLoading(false);
        }
    }, [currentSchool]);

    // Helper to compress image and get base64
    const compressImage = (file: File, maxWidth: number = 800): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7)); // 70% quality JPEG
                };
            };
        });
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentSchool?.id) return;
        setIsSaving(true);
        try {
            let finalLogoUrl = info.logoUrl;
            let finalLogoBase64 = currentSchool.logoBase64 || '';
            let finalHeaderBase64 = currentSchool.receiptHeaderBase64 || '';

            // Upload logo file if one was selected
            if (logoFile) {
                const fileExtension = logoFile.name.split('.').pop();
                const storagePath = `schools/${currentSchool.id}/logo.${fileExtension}`;
                const storageRef = ref(storage, storagePath);

                const uploadTask = uploadBytesResumable(storageRef, logoFile);

                await new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Upload timeout - please check Firebase Storage rules'));
                    }, 30000);

                    uploadTask.on(
                        'state_changed',
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            setUploadProgress(progress);
                        },
                        (error) => {
                            clearTimeout(timeout);
                            reject(new Error(`Upload failed: ${error.message}`));
                        },
                        async () => {
                            clearTimeout(timeout);
                            try {
                                finalLogoUrl = await getDownloadURL(uploadTask.snapshot.ref);
                                resolve();
                            } catch (error) {
                                reject(error);
                            }
                        }
                    );
                });

                finalLogoBase64 = await compressImage(logoFile, 200); // Small for logo
                setLogoFile(null);
            }

            // Upload receipt header image if one was selected
            let finalHeaderUrl = info.receiptHeaderUrl;
            if (headerFile) {
                const fileExtension = headerFile.name.split('.').pop();
                const storagePath = `schools/${currentSchool.id}/receipt-header.${fileExtension}`;
                const storageRef2 = ref(storage, storagePath);

                const uploadTask2 = uploadBytesResumable(storageRef2, headerFile);

                await new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Header upload timeout - please check Firebase Storage rules'));
                    }, 30000);

                    uploadTask2.on(
                        'state_changed',
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            setHeaderUploadProgress(progress);
                        },
                        (error) => {
                            clearTimeout(timeout);
                            reject(new Error(`Header upload failed: ${error.message}`));
                        },
                        async () => {
                            clearTimeout(timeout);
                            try {
                                finalHeaderUrl = await getDownloadURL(uploadTask2.snapshot.ref);
                                resolve();
                            } catch (error) {
                                reject(error);
                            }
                        }
                    );
                });

                finalHeaderBase64 = await compressImage(headerFile, 1000); // Larger for header
                setHeaderFile(null);
            }

            // 1. Update the school document in schools collection
            await updateDoc(doc(db, 'schools', currentSchool.id), {
                name: info.name,
                fullName: info.fullName,
                email: info.email,
                address: info.address,
                phone: info.phone,
                website: info.website,
                contactPerson: info.contactPerson,
                contactNumber: info.contactNumber,
                logoUrl: finalLogoUrl,
                logoBase64: finalLogoBase64,
                receiptHeaderUrl: finalHeaderUrl,
                receiptHeaderBase64: finalHeaderBase64,
                receiptHeaderMode: receiptHeaderMode,
                receiptHeaderImageHeight: headerImageHeight,
                receiptSchoolNameFontSize: schoolNameFontSize,
                receiptHeaderFields: receiptFields,
                customTitle: info.customTitle,
                admissionNumberPrefix: info.admissionNumberPrefix,
                admissionNumberStartNumber: info.admissionNumberStartNumber,
                academicYearStartMonth: info.academicYearStartMonth,
                showExamVenue: info.showExamVenue,
                udiseCode: info.udiseCode,
                schoolCode: info.schoolCode,
                runAndManagedBy: info.runAndManagedBy,
                updatedAt: new Date().toISOString()
            });

            // 2. Also update/sync the school_info document in settings collection for legacy component compatibility
            const settingsRef = doc(db, 'settings', `school_info_${currentSchool.id}`);
            await setDoc(settingsRef, {
                name: info.name,
                fullName: info.fullName,
                email: info.email,
                address: info.address,
                phone: info.phone,
                website: info.website,
                web: info.website,
                logo: finalLogoUrl,
                logoUrl: finalLogoUrl,
                logoBase64: finalLogoBase64,
                receiptHeaderUrl: finalHeaderUrl,
                receiptHeaderBase64: finalHeaderBase64,
                receiptHeaderMode: receiptHeaderMode,
                receiptHeaderImageHeight: headerImageHeight,
                receiptSchoolNameFontSize: schoolNameFontSize,
                receiptHeaderFields: receiptFields,
                admissionNumberPrefix: info.admissionNumberPrefix,
                admissionNumberStartNumber: info.admissionNumberStartNumber,
                udiseCode: info.udiseCode,
                schoolCode: info.schoolCode,
                runAndManagedBy: info.runAndManagedBy,
                type: 'school_info',
                schoolId: currentSchool.id,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            // Update local state with the final URL
            setInfo(prev => ({ ...prev, logoUrl: finalLogoUrl, receiptHeaderUrl: finalHeaderUrl }));
            setLogoPreview(finalLogoUrl);
            setHeaderPreview(finalHeaderUrl);

            // Sync context so other pages (like FeeReceipt) get updated data immediately
            if (updateSchoolData) {
                await updateSchoolData({
                    name: info.name,
                    fullName: info.fullName,
                    email: info.email,
                    address: info.address,
                    phone: info.phone,
                    website: info.website,
                    contactPerson: info.contactPerson,
                    contactNumber: info.contactNumber,
                    logoUrl: finalLogoUrl,
                    logoBase64: finalLogoBase64,
                    receiptHeaderUrl: finalHeaderUrl,
                    receiptHeaderBase64: finalHeaderBase64,
                    receiptHeaderMode: receiptHeaderMode,
                    receiptHeaderImageHeight: headerImageHeight,
                    receiptSchoolNameFontSize: schoolNameFontSize,
                    receiptHeaderFields: receiptFields,
                    customTitle: info.customTitle,
                    admissionNumberPrefix: info.admissionNumberPrefix,
                    admissionNumberStartNumber: info.admissionNumberStartNumber,
                    academicYearStartMonth: info.academicYearStartMonth,
                    showExamVenue: info.showExamVenue,
                    udiseCode: info.udiseCode,
                    schoolCode: info.schoolCode,
                    runAndManagedBy: info.runAndManagedBy
                } as any);
            }

            alert('✅ Institution information updated successfully!');
        } catch (err) {
            alert('Failed to update: ' + (err as Error).message);
        } finally {
            setIsSaving(false);
            setUploadProgress(0);
            setHeaderUploadProgress(0);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontWeight: 700, marginBottom: '1.5rem' }}>Institution Information</h3>
                <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="grid-2" style={{ gap: '1rem' }}>
                        <div className="input-group">
                            <label>School Name (Short)</label>
                            <input
                                type="text"
                                className="input-field"
                                value={info.name}
                                onChange={e => setInfo({ ...info, name: e.target.value })}
                                onBlur={e => setInfo({ ...info, name: toProperCase(e.target.value) })}
                                placeholder=""
                            />
                        </div>
                        <div className="input-group">
                            <label>Full School Name</label>
                            <input
                                type="text"
                                className="input-field"
                                value={info.fullName}
                                onChange={e => setInfo({ ...info, fullName: e.target.value })}
                                onBlur={e => setInfo({ ...info, fullName: toProperCase(e.target.value) })}
                                placeholder="e.g., Paramount Public High School"
                            />
                        </div>
                    </div>
                    <div className="input-group">
                        <label>Custom Browser Title</label>
                        <input
                            type="text"
                            className="input-field"
                            value={info.customTitle}
                            onChange={e => setInfo({ ...info, customTitle: e.target.value })}
                            onBlur={e => setInfo({ ...info, customTitle: toProperCase(e.target.value) })}
                            placeholder="e.g., Paramount Public High School - School Management"
                        />
                        <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            This will be shown in the browser tab title
                        </small>
                    </div>
                    <div className="input-group">
                        <label>Academic Year Start Month</label>
                        <select
                            className="input-field"
                            value={info.academicYearStartMonth}
                            onChange={e => setInfo({ ...info, academicYearStartMonth: e.target.value })}
                        >
                            <option value="January">January (Jan - Dec)</option>
                            <option value="February">February (Feb - Jan)</option>
                            <option value="March">March (Mar - Feb)</option>
                            <option value="April">April (Apr - Mar)</option>
                            <option value="May">May (May - Apr)</option>
                            <option value="June">June (Jun - May)</option>
                            <option value="July">July (Jul - Jun)</option>
                            <option value="August">August (Aug - Jul)</option>
                            <option value="September">September (Sep - Aug)</option>
                            <option value="October">October (Oct - Sep)</option>
                            <option value="November">November (Nov - Oct)</option>
                            <option value="December">December (Dec - Nov)</option>
                        </select>
                        <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            This determines the months shown in fee collection (e.g., if March is selected, months will show March to February)
                        </small>
                    </div>

                    {/* UDISE Code, School Code, Run and Managed By */}
                    <div className="grid-2" style={{ gap: '1rem' }}>
                        <div className="input-group">
                            <label>UDISE Code</label>
                            <input
                                type="text"
                                className="input-field"
                                value={info.udiseCode}
                                onChange={e => setInfo({ ...info, udiseCode: e.target.value })}
                                placeholder="e.g., 09140100301"
                            />
                        </div>
                        <div className="input-group">
                            <label>School Code</label>
                            <input
                                type="text"
                                className="input-field"
                                value={info.schoolCode}
                                onChange={e => setInfo({ ...info, schoolCode: e.target.value })}
                                placeholder="e.g., 12345"
                            />
                        </div>
                    </div>
                    <div className="input-group">
                        <label>Run and Managed By</label>
                        <input
                            type="text"
                            className="input-field"
                            value={info.runAndManagedBy}
                            onChange={e => setInfo({ ...info, runAndManagedBy: e.target.value })}
                            onBlur={e => setInfo({ ...info, runAndManagedBy: toProperCase(e.target.value) })}
                            placeholder="e.g., Private Unaided (Recognised)"
                        />
                    </div>

                    {/* NEW: Exam Configuration Settings */}
                    <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <BookOpen size={18} /> Exam Settings
                        </h4>

                        <div className="input-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={info.showExamVenue}
                                    onChange={e => setInfo({ ...info, showExamVenue: e.target.checked })}
                                    style={{ width: '1.125rem', height: '1.125rem', accentColor: 'var(--primary)' }}
                                />
                                <span style={{ fontWeight: 600 }}>Enable 'Venue' (Room Number) in Schedule</span>
                            </label>
                            <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '1.75rem' }}>
                                If disabled, the room/venue option will be hidden from the exam schedule entry form.
                            </small>
                        </div>
                    </div>
                    <div className="grid-2" style={{ gap: '1rem' }}>
                        <div className="input-group">
                            <label>Prefix for Admission Number</label>
                            <input
                                type="text"
                                className="input-field"
                                value={info.admissionNumberPrefix}
                                onChange={e => setInfo({ ...info, admissionNumberPrefix: e.target.value.toUpperCase() })}
                                placeholder=""
                                maxLength={10}
                            />
                            <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Will be used for auto-generating admission numbers
                            </small>
                        </div>
                        <div className="input-group">
                            <label>Start Number From</label>
                            <input
                                type="text"
                                className="input-field"
                                value={info.admissionNumberStartNumber}
                                onChange={e => setInfo({ ...info, admissionNumberStartNumber: e.target.value.replace(/\D/g, '') })}
                                placeholder=""
                                maxLength={6}
                            />

                        </div>
                    </div>
                    <div className="grid-2" style={{ gap: '1rem' }}>
                        <div className="input-group">
                            <label>Email Address</label>
                            <input
                                type="email"
                                className="input-field"
                                value={info.email}
                                onChange={e => setInfo({ ...info, email: e.target.value })}
                            />
                        </div>
                        <div className="input-group">
                            <label>Phone Number/Landline</label>
                            <input
                                type="text"
                                className="input-field"
                                value={info.phone}
                                onChange={e => setInfo({ ...info, phone: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="grid-2" style={{ gap: '1rem' }}>
                        <div className="input-group">
                            <label>Contact Person</label>
                            <input
                                type="text"
                                className="input-field"
                                value={info.contactPerson}
                                onChange={e => setInfo({ ...info, contactPerson: e.target.value })}
                                onBlur={e => setInfo({ ...info, contactPerson: toProperCase(e.target.value) })}
                            />
                        </div>
                        <div className="input-group">
                            <label>Contact/Mobile Number (for Login)</label>
                            <input
                                type="text"
                                className="input-field"
                                value={info.contactNumber}
                                onChange={e => setInfo({ ...info, contactNumber: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="grid-2" style={{ gap: '1rem' }}>
                        <div className="input-group">
                            <label>Website</label>
                            <input
                                type="text"
                                className="input-field"
                                value={info.website}
                                onChange={e => setInfo({ ...info, website: e.target.value })}
                            />
                        </div>
                        <div className="input-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <ImageIcon size={16} /> School Logo
                            </label>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                {/* Logo Preview */}
                                <div style={{
                                    width: '100px',
                                    height: '100px',
                                    borderRadius: '12px',
                                    border: '2px dashed var(--border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'var(--bg-main)',
                                    overflow: 'hidden',
                                    flexShrink: 0
                                }}>
                                    {logoPreview ? (
                                        <img src={logoPreview} alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        <ImageIcon size={40} color="var(--text-muted)" style={{ opacity: 0.3 }} />
                                    )}
                                </div>
                                {/* Upload Controls */}
                                <div style={{ flex: 1 }}>
                                    <input
                                        type="file"
                                        id="institution-logo-upload"
                                        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                                        onChange={handleLogoChange}
                                        style={{ display: 'none' }}
                                    />
                                    <label
                                        htmlFor="institution-logo-upload"
                                        className="btn"
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            cursor: 'pointer',
                                            padding: '0.6rem 1rem',
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            background: 'white',
                                            fontWeight: 600,
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        <Upload size={16} />
                                        {logoPreview ? 'Change Logo' : 'Upload Logo'}
                                    </label>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem', marginBottom: '0.75rem' }}>
                                        PNG, JPG, SVG, WebP (max 2MB)
                                    </p>
                                    <div className="input-group" style={{ marginBottom: 0 }}>
                                        <label className="field-label" style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.7 }}>Or enter Logo URL manually:</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                                            value={info.logoUrl}
                                            onChange={e => {
                                                const url = e.target.value;
                                                setInfo({ ...info, logoUrl: url });
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
                                            <p style={{ fontSize: '0.65rem', color: 'var(--primary)', marginTop: '0.25rem' }}>
                                                Uploading: {Math.round(uploadProgress)}%
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="input-group">
                        <label>Address</label>
                        <textarea
                            className="input-field"
                            style={{ minHeight: '80px' }}
                            value={info.address}
                            onChange={e => setInfo({ ...info, address: e.target.value })}
                            onBlur={e => setInfo({ ...info, address: toProperCase(e.target.value) })}
                        />
                    </div>

                    {/* Receipt Header Image Section */}
                    <div style={{ background: 'rgba(99, 102, 241, 0.04)', border: '1px dashed rgba(99, 102, 241, 0.3)', borderRadius: '12px', padding: '1.25rem', marginTop: '0.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary)' }}>
                            <ImageIcon size={18} /> Fee Receipt Header Image (Optional)
                        </label>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
                            Upload a complete header image (letterhead) for fee receipts. This image will replace the text-based header (school name, address, phone, website).
                            <strong> If no image is uploaded, the receipt will use text from Institution Info fields above.</strong>
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                            {/* Header Preview */}
                            <div style={{
                                width: '200px',
                                minHeight: '70px',
                                borderRadius: '8px',
                                border: '2px dashed var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'white',
                                overflow: 'hidden',
                                flexShrink: 0
                            }}>
                                {headerPreview ? (
                                    <img src={headerPreview} alt="Header preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                ) : (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem' }}>No header image<br />Text header will be used</span>
                                )}
                            </div>
                            {/* Upload Controls */}
                            <div style={{ flex: 1 }}>
                                <input
                                    type="file"
                                    id="receipt-header-upload"
                                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                                    onChange={handleHeaderChange}
                                    style={{ display: 'none' }}
                                />
                                <label
                                    htmlFor="receipt-header-upload"
                                    className="btn"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        cursor: 'pointer',
                                        padding: '0.6rem 1rem',
                                        border: '1px solid var(--primary)',
                                        borderRadius: '8px',
                                        background: 'white',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        color: 'var(--primary)'
                                    }}
                                >
                                    <Upload size={16} />
                                    {headerPreview ? 'Change Header Image' : 'Upload Header Image'}
                                </label>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem', marginBottom: '0.75rem' }}>
                                    PNG, JPG, SVG, WebP (max 5MB). Recommended: wide landscape format.
                                </p>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label className="field-label" style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.7 }}>Or enter Header Image URL:</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                                        value={info.receiptHeaderUrl}
                                        onChange={e => {
                                            const url = e.target.value;
                                            setInfo({ ...info, receiptHeaderUrl: url });
                                            if (!headerFile) setHeaderPreview(url);
                                        }}
                                        placeholder="https://example.com/header.png"
                                    />
                                </div>
                                {headerPreview && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setHeaderPreview('');
                                            setHeaderFile(null);
                                            setInfo({ ...info, receiptHeaderUrl: '' });
                                        }}
                                        style={{
                                            marginTop: '0.5rem',
                                            padding: '0.3rem 0.75rem',
                                            fontSize: '0.75rem',
                                            background: '#fee2e2',
                                            color: '#dc2626',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 600
                                        }}
                                    >
                                        ✕ Remove Header Image (Use Text Instead)
                                    </button>
                                )}
                                {/* Upload Progress Bar */}
                                {headerUploadProgress > 0 && headerUploadProgress < 100 && (
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <div style={{
                                            width: '100%',
                                            height: '6px',
                                            background: 'var(--bg-main)',
                                            borderRadius: '100px',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                width: `${headerUploadProgress}%`,
                                                height: '100%',
                                                background: 'var(--primary)',
                                                transition: 'width 0.3s ease'
                                            }} />
                                        </div>
                                        <p style={{ fontSize: '0.65rem', color: 'var(--primary)', marginTop: '0.25rem' }}>
                                            Uploading: {Math.round(headerUploadProgress)}%
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Header Image Size Control */}
                        {headerPreview && (
                            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'white', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                    <span>Image Height on Receipt</span>
                                    <span style={{ color: 'var(--primary)' }}>{headerImageHeight}px</span>
                                </label>
                                <input
                                    type="range"
                                    min="60"
                                    max="200"
                                    step="5"
                                    value={headerImageHeight}
                                    onChange={e => setHeaderImageHeight(Number(e.target.value))}
                                    style={{ width: '100%', accentColor: 'var(--primary)' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                    <span>Small (60px)</span>
                                    <span>Large (200px)</span>
                                </div>
                            </div>
                        )}

                        {/* School Name Font Size Control */}
                        {receiptFields.showSchoolName && (
                            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'white', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                    <span>School Name Font Size</span>
                                    <span style={{ color: 'var(--primary)' }}>{schoolNameFontSize}px</span>
                                </label>
                                <input
                                    type="range"
                                    min="12"
                                    max="36"
                                    step="1"
                                    value={schoolNameFontSize}
                                    onChange={e => setSchoolNameFontSize(Number(e.target.value))}
                                    style={{ width: '100%', accentColor: 'var(--primary)' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                    <span>Small (12px)</span>
                                    <span>Extra Large (36px)</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Receipt Header Fields Checkboxes */}
                    <div style={{ background: 'rgba(34, 197, 94, 0.04)', border: '1px dashed rgba(34, 197, 94, 0.3)', borderRadius: '12px', padding: '1.25rem', marginTop: '0.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontWeight: 700, fontSize: '0.95rem', color: '#16a34a' }}>
                            <FileText size={18} /> Receipt Header: Show/Hide Fields
                        </label>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            Select which fields to display in the fee receipt header (used when no header image is set, or below the header image).
                        </p>

                        {/* Receipt Header Mode Toggle */}
                        {headerPreview && (
                            <div style={{
                                marginBottom: '1rem',
                                padding: '0.75rem',
                                background: 'white',
                                borderRadius: '10px',
                                border: `2px solid ${receiptHeaderMode === 'image' ? '#2563eb' : '#16a34a'}`,
                            }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', display: 'block', color: '#374151' }}>
                                    📋 Receipt Header Style
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => setReceiptHeaderMode('image')}
                                        style={{
                                            padding: '0.6rem 0.75rem',
                                            borderRadius: '8px',
                                            border: `2px solid ${receiptHeaderMode === 'image' ? '#2563eb' : '#e5e7eb'}`,
                                            background: receiptHeaderMode === 'image' ? 'rgba(37, 99, 235, 0.08)' : 'white',
                                            cursor: 'pointer',
                                            fontSize: '0.82rem',
                                            fontWeight: 700,
                                            color: receiptHeaderMode === 'image' ? '#2563eb' : '#6b7280',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem'
                                        }}
                                    >
                                        🖼️ Use Image Header
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setReceiptHeaderMode('text')}
                                        style={{
                                            padding: '0.6rem 0.75rem',
                                            borderRadius: '8px',
                                            border: `2px solid ${receiptHeaderMode === 'text' ? '#16a34a' : '#e5e7eb'}`,
                                            background: receiptHeaderMode === 'text' ? 'rgba(34, 197, 94, 0.08)' : 'white',
                                            cursor: 'pointer',
                                            fontSize: '0.82rem',
                                            fontWeight: 700,
                                            color: receiptHeaderMode === 'text' ? '#16a34a' : '#6b7280',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem'
                                        }}
                                    >
                                        📝 Use Text Header
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                                    {receiptHeaderMode === 'image'
                                        ? '✅ Receipt will show the uploaded header image as heading.'
                                        : '✅ Receipt will show school name, logo & address as text heading.'}
                                </p>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                            {[
                                { key: 'showLogo', label: 'School Logo' },
                                { key: 'showSchoolName', label: 'School Name' },
                                { key: 'showAddress', label: 'Address' },
                                { key: 'showPhone', label: 'Phone Number' },
                                { key: 'showEmail', label: 'Email' },
                                { key: 'showWebsite', label: 'Website' }
                            ].map(item => (
                                <label key={item.key} style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    padding: '0.6rem 0.75rem', borderRadius: '8px',
                                    border: `1px solid ${(receiptFields as any)[item.key] ? '#16a34a' : 'var(--border)'}`,
                                    background: (receiptFields as any)[item.key] ? 'rgba(34, 197, 94, 0.06)' : 'white',
                                    cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                                    transition: 'all 0.2s'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={(receiptFields as any)[item.key]}
                                        onChange={e => setReceiptFields({ ...receiptFields, [item.key]: e.target.checked })}
                                        style={{ accentColor: '#16a34a' }}
                                    />
                                    {item.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={isSaving || loading}>
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Update Institution Info
                    </button>
                </form>
            </div>
        </div>
    );
}

export function GeminiConfig() {
    const { currentSchool } = useSchool();
    const [geminiKey, setGeminiKey] = usePersistence<string>('aischool360_gemini_api_key', '');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchKey = async () => {
            if (!geminiKey && currentSchool?.id) {
                try {
                    const d = await getDoc(doc(db, 'settings', `gemini_${currentSchool.id}`));
                    if (d.exists()) {
                        setGeminiKey(d.data().apiKey);
                    }
                } catch (e) {
                    console.error("Gemini fetch error:", e);
                }
            }
        };
        fetchKey();
    }, [currentSchool?.id, geminiKey]);

    const handleSaveToCloud = async () => {
        if (!geminiKey || !currentSchool?.id) {
            alert('Please enter an API Key first.');
            return;
        }

        setIsSaving(true);
        try {
            await setDoc(doc(db, 'settings', `gemini_${currentSchool.id}`), {
                apiKey: geminiKey,
                schoolId: currentSchool.id,
                updatedAt: new Date().toISOString()
            });
            alert('✅ Gemini API Key synced to cloud! AI Assistant will now work on all devices.');
        } catch (err) {
            console.error("Gemini cloud sync error:", err);
            alert('Failed to sync to cloud: ' + (err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BrainCircuit size={20} />
                </div>
                <h3 style={{ fontWeight: 700 }}>AI Assistant Configuration</h3>
            </div>
            <div className="input-group">
                <label>Gemini API Key</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <input
                            type="password"
                            className="input-field"
                            placeholder="Paste your Gemini API Key here..."
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            style={{ paddingRight: '3rem' }}
                        />
                        <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: geminiKey ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                            {geminiKey ? 'ACTIVE' : 'MISSING'}
                        </div>
                    </div>
                    <button
                        onClick={handleSaveToCloud}
                        disabled={isSaving}
                        style={{
                            padding: '0.75rem 1rem',
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: 700,
                            opacity: isSaving ? 0.7 : 1
                        }}
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Sync to Mobile
                    </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    Required for AI intelligence. Get yours at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>Google AI Studio</a> then click <b>Sync to Mobile</b>.
                </p>
            </div>
        </div>
    );
};

// -- Class-wise Price Grid Component --
const ClassPriceGrid = ({
    classPrices,
    onChange,
    disabled,
    sortedClassNames,
    useRomanNumerals
}: {
    classPrices: Record<string, number>;
    onChange: (prices: Record<string, number>) => void;
    disabled?: boolean;
    sortedClassNames: string[];
    useRomanNumerals?: boolean;
}) => (
    <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '0.625rem',
        padding: '1rem',
        background: 'rgba(99, 102, 241, 0.03)',
        borderRadius: '12px',
        border: '1px solid rgba(99, 102, 241, 0.1)'
    }}>
        {sortedClassNames.map((cls: string) => (
            <div key={cls} style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
            }}>
                <label style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em'
                }}>
                    {formatClassName(cls, useRomanNumerals)}
                </label>
                <input
                    type="number"
                    className="input-field"
                    style={{
                        height: '2.25rem',
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        padding: '0 0.5rem',
                        textAlign: 'right'
                    }}
                    placeholder="0"
                    value={classPrices[cls] || ''}
                    onChange={e => onChange({ ...classPrices, [cls]: Number(e.target.value) })}
                    disabled={disabled}
                    min={0}
                />
            </div>
        ))}
    </div>
);

// -- Pricing Type Toggle Component --
const PricingTypeToggle = ({ value, onChange }: { value: 'fixed' | 'classwise'; onChange: (v: 'fixed' | 'classwise') => void }) => (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
        {[
            { id: 'fixed' as const, label: '💲 Fixed Price', desc: 'Same for all' },
            { id: 'classwise' as const, label: '📚 Class-wise', desc: 'Varies by class' }
        ].map(opt => (
            <button
                key={opt.id}
                type="button"
                onClick={() => onChange(opt.id)}
                style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: `2px solid ${value === opt.id ? (opt.id === 'fixed' ? '#10b981' : 'var(--primary)') : '#e2e8f0'}`,
                    background: value === opt.id
                        ? (opt.id === 'fixed' ? 'rgba(16, 185, 129, 0.06)' : 'rgba(99, 102, 241, 0.06)')
                        : 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease'
                }}
            >
                <div style={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: value === opt.id ? 'var(--text-main)' : 'var(--text-muted)'
                }}>{opt.label}</div>
                <div style={{
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                    marginTop: '2px'
                }}>{opt.desc}</div>
            </button>
        ))}
    </div>
);

export function InventoryMaster() {
    const { currentSchool } = useSchool();
    const { data: allSettings, loading } = useFirestore<any>('settings');
    const { data: academicYears } = useFirestore<any>('academic_years');
    const [isSaving, setIsSaving] = useState(false);
    const [isCopying, setIsCopying] = useState(false);
    const [expandedItem, setExpandedItem] = useState<string | null>(null);

    const activeFY = currentSchool?.activeFinancialYear || '';
    const schoolYears = (academicYears || []).filter((y: any) => y.schoolId === currentSchool?.id && !y.isArchived).map((y: any) => y.name).sort();
    const currentYearIndex = schoolYears.indexOf(activeFY);
    const nextFY = currentYearIndex >= 0 && currentYearIndex < schoolYears.length - 1 ? schoolYears[currentYearIndex + 1] : '';
    const previousFY = currentYearIndex > 0 ? schoolYears[currentYearIndex - 1] : '';

    // Add item form
    const [newItem, setNewItem] = useState({ name: '', price: 0, pricingType: 'fixed' as 'fixed' | 'classwise' });
    const [newClassPrices, setNewClassPrices] = useState<Record<string, number>>({});

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editPrice, setEditPrice] = useState<number>(0);
    const [editClassPrices, setEditClassPrices] = useState<Record<string, number>>({});
    const [editPricingType, setEditPricingType] = useState<'fixed' | 'classwise'>('fixed');

    // Classes from school configuration
    const activeClasses = (allSettings && allSettings.length > 0)
        ? getActiveClasses(allSettings.filter((d: any) => d.type === 'class' && d.schoolId === currentSchool?.id), activeFY)
        : [];
    const sortedClassNames = activeClasses.map((c: any) => c.name);

    // All inventory items for this school
    const allInventoryItems = allSettings?.filter((d: any) => d.type === 'inventory' && d.schoolId === currentSchool?.id) || [];
    // Untagged items (no financialYear field)
    const untaggedItems = allInventoryItems.filter((d: any) => !d.financialYear);
    // Items for active FY
    const items = allInventoryItems.filter((d: any) => d.financialYear === activeFY) || [];

    const getDisplayPrice = (item: any) => {
        if (item.pricingType === 'classwise' && item.classPrices) {
            const prices = Object.values(item.classPrices).filter((p: any) => p > 0) as number[];
            if (prices.length === 0) return '—';
            const minP = Math.min(...prices);
            const maxP = Math.max(...prices);
            if (minP === maxP) return `₹${minP}`;
            return `₹${minP} – ₹${maxP}`;
        }
        return `₹${item.price || 0}`;
    };

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItem.name || !currentSchool?.id) return;
        setIsSaving(true);
        try {
            const docId = `inv_${newItem.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${currentSchool.id}_${activeFY.replace(/[^a-z0-9]/gi, '')}`;
            const itemData: any = {
                name: newItem.name,
                schoolId: currentSchool.id,
                type: 'inventory',
                pricingType: newItem.pricingType,
                financialYear: activeFY,
                createdAt: new Date().toISOString()
            };
            if (newItem.pricingType === 'fixed') {
                itemData.price = newItem.price;
            } else {
                itemData.classPrices = newClassPrices;
                itemData.price = 0;
            }
            await setDoc(doc(db, 'settings', docId), itemData);
            setNewItem({ name: '', price: 0, pricingType: 'fixed' });
            setNewClassPrices({});
        } catch (err) {
            alert('Failed to add item: ' + (err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateItem = async (id: string) => {
        setIsSaving(true);
        try {
            const updateData: any = {
                pricingType: editPricingType,
                updatedAt: new Date().toISOString()
            };
            if (editPricingType === 'fixed') {
                updateData.price = editPrice;
                updateData.classPrices = {};
            } else {
                updateData.classPrices = editClassPrices;
                updateData.price = 0;
            }
            await updateDoc(doc(db, 'settings', id), updateData);
            setEditingId(null);
        } catch (err) {
            alert('Failed to update: ' + (err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteItem = async (id: string) => {
        if (!confirm('Are you sure you want to delete this item?')) return;
        setIsSaving(true);
        try {
            await deleteDoc(doc(db, 'settings', id));
        } catch (err) {
            alert('Failed to delete item: ' + (err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const startEditing = (item: any) => {
        setEditingId(item.id);
        setEditPricingType(item.pricingType || 'fixed');
        setEditPrice(item.price || 0);
        setEditClassPrices(item.classPrices || {});
    };

    // Copy inventory items to another session
    const handleCopyToSession = async (targetFY: string, sourceFY: string) => {
        const sourceItems = allInventoryItems.filter((d: any) => d.financialYear === sourceFY);
        if (sourceItems.length === 0) {
            alert(`No inventory items found in ${sourceFY} to copy.`);
            return;
        }
        const targetItems = allInventoryItems.filter((d: any) => d.financialYear === targetFY);
        if (targetItems.length > 0) {
            if (!window.confirm(`Session ${targetFY} already has ${targetItems.length} item(s). Copying will only add missing ones.\n\nContinue?`)) return;
        } else {
            if (!window.confirm(`Copy ${sourceItems.length} item(s) from ${sourceFY} to ${targetFY}?`)) return;
        }

        setIsCopying(true);
        try {
            let copiedCount = 0;
            for (const item of sourceItems) {
                const existsInTarget = targetItems.some((t: any) => t.name === item.name);
                if (!existsInTarget) {
                    const newDocId = `inv_${item.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${currentSchool?.id}_${targetFY.replace(/[^a-z0-9]/gi, '')}`;
                    await setDoc(doc(db, 'settings', newDocId), {
                        name: item.name,
                        schoolId: currentSchool?.id,
                        type: 'inventory',
                        pricingType: item.pricingType || 'fixed',
                        price: item.price || 0,
                        classPrices: item.classPrices || {},
                        financialYear: targetFY,
                        copiedFrom: sourceFY,
                        createdAt: new Date().toISOString()
                    });
                    copiedCount++;
                }
            }
            alert(`Successfully copied ${copiedCount} item(s) from ${sourceFY} to ${targetFY}.`);
        } catch (err) {
            alert('Failed to copy: ' + (err as Error).message);
        } finally {
            setIsCopying(false);
        }
    };

    // Tag untagged inventory items
    const handleTagItems = async () => {
        if (untaggedItems.length === 0) return;
        if (!window.confirm(`Tag ${untaggedItems.length} item(s) without a session to "${activeFY}"?`)) return;

        setIsCopying(true);
        try {
            for (let i = 0; i < untaggedItems.length; i += 500) {
                const chunk = untaggedItems.slice(i, i + 500);
                const batch = writeBatch(db);
                chunk.forEach((item: any) => {
                    batch.update(doc(db, 'settings', item.id), { financialYear: activeFY });
                });
                await batch.commit();
            }
            alert(`Successfully tagged ${untaggedItems.length} item(s) to ${activeFY}.`);
        } catch (err) {
            alert('Failed to tag: ' + (err as Error).message);
        } finally {
            setIsCopying(false);
        }
    };

    return (
        <div className="animate-fade-in no-scrollbar" style={{ paddingBottom: '2rem' }}>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '52px', height: '52px', borderRadius: '16px',
                            background: 'linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%)',
                            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.4)'
                        }}>
                            <ShoppingBag size={26} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.025em' }}>Inventory Master</h1>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                Manage school items — books, uniforms, stationery and more.
                                <span style={{ background: 'var(--primary)', color: 'white', padding: '0.15rem 0.6rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.75rem' }}>FY: {activeFY}</span>
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {previousFY && (
                            <button
                                onClick={() => handleCopyToSession(activeFY, previousFY)}
                                disabled={isCopying}
                                style={{
                                    background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)',
                                    padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 700,
                                    border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '10px',
                                    cursor: isCopying ? 'not-allowed' : 'pointer', display: 'flex',
                                    alignItems: 'center', gap: '0.4rem', opacity: isCopying ? 0.6 : 1
                                }}
                            >
                                <Copy size={16} /> {isCopying ? 'Copying...' : `Copy from ${previousFY}`}
                            </button>
                        )}
                        {nextFY && (
                            <button
                                onClick={() => handleCopyToSession(nextFY, activeFY)}
                                disabled={isCopying}
                                style={{
                                    background: 'rgba(16, 185, 129, 0.1)', color: '#059669',
                                    padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 700,
                                    border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '10px',
                                    cursor: isCopying ? 'not-allowed' : 'pointer', display: 'flex',
                                    alignItems: 'center', gap: '0.4rem', opacity: isCopying ? 0.6 : 1
                                }}
                            >
                                <Copy size={16} /> {isCopying ? 'Copying...' : `Copy to ${nextFY}`}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Untagged Items Warning */}
            {untaggedItems.length > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                    border: '1px solid #f59e0b', borderRadius: '12px',
                    padding: '1rem 1.5rem', marginBottom: '1.5rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '1rem', flexWrap: 'wrap'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <ShoppingBag size={22} style={{ color: '#d97706', flexShrink: 0 }} />
                        <div>
                            <div style={{ fontWeight: 800, color: '#92400e', fontSize: '0.9375rem' }}>
                                {untaggedItems.length} inventory item(s) found without a session tag!
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: '#a16207', marginTop: '2px' }}>
                                These items were saved before session tagging. Tag them to see them here.
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleTagItems}
                        disabled={isCopying}
                        style={{
                            background: '#f59e0b', color: 'white', padding: '0.6rem 1.25rem',
                            fontSize: '0.8125rem', fontWeight: 800, border: 'none', borderRadius: '8px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap'
                        }}
                    >
                        <Check size={16} /> {isCopying ? 'Tagging...' : `Tag to ${activeFY}`}
                    </button>
                </div>
            )}

            {/* Add New Item Card */}
            <div className="glass-card" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={18} style={{ color: 'var(--primary)' }} /> Add New Item
                </h3>

                <form onSubmit={handleAddItem}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                        {/* Row 1: Name + Pricing Type */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Item Name *</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="e.g. School Bag, Books, ID Card..."
                                    value={newItem.name}
                                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                    onBlur={e => setNewItem({ ...newItem, name: toProperCase(e.target.value) })}
                                    required
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>Pricing Type</label>
                                <PricingTypeToggle value={newItem.pricingType} onChange={v => setNewItem({ ...newItem, pricingType: v })} />
                            </div>
                        </div>

                        {/* Row 2: Price Input OR Class-wise Grid */}
                        {newItem.pricingType === 'fixed' ? (
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                                <div className="input-group" style={{ width: '180px', marginBottom: 0 }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Price (₹)</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        style={{ fontWeight: 700, fontSize: '1.125rem' }}
                                        value={newItem.price}
                                        onChange={e => setNewItem({ ...newItem, price: Number(e.target.value) })}
                                        required
                                        min={0}
                                    />
                                </div>
                                <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ height: '2.75rem', gap: '0.5rem' }}>
                                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                                    Add Item
                                </button>
                            </div>
                        ) : (
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                                    Set Price for Each Class
                                </label>
                                {sortedClassNames.length === 0 ? (
                                    <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '10px', color: '#dc2626', fontSize: '0.875rem', fontWeight: 600 }}>
                                        ⚠️ No classes found. Please configure classes in Class & Section Master first.
                                    </div>
                                ) : (
                                    <>
                                        <ClassPriceGrid
                                            classPrices={newClassPrices}
                                            onChange={setNewClassPrices}
                                            sortedClassNames={sortedClassNames}
                                            useRomanNumerals={currentSchool?.useRomanNumerals}
                                        />
                                        <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ height: '2.75rem', gap: '0.5rem', marginTop: '1rem' }}>
                                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                                            Add Item
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </form>
            </div>

            {/* Items List */}
            <div className="glass-card" style={{ padding: '1.75rem' }}>
                <h3 style={{ fontWeight: 700, marginBottom: '1.25rem' }}>
                    Inventory Items
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '0.75rem' }}>
                        ({items.length} item{items.length !== 1 ? 's' : ''})
                    </span>
                </h3>

                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center' }}>
                        <Loader2 size={32} className="animate-spin" color="var(--primary)" />
                        <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Loading items...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <ShoppingBag size={48} style={{ opacity: 0.15, marginBottom: '1rem' }} />
                        <p style={{ fontSize: '1rem', fontWeight: 600 }}>No inventory items yet</p>
                        <p style={{ fontSize: '0.875rem' }}>Add items using the form above.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {[...items].sort((a, b) => a.name.localeCompare(b.name)).map((item: any) => {
                            const isClasswise = item.pricingType === 'classwise';
                            const isEditing = editingId === item.id;
                            const isExpanded = expandedItem === item.id;

                            return (
                                <div key={item.id} style={{
                                    border: '1px solid var(--border)',
                                    borderRadius: '1rem',
                                    overflow: 'hidden',
                                    transition: 'all 0.2s ease',
                                    background: isEditing ? 'rgba(99, 102, 241, 0.02)' : 'white'
                                }}>
                                    {/* Item Row */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '1rem 1.25rem',
                                        cursor: isClasswise && !isEditing ? 'pointer' : 'default'
                                    }}
                                        onClick={() => {
                                            if (isClasswise && !isEditing) {
                                                setExpandedItem(isExpanded ? null : item.id);
                                            }
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '10px',
                                                background: isClasswise ? 'rgba(99, 102, 241, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: isClasswise ? 'var(--primary)' : '#10b981',
                                                flexShrink: 0
                                            }}>
                                                {isClasswise ? <BookOpen size={20} /> : <ShoppingBag size={20} />}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{item.name}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                    <span style={{
                                                        fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase',
                                                        padding: '0.15rem 0.5rem', borderRadius: '100px',
                                                        background: isClasswise ? 'rgba(99, 102, 241, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                        color: isClasswise ? 'var(--primary)' : '#059669',
                                                        letterSpacing: '0.05em'
                                                    }}>
                                                        {isClasswise ? '📚 Class-wise' : '💲 Fixed'}
                                                    </span>
                                                    {isClasswise && (
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                            {isExpanded ? '▲ collapse' : '▼ expand'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Price Display */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            {!isEditing && (
                                                <div style={{
                                                    fontWeight: 800,
                                                    fontSize: isClasswise ? '0.9375rem' : '1.125rem',
                                                    color: isClasswise ? 'var(--primary)' : '#10b981',
                                                    textAlign: 'right'
                                                }}>
                                                    {getDisplayPrice(item)}
                                                </div>
                                            )}

                                            {/* Action Buttons */}
                                            {!isEditing && (
                                                <div style={{ display: 'flex', gap: '0.375rem' }} onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => startEditing(item)}
                                                        style={{
                                                            background: 'rgba(99, 102, 241, 0.08)', border: 'none', cursor: 'pointer',
                                                            color: 'var(--primary)', width: '32px', height: '32px', borderRadius: '8px',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <Edit2 size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteItem(item.id)}
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.08)', border: 'none', cursor: 'pointer',
                                                            color: '#ef4444', width: '32px', height: '32px', borderRadius: '8px',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Edit Mode */}
                                    {isEditing && (
                                        <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--border)' }}>
                                            <div style={{ paddingTop: '1rem' }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>Pricing Type</label>
                                                <PricingTypeToggle value={editPricingType} onChange={setEditPricingType} />
                                            </div>

                                            <div style={{ marginTop: '1rem' }}>
                                                {editPricingType === 'fixed' ? (
                                                    <div className="input-group" style={{ width: '200px', marginBottom: 0 }}>
                                                        <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Price (₹)</label>
                                                        <input
                                                            type="number"
                                                            className="input-field"
                                                            style={{ fontWeight: 700, fontSize: '1.125rem' }}
                                                            value={editPrice}
                                                            onChange={e => setEditPrice(Number(e.target.value))}
                                                            autoFocus
                                                            min={0}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                                                            Price for Each Class
                                                        </label>
                                                        <ClassPriceGrid
                                                            classPrices={editClassPrices}
                                                            onChange={setEditClassPrices}
                                                            sortedClassNames={sortedClassNames}
                                                            useRomanNumerals={currentSchool?.useRomanNumerals}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                                                <button
                                                    onClick={() => handleUpdateItem(item.id)}
                                                    className="btn btn-primary"
                                                    style={{ gap: '0.5rem' }}
                                                    disabled={isSaving}
                                                >
                                                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                                    Save Changes
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="btn"
                                                    style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', color: 'var(--text-main)' }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Expanded Class-wise Prices (read-only) */}
                                    {isClasswise && isExpanded && !isEditing && item.classPrices && (
                                        <div style={{
                                            padding: '0 1.25rem 1.25rem',
                                            borderTop: '1px solid var(--border)'
                                        }}>
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                                                gap: '0.5rem',
                                                paddingTop: '1rem'
                                            }}>
                                                {sortedClassNames.map((cls: string) => {
                                                    const p = item.classPrices[cls];
                                                    return (
                                                        <div key={cls} style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            padding: '0.5rem 0.75rem',
                                                            borderRadius: '8px',
                                                            background: p > 0 ? 'rgba(16, 185, 129, 0.06)' : 'rgba(0,0,0,0.02)',
                                                            border: '1px solid',
                                                            borderColor: p > 0 ? 'rgba(16, 185, 129, 0.15)' : 'var(--border)'
                                                        }}>
                                                            <span style={{
                                                                fontSize: '0.75rem',
                                                                fontWeight: 700,
                                                                color: 'var(--text-muted)'
                                                            }}>
                                                                {formatClassName(cls, currentSchool?.useRomanNumerals)}
                                                            </span>
                                                            <span style={{
                                                                fontSize: '0.8125rem',
                                                                fontWeight: 800,
                                                                color: p > 0 ? '#059669' : 'var(--text-muted)'
                                                            }}>
                                                                {p > 0 ? `₹${p}` : '—'}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export function MapsConfig() {
    const [mapsKey, setMapsKey] = usePersistence<string>('aischool360_google_maps_api_key', '');
    const [isSaving, setIsSaving] = useState(false);

    const { currentSchool } = useSchool();
    const handleSaveToCloud = async () => {
        if (!mapsKey || !currentSchool?.id) {
            alert('Please enter an API Key first.');
            return;
        }

        setIsSaving(true);
        try {
            await setDoc(doc(db, 'settings', `google_maps_${currentSchool.id} `), {
                apiKey: mapsKey,
                schoolId: currentSchool.id,
                updatedAt: new Date().toISOString()
            });
            alert('✅ API Key synced to cloud! It will now be available on all devices (mobile/desktop).');
        } catch (err) {
            console.error("Cloud sync error:", err);
            alert('Failed to sync to cloud: ' + (err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#4285F4', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span role="img" aria-label="map">📍</span>
                </div>
                <h3 style={{ fontWeight: 700 }}>Maps Configuration</h3>
            </div>
            <div className="input-group">
                <label>Google Maps API Key</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <input
                            type="password"
                            className="input-field"
                            placeholder="Paste your Google Maps API Key here..."
                            value={mapsKey}
                            onChange={(e) => setMapsKey(e.target.value)}
                            style={{ paddingRight: '3rem' }}
                        />
                        <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: mapsKey ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                            {mapsKey ? 'ACTIVE' : 'MISSING'}
                        </div>
                    </div>
                    <button
                        onClick={handleSaveToCloud}
                        disabled={isSaving}
                        style={{
                            padding: '0.75rem 1rem',
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: 700,
                            opacity: isSaving ? 0.7 : 1
                        }}
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Sync to Mobile
                    </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    Required for real-time bus tracking. Click <b>Sync to Mobile</b> to make this key across all devices.
                </p>
            </div>
        </div>
    );
};

export function PrintFormSettings() {
    const { currentSchool } = useSchool();
    const [config, setConfig] = useState({
        headerImage: '',
        footerImage: '',
        declarationText: 'I hereby declare that the information provided above is true and correct to the best of my knowledge and belief. I also understand that any discrepancy found in the provided details may lead to cancellation of my admission.',
        showPhoto: true,
        showFatherSign: true,
        showMotherSign: true,
        showPrincipalSign: true,
        showAadhar: true,
        showRollNo: true,
        showDOB: true,
        showGender: true,
        showBloodGroup: false,
        showCaste: false,
        showAddress: true,
        showFatherOcc: false,
        showMotherOcc: false,
        showAdmissionDate: true,
        showSession: true,
        showCategory: false,
        headerText1: '',
        headerText2: '',
        headerText3: '',
        showSchoolLogo: false,
        headerType: 'image', // 'image' | 'text' | 'both'
        headerTag1: 'h1',
        headerTag2: 'h2',
        headerTag3: 'h3',
        showSection: true,
        showMedical: false,
        showFatherAadhar: false,
        showMotherAadhar: false,
        showFatherAddress: false,
        showMotherAddress: false,
        showGuardian: false,
        showApaarNo: false,
        showPenNo: false,
        showOfficeFooter: false,
        officeFooterText: `FOR OFFICE USE ONLY

Form No. - 17........

Full name of student ..................................................................................................................................................

Date of Admission ................................................ Receipt No.................... Admission No....................................................

Admission granted in Class ..................................................


Signature of Principal`
    });
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const headerInputRef = useRef<HTMLInputElement>(null);
    const footerInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!currentSchool?.id) return;
            try {
                const d = await getDoc(doc(db, 'settings', `print_form_${currentSchool.id}`));
                if (d.exists()) {
                    setConfig(prev => ({ ...prev, ...d.data() }));
                }
            } catch (e) {
                console.error("Error fetching print settings:", e);
            }
            setLoading(false);
        };
        fetchSettings();
    }, [currentSchool?.id]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'header' | 'footer') => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Simple base64 conversion for settings (keep it small ideally)
        const reader = new FileReader();
        reader.onloadend = () => {
            setConfig(prev => ({ ...prev, [type === 'header' ? 'headerImage' : 'footerImage']: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!currentSchool?.id) return;
        setIsSaving(true);
        try {
            await setDoc(doc(db, 'settings', `print_form_${currentSchool.id}`), {
                ...config,
                schoolId: currentSchool.id,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            alert('✅ Print form settings saved successfully!');
        } catch (e) {
            alert('Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return null;

    return (
        <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(139, 92, 246, 0.2)', background: 'rgba(139, 92, 246, 0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#8b5cf6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={20} />
                </div>
                <h3 style={{ fontWeight: 700 }}>Print/View Form Settings</h3>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Customize the layout and content of the student admission form for printing.
            </p>

            <div style={{ display: 'grid', gap: '1.5rem' }}>
                {/* Header Options */}
                <div style={{ background: 'white', padding: '1.25rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>HEADER CONTENT TYPE</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {['image', 'text', 'both'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setConfig({ ...config, headerType: type as any })}
                                    style={{
                                        padding: '0.4rem 0.8rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontWeight: 700,
                                        background: config.headerType === type ? 'var(--primary)' : '#f1f5f9',
                                        color: config.headerType === type ? 'white' : 'var(--text-muted)',
                                        border: 'none', cursor: 'pointer', textTransform: 'uppercase'
                                    }}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        {/* Image Letterheads */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="input-group">
                                <label style={{ fontSize: '0.7rem', fontWeight: 800 }}>HEADER IMAGE</label>
                                <div
                                    onClick={() => headerInputRef.current?.click()}
                                    style={{
                                        height: '80px', border: '2px dashed #e2e8f0', borderRadius: '0.75rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                        overflow: 'hidden', background: '#f8fafc'
                                    }}
                                >
                                    {config.headerImage ? (
                                        <img src={config.headerImage} alt="Header" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        <div style={{ color: '#94a3b8', textAlign: 'center' }}>
                                            <ImageIcon size={20} style={{ marginBottom: '0.25rem' }} />
                                            <div style={{ fontSize: '0.65rem' }}>Upload Header</div>
                                        </div>
                                    )}
                                </div>
                                <input type="file" ref={headerInputRef} hidden accept="image/*" onChange={e => handleImageUpload(e, 'header')} />
                            </div>

                            <div className="input-group">
                                <label style={{ fontSize: '0.7rem', fontWeight: 800 }}>FOOTER IMAGE</label>
                                <div
                                    onClick={() => footerInputRef.current?.click()}
                                    style={{
                                        height: '80px', border: '2px dashed #e2e8f0', borderRadius: '0.75rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                        overflow: 'hidden', background: '#f8fafc'
                                    }}
                                >
                                    {config.footerImage ? (
                                        <img src={config.footerImage} alt="Footer" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        <div style={{ color: '#94a3b8', textAlign: 'center' }}>
                                            <ImageIcon size={20} style={{ marginBottom: '0.25rem' }} />
                                            <div style={{ fontSize: '0.65rem' }}>Upload Footer</div>
                                        </div>
                                    )}
                                </div>
                                <input type="file" ref={footerInputRef} hidden accept="image/*" onChange={e => handleImageUpload(e, 'footer')} />
                            </div>
                        </div>

                        {/* Text Header */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div className="input-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 800 }}>HEADER LINE 1</label>
                                    <select
                                        style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', borderRadius: '4px', border: '1px solid var(--border)' }}
                                        value={config.headerTag1}
                                        onChange={e => setConfig({ ...config, headerTag1: e.target.value })}
                                    >
                                        <option value="h1">H1 (Extra Big)</option>
                                        <option value="h2">H2 (Big)</option>
                                        <option value="h3">H3 (Medium)</option>
                                        <option value="h4">H4 (Small)</option>
                                    </select>
                                </div>
                                <input
                                    className="input-field"
                                    placeholder="School Name"
                                    value={config.headerText1}
                                    onChange={e => setConfig({ ...config, headerText1: e.target.value })}
                                />
                            </div>
                            <div className="input-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 800 }}>HEADER LINE 2</label>
                                    <select
                                        style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', borderRadius: '4px', border: '1px solid var(--border)' }}
                                        value={config.headerTag2}
                                        onChange={e => setConfig({ ...config, headerTag2: e.target.value })}
                                    >
                                        <option value="h1">H1 (Extra Big)</option>
                                        <option value="h2">H2 (Big)</option>
                                        <option value="h3">H3 (Medium)</option>
                                        <option value="h4">H4 (Small)</option>
                                    </select>
                                </div>
                                <input
                                    className="input-field"
                                    placeholder="Address / Slogan"
                                    value={config.headerText2}
                                    onChange={e => setConfig({ ...config, headerText2: e.target.value })}
                                />
                            </div>
                            <div className="input-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 800 }}>HEADER LINE 3</label>
                                    <select
                                        style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', borderRadius: '4px', border: '1px solid var(--border)' }}
                                        value={config.headerTag3}
                                        onChange={e => setConfig({ ...config, headerTag3: e.target.value })}
                                    >
                                        <option value="h1">H1 (Extra Big)</option>
                                        <option value="h2">H2 (Big)</option>
                                        <option value="h3">H3 (Medium)</option>
                                        <option value="h4">H4 (Small)</option>
                                    </select>
                                </div>
                                <input
                                    className="input-field"
                                    placeholder="Contact / Website"
                                    value={config.headerText3}
                                    onChange={e => setConfig({ ...config, headerText3: e.target.value })}
                                />
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, color: config.showSchoolLogo ? 'var(--primary)' : 'var(--text-muted)' }}>
                                <input
                                    type="checkbox"
                                    checked={config.showSchoolLogo}
                                    onChange={e => setConfig({ ...config, showSchoolLogo: e.target.checked })}
                                />
                                Display School logo on Left
                            </label>
                        </div>
                    </div>
                </div>

                {/* Declaration Text */}
                <div className="input-group">
                    <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>DECLARATION TEXT</label>
                    <textarea
                        className="input-field"
                        style={{ minHeight: '100px', fontSize: '0.875rem' }}
                        value={config.declarationText}
                        onChange={e => setConfig({ ...config, declarationText: e.target.value })}
                    />
                </div>

                {/* Office Footer Toggle */}
                <div className="input-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, color: config.showOfficeFooter ? 'var(--primary)' : 'var(--text-muted)', padding: '1rem', background: 'rgba(255,255,255,0.5)', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
                        <input
                            type="checkbox"
                            checked={config.showOfficeFooter}
                            onChange={e => setConfig({ ...config, showOfficeFooter: e.target.checked })}
                            style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                        />
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '0.875rem' }}>Enable Office Use Footer</div>
                            <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400, display: 'block', marginTop: '0.25rem' }}>
                                Adds Form No., Receipt No., and admission details for office records at bottom of form
                            </small>
                        </div>
                    </label>
                </div>

                {/* Toggles */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', background: 'rgba(255,255,255,0.5)', padding: '1.25rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                    {[
                        { label: 'Student Photo', key: 'showPhoto' },
                        { label: 'Roll Number', key: 'showRollNo' },
                        { label: 'Aadhar Number', key: 'showAadhar' },
                        { label: 'Date of Birth', key: 'showDOB' },
                        { label: 'Gender', key: 'showGender' },
                        { label: 'Blood Group', key: 'showBloodGroup' },
                        { label: 'Caste', key: 'showCaste' },
                        { label: 'Full Address', key: 'showAddress' },
                        { label: 'Father Occupation', key: 'showFatherOcc' },
                        { label: 'Mother Occupation', key: 'showMotherOcc' },
                        { label: 'Admission Date', key: 'showAdmissionDate' },
                        { label: 'Academic Session', key: 'showSession' },
                        { label: 'Academic Section', key: 'showSection' },
                        { label: 'Student Category', key: 'showCategory' },
                        { label: 'Medical Info', key: 'showMedical' },
                        { label: 'Father Aadhar', key: 'showFatherAadhar' },
                        { label: 'Mother Aadhar', key: 'showMotherAadhar' },
                        { label: 'Father Address', key: 'showFatherAddress' },
                        { label: 'Mother Address', key: 'showMotherAddress' },
                        { label: 'Guardian Info', key: 'showGuardian' },
                        { label: 'Apar ID', key: 'showApaarNo' },
                        { label: 'PEN Number', key: 'showPenNo' },
                        { label: 'Father Signature', key: 'showFatherSign' },
                        { label: 'Mother Signature', key: 'showMotherSign' },
                        { label: 'Principal Signature', key: 'showPrincipalSign' }
                    ].map(item => (
                        <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: (config as any)[item.key] ? 'var(--primary)' : 'var(--text-muted)' }}>
                            <div style={{ position: 'relative', width: '36px', height: '20px', background: (config as any)[item.key] ? 'var(--primary)' : '#cbd5e1', borderRadius: '20px', transition: 'all 0.3s' }}>
                                <input
                                    type="checkbox"
                                    style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer', zIndex: 1 }}
                                    checked={(config as any)[item.key]}
                                    onChange={e => setConfig({ ...config, [item.key]: e.target.checked })}
                                />
                                <div style={{
                                    position: 'absolute', top: '2px', left: (config as any)[item.key] ? '18px' : '2px',
                                    width: '16px', height: '16px', background: 'white', borderRadius: '50%', transition: 'all 0.3s'
                                }} />
                            </div>
                            {item.label}
                        </label>
                    ))}
                </div>

                <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{ background: '#8b5cf6', marginTop: '1rem' }}
                >
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                    Save Print Settings
                </button>
            </div>
        </div>
    );
}

export default GeneralSettings;
