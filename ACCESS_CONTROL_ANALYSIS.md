# Access Control Analysis - Available Features

## Current Permission Structure (src/types/rbac.ts)

### 1. Dashboard Permissions
- ✅ `VIEW_DASHBOARD` - Dashboard देखने की permission
- ✅ `VIEW_STATS` - Statistics देखने की permission

### 2. Students Permissions
- ✅ `VIEW_STUDENTS` - Students list देखना
- ✅ `MANAGE_STUDENTS` - Students को add/edit/delete करना
- ✅ `ADMIT_STUDENT` - नए students को admit करना

### 3. Employees Permissions
- ✅ `VIEW_EMPLOYEES` - Teachers/Staff list देखना
- ✅ `MANAGE_EMPLOYEES` - Employees को manage करना
- ✅ `MANAGE_PAYROLL` - Payroll/Salary management

### 4. Finance Permissions
- ✅ `MANAGE_FEES` - Fee collection और management
- ✅ `COLLECT_FEES` - Fee collection specifically
- ✅ `VIEW_FEE_STRUCTURE` - Fee structure देखना

### 5. Accounts Permissions (❌ Missing in UserRoles.tsx)
- ✅ `MANAGE_ACCOUNTS` - Accounts/Expenses manage करना (Defined in rbac.ts)
- ✅ `VIEW_ACCOUNTS` - Accounts dashboard देखना (Defined in rbac.ts)
- ❌ **NOT showing in UserRoles permission groups**

### 6. Academic Permissions
- ✅ `MANAGE_ATTENDANCE` - Attendance लेना
- ✅ `MANAGE_EXAMS` - Exams create/manage करना
- ✅ `VIEW_EXAMS` - Exam results देखना
- ✅ `MANAGE_CALENDAR` - Academic calendar manage करना
- ✅ `MANAGE_HOMEWORK` - Homework assign/manage करना (Defined in rbac.ts)
- ❌ **MANAGE_HOMEWORK not showing in UserRoles permission groups**

### 7. Communication Permissions
- ✅ `MANAGE_NOTICES` - Notices create/delete करना
- ✅ `POST_NOTICE` - Notice post करना
- ✅ `MANAGE_GALLERY` - Gallery manage करना (Defined in rbac.ts)
- ✅ `VIEW_GALLERY` - Gallery देखना (Defined in rbac.ts)
- ❌ **Gallery permissions not showing in UserRoles permission groups**

### 8. Support Permissions
- ✅ `MANAGE_TRANSPORT` - Transport/Bus management
- ✅ `MANAGE_LIBRARY` - Library management

### 9. System Permissions
- ✅ `VIEW_REPORTS` - Reports देखना
- ✅ `MANAGE_SETTINGS` - Settings access
- ✅ `MANAGE_ROLES` - Roles manage करना
- ✅ `MANAGE_MANAGERS` - Managers manage करना (Defined in rbac.ts)
- ✅ `MANAGE_SCHOOLS` - Schools manage करना (Super Admin only, Defined in rbac.ts)
- ❌ **MANAGE_MANAGERS and MANAGE_SCHOOLS not showing in UserRoles permission groups**

### 10. AI Features
- ✅ `USE_AI_ASSISTANT` - AI assistant use करना

---

## Missing Permissions in UserRoles.tsx

आपको `UserRoles.tsx` की `permissionGroups` में ये add करने होंगे:

```typescript
const permissionGroups = {
    'Dashboard': [Permission.VIEW_DASHBOARD, Permission.VIEW_STATS],
    'Students': [Permission.VIEW_STUDENTS, Permission.MANAGE_STUDENTS, Permission.ADMIT_STUDENT],
    'Employees': [Permission.VIEW_EMPLOYEES, Permission.MANAGE_EMPLOYEES, Permission.MANAGE_PAYROLL],
    'Finance': [Permission.MANAGE_FEES, Permission.COLLECT_FEES, Permission.VIEW_FEE_STRUCTURE],
    
    // ⚠️ MISSING GROUP - ADD THIS
    'Accounts': [Permission.VIEW_ACCOUNTS, Permission.MANAGE_ACCOUNTS],
    
    'Academic': [
        Permission.MANAGE_ATTENDANCE, 
        Permission.MANAGE_EXAMS, 
        Permission.VIEW_EXAMS, 
        Permission.MANAGE_CALENDAR,
        // ⚠️ MISSING - ADD THIS
        Permission.MANAGE_HOMEWORK
    ],
    
    'Communication': [
        Permission.MANAGE_NOTICES, 
        Permission.POST_NOTICE,
        // ⚠️ MISSING - ADD THESE
        Permission.MANAGE_GALLERY,
        Permission.VIEW_GALLERY
    ],
    
    'Support': [Permission.MANAGE_TRANSPORT, Permission.MANAGE_LIBRARY],
    
    'System': [
        Permission.VIEW_REPORTS, 
        Permission.MANAGE_SETTINGS, 
        Permission.MANAGE_ROLES,
        // ⚠️ MISSING - ADD THESE
        Permission.MANAGE_MANAGERS,
        Permission.MANAGE_SCHOOLS
    ],
    
    'AI Features': [Permission.USE_AI_ASSISTANT],
};
```

