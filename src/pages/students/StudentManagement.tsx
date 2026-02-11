import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSchool } from '../../context/SchoolContext';
import { useFirestore } from '../../hooks/useFirestore';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import { formatClassSectionShort } from '../../utils/formatters';
import { Search, Edit2, Trash2, UserPlus, FileText, Settings } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, writeBatch } from 'firebase/firestore';
import { getActiveClasses, SESSIONS } from '../../constants/app';

const StudentManagement: React.FC = () => {
    const navigate = useNavigate();
    const { currentSchool } = useSchool();
    const { schoolId } = useParams();
    const [printingStudent, setPrintingStudent] = useState<any | null>(null);
    const [isPrintingReport, setIsPrintingReport] = useState(false);
    const { data: students, loading, update: updateStudent, remove: removeStudent } = useFirestore<any>('students');

    const { data: allSettings } = useFirestore<any>('settings');
    const printSettings = allSettings?.find((s: any) => s.id === `print_form_${schoolId}`);

    const activeClasses = getActiveClasses(allSettings?.filter((d: any) => d.type === 'class') || []);
    const classesList = activeClasses.map((c: any) => c.name);

    const [selectedSession, setSelectedSession] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');

    const sectionsList = selectedClass ? (activeClasses.find((c: any) => c.name === selectedClass)?.sections || []) : [];
    const [selectedStatus, setSelectedStatus] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [entriesToShow, setEntriesToShow] = useState(10);

    const handlePrint = async (stu: any) => {
        // Fetch first receipt number
        let firstReceiptNo = '';
        try {
            const q = query(
                collection(db, 'fee_collections'),
                where('admissionNo', '==', stu.admissionNo || stu.id),
                where('schoolId', '==', schoolId)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const receipts = querySnapshot.docs.map(doc => doc.data());
                // Sort by date ascending to get the first one
                receipts.sort((a, b) => {
                    const dateA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date || 0).getTime();
                    const dateB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date || 0).getTime();
                    return dateA - dateB;
                });
                firstReceiptNo = receipts[0].receiptNo;
            }
        } catch (err) {
            console.error("Error fetching receipt:", err);
        }

        setPrintingStudent({ ...stu, firstReceiptNo });
        setTimeout(() => {
            window.print();
            setPrintingStudent(null);
        }, 150); // Increased timeout slightly to ensure receipt number is rendered
    };

    const handleToggleStatus = async (id: string) => {
        const student = students.find(s => s.id === id);
        if (student) {
            await updateStudent(id, {
                status: student.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
            });
        }
    };

    const handleAssignRoll = async () => {
        if (!selectedClass) {
            alert('Please select a class first');
            return;
        }

        const classStudents = students.filter(s =>
            s.class === selectedClass &&
            (selectedSession === '' || s.session === selectedSession) &&
            (selectedSection === '' || s.section === selectedSection)
        );

        if (classStudents.length === 0) {
            alert('No students found in the selected class/session');
            return;
        }

        const sorted = [...classStudents].sort((a, b) => (a.name || a.fullName).localeCompare(b.name || b.fullName));

        for (let i = 0; i < sorted.length; i++) {
            await updateStudent(sorted[i].id, { rollNo: (i + 1).toString() });
        }

        alert(`Roll numbers assigned to ${sorted.length} students in Class ${selectedClass}`);
    };

    const handleCleanData = async () => {
        const filteredCount = allFilteredStudents.length;
        if (filteredCount === 0) {
            alert('No students found to clean.');
            return;
        }

        const selectionText = selectedClass
            ? `Class ${selectedClass}${selectedSection ? ` Section ${selectedSection}` : ''}`
            : 'ALL currently filtered students';

        const message = `Are you sure you want to delete ${filteredCount} students from ${selectionText}? \n\nThis will PERMANENTLY remove them from the system. You cannot undo this.`;
        if (!window.confirm(message)) return;

        const doubleConfirm = window.confirm("FINAL WARNING: This action will destroy these student records forever. Click OK to proceed with deletion.");
        if (!doubleConfirm) return;

        try {
            const idsToDelete = allFilteredStudents.map(s => s.id);

            // Firebase batch limit is 500 operations
            for (let i = 0; i < idsToDelete.length; i += 500) {
                const chunk = idsToDelete.slice(i, i + 500);
                const batch = writeBatch(db);
                chunk.forEach(id => {
                    batch.delete(doc(db, 'students', id));
                });
                await batch.commit();
            }

            alert(`Successfully cleaned ${filteredCount} student records.`);
        } catch (error) {
            console.error('Error cleaning data:', error);
            alert('An error occurred during cleanup: ' + (error as Error).message);
        }
    };

    const handleGeneratePins = async () => {
        const studentsWithoutPin = allFilteredStudents.filter(s => !s.pin);
        if (studentsWithoutPin.length === 0) {
            alert('All currently filtered students already have a PIN.');
            return;
        }

        const confirmMsg = `Are you sure you want to generate unique PINs for ${studentsWithoutPin.length} students who don't have one? Existing PINs will not be changed.`;
        if (!window.confirm(confirmMsg)) return;

        try {
            const generateUniquePin = () => Math.floor(1000 + Math.random() * 9000).toString();

            // Use batch for efficiency
            for (let i = 0; i < studentsWithoutPin.length; i += 500) {
                const chunk = studentsWithoutPin.slice(i, i + 500);
                const batch = writeBatch(db);
                chunk.forEach(student => {
                    batch.update(doc(db, 'students', student.id), { pin: generateUniquePin() });
                });
                await batch.commit();
            }

            alert(`Successfully generated PINs for ${studentsWithoutPin.length} students.`);
        } catch (error) {
            console.error('Error generating PINs:', error);
            alert('An error occurred while generating PINs: ' + (error as Error).message);
        }
    };

    const allFilteredStudents = students.filter(s => {
        // Robust filtering: match if filter is empty OR property includes selection (to handle "Class VI" vs "VI")
        const matchesSession = !selectedSession || (s.session && s.session.includes(selectedSession)) || !s.session;
        const matchesClass = !selectedClass || (s.class && new RegExp(`\\b${selectedClass}$`).test(s.class));
        const matchesSection = !selectedSection || (s.section && s.section.toUpperCase() === selectedSection.toUpperCase()) || !s.section;
        const matchesStatus = selectedStatus === 'ALL' || (s.status && s.status.toUpperCase() === selectedStatus.toUpperCase());

        const q = searchQuery.toLowerCase();
        const matchesSearch = !q ||
            (s.name && s.name.toLowerCase().includes(q)) ||
            (s.fullName && s.fullName.toLowerCase().includes(q)) ||
            (s.admissionNo && String(s.admissionNo).toLowerCase().includes(q)) ||
            (s.fatherName && s.fatherName.toLowerCase().includes(q)) ||
            (s.motherName && s.motherName.toLowerCase().includes(q)) ||
            (s.guardianName && s.guardianName.toLowerCase().includes(q)) ||
            (s.mobileNo && String(s.mobileNo).toLowerCase().includes(q)) ||
            (s.phone && String(s.phone).toLowerCase().includes(q)) ||
            (s.fatherContactNo && String(s.fatherContactNo).toLowerCase().includes(q)) ||
            (s.motherContactNo && String(s.motherContactNo).toLowerCase().includes(q)) ||
            (s.guardianMobile && String(s.guardianMobile).toLowerCase().includes(q)) ||
            (s.aadharNo && String(s.aadharNo).toLowerCase().includes(q)) ||
            (s.studentAadharNo && String(s.studentAadharNo).toLowerCase().includes(q)) ||
            (s.appaarNo && String(s.appaarNo).toLowerCase().includes(q)) ||
            (s.studentPenNo && String(s.studentPenNo).toLowerCase().includes(q)) ||
            (s.permanentAddress && s.permanentAddress.toLowerCase().includes(q)) ||
            (s.presentAddress && s.presentAddress.toLowerCase().includes(q)) ||
            (s.fatherAddress && s.fatherAddress.toLowerCase().includes(q)) ||
            (s.motherAddress && s.motherAddress.toLowerCase().includes(q)) ||
            (s.guardianAddress && s.guardianAddress.toLowerCase().includes(q)) ||
            (s.previousSchool && s.previousSchool.toLowerCase().includes(q)) ||
            (s.diseaseAllergy && s.diseaseAllergy.toLowerCase().includes(q)) ||
            (s.class && s.class.toLowerCase().includes(q));

        return matchesSession && matchesClass && matchesSection && matchesStatus && matchesSearch;
    }).sort((a, b) => {
        // Sort by Roll No if available, else by name
        const rollA = parseInt(a.rollNo);
        const rollB = parseInt(b.rollNo);

        if (!isNaN(rollA) && !isNaN(rollB)) return rollA - rollB;
        if (!isNaN(rollA)) return -1;
        if (!isNaN(rollB)) return 1;

        const nameA = (a.name || a.fullName || '').toLowerCase();
        const nameB = (b.name || b.fullName || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });

    const filteredStudents = allFilteredStudents.slice(0, entriesToShow);

    const handlePrintReport = () => {
        setIsPrintingReport(true);
        setTimeout(() => {
            window.print();
            setIsPrintingReport(false);
        }, 300);
    };

    const handleExportCSV = () => {
        if (allFilteredStudents.length === 0) return;

        const headers = ["Roll No", "Admission No", "Name", "Father's Name", "Father's Number", "Mother's Name", "Mother's Number", "Class", "Section", "Status"];
        const rows = allFilteredStudents.map(s => [
            s.rollNo || s.classRollNo || '-',
            s.admissionNo || s.id,
            s.name || s.fullName,
            s.fatherName || '-',
            s.fatherContactNo || s.fatherMobile || s.mobileNo || s.phone || '-',
            s.motherName || '-',
            s.motherContactNo || s.motherMobile || '-',
            s.class,
            s.section || '-',
            s.status || 'ACTIVE'
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.map(val => `"${val}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Student_Report_${selectedClass || 'All'}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="animate-fade-in no-scrollbar student-management-page">
            {/* Print Template (Visible ONLY during system print) */}
            {printingStudent && (
                <div className="print-only-container printable-form">
                    <div className="admission-form-print">
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', minHeight: '100px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
                            {printSettings?.showSchoolLogo && (currentSchool?.logoUrl || currentSchool?.logo) && (
                                <div style={{ width: '80px', height: '80px', marginRight: '20px', flexShrink: 0 }}>
                                    <img src={currentSchool.logoUrl || currentSchool.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                </div>
                            )}

                            <div style={{ flex: 1 }}>
                                {(printSettings?.headerType === 'image' || printSettings?.headerType === 'both') && printSettings?.headerImage && (
                                    <div className="form-letterhead-header">
                                        <img src={printSettings.headerImage} alt="Header" style={{ width: '100%', maxHeight: '120px', objectFit: 'contain' }} />
                                    </div>
                                )}

                                {(printSettings?.headerType === 'text' || printSettings?.headerType === 'both') && (
                                    <div style={{ textAlign: 'center' }}>
                                        {printSettings?.headerText1 && React.createElement(printSettings.headerTag1 || 'h1', { style: { margin: 0, fontSize: (printSettings.headerTag1 === 'h1' ? '28px' : printSettings.headerTag1 === 'h2' ? '22px' : printSettings.headerTag1 === 'h3' ? '18px' : '14px'), fontWeight: 900, textTransform: 'uppercase' } }, printSettings.headerText1)}
                                        {printSettings?.headerText2 && React.createElement(printSettings.headerTag2 || 'h2', { style: { margin: '5px 0 0 0', fontSize: (printSettings.headerTag2 === 'h1' ? '28px' : printSettings.headerTag2 === 'h2' ? '22px' : printSettings.headerTag2 === 'h3' ? '18px' : '14px'), fontWeight: 700 } }, printSettings.headerText2)}
                                        {printSettings?.headerText3 && React.createElement(printSettings.headerTag3 || 'h3', { style: { margin: '3px 0 0 0', fontSize: (printSettings.headerTag3 === 'h1' ? '28px' : printSettings.headerTag3 === 'h2' ? '22px' : printSettings.headerTag3 === 'h3' ? '18px' : '14px'), fontWeight: 600 } }, printSettings.headerText3)}
                                        {!printSettings?.headerText1 && !printSettings?.headerText2 && !printSettings?.headerText3 && !printSettings?.headerImage && (
                                            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Registration Cum Admission Form</h1>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Symmetric spacer for perfect centering when logo is present */}
                            {printSettings?.showSchoolLogo && (currentSchool?.logoUrl || currentSchool?.logo) && (
                                <div style={{ width: '80px', marginLeft: '20px' }}></div>
                            )}
                        </div>

                        <div className="form-section">
                            <div className="section-title">Student Information</div>
                            <div style={{ display: 'flex' }}>
                                <div className="info-grid" style={{ flex: 1 }}>
                                    <div className="info-item"><strong>Student Name:</strong> {printingStudent.name}</div>
                                    <div className="info-item"><strong>Class:</strong> {printingStudent.class}</div>
                                    {printSettings?.showSection !== false && printingStudent.section && <div className="info-item"><strong>Section:</strong> {printingStudent.section}</div>}
                                    {printSettings?.showRollNo !== false && (printingStudent.rollNo || printingStudent.classRollNo) && <div className="info-item"><strong>Roll No.:</strong> {printingStudent.rollNo || printingStudent.classRollNo}</div>}
                                    <div className="info-item"><strong>Admission No.:</strong> {printingStudent.admissionNo || printingStudent.id}</div>
                                    {printSettings?.showAadhar && (printingStudent.aadharNo || printingStudent.studentAadharNo) && <div className="info-item"><strong>Aadhar No.:</strong> {printingStudent.aadharNo || printingStudent.studentAadharNo}</div>}
                                    {printSettings?.showDOB !== false && <div className="info-item"><strong>Date of Birth:</strong> {formatDate(printingStudent.dob)}</div>}
                                    {printSettings?.showGender !== false && printingStudent.gender && <div className="info-item"><strong>Gender:</strong> {printingStudent.gender}</div>}
                                    {printSettings?.showBloodGroup && printingStudent.bloodGroup && <div className="info-item"><strong>Blood Group:</strong> {printingStudent.bloodGroup}</div>}
                                    {printSettings?.showCaste && printingStudent.caste && <div className="info-item"><strong>Caste:</strong> {printingStudent.caste}</div>}
                                    {printSettings?.showCategory && printingStudent.studentCategory && <div className="info-item"><strong>Category:</strong> {printingStudent.studentCategory}</div>}
                                    {printSettings?.showAdmissionDate && printingStudent.admissionDate && <div className="info-item"><strong>Adm. Date:</strong> {formatDate(printingStudent.admissionDate)}</div>}
                                    {printSettings?.showSession && printingStudent.session && <div className="info-item"><strong>Session:</strong> {printingStudent.session}</div>}
                                    {printSettings?.showMedical && printingStudent.diseaseAllergy && <div className="info-item"><strong>Medical Info:</strong> {printingStudent.diseaseAllergy}</div>}
                                    {printSettings?.showApaarNo && printingStudent.appaarNo && <div className="info-item"><strong>Apar ID:</strong> {printingStudent.appaarNo}</div>}
                                    {printSettings?.showPenNo && printingStudent.studentPenNo && <div className="info-item"><strong>PEN Number:</strong> {printingStudent.studentPenNo}</div>}
                                </div>
                                {printSettings?.showPhoto !== false && (
                                    <div className="student-photo-container">
                                        {printingStudent.photo ? (
                                            <img src={printingStudent.photo} alt="Student" />
                                        ) : (
                                            <div className="photo-placeholder">PHOTO</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-section">
                            <div className="section-title">Family Information</div>
                            <div style={{ display: 'flex', borderTop: '1px solid #000', borderLeft: '1px solid #000' }}>
                                {/* Father Side */}
                                <div style={{ flex: 1, borderRight: '1px solid #000' }}>
                                    <div className="info-item" style={{ borderRight: 'none', background: '#f8f9fa', fontWeight: 700, textAlign: 'center' }}>FATHER DETAILS</div>
                                    <div className="info-item" style={{ borderRight: 'none' }}><strong>Name:</strong> {printingStudent.fatherName}</div>
                                    {(printingStudent.fatherMobile || printingStudent.fatherContactNo) && <div className="info-item" style={{ borderRight: 'none' }}><strong>Mobile:</strong> {printingStudent.fatherMobile || printingStudent.fatherContactNo}</div>}
                                    {printSettings?.showFatherOcc && printingStudent.fatherOccupation && <div className="info-item" style={{ borderRight: 'none' }}><strong>Occupation:</strong> {printingStudent.fatherOccupation}</div>}
                                    {printSettings?.showFatherAadhar && printingStudent.fatherAadharNo && <div className="info-item" style={{ borderRight: 'none' }}><strong>Aadhar No.:</strong> {printingStudent.fatherAadharNo}</div>}
                                    {printSettings?.showFatherAddress && printingStudent.fatherAddress && <div className="info-item" style={{ borderRight: 'none' }}><strong>Address:</strong> {printingStudent.fatherAddress}</div>}
                                </div>
                                {/* Mother Side */}
                                <div style={{ flex: 1 }}>
                                    <div className="info-item" style={{ borderRight: 'none', background: '#f8f9fa', fontWeight: 700, textAlign: 'center' }}>MOTHER DETAILS</div>
                                    {printingStudent.motherName && <div className="info-item" style={{ borderRight: 'none' }}><strong>Name:</strong> {printingStudent.motherName}</div>}
                                    {(printingStudent.motherMobile || printingStudent.motherContactNo) && <div className="info-item" style={{ borderRight: 'none' }}><strong>Mobile:</strong> {printingStudent.motherMobile || printingStudent.motherContactNo}</div>}
                                    {printSettings?.showMotherOcc && printingStudent.motherOccupation && <div className="info-item" style={{ borderRight: 'none' }}><strong>Occupation:</strong> {printingStudent.motherOccupation}</div>}
                                    {printSettings?.showMotherAadhar && printingStudent.motherAadharNo && <div className="info-item" style={{ borderRight: 'none' }}><strong>Aadhar No.:</strong> {printingStudent.motherAadharNo}</div>}
                                    {printSettings?.showMotherAddress && printingStudent.motherAddress && <div className="info-item" style={{ borderRight: 'none' }}><strong>Address:</strong> {printingStudent.motherAddress}</div>}
                                </div>
                            </div>
                        </div>

                        {printSettings?.showGuardian && (
                            <div className="form-section">
                                <div className="section-title">Guardian Information</div>
                                <div className="info-grid">
                                    {printingStudent.guardianName && <div className="info-item"><strong>Guardian's Name:</strong> {printingStudent.guardianName}</div>}
                                    {printingStudent.guardianMobile && <div className="info-item"><strong>Guardian's Mobile:</strong> {printingStudent.guardianMobile}</div>}
                                    {printingStudent.guardianAddress && <div className="info-item" style={{ gridColumn: '1 / -1' }}><strong>Guardian's Address:</strong> {printingStudent.guardianAddress}</div>}
                                </div>
                            </div>
                        )}

                        <div className="declaration-section">
                            <h3>Declaration</h3>
                            <p style={{ whiteSpace: 'pre-wrap' }}>{printSettings?.declarationText || `I, ${printingStudent.name}, hereby declare that the information provided above is true and correct to the best of my knowledge and belief. I also understand that any discrepancy found in the provided details may lead to cancellation of my admission.`}</p>
                            {!printSettings?.declarationText && <p>I agree to abide by the rules and regulations of the institution and understand that any violation of these rules may result in disciplinary actions as deemed necessary by the school authorities.</p>}
                        </div>

                        <div className="signature-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '40px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700 }}>
                                Date: ...........................................
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ borderTop: '1.5px solid #000', width: '250px', paddingTop: '5px', fontSize: '12px', fontWeight: 700 }}>
                                    Signature of Parents/Guardian
                                </div>
                            </div>
                        </div>

                        {printSettings?.footerImage && (
                            <div className="form-letterhead-footer" style={{ marginTop: '20px' }}>
                                <img src={printSettings.footerImage} alt="School Footer" style={{ width: '100%', maxHeight: '80px', objectFit: 'contain' }} />
                            </div>
                        )}

                        {printSettings?.showOfficeFooter && (
                            <div className="office-footer-section" style={{ marginTop: '30px', padding: '20px', border: '2px solid #000', borderRadius: '8px', background: '#f9f9f9' }}>
                                <div style={{ fontWeight: 800, fontSize: '14px', textAlign: 'center', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    FOR OFFICE USE ONLY
                                </div>
                                <div style={{ fontSize: '12px', lineHeight: '1.5', fontWeight: 600 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span><strong>Reg No.:</strong> {(printingStudent.registrationNo || '').replace(/^Reg-/, '') || '___________________'}</span>
                                        <span style={{ textAlign: 'right' }}>Date: {new Date().toLocaleDateString('en-GB')}</span>
                                    </div>
                                    <div style={{ marginBottom: '4px' }}>
                                        <strong>Full name of student:</strong> {printingStudent.name || printingStudent.fullName}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span><strong>Date of Admission:</strong> {printingStudent.admissionDate ? formatDate(printingStudent.admissionDate) : '_______________'}</span>
                                        <span><strong>Receipt No.:</strong> {printingStudent.firstReceiptNo || '_______________'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span><strong>Admission No.:</strong> {printingStudent.admissionNo || printingStudent.id}</span>
                                        <span><strong>Admission granted in Class:</strong> {printingStudent.class}</span>
                                    </div>
                                    <div style={{ marginTop: '40px', textAlign: 'right' }}>
                                        <div style={{ borderTop: '1.5px solid #000', display: 'inline-block', width: '200px', paddingTop: '4px', textAlign: 'center' }}>
                                            Signature of Principal
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isPrintingReport && (
                <div className="printable-report">
                    <div style={{ padding: '20px', background: 'white', minHeight: '297mm' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', borderBottom: '2px solid #333', paddingBottom: '15px' }}>
                            {currentSchool?.logoUrl && <img src={currentSchool.logoUrl} alt="Logo" style={{ width: '60px', height: '60px', objectFit: 'contain', marginRight: '15px' }} />}
                            <div style={{ textAlign: 'center' }}>
                                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, textTransform: 'uppercase' }}>{currentSchool?.fullName || currentSchool?.name || 'School Report'}</h1>
                                <p style={{ margin: '5px 0 0', fontSize: '14px', fontWeight: 600 }}>STUDENT DATABASE REPORT - {selectedClass ? `CLASS ${selectedClass}` : 'ALL CLASSES'}</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '12px', fontWeight: 700 }}>
                            <span>Total Students: {allFilteredStudents.length}</span>
                            <span>Date: {new Date().toLocaleDateString('en-GB')}</span>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                            <thead>
                                <tr style={{ background: '#f0f0f0' }}>
                                    <th style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>Roll</th>
                                    <th style={{ border: '1px solid #333', padding: '8px', textAlign: 'left' }}>Adm No</th>
                                    <th style={{ border: '1px solid #333', padding: '8px', textAlign: 'left' }}>Student Name</th>
                                    <th style={{ border: '1px solid #333', padding: '8px', textAlign: 'left' }}>Father's Name</th>
                                    <th style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>Class/Sec</th>
                                    <th style={{ border: '1px solid #333', padding: '8px', textAlign: 'left' }}>Contact No</th>
                                    <th style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allFilteredStudents.map((s, idx) => (
                                    <tr key={idx}>
                                        <td style={{ border: '1px solid #333', padding: '6px', textAlign: 'center' }}>{s.rollNo || s.classRollNo || '-'}</td>
                                        <td style={{ border: '1px solid #333', padding: '6px' }}>{s.admissionNo || s.id}</td>
                                        <td style={{ border: '1px solid #333', padding: '6px', fontWeight: 700 }}>{(s.name || s.fullName || '').toUpperCase()}</td>
                                        <td style={{ border: '1px solid #333', padding: '6px' }}>{(s.fatherName || '-').toUpperCase()}</td>
                                        <td style={{ border: '1px solid #333', padding: '6px', textAlign: 'center' }}>{s.class}{s.section ? ` - ${s.section}` : ''}</td>
                                        <td style={{ border: '1px solid #333', padding: '6px' }}>{s.fatherContactNo || s.mobileNo || s.phone || '-'}</td>
                                        <td style={{ border: '1px solid #333', padding: '6px', textAlign: 'center' }}>{s.status || 'ACTIVE'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '10px', color: '#666' }}>
                            * This is a computer generated report from {currentSchool?.name || 'aischool360'}
                        </div>
                    </div>
                </div>
            )}

            {/* Main UI (Hidden during system print) */}
            <div className="no-print">
                <div className="student-management-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 300px' }}>
                        <h1 className="main-title" style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.025em' }}>Student Database</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1.0625rem' }}>Comprehensive records management system.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            className="btn hover-lift"
                            onClick={() => navigate(`/${schoolId}/settings/print-design`)}
                            style={{ border: '1px solid var(--border)', background: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem' }}
                        >
                            <Settings size={18} /> <span className="mobile-hide">Design Form</span>
                        </button>
                        <div className="btn-group" style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                                className="btn hover-lift"
                                onClick={handlePrintReport}
                                style={{ border: '1px solid var(--border)', background: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md) 0 0 var(--radius-md)' }}
                            >
                                <FileText size={18} /> <span className="mobile-hide">Export Report</span>
                            </button>
                            <button
                                className="btn hover-lift"
                                onClick={handleExportCSV}
                                title="Download CSV"
                                style={{ border: '1px solid var(--border)', borderLeft: 'none', background: 'white', display: 'flex', alignItems: 'center', padding: '0.75rem 0.5rem', borderRadius: '0 var(--radius-md) var(--radius-md) 0' }}
                            >
                                <Settings size={16} />
                            </button>
                        </div>
                        <button className="btn btn-primary hover-lift hover-glow" onClick={() => navigate(`/${schoolId}/students/admission`)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem' }}>
                            <UserPlus size={20} /> New Admission
                        </button>
                    </div>
                </div>

                <div className="glass-card animate-slide-up" style={{ padding: '0' }}>
                    <div className="filters-bar" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: '#f8f9fa' }}>
                        <div className="filter-group" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
                            <button className="btn-success-small hover-lift" onClick={handleAssignRoll} style={{ background: '#22c55e', padding: '0.625rem 1.25rem', height: '40px' }}>ASSIGN NEW ROLL</button>
                            <button
                                className="btn hover-lift"
                                onClick={handleGeneratePins}
                                style={{ background: '#3b82f6', color: 'white', padding: '0.625rem 1.25rem', height: '40px', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                                <Settings size={14} /> GENERATE PIN
                            </button>
                            <button
                                className="btn hover-lift"
                                onClick={handleCleanData}
                                style={{ background: '#ef4444', color: 'white', padding: '0.625rem 1.25rem', height: '40px', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                                <Trash2 size={14} /> CLEAN DATA
                            </button>
                            <select
                                className="input-field"
                                style={{ padding: '0.5rem', width: 'auto', background: 'white' }}
                                value={selectedSession}
                                onChange={(e) => setSelectedSession(e.target.value)}
                            >
                                <option value="">All Session</option>
                                {SESSIONS.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                            <select
                                className="input-field"
                                style={{ padding: '0.5rem', width: 'auto', background: 'white' }}
                                value={selectedClass}
                                onChange={(e) => {
                                    setSelectedClass(e.target.value);
                                    setSelectedSection('');
                                }}
                            >
                                <option value="">Select Class</option>
                                {classesList.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            <select
                                className="input-field"
                                style={{ padding: '0.5rem', width: 'auto', background: 'white' }}
                                value={selectedSection}
                                onChange={(e) => setSelectedSection(e.target.value)}
                                disabled={!selectedClass}
                            >
                                <option value="">Select Section</option>
                                {sectionsList.map((s: string) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                            <select
                                className="input-field"
                                style={{ padding: '0.5rem', width: 'auto', background: 'white' }}
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                            >
                                <option value="ALL">All Status</option>
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '14px' }}>
                            <span>Show</span>
                            <select
                                className="input-field"
                                style={{ width: 'auto', padding: '0.25rem 0.5rem' }}
                                value={entriesToShow}
                                onChange={(e) => setEntriesToShow(Number(e.target.value))}
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <span>entries</span>
                        </div>
                        <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
                            <Search size={16} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search by name, parent, mobile, admit no..."
                                className="input-field"
                                style={{ paddingRight: '2.5rem', background: 'white', borderRadius: '4px' }}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        {loading ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading students...</div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                        <th style={{ padding: '1.25rem 1rem' }}>Roll No</th>
                                        <th style={{ padding: '1.25rem 1rem' }}>Student Details</th>
                                        <th style={{ padding: '1.25rem 1rem' }}>Parent Info</th>
                                        <th style={{ padding: '1.25rem 1rem' }}>Contact</th>
                                        <th style={{ padding: '1.25rem 1rem' }}>PIN</th>
                                        <th style={{ padding: '1.25rem 1rem' }}>Status</th>
                                        <th style={{ padding: '1.25rem 1rem' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.map((stu) => (
                                        <tr key={stu.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s ease' }} className="hover-row">
                                            <td style={{ padding: '1.25rem 1rem' }}>
                                                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>#{stu.rollNo || stu.classRollNo || '-'}</span>
                                            </td>
                                            <td style={{ padding: '1.25rem 1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '0.875rem' }}>
                                                        {(stu.name || stu.fullName || 'S')[0]}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700 }}>{stu.name || stu.fullName}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatClassSectionShort(stu.class, stu.section, currentSchool?.useRomanNumerals)}</div>
                                                        {(stu.admissionTimestamp || stu.createdAt) && (
                                                            <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 600, marginTop: '2px' }}>
                                                                📅 {formatDateTime(stu.admissionTimestamp || stu.createdAt)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1rem' }}>
                                                <div style={{ fontWeight: 500 }}>{stu.parentName || stu.fatherName}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {stu.admissionNo || stu.id}</div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1rem', fontSize: '0.875rem' }}>
                                                <div>{stu.fatherContactNo || stu.fatherMobile || stu.mobileNo || stu.phone || '-'}</div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1rem' }}>
                                                <div
                                                    style={{
                                                        fontWeight: 700,
                                                        color: 'var(--primary)',
                                                        fontSize: '1rem',
                                                        letterSpacing: '0.1em',
                                                        fontFamily: 'monospace',
                                                        background: 'rgba(99, 102, 241, 0.1)',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '0.25rem',
                                                        display: 'inline-block',
                                                        cursor: 'pointer'
                                                    }}
                                                    title="Click to copy PIN"
                                                    onClick={() => {
                                                        if (stu.pin) {
                                                            navigator.clipboard.writeText(stu.pin);
                                                            alert('PIN copied to clipboard!');
                                                        }
                                                    }}
                                                >
                                                    {stu.pin || '----'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1rem' }}>
                                                <button
                                                    onClick={() => handleToggleStatus(stu.id)}
                                                    className={`status-badge ${stu.status === 'ACTIVE' ? 'active' : 'inactive'}`}
                                                    style={{ border: 'none', cursor: 'pointer' }}
                                                >
                                                    {stu.status}
                                                </button>
                                            </td>
                                            <td style={{ padding: '1.25rem 1rem' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        className="btn-icon"
                                                        onClick={() => navigate(`/${schoolId}/students/admission`, { state: { editMode: true, student: stu } })}
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button className="btn-icon" onClick={() => handlePrint(stu)} title="Print ID Card"><FileText size={16} /></button>
                                                    <button
                                                        className="btn-icon"
                                                        style={{ color: '#ef4444' }}
                                                        onClick={() => {
                                                            if (confirm('Are you sure you want to delete this student?')) removeStudent(stu.id);
                                                        }}
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                <style>{`
                .student-table th, .student-table td { border: 1px solid #edf2f7; }
                .hover-row:hover { background: #f8fafc; }
                
                .btn-success-small {
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 5px 12px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 700;
                    cursor: pointer;
                }
                .btn-show-red {
                    background: #ff4d4d;
                    color: white;
                    border: none;
                    padding: 8px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 600;
                }
                
                .status-badge {
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 800;
                }
                .status-badge.active { background: #c6f6d5; color: #22543d; }
                .status-badge.inactive { background: #fed7d7; color: #822727; }
                
                .action-btn {
                    width: 28px;
                    height: 28px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    border: none;
                    cursor: pointer;
                }
                .action-btn.view { background: #28a745; }
                .action-btn.print { background: #343a40; }
                .action-btn.edit { background: #007bff; }
                .action-btn.delete { background: #dc3545; }

                /* PRINT LOGIC */
                .print-only-container { display: none; }
                @media print {
                    body * { visibility: hidden; pointer-events: none; }
                    .print-only-container { display: block !important; }
                    .printable-form, .printable-form *, .printable-report, .printable-report * { visibility: visible; }
                    .printable-form { position: absolute; left: 0; top: 0; width: 100%; }
                    .printable-report { position: absolute; left: 0; top: 0; width: 100%; }
                    .no-print { display: none !important; }
                    @page { size: A4; margin: 1cm; }
                }

                .admission-form-print {
                    padding: 10px 15px;
                    border: 1px solid #eee;
                    font-family: 'Inter', sans-serif;
                    background: white;
                }
                .form-letterhead-header { margin-bottom: 12px; border-bottom: 2px solid #333; padding-bottom: 8px; }
                .form-letterhead-footer { margin-top: 15px; border-top: 1px solid #eee; padding-top: 8px; }
                .form-section { border: 1px solid #000; margin-bottom: 12px; }
                .section-title {
                    background: #F1F5F9;
                    padding: 5px 10px;
                    font-weight: 800;
                    border-bottom: 1px solid #000;
                    text-transform: uppercase;
                    font-size: 11px;
                }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; }
                .info-grid.full-width { grid-template-columns: 1fr; }
                .info-item {
                    padding: 4px 10px;
                    border-bottom: 0.5px solid #ccc;
                    border-right: 0.5px solid #ccc;
                    font-size: 12px;
                }
                .info-item strong { margin-right: 6px; color: #333; }
                
                .student-photo-container {
                    width: 100px;
                    height: 120px;
                    border-left: 1px solid #000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    background: #fdfdfd;
                }
                .student-photo-container img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .photo-placeholder {
                    color: #ccc;
                    font-size: 10px;
                    font-weight: 800;
                    text-align: center;
                }
                
                .declaration-section { margin-top: 15px; font-size: 12px; line-height: 1.4; }
                .signature-section {
                    margin-top: 30px;
                    display: flex;
                    justify-content: space-between;
                }
                .sig-box {
                    border-top: 1.5px solid #000;
                    width: 160px;
                    text-align: center;
                    padding-top: 5px;
                    font-size: 11px;
                    font-weight: 700;
                }

                @media (max-width: 768px) {
                    .mobile-hide { display: none; }
                    .main-title { font-size: 1.5rem !important; }
                    .student-management-header { flex-direction: column; align-items: flex-start !important; }
                    .filters-bar { padding: 1rem !important; }
                    .filter-group { flex-direction: column; width: 100%; }
                    .filter-group select { width: 100% !important; }
                    .btn-success-small { width: 100%; }
                }
            `}</style>
            </div>
        </div>
    );
};

export default StudentManagement;
