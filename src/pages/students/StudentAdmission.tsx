import React, { useState, useEffect } from 'react';
import { Save, ArrowLeft, Image as ImageIcon, User, School, ArrowRight } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useSchool } from '../../context/SchoolContext';
import { useFirestore } from '../../hooks/useFirestore';
import { calculateAge } from '../../utils/dateUtils';
import { getActiveClasses } from '../../constants/app';
import { toProperCase, formatClassName } from '../../utils/formatters';
import { compressImage } from '../../utils/imageUtils';

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

const SegmentedControl: React.FC<{
    options: string[];
    value: string;
    onChange: (val: string) => void;
    label?: string;
}> = ({ options, value, onChange, label }) => (
    <div className="segmented-control-wrapper">
        {label && <label className="field-label">{label}</label>}
        <div className="segmented-control">
            {options.map(opt => (
                <button
                    key={opt}
                    type="button"
                    className={`segment-btn ${value === opt ? 'active' : ''}`}
                    onClick={() => onChange(opt)}
                >
                    {opt}
                </button>
            ))}
        </div>
    </div>
);

const StudentAdmission: React.FC = () => {
    const { schoolId } = useParams();
    const navigate = useNavigate();

    const { currentSchool } = useSchool();
    const [step, setStep] = useState(1);
    const { data: allSettings, loading: settingsLoading } = useFirestore<any>('settings');
    const { data: feeAmounts } = useFirestore<any>('fee_amounts');
    const { data: academicYears } = useFirestore<any>('academic_years');

    const activeFY = currentSchool?.activeFinancialYear || '';
    const schoolYears = (academicYears || []).filter((y: any) => y.schoolId === currentSchool?.id && !y.isArchived).map((y: any) => y.name).sort();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [fieldSettings, setFieldSettings] = useState<any[]>([]);

    const location = useLocation();
    const editMode = location.state?.editMode;
    const initialStudent = location.state?.student;

    // Load field settings from Firestore
    React.useEffect(() => {
        const loadFieldSettings = async () => {
            try {
                const { doc, getDoc } = await import('firebase/firestore');
                const { db } = await import('../../lib/firebase');
                // Use currentSchool.id (from context) first, then fallback to URL param
                const effectiveSchoolId = currentSchool?.id || schoolId;
                console.log('[StudentAdmission] currentSchool?.id:', currentSchool?.id, 'schoolId:', schoolId, 'effectiveSchoolId:', effectiveSchoolId);
                const path = effectiveSchoolId ? `schools/${effectiveSchoolId}/settings/student_admission_fields` : 'settings/student_admission_fields';
                console.log('[StudentAdmission] Loading from path:', path);
                const docRef = doc(db, path);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const fields = docSnap.data().fields || [];
                    console.log('[StudentAdmission] Field settings loaded:', fields.length, 'fields', fields);
                    setFieldSettings(fields);
                } else {
                    console.warn('[StudentAdmission] No field settings document found');
                    // Default: all fields enabled and with default required states
                    setFieldSettings([]);
                }
            } catch (error) {
                console.error('Error loading field settings:', error);
                setFieldSettings([]);
            }
        };
        loadFieldSettings();
    }, [schoolId, currentSchool?.id]);

    // Helper function to check if a field is enabled
    const isFieldEnabled = (fieldId: string) => {
        if (fieldSettings.length === 0) return true; // If no settings, show all fields
        const field = fieldSettings.find(f => f.id === fieldId);
        return field ? field.enabled : true;
    };

    // Helper function to check if a field is required
    const isFieldRequired = (fieldId: string) => {
        if (fieldSettings.length === 0) return false; // If no settings, use defaults
        const field = fieldSettings.find(f => f.id === fieldId);
        return field ? (field.enabled && field.required) : false;
    };

    const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

    // Helper to get initial PIN value
    const getInitialPin = () => {
        if (editMode && initialStudent) {
            // In edit mode, preserve existing PIN (check multiple possible field names)
            return initialStudent.pin || initialStudent.loginPin || initialStudent.loginPassword || '';
        }
        // In new admission mode, generate a fresh PIN
        return generatePin();
    };

    // Student Form State
    const [formData, setFormData] = useState({
        // Step 1: Student Details
        fullName: initialStudent?.fullName || initialStudent?.name || '',
        dob: initialStudent?.dob || '',
        gender: initialStudent?.gender || 'Male',
        bloodGroup: initialStudent?.bloodGroup || 'Select',
        state: initialStudent?.state || 'Jharkhand',
        district: initialStudent?.district || 'Ranchi',
        permanentAddress: initialStudent?.permanentAddress || '',
        presentAddress: initialStudent?.presentAddress || '',
        isAddressSame: initialStudent?.isAddressSame || false,
        pinCode: initialStudent?.pinCode || '',
        appaarNo: initialStudent?.appaarNo || '',
        aadharNo: initialStudent?.aadharNo || '',
        studentPenNo: initialStudent?.studentPenNo || '',
        previousSchool: initialStudent?.previousSchool || '',
        diseaseAllergy: initialStudent?.diseaseAllergy || '',

        // Step 2: Father's Details
        fatherName: initialStudent?.fatherName || initialStudent?.parentName || '',
        fatherAadharNo: initialStudent?.fatherAadharNo || '',
        fatherReligion: initialStudent?.fatherReligion || initialStudent?.religion || 'Select',
        fatherQualification: initialStudent?.fatherQualification || 'Select',
        fatherOccupation: initialStudent?.fatherOccupation || 'Select',
        fatherAddress: initialStudent?.fatherAddress || '',
        isFatherAddressSame: initialStudent?.isFatherAddressSame || false,
        fatherContactNo: initialStudent?.fatherContactNo || '',
        fatherWhatsappNo: initialStudent?.fatherWhatsappNo || '',
        fatherEmailId: initialStudent?.fatherEmailId || '',
        fatherAge: initialStudent?.fatherAge || '',

        // Step 3: Mother's Details
        motherName: initialStudent?.motherName || '',
        motherAadharNo: initialStudent?.motherAadharNo || '',
        motherReligion: initialStudent?.motherReligion || initialStudent?.fatherReligion || initialStudent?.religion || 'Select',
        motherQualification: initialStudent?.motherQualification || 'Select',
        motherOccupation: initialStudent?.motherOccupation || 'Select',
        motherAddress: initialStudent?.motherAddress || '',
        isMotherAddressSame: initialStudent?.isMotherAddressSame || false,
        motherContactNo: initialStudent?.motherContactNo || '',
        motherWhatsappNo: initialStudent?.motherWhatsappNo || '',
        motherEmailId: initialStudent?.motherEmailId || '',
        motherAge: initialStudent?.motherAge || '',

        // Step: Guardian Details
        guardianName: initialStudent?.guardianName || '',
        guardianMobile: initialStudent?.guardianMobile || '',
        guardianAddress: initialStudent?.guardianAddress || '',

        // Step 4: Admission Details (Office Use)
        session: initialStudent?.session || activeFY, // Default to active academic year
        admissionDate: initialStudent?.admissionDate || new Date().toISOString().split('T')[0],
        admissionNo: initialStudent?.admissionNo || '',
        class: initialStudent?.class || initialStudent?.admissionClass || '',
        section: initialStudent?.section || '',
        classRollNo: initialStudent?.classRollNo || initialStudent?.rollNo || '0',
        admissionType: initialStudent?.admissionType || 'NEW',
        financeType: initialStudent?.financeType || 'NORMAL',
        studentCategory: initialStudent?.studentCategory || 'GENERAL',
        basicDues: initialStudent?.basicDues || '0.00',
        monthlyFee: initialStudent?.monthlyFee || '0',
        pin: getInitialPin(),
        status: editMode ? (initialStudent?.status || 'ACTIVE') : 'ACTIVE',
        caste: initialStudent?.caste || 'General',
        familyIncome: initialStudent?.familyIncome || '',
        parentOtherInfo: initialStudent?.parentOtherInfo || initialStudent?.remarks || '',

        // Legacy fields (for backward compatibility)
        mobileNo: initialStudent?.mobileNo || initialStudent?.phone || '',
        emailId: initialStudent?.emailId || '',
        whatsappNo: initialStudent?.whatsappNo || '',

        // Registration number (from public registration)
        registrationNo: initialStudent?.registrationNo || ''
    });

    const activeClasses = React.useMemo(() => {
        return getActiveClasses(allSettings?.filter((d: any) => d.type === 'class') || [], formData.session);
    }, [allSettings, formData.session]);

    const { data: students, loading: dbLoading, add: addStudent, update: updateStudent } = useFirestore<any>('students');

    // Auto-generate Admission Number using Institution Settings
    React.useEffect(() => {
        if (!editMode && !formData.admissionNo && !dbLoading && currentSchool) {
            const prefix = currentSchool.admissionNumberPrefix || currentSchool.name?.substring(0, 3).toUpperCase() || 'SCH';
            const startNumStr = currentSchool.admissionNumberStartNumber || '1001';
            const startNum = parseInt(startNumStr) || 1001;

            if (students.length === 0) {
                setFormData(prev => ({ ...prev, admissionNo: `${prefix}/${startNum}` }));
            } else {
                // Find students with the configured prefix
                const prefixedStudents = students.filter((s: any) => {
                    if (!s.admissionNo) return false;
                    // Handle both formats: "PREFIX/123" or "PREFIX123"
                    return s.admissionNo.startsWith(prefix + '/') || s.admissionNo.startsWith(prefix);
                });

                if (prefixedStudents.length === 0) {
                    setFormData(prev => ({ ...prev, admissionNo: `${prefix}/${startNum}` }));
                } else {
                    // Extract numbers from existing admission numbers
                    const numbers = prefixedStudents
                        .map((s: any) => {
                            // Remove prefix and slash, get the number part
                            let numPart = s.admissionNo.replace(prefix, '').replace('/', '').trim();
                            const parsed = parseInt(numPart);
                            return parsed;
                        })
                        .filter((n: any) => !isNaN(n));

                    // Find the highest number
                    const maxNum = numbers.length > 0 ? Math.max(...numbers) : startNum - 1;
                    // Generate next number (always incrementing from the highest found)
                    const nextNum = Math.max(maxNum + 1, startNum);
                    setFormData(prev => ({ ...prev, admissionNo: `${prefix}/${nextNum}` }));
                }
            }
        }
    }, [students, dbLoading, editMode, formData.admissionNo, currentSchool]);

    React.useEffect(() => {
        if (initialStudent?.photo) {
            setImagePreview(initialStudent.photo);
        }
    }, [initialStudent]);

    // Auto-populate monthly fee from fee management when class is selected
    React.useEffect(() => {
        if (formData.class && feeAmounts && feeAmounts.length > 0) {
            // Filter by active financial year first, then by class AND "Monthly" in the name
            const classFees = feeAmounts.filter((fa: any) =>
                (fa.financialYear === activeFY || (!fa.financialYear && !activeFY)) &&
                fa.className === formData.class &&
                fa.feeTypeName &&
                fa.feeTypeName.toLowerCase().includes('monthly')
            );

            const totalMonthlyFee = classFees.reduce((sum: number, fa: any) => sum + (Number(fa.amount) || 0), 0);

            // Always update when class changes, even if it's 0
            setFormData(prev => ({ ...prev, monthlyFee: totalMonthlyFee.toString() }));
        }
    }, [formData.class, feeAmounts, activeFY]);

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

    const handleAddressSame = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setFormData(prev => ({
            ...prev,
            isAddressSame: checked,
            presentAddress: checked ? prev.permanentAddress : prev.presentAddress
        }));
    };

    const handleConfirm = async () => {
        if (!formData.fullName || !formData.admissionNo) {
            alert('Please fill at least Name and Admission No.');
            return;
        }

        // Mobile Number Validation (10 digits)
        const mobileFields = [
            { key: 'mobileNo', label: 'Primary Mobile No' },
            { key: 'whatsappNo', label: 'WhatsApp No' },
            { key: 'fatherContactNo', label: "Father's Contact No" },
            { key: 'fatherWhatsappNo', label: "Father's WhatsApp No" },
            { key: 'motherContactNo', label: "Mother's Contact No" },
            { key: 'motherWhatsappNo', label: "Mother's WhatsApp No" }
        ];

        let invalidMobile = [];
        for (const field of mobileFields) {
            const val = formData[field.key as keyof typeof formData];
            if (val && val.toString().length > 0 && val.toString().length !== 10) {
                invalidMobile.push(field.label);
            }
        }

        if (invalidMobile.length > 0) {
            alert(`Invalid Mobile Number(must be 10 digits): ${invalidMobile.join(', ')} `);
            return;
        }

        // Convert text fields to Proper Case
        const transformedData = { ...formData };
        const skipFields = [
            'dob', 'gender', 'bloodGroup', 'photo', 'state', 'district', 'pinCode',
            'aadharNo', 'appaarNo', 'studentPenNo', 'class', 'section', 'session',
            'admissionNo', 'admissionDate', 'pin', 'status', 'admissionType', 'financeType',
            'studentCategory', 'basicDues', 'mobileNo', 'whatsappNo',
            'fatherContactNo', 'fatherWhatsappNo', 'motherContactNo', 'motherWhatsappNo',
            'fatherEmailId', 'motherEmailId', 'emailId', 'fatherAge', 'motherAge'
        ];

        (Object.keys(transformedData) as Array<keyof typeof formData>).forEach(key => {
            const val = transformedData[key];
            if (typeof val === 'string' && !skipFields.includes(key) && val.trim().length > 0) {
                (transformedData as any)[key] = toProperCase(val);
            }
        });

        const studentData = {
            ...transformedData,
            photo: imagePreview,
            name: transformedData.fullName,
            parentName: transformedData.fatherName,
            phone: transformedData.fatherContactNo || transformedData.mobileNo || '',
            mobileNo: transformedData.fatherContactNo || transformedData.mobileNo || '',
            admissionDate: transformedData.admissionDate,
            status: transformedData.status,
            updatedAt: new Date().toISOString()
        };

        if (!editMode) {
            (studentData as any).createdAt = new Date().toISOString();
            (studentData as any).admissionTimestamp = new Date().toISOString();
        }

        try {
            if (editMode && initialStudent?.id) {
                await updateStudent(initialStudent.id, studentData);
                alert('Student record updated successfully!');
            } else {
                await addStudent(studentData);

                // If this admission came from a public registration, delete the registration request
                if (initialStudent?.registrationId) {
                    try {
                        const { doc } = await import('firebase/firestore');
                        const { db } = await import('../../lib/firebase');
                        const { guardedDeleteDoc } = await import('../../lib/firestoreWrite');
                        await guardedDeleteDoc(doc(db, 'registrations', initialStudent.registrationId));
                    } catch (regErr: any) {
                        if (regErr?.message !== 'WRITE_DENIED') console.error("Error deleting registration record:", regErr);
                        // Don't fail the whole process if registration deletion fails
                    }
                }

                alert('Student admitted successfully!');
            }
            navigate(`/${schoolId}/students`);
        } catch (e) {
            alert('Failed to save student: ' + (e as Error).message);
        }
    };

    const currentDistricts = DISTRICTS_MAP[formData.state] || [];

    const nextStep = () => setStep(s => Math.min(s + 1, 5));
    const prevStep = () => setStep(s => Math.max(s - 1, 1));

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '4rem' }}>
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleImageChange}
            />
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', background: 'var(--primary)', padding: '1rem 2rem', borderRadius: 'var(--radius-lg)', color: 'white', boxShadow: 'var(--shadow-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <button onClick={() => navigate(`/${schoolId}/students`)} className="btn-icon" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{editMode ? 'Edit Student Details' : 'Student Admission'}</h2>
                        <p style={{ fontSize: '0.75rem', opacity: 0.9, margin: 0 }}>{editMode ? 'Modify existing student record' : 'Enroll a new student into the system'}</p>
                    </div>
                </div>
                <div className="wizard-stepper">
                    {[1, 2, 3, 4, 5].map(i => (
                        <button
                            key={i}
                            onClick={() => setStep(i)}
                            className={`step-dot ${step === i ? 'active' : ''} ${step > i ? 'completed' : ''}`}
                            aria-label={`Go to step ${i}`}
                            style={{ cursor: 'pointer', border: 'none', outline: 'none' }}
                        >
                            {i}
                        </button>
                    ))}
                </div>
            </div>

            <div className="glass-card wizard-container" style={{ padding: '0', overflow: 'hidden' }}>
                {/* Step Header */}
                <div className="wizard-step-header">
                    {step === 1 && <><User size={20} /> <span>Student Details</span></>}
                    {step === 2 && <><User size={20} /> <span>Father's Details</span></>}
                    {step === 3 && <><User size={20} /> <span>Mother's Details</span></>}
                    {step === 4 && <><User size={20} /> <span>Guardian Details</span></>}
                    {step === 5 && <><School size={20} /> <span>Admission Details (Office Use)</span></>}
                </div>

                <div style={{ padding: '2.5rem' }}>
                    {/* Step 1: Student Details */}
                    {step === 1 && (
                        <div className="animate-scale-in wizard-step-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '3rem' }}>
                            {/* Left Column: Personal Info */}
                            <div className="field-column">
                                {isFieldEnabled('fullName') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">Student Full Name{isFieldRequired('fullName') && <span style={{ color: '#ef4444' }}> *</span>}</label>
                                        <input type="text" placeholder="Enter full name" className="input-field-premium important" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} onBlur={e => setFormData({ ...formData, fullName: toProperCase(e.target.value) })} />
                                    </div>
                                )}
                                {isFieldEnabled('dob') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">Date of Birth{isFieldRequired('dob') && <span style={{ color: '#ef4444' }}> *</span>}</label>
                                        <input type="date" className="input-field-premium" value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} />
                                        {formData.dob && (
                                            <div style={{
                                                padding: '0.4rem 0.8rem',
                                                background: 'rgba(99, 102, 241, 0.1)',
                                                borderRadius: '0.5rem',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                color: 'var(--primary)',
                                                marginTop: '0.5rem',
                                                display: 'inline-block',
                                                width: 'fit-content'
                                            }}>
                                                Age: {calculateAge(formData.dob)?.years} Years, {calculateAge(formData.dob)?.months} Months
                                            </div>
                                        )}
                                    </div>
                                )}
                                {isFieldEnabled('gender') && (
                                    <SegmentedControl
                                        label={`Gender ${isFieldRequired('gender') ? '*' : ''}`}
                                        options={['Male', 'Female', 'Other']}
                                        value={formData.gender}
                                        onChange={val => setFormData({ ...formData, gender: val })}
                                    />
                                )}
                                {isFieldEnabled('caste') && (
                                    <SegmentedControl
                                        label={`Caste ${isFieldRequired('caste') ? '*' : ''}`}
                                        options={['General', 'OBC', 'SC', 'ST']}
                                        value={formData.caste}
                                        onChange={val => setFormData({ ...formData, caste: val })}
                                    />
                                )}
                                {isFieldEnabled('bloodGroup') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">
                                            Blood Group{isFieldRequired('bloodGroup') && <span style={{ color: '#ef4444' }}> *</span>}
                                        </label>
                                        <select className="input-field-premium" value={formData.bloodGroup} onChange={e => setFormData({ ...formData, bloodGroup: e.target.value })}>
                                            <option>Select</option>
                                            <option>A+</option><option>B+</option><option>O+</option><option>AB+</option>
                                            <option>A-</option><option>B-</option><option>O-</option><option>AB-</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Middle Column: Location & Address */}
                            <div className="field-column">
                                {isFieldEnabled('state') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">State{isFieldRequired('state') && <span style={{ color: '#ef4444' }}> *</span>}</label>
                                        <select className="input-field-premium" value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value, district: DISTRICTS_MAP[e.target.value]?.[0] || 'Select' })}>
                                            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                )}
                                {isFieldEnabled('district') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">District{isFieldRequired('district') && <span style={{ color: '#ef4444' }}> *</span>}</label>
                                        <select className="input-field-premium" value={formData.district} onChange={e => setFormData({ ...formData, district: e.target.value })} disabled={currentDistricts.length === 0}>
                                            {currentDistricts.length > 0 ? (
                                                currentDistricts.map(d => <option key={d} value={d}>{d}</option>)
                                            ) : (
                                                <option>Select</option>
                                            )}
                                        </select>
                                    </div>
                                )}
                                {isFieldEnabled('permanentAddress') && (
                                    <div className="input-group-vertical" style={{ gap: '0.25rem' }}>
                                        <label className="field-label">Permanent Address{isFieldRequired('permanentAddress') && <span style={{ color: '#ef4444' }}> *</span>}</label>
                                        <textarea
                                            placeholder="Enter permanent address"
                                            className="input-field-premium"
                                            style={{ minHeight: '80px', resize: 'none' }}
                                            value={formData.permanentAddress}
                                            onChange={e => setFormData({ ...formData, permanentAddress: e.target.value, presentAddress: formData.isAddressSame ? e.target.value : formData.presentAddress })}
                                            onBlur={e => setFormData({ ...formData, permanentAddress: toProperCase(e.target.value), presentAddress: formData.isAddressSame ? toProperCase(e.target.value) : formData.presentAddress })}
                                        />
                                    </div>
                                )}
                                {isFieldEnabled('presentAddress') && (
                                    <div className="input-group-vertical" style={{ gap: '0.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <label className="field-label">Present Address{isFieldRequired('presentAddress') && <span style={{ color: '#ef4444' }}> *</span>}</label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={formData.isAddressSame} onChange={handleAddressSame} /> SAME
                                            </label>
                                        </div>
                                        <textarea
                                            placeholder="Enter present address"
                                            className="input-field-premium"
                                            style={{ minHeight: '80px', resize: 'none' }}
                                            value={formData.presentAddress}
                                            onChange={e => setFormData({ ...formData, presentAddress: e.target.value })}
                                            onBlur={e => setFormData({ ...formData, presentAddress: toProperCase(e.target.value) })}
                                            disabled={formData.isAddressSame}
                                        />
                                    </div>
                                )}
                                {isFieldEnabled('pinCode') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">
                                            Pin Code{isFieldRequired('pinCode') && <span style={{ color: '#ef4444' }}> *</span>}
                                        </label>
                                        <input type="text" placeholder="6 digit pin code" className="input-field-premium" value={formData.pinCode} onChange={e => setFormData({ ...formData, pinCode: e.target.value })} />
                                    </div>
                                )}
                            </div>

                            {/* Right Column: Photo & Contact */}
                            <div className="field-column">
                                {isFieldEnabled('photo') && (
                                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                        <div className="photo-upload-box" style={{ padding: 0, overflow: 'hidden' }}>
                                            {imagePreview ? (
                                                <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <>
                                                    <ImageIcon size={40} />
                                                    <span>PHOTO</span>
                                                </>
                                            )}
                                        </div>
                                        <button className="btn-small" onClick={() => fileInputRef.current?.click()}>
                                            UPLOAD / CHANGE PHOTO{isFieldRequired('photo') && <span style={{ color: '#ef4444' }}> *</span>}
                                        </button>
                                    </div>
                                )}
                                {isFieldEnabled('aadharNo') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">
                                            Student Aadhar No{isFieldRequired('aadharNo') && <span style={{ color: '#ef4444' }}> *</span>}
                                        </label>
                                        <input type="text" placeholder="12 digit Aadhar number" className="input-field-premium" value={formData.aadharNo} onChange={e => setFormData({ ...formData, aadharNo: e.target.value.replace(/\D/g, '') })} maxLength={12} pattern="\d{12}" />
                                    </div>
                                )}
                                {isFieldEnabled('appaarNo') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">
                                            Appaar No.{isFieldRequired('appaarNo') && <span style={{ color: '#ef4444' }}> *</span>}
                                        </label>
                                        <input type="text" placeholder="Appaar number" className="input-field-premium" value={formData.appaarNo} onChange={e => setFormData({ ...formData, appaarNo: e.target.value })} />
                                    </div>
                                )}
                                {isFieldEnabled('studentPenNo') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">
                                            Student PEN No.{isFieldRequired('studentPenNo') && <span style={{ color: '#ef4444' }}> *</span>}
                                        </label>
                                        <input type="text" placeholder="PEN number" className="input-field-premium" value={formData.studentPenNo} onChange={e => setFormData({ ...formData, studentPenNo: e.target.value })} />
                                    </div>
                                )}
                                {isFieldEnabled('previousSchool') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">
                                            Previous School{isFieldRequired('previousSchool') && <span style={{ color: '#ef4444' }}> *</span>}
                                        </label>
                                        <input type="text" placeholder="Previous school name" className="input-field-premium" value={formData.previousSchool} onChange={e => setFormData({ ...formData, previousSchool: e.target.value })} onBlur={e => setFormData({ ...formData, previousSchool: toProperCase(e.target.value) })} />
                                    </div>
                                )}
                                {isFieldEnabled('diseaseAllergy') && (
                                    <div className="input-group-vertical" style={{ gridColumn: 'span 2' }}>
                                        <label className="field-label">Any disease or allergy? Specify {isFieldRequired('diseaseAllergy') && <span style={{ color: '#ef4444' }}> *</span>}</label>
                                        <input type="text" placeholder="Specify if any, otherwise type 'None'" className="input-field-premium" value={formData.diseaseAllergy} onChange={e => setFormData({ ...formData, diseaseAllergy: e.target.value })} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}


                    {/* Step 2: Father's Details */}
                    {step === 2 && (
                        <div className="animate-scale-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                {/* Left Column */}
                                <div className="field-column">
                                    <div className="input-group-vertical">
                                        <label className="field-label">Father's Name <span style={{ color: '#ef4444' }}>*</span></label>
                                        <input type="text" placeholder="Enter father's name" className="input-field-premium" value={formData.fatherName} onChange={e => setFormData({ ...formData, fatherName: e.target.value })} onBlur={e => setFormData({ ...formData, fatherName: toProperCase(e.target.value) })} />
                                    </div>
                                    {isFieldEnabled('fatherAadharNo') && (
                                        <div className="input-group-vertical">
                                            <label className="field-label">
                                                Father's Aadhar No{isFieldRequired('fatherAadharNo') && <span style={{ color: '#ef4444' }}> *</span>}
                                            </label>
                                            <input type="text" placeholder="12 digit Aadhar number" className="input-field-premium" value={formData.fatherAadharNo} onChange={e => setFormData({ ...formData, fatherAadharNo: e.target.value.replace(/\D/g, '') })} maxLength={12} pattern="\d{12}" />
                                        </div>
                                    )}
                                    {isFieldEnabled('fatherQualification') && (
                                        <div className="input-group-vertical">
                                            <label className="field-label">
                                                Father's Qualification{isFieldRequired('fatherQualification') && <span style={{ color: '#ef4444' }}> *</span>}
                                            </label>
                                            <select className="input-field-premium" value={formData.fatherQualification} onChange={e => setFormData({ ...formData, fatherQualification: e.target.value })}>
                                                <option>Select</option>
                                                <option>No Formal Education</option>
                                                <option>Primary Education</option>
                                                <option>Secondary Education</option>
                                                <option>Vocational</option>
                                                <option>Bachelor's</option>
                                                <option>Master's</option>
                                                <option>Doctorate</option>
                                            </select>
                                        </div>
                                    )}
                                    {isFieldEnabled('fatherOccupation') && (
                                        <div className="input-group-vertical">
                                            <label className="field-label">
                                                Father's Occupation{isFieldRequired('fatherOccupation') && <span style={{ color: '#ef4444' }}> *</span>}
                                            </label>
                                            <select className="input-field-premium" value={formData.fatherOccupation} onChange={e => setFormData({ ...formData, fatherOccupation: e.target.value })}>
                                                <option>Select</option>
                                                <option>Unemployed</option>
                                                <option>Private Job</option>
                                                <option>Govt. Job</option>
                                                <option>Self Employed</option>
                                                <option>Professional</option>
                                                <option>Farmer</option>
                                            </select>
                                        </div>
                                    )}
                                    {isFieldEnabled('fatherReligion') && (
                                        <div className="input-group-vertical">
                                            <label className="field-label">
                                                Father's Religion{isFieldRequired('fatherReligion') && <span style={{ color: '#ef4444' }}> *</span>}
                                            </label>
                                            <select
                                                className="input-field-premium"
                                                value={formData.fatherReligion}
                                                onChange={e => setFormData({
                                                    ...formData,
                                                    fatherReligion: e.target.value,
                                                    motherReligion: formData.motherReligion === formData.fatherReligion || formData.motherReligion === 'Select' ? e.target.value : formData.motherReligion
                                                })}
                                            >
                                                <option>Select</option>
                                                <option>Islam</option>
                                                <option>Hinduism</option>
                                                <option>Christianity</option>
                                                <option>Sikhism</option>
                                                <option>Buddhism</option>
                                                <option>Other</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {/* Right Column */}
                                <div className="field-column">
                                    {isFieldEnabled('fatherAddress') && (
                                        <div className="input-group-vertical" style={{ gap: '0.25rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label className="field-label">
                                                    Father's Address{isFieldRequired('fatherAddress') && <span style={{ color: '#ef4444' }}> *</span>}
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.isFatherAddressSame}
                                                        onChange={e => setFormData({
                                                            ...formData,
                                                            isFatherAddressSame: e.target.checked,
                                                            fatherAddress: e.target.checked ? formData.permanentAddress : formData.fatherAddress
                                                        })}
                                                    />
                                                    SAME AS STUDENT
                                                </label>
                                            </div>
                                            <textarea
                                                placeholder="Enter father's address"
                                                className="input-field-premium"
                                                style={{ minHeight: '80px', resize: 'none' }}
                                                value={formData.fatherAddress}
                                                onChange={e => setFormData({ ...formData, fatherAddress: e.target.value })}
                                                onBlur={e => setFormData({ ...formData, fatherAddress: toProperCase(e.target.value) })}
                                                disabled={formData.isFatherAddressSame}
                                            />
                                        </div>
                                    )}
                                    {isFieldEnabled('fatherContactNo') && (
                                        <div className="input-group-vertical">
                                            <label className="field-label">
                                                Father's Contact No{isFieldRequired('fatherContactNo') ? <span style={{ color: '#ef4444' }}> *</span> : ''}
                                            </label>
                                            <input type="text" placeholder="10 digit mobile number" className="input-field-premium" value={formData.fatherContactNo} onChange={e => setFormData({ ...formData, fatherContactNo: e.target.value })} />
                                        </div>
                                    )}
                                    {isFieldEnabled('fatherWhatsappNo') && (
                                        <div className="input-group-vertical">
                                            <label className="field-label">
                                                Father's WhatsApp No{isFieldRequired('fatherWhatsappNo') && <span style={{ color: '#ef4444' }}> *</span>}
                                            </label>
                                            <input type="text" placeholder="WhatsApp number" className="input-field-premium" value={formData.fatherWhatsappNo} onChange={e => setFormData({ ...formData, fatherWhatsappNo: e.target.value })} />
                                        </div>
                                    )}
                                    {isFieldEnabled('fatherEmailId') && (
                                        <div className="input-group-vertical">
                                            <label className="field-label">
                                                Father's Email ID{isFieldRequired('fatherEmailId') && <span style={{ color: '#ef4444' }}> *</span>}
                                            </label>
                                            <input type="email" placeholder="example@email.com" className="input-field-premium" value={formData.fatherEmailId} onChange={e => setFormData({ ...formData, fatherEmailId: e.target.value })} />
                                        </div>
                                    )}
                                    {isFieldEnabled('fatherAge') && (
                                        <div className="input-group-vertical">
                                            <label className="field-label">
                                                Father's Age{isFieldRequired('fatherAge') && <span style={{ color: '#ef4444' }}> *</span>}
                                            </label>
                                            <input type="number" placeholder="Years" className="input-field-premium" value={formData.fatherAge} onChange={e => setFormData({ ...formData, fatherAge: e.target.value })} />
                                        </div>
                                    )}
                                    {isFieldEnabled('familyIncome') && (
                                        <div className="input-group-vertical">
                                            <label className="field-label">
                                                Family Income (Annual){isFieldRequired('familyIncome') && <span style={{ color: '#ef4444' }}> *</span>}
                                            </label>
                                            <input type="text" placeholder="e.g. 5,00,000" className="input-field-premium" value={formData.familyIncome} onChange={e => setFormData({ ...formData, familyIncome: e.target.value })} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}


                    {/* Step 3: Mother's Details */}
                    {step === 3 && (
                        <div className="animate-scale-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                {/* Left Column */}
                                <div className="field-column">
                                    <div className="input-group-vertical">
                                        <label className="field-label">Mother's Name <span style={{ color: '#ef4444' }}>*</span></label>
                                        <input type="text" placeholder="Enter mother's name" className="input-field-premium" value={formData.motherName} onChange={e => setFormData({ ...formData, motherName: e.target.value })} onBlur={e => setFormData({ ...formData, motherName: toProperCase(e.target.value) })} />
                                    </div>
                                    {isFieldEnabled('motherAadharNo') && (
                                        <div className="input-group-vertical">
                                            <label className="field-label">
                                                Mother's Aadhar No{isFieldRequired('motherAadharNo') && <span style={{ color: '#ef4444' }}> *</span>}
                                            </label>
                                            <input type="text" placeholder="12 digit Aadhar number" className="input-field-premium" value={formData.motherAadharNo} onChange={e => setFormData({ ...formData, motherAadharNo: e.target.value.replace(/\D/g, '') })} maxLength={12} pattern="\d{12}" />
                                        </div>
                                    )}
                                    {isFieldEnabled('motherQualification') && (
                                        <div className="input-group-vertical">
                                            <label className="field-label">
                                                Mother's Qualification{isFieldRequired('motherQualification') && <span style={{ color: '#ef4444' }}> *</span>}
                                            </label>
                                            <select className="input-field-premium" value={formData.motherQualification} onChange={e => setFormData({ ...formData, motherQualification: e.target.value })}>
                                                <option>Select</option>
                                                <option>No Formal Education</option>
                                                <option>Primary Education</option>
                                                <option>Secondary Education</option>
                                                <option>Vocational</option>
                                                <option>Bachelor's</option>
                                                <option>Master's</option>
                                                <option>Doctorate</option>
                                            </select>
                                        </div>
                                    )}
                                    {isFieldEnabled('motherOccupation') && (
                                        <div className="input-group-vertical">
                                            <label className="field-label">
                                                Mother's Occupation{isFieldRequired('motherOccupation') && <span style={{ color: '#ef4444' }}> *</span>}
                                            </label>
                                            <select className="input-field-premium" value={formData.motherOccupation} onChange={e => setFormData({ ...formData, motherOccupation: e.target.value })}>
                                                <option>Select</option>
                                                <option>House Wife</option>
                                                <option>Private Job</option>
                                                <option>Govt. Job</option>
                                                <option>Self Employed</option>
                                                <option>Professional</option>
                                            </select>
                                        </div>
                                    )}
                                    {isFieldEnabled('motherReligion') && (
                                        <div className="input-group-vertical">
                                            <label className="field-label">
                                                Mother's Religion{isFieldRequired('motherReligion') && <span style={{ color: '#ef4444' }}> *</span>}
                                            </label>
                                            <select
                                                className="input-field-premium"
                                                value={formData.motherReligion}
                                                onChange={e => setFormData({ ...formData, motherReligion: e.target.value })}
                                            >
                                                <option>Select</option>
                                                <option>Islam</option>
                                                <option>Hinduism</option>
                                                <option>Christianity</option>
                                                <option>Sikhism</option>
                                                <option>Buddhism</option>
                                                <option>Other</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {/* Right Column */}
                                <div className="field-column">
                                    {isFieldEnabled('motherAddress') && (
                                        <div className="input-group-vertical" style={{ gap: '0.25rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label className="field-label">
                                                    Mother's Address{isFieldRequired('motherAddress') && <span style={{ color: '#ef4444' }}> *</span>}
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.isMotherAddressSame}
                                                        onChange={e => setFormData({
                                                            ...formData,
                                                            isMotherAddressSame: e.target.checked,
                                                            motherAddress: e.target.checked ? formData.permanentAddress : formData.motherAddress
                                                        })}
                                                    />
                                                    SAME AS STUDENT
                                                </label>
                                            </div>
                                            <textarea
                                                placeholder="Enter mother's address"
                                                className="input-field-premium"
                                                style={{ minHeight: '80px', resize: 'none' }}
                                                value={formData.motherAddress}
                                                onChange={e => setFormData({ ...formData, motherAddress: e.target.value })}
                                                disabled={formData.isMotherAddressSame}
                                            />
                                        </div>
                                    )}
                                    {isFieldEnabled('motherContactNo') && (
                                        <div className="input-group-vertical">
                                            <label className="field-label">
                                                Mother's Contact No{isFieldRequired('motherContactNo') && <span style={{ color: '#ef4444' }}> *</span>}
                                            </label>
                                            <input type="text" placeholder="10 digit mobile number" className="input-field-premium" value={formData.motherContactNo} onChange={e => setFormData({ ...formData, motherContactNo: e.target.value })} />
                                        </div>
                                    )}
                                    {isFieldEnabled('motherWhatsappNo') && (
                                        <div className="input-group-vertical">
                                            <label className="field-label">
                                                Mother's WhatsApp No{isFieldRequired('motherWhatsappNo') && <span style={{ color: '#ef4444' }}> *</span>}
                                            </label>
                                            <input type="text" placeholder="WhatsApp number" className="input-field-premium" value={formData.motherWhatsappNo} onChange={e => setFormData({ ...formData, motherWhatsappNo: e.target.value })} />
                                        </div>
                                    )}
                                    {isFieldEnabled('motherEmailId') && (
                                        <div className="input-group-vertical">
                                            <label className="field-label">
                                                Mother's Email ID{isFieldRequired('motherEmailId') && <span style={{ color: '#ef4444' }}> *</span>}
                                            </label>
                                            <input type="email" placeholder="example@email.com" className="input-field-premium" value={formData.motherEmailId} onChange={e => setFormData({ ...formData, motherEmailId: e.target.value })} />
                                        </div>
                                    )}
                                    {isFieldEnabled('motherAge') && (
                                        <div className="input-group-vertical">
                                            <label className="field-label">
                                                Mother's Age{isFieldRequired('motherAge') && <span style={{ color: '#ef4444' }}> *</span>}
                                            </label>
                                            <input type="number" placeholder="Years" className="input-field-premium" value={formData.motherAge} onChange={e => setFormData({ ...formData, motherAge: e.target.value })} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Guardian Details */}
                    {step === 4 && (
                        <div className="animate-scale-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
                            <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '1.5rem', borderRadius: '1rem', border: '1px dotted var(--primary)', marginBottom: '2rem' }}>
                                <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.1rem', fontWeight: 800 }}>Guardian Information</h3>
                                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Required if parent is deceased or does not locally reside.</p>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '1.5rem' }}>
                                {isFieldEnabled('guardianName') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">Guardian's Name {isFieldRequired('guardianName') && <span style={{ color: '#ef4444' }}> *</span>}</label>
                                        <input type="text" placeholder="Enter guardian's full name" className="input-field-premium" value={formData.guardianName} onChange={e => setFormData({ ...formData, guardianName: e.target.value })} />
                                    </div>
                                )}
                                {isFieldEnabled('guardianMobile') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">Guardian's Mobile {isFieldRequired('guardianMobile') && <span style={{ color: '#ef4444' }}> *</span>}</label>
                                        <input type="text" placeholder="Guardian's contact number" className="input-field-premium" value={formData.guardianMobile} onChange={e => setFormData({ ...formData, guardianMobile: e.target.value })} />
                                    </div>
                                )}
                                {isFieldEnabled('guardianAddress') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">Guardian's Address {isFieldRequired('guardianAddress') && <span style={{ color: '#ef4444' }}> *</span>}</label>
                                        <textarea
                                            placeholder="Guardian's permanent address"
                                            className="input-field-premium"
                                            style={{ minHeight: '100px', resize: 'none' }}
                                            value={formData.guardianAddress}
                                            onChange={e => setFormData({ ...formData, guardianAddress: e.target.value })}
                                        />
                                    </div>
                                )}
                                {!isFieldEnabled('guardianName') && !isFieldEnabled('guardianMobile') && !isFieldEnabled('guardianAddress') && (
                                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                        Guardian fields are disabled in settings. Please contact administrator.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 5: Admission Details (Office Use) */}
                    {step === 5 && (
                        <div className="animate-scale-in wizard-step-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
                            <div className="field-column">
                                {isFieldEnabled('session') && (
                                    <SegmentedControl
                                        label={`Session ${isFieldRequired('session') ? '*' : ''}`}
                                        options={schoolYears.length > 0 ? schoolYears : [activeFY]}
                                        value={formData.session}
                                        onChange={val => setFormData({ ...formData, session: val })}
                                    />
                                )}
                                {isFieldEnabled('admissionDate') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">
                                            Date of Admission{isFieldRequired('admissionDate') && <span style={{ color: '#ef4444' }}> *</span>}
                                        </label>
                                        <input type="date" className="input-field-premium" value={formData.admissionDate} onChange={e => setFormData({ ...formData, admissionDate: e.target.value })} />
                                    </div>
                                )}
                                {isFieldEnabled('admissionNo') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">
                                            Admission No. (System Generated){isFieldRequired('admissionNo') && <span style={{ color: '#ef4444' }}> *</span>}
                                        </label>
                                        <input
                                            type="text"
                                            className="input-field-premium important"
                                            value={formData.admissionNo}
                                            onChange={e => setFormData({ ...formData, admissionNo: e.target.value })}
                                        />
                                    </div>
                                )}
                                {isFieldEnabled('class') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">
                                            Class{isFieldRequired('class') && <span style={{ color: '#ef4444' }}> *</span>}
                                        </label>
                                        <select
                                            className="input-field-premium"
                                            value={formData.class}
                                            onChange={e => setFormData({ ...formData, class: e.target.value, section: '' })}
                                        >
                                            <option value="">Select Class</option>
                                            {activeClasses.map((cls: any) => (
                                                <option key={cls.id} value={cls.name}>{formatClassName(cls.name, currentSchool?.useRomanNumerals)}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {isFieldEnabled('section') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">
                                            Section{isFieldRequired('section') && <span style={{ color: '#ef4444' }}> *</span>}
                                        </label>
                                        <select
                                            className="input-field-premium"
                                            value={formData.section}
                                            onChange={e => setFormData({ ...formData, section: e.target.value })}
                                            disabled={!formData.class}
                                        >
                                            <option value="">Select Section</option>
                                            {activeClasses.find((cls: any) => cls.name === formData.class)?.sections?.length > 0 ? (
                                                activeClasses.find((cls: any) => cls.name === formData.class)?.sections?.map((sec: string) => (
                                                    <option key={sec} value={sec}>{sec}</option>
                                                ))
                                            ) : formData.class ? (
                                                <option value="">No Section</option>
                                            ) : null}
                                        </select>
                                    </div>
                                )}
                                {isFieldEnabled('classRollNo') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">
                                            Class Roll No.{isFieldRequired('classRollNo') && <span style={{ color: '#ef4444' }}> *</span>}
                                        </label>
                                        <input type="text" className="input-field-premium" value={formData.classRollNo} onChange={e => setFormData({ ...formData, classRollNo: e.target.value })} />
                                    </div>
                                )}



                            </div>

                            <div className="field-column">
                                {isFieldEnabled('admissionType') && (
                                    <SegmentedControl
                                        label={`Admission Type ${isFieldRequired('admissionType') ? '*' : ''}`}
                                        options={['NEW', 'OLD']}
                                        value={formData.admissionType}
                                        onChange={val => setFormData({ ...formData, admissionType: val })}
                                    />
                                )}
                                {isFieldEnabled('financeType') && (
                                    <SegmentedControl
                                        label={`Finance Type ${isFieldRequired('financeType') ? '*' : ''}`}
                                        options={['NORMAL', 'BPL', 'FREE', 'WARD']}
                                        value={formData.financeType}
                                        onChange={val => setFormData({ ...formData, financeType: val })}
                                    />
                                )}
                                {isFieldEnabled('studentCategory') && (
                                    <SegmentedControl
                                        label={`Student Category ${isFieldRequired('studentCategory') ? '*' : ''}`}
                                        options={[
                                            'GENERAL',
                                            ...(currentSchool?.allowedModules?.includes('transport') ? ['TRANSPORT'] : []),
                                            ...(currentSchool?.allowedModules?.includes('hostel') ? ['HOSTELER'] : [])
                                        ]}
                                        value={formData.studentCategory}
                                        onChange={val => setFormData({ ...formData, studentCategory: val })}
                                    />
                                )}
                                {isFieldEnabled('basicDues') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">
                                            Basic Dues{isFieldRequired('basicDues') && <span style={{ color: '#ef4444' }}> *</span>}
                                        </label>
                                        <input type="text" className="input-field-premium" value={formData.basicDues} onChange={e => setFormData({ ...formData, basicDues: e.target.value })} />
                                    </div>
                                )}
                                <div className="input-group-vertical">
                                    <label className="field-label">
                                        Monthly Fee <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>(from Fee Management)</span>
                                    </label>
                                    <input
                                        type="number"
                                        className="input-field-premium"
                                        value={formData.monthlyFee}
                                        onChange={e => setFormData({ ...formData, monthlyFee: e.target.value })}
                                        placeholder="Auto-filled from Fee Management"
                                    />
                                </div>
                                {isFieldEnabled('pin') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">
                                            Login Password{isFieldRequired('pin') && <span style={{ color: '#ef4444' }}> *</span>}
                                        </label>
                                        <input
                                            type="text"
                                            className="input-field-premium important"
                                            value={formData.pin}
                                            onChange={e => setFormData({ ...formData, pin: e.target.value })}
                                            maxLength={4}
                                            disabled={editMode}
                                            style={{ opacity: editMode ? 0.7 : 1, cursor: editMode ? "not-allowed" : "text" }}
                                        />
                                    </div>
                                )}
                                {isFieldEnabled('status') && (
                                    <SegmentedControl
                                        label={`Status ${isFieldRequired('status') ? '*' : ''}`}
                                        options={['ACTIVE', 'INACTIVE']}
                                        value={formData.status}
                                        onChange={val => setFormData({ ...formData, status: val })}
                                    />
                                )}
                                {isFieldEnabled('parentOtherInfo') && (
                                    <div className="input-group-vertical">
                                        <label className="field-label">
                                            Parent Other Information{isFieldRequired('parentOtherInfo') && <span style={{ color: '#ef4444' }}> *</span>}
                                        </label>
                                        <textarea
                                            className="input-field-premium"
                                            style={{ minHeight: '100px', resize: 'none' }}
                                            value={formData.parentOtherInfo}
                                            onChange={e => setFormData({ ...formData, parentOtherInfo: e.target.value })}
                                            placeholder="Enter any additional information about parents..."
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="wizard-footer">
                    <button className="btn-secondary" onClick={prevStep} disabled={step === 1}>Back</button>
                    {step < 5 ? (
                        <button className="btn-primary-modern" onClick={nextStep}>
                            Next <ArrowRight size={18} />
                        </button>
                    ) : (
                        <button className="btn-success-modern" onClick={handleConfirm}>
                            <Save size={18} /> {editMode ? 'Update Record' : 'Confirm Admission'}
                        </button>
                    )}
                </div>
            </div>

            <style>{`
                .wizard-container {
                    background: var(--bg-card);
                    border-radius: var(--radius-xl);
                    box-shadow: 0 20px 50px rgba(0,0,0,0.1);
                }
                .wizard-step-header {
                    background: #f8fafc;
                    padding: 1rem 2.5rem;
                    border-bottom: 1px solid var(--border);
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    color: var(--primary);
                    font-weight: 700;
                }
                .wizard-stepper {
                    display: flex;
                    gap: 0.75rem;
                }
                .step-dot {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.875rem;
                    font-weight: 700;
                    transition: all 0.3s ease;
                }
                /* Responsive Mobile Styles */
                @media (max-width: 768px) {
                    .wizard-container {
                        margin: 0 -0.5rem;
                        border-radius: 0;
                    }
                    .wizard-step-grid {
                        grid-template-columns: 1fr !important;
                        gap: 1.5rem !important;
                    }
                    .wizard-container > div:last-child {
                        padding: 1.25rem !important;
                    }
                    .field-column {
                        gap: 1rem;
                    }
                    .field-label {
                        font-size: 0.65rem;
                        margin-bottom: 0.25rem;
                    }
                    .segmented-control {
                        flex-wrap: wrap;
                    }
                    .segment-btn {
                        flex: 1 1 30% !important;
                        min-height: 38px;
                        font-size: 0.65rem;
                        padding: 0.35rem 0.2rem;
                        line-height: 1.1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        text-align: center;
                    }
                    .dropdown-grid-mobile {
                        flex-direction: column !important;
                        gap: 1rem !important;
                    }
                    .btn-primary-modern, .btn-secondary, .btn-success-modern {
                        width: 100%;
                        padding: 0.875rem;
                        font-size: 0.95rem;
                        justify-content: center;
                    }
                    .wizard-footer {
                        flex-direction: column-reverse;
                        padding: 1.25rem !important;
                        gap: 0.75rem;
                    }
                    .wizard-step-header {
                        padding: 0.875rem 1.25rem;
                        font-size: 0.9rem;
                    }
                    .input-field-premium {
                        font-size: 0.875rem; 
                        padding: 0.75rem 0.875rem;
                    }
                    .wizard-header h1 {
                        font-size: 1.25rem;
                    }
                    .wizard-header p {
                        font-size: 0.75rem;
                    }
                }

                .step-dot:hover:not(.active):not(.completed) {
                    background: rgba(255,255,255,0.3);
                    transform: scale(1.1);
                }
                .step-dot.active {
                    background: white;
                    color: var(--primary);
                    transform: scale(1.2);
                    box-shadow: 0 0 20px rgba(255,255,255,0.6);
                    border: 3px solid rgba(255,255,255,0.8) !important;
                    animation: pulse-active 2s infinite;
                }
                @keyframes pulse-active {
                    0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(255,255,255,0); }
                    100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
                }
                .step-dot.completed {
                    background: #22c55e;
                    color: white;
                    border: 2px solid transparent;
                }
                .field-column {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .field-label {
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .input-field-premium {
                    width: 100%;
                    padding: 0.875rem 1rem;
                    background: #f1f5f9;
                    border: 2px solid transparent;
                    border-radius: var(--radius-md);
                    color: var(--text-main);
                    font-size: 0.95rem;
                    font-weight: 500;
                    outline: none;
                    transition: all 0.2s ease;
                }
                .input-field-premium:focus {
                    background: white;
                    border-color: var(--primary);
                    box-shadow: 0 10px 20px -10px var(--primary-glow);
                }
                .input-field-premium.important {
                    border-bottom: 2px solid var(--warning);
                }
                .photo-upload-box {
                    width: 120px;
                    height: 150px;
                    margin: 0 auto 1rem;
                    background: #f1f5f9;
                    border: 2px dashed var(--border);
                    border-radius: var(--radius-lg);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    color: #94a3b8;
                    font-size: 0.7rem;
                    font-weight: 800;
                }
                .segmented-control-wrapper {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .segmented-control {
                    display: flex;
                    background: #f1f5f9;
                    padding: 0.25rem;
                    border-radius: var(--radius-md);
                    gap: 0.25rem;
                }
                .segment-btn {
                    flex: 1;
                    padding: 0.625rem;
                    border: none;
                    background: transparent;
                    border-radius: var(--radius-sm);
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .segment-btn:hover {
                    color: var(--text-main);
                }
                .segment-btn.active {
                    background: white;
                    color: var(--primary);
                    box-shadow: var(--shadow-sm);
                }
                .wizard-footer {
                    padding: 1.5rem 2.5rem;
                    background: #f8fafc;
                    display: flex;
                    justify-content: space-between;
                    border-top: 1px solid var(--border);
                }
                .btn-primary-modern {
                    background: var(--primary);
                    color: white;
                    padding: 0.75rem 2rem;
                    border-radius: var(--radius-md);
                    font-weight: 700;
                    border: none;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .btn-primary-modern:hover {
                    transform: translateX(4px);
                    box-shadow: 0 8px 20px var(--primary-glow);
                }
                .btn-success-modern {
                    background: #22c55e;
                    color: white;
                    padding: 0.75rem 2.5rem;
                    border-radius: var(--radius-md);
                    font-weight: 700;
                    border: none;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    cursor: pointer;
                    box-shadow: 0 4px 15px rgba(34, 197, 94, 0.3);
                }
                .btn-secondary {
                    background: transparent;
                    border: 2px solid var(--border);
                    color: var(--text-muted);
                    padding: 0.75rem 2rem;
                    border-radius: var(--radius-md);
                    font-weight: 700;
                    cursor: pointer;
                }
                .btn-secondary:disabled {
                    opacity: 0.3;
                    cursor: not-allowed;
                }
                .btn-small {
                    padding: 0.4rem 1rem;
                    font-size: 0.75rem;
                    font-weight: 700;
                    background: var(--text-muted);
                    color: white;
                    border: none;
                    border-radius: var(--radius-sm);
                    cursor: pointer;
                }
                select.input-field-premium {
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 0.75rem center;
                    padding-right: 2.5rem;
                    appearance: none;
                }
            `}</style>
        </div >
    );
};

export default StudentAdmission;



