import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { CreditCard, Loader2, QrCode, Copy, CheckCircle } from 'lucide-react';

const ParentFeeInfo: React.FC = () => {
    const [bankDetails, setBankDetails] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    useEffect(() => {
        fetchBankDetails();
    }, []);

    const fetchBankDetails = async () => {
        setLoading(true);
        try {
            // Try payment_info first (new system)
            let d = await getDoc(doc(db, 'settings', 'payment_info'));
            if (d.exists()) {
                const data = d.data();
                setBankDetails({
                    accountName: data.accountHolder,
                    accountNumber: data.accountNumber,
                    ifscCode: data.ifscCode,
                    bankName: data.bankName,
                    upiId: data.upiId,
                    qrCodeUrl: data.qrCodeUrl
                });
            } else {
                // Fallback to old bank_details
                d = await getDoc(doc(db, 'settings', 'bank_details'));
                if (d.exists()) setBankDetails(d.data());
            }
        } catch (e) {
            console.error('Failed to fetch bank details:', e);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
                <Loader2 className="animate-spin" size={40} color="var(--primary)" />
            </div>
        );
    }

    if (!bankDetails) {
        return (
            <div className="glass-card" style={{ padding: '4rem', textAlign: 'center' }}>
                <CreditCard size={48} style={{ color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 1rem' }} />
                <h3 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '1.125rem' }}>
                    Payment Information Not Available
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Please contact school administration for payment details.
                </p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="glass-card" style={{ padding: '2.5rem' }}>
                <div style={{ marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '2px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <CreditCard size={24} color="var(--primary)" />
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
                            Payment Information
                        </h2>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Use the details below to make fee payments via bank transfer or UPI
                    </p>
                </div>

                {/* Bank Details Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '1.5rem',
                    marginBottom: '2rem'
                }}>
                    <div className="info-card">
                        <label className="info-label">Account Holder</label>
                        <p className="info-value">{bankDetails.accountName}</p>
                    </div>

                    <div className="info-card">
                        <label className="info-label">Bank Name</label>
                        <p className="info-value">{bankDetails.bankName}</p>
                    </div>

                    <div className="info-card">
                        <label className="info-label">Account Number</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <p className="info-value mono">{bankDetails.accountNumber}</p>
                            <button
                                onClick={() => copyToClipboard(bankDetails.accountNumber, 'account')}
                                className="copy-btn"
                                title="Copy Account Number"
                            >
                                {copiedField === 'account' ? <CheckCircle size={16} /> : <Copy size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="info-card">
                        <label className="info-label">IFSC Code</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <p className="info-value mono">{bankDetails.ifscCode}</p>
                            <button
                                onClick={() => copyToClipboard(bankDetails.ifscCode, 'ifsc')}
                                className="copy-btn"
                                title="Copy IFSC Code"
                            >
                                {copiedField === 'ifsc' ? <CheckCircle size={16} /> : <Copy size={16} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* UPI Section */}
                {bankDetails.upiId && (
                    <div style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        padding: '1.5rem',
                        borderRadius: '1.25rem',
                        marginBottom: '2rem'
                    }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            color: 'rgba(255,255,255,0.8)',
                            textTransform: 'uppercase',
                            marginBottom: '0.5rem',
                            letterSpacing: '0.05em'
                        }}>
                            UPI ID (VPA)
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <p style={{
                                fontSize: '1.25rem',
                                fontWeight: 900,
                                color: 'white',
                                fontFamily: "'JetBrains Mono', 'Roboto Mono', monospace",
                                margin: 0
                            }}>
                                {bankDetails.upiId}
                            </p>
                            <button
                                onClick={() => copyToClipboard(bankDetails.upiId, 'upi')}
                                style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    color: 'white',
                                    border: '1px solid rgba(255,255,255,0.3)',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '0.75rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                            >
                                {copiedField === 'upi' ? (
                                    <>
                                        <CheckCircle size={14} />
                                        COPIED!
                                    </>
                                ) : (
                                    <>
                                        <Copy size={14} />
                                        COPY UPI ID
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* QR Code Section */}
                {bankDetails.qrCodeUrl && (
                    <div style={{
                        background: '#f8fafc',
                        padding: '2rem',
                        borderRadius: '1.5rem',
                        border: '2px dashed #cbd5e1',
                        textAlign: 'center'
                    }}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <QrCode size={24} color="var(--primary)" style={{ margin: '0 auto' }} />
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.5rem' }}>
                                Scan & Pay
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Use any UPI app to scan this QR code
                            </p>
                        </div>

                        <div style={{
                            background: 'white',
                            padding: '1.5rem',
                            borderRadius: '1.25rem',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                            display: 'inline-block',
                            marginBottom: '1rem'
                        }}>
                            <img
                                src={bankDetails.qrCodeUrl}
                                alt="Payment QR Code"
                                style={{
                                    width: '200px',
                                    height: '200px',
                                    objectFit: 'contain',
                                    display: 'block'
                                }}
                            />
                        </div>

                        <a
                            href={bankDetails.qrCodeUrl}
                            download="School_Payment_QR.png"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn"
                            style={{
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                color: 'white',
                                padding: '0.75rem 1.5rem',
                                fontSize: '0.875rem',
                                fontWeight: 700,
                                borderRadius: '0.75rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                textDecoration: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
                            }}
                        >
                            <QrCode size={16} />
                            DOWNLOAD QR CODE
                        </a>
                    </div>
                )}
            </div>

            <style>{`
                .info-card {
                    padding: 1.25rem;
                    background: rgba(99, 102, 241, 0.03);
                    border: 1px solid rgba(99, 102, 241, 0.1);
                    border-radius: 1rem;
                }

                .info-label {
                    display: block;
                    font-size: 0.7rem;
                    font-weight: 800;
                    color: #94a3b8;
                    text-transform: uppercase;
                    margin-bottom: 0.5rem;
                    letter-spacing: 0.05em;
                }

                .info-value {
                    font-weight: 700;
                    color: #1e293b;
                    font-size: 1rem;
                    margin: 0;
                }

                .info-value.mono {
                    font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
                    font-size: 1.125rem;
                    color: var(--primary);
                    font-weight: 800;
                }

                .copy-btn {
                    background: rgba(99, 102, 241, 0.1);
                    color: var(--primary);
                    border: 1px solid rgba(99, 102, 241, 0.2);
                    padding: 0.5rem;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }

                .copy-btn:hover {
                    background: var(--primary);
                    color: white;
                    transform: scale(1.05);
                }

                @media (max-width: 768px) {
                    .info-card {
                        grid-column: span 2;
                    }
                }
            `}</style>
        </div>
    );
};

export default ParentFeeInfo;
