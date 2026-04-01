import { useState, useEffect } from 'react';
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
import Members from './pages/Members';
import Settings from './pages/Settings';
import ShowerQueue from './pages/ShowerQueue';
import TrashTurn from './pages/TrashTurn';
import NotFound from './pages/NotFound';
import AccessDenied from './pages/AccessDenied';
import LoadingScreen from './components/LoadingScreen';
import { useAuth } from './AuthContext';

export default function App() {
  const { user, loading, apartmentId } = useAuth();
  const [minLoading, setMinLoading] = useState(true);

  useEffect(() => {
    // Ensure splash screen shows for at least 2.5 seconds
    const timer = setTimeout(() => {
      setMinLoading(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  console.log('App rendering, user:', !!user, 'loading:', loading, 'minLoading:', minLoading, 'apartmentId:', apartmentId);

  if (loading || minLoading) {
    return <LoadingScreen message="Loading Roommate OS..." />;
  }

  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/auth" element={(!user || !apartmentId) ? <Auth /> : <Navigate to="/dashboard" replace />} />
        <Route path="/tv" element={<TVMode />} />
        <Route path="/403" element={<AccessDenied />} />
        
        <Route path="/" element={user ? (apartmentId ? <Layout /> : <Navigate to="/auth" replace />) : <Navigate to="/auth" replace />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="chores" element={<Chores />} />
          <Route path="groceries" element={<Groceries />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="shower-queue" element={<ShowerQueue />} />
          <Route path="trash-turn" element={<TrashTurn />} />
          <Route path="members" element={<Members />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
