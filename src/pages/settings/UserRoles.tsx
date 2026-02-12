import React, { useState, useEffect } from 'react';
import { Shield, ChevronRight, ChevronDown, Check, Plus, X, Edit2, Trash2, LayoutDashboard, Users, CreditCard, UserCheck, BookOpen, FileText, Bus, Building2, Bell, MessageSquare, Calendar, Clock, User, Settings } from 'lucide-react';
import { Permission, DEFAULT_ROLES } from '../../types/rbac';
import type { Role } from '../../types/rbac';
import { usePersistence } from '../../hooks/usePersistence';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { useSchool } from '../../context/SchoolContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { useFirestore } from '../../hooks/useFirestore';

interface CustomRole {
    id: string;
    role: Role;
    label: string;
    permissions: Permission[];
    isDefault: boolean;
    status: 'ACTIVE' | 'INACTIVE';
}

// ─── Menu-based permission structure ────────────────────────────────────────
// This mirrors the sidebar menu exactly. Each menu/submenu item maps to
// one or more Permission values. Toggling a menu item toggles all its
// associated permissions together.
// ────────────────────────────────────────────────────────────────────────────

interface MenuItem {
    id: string;
    label: string;
    icon: any;
    permissions: Permission[];
    children?: SubMenuItem[];
}

interface SubMenuItem {
    id: string;
    label: string;
    permissions: Permission[];
}

