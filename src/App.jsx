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
import SocialView from './components/SocialView';
import ProjectsView from './components/ProjectsView';
import { TutorialBanner, TutorialSpotlight, TutorialCelebrationModal } from './components/TutorialComponents';
import { PiggyBank, Calendar, Handshake, Gift, Plus, Settings as SettingsIcon, Users, Folder } from 'lucide-react';
import TransactionModal from './components/TransactionModal';
import { APP_THEMES } from './config/themes';
import EncounterModal from './components/EncounterModal';

export default function App() {
  const { isLoading, user, username, accounts, userMeta, activeTheme, isAdmin, tutorialProgress, pendingRequestsCount } = useDb();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isGlobalTxModalOpen, setIsGlobalTxModalOpen] = useState(false);

  // Connected but no account yet -> force onboarding (guided first account creation)
  const needsOnboarding = !accounts || accounts.length === 0;

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
    // Only show tutorial spotlight when user is logged in, onboarding is completed, and step is not validated
    if (user && !needsOnboarding && tutorialProgress && !tutorialProgress.isCompleted && activeStepKey) {
      if (tutorialProgress.steps[activeStepKey] === false) {
        setShowSpotlight(true);
      } else {
        setShowSpotlight(false);
      }
    } else {
      setShowSpotlight(false);
    }
  }, [activeTab, tutorialProgress, user, activeStepKey, needsOnboarding]);

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

  const defaultAccountId = useMemo(() => {
    if (!accounts || accounts.length === 0) return null;
    const favMeta = userMeta?.find(m => m.key === 'favorite_account_id');
    const favoriteId = favMeta ? favMeta.value : null;
    if (favoriteId && accounts.some(a => a.id === favoriteId)) return favoriteId;
    
    const courant = accounts.find(a => a.type === 'Courant');
    return courant ? courant.id : accounts[0].id;
  }, [accounts, userMeta]);

  const handleSaveGlobalTransaction = async (txData) => {
    try {
      await db.transactions.add(txData);
      setIsGlobalTxModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement de la transaction.");
    }
  };

  useEffect(() => {
    if (activeTab === 'admin' && !isAdmin) {
      setActiveTab('dashboard');
    }
    if (activeTab === 'home') {
      setActiveTab('dashboard');
    }
  }, [activeTab, isAdmin]);

  const currentTheme = useMemo(() => {
    return APP_THEMES[activeTheme] || APP_THEMES.default;
  }, [activeTheme]);

  const activeThemeClass = useMemo(() => {
    return `theme-${currentTheme.id}`;
  }, [currentTheme]);

  useEffect(() => {
    const { primary, secondary, text } = currentTheme.colors;
    
    // Inject dynamic CSS variables on document root
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', primary);
    root.style.setProperty('--theme-secondary', secondary);
    root.style.setProperty('--theme-text', text);

    const allThemeClasses = Object.keys(APP_THEMES).map(id => `theme-${id}`);
    allThemeClasses.push('theme-sakura', 'theme-red', 'theme-blue', 'theme-yellow', 'theme-neon', 'theme-wayfs');
    allThemeClasses.forEach(c => document.body.classList.remove(c));
    document.body.classList.add(`theme-${currentTheme.id}`);
    
    return () => {
      allThemeClasses.forEach(c => document.body.classList.remove(c));
    };
  }, [currentTheme]);

  // Navigate to accounts tab and focus on specific account details
  const handleViewAccountDetails = (accountId) => {
    setSelectedAccountId(accountId);
    setActiveTab('accounts');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
      case 'home':
        return (
          <Dashboard 
            onViewAccountDetails={handleViewAccountDetails} 
            username={username} 
            setActiveTab={setActiveTab}
            setCurrentView={setActiveTab}
            onNavigate={setActiveTab}
          />
        );
      case 'accounts':
        return (
          <AccountsView
            selectedAccountId={selectedAccountId}
            setSelectedAccountId={setSelectedAccountId}
            setActiveTab={setActiveTab}
            setCurrentView={setActiveTab}
            onNavigate={setActiveTab}
          />
        );
      case 'calendar':
        return <EconomicCalendar />;
      case 'debts':
        return <DebtsView />;
      case 'wishlist':
        return <WishlistView />;
      case 'projects':
        return <ProjectsView />;
      case 'social':
        return <SocialView />;
      case 'settings':
        return <Settings />;
      case 'admin':
        return <AdminView />;
      default:
        return (
          <Dashboard 
            onViewAccountDetails={handleViewAccountDetails} 
            username={username} 
            setActiveTab={setActiveTab}
            setCurrentView={setActiveTab}
            onNavigate={setActiveTab}
          />
        );
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

  const photoURL = userMeta?.find(m => m.key === 'photoURL')?.value || user?.photoURL;

  const getInitial = (name = '') => {
    if (!name) return '🍃';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleNavTabClick = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'accounts') {
      setSelectedAccountId(null);
    }
  };

  return (
    <div 
      className={`flex flex-col md:flex-row bg-ac-cream min-h-screen text-ac-brown selection:bg-ac-green/30 transition-colors duration-300 ${activeThemeClass}`}
      style={{
        '--theme-primary': currentTheme.colors.primary,
        '--theme-secondary': currentTheme.colors.secondary,
        '--theme-text': currentTheme.colors.text
      }}
    >
      {/* Mobile Top Header (only on mobile screens) */}
      {user && !needsOnboarding && (
        <header className="md:hidden flex justify-between items-center bg-ac-cream-dark border-b-3 border-ac-brown px-4 py-3 sticky top-0 z-30 select-none w-full">
          <span 
            onClick={() => setActiveTab('dashboard')}
            className="text-lg font-black tracking-tight text-ac-brown flex items-center gap-1.5 cursor-pointer"
          >
            🍃 Ecopine
            {isAdmin && (
              <span className="text-[8px] uppercase font-extrabold px-1 py-0.5 bg-[#E57373] text-white rounded-full border border-white shadow-xs">
                🔑 Admin
              </span>
            )}
          </span>
          <div className="relative flex items-center gap-2">
            <div 
              onClick={() => setActiveTab(isAdmin ? 'admin' : 'settings')}
              className={`w-10 h-10 rounded-full border-2 border-[#5C3A41] overflow-hidden bg-ac-green flex items-center justify-center text-white text-xs font-black shadow-ac-xs shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-all ${
                isAdmin ? 'ring-2 ring-ac-orange ring-offset-1' : ''
              }`}
            >
              {photoURL ? (
                <img src={photoURL} alt="Profil" className="w-full h-full object-cover object-center block" />
              ) : (
                <span>{getInitial(username || user?.displayName)}</span>
              )}
            </div>
            {/* Mobile Friend Requests Badge */}
            {pendingRequestsCount > 0 && (
              <button 
                onClick={() => setActiveTab('social')}
                className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-ac-red border border-white rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-ac-xs animate-pulse cursor-pointer"
                title="Invitations d'amis reçues"
              >
                {pendingRequestsCount}
              </button>
            )}
          </div>
        </header>
      )}

      {/* Sidebar Navigation (Desktop) */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        setSelectedAccountId={setSelectedAccountId} 
      />

      {/* Main Panel Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-28 md:pb-8 max-w-7xl mx-auto w-full">
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

      {/* Mobile Bottom Navigation Bar (NookPhone Dock) */}
      {user && !needsOnboarding && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FFF9FA]/95 backdrop-blur-md border-t-2 border-[#5C3A41] pb-[env(safe-area-inset-bottom)]">
          <nav className="flex justify-around items-center h-16 px-1">
            {[
              { id: 'accounts', label: 'Comptes', icon: PiggyBank },
              { id: 'calendar', label: 'Calendrier', icon: Calendar },
              { id: 'debts', label: 'Dettes', icon: Handshake },
              { id: 'wishlist', label: 'Souhaits', icon: Gift },
              { id: 'projects', label: 'Projets', icon: Folder },
              { id: 'social', label: 'Social', icon: Users },
              { id: 'settings', label: 'Paramètres', icon: SettingsIcon }
            ].map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavTabClick(item.id)}
                  className={`flex flex-col items-center justify-center flex-1 h-full transition-all gap-0.5 cursor-pointer select-none ${
                    isActive 
                      ? 'text-ac-green scale-105 font-black animate-bounce-once' 
                      : 'text-ac-brown/65 hover:text-ac-brown font-bold'
                  }`}
                  style={{ minHeight: '44px' }}
                >
                  <div className={`relative p-1 rounded-xl border transition-all ${
                    isActive ? 'bg-[#78B159]/15 border-[#78B159]/40 shadow-xs' : 'border-transparent'
                  }`}>
                    <Icon className="w-5 h-5" />
                    {item.id === 'social' && pendingRequestsCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-ac-red border border-white rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-ac-xs animate-pulse">
                        {pendingRequestsCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[8px] tracking-tight">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* Floating Action Button (FAB) on mobile */}
      {user && !needsOnboarding && (
        <button
          onClick={() => setIsGlobalTxModalOpen(true)}
          className="fixed bottom-20 right-4 md:hidden z-30 w-14 h-14 bg-ac-green text-white rounded-full shadow-lg flex items-center justify-center border-3 border-ac-brown hover:scale-105 active:scale-95 transition-all cursor-pointer"
          style={{ minHeight: '44px', minWidth: '44px' }}
        >
          <Plus className="w-7 h-7" />
        </button>
      )}

      {/* Global Transaction Modal */}
      {isGlobalTxModalOpen && defaultAccountId && (
        <TransactionModal
          isOpen={isGlobalTxModalOpen}
          onClose={() => setIsGlobalTxModalOpen(false)}
          onSave={handleSaveGlobalTransaction}
          accountId={defaultAccountId}
        />
      )}

      {showSpotlight && !needsOnboarding && activeStepKey && (
        <TutorialSpotlight
          activeTab={activeTab}
          onValidate={handleValidateStep}
          onClose={() => setShowSpotlight(false)}
        />
      )}

      {showCelebration && !needsOnboarding && (
        <TutorialCelebrationModal
          onClose={() => setShowCelebration(false)}
        />
      )}

      {/* Pop-up de rencontre animalière globale */}
      <EncounterModal />
    </div>
  );
}
