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

                // Find header row (the one containing 'ROLL' and 'STUDENT NAME')
                let headerRowIndex = -1;
                for (let i = 0; i < range.length; i++) {
                    const row = range[i].map(cell => cell?.toString().trim().toUpperCase());
                    if (row.includes('ROLL') || (row.includes('STUDENT NAME') || row.includes('NAME'))) {
                        headerRowIndex = i;
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    // Fallback to traditional way if headers not found
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });
                    resolve(jsonData);
                    return;
                }

                // Parse using detected header row
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                    raw: false,
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

export const validateStudentData = (data: StudentExcelRow[]): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let validCount = 0;

    if (!data || data.length === 0) {
        errors.push('No data found in Excel file');
        return { isValid: false, errors, warnings, validCount: 0, totalCount: 0 };
    }

    const firstRow = data[0];
    const requiredColumns = ['Roll No.', 'Student Name'];
    const missingColumns = requiredColumns.filter(col => !(col in firstRow));

    if (missingColumns.length > 0) {
        errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
        return { isValid: false, errors, warnings, validCount: 0, totalCount: data.length };
    }

    const rollNumbers = new Set<string>();

    data.forEach((row, index) => {
        const rowNum = index + 2;
        let hasError = false;

        if (!row['Student Name'] || row['Student Name'].toString().trim() === '') {
            errors.push(`Row ${rowNum}: Student Name is required`);
            hasError = true;
        }

        if (!row['Roll No.'] || row['Roll No.'].toString().trim() === '') {
            errors.push(`Row ${rowNum}: Roll No. is required`);
            hasError = true;
        } else {
            const rollNo = row['Roll No.'].toString().trim();
            if (rollNumbers.has(rollNo)) {
                errors.push(`Row ${rowNum}: Duplicate Roll No.: ${rollNo}`);
                hasError = true;
            }
            rollNumbers.add(rollNo);
        }

        if (row['Father Phone'] && !isValidPhone(row['Father Phone']?.toString())) {
            warnings.push(`Row ${rowNum}: Invalid Father Phone number`);
        }
        if (row['Mother Phone'] && !isValidPhone(row['Mother Phone']?.toString())) {
            warnings.push(`Row ${rowNum}: Invalid Mother Phone number`);
        }
        if (row['Mobile Number'] && !isValidPhone(row['Mobile Number']?.toString())) {
            warnings.push(`Row ${rowNum}: Invalid Mobile number`);
        }
        if (row['UID Number'] && !isValidAadhar(row['UID Number']?.toString())) {
            warnings.push(`Row ${rowNum}: Invalid UID Number (Aadhar)`);
        }

        if (!hasError) validCount++;
    });

    return { isValid: errors.length === 0, errors, warnings, validCount, totalCount: data.length };
};

