import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSchool } from '../../context/SchoolContext';
import { useAuth } from '../../context/AuthContext';
import { Lock, Phone, Shield, Key, CheckCircle, RefreshCw, X, GraduationCap, Briefcase, Truck, Users, UserCog, Smartphone } from 'lucide-react';
import { APP_CONFIG } from '../../constants/app';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { DEFAULT_ROLES, Permission } from '../../types/rbac';

interface UserData {
    username: string;
    role: 'ADMIN' | 'MANAGER' | 'TEACHER' | 'DRIVER' | 'PARENT' | 'SUPER_ADMIN';
    permissions: Permission[];
    mobile: string;
    id?: string;
    schoolId?: string;
    class?: string;
    section?: string;
    fatherName?: string;
    motherName?: string;
    displayRole?: string;
}

const UnifiedLogin: React.FC = () => {
    const [mobile, setMobile] = useState('');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [isChangingPin, setIsChangingPin] = useState(false);
    const [foundUsers, setFoundUsers] = useState<UserData[]>([]);
    const [showRoleSelection, setShowRoleSelection] = useState(false);

    // Change PIN State
    const [oldPin, setOldPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isStandalone, setIsStandalone] = useState(false);

    const { login } = useAuth();
    const { currentSchool } = useSchool();
    const navigate = useNavigate();
    const { schoolId: urlSchoolId } = useParams();

    // Handle PWA Installation
    useEffect(() => {
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        const handleAppInstalled = () => {
            setDeferredPrompt(null);
            setIsStandalone(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        // Check if already in standalone mode
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
            setIsStandalone(true);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setFoundUsers([]);

        try {
            const results: UserData[] = [];
            // Fetch global roles and overrides from Firestore for the specific school
            let customRoles = [];
            let userOverrides = {};
            if (currentSchool?.id) {
                const safeId = currentSchool.id.replace(/\//g, '');
                const [rolesDoc, overridesDoc] = await Promise.all([
                    getDoc(doc(db, 'settings', `role_configs_${safeId}`)),
                    getDoc(doc(db, 'settings', `user_overrides_${safeId}`))
                ]);

                if (rolesDoc.exists()) {
                    customRoles = rolesDoc.data().roles || [];
                    localStorage.setItem('aischool360_custom_roles', JSON.stringify(customRoles));
                    // Also sync to 'millat_custom_roles' which is what hasPermission() reads
                    localStorage.setItem('millat_custom_roles', JSON.stringify(customRoles));
                }
                if (overridesDoc.exists()) {
                    userOverrides = overridesDoc.data().overrides || {};
                    localStorage.setItem('aischool360_user_overrides', JSON.stringify(userOverrides));
                    // Also sync to 'millat_user_overrides' which is what hasPermission() reads
                    localStorage.setItem('millat_user_overrides', JSON.stringify(userOverrides));
                }
            }

            const isRoleEnabled = (role: string) => {
                if (role === 'ADMIN') return true;
                const customRole = customRoles.find((r: any) => r.role === role || r.id === role);
                return customRole ? customRole.status === 'ACTIVE' : true;
            };

            let disabledRolesFound: string[] = [];

            // 1. Check Admin
            // School-specific admins are stored as: settings/admin_credentials_{schoolId}
            // Global super admin is stored as: settings/admin_credentials
            const safeSchoolId = currentSchool?.id?.replace(/\//g, '') || '';
            const adminDocId = currentSchool ? `admin_credentials_${safeSchoolId}` : 'admin_credentials';
            const adminDoc = await getDoc(doc(db, 'settings', adminDocId));
            if (adminDoc.exists()) {
                const data = adminDoc.data();
                if (data.mobile === mobile && String(data.pin) === String(pin)) {
                    results.push({
                        username: currentSchool ? 'Administrator' : 'Super Administrator',
                        role: currentSchool ? 'ADMIN' : 'SUPER_ADMIN',
                        displayRole: currentSchool ? 'Administrator' : 'Super Administrator',
                        permissions: Object.values(Permission),
                        mobile,
                        schoolId: currentSchool?.id
                    });
                }
            } else if (mobile === '0000000000' && pin === '0000') {
                results.push({
                    username: currentSchool ? 'Demo Admin' : 'Demo Super Admin',
                    role: currentSchool ? 'ADMIN' : 'SUPER_ADMIN',
                    permissions: Object.values(Permission),
                    mobile
                });
            } else if (!currentSchool && mobile === '9999999999' && pin === '9999') {
                results.push({
                    username: 'System Admin',
                    role: 'SUPER_ADMIN',
                    permissions: Object.values(Permission),
                    mobile
                });
            }

            // If we are in a specific school context, we must filter all other entities by currentSchool.id
            const filterSchoolId = currentSchool?.id;

            // 2. Check Manager
            const savedManagers = JSON.parse(localStorage.getItem('aischool360_managers') || '[]');
            const managerMatch = savedManagers.find((m: any) => m.mobile === mobile && String(m.pin) === String(pin));
            if (managerMatch) {
                if (!isRoleEnabled('MANAGER')) {
                    disabledRolesFound.push('Management');
                } else if (managerMatch.status !== 'INACTIVE') {
                    const managerRole = DEFAULT_ROLES.find(r => r.role === 'MANAGER');
                    results.push({
                        username: managerMatch.name,
                        role: 'MANAGER',
                        displayRole: managerMatch.role || 'Manager',
                        permissions: managerMatch.permissions || managerRole?.permissions || [],
                        mobile: managerMatch.mobile,
                        id: managerMatch.id
                    });
                }
            }

            // 3. Check Teacher / Driver
            let teacherQuery = query(collection(db, 'teachers'), where('mobile', '==', mobile));
            if (filterSchoolId) {
                teacherQuery = query(collection(db, 'teachers'), where('mobile', '==', mobile), where('schoolId', '==', filterSchoolId));
            }
            const teacherSnapshot = await getDocs(teacherQuery);
            teacherSnapshot.forEach(doc => {
                const docData = doc.data();
                if (docData.status === 'INACTIVE') return;

                // Check PIN across multiple possible fields
                const sPin = docData.pin || docData.loginPin || docData.password || docData.loginPassword;
                if (String(sPin) !== String(pin)) return;

                const empType = docData.employeeType || '';

                if (empType === 'Teacher') {
                    if (isRoleEnabled('TEACHER')) {
                        const customRole = customRoles.find((r: any) =>
                            (r.label && r.label.toLowerCase() === 'teacher') ||
                            (r.role === 'TEACHER') ||
                            (r.id === 'TEACHER')
                        );
                        const defaultRole = DEFAULT_ROLES.find(r => r.role === 'TEACHER');

                        results.push({
                            username: docData.name,
                            role: 'TEACHER',
                            displayRole: customRole?.label || 'Teacher',
                            permissions: customRole?.permissions || defaultRole?.permissions || [],
                            mobile,
                            id: docData.id || doc.id,
                            schoolId: docData.schoolId || filterSchoolId
                        });
                    } else {
                        disabledRolesFound.push('Teacher Portal');
                    }
                } else if (empType === 'Driver' || empType === 'Bus Driver') {
                    if (isRoleEnabled('DRIVER')) {
                        const customRole = customRoles.find((r: any) =>
                            (r.label && r.label.toLowerCase() === 'driver') ||
                            (r.role === 'DRIVER') ||
                            (r.id === 'DRIVER')
                        );
                        const defaultRole = DEFAULT_ROLES.find(r => r.role === 'DRIVER');

                        results.push({
                            username: docData.name,
                            role: 'DRIVER',
                            displayRole: customRole?.label || 'Bus Driver',
                            permissions: customRole?.permissions || defaultRole?.permissions || [],
                            mobile,
                            id: docData.id || doc.id,
                            schoolId: docData.schoolId || filterSchoolId
                        });
                    } else {
                        disabledRolesFound.push('Driver Portal');
                    }
                } else {
                    // Handle Manager, Accountant, Staff, and any custom employee types
                    // Map the employeeType label to its RBAC role
                    const matchedRole = customRoles.find((r: any) =>
                        (r.label && empType && r.label.toLowerCase() === empType.toLowerCase()) ||
                        (r.id && empType && r.id.toLowerCase() === empType.toLowerCase())
                    );

                    // Determine the RBAC role: use the matched role's .role field, or fall back to
                    // known mappings, or default to MANAGER for any non-teacher staff
                    let roleType: string = matchedRole?.role || 'MANAGER';
                    if (empType.toLowerCase() === 'manager' || empType.toLowerCase() === 'staff') roleType = 'MANAGER';
                    if (empType.toLowerCase() === 'accountant') roleType = 'ACCOUNTANT';

                    if (isRoleEnabled(roleType) && (!matchedRole || matchedRole.status !== 'INACTIVE')) {
                        const defaultRole = DEFAULT_ROLES.find(r => r.role === roleType);

                        results.push({
                            username: docData.name,
                            role: roleType as any,
                            displayRole: matchedRole?.label || empType,
                            permissions: matchedRole?.permissions || defaultRole?.permissions || [],
                            mobile,
                            id: docData.id || doc.id,
                            schoolId: docData.schoolId || filterSchoolId
                        });
                    } else {
                        disabledRolesFound.push(`${empType} Portal`);
                    }
                }
            });

            // 4. Check Parent (Siblings handling)
            let studentQuery = query(collection(db, 'students'));
            if (filterSchoolId) {
                studentQuery = query(collection(db, 'students'), where('schoolId', '==', filterSchoolId));
            }
            const studentSnapshot = await getDocs(studentQuery);
            const familyStudents = studentSnapshot.docs.filter(d => {
                const s = d.data();
                return (s.mobileNo === mobile || s.phone === mobile || s.fatherContactNo === mobile || s.motherContactNo === mobile);
            });

            // Find if any family student matches the PIN
            const hasMatchingPin = familyStudents.some(d => {
                const s = d.data();
                const sPin = s.pin || s.loginPin || s.password || s.loginPassword;
                return String(sPin) === String(pin);
            });

            if (hasMatchingPin) {
                if (!isRoleEnabled('PARENT')) {
                    disabledRolesFound.push('Parent Portal');
                } else {
                    familyStudents.forEach(student => {
                        const sData = student.data();
                        if (sData.status === 'INACTIVE') return;

                        // Show student name instead of father/mother name for profile selection
                        let pName = sData.fullName || sData.name || 'Student';

                        const customRole = customRoles.find((r: any) =>
                            (r.label && r.label.toLowerCase() === 'parent') ||
                            (r.role === 'PARENT') ||
                            (r.id === 'PARENT')
                        );
                        const defaultRole = DEFAULT_ROLES.find(r => r.role === 'PARENT');

                        results.push({
                            username: pName,
                            role: 'PARENT',
                            displayRole: customRole?.label || 'Parent',
                            permissions: customRole?.permissions || defaultRole?.permissions || [],
                            mobile,
                            id: sData.id || student.id,
                            admissionNo: sData.admissionNo || sData.id || student.id,
                            schoolId: sData.schoolId || filterSchoolId,
                            class: sData.class,
                            section: sData.section,
                            photo: sData.photo || sData.image,
                            fatherName: sData.fatherName || sData.parentName,
                            motherName: sData.motherName
                        } as any);
                    });
                }
            }

            if (results.length === 0) {
                if (disabledRolesFound.length > 0) {
                    alert(`Access Restricted: The ${disabledRolesFound.join(' & ')} is currently disabled by administrator.`);
                } else {
                    alert('Invalid Mobile Number or PIN!');
                }
            } else if (results.length === 1) {
                const user = results[0];
                login({ ...user, allProfiles: results } as any);
                const targetSchoolId = currentSchool?.id || user.schoolId;
                // Navigate to dashboard if permitted, otherwise first accessible route
                const hasDashboard = user.permissions?.includes(Permission.VIEW_DASHBOARD);
                let landingPage = 'dashboard';
                if (!hasDashboard) {
                    const fallbacks = [
                        { path: 'fees', perm: Permission.COLLECT_FEES },
                        { path: 'students', perm: Permission.VIEW_STUDENTS },
                        { path: 'attendance', perm: Permission.MANAGE_ATTENDANCE },
                        { path: 'calendar', perm: null },
                        { path: 'profile', perm: null },
                    ];
                    const first = fallbacks.find(f => !f.perm || user.permissions?.includes(f.perm));
                    landingPage = first?.path || 'profile';
                }
                navigate(targetSchoolId ? `/${targetSchoolId}/${landingPage}` : `/${landingPage}`);
            } else {
                setFoundUsers(results);
                setShowRoleSelection(true);
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('An error occurred during login. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleRoleSelect = (userData: UserData) => {
        login({
            ...userData,
            allProfiles: foundUsers as any
        } as any);
        const targetSchoolId = currentSchool?.id || userData.schoolId;
        // Navigate to dashboard if permitted, otherwise first accessible route
        const hasDashboard = userData.permissions?.includes(Permission.VIEW_DASHBOARD);
        let landingPage = 'dashboard';
        if (!hasDashboard) {
            const fallbacks = [
                { path: 'fees', perm: Permission.COLLECT_FEES },
                { path: 'students', perm: Permission.VIEW_STUDENTS },
                { path: 'attendance', perm: Permission.MANAGE_ATTENDANCE },
                { path: 'calendar', perm: null },
                { path: 'profile', perm: null },
            ];
            const first = fallbacks.find(f => !f.perm || userData.permissions?.includes(f.perm));
            landingPage = first?.path || 'profile';
        }
        navigate(targetSchoolId ? `/${targetSchoolId}/${landingPage}` : `/${landingPage}`);
    };

    const handleUpdatePin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPin !== confirmPin) {
            alert('New PIN and Confirm PIN do not match!');
            return;
        }
        if (newPin.length !== 4) {
            alert('PIN must be exactly 4 digits!');
            return;
        }

        setLoading(true);
        try {
            let success = false;
            // Update logic needs to be careful because one mobile/pincode might match multiple records
            // We'll update ALL records that match the mobile and old PIN

            // 1. Admin
            const adminDoc = await getDoc(doc(db, 'settings', 'admin_credentials'));
            if (adminDoc.exists()) {
                const data = adminDoc.data();
                if (data.mobile === mobile && String(data.pin) === String(oldPin)) {
                    await updateDoc(doc(db, 'settings', 'admin_credentials'), { pin: newPin });
                    success = true;
                }
            } else if (mobile === '0000000000' && String(oldPin) === '0000') {
                // For demo/initial setup
                await updateDoc(doc(db, 'settings', 'admin_credentials'), { mobile: '0000000000', pin: newPin });
                success = true;
            }

            // 2. Manager
            const savedManagers = JSON.parse(localStorage.getItem('aischool360_managers') || '[]');
            savedManagers.forEach((m: any) => {
                if (m.mobile === mobile && String(m.pin) === String(oldPin)) {
                    m.pin = newPin;
                    success = true;
                }
            });
            if (success) localStorage.setItem('aischool360_managers', JSON.stringify(savedManagers));

            // 3. Teachers/Drivers
            const teacherQuery = query(collection(db, 'teachers'), where('mobile', '==', mobile), where('pin', '==', oldPin));
            const teacherSnapshot = await getDocs(teacherQuery);
            for (const doc of teacherSnapshot.docs) {
                await updateDoc(doc.ref, { pin: newPin });
                success = true;
            }

            // 4. Parents (Students)
            const studentQuery = query(collection(db, 'students'));
            const studentSnapshot = await getDocs(studentQuery);
            for (const doc of studentSnapshot.docs) {
                const s = doc.data();
                if ((s.mobileNo === mobile || s.phone === mobile || s.fatherContactNo === mobile || s.motherContactNo === mobile) && String(s.pin) === String(oldPin)) {
                    await updateDoc(doc.ref, { pin: newPin });
                    success = true;
                }
            }

            if (success) {
                alert('PIN updated successfully! Please login with your new PIN.');
                setIsChangingPin(false);
                setPin('');
            } else {
                alert('Invalid Mobile or Old PIN!');
            }
        } catch (error) {
            console.error('Update PIN error:', error);
            alert('Failed to update PIN.');
        } finally {
            setLoading(false);
        }
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'ADMIN': return <Shield size={24} />;
            case 'MANAGER': return <UserCog size={24} />;
            case 'TEACHER': return <GraduationCap size={24} />;
            case 'DRIVER': return <Truck size={24} />;
            case 'PARENT': return <Users size={24} />;
            default: return <Briefcase size={24} />;
        }
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'ADMIN': return '#ef4444'; // Red
            case 'MANAGER': return '#8b5cf6'; // Violet
            case 'TEACHER': return '#10b981'; // Emerald
            case 'DRIVER': return '#f59e0b'; // Amber
            case 'PARENT': return '#3b82f6'; // Blue
            default: return '#64748b';
        }
    };

    return (
        <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '1.5rem' }}>
            <div className="mesh-bg" />

            <div className="glass-card animate-scale-in" style={{
                width: '100%', maxWidth: '440px', padding: '3rem', position: 'relative', zIndex: 1,
                background: 'rgba(255, 255, 255, 0.9)', border: `1px solid #e2e8f0`,
                boxShadow: `0 25px 50px -12px rgba(0,0,0,0.1)`, borderRadius: '2.5rem'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    {/* Logo with multiple fallbacks */}
                    <div style={{
                        width: '120px',
                        height: '120px',
                        margin: '0 auto 2rem',
                        borderRadius: '50%',
                        background: 'white',
                        border: '4px solid white',
                        boxShadow: '0 10px 15px rgba(0,0,0,0.1)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                    }}>
                        {(currentSchool?.logoUrl || currentSchool?.logo) ? (
                            <img
                                src={currentSchool?.logoUrl || currentSchool?.logo}
                                alt="Logo"
                                className="animate-breathe"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain'
                                }}
                                onError={(e) => {
                                    // If school logo fails, try app logo, then fallback to icon
                                    const target = e.currentTarget;
                                    if (target.src !== (window.location.origin + APP_CONFIG.logo)) {
                                        target.src = APP_CONFIG.logo;
                                    } else {
                                        target.style.display = 'none';
                                        const parent = target.parentElement;
                                        if (parent) {
                                            const icon = document.createElement('div');
                                            icon.innerHTML = '🏫';
                                            icon.style.fontSize = '4rem';
                                            parent.appendChild(icon);
                                        }
                                    }
                                }}
                            />
                        ) : (
                            <div style={{ fontSize: '4rem' }}>🏫</div>
                        )}
                    </div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#1e293b', letterSpacing: '-0.025em' }}>
                        {showRoleSelection ? 'Choose Profile' : isChangingPin ? 'Update PIN' : (currentSchool?.name || APP_CONFIG.name)}
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '1.1rem', marginTop: '0.5rem', fontWeight: 500 }}>
                        {showRoleSelection ? 'Multiple profiles found for this number' : 'Integrated Management System'}
                    </p>
                </div>

                {showRoleSelection ? (
                    <div style={{ display: 'grid', gap: '1rem' }} className="animate-slide-up">
                        {foundUsers.map((u, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleRoleSelect(u)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem',
                                    borderRadius: '1.25rem', border: `2px solid #f1f5f9`, background: 'white',
                                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                                    width: '100%'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.borderColor = getRoleColor(u.role);
                                    e.currentTarget.style.background = `${getRoleColor(u.role)}05`;
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.borderColor = '#f1f5f9';
                                    e.currentTarget.style.background = 'white';
                                }}
                            >
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '1rem',
                                    background: `${getRoleColor(u.role)}15`, color: getRoleColor(u.role),
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {getRoleIcon(u.role)}
                                </div>
                                <div>
                                    <h4 style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.1rem', marginBottom: '0.125rem' }}>{u.username}</h4>
                                    {u.role === 'PARENT' && u.fatherName && (
                                        <p style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>
                                            S/O: {u.fatherName}
                                        </p>
                                    )}
                                    <p style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                                        {u.role} {u.class ? `• ${u.class.replace(/class/gi, '').trim()}` : ''}
                                    </p>
                                </div>
                            </button>
                        ))}
                        <button
                            onClick={() => { setShowRoleSelection(false); setMobile(''); setPin(''); }}
                            style={{ background: 'transparent', border: 'none', color: '#64748b', fontWeight: 700, marginTop: '1rem', cursor: 'pointer' }}
                        >
                            Back to Login
                        </button>
                    </div>
                ) : !isChangingPin ? (
                    <form onSubmit={handleLogin} style={{ display: 'grid', gap: '1.5rem' }}>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'block' }}>Primary Mobile</label>
                            <div style={{ position: 'relative' }}>
                                <Phone size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                <input
                                    type="tel" inputMode="numeric" className="input-field" placeholder="10-digit mobile"
                                    style={{ paddingLeft: '3.5rem', height: '4rem', fontSize: '1.1rem', borderRadius: '1.25rem', border: '2px solid #f8fafc', background: 'white' }}
                                    value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} required
                                />
                            </div>
                        </div>

                        <div className="input-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'block' }}>Security PIN</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                <input
                                    type="password" inputMode="numeric" className="input-field" placeholder="••••" maxLength={4}
                                    style={{ paddingLeft: '3.5rem', height: '4rem', fontSize: '1.8rem', letterSpacing: '0.5rem', borderRadius: '1.25rem', fontWeight: 900, border: '2px solid #f8fafc' }}
                                    value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} required
                                />
                            </div>
                        </div>

                        <button type="submit" disabled={loading} className="btn btn-primary" style={{
                            height: '4.5rem', fontSize: '1.25rem', fontWeight: 800, borderRadius: '1.5rem',
                            background: `linear-gradient(135deg, #1e293b 0%, #334155 100%)`, marginTop: '1rem',
                            boxShadow: `0 15px 30px rgba(0,0,0,0.1)`
                        }}>
                            {loading ? <RefreshCw className="animate-spin" /> : <>Authenticate <Shield size={22} style={{ marginLeft: '0.5rem' }} /></>}
                        </button>

                        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={() => setIsChangingPin(true)}
                                style={{ background: 'transparent', border: 'none', color: '#64748b', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', margin: '0 auto' }}
                            >
                                <Key size={16} /> Update Security PIN?
                            </button>
                        </div>

                        {deferredPrompt && !isStandalone && (
                            <div className="animate-bounce" style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '1.25rem', border: '1px dashed #6366f1' }}>
                                <button
                                    type="button"
                                    onClick={handleInstallClick}
                                    style={{
                                        width: '100%',
                                        background: '#6366f1',
                                        color: 'white',
                                        border: 'none',
                                        padding: '1rem',
                                        borderRadius: '1rem',
                                        fontWeight: 800,
                                        fontSize: '1rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.75rem',
                                        boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)'
                                    }}
                                >
                                    <Smartphone size={20} /> Install App for Better Experience
                                </button>
                                <p style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 600, marginTop: '0.5rem', textAlign: 'center' }}>
                                    Install once, access anytime from your home screen.
                                </p>
                            </div>
                        )}
                    </form>
                ) : (
                    <form onSubmit={handleUpdatePin} style={{ display: 'grid', gap: '1.25rem' }} className="animate-slide-up">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <h3 style={{ fontWeight: 800, color: '#1e293b' }}>Change Security PIN</h3>
                            <button type="button" onClick={() => setIsChangingPin(false)} className="btn-icon" style={{ padding: '0.25rem' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="input-group">
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>REGISTERED MOBILE</label>
                            <input
                                type="tel" inputMode="numeric" className="input-field" placeholder="Mobile Number"
                                value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} required
                            />
                        </div>

                        <div className="input-group">
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>CURRENT PIN</label>
                            <input
                                type="password" inputMode="numeric" className="input-field" placeholder="••••" maxLength={4}
                                value={oldPin} onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))} required
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="input-group">
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>NEW PIN</label>
                                <input
                                    type="password" inputMode="numeric" className="input-field" placeholder="••••" maxLength={4}
                                    value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} required
                                />
                            </div>
                            <div className="input-group">
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>CONFIRM PIN</label>
                                <input
                                    type="password" inputMode="numeric" className="input-field" placeholder="••••" maxLength={4}
                                    value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} required
                                />
                            </div>
                        </div>

                        <button type="submit" disabled={loading} className="btn btn-primary" style={{
                            height: '4rem', fontWeight: 800, borderRadius: '1.25rem',
                            background: '#1e293b', marginTop: '0.5rem'
                        }}>
                            {loading ? <RefreshCw className="animate-spin" /> : <>Update Secure PIN <CheckCircle size={20} style={{ marginLeft: '0.5rem' }} /></>}
                        </button>
                    </form>
                )}

                {!showRoleSelection && !isChangingPin && (
                    <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
                        <button onClick={() => navigate(currentSchool ? `/${currentSchool.id}/register` : '/register')} style={{ background: 'transparent', border: 'none', color: '#64748b', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9rem' }}>
                            New admission? Apply here
                        </button>
                    </div>
                )}
            </div>

            <p style={{ position: 'absolute', bottom: '2rem', color: '#64748b', fontSize: '0.8125rem', fontWeight: 600 }}>
                &copy; {new Date().getFullYear()} {currentSchool?.name || APP_CONFIG.name}. Multi-layered encryption active.
            </p>
        </div>
    );
};

export default UnifiedLogin;
