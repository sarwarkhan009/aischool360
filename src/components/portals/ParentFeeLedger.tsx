import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Receipt, History, Info, Wallet, Loader2 } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import { getMonthIndexMap } from '../../utils/academicYear';
import { useSchool } from '../../context/SchoolContext';

interface Props {
    admissionNo: string;
    studentData: any;
}

const ParentFeeLedger: React.FC<Props> = ({ admissionNo, studentData }) => {
    const { currentSchool } = useSchool();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [feeTypes, setFeeTypes] = useState<any[]>([]);
    const [feeAmounts, setFeeAmounts] = useState<any[]>([]);

    useEffect(() => {
        if (admissionNo) {
            fetchHistory();
            fetchMetadata();
        } else {
            setLoading(false);
        }
    }, [admissionNo]);

    const fetchMetadata = async () => {
        try {
            const typesSnap = await getDocs(collection(db, 'fee_types'));
            const amountsSnap = await getDocs(collection(db, 'fee_amounts'));
            setFeeTypes(typesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setFeeAmounts(amountsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error('Metadata fetch failed:', e);
        }
    };

    const fetchHistory = async () => {
        if (!admissionNo) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const q = query(
                collection(db, 'fee_collections'),
                where('admissionNo', '==', admissionNo)
            );
            const snap = await getDocs(q);
            const collections = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            // Sort in memory to avoid index requirement
            collections.sort((a, b) => {
                const dateA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date || 0).getTime();
                const dateB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date || 0).getTime();
                return dateB - dateA;
            });
            setHistory(collections);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const MONTH_MAP = getMonthIndexMap();
    const academicStartMonthIdx = MONTH_MAP[currentSchool?.academicYearStartMonth || 'April'];

    const feeMetrics = React.useMemo(() => {
        if (!studentData || feeTypes.length === 0 || feeAmounts.length === 0) {
            const dues = Number(studentData?.basicDues || 0);
            return { payable: dues, paid: 0, balance: dues, payableDetails: [] };
        }

        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-11
        const sessionStartYear = currentMonth >= academicStartMonthIdx ? currentYear : currentYear - 1;
        const sessionStartDate = new Date(sessionStartYear, academicStartMonthIdx, 1);

        const admType = studentData.admissionType || 'NEW';
        const admDateRaw = studentData.admissionDate ? new Date(studentData.admissionDate) : null;

        let startMonthIdx: number;
        let startYear: number;

        if (admType === 'NEW' && admDateRaw && admDateRaw >= sessionStartDate) {
            startMonthIdx = admDateRaw.getMonth();
            startYear = admDateRaw.getFullYear();
        } else {
            startMonthIdx = academicStartMonthIdx;
            startYear = sessionStartYear;
        }

        let totalPayable = 0;
        const payableDetails: any[] = [];
        const studentAdmMonth = admDateRaw ? admDateRaw.getMonth() : -1;
        const studentAdmYear = admDateRaw ? admDateRaw.getFullYear() : -1;

        feeTypes.forEach(type => {
            if (type.status !== 'ACTIVE') return;

            const matchesAdmType = type.admissionTypes?.includes(admType);
            if (!matchesAdmType) return;

            const matchesStudentType = type.studentTypes?.includes(studentData.studentCategory || 'GENERAL');

            // Check if fee type's classes array includes the student's class
            let matchesClass = type.classes?.includes(studentData.class || '');
            // Fallback: check fee_amounts if fee type classes list is stale
            if (!matchesClass && studentData.class) {
                const hasAmountForClass = feeAmounts.some(fa => fa.feeTypeId === type.id && fa.className === studentData.class);
                if (hasAmountForClass) matchesClass = true;
            }

            if (matchesClass && matchesStudentType) {
                const amountConfig = feeAmounts.find(fa => fa.feeTypeId === type.id && fa.className === studentData.class);
                if (!amountConfig || !amountConfig.amount) return;

                type.months?.forEach((monthName: string) => {
                    let isDue = false;

                    if (monthName === 'Admission_month') {
                        if (admType === 'OLD') {
                            isDue = true;
                        } else if (admType === 'NEW' && studentAdmYear === startYear && studentAdmMonth !== -1) {
                            isDue = true;
                        }
                    } else {
                        const targetMonthIdx = MONTH_MAP[monthName];
                        if (targetMonthIdx !== undefined) {
                            const targetYear = targetMonthIdx < academicStartMonthIdx ? sessionStartYear + 1 : sessionStartYear;
                            const dueDate = new Date(targetYear, targetMonthIdx, 5);

                            if (today >= dueDate) {
                                const monthDate = new Date(targetYear, targetMonthIdx, 1);
                                const sessionStartCompareDate = new Date(startYear, startMonthIdx, 1);
                                if (monthDate >= sessionStartCompareDate) {
                                    isDue = true;
                                }
                            }
                        }
                    }

                    if (isDue) {
                        totalPayable += Number(amountConfig.amount);
                        payableDetails.push({
                            head: type.feeHeadName,
                            month: monthName.replace('_month', ' (Joining Month)'),
                            amount: amountConfig.amount
                        });
                    }
                });
            }
        });

        const totalPaid = history
            .filter(c => c.status !== 'CANCELLED' && (c.date?.toDate ? c.date.toDate() : new Date(c.paymentDate || c.date)) >= sessionStartDate)
            .reduce((sum, c) => sum + (Number(c.paid) || 0), 0);

        return {
            payable: totalPayable,
            paid: totalPaid,
            balance: totalPayable - totalPaid,
            payableDetails
        };
    }, [studentData, feeTypes, feeAmounts, history]);


    return (
        <div className="fee-ledger-container">
            <div className="ledger-grid">
                <div className="status-stacks">
                    {/* Dues Card */}
                    <div className="glass-card" style={{ padding: '2rem', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white' }}>
                        <div className="flex-between mb-15">
                            <div className="flex-center gap-075">
                                <Wallet size={20} />
                                <span className="font-800 text-small uppercase tracking-wide opacity-80">Fee Balance</span>
                            </div>
                            <Info size={18} className="opacity-40" />
                        </div>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.25rem' }}>
                            ₹{Number(feeMetrics.balance || 0).toLocaleString('en-IN')}
                        </h2>
                        <div style={{
                            display: 'inline-block',
                            padding: '0.35rem 0.85rem',
                            borderRadius: '2rem',
                            fontSize: '0.70rem',
                            fontWeight: 900,
                            background: Number(feeMetrics.balance || 0) > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                            color: Number(feeMetrics.balance || 0) > 0 ? '#f87171' : '#34d399',
                            letterSpacing: '0.05em',
                            marginBottom: '1.5rem'
                        }}>
                            {Number(feeMetrics.balance || 0) > 0 ? 'PENDING' : 'FULLY PAID'}
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '1rem',
                            paddingTop: '1.5rem',
                            borderTop: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <div>
                                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Payable</p>
                                <p style={{ fontWeight: 900, fontSize: '1.1rem' }}>₹{feeMetrics.payable?.toLocaleString('en-IN')}</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Paid</p>
                                <p style={{ fontWeight: 900, fontSize: '1.1rem', color: '#34d399' }}>₹{feeMetrics.paid?.toLocaleString('en-IN')}</p>
                            </div>
                        </div>
                    </div>

                    {/* Payable Details Section */}
                    {feeMetrics.payableDetails.length > 0 && (
                        <div className="glass-card payable-card" style={{ padding: '2rem' }}>
                            <div className="flex-center gap-075 mb-15">
                                <Receipt size={20} color="var(--primary)" />
                                <h3 className="section-title">Payable Breakdown</h3>
                            </div>
                            <div className="payable-list">
                                <div className="detail-header">
                                    <span>Description</span>
                                    <span>Amount</span>
                                </div>
                                {feeMetrics.payableDetails.map((pd, idx) => (
                                    <div key={idx} className="detail-item">
                                        <div className="detail-info">
                                            <p className="detail-head">{pd.head}</p>
                                            <p className="detail-month">{pd.month}</p>
                                        </div>
                                        <p className="detail-amount">₹{pd.amount.toLocaleString('en-IN')}</p>
                                    </div>
                                ))}
                                <div className="detail-footer">
                                    <span>Total Payable</span>
                                    <span>₹{feeMetrics.payable.toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Transaction History - Moved here for mobile order */}
                    <div className="glass-card history-card" style={{ padding: '2rem' }}>
                        <div className="flex-between mb-2">
                            <div className="flex-center gap-075">
                                <History size={22} color="var(--primary)" />
                                <h3 className="section-title">Transaction History</h3>
                            </div>
                            <span className="count-badge">{history.length} Receipts</span>
                        </div>

                        {loading ? (
                            <div className="flex-center justify-center p-4">
                                <Loader2 className="animate-spin" color="var(--primary)" />
                            </div>
                        ) : history.length > 0 ? (
                            <>
                                <div className="history-list">
                                    {history.map((fee) => (
                                        <div key={fee.id} className="history-item">
                                            <div className="flex-center gap-1">
                                                <div className="receipt-icon">
                                                    <Receipt size={20} />
                                                </div>
                                                <div>
                                                    <p className="receipt-no">{fee.receiptNo}</p>
                                                    <p className="receipt-meta">{formatDate(fee.date?.toDate ? fee.date.toDate() : (fee.paymentDate || fee.date))} • {fee.paymentMode}</p>
                                                </div>
                                            </div>
                                            <div className="flex-center gap-15">
                                                <div className="text-right">
                                                    <p className="amount-paid">₹{fee.paid?.toLocaleString('en-IN')}</p>
                                                    <span className="paid-tag">PAID</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Total Payment Footer */}
                                <div className="history-total">
                                    <span>Total Paid</span>
                                    <span>₹{history.reduce((sum, fee) => sum + (Number(fee.paid) || 0), 0).toLocaleString('en-IN')}</span>
                                </div>
                            </>
                        ) : (
                            <div className="empty-history">
                                <Receipt size={48} />
                                <p>No payment history found</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>


            <style>{`
                .fee-ledger-container { max-width: 100%; }
                
                /* Desktop: 2-column grid with Transaction History spanning right column */
                .ledger-grid { 
                    display: grid; 
                    grid-template-columns: 1.2fr 1.8fr; 
                    gap: 2rem; 
                }
                
                .status-stacks { 
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 2rem;
                    grid-column: 1 / 2;
                }
                
                /* Desktop: Move Transaction History to right column */
                @media (min-width: 993px) {
                    .history-card {
                        grid-column: 2 / 3;
                        grid-row: 1 / 4;
                    }
                    
                    .payable-card {
                        grid-row: 2;
                    }
                    
                    .bank-details-card {
                        grid-row: 3;
                    }
                }
                
                .bank-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
                .info-item label { display: block; font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 0.25rem; letter-spacing: 0.05em; }
                .info-item p { font-weight: 700; color: #1e293b; font-size: 0.9375rem; word-break: break-all; }
                .mono { font-family: 'JetBrains Mono', 'Roboto Mono', monospace; font-size: 1.1rem !important; color: var(--primary) !important; }

                .payable-list { display: flex; flex-direction: column; gap: 0.5rem; }
                .detail-header { display: flex; justify-content: space-between; padding: 0 0.5rem 0.75rem; border-bottom: 1px solid #f1f5f9; font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
                .detail-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0.5rem; border-bottom: 1px solid #f8fafc; }
                .detail-head { font-weight: 700; color: #1e293b; font-size: 0.875rem; margin: 0; }
                .detail-month { font-size: 0.7rem; color: #64748b; font-weight: 600; margin: 0.1rem 0 0; }
                .detail-amount { font-weight: 800; color: #1e293b; font-size: 0.9375rem; }
                .detail-footer { display: flex; justify-content: space-between; padding: 1rem 0.5rem 0; font-weight: 900; color: var(--primary); font-size: 1rem; border-top: 2px solid #f1f5f9; margin-top: 0.5rem; }
                
                .qr-container { margin-top: 1.5rem; padding: 1.5rem; background: #f8fafc; border-radius: 1.5rem; display: flex; flex-direction: column; align-items: center; border: 1px dashed #cbd5e1; }
                .qr-box { background: white; padding: 1rem; border-radius: 1rem; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
                .qr-box img { width: 120px; height: 120px; object-fit: contain; }
                .qr-label { font-size: 0.75rem; font-weight: 800; color: #64748b; margin-top: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
                
                .count-badge { padding: 0.25rem 0.75rem; background: #eff6ff; color: #3b82f6; border-radius: 2rem; font-size: 0.75rem; font-weight: 800; }
                .history-list { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; }
                .history-item { padding: 1.25rem; border: 1px solid #f1f5f9; border-radius: 1.25rem; display: flex; justify-content: space-between; align-items: center; transition: all 0.3s; }
                .history-item:hover { border-color: var(--primary); background: #f8fafc; transform: translateX(5px); }
                
                .history-total { 
                    display: flex; 
                    justify-content: space-between; 
                    padding: 1.25rem 0.5rem 0; 
                    font-weight: 900; 
                    color: #10b981; 
                    font-size: 1.1rem; 
                    border-top: 2px solid #f1f5f9; 
                    margin-top: 0.5rem; 
                }
                
                .receipt-icon { width: 44px; height: 44px; background: rgba(99, 102, 241, 0.1); color: var(--primary); border-radius: 1rem; display: flex; align-items: center; justify-content: center; }
                .receipt-no { font-weight: 800; color: #1e293b; font-size: 0.9375rem; margin-bottom: 0.1rem; }
                .receipt-meta { font-size: 0.75rem; color: #64748b; font-weight: 600; }
                
                .amount-paid { font-weight: 900; color: #10b981; font-size: 1.1rem; }
                .paid-tag { font-size: 0.625rem; font-weight: 900; color: #94a3b8; background: #f1f5f9; padding: 0.15rem 0.4rem; borderRadius: 0.4rem; }
                
                
                .empty-history { text-align: center; padding: 4rem; color: #cbd5e1; }
                .empty-history p { margin-top: 1rem; font-weight: 700; }
                

                @media (max-width: 992px) {
                    .ledger-grid { grid-template-columns: 1fr; }
                }
                @media (max-width: 768px) {
                    .bank-info-grid { grid-template-columns: 1fr; }
                    .history-item { flex-direction: column; align-items: flex-start; gap: 1rem; }
                    .history-item > div:last-child { width: 100%; flex-direction: row; justify-content: space-between; border-top: 1px solid #f1f5f9; paddingTop: 1rem; }
                }
            `}</style>
        </div>
    );
};

export default ParentFeeLedger;
