import React from 'react';
import LoginPortal from '../../components/auth/LoginPortal';
import { UserCog } from 'lucide-react';

const ManagerLogin: React.FC = () => {
    return (
        <LoginPortal
            portalType="MANAGER"
            title="Manager Portal"
            subtitle="Administrative delegate access"
            icon={UserCog}
            accentColor="#8b5cf6" // Purple
        />
    );
};

export default ManagerLogin;
