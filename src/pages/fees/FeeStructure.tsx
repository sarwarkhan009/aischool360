import React, { useState } from 'react';
import {
    Plus,
    Save,
    ChevronRight,
    Home,
    Check,
    Trash2,
    Edit,
    Search,
    FileText,
    Download,
    Printer,
    FileDown
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { db } from '../../lib/firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { getActiveClasses } from '../../constants/app';
import { useSchool } from '../../context/SchoolContext';
import { getAcademicYearMonths } from '../../utils/academicYear';

const FeeStructure: React.FC = () => {
    const { currentSchool } = useSchool();
    const { data: allSettings } = useFirestore<any>('settings');
    const { data: feeTypes, add: addFeeType, update: updateFeeType, remove: removeFeeType } = useFirestore<any>('fee_types');
    const activeClasses = getActiveClasses(allSettings?.filter((d: any) => d.type === 'class') || []).map(c => c.name);

    // Form State
    const [formData, setFormData] = useState({
        feeHeadName: '',
        displayOrder: '',
        feeNature: 'Based On Class',
        status: 'ACTIVE',
        studentTypes: [] as string[],
        months: [] as string[],
        classes: [] as string[],
        financeTypes: [] as string[],
        admissionTypes: [] as string[],
    });

    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const studentTypesList = ['GENERAL', 'TRANSPORT', 'HOSTELER'];
    // Dynamic months based on academic year start month
    const monthsList = getAcademicYearMonths(currentSchool?.academicYearStartMonth || 'April');
    const financeTypesList = ['NORMAL', 'BPL', 'FREE', 'WARD'];
    const admissionTypesList = ['NEW', 'OLD'];

    const toggleList = (list: string[], item: string, setFn: (val: string[]) => void) => {
        if (list.includes(item)) {
            setFn(list.filter(i => i !== item));
        } else {
            setFn([...list, item]);
        }
    };

    const toggleAll = (currentList: string[], fullList: string[], setFn: (val: string[]) => void) => {
        if (currentList.length === fullList.length) {
            setFn([]);
        } else {
            setFn([...fullList]);
        }
    };

    const handleSave = async () => {
        if (!formData.feeHeadName) {
            alert("Please enter Fee Head Name");
            return;
        }
        try {
            if (editingId) {
                await updateFeeType(editingId, {
                    ...formData,
                    updatedAt: new Date().toISOString()
                });
                alert("Fee details updated successfully!");
            } else {
                await addFeeType({
                    ...formData,
                    createdAt: new Date().toISOString()
                });
                alert("Fee details saved successfully!");
            }
            handleNew();
        } catch (e) {
            console.error(e);
            alert("Error saving: " + (e as Error).message);
        }
    };

    const handleNew = () => {
        setFormData({
            feeHeadName: '',
            displayOrder: '',
            feeNature: 'Based On Class',
            status: 'ACTIVE',
            studentTypes: [],
            months: [],
            classes: [],
            financeTypes: [],
            admissionTypes: [],
        });
        setEditingId(null);
    };

    const handleEdit = (fee: any) => {
        setFormData({
            feeHeadName: fee.feeHeadName || '',
            displayOrder: fee.displayOrder || '',
            feeNature: fee.feeNature || 'Based On Class',
            status: fee.status || 'ACTIVE',
            studentTypes: fee.studentTypes || [],
            months: fee.months || [],
            classes: fee.classes || [],
            financeTypes: fee.financeTypes || [],
            admissionTypes: fee.admissionTypes || [],
        });
        setEditingId(fee.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this fee head?")) {
            try {
                await removeFeeType(id);
                alert("Deleted successfully!");
            } catch (e) {
                alert("Error deleting: " + (e as Error).message);
            }
        }
    };

    const filteredFeeTypes = feeTypes.filter(f =>
        f.feeHeadName?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));

    // Premium Chip Component
    const SelectChip = ({ label, isSelected, onClick }: { label: string, isSelected: boolean, onClick: () => void }) => (
        <button
            onClick={onClick}
            type="button"
            style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'white',
                color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                transition: 'all 0.2s',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: isSelected ? '0 4px 12px rgba(99, 102, 241, 0.2)' : 'none',
            }}
        >
            {isSelected && <Check size={12} />}
            {label}
        </button>
    );

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
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                color: 'white',
                boxShadow: '0 10px 25px rgba(99, 102, 241, 0.3)'
            }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.5rem', letterSpacing: '-0.025em' }}>Define Fee structure</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', opacity: 0.9 }}>
                        <Home size={14} /> Home <ChevronRight size={12} /> Fee <ChevronRight size={12} /> Fee structure Old
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={handleNew} className="btn-glass" style={{
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
                        borderRadius: '12px'
                    }}>
                        <Plus size={18} /> New Model
                    </button>
                    <button onClick={handleSave} className="btn-glass" style={{
                        background: 'white',
                        color: '#6366f1',
                        padding: '0.6rem 1.25rem',
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        borderRadius: '12px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                    }}>
                        <Save size={18} /> {editingId ? 'Update System' : 'Deploy Model'}
                    </button>
                </div>
            </div>

            {/* Main Configuration Matrix */}
            <div className="glass-card" style={{ padding: '0', overflow: 'hidden', marginBottom: '3rem', border: '1px solid var(--border)' }}>
                <div style={{
                    background: 'rgba(245, 243, 255, 0.5)',
                    padding: '1rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    borderBottom: '1px solid var(--border)',
                    backdropFilter: 'blur(5px)'
                }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6366f1' }}></div>
                    <span style={{ color: 'var(--text-main)', fontWeight: 800, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {editingId ? 'Edit Configuration' : 'Schema Creation'}
                    </span>
                </div>

                <div style={{ padding: '2.5rem', display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 1fr', gap: '3rem' }}>
                    {/* Column 1: Core Definitions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div className="input-group">
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Fee Head Name</label>
                            <input
                                type="text"
                                className="input-field-premium"
                                style={{ borderRadius: '12px', padding: '0.75rem' }}
                                value={formData.feeHeadName}
                                onChange={e => setFormData({ ...formData, feeHeadName: e.target.value })}
                                placeholder="e.g. Laboratory Facility Fee"
                            />
                        </div>

                        <div className="input-group">
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Display Priority</label>
                            <input
                                type="number"
                                className="input-field-premium"
                                style={{ borderRadius: '12px', padding: '0.75rem' }}
                                value={formData.displayOrder}
                                onChange={e => setFormData({ ...formData, displayOrder: e.target.value })}
                                placeholder="1"
                            />
                        </div>

                        <div className="input-group">
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Governance Type</label>
                            <select
                                className="input-field-premium"
                                style={{ borderRadius: '12px', padding: '0.75rem' }}
                                value={formData.feeNature}
                                onChange={e => setFormData({ ...formData, feeNature: e.target.value })}
                            >
                                <option value="Based On Class">Class Standardized</option>
                                <option value="Based on Student">Individual Student</option>
                                <option value="Fixed">Global Fixed</option>
                                <option value="Custom">Custom Logic</option>
                            </select>
                        </div>

                        <div className="input-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Target Groups</label>
                                <button
                                    onClick={() => toggleAll(formData.studentTypes, studentTypesList, val => setFormData({ ...formData, studentTypes: val }))}
                                    style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer' }}
                                >
                                    {formData.studentTypes.length === studentTypesList.length ? 'Clear' : 'Select All'}
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {studentTypesList.map(type => (
                                    <SelectChip
                                        key={type}
                                        label={type}
                                        isSelected={formData.studentTypes.includes(type)}
                                        onClick={() => toggleList(formData.studentTypes, type, val => setFormData({ ...formData, studentTypes: val }))}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Column 2: Temporal Mapping */}
                    <div className="input-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Timeline Activation</label>
                            <button
                                onClick={() => toggleAll(formData.months, monthsList, val => setFormData({ ...formData, months: val }))}
                                style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer' }}
                            >
                                {formData.months.length === monthsList.length ? 'Clear All' : 'Full Cycle'}
                            </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            {monthsList.map(month => (
                                <SelectChip
                                    key={month}
                                    label={month.replace('_month', '')}
                                    isSelected={formData.months.includes(month)}
                                    onClick={() => toggleList(formData.months, month, val => setFormData({ ...formData, months: val }))}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Column 3: Academic Boundaries */}
                    <div className="input-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Academic Classes</label>
                            <button
                                onClick={() => toggleAll(formData.classes, activeClasses, val => setFormData({ ...formData, classes: val }))}
                                style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer' }}
                            >
                                {formData.classes.length === activeClasses.length ? 'Clear' : 'All Levels'}
                            </button>
                        </div>
                        <div className="no-scrollbar" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '420px', overflowY: 'auto' }}>
                            {activeClasses.map(cls => (
                                <SelectChip
                                    key={cls}
                                    label={cls}
                                    isSelected={formData.classes.includes(cls)}
                                    onClick={() => toggleList(formData.classes, cls, val => setFormData({ ...formData, classes: val }))}
                                />
                            ))}
                            {activeClasses.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Establish classes in settings first.</span>}
                        </div>
                    </div>

                    {/* Column 4: Financial Filters */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                        <div className="input-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Economic Category</label>
                                <button
                                    onClick={() => toggleAll(formData.financeTypes, financeTypesList, val => setFormData({ ...formData, financeTypes: val }))}
                                    style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer' }}
                                >
                                    {formData.financeTypes.length === financeTypesList.length ? 'Clear' : 'All'}
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {financeTypesList.map(type => (
                                    <SelectChip
                                        key={type}
                                        label={type}
                                        isSelected={formData.financeTypes.includes(type)}
                                        onClick={() => toggleList(formData.financeTypes, type, val => setFormData({ ...formData, financeTypes: val }))}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="input-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Enrollment Type</label>
                                <button
                                    onClick={() => toggleAll(formData.admissionTypes, admissionTypesList, val => setFormData({ ...formData, admissionTypes: val }))}
                                    style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer' }}
                                >
                                    {formData.admissionTypes.length === admissionTypesList.length ? 'Clear' : 'All'}
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {admissionTypesList.map(type => (
                                    <SelectChip
                                        key={type}
                                        label={type}
                                        isSelected={formData.admissionTypes.includes(type)}
                                        onClick={() => toggleList(formData.admissionTypes, type, val => setFormData({ ...formData, admissionTypes: val }))}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="input-group" style={{ marginTop: 'auto' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Operational Status</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={() => setFormData({ ...formData, status: 'ACTIVE' })}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        borderRadius: '12px',
                                        border: formData.status === 'ACTIVE' ? '2px solid #22c55e' : '1px solid var(--border)',
                                        background: formData.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.1)' : 'white',
                                        color: formData.status === 'ACTIVE' ? '#166534' : 'var(--text-muted)',
                                        fontWeight: 800,
                                        fontSize: '0.75rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    ACTIVE
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, status: 'INACTIVE' })}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        borderRadius: '12px',
                                        border: formData.status === 'INACTIVE' ? '2px solid #ef4444' : '1px solid var(--border)',
                                        background: formData.status === 'INACTIVE' ? 'rgba(239, 68, 68, 0.1)' : 'white',
                                        color: formData.status === 'INACTIVE' ? '#991b1b' : 'var(--text-muted)',
                                        fontWeight: 800,
                                        fontSize: '0.75rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    INACTIVE
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Repository Section */}
            <div className="animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ display: 'flex', background: 'white', padding: '0.25rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <button className="btn-icon-minimal" title="Export CSV"><FileDown size={18} /></button>
                            <button className="btn-icon-minimal" title="Export Excel"><Download size={18} /></button>
                            <button className="btn-icon-minimal" title="Print Archive"><Printer size={18} /></button>
                            <button className="btn-icon-minimal" title="Export PDF" style={{ color: '#ef4444' }}><FileText size={18} /></button>
                        </div>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
                        <input
                            type="text"
                            placeholder="Filter architecture models..."
                            className="input-field-premium"
                            style={{ width: '350px', padding: '0.75rem 1rem 0.75rem 2.75rem', borderRadius: '14px', fontSize: '0.875rem', border: '1px solid var(--border)' }}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                        <thead>
                            <tr style={{ background: '#334155', color: 'white', borderBottom: '2px solid var(--border)' }}>
                                <th style={{ padding: '1rem 0.75rem', textAlign: 'left', width: '60px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>#</th>
                                <th style={{ padding: '1rem 0.75rem', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Fee Name</th>
                                <th style={{ padding: '1rem 0.75rem', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Months</th>
                                <th style={{ padding: '1rem 0.75rem', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Class</th>
                                <th style={{ padding: '1rem 0.75rem', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Student Type</th>
                                <th style={{ padding: '1rem 0.75rem', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Fee Type</th>
                                <th style={{ padding: '1rem 0.75rem', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Finance</th>
                                <th style={{ padding: '1rem 0.75rem', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Admission</th>
                                <th style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>Operation</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredFeeTypes.map((fee, index) => (
                                <tr key={fee.id} style={{ borderBottom: '1px solid var(--border)', background: index % 2 === 0 ? 'white' : '#f8fafc' }}>
                                    <td style={{ padding: '0.75rem', borderRight: '1px solid var(--border)', color: 'var(--text-muted)' }}>{index + 1}</td>
                                    <td style={{ padding: '0.75rem', borderRight: '1px solid var(--border)' }}>
                                        <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{fee.feeHeadName}</div>
                                        <div style={{
                                            display: 'inline-block',
                                            fontSize: '0.625rem',
                                            background: fee.status === 'ACTIVE' ? '#64748b' : '#94a3b8',
                                            color: 'white',
                                            padding: '1px 6px',
                                            borderRadius: '3px',
                                            marginTop: '4px',
                                            fontWeight: 700,
                                            textTransform: 'uppercase'
                                        }}>
                                            {fee.status}
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.75rem', borderRight: '1px solid var(--border)', maxWidth: '250px', fontSize: '0.75rem', color: '#64748b' }}>
                                        {fee.months?.length === 13 ? 'April, May, June, July, August, September, October, November, December, January, February, March' : fee.months?.map((m: string) => m.replace('_month', '')).join(', ')}
                                    </td>
                                    <td style={{ padding: '0.75rem', borderRight: '1px solid var(--border)', maxWidth: '150px', fontSize: '0.75rem', color: '#64748b' }}>
                                        {fee.classes?.join(', ')}
                                    </td>
                                    <td style={{ padding: '0.75rem', borderRight: '1px solid var(--border)', fontSize: '0.75rem', color: '#64748b' }}>{fee.studentTypes?.join(', ')}</td>
                                    <td style={{ padding: '0.75rem', borderRight: '1px solid var(--border)', fontSize: '0.75rem', color: '#64748b' }}>{fee.feeNature?.toUpperCase().includes('STUDENT') ? 'STUDENT' : 'CLASS'}</td>
                                    <td style={{ padding: '0.75rem', borderRight: '1px solid var(--border)', fontSize: '0.75rem', color: '#64748b' }}>{fee.financeTypes?.join(', ')}</td>
                                    <td style={{ padding: '0.75rem', borderRight: '1px solid var(--border)', fontSize: '0.75rem', color: '#64748b' }}>{fee.admissionTypes?.join(', ')}</td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem' }}>
                                            <button
                                                onClick={() => handleEdit(fee)}
                                                style={{ padding: '4px', background: '#3b82f6', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(fee.id)}
                                                style={{ padding: '4px', background: '#ef4444', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredFeeTypes.length === 0 && (
                                <tr>
                                    <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No configurations found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', padding: '0 0.5rem' }}>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-main)', fontWeight: 600 }}>
                        Showing 1 to {filteredFeeTypes.length} of {filteredFeeTypes.length} entries
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, cursor: 'not-allowed' }}>Previous</button>
                        <button style={{ width: '32px', height: '32px', background: '#f97316', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 700, fontSize: '0.875rem' }}>1</button>
                        <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, cursor: 'not-allowed' }}>Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FeeStructure;
