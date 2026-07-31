import React, { useState, useMemo, useEffect } from 'react';
import { useDb, db } from './db';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import AccountsView from './components/AccountsView';
import EconomicCalendar from './components/EconomicCalendar';
import Settings from './components/Settings';
import OnboardingModal from './components/OnboardingModal';
import WishlistView from './components/WishlistView';
import AuthView from './components/AuthView';
import DebtsView from './components/DebtsView';
import AdminView from './components/AdminView';
import { TutorialBanner, TutorialSpotlight, TutorialCelebrationModal } from './components/TutorialComponents';

export default function App() {
  const { isLoading, user, username, accounts, userMeta, activeTheme, isAdmin, tutorialProgress } = useDb();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const stepKeyMap = {
    'dashboard': 'home',
    'accounts': 'accounts',
    'calendar': 'calendar',
    'debts': 'debts',
    'wishlist': 'wishlist',
    'settings': 'settings'
  };

  const activeStepKey = stepKeyMap[activeTab];

  useEffect(() => {
    if (user && tutorialProgress && !tutorialProgress.isCompleted && activeStepKey) {
      if (tutorialProgress.steps[activeStepKey] === false) {
        setShowSpotlight(true);
      } else {
        setShowSpotlight(false);
      }
    } else {
      setShowSpotlight(false);
    }
  }, [activeTab, tutorialProgress, user, activeStepKey]);

  const handleValidateStep = async (stepKey) => {
    try {
      const updatedSteps = {
        ...tutorialProgress.steps,
        [stepKey]: true
      };
      
      const isCompleted = Object.values(updatedSteps).every(v => v === true);
      
      await db.user_meta.put({
        key: 'tutorial_progress',
        value: {
          isCompleted,
          steps: updatedSteps
        }
      });
      
      setShowSpotlight(false);
      
      if (isCompleted) {
        setShowCelebration(true);
      }
    } catch (err) {
      console.error("Error validating tutorial step:", err);
    }
  };

  useEffect(() => {
    if (activeTab === 'admin' && !isAdmin) {
      setActiveTab('dashboard');
    }
  }, [activeTab, isAdmin]);

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
      case 'admin':
        return <AdminView />;
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
          <span className="text-lg font-black tracking-tight text-ac-brown flex items-center gap-1.5">
            🍃 Ecopine
            {isAdmin && (
              <span className="text-[8px] uppercase font-extrabold px-1 py-0.5 bg-[#E57373] text-white rounded-full border border-white shadow-xs">
                🔑 Admin
              </span>
            )}
          </span>
          <div 
            onClick={isAdmin ? () => setActiveTab('admin') : undefined}
            className={`w-10 h-10 rounded-full border-2 border-[#5C3A41] overflow-hidden bg-ac-green flex items-center justify-center text-white text-xs font-black shadow-ac-xs shrink-0 ${
              isAdmin ? 'cursor-pointer hover:scale-105 active:scale-95 transition-all ring-2 ring-ac-orange ring-offset-1' : ''
            }`}
          >
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
            <>
              {tutorialProgress && !tutorialProgress.isCompleted && (
                <TutorialBanner 
                  tutorialProgress={tutorialProgress}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
              )}
              {renderContent()}
            </>
          )}
        </div>
      </main>

      {showSpotlight && activeStepKey && (
        <TutorialSpotlight
          activeTab={activeTab}
          onValidate={handleValidateStep}
          onClose={() => setShowSpotlight(false)}
        />
      )}

      {showCelebration && (
        <TutorialCelebrationModal
          onClose={() => setShowCelebration(false)}
        />
      )}
    </div>
  );
}
