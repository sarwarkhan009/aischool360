import React, { useState } from 'react';
import {
    Calendar,
    Plus,
    Edit2,
    Trash2,
    Archive,
    Check,
    X,
    AlertCircle,
    Copy,
    Loader2
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';
import { doc, updateDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface Term {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
}

interface AcademicYear {
    id: string;
    schoolId: string;
    name: string; // e.g., "2024-2025"
    startDate: string;
    endDate: string;
    terms: Term[];
    isActive: boolean;
    isArchived: boolean;
    createdAt: string;
    updatedAt: string;
}

const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
};

const AcademicYearManager: React.FC = () => {
    const { currentSchool, updateSchoolData } = useSchool();
    const { data: academicYears, add: addDocument, update: updateDocument, remove: deleteDocument } = useFirestore<AcademicYear>('academic_years');

    const [showModal, setShowModal] = useState(false);
    const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
    const [showTermModal, setShowTermModal] = useState(false);
    const [editingTerm, setEditingTerm] = useState<Term | null>(null);
    const [selectedYearForTerm, setSelectedYearForTerm] = useState<string | null>(null);
    const [copyingData, setCopyingData] = useState(false);

    const [newYear, setNewYear] = useState<Partial<AcademicYear>>({
        name: '',
        startDate: '',
        endDate: '',
        terms: [],
        isActive: false,
        isArchived: false
    });

    const [newTerm, setNewTerm] = useState<Partial<Term>>({
        name: '',
        startDate: '',
        endDate: '',
        isActive: false
    });

    // Filter years for current school
    const schoolYears = academicYears?.filter(y => y.schoolId === currentSchool?.id) || [];
    const activeYear = schoolYears.find(y => y.isActive && !y.isArchived);

    // Auto-copy fee_types, fee_amounts, and inventory from source FY to target FY
    const copyDataToNewFY = async (sourceFY: string, targetFY: string) => {
        if (!currentSchool?.id) return;
        setCopyingData(true);
        try {
            const schoolId = currentSchool.id;

            // 1. Copy fee_types
            const feeTypesQuery = query(
                collection(db, 'fee_types'),
                where('schoolId', '==', schoolId)
            );
            const feeTypesSnap = await getDocs(feeTypesQuery);
            const feeTypeCopyPromises = feeTypesSnap.docs
                .filter(d => (d.data().financialYear || '2025-26') === sourceFY)
                .map(d => {
                    const data = d.data();
                    const { id, ...rest } = data as any;
                    return addDoc(collection(db, 'fee_types'), {
                        ...rest,
                        financialYear: targetFY,
                        copiedFrom: d.id,
                        createdAt: new Date().toISOString()
                    });
                });

            // 2. Copy fee_amounts
            const feeAmountsQuery = query(
                collection(db, 'fee_amounts'),
                where('schoolId', '==', schoolId)
            );
            const feeAmountsSnap = await getDocs(feeAmountsQuery);
            const feeAmountCopyPromises = feeAmountsSnap.docs
                .filter(d => (d.data().financialYear || '2025-26') === sourceFY)
                .map(d => {
                    const data = d.data();
                    const { id, ...rest } = data as any;
                    return addDoc(collection(db, 'fee_amounts'), {
                        ...rest,
                        financialYear: targetFY,
                        copiedFrom: d.id,
                        createdAt: new Date().toISOString()
                    });
                });

            // 3. Copy inventory items from settings
            const settingsQuery = query(
                collection(db, 'settings'),
                where('schoolId', '==', schoolId),
                where('type', '==', 'inventory')
            );
            const settingsSnap = await getDocs(settingsQuery);
            const inventoryCopyPromises = settingsSnap.docs
                .filter(d => (d.data().financialYear || '2025-26') === sourceFY)
                .map(d => {
                    const data = d.data();
                    const { id, ...rest } = data as any;
                    return addDoc(collection(db, 'settings'), {
                        ...rest,
                        financialYear: targetFY,
                        copiedFrom: d.id,
                        createdAt: new Date().toISOString()
                    });
                });

            await Promise.all([
                ...feeTypeCopyPromises,
                ...feeAmountCopyPromises,
                ...inventoryCopyPromises
            ]);

            const totalCopied = feeTypeCopyPromises.length + feeAmountCopyPromises.length + inventoryCopyPromises.length;
            if (totalCopied > 0) {
                alert(`✅ ${totalCopied} items copied from ${sourceFY} to ${targetFY} (Fee Types: ${feeTypeCopyPromises.length}, Fee Amounts: ${feeAmountCopyPromises.length}, Inventory: ${inventoryCopyPromises.length})`);
            }
        } catch (error) {
            console.error('Error copying data to new FY:', error);
            alert('Failed to copy data to new financial year');
        } finally {
            setCopyingData(false);
        }
    };

    const handleSaveYear = async () => {
        if (!newYear.name || !newYear.startDate || !newYear.endDate || !currentSchool?.id) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            const yearData = {
                ...newYear,
                schoolId: currentSchool.id,
                terms: newYear.terms || [],
                updatedAt: new Date().toISOString()
            };

            if (editingYear) {
                await updateDocument(editingYear.id, yearData);
            } else {
                await addDocument({
                    ...yearData,
                    createdAt: new Date().toISOString()
                } as AcademicYear);

                // Auto-copy fee_types, fee_amounts, and inventory from active FY
                const sourceFY = currentSchool.activeFinancialYear || activeYear?.name || '2025-26';
                if (newYear.name && newYear.name !== sourceFY) {
                    await copyDataToNewFY(sourceFY, newYear.name);
                }
            }

            setShowModal(false);
            setEditingYear(null);
            setNewYear({
                name: '',
                startDate: '',
                endDate: '',
                terms: [],
                isActive: false,
                isArchived: false
            });
        } catch (error) {
            console.error('Error saving academic year:', error);
            alert('Failed to save academic year');
        }
    };

    const handleEditYear = (year: AcademicYear) => {
        setEditingYear(year);
        setNewYear(year);
        setShowModal(true);
    };

    const handleSetActiveYear = async (yearId: string) => {
        try {
            const targetYear = schoolYears.find(y => y.id === yearId);
            // Deactivate all other years
            const promises = schoolYears.map(async (year) => {
                if (year.id === yearId) {
                    await updateDocument(year.id, { isActive: true, updatedAt: new Date().toISOString() });
                } else if (year.isActive) {
                    await updateDocument(year.id, { isActive: false, updatedAt: new Date().toISOString() });
                }
            });
            await Promise.all(promises);

            // Sync active FY to schools document for global access
            if (targetYear?.name && updateSchoolData) {
                await updateSchoolData({ activeFinancialYear: targetYear.name });
            }
        } catch (error) {
            console.error('Error setting active year:', error);
            alert('Failed to set active year');
        }
    };

    const handleArchiveYear = async (yearId: string) => {
        if (!confirm('Are you sure you want to archive this academic year?')) return;

        try {
            await updateDocument(yearId, {
                isArchived: true,
                isActive: false,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error archiving year:', error);
            alert('Failed to archive year');
        }
    };

    const handleDeleteYear = async (yearId: string) => {
        if (!confirm('Are you sure you want to delete this academic year? This action cannot be undone.')) return;

        try {
            await deleteDocument(yearId);
        } catch (error) {
            console.error('Error deleting year:', error);
            alert('Failed to delete year');
        }
    };

    const handleAddTerm = (yearId: string) => {
        setSelectedYearForTerm(yearId);
        setEditingTerm(null);
        setNewTerm({
            name: '',
            startDate: '',
            endDate: '',
            isActive: false
        });
        setShowTermModal(true);
    };

    const handleEditTerm = (year: AcademicYear, term: Term) => {
        setSelectedYearForTerm(year.id);
        setEditingTerm(term);
        setNewTerm(term);
        setShowTermModal(true);
    };

    const handleSaveTerm = async () => {
        if (!newTerm.name || !newTerm.startDate || !newTerm.endDate || !selectedYearForTerm) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            const year = schoolYears.find(y => y.id === selectedYearForTerm);
            if (!year) return;

            let updatedTerms: Term[];

            if (editingTerm) {
                updatedTerms = year.terms.map(t =>
                    t.id === editingTerm.id ? { ...newTerm as Term, id: t.id } : t
                );
            } else {
                const termId = `term_${Date.now()}`;
                updatedTerms = [...year.terms, { ...newTerm as Term, id: termId }];
            }

            await updateDocument(year.id, {
                terms: updatedTerms,
                updatedAt: new Date().toISOString()
            });

            setShowTermModal(false);
            setEditingTerm(null);
            setSelectedYearForTerm(null);
            setNewTerm({
                name: '',
                startDate: '',
                endDate: '',
                isActive: false
            });
        } catch (error) {
            console.error('Error saving term:', error);
            alert('Failed to save term');
        }
    };

    const handleDeleteTerm = async (year: AcademicYear, termId: string) => {
        if (!confirm('Are you sure you want to delete this term?')) return;

        try {
            const updatedTerms = year.terms.filter(t => t.id !== termId);
            await updateDocument(year.id, {
                terms: updatedTerms,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error deleting term:', error);
            alert('Failed to delete term');
        }
    };

    return (
        <div className="page-container">
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <h1 className="page-title">Academic Year Management</h1>
                    <p className="page-subtitle">Manage academic years and terms for your school</p>
                </div>
                <button
                    onClick={() => {
                        setEditingYear(null);
                        setNewYear({
                            name: '',
                            startDate: '',
                            endDate: '',
                            terms: [],
                            isActive: false,
                            isArchived: false
                        });
                        setShowModal(true);
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.75rem',
                        fontWeight: 600,
                        fontSize: '0.9375rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = ' 4px 12px rgba(99, 102, 241, 0.3)';
                    }}
                >
                    <Plus size={20} />
                    Add Academic Year
                </button>
            </div>

            {/* Active Year Banner */}
            {activeYear && (
                <div style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    padding: '1.5rem',
                    borderRadius: '1rem',
                    marginBottom: '2rem',
                    boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Calendar size={32} />
                        <div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, opacity: 0.9 }}>CURRENT ACADEMIC YEAR</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{activeYear.name}</div>
                            <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                                {formatDate(activeYear.startDate)} - {formatDate(activeYear.endDate)}
                                {activeYear.terms.length > 0 && ` • ${activeYear.terms.length} Terms`}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Academic Years List */}
            <div style={{ display: 'grid', gap: '1.5rem' }}>
                {schoolYears.length === 0 ? (
                    <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                        <Calendar size={64} style={{ margin: '0 auto', color: 'var(--text-muted)', marginBottom: '1rem' }} />
                        <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>No Academic Years Yet</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                            Create your first academic year to get started
                        </p>
                        <button
                            onClick={() => setShowModal(true)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '0.75rem',
                                fontWeight: 600,
                                fontSize: '0.9375rem',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                            }}
                        >
                            <Plus size={20} />
                            Add Academic Year
                        </button>
                    </div>
                ) : (
                    schoolYears.map(year => (
                        <div key={year.id} className="card" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                                        <h3 style={{ color: 'var(--text-main)', fontSize: '1.25rem', fontWeight: 700 }}>
                                            {year.name}
                                        </h3>
                                        {year.isActive && !year.isArchived && (
                                            <span style={{
                                                background: '#10b981',
                                                color: 'white',
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '999px',
                                                fontSize: '0.75rem',
                                                fontWeight: 700
                                            }}>
                                                ACTIVE
                                            </span>
                                        )}
                                        {year.isArchived && (
                                            <span style={{
                                                background: '#6b7280',
                                                color: 'white',
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '999px',
                                                fontSize: '0.75rem',
                                                fontWeight: 700
                                            }}>
                                                ARCHIVED
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                        {formatDate(year.startDate)} - {formatDate(year.endDate)}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {!year.isActive && !year.isArchived && (
                                        <button
                                            onClick={() => handleSetActiveYear(year.id)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.375rem',
                                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                                color: 'white',
                                                border: 'none',
                                                padding: '0.5rem 0.875rem',
                                                borderRadius: '0.5rem',
                                                fontSize: '0.8125rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                                e.currentTarget.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.3)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.2)';
                                            }}
                                        >
                                            <Check size={14} />
                                            Set Active
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleEditYear(year)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: '#f3f4f6',
                                            color: '#6b7280',
                                            border: '1px solid #e5e7eb',
                                            padding: '0.5rem',
                                            borderRadius: '0.5rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#e5e7eb';
                                            e.currentTarget.style.color = '#374151';
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = '#f3f4f6';
                                            e.currentTarget.style.color = '#6b7280';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }}
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    {!year.isArchived && (
                                        <button
                                            onClick={() => handleArchiveYear(year.id)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                background: '#fef3c7',
                                                color: '#d97706',
                                                border: '1px solid #fde68a',
                                                padding: '0.5rem',
                                                borderRadius: '0.5rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = '#fde68a';
                                                e.currentTarget.style.color = '#b45309';
                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = '#fef3c7';
                                                e.currentTarget.style.color = '#d97706';
                                                e.currentTarget.style.transform = 'translateY(0)';
                                            }}
                                        >
                                            <Archive size={16} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDeleteYear(year.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: '#fee2e2',
                                            color: '#dc2626',
                                            border: '1px solid #fecaca',
                                            padding: '0.5rem',
                                            borderRadius: '0.5rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#fecaca';
                                            e.currentTarget.style.color = '#b91c1c';
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = '#fee2e2';
                                            e.currentTarget.style.color = '#dc2626';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Terms Section */}
                            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h4 style={{ color: 'var(--text-main)', fontSize: '1rem', fontWeight: 600 }}>
                                        Terms ({year.terms.length})
                                    </h4>
                                    <button
                                        onClick={() => handleAddTerm(year.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.375rem',
                                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                            color: 'white',
                                            border: 'none',
                                            padding: '0.5rem 0.875rem',
                                            borderRadius: '0.5rem',
                                            fontSize: '0.8125rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            boxShadow: '0 2px 4px rgba(99, 102, 241, 0.2)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(99, 102, 241, 0.3)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(99, 102, 241, 0.2)';
                                        }}
                                    >
                                        <Plus size={14} />
                                        Add Term
                                    </button>
                                </div>

                                {year.terms.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                                        No terms added yet
                                    </p>
                                ) : (
                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                        {year.terms.map(term => (
                                            <div
                                                key={term.id}
                                                style={{
                                                    background: 'var(--bg-main)',
                                                    padding: '1rem',
                                                    borderRadius: '0.75rem',
                                                    border: '1px solid var(--border)'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                                                            {term.name}
                                                            {term.isActive && (
                                                                <span style={{
                                                                    background: '#10b981',
                                                                    color: 'white',
                                                                    padding: '0.125rem 0.5rem',
                                                                    borderRadius: '999px',
                                                                    fontSize: '0.625rem',
                                                                    fontWeight: 700,
                                                                    marginLeft: '0.5rem'
                                                                }}>
                                                                    ACTIVE
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                                            {formatDate(term.startDate)} - {formatDate(term.endDate)}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            onClick={() => handleEditTerm(year, term)}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                background: '#f3f4f6',
                                                                color: '#6b7280',
                                                                border: '1px solid #e5e7eb',
                                                                padding: '0.375rem',
                                                                borderRadius: '0.375rem',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.background = '#e5e7eb';
                                                                e.currentTarget.style.color = '#374151';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.background = '#f3f4f6';
                                                                e.currentTarget.style.color = '#6b7280';
                                                            }}
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteTerm(year, term.id)}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                background: '#fee2e2',
                                                                color: '#dc2626',
                                                                border: '1px solid #fecaca',
                                                                padding: '0.375rem',
                                                                borderRadius: '0.375rem',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.background = '#fecaca';
                                                                e.currentTarget.style.color = '#b91c1c';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.background = '#fee2e2';
                                                                e.currentTarget.style.color = '#dc2626';
                                                            }}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Academic Year Modal */}
            {showModal && (
                <>
                    <div className="modal-overlay" onClick={() => setShowModal(false)} />
                    <div className="modal" style={{ maxWidth: '540px' }}>
                        {/* Modern Header */}
                        <div style={{
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: 'white',
                            padding: '1.5rem',
                            borderRadius: '1rem 1rem 0 0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    padding: '0.625rem',
                                    borderRadius: '0.625rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Calendar size={22} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                                        {editingYear ? 'Edit Academic Year' : 'Add Academic Year'}
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.8125rem', opacity: 0.9, marginTop: '0.125rem' }}>
                                        {editingYear ? 'Update academic year details' : 'Create a new academic year'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    border: 'none',
                                    color: 'white',
                                    padding: '0.5rem',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Form Content */}
                        <div style={{ padding: '1.75rem' }}>
                            {/* Academic Year Name */}
                            <div className="form-group">
                                <label style={{
                                    display: 'block',
                                    marginBottom: '0.5rem',
                                    fontWeight: 600,
                                    color: 'var(--text-main)',
                                    fontSize: '0.875rem'
                                }}>
                                    Academic Year Name *
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="e.g., 2024-2025"
                                    value={newYear.name}
                                    onChange={(e) => setNewYear({ ...newYear, name: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '0.625rem',
                                        border: '2px solid #e5e7eb',
                                        fontSize: '0.9375rem',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#6366f1';
                                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = '#e5e7eb';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                />
                            </div>

                            {/* Date Fields Grid */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '1rem',
                                marginTop: '1.25rem'
                            }}>
                                <div className="form-group">
                                    <label style={{
                                        display: 'block',
                                        marginBottom: '0.5rem',
                                        fontWeight: 600,
                                        color: 'var(--text-main)',
                                        fontSize: '0.875rem'
                                    }}>
                                        Start Date *
                                    </label>
                                    <input
                                        type="date"
                                        className="input-field"
                                        value={newYear.startDate}
                                        onChange={(e) => setNewYear({ ...newYear, startDate: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '0.625rem',
                                            border: '2px solid #e5e7eb',
                                            fontSize: '0.9375rem',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = '#6366f1';
                                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = '#e5e7eb';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{
                                        display: 'block',
                                        marginBottom: '0.5rem',
                                        fontWeight: 600,
                                        color: 'var(--text-main)',
                                        fontSize: '0.875rem'
                                    }}>
                                        End Date *
                                    </label>
                                    <input
                                        type="date"
                                        className="input-field"
                                        value={newYear.endDate}
                                        onChange={(e) => setNewYear({ ...newYear, endDate: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '0.625rem',
                                            border: '2px solid #e5e7eb',
                                            fontSize: '0.9375rem',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = '#6366f1';
                                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = '#e5e7eb';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Info Note */}
                            <div style={{
                                marginTop: '1.5rem',
                                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                border: '1px solid #fbbf24',
                                borderRadius: '0.75rem',
                                padding: '1rem',
                                display: 'flex',
                                gap: '0.75rem',
                                alignItems: 'start'
                            }}>
                                <div style={{
                                    background: '#f59e0b',
                                    color: 'white',
                                    borderRadius: '50%',
                                    padding: '0.375rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <AlertCircle size={16} />
                                </div>
                                <div>
                                    <div style={{
                                        fontSize: '0.875rem',
                                        fontWeight: 700,
                                        color: '#92400e',
                                        marginBottom: '0.25rem'
                                    }}>
                                        Important Note
                                    </div>
                                    <div style={{
                                        fontSize: '0.8125rem',
                                        color: '#78350f',
                                        lineHeight: '1.5'
                                    }}>
                                        You can add terms after creating the academic year. Terms help organize your exams by semester or quarter.
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            borderTop: '1px solid #e5e7eb',
                            display: 'flex',
                            gap: '0.75rem',
                            justifyContent: 'flex-end'
                        }}>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '0.625rem',
                                    border: '2px solid #e5e7eb',
                                    background: 'white',
                                    color: '#6b7280',
                                    fontWeight: 600,
                                    fontSize: '0.9375rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f9fafb';
                                    e.currentTarget.style.borderColor = '#d1d5db';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'white';
                                    e.currentTarget.style.borderColor = '#e5e7eb';
                                }}
                            >
                                <X size={18} />
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveYear}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '0.625rem',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    color: 'white',
                                    fontWeight: 600,
                                    fontSize: '0.9375rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                                }}
                            >
                                <Check size={18} />
                                {editingYear ? 'Update Year' : 'Create Year'}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Term Modal */}
            {showTermModal && (
                <>
                    <div className="modal-overlay" onClick={() => setShowTermModal(false)} />
                    <div className="modal" style={{ maxWidth: '540px' }}>
                        {/* Modern Header */}
                        <div style={{
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: 'white',
                            padding: '1.5rem',
                            borderRadius: '1rem 1rem 0 0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    padding: '0.625rem',
                                    borderRadius: '0.625rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Calendar size={22} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                                        {editingTerm ? 'Edit Term' : 'Add Term'}
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.8125rem', opacity: 0.9, marginTop: '0.125rem' }}>
                                        {editingTerm ? 'Update term details' : 'Create a new academic term'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowTermModal(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    border: 'none',
                                    color: 'white',
                                    padding: '0.5rem',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Form Content */}
                        <div style={{ padding: '1.75rem' }}>
                            <div className="form-group">
                                <label style={{
                                    display: 'block',
                                    marginBottom: '0.5rem',
                                    fontWeight: 600,
                                    color: 'var(--text-main)',
                                    fontSize: '0.875rem'
                                }}>
                                    Term Name *
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="e.g., Term 1, First Semester"
                                    value={newTerm.name}
                                    onChange={(e) => setNewTerm({ ...newTerm, name: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '0.625rem',
                                        border: '2px solid #e5e7eb',
                                        fontSize: '0.9375rem',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#6366f1';
                                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = '#e5e7eb';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                />
                            </div>

                            {/* Date Fields Grid */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '1rem',
                                marginTop: '1.25rem'
                            }}>
                                <div className="form-group">
                                    <label style={{
                                        display: 'block',
                                        marginBottom: '0.5rem',
                                        fontWeight: 600,
                                        color: 'var(--text-main)',
                                        fontSize: '0.875rem'
                                    }}>
                                        Start Date *
                                    </label>
                                    <input
                                        type="date"
                                        className="input-field"
                                        value={newTerm.startDate}
                                        onChange={(e) => setNewTerm({ ...newTerm, startDate: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '0.625rem',
                                            border: '2px solid #e5e7eb',
                                            fontSize: '0.9375rem',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = '#6366f1';
                                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = '#e5e7eb';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{
                                        display: 'block',
                                        marginBottom: '0.5rem',
                                        fontWeight: 600,
                                        color: 'var(--text-main)',
                                        fontSize: '0.875rem'
                                    }}>
                                        End Date *
                                    </label>
                                    <input
                                        type="date"
                                        className="input-field"
                                        value={newTerm.endDate}
                                        onChange={(e) => setNewTerm({ ...newTerm, endDate: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '0.625rem',
                                            border: '2px solid #e5e7eb',
                                            fontSize: '0.9375rem',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = '#6366f1';
                                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = '#e5e7eb';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Active Term Checkbox */}
                            <div style={{
                                marginTop: '1.5rem',
                                padding: '1rem',
                                background: '#f9fafb',
                                borderRadius: '0.75rem',
                                border: '1px solid #e5e7eb'
                            }}>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.625rem',
                                    cursor: 'pointer',
                                    userSelect: 'none'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={newTerm.isActive || false}
                                        onChange={(e) => setNewTerm({ ...newTerm, isActive: e.target.checked })}
                                        style={{
                                            width: '18px',
                                            height: '18px',
                                            cursor: 'pointer',
                                            accentColor: '#6366f1'
                                        }}
                                    />
                                    <span style={{
                                        fontWeight: 600,
                                        color: 'var(--text-main)',
                                        fontSize: '0.9375rem'
                                    }}>
                                        Set as Active Term
                                    </span>
                                    {newTerm.isActive && (
                                        <span style={{
                                            background: '#10b981',
                                            color: 'white',
                                            padding: '0.125rem 0.5rem',
                                            borderRadius: '999px',
                                            fontSize: '0.6875rem',
                                            fontWeight: 700
                                        }}>
                                            ACTIVE
                                        </span>
                                    )}
                                </label>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            borderTop: '1px solid #e5e7eb',
                            display: 'flex',
                            gap: '0.75rem',
                            justifyContent: 'flex-end'
                        }}>
                            <button
                                onClick={() => setShowTermModal(false)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '0.625rem',
                                    border: '2px solid #e5e7eb',
                                    background: 'white',
                                    color: '#6b7280',
                                    fontWeight: 600,
                                    fontSize: '0.9375rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f9fafb';
                                    e.currentTarget.style.borderColor = '#d1d5db';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'white';
                                    e.currentTarget.style.borderColor = '#e5e7eb';
                                }}
                            >
                                <X size={18} />
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveTerm}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '0.625rem',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    color: 'white',
                                    fontWeight: 600,
                                    fontSize: '0.9375rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                                }}
                            >
                                <Check size={18} />
                                {editingTerm ? 'Update Term' : 'Add Term'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AcademicYearManager;
