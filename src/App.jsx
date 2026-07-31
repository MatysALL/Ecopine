import React, { useState, useMemo, useEffect } from 'react';
import { useDb } from './db';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import AccountsView from './components/AccountsView';
import EconomicCalendar from './components/EconomicCalendar';
import Settings from './components/Settings';
import OnboardingModal from './components/OnboardingModal';
import WishlistView from './components/WishlistView';
import AuthView from './components/AuthView';
import DebtsView from './components/DebtsView';

export default function App() {
  const { isLoading, user, username, accounts, userMeta, activeTheme } = useDb();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState(null);

  const activeThemeClass = useMemo(() => {
    const map = {
      'default': 'theme-default',
      'red': 'theme-red',
      'blue': 'theme-blue',
      'yellow': 'theme-yellow',
      'neon': 'theme-neon',
      'wayfs': 'theme-wayfs',
      'lea': 'theme-sakura'
    };
    return map[activeTheme] || 'theme-default';
  }, [activeTheme]);

  useEffect(() => {
    const themeClasses = ['theme-default', 'theme-red', 'theme-blue', 'theme-yellow', 'theme-neon', 'theme-wayfs', 'theme-sakura'];
    themeClasses.forEach(c => document.body.classList.remove(c));
    document.body.classList.add(activeThemeClass);
    return () => {
      themeClasses.forEach(c => document.body.classList.remove(c));
    };
  }, [activeThemeClass]);

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
      case 'debts':
        return <DebtsView />;
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

  const photoURL = userMeta?.find(m => m.key === 'photoURL')?.value || user?.photoURL;

  const getInitial = (name = '') => {
    if (!name) return '🍃';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className={`flex flex-col md:flex-row bg-ac-cream min-h-screen text-ac-brown selection:bg-ac-green/30 transition-colors duration-300 ${activeThemeClass}`}>
      {/* Mobile Top Header (only on mobile screens) */}
      {user && !needsOnboarding && (
        <header className="md:hidden flex justify-between items-center bg-ac-cream-dark border-b-3 border-ac-brown px-4 py-3 sticky top-0 z-30 select-none w-full">
          <span className="text-lg font-black tracking-tight text-ac-brown flex items-center gap-1">🍃 Ecopine</span>
          <div className="w-10 h-10 rounded-full border-2 border-[#5C3A41] overflow-hidden bg-ac-green flex items-center justify-center text-white text-xs font-black shadow-ac-xs shrink-0">
            {photoURL ? (
              <img src={photoURL} alt="Profil" className="w-full h-full object-cover object-center block" />
            ) : (
              <span>{getInitial(username || user?.displayName)}</span>
            )}
          </div>
        </header>
      )}

      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Panel Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
        <div className="animate-bounce-in">
          {needsOnboarding ? (
            <OnboardingModal />
          ) : (
            renderContent()
          )}
        </div>
      </main>
    </div>
  );
}
