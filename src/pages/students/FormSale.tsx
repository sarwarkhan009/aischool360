import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';
import { db } from '../../lib/firebase';
import { collection, addDoc, Timestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import {
    Users,
    Receipt,
    Search,
    FileText,
    Printer,
    CheckCircle,
    AlertCircle,
    Home,
    ChevronRight,
    MessageCircle,
    Calendar,
    ArrowLeft,
    Settings,
    Edit3,
    Languages,
    Save,
    Trash2
} from 'lucide-react';
import { formatDate, formatDateTime, getCurrentDate } from '../../utils/dateUtils';
import { getActiveClasses } from '../../constants/app';
import FeeReceipt from '../../components/fees/FeeReceipt';

const FormSale: React.FC = () => {
    const { schoolId } = useParams();
    const navigate = useNavigate();
    const { currentSchool } = useSchool();
    const [activeTab, setActiveTab] = useState<'form-sale' | 'reporting' | 'messages'>('form-sale');

    // Message Templates State
    const [msgTemplates, setMsgTemplates] = useState({
        english: 'Dear Parent, Welcome to {schoolName}. Also fill this form - {regLink}',
        hindi: 'नमस्ते अभिभावक, {schoolName} में आपका स्वागत है। कृपया यह फॉर्म भी भरें - {regLink}',
        hinglish: 'Dear Parent, {schoolName} mein aapka swagat hai. Please ye form bhi fill karein - {regLink}',
        activeType: 'english' as 'english' | 'hindi' | 'hinglish'
    });
    const [savingMessages, setSavingMessages] = useState(false);

    // Form Sale State
    const [studentName, setStudentName] = useState('');
    const [studentClass, setStudentClass] = useState('');
    const [whatsappNumber, setWhatsappNumber] = useState('');

    // Firestore hooks
    const { data: allSettings } = useFirestore<any>('settings');
    const { data: formSales } = useFirestore<any>('form_sales');
    const { data: feeCollections } = useFirestore<any>('fee_collections');
    const { data: feeTypes } = useFirestore<any>('fee_types');
    const { data: feeAmounts } = useFirestore<any>('fee_amounts');

    // Load message settings from Firestore
    React.useEffect(() => {
        const settings = allSettings?.find((s: any) => s.type === 'form_sale_messages');
        if (settings) {
            setMsgTemplates({
                english: settings.english || msgTemplates.english,
                hindi: settings.hindi || msgTemplates.hindi,
                hinglish: settings.hinglish || msgTemplates.hinglish,
                activeType: settings.activeType || 'english'
            });
        }
    }, [allSettings]);

    // Combine old form sales and new fee collections for form sales
    const allFormSalesForReport = [
        ...formSales.map(s => ({ ...s, source: 'old' })),
        ...feeCollections
            .filter((c: any) => c.admissionNo === 'FORM-SALE')
            .map((c: any) => ({
                id: c.id,
                studentName: c.studentName,
                studentClass: c.class,
                whatsappNumber: c.mobileNo,
                formAmount: c.paid || c.total || '0',
                receiptNo: c.receiptNo,
                saleDate: c.date,
                source: 'new'
            }))
    ];

    // Get active classes
    const activeClasses = getActiveClasses(allSettings?.filter((d: any) => d.type === 'class') || []);
    const classesList = activeClasses.map((c: any) => c.name);

    // Get Form Sale fee head
    const formSaleFeeHead = feeTypes.find((f: any) => f.feeHeadName === 'Form Sale');

    // Get form amount for selected class
    const getFormAmountForClass = (className: string) => {
        if (!formSaleFeeHead || !className) return '0';

        const feeAmountRecord = feeAmounts.find((fa: any) =>
            fa.feeTypeId === formSaleFeeHead.id &&
            fa.className === className
        );

        return feeAmountRecord?.amount || '0';
    };

    // Search and filter for reporting
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState<'this-month' | 'last-month' | 'lifetime'>('this-month');
    const [currentReceipt, setCurrentReceipt] = useState<any | null>(null);

    // Filter form sales
    const filteredFormSales = allFormSalesForReport.filter((sale: any) => {
        // Date Filter
        const saleDate = sale.saleDate?.toDate ? sale.saleDate.toDate() : new Date(sale.saleDate || 0);
        const now = new Date();

        if (dateFilter === 'this-month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            if (saleDate < startOfMonth) return false;
        } else if (dateFilter === 'last-month') {
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            if (saleDate < startOfLastMonth || saleDate > endOfLastMonth) return false;
        }

        const q = searchQuery.toLowerCase();
        const saleName = (sale.studentName || '').toLowerCase();
        const saleClass = (sale.studentClass || '').toLowerCase();
        const saleWh = (sale.whatsappNumber || sale.fatherNumber || '').toLowerCase();
        const saleReceipt = (sale.receiptNo || '').toLowerCase();

        return !q ||
            saleName.includes(q) ||
            saleClass.includes(q) ||
            saleWh.includes(q) ||
            saleReceipt.includes(q);
    }).sort((a: any, b: any) => {
        const dateA = a.saleDate?.toDate ? a.saleDate.toDate().getTime() : new Date(a.saleDate || 0).getTime();
        const dateB = b.saleDate?.toDate ? b.saleDate.toDate().getTime() : new Date(b.saleDate || 0).getTime();
        return dateB - dateA;
    });

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!studentName || !studentClass || !whatsappNumber) {
            alert('Please fill all required fields');
            return;
        }

        if (!formSaleFeeHead) {
            alert('Form Sale fee head not found. Please create it in Fee Structure first.');
            return;
        }

        // Navigate to Fee Collection page with Form Sale data
        navigate(`/${schoolId}/fees`, {
            state: {
                formSaleData: {
                    studentName,
                    studentClass,
                    whatsappNumber,
                    formAmount: getFormAmountForClass(studentClass),
                    feeTypeId: formSaleFeeHead.id
                }
            }
        });
    };

    // Handle print/view receipt
    const handlePrintReceipt = (sale: any) => {
        // Transform for unified FeeReceipt component
        const receiptData = sale.source === 'new' ?
            feeCollections.find((c: any) => c.id === sale.id) :
            {
                ...sale,
                date: sale.saleDate,
                admissionNo: 'FORM-SALE',
                paidFor: 'Form Sale',
                total: parseFloat(sale.formAmount),
                paid: parseFloat(sale.formAmount),
                dues: 0,
                paymentMode: 'Cash',
                feeBreakdown: { 'Form Sale': parseFloat(sale.formAmount) }
            };

        setCurrentReceipt(receiptData);
    };

    // Handle WhatsApp Welcome Message
    const handleWhatsAppWelcome = (sale: any) => {
        const number = (sale.whatsappNumber || sale.fatherNumber || '').replace(/[^0-9]/g, '');
        if (!number) {
            alert('No mobile number available');
            return;
        }

        const schoolName = currentSchool?.fullName || currentSchool?.name || 'our school';
        const registrationUrl = `${window.location.origin}/${schoolId}/register`;

        // Get message based on template
        let message = msgTemplates[msgTemplates.activeType as keyof typeof msgTemplates] || msgTemplates.english;
        message = message.replace(/{schoolName}/g, schoolName).replace(/{regLink}/g, registrationUrl);

        const waUrl = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
    };

    // Handle Delete Sale
    const handleDeleteSale = async (sale: any) => {
        if (!window.confirm(`Are you sure you want to delete form sale for "${sale.studentName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const collectionName = sale.source === 'old' ? 'form_sales' : 'fee_collections';
            await deleteDoc(doc(db, collectionName, sale.id));
            alert('Record deleted successfully');
        } catch (error) {
            console.error('Error deleting record:', error);
            alert('Failed to delete record. Please check permissions.');
        }
    };

    // Handle Save Messages
    const handleSaveMessages = async () => {
        setSavingMessages(true);
        try {
            const settingsDoc = allSettings?.find((s: any) => s.type === 'form_sale_messages');
            const data = {
                type: 'form_sale_messages',
                ...msgTemplates,
                updatedAt: Timestamp.now(),
                schoolId: currentSchool?.id
            };

            if (settingsDoc) {
                await updateDoc(doc(db, 'settings', settingsDoc.id), data);
            } else {
                await addDoc(collection(db, 'settings'), data);
            }
            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Error saving message settings:', error);
            alert('Failed to save settings.');
        } finally {
            setSavingMessages(false);
        }
    };

    return (
        <div className="animate-fade-in no-scrollbar" style={{ paddingBottom: '4rem' }}>
            {/* Unified Fee Receipt View */}
            {currentReceipt && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'white',
                    zIndex: 1000,
                    overflowY: 'auto',
                    padding: '2rem'
                }}>
                    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                        <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={() => setCurrentReceipt(null)}
                                className="btn"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f5f9' }}
                            >
                                <ArrowLeft size={18} /> Back to Reports
                            </button>
                        </div>
                        <FeeReceipt
                            receipt={currentReceipt}
                            studentData={{
                                fullName: currentReceipt.studentName,
                                admissionNo: currentReceipt.admissionNo,
                                class: currentReceipt.class || currentReceipt.studentClass,
                                section: currentReceipt.section || '',
                                mobileNo: currentReceipt.mobileNo || currentReceipt.whatsappNumber
                            }}
                            schoolInfo={{
                                name: currentSchool?.fullName || currentSchool?.name || 'AI School 360',
                                logo: currentSchool?.logoUrl || currentSchool?.logo || '',
                                address: currentSchool?.address || '',
                                phone: currentSchool?.phone || '',
                                website: currentSchool?.website || ''
                            }}
                            onClose={() => setCurrentReceipt(null)}
                        />
                    </div>
                </div>
            )}

            {/* Main UI */}
            <div className="no-print">
                {/* Header */}
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
                        <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.5rem', letterSpacing: '-0.025em' }}>Form Sale Management</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', opacity: 0.9 }}>
                            <Home size={14} /> Home <ChevronRight size={12} /> Student Management <ChevronRight size={12} /> Form Sale
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            onClick={() => navigate(`/${schoolId}/fees/structure`)}
                            className="btn-glass"
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
                                borderRadius: '12px'
                            }}
                        >
                            <FileText size={18} /> Fee Structure
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid var(--border)' }}>
                        <button
                            onClick={() => setActiveTab('form-sale')}
                            style={{
                                padding: '1rem 2rem',
                                border: 'none',
                                background: activeTab === 'form-sale' ? 'var(--primary)' : 'transparent',
                                color: activeTab === 'form-sale' ? 'white' : 'var(--text-muted)',
                                fontWeight: 700,
                                fontSize: '0.9375rem',
                                borderRadius: '12px 12px 0 0',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <Receipt size={18} /> Form Sale
                        </button>
                        <button
                            onClick={() => setActiveTab('reporting')}
                            style={{
                                padding: '1rem 2rem',
                                border: 'none',
                                background: activeTab === 'reporting' ? 'var(--primary)' : 'transparent',
                                color: activeTab === 'reporting' ? 'white' : 'var(--text-muted)',
                                fontWeight: 700,
                                fontSize: '0.9375rem',
                                borderRadius: '12px 12px 0 0',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <FileText size={18} /> Reporting
                        </button>
                        <button
                            onClick={() => setActiveTab('messages')}
                            style={{
                                padding: '1rem 2rem',
                                border: 'none',
                                background: activeTab === 'messages' ? 'var(--primary)' : 'transparent',
                                color: activeTab === 'messages' ? 'white' : 'var(--text-muted)',
                                fontWeight: 700,
                                fontSize: '0.9375rem',
                                borderRadius: '12px 12px 0 0',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <Settings size={18} /> Welcome Messages
                        </button>
                    </div>
                </div>

                {/* Form Sale Tab */}
                {activeTab === 'form-sale' && (
                    <div className="glass-card animate-slide-up" style={{ padding: '2.5rem' }}>
                        {!formSaleFeeHead && (
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid #ef4444',
                                borderRadius: '12px',
                                padding: '1rem',
                                marginBottom: '2rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                color: '#991b1b'
                            }}>
                                <AlertCircle size={20} />
                                <div>
                                    <strong>Warning:</strong> "Form Sale" fee head not found. Please create it in Fee Structure first.
                                </div>
                            </div>
                        )}

                        <div style={{
                            background: 'rgba(245, 243, 255, 0.5)',
                            padding: '1rem 1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            borderBottom: '1px solid var(--border)',
                            marginBottom: '2rem',
                            borderRadius: '12px 12px 0 0'
                        }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6366f1' }}></div>
                            <span style={{ color: 'var(--text-main)', fontWeight: 800, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Record Form Sale
                            </span>
                        </div>


                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                                <div className="input-group">
                                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>
                                        Student Name <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="input-field-premium"
                                        style={{ borderRadius: '12px', padding: '0.75rem', width: '100%' }}
                                        value={studentName}
                                        onChange={(e) => setStudentName(e.target.value)}
                                        placeholder="Enter student name"
                                        required
                                    />
                                </div>

                                <div className="input-group">
                                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>
                                        Class <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <select
                                        className="input-field-premium"
                                        style={{ borderRadius: '12px', padding: '0.75rem', width: '100%' }}
                                        value={studentClass}
                                        onChange={(e) => setStudentClass(e.target.value)}
                                        required
                                    >
                                        <option value="">Select Class</option>
                                        {classesList.map((cls) => (
                                            <option key={cls} value={cls}>{cls}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="input-group">
                                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>
                                        WhatsApp Number <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        className="input-field-premium"
                                        style={{ borderRadius: '12px', padding: '0.75rem', width: '100%' }}
                                        value={whatsappNumber}
                                        onChange={(e) => setWhatsappNumber(e.target.value)}
                                        placeholder="Enter WhatsApp number"
                                        required
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStudentName('');
                                        setStudentClass('');
                                        setWhatsappNumber('');
                                    }}
                                    className="btn"
                                    style={{
                                        padding: '0.75rem 2rem',
                                        border: '1px solid var(--border)',
                                        background: 'white',
                                        color: 'var(--text-main)',
                                        fontWeight: 700,
                                        borderRadius: '12px'
                                    }}
                                >
                                    Clear
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary hover-lift hover-glow"
                                    style={{
                                        padding: '0.75rem 2rem',
                                        fontWeight: 700,
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <CheckCircle size={18} /> Record Form Sale
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Reporting Tab */}
                {activeTab === 'reporting' && (
                    <div className="glass-card animate-slide-up" style={{ padding: '0' }}>
                        <div style={{
                            background: 'rgba(245, 243, 255, 0.5)',
                            padding: '1rem 1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid var(--border)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6366f1' }}></div>
                                <span style={{ color: 'var(--text-main)', fontWeight: 800, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Form Sales Report
                                </span>
                            </div>
                            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                                <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Search by name, receipt, class or WhatsApp..."
                                    className="input-field"
                                    style={{ paddingLeft: '2.8rem', background: 'white', borderRadius: '12px', height: '44px' }}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: '#f1f5f9', padding: '4px', borderRadius: '24px' }}>
                                {[
                                    { id: 'this-month', label: 'This Month' },
                                    { id: 'last-month', label: 'Last Month' },
                                    { id: 'lifetime', label: 'Life Time' }
                                ].map((chip) => (
                                    <button
                                        key={chip.id}
                                        onClick={() => setDateFilter(chip.id as any)}
                                        style={{
                                            padding: '0.6rem 1.25rem',
                                            borderRadius: '20px',
                                            fontSize: '0.8125rem',
                                            fontWeight: 700,
                                            background: dateFilter === chip.id ? 'white' : 'transparent',
                                            color: dateFilter === chip.id ? 'var(--primary)' : 'var(--text-muted)',
                                            border: 'none',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            boxShadow: dateFilter === chip.id ? '0 4px 12px rgba(0, 0, 0, 0.08)' : 'none',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {chip.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.875rem', background: '#f8f9fa' }}>
                                        <th style={{ padding: '1.25rem 1rem' }}>Receipt No</th>
                                        <th style={{ padding: '1.25rem 1rem' }}>Student Name</th>
                                        <th style={{ padding: '1.25rem 1rem' }}>Class</th>
                                        <th style={{ padding: '1.25rem 1rem' }}>WhatsApp No</th>
                                        <th style={{ padding: '1.25rem 1rem' }}>Amount</th>
                                        <th style={{ padding: '1.25rem 1rem' }}>Sale Date</th>
                                        <th style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredFormSales.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                <Users size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                                                <div>No form sales recorded yet</div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredFormSales.map((sale: any) => (
                                            <tr key={sale.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s ease' }} className="hover-row">
                                                <td style={{ padding: '1.25rem 1rem' }}>
                                                    <span style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>{sale.receiptNo}</span>
                                                </td>
                                                <td style={{ padding: '1.25rem 1rem' }}>
                                                    <div style={{ fontWeight: 700 }}>{sale.studentName}</div>
                                                </td>
                                                <td style={{ padding: '1.25rem 1rem' }}>
                                                    <span style={{
                                                        background: 'rgba(99, 102, 241, 0.1)',
                                                        color: 'var(--primary)',
                                                        padding: '0.25rem 0.75rem',
                                                        borderRadius: '6px',
                                                        fontSize: '0.8125rem',
                                                        fontWeight: 700
                                                    }}>
                                                        {sale.studentClass}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1.25rem 1rem', fontSize: '0.875rem' }}>
                                                    {sale.whatsappNumber || sale.fatherNumber}
                                                </td>
                                                <td style={{ padding: '1.25rem 1rem' }}>
                                                    <span style={{ fontWeight: 900, color: '#22c55e', fontSize: '1rem' }}>
                                                        ₹ {sale.formAmount || '0'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1.25rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                                    {formatDateTime(sale.saleDate)}
                                                </td>
                                                <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                        <button
                                                            className="btn-icon"
                                                            onClick={() => handlePrintReceipt(sale)}
                                                            title="Print/View Receipt"
                                                            style={{ background: 'var(--primary)', color: 'white', width: '32px', height: '32px' }}
                                                        >
                                                            <Printer size={14} />
                                                        </button>
                                                        <button
                                                            className="btn-icon"
                                                            onClick={() => handleWhatsAppWelcome(sale)}
                                                            title="Send Welcome WhatsApp"
                                                            style={{ background: '#25D366', color: 'white', width: '32px', height: '32px' }}
                                                        >
                                                            <MessageCircle size={14} />
                                                        </button>
                                                        <button
                                                            className="btn-icon"
                                                            onClick={() => handleDeleteSale(sale)}
                                                            title="Delete Record"
                                                            style={{ background: '#ef4444', color: 'white', width: '32px', height: '32px' }}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {filteredFormSales.length > 0 && (
                            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', background: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                    Total Records: {filteredFormSales.length}
                                </div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary)' }}>
                                    Total Amount: ₹ {filteredFormSales.reduce((sum: number, sale: any) => sum + (parseFloat(sale.formAmount) || 0), 0).toFixed(2)}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Welcome Messages Customization Tab */}
                {activeTab === 'messages' && (
                    <div className="glass-card animate-fade-in" style={{ padding: '2.5rem' }}>
                        <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                <Languages size={20} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)' }}>Customize Welcome Message</h3>
                                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Set up templates for WhatsApp welcome messages</p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '2rem' }}>
                            <div className="input-group">
                                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <span style={{ fontWeight: 800, fontSize: '0.8125rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>English Template</span>
                                    <button
                                        onClick={() => setMsgTemplates(prev => ({ ...prev, activeType: 'english' }))}
                                        style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '20px',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            background: msgTemplates.activeType === 'english' ? 'var(--primary)' : '#f1f5f9',
                                            color: msgTemplates.activeType === 'english' ? 'white' : 'var(--text-muted)',
                                            border: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Use Default
                                    </button>
                                </label>
                                <textarea
                                    className="input-field-premium"
                                    style={{ width: '100%', minHeight: '80px', borderRadius: '12px', padding: '1rem' }}
                                    value={msgTemplates.english}
                                    onChange={(e) => setMsgTemplates(prev => ({ ...prev, english: e.target.value }))}
                                    placeholder="Enter English welcome message..."
                                />
                            </div>

                            <div className="input-group">
                                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <span style={{ fontWeight: 800, fontSize: '0.8125rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hindi Template</span>
                                    <button
                                        onClick={() => setMsgTemplates(prev => ({ ...prev, activeType: 'hindi' }))}
                                        style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '20px',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            background: msgTemplates.activeType === 'hindi' ? 'var(--primary)' : '#f1f5f9',
                                            color: msgTemplates.activeType === 'hindi' ? 'white' : 'var(--text-muted)',
                                            border: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Use Default
                                    </button>
                                </label>
                                <textarea
                                    className="input-field-premium"
                                    style={{ width: '100%', minHeight: '80px', borderRadius: '12px', padding: '1rem' }}
                                    value={msgTemplates.hindi}
                                    onChange={(e) => setMsgTemplates(prev => ({ ...prev, hindi: e.target.value }))}
                                    placeholder="हिंदी में मैसेज लिखें..."
                                />
                            </div>

                            <div className="input-group">
                                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <span style={{ fontWeight: 800, fontSize: '0.8125rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hinglish Template</span>
                                    <button
                                        onClick={() => setMsgTemplates(prev => ({ ...prev, activeType: 'hinglish' }))}
                                        style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '20px',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            background: msgTemplates.activeType === 'hinglish' ? 'var(--primary)' : '#f1f5f9',
                                            color: msgTemplates.activeType === 'hinglish' ? 'white' : 'var(--text-muted)',
                                            border: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Use Default
                                    </button>
                                </label>
                                <textarea
                                    className="input-field-premium"
                                    style={{ width: '100%', minHeight: '80px', borderRadius: '12px', padding: '1rem' }}
                                    value={msgTemplates.hinglish}
                                    onChange={(e) => setMsgTemplates(prev => ({ ...prev, hinglish: e.target.value }))}
                                    placeholder="Enter Hinglish welcome message..."
                                />
                            </div>

                            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px dashed #cbd5e1', fontSize: '0.8125rem' }}>
                                <div style={{ fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Available Placeholders:</div>
                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                    <code style={{ background: 'white', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>{'{schoolName}'}</code>
                                    <code style={{ background: 'white', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>{'{regLink}'}</code>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button
                                    onClick={handleSaveMessages}
                                    disabled={savingMessages}
                                    className="btn-premium"
                                    style={{
                                        padding: '0.875rem 2.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        opacity: savingMessages ? 0.7 : 1
                                    }}
                                >
                                    <Save size={18} /> {savingMessages ? 'Saving...' : 'Save All Templates'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Print Styles */}
            <style>{`
                .print-only-container { display: none; }
                @media print {
                    body * { visibility: hidden; pointer-events: none; }
                    .print-only-container { display: block !important; }
                    .printable-receipt, .printable-receipt * { visibility: visible; }
                    .printable-receipt { position: absolute; left: 0; top: 0; width: 100%; }
                    .no-print { display: none !important; }
                    @page { size: A4; margin: 1cm; }
                }
                .hover-row:hover { background: #f8fafc; }
            `}</style>
        </div>
    );
};

export default FormSale;
