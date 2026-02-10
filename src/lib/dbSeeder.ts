import { db } from './firebase';
import { collection, getDocs, writeBatch, doc, setDoc, Timestamp, query, where, getDoc } from 'firebase/firestore';

// Indian student names for realistic data
const boyNames = ["Aarav", "Advait", "Aditya", "Akash", "Anish", "Arjun", "Ayush", "Chirag", "Dev", "Dhruv", "Harsh", "Ishaan", "Kabir", "Karan", "Krish", "Manav", "Nikhil", "Pranav", "Rahul", "Rohit", "Sahil", "Siddharth", "Tanmay", "Varun", "Vihaan", "Yash"];
const girlNames = ["Aanya", "Aditi", "Ananya", "Anushka", "Avni", "Dia", "Diya", "Ishita", "Kavya", "Kiara", "Meera", "Myra", "Navya", "Pari", "Prisha", "Riya", "Saanvi", "Sara", "Shriya", "Simran", "Tanvi", "Trisha", "Zara", "Zoya"];
const lastNames = ["Sharma", "Verma", "Gupta", "Singh", "Kumar", "Yadav", "Patel", "Mishra", "Jha", "Khan", "Ahmed", "Das", "Roy", "Reddy", "Nair", "Iyer", "Kulkarni", "Deshmukh", "Pandey", "Tiwari"];

const getRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/**
 * Wipes out student-related collections for a specific school.
 * PRESERVES: API keys, class master, fee types, and other settings
 */
export const clearDatabase = async (schoolId: string) => {
    if (!schoolId) throw new Error("School ID is required to wipe data");

    console.log(`🗑️  Wiping student data for school: ${schoolId}...`);
    const collections = ['students', 'attendance', 'fees', 'fee_collections', 'teachers', 'fee_structures', 'drivers'];

    for (const collName of collections) {
        try {
            const snapshot = await getDocs(query(collection(db, collName), where('schoolId', '==', schoolId)));
            if (snapshot.empty) continue;

            const batch = writeBatch(db);
            snapshot.docs.forEach((d) => {
                batch.delete(doc(db, collName, d.id));
            });
            await batch.commit();
            console.log(`  ✅ Cleared collection: ${collName}`);
        } catch (error) {
            console.error(`  ❌ Error clearing collection ${collName}:`, error);
        }
    }
    console.log("✅ School data wiped!\n");
};

