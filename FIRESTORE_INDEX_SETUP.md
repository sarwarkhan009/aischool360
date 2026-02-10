# Firestore Index Setup Instructions

## The Problem
The dashboard queries require Firestore composite indexes. Without these indexes, the queries will fail and show 0 data.

## Solutions

### Option 1: Click the Console Links (Easiest)
1. Open your browser's console (F12)
2. Look for the error messages with blue links
3. Click each link - it will take you to Firebase Console
4. Click "Create Index" button
5. Wait 2-5 minutes for each index to build

You need to create indexes for:
- ✅ `fee_collections` (schoolId + date)
- ✅ `students` (schoolId + createdAt)  
- ✅ `attendance` (schoolId + date)
- ✅ `teacherAttendance` (schoolId + date)

### Option 2: Deploy via Firebase CLI
Run this command in terminal:
```bash
firebase deploy --only firestore:indexes
```

### Option 3: Manual Creation in Firebase Console
1. Go to https://console.firebase.google.com
2. Select your project: `ai-school360`
3. Go to Firestore Database
4. Click "Indexes" tab
5. Click "Create Index"
6. Create each index with these settings:

**Index 1: fee_collections**
- Collection: `fee_collections`
- Field 1: `schoolId` (Ascending)
- Field 2: `date` (Ascending)

**Index 2: students** 
- Collection: `students`
- Field 1: `schoolId` (Ascending)
- Field 2: `createdAt` (Ascending)

**Index 3: attendance**
- Collection: `attendance`
- Field 1: `schoolId` (Ascending)
- Field 2: `date` (Ascending)

**Index 4: teacherAttendance**
- Collection: `teacherAttendance`  
- Field 1: `schoolId` (Ascending)
- Field 2: `date` (Ascending)

## After Creating Indexes
1. Wait 2-5 minutes for indexes to build
2. Refresh your dashboard
3. Check console logs for data being fetched
4. The cards should now show correct data!

## Debug Info
After refreshing, check the console logs for:
- `=== DASHBOARD DATE RANGES ===` - Shows the date ranges being queried
- `📊 Today's Fees: Found X records` - Number of fee records found
- `💰 Today's Collection Total: ₹X` - Calculated total
- `👨‍🎓 Student Attendance: X/Y = Z%` - Attendance calculation
- `👨‍🏫 Teacher Attendance: X/Y = Z%` - Teacher attendance calculation

If you see "Found 0 records", the data might not exist for today's date or there's a timezone issue.
