import React, { useMemo } from 'react';
import { GoogleMap, useJsApiLoader, InfoWindow, OverlayViewF } from '@react-google-maps/api';
import { usePersistence } from '../../hooks/usePersistence';
import { useRealtime } from '../../hooks/useRealtime';
import { Loader2, AlertTriangle } from 'lucide-react';

import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface BusLocation {
    id: string;
    driverId: string;
    driverName: string;
    lat: number;
    lng: number;
    updatedAt: any;
    isActive: boolean;
}

const containerStyle = {
    width: '100%',
    height: '100%',
    borderRadius: '1.5rem',
};

const MapInner: React.FC<{ apiKey: string, busLocations: BusLocation[] }> = ({ apiKey, busLocations }) => {
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: apiKey
    });

    const [selectedBusIds, setSelectedBusIds] = React.useState<string[]>([]);
    const [focusedBus, setFocusedBus] = React.useState<BusLocation | null>(null);

    // Filter out stale locations (older than 2 minutes)
    const activeBusLocations = useMemo(() => {
        const now = Date.now();
        const twoMinutes = 2 * 60 * 1000;
        return busLocations.filter(bus => {
            const updatedAt = typeof bus.updatedAt === 'number' ? bus.updatedAt : 0;
            return (now - updatedAt) < twoMinutes;
        });
    }, [busLocations]);

    // Buses actually shown on map (filtered by selection if any)
    const displayedBuses = useMemo(() => {
        if (selectedBusIds.length === 0) return activeBusLocations;
        return activeBusLocations.filter(bus => selectedBusIds.includes(bus.id));
    }, [activeBusLocations, selectedBusIds]);

    const center = useMemo(() => {
        if (focusedBus) return { lat: focusedBus.lat, lng: focusedBus.lng };
        if (displayedBuses.length > 0) {
            return { lat: displayedBuses[0].lat, lng: displayedBuses[0].lng };
        }
        return { lat: 23.3626, lng: 85.3242 }; // Ranchi Center
    }, [displayedBuses, focusedBus]);

    const toggleBusSelection = (id: string) => {
        setSelectedBusIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
        // Clear focus if we unselect the focused bus
        if (focusedBus?.id === id) setFocusedBus(null);
    };

    // Helper to get a consistent color for a driver ID
    const getDriverColor = (id: string) => {
        const colors = [
            '#4f46e5', // Primary
            '#10b981', // Success
            '#f59e0b', // Warning
            '#ef4444', // Danger
            '#8b5cf6', // Purple
            '#ec4899', // Pink
            '#06b6d4', // Cyan
            '#14b8a6'  // Teal
        ];
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = id.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    if (loadError) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', height: '100%', minHeight: '350px', background: '#fef2f2', borderRadius: '1.5rem', border: '1px solid #fee2e2', textAlign: 'center' }}>
                <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '1.5rem' }} />
                <h3 style={{ fontWeight: 800, color: '#991b1b', marginBottom: '0.5rem' }}>Map Failed to Load</h3>
                <p style={{ color: '#b91c1c', fontSize: '0.875rem' }}>{loadError.message}</p>
                <button onClick={() => window.location.reload()} className="btn" style={{ marginTop: '1.5rem', background: 'white', border: '1px solid #fee2e2' }}>Retry</button>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', height: '100%', minHeight: '350px', width: '100%', background: '#f8fafc' }}>
                <Loader2 size={40} className="animate-spin" color="var(--primary)" />
                <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Connecting to Satellites...</p>
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: '100%', minHeight: '350px', position: 'relative', overflow: 'hidden', borderRadius: '1.5rem' }}>
            <GoogleMap
                mapContainerStyle={{ ...containerStyle, minHeight: '350px' }}
                center={center}
                zoom={focusedBus ? 16 : 13}
                options={{
                    styles: [
                        { "featureType": "administrative", "elementType": "labels.text.fill", "stylers": [{ "color": "#444444" }] },
                        { "featureType": "landscape", "elementType": "all", "stylers": [{ "color": "#f2f2f2" }] },
                        { "featureType": "poi", "elementType": "all", "stylers": [{ "visibility": "off" }] },
                        { "featureType": "road", "elementType": "all", "stylers": [{ "saturation": -100 }, { "lightness": 45 }] },
                        { "featureType": "road.highway", "elementType": "all", "stylers": [{ "visibility": "simplified" }] },
                        { "featureType": "road.arterial", "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
                        { "featureType": "transit", "elementType": "all", "stylers": [{ "visibility": "off" }] },
                        { "featureType": "water", "elementType": "all", "stylers": [{ "color": "#46bcec" }, { "visibility": "on" }] }
                    ],
                    disableDefaultUI: false,
                    zoomControl: true,
                    gestureHandling: 'greedy'
                }}
            >
                {displayedBuses.map((bus) => (
                    <OverlayViewF
                        key={bus.id}
                        position={{ lat: bus.lat, lng: bus.lng }}
                        mapPaneName="overlayMouseTarget"
                        getPixelPositionOffset={(width, height) => ({
                            x: -(width / 2),
                            y: -(height / 2),
                        })}
                    >
                        <div
                            className="marker-container"
                            style={{ zIndex: 100 }}
                            onClick={() => setFocusedBus(bus)}
                        >
                            <div
                                className="marker-pulse"
                                style={{ backgroundColor: getDriverColor(bus.id) }}
                            />
                            <div
                                className="marker-dot"
                                style={{ backgroundColor: getDriverColor(bus.id) }}
                            />
                        </div>
                    </OverlayViewF>
                ))}

                {focusedBus && (
                    <InfoWindow
                        position={{ lat: focusedBus.lat, lng: focusedBus.lng }}
                        onCloseClick={() => setFocusedBus(null)}
                    >
                        <div style={{ padding: '0.4rem' }}>
                            <h4 style={{ margin: '0 0 0.25rem 0', fontWeight: 800, color: getDriverColor(focusedBus.id) }}>{focusedBus.driverName}</h4>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#666', fontWeight: 600 }}>STATUS: ACTIVE</p>
                        </div>
                    </InfoWindow>
                )}
            </GoogleMap>

            {/* Bottom Controls Area */}
            <div style={{
                position: 'absolute',
                bottom: '1rem',
                left: '0.75rem',
                right: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
                zIndex: 10,
                pointerEvents: 'none'
            }}>
                {/* Driver Selector List */}
                {activeBusLocations.length > 0 && (
                    <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        overflowX: 'auto',
                        padding: '0.5rem',
                        maxWidth: '100%',
                        msOverflowStyle: 'none',
                        scrollbarWidth: 'none',
                        pointerEvents: 'auto'
                    }} className="no-scrollbar">
                        {activeBusLocations.map(bus => (
                            <button
                                key={bus.id}
                                onClick={() => toggleBusSelection(bus.id)}
                                style={{
                                    flex: '0 0 auto',
                                    background: selectedBusIds.includes(bus.id) ? getDriverColor(bus.id) : 'rgba(255,255,255,0.98)',
                                    color: selectedBusIds.includes(bus.id) ? 'white' : 'var(--text-main)',
                                    border: `1px solid ${selectedBusIds.includes(bus.id) ? 'transparent' : 'rgba(0,0,0,0.1)'}`,
                                    padding: '0.5rem 1rem',
                                    borderRadius: '1rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    boxShadow: '0 10px 20px rgba(0,0,0,0.15)',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.2s ease',
                                    transform: selectedBusIds.includes(bus.id) ? 'translateY(-2px)' : 'none'
                                }}
                            >
                                <div style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    background: selectedBusIds.includes(bus.id) ? '#fff' : getDriverColor(bus.id),
                                    border: '2px solid rgba(255,255,255,0.3)'
                                }} className="animate-pulse" />
                                {bus.driverName}
                            </button>
                        ))}
                    </div>
                )}


                {/* Status Badge */}
                <div style={{
                    background: 'rgba(30, 41, 59, 0.9)',
                    backdropFilter: 'blur(10px)',
                    padding: '0.5rem 1rem',
                    borderRadius: '2rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    pointerEvents: 'auto'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} className="animate-pulse" />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white' }}>
                            {activeBusLocations.length} BUSES ONLINE
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};


