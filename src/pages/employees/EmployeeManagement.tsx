import React, { useState, useEffect } from 'react';
import { Search, Edit2, UserPlus, Phone, Briefcase, Calendar, Banknote, BookOpen, GraduationCap, X, Key, Check, MessageCircle } from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toProperCase } from '../../utils/formatters';
import { sortClasses } from '../../constants/app';
import { formatDate } from '../../utils/dateUtils';
import { useSchool } from '../../context/SchoolContext';

interface Employee {
    id: string; // Generated ID like EMP001
    uid?: string; // Firestore Doc ID
    name: string;
    designation: string;
    employeeType: string;
    mobile: string;
    email: string;
    status: 'ACTIVE' | 'INACTIVE';
    pin?: string;
    loginPin?: string;
    baseSalary: number;
    joiningDate: string;
    dob?: string;
    subjects?: string[];
    teachingClasses?: string[];
    fromClass?: string;
    toClass?: string;
    createdAt: string;
}

const EmployeeManagement: React.FC = () => {
    const { currentSchool } = useSchool();
    const [showModal, setShowModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const { data: employees, loading, add: addEmployee, update: updateEmployee } = useFirestore<Employee>('teachers');
    const { data: allSettings } = useFirestore<any>('settings');

    const [classes, setClasses] = useState<string[]>([]);
    const [rawAcademicSubjects, setRawAcademicSubjects] = useState<any[]>([]);
    const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBirthMonth, setSelectedBirthMonth] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        designation: '',
        employeeType: 'Teacher',
        mobile: '',
        email: '',
        baseSalary: 0,
        joiningDate: new Date().toISOString().split('T')[0],
        dob: '',
        subjects: [] as string[],
        teachingClasses: [] as string[],
        fromClass: '',
        toClass: ''
    });

    // Load classes and subjects from settings
    useEffect(() => {
        if (allSettings) {
            const activeClasses = sortClasses(
                allSettings.filter((d: any) => d.type === 'class' && d.active !== false)
            );
            setClasses(activeClasses.map((c: any) => c.name));

            const structureId = `academic_structure_${currentSchool?.id}`;
            const academicStructure = allSettings.find((d: any) => d.id === structureId || d.id === 'academic_structure');
            if (academicStructure?.subjects && Array.isArray(academicStructure.subjects)) {
                setRawAcademicSubjects(academicStructure.subjects);
            }
        }
    }, [allSettings, currentSchool?.id]);

    // Dynamic Filter for subjects based on selected classes
    useEffect(() => {
        if (formData.teachingClasses.length === 0) {
            // If no class selected, maybe show no subjects or all if we want.
            // But user said "show subjects which are in those class", so let's show only matches.
            setAvailableSubjects([]);
            return;
        }

        const filtered = rawAcademicSubjects.filter(sub =>
            sub.enabledFor.some((cls: string) => formData.teachingClasses.includes(cls))
        ).map(sub => sub.name);

        setAvailableSubjects(Array.from(new Set(filtered)));

        // Clean up selected subjects that are no longer available
        const validSubjects = formData.subjects.filter(s => filtered.includes(s));
        if (validSubjects.length !== formData.subjects.length) {
            setFormData(prev => ({ ...prev, subjects: validSubjects }));
        }
    }, [formData.teachingClasses, rawAcademicSubjects]);

    const handleOpenModal = (employee?: Employee) => {
        if (employee) {
            setEditingEmployee(employee);
            setFormData({
                name: employee.name || '',
                designation: employee.designation || '',
                employeeType: employee.employeeType,
                mobile: employee.mobile || '',
                email: employee.email || '',
                baseSalary: employee.baseSalary || 0,
                joiningDate: employee.joiningDate || new Date().toISOString().split('T')[0],
                dob: employee.dob || '',
                subjects: employee.subjects || [],
                teachingClasses: employee.teachingClasses || (employee.fromClass ? [employee.fromClass, employee.toClass].filter(Boolean) as string[] : []),
                fromClass: employee.fromClass || '',
                toClass: employee.toClass || ''
            });
        } else {
            setEditingEmployee(null);
            setFormData({
                name: '',
                designation: '',
                employeeType: 'Teacher',
                mobile: '',
                email: '',
                baseSalary: 0,
                joiningDate: new Date().toISOString().split('T')[0],
                dob: '',
                subjects: [],
                teachingClasses: [],
                fromClass: '',
                toClass: ''
            });
        }
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.mobile.length !== 10) {
            alert('Mobile number must be exactly 10 digits');
            return;
        }

        try {
            const employeeData: any = {
                ...formData,
                name: toProperCase(formData.name),
                designation: toProperCase(formData.designation || formData.employeeType),
                status: editingEmployee?.status || 'ACTIVE',
                updatedAt: new Date().toISOString()
            };

            // Remove teacher specific fields if not a teacher
            if (formData.employeeType !== 'Teacher') {
                delete employeeData.subjects;
                delete employeeData.fromClass;
                delete employeeData.toClass;
            }

            if (editingEmployee) {
                const docId = editingEmployee.uid || editingEmployee.id;
                await updateEmployee(docId, employeeData);
                alert('Employee updated successfully!');
            } else {
                const pin = Math.floor(1000 + Math.random() * 9000).toString();
                // Find highest existing ID to increment
                const highestId = employees.length > 0
                    ? Math.max(...employees.map(e => parseInt(e.id?.replace('EMP', '') || '0')))
                    : 0;
                const newId = `EMP${(highestId + 1).toString().padStart(3, '0')}`;

                await addEmployee({
                    ...employeeData,
                    id: newId,
                    pin,
                    createdAt: new Date().toISOString()
                });
                alert(`Employee registered successfully!\nGenerated PIN: ${pin}`);
            }

            // The list will update automatically via Firestore listeners
            setShowModal(false);
        } catch (error) {
            alert('Failed to save employee: ' + (error as Error).message);
        }
    };

    const toggleStatus = async (employeeId: string, currentStatus: string) => {
        try {
            const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
            await updateEmployee(employeeId, { status: nextStatus });
        } catch (error) {
            alert('Status update failed');
        }
    };

    const handleSubjectToggle = (subject: string) => {
        const currentSubjects = [...formData.subjects];
        if (currentSubjects.includes(subject)) {
            setFormData({ ...formData, subjects: currentSubjects.filter(s => s !== subject) });
        } else {
            setFormData({ ...formData, subjects: [...currentSubjects, subject] });
        }
    };

    const handleClassToggle = (className: string) => {
        const currentClasses = [...formData.teachingClasses];
        if (currentClasses.includes(className)) {
            setFormData({ ...formData, teachingClasses: currentClasses.filter(c => c !== className) });
        } else {
            setFormData({ ...formData, teachingClasses: [...currentClasses, className] });
        }
    };

    const handleSelectAllClasses = () => {
        setFormData(prev => ({ ...prev, teachingClasses: [...classes] }));
    };

    const handleClearAllClasses = () => {
        setFormData(prev => ({ ...prev, teachingClasses: [], subjects: [] }));
    };

    const handleSelectAllSubjects = () => {
        setFormData(prev => ({ ...prev, subjects: [...availableSubjects] }));
    };

    const handleClearAllSubjects = () => {
        setFormData(prev => ({ ...prev, subjects: [] }));
    };

    const sendWhatsApp = (emp: Employee) => {
        const schoolName = currentSchool?.fullName || currentSchool?.name || 'AI School 360';
        const schoolSlug = currentSchool?.id || 'pphs';

        const message = `Hello *${emp.name}*! 👋

Welcome to *${schoolName}*!

To access your staff portal, please follow these steps:

📱 *Step 1:* Click on this link
🔗 https://ai-school360.web.app/${schoolSlug}

📥 *Step 2:* Tap on *'Install App'* when prompted

🔐 *Step 3:* Login using your PIN: *${emp.pin}*

If you need any assistance, please contact the admin office.

Thank you!`;

        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/91${emp.mobile}?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
    };


    const rolesList = JSON.parse(localStorage.getItem('millat_custom_roles') || '[]')
        .filter((r: any) => r.id !== 'PARENT' && r.label !== 'Parent' && r.id !== 'SUPER_ADMIN' && r.role !== 'SUPER_ADMIN' && r.status !== 'INACTIVE');

    const customRoles = JSON.parse(localStorage.getItem('millat_custom_roles') || '[]');

    const filteredEmployees = employees.filter(emp => {
        const name = emp.name || '';
        const id = emp.id || '';
        const mobile = emp.mobile || '';

        const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            mobile.includes(searchTerm);

        let matchesBirthMonth = true;
        if (selectedBirthMonth) {
            if (emp.dob) {
                const dobDate = new Date(emp.dob);
                matchesBirthMonth = !isNaN(dobDate.getTime()) && (dobDate.getMonth() + 1) === parseInt(selectedBirthMonth);
            } else {
                matchesBirthMonth = false;
            }
        }

        return matchesSearch && matchesBirthMonth;
    })
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map(emp => {
            // Overlay role status
            const roleConfig = customRoles.find((r: any) =>
                (r.label && emp.employeeType && r.label.toLowerCase() === emp.employeeType.toLowerCase()) ||
                (r.id && emp.employeeType && r.id.toLowerCase() === emp.employeeType.toLowerCase())
            );
            const isRoleDisabled = roleConfig?.status === 'INACTIVE';
            return { ...emp, isRoleDisabled };
        });

    return (
        <div className="animate-fade-in no-scrollbar">
            <div className="page-header">
                <div>
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.025em' }}>Employee Management</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.0625rem' }}>Manage records for teachers, staff, and other faculty members.</p>
                </div>
                <button
                    className="btn btn-primary hover-glow hover-lift"
                    onClick={() => handleOpenModal()}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1.5rem', height: '3rem' }}
                >
                    <UserPlus size={18} /> New Registration
                </button>
            </div>

            <div className="glass-card animate-slide-up" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', background: 'rgba(255, 255, 255, 0.3)', borderBottom: '1px solid var(--border)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search by name or mobile..."
                            className="input-field"
                            style={{ paddingLeft: '3rem', background: 'white', border: '1px solid var(--border)' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="input-field"
                        style={{ padding: '0.5rem', width: 'auto', background: 'white', border: '1px solid var(--border)' }}
                        value={selectedBirthMonth}
                        onChange={(e) => setSelectedBirthMonth(e.target.value)}
                    >
                        <option value="">Birthday Month</option>
                        <option value="1">January</option>
                        <option value="2">February</option>
                        <option value="3">March</option>
                        <option value="4">April</option>
                        <option value="5">May</option>
                        <option value="6">June</option>
                        <option value="7">July</option>
                        <option value="8">August</option>
                        <option value="9">September</option>
                        <option value="10">October</option>
                        <option value="11">November</option>
                        <option value="12">December</option>
                    </select>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', background: 'rgba(248, 250, 252, 0.5)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <th style={{ padding: '1.25rem 1.5rem' }}>Name & Role</th>
                                <th style={{ padding: '1.25rem 1.5rem' }}>Experience Data</th>
                                <th style={{ padding: '1.25rem 1.5rem' }}>Contact</th>
                                <th style={{ padding: '1.25rem 1.5rem' }}>Joining / PIN</th>
                                <th style={{ padding: '1.25rem 1.5rem' }}>Salary</th>
                                <th style={{ padding: '1.25rem 1.5rem' }}>Status</th>
                                <th style={{ padding: '1.25rem 1.5rem' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading employee data...</td>
                                </tr>
                            ) : filteredEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No records found</td>
                                </tr>
                            ) : filteredEmployees.map((emp, index) => (
                                <tr key={emp.uid || emp.id} style={{ borderBottom: '1px solid var(--border)', animationDelay: `${index * 0.1}s` }} className="hover-row animate-fade-in">
                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{
                                                width: '42px',
                                                height: '42px',
                                                borderRadius: '12px',
                                                background: emp.employeeType === 'Teacher' ? 'var(--primary)' : '#64748b',
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.875rem',
                                                fontWeight: 800,
                                            }}>
                                                {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '1rem' }}>{emp.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <Briefcase size={12} /> {emp.designation || emp.employeeType}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            {emp.employeeType === 'Teacher' ? (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {emp.subjects && emp.subjects.length > 0 && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                            <BookOpen size={12} /> {emp.subjects.slice(0, 2).join(', ')}{emp.subjects.length > 2 ? '...' : ''}
                                                        </div>
                                                    )}
                                                    {emp.teachingClasses && emp.teachingClasses.length > 0 ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                            <GraduationCap size={12} />
                                                            {emp.teachingClasses.slice(0, 3).join(', ')}{emp.teachingClasses.length > 3 ? '...' : ''}
                                                        </div>
                                                    ) : emp.fromClass && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                            <GraduationCap size={12} /> {emp.fromClass} to {emp.toClass}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Non-Teaching Staff</span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', fontSize: '0.875rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Phone size={12} /> {emp.mobile}</div>
                                            <div style={{ color: 'var(--text-muted)' }}>{emp.email || 'No Email'}</div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}>
                                                <Calendar size={14} style={{ color: 'var(--primary)' }} />
                                                {formatDate(emp.joiningDate)}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary)' }}>
                                                <Key size={14} /> PIN: {emp.pin || emp.loginPin || '----'}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: 'var(--primary)' }}>
                                            <Banknote size={16} /> ₹{emp.baseSalary?.toLocaleString() || 0}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                                            <div style={{
                                                padding: '0.4rem 0.75rem',
                                                background: (emp.status === 'ACTIVE' && !emp.isRoleDisabled) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                color: (emp.status === 'ACTIVE' && !emp.isRoleDisabled) ? '#10b981' : '#ef4444',
                                                borderRadius: '2rem',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                            }}>
                                                {emp.isRoleDisabled ? 'ROLE LOCKED' : (emp.status === 'ACTIVE' ? 'ENABLED' : 'DISABLED')}
                                            </div>
                                            {emp.isRoleDisabled && (
                                                <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 600 }}>Role is disabled in Access Control</span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                className="btn-icon hover-lift"
                                                style={{ color: '#25D366', background: 'rgba(37, 211, 102, 0.1)' }}
                                                onClick={() => sendWhatsApp(emp)}
                                                title="Send Login Details via WhatsApp"
                                            >
                                                <MessageCircle size={16} />
                                            </button>
                                            <button
                                                className="btn-icon hover-lift"
                                                style={{ color: 'var(--text-muted)' }}
                                                onClick={() => handleOpenModal(emp)}
                                                title="Edit Details"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                className="btn-icon hover-lift"
                                                style={{
                                                    color: emp.status === 'ACTIVE' ? '#ff9800' : '#10b981',
                                                    background: 'rgba(0,0,0,0.03)'
                                                }}
                                                onClick={() => toggleStatus((emp.uid || emp.id)!, emp.status)}
                                                title={emp.status === 'ACTIVE' ? 'Disable Account' : 'Enable Account'}
                                            >
                                                {emp.status === 'ACTIVE' ? <X size={16} /> : <Check size={16} />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Registration/Edit Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
                    <div className="glass-card animate-scale-in" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', background: 'white', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                                {editingEmployee ? `Edit Employee: ${editingEmployee.name}` : 'Register New Employee'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="btn-icon">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'grid', gap: '1.25rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="input-group">
                                    <label className="field-label">Full Name *</label>
                                    <input type="text" className="input-field" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} onBlur={e => setFormData({ ...formData, name: toProperCase(e.target.value) })} />
                                </div>
                                <div className="input-group">
                                    <label className="field-label">Employee Type *</label>
                                    <select
                                        className="input-field"
                                        required
                                        value={formData.employeeType}
                                        onChange={e => setFormData({ ...formData, employeeType: e.target.value as any, designation: '' })}
                                    >
                                        {rolesList.map((r: any) => (
                                            <option key={r.id} value={r.label}>{r.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="input-group">
                                    <label className="field-label">Mobile Number *</label>
                                    <input type="tel" className="input-field" required value={formData.mobile} onChange={e => setFormData({ ...formData, mobile: e.target.value })} maxLength={10} />
                                </div>
                                <div className="input-group">
                                    <label className="field-label">Email Address</label>
                                    <input type="email" className="input-field" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="input-group">
                                    <label className="field-label">Designation / Role</label>
                                    <input type="text" className="input-field" placeholder={formData.employeeType} value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })} onBlur={e => setFormData({ ...formData, designation: toProperCase(e.target.value) })} />
                                </div>
                                <div className="input-group">
                                    <label className="field-label">Monthly Base Salary (₹) *</label>
                                    <input type="number" className="input-field" required value={formData.baseSalary} onChange={e => setFormData({ ...formData, baseSalary: Number(e.target.value) })} />
                                </div>
                            </div>

                            <div className="input-group">
                                <label className="field-label">Joining Date *</label>
                                <input type="date" className="input-field" required value={formData.joiningDate} onChange={e => setFormData({ ...formData, joiningDate: e.target.value })} />
                            </div>

                            <div className="input-group">
                                <label className="field-label">Date of Birth</label>
                                <input type="date" className="input-field" value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} />
                            </div>

                            {formData.employeeType === 'Teacher' && (
                                <div style={{ background: 'var(--bg-main)', padding: '1.25rem', borderRadius: '1rem', border: '1px solid var(--border)', display: 'grid', gap: '1rem' }}>
                                    <h4 style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Teaching Capabilities</h4>

                                    <div className="input-group">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <label className="field-label">Classes he/she can teach *</label>
                                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                                <button type="button" onClick={handleSelectAllClasses} style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer' }}>Select All</button>
                                                <button type="button" onClick={handleClearAllClasses} style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer' }}>Clear All</button>
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            {classes.map(cls => (
                                                <label key={cls} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', padding: '0.4rem', borderRadius: '0.5rem', background: formData.teachingClasses.includes(cls) ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-secondary)', border: `1px solid ${formData.teachingClasses.includes(cls) ? 'var(--primary)' : 'var(--border)'}`, transition: 'all 0.2s' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.teachingClasses.includes(cls)}
                                                        onChange={() => handleClassToggle(cls)}
                                                    />
                                                    <span style={{ fontWeight: formData.teachingClasses.includes(cls) ? 700 : 500 }}>{cls}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {formData.teachingClasses.length > 0 && (
                                        <div className="input-group" style={{ marginTop: '0.5rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label className="field-label">Subjects he/she can teach ({availableSubjects.length} available)</label>
                                                {availableSubjects.length > 0 && (
                                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                                        <button type="button" onClick={handleSelectAllSubjects} style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer' }}>Select All</button>
                                                        <button type="button" onClick={handleClearAllSubjects} style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer' }}>Clear All</button>
                                                    </div>
                                                )}
                                            </div>
                                            {availableSubjects.length === 0 ? (
                                                <p style={{ fontSize: '0.75rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.05)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(239, 68, 68, 0.1)' }}>No subjects found for selected classes. Please check Academic Structure settings.</p>
                                            ) : (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                    {availableSubjects.map(sub => (
                                                        <label key={sub} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', padding: '0.4rem', borderRadius: '0.5rem', background: formData.subjects.includes(sub) ? 'rgba(16, 185, 129, 0.1)' : 'transparent', transition: 'all 0.2s' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.subjects.includes(sub)}
                                                                onChange={() => handleSubjectToggle(sub)}
                                                            />
                                                            <span style={{ fontWeight: formData.subjects.includes(sub) ? 700 : 500 }}>{sub}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="btn" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                                    {editingEmployee ? 'Update Changes' : 'Register Employee'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeManagement;
