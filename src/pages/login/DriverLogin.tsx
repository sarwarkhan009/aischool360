import React from 'react';
import LoginPortal from '../../components/auth/LoginPortal';
import { Bus } from 'lucide-react';

const DriverLogin: React.FC = () => {
    return (
        <LoginPortal
            portalType="DRIVER"
            title="Driver Portal"
            subtitle="Transport tracking & fleet logs"
            icon={Bus}
            accentColor="#f59e0b" // Amber
        />
    );
};

export default DriverLogin;
