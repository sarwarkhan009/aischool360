import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

// Firebase configuration (same as your main config)
const firebaseConfig = {
    apiKey: "AIzaSyBNqeNwj-s1dXwEQkwSRSdWXYfC3wRB6dE",
    authDomain: "millat-erp.firebaseapp.com",
    projectId: "millat-erp",
    storageBucket: "millat-erp.firebasestorage.app",
    messagingSenderId: "536621078149",
    appId: "1:536621078149:web:a42a3f9e1e70a2fb5fcdf3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

async function generatePinsForAllStudents() {
    try {
        console.log('🔍 Fetching all students from Firestore...');

        const studentsRef = collection(db, 'students');
        const snapshot = await getDocs(studentsRef);

        console.log(`📊 Found ${snapshot.size} students in database`);

        let updatedCount = 0;
        let skippedCount = 0;

        for (const studentDoc of snapshot.docs) {
            const studentData = studentDoc.data();

            // Check if student already has a PIN
            if (!studentData.pin) {
                const newPin = generatePin();

                // Update the student document with the new PIN
                await updateDoc(doc(db, 'students', studentDoc.id), {
                    pin: newPin,
                    updatedAt: new Date().toISOString()
                });

                console.log(`✅ Generated PIN ${newPin} for student: ${studentData.name || studentData.fullName} (ID: ${studentDoc.id})`);
                updatedCount++;
            } else {
                console.log(`⏭️  Student ${studentData.name || studentData.fullName} already has PIN: ${studentData.pin}`);
                skippedCount++;
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log('✨ PIN Generation Complete!');
        console.log(`✅ Updated: ${updatedCount} students`);
        console.log(`⏭️  Skipped: ${skippedCount} students (already had PINs)`);
        console.log('='.repeat(50));

        process.exit(0);
    } catch (error) {
        console.error('❌ Error generating PINs:', error);
        process.exit(1);
    }
}

// Run the script
generatePinsForAllStudents();
