import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, doc, getDoc, where } from 'firebase/firestore';
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    Calendar,
    Printer,
    Search,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';

interface SummaryStats {
    totalIncome: number;
    totalExpense: number;
    closingBalance: number;
}

const AccountsDashboard: React.FC = () => {
    const [stats, setStats] = useState<SummaryStats>({
        totalIncome: 0,
        totalExpense: 0,
        closingBalance: 0
    });
    const [allTransactions, setAllTransactions] = useState<any[]>([]);
    const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { currentSchool } = useSchool();
    const filterSchoolId = currentSchool?.id;

    // UI Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
    const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

    // Date Range: Start of current month to end of current month
    // Using local date strings to avoid ISO UTC issues
    const getInitialDates = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m + 1, 0).getDate();
        const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        return { start, end };
    };

    const [dateRange, setDateRange] = useState(getInitialDates());

    // dd-mmm-yy formatter
    const formatReportDate = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const day = String(date.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getMonth()];
        const year = String(date.getFullYear()).slice(-2);
        return `${day}-${month}-${year}`;
    };

    useEffect(() => {
        if (currentSchool) {
            // Use currentSchool from context instead of trying to fetch from a generic settings doc
        }
    }, [currentSchool]);

    useEffect(() => {
        if (!filterSchoolId) return;
        setLoading(true);

        const feeQuery = query(
            collection(db, 'fee_collections'),
            where('schoolId', '==', filterSchoolId)
        );
        const transQuery = query(
            collection(db, 'transactions'),
            where('schoolId', '==', filterSchoolId)
        );

        let fees: any[] = [];
        let trans: any[] = [];

        const updateCombined = () => {
            const combined: any[] = [];

            fees.forEach(data => {
                const date = data.paymentDate || (data.date?.toDate ? data.date.toDate().toISOString().split('T')[0] : data.date) || '';
                if (date >= dateRange.start && date <= dateRange.end) {
                    const amount = Number(data.amountPaid || data.paid || 0);
                    combined.push({
                        id: data.id,
                        type: 'INCOME',
                        category: 'STUDENT_FEE',
                        name: data.studentName,
                        amount,
                        date,
                        receiptNo: data.receiptNo || '-',
                        description: `Fee Collection - ${data.admissionNo || ''}`
                    });
                }
            });

            trans.forEach(data => {
                const date = data.date;
                if (date >= dateRange.start && date <= dateRange.end) {
                    const amount = Number(data.amount || 0);
                    combined.push({
                        id: data.id,
                        type: data.type,
                        category: data.category,
                        name: data.ledgerName || 'General',
                        amount,
                        date,
                        receiptNo: data.chalanNo || data.voucherNo || data.referenceNo || '-',
                        description: data.description || '-'
                    });
                }
            });

            setAllTransactions(combined);
            setLoading(false);
        };

        const unsubFees = onSnapshot(feeQuery, (snapshot) => {
            fees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateCombined();
        });

        const unsubTrans = onSnapshot(transQuery, (snapshot) => {
            trans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateCombined();
        });

        return () => {
            unsubFees();
            unsubTrans();
        };
    }, [dateRange, filterSchoolId]);

    // Apply filtering and sorting
    useEffect(() => {
        let result = [...allTransactions];

        // Search
        if (searchTerm) {
            const lowSearch = searchTerm.toLowerCase();
            result = result.filter(t =>
                t.name?.toLowerCase().includes(lowSearch) ||
                t.receiptNo?.toLowerCase().includes(lowSearch) ||
                t.description?.toLowerCase().includes(lowSearch) ||
                t.category?.toLowerCase().includes(lowSearch)
            );
        }

        // Type Filter
        if (typeFilter !== 'ALL') {
            result = result.filter(t => t.type === typeFilter);
        }

        // Sort
        result.sort((a, b) => {
            const comparison = a.date.localeCompare(b.date);
            return sortOrder === 'ASC' ? comparison : -comparison;
        });

        setFilteredTransactions(result);

        // Recalculate stats for the visible filter
        let tIncome = 0;
        let tExpense = 0;
        result.forEach(t => {
            if (t.type === 'INCOME') tIncome += t.amount;
            else tExpense += t.amount;
        });

        setStats({
            totalIncome: tIncome,
            totalExpense: tExpense,
            closingBalance: tIncome - tExpense
        });

    }, [allTransactions, searchTerm, typeFilter, sortOrder]);

    return (
        <div className="animate-fade-in no-scrollbar report-container">
            <style>
                {`
                    @media print {
                        nav, aside, header, .no-print, .btn, .page-header {
                            display: none !important;
                        }
                        .report-container {
                            width: 100% !important;
                            padding: 0 !important;
                            margin: 0 !important;
                        }
                        .glass-card {
                            border: 1px solid #eee !important;
                            box-shadow: none !important;
                            background: white !important;
                            color: black !important;
                        }
                        .summary-cards {
                            display: grid !important;
                            grid-template-columns: repeat(3, 1fr) !important;
                            gap: 10px !important;
                            margin-bottom: 20px !important;
                        }
                        .summary-card {
                            background: #f8f9fa !important;
                            color: black !important;
                            padding: 10px !important;
                            border: 1px solid #ddd !important;
                        }
                        .summary-card div {
                            color: black !important;
                            opacity: 1 !important;
                        }
                        table {
                            width: 100% !important;
                            border-collapse: collapse !important;
                        }
                        th, td {
                            border: 1px solid #eee !important;
                            padding: 8px !important;
                            color: black !important;
                            background: white !important;
                        }
                        .print-header {
                            display: block !important;
                            text-align: center;
                            margin-bottom: 30px;
                            border-bottom: 2px solid #333;
                            padding-bottom: 20px;
                        }
                        .no-scrollbar::-webkit-scrollbar { display: none; }
                    }
                    .print-header {
                        display: none;
                    }
                    .filter-btn {
                        padding: 0.5rem 1rem;
                        border-radius: 0.5rem;
                        border: 1px solid var(--border);
                        background: var(--bg-main);
                        color: var(--text-muted);
                        font-size: 0.875rem;
                        cursor: pointer;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        font-weight: 600;
                    }
                    .filter-btn.active {
                        background: var(--primary);
                        color: white !important;
                        border-color: var(--primary);
                    }
                `}
            </style>

            {/* Hidden Printing Header */}
            <div className="print-header">
                <h1 style={{ fontSize: '24px', margin: '0 0 5px 0', textTransform: 'uppercase', color: 'black' }}>{currentSchool?.name || 'School Name'}</h1>
                <p style={{ margin: '0 0 5px 0', color: 'black' }}>{currentSchool?.address || 'School Address'}</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '14px', color: 'black' }}>
                    <span>Phone: {currentSchool?.phone}</span>
                    <span>Email: {currentSchool?.email}</span>
                </div>
                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <h2 style={{ fontSize: '18px', margin: 0, textDecoration: 'underline', color: 'black' }}>Financial Report</h2>
                    <p style={{ fontSize: '14px', marginTop: '5px', color: 'black' }}>Period: {formatReportDate(dateRange.start)} to {formatReportDate(dateRange.end)}</p>
                </div>
            </div>

            <div className="page-header no-print">
                <div>
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Accounts Dashboard</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Financial overview of school income and expenses.</p>
                </div>

                <div className="glass-card" style={{
                    padding: '0.6rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    border: '1px solid var(--border)',
                    background: 'white',
                    borderRadius: '50px',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.4rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Calendar size={18} color="var(--primary)" />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <input
                                    type="date"
                                    style={{
                                        border: 'none',
                                        background: 'transparent',
                                        fontSize: '0.9rem',
                                        color: 'var(--text-main)',
                                        fontWeight: 700,
                                        outline: 'none',
                                        cursor: 'pointer',
                                        width: '120px'
                                    }}
                                    value={dateRange.start}
                                    onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                                />
                            </div>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>to</span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <input
                                    type="date"
                                    style={{
                                        border: 'none',
                                        background: 'transparent',
                                        fontSize: '0.9rem',
                                        color: 'var(--text-main)',
                                        fontWeight: 700,
                                        outline: 'none',
                                        cursor: 'pointer',
                                        width: '120px'
                                    }}
                                    value={dateRange.end}
                                    onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="glass-card summary-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.5rem', borderRadius: '0.75rem' }}><TrendingUp size={24} className="no-print" /></div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, background: 'rgba(255,255,255,0.2)', padding: '0.25rem 0.5rem', borderRadius: '2rem' }}>INCOME</div>
                    </div>
                    <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Total Revenue</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800 }}>₹{stats.totalIncome.toLocaleString()}</div>
                </div>

                <div className="glass-card summary-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white', border: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.5rem', borderRadius: '0.75rem' }}><TrendingDown size={24} className="no-print" /></div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, background: 'rgba(255,255,255,0.2)', padding: '0.25rem 0.5rem', borderRadius: '2rem' }}>EXPENSES</div>
                    </div>
                    <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Total Expenses</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800 }}>₹{stats.totalExpense.toLocaleString()}</div>
                </div>

                <div className="glass-card summary-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: 'white', border: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.5rem', borderRadius: '0.75rem' }}><Wallet size={24} className="no-print" /></div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, background: 'rgba(255,255,255,0.2)', padding: '0.25rem 0.5rem', borderRadius: '2rem' }}>BALANCE</div>
                    </div>
                    <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Closing Balance</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800 }}>₹{stats.closingBalance.toLocaleString()}</div>
                </div>
            </div>

            {/* Detailed Transactions List */}
            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }} className="no-print">
                    <div style={{ position: 'relative', minWidth: '300px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Search name, receipt #, category, description..."
                            style={{ paddingLeft: '2.8rem' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', background: 'var(--bg-main)', padding: '0.25rem', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
                            <button
                                className={`filter-btn ${typeFilter === 'INCOME' ? 'active' : ''}`}
                                onClick={() => setTypeFilter(typeFilter === 'INCOME' ? 'ALL' : 'INCOME')}
                            >
                                Incomes
                            </button>
                            <button
                                className={`filter-btn ${typeFilter === 'EXPENSE' ? 'active' : ''}`}
                                onClick={() => setTypeFilter(typeFilter === 'EXPENSE' ? 'ALL' : 'EXPENSE')}
                            >
                                Expenses
                            </button>
                        </div>

                        <button
                            className="filter-btn"
                            onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
                        >
                            Sort Date {sortOrder === 'DESC' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                        </button>

                        <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.6rem 1rem' }} onClick={() => window.print()}>
                            <Printer size={14} style={{ marginRight: '0.4rem' }} /> Print
                        </button>
                    </div>
                </div>

                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }} className="print-header">
                    <h3 style={{ fontWeight: 700 }}>Transaction History</h3>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', background: 'var(--bg-main)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                <th style={{ padding: '1rem 1.5rem' }}>Date</th>
                                <th style={{ padding: '1rem 1.5rem' }}>Receipt#/Chalan#</th>
                                <th style={{ padding: '1rem 1.5rem' }}>Name / Ledger</th>
                                <th style={{ padding: '1rem 1.5rem' }}>Category</th>
                                <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Income (₹)</th>
                                <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Expense (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center' }}>Loading intelligence...</td></tr>
                            ) : filteredTransactions.length === 0 ? (
                                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center' }}>No transactions found for this period</td></tr>
                            ) : filteredTransactions.map((t) => (
                                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover-row">
                                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem' }}>{formatReportDate(t.date)}</td>
                                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)' }}>{t.receiptNo}</td>
                                    <td style={{ padding: '1rem 1.5rem' }}>
                                        <div style={{ fontWeight: 700 }}>{t.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.description}</div>
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem' }}>
                                        <span style={{
                                            fontSize: '0.7rem',
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '1rem',
                                            background: t.type === 'INCOME' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                            color: t.type === 'INCOME' ? '#10b981' : '#ef4444',
                                            fontWeight: 700
                                        }}>
                                            {t.category ? t.category.replace('_', ' ') : '-'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                        {t.type === 'INCOME' ? `+₹${t.amount.toLocaleString()}` : '-'}
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>
                                        {t.type === 'EXPENSE' ? `-₹${t.amount.toLocaleString()}` : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr style={{ background: 'var(--bg-main)', fontWeight: 800 }}>
                                <td colSpan={4} style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>SUMMARY TOTALS:</td>
                                <td style={{ padding: '1rem 1.5rem', textAlign: 'right', color: '#10b981' }}>₹{stats.totalIncome.toLocaleString()}</td>
                                <td style={{ padding: '1rem 1.5rem', textAlign: 'right', color: '#ef4444' }}>₹{stats.totalExpense.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AccountsDashboard;
