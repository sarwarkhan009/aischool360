# 📚 Exam Management - Complete Workflow Guide

> **Complete step-by-step guide for Exam Management system**  
> Last Updated: February 2026

---

## 🎯 Overview

Ye guide aapko **Exam Management System** ko use karne ka complete flow samjhayega. Har step detail mein explained hai.

---

## 📋 Complete Workflow

### **Step 1️⃣: Academic Year & Terms Setup** 
📍 **Location:** `Exam Management → Academic Year & Terms`

**Kya karna hai:**
- Sabse pehle academic year create karo (e.g., "2025-26")
- Start date aur end date set karo
- Terms/semesters define karo:
  - Term 1 (April - September)
  - Term 2 (October - March)
  - Final Term
- Har term ke liye start/end dates set karo
- Year ko **Active** mark karo

**⚠️ Important:**
- Ye sabse pehla step hai - **mandatory hai**
- Bina active academic year ke koi exam create nahi kar sakte
- Ek time mein sirf ek year active ho sakta hai

---

### **Step 2️⃣: Exam Configuration**
📍 **Location:** `Exam Management → Exam Configuration`

#### **A. Assessment Types Setup (Multi-Term Scenario)**

Agar aapke school mein har Term ka alag result aata hai, toh aapko **Term 1, Term 2, aur Term 3** teeno ke assessment types ek hi list mein banane honge.

**Example Multi-Term Setup:**

| Assessment Name | Short Name | Weightage | Term |
| :--- | :--- | :--- | :--- |
| **Unit Test 1** | UT1 | 10% | Term 1 |
| **Multiple Assessment 1** | MA1 | 10% | Term 1 |
| **Term 1 Exam** | T1 | 80% | Term 1 |
| *--- Total Term 1 ---* | | *100%* | |
| **Unit Test 2** | UT2 | 10% | Term 2 |
| **Multiple Assessment 2** | MA2 | 10% | Term 2 |
| **Term 2 Exam** | T2 | 80% | Term 2 |
| *--- Total Term 2 ---* | | *100%* | |

> [!IMPORTANT]
> Jab aap Term 2 ke parts add karenge, toh system ek warning dikhayega ki "Total weightage 100% se zyada hai". 
> **Ise ignore karein aur "Confirm" par click karein.** 
> Global list mein total 200% ya 300% ho sakta hai, system automatically marks ko calculate karte waqt sirf wahi types uthayega jo us specific Term ke liye scheduled hain.

---

**Example:**
```
Name: Unit Test 2
Short Name: UT2
Weightage: 10%
Description: Second periodic test for Term 2
```

#### **B. Grading System Setup**

**Kya karna hai:**
- Grading scheme define karein (Percentage, Letter, ya GPA).
- Grades ya Divisions create karein range ke sath.

**Scenario 1: Letter Grades (CBSE Style)**
- Grade A+ (90-100)
- Grade A (80-89)
- ...baaki configuration default pre-loaded hoti hai.

**Scenario 2: Division System (State Board Style)**
Agar aapko result mein 'Division' dikhana hai, toh ek naya Grading System banayein aur ranges aise set karein:

| Division Name | Range (Min - Max) | Description |
| :--- | :--- | :--- |
| **First Division** | 60% - 100% | Distinction/First |
| **Second Division** | 45% - 59% | Good Standing |
| **Third Division** | 35% - 44% | Pass |
| **Marginal** | 0% - 34% | Need Improvement |

> [!TIP]
> Modal mein "Add Range" button ka use karke aap jitni chahe utni divisions define kar sakte hain. Aap system ka naam "Division System" rakh sakte hain.

- **Pass Marks:** Ye har **Assessment Type** (Step 2A) ke modal mein set hota hai.
- **Grade Point System:** Ye **Grading System** (Step 2B) ke modal mein "GPA" type select karke configure hota hai.

---

### **Step 3️⃣: Schedule Exams** ⭐ **MAIN STEP**
📍 **Location:** `Exam Management → Schedule Exams`

**Kya karna hai:**

#### **A. Create New Exam**
1. **Add Exam** button click karo
2. Basic details fill karo:
   - Exam Name (e.g., "Mid-Term Exam 2025")
   - Academic Year select karo
   - Assessment Type select karo
   - Term select karo (optional)
   - Exam start/end date range

#### **B. Select Target Classes**
- Checkbox se select karo kis kis class ke liye exam hai
- Multiple classes select kar sakte ho
- Example: Class 6, 7, 8

#### **C. Add Subjects** 🔑 **CRITICAL**
Har subject ke liye ye details add karo:
- **Subject name** (e.g., Mathematics, Science)
- **Exam Date** (individual date for each subject)
- **Exam Time** (start time - e.g., 09:00 AM)
- **Duration** (minutes - e.g., 180 for 3 hours)
- **Max Marks** (e.g., 100)
- **Room Number** (optional - e.g., Room 101)

**Example:**
```
Subject: Mathematics
Date: 15-03-2025
Time: 09:00 AM
Duration: 180 minutes
Max Marks: 100
Room: Lab 1
```

