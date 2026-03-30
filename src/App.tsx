import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import TVMode from './pages/TVMode';
import Expenses from './pages/Expenses';
import Chores from './pages/Chores';
import Groceries from './pages/Groceries';
import Calendar from './pages/Calendar';
import Announcements from './pages/Announcements';
import Members from './pages/Members';
import Settings from './pages/Settings';
import ShowerQueue from './pages/ShowerQueue';
import { useAuth } from './AuthContext';

export default function App() {
  const { user, loading, apartmentId } = useAuth();
  console.log('App rendering, user:', !!user, 'loading:', loading, 'apartmentId:', apartmentId);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/auth" element={(!user || !apartmentId) ? <Auth /> : <Navigate to="/dashboard" replace />} />
        <Route path="/tv" element={<TVMode />} />
        
        <Route path="/" element={user ? (apartmentId ? <Layout /> : <Navigate to="/auth" replace />) : <Navigate to="/auth" replace />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="chores" element={<Chores />} />
          <Route path="groceries" element={<Groceries />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="shower-queue" element={<ShowerQueue />} />
          <Route path="members" element={<Members />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
