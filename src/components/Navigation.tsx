import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Page = 'planned' | 'daily' | 'payroll' | 'receipt' | 'stats';
type ProjectOption = { id: string; name: string };

type NavigationProps = {
  currentPage: Page;
  onPageChange: (page: Page) => void;
  onLogout?: () => void;
  projects: ProjectOption[];
  activeProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  onCreateProject: (name: string, description?: string) => Promise<void>;
};

export default function Navigation({
  currentPage,
  onPageChange,
  onLogout,
  projects,
  activeProjectId,
  onProjectChange,
  onCreateProject,
}: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [createError, setCreateError] = useState('');
  const panelRef = useRef<HTMLFormElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const pages = [
    { id: 'stats' as Page, name: 'Stats' },
    { id: 'planned' as Page, name: 'Planned' },
    { id: 'daily' as Page, name: 'Daily Entries' },
    { id: 'payroll' as Page, name: 'Payroll' },
    { id: 'receipt' as Page, name: 'Comprobantes' },
  ];

  const closeCreateProjectPanel = () => {
    setShowCreateProject(false);
    setProjectName('');
    setProjectDescription('');
    setCreateError('');
    setCreatingProject(false);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingProject) return;

    const normalizedName = projectName.trim();
    if (!normalizedName) {
      setCreateError('El nombre del proyecto es obligatorio.');
      return;
    }

    try {
      setCreatingProject(true);
      setCreateError('');
      await onCreateProject(normalizedName, projectDescription.trim() || undefined);
      closeCreateProjectPanel();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo crear el proyecto.';
      setCreateError(message);
      setCreatingProject(false);
    }
  };

  useEffect(() => {
    if (!showCreateProject) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      closeCreateProjectPanel();
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCreateProjectPanel();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEsc);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showCreateProject]);

  return (
    <>
      <nav className="bg-black/30 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="text-2xl font-bold text-white">Obra App</div>
            </div>

            <div className="hidden md:flex items-center space-x-1">
              <div className="mr-3">
                <select
                  value={activeProjectId ?? ''}
                  onChange={(e) => onProjectChange(e.target.value || null)}
                  className="bg-gray-800 border border-gray-600 text-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {projects.length === 0 ? (
                    <option value="">Sin proyectos</option>
                  ) : (
                    projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <button
                ref={triggerRef}
                onClick={() => setShowCreateProject((prev) => !prev)}
                className="mr-2 px-3 py-2 rounded-lg border border-gray-600 text-sm font-semibold text-gray-200 hover:text-white hover:border-gray-400 transition-colors"
              >
                Nuevo proyecto
              </button>
              {pages.map((page) => (
                <button
                  key={page.id}
                  onClick={() => onPageChange(page.id)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    currentPage === page.id
                      ? 'bg-white text-black'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  {page.name}
                </button>
              ))}
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="ml-2 px-4 py-2 rounded-lg font-semibold text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors"
                >
                  Cerrar Sesión
                </button>
              )}
            </div>

            <div className="md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-gray-300 hover:text-white p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {isOpen && (
            <div className="md:hidden border-t border-gray-700 py-4">
              <div className="space-y-2">
                <div className="px-4 pb-2">
                  <select
                    value={activeProjectId ?? ''}
                    onChange={(e) => onProjectChange(e.target.value || null)}
                    className="w-full bg-gray-800 border border-gray-600 text-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    {projects.length === 0 ? (
                      <option value="">Sin proyectos</option>
                    ) : (
                      projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="px-4 pb-2">
                  <button
                    onClick={() => {
                      setShowCreateProject(true);
                      setIsOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-600 text-sm font-semibold text-gray-200 hover:text-white hover:border-gray-400 transition-colors text-left"
                  >
                    Nuevo proyecto
                  </button>
                </div>
                {pages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => {
                      onPageChange(page.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-colors ${
                      currentPage === page.id
                        ? 'bg-white text-black'
                        : 'text-gray-300 hover:text-white hover:bg-gray-800/50'
                    }`}
                  >
                    {page.name}
                  </button>
                ))}
                {onLogout && (
                  <button
                    onClick={() => {
                      onLogout();
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 rounded-lg font-semibold text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors"
                  >
                    Cerrar Sesión
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {showCreateProject &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm px-4">
            <form
              ref={panelRef}
              onSubmit={handleCreateProject}
              className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl"
            >
              <h3 className="mb-4 text-xl font-semibold text-white">Nuevo proyecto</h3>

              <div className="space-y-3">
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Nombre del proyecto"
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 text-white"
                  required
                />
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Descripción (opcional)"
                  rows={3}
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 text-white"
                />
              </div>

              {createError && <p className="mt-3 text-sm text-red-300">{createError}</p>}

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCreateProjectPanel}
                  className="rounded-lg border border-gray-600 px-4 py-2 text-gray-200 transition-colors hover:border-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingProject}
                  className={`rounded-lg px-4 py-2 font-semibold transition-colors ${
                    creatingProject ? 'cursor-not-allowed bg-gray-600 text-gray-300' : 'bg-white text-black hover:bg-gray-100'
                  }`}
                >
                  {creatingProject ? 'Creando...' : 'Crear proyecto'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}
    </>
  );
}
