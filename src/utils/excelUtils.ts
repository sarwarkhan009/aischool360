import * as XLSX from 'xlsx';
import type {
    ValidationResult,
    StudentExcelRow,
    ParsedStudent,
    MarksExcelRow,
    ParsedMarks
} from './excelTypes';

// ===================================
// Excel Parsing Functions
// ===================================

export const parseExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                // First, get all data as array of arrays to find the header row
                const range = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

                // Find header row (the one containing 'ROLL' or 'Roll No.' and 'STUDENT NAME')
                let headerRowIndex = -1;
                for (let i = 0; i < range.length; i++) {
                    const row = range[i].map(cell => cell?.toString().trim().toUpperCase());
                    if (row.includes('ROLL') || row.includes('ROLL NO.') || (row.includes('STUDENT NAME') || row.includes('NAME'))) {
                        headerRowIndex = i;
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    // Fallback to traditional way if headers not found
                    // Use raw:true so numbers stay as numbers (not as formatted strings)
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: '' });
                    resolve(jsonData);
                    return;
                }

                // Parse using detected header row with raw:true so numeric cells stay numeric
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                    raw: true,
                    defval: '',
                    range: headerRowIndex
                });

                resolve(jsonData);
            } catch (error) {
                reject(new Error('Failed to parse Excel file: ' + (error as Error).message));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsBinaryString(file);
    });
};


// ===================================
// Student Data Processing
// ===================================

const isValidPhone = (phone?: string): boolean => {
    if (!phone) return true;
    const cleaned = phone.toString().replace(/\D/g, '');
    return cleaned.length === 10;
};

const isValidAadhar = (aadhar?: string): boolean => {
    if (!aadhar) return true;
    const cleaned = aadhar.toString().replace(/\D/g, '');
    return cleaned.length === 12;
};

// Helper to parse class column value like '1 (A)', '9 (A)', 'LKG', 'UKG (B)', 'Class 5 (A)'
export const parseClassSection = (classStr: string): { className: string; section: string } => {
    if (!classStr) return { className: '', section: 'A' };
    const trimmed = classStr.toString().trim();

    // Match patterns like "1 (A)", "10 (B)", "Class 5 (A)", "LKG (A)", "Pre-Nursery (A)"
    const match = trimmed.match(/^(.+?)\s*\(\s*([A-Za-z])\s*\)$/);
    if (match) {
        let cls = match[1].trim();
        const sec = match[2].trim().toUpperCase();
        // Normalize: if it's just a number, prepend 'Class '
        if (/^\d+$/.test(cls)) {
            cls = `Class ${cls}`;
        }
        return { className: cls, section: sec };
    }

    // No section in parentheses — just class name
    let cls = trimmed;
    if (/^\d+$/.test(cls)) {
        cls = `Class ${cls}`;
    }
    return { className: cls, section: 'A' };
};

