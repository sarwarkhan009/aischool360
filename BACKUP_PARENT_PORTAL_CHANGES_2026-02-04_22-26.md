# Code Backup - Parent Portal Fee Controls
**Timestamp**: 2026-02-04 22:26:10 IST  
**Feature**: Parent Portal Controls - Fee Tab & Dues Banner with Discount Detection

---

## Summary of Changes

This backup contains all code changes made to implement parent portal controls for fee visibility, including:
1. Admin controls to show/hide fee tab and dues banner
2. Automatic discount detection (hides payment tab for discounted students)
3. Split payment functionality into two tabs (Payments & Fee Info)
4. PAY NOW button navigation to Fee Info tab

---

## Files Modified

### 1. `src/types/rbac.ts`

**Changes**: Added two new permission constants for parent controls

```typescript
// Inside Permission object (around line 81-83)
export const Permission = {
    // ... existing permissions
    
    // AI Features
    USE_AI_ASSISTANT: 'USE_AI_ASSISTANT',

    // Parent Portal Controls
    PARENT_SHOW_FEE_TAB: 'PARENT_SHOW_FEE_TAB',
    PARENT_SHOW_DUES_BANNER: 'PARENT_SHOW_DUES_BANNER',
} as const;

// Inside DEFAULT_ROLES array (around line 147-156)
{
    role: 'PARENT',
    label: 'Parent',
    permissions: [
        Permission.VIEW_DASHBOARD,
        Permission.VIEW_EXAMS,
        Permission.MANAGE_FEES,
        Permission.VIEW_GALLERY,
        Permission.PARENT_SHOW_FEE_TAB,
        Permission.PARENT_SHOW_DUES_BANNER,
    ],
},
```

---

### 2. `src/pages/settings/UserRoles.tsx`

**Changes**: Added Parent Controls group to permission UI

```typescript
// Inside permissionGroups object (around line 118-130)
const permissionGroups = {
    // ... other groups
    'Roles': [Permission.MANAGE_ROLES, Permission.MANAGE_MANAGERS],
    'Parent Controls': [Permission.PARENT_SHOW_FEE_TAB, Permission.PARENT_SHOW_DUES_BANNER],
    'Master Control': [
        Permission.MANAGE_SETTINGS, Permission.MANAGE_SCHOOLS, Permission.MANAGE_CLASSES,
        // ... other master control permissions
    ],
    'AI Features': [Permission.USE_AI_ASSISTANT],
};
```

---

### 3. `src/pages/portals/ParentDashboard.tsx`

**Changes**: Major updates for discount detection, tab split, and navigation

#### A. Import Additions (line 43-45)
```typescript
import ParentFeeLedger from '../../components/portals/ParentFeeLedger';
import ParentFeeInfo from '../../components/portals/ParentFeeInfo';
import { Permission } from '../../types/rbac';
```

#### B. State Addition (line 88)
```typescript
const [hasDiscountedFee, setHasDiscountedFee] = useState(false);
```

#### C. Discount Detection Logic (inside useEffect, around line 232-287)
```typescript
if (studentSnap.exists()) {
    currentStudentData = studentSnap.data();
    studentIdField = currentStudentData.id;
    setStudentData(currentStudentData);

    // Check if student has discounted fee
    try {
        const studentMonthlyFee = Number(currentStudentData.monthlyFee || 0);
        
        if (studentMonthlyFee > 0) {
            // Fetch fee_types to get default monthly fee for this class
            const feeTypesSnap = await getDocs(collection(db, 'fee_types'));
            const monthlyFeeType = feeTypesSnap.docs.find(d => {
                const data = d.data();
                // Find the fee type that is ACTIVE, applies to this student's class, and has monthly charges
                return data.status === 'ACTIVE' &&
                       data.classes?.includes(currentStudentData.class) &&
                       data.months && data.months.length > 0; // Has monthly charges
            });

            if (monthlyFeeType) {
                // Now get the actual amount for this class from fee_amounts
                const feeAmountsSnap = await getDocs(collection(db, 'fee_amounts'));
                const classMonthlyFee = feeAmountsSnap.docs.find(d => {
                    const data = d.data();
                    return data.feeTypeId === monthlyFeeType.id && 
                           data.className === currentStudentData.class;
                });

                const defaultClassFee = classMonthlyFee ? Number(classMonthlyFee.data().amount || 0) : 0;

                // If student has a custom fee AND it's less than class fee, mark as discounted
                if (defaultClassFee > 0 && studentMonthlyFee < defaultClassFee) {
                    setHasDiscountedFee(true);
                    console.log('🔒 Discounted Fee Detected - Hiding Payment Tab', {
                        studentFee: studentMonthlyFee,
                        classFee: defaultClassFee,
                        class: currentStudentData.class,
                        feeType: monthlyFeeType.data().feeHeadName
                    });
                } else {
                    setHasDiscountedFee(false);
                    console.log('✅ Regular Fee - Showing Payment Tab', {
                        studentFee: studentMonthlyFee,
                        classFee: defaultClassFee
                    });
                }
            } else {
                setHasDiscountedFee(false);
                console.warn('⚠️ No monthly fee type found for class:', currentStudentData.class);
            }
        } else {
            setHasDiscountedFee(false);
        }
    } catch (feeCheckErr) {
        console.warn('⚠️ Fee discount check failed:', feeCheckErr);
        setHasDiscountedFee(false);
    }
}
```