export const seedDatabase = async (schoolId: string) => {
    if (!schoolId) throw new Error("School ID is required for seeding");
    console.log(`🌱 Seeding Data for school: ${schoolId}...\n`);

    // ==================== 1. SEED STUDENTS (Class 6-10) ====================
    console.log("👨‍🎓 Seeding Students...");
    const classes = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"];
    const sections = ["A", "B"];
    const studentsBatch = writeBatch(db);
    let currentMilNumber = Math.floor(1000 + Math.random() * 9000);
    const studentsData: any[] = [];

    for (const className of classes) {
        for (const section of sections) {
            for (let i = 1; i <= 5; i++) {
                const gender = getRandom(["Male", "Female"]);
                const fName = gender === "Male" ? getRandom(boyNames) : getRandom(girlNames);
                const lName = getRandom(lastNames);
                const admissionNo = `${schoolId.substring(0, 3).toUpperCase()}${currentMilNumber}`;
                const pin = Math.floor(1000 + Math.random() * 9000).toString();

                const studentData = {
                    schoolId,
                    fullName: `${fName} ${lName}`,
                    fatherName: `Mr. ${lName}`,
                    motherName: `Mrs. ${getRandom(lastNames)}`,
                    dob: '2012-05-15',
                    gender,
                    bloodGroup: "O+",
                    religion: "General",
                    state: "Bihar",
                    district: "Saran",
                    permanentAddress: "Main Colony, Ward 5",
                    presentAddress: "Main Colony, Ward 5",
                    pinCode: "841301",
                    mobileNo: `70040${Math.floor(10000 + Math.random() * 90000)}`,
                    admissionNo,
                    pin,
                    class: className,
                    section: section,
                    classRollNo: String(i),
                    financeType: "NORMAL",
                    status: "ACTIVE",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };

                const studentRef = doc(collection(db, "students"));
                studentsBatch.set(studentRef, studentData);
                studentsData.push({ ...studentData, firestoreId: studentRef.id });
                currentMilNumber++;
            }
        }
    }
    await studentsBatch.commit();

    // ==================== 2. SEED FEE COLLECTIONS ====================
    console.log("💰 Seeding Fees...");
    const feeBatch = writeBatch(db);
    studentsData.forEach((student) => {
        const feeRef = doc(collection(db, "fee_collections"));
        feeBatch.set(feeRef, {
            schoolId,
            studentId: student.firestoreId,
            studentName: student.fullName,
            admissionNo: student.admissionNo,
            class: student.class,
            section: student.section,
            month: "January",
            year: 2026,
            paid: 1500,
            total: 1500,
            date: new Date().toISOString(),
            paymentMode: "Cash",
            status: "PAID",
            receiptNo: `R${Math.floor(100000 + Math.random() * 900000)}`,
            createdAt: new Date().toISOString()
        });
    });
    await feeBatch.commit();

    // ==================== 3. SEED ATTENDANCE ====================
    const attBatch = writeBatch(db);
    studentsData.slice(0, 20).forEach((student) => {
        const attRef = doc(collection(db, "attendance"));
        attBatch.set(attRef, {
            schoolId,
            studentId: student.firestoreId,
            studentName: student.fullName,
            admissionNo: student.admissionNo,
            class: student.class,
            section: student.section,
            date: new Date().toISOString().split('T')[0],
            status: "PRESENT",
            createdAt: new Date().toISOString()
        });
    });
    await attBatch.commit();

    // ==================== 4. SEED TEACHERS ====================
    const teacherBatch = writeBatch(db);
    ["John Doe", "Jane Smith"].forEach((name, idx) => {
        const tRef = doc(collection(db, "teachers"));
        teacherBatch.set(tRef, {
            schoolId,
            name,
            employeeId: `EMP${idx + 101}`,
            employeeType: "Teacher",
            status: "ACTIVE",
            pin: "1234",
            mobile: `99887766${idx}0`,
            createdAt: new Date().toISOString()
        });
    });
    await teacherBatch.commit();

    console.log("🎉 Seeding Complete!\n");
};

/**
 * Seeds Subjects and Chapters for Science (8, 9, 10)
 */
