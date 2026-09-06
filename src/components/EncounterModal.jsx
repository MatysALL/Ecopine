import React from 'react';
import { useEncounter } from '../context/EncounterContext';
import { X, Sparkles } from 'lucide-react';

export default function EncounterModal() {
  const { activeEncounter, confirmDiscovery, setActiveEncounter } = useEncounter();

  if (!activeEncounter) return null;

  const handleConfirm = () => {
    confirmDiscovery(activeEncounter.id);
  };

  const handleClose = () => {
    setActiveEncounter(null);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="relative max-w-md w-full bg-gradient-to-b from-[#182620] via-[#0f1d17] to-[#07130e] border-3 border-emerald-400/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center overflow-hidden animate-bounce-in text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glowing atmospheric auras */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/25 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-teal-400/20 rounded-full blur-2xl pointer-events-none"></div>

        {/* Top-right close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 hover:text-white transition-all cursor-pointer hover:scale-105 active:scale-95"
          title="Fermer"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Floating badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-black tracking-wide uppercase mb-6 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
          <span>Nouvelle Rencontre</span>
        </div>

        {/* Mascot Avatar with gentle floating glow */}
        <div className="relative mx-auto w-36 h-36 mb-6">
          <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-xl animate-pulse"></div>
          <div className="relative w-full h-full rounded-full p-2 bg-gradient-to-tr from-emerald-500/30 via-white/10 to-teal-400/30 border-2 border-emerald-300/50 shadow-inner flex items-center justify-center overflow-hidden hover:scale-105 transition-transform duration-300">
            <img 
              src={activeEncounter.img} 
              alt={activeEncounter.name} 
              className="w-28 h-28 object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)] transition-transform duration-500 animate-pulse"
            />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 leading-tight drop-shadow-sm">
          Il est temps de rencontrer le {activeEncounter.name}
        </h2>

        {/* Ambient narrative caption */}
        <p className="text-xs sm:text-sm font-semibold text-emerald-100/75 max-w-xs mx-auto mb-7 leading-relaxed">
          Un nouveau Totem a rejoint ta ville.
        </p>

        {/* Bouton D'accord */}
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-emerald-950/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-emerald-200/40"
        >
          D'accord
        </button>
      </div>
    </div>
  );
}
