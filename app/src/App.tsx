import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { ToastProvider } from './contexts/ToastContext';
import { AvatarPickerPage } from './pages/AvatarPickerPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { PlanEditorPage } from './pages/PlanEditorPage';
import { PromptPage } from './pages/PromptPage';
import { RequireAuth } from './pages/RequireAuth';
import WelcomePage from './pages/WelcomePage';

function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/welcome" element={<WelcomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<LoginPage initialMode="signup" />} />
              <Route path="/onboarding" element={<AvatarPickerPage />} />
              <Route
                path="/plan/new"
                element={
                  <RequireAuth>
                    <PromptPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/plan/:id"
                element={
                  <RequireAuth>
                    <PlanEditorPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <DashboardPage />
                  </RequireAuth>
                }
              />
              <Route path="/" element={<Navigate to="/welcome" replace />} />
              <Route path="*" element={<Navigate to="/welcome" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}

export default App;