export const validateStudentData = (data: StudentExcelRow[], requireClass: boolean = false): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let validCount = 0;

    if (!data || data.length === 0) {
        errors.push('No data found in Excel file');
        return { isValid: false, errors, warnings, validCount: 0, totalCount: 0 };
    }

    const firstRow = data[0];
    const keys = Object.keys(firstRow);
    const getColKey = (name: string) => keys.find(k => k.toLowerCase().trim() === name.toLowerCase().trim()) || '';

    const rollCol = getColKey('Roll No.');
    const nameCol = getColKey('Student Name');
    const classCol = getColKey('Class');

    const requiredColumns = requireClass ? ['Roll No.', 'Student Name', 'Class'] : ['Roll No.', 'Student Name'];
    const missingColumns = requiredColumns.filter(col => !getColKey(col));

    if (missingColumns.length > 0) {
        errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
        return { isValid: false, errors, warnings, validCount: 0, totalCount: data.length };
    }

    // Track roll numbers: per class-section if requireClass, or globally if not
    const rollNumbersByClass = new Map<string, Set<string>>();
    const globalRollNumbers = new Set<string>();

    data.forEach((row, index) => {
        const rowNum = index + 2;
        let hasError = false;

        const nameVal = row[nameCol]?.toString().trim();
        const rollVal = row[rollCol]?.toString().trim();
        const classVal = classCol ? row[classCol]?.toString().trim() : '';

        if (!nameVal) {
            errors.push(`Row ${rowNum}: Student Name is required`);
            hasError = true;
        }

        if (!rollVal) {
            errors.push(`Row ${rowNum}: Roll No. is required`);
            hasError = true;
        }

        if (requireClass) {
            if (!classVal) {
                errors.push(`Row ${rowNum}: Class is required`);
                hasError = true;
            }

            // Check duplicate roll numbers within same class-section
            if (rollVal && classVal) {
                const rollNo = rollVal;
                const classKey = classVal.toUpperCase();
                if (!rollNumbersByClass.has(classKey)) {
                    rollNumbersByClass.set(classKey, new Set());
                }
                const classRolls = rollNumbersByClass.get(classKey)!;
                if (classRolls.has(rollNo)) {
                    errors.push(`Row ${rowNum}: Duplicate Roll No. ${rollNo} in class ${classVal}`);
                    hasError = true;
                }
                classRolls.add(rollNo);
            }
        } else {
            // Check global duplicate within the file
            if (rollVal) {
                if (globalRollNumbers.has(rollVal)) {
                    errors.push(`Row ${rowNum}: Duplicate Roll No.: ${rollVal}`);
                    hasError = true;
                }
                globalRollNumbers.add(rollVal);
            }
        }

        const fatherPhoneCol = getColKey('Father Phone');
        const motherPhoneCol = getColKey('Mother Phone');
        const mobileCol = getColKey('Mobile Number');
        const uidCol = getColKey('UID Number');

        if (fatherPhoneCol && row[fatherPhoneCol] && !isValidPhone(row[fatherPhoneCol].toString())) {
            warnings.push(`Row ${rowNum}: Invalid Father Phone number`);
        }
        if (motherPhoneCol && row[motherPhoneCol] && !isValidPhone(row[motherPhoneCol].toString())) {
            warnings.push(`Row ${rowNum}: Invalid Mother Phone number`);
        }
        if (mobileCol && row[mobileCol] && !isValidPhone(row[mobileCol].toString())) {
            warnings.push(`Row ${rowNum}: Invalid Mobile number`);
        }
        if (uidCol && row[uidCol] && !isValidAadhar(row[uidCol].toString())) {
            warnings.push(`Row ${rowNum}: Invalid UID Number (Aadhar)`);
        }

        if (!hasError) validCount++;
    });

    return { isValid: errors.length === 0, errors, warnings, validCount, totalCount: data.length };
};

// Helper to normalize date strings in dd-mm-yy or dd-mm-yyyy or dd/mm/yyyy format to YYYY-MM-DD
// Also handles Excel serial date numbers (e.g., 42488 = 2016-04-28)
const normalizeDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const trimmed = dateStr.trim();
    if (!trimmed) return '';

    // Handle Excel serial date numbers (pure number like 42488)
    if (/^\d{4,5}$/.test(trimmed)) {
        const serial = parseInt(trimmed);
        if (serial > 1000 && serial < 100000) {
            // Excel serial date: days since 1899-12-30
            const excelEpoch = new Date(1899, 11, 30);
            const date = new Date(excelEpoch.getTime() + serial * 86400000);
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
    }

    // Handle dd-mm-yy, dd-mm-yyyy, or yyyy-mm-dd
    if (trimmed.includes('-') || trimmed.includes('/')) {
        const parts = trimmed.split(/[-/]/);
        if (parts.length === 3) {
            // Check if it's already yyyy-mm-dd
            if (parts[0].length === 4) {
                const y = parts[0];
                const m = parts[1].padStart(2, '0');
                const d = parts[2].padStart(2, '0');
                return `${y}-${m}-${d}`;
            }

            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            let year = parts[2];
            // If 2-digit year, assume 2000s for <=50, 1900s for >50
            if (year.length === 2) {
                const yearNum = parseInt(year);
                year = yearNum <= 50 ? `20${year}` : `19${year}`;
            }
            if (year.length === 4) {
                return `${year}-${month}-${day}`;
            }
        }
    }
    return trimmed;
};

