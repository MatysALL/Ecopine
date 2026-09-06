import React from 'react';
import { useEncounter } from '../context/EncounterContext';
import { TOTEM_CONFIG } from '../utils/totems';

export default function TotemBadge({ totemId, className = '' }) {
  const { totems, handleBadgeClick } = useEncounter();
  const totemState = totems?.[totemId];

  // The badge is only visible if badgeUnlocked is true
  if (!totemState?.badgeUnlocked) {
    return null;
  }

  const config = TOTEM_CONFIG[totemId] || {
    id: totemId,
    name: totemId,
    img: `/${totemId}.png`
  };

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        handleBadgeClick(totemId);
      }}
      className={`relative w-9 h-9 rounded-full border-2 border-slate-900 bg-white shadow-sm flex items-center justify-center overflow-hidden hover:scale-110 active:scale-95 transition-transform cursor-pointer flex-shrink-0 select-none ${className}`}
      title={`Totem ${config.name}`}
      aria-label={`Totem ${config.name}`}
    >
      <img
        src={config.img}
        alt={config.name}
        className="w-7 h-7 object-contain drop-shadow-xs"
      />
      {totemState.completed && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white" title="Totem lié d'amitié" />
      )}
    </button>
  );
}
