import React, { useMemo, useState } from 'react';
import { useDb } from '../db';
import { doc, updateDoc } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { X, Mail, Check, Plane } from 'lucide-react';

export default function ShareModal({ isOpen, onClose, docId, collectionName, allowedUsers = [], creatorId }) {
  const { user, friendships } = useDb();
  const [isUpdating, setIsUpdating] = useState(false);

  // Flat resolved friends list (status === 'accepted')
  const friends = useMemo(() => {
    if (!user) return [];
    return friendships
      .filter(f => f.status === 'accepted')
      .map(f => {
        const isSender = f.senderId === user.uid;
        return {
          uid: isSender ? f.receiverId : f.senderId,
          email: isSender ? f.receiverEmail : f.senderEmail,
          name: isSender ? f.receiverName : f.senderName,
          friendshipId: f.id
        };
      });
  }, [friendships, user]);

  const effectiveCreatorId = creatorId || allowedUsers[0] || user?.uid;

  const handleToggleFriend = async (friendUid) => {
    if (isUpdating || !docId) return;
    setIsUpdating(true);

    try {
      let newAllowed = [...allowedUsers];
      if (newAllowed.includes(friendUid)) {
        // Prevent removing the original creator
        if (friendUid === effectiveCreatorId) {
          setIsUpdating(false);
          return;
        }
        newAllowed = newAllowed.filter(uid => uid !== friendUid);
      } else {
        newAllowed.push(friendUid);
      }

      // Sync to Firestore
      const docRef = doc(firestoreDb, collectionName, docId);
      await updateDoc(docRef, { allowedUsers: newAllowed });
    } catch (err) {
      console.error("Error setting allowed users:", err);
      alert("Une erreur s'est produite lors du partage.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-ac-brown/65 backdrop-blur-xs flex items-center justify-center p-4 z-100 animate-fade-in text-ac-brown">
      {/* Postcard Container */}
      <div className="bg-[#FFFDF9] border-4 border-ac-brown rounded-3xl p-6 max-w-sm w-full shadow-ac-lg relative animate-bounce-in overflow-hidden">
        {/* Dodo Airlines header decoration */}
        <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-ac-sky via-ac-sky-light to-ac-sky"></div>
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1.5 transition-all text-ac-brown cursor-pointer z-10 hover:scale-105"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mt-2 text-center">
          <div className="w-12 h-12 bg-ac-sky-light border-2 border-ac-sky text-ac-sky rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
            <Mail className="w-6 h-6" />
          </div>
          <h3 className="text-md font-black tracking-wide">
            Courrier de l'île
          </h3>
          <p className="text-[10px] font-bold text-ac-sky uppercase tracking-wider mb-4 flex items-center justify-center gap-1">
            <Plane className="w-3 h-3" /> Dodo Airlines Postal
          </p>
        </div>

        <div className="bg-ac-cream/70 border-2 border-ac-brown/15 rounded-2xl p-4 mb-4 select-none">
          <p className="text-xs font-semibold leading-relaxed mb-3">
            Sélectionne les habitants avec qui tu souhaites partager cet élément :
          </p>

          {friends.length === 0 ? (
            <div className="text-center py-4 bg-white/50 border border-dashed border-ac-brown/10 rounded-xl">
              <p className="text-xs font-extrabold text-ac-brown-light">Tu n'as pas encore d'amis acceptés.</p>
              <p className="text-[9px] text-ac-brown-light/75 mt-0.5">Rends-toi dans les Paramètres pour envoyer des invitations.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {friends.map(friend => {
                const isChecked = allowedUsers.includes(friend.uid);
                const isCreator = friend.uid === effectiveCreatorId;

                return (
                  <div 
                    key={friend.uid}
                    onClick={() => !isCreator && handleToggleFriend(friend.uid)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border-2 transition-all select-none cursor-pointer ${
                      isChecked 
                        ? 'bg-ac-sky-light/40 border-ac-sky text-ac-sky' 
                        : 'bg-white border-ac-brown/10 hover:border-ac-brown/25'
                    } ${isCreator ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-extrabold flex items-center gap-1 text-ac-brown">
                        🍃 {friend.name}
                        {isCreator && <span className="text-[8px] bg-ac-brown/15 text-ac-brown font-black px-1.5 py-0.2 rounded-full uppercase scale-90">Créateur</span>}
                      </span>
                      <span className="text-[9px] text-ac-brown-light">{friend.email}</span>
                    </div>

                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${
                      isChecked 
                        ? 'bg-ac-sky border-ac-sky text-white' 
                        : 'border-ac-brown/30 bg-ac-cream'
                    }`}>
                      {isChecked && <Check className="w-4 h-4 stroke-[3px]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center text-[10px] text-ac-brown-light/80 font-bold border-t border-ac-brown/10 pt-3">
          <span>Dodo Airlines service postal v3.0</span>
          <span className="flex items-center gap-0.5">🍃 Écopine</span>
        </div>
      </div>
    </div>
  );
}
