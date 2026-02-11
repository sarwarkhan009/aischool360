export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    validCount: number;
    totalCount: number;
}

export interface StudentExcelRow {
    'Roll No.': string | number;
    'GR. No'?: string | number;
    'Student Name': string;
    'Father Name'?: string;
    'Father UID'?: string | number;
    'Father Phone'?: string | number;
    'Mother Name'?: string;
    'Mother UID'?: string | number;
    'Mother Phone'?: string | number;
    'Address'?: string;
    'Date of Birth'?: string;
    'Date of Admission'?: string;
    'Gender'?: string;
    'Category'?: string;
    'Mobile Number'?: string | number;
    'UID Number'?: string | number;
    'PEN'?: string;
}

export interface ParsedStudent {
    // Basic Details
    name: string;
    fullName: string;
    rollNo: string;
    classRollNo: string;
    dob: string;
    admissionDate: string;
    gender: string;
    studentCategory: string;
    permanentAddress: string;
    presentAddress: string;
    isAddressSame: boolean;

    // Identification
    aadharNo: string;
    aadharNumber: string;
    studentPenNo?: string;
    grNo?: string;
    admissionNo: string;

    // Parent Details
    fatherName: string;
    parentName: string;
    fatherAadharNo: string;
    fatherContactNo: string;
    motherName: string;
    motherAadharNo: string;
    motherContactNo: string;

    // Contact
    mobileNo: string;
    phone: string;

    // Metadata
    status: 'ACTIVE';
    class: string;
    section: string;
    schoolId: string;
    createdAt: string;
    updatedAt: string;
}

export interface MarksExcelRow {
    'ROLL': number | string;
    'STUDENT NAME': string;
    [key: string]: any;
}

export interface ParsedMarks {
    rollNumber: string;
    studentName: string;
    subjects: {
        [subjectName: string]: {
            marks?: number;
            theoryMarks?: number;
            practicalMarks?: number;
            grade?: string;
            isAbsent?: boolean;
            isNA?: boolean;
        };
    };
    totalPercentage?: number;
    result?: string;
}
