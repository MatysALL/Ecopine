import React, { useState, useRef, useEffect } from 'react';
import { useDb, db } from '../db';
import { doc, updateDoc } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { Plus, X, Check, Edit3, Eye, Shield, Users } from 'lucide-react';
import { getPastelColor, getInitial } from './InlineShareSelector';

export default function AvatarStackPopover({
  allowedUsers = [],
  userRoles = {},
  ownerId,
  docId,
  collectionName,
  onUpdate,
  size = 'sm',
  position = 'bottom',
  onOpenChange
}) {
  const { acceptedFriends = [], user } = useDb();
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const popoverRef = useRef(null);

  const positionClass = position === 'top' 
    ? 'bottom-full mb-2 right-0' 
    : 'top-full mt-2 right-0';

  const effectiveOwnerId = ownerId || allowedUsers[0] || user?.uid;

  // Filter allowed friends (excluding owner)
  const sharedFriends = acceptedFriends.filter(f => allowedUsers.includes(friendUid(f)));

  function friendUid(f) {
    return f.uid;
  }

  // Notify parent component of open state changes
  useEffect(() => {
    if (onOpenChange) {
      onOpenChange(isOpen);
    }
  }, [isOpen, onOpenChange]);

  // Handle click outside to close popover
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggleFriend = async (friendUid) => {
    if (isUpdating) return;

    let newAllowed = [...allowedUsers];
    let newUserRoles = { ...userRoles };

    if (newAllowed.includes(friendUid)) {
      if (friendUid === effectiveOwnerId) return; // Cannot remove owner
      newAllowed = newAllowed.filter(u => u !== friendUid);
      delete newUserRoles[friendUid];
    } else {
      newAllowed.push(friendUid);
      if (!newUserRoles[friendUid]) {
        newUserRoles[friendUid] = 'editor';
      }
    }

    await syncChanges(newAllowed, newUserRoles);
  };

  const handleToggleRole = async (e, friendUid) => {
    e.stopPropagation();
    if (isUpdating) return;

    const currentRole = userRoles[friendUid] || 'editor';
    const nextRole = currentRole === 'editor' ? 'viewer' : 'editor';
    const newUserRoles = { ...userRoles, [friendUid]: nextRole };

    await syncChanges(allowedUsers, newUserRoles);
  };

  const syncChanges = async (newAllowed, newUserRoles) => {
    if (onUpdate) {
      onUpdate(newAllowed, newUserRoles);
    }

    if (docId && collectionName) {
      setIsUpdating(true);
      try {
        const docRef = doc(firestoreDb, collectionName, docId);
        await updateDoc(docRef, {
          allowedUsers: newAllowed,
          userRoles: newUserRoles
        });
      } catch (err) {
        console.error("Error updating permissions:", err);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const avatarSizeClass = size === 'md' ? 'w-8 h-8 text-xs border-2' : 'w-6 h-6 text-[10px] border-2';
  const plusSizeClass = size === 'md' ? 'w-8 h-8 text-sm' : 'w-6 h-6 text-xs';

  return (
    <div className={`relative inline-block select-none ${isOpen ? 'z-40' : 'z-0'}`} ref={popoverRef}>
      {/* Avatar Stack Trigger */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center -space-x-2 cursor-pointer group p-1 rounded-full hover:bg-ac-brown/5 transition-colors"
        title="Gérer les partages de l'île"
      >
        {/* Owner Avatar (if shared with others or explicitly passed) */}
        {allowedUsers.length > 1 && (
          <div 
            className={`rounded-full bg-ac-brown text-white font-black flex items-center justify-center border-white shadow-ac-xs ${avatarSizeClass}`}
            title="Propriétaire 🍃"
          >
            🍃
          </div>
        )}

        {/* Shared Friends Avatars */}
        {sharedFriends.slice(0, 3).map(friend => {
          const pastelStyle = getPastelColor(friend.uid);
          return (
            <div
              key={friend.uid}
              className={`rounded-full flex items-center justify-center font-black border-white shadow-ac-xs ${pastelStyle} ${avatarSizeClass}`}
              title={`${friend.name} (${userRoles[friend.uid] === 'viewer' ? 'Spectateur' : 'Éditeur'})`}
            >
              {getInitial(friend.name)}
            </div>
          );
        })}

        {/* Overflow Count Badge if > 3 friends */}
        {sharedFriends.length > 3 && (
          <div className={`rounded-full bg-ac-cream-dark border-ac-brown text-ac-brown font-black flex items-center justify-center border-white shadow-ac-xs ${avatarSizeClass}`}>
            +{sharedFriends.length - 3}
          </div>
        )}

        {/* Plus Button */}
        <div className={`rounded-full bg-ac-cream hover:bg-ac-green hover:text-white border-2 border-ac-brown text-ac-brown font-extrabold flex items-center justify-center transition-all shadow-ac-xs group-hover:scale-110 active:scale-95 ${plusSizeClass}`}>
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
        </div>
      </div>

      {/* Instant Floating Mini-Popover */}
      {isOpen && (
        <div className={`absolute ${positionClass} z-[100] w-72 bg-[#FFFDF9] border-3 border-ac-brown rounded-2xl p-3.5 shadow-ac-md animate-bounce-in`}>
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-ac-brown/10 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-ac-brown">
              <span>🍃</span>
              <span>Passeport Habitants</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-full text-ac-brown-light hover:text-ac-brown hover:bg-ac-cream transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[10px] font-bold text-ac-brown-light mb-2">
            Gère l'accès et les rôles de tes amis en direct :
          </p>

          {/* Friends List */}
          {acceptedFriends.length === 0 ? (
            <div className="py-3 text-center bg-ac-cream/50 rounded-xl border border-dashed border-ac-brown/15">
              <p className="text-[11px] font-black text-ac-brown">Aucun ami disponible</p>
              <p className="text-[9px] text-ac-brown-light">Ajoute des amis dans les Paramètres.</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5 scrollbar-thin">
              {acceptedFriends.map(friend => {
                const isSelected = allowedUsers.includes(friend.uid);
                const role = userRoles[friend.uid] || 'editor';
                const pastelStyle = getPastelColor(friend.uid);

                return (
                  <div
                    key={friend.uid}
                    onClick={() => handleToggleFriend(friend.uid)}
                    className={`flex items-center justify-between p-2 rounded-xl border-2 transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-ac-green-light/40 border-ac-green text-ac-brown'
                        : 'bg-white border-ac-brown/10 hover:border-ac-brown/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-[10px] font-black ${pastelStyle}`}>
                        {getInitial(friend.name)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-ac-brown leading-tight">
                          {friend.name}
                        </span>
                        <span className="text-[9px] font-semibold text-ac-brown-light truncate max-w-[110px]">
                          {friend.email}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isSelected && (
                        <button
                          type="button"
                          onClick={(e) => handleToggleRole(e, friend.uid)}
                          className={`px-1.5 py-0.5 rounded-full border text-[8px] font-black uppercase flex items-center gap-0.5 cursor-pointer transition-all ${
                            role === 'editor'
                              ? 'bg-ac-green text-white border-ac-green'
                              : 'bg-ac-gold-light text-ac-gold-dark border-ac-gold/40'
                          }`}
                          title="Changer le rôle"
                        >
                          {role === 'editor' ? '✏️ Éditeur' : '👁️ Spectateur'}
                        </button>
                      )}

                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-ac-green border-ac-green text-white' : 'border-ac-brown/20 bg-ac-cream'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-2.5 pt-2 border-t border-ac-brown/10 flex items-center justify-between text-[9px] font-extrabold text-ac-brown-light">
            <span>🍃 Écopine Passeport</span>
            {isUpdating && <span className="text-ac-green animate-pulse">Synchro...</span>}
          </div>
        </div>
      )}
    </div>
  );
}