#### **D. Publish Exam**
- Save as **Draft** (can edit later)
- When ready → Change status to **Published**
- Published ke baad hi marks entry aur admit cards available honge

---

### **Step 4️⃣: Exam Timetable** (Optional)
📍 **Location:** `Exam Management → Exam Timetable`

**Kya karna hai:**
- Calendar view mein slots manage karo
- **Auto-Generate** option use karo:
  - Step 3 mein jo schedule kiya, automatically slots create ho jayenge
- Ya manually add/edit karo individual slots
- Venue/room changes kar sakte ho

**Features:**
- Calendar view - month-wise
- Drag-drop slots (future feature)
- Filter by exam, class
- Print timetable PDF

---

### **Step 5️⃣: Print Admit Cards**
📍 **Location:** `Exam Management → Print Admit Card`

**Kya karna hai:**
1. Exam select karo dropdown se
2. Class/Section filter karo
3. Individual student select karo ya **Select All**
4. **Generate Admit Cards** button click karo
5. PDF download hoga - print kar do

**Admit Card mein kya hoga:**
- Student photo, name, admission number
- Class, section, roll number
- Exam name, dates
- Subject-wise timetable
- Instructions
- School logo & stamp area

**⚠️ Note:** Sirf **published** exams ke admit cards print ho sakte hain

---

### **Step 6️⃣: Manage Syllabus** (Optional)
📍 **Location:** `Exam Management → Manage Syllabus`

**Kya karna hai:**
- Exam select karo
- Subject-wise syllabus topics add karo
- Chapters/units list banao
- Weightage assign karo (optional)

**Example:**
```
Subject: Physics
Exam: Mid-Term 2025

Syllabus:
- Chapter 1: Motion (10 marks)
- Chapter 2: Force & Laws of Motion (15 marks)
- Chapter 3: Gravitation (10 marks)
```

**Benefits:**
- Students ko clear idea milega kya padhna hai
- Teachers ke liye reference
- Parent portal mein visible hoga

---

### **Step 7️⃣: Marks Entry** ⭐⭐ **MOST CRITICAL STEP**
📍 **Location:** `Exam Management → Marks Entry`

**Kya karna hai:**

#### **A. Select Exam & Subject**
1. Exam dropdown se select karo
2. Class select karo
3. Subject select karo
4. Student list automatically load hoga

#### **B. Enter Marks**
Har student ke liye:
- **Marks Obtained** enter karo
- **Absent** checkbox (agar student absent tha)
- Sistema automatically calculate karega:
  - Percentage
  - Grade (A+, A, B, etc.)
  - Pass/Fail status
- **Remarks** add kar sakte ho (optional)

**Example:**
```
Student: Rahul Kumar
Marks: 85/100
Auto-calculated:
  - Percentage: 85%
  - Grade: A
  - Status: Pass
Remarks: Good performance in theory section
```

#### **C. Save & Submit**
- **Save as Draft** - baad mein edit kar sakte ho
- **Submit for Approval** - marks lock ho jayenge
- Admin **Approve** karega
- Approved ke baad edit nahi kar sakte (lock)

**⚠️ Important:**
- Draft mein marks save kar sakte ho aur baad mein complete karo
- Submit sirf tab karo jab 100% confirm ho
- Approved marks report card mein show honge

**Status Flow:**
```
Draft → Submitted → Approved → Locked
```

---

### **Step 8️⃣: View Results**
📍 **Location:** `Exam Management → View Results`

**Kya karna hai:**
- Exam select karo
- Class/section filter karo
- **Approved marks** hi dikhengi
- Student-wise, subject-wise analysis dekho

**Features:**
- Overall class performance
- Subject-wise averages
- Top performers list
- Failed students list
- Export to Excel/PDF
- Print class result sheet

**Views Available:**
- Class Result Summary
- Individual Student Report
- Subject-wise Analysis
- Comparison with previous exams

---

### **Step 9️⃣: Performance Analytics** 📊
📍 **Location:** `Exam Management → Performance Analytics`

**Kya karna hai:**
- Exam select karo
- Automatically visual insights generate honge

**Analytics Available:**

#### **Charts & Graphs:**
1. **Class-wise Performance Bar Chart**
   - Har class ka pass percentage
   - Average marks comparison

2. **Grade Distribution Pie Chart**
   - Kitne students A+, A, B, C, D, F mein

3. **Subject-wise Radar Chart**
   - Konse subject strong, konse weak
   - Average scores comparison

4. **Trend Analysis**
   - Previous exams se comparison
   - Improvement/decline tracking

**Key Insights:**
- School average percentage
- Highest performing class
- Top subject
- Subjects needing attention
- Overall pass percentage

**Benefits:**
- Data-driven decisions le sakte ho
- Weak areas identify karo
- Teachers ko feedback do
- Parents ko detailed report

---

### **Step 🔟: Print Report Cards**
📍 **Location:** `Exam Management → Print Report Card`

