// Run this script once to create the default "Template 1" in Firestore
// You can run this from browser console or create a one-time admin action

import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const createDefaultTemplate = async () => {
    const defaultTemplate = {
        name: 'Template 1',
        description: 'Classic progress report design with modern aesthetics. Supports both single and combined exam reports.',
        accentColor: '#1e40af',
        headerStyle: 'modern',
        fontFamily: 'Inter, sans-serif',
        showLogo: true,
        includeGraphs: true,
        includeRemarks: true,
        signatures: {
            teacher: 'CLASS TEACHER',
            incharge: 'EXAMINATION IN-CHARGE',
            principal: 'PRINCIPAL / HEADMASTER'
        },
        customMessage: '{name} is a hardworking and dedicated student. {percentage >= 80 ? "Excellent performance this term." : "Shows good progress but needs more focus on core subjects."} Keep it up!',
        isPublic: true, // Available to all schools
        isDefault: true, // This is the default template
        supportsSingle: true,
        supportsMulti: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system'
    };

    try {
        const docRef = await addDoc(collection(db, 'report_card_templates'), defaultTemplate);
        console.log('✅ Default template created with ID:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('❌ Error creating default template:', error);
        throw error;
    }
};

// To run: Call createDefaultTemplate() from browser console or admin panel
// Example: await createDefaultTemplate()
