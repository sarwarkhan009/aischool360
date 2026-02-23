import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSchool } from '../context/SchoolContext';
import { useParams } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    Settings,
    LogOut,
    Menu,
    Bell,
    Search,
    BookOpen,
    CreditCard,
    Bus,
    FileText,
    UserCheck,
    Calendar,
    Clock,
    MessageSquare,
    Image,
    User,
    ChevronDown,
    Building2,
    FileQuestion,
    QrCode as QrIcon,
    Shield
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { Permission } from '../types/rbac';
import AIAssistant from './AIAssistant';
import VoiceLiveAssistant from './VoiceLiveAssistant';
import { APP_CONFIG } from '../constants/app';
import { useFirestore } from '../hooks/useFirestore';


const SidebarPaymentCard = ({ paymentInfo, collapsed }: { paymentInfo: any, collapsed: boolean }) => {
    if (!paymentInfo || collapsed) return null;

    return (
        <div className="sidebar-payment-card" style={{
            background: 'rgba(99, 102, 241, 0.05)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: '1.25rem',
            padding: '1rem',
            marginBottom: '1.25rem',
            marginTop: 'auto'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <QrIcon size={16} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase' }}>Pay Fee</div>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Scan & Pay via UPI</div>
                </div>
            </div>

            {paymentInfo.qrCodeUrl && (
                <div style={{ background: 'white', borderRadius: '0.75rem', padding: '0.5rem', marginBottom: '0.75rem', textAlign: 'center' }}>
                    <img src={paymentInfo.qrCodeUrl} alt="QR" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                </div>
            )}

            <div style={{ fontSize: '0.7rem', color: 'var(--text-main)', opacity: 0.8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 800 }}>A/C:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 900 }}>{paymentInfo.accountNumber || paymentInfo.accountNo}</span>
                </div>
                {paymentInfo.upiId && (
                    <div style={{ color: '#10b981', fontWeight: 900, textAlign: 'center', marginTop: '0.5rem', fontSize: '0.65rem' }}>
                        {paymentInfo.upiId}
                    </div>
                )}
            </div>
        </div>
    );
};

const SidebarItem = ({ to, icon: Icon, label, onClick }: { to: string, icon: any, label: string, collapsed: boolean, onClick?: () => void }) => (
    <NavLink
        to={to}
        end
        onClick={onClick}
        className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '0.875rem 1.25rem',
            borderRadius: '1rem',
            textDecoration: 'none',
            fontWeight: 500,
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            marginBottom: '0.375rem',
            color: '#64748b',
            position: 'relative',
        }}
    >
        <Icon size={20} style={{ flexShrink: 0 }} />
        <span className="sidebar-label">{label}</span>
    </NavLink>
);

const CollapsableSidebarItem = ({ icon: Icon, label, children, collapsed, permission, hasPermission, isOpen, onToggle, onOpen, moduleControls, schoolId, moduleId }: { icon: any, label: string, children: any[], collapsed: boolean, permission?: any, hasPermission: (p: any) => boolean, isOpen: boolean, onToggle: () => void, onOpen: () => void, moduleControls: any, schoolId?: string, moduleId?: string }) => {
    const location = useLocation();
    const { user } = useAuth();
    const { currentSchool } = useSchool();

    // Notify parent to open if a child is active (on mount or location change)
    useEffect(() => {
        const hasActiveChild = children.some(child => location.pathname === child.to);
        if (hasActiveChild && !isOpen) {
            onOpen();
        }
    }, [location.pathname]); // Only depend on pathname

    if (permission && !hasPermission(permission)) return null;

    // We don't filter children here anymore because they are already filtered 
    // in the main DashboardLayout loop before being passed to this component.
    // This avoids the issue where prefixed paths (with schoolId) failed to match permission keys.
    if (children.length === 0) return null;

    return (
        <div style={{ marginBottom: '0.25rem' }}>
            <button
                onClick={(e) => {
                    e.preventDefault();
                    onToggle();
                }}
                className={`sidebar-item ${isOpen ? 'group-active' : ''}`}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '0.875rem 1.25rem',
                    borderRadius: '1rem',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.5)',
                    transition: 'all 0.3s ease',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Icon size={20} style={{ flexShrink: 0 }} />
                    <span className="sidebar-label" style={{ opacity: collapsed ? 0 : 1 }}>{label}</span>
                </div>
                {!collapsed && (
                    <ChevronDown
                        size={16}
                        style={{
                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                            transition: 'transform 0.3s ease'
                        }}
                    />
                )}
            </button>
            <div
                style={{
                    maxHeight: isOpen ? '800px' : '0',
                    opacity: isOpen ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    paddingLeft: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    visibility: (isOpen && !collapsed) ? 'visible' : 'hidden'
                }}
            >
                {children.map((child, idx) => (
                    <NavLink
                        key={idx}
                        to={child.to}
                        end
                        className={({ isActive }) => `sidebar-item-sub ${isActive ? 'active' : ''}`}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem 1.25rem',
                            borderRadius: '0.75rem',
                            textDecoration: 'none',
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            color: 'rgba(255, 255, 255, 0.4)',
                            marginBottom: '0.125rem',
                            position: 'relative',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <span className="sidebar-label">{child.label}</span>
                    </NavLink>
                ))}
            </div>
        </div>
    );
};

const menuItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', permission: Permission.VIEW_DASHBOARD, roles: ['ADMIN', 'MANAGER', 'TEACHER', 'ACCOUNTANT', 'PARENT', 'DRIVER'] },
    {
        label: 'Student Management',
        icon: Users,
        roles: ['ADMIN', 'MANAGER', 'TEACHER', 'ACCOUNTANT'],
        moduleId: 'students',
        children: [
            { to: '/students/admission', label: 'Add Student', permission: Permission.ADMIT_STUDENT, moduleId: '/students/admission' },
            { to: '/students/form-sale', label: 'Form Sale', permission: Permission.ADMIT_STUDENT, moduleId: '/students/form-sale' },
            { to: '/students/bulk-upload', label: 'Bulk Student Upload', permission: Permission.ADMIT_STUDENT, moduleId: '/students/bulk-upload' },
            { to: '/students/registrations', label: 'Registration Requests', permission: Permission.VIEW_REGISTRATIONS, moduleId: '/students/registrations' },
            { to: '/students', label: 'Manage Students', permission: Permission.VIEW_STUDENTS, moduleId: '/students' },
            { to: '/students/report', label: 'Student Report', permission: Permission.VIEW_STUDENT_REPORTS, moduleId: '/students/report' },
            { to: '/students/re-reg', label: 'Re-Registration Report', permission: Permission.VIEW_RE_REGISTRATION_REPORTS, moduleId: '/students/re-reg' },
            { to: '/students/dues', label: 'Dues List', permission: Permission.VIEW_DUES_LIST, moduleId: '/students/dues' },
            { to: '/students/promotion', label: 'Promote Students', permission: Permission.PROMOTE_STUDENTS, moduleId: '/students/promotion' },
            { to: '/students/photos', label: 'Student Photo Upload', permission: Permission.UPLOAD_STUDENT_PHOTO, moduleId: '/students/photos' },
        ]
    },
    {
        label: 'Fee Management',
        icon: CreditCard,
        roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'],
        moduleId: 'fees',
        children: [
            { to: '/fees', label: 'Collect Fees', permission: Permission.COLLECT_FEES, moduleId: '/fees' },
            { to: '/fees/structure', label: 'Fee Structure', permission: Permission.VIEW_FEE_STRUCTURE, moduleId: '/fees/structure' },
            { to: '/fees/set-amount', label: 'Set Fee Amount', permission: Permission.SET_FEE_AMOUNT, moduleId: '/fees/set-amount' },
            { to: '/fees/report', label: 'Fee Report', permission: Permission.VIEW_FEE_REPORTS, moduleId: '/fees/report' },
            { to: '/fees/dues', label: 'Due Report', permission: Permission.VIEW_DUE_REPORTS, moduleId: '/fees/dues' },
        ]
    },
    {
        label: 'Attendance Management',
        icon: UserCheck,
        roles: ['ADMIN', 'MANAGER', 'TEACHER'],
        moduleId: 'attendance',
        children: [
            { to: '/attendance', label: 'Mark Attendance', permission: Permission.MANAGE_ATTENDANCE, moduleId: '/attendance' },
            { to: '/attendance/staff', label: 'Staff Attendance', permission: Permission.MANAGE_STAFF_ATTENDANCE, moduleId: '/attendance/staff' },
        ]
    },
    {
        label: 'Employee Management',
        icon: Users,
        roles: ['ADMIN', 'MANAGER'],
        moduleId: 'employees',
        children: [
            { to: '/teachers', label: 'Employee List', permission: Permission.VIEW_EMPLOYEES, moduleId: '/teachers' },
            { to: '/teachers/payroll', label: 'Payroll', permission: Permission.MANAGE_PAYROLL, moduleId: '/teachers/payroll' },
            { to: '/teaching-logs', label: 'Teaching Logs', permission: Permission.VIEW_TEACHING_LOGS, moduleId: '/teaching-logs' },
        ]
    },
    {
        label: 'Accounts',
        icon: CreditCard,
        roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'],
        moduleId: 'accounts',
        children: [
            { to: '/accounts/dashboard', label: 'Dashboard', permission: Permission.VIEW_ACCOUNTS, moduleId: '/accounts/dashboard' },
            { to: '/accounts/expenses', label: 'Expense Entry', permission: Permission.MANAGE_ACCOUNTS, moduleId: '/accounts/expenses' },
        ]
    },
    {
        label: 'Exam Management',
        icon: BookOpen,
        roles: ['ADMIN', 'MANAGER', 'TEACHER'],
        moduleId: 'exams',
        children: [
            { to: '/exams', label: 'Dashboard', permission: Permission.VIEW_EXAMS, moduleId: '/exams' },
            { to: '/academic-year-manager', label: 'Academic Year & Terms', permission: Permission.MANAGE_SETTINGS, moduleId: '/exams/academic-year' },
            { to: '/exam-configuration', label: 'Exam Configuration', permission: Permission.MANAGE_SETTINGS, moduleId: '/exams/configuration' },
            { to: '/exam-scheduling', label: 'Schedule Exams', permission: Permission.MANAGE_EXAM_TIMETABLE, moduleId: '/exams/scheduling' },
            { to: '/exam-timetable', label: 'Exam Timetable', permission: Permission.MANAGE_EXAM_TIMETABLE, moduleId: '/exam-timetable' },
            { to: '/admit-cards', label: 'Print Admit Card', permission: Permission.PRINT_ADMIT_CARDS, moduleId: '/admit-cards' },
            { to: '/advanced-marks-entry', label: 'Marks Entry', permission: Permission.ENTER_MARKS, moduleId: '/marks-entry' },
            { to: '/exams/bulk-marks-upload', label: 'Bulk Marks Upload', permission: Permission.ENTER_MARKS, moduleId: '/exams/bulk-marks-upload' },
            { to: '/exam-results', label: 'View Results', permission: Permission.VIEW_EXAMS, moduleId: '/exams/results' },
            { to: '/exam-analytics', label: 'Performance Analytics', permission: Permission.VIEW_EXAMS, moduleId: '/exams/analytics' },
            { to: '/exam-syllabus', label: 'Manage Syllabus', permission: Permission.MANAGE_EXAM_TIMETABLE, moduleId: '/exams/syllabus' },
            { to: '/exam-templates', label: 'Customize Templates', permission: Permission.MANAGE_EXAMS, moduleId: '/exams/templates' },
            { to: '/report-cards', label: 'Print Report Card', permission: Permission.PRINT_REPORT_CARDS, moduleId: '/report-cards' },
            { to: '/question-generator', label: 'Question Generator', permission: Permission.GENERATE_QUESTIONS, moduleId: '/question-generator' }
        ]
    },
    {
        label: 'Homework Management',
        icon: FileText,
        roles: ['ADMIN', 'MANAGER', 'TEACHER'],
        moduleId: 'homework',
        children: [
            { to: '/homework', label: 'Assign Homework', permission: Permission.MANAGE_HOMEWORK, moduleId: '/homework' },
            { to: '/homework/report', label: 'Homework Report', permission: Permission.VIEW_HOMEWORK_REPORTS, moduleId: '/homework/report' },
        ]
    },
    { to: '/transport', icon: Bus, label: 'Transport', permission: Permission.MANAGE_TRANSPORT, roles: ['ADMIN', 'MANAGER'], moduleId: 'transport' },
    { to: '/hostel', icon: Building2, label: 'Hostel', permission: Permission.VIEW_REPORTS, roles: ['ADMIN', 'MANAGER'], moduleId: 'hostel' },
    { to: '/library', icon: BookOpen, label: 'Library', permission: Permission.MANAGE_LIBRARY, roles: ['ADMIN', 'MANAGER'], moduleId: 'library' },
    { to: '/notices', icon: Bell, label: 'Notice Board', permission: Permission.MANAGE_NOTICES, roles: ['ADMIN', 'MANAGER', 'TEACHER'], moduleId: 'notices' },
    { to: '/messages', icon: MessageSquare, label: 'Messages', permission: Permission.VIEW_MESSAGES, roles: ['ADMIN', 'MANAGER'], moduleId: 'communication' },
    { to: '/calendar', icon: Calendar, label: 'Calendar', roles: ['ADMIN', 'MANAGER', 'TEACHER', 'DRIVER', 'ACCOUNTANT', 'PARENT'], moduleId: 'calendar' },
    { to: '/routine', icon: Clock, label: 'My Timetable', permission: Permission.VIEW_ROUTINE, roles: ['TEACHER'], moduleId: 'routine' },
    { to: '/routine', icon: Clock, label: 'Routine Management', permission: Permission.MANAGE_ROUTINE, roles: ['ADMIN', 'MANAGER'], moduleId: 'routine' },
    { to: '/profile', icon: User, label: 'My Profile', roles: ['ADMIN', 'MANAGER', 'TEACHER', 'ACCOUNTANT', 'USER', 'DRIVER'], moduleId: 'profile' },
    { to: '/settings/subjects-chapters', icon: BookOpen, label: 'Subjects & Chapters', permission: Permission.MANAGE_ACADEMIC_STRUCTURE, roles: ['ADMIN', 'MANAGER', 'TEACHER'], moduleId: '/settings/subjects-chapters' },
    { to: '/profile-verifications', icon: Shield, label: 'Profile Verification', roles: ['ADMIN', 'MANAGER'], permission: Permission.MANAGE_SETTINGS },
    { to: '/reports', icon: FileText, label: 'Reports', permission: Permission.VIEW_REPORTS, roles: ['ADMIN', 'MANAGER'], moduleId: 'reports' },
    {
        label: 'Settings',
        icon: Settings,
        permission: Permission.MANAGE_SETTINGS,
        roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
        moduleId: 'settings',
        children: [
            { to: '/settings/class-master', label: 'Class & Section Master', permission: Permission.MANAGE_CLASSES, moduleId: '/settings/class-master' },
            { to: '/settings/inventory', label: 'Inventory Master', permission: Permission.MANAGE_INVENTORY, moduleId: '/settings/inventory' },
            { to: '/settings/institution', label: 'Institution Info', permission: Permission.MANAGE_INSTITUTION, moduleId: '/settings/institution' },
            { to: '/settings/registration-fields', label: 'Public Registration Fields', permission: Permission.MANAGE_REGISTRATION_FIELDS, moduleId: '/settings/registration-fields' },
            { to: '/settings/student-admission-fields', label: 'Internal Admission Fields', permission: Permission.MANAGE_ADMISSION_FIELDS, moduleId: '/settings/student-admission-fields' },
            { to: '/settings/print-design', label: 'Print Form Designer', permission: Permission.MANAGE_PRINT_DESIGN, moduleId: '/settings/print-design' },
            { to: '/settings/api-keys', label: 'API Keys', permission: Permission.MANAGE_API_KEYS, moduleId: '/settings/api-keys' },
            { to: '/settings/data-seeder', label: 'Data Seeder', permission: Permission.MANAGE_DATA_SEEDER, moduleId: '/settings/data-seeder' },
            { to: '/settings/master-control', label: 'Master Control', permission: Permission.MANAGE_MASTER_CONTROL, roles: ['SUPER_ADMIN', 'ADMIN'], moduleId: '/settings/master-control' },
            { to: '/settings/schools', label: 'Manage Schools', permission: Permission.MANAGE_SCHOOLS, roles: ['SUPER_ADMIN', 'ADMIN'], moduleId: '/settings/schools' },
            { to: '/settings/payments', label: 'Payment Settings', permission: Permission.MANAGE_PAYMENT_SETTINGS, moduleId: '/settings/payments' },
            { to: '/settings/upload-holidays', label: 'Upload Master Holidays', permission: Permission.UPLOAD_HOLIDAYS, moduleId: '/settings/upload-holidays' },
            { to: '/settings/roles', label: 'Roles & Permissions', permission: Permission.MANAGE_ROLES, moduleId: '/settings/roles' }
        ]
    },
];

