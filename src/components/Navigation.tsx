import { useState } from 'react';

type Page = 'planned' | 'daily' | 'payroll' | 'receipt';

type NavigationProps = {
  currentPage: Page;
  onPageChange: (page: Page) => void;
  onLogout?: () => void;
};

export default function Navigation({ currentPage, onPageChange, onLogout }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);

  const pages = [
    { id: 'planned' as Page, name: 'Planned', icon: '📋' },
    { id: 'daily' as Page, name: 'Daily Entries', icon: '📝' },
    { id: 'payroll' as Page, name: 'Payroll', icon: '💰' },
    { id: 'receipt' as Page, name: 'Comprobantes', icon: '🧾' },
  ];

  return (
    <nav className="bg-black/30 backdrop-blur-sm border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="text-2xl font-bold text-white">Obra App</div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
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
                <span className="mr-2">{page.icon}</span>
                {page.name}
              </button>
            ))}
            {onLogout && (
              <button
                onClick={onLogout}
                className="ml-2 px-4 py-2 rounded-lg font-semibold text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors"
              >
                Cerrar SesiÃ³n
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
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

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden border-t border-gray-700 py-4">
            <div className="space-y-2">
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
                  <span className="mr-3">{page.icon}</span>
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
                  Cerrar SesiÃ³n
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

