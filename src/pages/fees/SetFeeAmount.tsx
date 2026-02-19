import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Save,
    ChevronRight,
    Home,
    Trash2,
    Check,
    AlertCircle,
    Edit,
    Plus,
    X,
    Copy
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { db } from '../../lib/firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { getActiveClasses, CLASS_ORDER, sortClasses } from '../../constants/app';
import { formatClassName } from '../../utils/formatters';
import { useSchool } from '../../context/SchoolContext';


const SetFeeAmount: React.FC = () => {
    const navigate = useNavigate();
    const { schoolId } = useParams();
    const { currentSchool } = useSchool();
    const { data: allSettings } = useFirestore<any>('settings');
    const { data: feeTypes } = useFirestore<any>('fee_types');
    const { data: allFeeAmounts, add: addFeeAmount, update: updateFeeAmount, remove: removeFeeAmount } = useFirestore<any>('fee_amounts');

    const activeFY = currentSchool?.activeFinancialYear || '2025-26';

    // Detect fee amounts without a financialYear tag
    const untaggedFeeAmounts = allFeeAmounts.filter((fa: any) => !fa.financialYear);

    // Filter fee amounts and fee types by active financial year
    const existingFeeAmounts = allFeeAmounts.filter((fa: any) => fa.financialYear === activeFY);
    const fyFeeTypes = feeTypes.filter((ft: any) => !ft.financialYear || ft.financialYear === activeFY);

    const activeClasses = getActiveClasses(allSettings?.filter((d: any) => d.type === 'class') || [], activeFY).map(c => c.name);

    // Form State
    const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [isCopying, setIsCopying] = useState(false);

    // Academic Years for copy feature
    const { data: academicYears } = useFirestore<any>('academic_years');
    const schoolYears = (academicYears || []).filter((y: any) => y.schoolId === currentSchool?.id && !y.isArchived).map((y: any) => y.name).sort();
    const currentYearIndex = schoolYears.indexOf(activeFY);
    const previousFY = currentYearIndex > 0 ? schoolYears[currentYearIndex - 1] : '';
    const previousFeeAmounts = allFeeAmounts.filter((fa: any) => (fa.financialYear || '2025-26') === previousFY);

    // Edit Modal State
    const [editingClass, setEditingClass] = useState<string | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    // Multiple fee rows state
    interface FeeRow {
        id: string;
        feeTypeId: string;
        amount: number;
        docId?: string; // Firebase document ID for existing records
    }
    const [feeRows, setFeeRows] = useState<FeeRow[]>([
        { id: Date.now().toString(), feeTypeId: '', amount: 0 }
    ]);

    // Filter fee types - only show active ones for current FY
    const activeFeeTypes = fyFeeTypes.filter((ft: any) => ft.status === 'ACTIVE')
        .sort((a: any, b: any) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));

    // Toggle class selection
    const toggleClass = (className: string) => {
        if (selectedClasses.includes(className)) {
            setSelectedClasses(selectedClasses.filter(c => c !== className));
        } else {
            setSelectedClasses([...selectedClasses, className]);
        }
    };

    // Select/Deselect all classes
    const toggleAllClasses = () => {
        if (selectedClasses.length === activeClasses.length) {
            setSelectedClasses([]);
        } else {
            setSelectedClasses([...activeClasses]);
        }
    };

    // Add new fee row
    const addFeeRow = () => {
        setFeeRows([...feeRows, { id: Date.now().toString(), feeTypeId: '', amount: 0 }]);
    };

    // Remove fee row
    const removeFeeRow = async (id: string) => {
        if (feeRows.length === 1) {
            alert('At least one fee type is required');
            return;
        }

        // Find the row to check if it has a docId (existing record in Firebase)
        const rowToDelete = feeRows.find(row => row.id === id);

        if (rowToDelete?.docId) {
            // If editing and row has docId, delete from Firebase
            if (window.confirm('Delete this fee permanently?')) {
                try {
                    await removeFeeAmount(rowToDelete.docId);
                    setFeeRows(feeRows.filter(row => row.id !== id));
                } catch (error) {
                    console.error('Error deleting fee:', error);
                    alert('Error deleting fee: ' + (error as Error).message);
                }
            }
        } else {
            // Just remove from state (not yet saved to Firebase)
            setFeeRows(feeRows.filter(row => row.id !== id));
        }
    };

    // Update fee row
    const updateFeeRow = (id: string, field: 'feeTypeId' | 'amount', value: string | number) => {
        setFeeRows(feeRows.map(row =>
            row.id === id ? { ...row, [field]: value } : row
        ));
    };

    // Handle save
    const handleSave = async () => {
        if (selectedClasses.length === 0) {
            alert('Please select at least one class');
            return;
        }

        // Validate fee rows
        const validRows = feeRows.filter(row => row.feeTypeId && row.amount >= 0);
        if (validRows.length === 0) {
            alert('Please add at least one fee type');
            return;
        }

        setSaving(true);
        try {
            let totalSaved = 0;

            for (const row of validRows) {
                const feeType = feeTypes.find((ft: any) => ft.id === row.feeTypeId);

                for (const className of selectedClasses) {
                    // Check if this combination already exists
                    const existingDoc = existingFeeAmounts.find(
                        (fa: any) => fa.feeTypeId === row.feeTypeId && fa.className === className
                    );

                    if (existingDoc) {
                        // Update existing using hook method
                        await updateFeeAmount(existingDoc.id, {
                            amount: row.amount,
                            updatedAt: new Date().toISOString()
                        });
                    } else {
                        // Create new using hook method (automatically adds schoolId)
                        await addFeeAmount({
                            feeTypeId: row.feeTypeId,
                            feeTypeName: feeType.feeHeadName,
                            className,
                            amount: row.amount,
                            financialYear: activeFY,
                            createdAt: new Date().toISOString()
                        });
                    }
                    totalSaved++;
                }
            }

            alert(`Successfully saved ${totalSaved} fee amount(s) for ${selectedClasses.length} class(es)!`);

            // Reset form
            setSelectedClasses([]);
            setFeeRows([{ id: Date.now().toString(), feeTypeId: '', amount: 0 }]);
        } catch (error) {
            console.error('Error saving fee amounts:', error);
            alert('Error saving fee amounts: ' + (error as Error).message);
        } finally {
            setSaving(false);
        }
    };

    // Handle Edit Class - Populate existing data
    const handleEditClass = (className: string) => {
        setEditingClass(className);

        // Get all fee amounts for this class
        const classFees = existingFeeAmounts.filter((fa: any) => fa.className === className);

        if (classFees.length > 0) {
            // Populate fee rows with existing data
            const populatedRows: FeeRow[] = classFees.map((fa: any) => ({
                id: fa.id + '-edit', // Unique ID for editing
                feeTypeId: fa.feeTypeId,
                amount: fa.amount,
                docId: fa.id // Store the Firebase document ID
            }));
            setFeeRows(populatedRows);
        } else {
            // If no fees exist, start with one empty row
            setFeeRows([{ id: Date.now().toString(), feeTypeId: '', amount: 0 }]);
        }

        setShowEditModal(true);
    };

    // Handle Update Fees (for edit mode)
    const handleUpdateFees = async () => {
        if (!editingClass) return;

        // Validate fee rows
        const validRows = feeRows.filter(row => row.feeTypeId && row.amount >= 0);
        if (validRows.length === 0) {
            alert('Please add at least one fee type');
            return;
        }

        setSaving(true);
        try {
            for (const row of validRows) {
                const feeType = feeTypes.find((ft: any) => ft.id === row.feeTypeId);

                if (row.docId) {
                    // Update existing record
                    await updateFeeAmount(row.docId, {
                        amount: row.amount,
                        updatedAt: new Date().toISOString()
                    });
                } else {
                    // Create new record (if user added a new fee type while editing)
                    await addFeeAmount({
                        feeTypeId: row.feeTypeId,
                        feeTypeName: feeType.feeHeadName,
                        className: editingClass,
                        amount: row.amount,
                        financialYear: activeFY,
                        createdAt: new Date().toISOString()
                    });
                }
            }

            alert(`Successfully updated fee amounts for ${editingClass}!`);

            // Close modal and reset
            setShowEditModal(false);
            setEditingClass(null);
            setFeeRows([{ id: Date.now().toString(), feeTypeId: '', amount: 0 }]);
        } catch (error) {
            console.error('Error updating fee amounts:', error);
            alert('Error updating fee amounts: ' + (error as Error).message);
        } finally {
            setSaving(false);
        }
    };

    // Cancel Edit
    const handleCancelEdit = () => {
        setShowEditModal(false);
        setEditingClass(null);
        setFeeRows([{ id: Date.now().toString(), feeTypeId: '', amount: 0 }]);
    };

    // Copy Fee Amounts from Previous Session
    const handleCopyFromPreviousSession = async () => {
        if (!previousFY) {
            alert('No previous session found to copy from.');
            return;
        }

        if (previousFeeAmounts.length === 0) {
            alert(`No fee amounts found in session ${previousFY} to copy.`);
            return;
        }

        if (existingFeeAmounts.length > 0) {
            const confirm = window.confirm(`Current session (${activeFY}) already has ${existingFeeAmounts.length} fee amount(s) configured.\n\nCopying will only add missing entries and will NOT overwrite existing ones.\n\nContinue?`);
            if (!confirm) return;
        } else {
            const confirm = window.confirm(`This will copy ${previousFeeAmounts.length} fee amount(s) from ${previousFY} to ${activeFY}.\n\nContinue?`);
            if (!confirm) return;
        }

        setIsCopying(true);
        try {
            let copiedCount = 0;

            for (const fa of previousFeeAmounts) {
                // Check if this class + feeType combo already exists in current FY
                const alreadyExists = existingFeeAmounts.find(
                    (efa: any) => efa.className === fa.className && efa.feeTypeId === fa.feeTypeId
                );

                if (!alreadyExists) {
                    await addFeeAmount({
                        feeTypeId: fa.feeTypeId,
                        feeTypeName: fa.feeTypeName,
                        className: fa.className,
                        amount: fa.amount,
                        financialYear: activeFY,
                        createdAt: new Date().toISOString(),
                        copiedFrom: previousFY
                    });
                    copiedCount++;
                }
            }

            alert(`Successfully copied ${copiedCount} fee amount(s) from ${previousFY} to ${activeFY}.`);
        } catch (error) {
            console.error('Error copying fee amounts:', error);
            alert('Error copying fee amounts: ' + (error as Error).message);
        } finally {
            setIsCopying(false);
        }
    };

    // Tag untagged fee amounts with a financial year
    const handleTagFeeAmounts = async (targetFY: string) => {
        if (untaggedFeeAmounts.length === 0) return;

        const confirmMsg = `This will tag ${untaggedFeeAmounts.length} fee amount(s) that don't have a session to "${targetFY}".\n\nContinue?`;
        if (!window.confirm(confirmMsg)) return;

        setIsCopying(true);
        try {
            for (let i = 0; i < untaggedFeeAmounts.length; i += 500) {
                const chunk = untaggedFeeAmounts.slice(i, i + 500);
                const batch = writeBatch(db);
                chunk.forEach((fa: any) => {
                    batch.update(doc(db, 'fee_amounts', fa.id), { financialYear: targetFY });
                });
                await batch.commit();
            }
            alert(`Successfully tagged ${untaggedFeeAmounts.length} fee amount(s) to session ${targetFY}.`);
        } catch (error) {
            console.error('Error tagging fee amounts:', error);
            alert('Error: ' + (error as Error).message);
        } finally {
            setIsCopying(false);
        }
    };

    return (
        <div className="animate-fade-in no-scrollbar" style={{ paddingBottom: '4rem' }}>
            {/* Header Section */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '2rem',
                padding: '1.5rem',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)'
            }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.5rem', letterSpacing: '-0.025em' }}>
                        Set Fee Amount
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', opacity: 0.9 }}>
                        <Home size={14} /> Home <ChevronRight size={12} /> Fee <ChevronRight size={12} /> Set Amount for Classes
                        <span style={{ background: 'rgba(255,255,255,0.25)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.75rem' }}>FY: {activeFY}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {previousFY && (
                        <button
                            onClick={handleCopyFromPreviousSession}
                            disabled={isCopying}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                color: 'white',
                                padding: '0.6rem 1.25rem',
                                fontSize: '0.875rem',
                                fontWeight: 700,
                                border: '1px solid rgba(255,255,255,0.3)',
                                backdropFilter: 'blur(10px)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                borderRadius: '12px',
                                cursor: isCopying ? 'not-allowed' : 'pointer',
                                opacity: isCopying ? 0.7 : 1,
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <Copy size={18} /> {isCopying ? 'Copying...' : `Copy from ${previousFY}`}
                        </button>
                    )}
                    <button
                        onClick={() => navigate(`/${schoolId}/fees/structure`)}
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            color: 'white',
                            padding: '0.6rem 1.25rem',
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            border: '1px solid rgba(255,255,255,0.3)',
                            backdropFilter: 'blur(10px)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <Edit size={18} /> Design Fee Types
                    </button>
                </div>
            </div>

            {/* Warning: Untagged Fee Amounts */}
            {untaggedFeeAmounts.length > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <AlertCircle size={22} style={{ color: '#d97706', flexShrink: 0 }} />
                        <div>
                            <div style={{ fontWeight: 800, color: '#92400e', fontSize: '0.9375rem' }}>
                                {untaggedFeeAmounts.length} fee amount(s) found without a session tag!
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: '#a16207', marginTop: '2px' }}>
                                These fees were saved before session tagging was introduced. Tag them to make them visible.
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => handleTagFeeAmounts(activeFY)}
                        disabled={isCopying}
                        style={{
                            background: '#f59e0b',
                            color: 'white',
                            padding: '0.6rem 1.25rem',
                            fontSize: '0.8125rem',
                            fontWeight: 800,
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <Check size={16} /> {isCopying ? 'Tagging...' : `Tag to ${activeFY}`}
                    </button>
                </div>
            )}

            {/* Input Form Section */}
            <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '2px solid var(--border)' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={20} style={{ color: '#10b981' }} />
                        Configure Fee Amount
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Select classes, choose fee type, and set the amount
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                    {/* Step 1: Select Classes */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase' }}>
                                Step 1: Select Classes
                            </label>
                            <button
                                onClick={toggleAllClasses}
                                style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: '#10b981',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '0.25rem 0.5rem'
                                }}
                            >
                                {selectedClasses.length === activeClasses.length ? 'Clear All' : 'Select All'}
                            </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.75rem' }}>
                            {activeClasses.map(cls => (
                                <button
                                    key={cls}
                                    onClick={() => toggleClass(cls)}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        borderRadius: '10px',
                                        border: selectedClasses.includes(cls) ? '2px solid #10b981' : '1px solid var(--border)',
                                        background: selectedClasses.includes(cls) ? 'rgba(16, 185, 129, 0.1)' : 'white',
                                        color: selectedClasses.includes(cls) ? '#10b981' : 'var(--text-main)',
                                        fontWeight: selectedClasses.includes(cls) ? 800 : 600,
                                        fontSize: '0.875rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        boxShadow: selectedClasses.includes(cls) ? '0 4px 12px rgba(16, 185, 129, 0.2)' : 'none'
                                    }}
                                >
                                    {selectedClasses.includes(cls) && <Check size={14} />}
                                    {formatClassName(cls, currentSchool?.useRomanNumerals)}
                                </button>
                            ))}
                        </div>
                        {selectedClasses.length > 0 && (
                            <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                                ✓ {selectedClasses.length} class(es) selected: {selectedClasses.map(c => formatClassName(c, currentSchool?.useRomanNumerals)).join(', ')}
                            </div>
                        )}
                    </div>

                    {/* Step 2 & 3: Multiple Fee Type Rows */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase' }}>
                                Step 2 & 3: Add Fee Types & Amounts
                            </label>
                            <button
                                onClick={addFeeRow}
                                className="btn"
                                style={{
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: 'white',
                                    padding: '0.5rem 1rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.375rem',
                                    border: 'none',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                                }}
                            >
                                <Plus size={14} />
                                Add Fee Type
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {feeRows.map((row, index) => (
                                <div key={row.id} style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr auto',
                                    gap: '0.75rem',
                                    padding: '1rem',
                                    background: 'rgba(16, 185, 129, 0.03)',
                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                    borderRadius: '12px',
                                    alignItems: 'end'
                                }}>
                                    {/* Fee Type Selection */}
                                    <div className="input-group">
                                        <label style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            color: '#64748b',
                                            textTransform: 'uppercase',
                                            marginBottom: '0.5rem',
                                            display: 'block'
                                        }}>
                                            Fee Type {index + 1}
                                        </label>
                                        <select
                                            className="input-field"
                                            style={{
                                                borderRadius: '10px',
                                                padding: '0.75rem',
                                                fontSize: '0.875rem',
                                                border: row.feeTypeId ? '2px solid #10b981' : '1px solid var(--border)',
                                                background: row.feeTypeId ? 'rgba(16, 185, 129, 0.05)' : 'white'
                                            }}
                                            value={row.feeTypeId}
                                            onChange={e => updateFeeRow(row.id, 'feeTypeId', e.target.value)}
                                        >
                                            <option value="">-- Choose Fee Type --</option>
                                            {activeFeeTypes.map((ft: any) => (
                                                <option key={ft.id} value={ft.id}>{ft.feeHeadName}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Amount Input */}
                                    <div className="input-group">
                                        <label style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            color: '#64748b',
                                            textTransform: 'uppercase',
                                            marginBottom: '0.5rem',
                                            display: 'block'
                                        }}>
                                            Amount
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <span style={{
                                                position: 'absolute',
                                                left: '14px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                fontSize: '1rem',
                                                fontWeight: 700,
                                                color: row.amount > 0 ? '#10b981' : 'var(--text-muted)'
                                            }}>
                                                ₹
                                            </span>
                                            <input
                                                type="number"
                                                className="input-field"
                                                style={{
                                                    width: '100%',
                                                    padding: '0.75rem 1rem 0.75rem 2.25rem',
                                                    borderRadius: '10px',
                                                    fontSize: '1rem',
                                                    fontWeight: 700,
                                                    textAlign: 'right',
                                                    border: row.amount > 0 ? '2px solid #10b981' : '1px solid var(--border)',
                                                    background: row.amount > 0 ? 'rgba(16, 185, 129, 0.05)' : 'white'
                                                }}
                                                value={row.amount || ''}
                                                onChange={(e) => updateFeeRow(row.id, 'amount', Number(e.target.value))}
                                                placeholder="0"
                                                min="0"
                                            />
                                        </div>
                                    </div>

                                    {/* Remove Button */}
                                    <button
                                        onClick={() => removeFeeRow(row.id)}
                                        disabled={feeRows.length === 1}
                                        style={{
                                            padding: '0.75rem',
                                            background: feeRows.length === 1 ? '#f1f5f9' : 'rgba(239, 68, 68, 0.1)',
                                            color: feeRows.length === 1 ? '#cbd5e1' : '#dc2626',
                                            border: feeRows.length === 1 ? '1px solid #e2e8f0' : '1px solid rgba(239, 68, 68, 0.2)',
                                            borderRadius: '10px',
                                            cursor: feeRows.length === 1 ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s'
                                        }}
                                        title={feeRows.length === 1 ? 'At least one fee type required' : 'Remove this fee type'}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Save Button */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                        <button
                            onClick={handleSave}
                            disabled={saving || selectedClasses.length === 0 || feeRows.every(row => !row.feeTypeId || row.amount < 0)}
                            className="btn btn-primary"
                            style={{
                                background: (saving || selectedClasses.length === 0 || feeRows.every(row => !row.feeTypeId || row.amount < 0)) ? '#94a3b8' : '#10b981',
                                color: 'white',
                                padding: '0.875rem 2rem',
                                fontSize: '1rem',
                                fontWeight: 700,
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: (saving || selectedClasses.length === 0 || feeRows.every(row => !row.feeTypeId || row.amount < 0)) ? 'not-allowed' : 'pointer',
                                border: 'none',
                                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                                transition: 'all 0.3s'
                            }}
                        >
                            <Save size={18} />
                            {saving ? 'Saving...' : `Save Fee Amount(s)`}
                        </button>
                    </div>
                </div>
            </div>

            {/* List of Set Fee Amounts - Pivot Table Format */}
            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '2px solid var(--border)'
                }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'white', margin: 0 }}>
                        Configured Fee Amounts
                    </h3>
                </div>

                {existingFeeAmounts.length === 0 ? (
                    <div style={{ padding: '4rem', textAlign: 'center' }}>
                        <AlertCircle size={48} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: '1rem' }} />
                        <h3 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '1.125rem' }}>No Fee Amounts Configured</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            Set fee amounts using the form above to see them listed here.
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        {(() => {
                            // Create pivot data structure
                            const pivotData: Record<string, Record<string, { amount: number, id: string }>> = {};
                            const uniqueFeeTypes: string[] = [];
                            const uniqueClasses: string[] = [];

                            // Process data
                            existingFeeAmounts.forEach((fa: any) => {
                                if (!uniqueClasses.includes(fa.className)) {
                                    uniqueClasses.push(fa.className);
                                }
                                if (!uniqueFeeTypes.includes(fa.feeTypeName)) {
                                    uniqueFeeTypes.push(fa.feeTypeName);
                                }

                                if (!pivotData[fa.className]) {
                                    pivotData[fa.className] = {};
                                }
                                pivotData[fa.className][fa.feeTypeName] = {
                                    amount: fa.amount,
                                    id: fa.id
                                };
                            });

                            // Sort classes and fee types
                            const sortedClasses = sortClasses(uniqueClasses);
                            uniqueFeeTypes.sort();

                            return (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                                            <th style={{
                                                padding: '1rem 1.25rem',
                                                textAlign: 'left',
                                                fontSize: '0.8125rem',
                                                fontWeight: 800,
                                                color: '#475569',
                                                textTransform: 'uppercase',
                                                position: 'sticky',
                                                left: 0,
                                                background: '#f8fafc',
                                                zIndex: 20,
                                                minWidth: '120px'
                                            }}>
                                                Class
                                            </th>
                                            {uniqueFeeTypes.map((feeType, _idx) => (
                                                <th key={feeType} style={{
                                                    padding: '1rem 1.25rem',
                                                    textAlign: 'right',
                                                    fontSize: '0.8125rem',
                                                    fontWeight: 800,
                                                    color: '#475569',
                                                    textTransform: 'uppercase',
                                                    minWidth: '150px',
                                                    background: '#f8fafc'
                                                }}>
                                                    {feeType}
                                                </th>
                                            ))}
                                            <th style={{
                                                padding: '1rem 1.25rem',
                                                textAlign: 'center',
                                                fontSize: '0.8125rem',
                                                fontWeight: 800,
                                                color: '#475569',
                                                textTransform: 'uppercase',
                                                width: '180px',
                                                background: '#f8fafc'
                                            }}>
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedClasses.map((className, rowIdx) => {
                                            const classData = pivotData[className] || {};
                                            // Get all fee IDs for this class for delete all functionality
                                            const classIds = Object.values(classData).map(d => d.id);

                                            return (
                                                <tr
                                                    key={className}
                                                    style={{
                                                        borderBottom: '1px solid var(--border)',
                                                        background: rowIdx % 2 === 0 ? 'white' : '#fafafa',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = '#f0fdf4';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = rowIdx % 2 === 0 ? 'white' : '#fafafa';
                                                    }}
                                                >
                                                    <td style={{
                                                        padding: '1rem 1.25rem',
                                                        fontWeight: 700,
                                                        fontSize: '0.9375rem',
                                                        color: '#1e293b',
                                                        position: 'sticky',
                                                        left: 0,
                                                        background: rowIdx % 2 === 0 ? 'white' : '#fafafa',
                                                        zIndex: 10
                                                    }}>
                                                        <span style={{
                                                            background: '#e0e7ff',
                                                            color: '#4338ca',
                                                            padding: '0.375rem 0.875rem',
                                                            borderRadius: '8px',
                                                            fontSize: '0.875rem',
                                                            fontWeight: 700,
                                                            display: 'inline-block'
                                                        }}>
                                                            {formatClassName(className, currentSchool?.useRomanNumerals)}
                                                        </span>
                                                    </td>
                                                    {uniqueFeeTypes.map(feeType => {
                                                        const cellData = classData[feeType];
                                                        return (
                                                            <td
                                                                key={feeType}
                                                                style={{
                                                                    padding: '1rem 1.25rem',
                                                                    textAlign: 'right',
                                                                    fontWeight: cellData ? 800 : 400,
                                                                    fontSize: cellData ? '1.0625rem' : '0.875rem',
                                                                    color: cellData ? '#10b981' : '#cbd5e1'
                                                                }}
                                                            >
                                                                {cellData ? (
                                                                    `₹ ${cellData.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                                ) : (
                                                                    '—'
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                    <td style={{
                                                        padding: '1rem 1.25rem',
                                                        textAlign: 'center'
                                                    }}>
                                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                            <button
                                                                onClick={() => handleEditClass(className)}
                                                                style={{
                                                                    padding: '0.5rem 0.875rem',
                                                                    background: 'rgba(59, 130, 246, 0.1)',
                                                                    color: '#2563eb',
                                                                    border: '1px solid rgba(59, 130, 246, 0.2)',
                                                                    borderRadius: '8px',
                                                                    cursor: 'pointer',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.375rem',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 700,
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.background = '#2563eb';
                                                                    e.currentTarget.style.color = 'white';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                                                                    e.currentTarget.style.color = '#2563eb';
                                                                }}
                                                                title="Edit fees for this class"
                                                            >
                                                                <Edit size={14} />
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    if (!window.confirm(`Delete all fee amounts for ${className}?`)) return;
                                                                    try {
                                                                        for (const id of classIds) {
                                                                            await removeFeeAmount(id);
                                                                        }
                                                                        alert('Fee amounts deleted successfully!');
                                                                    } catch (error) {
                                                                        console.error('Error:', error);
                                                                        alert('Error deleting: ' + (error as Error).message);
                                                                    }
                                                                }}
                                                                style={{
                                                                    padding: '0.5rem 0.875rem',
                                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                                    color: '#dc2626',
                                                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                                                    borderRadius: '8px',
                                                                    cursor: 'pointer',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.375rem',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 700,
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.background = '#dc2626';
                                                                    e.currentTarget.style.color = 'white';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                                                    e.currentTarget.style.color = '#dc2626';
                                                                }}
                                                                title="Delete all fees for this class"
                                                            >
                                                                <Trash2 size={14} />
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            );
                        })()}
                    </div>
                )}

                {/* Summary Footer */}
                {existingFeeAmounts.length > 0 && (
                    <div style={{
                        padding: '1rem 1.5rem',
                        background: '#f8fafc',
                        borderTop: '2px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 600 }}>
                            Total Classes: <strong style={{ color: '#1e293b' }}>{new Set(existingFeeAmounts.map((fa: any) => fa.className)).size}</strong>
                            {' • '}
                            Fee Types: <strong style={{ color: '#1e293b' }}>{new Set(existingFeeAmounts.map((fa: any) => fa.feeTypeName)).size}</strong>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            Matrix view of all configured fees
                        </div>
                    </div>
                )}
            </div>

            {/* Summary Info */}
            <div style={{
                marginTop: '1.5rem',
                padding: '1rem 1.5rem',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1rem'
            }}>
                <AlertCircle size={20} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.875rem', color: '#1e40af' }}>
                    <strong>Quick Guide:</strong>
                    <ul style={{ marginTop: '0.5rem', marginLeft: '1.25rem', lineHeight: 1.6 }}>
                        <li>Select one or more classes using checkboxes (Step 1)</li>
                        <li>Add fee type rows using the "Add Fee Type" button (Step 2 & 3)</li>
                        <li>For each row, choose the fee type and enter the amount</li>
                        <li>Click "Save Fee Amount(s)" to apply all fees to selected classes</li>
                        <li><strong>Example:</strong> Select Class 1-5 → Add 3 rows: Tuition Fee (₹500), Annual Fee (₹1500), Exam Fee (₹200) → Save → All 5 classes will have all 3 fees configured!</li>
                    </ul>
                </div>
            </div>

            {/* Edit Modal */}
            {showEditModal && (
                <>
                    {/* Backdrop */}
                    <div
                        onClick={handleCancelEdit}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.5)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 999,
                            animation: 'fadeIn 0.3s ease'
                        }}
                    />

                    {/* Modal */}
                    <div style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'white',
                        borderRadius: '20px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        zIndex: 1000,
                        width: '90%',
                        maxWidth: '800px',
                        maxHeight: '90vh',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        animation: 'slideUp 0.3s ease'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                            padding: '1.5rem 2rem',
                            color: 'white',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Edit size={24} />
                                    Edit Fee Amounts
                                </h2>
                                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', opacity: 0.9 }}>
                                    Editing fees for: <strong style={{ fontSize: '1rem', fontWeight: 900 }}>{editingClass}</strong>
                                </p>
                            </div>
                            <button
                                onClick={handleCancelEdit}
                                style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    border: 'none',
                                    borderRadius: '10px',
                                    padding: '0.5rem',
                                    cursor: 'pointer',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{
                            padding: '2rem',
                            flex: 1,
                            overflowY: 'auto'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                                    Fee Types & Amounts
                                </h3>
                                <button
                                    onClick={addFeeRow}
                                    className="btn"
                                    style={{
                                        background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                                        color: 'white',
                                        padding: '0.5rem 1rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.375rem',
                                        border: 'none',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
                                    }}
                                >
                                    <Plus size={14} />
                                    Add Fee Type
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {feeRows.map((row, index) => (
                                    <div key={row.id} style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr auto',
                                        gap: '0.75rem',
                                        padding: '1rem',
                                        background: 'rgba(37, 99, 235, 0.03)',
                                        border: '1px solid rgba(37, 99, 235, 0.2)',
                                        borderRadius: '12px',
                                        alignItems: 'end'
                                    }}>
                                        {/* Fee Type Selection */}
                                        <div className="input-group">
                                            <label style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                color: '#64748b',
                                                textTransform: 'uppercase',
                                                marginBottom: '0.5rem',
                                                display: 'block'
                                            }}>
                                                Fee Type {index + 1}
                                            </label>
                                            <select
                                                className="input-field"
                                                style={{
                                                    borderRadius: '10px',
                                                    padding: '0.75rem',
                                                    fontSize: '0.875rem',
                                                    border: row.feeTypeId ? '2px solid #2563eb' : '1px solid var(--border)',
                                                    background: row.feeTypeId ? 'rgba(37, 99, 235, 0.05)' : 'white'
                                                }}
                                                value={row.feeTypeId}
                                                onChange={e => updateFeeRow(row.id, 'feeTypeId', e.target.value)}
                                            >
                                                <option value="">-- Choose Fee Type --</option>
                                                {activeFeeTypes.map((ft: any) => (
                                                    <option key={ft.id} value={ft.id}>{ft.feeHeadName}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Amount Input */}
                                        <div className="input-group">
                                            <label style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                color: '#64748b',
                                                textTransform: 'uppercase',
                                                marginBottom: '0.5rem',
                                                display: 'block'
                                            }}>
                                                Amount
                                            </label>
                                            <div style={{ position: 'relative' }}>
                                                <span style={{
                                                    position: 'absolute',
                                                    left: '14px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    fontSize: '1rem',
                                                    fontWeight: 700,
                                                    color: row.amount > 0 ? '#2563eb' : 'var(--text-muted)'
                                                }}>
                                                    ₹
                                                </span>
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    style={{
                                                        width: '100%',
                                                        padding: '0.75rem 1rem 0.75rem 2.25rem',
                                                        borderRadius: '10px',
                                                        fontSize: '1rem',
                                                        fontWeight: 700,
                                                        textAlign: 'right',
                                                        border: row.amount > 0 ? '2px solid #2563eb' : '1px solid var(--border)',
                                                        background: row.amount > 0 ? 'rgba(37, 99, 235, 0.05)' : 'white'
                                                    }}
                                                    value={row.amount || ''}
                                                    onChange={(e) => updateFeeRow(row.id, 'amount', Number(e.target.value))}
                                                    placeholder="0"
                                                    min="0"
                                                />
                                            </div>
                                        </div>

                                        {/* Remove Button */}
                                        <button
                                            onClick={() => removeFeeRow(row.id)}
                                            disabled={feeRows.length === 1}
                                            style={{
                                                padding: '0.75rem',
                                                background: feeRows.length === 1 ? '#f1f5f9' : 'rgba(239, 68, 68, 0.1)',
                                                color: feeRows.length === 1 ? '#cbd5e1' : '#dc2626',
                                                border: feeRows.length === 1 ? '1px solid #e2e8f0' : '1px solid rgba(239, 68, 68, 0.2)',
                                                borderRadius: '10px',
                                                cursor: feeRows.length === 1 ? 'not-allowed' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s'
                                            }}
                                            title={feeRows.length === 1 ? 'At least one fee type required' : 'Remove this fee type'}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: '1.5rem 2rem',
                            borderTop: '1px solid var(--border)',
                            background: '#f8fafc',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '1rem'
                        }}>
                            <button
                                onClick={handleCancelEdit}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: 'white',
                                    border: '1px solid var(--border)',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    color: 'var(--text-main)',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateFees}
                                disabled={saving || feeRows.every(row => !row.feeTypeId || row.amount <= 0)}
                                className="btn btn-primary"
                                style={{
                                    background: (saving || feeRows.every(row => !row.feeTypeId || row.amount <= 0)) ? '#94a3b8' : 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                                    color: 'white',
                                    padding: '0.75rem 2rem',
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    borderRadius: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    cursor: (saving || feeRows.every(row => !row.feeTypeId || row.amount <= 0)) ? 'not-allowed' : 'pointer',
                                    border: 'none',
                                    boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)',
                                    transition: 'all 0.3s'
                                }}
                            >
                                <Save size={18} />
                                {saving ? 'Updating...' : 'Update Fee Amounts'}
                            </button>
                        </div>
                    </div>

                    {/* Inline animations */}
                    <style>{`
                        @keyframes fadeIn {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                        @keyframes slideUp {
                            from {
                                opacity: 0;
                                transform: translate(-50%, -45%);
                            }
                            to {
                                opacity: 1;
                                transform: translate(-50%, -50%);
                            }
                        }
                    `}</style>
                </>
            )}
        </div>
    );
};

export default SetFeeAmount;
