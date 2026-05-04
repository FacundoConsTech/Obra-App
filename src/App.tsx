import { useEffect, useMemo, useState } from 'react';
import Navigation from './components/Navigation';
import PlannedPage from './components/PlannedPage';
import DailyEntriesPage from './components/DailyEntriesPage';
import PayrollPage from './components/PayrollPage';
import StatsPage from './components/StatsPage';
import LoginPage from './components/LoginPage';
import LandingPage from './components/LandingPage';
import AppOnboarding from './components/AppOnboarding';
import { supabase } from './lib/supabase';
import { bootstrapInitialProjectsForUser, createProject, getProjects, type Project } from './lib/supabaseQueries';
import type { Session } from '@supabase/supabase-js';

type Page = 'planned' | 'daily' | 'payroll' | 'stats';

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
  targetSelector?: string;
}> = [
  {
    id: 'crews',
    title: 'Acá cargás las cuadrillas',
    description: 'Primero creás todas las crews que participan en la obra para mantener la operación ordenada.',
    page: 'daily',
    targetSelector: '[data-onboarding=\"daily-create-crew\"]',
  },
  {
    id: 'planned',
    title: 'Acá planificás las tareas',
    description: 'En Planned cargás rubros, tareas, cantidades y precios para planificar el trabajo.',
    page: 'planned',
  },
  {
    id: 'daily',
    title: 'Acá cargás los daily entries',
    description: 'En Daily Entries registrás el avance diario ejecutado para mantener el progreso actualizado.',
    page: 'daily',
  },
  {
    id: 'payroll',
    title: 'Acá calculás la liquidación',
    description: 'En Payroll calculás el total del período en base a lo ejecutado por cada crew.',
    page: 'payroll',
  },
  {
    id: 'stats',
    title: 'Acá seguís el avance general',
    description: 'En Stats ves el progreso por crew, por tarea y el estado global del proyecto.',
    page: 'stats',
  },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('planned');
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [routeView, setRouteView] = useState<RouteView>(() => resolveRoute(window.location.pathname));
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [onboardingStepIndex, setOnboardingStepIndex] = useState(0);

  const onboardingStorageKey = useMemo(
    () => (session?.user?.id ? `obrapp:onboarding:v1:${session.user.id}` : null),
    [session?.user?.id]
  );
  const projectStorageKey = useMemo(
    () => (session?.user?.id ? `obrapp:activeProject:v1:${session.user.id}` : null),
    [session?.user?.id]
  );

  const resolveInitialProjectId = (projectsData: Project[]) => {
    const savedProjectId = projectStorageKey ? window.localStorage.getItem(projectStorageKey) : null;
    const validSavedProjectId =
      savedProjectId && projectsData.some((project) => project.id === savedProjectId) ? savedProjectId : null;
    const defaultProjectId = projectsData.find((project) => project.id === 'proyecto-principal')?.id ?? null;
    const firstProjectId = projectsData[0]?.id ?? null;
    return validSavedProjectId ?? defaultProjectId ?? firstProjectId ?? null;
  };

  const refreshProjects = async (nextActiveProjectId?: string | null) => {
    const projectsData = await getProjects();
    setProjects(projectsData);

    if (nextActiveProjectId && projectsData.some((project) => project.id === nextActiveProjectId)) {
      setActiveProjectId(nextActiveProjectId);
      return;
    }

    setActiveProjectId(resolveInitialProjectId(projectsData));
  };

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

  useEffect(() => {
    if (!session || routeView !== 'app') return;

    let active = true;
    const loadProjects = async () => {
      try {
        let projectsData = await getProjects();
        if (projectsData.length === 0) {
          const { principalProjectId } = await bootstrapInitialProjectsForUser();
          projectsData = await getProjects();
          if (!active) return;
          setProjects(projectsData);
          setActiveProjectId(principalProjectId);
          return;
        }
        if (!active) return;

        setProjects(projectsData);
        setActiveProjectId(resolveInitialProjectId(projectsData));
      } catch (error) {
        console.error('Error loading projects:', error);
        if (!active) return;
        setProjects([]);
        setActiveProjectId(null);
      }
    };

    void loadProjects();
    return () => {
      active = false;
    };
  }, [session, routeView, projectStorageKey]);

  useEffect(() => {
    if (!projectStorageKey) return;
    if (activeProjectId) {
      window.localStorage.setItem(projectStorageKey, activeProjectId);
    } else {
      window.localStorage.removeItem(projectStorageKey);
    }
  }, [projectStorageKey, activeProjectId]);

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

  const handleCreateProject = async (name: string, description?: string) => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new Error('El nombre del proyecto es obligatorio.');
    }

    const createdProjectId = await createProject({ name: normalizedName, description });
    await refreshProjects(createdProjectId);
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
      <Navigation
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onLogout={handleLogout}
        projects={projects.map((project) => ({ id: project.id, name: project.name }))}
        activeProjectId={activeProjectId}
        onProjectChange={setActiveProjectId}
        onCreateProject={handleCreateProject}
      />
      {currentPage === 'stats' && <StatsPage activeProjectId={activeProjectId} />}
      {currentPage === 'planned' && <PlannedPage activeProjectId={activeProjectId} />}
      {currentPage === 'daily' && <DailyEntriesPage activeProjectId={activeProjectId} />}
      {currentPage === 'payroll' && <PayrollPage activeProjectId={activeProjectId} />}

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
