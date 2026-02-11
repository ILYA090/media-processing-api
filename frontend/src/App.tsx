import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

// Auth Pages
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';

// Main Pages
import { DashboardPage } from '@/pages/DashboardPage';
import { UploadPage } from '@/pages/UploadPage';
import { MediaLibraryPage } from '@/pages/MediaLibraryPage';
import { ProcessPage } from '@/pages/ProcessPage';
import { JobsPage } from '@/pages/JobsPage';
import { TeamPage } from '@/pages/TeamPage';
import { UsagePage } from '@/pages/UsagePage';
import { SettingsPage } from '@/pages/SettingsPage';

// Admin Pages
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminOrganizationsPage } from '@/pages/admin/AdminOrganizationsPage';
import { AdminOrgUsersPage } from '@/pages/admin/AdminOrgUsersPage';

// Protected Route Wrapper (redirects super admin to /admin)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}

// Super Admin Route Wrapper
function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Public Route Wrapper (redirect if authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to={user?.isSuperAdmin ? '/admin' : '/'} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />

      {/* Super Admin Routes */}
      <Route
        path="/admin"
        element={
          <SuperAdminRoute>
            <AdminDashboardPage />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/admin/organizations"
        element={
          <SuperAdminRoute>
            <AdminOrganizationsPage />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/admin/organizations/:orgId/users"
        element={
          <SuperAdminRoute>
            <AdminOrgUsersPage />
          </SuperAdminRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/upload"
        element={
          <ProtectedRoute>
            <UploadPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/media"
        element={
          <ProtectedRoute>
            <MediaLibraryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/process"
        element={
          <ProtectedRoute>
            <ProcessPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs"
        element={
          <ProtectedRoute>
            <JobsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/team"
        element={
          <ProtectedRoute>
            <TeamPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/usage"
        element={
          <ProtectedRoute>
            <UsagePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      {/* Catch all - redirect to dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
