# EnhancedExamScheduling.tsx - Bug Fixes & Architecture Notes

**Date**: 2026-03-01 | **File**: `src/pages/exams/EnhancedExamScheduling.tsx`

---

## ✅ Bug Fixes Applied (01 Mar 2026)

### Bug 1: Stale Closure (Main Culprit - Data Wipe)
**Problem**: Jab user edit modal me class checkbox ya koi field change karta tha, React ka purana `newExam` snapshot use hota tha. Result: `classRoutines` aur `targetClasses` empty ho jaate the silently.

**Fix**: Saare `setNewExam({...newExam, ...})` ko `setNewExam(prev => ({...prev, ...}))` me convert kiya:
- `displayName` onChange/onBlur
- `academicYear` onChange
- `term` onChange
- `assessmentType` onChange
- `startDate` onChange
- Class **checkbox** handlers (check/uncheck) ← **asli bug tha yahan**
- **Select All** button

---

### Bug 2: Safety Guard in `handleSaveExam`
**Problem**: Agar state kisi bhi wajah se empty ho jaaye, Firebase me `classRoutines: []` aur `targetClasses: []` save ho jaata tha.

**Fix**: Save karte waqt ab ye check hota hai:
```
safeTargetClasses = newExam.targetClasses.length > 0
    ? newExam.targetClasses
    : editingExam.targetClasses  ← fallback to original Firebase data
    
safeClassRoutines = newExam.classRoutines.length > 0
    ? newExam.classRoutines
    : editingExam.classRoutines  ← fallback to original Firebase data
```
**Kabhi bhi empty arrays Firebase me save nahi hongi.**

---

### Bug 3: Validation Change
`targetClasses?.length` check form validation se hata diya - ab `safeTargetClasses.length === 0` pe alert aata hai save ke time, jo fallback ke baad bhi check karta hai.

---

## 🆕 Features Added

### Auto-Backup System
Har `updateDocument` call se pehle ek snapshot `exam_backups` collection me save hota hai:
```
exam_backups/{auto-id}
  ├── examId
  ├── examName
  ├── schoolId
  ├── snapshot      ← poora purana exam object
  ├── targetClassesCount
  ├── classRoutinesCount
  ├── backedUpAt
  └── backedUpBy
```
Firebase Console → `exam_backups` → `examId` filter → `snapshot` copy → manually restore.

### Recover Classes Banner
Agar kisi exam ki `targetClasses` empty hai (0 classes), to card pe **yellow warning banner** dikhta hai with **🔄 Recover Classes** button.
- Ye `marks_entries` se us exam ka data recover karta hai
- `targetClasses` aur `classRoutines` dono restore karta hai

---

## 🏗️ Architecture Advice - File Split

### Abhi (4000+ lines) - Problems
| Problem | Impact |
|---|---|
| Build time slow | Vite/TypeScript pura file re-parse karta hai |
| Debugging mushkil | Bug dhundna time-consuming (8 hrs lage!) |
| Unnecessary re-renders | Ek change poora component re-render karta hai |
| Git merge conflicts | Team me multiple log ek hi file touch karte hain |

### Recommended Split (2-3 din baad karo)
```
pages/exams/
├── EnhancedExamScheduling.tsx     (~400 lines)  ← Main orchestrator only
├── components/
│   ├── ExamCard.tsx               (~300 lines)  ← Single exam card + action buttons
│   ├── ExamModal.tsx              (~600 lines)  ← Create/Edit modal Step 1: Settings
│   ├── ExamRoutineTab.tsx         (~600 lines)  ← Step 2: Class-wise routine editor
│   ├── ExamProgramView.tsx        (~300 lines)  ← Print/view routine
│   └── TeacherExamView.tsx        (~400 lines)  ← Teacher-only UI
└── hooks/
    └── useExamForm.ts             (~200 lines)  ← Form state + all handlers
```

### Shared State jo pass karni padegi
- `newExam`, `setNewExam` → `useExamForm` hook me move karo
- `editingExam`, `schoolClasses`, `schoolSubjects` → props
- `handleSaveExam`, `handleRecoverLostClasses` etc → `useExamForm` hook
- `resolveClassName`, `isClassInSchool` → separate `utils/examUtils.ts`

### ⚠️ Kyun abhi nahi karna
1. Fresh bug fix - stabilize hone do
2. Split me shared state management careful karna padta hai
3. Naye prop-drilling bugs aa sakte hain agar jaldi karo

---

## Console Logs (Debugging)
Save karte waqt browser console me dikhega:
```
[ExamSave] UPDATE "Annual Exam" | targetClasses: 13 | classRoutines: 13
[ExamBackup] ✅ Snapshot saved to exam_backups | classes: 13
```
Agar warning dikh rahi ho:
```
[ExamSave] ⚠️ targetClasses was empty in state — restored from editingExam
```
Matlab stale closure abhi bhi kuch edge case me trigger ho raha hai - further investigation needed.
