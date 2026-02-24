import { Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { HomePage } from './pages/HomePage';
import { ChatPage } from './pages/ChatPage';
import { ProfilePage } from './pages/ProfilePage';
import { ResumePage } from './pages/ResumePage';
import { JobsPage } from './pages/JobsPage';
import { LearningPage } from './pages/LearningPage';
import { LoginPage } from './pages/LoginPage';
import { AuthCallback } from './pages/AuthCallback';
import { OnboardingPage } from './pages/OnboardingPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/ui/ToastContainer';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RootRedirect } from './components/RootRedirect';
// Enhancement pages
import { SkillGapPage } from './pages/SkillGapPage';
import { InterviewPracticePage } from './pages/InterviewPracticePage';
import { CareerRoadmapPage } from './pages/CareerRoadmapPage';
import { AdvisorPage } from './pages/AdvisorPage';
import { ResumeBuilderPage } from './pages/ResumeBuilderPage';
import { AnalyticsDashboardPage } from './pages/AnalyticsDashboardPage';

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/onboarding" element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          } />

          <Route path="/" element={<MainLayout />}>
            <Route index element={<RootRedirect />} />
            <Route path="home" element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            } />
            <Route path="gini-chat" element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            } />
            <Route path="profile" element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } />
            <Route path="resume" element={
              <ProtectedRoute>
                <ResumePage />
              </ProtectedRoute>
            } />
            <Route path="jobs" element={
              <ProtectedRoute>
                <JobsPage />
              </ProtectedRoute>
            } />
            <Route path="learning" element={
              <ProtectedRoute>
                <LearningPage />
              </ProtectedRoute>
            } />
            <Route path="settings" element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            } />
            <Route path="resume-builder" element={
              <ProtectedRoute>
                <ResumeBuilderPage />
              </ProtectedRoute>
            } />
            {/* Enhancement Routes */}
            <Route path="skill-gaps" element={
              <ProtectedRoute>
                <SkillGapPage />
              </ProtectedRoute>
            } />
            <Route path="interview-practice" element={
              <ProtectedRoute>
                <InterviewPracticePage />
              </ProtectedRoute>
            } />
            <Route path="career-roadmap" element={
              <ProtectedRoute>
                <CareerRoadmapPage />
              </ProtectedRoute>
            } />
            <Route path="advisor" element={
              <ProtectedRoute>
                <AdvisorPage />
              </ProtectedRoute>
            } />
            <Route path="analytics" element={
              <ProtectedRoute>
                <AnalyticsDashboardPage />
              </ProtectedRoute>
            } />
            <Route path="applications" element={
              <ProtectedRoute>
                <PlaceholderPage title="Application Tracker" />
              </ProtectedRoute>
            } />
            <Route path="*" element={<PlaceholderPage title="404 Not Found" />} />
          </Route>
        </Routes>
      </AuthProvider>
      <ToastContainer />
    </ToastProvider>
  );
}

export default App;
