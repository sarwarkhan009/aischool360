import React from 'react';
import LoginPortal from '../../components/auth/LoginPortal';
import { GraduationCap } from 'lucide-react';

const TeacherLogin: React.FC = () => {
    return (
        <LoginPortal
            portalType="TEACHER"
            title="Faculty Login"
            subtitle="Educational management system"
            icon={GraduationCap}
            accentColor="#10b981" // Emerald
        />
    );
};

export default TeacherLogin;
