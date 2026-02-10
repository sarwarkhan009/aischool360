import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { usePersistence } from '../../hooks/usePersistence';
import { Permission } from '../../types/rbac';

interface Manager {
    id: string;
    name: string;
    mobile: string;
    pin: string;
    permissions: Permission[];
    status: 'ACTIVE' | 'INACTIVE';
}

const ManagerManagement: React.FC = () => {
    const [showModal, setShowModal] = useState(false);
    const [managers, setManagers] = usePersistence<Manager[]>('millat_managers', []);
    const [newManager, setNewManager] = useState({
        name: '',
        mobile: '',
        permissions: [] as Permission[]
    });

    const allPermissions = Object.values(Permission);

    const handleRegister = (e: React.FormEvent) => {
        e.preventDefault();
        const pin = Math.floor(1000 + Math.random() * 9000).toString();
        const id = `MGR${(managers.length + 1).toString().padStart(3, '0')}`;

        const manager: Manager = {
            ...newManager,
            id,
            pin,
            status: 'ACTIVE'
        };

        setManagers([...managers, manager]);
        setShowModal(false);
        setNewManager({ name: '', mobile: '', permissions: [] });
        alert(`Manager created successfully!\nGenerated PIN: ${pin}`);
    };

    const togglePermission = (perm: Permission) => {
        const current = newManager.permissions;
        if (current.includes(perm)) {
            setNewManager({ ...newManager, permissions: current.filter((p: Permission) => p !== perm) });
        } else {
            setNewManager({ ...newManager, permissions: [...current, perm] });
        }
    };

    return (
        <div className="animate-fade-in no-scrollbar">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Manager Accounts</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.0625rem' }}>Create and manage teachers/personnel with administrative privileges.</p>
                </div>
                <button className="btn btn-primary hover-glow" onClick={() => setShowModal(true)}>
                    <UserPlus size={18} /> Add Manager
                </button>
            </div>

            <div className="glass-card animate-slide-up" style={{ padding: '0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', background: 'rgba(248, 250, 252, 0.5)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                            <th style={{ padding: '1.25rem 1.5rem' }}>ID</th>
                            <th style={{ padding: '1.25rem 1.5rem' }}>Manager Name</th>
                            <th style={{ padding: '1.25rem 1.5rem' }}>Mobile</th>
                            <th style={{ padding: '1.25rem 1.5rem' }}>Access PIN</th>
                            <th style={{ padding: '1.25rem 1.5rem' }}>Permissions</th>
                            <th style={{ padding: '1.25rem 1.5rem' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {managers.map((mgr) => (
                            <tr key={mgr.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{mgr.id}</td>
                                <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600 }}>{mgr.name}</td>
                                <td style={{ padding: '1.25rem 1.5rem' }}>{mgr.mobile}</td>
                                <td style={{ padding: '1.25rem 1.5rem' }}>
                                    <div style={{ background: 'var(--bg-main)', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>
                                        {mgr.pin}
                                    </div>
                                </td>
                                <td style={{ padding: '1.25rem 1.5rem' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {mgr.permissions.length} Permissions Active
                                    </div>
                                </td>
                                <td style={{ padding: '1.25rem 1.5rem' }}>
                                    <span style={{ padding: '0.25rem 0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 700 }}>
                                        {mgr.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {managers.length === 0 && (
                            <tr>
                                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No managers created yet. Click "Add Manager" to start.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
                    <div className="glass-card animate-scale-in" style={{ width: '100%', maxWidth: '600px', padding: '2rem', background: 'white', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem' }}>Create Management Account</h2>
                        <form onSubmit={handleRegister} style={{ display: 'grid', gap: '1rem', flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                            <div className="input-group">
                                <label>Full Name</label>
                                <input type="text" className="input-field" required value={newManager.name} onChange={e => setNewManager({ ...newManager, name: e.target.value })} />
                            </div>
                            <div className="input-group">
                                <label>Mobile Number</label>
                                <input type="tel" className="input-field" required value={newManager.mobile} onChange={e => setNewManager({ ...newManager, mobile: e.target.value })} />
                            </div>

                            <div className="input-group">
                                <label>Assign Permissions</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', padding: '1rem', border: '1px solid var(--border)', borderRadius: '0.75rem' }}>
                                    {allPermissions.map((perm) => (
                                        <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={newManager.permissions.includes(perm)}
                                                onChange={() => togglePermission(perm)}
                                            />
                                            {perm.replace(/_/g, ' ')}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', position: 'sticky', bottom: 0, background: 'white', paddingTop: '1rem' }}>
                                <button type="button" className="btn" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Create & Generate PIN</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagerManagement;
