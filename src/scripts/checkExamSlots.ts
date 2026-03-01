import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

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

async function checkSlots() {
    const slotsRef = collection(db, 'exam_slots');
    const snapshot = await getDocs(slotsRef);

    const slots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`\nTotal Slots found: ${slots.length}`);

    // Group slots by exam Name
    const slotsByExam: any = {};
    slots.forEach((s: any) => {
        const eName = s.examName || "Unknown Exam";
        if (!slotsByExam[eName]) slotsByExam[eName] = [];
        slotsByExam[eName].push(s);
    });

    Object.keys(slotsByExam).forEach(key => {
        console.log(`\n==============`);
        console.log(`Exam: ${key}`);
        const examSlots = slotsByExam[key];
        console.log(`Total slots: ${examSlots.length}`);

        const classesCount: any = {};
        examSlots.forEach((s: any) => {
            classesCount[s.class] = (classesCount[s.class] || 0) + 1;
        });
        console.log(`Classes involved:`);
        Object.keys(classesCount).forEach(c => {
            console.log(`  - Class ${c}: ${classesCount[c]} subjects`);
        });
    });

    console.log("DONE!");
}

checkSlots().catch(console.error);
