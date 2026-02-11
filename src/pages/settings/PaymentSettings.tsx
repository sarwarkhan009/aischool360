import React, { useState, useEffect, useRef } from 'react';
import {
    CreditCard,
    Smartphone,
    QrCode,
    Save,
    Loader2,
    Banknote,
    User,
    Building2,
    Hash,
    Code,
    X,
    Plus,
    MessageCircle,
    Edit,
    Trash2,
    Upload
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { compressImage } from '../../utils/imageUtils';
import { useSchool } from '../../context/SchoolContext';

const DEFAULT_TEMPLATES = [
    {
        id: 'english',
        name: 'English (Formal)',
        content: "Hello {father_name}, Greetings! This is a friendly reminder regarding the outstanding school fees for {student_name}. The total due amount is ₹{amount}. We request you to kindly clear the dues as soon as possible. Thank you!"
    },
    {
        id: 'hindi',
        name: 'Hindi (Formal)',
        content: "नमस्ते {father_name}, सादर अभिवादन! यह {student_name} की बकाया स्कूल फीस के संबंध में एक विनम्र अनुस्मारक है। कुल देय राशि ₹{amount} है। आपसे अनुरोध है कि कृपया जल्द से जल्द बकाया राशि का भुगतान करें। धन्यवाद!"
    },
    {
        id: 'hinglish',
        name: 'Hinglish (Casual)',
        content: "Hello {father_name}, Namaste! Ye {student_name} ki school fees ke regarding reminder hai. Total due amount ₹{amount} hai. Aapse request hai ki please jaldi se due clear kar dein. Thank you!"
    }
];

const PaymentSettings: React.FC = () => {
    const { currentSchool } = useSchool();
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [paymentInfo, setPaymentInfo] = useState({
        bankName: '',
        accountHolder: '',
        accountNumber: '',
        ifscCode: '',
        upiId: '',
        qrCodeUrl: '',
        whatsappTemplates: DEFAULT_TEMPLATES,
        activeTemplateId: 'english',
        feeCollectionType: 'ADVANCE',
        monthlyFeeDueDate: 5,
        admissionFeeStartRule: 'FROM_ADMISSION_MONTH',
        admissionFeeCutoffDate: 15
    });
    const [editingTemplate, setEditingTemplate] = useState<string | null>(null);

    const qrInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchPaymentInfo = async () => {
            if (!currentSchool?.id) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const docRef = doc(db, 'schools', currentSchool.id, 'settings', 'payment_info');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setPaymentInfo({
                        ...data,
                        whatsappTemplates: (data.whatsappTemplates && data.whatsappTemplates.length > 0) ? data.whatsappTemplates : DEFAULT_TEMPLATES,
                        activeTemplateId: data.activeTemplateId || 'english',
                        feeCollectionType: data.feeCollectionType || 'ADVANCE',
                        monthlyFeeDueDate: data.monthlyFeeDueDate || 5,
                        admissionFeeStartRule: data.admissionFeeStartRule || 'FROM_ADMISSION_MONTH',
                        admissionFeeCutoffDate: data.admissionFeeCutoffDate || 15
                    } as any);
                }
            } catch (error) {
                console.error('Error fetching payment settings:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPaymentInfo();
    }, [currentSchool?.id]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const compressed = await compressImage(file, 800, 800, 0.7);
            setPaymentInfo(prev => ({ ...prev, qrCodeUrl: compressed }));
        } catch (error) {
            console.error('Error uploading QR code:', error);
            alert('Failed to process image');
        }
    };

    const handleSave = async () => {
        if (!currentSchool?.id) {
            alert('School not found!');
            return;
        }

        setIsSaving(true);
        try {
            await setDoc(doc(db, 'schools', currentSchool.id, 'settings', 'payment_info'), {
                ...paymentInfo,
                schoolId: currentSchool.id,
                updatedAt: new Date().toISOString()
            });
            alert('Payment settings updated successfully!');
        } catch (error) {
            console.error('Error saving payment settings:', error);
            alert('Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem' }}>
                <Loader2 className="animate-spin" size={40} color="var(--primary)" />
                <p style={{ fontWeight: 600, color: '#64748b' }}>Loading Payment Settings...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in no-scrollbar">
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Banknote size={24} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '0.25rem' }}>Payment Settings</h1>
                        <p style={{ color: 'var(--text-muted)' }}>Configure bank details and QR codes for collections.</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="btn btn-primary"
                    style={{ padding: '0.75rem 1.5rem', gap: '0.5rem' }}
                >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Save Settings
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* Left: Bank & UPI Form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="glass-card" style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Building2 size={20} />
                            </div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Bank Account Details</h3>
                        </div>

                        <div style={{ display: 'grid', gap: '1.5rem' }}>
                            <div className="input-group">
                                <label className="field-label"><Building2 size={14} /> Bank Name</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={paymentInfo.bankName}
                                    onChange={e => setPaymentInfo({ ...paymentInfo, bankName: e.target.value })}
                                    placeholder="e.g. State Bank of India"
                                />
                            </div>
                            <div className="input-group">
                                <label className="field-label"><User size={14} /> Account Holder Name</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={paymentInfo.accountHolder}
                                    onChange={e => setPaymentInfo({ ...paymentInfo, accountHolder: e.target.value })}
                                    placeholder="e.g. ABC School"
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="input-group">
                                    <label className="field-label"><Hash size={14} /> Account Number</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={paymentInfo.accountNumber}
                                        onChange={e => setPaymentInfo({ ...paymentInfo, accountNumber: e.target.value })}
                                        placeholder="00000000000"
                                    />
                                </div>
                                <div className="input-group">
                                    <label className="field-label"><Code size={14} /> IFSC Code</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={paymentInfo.ifscCode}
                                        onChange={e => setPaymentInfo({ ...paymentInfo, ifscCode: e.target.value })}
                                        placeholder="SBIN0000000"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card" style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Smartphone size={20} />
                            </div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>UPI Settings</h3>
                        </div>

                        <div className="input-group">
                            <label className="field-label"><Hash size={14} /> UPI ID (VPA)</label>
                            <input
                                type="text"
                                className="input-field"
                                value={paymentInfo.upiId}
                                onChange={e => setPaymentInfo({ ...paymentInfo, upiId: e.target.value })}
                                placeholder="school@upi"
                            />
                        </div>
                    </div>
                </div>

                {/* Right: QR Code Upload */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="glass-card" style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <QrCode size={20} />
                            </div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Payment QR Code</h3>
                        </div>

                        <div style={{
                            flex: 1,
                            border: '2px dashed #e2e8f0',
                            borderRadius: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#f8fafc',
                            position: 'relative',
                            overflow: 'hidden',
                            minHeight: '300px'
                        }}>
                            {paymentInfo.qrCodeUrl ? (
                                <>
                                    <img
                                        src={paymentInfo.qrCodeUrl}
                                        alt="Payment QR"
                                        style={{ width: '240px', height: '240px', objectFit: 'contain', background: 'white', padding: '1rem', borderRadius: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                                    />
                                    <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                                        <button
                                            className="btn"
                                            style={{ background: 'white', border: '1px solid var(--border)', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                                            onClick={() => qrInputRef.current?.click()}
                                        >
                                            Change QR
                                        </button>
                                        <button
                                            className="btn"
                                            style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                                            onClick={() => setPaymentInfo({ ...paymentInfo, qrCodeUrl: '' })}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div
                                    style={{ textAlign: 'center', padding: '2rem', cursor: 'pointer' }}
                                    onClick={() => qrInputRef.current?.click()}
                                >
                                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: 'var(--text-muted)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                        <Upload size={32} />
                                    </div>
                                    <p style={{ fontWeight: 700, margin: 0 }}>Click to upload QR Code</p>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Supports JPG, PNG (Max 5MB)</p>
                                </div>
                            )}
                            <input
                                type="file"
                                ref={qrInputRef}
                                style={{ display: 'none' }}
                                onChange={handleFileUpload}
                                accept="image/*"
                            />
                        </div>

                        <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '0.75rem', background: 'rgba(59, 130, 246, 0.05)', color: '#1e40af', fontSize: '0.875rem', display: 'flex', gap: '0.75rem' }}>
                            <div style={{ fontSize: '1rem' }}>ℹ️</div>
                            <p style={{ margin: 0, lineHeight: 1.5 }}>
                                This QR code will be displayed to parents on the fee payment screen and invoices.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Fee Calculation Rules - Full Width */}
            <div className="glass-card" style={{ padding: '2rem', marginTop: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CreditCard size={20} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.25rem' }}>Fee Calculation Rules</h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Configure how fee payables are calculated for new admissions</p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem' }}>
                    {/* Left Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="input-group">
                            <label className="field-label" style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.875rem' }}>Fee Collection Mode</label>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <label style={{ flex: 1, border: `2px solid ${paymentInfo.feeCollectionType === 'ADVANCE' ? '#8b5cf6' : '#e2e8f0'}`, borderRadius: '0.75rem', padding: '1rem', cursor: 'pointer', background: paymentInfo.feeCollectionType === 'ADVANCE' ? 'rgba(139, 92, 246, 0.05)' : 'white', transition: 'all 0.2s' }}>
                                    <input
                                        type="radio"
                                        name="collectionType"
                                        checked={paymentInfo.feeCollectionType === 'ADVANCE'}
                                        onChange={() => setPaymentInfo({ ...paymentInfo, feeCollectionType: 'ADVANCE' })}
                                        style={{ marginRight: '0.5rem' }}
                                    />
                                    <strong>Advance</strong>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 1.25rem' }}>January fee due on 5 Jan</p>
                                </label>
                                <label style={{ flex: 1, border: `2px solid ${paymentInfo.feeCollectionType === 'ARREARS' ? '#8b5cf6' : '#e2e8f0'}`, borderRadius: '0.75rem', padding: '1rem', cursor: 'pointer', background: paymentInfo.feeCollectionType === 'ARREARS' ? 'rgba(139, 92, 246, 0.05)' : 'white', transition: 'all 0.2s' }}>
                                    <input
                                        type="radio"
                                        name="collectionType"
                                        checked={paymentInfo.feeCollectionType === 'ARREARS'}
                                        onChange={() => setPaymentInfo({ ...paymentInfo, feeCollectionType: 'ARREARS' })}
                                        style={{ marginRight: '0.5rem' }}
                                    />
                                    <strong>Arrears</strong>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 1.25rem' }}>January fee due on 5 Feb</p>
                                </label>
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="field-label">Monthly Fee Due Date</label>
                            <input
                                type="number"
                                min="1"
                                max="31"
                                className="input-field"
                                value={paymentInfo.monthlyFeeDueDate}
                                onChange={e => setPaymentInfo({ ...paymentInfo, monthlyFeeDueDate: parseInt(e.target.value) || 5 })}
                                placeholder="5"
                            />
                            <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                                Day of month when fee becomes due (1-31)
                            </small>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="input-group">
                            <label className="field-label" style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.875rem' }}>New Admission Fee Start</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <label style={{ border: `2px solid ${paymentInfo.admissionFeeStartRule === 'FROM_ADMISSION_MONTH' ? '#8b5cf6' : '#e2e8f0'}`, borderRadius: '0.75rem', padding: '1rem', cursor: 'pointer', background: paymentInfo.admissionFeeStartRule === 'FROM_ADMISSION_MONTH' ? 'rgba(139, 92, 246, 0.05)' : 'white', transition: 'all 0.2s' }}>
                                    <input
                                        type="radio"
                                        name="startRule"
                                        checked={paymentInfo.admissionFeeStartRule === 'FROM_ADMISSION_MONTH'}
                                        onChange={() => setPaymentInfo({ ...paymentInfo, admissionFeeStartRule: 'FROM_ADMISSION_MONTH' })}
                                        style={{ marginRight: '0.5rem' }}
                                    />
                                    <strong>From Admission Month</strong>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 1.25rem' }}>Charge from admission month (with cutoff)</p>
                                </label>
                                <label style={{ border: `2px solid ${paymentInfo.admissionFeeStartRule === 'ALWAYS_FROM_APRIL' ? '#8b5cf6' : '#e2e8f0'}`, borderRadius: '0.75rem', padding: '1rem', cursor: 'pointer', background: paymentInfo.admissionFeeStartRule === 'ALWAYS_FROM_APRIL' ? 'rgba(139, 92, 246, 0.05)' : 'white', transition: 'all 0.2s' }}>
                                    <input
                                        type="radio"
                                        name="startRule"
                                        checked={paymentInfo.admissionFeeStartRule === 'ALWAYS_FROM_APRIL'}
                                        onChange={() => setPaymentInfo({ ...paymentInfo, admissionFeeStartRule: 'ALWAYS_FROM_APRIL' })}
                                        style={{ marginRight: '0.5rem' }}
                                    />
                                    <strong>Always from April</strong>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 1.25rem' }}>All admissions start from April</p>
                                </label>
                            </div>
                        </div>

                        {paymentInfo.admissionFeeStartRule === 'FROM_ADMISSION_MONTH' && (
                            <div className="input-group">
                                <label className="field-label">Admission Month Cutoff Date</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="31"
                                    className="input-field"
                                    value={paymentInfo.admissionFeeCutoffDate}
                                    onChange={e => setPaymentInfo({ ...paymentInfo, admissionFeeCutoffDate: parseInt(e.target.value) || 15 })}
                                    placeholder="15"
                                />
                                <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                                    Admission before this date = current month fee, after = next month
                                </small>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* WhatsApp Templates Section - Full Width */}
            <div className="glass-card" style={{ padding: '2rem', marginTop: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(37, 211, 102, 0.1)', color: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <MessageCircle size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.25rem' }}>WhatsApp Reminder Templates</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Customize the message sent to parents for fee reminders.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            const newId = `custom_${Date.now()}`;
                            const newTemplates = [...(paymentInfo.whatsappTemplates || []), { id: newId, name: 'New Template', content: '' }];
                            setPaymentInfo({ ...paymentInfo, whatsappTemplates: newTemplates });
                            setEditingTemplate(newId);
                        }}
                        className="btn"
                        style={{ border: '1px solid var(--border)', fontSize: '0.875rem' }}
                    >
                        <Plus size={16} /> Add New Template
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {(paymentInfo.whatsappTemplates || []).map((template: any) => (
                        <div
                            key={template.id}
                            style={{
                                border: paymentInfo.activeTemplateId === template.id ? '2px solid #25D366' : '1px solid var(--border)',
                                borderRadius: '1rem',
                                padding: '1.5rem',
                                background: paymentInfo.activeTemplateId === template.id ? 'rgba(37, 211, 102, 0.05)' : 'white',
                                position: 'relative',
                                transition: 'all 0.2s',
                                cursor: 'pointer'
                            }}
                            onClick={() => setPaymentInfo({ ...paymentInfo, activeTemplateId: template.id })}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {template.name}
                                    {paymentInfo.activeTemplateId === template.id && (
                                        <span style={{ fontSize: '0.625rem', background: '#25D366', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '1rem' }}>ACTIVE</span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingTemplate(template.id);
                                        }}
                                        className="btn-icon"
                                        style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                                    >
                                        <Edit size={14} />
                                    </button>
                                    {!['english', 'hindi', 'hinglish'].includes(template.id) && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const newTemplates = paymentInfo.whatsappTemplates.filter((t: any) => t.id !== template.id);
                                                let newActive = paymentInfo.activeTemplateId;
                                                if (newActive === template.id) newActive = newTemplates[0]?.id || '';
                                                setPaymentInfo({ ...paymentInfo, whatsappTemplates: newTemplates, activeTemplateId: newActive });
                                            }}
                                            className="btn-icon"
                                            style={{ width: '28px', height: '28px', borderRadius: '6px', color: '#ef4444', borderColor: '#fee2e2', background: '#fef2f2' }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {editingTemplate === template.id ? (
                                <div onClick={e => e.stopPropagation()}>
                                    <input
                                        type="text"
                                        value={template.name}
                                        onChange={(e) => {
                                            const updated = paymentInfo.whatsappTemplates.map((t: any) => t.id === template.id ? { ...t, name: e.target.value } : t);
                                            setPaymentInfo({ ...paymentInfo, whatsappTemplates: updated });
                                        }}
                                        className="input-field"
                                        style={{ marginBottom: '0.75rem', padding: '0.5rem' }}
                                        placeholder="Template Name"
                                    />
                                    <textarea
                                        value={template.content}
                                        onChange={(e) => {
                                            const updated = paymentInfo.whatsappTemplates.map((t: any) => t.id === template.id ? { ...t, content: e.target.value } : t);
                                            setPaymentInfo({ ...paymentInfo, whatsappTemplates: updated });
                                        }}
                                        className="input-field"
                                        style={{ minHeight: '120px', fontSize: '0.875rem', lineHeight: 1.5, resize: 'vertical' }}
                                        placeholder="Enter message template..."
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                        <button
                                            onClick={() => setEditingTemplate(null)}
                                            className="btn"
                                            style={{ background: '#25D366', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.75rem', height: 'auto', border: 'none' }}
                                        >
                                            Done
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                    {template.content || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>No content defined</span>}
                                </p>
                            )}

                            <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', background: '#f8fafc', padding: '0.5rem', borderRadius: '6px' }}>
                                <strong>Supported Variables:</strong> {'{father_name}'}, {'{student_name}'}, {'{amount}'}, {'{school_name}'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
                .input-group label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.875rem;
                    font-weight: 700;
                    color: #64748b;
                    margin-bottom: 0.5rem;
                }
                .input-field {
                    width: 100%;
                    padding: 0.75rem 1rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 0.75rem;
                    outline: none;
                    transition: all 0.2s;
                    font-size: 0.9375rem;
                    font-weight: 600;
                    background: white;
                }
                .input-field:focus {
                    border-color: var(--primary);
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
                }
                .btn {
                    border-radius: 0.75rem;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .btn-primary {
                    background: var(--primary);
                    color: white;
                    border: none;
                }
                .btn-primary:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                }
            `}</style>
        </div>
    );
};

export default PaymentSettings;