#### D. Tab Configuration Update (line 119-130)
```typescript
const TAB_CONFIG = [
    { id: 'OVERVIEW', label: 'Overview', icon: LayoutDashboard },
    { id: 'ATTENDANCE', label: 'Attendance', icon: CalendarCheck, moduleId: 'attendance' },
    { id: 'FEES', label: 'Payments', icon: CreditCard, moduleId: 'fees' },
    { id: 'FEE_INFO', label: 'Fee Info', icon: Info, moduleId: 'fees' },
    { id: 'ACADEMICS', label: 'Results', icon: Award, moduleId: 'exams' },
    { id: 'HOMEWORK', label: 'Homework', icon: MessageSquare, moduleId: 'homework' },
    { id: 'TIMETABLE', label: 'Schedule', icon: Clock, moduleId: 'calendar' },
    { id: 'COMMUNICATION', label: 'Chat', icon: MessageSquare, moduleId: 'communication' },
    { id: 'LIBRARY', label: 'Library', icon: Library, moduleId: 'library' },
    { id: 'NOTICES', label: 'Notices', icon: Bell, moduleId: 'notices' },
];
```

#### E. Render Content Update (line 664-665)
```typescript
case 'FEES': return <ParentFeeLedger admissionNo={studentData?.admissionNo} studentData={studentData} />;
case 'FEE_INFO': return <ParentFeeInfo />;
```

#### F. Dues Banner Update (line 722-723)
```typescript
{/* Dues Banner - Show if permission enabled (even for discounted students) */}
{feeBalance > 0 && hasPermission(Permission.PARENT_SHOW_DUES_BANNER) && (
```

#### G. PAY NOW Button Update (line 752)
```typescript
onClick={() => { setActiveTab('FEE_INFO'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
```

#### H. Tab Visibility Logic (line 927-935)
```typescript
// 3. Parent Permission Check for Fee Tabs
// FEES tab - Check both permission AND discount status
if (tab.id === 'FEES' && (!hasPermission(Permission.PARENT_SHOW_FEE_TAB) || hasDiscountedFee)) return null;

// FEE_INFO tab - Only check permission (always show for discounted students)
if (tab.id === 'FEE_INFO' && !hasPermission(Permission.PARENT_SHOW_FEE_TAB)) return null;
```

---

### 4. `src/components/portals/ParentFeeLedger.tsx`

**Changes**: Removed Payment Info section, kept only breakdown and history

#### A. Import Update (line 4)
```typescript
import { Receipt, History, Info, Wallet, Loader2 } from 'lucide-react';
```

#### B. State Declarations (line 13-16)
```typescript
const [history, setHistory] = useState<any[]>([]);
const [loading, setLoading] = useState(true);
const [feeTypes, setFeeTypes] = useState<any[]>([]);
const [feeAmounts, setFeeAmounts] = useState<any[]>([]);
```

#### C. useEffect Update (line 19-26)
```typescript
useEffect(() => {
    if (admissionNo) {
        fetchHistory();
        fetchMetadata();
    } else {
        setLoading(false);
    }
}, [admissionNo]);
```

#### D. Removed Functions
- Removed `fetchBankDetails()` function completely
- Removed all bank details rendering (Payment Info section)

---

### 5. `src/components/portals/ParentFeeInfo.tsx`

**NEW FILE CREATED**

```typescript
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
```

---

## Feature Logic Summary

### Tab Visibility Rules:

| Student Type | Admin Setting | Payments Tab | Fee Info Tab | Dues Banner |
|--------------|---------------|--------------|--------------|-------------|
| Regular (₹750 = ₹750) | ON | ✅ Visible | ✅ Visible | ✅ Visible |
| Regular (₹750 = ₹750) | OFF | ❌ Hidden | ❌ Hidden | ❌ Hidden |
| Discounted (₹600 < ₹750) | ON | ❌ Hidden | ✅ Visible | ✅ Visible |
| Discounted (₹600 < ₹750) | OFF | ❌ Hidden | ❌ Hidden | ❌ Hidden |

### Navigation Flow:
1. Parent sees dues banner with outstanding amount
2. Clicks "PAY NOW" button
3. Navigates to "Fee Info" tab
4. Sees bank details, UPI, and QR code
5. Can copy details or scan QR to pay

---

## Files List:
1. ✅ `src/types/rbac.ts` - Permission definitions
2. ✅ `src/pages/settings/UserRoles.tsx` - Admin UI for controls
3. ✅ `src/pages/portals/ParentDashboard.tsx` - Main logic & tabs
4. ✅ `src/components/portals/ParentFeeLedger.tsx` - Payment breakdown & history
5. ✅ `src/components/portals/ParentFeeInfo.tsx` - Payment information (NEW)

---

**End of Backup**  
**Created**: 2026-02-04 22:26:10 IST
