import React, { useState, useEffect } from 'react';
import { Save, ToggleLeft, ToggleRight, AlertCircle, CheckCircle, User, Users, ChevronRight, ChevronDown } from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useParams } from 'react-router-dom';
import { useSchool } from '../../context/SchoolContext';

interface RegistrationField {
    id: string;
    label: string;
    enabled: boolean;
    required: boolean;
    category: 'student' | 'father' | 'mother' | 'guardian';
}

const defaultFields: RegistrationField[] = [
    // Step 1: Student Details
    { id: 'fullName', label: 'Student Full Name', enabled: true, required: true, category: 'student' },
    { id: 'classRequested', label: 'Admission Class', enabled: true, required: true, category: 'student' },
    { id: 'dob', label: 'Date of Birth', enabled: true, required: true, category: 'student' },
    { id: 'gender', label: 'Gender', enabled: true, required: true, category: 'student' },
    { id: 'caste', label: 'Caste', enabled: true, required: false, category: 'student' },
    { id: 'bloodGroup', label: 'Blood Group', enabled: true, required: false, category: 'student' },
    { id: 'photo', label: 'Photo Upload', enabled: true, required: false, category: 'student' },
    { id: 'state', label: 'State', enabled: true, required: true, category: 'student' },
    { id: 'district', label: 'District', enabled: true, required: true, category: 'student' },
    { id: 'permanentAddress', label: 'Permanent Address', enabled: true, required: true, category: 'student' },
    { id: 'presentAddress', label: 'Present Address', enabled: true, required: true, category: 'student' },
    { id: 'pinCode', label: 'Pin Code', enabled: true, required: false, category: 'student' },
    { id: 'aadharNo', label: 'Student Aadhar No', enabled: true, required: false, category: 'student' },
    { id: 'appaarNo', label: 'Appaar No', enabled: true, required: false, category: 'student' },
    { id: 'studentPenNo', label: 'Student PEN No', enabled: true, required: false, category: 'student' },
    { id: 'previousSchool', label: 'Previous School', enabled: true, required: false, category: 'student' },
    { id: 'diseaseAllergy', label: 'Disease/Allergy', enabled: true, required: false, category: 'student' },

    // Step 2: Father's Details
    { id: 'fatherName', label: "Father's Name", enabled: true, required: true, category: 'father' },
    { id: 'fatherAadharNo', label: "Father's Aadhar No", enabled: true, required: false, category: 'father' },
    { id: 'fatherReligion', label: "Father's Religion", enabled: true, required: false, category: 'father' },
    { id: 'fatherQualification', label: "Father's Qualification", enabled: true, required: false, category: 'father' },
    { id: 'fatherOccupation', label: "Father's Occupation", enabled: true, required: false, category: 'father' },
    { id: 'fatherAddress', label: "Father's Address", enabled: true, required: false, category: 'father' },
    { id: 'fatherContactNo', label: "Father's Contact No", enabled: true, required: true, category: 'father' },
    { id: 'fatherWhatsappNo', label: "Father's WhatsApp No", enabled: true, required: false, category: 'father' },
    { id: 'fatherEmailId', label: "Father's Email ID", enabled: true, required: false, category: 'father' },
    { id: 'fatherAge', label: "Father's Age", enabled: true, required: false, category: 'father' },

    // Step 3: Mother's Details
    { id: 'motherName', label: "Mother's Name", enabled: true, required: true, category: 'mother' },
    { id: 'motherAadharNo', label: "Mother's Aadhar No", enabled: true, required: false, category: 'mother' },
    { id: 'motherReligion', label: "Mother's Religion", enabled: true, required: false, category: 'mother' },
    { id: 'motherQualification', label: "Mother's Qualification", enabled: true, required: false, category: 'mother' },
    { id: 'motherOccupation', label: "Mother's Occupation", enabled: true, required: false, category: 'mother' },
    { id: 'motherAddress', label: "Mother's Address", enabled: true, required: false, category: 'mother' },
    { id: 'motherContactNo', label: "Mother's Contact No", enabled: true, required: false, category: 'mother' },
    { id: 'motherWhatsappNo', label: "Mother's WhatsApp No", enabled: true, required: false, category: 'mother' },
    { id: 'motherEmailId', label: "Mother's Email ID", enabled: true, required: false, category: 'mother' },
    { id: 'motherAge', label: "Mother's Age", enabled: true, required: false, category: 'mother' },

    // Step 4: Guardian Details (Optional)
    { id: 'guardianName', label: "Guardian's Name", enabled: false, required: false, category: 'guardian' },
    { id: 'guardianMobile', label: "Guardian's Mobile", enabled: false, required: false, category: 'guardian' },
    { id: 'guardianAddress', label: "Guardian's Address", enabled: false, required: false, category: 'guardian' },
];

