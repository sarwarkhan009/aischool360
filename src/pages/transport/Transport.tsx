import React, { useState } from 'react';
import {
    Bus,
    MapPin,
    Phone,
    User,
    Users,
    Search,
    Plus,
    Map,
    Trash2
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import BusMap from '../../components/transport/BusMap';

const Transport: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'routes' | 'drivers' | 'map'>('routes');
    const { data: drivers, add: addDriver, remove: removeDriver } = useFirestore<any>('drivers');

    // States for adding a new driver
    const [showDriverModal, setShowDriverModal] = useState(false);
    const [newDriver, setNewDriver] = useState({ name: '', mobile: '', busNo: '' });

    // Routes search and filtering
    const [searchTerm, setSearchTerm] = useState('');

    // We filter drivers as "routes" for now since each driver is associated with a bus/route
    const routes = drivers.filter((d: any) =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.busNo?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAddDriver = async (e: React.FormEvent) => {
        e.preventDefault();
        const pin = Math.floor(1000 + Math.random() * 9000).toString();
        await addDriver({
            ...newDriver,
            pin,
            status: 'ACTIVE',
            createdAt: new Date().toISOString()
        });
        setShowDriverModal(false);
        setNewDriver({ name: '', mobile: '', busNo: '' });
        alert(`Driver added successfully! PIN for ${newDriver.name} is ${pin}`);
    };

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '0.5rem' }}>Transport Management</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Manage school buses, drivers, routes, and live tracking.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        className={`btn ${activeTab === 'routes' ? 'btn-primary' : ''}`}
                        onClick={() => setActiveTab('routes')}
                        style={{ border: activeTab !== 'routes' ? '1px solid var(--border)' : 'none', background: activeTab !== 'routes' ? 'white' : '' }}
                    >
                        Routes
                    </button>
                    <button
                        className={`btn ${activeTab === 'drivers' ? 'btn-primary' : ''}`}
                        onClick={() => setActiveTab('drivers')}
                        style={{ border: activeTab !== 'drivers' ? '1px solid var(--border)' : 'none', background: activeTab !== 'drivers' ? 'white' : '' }}
                    >
                        Drivers
                    </button>
                    <button
                        className={`btn ${activeTab === 'map' ? 'btn-primary' : ''}`}
                        onClick={() => setActiveTab('map')}
                        style={{ border: activeTab !== 'map' ? '1px solid var(--border)' : 'none', background: activeTab !== 'map' ? 'white' : '' }}
                    >
                        Live Map
                    </button>
                </div>
            </div>

            {activeTab === 'routes' && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                            <Bus size={24} color="var(--primary)" style={{ margin: '0 auto 0.5rem' }} />
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{drivers.length || 0}</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Buses</p>
                        </div>
                        <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                            <MapPin size={24} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{drivers.length || 0}</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Routes Covered</p>
                        </div>
                        <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                            <Users size={24} color="#a855f7" style={{ margin: '0 auto 0.5rem' }} />
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>0</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Opted Students</p>
                        </div>
                        <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                            <Map size={24} color="#f43f5e" style={{ margin: '0 auto 0.5rem' }} />
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>0</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Live Now</p>
                        </div>
                    </div>

                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontWeight: 700 }}>Bus Routes & Tracking</h3>
                            <div style={{ position: 'relative', width: '300px' }}>
                                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Search route or driver..."
                                    className="input-field"
                                    style={{ paddingLeft: '3rem' }}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                            {routes.map((route: any) => (
                                <div key={route.id} className="glass-card" style={{ border: '1px solid var(--border)', background: 'var(--bg-main)', overflow: 'hidden' }}>
                                    <div style={{ padding: '1.25rem', background: 'white', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '40px', height: '40px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Bus size={20} />
                                            </div>
                                            <div>
                                                <h4 style={{ fontWeight: 700, fontSize: '0.9rem' }}>Route {route.busNo || 'N/A'}</h4>
                                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Vehicle: {route.busNo}</p>
                                            </div>
                                        </div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>ACTIVE</span>
                                    </div>
                                    <div style={{ padding: '1.25rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                            <div>
                                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Driver</p>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <User size={14} color="var(--text-muted)" />
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{route.name}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Phone</p>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <Phone size={14} color="var(--text-muted)" />
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{route.mobile}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Users size={14} color="var(--text-muted)" />
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Occupancy: <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>0/50</span></span>
                                            </div>
                                            <button className="btn" style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', background: 'white', border: '1px solid var(--border)' }}>View Stops</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {routes.length === 0 && (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                    No routes or drivers found. Please add drivers to see them here.
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'drivers' && (
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ fontWeight: 700 }}>Driver Management</h3>
                        <button className="btn btn-primary" onClick={() => setShowDriverModal(true)}>
                            <Plus size={18} style={{ marginRight: '0.5rem' }} /> Add Driver
                        </button>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                <th style={{ padding: '1rem' }}>Driver Name</th>
                                <th style={{ padding: '1rem' }}>Mobile No.</th>
                                <th style={{ padding: '1rem' }}>Bus No.</th>
                                <th style={{ padding: '1rem' }}>Login PIN</th>
                                <th style={{ padding: '1rem' }}>Status</th>
                                <th style={{ padding: '1rem' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {drivers.map((driver: any) => (
                                <tr key={driver.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '1rem', fontWeight: 600 }}>{driver.name}</td>
                                    <td style={{ padding: '1rem' }}>{driver.mobile}</td>
                                    <td style={{ padding: '1rem' }}>{driver.busNo}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 700 }}>
                                            {driver.pin}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <span className={`status-badge active`}>{driver.status}</span>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <button className="btn-icon" style={{ color: '#ef4444' }} onClick={() => removeDriver(driver.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {drivers.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No drivers found. Add your first driver to start tracking.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'map' && (
                <div className="glass-card" style={{ padding: '0', height: '650px', overflow: 'hidden', position: 'relative' }}>
                    <BusMap />
                </div>
            )}

            {showDriverModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="glass-card" style={{ padding: '2rem', width: '400px', background: 'white' }}>
                        <h3 style={{ fontWeight: 800, marginBottom: '1.5rem' }}>Add New Driver</h3>
                        <form onSubmit={handleAddDriver} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="input-group">
                                <label>Driver Name</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    required
                                    value={newDriver.name}
                                    onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })}
                                />
                            </div>
                            <div className="input-group">
                                <label>Mobile Number</label>
                                <input
                                    type="tel"
                                    className="input-field"
                                    required
                                    value={newDriver.mobile}
                                    onChange={(e) => setNewDriver({ ...newDriver, mobile: e.target.value })}
                                />
                            </div>
                            <div className="input-group">
                                <label>Bus Number</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    required
                                    value={newDriver.busNo}
                                    onChange={(e) => setNewDriver({ ...newDriver, busNo: e.target.value })}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="btn" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={() => setShowDriverModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Add Driver</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Transport;
