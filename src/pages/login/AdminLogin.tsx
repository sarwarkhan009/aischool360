import React from 'react';
import LoginPortal from '../../components/auth/LoginPortal';
import { Shield } from 'lucide-react';

const AdminLogin: React.FC = () => {
    return (
        <LoginPortal
            portalType="ADMIN"
            title="Admin Terminal"
            subtitle="Full system control gateway"
            icon={Shield}
            accentColor="#6366f1" // Primary Indigo
        />
    );
};

export default AdminLogin;
