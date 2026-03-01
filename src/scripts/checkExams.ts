import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import * as fs from 'fs';

const firebaseConfig = {
    apiKey: "AIzaSyCe-UiH-tAdsalwqZqpMjd4w1mci509aT4",
    authDomain: "ai-school360.firebaseapp.com",
    projectId: "ai-school360",
    storageBucket: "ai-school360.firebasestorage.app",
    messagingSenderId: "224285030074",
    appId: "1:224285030074:web:e53896e81e4e98ad07b483"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkExams() {
    console.log("Fetching exams...");
    const examsRef = collection(db, 'exams');
    const snapshot = await getDocs(examsRef);

    const exams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    console.log(`Found ${exams.length} exams.`);

    let issuesFound = 0;

    exams.forEach(exam => {
        const targetClasses = exam.targetClasses || [];
        const routines = exam.classRoutines || [];

        if (routines.length > 0 && targetClasses.length === 0) {
            console.log(`\nExam ID: ${exam.id} | Name: ${exam.name}`);
            console.log(`ISSUE: targetClasses is empty, but classRoutines has ${routines.length} entries.`);
            const recoveredClasses = routines.map((r: any) => r.classId);
            console.log(`Recoverable Target Classes: ${recoveredClasses.join(", ")}`);
            issuesFound++;
        } else {
            // console.log(`Exam ${exam.name}: OK`);
        }
    });

    if (issuesFound === 0) {
        console.log("No missing targetClasses found (maybe the data was actually overwritten deeply).");
    }
}

checkExams().catch(console.error);
