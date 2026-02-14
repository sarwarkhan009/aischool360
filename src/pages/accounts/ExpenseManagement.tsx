import React, { useState, useEffect } from 'react';
import { useFirestore } from '../../hooks/useFirestore';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, Timestamp, where } from 'firebase/firestore';
import { Search, Plus, Trash2, Tag, Edit3 } from 'lucide-react';
import { toProperCase } from '../../utils/formatters';
import { useSchool } from '../../context/SchoolContext';

import { updateDoc } from 'firebase/firestore';

interface Ledger {
    id: string;
    uid?: string;
    name: string;
    type: 'EMPLOYEE' | 'GENERAL';
    balance?: number;
}

interface Transaction {
    id?: string;
    type: 'INCOME' | 'EXPENSE';
    category: 'FEE' | 'SALARY' | 'GENERAL_EXPENSE';
    ledgerId: string;
    ledgerName: string;
    amount: number;
    description: string;
    date: string;
    chalanNo?: string;
    createdAt: any;
}

const ExpenseManagement: React.FC = () => {
    const [ledgers, setLedgers] = useState<Ledger[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddLedger, setShowAddLedger] = useState(false);
    const [newLedgerName, setNewLedgerName] = useState('');
    const [ledgerSearch, setLedgerSearch] = useState('');
    const [editingLedger, setEditingLedger] = useState<Ledger | null>(null);

    const [showAddExpense, setShowAddExpense] = useState(false);
    const [selectedLedger, setSelectedLedger] = useState<Ledger | null>(null);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [expenseData, setExpenseData] = useState({
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        chalanNo: '',
        category: 'SALARY' as 'SALARY' | 'GENERAL_EXPENSE'
    });

    const { currentSchool } = useSchool();
    const { data: employees, loading: employeesLoading } = useFirestore<any>('teachers');
    const {
        data: fetchedLedgers,
        loading: ledgersLoading,
        add: addLedger,
        update: updateLedger,
        remove: removeLedger
    } = useFirestore<any>('ledger_masters');

    const { data: transactions, loading: transactionsLoading, add: addTransaction, update: updateTransaction, remove: removeTransaction } = useFirestore<any>('transactions', [limit(50)]);

    // Combine Ledgers and Employees into a unified list
    useEffect(() => {
        if (!currentSchool?.id || ledgersLoading || employeesLoading) return;

        const employeeLedgers: Ledger[] = (employees || [])
            .filter((emp: any) => emp.status === 'ACTIVE')
            .map((emp: any) => ({
                id: emp.uid || emp.id,
                uid: emp.uid || emp.id,
                name: emp.name,
                type: 'EMPLOYEE' as const
            }));

        const generalLedgers: Ledger[] = (fetchedLedgers || []).map(l => ({
            ...l,
            uid: l.id // Ensure consistency between hook 'id' and component 'uid'
        }));

        setLedgers([...employeeLedgers, ...generalLedgers]);
        setLoading(false);
    }, [employees, fetchedLedgers, ledgersLoading, employeesLoading]);

    const handleAddLedger = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLedgerName.trim()) return;

        try {
            await addLedger({
                name: toProperCase(newLedgerName),
                type: 'GENERAL',
                createdAt: new Date().toISOString()
            });
            setNewLedgerName('');
            setShowAddLedger(false);
        } catch (error) {
            alert('Error adding ledger: ' + (error as Error).message);
        }
    };

    const handleDeleteLedger = async (uid: string) => {
        if (confirm('Are you sure you want to delete this ledger?')) {
            try {
                await removeLedger(uid);
            } catch (error) {
                alert('Error deleting ledger: ' + (error as Error).message);
            }
        }
    };

    const handleUpdateLedger = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingLedger || !newLedgerName.trim()) return;

        try {
            await updateLedger(editingLedger.uid!, {
                name: toProperCase(newLedgerName),
                updatedAt: new Date().toISOString()
            });
            setEditingLedger(null);
            setNewLedgerName('');
            setShowAddLedger(false);
            alert('Ledger updated successfully');
        } catch (error) {
            alert('Error updating ledger: ' + (error as Error).message);
        }
    };

    const handleTransactionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // For new transactions, we need selectedLedger
        // For edits, we use editingTransaction's ledger info if not changed
        if (!expenseData.amount) return;

        try {
            if (editingTransaction) {
                // UPDATE
                await updateTransaction(editingTransaction.id!, {
                    amount: Number(expenseData.amount),
                    description: expenseData.description,
                    chalanNo: expenseData.chalanNo,
                    date: expenseData.date,
                    updatedAt: Timestamp.now()
                });
                alert('Transaction updated successfully');
            } else if (selectedLedger) {
                // CREATE
                await addTransaction({
                    type: 'EXPENSE',
                    category: selectedLedger.type === 'EMPLOYEE' ? 'SALARY' : 'GENERAL_EXPENSE',
                    ledgerId: selectedLedger.uid || selectedLedger.id,
                    ledgerName: selectedLedger.name,
                    amount: Number(expenseData.amount),
                    description: expenseData.description,
                    chalanNo: expenseData.chalanNo,
                    date: expenseData.date,
                    createdAt: Timestamp.now()
                });
                alert('Expense recorded successfully');
            }

            setShowAddExpense(false);
            setEditingTransaction(null);
            setExpenseData({
                amount: '',
                description: '',
                date: new Date().toISOString().split('T')[0],
                chalanNo: '',
                category: 'SALARY'
            });
            setSelectedLedger(null);
        } catch (error) {
            alert('Error processing transaction: ' + (error as Error).message);
        }
    };

    const handleDeleteTransaction = async (id: string) => {
        if (confirm('Are you sure you want to delete this transaction permanently?')) {
            try {
                await removeTransaction(id);
                alert('Transaction deleted');
            } catch (error) {
                alert('Error deleting transaction: ' + (error as Error).message);
            }
        }
    };

    const startEditTransaction = (t: Transaction) => {
        const matchingLedger = ledgers.find(l => (l.uid || l.id) === t.ledgerId);
        if (matchingLedger) setSelectedLedger(matchingLedger);

        setEditingTransaction(t);
        setExpenseData({
            amount: t.amount.toString(),
            description: t.description,
            date: t.date,
            chalanNo: t.chalanNo || '',
            category: t.category as any
        });
        setShowAddExpense(true);
    };

    return (
        <div className="animate-fade-in custom-scrollbar">
            <div className="page-header">
                <div>
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Expense Management</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Manage school expenses and salary disbursements.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowAddLedger(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Plus size={18} /> New Ledger
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                {/* Ledger Management Side */}
                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Tag size={18} color="var(--primary)" /> Ledgers
                        </h3>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Search ledgers..."
                            style={{ paddingLeft: '2.5rem', height: '2.5rem', fontSize: '0.875rem' }}
                            value={ledgerSearch}
                            onChange={(e) => setLedgerSearch(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto' }} className="custom-scrollbar">
                        {ledgers
                            .filter(l => l.name.toLowerCase().includes(ledgerSearch.toLowerCase()))
                            .map((ledger) => (
                                <div
                                    key={ledger.id || ledger.uid}
                                    className="hover-row"
                                    style={{
                                        padding: '0.75rem 1rem',
                                        background: 'var(--bg-main)',
                                        borderRadius: '0.75rem',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        border: '1px solid var(--border)'
                                    }}
                                >
                                    <div
                                        style={{ cursor: 'pointer', flex: 1 }}
                                        onClick={() => {
                                            setSelectedLedger(ledger);
                                            setEditingTransaction(null);
                                            setShowAddExpense(true);
                                        }}
                                    >
                                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{ledger.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: ledger.type === 'EMPLOYEE' ? 'var(--primary)' : 'var(--text-muted)' }}>
                                            {ledger.type === 'EMPLOYEE' ? 'Staff/Teacher' : 'Common Expense'}
                                        </div>
                                    </div>
                                    {ledger.type === 'GENERAL' && (
                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingLedger(ledger);
                                                    setNewLedgerName(ledger.name);
                                                    setShowAddLedger(true);
                                                }}
                                                className="btn-icon"
                                                style={{ color: 'var(--primary)', border: 'none', background: 'transparent' }}
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteLedger(ledger.uid!);
                                                }}
                                                className="btn-icon"
                                                style={{ color: '#ef4444', border: 'none', background: 'transparent' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                    </div>
                </div>

                {/* Recent Transactions List */}
                <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                        <h3 style={{ fontWeight: 700 }}>Recent Transactions</h3>
                    </div>
                    <div style={{ overflowX: 'auto' }} className="custom-scrollbar">
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', background: 'var(--bg-main)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                    <th style={{ padding: '1rem 1.5rem' }}>Date</th>
                                    <th style={{ padding: '1rem 1.5rem' }}>Ledger</th>
                                    <th style={{ padding: '1rem 1.5rem' }}>Category</th>
                                    <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Amount</th>
                                    <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center' }}>Loading...</td></tr>
                                ) : transactions.length === 0 ? (
                                    <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center' }}>No transactions found</td></tr>
                                ) : transactions.map((t) => (
                                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem' }}>{t.date}</td>
                                        <td style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>{t.ledgerName}</td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <span style={{
                                                fontSize: '0.7rem',
                                                padding: '0.2rem 0.5rem',
                                                borderRadius: '1rem',
                                                background: t.category === 'SALARY' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                                                color: t.category === 'SALARY' ? 'var(--primary)' : 'var(--text-muted)',
                                                fontWeight: 700
                                            }}>
                                                {t.category.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: 700, color: t.type === 'EXPENSE' ? '#ef4444' : '#10b981' }}>
                                            {t.type === 'EXPENSE' ? '-' : '+'} ₹{t.amount.toLocaleString()}
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                <button
                                                    onClick={() => startEditTransaction(t)}
                                                    className="btn-icon"
                                                    style={{ color: 'var(--primary)', border: 'none', background: 'transparent' }}
                                                    title="Edit"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTransaction(t.id!)}
                                                    className="btn-icon"
                                                    style={{ color: '#ef4444', border: 'none', background: 'transparent' }}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showAddLedger && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-card animate-scale-in" style={{ width: '400px', padding: '2rem', background: 'white' }}>
                        <h2 style={{ marginBottom: '1.5rem', fontWeight: 800 }}>
                            {editingLedger ? 'Edit Ledger' : 'Add New Ledger'}
                        </h2>
                        <form onSubmit={editingLedger ? handleUpdateLedger : handleAddLedger}>
                            <div className="input-group">
                                <label className="field-label">Ledger Name</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    required
                                    value={newLedgerName}
                                    onChange={e => setNewLedgerName(e.target.value)}
                                    onBlur={e => setNewLedgerName(toProperCase(e.target.value))}
                                    placeholder="e.g. Electricity Bill"
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                <button type="button" className="btn" style={{ flex: 1 }} onClick={() => {
                                    setShowAddLedger(false);
                                    setEditingLedger(null);
                                    setNewLedgerName('');
                                }}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                                    {editingLedger ? 'Update' : 'Save'} Ledger
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showAddExpense && (selectedLedger || editingTransaction) && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-card animate-scale-in" style={{ width: selectedLedger?.type === 'EMPLOYEE' ? '800px' : '500px', padding: '2rem', background: 'white', display: 'flex', gap: '2rem' }}>
                        <div style={{ flex: 1 }}>
                            <h2 style={{ marginBottom: '0.5rem', fontWeight: 800 }}>
                                {editingTransaction ? 'Edit Transaction' : 'Record Expense'}
                            </h2>
                            <p style={{ marginBottom: '1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                Ledger: <strong style={{ color: 'var(--primary)' }}>
                                    {editingTransaction ? editingTransaction.ledgerName : selectedLedger?.name}
                                </strong>
                            </p>
                            <form onSubmit={handleTransactionSubmit}>
                                <div style={{ display: 'grid', gap: '1.25rem' }}>
                                    <div className="input-group">
                                        <label className="field-label">Amount (₹) *</label>
                                        <input
                                            type="number"
                                            className="input-field"
                                            required
                                            value={expenseData.amount}
                                            onChange={e => setExpenseData({ ...expenseData, amount: e.target.value })}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label className="field-label">Date *</label>
                                        <input
                                            type="date"
                                            className="input-field"
                                            required
                                            value={expenseData.date}
                                            onChange={e => setExpenseData({ ...expenseData, date: e.target.value })}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label className="field-label">Chalan Number (Optional)</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            value={expenseData.chalanNo}
                                            onChange={e => setExpenseData({ ...expenseData, chalanNo: e.target.value })}
                                            placeholder="Enter chalan number if any"
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label className="field-label">Description / Remarks</label>
                                        <textarea
                                            className="input-field"
                                            rows={3}
                                            value={expenseData.description}
                                            onChange={e => setExpenseData({ ...expenseData, description: e.target.value })}
                                            onBlur={e => setExpenseData({ ...expenseData, description: toProperCase(e.target.value) })}
                                            placeholder="Add any notes here..."
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                    <button type="button" className="btn" style={{ flex: 1 }} onClick={() => {
                                        setShowAddExpense(false);
                                        setEditingTransaction(null);
                                        setSelectedLedger(null);
                                    }}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                                        {editingTransaction ? 'Update Transaction' : 'Record Transaction'}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Employee Sidebar in Modal */}
                        {selectedLedger?.type === 'EMPLOYEE' && (
                            <div style={{ width: '300px', borderLeft: '1px solid var(--border)', paddingLeft: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div>
                                    <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem' }}>Employee Summary</h4>
                                    {(() => {
                                        const emp = employees?.find((e: any) => (e.uid || e.id) === selectedLedger.id);
                                        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
                                        const empTrans = transactions.filter(t => t.ledgerId === selectedLedger.id && t.date.startsWith(currentMonth));

                                        const totalPaidThisMonth = empTrans.reduce((sum, t) => sum + t.amount, 0);
                                        const monthlySalary = emp?.baseSalary || emp?.salary || 0;
                                        const balance = Number(monthlySalary) - totalPaidThisMonth;

                                        return (
                                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                <div className="glass-card" style={{ padding: '0.75rem', background: 'var(--bg-main)' }}>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Monthly Salary ({currentMonth})</div>
                                                    <div style={{ fontSize: '1.125rem', fontWeight: 800 }}>₹{Number(monthlySalary).toLocaleString()}</div>
                                                </div>
                                                <div className="glass-card" style={{ padding: '0.75rem', background: 'rgba(99, 102, 241, 0.05)' }}>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>Total Paid (This Month)</div>
                                                    <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--primary)' }}>₹{totalPaidThisMonth.toLocaleString()}</div>
                                                </div>
                                                {balance > 0 ? (
                                                    <div className="glass-card" style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.05)' }}>
                                                        <div style={{ fontSize: '0.7rem', color: '#ef4444' }}>Closing Balance (Dues)</div>
                                                        <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ef4444' }}>₹{balance.toLocaleString()}</div>
                                                    </div>
                                                ) : balance < 0 ? (
                                                    <div className="glass-card" style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.05)' }}>
                                                        <div style={{ fontSize: '0.7rem', color: '#10b981' }}>Advance Paid</div>
                                                        <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#10b981' }}>₹{Math.abs(balance).toLocaleString()}</div>
                                                    </div>
                                                ) : (
                                                    <div className="glass-card" style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.05)' }}>
                                                        <div style={{ fontSize: '0.7rem', color: '#10b981' }}>Status</div>
                                                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#10b981' }}>Salary Fully Paid</div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div>
                                    <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Last 3 Activities</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {transactions
                                            .filter(t => t.ledgerId === selectedLedger.id)
                                            .slice(0, 3)
                                            .map(t => (
                                                <div key={t.id} style={{ fontSize: '0.75rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                                        <span style={{ fontWeight: 700 }}>₹{t.amount.toLocaleString()}</span>
                                                        <span style={{ color: 'var(--text-muted)' }}>{t.date}</span>
                                                    </div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {t.description || t.category}
                                                    </div>
                                                </div>
                                            ))}
                                        {transactions.filter(t => t.ledgerId === selectedLedger.id).length === 0 && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No history</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpenseManagement;
