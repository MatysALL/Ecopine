import React, { useState } from 'react';
import { useDb } from './db';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import AccountsView from './components/AccountsView';
import EconomicCalendar from './components/EconomicCalendar';
import Settings from './components/Settings';
import OnboardingModal from './components/OnboardingModal';
import WishlistView from './components/WishlistView';
import AuthView from './components/AuthView';

export default function App() {
  const { isLoading, user, username, accounts } = useDb();
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
      case 'wishlist':
        return <WishlistView />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard onViewAccountDetails={handleViewAccountDetails} username={username} />;
    }
  };

  // Loading screen
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-ac-cream p-4 text-ac-brown select-none animate-fade-in">
        <div className="flex flex-col items-center justify-center text-center max-w-sm space-y-4">
          <div className="animate-spin w-10 h-10 border-4 border-ac-green border-t-transparent rounded-full"></div>
          <p className="font-bold text-sm">Chargement de ton île budgétaire...</p>
        </div>
      </div>
    );
  }

  // Not connected -> show Auth screen
  if (!user) {
    return <AuthView />;
  }

  // Connected but no account yet -> force onboarding (guided first account creation)
  const needsOnboarding = accounts.length === 0;

  return (
    <div className="flex bg-ac-cream min-h-screen text-ac-brown selection:bg-ac-green/30">
      {/* Onboarding block */}
      {needsOnboarding && (
        <OnboardingModal />
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
