import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { useSchool } from '../../context/SchoolContext';
import { useParams } from 'react-router-dom';
import { collection, addDoc, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { getActiveClasses, APP_CONFIG, sortClasses } from '../../constants/app';
import { toProperCase, formatClassName } from '../../utils/formatters';
import { compressImage } from '../../utils/imageUtils';
import { CheckCircle, ChevronRight, MapPin, Phone, User, Users, Image as ImageIcon } from 'lucide-react';

interface RegistrationField {
    id: string;
    label: string;
    enabled: boolean;
    required: boolean;
    category: 'student' | 'father' | 'mother' | 'guardian';
}

const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Lakshadweep", "Delhi", "Puducherry", "Ladakh", "Jammu and Kashmir"
];

const DISTRICTS_MAP: Record<string, string[]> = {
    "Bihar": [
        "Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur", "Bhojpur", "Buxar", "Darbhanga",
        "East Champaran", "Gaya", "Gopalganj", "Jamui", "Jehanabad", "Kaimur", "Katihar", "Khagaria",
        "Kishanganj", "Lakhisarai", "Madhepura", "Madhubani", "Munger", "Muzaffarpur", "Nalanda", "Nawada",
        "Patna", "Purnia", "Rohtas", "Saharsa", "Samastipur", "Saran", "Sheikhpura", "Sheohar", "Sitamarhi",
        "Siwan", "Supaul", "Vaishali", "West Champaran"
    ],
    "Jharkhand": [
        "Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum", "Garhwa", "Giridih", "Godda",
        "Gumla", "Hazaribagh", "Jamtara", "Khunti", "Koderma", "Latehar", "Lohardaga", "Pakur", "Palamu",
        "Ramgarh", "Ranchi", "Sahibganj", "Seraikela Kharsawan", "Simdega", "West Singhbhum"
    ]
};

const QUALIFICATIONS = ["No Formal Education", "Primary Education", "Secondary Education", "Vocational", "Bachelor's", "Master's", "Doctorate"];
const OCCUPATIONS_FATHER = ["Unemployed", "Private Job", "Govt. Job", "Self Employed", "Professional", "Farmer"];
const OCCUPATIONS_MOTHER = ["House Wife", "Private Job", "Govt. Job", "Self Employed", "Professional"];
const RELIGIONS = ["Islam", "Hinduism", "Christianity", "Sikhism", "Buddhism", "Other"];

