import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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
    const examsRef = collection(db, 'exams');
    const snapshot = await getDocs(examsRef);

    const exams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

    exams.forEach(exam => {
        const targetClasses = exam.targetClasses || [];
        const routines = exam.classRoutines || [];
        console.log(`\n==============`);
        console.log(`Exam: ${exam.name} | ID: ${exam.id}`);
        console.log(`Target Classes (${targetClasses.length}): `, targetClasses);
        console.log(`Class Routines Configured (${routines.length}): `, routines.map((r: any) => r.classId));
    });

    console.log("DONE!");
}

checkExams().catch(console.error);
