import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Edit2, Plus, BrainCircuit, Database, Save, Loader2, ShoppingBag, Shield, CreditCard, Image as ImageIcon, FileText, BookOpen } from 'lucide-react';
import { usePersistence } from '../../hooks/usePersistence';
import { seedDatabase, clearDatabase } from '../../lib/dbSeeder';
import { APP_CONFIG, CLASS_ORDER } from '../../constants/app';
import { db } from '../../lib/firebase';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';
import { formatClassName } from '../../utils/formatters';

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
                        value={config.accountName} onChange={e => setConfig({ ...config, accountName: e.target.value })}
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
                            value={config.bankName} onChange={e => setConfig({ ...config, bankName: e.target.value })}
                        />
                    </div>
                    <div className="input-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>BRANCH</label>
                        <input
                            type="text" className="input-field"
                            value={config.branch} onChange={e => setConfig({ ...config, branch: e.target.value })}
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
    const [isSaving, setIsSaving] = useState<string | null>(null);

    const PRESET_CLASSES = CLASS_ORDER;
    const PRESET_SECTIONS = ['A', 'B', 'C', 'D'];

    // Get all class settings
    const classSettings = allSettings?.filter((d: any) => d.type === 'class') || [];

    const toggleClass = async (className: string) => {
        if (!currentSchool?.id) return;
        const docId = `class_${className.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${currentSchool.id}`;
        const existingClass = classSettings.find((c: any) => c.name === className);

        setIsSaving(`toggle-${className}`);
        try {
            if (existingClass) {
                // Toggle active status
                await updateDoc(doc(db, 'settings', docId), {
                    active: !existingClass.active,
                    updatedAt: new Date().toISOString()
                });
            } else {
                // First click on a new class - user wants to ENABLE it
                // Create class document with active=true
                await setDoc(doc(db, 'settings', docId), {
                    name: className,
                    sections: [], // No sections by default
                    active: true, // Enable the class
                    type: 'class',
                    schoolId: currentSchool.id,
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
        if (!currentSchool?.id) return;
        const docId = `class_${className.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${currentSchool.id}`;
        const existingClass = classSettings.find((c: any) => c.name === className);

        // Can't add sections to inactive class
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

    return (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={20} />
                </div>
                <div style={{ flex: 1 }}>
                    <h3 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Class & Section Master</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                        Enable classes your school offers and add sections as needed
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
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
                            if (!confirm('Enable ALL classes? This will activate every class from Pre-Nursery to Class 12.')) return;
                            setIsSaving('enable-all');
                            try {
                                if (!currentSchool?.id) return;
                                // Update all existing class documents to active=true
                                for (const className of PRESET_CLASSES) {
                                    const docId = `class_${className.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${currentSchool.id}`;
                                    await setDoc(doc(db, 'settings', docId), {
                                        name: className,
                                        sections: [],
                                        active: true,
                                        type: 'class',
                                        schoolId: currentSchool.id,
                                        updatedAt: new Date().toISOString()
                                    }, { merge: true });
                                }
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {PRESET_CLASSES.map(clsName => {
                    const classData = classSettings.find((c: any) => c.name === clsName);
                    // A class is active ONLY if the document exists AND its active field is not false.
                    // For a brand new school (no documents), it will correctly show as Disabled (false).
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
                            {/* Class Name & Toggle */}
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

                            {/* Sections */}
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
    const { currentSchool } = useSchool();
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
        admissionNumberStartNumber: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);

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
                admissionNumberStartNumber: currentSchool.admissionNumberStartNumber || ''
            });
            setLoading(false);
        }
    }, [currentSchool]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentSchool?.id) return;
        setIsSaving(true);
        try {
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
                logoUrl: info.logoUrl,
                customTitle: info.customTitle,
                admissionNumberPrefix: info.admissionNumberPrefix,
                admissionNumberStartNumber: info.admissionNumberStartNumber,
                updatedAt: new Date().toISOString()
            });

            // 2. Also update/sync the school_info document in settings collection for legacy component compatibility
            // Since useFirestore filters by schoolId, we MUST include schoolId here
            const settingsRef = doc(db, 'settings', `school_info_${currentSchool.id}`);
            await setDoc(settingsRef, {
                name: info.name,
                fullName: info.fullName,
                email: info.email,
                address: info.address,
                phone: info.phone,
                website: info.website,
                web: info.website, // legacy field name
                admissionNumberPrefix: info.admissionNumberPrefix,
                admissionNumberStartNumber: info.admissionNumberStartNumber,
                type: 'school_info',
                schoolId: currentSchool.id,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            alert('✅ Institution information updated successfully!');
        } catch (err) {
            alert('Failed to update: ' + (err as Error).message);
        } finally {
            setIsSaving(false);
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
                            placeholder="e.g., Paramount Public High School - School Management"
                        />
                        <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            This will be shown in the browser tab title
                        </small>
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
                            <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Example: PPHS/493
                            </small>
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
                            <label>Logo URL</label>
                            <input
                                type="text"
                                className="input-field"
                                value={info.logoUrl}
                                onChange={e => setInfo({ ...info, logoUrl: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="input-group">
                        <label>Address</label>
                        <textarea
                            className="input-field"
                            style={{ minHeight: '80px' }}
                            value={info.address}
                            onChange={e => setInfo({ ...info, address: e.target.value })}
                        />
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
    const [geminiKey, setGeminiKey] = usePersistence<string>('millat_gemini_api_key', '');
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

export function InventoryMaster() {
    const { currentSchool } = useSchool();
    const { data: allSettings, loading } = useFirestore<any>('settings');
    const [newItem, setNewItem] = useState({ name: '', price: 0 });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editPrice, setEditPrice] = useState<number>(0);
    const [isSaving, setIsSaving] = useState(false);

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItem.name || !currentSchool?.id) return;
        setIsSaving(true);
        try {
            const docId = `inv_${newItem.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${currentSchool.id} `;
            await setDoc(doc(db, 'settings', docId), {
                ...newItem,
                schoolId: currentSchool.id,
                type: 'inventory',
                createdAt: new Date().toISOString()
            });
            setNewItem({ name: '', price: 0 });
        } catch (err) {
            alert('Failed to add item: ' + (err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdatePrice = async (id: string) => {
        setIsSaving(true);
        try {
            await updateDoc(doc(db, 'settings', id), {
                price: editPrice,
                updatedAt: new Date().toISOString()
            });
            setEditingId(null);
        } catch (err) {
            alert('Failed to update price: ' + (err as Error).message);
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

    const items = allSettings?.filter((d: any) => d.type === 'inventory') || [];

    return (
        <div className="glass-card" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShoppingBag size={20} />
                </div>
                <h3 style={{ fontWeight: 700 }}>Inventory Master</h3>
            </div>

            <form onSubmit={handleAddItem} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                    <label>Item Name</label>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. School Bag"
                        value={newItem.name}
                        onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                        required
                    />
                </div>
                <div className="input-group" style={{ width: '120px' }}>
                    <label>Price (₹)</label>
                    <input
                        type="number"
                        className="input-field"
                        value={newItem.price}
                        onChange={e => setNewItem({ ...newItem, price: Number(e.target.value) })}
                        required
                    />
                </div>
                <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ height: '2.75rem' }}>
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                    Add Item
                </button>
            </form>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            <th style={{ padding: '0.75rem 1rem' }}>Item Name</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Price (₹)</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={3} style={{ padding: '2rem', textAlign: 'center' }}>Loading items...</td></tr>
                        ) : items.length > 0 ? [...items].sort((a, b) => a.name.localeCompare(b.name)).map((item: any) => (
                            <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '1rem', fontWeight: 600 }}>{item.name}</td>
                                <td style={{ padding: '1rem' }}>
                                    {editingId === item.id ? (
                                        <input
                                            type="number"
                                            className="input-field"
                                            style={{ width: '100px', height: '2rem' }}
                                            value={editPrice}
                                            onChange={e => setEditPrice(Number(e.target.value))}
                                            autoFocus
                                        />
                                    ) : (
                                        <span style={{ color: '#10b981', fontWeight: 700 }}>₹{item.price}</span>
                                    )}
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                        {editingId === item.id ? (
                                            <>
                                                <button
                                                    onClick={() => handleUpdatePrice(item.id)}
                                                    className="btn"
                                                    style={{ background: '#10b981', color: 'white', padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                                                    disabled={isSaving}
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="btn"
                                                    style={{ background: 'var(--border)', color: 'var(--text-main)', padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setEditingId(item.id);
                                                        setEditPrice(item.price);
                                                    }}
                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteItem(item.id)}
                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No inventory items found. Add one above.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function MapsConfig() {
    const [mapsKey, setMapsKey] = usePersistence<string>('millat_google_maps_api_key', '');
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
