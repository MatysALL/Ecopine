import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import AccountsView from './components/AccountsView';
import EconomicCalendar from './components/EconomicCalendar';
import Settings from './components/Settings';
import OnboardingModal from './components/OnboardingModal';

import Dexie from 'dexie';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [dbError, setDbError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [loadTimeout, setLoadTimeout] = useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setLoadTimeout(true);
    }, 4000);

    let active = true;

    const initializeDb = async () => {
      try {
        await Promise.race([
          db.open(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("La connexion à IndexedDB a expiré (2.5s). Un autre onglet Ecopine bloque peut-être la base.")), 2500)
          )
        ]);

        const meta = await db.user_meta.get('username');
        
        if (active) {
          setUsername(meta?.value || '');
          setIsLoading(false);
          clearTimeout(timer);
        }
      } catch (err) {
        console.error("Erreur lors de l'initialisation de la base de données:", err);
        if (active) {
          setDbError(err);
          setIsLoading(false);
          clearTimeout(timer);
        }
      }
    };

    initializeDb();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  const needsOnboarding = !isLoading && !dbError && !username;

  // Navigate to accounts tab and focus on specific account details
  const handleViewAccountDetails = (accountId) => {
    setSelectedAccountId(accountId);
    setActiveTab('accounts');
  };

  const handleWipeDatabase = async () => {
    if (window.confirm("Cela effacera définitivement toutes tes données locales d'Ecopine pour réparer IndexedDB. Continuer ?")) {
      try {
        await Dexie.delete('EcopineDB');
        window.location.reload();
      } catch (err) {
        alert("Impossible de réinitialiser la base de données : " + err.message);
      }
    }
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

  if (dbError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-ac-cream p-4 text-ac-brown select-none">
        <div className="bg-white border-4 border-ac-brown rounded-3xl p-8 max-w-md w-full shadow-ac-lg text-center space-y-4">
          <div className="text-5xl animate-bounce">🚧</div>
          <h2 className="text-xl font-black">Oups, Méli-Mélo a fait une erreur !</h2>
          <p className="text-xs font-semibold text-ac-brown-light leading-relaxed">
            Ecopine n'a pas pu ouvrir ou lire la base de données locale dans ton navigateur. 
            Cela peut être dû à un conflit de version d'IndexedDB.
          </p>
          <div className="bg-ac-red-light/30 border border-ac-red/20 rounded-xl p-3 text-[10px] text-ac-red font-mono break-all text-left">
            {dbError.name}: {dbError.message}
          </div>
          <button
            onClick={handleWipeDatabase}
            className="w-full bg-ac-red text-white font-extrabold text-xs py-3 rounded-2xl border-3 border-ac-brown shadow-ac-sm active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 cursor-pointer"
          >
            Réinitialiser IndexedDB et rafraîchir
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-ac-cream p-4 text-ac-brown select-none animate-fade-in">
        <div className="flex flex-col items-center justify-center text-center max-w-sm space-y-4">
          <div className="animate-spin w-10 h-10 border-4 border-ac-green border-t-transparent rounded-full"></div>
          <p className="font-bold text-sm">Chargement de ton île budgétaire...</p>
          
          {loadTimeout && (
            <div className="bg-white border-3 border-ac-brown rounded-2xl p-5 shadow-ac-sm space-y-3 mt-4 animate-bounce-in">
              <span className="text-xl">🦝</span>
              <h4 className="font-black text-xs">Le chargement prend plus de temps que prévu...</h4>
              <p className="text-[10px] text-ac-brown-light font-semibold leading-relaxed">
                Cela peut arriver si un autre onglet d'Ecopine est ouvert dans ton navigateur (ce qui bloque la base de données). 
                Ferme les autres onglets ou tente une action ci-dessous :
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 bg-ac-green text-white font-extrabold text-[10px] py-2.5 rounded-xl border-2 border-ac-brown shadow-ac-sm active:translate-y-0.5 active:shadow-none cursor-pointer"
                >
                  Rafraîchir
                </button>
                <button
                  onClick={handleWipeDatabase}
                  className="flex-1 bg-ac-red-light text-ac-red font-extrabold text-[10px] py-2.5 rounded-xl border-2 border-ac-brown shadow-ac-sm active:translate-y-0.5 active:shadow-none cursor-pointer"
                >
                  Réinitialiser
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-ac-cream min-h-screen text-ac-brown selection:bg-ac-green/30">
      {/* Onboarding block */}
      {needsOnboarding && (
        <OnboardingModal onComplete={(name) => setUsername(name)} />
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
