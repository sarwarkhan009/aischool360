import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bus, Power, Navigation, User } from 'lucide-react';
import { rtdb } from '../../lib/firebase';
import { ref, set, remove, serverTimestamp, onDisconnect } from 'firebase/database';

const DriverTracking: React.FC = () => {
    const { user } = useAuth();
    const [isJourneyActive, setIsJourneyActive] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<GeolocationPosition | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Request location permission on mount
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                () => console.log('Location permission granted'),
                (err) => {
                    console.warn('Location permission denied:', err);
                    setError("Please enable location permissions to use tracking.");
                },
                { enableHighAccuracy: true }
            );
        }
    }, []);

    useEffect(() => {
        let watchId: number;

        if (isJourneyActive) {
            if ("geolocation" in navigator) {
                watchId = navigator.geolocation.watchPosition(
                    (position) => {
                        setCurrentLocation(position);
                        updateLocationInRTDB(position);
                    },
                    (err) => {
                        setError(err.message);
                        setIsJourneyActive(false);
                    },
                    { enableHighAccuracy: true, timeout: 27000, maximumAge: 0 }
                );
            } else {
                setError("Geolocation is not supported by your browser.");
                setIsJourneyActive(false);
            }
        }

        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, [isJourneyActive]);

    const updateLocationInRTDB = async (position: GeolocationPosition) => {
        if (!user?.id) return;

        try {
            const busRef = ref(rtdb, `bus_locations/${user.id}`);

            // Auto cleanup when driver closes app
            onDisconnect(busRef).remove();

            await set(busRef, {
                driverId: user.id,
                driverName: user.username,
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                updatedAt: serverTimestamp(),
                isActive: true,
                accuracy: position.coords.accuracy
            });
        } catch (err) {
            console.error("Error updating location:", err);
        }
    };

    const toggleJourney = async () => {
        if (isJourneyActive) {
            // Stop Journey
            if (user?.id) {
                try {
                    await remove(ref(rtdb, `bus_locations/${user.id}`));
                } catch (err) {
                    console.error("Error deleting location:", err);
                }
            }
            setIsJourneyActive(false);
            setCurrentLocation(null);
        } else {
            // Start Journey
            setIsJourneyActive(true);
            setError(null);

            // Fetch initial location immediately
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                    setCurrentLocation(pos);
                    updateLocationInRTDB(pos);
                }, (err) => {
                    console.warn("Initial Fix Error:", err);
                }, { enableHighAccuracy: true, timeout: 10000 });
            }
        }
    };


    return (
        <div className="animate-fade-in" style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
            <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Bus size={24} />
                    </div>
                    <h1 style={{ fontWeight: 800 }}>Bus Tracking</h1>
                </div>

                <div style={{ background: 'var(--bg-main)', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--primary)' }}>
                            <User size={24} color="var(--primary)" />
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Logged in as</p>
                            <h3 style={{ fontWeight: 700 }}>{user?.username}</h3>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                        <div style={{ textAlign: 'left' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isJourneyActive ? '#10b981' : '#f43f5e' }} />
                                <span style={{ fontWeight: 700, color: isJourneyActive ? '#10b981' : '#f43f5e' }}>
                                    {isJourneyActive ? 'JOURNEY ACTIVE' : 'OFF DUTY'}
                                </span>
                            </div>
                        </div>
                        {isJourneyActive && (
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Signal</p>
                                <span style={{ fontWeight: 700, color: '#10b981' }}>Excellent</span>
                            </div>
                        )}
                    </div>
                </div>

                {error && (
                    <div style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
                        ⚠️ {error}
                    </div>
                )}

                <button
                    onClick={toggleJourney}
                    style={{
                        width: '100%',
                        height: '120px',
                        borderRadius: '2rem',
                        border: 'none',
                        background: isJourneyActive ? '#f43f5e' : 'var(--primary)',
                        color: 'white',
                        fontSize: '1.5rem',
                        fontWeight: 900,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        boxShadow: isJourneyActive ? '0 10px 30px rgba(244, 63, 94, 0.3)' : '0 10px 30px rgba(99, 102, 241, 0.3)',
                        transition: 'all 0.3s ease'
                    }}
                >
                    <Power size={32} />
                    {isJourneyActive ? 'STOP JOURNEY' : 'START JOURNEY'}
                </button>

                {isJourneyActive && currentLocation && (
                    <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f0f9ff', borderRadius: '1rem', border: '1px solid #e0f2fe' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0369a1', marginBottom: '0.5rem', justifyContent: 'center' }}>
                            <Navigation size={18} className="animate-pulse" />
                            <span style={{ fontWeight: 700 }}>Sharing Live Location</span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Lat: {currentLocation.coords.latitude.toFixed(6)}, Lng: {currentLocation.coords.longitude.toFixed(6)}
                        </p>
                    </div>
                )}

                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '2rem' }}>
                    Keep this window open while the bus is in transit. Your location will be shared with the school and parents.
                </p>
            </div>
        </div>
    );
};

export default DriverTracking;