const MENU_STRUCTURE: MenuItem[] = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        permissions: [Permission.VIEW_DASHBOARD, Permission.VIEW_STATS],
    },
    {
        id: 'students',
        label: 'Student Management',
        icon: Users,
        permissions: [Permission.VIEW_STUDENTS],
        children: [
            { id: 'students_add', label: 'Add Student', permissions: [Permission.ADMIT_STUDENT] },
            { id: 'students_form_sale', label: 'Form Sale', permissions: [Permission.ADMIT_STUDENT] },
            { id: 'students_bulk_upload', label: 'Bulk Student Upload', permissions: [Permission.ADMIT_STUDENT] },
            { id: 'students_registrations', label: 'Registration Requests', permissions: [Permission.VIEW_REGISTRATIONS] },
            { id: 'students_manage', label: 'Manage Students', permissions: [Permission.VIEW_STUDENTS] },
            { id: 'students_report', label: 'Student Report', permissions: [Permission.VIEW_STUDENT_REPORTS] },
            { id: 'students_re_reg', label: 'Re-Registration Report', permissions: [Permission.VIEW_RE_REGISTRATION_REPORTS] },
            { id: 'students_dues', label: 'Dues List', permissions: [Permission.VIEW_DUES_LIST] },
        ]
    },
    {
        id: 'fees',
        label: 'Fee Management',
        icon: CreditCard,
        permissions: [Permission.COLLECT_FEES],
        children: [
            { id: 'fees_collect', label: 'Collect Fees', permissions: [Permission.COLLECT_FEES] },
            { id: 'fees_structure', label: 'Fee Structure', permissions: [Permission.VIEW_FEE_STRUCTURE] },
            { id: 'fees_set_amount', label: 'Set Fee Amount', permissions: [Permission.SET_FEE_AMOUNT] },
            { id: 'fees_manage_structure', label: 'Manage Fee Structure', permissions: [Permission.MANAGE_FEE_STRUCTURE] },
            { id: 'fees_report', label: 'Fee Report', permissions: [Permission.VIEW_FEE_REPORTS] },
            { id: 'fees_dues', label: 'Due Report', permissions: [Permission.VIEW_DUE_REPORTS] },
        ]
    },
    {
        id: 'attendance',
        label: 'Attendance Management',
        icon: UserCheck,
        permissions: [Permission.MANAGE_ATTENDANCE],
        children: [
            { id: 'attendance_mark', label: 'Mark Attendance', permissions: [Permission.MANAGE_ATTENDANCE] },
            { id: 'attendance_staff', label: 'Staff Attendance', permissions: [Permission.MANAGE_STAFF_ATTENDANCE] },
        ]
    },
    {
        id: 'employees',
        label: 'Employee Management',
        icon: Users,
        permissions: [Permission.VIEW_EMPLOYEES],
        children: [
            { id: 'employees_list', label: 'Employee List', permissions: [Permission.VIEW_EMPLOYEES] },
            { id: 'employees_manage', label: 'Manage Employees', permissions: [Permission.MANAGE_EMPLOYEES] },
            { id: 'employees_payroll', label: 'Payroll', permissions: [Permission.MANAGE_PAYROLL] },
            { id: 'employees_teaching_logs', label: 'Teaching Logs', permissions: [Permission.VIEW_TEACHING_LOGS] },
        ]
    },
    {
        id: 'accounts',
        label: 'Accounts',
        icon: CreditCard,
        permissions: [Permission.VIEW_ACCOUNTS],
        children: [
            { id: 'accounts_dashboard', label: 'Dashboard', permissions: [Permission.VIEW_ACCOUNTS] },
            { id: 'accounts_expenses', label: 'Expense Entry', permissions: [Permission.MANAGE_ACCOUNTS] },
        ]
    },
    {
        id: 'exams',
        label: 'Exam Management',
        icon: BookOpen,
        permissions: [Permission.VIEW_EXAMS],
        children: [
            { id: 'exams_dashboard', label: 'Dashboard', permissions: [Permission.VIEW_EXAMS] },
            { id: 'exams_academic_year', label: 'Academic Year & Terms', permissions: [Permission.MANAGE_SETTINGS] },
            { id: 'exams_configuration', label: 'Exam Configuration', permissions: [Permission.MANAGE_SETTINGS] },
            { id: 'exams_scheduling', label: 'Schedule Exams', permissions: [Permission.MANAGE_EXAM_TIMETABLE] },
            { id: 'exams_timetable', label: 'Exam Timetable', permissions: [Permission.MANAGE_EXAM_TIMETABLE] },
            { id: 'exams_admit_cards', label: 'Print Admit Card', permissions: [Permission.PRINT_ADMIT_CARDS] },
            { id: 'exams_marks_entry', label: 'Marks Entry', permissions: [Permission.ENTER_MARKS] },
            { id: 'exams_bulk_marks', label: 'Bulk Marks Upload', permissions: [Permission.ENTER_MARKS] },
            { id: 'exams_results', label: 'View Results', permissions: [Permission.VIEW_EXAMS] },
            { id: 'exams_analytics', label: 'Performance Analytics', permissions: [Permission.VIEW_EXAMS] },
            { id: 'exams_syllabus', label: 'Manage Syllabus', permissions: [Permission.MANAGE_EXAM_TIMETABLE] },
            { id: 'exams_templates', label: 'Customize Templates', permissions: [Permission.MANAGE_EXAMS] },
            { id: 'exams_report_cards', label: 'Print Report Card', permissions: [Permission.PRINT_REPORT_CARDS] },
            { id: 'exams_question_gen', label: 'Question Generator', permissions: [Permission.GENERATE_QUESTIONS] },
        ]
    },
    {
        id: 'homework',
        label: 'Homework Management',
        icon: FileText,
        permissions: [Permission.MANAGE_HOMEWORK],
        children: [
            { id: 'homework_assign', label: 'Assign Homework', permissions: [Permission.MANAGE_HOMEWORK] },
            { id: 'homework_report', label: 'Homework Report', permissions: [Permission.VIEW_HOMEWORK_REPORTS] },
        ]
    },
    {
        id: 'transport',
        label: 'Transport',
        icon: Bus,
        permissions: [Permission.MANAGE_TRANSPORT],
    },
    {
        id: 'hostel',
        label: 'Hostel',
        icon: Building2,
        permissions: [Permission.VIEW_REPORTS],
    },
    {
        id: 'library',
        label: 'Library',
        icon: BookOpen,
        permissions: [Permission.MANAGE_LIBRARY],
    },
    {
        id: 'notices',
        label: 'Notice Board',
        icon: Bell,
        permissions: [Permission.MANAGE_NOTICES, Permission.POST_NOTICE],
    },
    {
        id: 'messages',
        label: 'Messages',
        icon: MessageSquare,
        permissions: [Permission.VIEW_MESSAGES],
    },
    {
        id: 'calendar',
        label: 'Calendar',
        icon: Calendar,
        permissions: [Permission.VIEW_CALENDAR, Permission.MANAGE_CALENDAR],
    },
    {
        id: 'routine',
        label: 'Routine Management',
        icon: Clock,
        permissions: [Permission.VIEW_ROUTINE, Permission.MANAGE_ROUTINE],
    },
    {
        id: 'gallery',
        label: 'Gallery',
        icon: User,
        permissions: [Permission.VIEW_GALLERY, Permission.MANAGE_GALLERY],
    },
    {
        id: 'reports',
        label: 'Reports',
        icon: FileText,
        permissions: [Permission.VIEW_REPORTS],
    },
    {
        id: 'roles',
        label: 'Roles & Managers',
        icon: Shield,
        permissions: [Permission.MANAGE_ROLES, Permission.MANAGE_MANAGERS],
    },
    {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        permissions: [Permission.MANAGE_SETTINGS],
        children: [
            { id: 'settings_classes', label: 'Class & Section Master', permissions: [Permission.MANAGE_CLASSES] },
            { id: 'settings_inventory', label: 'Inventory Master', permissions: [Permission.MANAGE_INVENTORY] },
            { id: 'settings_institution', label: 'Institution Info', permissions: [Permission.MANAGE_INSTITUTION] },
            { id: 'settings_reg_fields', label: 'Registration Fields', permissions: [Permission.MANAGE_REGISTRATION_FIELDS] },
            { id: 'settings_adm_fields', label: 'Admission Fields', permissions: [Permission.MANAGE_ADMISSION_FIELDS] },
            { id: 'settings_print', label: 'Print Form Designer', permissions: [Permission.MANAGE_PRINT_DESIGN] },
            { id: 'settings_api', label: 'API Keys', permissions: [Permission.MANAGE_API_KEYS] },
            { id: 'settings_seeder', label: 'Data Seeder', permissions: [Permission.MANAGE_DATA_SEEDER] },
            { id: 'settings_master', label: 'Master Control', permissions: [Permission.MANAGE_MASTER_CONTROL] },
            { id: 'settings_schools', label: 'Manage Schools', permissions: [Permission.MANAGE_SCHOOLS] },
            { id: 'settings_payments', label: 'Payment Settings', permissions: [Permission.MANAGE_PAYMENT_SETTINGS] },
            { id: 'settings_holidays', label: 'Upload Holidays', permissions: [Permission.UPLOAD_HOLIDAYS] },
            { id: 'settings_subjects', label: 'Subjects & Chapters', permissions: [Permission.MANAGE_ACADEMIC_STRUCTURE] },
        ]
    },
    {
        id: 'parent_controls',
        label: 'Parent Controls',
        icon: User,
        permissions: [Permission.PARENT_SHOW_FEE_TAB, Permission.PARENT_SHOW_DUES_BANNER],
        children: [
            { id: 'parent_fee_tab', label: 'Show Fee Tab', permissions: [Permission.PARENT_SHOW_FEE_TAB] },
            { id: 'parent_dues_banner', label: 'Show Dues Banner', permissions: [Permission.PARENT_SHOW_DUES_BANNER] },
        ]
    },
    {
        id: 'ai',
        label: 'AI Assistant',
        icon: BookOpen,
        permissions: [Permission.USE_AI_ASSISTANT],
    },
];

