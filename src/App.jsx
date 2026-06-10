import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import AccountsView from './components/AccountsView';
import EconomicCalendar from './components/EconomicCalendar';
import Settings from './components/Settings';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState(null);

  // Navigate to accounts tab and focus on specific account details
  const handleViewAccountDetails = (accountId) => {
    setSelectedAccountId(accountId);
    setActiveTab('accounts');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onViewAccountDetails={handleViewAccountDetails} />;
      case 'accounts':
        return (
          <AccountsView
            selectedAccountId={selectedAccountId}
            setSelectedAccountId={setSelectedAccountId}
          />
        );
      case 'calendar':
        return <EconomicCalendar />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard onViewAccountDetails={handleViewAccountDetails} />;
    }
  };

  return (
    <div className="flex bg-ac-cream min-h-screen text-ac-brown selection:bg-ac-green/30">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Panel Content */}
      <main className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full">
        <div className="animate-bounce-in">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
