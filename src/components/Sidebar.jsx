import React from 'react';
import { Leaf, PiggyBank, Calendar, Settings, Gift, LogOut, Handshake, Users } from 'lucide-react';
import { useDb } from '../db';

export default function Sidebar({ activeTab, setActiveTab }) {
  const { logOutUser, user, userMeta, username, pendingRequestsCount, isAdmin } = useDb();
  const photoURL = userMeta?.find(m => m.key === 'photoURL')?.value || user?.photoURL;

  const getInitial = (name = '') => {
    if (!name) return '🍃';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };
  
  const navItems = [
    { id: 'dashboard', label: 'Accueil', icon: Leaf, color: 'text-ac-green' },
    { id: 'accounts', label: 'Comptes', icon: PiggyBank, color: 'text-ac-gold' },
    { id: 'calendar', label: 'Calendrier', icon: Calendar, color: 'text-ac-sky' },
    { id: 'debts', label: 'Dettes', icon: Handshake, color: 'text-ac-orange' },
    { id: 'wishlist', label: 'Souhaits', icon: Gift, color: 'text-ac-red' },
    { id: 'social', label: 'Social', icon: Users, color: 'text-[#5C9440]' },
    { id: 'settings', label: 'Paramètres', icon: Settings, color: 'text-ac-brown-light' },
  ];

  const handleLogout = async () => {
    if (window.confirm("Es-tu sûr de vouloir quitter ton île budgétaire ?")) {
      try {
        await logOutUser();
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la déconnexion.");
      }
    }
  };

  return (
    <>
      <aside className="hidden md:flex w-64 bg-ac-cream-dark border-r-3 border-ac-brown flex flex-col justify-between h-screen sticky top-0 p-6 select-none">
        {/* Brand & Logo */}
        <div className="flex flex-col items-center">
          {photoURL ? (
            <div 
              onClick={isAdmin ? () => setActiveTab('admin') : undefined}
              className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center border-2 border-[#5C3A41] shrink-0 shadow-ac-sm mb-3 transform hover:rotate-12 transition-transform duration-200 cursor-pointer animate-fade-in ${
                isAdmin ? 'ring-3 ring-ac-orange ring-offset-2' : ''
              }`}
            >
              <img 
                src={photoURL} 
                alt="Profil" 
                className="w-full h-full object-cover object-center block" 
              />
            </div>
          ) : (
            <div 
              onClick={isAdmin ? () => setActiveTab('admin') : undefined}
              className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center border-2 border-[#5C3A41] shrink-0 bg-ac-green shadow-ac-sm mb-3 transform hover:rotate-12 transition-transform duration-200 cursor-pointer text-white font-black text-sm ${
                isAdmin ? 'ring-3 ring-ac-orange ring-offset-2' : ''
              }`}
            >
              {getInitial(username || user?.displayName)}
            </div>
          )}
          <h1 className="text-2xl font-black tracking-tight text-ac-brown text-center mb-1 flex items-center gap-1.5 justify-center">
            Ecopine
            {isAdmin && (
              <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 bg-[#E57373] text-white rounded-full border border-white shadow-sm flex items-center gap-0.5">
                🔑 Admin
              </span>
            )}
          </h1>
          <p className="text-xs font-semibold text-ac-brown-light text-center bg-ac-cream px-3 py-1 rounded-full border border-ac-brown/20">
            Mon App de gestion économique
          </p>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 my-6 flex flex-col gap-2.5 justify-start overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border-3 font-extrabold text-sm transition-all duration-150 text-left ac-btn ${
                  isActive
                    ? 'bg-ac-green text-white border-ac-brown shadow-none translate-y-1'
                    : 'bg-white text-ac-brown border-ac-brown hover:bg-ac-green-light hover:translate-y-[-2px]'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : item.color}`} />
                  {item.id === 'social' && pendingRequestsCount > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#E57373] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-pulse shadow-sm">
                      {pendingRequestsCount}
                    </div>
                  )}
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Disconnect Button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl border-3 font-extrabold text-sm bg-white text-ac-red border-ac-brown hover:bg-ac-red-light hover:translate-y-[-2px] transition-all duration-150 text-left ac-btn mt-4"
          >
            <LogOut className="w-5 h-5 text-ac-red" />
            <span>Déconnexion</span>
          </button>
        </nav>
      </aside>
    </>
  );
}
