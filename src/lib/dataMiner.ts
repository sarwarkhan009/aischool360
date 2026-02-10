import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

/**
 * Fetches comprehensive ERP data from Firestore for AI analysis
 * This provides the AI assistant with complete access to all database fields
 */
export const getMinifiedERPData = async () => {
    try {
        const context: any = {
            timestamp: new Date().toISOString(),
            students: [],
            employees: [],
            fee_collections: [], // Actual income
            transactions: [],    // Other income/expenses
            fees: [],            // Legacy or structure
            attendance: [],
            notices: [],
            transport: []
        };

        // Fetch Students with ALL fields
        try {
            const studentsSnapshot = await getDocs(collection(db, 'students'));
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
            const employeesSnapshot = await getDocs(collection(db, 'teachers'));
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
                    phone: data.phone
                };
            });
        } catch (err) {
            console.warn('Failed to fetch employees:', err);
        }

        // Fetch Actual Fee Collections (Income)
        try {
            const feeCollSnapshot = await getDocs(collection(db, 'fee_collections'));
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
                    paymentMode: data.paymentMode
                };
            });
        } catch (err) {
            console.warn('Failed to fetch fee collections:', err);
        }

        // Fetch General Transactions (Expenses & Other Income)
        try {
            const transSnapshot = await getDocs(collection(db, 'transactions'));
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
            const feesSnapshot = await getDocs(collection(db, 'fees'));
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

        // Fetch Attendance Summary (Last 30 days)
        try {
            const attendanceSnapshot = await getDocs(collection(db, 'attendance'));
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

        // Fetch Transport (Drivers)
        try {
            const transportSnapshot = await getDocs(collection(db, 'drivers'));
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

        // Add summary statistics for the AI
        context.summary = {
            totalStudents: context.students.length,
            totalEmployees: context.employees.length,
            totalIncomeEntries: context.fee_collections.length,
            totalExpenseEntries: context.transactions.filter((t: any) => t.type === 'EXPENSE').length,
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
