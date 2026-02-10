import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    Bus,
    Power,
    Navigation,
    User,
    Clock,
    ShieldCheck,
    Map as MapIcon,
    AlertTriangle,
    CheckCircle2
} from 'lucide-react';
import { rtdb } from '../../lib/firebase';
import { ref, set, remove, serverTimestamp, onDisconnect } from 'firebase/database';


const DriverDashboard: React.FC = () => {
    const { user } = useAuth();
    const [isJourneyActive, setIsJourneyActive] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<GeolocationPosition | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    const [wakeLock, setWakeLock] = useState<any>(null);
    const [useHighAccuracy, setUseHighAccuracy] = useState(true);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Re-request wake lock if tab is switched back
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (isJourneyActive && document.visibilityState === 'visible') {
                await requestWakeLock();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isJourneyActive]);

    const requestWakeLock = async () => {
        if ('wakeLock' in navigator) {
            try {
                const lock = await (navigator as any).wakeLock.request('screen');
                setWakeLock(lock);
            } catch (err) {
                console.error("Wake Lock Error:", err);
            }
        }
    };

    const releaseWakeLock = async () => {
        if (wakeLock) {
            try {
                await wakeLock.release();
                setWakeLock(null);
            } catch (err) {
                console.error("Wake Lock Release Error:", err);
            }
        }
    };

    useEffect(() => {
        let watchId: number;

        if (isJourneyActive) {
            requestWakeLock();
            if ("geolocation" in navigator) {
                watchId = navigator.geolocation.watchPosition(
                    (position) => {
                        setCurrentLocation(position);
                        updateLocationInRTDB(position);
                        setError(null);
                    },
                    (err) => {
                        console.error("Geolocation error:", err);
                        if (err.code === 3 && useHighAccuracy) { // Code 3 is Timeout
                            console.log("GPS timeout, falling back to standard accuracy...");
                            setUseHighAccuracy(false);
                            setError("GPS signal weak - using network location for now...");
                        } else {
                            setError(err.message === "Timeout expired" ? "GPS signal is weak. Please stay near a window or move outdoors for better tracking." : err.message);
                        }
                    },
                    {
                        enableHighAccuracy: useHighAccuracy,
                        timeout: useHighAccuracy ? 20000 : 30000,
                        maximumAge: 10000
                    }
                );
            } else {
                setError("Geolocation is not supported by your browser.");
                setIsJourneyActive(false);
            }
        }

        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
            releaseWakeLock();
        };
    }, [isJourneyActive, useHighAccuracy]);

    const updateLocationInRTDB = async (position: GeolocationPosition) => {
        if (!user?.id) return;

        try {
            const busRef = ref(rtdb, `bus_locations/${user.id}`);

            // Set up automatic cleanup on disconnect
            onDisconnect(busRef).remove();

            await set(busRef, {
                driverId: user.id,
                driverName: user.username,
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                updatedAt: serverTimestamp(),
                isActive: true
            });
        } catch (err) {
            console.error("Error updating location:", err);
        }
    };

    const toggleJourney = async () => {
        if (isJourneyActive) {
            if (confirm("Are you sure you want to STOP the journey?")) {
                if (user?.id) {
                    try {
                        await remove(ref(rtdb, `bus_locations/${user.id}`));
                    } catch (err) {
                        console.error("Error deleting location:", err);
                    }
                }
                setIsJourneyActive(false);
                setCurrentLocation(null);
            }
        } else {
            setIsJourneyActive(true);
            setError(null);

            // Push initial location immediately if available
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                    setCurrentLocation(pos);
                    updateLocationInRTDB(pos);
                });
            }
        }
    };



    return (
        <div className="animate-fade-in" style={{ paddingBottom: '2rem' }}>
            {/* Header Section */}
            <div style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                margin: '-2rem -2rem 2rem -2rem',
                padding: '3rem 2rem',
                color: 'white',
                borderRadius: '0 0 2.5rem 2.5rem',
                boxShadow: '0 10px 30px rgba(79, 70, 229, 0.2)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.5rem' }}>
                            {(() => {
                                const hr = new Date().getHours();
                                if (hr < 12) return 'Good Morning';
                                if (hr < 17) return 'Good Afternoon';
                                return 'Good Evening';
                            })()}, {user?.username}
                        </h1>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', opacity: 0.9 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Clock size={18} />
                            <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Bus size={18} />
                            <span>Bus #{user?.id?.slice(-4).toUpperCase() || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '1.5rem',
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(10px)'
                }}>
                    <User size={32} />
                </div>
            </div>

            {/* Main Action Card */}
            <div className="glass-card animate-slide-up" style={{
                padding: '2.5rem',
                textAlign: 'center',
                marginTop: '-4rem',
                border: '1px solid rgba(255,255,255,0.5)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
            }}>
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '2rem',
                    background: isJourneyActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                    color: isJourneyActive ? '#10b981' : '#f43f5e',
                    fontWeight: 800,
                    fontSize: '0.875rem',
                    marginBottom: '1.5rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: isJourneyActive ? '#10b981' : '#f43f5e',
                        boxShadow: isJourneyActive ? '0 0 10px #10b981' : 'none'
                    }} className={isJourneyActive ? 'animate-pulse' : ''} />
                    {isJourneyActive ? 'System Live - Sharing Location' : 'System Offline - Stop Mode'}
                </div>

                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '2rem', color: '#1e293b' }}>
                    {isJourneyActive ? 'Safe Driving! Your route is being monitored.' : 'Ready to start your route?'}
                </h2>

                <button
                    onClick={toggleJourney}
                    style={{
                        width: '100%',
                        maxWidth: '400px',
                        height: '180px',
                        borderRadius: '3rem',
                        border: 'none',
                        background: isJourneyActive ? '#f43f5e' : 'var(--primary)',
                        color: 'white',
                        fontSize: '1.75rem',
                        fontWeight: 900,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '1rem',
                        cursor: 'pointer',
                        boxShadow: isJourneyActive ? '0 20px 40px rgba(244, 63, 94, 0.3)' : '0 20px 40px rgba(79, 70, 229, 0.3)',
                        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        margin: '0 auto'
                    }}
                    className="hover-lift"
                >
                    <Power size={48} />
                    {isJourneyActive ? 'END JOURNEY' : 'START JOURNEY'}
                </button>

                {error && (
                    <div style={{
                        marginTop: '2rem',
                        background: 'rgba(244, 63, 94, 0.05)',
                        color: '#f43f5e',
                        padding: '1.25rem',
                        borderRadius: '1rem',
                        fontSize: '1rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        justifyContent: 'center',
                        border: '1px solid rgba(244, 63, 94, 0.2)'
                    }}>
                        <AlertTriangle size={24} /> {error}
                    </div>
                )}
            </div>

            {/* Status Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
                <div className="glass-card hover-lift" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShieldCheck size={28} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>GPS Accuracy</p>
                        <h4 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Excellent</h4>
                    </div>
                </div>

                <div className="glass-card hover-lift" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '1rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Navigation size={28} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Current Lat/Lng</p>
                        <h4 style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'monospace' }}>
                            {currentLocation ? `${currentLocation.coords.latitude.toFixed(4)}, ${currentLocation.coords.longitude.toFixed(4)}` : 'Waiting for GPS...'}
                        </h4>
                    </div>
                </div>

                <div className="glass-card hover-lift" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '1rem', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MapIcon size={28} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Route Assigned</p>
                        <h4 style={{ fontSize: '1.125rem', fontWeight: 800 }}>City Center Main</h4>
                    </div>
                </div>
            </div>

            {/* Quick Tips */}
            <div className="glass-card" style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(255,255,255,0.4)', border: '1px dashed var(--border)' }}>
                <h4 style={{ fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Important Reminders
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        <CheckCircle2 size={16} color="#10b981" /> Keep phone screen ON
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        <CheckCircle2 size={16} color="#10b981" /> Maintain steady speed
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        <CheckCircle2 size={16} color="#10b981" /> Report delays to office
                    </div>
                </div>
            </div>
        </div >
    );
};

export default DriverDashboard;
