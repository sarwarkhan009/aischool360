import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLocation } from 'react-router-dom';

interface SchoolData {
    id: string;
    name: string;
    fullName?: string;
    logoUrl?: string; // New standardized field
    logo?: string; // Backward compatibility
    themeColor?: string;
    address?: string;
    email?: string;
    phone?: string;
    website?: string;
    web?: string; // Backward compatibility
    contactPerson?: string;
    contactNumber?: string;
    schoolId?: string; // Alternative ID field for backward compatibility
    customTitle?: string; // Custom browser title
    status: 'ACTIVE' | 'INACTIVE';
    isActive?: boolean; // Backward compatibility
    allowedModules: string[];
    admissionNumberPrefix?: string;
    admissionNumberStartNumber?: string;
    useRomanNumerals?: boolean;
    selectedReportCardTemplateId?: string;
    principalSignatureUrl?: string; // Principal signature image
    enableWatermark?: boolean; // Enable/disable watermark
    academicYearStartMonth?: string; // Academic year start month (e.g., "April", "March")
}

interface SchoolContextType {
    currentSchool: SchoolData | null;
    loading: boolean;
    error: string | null;
    updateSchoolData?: (data: Partial<SchoolData>) => Promise<void>;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentSchool, setCurrentSchool] = useState<SchoolData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const location = useLocation();

    const updateSchoolData = async (data: Partial<SchoolData>) => {
        if (!currentSchool) return;

        const { updateDoc } = await import('firebase/firestore');
        const schoolRef = doc(db, 'schools', currentSchool.id);
        await updateDoc(schoolRef, data);

        setCurrentSchool(prev => prev ? { ...prev, ...data } : null);
    };

    useEffect(() => {
        const detectSchool = async () => {
            setLoading(true);
            setError(null);

            try {
                const pathSegments = location.pathname.split('/');
                let schoolId = '';

                // 1. Check Path Segment (e.g., /school1/login)
                // Filter out common top-level routes to avoid misidentifying them as schools
                const reservedRoutes = ['login', 'register', 'admin', 'dashboard', 'settings', 'students', 'teachers', 'fees', 'attendance', 'exams', 'transport', 'library', 'communication', 'calendar', 'reports', 'accounts'];

                if (pathSegments[1] && pathSegments[1] !== '' && !reservedRoutes.includes(pathSegments[1])) {
                    schoolId = pathSegments[1];
                }

                if (schoolId) {
                    // Try exact match
                    let schoolDoc = await getDoc(doc(db, 'schools', schoolId));

                    // Fallback: try with leading slash if exact match fails (for legacy data)
                    if (!schoolDoc.exists()) {
                        schoolDoc = await getDoc(doc(db, 'schools', `/${schoolId}`));
                    }

                    if (schoolDoc.exists()) {
                        setCurrentSchool({ id: schoolDoc.id, ...schoolDoc.data() } as SchoolData);
                    } else {
                        console.warn(`School with ID ${schoolId} not found`);
                        setCurrentSchool(null);
                    }
                } else {
                    setCurrentSchool(null);
                }
            } catch (err) {
                console.error('Error detecting school:', err);
                setError('Failed to load school configuration');
            } finally {
                setLoading(false);
            }
        };

        detectSchool();
    }, [location.pathname]);

    return (
        <SchoolContext.Provider value={{ currentSchool, loading, error, updateSchoolData }}>
            {children}
        </SchoolContext.Provider>
    );
};

export const useSchool = () => {
    const context = useContext(SchoolContext);
    if (context === undefined) {
        throw new Error('useSchool must be used within a SchoolProvider');
    }
    return context;
};
