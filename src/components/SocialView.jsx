import React, { useState, useMemo } from 'react';
import { useDb, db } from '../db';
import { 
  Users, Search, UserPlus, UserMinus, Check, X, Flag, 
  Trash2, ShieldAlert, HeartHandshake, AlertCircle, Sparkles,
  Clock, CheckCircle, ShieldCheck
} from 'lucide-react';

export default function SocialView() {
  const { 
    user, 
    acceptedFriends = [], 
    friendships = [], 
    allUsersMeta = [], 
    redlist = [] 
  } = useDb();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Modals state
  const [friendToDelete, setFriendToDelete] = useState(null);
  const [isRedlistModalOpen, setIsRedlistModalOpen] = useState(false);

  // Helper for notification toast
  const showToast = (msg, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 3500);
    } else {
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(null), 3500);
    }
  };

  // 1. List of pending received friend requests
  const receivedRequests = useMemo(() => {
    if (!friendships || !user) return [];
    return friendships
      .filter(f => f.status === 'pending' && f.receiverId === user.uid)
      .map(req => {
        const senderMeta = allUsersMeta.find(m => m.uid === req.senderId);
        return {
          ...req,
          avatar: senderMeta?.photoURL || senderMeta?.avatarUrl || '/pfp-ac.jpg',
          name: senderMeta?.username || req.senderName || 'Habitant'
        };
      });
  }, [friendships, user, allUsersMeta]);

  // 2. Sent pending requests map for fast lookup
  const sentRequestsMap = useMemo(() => {
    const map = new Set();
    if (!friendships || !user) return map;
    friendships
      .filter(f => f.status === 'pending' && f.senderId === user.uid)
      .forEach(f => map.add(f.receiverId));
    return map;
  }, [friendships, user]);

  // 3. Accepted friends UID set
  const acceptedFriendsUidSet = useMemo(() => {
    return new Set(acceptedFriends.map(f => f.uid));
  }, [acceptedFriends]);

  // 4. Received requests sender UID set
  const receivedRequestsUidSet = useMemo(() => {
    return new Set(receivedRequests.map(r => r.senderId));
  }, [receivedRequests]);

  // 5. Search filtering on allUsersMeta
  const searchResults = useMemo(() => {
    if (!user || !allUsersMeta) return [];
    const queryNorm = searchQuery.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    return allUsersMeta
      .filter(u => u.uid !== user.uid) // Exclude current user
      .filter(u => {
        if (!queryNorm) return true; // Show list if empty or show matches
        const nameNorm = (u.username || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const emailNorm = (u.email || '').toLowerCase();
        return nameNorm.includes(queryNorm) || emailNorm.includes(queryNorm);
      })
      .sort((a, b) => (a.username || '').localeCompare(b.username || '', undefined, { sensitivity: 'base' }));
  }, [allUsersMeta, user, searchQuery]);

  // Handlers for friendship actions
  const handleSendFriendRequest = async (targetUser) => {
    setActionLoading(targetUser.uid);
    try {
      await db.friendships.sendRequest(targetUser.uid);
      showToast(`Demande d'ami envoyée à ${targetUser.username || 'cet habitant'} ! 🍃`);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Erreur lors de l'envoi de la demande.", true);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptRequest = async (reqId, senderName) => {
    setActionLoading(reqId);
    try {
      await db.friendships.acceptRequest(reqId);
      showToast(`Tu es maintenant ami avec ${senderName || 'cet habitant'} ! 🎉`);
    } catch (err) {
      console.error(err);
      showToast("Impossible d'accepter la demande.", true);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectAndRedlist = async (reqId, senderUid, senderName) => {
    setActionLoading(reqId);
    try {
      await db.friendships.rejectAndRedlist(reqId, senderUid);
      showToast(`Demande refusée. ${senderName || 'Cet habitant'} a été ajouté à ta Redlist. 🚩`);
    } catch (err) {
      console.error(err);
      showToast("Erreur lors du refus de la demande.", true);
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmDeleteFriend = async () => {
    if (!friendToDelete) return;
    setActionLoading(friendToDelete.id);
    try {
      await db.friendships.delete(friendToDelete.id);
      showToast(`${friendToDelete.name} a été retiré de tes amis.`);
      setFriendToDelete(null);
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de la suppression de l'ami.", true);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveFromRedlist = async (targetUid, targetName) => {
    setActionLoading(targetUid);
    try {
      await db.friendships.removeFromRedlist(targetUid);
      showToast(`${targetName || 'Habitant'} retiré de ta Redlist.`);
    } catch (err) {
      console.error(err);
      showToast("Erreur lors du retrait de la Redlist.", true);
    } finally {
      setActionLoading(null);
    }
  };

  // Resolved Redlist items with meta
  const redlistedUsers = useMemo(() => {
    if (!redlist || redlist.length === 0) return [];
    return redlist.map(uid => {
      const meta = allUsersMeta.find(m => m.uid === uid);
      return {
        uid,
        name: meta?.username || 'Habitant inconnu',
        avatar: meta?.photoURL || meta?.avatarUrl || '/pfp-ac.jpg',
        email: meta?.email || ''
      };
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [redlist, allUsersMeta]);

  return (
    <div className="space-y-6 animate-fade-in text-ac-brown select-none max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm">
        <div>
          <h2 className="text-2xl font-black text-ac-brown flex items-center gap-2.5">
            <HeartHandshake className="w-7 h-7 text-ac-green" /> Espace Social & Amitiés
          </h2>
          <p className="text-xs font-semibold text-ac-brown-light mt-1">
            Retrouve tes amis insulaires, explore l'annuaire des habitants et gère tes invitations.
          </p>
        </div>

        {/* Global Stats / Quick Counter */}
        <div className="flex items-center gap-3">
          <div className="bg-ac-cream px-4 py-2 rounded-2xl border-2 border-ac-brown/15 flex items-center gap-2">
            <Users className="w-4 h-4 text-ac-green" />
            <span className="text-xs font-black text-ac-brown">
              {acceptedFriends.length} {acceptedFriends.length > 1 ? 'amis' : 'ami'}
            </span>
          </div>
          {receivedRequests.length > 0 && (
            <div className="bg-ac-red/15 text-ac-red px-3.5 py-2 rounded-2xl border-2 border-ac-red/30 flex items-center gap-1.5 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-xs font-black">
                {receivedRequests.length} {receivedRequests.length > 1 ? 'invitations' : 'invitation'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Notifications Toast */}
      {successMessage && (
        <div className="p-3.5 bg-[#78B159]/15 border-2 border-ac-green rounded-2xl flex items-center gap-2 text-xs font-bold text-ac-brown animate-bounce-in shadow-ac-xs">
          <CheckCircle className="w-4 h-4 text-ac-green shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3.5 bg-ac-red/10 border-2 border-ac-red rounded-2xl flex items-center gap-2 text-xs font-bold text-ac-red animate-bounce-in shadow-ac-xs">
          <AlertCircle className="w-4 h-4 text-ac-red shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Grid: Left (Large Widget 1) & Right (Widgets 2 & 3 stacked) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ========================================================================= */}
        {/* WIDGET 1 : MES AMIS (Grand Widget - Gauche)                               */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 ac-card p-6 bg-white border-3 border-ac-brown flex flex-col justify-between min-h-[540px]">
          <div className="space-y-4">
            {/* Title & Count */}
            <div className="flex items-center justify-between border-b-2 border-ac-brown/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-ac-green/15 border-2 border-ac-green/30 flex items-center justify-center">
                  <Users className="w-4 h-4 text-ac-green" />
                </div>
                <div>
                  <h3 className="text-base font-black text-ac-brown">Mes Amis</h3>
                  <p className="text-[10px] font-bold text-ac-brown-light">Triés par ordre alphabétique</p>
                </div>
              </div>
              <span className="text-xs font-black px-2.5 py-1 bg-ac-cream rounded-full border border-ac-brown/20 text-ac-brown">
                {acceptedFriends.length} habitant{acceptedFriends.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Friends list */}
            {acceptedFriends.length === 0 ? (
              <div className="py-16 px-4 text-center bg-ac-cream/40 border-2 border-dashed border-ac-brown/20 rounded-3xl space-y-3">
                <div className="w-14 h-14 rounded-full bg-white border-2 border-ac-brown/20 mx-auto flex items-center justify-center shadow-ac-xs">
                  <HeartHandshake className="w-7 h-7 text-ac-green/70" />
                </div>
                <div>
                  <p className="text-sm font-black text-ac-brown">Tu n'as pas encore d'amis sur l'île</p>
                  <p className="text-xs font-semibold text-ac-brown-light max-w-sm mx-auto mt-1">
                    Recherche un habitant dans le panneau de droite pour lui envoyer une invitation d'amitié ! 🍃
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[580px] overflow-y-auto pr-1">
                {acceptedFriends.map(friend => (
                  <div
                    key={friend.id}
                    className="p-3.5 bg-ac-cream/60 hover:bg-white border-2 border-ac-brown rounded-2xl flex items-center justify-between shadow-ac-xs hover:shadow-ac-sm hover:translate-y-[-1px] transition-all duration-150 group"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-ac-brown shrink-0 bg-white shadow-xs">
                        <img
                          src={friend.photoURL || '/pfp-ac.jpg'}
                          alt={friend.name}
                          className="w-full h-full object-cover object-center block"
                          onError={(e) => { e.currentTarget.src = '/pfp-ac.jpg'; }}
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-black text-ac-brown truncate flex items-center gap-1">
                          🍃 {friend.name}
                        </span>
                        {friend.email && (
                          <span className="text-[10px] font-semibold text-ac-brown-light truncate opacity-80">
                            {friend.email}
                          </span>
                        )}
                        <span className="text-[9px] font-extrabold text-ac-green flex items-center gap-0.5 mt-0.5">
                          <Check className="w-2.5 h-2.5" /> Ami de l'île
                        </span>
                      </div>
                    </div>

                    {/* Delete Friend Button */}
                    <button
                      onClick={() => setFriendToDelete(friend)}
                      className="p-2 rounded-xl bg-white hover:bg-ac-red/10 border-2 border-ac-brown/15 hover:border-ac-red text-ac-brown-light hover:text-ac-red transition-all cursor-pointer shrink-0 shadow-xs"
                      title="Retirer de mes amis"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Info note */}
          <div className="pt-4 mt-4 border-t border-ac-brown/10 text-[10px] font-semibold text-ac-brown-light flex items-center gap-1.5">
            <span>💡 Vos comptes et souhaits partagés sont automatiquement synchronisés entre amis acceptés.</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN (Stacked Widgets 2 & 3)                                     */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* ======================================================================= */}
          {/* WIDGET 2 : RECHERCHER UN HABITANT (Haut Droite)                         */}
          {/* ======================================================================= */}
          <div className="ac-card p-5 bg-white border-3 border-ac-brown space-y-4">
            <div className="flex items-center justify-between border-b-2 border-ac-brown/10 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-ac-gold/20 border-2 border-ac-gold/40 flex items-center justify-center">
                  <Search className="w-3.5 h-3.5 text-ac-brown" />
                </div>
                <h3 className="text-sm font-black text-ac-brown">Rechercher un habitant</h3>
              </div>
              <span className="text-[10px] font-black text-ac-brown-light">
                {searchResults.length} trouvé{searchResults.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Real-time search bar */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tape un pseudo ou un email..."
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl pl-9 pr-8 py-2.5 text-xs font-bold text-ac-brown placeholder:text-ac-brown-light/60 focus:outline-none focus:bg-white transition-all shadow-inner"
              />
              <Search className="w-4 h-4 text-ac-brown-light absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ac-brown-light hover:text-ac-brown p-0.5 rounded-full cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Search results list */}
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {searchResults.length === 0 ? (
                <div className="py-6 text-center text-xs font-bold text-ac-brown-light/70 bg-ac-cream/40 rounded-2xl border border-dashed border-ac-brown/20">
                  Aucun habitant correspondant trouvé 🍃
                </div>
              ) : (
                searchResults.map(targetUser => {
                  const targetRedlist = Array.isArray(targetUser.redlist) ? targetUser.redlist : [];
                  const isRedlistedByTarget = targetRedlist.includes(user.uid);
                  const isAlreadyFriend = acceptedFriendsUidSet.has(targetUser.uid);
                  const isPendingSent = sentRequestsMap.has(targetUser.uid);
                  const isPendingReceived = receivedRequestsUidSet.has(targetUser.uid);

                  return (
                    <div
                      key={targetUser.uid}
                      className="p-2.5 bg-ac-cream/60 hover:bg-white border-2 border-ac-brown/20 rounded-2xl flex items-center justify-between gap-2 transition-all shadow-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-1">
                        <div className="w-9 h-9 rounded-full overflow-hidden border border-ac-brown shrink-0 bg-white shadow-xs">
                          <img
                            src={targetUser.photoURL || targetUser.avatarUrl || '/pfp-ac.jpg'}
                            alt={targetUser.username}
                            className="w-full h-full object-cover object-center block"
                            onError={(e) => { e.currentTarget.src = '/pfp-ac.jpg'; }}
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-black text-ac-brown truncate">
                            {targetUser.username || 'Habitant'}
                          </span>
                          <span className="text-[9px] font-semibold text-ac-brown-light truncate">
                            {targetUser.email || ''}
                          </span>
                        </div>
                      </div>

                      {/* Status / Action Button depending on Redlist & State */}
                      <div className="shrink-0">
                        {isRedlistedByTarget ? (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-gray-200/80 text-gray-600 border border-gray-400/40 cursor-not-allowed inline-flex items-center gap-1 shadow-xs">
                            <ShieldAlert className="w-3 h-3 text-gray-500" /> Demande impossible
                          </span>
                        ) : isAlreadyFriend ? (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-[#78B159]/20 text-[#3C6E1F] border border-ac-green/40 inline-flex items-center gap-1 shadow-xs">
                            <Check className="w-3 h-3 text-ac-green" /> Déjà ami
                          </span>
                        ) : isPendingSent ? (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-ac-gold/20 text-ac-brown border border-ac-gold/50 inline-flex items-center gap-1 shadow-xs">
                            <Clock className="w-3 h-3 text-ac-brown-light" /> Envoyée
                          </span>
                        ) : isPendingReceived ? (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-ac-sky/20 text-ac-brown border border-ac-sky/50 inline-flex items-center gap-1 shadow-xs">
                            <Sparkles className="w-3 h-3 text-ac-green" /> Reçue
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSendFriendRequest(targetUser)}
                            disabled={actionLoading === targetUser.uid}
                            className="bg-ac-green hover:bg-[#689E4B] active:scale-95 text-white font-black text-[10px] px-3 py-1.5 rounded-xl border-2 border-ac-brown shadow-ac-xs flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                          >
                            <UserPlus className="w-3 h-3 text-white" />
                            {actionLoading === targetUser.uid ? "..." : "Ajouter"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ======================================================================= */}
          {/* WIDGET 3 : DEMANDES REÇUES & REDLIST (Bas Droite)                       */}
          {/* ======================================================================= */}
          <div className="ac-card p-5 bg-white border-3 border-ac-brown space-y-4">
            <div className="flex items-center justify-between border-b-2 border-ac-brown/10 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-ac-sky/20 border-2 border-ac-sky/40 flex items-center justify-center">
                  <HeartHandshake className="w-3.5 h-3.5 text-ac-brown" />
                </div>
                <h3 className="text-sm font-black text-ac-brown">Demandes d'amitié reçues</h3>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 bg-ac-cream rounded-full border border-ac-brown/20 text-ac-brown">
                {receivedRequests.length}
              </span>
            </div>

            {/* List of received requests */}
            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
              {receivedRequests.length === 0 ? (
                <div className="py-5 text-center text-xs font-bold text-ac-brown-light/70 bg-ac-cream/40 rounded-2xl border border-dashed border-ac-brown/20">
                  Aucune demande en attente 🍃
                </div>
              ) : (
                receivedRequests.map(req => (
                  <div
                    key={req.id}
                    className="p-3 bg-ac-cream border-2 border-ac-brown rounded-2xl flex flex-col gap-2.5 shadow-ac-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-ac-brown shrink-0 bg-white">
                        <img
                          src={req.avatar || '/pfp-ac.jpg'}
                          alt={req.name}
                          className="w-full h-full object-cover object-center block"
                          onError={(e) => { e.currentTarget.src = '/pfp-ac.jpg'; }}
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-black text-ac-brown truncate">
                          🍃 {req.name}
                        </span>
                        <span className="text-[9px] font-semibold text-ac-brown-light truncate">
                          {req.senderEmail}
                        </span>
                      </div>
                    </div>

                    {/* Actions: Accept or Reject & Redlist */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleAcceptRequest(req.id, req.name)}
                        disabled={actionLoading === req.id}
                        className="bg-ac-green hover:bg-[#689E4B] text-white font-extrabold text-[10px] py-1.5 rounded-xl border-2 border-ac-brown shadow-ac-xs flex items-center justify-center gap-1 cursor-pointer transition-all active:translate-y-[1px] disabled:opacity-50"
                      >
                        <Check className="w-3 h-3 text-white" /> Accepter
                      </button>
                      <button
                        onClick={() => handleRejectAndRedlist(req.id, req.senderId, req.name)}
                        disabled={actionLoading === req.id}
                        className="bg-white hover:bg-ac-red/15 text-ac-red font-extrabold text-[10px] py-1.5 rounded-xl border-2 border-ac-brown shadow-ac-xs flex items-center justify-center gap-1 cursor-pointer transition-all active:translate-y-[1px] disabled:opacity-50"
                        title="Refuser et ajouter cet habitant dans votre Redlist"
                      >
                        <X className="w-3 h-3 text-ac-red" /> Refuser
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Redlist Button with Flag icon 🚩 */}
            <div className="pt-2 border-t border-ac-brown/10">
              <button
                onClick={() => setIsRedlistModalOpen(true)}
                className="w-full bg-ac-cream hover:bg-white active:scale-98 border-2 border-ac-brown rounded-2xl py-2.5 px-4 flex items-center justify-between text-xs font-black text-ac-brown shadow-ac-xs hover:shadow-ac-sm transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-ac-red" />
                  <span>Gérer ma Redlist</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white border border-ac-brown/20 text-ac-brown">
                    {redlist.length} bloqué{redlist.length > 1 ? 's' : ''}
                  </span>
                  <span className="text-ac-brown-light text-xs font-bold">➔</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL : SUPPRESSION D'UN AMI                                              */}
      {/* ========================================================================= */}
      {friendToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border-3 border-ac-brown rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-bounce-in">
            <div className="w-12 h-12 rounded-full bg-ac-red/15 border-2 border-ac-red flex items-center justify-center mx-auto text-ac-red">
              <UserMinus className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-ac-brown">
                Retirer {friendToDelete.name} ?
              </h3>
              <p className="text-xs font-semibold text-ac-brown-light leading-relaxed">
                Es-tu sûr de vouloir retirer cet habitant de tes amis ? Tous ses accès partagés (comptes, souhaits) seront révoqués.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFriendToDelete(null)}
                className="flex-1 py-2.5 rounded-2xl bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown font-extrabold text-xs text-ac-brown transition-all cursor-pointer shadow-ac-xs"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFriend}
                disabled={actionLoading === friendToDelete.id}
                className="flex-1 py-2.5 rounded-2xl bg-ac-red hover:bg-ac-red/90 text-white border-2 border-ac-brown font-black text-xs transition-all cursor-pointer shadow-ac-xs active:translate-y-[1px] disabled:opacity-50"
              >
                {actionLoading === friendToDelete.id ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : GESTION DE LA REDLIST (Bouton Drapeau 🚩)                          */}
      {/* ========================================================================= */}
      {isRedlistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border-3 border-ac-brown rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-bounce-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b-2 border-ac-brown/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-ac-red/15 border-2 border-ac-red/30 flex items-center justify-center">
                  <Flag className="w-5 h-5 text-ac-red" />
                </div>
                <div>
                  <h3 className="text-base font-black text-ac-brown">Ma Redlist d'habitants</h3>
                  <p className="text-[10px] font-bold text-ac-brown-light">Gestion des restrictions d'invitation</p>
                </div>
              </div>
              <button
                onClick={() => setIsRedlistModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-ac-cream border border-ac-brown/20 text-ac-brown transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Explanation Note */}
            <div className="p-3.5 bg-ac-cream rounded-2xl border-2 border-ac-brown/15 text-[11px] font-bold text-ac-brown leading-relaxed flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-ac-green shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-ac-brown">Comment fonctionne la Redlist ?</p>
                <p className="text-[10px] text-ac-brown-light font-semibold mt-0.5">
                  Les habitants listés ci-dessous ne peuvent plus t'envoyer de demande d'ami. Cependant, tu conserves la possibilité de leur envoyer une demande si tu changes d'avis !
                </p>
              </div>
            </div>

            {/* Redlist Users List */}
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {redlistedUsers.length === 0 ? (
                <div className="py-8 text-center text-xs font-bold text-ac-brown-light/70 bg-ac-cream/40 rounded-2xl border border-dashed border-ac-brown/20">
                  🎉 Ta Redlist est vide. Aucun habitant n'est bloqué.
                </div>
              ) : (
                redlistedUsers.map(redUser => (
                  <div
                    key={redUser.uid}
                    className="p-3 bg-ac-cream/50 border-2 border-ac-brown/20 rounded-2xl flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-ac-brown shrink-0 bg-white">
                        <img
                          src={redUser.avatar || '/pfp-ac.jpg'}
                          alt={redUser.name}
                          className="w-full h-full object-cover object-center block"
                          onError={(e) => { e.currentTarget.src = '/pfp-ac.jpg'; }}
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-black text-ac-brown truncate">
                          {redUser.name}
                        </span>
                        {redUser.email && (
                          <span className="text-[9px] font-semibold text-ac-brown-light truncate">
                            {redUser.email}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveFromRedlist(redUser.uid, redUser.name)}
                      disabled={actionLoading === redUser.uid}
                      className="bg-white hover:bg-ac-green-light border-2 border-ac-brown text-ac-brown hover:text-ac-green font-extrabold text-[10px] px-3 py-1.5 rounded-xl shadow-ac-xs transition-all cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {actionLoading === redUser.uid ? "..." : "Retirer de la Redlist"}
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-ac-brown/10 flex justify-end">
              <button
                type="button"
                onClick={() => setIsRedlistModalOpen(false)}
                className="bg-ac-green text-white font-black text-xs px-5 py-2.5 rounded-2xl border-2 border-ac-brown shadow-ac-sm active:translate-y-[1px] cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
