import { useState } from 'react';
import Navigation from './components/Navigation';
import PlannedPage from './components/PlannedPage';
import DailyEntriesPage from './components/DailyEntriesPage';
import PayrollPage from './components/PayrollPage';
import ComprobantePage from './components/ComprobantePage';

type Page = 'planned' | 'daily' | 'payroll' | 'receipt';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('planned');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />
      {currentPage === 'planned' && <PlannedPage />}
      {currentPage === 'daily' && <DailyEntriesPage />}
      {currentPage === 'payroll' && <PayrollPage />}
      {currentPage === 'receipt' && <ComprobantePage />}
    </div>
  );
}