export const convertToStudents = (
    data: StudentExcelRow[],
    classId: string,
    section: string,
    schoolId: string
): ParsedStudent[] => {
    return data.map(row => {
        const rollNo = row['Roll No.']?.toString().trim() || '';
        const name = row['Student Name']?.toString().trim() || '';
        const fatherName = row['Father Name']?.toString().trim() || '';
        const motherName = row['Mother Name']?.toString().trim() || '';
        const address = row['Address']?.toString().trim() || '';
        const mobile = row['Mobile Number']?.toString().replace(/\D/g, '') || '';
        const fatherPhone = row['Father Phone']?.toString().replace(/\D/g, '') || '';
        const motherPhone = row['Mother Phone']?.toString().replace(/\D/g, '') || '';
        const aadhar = row['UID Number']?.toString().replace(/\D/g, '') || '';
        const grNo = row['GR. No']?.toString().trim();

        // Normalize Gender
        let gender = (row['Gender']?.toString().trim() || 'Male').toLowerCase();
        if (gender.startsWith('m')) gender = 'Male';
        else if (gender.startsWith('f')) gender = 'Female';
        else gender = 'Other';

        // Normalize Date (expecting common formats like DD-MM-YYYY or DD/MM/YYYY)
        let dob = row['Date of Birth']?.toString().trim() || '';
        if (dob && (dob.includes('-') || dob.includes('/'))) {
            const parts = dob.split(/[-/]/);
            if (parts.length === 3) {
                // If it's DD-MM-YYYY, convert to YYYY-MM-DD
                if (parts[2].length === 4) {
                    dob = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
        }

        let admissionDate = row['Date of Admission']?.toString().trim() || new Date().toISOString().split('T')[0];
        if (admissionDate && (admissionDate.includes('-') || admissionDate.includes('/'))) {
            const parts = admissionDate.split(/[-/]/);
            if (parts.length === 3) {
                // If it's DD-MM-YYYY, convert to YYYY-MM-DD
                if (parts[2].length === 4) {
                    admissionDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
        }

        return {
            // Student Details
            fullName: name,
            name: name,
            dob: dob,
            admissionDate: admissionDate,
            gender: gender,
            studentCategory: (row['Category']?.toString().trim() || 'GENERAL').toUpperCase(),
            permanentAddress: address,
            presentAddress: address,
            isAddressSame: true,
            aadharNo: aadhar,
            aadharNumber: aadhar, // Keep for compatibility
            studentPenNo: row['PEN']?.toString().trim(),
            grNo: grNo,
            admissionNo: grNo || '', // Mapping GR. No to Admission No

            // Parent Details
            fatherName: fatherName,
            parentName: fatherName, // Added parentName for compatibility
            fatherAadharNo: row['Father UID']?.toString().replace(/\D/g, '') || '',
            fatherContactNo: fatherPhone,
            motherName: motherName,
            motherAadharNo: row['Mother UID']?.toString().replace(/\D/g, '') || '',
            motherContactNo: motherPhone,

            // Contact
            mobileNo: mobile,
            phone: fatherPhone || mobile,

            // Essential Metadata
            rollNo: rollNo,
            classRollNo: rollNo,
            status: 'ACTIVE',
            class: classId,
            section: section,
            schoolId: schoolId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    });
};

// ===================================
// Marks Data Processing
// ===================================

export const parseSubjectMarks = (value: string | number): { theoryMarks: number; practicalMarks: number; grade: string; isAbsent: boolean; isNA: boolean } => {
    if (!value) return { theoryMarks: 0, practicalMarks: 0, grade: '', isAbsent: false, isNA: false };

    const str = value.toString().trim().toUpperCase();

    // Check for Absent
    if (str === 'AB') {
        return {
            theoryMarks: 0,
            practicalMarks: 0,
            grade: '',
            isAbsent: true,
            isNA: false
        };
    }

    // Check for Not Applicable
    if (str === 'NA') {
        return {
            theoryMarks: 0,
            practicalMarks: 0,
            grade: '',
            isAbsent: false,
            isNA: true
        };
    }

    // Grade only (e.g., "B+", "A")
    const gradeOnlyMatch = str.match(/^([A-F][+-]?)$/i);
    if (gradeOnlyMatch) {
        return {
            theoryMarks: 0,
            practicalMarks: 0,
            grade: gradeOnlyMatch[1].toUpperCase(),
            isAbsent: false,
            isNA: false
        };
    }

    // Two numbers + grade (e.g., "95 0 A+", "45 20 C", "80 20 A+")
    const fullMatch = str.match(/(\d+)\s+(\d+)\s+([A-F][+-]?)/i);
    if (fullMatch) {
        return {
            theoryMarks: parseInt(fullMatch[1]),
            practicalMarks: parseInt(fullMatch[2]),
            grade: fullMatch[3].toUpperCase(),
            isAbsent: false,
            isNA: false
        };
    }

    // Fallback: just numbers (no grade)
    const parts = str.split(/\s+/);
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
    const template = [{
        'Roll No.': '1',
        'GR. No': 'GR001',
        'Student Name': 'Sample Student',
        'Father Name': 'Mr. Father',
        'Father UID': '123412341234',
        'Father Phone': '9876543210',
        'Mother Name': 'Mrs. Mother',
        'Mother UID': '123412341234',
        'Mother Phone': '9876543210',
        'Address': 'Sample Address, City',
        'Date of Birth': '01-01-2015',
        'Date of Admission': '10-02-2026',
        'Gender': 'Male',
        'Category': 'General',
        'Mobile Number': '9876543210',
        'UID Number': '123456789012',
        'PEN': 'PEN123456'
    }];
    const ws = XLSX.utils.json_to_sheet(template);
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
