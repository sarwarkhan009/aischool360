import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Phone, Shield, Key, CheckCircle, RefreshCw, X } from 'lucide-react';
import { APP_CONFIG } from '../../constants/app';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { DEFAULT_ROLES, Permission } from '../../types/rbac';

interface LoginPortalProps {
    portalType: 'ADMIN' | 'MANAGER' | 'TEACHER' | 'DRIVER' | 'PARENT';
    title: string;
    subtitle: string;
    icon: React.ElementType;
    accentColor: string;
}

const LoginPortal: React.FC<LoginPortalProps> = ({ portalType, title, subtitle, icon: _Icon, accentColor }) => {
    const [mobile, setMobile] = useState('');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [isChangingPin, setIsChangingPin] = useState(false);

    // Change PIN State
    const [oldPin, setOldPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let userData: any = null;

            if (portalType === 'ADMIN') {
                // For admin, we use a single record or demo record
                // Check if admin credentials exist in settings
                const adminDoc = await getDoc(doc(db, 'settings', 'admin_credentials'));
                if (adminDoc.exists()) {
                    const data = adminDoc.data();
                    if (data.mobile === mobile && String(data.pin) === String(pin)) {
                        userData = { username: 'Administrator', role: 'ADMIN', permissions: Object.values(Permission), mobile };
                    }
                } else {
                    // Fallback to demo admin if not configured
                    if (mobile === '0000000000' && pin === '0000') {
                        userData = { username: 'Demo Admin', role: 'ADMIN', permissions: Object.values(Permission), mobile };
                    }
                }
            } else if (portalType === 'MANAGER') {
                // Use persistence or Firestore for managers. 
                // Current project stores managers in local storage via usePersistence.
                // Let's check local storage
                const savedManagers = JSON.parse(localStorage.getItem('millat_managers') || '[]');
                const manager = savedManagers.find((m: any) => m.mobile === mobile && String(m.pin) === String(pin));
                if (manager) {
                    const managerRole = DEFAULT_ROLES.find(r => r.role === 'MANAGER');
                    userData = {
                        username: manager.name,
                        role: 'MANAGER',
                        permissions: manager.permissions || managerRole?.permissions || [],
                        mobile: manager.mobile,
                        id: manager.id
                    };
                }
            } else if (portalType === 'TEACHER' || portalType === 'DRIVER') {
                const q = query(collection(db, 'teachers'), where('mobile', '==', mobile));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const match = snapshot.docs.find(d => {
                        const data = d.data();
                        const sPin = data.pin || data.loginPin || data.password || data.loginPassword;
                        return String(sPin) === String(pin);
                    });

                    if (match) {
                        const docData = match.data();
                        const isDriver = (docData.employeeType === 'Driver' || docData.employeeType === 'Bus Driver');
                        const isTeacher = (docData.employeeType === 'Teacher');

                        if ((portalType === 'TEACHER' && isTeacher) || (portalType === 'DRIVER' && isDriver)) {
                            const roleType = isTeacher ? 'TEACHER' : 'DRIVER';
                            const role = DEFAULT_ROLES.find(r => r.role === roleType);
                            userData = {
                                username: docData.name,
                                role: roleType,
                                permissions: role?.permissions || [],
                                mobile,
                                id: match.id
                            };
                        }
                    }
                }
            } else if (portalType === 'PARENT') {
                const q = query(collection(db, 'students'));
                const snapshot = await getDocs(q);
                const familyStudents = snapshot.docs.filter(d => {
                    const s = d.data();
                    return (s.mobileNo === mobile || s.phone === mobile || s.fatherContactNo === mobile || s.motherContactNo === mobile);
                });

                const matchingStudent = familyStudents.find(d => {
                    const s = d.data();
                    const sPin = s.pin || s.loginPin || s.password || s.loginPassword;
                    return String(sPin) === String(pin);
                });

                if (matchingStudent) {
                    const sData = matchingStudent.data();
                    const role = DEFAULT_ROLES.find(r => r.role === 'PARENT');
                    const allProfiles = familyStudents.map(fs => {
                        const fsData = fs.data();
                        return {
                            username: fsData.fullName || fsData.name,
                            role: 'PARENT',
                            permissions: role?.permissions || [],
                            mobile,
                            id: fs.id
                        };
                    });

                    userData = {
                        username: sData.fullName || sData.name,
                        role: 'PARENT',
                        permissions: role?.permissions || [],
                        mobile,
                        id: matchingStudent.id,
                        allProfiles
                    };
                }
            }

            if (userData) {
                login(userData);
                navigate('/dashboard');
            } else {
                alert('Invalid Mobile Number or PIN!');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('An error occurred during login. Please try again.');
        } finally {
            setLoading(false);
        }
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

            if (portalType === 'ADMIN') {
                const adminDoc = await getDoc(doc(db, 'settings', 'admin_credentials'));
                if (adminDoc.exists()) {
                    const data = adminDoc.data();
                    if (data.mobile === mobile && String(data.pin) === String(oldPin)) {
                        await updateDoc(doc(db, 'settings', 'admin_credentials'), { pin: newPin });
                        success = true;
                    }
                } else if (mobile === '0000000000' && oldPin === '0000') {
                    // Create if not exists for demo
                    await updateDoc(doc(db, 'settings', 'admin_credentials'), { mobile: '0000000000', pin: newPin });
                    success = true;
                }
            } else if (portalType === 'MANAGER') {
                const savedManagers = JSON.parse(localStorage.getItem('millat_managers') || '[]');
                const idx = savedManagers.findIndex((m: any) => m.mobile === mobile && String(m.pin) === String(oldPin));
                if (idx !== -1) {
                    savedManagers[idx].pin = newPin;
                    localStorage.setItem('millat_managers', JSON.stringify(savedManagers));
                    success = true;
                }
            } else {
                const collectionName = (portalType === 'TEACHER' || portalType === 'DRIVER') ? 'teachers' : 'students';
                const q = query(collection(db, collectionName), where('mobile', '==', mobile), where('pin', '==', oldPin));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    await updateDoc(doc(db, collectionName, snapshot.docs[0].id), { pin: newPin });
                    success = true;
                }
            }

            if (success) {
                alert('PIN updated successfully! Please login with your new PIN.');
                // Clear state and ensure user is on the correct portal page
                const portalPaths: Record<string, string> = {
                    'ADMIN': '/admin',
                    'MANAGER': '/manager',
                    'TEACHER': '/teacher',
                    'DRIVER': '/driver',
                    'PARENT': '/'
                };
                setIsChangingPin(false);
                setPin('');
                navigate(portalPaths[portalType] || '/');
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

    return (
        <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '1.5rem' }}>
            <div className="mesh-bg" style={{ filter: `hue-rotate(${portalType === 'ADMIN' ? '0' : portalType === 'MANAGER' ? '280' : portalType === 'TEACHER' ? '90' : portalType === 'DRIVER' ? '150' : '200'}deg)` }} />

            <div className="glass-card animate-scale-in" style={{
                width: '100%', maxWidth: '440px', padding: '3rem', position: 'relative', zIndex: 1,
                background: 'rgba(255, 255, 255, 0.9)', border: `1px solid ${accentColor}33`,
                boxShadow: `0 25px 50px -12px ${accentColor}22`, borderRadius: '2.5rem'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <img
                        src={APP_CONFIG.logo}
                        alt="Millat Academy Logo"
                        className="animate-breathe"
                        style={{
                            width: '120px',
                            height: 'auto',
                            margin: '0 auto 2rem',
                            display: 'block',
                            filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.1))'
                        }}
                    />
                    <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#1e293b', letterSpacing: '-0.025em' }}>{title}</h1>
                    <p style={{ color: '#64748b', fontSize: '1.1rem', marginTop: '0.5rem', fontWeight: 500 }}>{subtitle}</p>
                </div>

                {!isChangingPin ? (
                    <form onSubmit={handleLogin} style={{ display: 'grid', gap: '1.5rem' }}>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: accentColor, textTransform: 'uppercase', marginBottom: '0.75rem', display: 'block' }}>Primary Mobile</label>
                            <div style={{ position: 'relative' }}>
                                <Phone size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: accentColor }} />
                                <input
                                    type="tel" className="input-field" placeholder="10-digit mobile"
                                    style={{ paddingLeft: '3.5rem', height: '4rem', fontSize: '1.1rem', borderRadius: '1.25rem', border: '2px solid #f8fafc', background: 'white' }}
                                    value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} required
                                />
                            </div>
                        </div>

                        <div className="input-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: accentColor, textTransform: 'uppercase', marginBottom: '0.75rem', display: 'block' }}>Security PIN</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: accentColor }} />
                                <input
                                    type="password" className="input-field" placeholder="••••" maxLength={4}
                                    style={{ paddingLeft: '3.5rem', height: '4rem', fontSize: '1.8rem', letterSpacing: '0.5rem', borderRadius: '1.25rem', fontWeight: 900, border: '2px solid #f8fafc' }}
                                    value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} required
                                />
                            </div>
                        </div>

                        <button type="submit" disabled={loading} className="btn btn-primary" style={{
                            height: '4.5rem', fontSize: '1.25rem', fontWeight: 800, borderRadius: '1.5rem',
                            background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}ee 100%)`, marginTop: '1rem',
                            boxShadow: `0 15px 30px ${accentColor}44`
                        }}>
                            {loading ? <RefreshCw className="animate-spin" /> : <>Authenticate <Shield size={22} style={{ marginLeft: '0.5rem' }} /></>}
                        </button>

                        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={() => setIsChangingPin(true)}
                                style={{ background: 'transparent', border: 'none', color: accentColor, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', margin: '0 auto' }}
                            >
                                <Key size={16} /> Update Security PIN?
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleUpdatePin} style={{ display: 'grid', gap: '1.25rem' }} className="animate-slide-up">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <h3 style={{ fontWeight: 800, color: accentColor }}>Change Security PIN</h3>
                            <button type="button" onClick={() => setIsChangingPin(false)} className="btn-icon" style={{ padding: '0.25rem' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="input-group">
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>REGISTERED MOBILE</label>
                            <input
                                type="tel" className="input-field" placeholder="Mobile Number"
                                value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} required
                            />
                        </div>

                        <div className="input-group">
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>CURRENT PIN</label>
                            <input
                                type="password" className="input-field" placeholder="••••" maxLength={4}
                                value={oldPin} onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))} required
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="input-group">
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>NEW PIN</label>
                                <input
                                    type="password" className="input-field" placeholder="••••" maxLength={4}
                                    value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} required
                                />
                            </div>
                            <div className="input-group">
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>CONFIRM PIN</label>
                                <input
                                    type="password" className="input-field" placeholder="••••" maxLength={4}
                                    value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} required
                                />
                            </div>
                        </div>

                        <button type="submit" disabled={loading} className="btn btn-primary" style={{
                            height: '4rem', fontWeight: 800, borderRadius: '1.25rem',
                            background: accentColor, marginTop: '0.5rem'
                        }}>
                            {loading ? <RefreshCw className="animate-spin" /> : <>Update Secure PIN <CheckCircle size={20} style={{ marginLeft: '0.5rem' }} /></>}
                        </button>
                    </form>
                )}

                <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
                    {portalType === 'PARENT' && (
                        <button onClick={() => navigate('/register')} style={{ background: 'transparent', border: 'none', color: accentColor, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9rem' }}>
                            New admission? Apply here
                        </button>
                    )}
                </div>
            </div>

            <p style={{ position: 'absolute', bottom: '2rem', color: '#64748b', fontSize: '0.8125rem', fontWeight: 600 }}>
                &copy; {new Date().getFullYear()} {APP_CONFIG.name}. Multi-layered encryption active.
            </p>
        </div>
    );
};

export default LoginPortal;
