
export const seedTestData = () => {
    if (localStorage.getItem('aischool360_seeded_v1')) {
        console.log("Data already seeded.");
        return;
    }

    console.log("Seeding test data...");

    const classes = ['Class VI', 'Class VII', 'Class VIII', 'Class IX', 'Class X'];
    const sections = ['A', 'B'];
    const students: any[] = [];
    const fees: any[] = [];

    const dates = [
        '2025-12-25', '2025-12-26', '2025-12-27', '2025-12-28', '2025-12-29', '2025-12-30'
    ];

    let stuCounter = 1;

    classes.forEach(cls => {
        sections.forEach(sec => {
            // 5 Students per section
            const sectionStudents: any[] = [];

            for (let i = 0; i < 5; i++) {
                const id = `STU${stuCounter.toString().padStart(3, '0')}`;
                const name = `${getRandomName()} ${getRandomSurname()}`;

                const student = {
                    id,
                    name,
                    class: cls,
                    section: sec,
                    parentName: `${getRandomName()} Parent`,
                    phone: `+91 98765 ${Math.floor(10000 + Math.random() * 90000)}`,
                    admissionDate: '2025-01-15',
                    status: 'ACTIVE',
                    monthlyFee: 5000 + (classes.indexOf(cls) * 500) // Different fee per class
                };

                students.push(student);
                sectionStudents.push(student);

                // Fee Entry
                const totalFee = student.monthlyFee * 12;
                const paid = Math.floor(Math.random() * totalFee);
                fees.push({
                    id,
                    name,
                    class: cls,
                    section: sec,
                    totalFee,
                    paid,
                    due: totalFee - paid,
                    status: paid === totalFee ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID'
                });

                stuCounter++;
            }

            // Attendance for this section for all dates
            dates.forEach(date => {
                const key = `aischool360_attendance_${cls}_${sec}_${date}`;
                const records = sectionStudents.map(s => ({
                    id: s.id,
                    name: s.name,
                    status: Math.random() > 0.1 ? 'PRESENT' : (Math.random() > 0.5 ? 'ABSENT' : 'LATE')
                }));
                localStorage.setItem(key, JSON.stringify(records));
            });

            // Also set "current" attendance (no date suffix) for UI default
            const currentKey = `aischool360_attendance_${cls}_${sec}`;
            const currentRecords = sectionStudents.map(s => ({
                id: s.id,
                name: s.name,
                status: 'PRESENT' // Default for today
            }));
            localStorage.setItem(currentKey, JSON.stringify(currentRecords));
        });
    });

    localStorage.setItem('aischool360_students', JSON.stringify(students));
    localStorage.setItem('aischool360_fees', JSON.stringify(fees));
    localStorage.setItem('aischool360_seeded_v1', 'true');
    console.log("Seeding complete!");
};

const names = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan", "Diya", "Saanvi", "Ananya", "Aadhya", "Pari", "Anushka", "Navya", "Riya", "Myra", "Ira"];
const surnames = ["Sharma", "Verma", "Gupta", "Malhotra", "Bhatia", "Saxena", "Mehta", "Jain", "Singh", "Yadav", "Das", "Rao", "Nair", "Patel", "Reddy"];

function getRandomName() {
    return names[Math.floor(Math.random() * names.length)];
}

function getRandomSurname() {
    return surnames[Math.floor(Math.random() * surnames.length)];
}
