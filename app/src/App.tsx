import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { ToastProvider } from './contexts/ToastContext';
import { AvatarPickerPage } from './pages/AvatarPickerPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { PlanEditorPage } from './pages/PlanEditorPage';
import { PromptPage } from './pages/PromptPage';

function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/plan/new" replace />} />
              <Route path="/plan/new" element={<PromptPage />} />
              <Route path="/plan/:id" element={<PlanEditorPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/onboarding" element={<AvatarPickerPage />} />
              <Route path="*" element={<Navigate to="/plan/new" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}

export default App;
