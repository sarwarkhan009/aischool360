import React, { createContext, useContext, useState } from 'react';

import { Permission } from '../types/rbac';
import type { Role } from '../types/rbac';

interface User {
  username: string;
  name?: string;
  role: Role;
  permissions: Permission[];
  mobile?: string;
  id?: string;
  schoolId?: string;
  // Student/Parent specific fields
  photo?: string;
  admissionNo?: string;
  class?: string;
  section?: string;
  fatherName?: string;
  motherName?: string;
  // For account switching (e.g., parents with multiple children)
  allProfiles?: User[];
}

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    // Initial state from localStorage to prevent flicker
    const savedUser = localStorage.getItem('aischool360_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('aischool360_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('aischool360_user');
  };

  const hasPermission = (permission: Permission) => {
    if (!user) return false;

    // Load latest roles and overrides for real-time reactivity
    // This allows changes in Access Control to reflect immediately
    const customRoles = JSON.parse(localStorage.getItem('millat_custom_roles') || '[]');
    const userOverrides = JSON.parse(localStorage.getItem('millat_user_overrides') || '{}');

    const userId = user.id;
    const roleConfig = customRoles.find((r: any) => r.role === user.role || r.id === user.role);

    // Priority: User Override > Custom Role > Login Time User Permissions
    const activePermissions = (userId && userOverrides[userId])
      || roleConfig?.permissions
      || user.permissions;

    // AI Assistant is a special case with smart defaults:
    // - SUPER_ADMIN and ADMIN: Enabled by default (unless explicitly removed in overrides)
    // - Other roles: Must be explicitly granted in permissions
    if (permission === 'USE_AI_ASSISTANT') {
      // Check if explicitly disabled in overrides
      if (userId && userOverrides[userId]) {
        return userOverrides[userId].includes(permission);
      }
      // Check custom role config
      if (roleConfig?.permissions) {
        return roleConfig.permissions.includes(permission);
      }
      // Default: ADMIN and SUPER_ADMIN have access, others check their permissions
      if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;
      return user.permissions.includes(permission);
    }

    // Super admins always have all other permissions
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;

    return activePermissions.includes(permission);
  };


  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
