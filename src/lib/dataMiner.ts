import { db } from './firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

/**
 * Fetches comprehensive ERP data from Firestore for AI analysis
 * This provides the AI assistant with complete access to all database fields
 */
export const getMinifiedERPData = async (schoolId?: string) => {
    try {
        const context: any = {
            timestamp: new Date().toISOString(),
            students: [],
            employees: [],
            fee_collections: [], // Actual income
            transactions: [],    // Other income/expenses
            fees: [],            // Legacy or structure
            fee_types: [],       // Fee structure definitions
            fee_amounts: [],     // Class-wise fee amounts
            attendance: [],
            teacher_attendance: [],
            notices: [],
            transport: [],
            student_dues: []     // Computed outstanding dues per student
        };

        // Helper: build query with schoolId filter
        const getQuery = (col: string) => {
            const colRef = collection(db, col);
            return schoolId ? query(colRef, where('schoolId', '==', schoolId)) : colRef;
        };

        // Fetch Students with ALL fields
        try {
            const studentsSnapshot = await getDocs(getQuery('students'));
            context.students = studentsSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name || data.fullName,
                    fatherName: data.fatherName || data.parentName,
                    motherName: data.motherName,
                    dob: data.dob,
                    gender: data.gender,
                    bloodGroup: data.bloodGroup,
                    religion: data.religion,
                    mobileNo: data.mobileNo || data.phone,
                    emailId: data.emailId,
                    whatsappNo: data.whatsappNo,
                    state: data.state,
                    district: data.district,
                    permanentAddress: data.permanentAddress,
                    presentAddress: data.presentAddress,
                    pinCode: data.pinCode,
                    admissionNo: data.admissionNo,
                    class: data.class,
                    section: data.section,
                    rollNo: data.rollNo || data.classRollNo,
                    session: data.session,
                    admissionDate: data.admissionDate,
                    admissionType: data.admissionType,
                    financeType: data.financeType,
                    studentCategory: data.studentCategory,
                    basicDues: data.basicDues,
                    status: data.status,
                    studentPenNo: data.studentPenNo
                };
            });
        } catch (err) {
            console.warn('Failed to fetch students:', err);
        }

        // Fetch Employees/Teachers (Collection is called 'teachers')
        try {
            const employeesSnapshot = await getDocs(getQuery('teachers'));
            context.employees = employeesSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name,
                    designation: data.designation,
                    department: data.department,
                    joiningDate: data.joiningDate,
                    salary: data.baseSalary || data.salary,
                    status: data.status,
                    employeeId: data.employeeId,
                    gender: data.gender,
                    qualification: data.qualification,
                    phone: data.mobile || data.phone,
                    email: data.email,
                    employeeType: data.employeeType,
                    subjects: data.subjects,
                    teachingClasses: data.teachingClasses
                };
            });
        } catch (err) {
            console.warn('Failed to fetch employees:', err);
        }

        // Fetch Actual Fee Collections (Income)
        try {
            const feeCollSnapshot = await getDocs(getQuery('fee_collections'));
            context.fee_collections = feeCollSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    studentName: data.studentName,
                    admissionNo: data.admissionNo,
                    class: data.class,
                    month: data.month,
                    year: data.year,
                    amount: data.amountPaid || data.paid || 0,
                    paymentDate: data.paymentDate,
                    receiptNo: data.receiptNo,
                    paymentMode: data.paymentMode,
                    status: data.status,
                    discount: data.discount || 0,
                    feeType: data.feeType || data.feeTypes
                };
            });
        } catch (err) {
            console.warn('Failed to fetch fee collections:', err);
        }

        // Fetch General Transactions (Expenses & Other Income)
        try {
            const transSnapshot = await getDocs(getQuery('transactions'));
            context.transactions = transSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    type: data.type, // INCOME or EXPENSE
                    category: data.category,
                    ledgerName: data.ledgerName,
                    amount: data.amount,
                    date: data.date,
                    description: data.description,
                    chalanNo: data.chalanNo || data.voucherNo || data.referenceNo
                };
            });
        } catch (err) {
            console.warn('Failed to fetch transactions:', err);
        }

        // Fetch Fee Records (Dues/Structures)
        try {
            const feesSnapshot = await getDocs(getQuery('fees'));
            context.fees = feesSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    studentName: data.name || data.studentName,
                    totalFee: data.totalFee,
                    paidAmount: data.paid || data.paidAmount,
                    dueAmount: data.due || data.dueAmount,
                    status: data.status
                };
            });
        } catch (err) {
            console.warn('Failed to fetch fees:', err);
        }

        // Fetch Fee Types (fee structure definitions)
        try {
            const feeTypesSnapshot = await getDocs(getQuery('fee_types'));
            context.fee_types = feeTypesSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    feeHeadName: data.feeHeadName,
                    months: data.months,
                    admissionTypes: data.admissionTypes,
                    studentTypes: data.studentTypes,
                    classes: data.classes,
                    status: data.status
                };
            });
        } catch (err) {
            console.warn('Failed to fetch fee_types:', err);
        }

        // Fetch Fee Amounts (class-wise amounts)
        try {
            const feeAmountsSnapshot = await getDocs(getQuery('fee_amounts'));
            context.fee_amounts = feeAmountsSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    feeTypeId: data.feeTypeId,
                    className: data.className,
                    amount: data.amount
                };
            });
        } catch (err) {
            console.warn('Failed to fetch fee_amounts:', err);
        }

        // Fetch Attendance Summary (Last 30 days)
        try {
            const attendanceSnapshot = await getDocs(getQuery('attendance'));
            context.attendance = attendanceSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    studentName: data.studentName,
                    class: data.class,
                    date: data.date,
                    status: data.status
                };
            });
        } catch (err) {
            console.warn('Failed to fetch attendance:', err);
        }

        // Fetch Teacher Attendance
        try {
            const teacherAttSnapshot = await getDocs(getQuery('teacherAttendance'));
            context.teacher_attendance = teacherAttSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    teacherId: data.teacherId,
                    teacherName: data.teacherName,
                    date: data.date,
                    status: data.status
                };
            });
        } catch (err) {
            console.warn('Failed to fetch teacher attendance:', err);
        }

        // Fetch Transport (Drivers)
        try {
            const transportSnapshot = await getDocs(getQuery('drivers'));
            context.transport = transportSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    vehicleNo: data.vehicleNo,
                    routeName: data.route || data.routeName,
                    driverName: data.name || data.driverName,
                    phone: data.phone
                };
            });
        } catch (err) {
            console.warn('Failed to fetch transport:', err);
        }

        // === COMPUTE STUDENT DUES (same logic as DueReport) ===
        try {
            const today = new Date();
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth();
            const sessionStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
            const sessionStartDate = new Date(sessionStartYear, 3, 1); // April 1
            const academicStartMonthIdx = 3; // April

            const MONTH_MAP: Record<string, number> = {
                'January': 0, 'February': 1, 'March': 2, 'April': 3,
                'May': 4, 'June': 5, 'July': 6, 'August': 7,
                'September': 8, 'October': 9, 'November': 10, 'December': 11
            };

            const feeTypes = context.fee_types || [];
            const feeAmounts = context.fee_amounts || [];

            context.student_dues = context.students.map((student: any) => {
                const admType = student.admissionType || 'NEW';
                const admDateRaw = student.admissionDate ? new Date(student.admissionDate) : null;

                let startMonthIdx = academicStartMonthIdx;
                let startYear = sessionStartYear;

                if (admType === 'NEW' && admDateRaw && admDateRaw >= sessionStartDate) {
                    startMonthIdx = admDateRaw.getMonth();
                    startYear = admDateRaw.getFullYear();
                }

                let totalPayable = 0;

                feeTypes.forEach((type: any) => {
                    if (type.status !== 'ACTIVE') return;
                    if (!type.admissionTypes?.includes(admType)) return;

                    const matchesStudentType = type.studentTypes?.includes(student.studentCategory || 'GENERAL');
                    let matchesClass = type.classes?.includes(student.class || '');

                    if (!matchesClass && student.class) {
                        matchesClass = feeAmounts.some((fa: any) => fa.feeTypeId === type.id && fa.className === student.class);
                    }

                    if (matchesClass && matchesStudentType) {
                        const amountConfig = feeAmounts.find((fa: any) => fa.feeTypeId === type.id && fa.className === student.class);
                        const isMonthlyFee = type.feeHeadName?.toLowerCase().includes('monthly');
                        const hasOverride = isMonthlyFee && student.monthlyFee !== undefined && student.monthlyFee !== null && student.monthlyFee !== '';
                        const studentFee = hasOverride ? parseFloat(String(student.monthlyFee)) : null;
                        const useStudentFee = hasOverride && studentFee !== null && !isNaN(studentFee);

                        if (!useStudentFee && (!amountConfig || !amountConfig.amount)) return;

                        type.months?.forEach((monthName: string) => {
                            let isDue = false;

                            if (monthName === 'Admission_month') {
                                if (admType === 'OLD') isDue = true;
                                else if (admType === 'NEW' && admDateRaw) isDue = today >= admDateRaw;
                            } else {
                                const targetMonthIdx = MONTH_MAP[monthName];
                                if (targetMonthIdx !== undefined) {
                                    const targetYear = targetMonthIdx < academicStartMonthIdx ? sessionStartYear + 1 : sessionStartYear;
                                    const dueDate = new Date(targetYear, targetMonthIdx, 5);
                                    if (today >= dueDate) {
                                        const monthDate = new Date(targetYear, targetMonthIdx, 1);
                                        const sessionStartCompare = new Date(startYear, startMonthIdx, 1);
                                        if (monthDate >= sessionStartCompare) isDue = true;
                                    }
                                }
                            }

                            if (isDue) {
                                totalPayable += useStudentFee ? studentFee! : (amountConfig?.amount || 0);
                            }
                        });
                    }
                });

                // Add basicDues (carry-forward)
                const basicDues = Number(student.basicDues) || 0;
                totalPayable += basicDues;

                // Calculate payments
                const studentPayments = (context.fee_collections || []).filter((c: any) =>
                    c.admissionNo === student.admissionNo &&
                    c.status !== 'CANCELLED'
                );
                const totalPaid = studentPayments.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);
                const totalDiscount = studentPayments.reduce((sum: number, c: any) => sum + (Number(c.discount) || 0), 0);

                const dues = totalPayable - totalPaid - totalDiscount;
                if (dues <= 0) return null;

                return {
                    name: student.name,
                    admissionNo: student.admissionNo,
                    class: student.class,
                    section: student.section,
                    fatherName: student.fatherName,
                    phone: student.mobileNo,
                    totalPayable,
                    totalPaid,
                    totalDiscount,
                    basicDues,
                    dues
                };
            }).filter(Boolean);
        } catch (err) {
            console.warn('Failed to compute student dues:', err);
        }

        // Add summary statistics for the AI
        const totalDues = (context.student_dues || []).reduce((s: number, d: any) => s + (d.dues || 0), 0);
        context.summary = {
            totalStudents: context.students.length,
            totalEmployees: context.employees.length,
            totalTeacherAttendance: (context.teacher_attendance || []).length,
            totalIncomeEntries: context.fee_collections.length,
            totalExpenseEntries: context.transactions.filter((t: any) => t.type === 'EXPENSE').length,
            studentsWithDues: (context.student_dues || []).length,
            totalOutstandingDues: totalDues,
            currentTimestamp: context.timestamp
        };

        return JSON.stringify(context, null, 2);
    } catch (error) {
        console.error("Data Mining Error:", error);
        return JSON.stringify({
            error: "Failed to fetch data",
            message: (error as Error).message,
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * COMPACT summary for Voice AI (Gemini Live API) — kept under 50K chars
 * Includes: student name/class/admNo/rollNo/gender/father/phone, class-wise dues, top 50 defaulters
 */
export function buildVoiceSummary(data: any): string {
    if (!data || typeof data !== 'object') return 'No school data available.';

    const lines: string[] = [];
    const today = new Date().toISOString().split('T')[0];
    const todayParts = today.split('-');
    const currentMonth = `${todayParts[0]}-${todayParts[1]}`;

    // Format date from yyyy-mm-dd to dd-MMM-yyyy (e.g. 11-Sep-2018)
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fmtDate = (d: string | undefined): string => {
        if (!d) return '';
        const parts = d.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            const mi = parseInt(parts[1], 10) - 1;
            return `${parts[2]}-${MONTHS[mi] || parts[1]}-${parts[0]}`;
        }
        return d;
    };

    // === STUDENTS (name, class, admNo, father, phone) ===
    if (data.students?.length) {
        lines.push(`=== STUDENTS (${data.students.length} total) ===`);
        const byClass: Record<string, any[]> = {};
        for (const s of data.students) {
            const cls = s.class || 'Unknown';
            if (!byClass[cls]) byClass[cls] = [];
            byClass[cls].push(s);
        }
        for (const [cls, students] of Object.entries(byClass)) {
            const boys = students.filter((s: any) => s.gender === 'Male' || s.gender === 'male').length;
            const girls = students.length - boys;
            lines.push(`\n[${cls}] ${students.length} (${boys}B/${girls}G):`);
            for (const s of students) {
                const parts = [
                    s.admissionNo ? `#${s.admissionNo}` : '',
                    s.rollNo ? `R:${s.rollNo}` : '',
                    s.section ? `Sec:${s.section}` : '',
                    s.gender ? `${s.gender}` : '',
                    s.dob ? `DOB:${fmtDate(s.dob)}` : '',
                    s.admissionDate ? `Adm:${fmtDate(s.admissionDate)}` : '',
                    s.fatherName ? `F:${s.fatherName}` : '',
                    s.mobileNo ? `Ph:${s.mobileNo}` : '',
                    s.basicDues ? `Dues:₹${s.basicDues}` : ''
                ].filter(Boolean).join(' | ');
                lines.push(`  ${s.name || 'N/A'} | ${parts}`);
            }
        }
    }

    // === EMPLOYEES / TEACHERS ===
    if (data.employees?.length) {
        lines.push(`\n=== EMPLOYEES (${data.employees.length}) ===`);
        for (const e of data.employees) {
            const parts = [
                e.designation || 'Staff',
                e.employeeType || '',
                e.phone ? `Ph:${e.phone}` : '',
                e.email ? `Email:${e.email}` : '',
                e.subjects?.length ? `Sub:${e.subjects.join(',')}` : '',
                e.teachingClasses?.length ? `Classes:${e.teachingClasses.join(',')}` : '',
                e.qualification || '',
                e.status ? `[${e.status}]` : ''
            ].filter(Boolean).join(' | ');
            lines.push(`  ${e.name || 'N/A'} | ${parts}`);
        }
    }

    // === FEE COLLECTIONS (last 3 days receipt-wise + day-wise totals + class-wise) ===
    if (data.fee_collections?.length) {
        const all = data.fee_collections.filter((f: any) => f.status !== 'CANCELLED');
        const totalAll = all.reduce((s: number, f: any) => s + (Number(f.amount) || 0), 0);
        const todayColl = all.filter((f: any) => (f.paymentDate || f.date || '').startsWith(today));
        const todayTotal = todayColl.reduce((s: number, f: any) => s + (Number(f.amount) || 0), 0);
        const monthColl = all.filter((f: any) => (f.paymentDate || f.date || '').startsWith(currentMonth));
        const monthTotal = monthColl.reduce((s: number, f: any) => s + (Number(f.amount) || 0), 0);

        lines.push(`\n=== FEE COLLECTIONS ===`);
        lines.push(`All-Time: \u20b9${totalAll} (${all.length}) | Today: \u20b9${todayTotal} (${todayColl.length}) | Month: \u20b9${monthTotal} (${monthColl.length})`);

        // Day-wise totals for last 3 days
        const byDateColl: Record<string, any[]> = {};
        for (const f of all) {
            const dt = f.paymentDate || f.date || 'Unknown';
            if (!byDateColl[dt]) byDateColl[dt] = [];
            byDateColl[dt].push(f);
        }
        const last3Days = Object.keys(byDateColl).sort().reverse().slice(0, 3);
        lines.push(`\nDay-wise Collection (Last 3 Days):`);
        for (const dt of last3Days) {
            const dayRecs = byDateColl[dt];
            const dayTotal = dayRecs.reduce((s: number, f: any) => s + (Number(f.amount) || 0), 0);
            const cash = dayRecs.filter((f: any) => (f.paymentMode || '').toLowerCase() === 'cash').reduce((s: number, f: any) => s + (Number(f.amount) || 0), 0);
            const online = dayTotal - cash;
            lines.push(`  ${fmtDate(dt)}: \u20b9${dayTotal} (${dayRecs.length} receipts) | Cash:\u20b9${cash} Online:\u20b9${online}`);
        }

        // Last 3 days receipt-wise details
        lines.push(`\nReceipt-wise (Last 3 Days):`);
        for (const dt of last3Days) {
            lines.push(`  --- ${fmtDate(dt)} ---`);
            for (const f of byDateColl[dt]) {
                lines.push(`    ${f.studentName || 'N/A'} (${f.class || ''}) | \u20b9${f.amount} | ${f.paymentMode || ''} | Rcpt:${f.receiptNo || 'N/A'} | ${f.feeType || f.month || ''}`);
            }
        }

        // Class-wise collection summary
        const byClassColl: Record<string, number> = {};
        for (const f of all) {
            const cls = f.class || 'Unknown';
            byClassColl[cls] = (byClassColl[cls] || 0) + (Number(f.amount) || 0);
        }
        lines.push(`\nClass-wise Collection:`);
        for (const [cls, amt] of Object.entries(byClassColl)) {
            lines.push(`  ${cls}: \u20b9${amt}`);
        }
    }

    // === STUDENT DUES (class-wise + top 50) ===
    if (data.student_dues?.length) {
        const allDues = data.student_dues;
        const totalDues = allDues.reduce((s: number, d: any) => s + (d.dues || 0), 0);
        lines.push(`\n=== STUDENT DUES (${allDues.length} students, Total: \u20b9${totalDues}) ===`);

        const byClass: Record<string, any[]> = {};
        for (const d of allDues) {
            const cls = d.class || 'Unknown';
            if (!byClass[cls]) byClass[cls] = [];
            byClass[cls].push(d);
        }
        lines.push(`Class-wise:`);
        for (const [cls, students] of Object.entries(byClass)) {
            const classDues = students.reduce((s: number, d: any) => s + (d.dues || 0), 0);
            lines.push(`  ${cls}: ${students.length} students, \u20b9${classDues}`);
        }

        const sorted = [...allDues].sort((a: any, b: any) => (b.dues || 0) - (a.dues || 0));
        lines.push(`\nTop ${Math.min(50, sorted.length)} Defaulters:`);
        for (const d of sorted.slice(0, 50)) {
            lines.push(`  ${d.name || 'N/A'} | ${d.class || ''} | #${d.admissionNo || ''} | F:${d.fatherName || ''} | Due:\u20b9${d.dues} | Ph:${d.phone || ''}`);
        }
    }

    // === ATTENDANCE (last 3 days) ===
    if (data.attendance?.length) {
        lines.push(`\n=== ATTENDANCE ===`);
        const byDate: Record<string, any[]> = {};
        for (const a of data.attendance) {
            const d = a.date || 'Unknown';
            if (!byDate[d]) byDate[d] = [];
            byDate[d].push(a);
        }
        const sortedDates = Object.keys(byDate).sort().reverse().slice(0, 3);
        for (const date of sortedDates) {
            const recs = byDate[date];
            const absent = recs.filter((a: any) => a.status === 'ABSENT' || a.status === 'absent' || a.status === 'A');
            const present = recs.filter((a: any) => a.status === 'PRESENT' || a.status === 'present' || a.status === 'P');
            lines.push(`${date}${date === today ? ' (TODAY)' : ''}: P:${present.length} A:${absent.length}`);
            if (absent.length) {
                lines.push(`  Absent: ${absent.map((a: any) => `${a.studentName || 'N/A'}(${a.class || ''})`).join(', ')}`);
            }
        }
    }

    // === TEACHER ATTENDANCE (last 3 days) ===
    if (data.teacher_attendance?.length) {
        lines.push(`\n=== TEACHER ATTENDANCE ===`);
        const byDate: Record<string, any[]> = {};
        for (const a of data.teacher_attendance) {
            const d = a.date || 'Unknown';
            if (!byDate[d]) byDate[d] = [];
            byDate[d].push(a);
        }
        const sortedDates = Object.keys(byDate).sort().reverse().slice(0, 3);
        for (const date of sortedDates) {
            const recs = byDate[date];
            const absent = recs.filter((a: any) => a.status === 'ABSENT' || a.status === 'absent' || a.status === 'A');
            const present = recs.filter((a: any) => a.status === 'PRESENT' || a.status === 'present' || a.status === 'P');
            lines.push(`${date}${date === today ? ' (TODAY)' : ''}: P:${present.length} A:${absent.length}`);
            if (absent.length) {
                lines.push(`  Absent: ${absent.map((a: any) => a.teacherName || 'N/A').join(', ')}`);
            }
        }
    }

    // === TRANSACTIONS ===
    if (data.transactions?.length) {
        const exp = data.transactions.filter((t: any) => t.type === 'EXPENSE' || t.type === 'expense');
        const inc = data.transactions.filter((t: any) => t.type === 'INCOME' || t.type === 'income');
        lines.push(`\n=== TRANSACTIONS ===`);
        lines.push(`Income: \u20b9${inc.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0)} (${inc.length}) | Expense: \u20b9${exp.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0)} (${exp.length})`);
        for (const t of data.transactions.slice(-10)) {
            lines.push(`  ${t.type || ''} | \u20b9${t.amount} | ${t.category || t.ledgerName || ''} | ${t.date || ''} | ${(t.description || '').substring(0, 40)}`);
        }
    }

    // === NOTICES ===
    if (data.notices?.length) {
        lines.push(`\n=== NOTICES (${data.notices.length}) ===`);
        for (const n of data.notices.slice(-5)) {
            lines.push(`  ${n.title || 'N/A'}: ${(n.content || n.message || '').substring(0, 80)}`);
        }
    }

    // === TRANSPORT ===
    if (data.transport?.length) {
        lines.push(`\n=== TRANSPORT (${data.transport.length}) ===`);
        for (const t of data.transport) {
            lines.push(`  ${t.routeName || 'N/A'} | ${t.driverName || 'N/A'} | ${t.vehicleNo || ''}`);
        }
    }

    // Hard cap at 60K chars for Gemini Live API
    const result = lines.join('\n');
    if (result.length > 60000) {
        return result.substring(0, 60000) + '\n... (truncated for voice)';
    }
    return result;
}

/**
 * DETAILED summary for Written AI Assistant — no size limit
 * Includes: all students with full details, all dues individually, all attendance records
 */
export function buildDetailedSummary(data: any): string {
    if (!data || typeof data !== 'object') return 'No school data available.';

    const lines: string[] = [];
    const today = new Date().toISOString().split('T')[0];
    const todayParts = today.split('-');
    const currentMonth = `${todayParts[0]}-${todayParts[1]}`;

    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fmtDate = (d: string | undefined): string => {
        if (!d) return '';
        const parts = d.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            const mi = parseInt(parts[1], 10) - 1;
            return `${parts[2]}-${MONTHS[mi] || parts[1]}-${parts[0]}`;
        }
        return d;
    };

    // === STUDENTS (full details) ===
    if (data.students?.length) {
        lines.push(`=== STUDENTS (${data.students.length} total) ===`);
        const byClass: Record<string, any[]> = {};
        for (const s of data.students) {
            const cls = s.class || 'Unknown';
            if (!byClass[cls]) byClass[cls] = [];
            byClass[cls].push(s);
        }
        for (const [cls, students] of Object.entries(byClass)) {
            const boys = students.filter((s: any) => s.gender === 'Male' || s.gender === 'male').length;
            const girls = students.length - boys;
            lines.push(`\n[${cls}] ${students.length} students (${boys}B/${girls}G):`);
            for (const s of students) {
                const parts = [
                    s.section ? `Sec:${s.section}` : '',
                    s.rollNo ? `Roll:${s.rollNo}` : '',
                    s.admissionNo ? `Adm:${s.admissionNo}` : '',
                    s.fatherName ? `Father:${s.fatherName}` : '',
                    s.motherName ? `Mother:${s.motherName}` : '',
                    s.mobileNo ? `Ph:${s.mobileNo}` : '',
                    s.gender ? `${s.gender}` : '',
                    s.dob ? `DOB:${fmtDate(s.dob)}` : '',
                    s.admissionDate ? `AdmDate:${fmtDate(s.admissionDate)}` : '',
                    s.admissionType ? `Type:${s.admissionType}` : '',
                    s.basicDues ? `Dues:\u20b9${s.basicDues}` : '',
                    s.status ? `[${s.status}]` : ''
                ].filter(Boolean).join(' | ');
                lines.push(`  ${s.name || 'N/A'} | ${parts}`);
            }
        }
    }

    // === EMPLOYEES / TEACHERS (full) ===
    if (data.employees?.length) {
        lines.push(`\n=== EMPLOYEES (${data.employees.length}) ===`);
        for (const e of data.employees) {
            const parts = [
                e.designation || e.role || 'Staff',
                e.department ? `Dept:${e.department}` : '',
                e.phone ? `Ph:${e.phone}` : '',
                e.salary ? `Salary:\u20b9${e.salary}` : '',
                e.qualification || '',
                e.joiningDate ? `Joined:${e.joiningDate}` : '',
                e.status ? `[${e.status}]` : ''
            ].filter(Boolean).join(' | ');
            lines.push(`  ${e.name || 'N/A'} | ${parts}`);
        }
    }

    // === FEE COLLECTIONS (full) ===
    if (data.fee_collections?.length) {
        const all = data.fee_collections;
        const totalAll = all.reduce((s: number, f: any) => s + (Number(f.amount) || 0), 0);
        const todayColl = all.filter((f: any) => (f.paymentDate || f.date || '').startsWith(today));
        const todayTotal = todayColl.reduce((s: number, f: any) => s + (Number(f.amount) || 0), 0);
        const monthColl = all.filter((f: any) => (f.paymentDate || f.date || '').startsWith(currentMonth));
        const monthTotal = monthColl.reduce((s: number, f: any) => s + (Number(f.amount) || 0), 0);

        lines.push(`\n=== FEE COLLECTIONS ===`);
        lines.push(`All-Time: \u20b9${totalAll} (${all.length} receipts)`);
        lines.push(`Today (${today}): \u20b9${todayTotal} (${todayColl.length} receipts)`);
        lines.push(`This Month: \u20b9${monthTotal} (${monthColl.length} receipts)`);
        if (todayColl.length) {
            lines.push(`Today's Details:`);
            for (const f of todayColl) {
                lines.push(`  ${f.studentName || 'N/A'} (${f.class || ''}) | \u20b9${f.amount} | ${f.paymentMode || ''} | Rcpt:${f.receiptNo || 'N/A'}`);
            }
        }
        lines.push(`Recent 30 Payments:`);
        for (const f of all.slice(-30)) {
            lines.push(`  ${f.studentName || 'N/A'} | \u20b9${f.amount} | ${f.month || ''} ${f.year || ''} | ${f.paymentDate || f.date || 'N/A'} | ${f.paymentMode || ''}`);
        }
    }

    // === STUDENT DUES (ALL students with dues — full data) ===
    if (data.student_dues?.length) {
        const allDues = data.student_dues;
        const totalDues = allDues.reduce((s: number, d: any) => s + (d.dues || 0), 0);
        lines.push(`\n=== STUDENT DUES REPORT (${allDues.length} students with outstanding dues, Total Collectable: \u20b9${totalDues}) ===`);

        const byClass: Record<string, any[]> = {};
        for (const d of allDues) {
            const cls = d.class || 'Unknown';
            if (!byClass[cls]) byClass[cls] = [];
            byClass[cls].push(d);
        }
        for (const [cls, students] of Object.entries(byClass)) {
            const classDues = students.reduce((s: number, d: any) => s + (d.dues || 0), 0);
            lines.push(`\n[${cls}] ${students.length} students, Total Due: \u20b9${classDues}`);
            for (const d of students) {
                const parts = [
                    d.admissionNo ? `Adm:${d.admissionNo}` : '',
                    d.section ? `Sec:${d.section}` : '',
                    d.fatherName ? `Father:${d.fatherName}` : '',
                    `Payable:\u20b9${d.totalPayable}`,
                    `Paid:\u20b9${d.totalPaid}`,
                    d.totalDiscount ? `Disc:\u20b9${d.totalDiscount}` : '',
                    d.basicDues ? `PrevDues:\u20b9${d.basicDues}` : '',
                    `DUE:\u20b9${d.dues}`,
                    d.phone ? `Ph:${d.phone}` : ''
                ].filter(Boolean).join(' | ');
                lines.push(`  ${d.name || 'N/A'} | ${parts}`);
            }
        }
    }

    // === ATTENDANCE (all records, last 10 days) ===
    if (data.attendance?.length) {
        lines.push(`\n=== ATTENDANCE (${data.attendance.length} records) ===`);
        const byDate: Record<string, any[]> = {};
        for (const a of data.attendance) {
            const d = a.date || 'Unknown';
            if (!byDate[d]) byDate[d] = [];
            byDate[d].push(a);
        }
        const sortedDates = Object.keys(byDate).sort().reverse().slice(0, 10);
        for (const date of sortedDates) {
            const recs = byDate[date];
            const absent = recs.filter((a: any) => a.status === 'ABSENT' || a.status === 'absent' || a.status === 'A');
            const late = recs.filter((a: any) => a.status === 'LATE' || a.status === 'late' || a.status === 'L');
            const present = recs.filter((a: any) => a.status === 'PRESENT' || a.status === 'present' || a.status === 'P');
            lines.push(`\n${date}${date === today ? ' (TODAY)' : ''}: P:${present.length} A:${absent.length} L:${late.length}`);
            if (absent.length) {
                lines.push(`  Absent: ${absent.map((a: any) => `${a.studentName || 'N/A'}(${a.class || ''})`).join(', ')}`);
            }
            if (late.length) {
                lines.push(`  Late: ${late.map((a: any) => `${a.studentName || 'N/A'}(${a.class || ''})`).join(', ')}`);
            }
        }
    }

    // === TEACHER ATTENDANCE (last 7 days) ===
    if (data.teacher_attendance?.length) {
        lines.push(`\n=== TEACHER ATTENDANCE ===`);
        const byDate: Record<string, any[]> = {};
        for (const a of data.teacher_attendance) {
            const d = a.date || 'Unknown';
            if (!byDate[d]) byDate[d] = [];
            byDate[d].push(a);
        }
        const sortedDates = Object.keys(byDate).sort().reverse().slice(0, 7);
        for (const date of sortedDates) {
            const recs = byDate[date];
            const absent = recs.filter((a: any) => a.status === 'ABSENT' || a.status === 'absent' || a.status === 'A');
            const late = recs.filter((a: any) => a.status === 'LATE' || a.status === 'late' || a.status === 'L');
            const present = recs.filter((a: any) => a.status === 'PRESENT' || a.status === 'present' || a.status === 'P');
            lines.push(`\n${date}${date === today ? ' (TODAY)' : ''}: P:${present.length} A:${absent.length} L:${late.length}`);
            if (absent.length) {
                lines.push(`  Absent: ${absent.map((a: any) => a.teacherName || 'N/A').join(', ')}`);
            }
            if (late.length) {
                lines.push(`  Late: ${late.map((a: any) => a.teacherName || 'N/A').join(', ')}`);
            }
        }
    }

    // === TRANSACTIONS (full) ===
    if (data.transactions?.length) {
        const exp = data.transactions.filter((t: any) => t.type === 'EXPENSE' || t.type === 'expense');
        const inc = data.transactions.filter((t: any) => t.type === 'INCOME' || t.type === 'income');
        lines.push(`\n=== TRANSACTIONS ===`);
        lines.push(`Income: \u20b9${inc.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0)} (${inc.length}) | Expense: \u20b9${exp.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0)} (${exp.length})`);
        for (const t of data.transactions.slice(-15)) {
            lines.push(`  ${t.type || ''} | \u20b9${t.amount} | ${t.category || t.ledgerName || ''} | ${t.date || ''} | ${(t.description || '').substring(0, 50)}`);
        }
    }

    // === NOTICES ===
    if (data.notices?.length) {
        lines.push(`\n=== NOTICES (${data.notices.length}) ===`);
        for (const n of data.notices.slice(-5)) {
            lines.push(`  ${n.title || 'N/A'}: ${(n.content || n.message || '').substring(0, 100)}`);
        }
    }

    // === TRANSPORT ===
    if (data.transport?.length) {
        lines.push(`\n=== TRANSPORT (${data.transport.length} routes) ===`);
        for (const t of data.transport) {
            lines.push(`  ${t.routeName || 'N/A'} | Driver:${t.driverName || 'N/A'} | ${t.vehicleNo || ''} | Ph:${t.phone || ''}`);
        }
    }

    return lines.join('\n');
}