export const convertToStudents = (
    data: StudentExcelRow[],
    classIdOrSchoolId: string,
    section?: string,
    schoolId?: string
): ParsedStudent[] => {
    // Support both old (classId, section, schoolId) and new (just schoolId) signatures
    const isOldSignature = section !== undefined && schoolId !== undefined;
    const actualSchoolId = isOldSignature ? schoolId : classIdOrSchoolId;

    // Helper for case-insensitive column access
    const getVal = (row: any, name: string) => {
        const keys = Object.keys(row);
        const key = keys.find(k => k.toLowerCase().trim() === name.toLowerCase().trim());
        return key ? row[key] : undefined;
    };

    return data.filter(row => {
        // Skip rows where both student name and roll no are empty
        return getVal(row, 'Student Name')?.toString().trim() && getVal(row, 'Roll No.')?.toString().trim();
    }).map(row => {
        const rollNo = getVal(row, 'Roll No.')?.toString().trim() || '';
        const name = getVal(row, 'Student Name')?.toString().trim() || '';
        const fatherName = getVal(row, 'Father Name')?.toString().trim() || '';
        const motherName = getVal(row, 'Mother Name')?.toString().trim() || '';
        const address = getVal(row, 'Address')?.toString().trim() || '';
        const mobile = getVal(row, 'Mobile Number')?.toString().replace(/\D/g, '') || '';
        const fatherPhone = getVal(row, 'Father Phone')?.toString().replace(/\D/g, '') || '';
        const motherPhone = getVal(row, 'Mother Phone')?.toString().replace(/\D/g, '') || '';
        const aadhar = getVal(row, 'UID Number')?.toString().replace(/\D/g, '') || '';
        const grNo = getVal(row, 'GR. No')?.toString().trim();

        // Parse Class column for class + section (e.g., '1 (A)', '9 (A)', 'LKG', 'UKG (B)')
        const classVal = getVal(row, 'Class');
        const parsed = parseClassSection(classVal?.toString() || '');
        const finalClass = isOldSignature ? classIdOrSchoolId : parsed.className;
        const finalSection = isOldSignature ? (section as string) : parsed.section;

        // Normalize Gender
        let gender = (getVal(row, 'Gender')?.toString().trim() || 'Male').toLowerCase();
        if (gender.startsWith('m')) gender = 'Male';
        else if (gender.startsWith('f')) gender = 'Female';
        else gender = 'Other';

        // Normalize Dates (expecting dd-mm-yy or dd-mm-yyyy format)
        const dob = normalizeDate(getVal(row, 'Date of Birth')?.toString() || '');
        const admissionDate = normalizeDate(getVal(row, 'Date of Admission')?.toString() || '') || new Date().toISOString().split('T')[0];

        return {
            // Student Details
            fullName: name,
            name: name,
            dob: dob,
            admissionDate: admissionDate,
            gender: gender,
            studentCategory: 'GENERAL',
            permanentAddress: address,
            presentAddress: address,
            isAddressSame: true,
            aadharNo: aadhar,
            aadharNumber: aadhar, // Keep for compatibility
            studentPenNo: getVal(row, 'PEN')?.toString().trim(),
            appaarNo: getVal(row, 'APAAR ID')?.toString().trim() || '',
            grNo: grNo,
            admissionNo: grNo || '', // Mapping GR. No to Admission No

            // Parent Details
            fatherName: fatherName,
            parentName: fatherName, // Added parentName for compatibility
            fatherAadharNo: getVal(row, 'Father UID')?.toString().replace(/\D/g, '') || '',
            fatherContactNo: fatherPhone,
            motherName: motherName,
            motherAadharNo: getVal(row, 'Mother UID')?.toString().replace(/\D/g, '') || '',
            motherContactNo: motherPhone,

            // Contact
            mobileNo: mobile,
            phone: fatherPhone || mobile,

            // Essential Metadata
            rollNo: rollNo,
            classRollNo: rollNo,
            status: 'ACTIVE',
            class: finalClass,
            section: finalSection,
            schoolId: actualSchoolId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    });
};

// ===================================
// Marks Data Processing
// ===================================

export const parseSubjectMarks = (value: string | number): { theoryMarks: number; practicalMarks: number; grade: string; isAbsent: boolean; isNA: boolean } => {
    if (value === null || value === undefined || value === '') return { theoryMarks: 0, practicalMarks: 0, grade: '', isAbsent: false, isNA: false };

    // If Excel stored it as a real number, treat directly as theoryMarks
    if (typeof value === 'number') {
        return { theoryMarks: value, practicalMarks: 0, grade: '', isAbsent: false, isNA: false };
    }

    const str = value.toString().trim().toUpperCase();

    if (!str) return { theoryMarks: 0, practicalMarks: 0, grade: '', isAbsent: false, isNA: false };

    // Check for Absent
    if (str === 'AB' || str === 'ABS' || str === 'ABSENT') {
        return { theoryMarks: 0, practicalMarks: 0, grade: '', isAbsent: true, isNA: false };
    }

    // Check for Not Applicable
    if (str === 'NA' || str === 'N/A') {
        return { theoryMarks: 0, practicalMarks: 0, grade: '', isAbsent: false, isNA: true };
    }

    // Grade only (e.g., "B+", "A")
    const gradeOnlyMatch = str.match(/^([A-F][+-]?)$/i);
    if (gradeOnlyMatch) {
        return { theoryMarks: 0, practicalMarks: 0, grade: gradeOnlyMatch[1].toUpperCase(), isAbsent: false, isNA: false };
    }

    // Two numbers + grade (e.g., "95 0 A+", "45 20 C", "80 20 A+")
    const fullMatch = str.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+([A-F][+-]?)/i);
    if (fullMatch) {
        return {
            theoryMarks: parseFloat(fullMatch[1]),
            practicalMarks: parseFloat(fullMatch[2]),
            grade: fullMatch[3].toUpperCase(),
            isAbsent: false,
            isNA: false
        };
    }

    // Two numbers only (e.g., "80 20") — theory + practical
    const twoNumMatch = str.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/);
    if (twoNumMatch) {
        return {
            theoryMarks: parseFloat(twoNumMatch[1]),
            practicalMarks: parseFloat(twoNumMatch[2]),
            grade: '',
            isAbsent: false,
            isNA: false
        };
    }

    // Single number as text (e.g., "71", " 68 ") — treat as theoryMarks
    const singleNumMatch = str.match(/^(\d+(?:\.\d+)?)$/);
    if (singleNumMatch) {
        return { theoryMarks: parseFloat(singleNumMatch[1]), practicalMarks: 0, grade: '', isAbsent: false, isNA: false };
    }

    // Fallback: space-split parts
    const parts = str.split(/\s+/).filter(p => p !== '');
    const theoryMarks = parseFloat(parts[0]) || 0;
    const practicalMarks = parseFloat(parts[1]) || 0;
    const grade = parts[2] ? parts[2].toUpperCase() : '';

    return { theoryMarks, practicalMarks, grade, isAbsent: false, isNA: false };
};

