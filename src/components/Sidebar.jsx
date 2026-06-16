import { Leaf, PiggyBank, Calendar, Settings, Smile, Gift } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'dashboard', label: 'Accueil', icon: Leaf, color: 'text-ac-green' },
    { id: 'accounts', label: 'Comptes', icon: PiggyBank, color: 'text-ac-gold' },
    { id: 'calendar', label: 'Calendrier', icon: Calendar, color: 'text-ac-sky' },
    { id: 'wishlist', label: 'Souhaits', icon: Gift, color: 'text-ac-red' },
    { id: 'settings', label: 'Paramètres', icon: Settings, color: 'text-ac-brown-light' },
  ];

  return (
    <aside className="w-64 bg-ac-cream-dark border-r-3 border-ac-brown flex flex-col justify-between h-screen sticky top-0 p-6 select-none">
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
      </nav>

      {/* Cute character advice widget */}
      <div className="bg-white rounded-2xl border-3 border-ac-brown p-4 shadow-ac-sm relative">
        <div className="absolute -top-3 right-3 bg-ac-gold border-2 border-ac-brown rounded-full px-2 py-0.5 text-[10px] font-black text-white flex items-center gap-1">
          <Smile className="w-3 h-3" /> Info
        </div>
        <p className="text-xs font-bold leading-relaxed text-ac-brown text-center pt-1">
          "Économise tes clochettes aujourd'hui pour t'offrir la maison de tes rêves demain !"
        </p>
        <div className="w-3 h-3 bg-white border-r-3 border-b-3 border-ac-brown absolute bottom-[-8px] left-1/2 transform -translate-x-1/2 rotate-45"></div>
      </div>
    </aside>
  );
}
