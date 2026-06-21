import React, { useState } from 'react';
import { Leaf, PiggyBank, Calendar, Settings, Smile, Gift, LogOut } from 'lucide-react';
import { useDb } from '../db';

export default function Sidebar({ activeTab, setActiveTab }) {
  const { logOutUser } = useDb();
  
  const navItems = [
    { id: 'dashboard', label: 'Accueil', icon: Leaf, color: 'text-ac-green' },
    { id: 'accounts', label: 'Comptes', icon: PiggyBank, color: 'text-ac-gold' },
    { id: 'calendar', label: 'Calendrier', icon: Calendar, color: 'text-ac-sky' },
    { id: 'wishlist', label: 'Souhaits', icon: Gift, color: 'text-ac-red' },
    { id: 'settings', label: 'Paramètres', icon: Settings, color: 'text-ac-brown-light' },
  ];

  // Nook interactive advice states
  const nookAdvices = [
    "Économise tes clochettes aujourd'hui pour t'offrir la maison de tes rêves demain !",
    "Un prêt à taux zéro, c'est une affaire en or ! Oui, oui !",
    "Pense à placer tes clochettes avant que le cours du navet ne chute !",
    "Agrandir ta maison demande des sacrifices économiques constants...",
    "Chaque projet de pont ou de rampe demande la participation de tous, mais surtout la tienne ! Oui, oui !"
  ];

  const [currentAdviceIndex, setCurrentAdviceIndex] = useState(0);
  const [viewedIndices, setViewedIndices] = useState([0]);
  const [phase, setPhase] = useState('advices'); // 'advices', 'yellow', 'distress', 'sold'
  const [yellowClickCount, setYellowClickCount] = useState(0);
  const [distressClickCount, setDistressClickCount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleCardClick = () => {
    if (isAnimating || phase === 'sold') return;

    setIsAnimating(true);

    // Swap text state halfway through animation (at 100ms)
    setTimeout(() => {
      if (phase === 'advices') {
        const unviewed = nookAdvices
          .map((_, idx) => idx)
          .filter(idx => !viewedIndices.includes(idx));

        if (unviewed.length > 0) {
          const randomIdx = unviewed[Math.floor(Math.random() * unviewed.length)];
          setCurrentAdviceIndex(randomIdx);
          setViewedIndices(prev => [...prev, randomIdx]);
        } else {
          setPhase('yellow');
        }
      } else if (phase === 'yellow') {
        const nextCount = yellowClickCount + 1;
        setYellowClickCount(nextCount);
        if (nextCount >= 5) {
          setPhase('distress');
        }
      } else if (phase === 'distress') {
        const nextCount = distressClickCount + 1;
        setDistressClickCount(nextCount);
        if (nextCount >= 10) {
          setPhase('sold');
        }
      }
    }, 100);

    // End animation after 200ms
    setTimeout(() => {
      setIsAnimating(false);
    }, 200);
  };

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

  const mobileNavItems = [
    { id: 'dashboard', label: 'Accueil', icon: Leaf, color: 'text-ac-green' },
    { id: 'accounts', label: 'Comptes', icon: PiggyBank, color: 'text-ac-gold' },
    { id: 'calendar', label: 'Calendrier', icon: Calendar, color: 'text-ac-sky' },
    { id: 'wishlist', label: 'Souhaits', icon: Gift, color: 'text-ac-red' },
    { id: 'settings', label: 'Paramètres', icon: Settings, color: 'text-ac-brown-light' },
  ];

  return (
    <>
      <aside className="hidden md:flex w-64 bg-ac-cream-dark border-r-3 border-ac-brown flex flex-col justify-between h-screen sticky top-0 p-6 select-none">
        {/* Brand & Logo */}
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 bg-ac-green rounded-full flex items-center justify-center border-3 border-ac-brown shadow-ac-sm mb-3 transform hover:rotate-12 transition-transform duration-200 cursor-pointer">
            <Leaf className="w-12 h-12 text-white fill-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-ac-brown text-center mb-1">
            Ecopine
          </h1>
          <p className="text-xs font-semibold text-ac-brown-light text-center bg-ac-cream px-3 py-1 rounded-full border border-ac-brown/20">
            Mon App de gestion économique
          </p>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 my-10 flex flex-col gap-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-3 font-extrabold text-sm transition-all duration-150 text-left ac-btn ${
                  isActive
                    ? 'bg-ac-green text-white border-ac-brown shadow-none translate-y-1'
                    : 'bg-white text-ac-brown border-ac-brown hover:bg-ac-green-light hover:translate-y-[-2px]'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : item.color}`} />
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

        {/* Cute character advice widget */}
        {phase === 'sold' ? (
          <div className="border-4 border-dashed border-ac-red bg-ac-red-light/20 rounded-2xl p-6 flex items-center justify-center shadow-ac-sm animate-bounce-in relative">
            <span className="text-2xl font-black text-ac-red uppercase tracking-wider transform -rotate-12 border-4 border-ac-red px-4 py-2 rounded-xl bg-white shadow-ac-xs">
              Vendu 
            </span>
          </div>
        ) : (
          <div 
            onClick={handleCardClick}
            className={`bg-white rounded-2xl border-3 border-ac-brown p-4 shadow-ac-sm relative cursor-pointer select-none transition-all duration-200 transform ${
              isAnimating 
                ? 'scale-90 -translate-y-2 opacity-50 rotate-3 z-0' 
                : 'scale-100 translate-y-0 opacity-100 z-10 hover:scale-[1.03]'
            }`}
            style={{ transformOrigin: 'bottom' }}
          >
            <div className="absolute -top-3 right-3 border-2 border-ac-brown rounded-full px-2 py-0.5 text-[10px] font-black text-white bg-ac-gold flex items-center gap-1">
              <Smile className="w-3 h-3" /> Info
            </div>
            <p className="text-xs font-bold leading-relaxed text-center pt-1 text-ac-brown">
              {phase === 'advices' && `"${nookAdvices[currentAdviceIndex]}"`}
              {phase === 'yellow' && `"Je ne suis pas une banque à conseils. Oui, Oui. Ma spécialité c'est garder mon argent"`}
              {phase === 'distress' && `"Eh je suis vraiment à sec !"`}
            </p>
            <div className="w-3 h-3 bg-white border-r-3 border-b-3 border-ac-brown absolute bottom-[-8px] left-1/2 transform -translate-x-1/2 rotate-45"></div>
          </div>
        )}
      </aside>

      {/* Mobile NookPhone Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-ac-cream border-t-4 border-ac-brown shadow-[0_-4px_10px_rgba(74,62,61,0.12)] flex justify-around items-center px-4 py-3 pb-safe-bottom z-40">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-12 h-12 rounded-full border-3 border-ac-brown flex items-center justify-center transition-all duration-150 select-none ${
                isActive
                  ? 'bg-ac-green text-white border-ac-brown shadow-none translate-y-1'
                  : 'bg-white text-ac-brown border-ac-brown shadow-ac-sm active:translate-y-1 active:shadow-none'
              }`}
              title={item.label}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : item.color}`} />
            </button>
          );
        })}
      </nav>
    </>
  );
}