export const isGradeOnlySubject = (subjectName: string): boolean => {
    const upperName = subjectName.toUpperCase().trim();
    // System columns that should NEVER be subjects
    const excludePatterns = ['ROLL', 'NAME', 'STUDENT', 'TOTAL', '%', 'RESULT', 'SIGN', 'REMARK', 'REMARKS'];
    if (excludePatterns.some(p => upperName.includes(p))) return false;

    // Only DRAWING and ART are usually grade-based in this context
    const gradeOnlySubjects = ['DRAWING', 'ART', 'CRAFT', 'MUSIC'];
    return gradeOnlySubjects.some(s => upperName.includes(s));
};

export const isComputerSubject = (subjectName: string): boolean => {
    const upperName = subjectName.toUpperCase();
    if (upperName.includes('COMPUTER')) return true;
    return false;
};

export const parseGrade = (value: string | number): string => {
    if (!value) return '';
    const str = value.toString().trim();
    if (str.match(/^[A-F][+-]?$/i)) return str.toUpperCase();
    const parts = str.split(/\s+/);
    if (parts.length >= 3) return parts[2].toUpperCase();
    return '';
};

export const validateMarksData = (data: MarksExcelRow[], students: any[]): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let validCount = 0;

    if (!data || data.length === 0) {
        errors.push('No data found in Excel file');
        return { isValid: false, errors, warnings, validCount: 0, totalCount: 0 };
    }

    const keys = Object.keys(data[0]);
    const rollCol = keys.find(k => k.toUpperCase().includes('ROLL')) || '';
    const nameCol = keys.find(k => k.toUpperCase().includes('NAME') || k.toUpperCase().includes('STUDENT')) || '';

    if (!rollCol || !nameCol) {
        errors.push('Missing required columns (Roll and Name)');
        return { isValid: false, errors, warnings, validCount: 0, totalCount: data.length };
    }

    data.forEach((row, index) => {
        const rowNum = index + 2;
        let hasError = false;
        const roll = row[rollCol];
        const name = row[nameCol];

        if (!roll && !name) return; // Skip completely empty rows

        if (!roll) {
            errors.push(`Row ${rowNum}: Roll number is required`);
            hasError = true;
        }
        if (!name) {
            errors.push(`Row ${rowNum}: Student name is required`);
            hasError = true;
        }

        if (students && students.length > 0 && roll) {
            const rollStr = roll?.toString().trim().replace(/^#/, ''); // Normalize
            const found = students.find(s =>
                (s.rollNo?.toString().trim().replace(/^#/, '') === rollStr) ||
                (s.classRollNo?.toString().trim().replace(/^#/, '') === rollStr)
            );
            if (!found) warnings.push(`Row ${rowNum}: Student with Roll No ${rollStr} not found`);
        }

        if (!hasError) validCount++;
    });

    return { isValid: errors.length === 0, errors, warnings, validCount, totalCount: data.length };
};

export const convertToMarksData = (data: MarksExcelRow[]): ParsedMarks[] => {
    return data.filter(row => {
        const keys = Object.keys(row);
        const rollKey = keys.find(k => k.toUpperCase().includes('ROLL'));
        const nameKey = keys.find(k => k.toUpperCase().includes('NAME') || k.toUpperCase().includes('STUDENT'));
        return (rollKey && row[rollKey]) || (nameKey && row[nameKey]); // Skip empty rows
    }).map(row => {
        const keys = Object.keys(row);

        // Find Roll and Name columns dynamically
        const rollKey = keys.find(k => k.toUpperCase().includes('ROLL')) || '';
        const nameKey = keys.find(k => k.toUpperCase().includes('NAME') || k.toUpperCase().includes('STUDENT')) || '';

        const roll = row[rollKey]?.toString().trim() || '';
        const name = row[nameKey]?.toString().trim() || '';

        // Columns to exclude from subjects (more robust list)
        const excludePatterns = ['ROLL', 'NAME', 'STUDENT', 'TOTAL', '%', 'RESULT', 'SIGN', 'REMARK'];
        const subjectColumns = keys.filter(key => {
            const upKey = key.toUpperCase();
            return !excludePatterns.some(pattern => upKey.includes(pattern)) && key.trim() !== '' && !key.startsWith('__EMPTY');
        });

        const subjects: { [key: string]: any } = {};

        subjectColumns.forEach(subjectName => {
            const value = row[subjectName];
            const { theoryMarks, practicalMarks, grade, isAbsent, isNA } = parseSubjectMarks(value);
            if (isGradeOnlySubject(subjectName)) {
                subjects[subjectName] = {
                    grade: grade || parseGrade(value),
                    isAbsent: isAbsent,
                    isNA: isNA
                };
            } else {
                subjects[subjectName] = {
                    theoryMarks,
                    practicalMarks,
                    marks: theoryMarks + practicalMarks,
                    grade,
                    isAbsent: isAbsent,
                    isNA: isNA
                };
            }
        });

        return {
            rollNumber: roll,
            studentName: name,
            subjects,
            totalPercentage: undefined,
            result: undefined
        };
    });
};

// ===================================
// Template Generation
// ===================================

export const generateStudentTemplate = (): void => {
    const template = [
        {
            'Roll No.': '1',
            'GR. No': '260',
            'Date of Admission': '05-08-24',
            'Student Name': 'SAMPLE STUDENT',
            'Class': '1 (A)',
            'Father Name': 'MR. FATHER NAME',
            'Father UID': '551902008610',
            'Father Phone': '9876543210',
            'Mother Name': 'MRS. MOTHER NAME',
            'Mother UID': '757760037601',
            'Mother Phone': '9876543210',
            'Address': 'SAMPLE ADDRESS, CITY',
            'Date of Birth': '15-06-15',
            'Gender': 'Male',
            'Mobile Number': '9876543210',
            'UID Number': '123456789012',
            'PEN': 'PEN123456',
            'APAAR ID': 'APAAR123456'
        },
        {
            'Roll No.': '2',
            'GR. No': '1072',
            'Date of Admission': '17-05-24',
            'Student Name': 'ANOTHER STUDENT',
            'Class': '9 (A)',
            'Father Name': 'MR. ANOTHER FATHER',
            'Father UID': '278829039725',
            'Father Phone': '9876543211',
            'Mother Name': 'MRS. ANOTHER MOTHER',
            'Mother UID': '250624075955',
            'Mother Phone': '9876543211',
            'Address': 'ANOTHER ADDRESS, CITY',
            'Date of Birth': '20-03-10',
            'Gender': 'Female',
            'Mobile Number': '9876543211',
            'UID Number': '987654321098',
            'PEN': 'PEN654321',
            'APAAR ID': 'APAAR654321'
        }
    ];
    const ws = XLSX.utils.json_to_sheet(template);

    // Set column widths
    ws['!cols'] = [
        { wch: 8 },   // Roll No.
        { wch: 10 },  // GR. No
        { wch: 18 },  // Date of Admission
        { wch: 25 },  // Student Name
        { wch: 10 },  // Class
        { wch: 22 },  // Father Name
        { wch: 15 },  // Father UID
        { wch: 14 },  // Father Phone
        { wch: 22 },  // Mother Name
        { wch: 15 },  // Mother UID
        { wch: 14 },  // Mother Phone
        { wch: 30 },  // Address
        { wch: 15 },  // Date of Birth
        { wch: 8 },   // Gender
        { wch: 14 },  // Mobile Number
        { wch: 15 },  // UID Number
        { wch: 12 },  // PEN
        { wch: 14 },  // APAAR ID
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Student Template");
    XLSX.writeFile(wb, "Student_Upload_Template.xlsx");
};

export const generateMarksTemplate = (className: string, subjects: string[]): void => {
    const template: any = { 'Roll No': '1', 'Student Name': 'Sample Student' };
    subjects.forEach(subject => {
        if (isGradeOnlySubject(subject)) template[subject] = 'A+';
        else if (isComputerSubject(subject)) template[subject] = '70 20 A';
        else template[subject] = '78 16 A+';
    });
    template['TOTAL %'] = '95.00';
    template['RESULT'] = 'Pass';
    const ws = XLSX.utils.json_to_sheet([template]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Marks Template");
    XLSX.writeFile(wb, `${className}_Marks_Template.xlsx`);
};

export const findMatchingStudent = (name: string, roll: string, students: any[]): any | null => {
    const normalizedName = name.toLowerCase().trim();
    const normalizedRoll = roll.toString().trim().replace(/^#/, ''); // Remove # prefix

    // Try exact match with name and roll
    let match = students.find(s => {
        const studentRoll = (s.rollNo || s.classRollNo || '').toString().trim().replace(/^#/, '');
        const studentName = s.name.toLowerCase().trim();
        return studentName === normalizedName && studentRoll === normalizedRoll;
    });

    if (match) return match;

    // Try roll number only match
    return students.find(s => {
        const studentRoll = (s.rollNo || s.classRollNo || '').toString().trim().replace(/^#/, '');
        return studentRoll === normalizedRoll;
    }) || null;
};