const MapComponent: React.FC = () => {
    const [localApiKey, setLocalApiKey] = usePersistence<string>('millat_google_maps_api_key', '');
    const [apiKey, setApiKey] = React.useState<string>(localApiKey);
    const { data: busLocations } = useRealtime<BusLocation>('bus_locations');
    const [isFetchingKey, setIsFetchingKey] = React.useState(!localApiKey);

    React.useEffect(() => {
        const fetchKey = async () => {
            if (!localApiKey) {
                try {
                    const docRef = doc(db, 'settings', 'google_maps');
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const key = docSnap.data().apiKey;
                        setApiKey(key);
                        setLocalApiKey(key); // Cache it locally too
                    }
                } catch (err) {
                    console.error("Error fetching Maps API Key:", err);
                } finally {
                    setIsFetchingKey(false);
                }
            } else {
                setApiKey(localApiKey);
                setIsFetchingKey(false);
            }
        };
        fetchKey();
    }, [localApiKey]);

    if (isFetchingKey) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', height: '100%', minHeight: '350px', width: '100%', background: '#f8fafc' }}>
                <Loader2 size={40} className="animate-spin" color="var(--primary)" />
                <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Securing API Connection...</p>
            </div>
        );
    }

    if (!apiKey) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', height: '100%', minHeight: '350px', background: '#fff7ed', borderRadius: '1.5rem', border: '1px solid #ffedd5', textAlign: 'center' }}>
                <AlertTriangle size={48} color="#f59e0b" style={{ marginBottom: '1.5rem' }} />
                <h3 style={{ fontWeight: 800, color: '#9a3412', marginBottom: '0.5rem' }}>Maps API Key Missing</h3>
                <p style={{ color: '#c2410c', maxWidth: '300px', fontSize: '0.875rem' }}>Please configure your Google Maps API Key in <strong>Settings</strong> to enable tracking.</p>
            </div>
        );
    }

    return <MapInner apiKey={apiKey} busLocations={busLocations} />;
};

export default MapComponent;
