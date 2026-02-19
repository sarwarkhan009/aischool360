import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useParams, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SchoolProvider, useSchool } from './context/SchoolContext';
import DashboardLayout from './components/DashboardLayout';
import DynamicPWAConfig from './components/DynamicPWAConfig';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import StudentManagement from './pages/students/StudentManagement';
import EmployeeManagement from './pages/employees/EmployeeManagement';
import AttendanceManagement from './pages/AttendanceManagement';
import FeeManagement from './pages/fees/FeeManagement';
import ExamManagement from './pages/exams/ExamManagement';
import Transport from './pages/transport/Transport';
import DriverTracking from './pages/transport/DriverTracking';
import NoticeBoard from './pages/communication/NoticeBoard';
import MessageCenter from './pages/communication/MessageCenter';
import ReportsCenter from './pages/reports/ReportsCenter';
import StudentReport from './pages/students/StudentReport';
import ReRegReport from './pages/students/ReRegReport';
import DuesList from './pages/students/DuesList';
import AttendanceReport from './pages/AttendanceReport';
import TeacherAttendance from './pages/TeacherAttendance';
import StaffAttendanceReport from './pages/StaffAttendanceReport';
import LibraryManagement from './pages/library/LibraryManagement';
import AcademicCalendar from './pages/Calendar';
import StudentAdmission from './pages/students/StudentAdmission';
import FormSale from './pages/students/FormSale';
import BulkStudentUpload from './pages/students/BulkStudentUpload';
import StudentPromotion from './pages/students/StudentPromotion';
import StudentPhotoUpload from './pages/students/StudentPhotoUpload';
import BulkMarksUpload from './pages/exams/BulkMarksUpload';
import FeeStructure from './pages/fees/FeeStructure';
import FeeReport from './pages/fees/FeeReport';
import SetFeeAmount from './pages/fees/SetFeeAmount';
import DueReport from './pages/fees/DueReport';
import Payroll from './pages/employees/Payroll';
import UserProfile from './pages/settings/UserProfile';
import UserRoles from './pages/settings/UserRoles';
import UnifiedLogin from './pages/login/UnifiedLogin';
import ManagerManagement from './pages/settings/ManagerManagement';
import {
  ClassMaster,
  InventoryMaster,
  InstitutionInfo,
  DataSeeder,
  GeminiConfig,
  MapsConfig,
  PinManagement,
  AdminSecurityMaster,
  AdmissionNoSync,
  BankSettings,
  PrintFormSettings
} from './pages/settings/GeneralSettings';
import MasterControl from './pages/settings/MasterControl';
import PublicRegistration from './pages/students/PublicRegistration';
import RegistrationRequests from './pages/students/RegistrationRequests';
import RegistrationFields from './pages/settings/RegistrationFields';
import StudentAdmissionFields from './pages/settings/StudentAdmissionFields';
import QuestionGenerator from './pages/academics/QuestionGenerator';
import HomeworkManagement from './pages/academics/HomeworkManagement';
import HomeworkReport from './pages/academics/HomeworkReport';
import AcademicStructure from './pages/settings/AcademicStructure';
import GalleryManagement from './pages/settings/GalleryManagement';
import ExamTimeTable from './pages/exams/ExamTimeTable';
import AcademicYearManager from './pages/exams/AcademicYearManager';
import ExamConfiguration from './pages/exams/ExamConfiguration';
import EnhancedExamScheduling from './pages/exams/EnhancedExamScheduling';
import AdvancedMarksEntry from './pages/exams/AdvancedMarksEntry';
import ExamResultsDashboard from './pages/exams/ExamResultsDashboard';
import ExamAnalytics from './pages/exams/ExamAnalytics';
import SyllabusManager from './pages/exams/SyllabusManager';
import TemplateEditor from './pages/exams/TemplateEditor';
import PaymentSettings from './pages/settings/PaymentSettings';
import AdmitCards from './pages/exams/AdmitCards';
import CombinedReportCard from './pages/exams/CombinedReportCard';
import TemplateManagement from './pages/exams/TemplateManagement';
import ReportCards from './pages/exams/ReportCards';
import AccountsDashboard from './pages/accounts/AccountsDashboard';
import ExpenseManagement from './pages/accounts/ExpenseManagement';
import ProfileVerificationCenter from './pages/admin/ProfileVerificationCenter';
import SchoolManagement from './pages/settings/SchoolManagement';
import UploadHolidays from './pages/settings/UploadHolidays';
import SMGHS from './pages/public/SMGHS';
import RoutineManager from './components/RoutineManager';
import TeachingLogReports from './pages/TeachingLogReports';
import { Permission } from './types/rbac';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './lib/firebase';