---

## New Features Added Recently (Based on App.tsx Routes)

### ✅ Already Routed with Proper Permissions:
1. **Message Center** (`/messages`) - Using `Permission.VIEW_REPORTS`
   - `AdminChatMonitor` component
   - Admin can monitor all chats

2. **Attendance (Staff)** - Using `Permission.MANAGE_ATTENDANCE`
   - Teacher Attendance (`/attendance/staff`)
   - Staff Attendance Report (`/attendance/staff-report`)

3. **Homework Management** - Using `Permission.MANAGE_HOMEWORK`
   - Homework assignment (`/homework`)
   - Homework Report (`/homework/report`)

4. **Gallery Management** - Using `Permission.MANAGE_GALLERY`
   - Gallery settings (`/settings/gallery`)

5. **Accounts Module** - Using `Permission.VIEW_ACCOUNTS` & `Permission.MANAGE_ACCOUNTS`
   - Accounts Dashboard (`/accounts/dashboard`)
   - Expense Management (`/accounts/expenses`)

6. **School Management** - Using `Permission.MANAGE_SCHOOLS`
   - Multi-school setup (`/settings/schools`)

---

## Summary of Required Changes

### 1. Add Missing Permission Groups to UserRoles.tsx
- ✅ Accounts (VIEW_ACCOUNTS, MANAGE_ACCOUNTS)
- ✅ Homework (MANAGE_HOMEWORK) to Academic group
- ✅ Gallery (MANAGE_GALLERY, VIEW_GALLERY) to Communication group
- ✅ Managers & Schools (MANAGE_MANAGERS, MANAGE_SCHOOLS) to System group

### 2. Message Center Permission
Currently using `VIEW_REPORTS` permission for Message Center. Consider:
- Creating dedicated `VIEW_MESSAGES` or `MANAGE_MESSAGES` permission
- OR keep it as admin-only with `VIEW_REPORTS`

---

## Role-wise Default Access (Current Setup)

### SUPER_ADMIN
- ✅ सभी permissions including `USE_AI_ASSISTANT`

### ADMIN
- ✅ सभी permissions EXCEPT `USE_AI_ASSISTANT`
- Admin AI assistant को manually enable/disable कर सकता है

### MANAGER
- Dashboard, Stats
- View Students, Employees
- Collect Fees, View Fee Structure
- View Exams
- Manage Notices
- View Reports, Gallery

### TEACHER
- Dashboard
- View Students
- Manage Attendance
- View/Manage Exams
- Post Notice
- Manage Homework
- View Gallery

### ACCOUNTANT
- Dashboard
- Manage Fees, Collect Fees
- View Fee Structure
- View Reports

### PARENT
- Dashboard
- View Exams
- Manage Fees (for their child)
- View Gallery

### DRIVER
- Dashboard only

---

## Recommendations

1. **Message Center को dedicated permission दें** (optional):
   ```typescript
   MANAGE_MESSAGES: 'MANAGE_MESSAGES',
   VIEW_MESSAGES: 'VIEW_MESSAGES',
   ```

2. **Super Admin features को protect करें**:
   - `MANAGE_SCHOOLS` - Only for Super Admin
   - `MANAGE_MANAGERS` - Only for Super Admin/Admin

3. **Admin control improvements**:
   - Admin sirf wahi roles assign kar sake jo super admin ne enable kiye hain
   - Role status (ACTIVE/INACTIVE) properly reflect ho

---

## Next Steps

1. ✅ Review this analysis
2. ⏳ Update `UserRoles.tsx` with missing permission groups
3. ⏳ Verify all permissions are working correctly
4. ⏳ Manual testing required