const PublicRegistration: React.FC = () => {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [activeClasses, setActiveClasses] = useState<any[]>([]);
    const [schoolInfo, setSchoolInfo] = useState<any>(null);
    const [fieldSettings, setFieldSettings] = useState<RegistrationField[]>([]);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const { currentSchool, loading: schoolLoading } = useSchool();
    const { schoolId: urlSchoolId } = useParams();

    const [formData, setFormData] = React.useState({
        // Student Details
        fullName: '',
        dob: '',
        gender: 'Male',
        caste: '',
        bloodGroup: '',
        photo: '',
        state: 'Jharkhand',
        district: 'Ranchi',
        permanentAddress: '',
        presentAddress: '',
        pinCode: '',
        aadharNo: '',
        appaarNo: '',
        studentPenNo: '',
        previousSchool: '',
        religion: '',
        classRequested: '',
        diseaseAllergy: '',

        // Father's Details
        fatherName: '',
        fatherAadharNo: '',
        fatherReligion: '',
        fatherQualification: '',
        fatherOccupation: '',
        fatherAddress: '',
        fatherContactNo: '',
        fatherWhatsappNo: '',
        fatherEmailId: '',

        // Mother's Details
        motherName: '',
        motherAadharNo: '',
        motherReligion: '',
        motherQualification: '',
        motherOccupation: '',
        motherAddress: '',
        motherContactNo: '',
        motherWhatsappNo: '',
        motherEmailId: '',

        // Guardian's Details
        guardianName: '',
        guardianMobile: '',
        guardianAddress: '',

        isPermanentAddressSame: false,
        isFatherAddressSame: false,
        isMotherAddressSame: false,

        remarks: ''
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Classes
                const schoolIdToUse = currentSchool?.id || urlSchoolId;
                if (!schoolIdToUse) {
                    console.warn('[PublicRegistration] No school ID available');
                    return;
                }

                console.log('[PublicRegistration] Fetching classes for school:', schoolIdToUse);
                const q = query(collection(db, 'settings'), where('type', '==', 'class'), where('schoolId', '==', schoolIdToUse));
                const querySnapshot = await getDocs(q);
                const classData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                console.log('[PublicRegistration] Raw classes found:', classData.length);

                // Use the utility to get active classes
                let activeClassesList = getActiveClasses(classData);

                // Fallback: If classes exist but all are marked inactive, 
                // show them anyway to prevent blocking registration (might happen with legacy data)
                if (activeClassesList.length === 0 && classData.length > 0) {
                    console.log('[PublicRegistration] Fallback: No active classes found, using all available classes.');
                    activeClassesList = sortClasses(classData);
                }

                console.log('[PublicRegistration] Final class list count:', activeClassesList.length);
                setActiveClasses(activeClassesList);

                // Fetch School Info
                setSchoolInfo(currentSchool);

                // Fetch Field Settings (wrapped separately to avoid blocking if permissions fail)
                try {
                    const fieldsDoc = await getDoc(doc(db, `schools/${schoolIdToUse}/settings/registration_fields`));
                    if (fieldsDoc.exists()) {
                        const data = fieldsDoc.data();
                        if (data && Array.isArray(data.fields)) {
                            setFieldSettings(data.fields);
                        }
                    }
                } catch (fieldError) {
                    console.warn('[PublicRegistration] Could not fetch field settings (using defaults):', fieldError);
                    // Continue with default field settings
                }
            } catch (error) {
                console.error("[PublicRegistration] Error fetching data:", error);
                // Don't set fallback classes - let admin configure them properly
                setActiveClasses([]);
            }
        };
        fetchData();
    }, [currentSchool, urlSchoolId]);

    // Set browser tab title based on school
    useEffect(() => {
        if (currentSchool?.customTitle) {
            document.title = `${currentSchool.customTitle} - Registration`;
        } else if (currentSchool?.name) {
            document.title = `${currentSchool.name} - Registration`;
        } else {
            document.title = `${APP_CONFIG.fullName} - Registration`;
        }
    }, [currentSchool]);


    const isFieldEnabled = (fieldId: string) => {
        if (fieldSettings.length === 0) return true;
        const field = fieldSettings.find(f => f.id === fieldId);
        return field ? field.enabled : true;
    };

    const isFieldRequired = (fieldId: string) => {
        if (fieldSettings.length === 0) {
            const requiredByDefault = ['fullName', 'dob', 'gender', 'fatherName', 'motherName', 'fatherContactNo', 'state', 'district', 'presentAddress', 'classRequested'];
            return requiredByDefault.includes(fieldId);
        }
        const field = fieldSettings.find(f => f.id === fieldId);
        return field ? (field.enabled && field.required) : false;
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const compressedBase64 = await compressImage(file, 400, 400, 0.7);
                setImagePreview(compressedBase64);
                setFormData(prev => ({ ...prev, photo: compressedBase64 }));
            } catch (error) {
                console.error('Image compression failed:', error);
                alert('Failed to process image. Please try another one.');
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
            permanentAddress: (name === 'presentAddress' && prev.isPermanentAddressSame) ? value : (name === 'permanentAddress' ? value : prev.permanentAddress),
            fatherAddress: (name === 'permanentAddress' && prev.isFatherAddressSame) ? value : (name === 'fatherAddress' ? value : prev.fatherAddress),
            motherAddress: (name === 'permanentAddress' && prev.isMotherAddressSame) ? value : (name === 'motherAddress' ? value : prev.motherAddress)
        }));
    };

    const handlePermanentAddressSame = () => {
        setFormData(prev => {
            const newValue = !prev.isPermanentAddressSame;
            return {
                ...prev,
                isPermanentAddressSame: newValue,
                permanentAddress: newValue ? prev.presentAddress : prev.permanentAddress
            };
        });
    };

    const handleFatherAddressSame = () => {
        setFormData(prev => {
            const newValue = !prev.isFatherAddressSame;
            return {
                ...prev,
                isFatherAddressSame: newValue,
                fatherAddress: newValue ? prev.permanentAddress : prev.fatherAddress
            };
        });
    };

    const handleMotherAddressSame = () => {
        setFormData(prev => {
            const newValue = !prev.isMotherAddressSame;
            return {
                ...prev,
                isMotherAddressSame: newValue,
                motherAddress: newValue ? prev.permanentAddress : prev.motherAddress
            };
        });
    };

    const validateStep = (currentStep: number) => {
        let missingFields: string[] = [];
        const enabledRequiredFields = fieldSettings.length > 0
            ? fieldSettings.filter(f => f.enabled && f.required)
            : [];

        if (currentStep === 1) {
            const step1Fields = fieldSettings.length > 0
                ? enabledRequiredFields.filter(f => f.category === 'student')
                : [{ id: 'fullName', label: 'Full Name' }, { id: 'dob', label: 'Date of Birth' }, { id: 'classRequested', label: 'Admission Class' }];

            step1Fields.forEach(f => {
                if (!formData[f.id as keyof typeof formData]) missingFields.push(f.label);
            });
        } else if (currentStep === 2) {
            const step2Fields = fieldSettings.length > 0
                ? enabledRequiredFields.filter(f => f.category === 'father')
                : [{ id: 'fatherName', label: "Father's Name" }, { id: 'fatherContactNo', label: "Father's Contact No" }];

            step2Fields.forEach(f => {
                if (!formData[f.id as keyof typeof formData]) missingFields.push(f.label);
            });
        } else if (currentStep === 3) {
            const step3Fields = fieldSettings.length > 0
                ? enabledRequiredFields.filter(f => f.category === 'mother')
                : [{ id: 'motherName', label: "Mother's Name" }];

            step3Fields.forEach(f => {
                if (!formData[f.id as keyof typeof formData]) missingFields.push(f.label);
            });
        } else if (currentStep === 4) {
            const step4Fields = fieldSettings.length > 0
                ? enabledRequiredFields.filter(f => f.category === 'guardian')
                : [];

            step4Fields.forEach(f => {
                if (!formData[f.id as keyof typeof formData]) missingFields.push(f.label);
            });
        }

        // Mobile Number Validation (10 digits)
        const mobileFields = [
            { id: 'fatherContactNo', label: "Father's Contact No" },
            { id: 'fatherWhatsappNo', label: "Father's WhatsApp No" },
            { id: 'motherContactNo', label: "Mother's Contact No" },
            { id: 'motherWhatsappNo', label: "Mother's WhatsApp No" },
            { id: 'guardianMobile', label: "Guardian's Mobile" }
        ];

        mobileFields.forEach(f => {
            const val = formData[f.id as keyof typeof formData];
            if (val && val.toString().length > 0 && val.toString().length !== 10) {
                missingFields.push(`${f.label} (must be 10 digits)`);
            }
        });

        if (missingFields.length > 0) {
            alert(`Please fill required fields: ${missingFields.join(', ')}`);
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const enabledRequiredFields = fieldSettings.filter(f => f.enabled && f.required);
        let missing: string[] = [];
        enabledRequiredFields.forEach(f => {
            if (!formData[f.id as keyof typeof formData]) missing.push(f.label);
        });

        if (missing.length > 0) {
            alert(`Please fill all required fields: ${missing.join(', ')}`);
            return;
        }

        setIsSubmitting(true);
        try {
            // Generate unique registration number: REG-YYYYMMDD-XXXXX
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
            const randomNum = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
            const registrationNo = `REG-${dateStr}-${randomNum}`;

            // Convert text fields to Proper Case
            const transformedData = { ...formData };
            const skipFields = [
                'dob', 'gender', 'bloodGroup', 'photo', 'state', 'district', 'pinCode',
                'aadharNo', 'appaarNo', 'studentPenNo', 'classRequested',
                'fatherContactNo', 'fatherWhatsappNo', 'motherContactNo', 'motherWhatsappNo',
                'fatherEmailId', 'motherEmailId'
            ];

            (Object.keys(transformedData) as Array<keyof typeof formData>).forEach(key => {
                const val = transformedData[key];
                if (typeof val === 'string' && !skipFields.includes(key) && val.trim().length > 0) {
                    (transformedData as any)[key] = toProperCase(val);
                }
            });

            await addDoc(collection(db, 'registrations'), {
                ...transformedData,
                registrationNo,
                status: 'pending',
                schoolId: currentSchool?.id || urlSchoolId,
                createdAt: new Date().toISOString()
            });

            // Store registration number to display on success screen
            setFormData({ ...formData, registrationNo } as any);
            setSubmitted(true);
        } catch (err) {
            alert('Failed to submit: ' + (err as Error).message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="success-page-root">
                <div className="success-blob blob-1"></div>
                <div className="success-blob blob-2"></div>
                <div className="success-blob blob-3"></div>
                <div className="success-container">
                    <div className="success-card">
                        <div className="success-icon-container">
                            <div className="success-checkmark"><CheckCircle size={80} /></div>
                            <div className="success-ripple"></div>
                        </div>
                        <h1 className="success-title">Registration Successful!</h1>
                        <div className="success-message">
                            <p className="message-primary">Registration for <span className="highlight-name">{formData.fullName}</span> has been submitted.</p>
                            <div style={{ margin: '1.5rem 0', padding: '1rem 1.5rem', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', borderRadius: '12px', border: '2px dashed #0ea5e9' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Your Registration Number</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0c4a6e', fontFamily: 'monospace', letterSpacing: '2px' }}>{(formData as any).registrationNo}</div>
                                <div style={{ fontSize: '0.7rem', color: '#075985', marginTop: '0.5rem' }}>⚠️ Please save this number for future reference</div>
                            </div>
                            <p className="message-secondary">Thank you for choosing <span className="highlight-school">{currentSchool?.name || APP_CONFIG.fullName}</span></p>
                        </div>
                        <button onClick={() => window.location.reload()} className="success-btn">
                            <span>Register Another Student</span><ChevronRight size={20} />
                        </button>
                    </div>
                </div>
                <style>{`
                    .success-page-root { min-height: 100vh; background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1e293b 100%); display: flex; align-items: center; justify-content: center; padding: 2rem 1rem; position: relative; overflow: hidden; font-family: 'Inter', sans-serif; }
                    .success-blob { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.25; z-index: 0; animation: float 20s ease-in-out infinite; }
                    .blob-1 { width: 500px; height: 500px; background: #1e40af; top: -150px; left: -150px; }
                    .success-container { max-width: 600px; width: 100%; position: relative; z-index: 1; }
                    .success-card { background: #fff; border-radius: 30px; padding: 3rem 2.5rem; text-align: center; box-shadow: 0 30px 80px rgba(0,0,0,0.3); }
                    .success-icon-container { position: relative; width: 120px; height: 120px; margin: 0 auto 2rem; display: flex; align-items: center; justify-content: center; }
                    .success-checkmark { width: 120px; height: 120px; border-radius: 50%; background: #0ea5e9; display: flex; align-items: center; justify-content: center; color: #fff; box-shadow: 0 10px 40px rgba(14,165,233,0.4); }
                    .success-title { font-size: 2.25rem; font-weight: 900; color: #0f172a; margin-bottom: 1.5rem; }
                    .success-btn { width: 100%; background: #1e40af; color: #fff; border: none; border-radius: 14px; padding: 1.125rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
                    @keyframes float { 0%, 100% { transform: translate(0,0); } 50% { transform: translate(20px, 20px); } }
                `}</style>
            </div>
        );
    }

    return (
        <div className="public-registration-root min-h-screen relative overflow-hidden">
            <div className="ambient-blob blob-1"></div>
            <div className="ambient-blob blob-2"></div>
            <div className="ambient-blob blob-3"></div>

            <div className="registration-container">
                <header className="header-section">
                    <div className="logo-container">
                        <img src={currentSchool?.logoUrl || '/logo.png'} alt="Logo" className="logo-img" />
                    </div>
                    <h1 className="school-name">{currentSchool?.name || APP_CONFIG.fullName}</h1>
                    {currentSchool && (
                        <div className="school-info">
                            <p className="info-item"><MapPin size={16} /> <span>{currentSchool.address}</span></p>
                            <p className="info-item"><Phone size={16} /> <span>{currentSchool.phone}</span></p>
                        </div>
                    )}
                    <div className="admission-badge">
                        <div className="badge-icon">📝</div>
                        <div className="badge-text">
                            <div className="badge-title">Online Admission Registration</div>
                            <div className="badge-year">{new Date().getFullYear()}-{new Date().getFullYear() + 1}</div>
                        </div>
                    </div>
                </header>

                <div className="registration-card">
                    {/* Stepper */}
                    <div className="progress-section">
                        <div className="progress-track">
                            <div className="progress-fill" style={{ width: `${(step / 4) * 100}%` }}></div>
                        </div>
                        <div className="progress-steps">
                            <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
                                <div className="step-number">{step > 1 ? <CheckCircle size={16} /> : 1}</div>
                                <div className="step-label">Student</div>
                            </div>
                            <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
                                <div className="step-number">{step > 2 ? <CheckCircle size={16} /> : 2}</div>
                                <div className="step-label">Father</div>
                            </div>
                            <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>
                                <div className="step-number">{step > 3 ? <CheckCircle size={16} /> : 3}</div>
                                <div className="step-label">Mother</div>
                            </div>
                            <div className={`progress-step ${step >= 4 ? 'active' : ''}`}>
                                <div className="step-number">4</div>
                                <div className="step-label">Guardian</div>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="form-section">
                        {step === 1 ? (
                            <div className="form-page animate-fade-in">
                                <div className="section-title">
                                    <div className="title-icon student"><User size={24} /></div>
                                    <h2>Student Details</h2>
                                </div>

                                <div className="form-grid">
                                    {isFieldEnabled('fullName') && (
                                        <div className="form-group full-width">
                                            <label className="form-label">Student Full Name {isFieldRequired('fullName') && <span className="required">*</span>}</label>
                                            <input type="text" name="fullName" required={isFieldRequired('fullName')} className="form-input" value={formData.fullName} onChange={handleChange} placeholder="Full Name as per records" />
                                        </div>
                                    )}

                                    {isFieldEnabled('classRequested') && (
                                        <div className="form-group full-width">
                                            <label className="form-label">Admission Class {isFieldRequired('classRequested') && <span className="required">*</span>}</label>
                                            <select name="classRequested" required={isFieldRequired('classRequested')} className="form-input" value={formData.classRequested} onChange={handleChange}>
                                                <option value="">Select Class</option>
                                                {activeClasses.map(cls => <option key={cls.id || cls.name} value={cls.name}>{formatClassName(cls.name, currentSchool?.useRomanNumerals)}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {isFieldEnabled('dob') && (
                                        <div className="form-group">
                                            <label className="form-label">Date of Birth {isFieldRequired('dob') && <span className="required">*</span>}</label>
                                            <input type="date" name="dob" required={isFieldRequired('dob')} className="form-input" value={formData.dob} onChange={handleChange} />
                                        </div>
                                    )}

                                    {isFieldEnabled('gender') && (
                                        <div className="form-group">
                                            <label className="form-label">Gender {isFieldRequired('gender') && <span className="required">*</span>}</label>
                                            <div className="caste-chips">
                                                {['Male', 'Female', 'Other'].map(option => (
                                                    <button
                                                        key={option}
                                                        type="button"
                                                        className={`chip-btn ${formData.gender === option ? 'active' : ''}`}
                                                        onClick={() => setFormData(prev => ({ ...prev, gender: option }))}
                                                    >
                                                        {option}
                                                    </button>
                                                ))}
                                            </div>
                                            <input type="hidden" name="gender" required={isFieldRequired('gender')} value={formData.gender} />
                                        </div>
                                    )}

                                    {isFieldEnabled('caste') && (
                                        <div className="form-group full-width">
                                            <label className="form-label">Caste {isFieldRequired('caste') && <span className="required">*</span>}</label>
                                            <div className="caste-chips">
                                                {['General', 'OBC', 'SC', 'ST'].map(option => (
                                                    <button
                                                        key={option}
                                                        type="button"
                                                        className={`chip-btn ${formData.caste === option ? 'active' : ''}`}
                                                        onClick={() => setFormData(prev => ({ ...prev, caste: option }))}
                                                    >
                                                        {option}
                                                    </button>
                                                ))}
                                            </div>
                                            <input type="hidden" name="caste" required={isFieldRequired('caste')} value={formData.caste} />
                                        </div>
                                    )}

                                    {isFieldEnabled('bloodGroup') && (
                                        <div className="form-group">
                                            <label className="form-label">Blood Group {isFieldRequired('bloodGroup') && <span className="required">*</span>}</label>
                                            <select name="bloodGroup" required={isFieldRequired('bloodGroup')} className="form-input" value={formData.bloodGroup} onChange={handleChange}>
                                                <option value="">Select</option>
                                                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg}>{bg}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {isFieldEnabled('aadharNo') && (
                                        <div className="form-group">
                                            <label className="form-label">Student Aadhar No {isFieldRequired('aadharNo') && <span className="required">*</span>}</label>
                                            <input type="text" name="aadharNo" required={isFieldRequired('aadharNo')} className="form-input" value={formData.aadharNo} onChange={handleChange} maxLength={12} placeholder="12 digit number" />
                                        </div>
                                    )}

                                    {isFieldEnabled('appaarNo') && (
                                        <div className="form-group">
                                            <label className="form-label">Appaar No {isFieldRequired('appaarNo') && <span className="required">*</span>}</label>
                                            <input type="text" name="appaarNo" required={isFieldRequired('appaarNo')} className="form-input" value={formData.appaarNo} onChange={handleChange} />
                                        </div>
                                    )}

                                    {isFieldEnabled('diseaseAllergy') && (
                                        <div className="form-group full-width">
                                            <label className="form-label">Any disease or allergy? Specify {isFieldRequired('diseaseAllergy') && <span className="required">*</span>}</label>
                                            <input type="text" name="diseaseAllergy" required={isFieldRequired('diseaseAllergy')} className="form-input" value={formData.diseaseAllergy} onChange={handleChange} placeholder="Specify if any, otherwise leave empty or type None" />
                                        </div>
                                    )}

                                    {isFieldEnabled('studentPenNo') && (
                                        <div className="form-group">
                                            <label className="form-label">Student PEN No {isFieldRequired('studentPenNo') && <span className="required">*</span>}</label>
                                            <input type="text" name="studentPenNo" required={isFieldRequired('studentPenNo')} className="form-input" value={formData.studentPenNo} onChange={handleChange} />
                                        </div>
                                    )}

                                    {isFieldEnabled('previousSchool') && (
                                        <div className="form-group full-width">
                                            <label className="form-label">Previous School Name {isFieldRequired('previousSchool') && <span className="required">*</span>}</label>
                                            <input type="text" name="previousSchool" required={isFieldRequired('previousSchool')} className="form-input" value={formData.previousSchool} onChange={handleChange} />
                                        </div>
                                    )}

                                    <div className="form-group">
                                        <label className="form-label">State <span className="required">*</span></label>
                                        <select name="state" required className="form-input" value={formData.state} onChange={handleChange}>
                                            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">District <span className="required">*</span></label>
                                        <select name="district" required className="form-input" value={formData.district} onChange={handleChange}>
                                            {(DISTRICTS_MAP[formData.state] || []).map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>

                                    {isFieldEnabled('presentAddress') && (
                                        <div className="form-group full-width">
                                            <label className="form-label">Present Address {isFieldRequired('presentAddress') && <span className="required">*</span>}</label>
                                            <textarea name="presentAddress" required={isFieldRequired('presentAddress')} className="form-textarea" value={formData.presentAddress} onChange={handleChange} rows={2}></textarea>
                                        </div>
                                    )}

                                    {isFieldEnabled('permanentAddress') && (
                                        <div className="form-group full-width">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                <label className="form-label">Permanent Address {isFieldRequired('permanentAddress') && <span className="required">*</span>}</label>
                                                <button type="button" onClick={handlePermanentAddressSame} className={`same-btn ${formData.isPermanentAddressSame ? 'active' : ''}`}>
                                                    {formData.isPermanentAddressSame ? <CheckCircle size={14} /> : <div className="circle-icon"></div>} Same as Present
                                                </button>
                                            </div>
                                            <textarea name="permanentAddress" required={isFieldRequired('permanentAddress')} className="form-textarea" value={formData.permanentAddress} onChange={handleChange} rows={2} disabled={formData.isPermanentAddressSame}></textarea>
                                        </div>
                                    )}

                                    {isFieldEnabled('pinCode') && (
                                        <div className="form-group">
                                            <label className="form-label">Pin Code {isFieldRequired('pinCode') && <span className="required">*</span>}</label>
                                            <input type="text" name="pinCode" required={isFieldRequired('pinCode')} className="form-input" value={formData.pinCode} onChange={handleChange} maxLength={6} />
                                        </div>
                                    )}

                                    {isFieldEnabled('photo') && (
                                        <div className="form-group full-width photo-upload-section">
                                            <label className="form-label">Student Photo {isFieldRequired('photo') && <span className="required">*</span>}</label>
                                            <div className="photo-container">
                                                <div className="preview-area">
                                                    {imagePreview ? (
                                                        <img src={imagePreview} alt="Preview" className="photo-preview" />
                                                    ) : (
                                                        <div className="photo-placeholder">
                                                            <ImageIcon size={48} />
                                                            <span>No photo selected</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="upload-controls">
                                                    <input
                                                        type="file"
                                                        id="photo-input"
                                                        accept="image/*"
                                                        onChange={handleImageChange}
                                                        className="hidden-input"
                                                        required={isFieldRequired('photo') && !imagePreview}
                                                    />
                                                    <label htmlFor="photo-input" className="upload-btn">
                                                        <ImageIcon size={18} /> {imagePreview ? 'Change Photo' : 'Upload Photo'}
                                                    </label>
                                                    <p className="upload-tip">JPG, PNG or WEBP (Max 2MB)</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="form-actions">
                                    <button type="button" onClick={() => validateStep(1) && setStep(2)} className="btn-primary">
                                        Continue to Father Details <ChevronRight size={20} />
                                    </button>
                                </div>
                            </div>
                        ) : step === 2 ? (
                            <div className="form-page animate-fade-in">
                                <div className="section-title">
                                    <div className="title-icon contact"><Users size={24} /></div>
                                    <h2>Father's Information</h2>
                                </div>

                                <div className="form-grid">
                                    {isFieldEnabled('fatherName') && (
                                        <div className="form-group full-width">
                                            <label className="form-label">Father's Name {isFieldRequired('fatherName') && <span className="required">*</span>}</label>
                                            <input type="text" name="fatherName" required={isFieldRequired('fatherName')} className="form-input" value={formData.fatherName} onChange={handleChange} />
                                        </div>
                                    )}

                                    {isFieldEnabled('fatherContactNo') && (
                                        <div className="form-group">
                                            <label className="form-label">Father's Contact No {isFieldRequired('fatherContactNo') && <span className="required">*</span>}</label>
                                            <input type="tel" name="fatherContactNo" required={isFieldRequired('fatherContactNo')} className="form-input" value={formData.fatherContactNo} onChange={handleChange} maxLength={10} />
                                        </div>
                                    )}

                                    {isFieldEnabled('fatherAadharNo') && (
                                        <div className="form-group">
                                            <label className="form-label">Father's Aadhar No {isFieldRequired('fatherAadharNo') && <span className="required">*</span>}</label>
                                            <input type="text" name="fatherAadharNo" required={isFieldRequired('fatherAadharNo')} className="form-input" value={formData.fatherAadharNo} onChange={handleChange} maxLength={12} pattern="\d{12}" placeholder="12 digit number" />
                                        </div>
                                    )}

                                    {isFieldEnabled('fatherOccupation') && (
                                        <div className="form-group">
                                            <label className="form-label">Father's Occupation {isFieldRequired('fatherOccupation') && <span className="required">*</span>}</label>
                                            <select name="fatherOccupation" required={isFieldRequired('fatherOccupation')} className="form-input" value={formData.fatherOccupation} onChange={handleChange}>
                                                <option value="">Select</option>
                                                {OCCUPATIONS_FATHER.map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {isFieldEnabled('fatherQualification') && (
                                        <div className="form-group">
                                            <label className="form-label">Father Qualification {isFieldRequired('fatherQualification') && <span className="required">*</span>}</label>
                                            <select name="fatherQualification" required={isFieldRequired('fatherQualification')} className="form-input" value={formData.fatherQualification} onChange={handleChange}>
                                                <option value="">Select</option>
                                                {QUALIFICATIONS.map(q => <option key={q} value={q}>{q}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {isFieldEnabled('fatherWhatsappNo') && (
                                        <div className="form-group">
                                            <label className="form-label">WhatsApp No {isFieldRequired('fatherWhatsappNo') && <span className="required">*</span>}</label>
                                            <input type="tel" name="fatherWhatsappNo" required={isFieldRequired('fatherWhatsappNo')} className="form-input" value={formData.fatherWhatsappNo} onChange={handleChange} maxLength={10} />
                                        </div>
                                    )}

                                    {isFieldEnabled('fatherReligion') && (
                                        <div className="form-group">
                                            <label className="form-label">Father's Religion {isFieldRequired('fatherReligion') && <span className="required">*</span>}</label>
                                            <select name="fatherReligion" required={isFieldRequired('fatherReligion')} className="form-input" value={formData.fatherReligion} onChange={handleChange}>
                                                <option value="">Select</option>
                                                {RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {isFieldEnabled('fatherAddress') && (
                                        <div className="form-group full-width">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                <label className="form-label">Father's Address {isFieldRequired('fatherAddress') && <span className="required">*</span>}</label>
                                                <button type="button" onClick={handleFatherAddressSame} className={`same-btn ${formData.isFatherAddressSame ? 'active' : ''}`}>
                                                    {formData.isFatherAddressSame ? <CheckCircle size={14} /> : <div className="circle-icon"></div>} Same as Student
                                                </button>
                                            </div>
                                            <textarea name="fatherAddress" required={isFieldRequired('fatherAddress')} className="form-textarea" value={formData.fatherAddress} onChange={handleChange} rows={2} disabled={formData.isFatherAddressSame}></textarea>
                                        </div>
                                    )}

                                    {isFieldEnabled('fatherEmailId') && (
                                        <div className="form-group">
                                            <label className="form-label">Father's Email ID {isFieldRequired('fatherEmailId') && <span className="required">*</span>}</label>
                                            <input type="email" name="fatherEmailId" required={isFieldRequired('fatherEmailId')} className="form-input" value={formData.fatherEmailId} onChange={handleChange} />
                                        </div>
                                    )}
                                </div>

                                <div className="form-actions two-buttons">
                                    <button type="button" onClick={() => setStep(1)} className="btn-secondary">← Back</button>
                                    <button type="button" onClick={() => validateStep(2) && setStep(3)} className="btn-primary">
                                        Continue to Mother Details <ChevronRight size={20} />
                                    </button>
                                </div>
                            </div>
                        ) : step === 3 ? (
                            <div className="form-page animate-fade-in">
                                <div className="section-title">
                                    <div className="title-icon contact"><Users size={24} /></div>
                                    <h2>Mother's Information</h2>
                                </div>

                                <div className="form-grid">
                                    {isFieldEnabled('motherName') && (
                                        <div className="form-group full-width">
                                            <label className="form-label">Mother's Name {isFieldRequired('motherName') && <span className="required">*</span>}</label>
                                            <input type="text" name="motherName" required={isFieldRequired('motherName')} className="form-input" value={formData.motherName} onChange={handleChange} />
                                        </div>
                                    )}

                                    {isFieldEnabled('motherContactNo') && (
                                        <div className="form-group">
                                            <label className="form-label">Mother's Contact No {isFieldRequired('motherContactNo') && <span className="required">*</span>}</label>
                                            <input type="tel" name="motherContactNo" required={isFieldRequired('motherContactNo')} className="form-input" value={formData.motherContactNo} onChange={handleChange} maxLength={10} />
                                        </div>
                                    )}

                                    {isFieldEnabled('motherOccupation') && (
                                        <div className="form-group">
                                            <label className="form-label">Mother's Occupation {isFieldRequired('motherOccupation') && <span className="required">*</span>}</label>
                                            <select name="motherOccupation" required={isFieldRequired('motherOccupation')} className="form-input" value={formData.motherOccupation} onChange={handleChange}>
                                                <option value="">Select</option>
                                                {OCCUPATIONS_MOTHER.map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {isFieldEnabled('motherReligion') && (
                                        <div className="form-group">
                                            <label className="form-label">Mother's Religion {isFieldRequired('motherReligion') && <span className="required">*</span>}</label>
                                            <select name="motherReligion" required={isFieldRequired('motherReligion')} className="form-input" value={formData.motherReligion} onChange={handleChange}>
                                                <option value="">Select</option>
                                                {RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {isFieldEnabled('motherAadharNo') && (
                                        <div className="form-group">
                                            <label className="form-label">Mother's Aadhar No {isFieldRequired('motherAadharNo') && <span className="required">*</span>}</label>
                                            <input type="text" name="motherAadharNo" required={isFieldRequired('motherAadharNo')} className="form-input" value={formData.motherAadharNo} onChange={handleChange} maxLength={12} pattern="\d{12}" placeholder="12 digit number" />
                                        </div>
                                    )}

                                    {isFieldEnabled('motherQualification') && (
                                        <div className="form-group">
                                            <label className="form-label">Mother Qualification {isFieldRequired('motherQualification') && <span className="required">*</span>}</label>
                                            <select name="motherQualification" required={isFieldRequired('motherQualification')} className="form-input" value={formData.motherQualification} onChange={handleChange}>
                                                <option value="">Select</option>
                                                {QUALIFICATIONS.map(q => <option key={q} value={q}>{q}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {isFieldEnabled('motherWhatsappNo') && (
                                        <div className="form-group">
                                            <label className="form-label">Mother's WhatsApp No {isFieldRequired('motherWhatsappNo') && <span className="required">*</span>}</label>
                                            <input type="tel" name="motherWhatsappNo" required={isFieldRequired('motherWhatsappNo')} className="form-input" value={formData.motherWhatsappNo} onChange={handleChange} maxLength={10} />
                                        </div>
                                    )}

                                    {isFieldEnabled('motherAddress') && (
                                        <div className="form-group full-width">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                <label className="form-label">Mother's Address {isFieldRequired('motherAddress') && <span className="required">*</span>}</label>
                                                <button type="button" onClick={handleMotherAddressSame} className={`same-btn ${formData.isMotherAddressSame ? 'active' : ''}`}>
                                                    {formData.isMotherAddressSame ? <CheckCircle size={14} /> : <div className="circle-icon"></div>} Same as Student
                                                </button>
                                            </div>
                                            <textarea name="motherAddress" required={isFieldRequired('motherAddress')} className="form-textarea" value={formData.motherAddress} onChange={handleChange} rows={2} disabled={formData.isMotherAddressSame}></textarea>
                                        </div>
                                    )}

                                    {isFieldEnabled('motherEmailId') && (
                                        <div className="form-group">
                                            <label className="form-label">Mother's Email ID {isFieldRequired('motherEmailId') && <span className="required">*</span>}</label>
                                            <input type="email" name="motherEmailId" required={isFieldRequired('motherEmailId')} className="form-input" value={formData.motherEmailId} onChange={handleChange} />
                                        </div>
                                    )}

                                    <div className="form-group full-width">
                                        <label className="form-label">Additional Remarks</label>
                                        <textarea name="remarks" className="form-textarea" value={formData.remarks} onChange={handleChange} rows={2} placeholder="Any other information..."></textarea>
                                    </div>
                                </div>

                                <div className="form-actions two-buttons">
                                    <button type="button" onClick={() => setStep(2)} className="btn-secondary">← Back</button>
                                    <button type="button" onClick={() => setStep(4)} className="btn-primary">Next: Guardian Details →</button>
                                </div>
                            </div>
                        ) : null}

                        {step === 4 && (
                            <div className="form-page animate-fade-in">
                                <div className="section-title">
                                    <div className="title-icon guardian"><Users size={24} /></div>
                                    <div>
                                        <h2>Guardian Details</h2>
                                        <p className="subtitle">If parents are deceased or do not reside locally</p>
                                    </div>
                                </div>

                                <div className="form-grid">
                                    {isFieldEnabled('guardianName') && (
                                        <div className="form-group full-width">
                                            <label className="form-label">Guardian's Name {isFieldRequired('guardianName') && <span className="required">*</span>}</label>
                                            <input type="text" name="guardianName" required={isFieldRequired('guardianName')} className="form-input" value={formData.guardianName} onChange={handleChange} placeholder="Full Name of Guardian" />
                                        </div>
                                    )}

                                    {isFieldEnabled('guardianMobile') && (
                                        <div className="form-group">
                                            <label className="form-label">Guardian's Mobile {isFieldRequired('guardianMobile') && <span className="required">*</span>}</label>
                                            <input type="tel" name="guardianMobile" required={isFieldRequired('guardianMobile')} className="form-input" value={formData.guardianMobile} onChange={handleChange} maxLength={10} />
                                        </div>
                                    )}

                                    {isFieldEnabled('guardianAddress') && (
                                        <div className="form-group full-width">
                                            <label className="form-label">Guardian's Address {isFieldRequired('guardianAddress') && <span className="required">*</span>}</label>
                                            <textarea name="guardianAddress" required={isFieldRequired('guardianAddress')} className="form-textarea" value={formData.guardianAddress} onChange={handleChange} rows={3} placeholder="Permanent Address of Guardian"></textarea>
                                        </div>
                                    )}

                                    {!isFieldEnabled('guardianName') && !isFieldEnabled('guardianMobile') && !isFieldEnabled('guardianAddress') && (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontStyle: 'italic', gridColumn: '1 / -1' }}>
                                            Guardian information is non-mandatory and fields are hidden. You can proceed with registration.
                                        </div>
                                    )}

                                    <div className="form-group full-width">
                                        <label className="form-label">Additional Remarks</label>
                                        <textarea name="remarks" className="form-textarea" value={formData.remarks} onChange={handleChange} rows={2} placeholder="Any other information..."></textarea>
                                    </div>
                                </div>

                                <div className="form-actions two-buttons">
                                    <button type="button" onClick={() => setStep(3)} className="btn-secondary">← Back</button>
                                    <button type="submit" disabled={isSubmitting} className="btn-success">
                                        {isSubmitting ? <><div className="spinner"></div> Submitting...</> : <>Complete Registration <CheckCircle size={20} /></>}
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>
                </div>

                <footer className="footer-section">
                    <p>&copy; {new Date().getFullYear()} {currentSchool?.name || APP_CONFIG.fullName}. All rights reserved.</p>
                </footer>
            </div>

            <style>{`
                .public-registration-root {
                    background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1e293b 100%);
                    font-family: 'Inter', sans-serif;
                    padding: 2rem 1rem;
                    min-height: 100vh;
                    position: relative;
                    overflow-x: hidden;
                }
                .ambient-blob { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.2; z-index: 0; }
                .blob-1 { width: 600px; height: 600px; background: #1e40af; top: -200px; left: -200px; }
                .blob-2 { width: 400px; height: 400px; background: #2563eb; bottom: -150px; right: -150px; }
                .blob-3 { width: 300px; height: 300px; background: #3b82f6; top: 40%; right: -100px; }

                .registration-container { max-width: 900px; margin: 0 auto; position: relative; z-index: 1; }
                
                .header-section { text-align: center; margin-bottom: 3rem; color: #fff; }
                .logo-img { width: 100px; height: 100px; filter: drop-shadow(0 10px 30px rgba(0,0,0,0.3)); margin-bottom: 1rem; }
                .school-name { font-size: 2.5rem; font-weight: 900; margin: 0 0 1rem 0; text-shadow: 0 4px 12px rgba(0,0,0,0.3); }
                .school-info { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; font-size: 0.95rem; opacity: 0.9; }
                .info-item { display: flex; align-items: center; gap: 0.5rem; }
                
                .admission-badge { 
                    display: inline-flex; align-items: center; gap: 1rem; background: #fff; padding: 0.75rem 1.5rem; 
                    border-radius: 50px; color: #0f172a; margin-top: 1.5rem; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                }
                .badge-text { text-align: left; }
                .badge-title { font-weight: 800; font-size: 0.9rem; }
                .badge-year { font-weight: 600; font-size: 0.8rem; opacity: 0.7; }

                .registration-card { background: #fff; border-radius: 30px; box-shadow: 0 30px 80px rgba(0,0,0,0.4); overflow: hidden; }
                
                .progress-section { background: #1e3a8a; padding: 2rem; }
                .progress-track { height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; margin-bottom: 1.5rem; position: relative; overflow: hidden; }
                .progress-fill { height: 100%; background: #60a5fa; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
                .progress-steps { display: flex; justify-content: space-around; }
                .progress-step { display: flex; align-items: center; gap: 0.75rem; color: rgba(255,255,255,0.4); transition: all 0.3s; }
                .progress-step.active { color: #fff; }
                .step-number { width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem; }
                .progress-step.active .step-number { background: #60a5fa; color: #0f172a; box-shadow: 0 0 15px rgba(96, 165, 250, 0.4); }

                .form-section { padding: 3rem 2.5rem; }
                .section-title { display: flex; align-items: center; gap: 1rem; margin-bottom: 2.5rem; color: #1e293b; }
                .title-icon { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #fff; }
                .title-icon.student { background: linear-gradient(135deg, #1e40af, #3b82f6); }
                .title-icon.contact { background: linear-gradient(135deg, #0ea5e9, #2563eb); }
                
                .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.75rem; }
                .form-group.full-width { grid-column: span 2; }
                .form-label { display: block; font-size: 0.875rem; font-weight: 700; color: #475569; margin-bottom: 0.625rem; text-transform: uppercase; letter-spacing: 0.5px; }
                .required { color: #ef4444; margin-left: 2px; }
                
                .form-input, .form-select, .form-textarea { 
                    width: 100%; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 0.875rem 1.125rem; 
                    font-size: 1rem; outline: none; transition: all 0.2s; font-family: inherit; color: #1e293b;
                }
                .form-input:focus, .form-textarea:focus { border-color: #2563eb; background: #fff; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1); }
                
                .caste-chips { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.25rem; }
                .chip-btn { 
                    padding: 0.625rem 1.25rem; border-radius: 10px; border: 2px solid #e2e8f0; background: #f8fafc;
                    color: #475569; font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: all 0.2s;
                }
                .chip-btn:hover { border-color: #cbd5e1; background: #f1f5f9; }
                .chip-btn.active { border-color: #2563eb; background: #eff6ff; color: #2563eb; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.1); }

                .photo-upload-section { margin-top: 1rem; }
                .photo-container { display: flex; gap: 2rem; align-items: center; background: #f8fafc; padding: 1.5rem; border-radius: 20px; border: 1px solid #e2e8f0; }
                .preview-area { 
                    width: 120px; height: 120px; border-radius: 16px; overflow: hidden; background: #fff; border: 2px dashed #cbd5e1;
                    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
                }
                .photo-preview { width: 100%; height: 100%; object-fit: cover; }
                .photo-placeholder { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; color: #94a3b8; font-size: 0.75rem; text-align: center; }
                .upload-controls { flex: 1; display: flex; flex-direction: column; gap: 0.75rem; }
                .hidden-input { display: none; }
                .upload-btn { 
                    display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem; background: #fff; 
                    border: 1px solid #cbd5e1; border-radius: 10px; color: #475569; font-weight: 700; cursor: pointer; transition: all 0.2s;
                    width: fit-content;
                }
                .upload-btn:hover { border-color: #2563eb; color: #2563eb; background: #f0f7ff; }
                .upload-tip { font-size: 0.8rem; color: #64748b; margin: 0; }

                .same-btn { 
                    display: flex; align-items: center; gap: 0.5rem; background: none; border: none; 
                    color: #2563eb; font-size: 0.8rem; font-weight: 700; cursor: pointer; padding: 4px 8px;
                    border-radius: 6px; transition: all 0.2s;
                }
                .same-btn:hover { background: #eff6ff; }
                .same-btn.active { color: #059669; }
                .circle-icon { width: 14px; height: 14px; border: 2px solid currentColor; border-radius: 50%; }

                .form-actions { display: flex; justify-content: flex-end; margin-top: 3rem; gap: 1.5rem; }
                .form-actions.two-buttons { justify-content: space-between; }
                
                .btn-primary { 
                    background: #1e40af; color: #fff; padding: 1rem 2rem; border-radius: 14px; font-weight: 800; border: none; cursor: pointer; 
                    display: flex; align-items: center; gap: 0.75rem; transition: all 0.2s; box-shadow: 0 8px 15px rgba(30, 64, 175, 0.3);
                }
                .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 20px rgba(30, 64, 175, 0.4); }
                
                .btn-secondary { background: #f1f5f9; color: #475569; padding: 1rem 2rem; border-radius: 14px; border: none; font-weight: 700; cursor: pointer; transition: all 0.2s; }
                .btn-secondary:hover { background: #e2e8f0; color: #1e293b; }
                
                .btn-success { 
                    background: #10b981; color: #fff; padding: 1rem 2.5rem; border-radius: 14px; font-weight: 800; border: none; cursor: pointer; 
                    display: flex; align-items: center; gap: 0.75rem; transition: all 0.2s; box-shadow: 0 8px 15px rgba(16, 185, 129, 0.3);
                }
                .btn-success:hover { transform: translateY(-2px); box-shadow: 0 12px 20px rgba(16, 185, 129, 0.4); }

                .spinner { width: 22px; height: 22px; border: 3px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
                
                .animate-fade-in { animation: fadeIn 0.4s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

                .footer-section { text-align: center; margin-top: 3rem; color: #fff; opacity: 0.7; font-size: 0.9rem; }

                @media (max-width: 640px) {
                    .form-grid { grid-template-columns: 1fr; }
                    .form-group.full-width { grid-column: span 1; }
                    .school-name { font-size: 1.75rem; }
                    .progress-step .step-label { display: none; }
                    .form-actions.two-buttons { flex-direction: column-reverse; }
                    .form-actions button { width: 100%; justify-content: center; }
                }
            `}</style>
        </div>
    );
};

export default PublicRegistration;