const DashboardLayout: React.FC = () => {
    const { user, login, logout, hasPermission, refreshPermissions } = useAuth();
    const { currentSchool } = useSchool();
    const { schoolId } = useParams();
    const navigate = useNavigate();
    const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
    const { data: allSettings } = useFirestore<any>('settings');
    const moduleControls = allSettings?.find(s => s.id === `module_controls_${currentSchool?.id}`);

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [openMenuLabel, setOpenMenuLabel] = useState<string | null>(null);
    const location = useLocation();

    // Sync Global Role & Overrides to localStorage for synchronous checks
    useEffect(() => {
        if (!allSettings || !currentSchool?.id) return;

        const safeId = currentSchool.id.replace(/\//g, '');
        const roleConfigs = allSettings.find(s => s.id === `role_configs_${safeId}`);
        let synced = false;
        if (roleConfigs?.roles) {
            localStorage.setItem('millat_custom_roles', JSON.stringify(roleConfigs.roles));
            synced = true;
        }

        const userOverrides = allSettings.find(s => s.id === `user_overrides_${safeId}`);
        if (userOverrides?.overrides) {
            localStorage.setItem('millat_user_overrides', JSON.stringify(userOverrides.overrides));
            synced = true;
        }

        // Force all permission-dependent components to re-render with the updated data
        if (synced) refreshPermissions();
    }, [allSettings, currentSchool?.id, refreshPermissions]);

    // Close mobile menu on route change

    // Handle logout with proper navigation
    const handleLogout = () => {
        // Clear auth state first
        logout();

        // Force redirect using window.location to ensure navigation happens
        const loginPath = schoolId ? `/${schoolId}/login` : '/login';
        window.location.href = loginPath;
    };

    return (
        <div className={`layout-root ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
            {/* Mobile Overlay */}
            <div
                className="mobile-overlay"
                onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Sidebar */}
            <aside className="sidebar no-print">
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.875rem',
                    marginBottom: '2rem',
                    padding: '0 0.5rem',
                    minWidth: 0, // Critical for ellipsis to work in flex
                }}>
                    <div className="animate-scale-in" style={{
                        width: '40px',
                        height: '40px',
                        background: 'white',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        overflow: 'hidden',
                        padding: (currentSchool?.logoUrl || currentSchool?.logo) ? '2px' : '0'
                    }}>
                        {(currentSchool?.logoUrl || currentSchool?.logo) ? (
                            <img src={currentSchool?.logoUrl || currentSchool?.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                            <Building2 size={24} color="var(--primary)" />
                        )}
                    </div>
                    <h2 className="sidebar-title animate-fade-in" style={{
                        fontSize: 'clamp(1rem, 2vw, 1.25rem)',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: '#fff',
                        margin: 0,
                        flex: 1
                    }}>
                        {currentSchool?.name || APP_CONFIG.name}
                    </h2>
                </div>

                <nav style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }} className="sidebar-nav">
                    {menuItems.map((item, idx) => {
                        // 1. Role & Permission Filtering (Super Admin bypasses this)
                        if (user?.role !== 'SUPER_ADMIN') {
                            // If it has a specific permission, that is our primary gate
                            if (item.permission) {
                                if (!hasPermission(item.permission)) return null;
                            } else {
                                // If no permission is defined, check roles (e.g. for section headers or role-only items)
                                // We skip role check for parents with children, as children filtering will decide parent visibility
                                if (!item.children && item.roles && (!user?.role || !item.roles.includes(user.role as any))) return null;
                            }
                        }

                        // 3. School Module Gate (Tenant level) - APPLIES TO ALL USERS INCLUDING SUPER_ADMIN
                        if (currentSchool && (item as any).moduleId) {
                            const mid = (item as any).moduleId;
                            if (currentSchool.allowedModules && !currentSchool.allowedModules.includes(mid)) return null;
                        }

                        // 4. Global Module filtering (Master Control)
                        if ((item as any).moduleId && moduleControls) {
                            const mid = (item as any).moduleId;
                            if (moduleControls[mid] === false) return null;
                        }

                        if (item.children) {
                            const filteredChildren = item.children.filter((child: any) => {
                                // 1. Unified filtering (Super Admin bypasses this)
                                if (user?.role !== 'SUPER_ADMIN') {
                                    if (child.permission) {
                                        if (!hasPermission(child.permission)) return false;
                                    } else if (child.roles) {
                                        if (!user?.role || !child.roles.includes(user?.role as any)) return false;
                                    }
                                }

                                // 3. School Module Gate (Tenant level)
                                if (currentSchool && (child as any).moduleId) {
                                    if (currentSchool.allowedModules) {
                                        const cMid = (child as any).moduleId as string;
                                        // Direct match OR base-module match (e.g. '/students/photos' → 'students')
                                        const parts = cMid.split('/').filter(Boolean);
                                        const baseModule = parts[0] || null;
                                        const isAllowed = currentSchool.allowedModules.includes(cMid) ||
                                            (baseModule && currentSchool.allowedModules.includes(baseModule));

                                        if (!isAllowed) return false;
                                    }
                                }

                                // 4. Global Module filtering (Master Control)
                                if (moduleControls && moduleControls[child.to] === false) return false;

                                return true;
                            });
                            if (filteredChildren.length === 0) return null;

                            return (
                                <CollapsableSidebarItem
                                    key={idx}
                                    {...item}
                                    children={filteredChildren.map(child => ({ ...child, to: `/${schoolId}${child.to.startsWith('/') ? '' : '/'}${child.to}` }))}
                                    collapsed={sidebarCollapsed}
                                    hasPermission={hasPermission}
                                    isOpen={openMenuLabel === item.label}
                                    onToggle={() => setOpenMenuLabel(openMenuLabel === item.label ? null : item.label)}
                                    onOpen={() => setOpenMenuLabel(item.label)}
                                    moduleControls={moduleControls}
                                    schoolId={schoolId}
                                    moduleId={(item as any).moduleId}
                                />
                            );
                        }
                        return (
                            <SidebarItem
                                key={idx}
                                {...item as any}
                                to={`/${schoolId}${item.to!.startsWith('/') ? '' : '/'}${item.to}`}
                                collapsed={sidebarCollapsed}
                                onClick={() => setIsMobileMenuOpen(false)}
                            />
                        );
                    })}
                </nav>

                <SidebarPaymentCard
                    paymentInfo={allSettings?.find(s => s.id === 'payment_info') || allSettings?.find(s => s.id === 'bank_details')}
                    collapsed={sidebarCollapsed}
                />

                <button
                    onClick={handleLogout}
                    className="sidebar-logout-btn"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '0.875rem 1rem',
                        borderRadius: '0.75rem',
                        color: '#ef4444',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'all 0.2s ease',
                        width: '100%',
                        overflow: 'hidden',
                    }}
                >
                    <LogOut size={20} style={{ flexShrink: 0 }} />
                    <span className="sidebar-label">Logout</span>
                </button>
            </aside>

            {/* Main Content Area */}
            <div className="main-wrapper">
                {/* Header */}
                <header className="header no-print">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            onClick={() => window.innerWidth < 1024 ? setIsMobileMenuOpen(true) : setSidebarCollapsed(!sidebarCollapsed)}
                            className="btn-icon header-menu-toggle"
                            style={{
                                background: 'var(--bg-main)',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-main)',
                                padding: '0.5rem',
                                borderRadius: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <Menu size={22} />
                        </button>

                        {/* Student Profile Header for Parents */}
                        {user?.role === 'PARENT' && (
                            <div className="header-student-info animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingLeft: '0.5rem', borderLeft: '1px solid var(--border)', marginLeft: '0.5rem' }}>
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                    overflow: 'hidden',
                                    flexShrink: 0,
                                    boxShadow: '0 4px 10px rgba(99, 102, 241, 0.15)'
                                }}>
                                    <img
                                        src={user?.photo || `https://ui-avatars.com/api/?name=${user?.username}&background=6366f1&color=fff`}
                                        alt="Student"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                </div>
                                <div style={{ lineHeight: 1.1 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                                        {user?.username}
                                    </div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        {user?.admissionNo || `ID: ${user?.id?.slice(-6)}`} • {user?.class || 'N/A'}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="search-container" style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="input-field header-search"
                                style={{ width: '240px', paddingLeft: '2.75rem', height: '40px', background: 'var(--bg-main)', border: 'none' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                            className="btn-icon hover-glow"
                            onClick={() => {
                                if (user?.role === 'TEACHER' || user?.role === 'PARENT') {
                                    navigate(`/${schoolId}/dashboard?tab=MESSAGES`);
                                } else {
                                    navigate(`/${schoolId}/messages`);
                                }
                            }}
                            style={{ position: 'relative', background: 'transparent', border: 'none', padding: '0.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
                        >
                            <Bell size={22} />
                            <span style={{ position: 'absolute', top: '6px', right: '6px', width: '8px', height: '8px', background: 'var(--accent)', borderRadius: '50%', border: '2px solid var(--bg-card)' }}></span>
                        </button>

                        <div style={{ height: '24px', width: '1px', background: 'var(--border)', margin: '0 0.25rem' }} className="header-divider"></div>

                        <div style={{ position: 'relative' }}>
                            <div
                                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: (user?.role === 'PARENT' && !(user?.allProfiles && user.allProfiles.length > 1)) ? 'default' : 'pointer' }}
                                className="user-profile-trigger"
                                onClick={() => {
                                    if (user?.allProfiles && user.allProfiles.length > 1) {
                                        setShowAccountSwitcher(!showAccountSwitcher);
                                    } else if (user?.role !== 'PARENT') {
                                        navigate(`/${schoolId}/profile`);
                                    }
                                }}
                            >
                                <div className="user-info" style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>{user?.username}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                                        {user?.displayRole || user?.role}
                                        {user?.allProfiles && user.allProfiles.length > 1 && <ChevronDown size={14} />}
                                    </div>
                                </div>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '12px',
                                    background: 'var(--primary)',
                                    overflow: 'hidden',
                                    padding: '2px',
                                    boxShadow: '0 4px 6px -1px var(--primary-glow)'
                                }}>
                                    <img
                                        src={`https://ui-avatars.com/api/?name=${user?.username}&background=6366f1&color=fff`}
                                        alt="Avatar"
                                        style={{ width: '100%', height: '100%', borderRadius: '10px' }}
                                    />
                                </div>
                            </div>

                            {showAccountSwitcher && user?.allProfiles && (
                                <>
                                    <div
                                        style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                                        onClick={() => setShowAccountSwitcher(false)}
                                    />
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        marginTop: '0.75rem',
                                        width: '240px',
                                        background: 'var(--bg-card)',
                                        borderRadius: '1rem',
                                        boxShadow: 'var(--shadow-lg)',
                                        border: '1px solid var(--border)',
                                        zIndex: 1000,
                                        overflow: 'hidden',
                                        padding: '0.5rem'
                                    }}>
                                        <div style={{ padding: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', marginBottom: '0.5rem' }}>
                                            SWITCH ACCOUNT
                                        </div>
                                        {user.allProfiles.map((profile: any, idx: number) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    login({ ...profile, allProfiles: user.allProfiles });
                                                    setShowAccountSwitcher(false);
                                                    navigate(`/${schoolId}/dashboard`);
                                                }}
                                                style={{
                                                    width: '100%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.75rem',
                                                    padding: '0.75rem',
                                                    borderRadius: '0.5rem',
                                                    background: profile.id === user.id ? 'var(--primary-glow)' : 'transparent',
                                                    border: 'none',
                                                    color: profile.id === user.id ? 'var(--primary)' : 'var(--text-main)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    textAlign: 'left'
                                                }}
                                            >
                                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <User size={16} />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{profile.username}</div>
                                                    <div style={{ fontSize: '0.6875rem', opacity: 0.7 }}>{profile.role} {profile.class ? `(${profile.class})` : ''}</div>
                                                </div>
                                                {profile.id === user.id && <div style={{ width: '6px', height: '6px', background: 'var(--primary)', borderRadius: '50%' }} />}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className="content-root">
                    <div className="animate-fade-in" style={{ height: '100%' }}>
                        <Outlet />
                    </div>
                </main>

                {/* AI Assistant */}
                {hasPermission(Permission.USE_AI_ASSISTANT) && <AIAssistant />}
                {hasPermission(Permission.USE_AI_ASSISTANT) && <VoiceLiveAssistant />}
            </div>

            <style>{`
                .layout-root {
                    display: flex;
                    min-height: 100vh;
                    background: var(--bg-main);
                    position: relative;
                }
                .sidebar {
                    --neon-cyan: #00f2ff;
                    --neon-purple: #7000ff;
                    --neon-glow: rgba(0, 242, 255, 0.5);
                    
                    width: 280px;
                    background: rgba(5, 10, 21, 0.9) !important; /* Deep Space Blue Surface */
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(0, 242, 255, 0.2);
                    padding: 2.5rem 1.25rem;
                    display: flex;
                    flex-direction: column;
                    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                    position: fixed;
                    left: 1.25rem;
                    top: 1.25rem;
                    height: calc(100vh - 2.5rem);
                    z-index: 100;
                    border-radius: 1.5rem;
                    box-shadow: 0 0 30px rgba(0, 0, 0, 0.5), inset 0 0 1px 1px rgba(0, 242, 255, 0.1);
                }
                .sidebar::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulance type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
                    opacity: 0.05;
                    border-radius: 1.5rem;
                    pointer-events: none;
                }

                /* Custom Scrollbar Styling */
                .sidebar-nav {
                    scrollbar-width: auto;
                    scrollbar-color: rgba(0, 242, 255, 0.3) rgba(255, 255, 255, 0.05);
                }
                .sidebar-nav::-webkit-scrollbar {
                    width: 16px;
                }
                .sidebar-nav::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                    margin: 4px 0;
                }
                .sidebar-nav::-webkit-scrollbar-thumb {
                    background: rgba(0, 242, 255, 0.3);
                    border-radius: 10px;
                    border: 4px solid transparent;
                    background-clip: padding-box;
                }
                .sidebar-nav::-webkit-scrollbar-thumb:hover {
                    background: rgba(0, 242, 255, 0.5);
                    border-radius: 10px;
                    border: 4px solid transparent;
                    background-clip: padding-box;
                }

                .sidebar-collapsed .sidebar {
                    width: 90px;
                }
                .main-wrapper {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    margin-left: 310px;
                    transition: margin-left 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                    min-width: 0;
                }
                .sidebar-collapsed .main-wrapper {
                    margin-left: 120px;
                }
                
                .sidebar-label {
                    white-space: nowrap;
                    transition: opacity 0.3s, visibility 0.3s;
                    letter-spacing: 0.05em;
                    font-size: 0.8125rem;
                    font-weight: 600;
                }
                .sidebar-collapsed .sidebar-label {
                    opacity: 0;
                    visibility: hidden;
                }
                .sidebar-collapsed .sidebar-title {
                    opacity: 0;
                    visibility: hidden;
                }

                .sidebar-item {
                    color: rgba(255, 255, 255, 0.5) !important;
                    border: 1px solid transparent;
                }
                .sidebar-item:hover {
                    background: rgba(0, 242, 255, 0.05) !important;
                    color: #00f2ff !important;
                    transform: scale(1.05) translateX(4px);
                    box-shadow: 0 0 15px rgba(0, 242, 255, 0.2);
                    border: 1px solid rgba(0, 242, 255, 0.2);
                }
                .sidebar-item.active {
                    background: linear-gradient(135deg, #00f2ff 0%, #7000ff 100%) !important;
                    color: #050a15 !important;
                    box-shadow: 0 0 20px rgba(0, 242, 255, 0.4);
                    border: none;
                }
                .sidebar-item.active .sidebar-label {
                    color: #050a15;
                    text-shadow: none;
                }
                .group-active {
                    background: rgba(112, 0, 255, 0.1) !important;
                    color: #00f2ff !important;
                    border-left: 3px solid #00f2ff;
                }
                .sidebar-logout-btn {
                    color: rgba(255, 255, 255, 0.5) !important;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    font-size: 0.75rem;
                }
                .sidebar-logout-btn:hover {
                    background: rgba(239, 68, 68, 0.1) !important;
                    color: #ff4757 !important;
                    transform: scale(1.05);
                    box-shadow: 0 0 15px rgba(239, 68, 68, 0.2);
                }
                .header {
                    height: 70px;
                    background: rgba(255, 255, 255, 0.85);
                    border-bottom: 1px solid var(--border);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 1.5rem;
                    position: sticky;
                    top: 0;
                    z-index: 80;
                    backdrop-filter: blur(12px);
                }
                .content-root {
                    padding: 2rem;
                    flex: 1;
                }

                .sidebar-title {
                    color: white !important;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    text-shadow: 0 0 10px rgba(0, 242, 255, 0.3);
                }

                .sidebar-item-sub {
                    color: rgba(255, 255, 255, 0.4) !important;
                    letter-spacing: 0.03em;
                }
                .sidebar-item-sub:hover {
                    background: rgba(255, 255, 255, 0.02) !important;
                    color: #00f2ff !important;
                    text-shadow: 0 0 8px rgba(0, 242, 255, 0.5);
                    transform: scale(1.02) translateX(4px);
                }
                .sidebar-item-sub.active {
                    color: #00f2ff !important;
                    font-weight: 800 !important;
                    text-shadow: 0 0 12px rgba(0, 242, 255, 0.6);
                }

                .mobile-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.5);
                    backdrop-filter: blur(4px);
                    z-index: 90;
                    opacity: 0;
                    visibility: hidden;
                    transition: all 0.3s ease;
                }
                .mobile-menu-open .mobile-overlay {
                    opacity: 1;
                    visibility: visible;
                }

                @media (max-width: 1023px) {
                    .sidebar {
                        transform: translateX(-100%);
                        z-index: 1000;
                        width: 260px !important;
                        left: 0;
                        top: 0;
                        height: 100vh;
                        border-radius: 0 1.5rem 1.5rem 0;
                    }
                    .mobile-menu-open .sidebar {
                        transform: translateX(0);
                        box-shadow: 0 0 50px rgba(0,0,0,0.5);
                    }
                    .main-wrapper {
                        margin-left: 0 !important;
                    }
                    .header-search {
                        display: none;
                    }
                    .user-info {
                        display: none;
                    }
                    .header-divider {
                        display: none;
                    }
                    .content-root {
                        padding: 1.25rem !important;
                    }
                    .header {
                        padding: 0 1rem !important;
                        height: 60px !important;
                    }
                }
                @media (max-width: 639px) {
                   .search-container { display: none; }
                }
                .btn-icon:hover {
                    background: var(--border) !important;
                    transform: scale(1.05);
                }
            `}</style>
        </div>
    );
};

export default DashboardLayout;
