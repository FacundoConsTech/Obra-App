import { useState } from 'react';
import Navigation from './components/Navigation';
import PlannedPage from './components/PlannedPage';
import DailyEntriesPage from './components/DailyEntriesPage';
import PayrollPage from './components/PayrollPage';
import ComprobantePage from './components/ComprobantePage';

type Page = 'planned' | 'daily' | 'payroll' | 'receipt';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('planned');

  const renderPage = () => {
    switch (currentPage) {
      case 'planned':
        return <PlannedPage />;
      case 'daily':
        return <DailyEntriesPage />;
      case 'payroll':
        return <PayrollPage />;
      case 'receipt':
        return <ComprobantePage />;
      default:
        return <PlannedPage />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />
      {renderPage()}
    </div>
  );
}