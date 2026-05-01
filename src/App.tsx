import { useEffect, useMemo, useState } from 'react';
import Navigation from './components/Navigation';
import PlannedPage from './components/PlannedPage';
import DailyEntriesPage from './components/DailyEntriesPage';
import PayrollPage from './components/PayrollPage';
import ComprobantePage from './components/ComprobantePage';
import LoginPage from './components/LoginPage';
import LandingPage from './components/LandingPage';
import AppOnboarding from './components/AppOnboarding';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';

type Page = 'planned' | 'daily' | 'payroll' | 'receipt';

type RouteView = 'landing' | 'app';

const resolveRoute = (pathname: string): RouteView => {
  if (pathname.startsWith('/app')) return 'app';
  return 'landing';
};

const onboardingSteps: Array<{
  id: string;
  title: string;
  description: string;
  page: Page;
}> = [
  {
    id: 'crews',
    title: 'Acá cargás las cuadrillas',
    description: 'En Daily Entries gestionás las crews activas y sus datos para usarlas en la carga diaria.',
    page: 'daily',
  },
  {
    id: 'planned',
    title: 'Acá ingresás las tareas',
    description: 'En Planned definís rubros, tareas, cantidades y precios de referencia por obra.',
    page: 'planned',
  },
  {
    id: 'daily',
    title: 'Acá cargás los daily entries',
    description: 'En Daily Entries registrás avances diarios por cuadrilla para mantener el progreso actualizado.',
    page: 'daily',
  },
  {
    id: 'payroll',
    title: 'Acá calculás la liquidación',
    description: 'En Payroll calculás el total del período en base a lo ejecutado por cada crew.',
    page: 'payroll',
  },
  {
    id: 'receipt',
    title: 'Acá ves y emitís comprobantes',
    description: 'En Comprobantes consultás el historial y emitís informes para respaldo y auditoría.',
    page: 'receipt',
  },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('planned');
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [routeView, setRouteView] = useState<RouteView>(() => resolveRoute(window.location.pathname));
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [onboardingStepIndex, setOnboardingStepIndex] = useState(0);

  const onboardingStorageKey = useMemo(
    () => (session?.user?.id ? `obrapp:onboarding:v1:${session.user.id}` : null),
    [session?.user?.id]
  );

  const navigate = (path: '/app' | '/', replace = false) => {
    if (window.location.pathname !== path) {
      if (replace) {
        window.history.replaceState({}, '', path);
      } else {
        window.history.pushState({}, '', path);
      }
    }
    setRouteView(resolveRoute(path));
  };

  useEffect(() => {
    const handlePopState = () => {
      setRouteView(resolveRoute(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  useEffect(() => {
    if (!session || routeView !== 'app' || !onboardingStorageKey) return;

    const done = window.localStorage.getItem(onboardingStorageKey) === 'done';
    if (!done) {
      setOnboardingStepIndex(0);
      setCurrentPage(onboardingSteps[0].page);
      setOnboardingVisible(true);
    }
  }, [session, routeView, onboardingStorageKey]);

  const completeOnboarding = () => {
    if (onboardingStorageKey) {
      window.localStorage.setItem(onboardingStorageKey, 'done');
    }
    setOnboardingVisible(false);
  };

  const handleOnboardingNext = () => {
    const nextIndex = onboardingStepIndex + 1;
    if (nextIndex >= onboardingSteps.length) {
      completeOnboarding();
      return;
    }

    setOnboardingStepIndex(nextIndex);
    setCurrentPage(onboardingSteps[nextIndex].page);
  };

  const handleOnboardingBack = () => {
    const prevIndex = onboardingStepIndex - 1;
    if (prevIndex < 0) return;
    setOnboardingStepIndex(prevIndex);
    setCurrentPage(onboardingSteps[prevIndex].page);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      console.error('Error closing session:', error);
      return;
    }
    setSession(null);
    setOnboardingVisible(false);
    setOnboardingStepIndex(0);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    );
  }

  if (routeView === 'landing') {
    return <LandingPage onTryApp={() => navigate('/app')} onLogin={() => navigate('/app')} />;
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

      {onboardingVisible && (
        <AppOnboarding
          steps={onboardingSteps}
          stepIndex={onboardingStepIndex}
          onNext={handleOnboardingNext}
          onBack={handleOnboardingBack}
          onClose={completeOnboarding}
        />
      )}
    </div>
  );
}
