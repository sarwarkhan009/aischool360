import React, { useState, useEffect } from 'react';
import { Shield, ChevronRight, Check, Plus, X, Edit2, Trash2 } from 'lucide-react';
import { Permission, DEFAULT_ROLES } from '../../types/rbac';
import type { Role } from '../../types/rbac';
import { usePersistence } from '../../hooks/usePersistence';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { useSchool } from '../../context/SchoolContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';

interface CustomRole {
    id: string;
    role: Role;
    label: string;
    permissions: Permission[];
    isDefault: boolean;
    status: 'ACTIVE' | 'INACTIVE';
}

import { useFirestore } from '../../hooks/useFirestore';

const UserRoles: React.FC = () => {
    const { currentSchool } = useSchool();
    const [activeTab, setActiveTab] = useState<'ROLES' | 'USERS'>('ROLES');
    const [roles, setRoles] = usePersistence<CustomRole[]>('millat_custom_roles',
        DEFAULT_ROLES.map(r => ({ ...r, id: r.role, isDefault: true, status: 'ACTIVE' }))
    );
    const { data: teachers } = useFirestore<any>('teachers');

    const [selectedRole, setSelectedRole] = useState<CustomRole>(roles[0]);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [userPermissions, setUserPermissions] = usePersistence<Record<string, Permission[]>>('millat_user_overrides', {});
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [editingRole, setEditingRole] = useState<CustomRole | null>(null);

    // Sync roles to Firestore for global persistence
    useEffect(() => {
        // Sanitize ID for Firestore document path
        const safeId = currentSchool?.id?.replace(/\//g, '') || '';
        if (safeId && roles.length > 0) {
            const syncRoles = async () => {
                try {
                    await setDoc(doc(db, 'settings', `role_configs_${safeId}`), {
                        roles,
                        type: 'role_configs',
                        schoolId: currentSchool?.id,
                        updatedAt: new Date().toISOString()
                    }, { merge: true });
                } catch (e) {
                    console.error("Error syncing roles:", e);
                }
            };
            syncRoles();
        }
    }, [roles, currentSchool?.id]);

    // Sync user overrides to Firestore
    useEffect(() => {
        const safeId = currentSchool?.id?.replace(/\//g, '') || '';
        if (safeId && Object.keys(userPermissions).length > 0) {
            const syncOverrides = async () => {
                try {
                    await setDoc(doc(db, 'settings', `user_overrides_${safeId}`), {
                        overrides: userPermissions,
                        type: 'user_overrides',
                        schoolId: currentSchool?.id,
                        updatedAt: new Date().toISOString()
                    }, { merge: true });
                } catch (e) {
                    console.error("Error syncing overrides:", e);
                }
            };
            syncOverrides();
        }
    }, [userPermissions, currentSchool?.id]);

    // Initial Load from Firestore
    useEffect(() => {
        const safeId = currentSchool?.id?.replace(/\//g, '') || '';
        if (!safeId) return;

        const loadConfig = async () => {
            try {
                const [rolesDoc, overridesDoc] = await Promise.all([
                    getDoc(doc(db, 'settings', `role_configs_${safeId}`)),
                    getDoc(doc(db, 'settings', `user_overrides_${safeId}`))
                ]);

                if (rolesDoc.exists()) {
                    setRoles(rolesDoc.data().roles);
                }
                if (overridesDoc.exists()) {
                    setUserPermissions(overridesDoc.data().overrides);
                }
            } catch (e) {
                console.error("Error loading configs:", e);
            }
        };
        loadConfig();
    }, [currentSchool?.id]);

    const permissionGroups = {
        'Dashboard': [Permission.VIEW_DASHBOARD, Permission.VIEW_STATS],
        'Students': [Permission.VIEW_STUDENTS, Permission.ADMIT_STUDENT, Permission.VIEW_REGISTRATIONS, Permission.VIEW_STUDENT_REPORTS, Permission.VIEW_RE_REGISTRATION_REPORTS, Permission.VIEW_DUES_LIST],
        'Employees': [Permission.VIEW_EMPLOYEES, Permission.MANAGE_EMPLOYEES, Permission.MANAGE_PAYROLL, Permission.VIEW_TEACHING_LOGS],
        'Finance': [Permission.COLLECT_FEES, Permission.VIEW_FEE_STRUCTURE, Permission.MANAGE_FEE_STRUCTURE, Permission.SET_FEE_AMOUNT, Permission.VIEW_FEE_REPORTS, Permission.VIEW_DUE_REPORTS],
        'Academic': [
            Permission.MANAGE_ATTENDANCE, Permission.MANAGE_STAFF_ATTENDANCE,
            Permission.VIEW_EXAMS, Permission.MANAGE_EXAMS, Permission.MANAGE_EXAM_TIMETABLE,
            Permission.PRINT_ADMIT_CARDS, Permission.ENTER_MARKS, Permission.PRINT_REPORT_CARDS,
            Permission.GENERATE_QUESTIONS, Permission.VIEW_CALENDAR, Permission.MANAGE_CALENDAR,
            Permission.MANAGE_HOMEWORK, Permission.VIEW_HOMEWORK_REPORTS,
            Permission.VIEW_ROUTINE, Permission.MANAGE_ROUTINE
        ],
        'Accounts': [Permission.VIEW_ACCOUNTS, Permission.MANAGE_ACCOUNTS],
        'Communication': [Permission.MANAGE_NOTICES, Permission.POST_NOTICE, Permission.VIEW_MESSAGES, Permission.VIEW_GALLERY, Permission.MANAGE_GALLERY],
        'Support': [Permission.MANAGE_TRANSPORT, Permission.MANAGE_LIBRARY],
        'Reports': [Permission.VIEW_REPORTS],
        'Roles': [Permission.MANAGE_ROLES, Permission.MANAGE_MANAGERS],
        'Parent Controls': [Permission.PARENT_SHOW_FEE_TAB, Permission.PARENT_SHOW_DUES_BANNER],
        'Master Control': [
            Permission.MANAGE_SETTINGS, Permission.MANAGE_SCHOOLS, Permission.MANAGE_CLASSES,
            Permission.MANAGE_INVENTORY, Permission.MANAGE_INSTITUTION,
            Permission.MANAGE_REGISTRATION_FIELDS, Permission.MANAGE_ADMISSION_FIELDS,
            Permission.MANAGE_PRINT_DESIGN, Permission.MANAGE_API_KEYS, Permission.MANAGE_DATA_SEEDER,
            Permission.MANAGE_MASTER_CONTROL, Permission.MANAGE_PAYMENT_SETTINGS,
            Permission.UPLOAD_HOLIDAYS, Permission.MANAGE_ACADEMIC_STRUCTURE
        ],
        'AI Features': [Permission.USE_AI_ASSISTANT],
    };

    const { hasPermission: currentUserHasPermission } = useAuth();

    const togglePermission = (perm: Permission) => {
        if (activeTab === 'ROLES') {
            if (!selectedRole) return;
            // Admins have all permissions locked except for USE_AI_ASSISTANT
            if (selectedRole.role === 'ADMIN' && perm !== Permission.USE_AI_ASSISTANT) return;
            const hasPerm = selectedRole.permissions.includes(perm);
            const newPerms = hasPerm
                ? selectedRole.permissions.filter((p: Permission) => p !== perm)
                : [...selectedRole.permissions, perm];

            const updatedRole = { ...selectedRole, permissions: newPerms };
            setSelectedRole(updatedRole);
            setRoles(roles.map(r => r.id === updatedRole.id ? updatedRole : r));
        } else {
            if (!selectedUser) return;
            const userId = selectedUser.uid || selectedUser.id;

            // Fallback Priority: Existing Override > Current Role Config > Default Role Config
            const roleConfig = roles.find(r => r.role === 'TEACHER');
            const currentPerms = userPermissions[userId]
                || roleConfig?.permissions
                || DEFAULT_ROLES.find(r => r.role === 'TEACHER')?.permissions
                || [];

            const hasPerm = currentPerms.includes(perm);
            const newPerms = hasPerm
                ? currentPerms.filter((p: Permission) => p !== perm)
                : [...currentPerms, perm];

            setUserPermissions({ ...userPermissions, [userId]: newPerms });
        }
    };

    const handleCreateRole = () => {
        if (!newRoleName.trim()) return;

        if (editingRole) {
            const updatedRoles = roles.map(r =>
                r.id === editingRole.id ? { ...r, label: newRoleName } : r
            );
            setRoles(updatedRoles);
            if (selectedRole?.id === editingRole.id) {
                setSelectedRole({ ...selectedRole, label: newRoleName });
            }
        } else {
            const newId = newRoleName.toUpperCase().replace(/\s+/g, '_');
            if (roles.find(r => r.id === newId)) {
                alert('A role with this name already exists!');
                return;
            }

            const newRole: CustomRole = {
                id: newId,
                role: 'USER' as Role,
                label: newRoleName,
                permissions: [],
                isDefault: false,
                status: 'ACTIVE'
            };

            setRoles([...roles, newRole]);
            setSelectedRole(newRole);
        }

        setNewRoleName('');
        setEditingRole(null);
        setShowCreateModal(false);
    };

    const handleEditRole = (e: React.MouseEvent, role: CustomRole) => {
        e.stopPropagation();
        setEditingRole(role);
        setNewRoleName(role.label);
        setShowCreateModal(true);
    };

    const handleDeleteRole = (e: React.MouseEvent, roleId: string) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this role? This cannot be undone.')) return;

        const updatedRoles = roles.filter(r => r.id !== roleId);
        setRoles(updatedRoles);
        if (selectedRole?.id === roleId) {
            setSelectedRole(updatedRoles[0]);
        }
    };

    const toggleRoleStatus = (e: React.MouseEvent, roleId: string) => {
        e.stopPropagation();
        const updatedRoles = roles.map(r => {
            if (r.id === roleId) {
                const newStatus = r.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                return { ...r, status: newStatus as 'ACTIVE' | 'INACTIVE' };
            }
            return r;
        });
        setRoles(updatedRoles);

        // Update selected role state if it's the one being toggled
        if (selectedRole?.id === roleId) {
            const updated = updatedRoles.find(r => r.id === roleId);
            if (updated) setSelectedRole(updated);
        }
    };

    const toggleUserStatus = async (user: any) => {
        try {
            const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
            await updateDoc(doc(db, 'teachers', user.uid || user.id), { status: nextStatus });
            if (selectedUser && (selectedUser.uid === user.uid || selectedUser.id === user.id)) {
                setSelectedUser({ ...selectedUser, status: nextStatus });
            }
        } catch (error) {
            alert('Failed to update user status');
        }
    };

    return (
        <div className="animate-fade-in no-scrollbar" style={{ paddingBottom: '3rem' }}>
            <div className="page-header">
                <div>
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.025em' }}>Access Control</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.0625rem' }}>Manage roles, permissions, and individual user access levels.</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', overflowX: 'auto', whiteSpace: 'nowrap' }} className="no-scrollbar">
                <button
                    onClick={() => setActiveTab('ROLES')}
                    style={{
                        padding: '1rem 0',
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: activeTab === 'ROLES' ? 'var(--primary)' : 'var(--text-muted)',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'ROLES' ? '2px solid var(--primary)' : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        flexShrink: 0
                    }}
                >
                    Role Management
                </button>
                <button
                    onClick={() => setActiveTab('USERS')}
                    style={{
                        padding: '1rem 0',
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: activeTab === 'USERS' ? 'var(--primary)' : 'var(--text-muted)',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'USERS' ? '2px solid var(--primary)' : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        flexShrink: 0
                    }}
                >
                    Individual User Access
                </button>
            </div>

            <div className="responsive-settings-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>
                {/* Selection Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {activeTab === 'ROLES' ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-main)' }}>Available Roles</h3>
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="btn-icon"
                                    style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', width: '32px', height: '32px' }}
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                            {roles.filter(r => r.role !== 'SUPER_ADMIN').map((r) => (
                                <div
                                    key={r.id}
                                    onClick={() => setSelectedRole(r)}
                                    className={`glass-card hover-lift ${selectedRole && selectedRole.id === r.id ? 'active-item' : ''}`}
                                    style={{
                                        padding: '1.25rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        border: selectedRole && selectedRole.id === r.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                                        background: selectedRole && selectedRole.id === r.id ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-card)'
                                    }}
                                >
                                    <Shield size={20} color={selectedRole && selectedRole.id === r.id ? 'var(--primary)' : 'var(--text-muted)'} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: r.status === 'INACTIVE' ? 'var(--text-muted)' : 'inherit' }}>
                                            {r.label}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.permissions.length} Features</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        {!r.isDefault && (
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button
                                                    onClick={(e) => handleEditRole(e, r)}
                                                    style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--primary)', opacity: 0.6 }}
                                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteRole(e, r.id)}
                                                    style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: '#ef4444', opacity: 0.6 }}
                                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                        {r.id !== 'ADMIN' && (
                                            <button
                                                onClick={(e) => toggleRoleStatus(e, r.id)}
                                                style={{
                                                    background: r.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                    color: r.status === 'ACTIVE' ? '#10b981' : '#ef4444',
                                                    border: 'none',
                                                    borderRadius: '2rem',
                                                    padding: '0.25rem 0.75rem',
                                                    fontSize: '0.65rem',
                                                    fontWeight: 800,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {r.status === 'ACTIVE' ? 'ENABLED' : 'DISABLED'}
                                            </button>
                                        )}
                                    </div>
                                    <ChevronRight size={18} color="var(--text-muted)" />
                                </div>
                            ))}
                        </>
                    ) : (
                        <>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Teachers & Faculty</h3>
                            {teachers.map((t) => (
                                <div
                                    key={t.uid || t.id}
                                    onClick={() => setSelectedUser(t)}
                                    className={`glass-card hover-lift ${selectedUser && (selectedUser.uid || selectedUser.id) === (t.uid || t.id) ? 'active-item' : ''}`}
                                    style={{
                                        padding: '1.25rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        border: selectedUser && (selectedUser.uid || selectedUser.id) === (t.uid || t.id) ? '2px solid var(--primary)' : '1px solid var(--border)',
                                        background: selectedUser && (selectedUser.uid || selectedUser.id) === (t.uid || t.id) ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-card)'
                                    }}
                                >
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8125rem' }}>
                                        {t.name.split(' ').map((n: string) => n[0]).join('')}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: t.status === 'INACTIVE' ? 'var(--text-muted)' : 'inherit' }}>
                                            {t.name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.designation}</div>
                                    </div>
                                    <div style={{
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: '1rem',
                                        background: t.status === 'INACTIVE' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                        color: t.status === 'INACTIVE' ? '#ef4444' : '#10b981'
                                    }}>
                                        {t.status === 'INACTIVE' ? 'DISABLED' : 'ENABLED'}
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                {/* Permissions Management */}
                <div className="glass-card animate-slide-up" style={{ padding: '2rem' }}>
                    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {activeTab === 'ROLES' ? 'Configuring Role' : 'Customizing User Access'}
                            </span>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>
                                {activeTab === 'ROLES' ? selectedRole?.label : selectedUser?.name || 'Select a user'}
                            </h2>
                        </div>
                        {activeTab === 'USERS' && selectedUser && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: selectedUser.status === 'INACTIVE' ? '#ef4444' : '#10b981' }}>
                                    Account {selectedUser.status === 'INACTIVE' ? 'Disabled' : 'Enabled'}
                                </span>
                                <button
                                    onClick={() => toggleUserStatus(selectedUser)}
                                    style={{
                                        background: selectedUser.status === 'INACTIVE' ? '#10b981' : '#ef4444',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '0.5rem',
                                        padding: '0.5rem 1rem',
                                        fontSize: '0.8125rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {selectedUser.status === 'INACTIVE' ? 'Enable Access' : 'Disable Access'}
                                </button>
                            </div>
                        )}
                    </div>

                    {!selectedRole && activeTab === 'ROLES' ? (
                        <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-muted)' }}>Select a role to manage permissions</div>
                    ) : !selectedUser && activeTab === 'USERS' ? (
                        <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-muted)' }}>Select a user from the sidebar to customize their individual permissions</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2.5rem' }}>
                            {Object.entries(permissionGroups).map(([group, perms]) => {
                                const currentPermissions = activeTab === 'ROLES'
                                    ? (selectedRole?.permissions || [])
                                    : (userPermissions[selectedUser.id] || DEFAULT_ROLES.find(r => r.role === 'TEACHER')?.permissions || []);

                                // Filter perms based on what the CURRENT user actually has access to
                                // This ensures an Admin can't assign permissions they don't have.
                                const availablePerms = perms.filter(p => currentUserHasPermission(p));

                                if (availablePerms.length === 0) return null;

                                return (
                                    <div key={group}>
                                        <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ width: '8px', height: '18px', background: 'var(--primary)', borderRadius: '4px' }} />
                                            {group}
                                        </h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {availablePerms.map(perm => {
                                                const isActive = currentPermissions.includes(perm);
                                                const isLocked = activeTab === 'ROLES' && selectedRole?.role === 'ADMIN' && perm !== Permission.USE_AI_ASSISTANT;

                                                return (
                                                    <div
                                                        key={perm}
                                                        onClick={() => !isLocked && togglePermission(perm)}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            padding: '0.75rem 1rem',
                                                            borderRadius: '0.75rem',
                                                            background: isActive ? 'rgba(99, 102, 241, 0.03)' : 'transparent',
                                                            border: '1px solid',
                                                            borderColor: isActive ? 'rgba(99, 102, 241, 0.2)' : 'var(--border)',
                                                            cursor: isLocked ? 'default' : 'pointer',
                                                            transition: 'all 0.2s ease',
                                                            opacity: isLocked ? 0.7 : 1
                                                        }}
                                                        className={!isLocked ? 'hover-lift' : ''}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <div style={{
                                                                width: '20px',
                                                                height: '20px',
                                                                borderRadius: '6px',
                                                                border: isActive ? 'none' : '2px solid var(--border)',
                                                                background: isActive ? 'var(--primary)' : 'transparent',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: 'white'
                                                            }}>
                                                                {isActive && <Check size={14} />}
                                                            </div>
                                                            <span style={{ fontSize: '0.9375rem', fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                                                {perm.split('_')
                                                                    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                                                                    .join(' ')
                                                                }
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .active-item {
                    transform: translateX(10px);
                    box-shadow: var(--shadow-xl) !important;
                }
            `}</style>

            {/* Create Role Modal */}
            {showCreateModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
                    <div className="glass-card animate-scale-in" style={{ width: '100%', maxWidth: '400px', padding: '2rem', background: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{editingRole ? 'Update Role' : 'Add New Role'}</h2>
                            <button onClick={() => { setShowCreateModal(false); setEditingRole(null); setNewRoleName(''); }} className="btn-icon">
                                <X size={24} />
                            </button>
                        </div>
                        <div style={{ marginBottom: '2rem' }}>
                            <label className="field-label">Role Name</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="e.g. Librarian, Accountant"
                                value={newRoleName}
                                onChange={e => setNewRoleName(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn" style={{ flex: 1 }} onClick={() => { setShowCreateModal(false); setEditingRole(null); setNewRoleName(''); }}>Cancel</button>
                            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleCreateRole}>
                                {editingRole ? 'Update Changes' : 'Create Role'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserRoles;
