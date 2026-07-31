import React from 'react';
import { useDb } from '../db';
import { Check, Edit3, Eye } from 'lucide-react';

const PASTEL_COLORS = [
  'bg-[#FFD1DC] text-[#7A3036] border-[#F4A8B7]',
  'bg-[#C1E7E3] text-[#1E4D45] border-[#9AD2CC]',
  'bg-[#BAE1FF] text-[#1E3A8A] border-[#93C5FD]',
  'bg-[#FFFFBA] text-[#744210] border-[#FDE047]',
  'bg-[#E8DFF5] text-[#4A154B] border-[#C084FC]',
  'bg-[#FCE1E4] text-[#9B111E] border-[#F87171]',
  'bg-[#FCF4DD] text-[#7C2D12] border-[#FDBA74]',
  'bg-[#DDEDEA] text-[#134E4A] border-[#99F6E4]'
];

export function getPastelColor(uid = '') {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PASTEL_COLORS.length;
  return PASTEL_COLORS[index];
}

export function getInitial(name = '') {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function InlineShareSelector({
  allowedUsers = [],
  userRoles = {},
  onChange,
  onSelectFriend,
  ownerId,
  showRoles = true,
  title = "Passeport Habitants — Partager avec mes Amis"
}) {
  const { acceptedFriends = [], user } = useDb();

  const handleToggleUser = (friend) => {
    const friendUid = friend.uid;
    let newAllowed = [...allowedUsers];
    let newUserRoles = { ...userRoles };

    if (newAllowed.includes(friendUid)) {
      newAllowed = newAllowed.filter(uid => uid !== friendUid);
      delete newUserRoles[friendUid];
    } else {
      newAllowed.push(friendUid);
      if (!newUserRoles[friendUid]) {
        newUserRoles[friendUid] = 'editor';
      }
    }

    if (onChange) {
      onChange(newAllowed, newUserRoles);
    }
    if (onSelectFriend) {
      onSelectFriend(friend);
    }
  };

  const handleToggleRole = (e, friendUid) => {
    e.stopPropagation();
    const currentRole = userRoles[friendUid] || 'editor';
    const nextRole = currentRole === 'editor' ? 'viewer' : 'editor';
    const newUserRoles = { ...userRoles, [friendUid]: nextRole };
    if (onChange) {
      onChange(allowedUsers, newUserRoles);
    }
  };

  if (!acceptedFriends || acceptedFriends.length === 0) {
    return (
      <div className="bg-ac-cream/60 border-2 border-dashed border-ac-brown/20 rounded-2xl p-4 text-center select-none">
        <div className="flex justify-center mb-1">
          <span className="text-2xl animate-bounce">🍃</span>
        </div>
        <p className="text-xs font-black text-ac-brown">Registre des Habitants vide</p>
        <p className="text-[10px] font-bold text-ac-brown-light mt-0.5">
          Ajoute des amis dans les <strong>Paramètres</strong> pour leur partager tes éléments !
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 select-none">
      {title && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-black uppercase tracking-wider text-ac-brown-light flex items-center gap-1.5">
            <span>🍃</span> {title}
          </label>
          {allowedUsers.filter(u => u !== (ownerId || user?.uid)).length > 0 && (
            <span className="text-[10px] font-extrabold text-ac-green bg-ac-green-light px-2 py-0.5 rounded-full border border-ac-green/30 animate-fade-in">
              {allowedUsers.filter(u => u !== (ownerId || user?.uid)).length} sélectionné(s)
            </span>
          )}
        </div>
      )}

      {/* Horizontal Avatar Bar */}
      <div className="flex items-start gap-4 overflow-x-auto pb-3 pt-2 px-1 scroll-snap-x scrollbar-thin scrollbar-thumb-ac-brown/20">
        {acceptedFriends.map(friend => {
          const isSelected = allowedUsers.includes(friend.uid);
          const role = userRoles[friend.uid] || 'editor';
          const pastelStyle = getPastelColor(friend.uid);

          return (
            <div
              key={friend.uid}
              onClick={() => handleToggleUser(friend)}
              className="flex flex-col items-center flex-shrink-0 cursor-pointer group scroll-snap-align-start transition-all duration-200"
              style={{ width: '76px' }}
            >
              {/* Avatar Bubble Container */}
              <div className="relative">
                {friend.photoURL ? (
                  <img
                    src={friend.photoURL}
                    alt={friend.name}
                    className={`w-14 h-14 rounded-full object-cover shadow-ac-xs transition-all duration-200 group-hover:scale-105 active:scale-95 border-3 ${
                      isSelected
                        ? 'ring-4 ring-ac-green ring-offset-2 border-ac-green shadow-[0_0_12px_rgba(74,222,128,0.5)]'
                        : 'border-transparent opacity-70 group-hover:opacity-100 hover:border-ac-brown'
                    }`}
                  />
                ) : (
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-base shadow-ac-xs transition-all duration-200 group-hover:scale-105 active:scale-95 border-3 ${pastelStyle} ${
                      isSelected
                        ? 'ring-4 ring-ac-green ring-offset-2 border-ac-green shadow-[0_0_12px_rgba(74,222,128,0.5)]'
                        : 'opacity-70 group-hover:opacity-100 hover:border-ac-brown'
                    }`}
                  >
                    {getInitial(friend.name)}
                  </div>
                )}

                {/* Selected Check Badge */}
                {isSelected && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-ac-green border-2 border-white text-white rounded-full flex items-center justify-center text-[10px] shadow-ac-xs animate-bounce-in">
                    <Check className="w-3.5 h-3.5 stroke-[3.5]" />
                  </div>
                )}
              </div>

              {/* Name Below Avatar */}
              <span className={`text-[11px] font-extrabold mt-1.5 text-center truncate max-w-full leading-tight transition-colors ${
                isSelected ? 'text-ac-brown font-black' : 'text-ac-brown-light group-hover:text-ac-brown'
              }`}>
                {friend.name}
              </span>

              {/* In-Line Role Pill */}
              {showRoles && isSelected && (
                <button
                  type="button"
                  onClick={(e) => handleToggleRole(e, friend.uid)}
                  className={`mt-1.5 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase flex items-center gap-1 transition-all shadow-ac-xs active:scale-95 cursor-pointer ${
                    role === 'editor'
                      ? 'bg-ac-green-light text-ac-green border-ac-green/40 hover:bg-ac-green hover:text-white'
                      : 'bg-ac-gold-light text-ac-gold-dark border-ac-gold/40 hover:bg-ac-gold hover:text-ac-brown'
                  }`}
                  title="Cliquer pour changer le rôle"
                >
                  {role === 'editor' ? (
                    <>
                      <Edit3 className="w-2.5 h-2.5" /> Éditeur ▾
                    </>
                  ) : (
                    <>
                      <Eye className="w-2.5 h-2.5" /> Spectateur ▾
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
