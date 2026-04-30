import { useEffect, useState } from 'react';
import Navigation from './components/Navigation';
import PlannedPage from './components/PlannedPage';
import DailyEntriesPage from './components/DailyEntriesPage';
import PayrollPage from './components/PayrollPage';
import ComprobantePage from './components/ComprobantePage';
import LoginPage from './components/LoginPage';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';

type Page = 'planned' | 'daily' | 'payroll' | 'receipt';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('planned');
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setSession(data.session ?? null);
        setAuthLoading(false);
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession ?? null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      console.error('Error closing session:', error);
      return;
    }
    // Ensure UI returns to login immediately even if auth event arrives late.
    setSession(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <Navigation currentPage={currentPage} onPageChange={setCurrentPage} onLogout={handleLogout} />
      {currentPage === 'planned' && <PlannedPage />}
      {currentPage === 'daily' && <DailyEntriesPage />}
      {currentPage === 'payroll' && <PayrollPage />}
      {currentPage === 'receipt' && <ComprobantePage />}
    </div>
  );
}
