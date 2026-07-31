import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDb } from '../db';
import { doc, updateDoc } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { Plus, X, Check } from 'lucide-react';
import { getPastelColor, getInitial } from './InlineShareSelector';

export default function AvatarStackPopover({
  allowedUsers = [],
  userRoles = {},
  ownerId,
  docId,
  collectionName,
  onUpdate,
  size = 'sm',
  onOpenChange
}) {
  const { acceptedFriends = [], user } = useDb();
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

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
    <div className="relative inline-block select-none">
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

      {/* Global Fixed Modal using createPortal to isolate stack contexts */}
      {isOpen && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="relative bg-[#FFF9FA] border-2 border-[#5C3A41] rounded-2xl p-6 w-full max-w-md shadow-2xl z-[10000] animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#5C3A41]/10 mb-4">
              <div className="flex items-center gap-2 text-sm font-black text-[#5C3A41]">
                <span>🍃</span>
                <span>Passeport Habitants</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full text-[#5C3A41]/60 hover:text-[#5C3A41] hover:bg-[#5C3A41]/5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs font-bold text-[#5C3A41]/80 mb-4">
              Gère l'accès et les rôles de tes amis en direct :
            </p>

            {/* Friends List */}
            {acceptedFriends.length === 0 ? (
              <div className="py-6 text-center bg-[#5C3A41]/5 rounded-2xl border-2 border-dashed border-[#5C3A41]/15">
                <p className="text-xs font-black text-[#5C3A41]">Aucun ami disponible</p>
                <p className="text-[10px] text-[#5C3A41]/60 mt-0.5">Ajoute des amis dans les Paramètres.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                {acceptedFriends.map(friend => {
                  const isSelected = allowedUsers.includes(friend.uid);
                  const role = userRoles[friend.uid] || 'editor';
                  const pastelStyle = getPastelColor(friend.uid);

                  return (
                    <div
                      key={friend.uid}
                      onClick={() => handleToggleFriend(friend.uid)}
                      className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all cursor-pointer select-none ${
                        isSelected
                          ? 'bg-ac-green-light/40 border-ac-green text-ac-brown'
                          : 'bg-white border-[#5C3A41]/10 hover:border-[#5C3A41]/30'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-black ${pastelStyle}`}>
                          {getInitial(friend.name)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-[#5C3A41] leading-tight">
                            {friend.name}
                          </span>
                          <span className="text-[10px] font-semibold text-[#5C3A41]/60 truncate max-w-[150px]">
                            {friend.email}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <button
                            type="button"
                            onClick={(e) => handleToggleRole(e, friend.uid)}
                            className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase flex items-center gap-1 cursor-pointer transition-all ${
                              role === 'editor'
                                ? 'bg-ac-green text-white border-ac-green'
                                : 'bg-ac-gold-light text-ac-gold-dark border-ac-gold/40'
                            }`}
                            title="Changer le rôle"
                          >
                            {role === 'editor' ? '✏️ Éditeur' : '👁️ Spectateur'}
                          </button>
                        )}

                        <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-ac-green border-ac-green text-white' : 'border-[#5C3A41]/20 bg-white'
                        }`}>
                          {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-[#5C3A41]/10 flex items-center justify-between text-[10px] font-extrabold text-[#5C3A41]/60">
              <span>🍃 Écopine Passeport</span>
              {isUpdating && <span className="text-ac-green animate-pulse">Synchro...</span>}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
