import React from 'react';
import LoginPortal from '../../components/auth/LoginPortal';
import { Heart } from 'lucide-react';

const ParentLogin: React.FC = () => {
    return (
        <LoginPortal
            portalType="PARENT"
            title="Parent Portal"
            subtitle="Follow your child's academic path"
            icon={Heart}
            accentColor="#0ea5e9" // Sky Blue
        />
    );
};

export default ParentLogin;
