import React from 'react';
import { 
  CreditCard, 
  Calendar, 
  Handshake, 
  Gift, 
  Leaf, 
  Settings, 
  Check, 
  Footprints
} from 'lucide-react';

export function TutorialBanner({ tutorialProgress, activeTab, setActiveTab }) {
  const steps = tutorialProgress?.steps || {};
  const completedCount = Object.values(steps).filter(Boolean).length;
  
  const stamps = [
    { id: 'home', label: 'Accueil', key: 'home', icon: Leaf, tabId: 'dashboard' },
    { id: 'accounts', label: 'Comptes', key: 'accounts', icon: CreditCard, tabId: 'accounts' },
    { id: 'calendar', label: 'Calendrier', key: 'calendar', icon: Calendar, tabId: 'calendar' },
    { id: 'debts', label: 'Dettes', key: 'debts', icon: Handshake, tabId: 'debts' },
    { id: 'wishlist', label: 'Souhaits', key: 'wishlist', icon: Gift, tabId: 'wishlist' },
    { id: 'settings', label: 'Paramètres', key: 'settings', icon: Settings, tabId: 'settings' }
  ];

  return (
    <div className="bg-[#FAF5E6] border-4 border-[#8C6D58] rounded-3xl p-4 sm:p-5 shadow-ac-sm animate-fade-in relative overflow-hidden select-none mb-6">
      {/* Decorative Stamp Background pattern */}
      <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none transform translate-x-4 translate-y-4">
        <Footprints className="w-48 h-48 rotate-12 text-[#8C6D58]" />
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-black text-[#5C3A41] flex items-center gap-1.5">
            🐾 Passeport d'Installation Nook
          </h3>
          <p className="text-[11px] font-bold text-[#8C6D58] mt-0.5">
            Complète les activités et récolte tes 6 tampons d'habitant pour valider ton île !
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase bg-[#8C6D58] text-white px-2.5 py-1 rounded-full border border-white/20">
            Tampons : {completedCount}/6
          </span>
        </div>
      </div>

      {/* Stamp Slots */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-4">
        {stamps.map(stamp => {
          const isDone = steps[stamp.key];
          const isActive = activeTab === stamp.tabId;
          const StampIcon = stamp.icon;

          return (
            <div
              key={stamp.id}
              onClick={() => setActiveTab(stamp.tabId)}
              className={`relative cursor-pointer flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-300 bg-white ${
                isActive 
                  ? 'border-[#7C9E59] shadow-ac-xs scale-102 bg-[#F2F9EC]' 
                  : 'border-[#E0DBCF] hover:border-[#8C6D58]/60 hover:bg-[#FAF9F5]'
              }`}
            >
              {/* Circle Ring */}
              <div className={`w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center relative shrink-0 transition-colors ${
                isDone 
                  ? 'border-[#7C9E59]/40 bg-[#7C9E59]/5' 
                  : 'border-[#C4BEB3]'
              }`}>
                {isDone ? (
                  // Stamp animation trigger
                  <div className="text-[#4F7335] scale-110 animate-bounce flex flex-col items-center justify-center">
                    <Footprints className="w-7 h-7 transform -rotate-12 absolute opacity-80" />
                    <Check className="w-4 h-4 bg-white/95 rounded-full p-0.5 border border-[#4F7335] absolute right-0 bottom-0 shadow-ac-xs font-black" />
                  </div>
                ) : (
                  <StampIcon className="w-5 h-5 text-[#8C6D58]/50" />
                )}
              </div>
              <span className="text-[9px] font-black uppercase text-[#5C3A41] mt-2 tracking-tight text-center">
                {stamp.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TutorialSpotlight({ activeTab, onValidate, onClose }) {
  const descriptions = {
    dashboard: {
      stepKey: 'home',
      title: 'Mon Bureau d\'Habitant',
      msg: 'Ton tableau de bord récapitulatif ! Retrouve tes poches prioritaires, les conseils de Tom Nook et le fil de tes dernières transactions.'
    },
    accounts: {
      stepKey: 'accounts',
      title: 'Gestion de la Trésorerie',
      msg: 'Bienvenue dans ta trésorerie ! Ici, tu peux créer tes vrais comptes bancaires et les diviser en Poches Virtuelles pour budgétiser tes d\'épenses.'
    },
    calendar: {
      stepKey: 'calendar',
      title: 'Calendrier Économique',
      msg: 'Le calendrier te permet de planifier tes renouvellements de budget et d\'anticiper tes échéances de clochettes du mois !'
    },
    debts: {
      stepKey: 'debts',
      title: 'Registre des Dettes',
      msg: 'Tu as prêté des clochettes à un habitant ? Note-le ici ! Tu pourras lier une dette directement à un ami pour solder tes comptes en un clic.'
    },
    wishlist: {
      stepKey: 'wishlist',
      title: 'Liste des Souhaits',
      msg: 'Garde le cap sur tes objectifs ! Ajoute tes projets d\'achats dans ta liste de souhaits et mets de côté petit à petit.'
    },
    settings: {
      stepKey: 'settings',
      title: 'Mairie & Configuration',
      msg: 'Personnalise ton île ! Change ton avatar d\'habitant, débloque des thèmes secrets et gère tes demandes d\'amis dans le Registre des Habitants.'
    }
  };

  const info = descriptions[activeTab];
  if (!info) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none animate-fade-in">
      <div className="relative bg-[#FAF5E6] border-4 border-[#8C6D58] rounded-3xl p-6 shadow-ac-lg max-w-md w-full text-ac-brown">
        {/* Tom Nook Avatar Section */}
        <div className="flex items-center gap-3.5 pb-4 border-b-2 border-[#8C6D58]/10">
          <div className="w-12 h-12 rounded-full border-2 border-[#5C3A41] bg-[#78B159] flex items-center justify-center text-2xl shadow-ac-sm shrink-0">
            🦝
          </div>
          <div>
            <h4 className="text-xs font-black uppercase text-[#8C6D58] tracking-wider">Tom Nook explique...</h4>
            <h3 className="text-sm font-black text-[#5C3A41]">{info.title}</h3>
          </div>
        </div>

        {/* Bubble dialog text */}
        <div className="my-5 bg-white border-2 border-[#8C6D58]/20 rounded-2xl p-4 min-h-[90px] flex items-center relative">
          {/* Arrow */}
          <div className="absolute left-4 -top-2 w-3.5 h-3.5 bg-white border-t-2 border-l-2 border-[#8C6D58]/20 transform rotate-45"></div>
          
          <p className="text-xs font-bold text-[#5C3A41] leading-relaxed">
            {info.msg}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="text-[10px] font-black text-[#8C6D58] hover:underline px-3 py-2 cursor-pointer"
          >
            Plus tard
          </button>

          <button
            onClick={() => onValidate(info.stepKey)}
            className="bg-[#78B159] hover:bg-[#689B48] text-white border-3 border-[#5C3A41] font-extrabold text-xs px-5 py-2.5 rounded-2xl shadow-ac-xs active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
          >
            Valider ce tampon ! 🐾
          </button>
        </div>
      </div>
    </div>
  );
}

export function TutorialCelebrationModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none animate-fade-in">
      <div className="relative bg-white border-4 border-[#78B159] rounded-3xl p-6 sm:p-8 shadow-ac-lg max-w-md w-full text-center text-ac-brown">
        {/* Confetti decoration */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
          <div className="text-xs absolute left-10 top-10 animate-pulse">🎉</div>
          <div className="text-xs absolute right-10 top-10 animate-pulse">✨</div>
          <div className="text-xs absolute left-20 bottom-10 animate-pulse">🎈</div>
          <div className="text-xs absolute right-20 bottom-10 animate-pulse">🌸</div>
        </div>

        <div className="w-20 h-20 rounded-full border-4 border-[#5C3A41] bg-[#FAF5E6] flex items-center justify-center text-4xl shadow-ac-sm mx-auto mb-4 animate-bounce">
          🦝
        </div>

        <h3 className="text-lg font-black text-[#78B159] uppercase tracking-wide">Félicitations !</h3>
        <h2 className="text-xl font-black text-[#5C3A41] mt-1">Passeport 100% Validé</h2>

        <div className="my-5 bg-[#FAF5E6] border-2 border-[#8C6D58]/20 rounded-2xl p-4">
          <p className="text-xs font-bold text-[#5C3A41] leading-relaxed">
            "Félicitations ! Ton Passeport d'Installation est à 100 % validé. Tu es officiellement un habitant expérimenté d'Ecopine !"
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-[#78B159] hover:bg-[#689B48] text-white border-3 border-[#5C3A41] font-extrabold text-sm py-3 rounded-2xl shadow-ac-sm active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          Merci Tom Nook ! 🐾
        </button>
      </div>
    </div>
  );
}
