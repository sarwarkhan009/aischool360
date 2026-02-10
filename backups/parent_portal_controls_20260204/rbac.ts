export const Permission = {
    // Dashboard
    VIEW_DASHBOARD: 'VIEW_DASHBOARD',
    VIEW_STATS: 'VIEW_STATS',

    // Students
    MANAGE_STUDENTS: 'MANAGE_STUDENTS',
    VIEW_STUDENTS: 'VIEW_STUDENTS',
    ADMIT_STUDENT: 'ADMIT_STUDENT',
    VIEW_REGISTRATIONS: 'VIEW_REGISTRATIONS',
    VIEW_STUDENT_REPORTS: 'VIEW_STUDENT_REPORTS',
    VIEW_RE_REGISTRATION_REPORTS: 'VIEW_RE_REGISTRATION_REPORTS',
    VIEW_DUES_LIST: 'VIEW_DUES_LIST',

    // Employees
    MANAGE_EMPLOYEES: 'MANAGE_EMPLOYEES',
    VIEW_EMPLOYEES: 'VIEW_EMPLOYEES',
    MANAGE_PAYROLL: 'MANAGE_PAYROLL',
    VIEW_TEACHING_LOGS: 'VIEW_TEACHING_LOGS',

    // Finance
    MANAGE_FEES: 'MANAGE_FEES',
    COLLECT_FEES: 'COLLECT_FEES',
    VIEW_FEE_STRUCTURE: 'VIEW_FEE_STRUCTURE',
    MANAGE_FEE_STRUCTURE: 'MANAGE_FEE_STRUCTURE',
    SET_FEE_AMOUNT: 'SET_FEE_AMOUNT',
    VIEW_FEE_REPORTS: 'VIEW_FEE_REPORTS',
    VIEW_DUE_REPORTS: 'VIEW_DUE_REPORTS',

    // Accounts
    MANAGE_ACCOUNTS: 'MANAGE_ACCOUNTS',
    VIEW_ACCOUNTS: 'VIEW_ACCOUNTS',

    // Academic
    MANAGE_ATTENDANCE: 'MANAGE_ATTENDANCE',
    MANAGE_STAFF_ATTENDANCE: 'MANAGE_STAFF_ATTENDANCE',
    MANAGE_EXAMS: 'MANAGE_EXAMS',
    VIEW_EXAMS: 'VIEW_EXAMS',
    MANAGE_EXAM_TIMETABLE: 'MANAGE_EXAM_TIMETABLE',
    PRINT_ADMIT_CARDS: 'PRINT_ADMIT_CARDS',
    ENTER_MARKS: 'ENTER_MARKS',
    PRINT_REPORT_CARDS: 'PRINT_REPORT_CARDS',
    GENERATE_QUESTIONS: 'GENERATE_QUESTIONS',
    MANAGE_CALENDAR: 'MANAGE_CALENDAR',
    VIEW_CALENDAR: 'VIEW_CALENDAR',
    MANAGE_HOMEWORK: 'MANAGE_HOMEWORK',
    VIEW_HOMEWORK_REPORTS: 'VIEW_HOMEWORK_REPORTS',
    VIEW_ROUTINE: 'VIEW_ROUTINE',
    MANAGE_ROUTINE: 'MANAGE_ROUTINE',

    // Communication
    MANAGE_NOTICES: 'MANAGE_NOTICES',
    POST_NOTICE: 'POST_NOTICE',
    MANAGE_GALLERY: 'MANAGE_GALLERY',
    VIEW_GALLERY: 'VIEW_GALLERY',
    VIEW_MESSAGES: 'VIEW_MESSAGES',

    // Support
    MANAGE_TRANSPORT: 'MANAGE_TRANSPORT',
    MANAGE_LIBRARY: 'MANAGE_LIBRARY',

    // System / Settings
    VIEW_REPORTS: 'VIEW_REPORTS',
    MANAGE_SETTINGS: 'MANAGE_SETTINGS',
    MANAGE_ROLES: 'MANAGE_ROLES',
    MANAGE_MANAGERS: 'MANAGE_MANAGERS',
    MANAGE_SCHOOLS: 'MANAGE_SCHOOLS',
    MANAGE_CLASSES: 'MANAGE_CLASSES',
    MANAGE_INVENTORY: 'MANAGE_INVENTORY',
    MANAGE_INSTITUTION: 'MANAGE_INSTITUTION',
    MANAGE_REGISTRATION_FIELDS: 'MANAGE_REGISTRATION_FIELDS',
    MANAGE_ADMISSION_FIELDS: 'MANAGE_ADMISSION_FIELDS',
    MANAGE_PRINT_DESIGN: 'MANAGE_PRINT_DESIGN',
    MANAGE_API_KEYS: 'MANAGE_API_KEYS',
    MANAGE_DATA_SEEDER: 'MANAGE_DATA_SEEDER',
    MANAGE_MASTER_CONTROL: 'MANAGE_MASTER_CONTROL',
    MANAGE_PAYMENT_SETTINGS: 'MANAGE_PAYMENT_SETTINGS',
    UPLOAD_HOLIDAYS: 'UPLOAD_HOLIDAYS',
    MANAGE_ACADEMIC_STRUCTURE: 'MANAGE_ACADEMIC_STRUCTURE',

    // AI Features
    USE_AI_ASSISTANT: 'USE_AI_ASSISTANT',

    // Parent Portal Controls
    PARENT_SHOW_FEE_TAB: 'PARENT_SHOW_FEE_TAB',
    PARENT_SHOW_DUES_BANNER: 'PARENT_SHOW_DUES_BANNER',
} as const;