const RegistrationFieldsSettings: React.FC = () => {
    const [fields, setFields] = useState<RegistrationField[]>(defaultFields);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        student: true,
        father: false,
        mother: false,
        guardian: false
    });

    const { schoolId: urlSchoolId } = useParams();
    const { currentSchool } = useSchool();
    const schoolId = currentSchool?.id || urlSchoolId;

    const toggleSection = (category: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    useEffect(() => {
        if (schoolId) {
            loadSettings();
        }
    }, [schoolId]);

    const loadSettings = async () => {
        if (!schoolId) return;

        try {
            // Use school-specific path
            const docRef = doc(db, `schools/${schoolId}/settings/registration_fields`);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data && Array.isArray(data.fields)) {
                    const savedFieldsData = data.fields;
                    const mappedFields = defaultFields.map(df => {
                        const saved = savedFieldsData.find((sf: any) => sf.id === df.id);
                        if (saved) {
                            return {
                                ...df,
                                enabled: typeof saved.enabled === 'boolean' ? saved.enabled : df.enabled,
                                required: typeof saved.required === 'boolean' ? saved.required : df.required
                            };
                        }
                        return df;
                    });
                    setFields(mappedFields);
                }
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    };

    const handleToggleEnabled = (fieldId: string) => {
        setFields(prev => prev.map(field =>
            field.id === fieldId ? { ...field, enabled: !field.enabled } : field
        ));
        setSaveStatus('idle');
    };

    const handleToggleRequired = (fieldId: string) => {
        setFields(prev => prev.map(field =>
            field.id === fieldId ? { ...field, required: !field.required } : field
        ));
        setSaveStatus('idle');
    };

    const handleSave = async () => {
        if (!schoolId) {
            alert('School ID not found. Please ensure you are accessing this from a school context.');
            return;
        }

        setIsSaving(true);
        setSaveStatus('idle');

        try {
            // Use school-specific path
            const docRef = doc(db, `schools/${schoolId}/settings/registration_fields`);
            await setDoc(docRef, {
                fields: fields,
                updatedAt: new Date().toISOString()
            });

            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (error) {
            console.error('Error saving settings:', error);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    const getCategoryFields = (cat: string) => {
        return fields.filter(f => f.category === cat);
    };

    const renderFieldCard = (field: RegistrationField) => (
        <div key={field.id} className="field-card">
            <div className="field-header">
                <div className="field-info">
                    <h4 className="field-label">{field.label}</h4>
                    <span className="field-id">{field.id}</span>
                </div>
                <div className="field-controls">
                    <button
                        onClick={() => handleToggleEnabled(field.id)}
                        className={`toggle-btn ${field.enabled ? 'enabled' : 'disabled'}`}
                        title={field.enabled ? 'Enabled' : 'Disabled'}
                    >
                        {field.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                        <span>{field.enabled ? 'Enabled' : 'Disabled'}</span>
                    </button>
                </div>
            </div>

            {field.enabled && (
                <div className="field-options">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={field.required}
                            onChange={() => handleToggleRequired(field.id)}
                            className="checkbox-input"
                        />
                        <span className="checkbox-text">Required Field</span>
                    </label>
                </div>
            )}
        </div>
    );

    return (
        <div className="registration-fields-settings">
            <div className="settings-header">
                <div>
                    <h1 className="page-title">Registration Form Field Toggle</h1>
                    <p className="page-subtitle">
                        Configure visibility and requirements for the Public Online Registration form
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`save-btn ${saveStatus === 'success' ? 'success' : ''}`}
                >
                    {isSaving ? (
                        <>
                            <div className="spinner"></div>
                            Saving...
                        </>
                    ) : saveStatus === 'success' ? (
                        <>
                            <CheckCircle size={20} />
                            Saved!
                        </>
                    ) : (
                        <>
                            <Save size={20} />
                            Save Changes
                        </>
                    )}
                </button>
            </div>

            <div className="info-alert">
                <AlertCircle size={20} />
                <div>
                    <strong>Admin Note:</strong> These toggles control the Public Registration form used by parents.
                    Changes here will take effect immediately on the public registration page.
                </div>
            </div>

            <div className="field-sections">
                <section className={`field-section ${expandedSections.student ? 'expanded' : ''}`}>
                    <div className="section-header" onClick={() => toggleSection('student')} style={{ cursor: 'pointer' }}>
                        <div className="section-title-group">
                            <div className="category-icon">
                                <User size={24} />
                            </div>
                            <div>
                                <h2 className="section-title">Step 1: Student Details</h2>
                                <p className="section-subtitle">Basic student info, address, and class request</p>
                            </div>
                        </div>
                        <div className="section-header-right">
                            <span className="section-count">
                                {getCategoryFields('student').filter(f => f.enabled).length}/{getCategoryFields('student').length} enabled
                            </span>
                            {expandedSections.student ? <ChevronDown size={24} className="chevron" /> : <ChevronRight size={24} className="chevron" />}
                        </div>
                    </div>
                    {expandedSections.student && (
                        <div className="field-grid animate-slide-down">
                            {getCategoryFields('student').map(renderFieldCard)}
                        </div>
                    )}
                </section>

                <section className={`field-section ${expandedSections.father ? 'expanded' : ''}`}>
                    <div className="section-header" onClick={() => toggleSection('father')} style={{ cursor: 'pointer' }}>
                        <div className="section-title-group">
                            <div className="category-icon">
                                <Users size={24} />
                            </div>
                            <div>
                                <h2 className="section-title">Step 2: Father's Details</h2>
                                <p className="section-subtitle">Father's occupation, contact, and religion</p>
                            </div>
                        </div>
                        <div className="section-header-right">
                            <span className="section-count">
                                {getCategoryFields('father').filter(f => f.enabled).length}/{getCategoryFields('father').length} enabled
                            </span>
                            {expandedSections.father ? <ChevronDown size={24} className="chevron" /> : <ChevronRight size={24} className="chevron" />}
                        </div>
                    </div>
                    {expandedSections.father && (
                        <div className="field-grid animate-slide-down">
                            {getCategoryFields('father').map(renderFieldCard)}
                        </div>
                    )}
                </section>

                <section className={`field-section ${expandedSections.mother ? 'expanded' : ''}`}>
                    <div className="section-header" onClick={() => toggleSection('mother')} style={{ cursor: 'pointer' }}>
                        <div className="section-title-group">
                            <div className="category-icon">
                                <Users size={24} />
                            </div>
                            <div>
                                <h2 className="section-title">Step 3: Mother's Details</h2>
                                <p className="section-subtitle">Mother's occupation, contact, and religion</p>
                            </div>
                        </div>
                        <div className="section-header-right">
                            <span className="section-count">
                                {getCategoryFields('mother').filter(f => f.enabled).length}/{getCategoryFields('mother').length} enabled
                            </span>
                            {expandedSections.mother ? <ChevronDown size={24} className="chevron" /> : <ChevronRight size={24} className="chevron" />}
                        </div>
                    </div>
                    {expandedSections.mother && (
                        <div className="field-grid animate-slide-down">
                            {getCategoryFields('mother').map(renderFieldCard)}
                        </div>
                    )}
                </section>

                <section className={`field-section ${expandedSections.guardian ? 'expanded' : ''}`}>
                    <div className="section-header" onClick={() => toggleSection('guardian')} style={{ cursor: 'pointer' }}>
                        <div className="section-title-group">
                            <div className="category-icon">
                                <Users size={24} />
                            </div>
                            <div>
                                <h2 className="section-title">Step 4: Guardian Details (Optional)</h2>
                                <p className="section-subtitle">Guardian contact info when parents are unavailable</p>
                            </div>
                        </div>
                        <div className="section-header-right">
                            <span className="section-count">
                                {getCategoryFields('guardian').filter(f => f.enabled).length}/{getCategoryFields('guardian').length} enabled
                            </span>
                            {expandedSections.guardian ? <ChevronDown size={24} className="chevron" /> : <ChevronRight size={24} className="chevron" />}
                        </div>
                    </div>
                    {expandedSections.guardian && (
                        <div className="field-grid animate-slide-down">
                            {getCategoryFields('guardian').map(renderFieldCard)}
                        </div>
                    )}
                </section>
            </div>

            <style>{`
                .registration-fields-settings { max-width: 1400px; margin: 0 auto; }
                .settings-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; gap: 2rem; }
                .page-title { font-size: 2.25rem; font-weight: 900; color: #1e293b; margin: 0 0 0.5rem 0; letter-spacing: -0.025em; }
                .page-subtitle { font-size: 1.125rem; color: #64748b; margin: 0; }
                .save-btn { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 2rem; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; border: none; border-radius: 12px; font-size: 1.125rem; font-weight: 700; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3); white-space: nowrap; }
                .save-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 20px 25px -5px rgba(79, 70, 229, 0.4); }
                .save-btn:disabled { opacity: 0.7; cursor: not-allowed; }
                .save-btn.success { background: linear-gradient(135deg, #059669 0%, #10b981 100%); box-shadow: 0 10px 15px -3px rgba(5, 150, 105, 0.3); }
                .spinner { width: 20px; height: 20px; border: 3px solid rgba(255, 255, 255, 0.3); border-top-color: #ffffff; border-radius: 50%; animation: spin 0.8s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .info-alert { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem; margin-bottom: 3rem; color: #1e40af; }
                .field-sections { display: flex; flex-direction: column; gap: 3.5rem; }
                .field-section { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); transition: all 0.3s ease; }
                .field-section.expanded { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
                .section-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 2rem; background: #ffffff; transition: background 0.2s ease; }
                .section-header:hover { background: #f8fafc; }
                .section-header-right { display: flex; align-items: center; gap: 1.5rem; }
                .chevron { color: #94a3b8; transition: all 0.2s ease; }
                .section-header:hover .chevron { color: #6366f1; transform: scale(1.1); }
                .animate-slide-down { animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
                @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                .section-title-group { display: flex; align-items: center; gap: 1.25rem; }
                .category-icon { color: #6366f1; padding: 12px; background: #f5f3ff; border-radius: 14px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; }
                .section-title { font-size: 1.5rem; font-weight: 800; color: #1e293b; margin: 0 0 0.25rem 0; }
                .section-subtitle { font-size: 1rem; color: #64748b; margin: 0; }
                .section-count { font-size: 0.875rem; font-weight: 700; color: #6366f1; background: #f5f3ff; padding: 0.5rem 1rem; border-radius: 12px; border: 1px solid #e0e7ff; }
                .field-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; padding: 0 2rem 2.5rem 2rem; border-top: 1px solid #f1f5f9; padding-top: 2rem; }
                .field-card { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 16px; padding: 1.5rem; transition: all 0.2s ease; }
                .field-card:hover { background: #ffffff; border-color: #e2e8f0; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); transform: translateY(-2px); }
                .field-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.25rem; }
                .field-info { flex: 1; min-width: 0; }
                .field-label { font-size: 1.0625rem; font-weight: 700; color: #334155; margin: 0 0 0.5rem 0; }
                .field-id { font-size: 0.75rem; color: #94a3b8; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background: #f1f5f9; padding: 0.25rem 0.5rem; border-radius: 6px; }
                .toggle-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.875rem; border: none; border-radius: 10px; font-size: 0.875rem; font-weight: 700; cursor: pointer; transition: all 0.2s ease; }
                .toggle-btn.enabled { background: #ecfdf5; color: #059669; }
                .toggle-btn.enabled svg { color: #10b981; }
                .toggle-btn.disabled { background: #f1f5f9; color: #64748b; }
                .field-options { padding-top: 1rem; border-top: 1px dashed #e2e8f0; }
                .checkbox-label { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; color: #475569; font-size: 0.9375rem; font-weight: 600; }
                .checkbox-input { width: 20px; height: 20px; cursor: pointer; accent-color: #6366f1; }
                @media (max-width: 768px) {
                    .settings-header { flex-direction: column; align-items: stretch; text-align: center; }
                    .field-grid { grid-template-columns: 1fr; }
                    .section-header { flex-direction: column; gap: 1rem; text-align: center; }
                    .section-title-group { flex-direction: column; }
                }
            `}</style>
        </div>
    );
};

export default RegistrationFieldsSettings;
