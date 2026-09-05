import React from 'react';
import { Search } from 'lucide-react';

const PAGE_TITLES = {
  overview: 'Recovery Overview',
  transactions: 'Payments',
  queue: 'Recovery Queue',
  insights: 'AI Insights',
  history: 'Recovery History',
  customers: 'Customers',
  reports: 'Reports'
};

export default function Navbar({ activePage, searchQuery, setSearchQuery }) {
  const pageTitle = PAGE_TITLES[activePage] || 'Dashboard';

  return (
    <header className="top-navbar">
      <div className="nav-brand-container">
        {/* We can place the contextual title here */}
      </div>

      <div className="nav-controls">
        <div className="nav-search-bar">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search Payment ID or Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
    </header>
  );
}