/**
 * When Super Admin logs in without a school slug, we need to pick a school.
 * This component fetches the first active school and redirects there.
 */
const SuperAdminSchoolSelector = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const findSchool = async () => {
      try {
        const schoolsSnap = await getDocs(collection(db, 'schools'));
        const activeSchool = schoolsSnap.docs.find(d => {
          const data = d.data();
          return data.status === 'ACTIVE' || data.isActive === true;
        }) || schoolsSnap.docs[0];

        if (activeSchool) {
          navigate(`/${activeSchool.id}/dashboard`, { replace: true });
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error finding school:', err);
        setLoading(false);
      }
    };
    findSchool();
  }, [navigate]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #e5e7eb', borderTop: '4px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#6b7280', fontWeight: 500 }}>Loading schools...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem' }}>
      <p style={{ color: '#6b7280', fontSize: '1.25rem' }}>No schools found. Please create a school first.</p>
    </div>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredPermission?: Permission }> = ({ children, requiredPermission }) => {
  const { isAuthenticated, hasPermission, user } = useAuth();
  const { schoolId } = useParams();

  // Redirect to appropriate login page based on context
  if (!isAuthenticated) {
    return <Navigate to={schoolId ? `/${schoolId}/login` : "/login"} replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    // Find the first accessible page to redirect to (avoid infinite loop if dashboard is blocked)
    const fallbackRoutes = [
      { path: 'dashboard', permission: Permission.VIEW_DASHBOARD },
      { path: 'students', permission: Permission.VIEW_STUDENTS },
      { path: 'fees', permission: Permission.COLLECT_FEES },
      { path: 'attendance', permission: Permission.MANAGE_ATTENDANCE },
      { path: 'teachers', permission: Permission.VIEW_EMPLOYEES },
      { path: 'exams', permission: Permission.VIEW_EXAMS },
      { path: 'notices', permission: null }, // no permission needed
      { path: 'calendar', permission: null },
      { path: 'profile', permission: null },
    ];

    const firstAvailable = fallbackRoutes.find(r =>
      !r.permission || hasPermission(r.permission)
    );
    const fallbackPath = firstAvailable ? firstAvailable.path : 'profile';
    const target = schoolId ? `/${schoolId}/${fallbackPath}` : `/${fallbackPath}`;

    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
};

const RoutineRouteWrapper = () => {
  const { user, hasPermission } = useAuth();
  const isTeacher = user?.role === 'TEACHER';
  const canManage = hasPermission(Permission.MANAGE_SETTINGS);

  if (isTeacher || canManage) {
    return <RoutineManager
      isReadOnly={isTeacher && !canManage}
      fixedTeacherName={isTeacher ? (user?.name || user?.username || '') : undefined}
    />;
  }
  return <Navigate to="../dashboard" replace />;
};

// import { seedTestData } from './utils/seeder';

function App() {
  // React.useEffect(() => {
  //   seedTestData();
  // }, []);

  return (
    <ErrorBoundary>
      <Router>
        <SchoolProvider>
          <AuthProvider>
            <AuthWrapper />
          </AuthProvider>
        </SchoolProvider>
      </Router>
    </ErrorBoundary>
  );
}

const AuthWrapper = () => {
  const { isAuthenticated } = useAuth();
  const { currentSchool, loading: schoolLoading } = useSchool();

  if (schoolLoading) {
    return <div className="loading-container">Loading school configuration...</div>;
  }

  return (
    <>
      <DynamicPWAConfig />
      <Routes>
        {/* Root Route - Selection or Redirect */}
        <Route path="/" element={
          currentSchool ?
            (isAuthenticated ? <Navigate to={`/${currentSchool.id}/dashboard`} /> : <Navigate to={`/${currentSchool.id}/login`} />) :
            <Navigate to="/login" />
        } />

        {/* Public Login Routes */}
        <Route path="/login" element={!isAuthenticated ? <UnifiedLogin /> : (currentSchool ? <Navigate to={`/${currentSchool.id}/dashboard`} /> : <SuperAdminSchoolSelector />)} />
        <Route path="/register" element={<PublicRegistration />} />
        <Route path="/smghs" element={<SMGHS />} />

        {/* Dynamic School Routes */}
        <Route path="/:schoolId">
          <Route index element={<Navigate to="login" />} />
          <Route path="login" element={!isAuthenticated ? <UnifiedLogin /> : <Navigate to="../dashboard" replace />} />
          <Route path="register" element={<PublicRegistration />} />

          <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route path="dashboard" element={<ProtectedRoute requiredPermission={Permission.VIEW_DASHBOARD}><Dashboard /></ProtectedRoute>} />
            <Route path="profile-verifications" element={<ProfileVerificationCenter />} />

            {/* Student Routes */}
            <Route path="students" element={<ProtectedRoute requiredPermission={Permission.VIEW_STUDENTS}><StudentManagement /></ProtectedRoute>} />
            <Route path="students/admission" element={<ProtectedRoute requiredPermission={Permission.ADMIT_STUDENT}><StudentAdmission /></ProtectedRoute>} />
            <Route path="students/form-sale" element={<ProtectedRoute requiredPermission={Permission.ADMIT_STUDENT}><FormSale /></ProtectedRoute>} />
            <Route path="students/bulk-upload" element={<ProtectedRoute requiredPermission={Permission.ADMIT_STUDENT}><BulkStudentUpload /></ProtectedRoute>} />
            <Route path="students/registrations" element={<ProtectedRoute requiredPermission={Permission.VIEW_REGISTRATIONS}><RegistrationRequests /></ProtectedRoute>} />
            <Route path="students/report" element={<ProtectedRoute requiredPermission={Permission.VIEW_STUDENT_REPORTS}><StudentReport /></ProtectedRoute>} />
            <Route path="students/re-reg" element={<ProtectedRoute requiredPermission={Permission.VIEW_RE_REGISTRATION_REPORTS}><ReRegReport /></ProtectedRoute>} />
            <Route path="students/dues" element={<ProtectedRoute requiredPermission={Permission.VIEW_DUES_LIST}><DuesList /></ProtectedRoute>} />
            <Route path="students/promotion" element={<ProtectedRoute requiredPermission={Permission.PROMOTE_STUDENTS}><StudentPromotion /></ProtectedRoute>} />
            <Route path="students/photos" element={<ProtectedRoute requiredPermission={Permission.UPLOAD_STUDENT_PHOTO}><StudentPhotoUpload /></ProtectedRoute>} />

            {/* Teacher Routes */}
            <Route path="teachers" element={<ProtectedRoute requiredPermission={Permission.VIEW_EMPLOYEES}><EmployeeManagement /></ProtectedRoute>} />
            <Route path="teachers/payroll" element={<ProtectedRoute requiredPermission={Permission.MANAGE_PAYROLL}><Payroll /></ProtectedRoute>} />

            {/* Academic Routes */}
            <Route path="attendance" element={<ProtectedRoute requiredPermission={Permission.MANAGE_ATTENDANCE}><AttendanceManagement /></ProtectedRoute>} />
            <Route path="attendance/staff" element={<ProtectedRoute requiredPermission={Permission.MANAGE_STAFF_ATTENDANCE}><TeacherAttendance /></ProtectedRoute>} />

            <Route path="question-generator" element={<ProtectedRoute requiredPermission={Permission.GENERATE_QUESTIONS}><QuestionGenerator /></ProtectedRoute>} />
            <Route path="exams" element={<ProtectedRoute requiredPermission={Permission.VIEW_EXAMS}><ExamManagement /></ProtectedRoute>} />
            <Route path="academic-year-manager" element={<ProtectedRoute requiredPermission={Permission.MANAGE_SETTINGS}><AcademicYearManager /></ProtectedRoute>} />
            <Route path="exam-configuration" element={<ProtectedRoute requiredPermission={Permission.MANAGE_SETTINGS}><ExamConfiguration /></ProtectedRoute>} />
            <Route path="exam-scheduling" element={<ProtectedRoute requiredPermission={Permission.MANAGE_EXAM_TIMETABLE}><EnhancedExamScheduling /></ProtectedRoute>} />
            <Route path="exam-timetable" element={<ProtectedRoute requiredPermission={Permission.MANAGE_EXAM_TIMETABLE}><ExamTimeTable /></ProtectedRoute>} />
            <Route path="admit-cards" element={<ProtectedRoute requiredPermission={Permission.PRINT_ADMIT_CARDS}><AdmitCards /></ProtectedRoute>} />
            <Route path="advanced-marks-entry" element={<ProtectedRoute requiredPermission={Permission.ENTER_MARKS}><AdvancedMarksEntry /></ProtectedRoute>} />
            <Route path="exams/bulk-marks-upload" element={<ProtectedRoute requiredPermission={Permission.ENTER_MARKS}><BulkMarksUpload /></ProtectedRoute>} />
            <Route path="marks-entry" element={<Navigate to="advanced-marks-entry" replace />} />
            <Route path="exam-results" element={<ProtectedRoute requiredPermission={Permission.VIEW_EXAMS}><ExamResultsDashboard /></ProtectedRoute>} />
            <Route path="exam-analytics" element={<ProtectedRoute requiredPermission={Permission.VIEW_EXAMS}><ExamAnalytics /></ProtectedRoute>} />
            <Route path="exam-syllabus" element={<ProtectedRoute requiredPermission={Permission.MANAGE_EXAM_TIMETABLE}><SyllabusManager /></ProtectedRoute>} />
            <Route path="exam-templates" element={<ProtectedRoute requiredPermission={Permission.MANAGE_EXAMS}><TemplateEditor /></ProtectedRoute>} />
            <Route path="exams/template-management" element={<ProtectedRoute requiredPermission={Permission.MANAGE_EXAMS}><TemplateManagement /></ProtectedRoute>} />
            <Route path="exams/report-cards" element={<ProtectedRoute requiredPermission={Permission.PRINT_REPORT_CARDS}><ReportCards /></ProtectedRoute>} />
            <Route path="report-cards" element={<ProtectedRoute requiredPermission={Permission.PRINT_REPORT_CARDS}><CombinedReportCard /></ProtectedRoute>} />
            <Route path="homework" element={<ProtectedRoute requiredPermission={Permission.MANAGE_HOMEWORK}><HomeworkManagement /></ProtectedRoute>} />
            <Route path="homework/report" element={<ProtectedRoute requiredPermission={Permission.VIEW_HOMEWORK_REPORTS}><HomeworkReport /></ProtectedRoute>} />
            <Route path="calendar" element={<AcademicCalendar />} />
            <Route path="routine" element={
              <ProtectedRoute>
                <RoutineRouteWrapper />
              </ProtectedRoute>
            } />

            {/* Finance Routes */}
            <Route path="fees" element={<ProtectedRoute requiredPermission={Permission.COLLECT_FEES}><FeeManagement /></ProtectedRoute>} />
            <Route path="fees/structure" element={<ProtectedRoute requiredPermission={Permission.VIEW_FEE_STRUCTURE}><FeeStructure /></ProtectedRoute>} />
            <Route path="fees/set-amount" element={<ProtectedRoute requiredPermission={Permission.SET_FEE_AMOUNT}><SetFeeAmount /></ProtectedRoute>} />
            <Route path="fees/report" element={<ProtectedRoute requiredPermission={Permission.VIEW_FEE_REPORTS}><FeeReport /></ProtectedRoute>} />
            <Route path="fees/dues" element={<ProtectedRoute requiredPermission={Permission.VIEW_DUE_REPORTS}><DueReport /></ProtectedRoute>} />

            {/* Accounts Routes */}
            <Route path="accounts/dashboard" element={<ProtectedRoute requiredPermission={Permission.VIEW_ACCOUNTS}><AccountsDashboard /></ProtectedRoute>} />
            <Route path="accounts/expenses" element={<ProtectedRoute requiredPermission={Permission.MANAGE_ACCOUNTS}><ExpenseManagement /></ProtectedRoute>} />

            {/* Support Routes */}
            <Route path="transport" element={<ProtectedRoute requiredPermission={Permission.MANAGE_TRANSPORT}><Transport /></ProtectedRoute>} />
            <Route path="library" element={<ProtectedRoute requiredPermission={Permission.MANAGE_LIBRARY}><LibraryManagement /></ProtectedRoute>} />
            <Route path="notices" element={<NoticeBoard />} />
            <Route path="messages" element={<ProtectedRoute requiredPermission={Permission.VIEW_MESSAGES}><MessageCenter /></ProtectedRoute>} />
            <Route path="teaching-logs" element={<ProtectedRoute requiredPermission={Permission.VIEW_TEACHING_LOGS}><TeachingLogReports /></ProtectedRoute>} />
            <Route path="profile" element={<UserProfile />} />

            {/* Driver Routes */}
            <Route path="driver/tracking" element={<ProtectedRoute><DriverTracking /></ProtectedRoute>} />

            {/* Admin only Routes */}
            <Route path="reports" element={<ProtectedRoute requiredPermission={Permission.VIEW_REPORTS}><ReportsCenter /></ProtectedRoute>} />
            <Route path="settings" element={<Outlet />}>
              <Route index element={<Navigate to="class-master" replace />} />
              <Route path="profile" element={<UserProfile />} />
              <Route path="roles" element={<ProtectedRoute requiredPermission={Permission.MANAGE_ROLES}><UserRoles /></ProtectedRoute>} />
              <Route path="class-master" element={<ProtectedRoute requiredPermission={Permission.MANAGE_CLASSES}><ClassMaster /></ProtectedRoute>} />
              <Route path="inventory" element={<ProtectedRoute requiredPermission={Permission.MANAGE_INVENTORY}><InventoryMaster /></ProtectedRoute>} />
              <Route path="institution" element={<ProtectedRoute requiredPermission={Permission.MANAGE_INSTITUTION}><InstitutionInfo /></ProtectedRoute>} />
              <Route path="api-keys" element={<ProtectedRoute requiredPermission={Permission.MANAGE_API_KEYS}><div className="animate-fade-in glass-card" style={{ padding: '2rem' }}><GeminiConfig /><hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid var(--border)' }} /><MapsConfig /></div></ProtectedRoute>} />
              <Route path="data-seeder" element={<ProtectedRoute requiredPermission={Permission.MANAGE_DATA_SEEDER}><div className="animate-fade-in responsive-grid-auto" style={{ gap: '2rem' }}><DataSeeder /><PinManagement /><AdminSecurityMaster /><AdmissionNoSync /><BankSettings /><PrintFormSettings /></div></ProtectedRoute>} />
              <Route path="print-design" element={<ProtectedRoute requiredPermission={Permission.MANAGE_PRINT_DESIGN}><PrintFormSettings /></ProtectedRoute>} />
              <Route path="master-control" element={<ProtectedRoute requiredPermission={Permission.MANAGE_MASTER_CONTROL}><MasterControl /></ProtectedRoute>} />
              <Route path="payments" element={<ProtectedRoute requiredPermission={Permission.MANAGE_PAYMENT_SETTINGS}><PaymentSettings /></ProtectedRoute>} />
              <Route path="upload-holidays" element={<ProtectedRoute requiredPermission={Permission.UPLOAD_HOLIDAYS}><UploadHolidays /></ProtectedRoute>} />
              <Route path="subjects-chapters" element={<ProtectedRoute requiredPermission={Permission.MANAGE_ACADEMIC_STRUCTURE}><AcademicStructure /></ProtectedRoute>} />
              <Route path="gallery" element={<ProtectedRoute requiredPermission={Permission.MANAGE_GALLERY}><GalleryManagement /></ProtectedRoute>} />
              <Route path="registration-fields" element={<ProtectedRoute requiredPermission={Permission.MANAGE_REGISTRATION_FIELDS}><RegistrationFields /></ProtectedRoute>} />
              <Route path="student-admission-fields" element={<ProtectedRoute requiredPermission={Permission.MANAGE_ADMISSION_FIELDS}><StudentAdmissionFields /></ProtectedRoute>} />
              <Route path="schools" element={<ProtectedRoute requiredPermission={Permission.MANAGE_SCHOOLS}><SchoolManagement /></ProtectedRoute>} />
            </Route>

            <Route path="*" element={<div style={{ padding: '2rem' }}><h2>Page Not Found</h2></div>} />
          </Route>
        </Route>

        {/* Legacy/Fallback Routes - Redirect to school context if available */}
        <Route path="/dashboard" element={currentSchool ? <Navigate to={`/${currentSchool.id}/dashboard`} /> : (isAuthenticated ? <SuperAdminSchoolSelector /> : <Navigate to="/login" />)} />
        <Route path="/dashboard/*" element={currentSchool ? <Navigate to={`/${currentSchool.id}/dashboard`} /> : (isAuthenticated ? <SuperAdminSchoolSelector /> : <Navigate to="/login" />)} />
        <Route path="/settings/*" element={currentSchool ? <Navigate to={`/${currentSchool.id}/settings`} /> : (isAuthenticated ? <SuperAdminSchoolSelector /> : <Navigate to="/login" />)} />
        <Route path="/manager" element={<Navigate to="/" />} />
        <Route path="/teacher" element={<Navigate to="/" />} />
        <Route path="/driver" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
};

export default App;