export type Permission = typeof Permission[keyof typeof Permission];

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'TEACHER' | 'ACCOUNTANT' | 'PARENT' | 'USER' | 'DRIVER';

export interface RoleConfig {
    role: Role;
    label: string;
    permissions: Permission[];
}

export const DEFAULT_ROLES: RoleConfig[] = [
    {
        role: 'SUPER_ADMIN',
        label: 'Super Administrator',
        permissions: Object.values(Permission) as Permission[],
    },
    {
        role: 'ADMIN',
        label: 'Administrator',
        permissions: Object.values(Permission) as Permission[],
    },
    {
        role: 'MANAGER',
        label: 'Manager',
        permissions: [
            Permission.VIEW_DASHBOARD,
            Permission.VIEW_STATS,
            Permission.VIEW_STUDENTS,
            Permission.VIEW_EMPLOYEES,
            Permission.COLLECT_FEES,
            Permission.VIEW_FEE_STRUCTURE,
            Permission.VIEW_EXAMS,
            Permission.MANAGE_NOTICES,
            Permission.VIEW_REPORTS,
            Permission.VIEW_GALLERY,
        ],
    },
    {
        role: 'TEACHER',
        label: 'Teacher',
        permissions: [
            Permission.VIEW_DASHBOARD,
            Permission.VIEW_STUDENTS,
            Permission.MANAGE_ATTENDANCE,
            Permission.VIEW_EXAMS,
            Permission.MANAGE_EXAMS,
            Permission.POST_NOTICE,
            Permission.MANAGE_HOMEWORK,
            Permission.VIEW_GALLERY,
        ],
    },
    {
        role: 'ACCOUNTANT',
        label: 'Accountant',
        permissions: [
            Permission.VIEW_DASHBOARD,
            Permission.MANAGE_FEES,
            Permission.COLLECT_FEES,
            Permission.VIEW_FEE_STRUCTURE,
            Permission.VIEW_REPORTS,
        ],
    },
    {
        role: 'PARENT',
        label: 'Parent',
        permissions: [
            Permission.VIEW_DASHBOARD,
            Permission.VIEW_EXAMS,
            Permission.MANAGE_FEES,
            Permission.VIEW_GALLERY,
            Permission.PARENT_SHOW_FEE_TAB,
            Permission.PARENT_SHOW_DUES_BANNER,
        ],
    },
    {
        role: 'DRIVER',
        label: 'Bus Driver',
        permissions: [
            Permission.VIEW_DASHBOARD,
        ],
    },
];