// ─── Helper: Check if a menu/submenu is "on" for a set of permissions ──────
const isMenuEnabled = (menuPerms: Permission[], rolePerms: Permission[]): boolean => {
    return menuPerms.every(p => rolePerms.includes(p));
};
const isMenuPartial = (menuPerms: Permission[], rolePerms: Permission[]): boolean => {
    return menuPerms.some(p => rolePerms.includes(p)) && !menuPerms.every(p => rolePerms.includes(p));
};

// ─── Collect ALL unique permissions from a parent menu (including children) ──
const getAllMenuPermissions = (menu: MenuItem): Permission[] => {
    const set = new Set<Permission>(menu.permissions);
    menu.children?.forEach(c => c.permissions.forEach(p => set.add(p)));
    return Array.from(set);
};


const UserRoles: React.FC = () => {
    const { currentSchool } = useSchool();
    const [activeTab, setActiveTab] = useState<'ROLES' | 'USERS'>('ROLES');
    const [roles, setRoles] = usePersistence<CustomRole[]>('millat_custom_roles',
        DEFAULT_ROLES.map(r => ({ ...r, id: r.role, isDefault: true, status: 'ACTIVE' }))
    );
    const { data: teachers } = useFirestore<any>('teachers');
    const { hasPermission: currentUserHasPermission } = useAuth();

    const [selectedRole, setSelectedRole] = useState<CustomRole>(roles[0]);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [userPermissions, setUserPermissions] = usePersistence<Record<string, Permission[]>>('millat_user_overrides', {});
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
    const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});

    // Sync roles to Firestore for global persistence
    useEffect(() => {
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


    // ─── Get current permissions (for selected role or user) ─────────────
    const getCurrentPermissions = (): Permission[] => {
        if (activeTab === 'ROLES') {
            return selectedRole?.permissions || [];
        } else {
            if (!selectedUser) return [];
            const userId = selectedUser.uid || selectedUser.id;
            const roleConfig = roles.find(r => r.role === 'TEACHER');
            return userPermissions[userId]
                || roleConfig?.permissions
                || DEFAULT_ROLES.find(r => r.role === 'TEACHER')?.permissions
                || [];
        }
    };

    // ─── Toggle ALL permissions for a menu item (parent or submenu child) ──
    const toggleMenuPermissions = (permsToToggle: Permission[]) => {
        if (activeTab === 'ROLES') {
            if (!selectedRole) return;
            if (selectedRole.role === 'ADMIN') return; // Admin has everything locked

            const currentPerms = selectedRole.permissions;
            const allEnabled = permsToToggle.every(p => currentPerms.includes(p));

            let newPerms: Permission[];
            if (allEnabled) {
                // Remove these permissions
                newPerms = currentPerms.filter(p => !permsToToggle.includes(p));
            } else {
                // Add missing permissions
                const toAdd = permsToToggle.filter(p => !currentPerms.includes(p));
                newPerms = [...currentPerms, ...toAdd];
            }

            const updatedRole = { ...selectedRole, permissions: newPerms };
            setSelectedRole(updatedRole);
            setRoles(roles.map(r => r.id === updatedRole.id ? updatedRole : r));
        } else {
            if (!selectedUser) return;
            const userId = selectedUser.uid || selectedUser.id;
            const roleConfig = roles.find(r => r.role === 'TEACHER');
            const currentPerms = userPermissions[userId]
                || roleConfig?.permissions
                || DEFAULT_ROLES.find(r => r.role === 'TEACHER')?.permissions
                || [];

            const allEnabled = permsToToggle.every(p => currentPerms.includes(p));
            let newPerms: Permission[];
            if (allEnabled) {
                newPerms = currentPerms.filter(p => !permsToToggle.includes(p));
            } else {
                const toAdd = permsToToggle.filter(p => !currentPerms.includes(p));
                newPerms = [...currentPerms, ...toAdd];
            }
            setUserPermissions({ ...userPermissions, [userId]: newPerms });
        }
    };

    // ─── Toggle entire parent menu (all children included) ─────────────
    const toggleEntireMenu = (menu: MenuItem) => {
        const allPerms = getAllMenuPermissions(menu);
        toggleMenuPermissions(allPerms);
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

    const toggleExpanded = (menuId: string) => {
        setExpandedMenus(prev => ({ ...prev, [menuId]: !prev[menuId] }));
    };

    const currentPermissions = getCurrentPermissions();
    const isLocked = activeTab === 'ROLES' && selectedRole?.role === 'ADMIN';

    // Count enabled menus for the role
    const enabledCount = MENU_STRUCTURE.filter(m => isMenuEnabled(m.permissions, currentPermissions)).length;

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
                {/* ──── SELECTION SIDEBAR ──── */}
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
                            {teachers.map((t: any) => (
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

                {/* ──── PERMISSION MANAGEMENT (MENU-BASED) ──── */}
                <div className="glass-card animate-slide-up" style={{ padding: '2rem' }}>
                    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {activeTab === 'ROLES' ? 'Configuring Role' : 'Customizing User Access'}
                            </span>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>
                                {activeTab === 'ROLES' ? selectedRole?.label : selectedUser?.name || 'Select a user'}
                            </h2>
                            {(activeTab === 'ROLES' ? !!selectedRole : !!selectedUser) && (
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                                    <span style={{
                                        background: 'rgba(99, 102, 241, 0.08)',
                                        color: 'var(--primary)',
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '2rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                    }}>
                                        {enabledCount} / {MENU_STRUCTURE.length} Menus Enabled
                                    </span>
                                    {isLocked && (
                                        <span style={{
                                            background: 'rgba(245, 158, 11, 0.1)',
                                            color: '#f59e0b',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '2rem',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                        }}>
                                            🔒 Admin role has full access
                                        </span>
                                    )}
                                </div>
                            )}
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {MENU_STRUCTURE.map(menu => {
                                const Icon = menu.icon;
                                const allPerms = getAllMenuPermissions(menu);
                                const enabled = isMenuEnabled(menu.permissions, currentPermissions);
                                const hasChildren = menu.children && menu.children.length > 0;
                                const isExpanded = expandedMenus[menu.id] || false;

                                // Count enabled children
                                const enabledChildren = menu.children
                                    ? menu.children.filter(c => isMenuEnabled(c.permissions, currentPermissions)).length
                                    : 0;
                                const totalChildren = menu.children?.length || 0;

                                return (
                                    <div key={menu.id} style={{
                                        borderRadius: '1rem',
                                        border: '1px solid',
                                        borderColor: enabled ? 'rgba(99, 102, 241, 0.15)' : 'var(--border)',
                                        overflow: 'hidden',
                                        transition: 'all 0.3s ease',
                                        background: enabled ? 'rgba(99, 102, 241, 0.02)' : 'transparent',
                                    }}>
                                        {/* ── Parent Menu Row ── */}
                                        <div
                                            style={{
                                                padding: '1rem 1.25rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '1rem',
                                                cursor: isLocked ? 'default' : 'pointer',
                                                transition: 'background 0.2s',
                                                background: enabled ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                                            }}
                                            onClick={() => hasChildren && toggleExpanded(menu.id)}
                                            onMouseEnter={(e) => { if (!isLocked) e.currentTarget.style.background = 'rgba(99, 102, 241, 0.06)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = enabled ? 'rgba(99, 102, 241, 0.04)' : 'transparent'; }}
                                        >
                                            {/* Expand/collapse icon for menus with children */}
                                            {hasChildren ? (
                                                <ChevronDown size={16} style={{
                                                    transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                                                    transition: 'transform 0.3s ease',
                                                    color: 'var(--text-muted)',
                                                    flexShrink: 0,
                                                }} />
                                            ) : (
                                                <div style={{ width: 16, flexShrink: 0 }} />
                                            )}

                                            {/* Menu Icon */}
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '12px',
                                                background: enabled
                                                    ? 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)'
                                                    : 'var(--bg-main)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                transition: 'all 0.3s ease',
                                                boxShadow: enabled ? '0 4px 12px -2px rgba(99, 102, 241, 0.3)' : 'none',
                                            }}>
                                                <Icon size={20} color={enabled ? 'white' : 'var(--text-muted)'} />
                                            </div>

                                            {/* Label & Info */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    fontWeight: 700,
                                                    fontSize: '0.9375rem',
                                                    color: enabled ? 'var(--text-main)' : 'var(--text-muted)',
                                                }}>
                                                    {menu.label}
                                                </div>
                                                {hasChildren && (
                                                    <div style={{
                                                        fontSize: '0.6875rem',
                                                        color: 'var(--text-muted)',
                                                        marginTop: '2px',
                                                        fontWeight: 600,
                                                    }}>
                                                        {enabledChildren} / {totalChildren} sub-menus enabled
                                                    </div>
                                                )}
                                            </div>

                                            {/* ── Toggle Switch ── */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!isLocked) toggleEntireMenu(menu);
                                                }}
                                                style={{
                                                    width: '52px',
                                                    height: '28px',
                                                    borderRadius: '14px',
                                                    border: 'none',
                                                    background: enabled ? '#10b981' : '#cbd5e1',
                                                    position: 'relative',
                                                    cursor: isLocked ? 'default' : 'pointer',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    flexShrink: 0,
                                                    opacity: isLocked ? 0.6 : 1,
                                                    boxShadow: enabled ? '0 2px 8px rgba(16, 185, 129, 0.25)' : 'none',
                                                }}
                                            >
                                                <div style={{
                                                    width: '22px',
                                                    height: '22px',
                                                    borderRadius: '50%',
                                                    background: 'white',
                                                    position: 'absolute',
                                                    top: '3px',
                                                    left: enabled ? '27px' : '3px',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                                }}>
                                                    {enabled ? <Check size={12} color="#10b981" strokeWidth={3} /> : <X size={12} color="#94a3b8" strokeWidth={3} />}
                                                </div>
                                            </button>
                                        </div>

                                        {/* ── Sub-menu children (collapsible) ── */}
                                        {hasChildren && (
                                            <div style={{
                                                maxHeight: isExpanded ? '1200px' : '0',
                                                opacity: isExpanded ? 1 : 0,
                                                overflow: 'hidden',
                                                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                                borderTop: isExpanded ? '1px solid var(--border)' : 'none',
                                            }}>
                                                <div style={{
                                                    padding: '0.75rem 1.25rem 0.75rem 4.5rem',
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                                                    gap: '0.5rem',
                                                }}>
                                                    {menu.children!.map(child => {
                                                        const childEnabled = isMenuEnabled(child.permissions, currentPermissions);

                                                        return (
                                                            <div
                                                                key={child.id}
                                                                onClick={() => { if (!isLocked) toggleMenuPermissions(child.permissions); }}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.75rem',
                                                                    padding: '0.75rem 1rem',
                                                                    borderRadius: '0.75rem',
                                                                    background: childEnabled ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                                                                    border: '1px solid',
                                                                    borderColor: childEnabled ? 'rgba(99, 102, 241, 0.15)' : 'var(--border)',
                                                                    cursor: isLocked ? 'default' : 'pointer',
                                                                    transition: 'all 0.2s ease',
                                                                    opacity: isLocked ? 0.7 : 1,
                                                                }}
                                                                className={!isLocked ? 'hover-lift' : ''}
                                                            >
                                                                <div style={{
                                                                    width: '22px',
                                                                    height: '22px',
                                                                    borderRadius: '6px',
                                                                    border: childEnabled ? 'none' : '2px solid var(--border)',
                                                                    background: childEnabled ? 'var(--primary)' : 'transparent',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    color: 'white',
                                                                    flexShrink: 0,
                                                                    transition: 'all 0.2s ease',
                                                                }}>
                                                                    {childEnabled && <Check size={14} />}
                                                                </div>
                                                                <span style={{
                                                                    fontSize: '0.8125rem',
                                                                    fontWeight: childEnabled ? 600 : 500,
                                                                    color: childEnabled ? 'var(--text-main)' : 'var(--text-muted)',
                                                                }}>
                                                                    {child.label}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
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
