import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import AccountsView from './components/AccountsView';
import EconomicCalendar from './components/EconomicCalendar';
import Settings from './components/Settings';
import OnboardingModal from './components/OnboardingModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState(null);

  // Query database for user profile name
  const userMeta = useLiveQuery(() => 
    db.user_meta.where('key').equals('username').first()
  );

  const username = userMeta?.value || '';
  const isLoading = userMeta === undefined;
  const needsOnboarding = !isLoading && !userMeta;

  // Navigate to accounts tab and focus on specific account details
  const handleViewAccountDetails = (accountId) => {
    setSelectedAccountId(accountId);
    setActiveTab('accounts');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onViewAccountDetails={handleViewAccountDetails} username={username} />;
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
        return <Dashboard onViewAccountDetails={handleViewAccountDetails} username={username} />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-ac-cream text-ac-brown">
        <div className="animate-spin w-10 h-10 border-4 border-ac-green border-t-transparent rounded-full mb-3"></div>
        <p className="font-bold text-sm">Chargement de ton île budgétaire...</p>
      </div>
    );
  }

  return (
    <div className="flex bg-ac-cream min-h-screen text-ac-brown selection:bg-ac-green/30">
      {/* Onboarding block */}
      {needsOnboarding && (
        <OnboardingModal onComplete={() => {}} />
      )}

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