export const seedAcademicStructure = async (schoolId: string) => {
    if (!schoolId) throw new Error("School ID is required");

    const scienceData = [
        {
            class: "Class 10",
            subject: "Science",
            chapters: [
                "1. Chemical Reactions and Equation",
                "2. Acid, Base and Salt",
                "3. Metals and Non-metals",
                "4. Carbon and its Compounds",
                "5. Life Processes",
                "6. Control and Coordination",
                "7. How do Organisms Reproduce",
                "8. Heredity",
                "9. Reflection and Refraction",
                "10. Human Eyes",
                "11. Electricity",
                "12. Magnetic Effects of Current",
                "13. Our Environment"
            ]
        },
        {
            class: "Class 9",
            subject: "Science",
            chapters: [
                "1. Matter in Our Surroundings",
                "2. Is Matter Around Us Pure?",
                "3. Atoms and Molecules",
                "4. Structure of the Atom",
                "5. The Fundamental Unit of Life",
                "6. Tissues",
                "7. Motion",
                "8. Force and Laws of Motion",
                "9. Gravitation",
                "10. Work and Energy",
                "11. Sound",
                "12. Improvement in Food Resources"
            ]
        },
        {
            class: "Class 8",
            subject: "Science",
            chapters: [
                "1. Crop Production and Management",
                "2. Microorganisms: Friend and Foe",
                "3. Coal and Petroleum",
                "4. Combustion and Flame",
                "5. Conservation of Plants and Animals",
                "6. Reproduction in Animals",
                "7. Reaching the Age of Adolescence",
                "8. Force and Pressure",
                "9. Friction",
                "10. Sound",
                "11. Chemical Effects of Electric Current",
                "12. Some Natural Phenomena",
                "13. Light"
            ]
        }
    ];

    try {
        const docRef = doc(db, 'settings', `academic_structure_${schoolId}`);
        const docSnap = await getDoc(docRef);

        let existingSubjects: any[] = [];
        if (docSnap.exists()) {
            existingSubjects = docSnap.data().subjects || [];
        }

        const updatedSubjects = [...existingSubjects];

        scienceData.forEach(data => {
            let subject = updatedSubjects.find(s => s.name === data.subject);

            if (!subject) {
                subject = {
                    name: data.subject,
                    enabledFor: [],
                    chaptersPerClass: {}
                };
                updatedSubjects.push(subject);
            }

            if (!subject.enabledFor.includes(data.class)) {
                subject.enabledFor.push(data.class);
            }

            subject.chaptersPerClass[data.class] = data.chapters;
        });

        await setDoc(docRef, {
            subjects: updatedSubjects,
            schoolId,
            type: 'academic_structure',
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log("✅ Science Academic Structure Seeded!");
    } catch (error) {
        console.error("Error seeding academic structure:", error);
        throw error;
    }
};

/**
 * Seeds a master list of 20 common school subjects for all active classes
 */
export const seedSubjectList = async (schoolId: string) => {
    if (!schoolId) throw new Error("School ID is required");

    const subjectList = [
        "Activity", "Bio", "Chemistry", "Computer", "Computer Practical",
        "Craft", "Current Affairs", "Deeniyat", "Drawing", "English",
        "English Grammar", "English Writing", "EVS", "GK", "Hindi",
        "Hindi Grammar", "Hindi Writing", "Islamic Studies", "Maths",
        "Maths Table", "Oration", "Physics", "Rhymes", "S.St.",
        "Science Practical", "Spelling", "Urdu"
    ];

    try {
        // 1. Get all active classes for this school
        const classesRef = collection(db, 'settings');
        const classSnap = await getDocs(query(classesRef, where('schoolId', '==', schoolId), where('type', '==', 'class'), where('active', '==', true)));
        const activeClasses = classSnap.docs.map(doc => doc.data().name);

        if (activeClasses.length === 0) {
            throw new Error("No active classes found. Please enable classes in Class Master first.");
        }

        const docRef = doc(db, 'settings', `academic_structure_${schoolId}`);
        const docSnap = await getDoc(docRef);

        let existingSubjects: any[] = [];
        if (docSnap.exists()) {
            existingSubjects = docSnap.data().subjects || [];
        }

        const updatedSubjects = [...existingSubjects];

        subjectList.forEach(name => {
            let subject = updatedSubjects.find(s => s.name.toLowerCase() === name.toLowerCase());

            if (!subject) {
                subject = {
                    name,
                    enabledFor: [...activeClasses],
                    chaptersPerClass: {}
                };
                // Initialize empty chapters for each class
                activeClasses.forEach(cls => {
                    subject.chaptersPerClass[cls] = [];
                });
                updatedSubjects.push(subject);
            } else {
                // If subject exists, ensure it's enabled for all active classes
                activeClasses.forEach(cls => {
                    if (!subject.enabledFor.includes(cls)) {
                        subject.enabledFor.push(cls);
                    }
                    if (!subject.chaptersPerClass[cls]) {
                        subject.chaptersPerClass[cls] = [];
                    }
                });
            }
        });

        await setDoc(docRef, {
            subjects: updatedSubjects,
            schoolId,
            type: 'academic_structure',
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log("✅ Subject Master List Seeded!");
    } catch (error) {
        console.error("Error seeding subject list:", error);
        throw error;
    }
};