**Kya karna hai:**
1. Exam select karo
2. Class/section filter karo
3. Students select karo (individual ya bulk)
4. Template choose karo (agar multiple templates hain)
5. **Generate Report Cards** click karo
6. PDF download → Bulk print

**Report Card mein kya hoga:**
- Student details (photo, name, class, roll no)
- Subject-wise marks table:
  - Max marks
  - Marks obtained
  - Grade
- Overall percentage & grade
- Attendance percentage
- Class teacher remarks
- Principal signature area
- School stamp

**⚠️ Prerequisites:**
- Marks entry **Approved** hona chahiye
- Attendance data filled hona chahiye (optional)
- Template customized hona chahiye (optional)

---

## 🎨 Bonus Features

### **📝 Customize Templates**
📍 **Location:** `Exam Management → Customize Templates`

**Kya kar sakte ho:**

#### **Admit Card Template:**
- Layout design karo (portrait/landscape)
- School logo position
- Header/footer customize
- Font styles, colors
- Instruction text
- QR code add (optional)

#### **Report Card Template:**
- Design select karo (modern, classic, minimal)
- Color scheme
- Logo & header
- Remark section positioning
- Grading table format
- Signature placement

**How to use:**
1. Template editor open karo
2. Drag-drop elements
3. Preview dekho
4. Save template
5. Set as default (optional)

---

### **❓ Question Generator** (AI-Powered)
📍 **Location:** `Exam Management → Question Generator`

**Kya kar sakte ho:**
- Subject select karo
- Topics choose karo
- Difficulty level set karo (Easy/Medium/Hard)
- Question types select karo:
  - MCQs
  - Short answer
  - Long answer
  - Fill in the blanks
- Number of questions
- **Generate** click karo
- AI automatically question paper banayega
- Edit kar sakte ho
- PDF export karo

**Benefits:**
- Time saving - manual typing nahi karni padegi
- Variety in questions
- Difficulty balance automatically hogi
- Blueprint ke according paper

---

## 📊 Dashboard Overview
📍 **Location:** `Exam Management → Dashboard`

**Quick Stats Dekho:**
- Total scheduled exams
- Ongoing exams
- Pending marks entries
- Completed exams
- Upcoming exam alerts

**Quick Actions:**
- Latest exam ka marks entry
- Generate admit cards
- View recent results
- Performance summary

---

## ⚠️ Important Notes & Tips

### **Workflow Sequence (Must Follow):**
```
1. Academic Year ✓
2. Exam Configuration ✓
3. Schedule Exam ✓
4. Publish Exam ✓
5. Print Admit Cards
6. Conduct Exam
7. Marks Entry → Approve ✓
8. View Results
9. Analytics Check
10. Print Report Cards
```

### **Common Mistakes to Avoid:**

❌ **Don't:**
- Academic year set kiye bina exam create karna
- Marks entry bina publish kiye exam mein try karna
- Draft marks ko directly approve kar dena bina review
- Report card print karna bina marks approve kiye

✅ **Do:**
- Har step sequentially follow karo
- Draft save karte raho (data loss se bachne ke liye)
- Marks entry se pehle double-check karo
- Backup regularly lo (exports)

### **Permission Requirements:**

Different roles ke liye access:
- **Admin/Principal:** Full access - sab kuch kar sakte hain
- **Manager:** Exam create, approve marks, print cards
- **Teacher:** Marks entry (sirf apne assigned subjects)
- **Student/Parent:** View only (results, admit cards)

### **Data Backup:**

Regular backups lo:
- Exam schedules export karo (Excel/PDF)
- Marks entries backup lo (CSV export)
- Report cards archive karo (PDF folder)
- Templates save karo

---

## 🆘 Troubleshooting

### **Q1: Exam publish nahi ho raha?**
**A:** Check karo:
- Academic year active hai ya nahi
- At least 1 class selected hai
- At least 1 subject added hai with date/time
- All required fields filled hain

### **Q2: Admit card print nahi ho raha?**
**A:** 
- Exam **Published** status mein hona chahiye
- Students enrolled hone chahiye selected class mein
- Template configured hona chahiye

### **Q3: Marks entry save nahi ho raha?**
**A:**
- Marks max marks se zyada to nahi?
- Network connection check karo
- Browser console mein errors dekho

### **Q4: Report card blank aa raha?**
**A:**
- Marks **Approved** status mein hone chahiye
- Template properly configured hona chahiye
- Student data complete hona chahiye (photo, admission no, etc.)

### **Q5: Analytics show nahi ho raha?**
**A:**
- At least 1 exam ke marks approved hone chahiye
- Exam select karo dropdown se
- Filter properly set karo (year/class)

---

## 📞 Support & Help

**Agar koi problem aaye:**
1. Is guide ko fir se carefully padho
2. Step-by-step images dekho (screenshots)
3. Admin/IT team se contact karo
4. Technical support: [Contact details]

---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 2026 | Initial workflow guide created |

---

**💡 Tip:** Is file ko bookmark kar lo aur exam time pe refer karte raho!

**📌 Quick Reference Path:** `d:\all\aischool360\EXAM_MANAGEMENT_GUIDE.md`
