import React, { useState, useMemo, useRef } from 'react';
import { db, useDb } from '../db';
import { doc, writeBatch } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { 
  Plus, Edit2, Trash2, Gift, Coins, Sparkles, X, 
  Landmark, Mail
} from 'lucide-react';
import InlineShareSelector from './InlineShareSelector';
import AvatarStackPopover from './AvatarStackPopover';

export default function WishlistView() {
  const { wishlist: wishes, accountsData: accounts, user, acceptedFriends, username } = useDb();

  // Sharing checkboxes state
  const [sharedFriendUids, setSharedFriendUids] = useState([]);
  const [formUserRoles, setFormUserRoles] = useState({});

  // UI state
  const [formOpen, setFormOpen] = useState(false);
  const [editingWish, setEditingWish] = useState(null);
  const [openPopoverWishId, setOpenPopoverWishId] = useState(null);
  
  // Form fields
  const [wishName, setWishName] = useState('');
  const [wishPrice, setWishPrice] = useState('');
  const [wishDescription, setWishDescription] = useState('');

  // Purchase flow state
  const [buyingWish, setBuyingWish] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBuying, setIsBuying] = useState(false);

  // Drag & Drop state for Wishes
  const [draggableWishId, setDraggableWishId] = useState(null);
  const longPressTimer = useRef(null);

  const sortedWishes = useMemo(() => {
    if (!wishes) return [];
    return [...wishes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [wishes]);

  // Drag & Drop handlers for Wishes
  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, hoverIndex) => {
    e.preventDefault();
    const dragIndex = Number(e.dataTransfer.getData('text/plain'));
    if (dragIndex === hoverIndex || isNaN(dragIndex)) return;

    const reordered = [...sortedWishes];
    const [dragged] = reordered.splice(dragIndex, 1);
    reordered.splice(hoverIndex, 0, dragged);

    // Save order sequence in Firestore
    const batch = writeBatch(firestoreDb);
    reordered.forEach((wish, idx) => {
      const ref = doc(firestoreDb, 'wishlist', wish.id);
      batch.update(ref, { order: idx });
    });
    
    await batch.commit();
    setDraggableWishId(null);
  };

  const handleDragEnd = () => {
    setDraggableWishId(null);
  };

  const handleStartLongPress = (id) => {
    longPressTimer.current = setTimeout(() => {
      setDraggableWishId(id);
    }, 850);
  };

  const handleCancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  // Handlers for Wish Form
  const handleWishSubmit = async (e) => {
    e.preventDefault();
    if (!wishName || !wishPrice || isSubmitting) return;

    const priceValue = parseFloat(wishPrice);
    if (isNaN(priceValue) || priceValue <= 0) {
      alert("Veuillez entrer un prix valide supérieur à 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      const wishData = {
        name: wishName.trim(),
        price: priceValue,
        description: wishDescription.trim(),
        allowedUsers: [user.uid, ...sharedFriendUids],
        userRoles: { [user.uid]: 'owner', ...formUserRoles }
      };

      if (editingWish) {
        await db.wishlist.update(editingWish.id, wishData);
        setEditingWish(null);
      } else {
        await db.wishlist.add({
          ...wishData,
          order: sortedWishes.length
        });
      }

      resetForm();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement du souhait.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditWish = (wish) => {
    setEditingWish(wish);
    setWishName(wish.name);
    setWishPrice(wish.price.toString());
    setWishDescription(wish.description || '');
    setSharedFriendUids(wish.allowedUsers ? wish.allowedUsers.filter(uid => uid !== user?.uid) : []);
    setFormUserRoles(wish.userRoles || {});
    setFormOpen(true);
  };

  const handleDeleteWish = async (id) => {
    const wish = wishes?.find(w => w.id === id);
    if (!wish) return;
    const isOwner = wish.ownerId === user?.uid || wish.creatorId === user?.uid || !wish.ownerId && !wish.creatorId || (wish.allowedUsers && wish.allowedUsers[0] === user?.uid);
    if (!isOwner) {
      alert("Vous n'êtes pas le propriétaire de ce souhait.");
      return;
    }
    if (window.confirm("Es-tu sûr de vouloir retirer ce souhait de ton catalogue ?")) {
      await db.wishlist.delete(id);
    }
  };

  const handleLeaveWish = async (wish) => {
    const confirmLeave = window.confirm("Es-tu sûr de vouloir quitter ce souhait partagé ?");
    if (!confirmLeave) return;

    try {
      const myUsername = username || 'Habitant';
      const updatedAllowedUsers = (wish.allowedUsers || []).filter(uid => uid !== user?.uid);
      
      const updatedUserRoles = { ...(wish.userRoles || {}) };
      delete updatedUserRoles[user?.uid];

      const updatedSharedWithNames = (wish.sharedWithNames || []).filter(
        name => name.toLowerCase() !== myUsername.toLowerCase()
      );

      await db.wishlist.update(wish.id, {
        allowedUsers: updatedAllowedUsers,
        userRoles: updatedUserRoles,
        sharedWithNames: updatedSharedWithNames
      });

      alert("Vous avez quitté le partage de ce souhait.");
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la sortie du partage.");
    }
  };

  const resetForm = () => {
    setWishName('');
    setWishPrice('');
    setWishDescription('');
    setFormOpen(false);
    setEditingWish(null);
    setSharedFriendUids([]);
    setFormUserRoles({});
  };

  // Handlers for Purchase flow
  const openPurchaseModal = (wish) => {
    setBuyingWish(wish);
    setSelectedAccountId('');
    setPurchaseSuccess(false);
  };

  const handleConfirmPurchase = async (e) => {
    e.preventDefault();
    if (!buyingWish || !selectedAccountId || isBuying) return;

    const selectedAccount = accounts?.find(a => a.id === selectedAccountId);
    if (!selectedAccount) {
      alert("Compte sélectionné introuvable.");
      return;
    }

    setIsBuying(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // Create the debit transaction (simplified structure)
      const newTx = {
        accountId: selectedAccountId,
        name: `Achat : ${buyingWish.name}`,
        description: buyingWish.description || `Achat depuis le Catalogue : ${buyingWish.name}`,
        amount: buyingWish.price,
        type: 'debit',
        date: todayStr,
        pocketId: null
      };

      // Execute in a single db transaction
      await db.transaction('rw', [db.transactions, db.wishlist], async () => {
        // Add transaction
        await db.transactions.add(newTx);
        // Delete wish from wishlist
        await db.wishlist.delete(buyingWish.id);
      });

      // Show cute success notification
      setPurchaseSuccess(true);

      // Close modal after 3 seconds or on click
      setTimeout(() => {
        setBuyingWish(null);
        setPurchaseSuccess(false);
      }, 3200);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la validation de l'achat.");
    } finally {
      setIsBuying(false);
    }
  };

  if (!wishes) {
    return <div className="text-xs font-bold text-ac-brown-light text-center py-6">Chargement du catalogue...</div>;
  }

  return (
    <div className="space-y-6 relative text-ac-brown select-none">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm">
        <div>
          <h2 className="text-2xl font-black text-ac-brown flex items-center gap-2">
            <Gift className="w-6 h-6 text-ac-red animate-bounce" /> Le Catalogue des Souhaits
          </h2>
          <p className="text-xs font-semibold text-ac-brown-light mt-0.5">
            Planifie tes prochains achats et convertis-les en dépenses en un clic !
          </p>
        </div>

        <button
          onClick={() => {
            if (formOpen) {
              resetForm();
            } else {
              setEditingWish(null);
              setFormOpen(true);
            }
          }}
          className="bg-ac-green text-white font-extrabold text-xs px-4 py-3 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center gap-1.5 hover:translate-y-[1px] cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> {formOpen ? 'Masquer le formulaire' : 'Nouveau Souhait'}
        </button>
      </div>

      {/* Toggleable Wish Form */}
      {formOpen && (
        <form onSubmit={handleWishSubmit} className="bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm space-y-4 animate-bounce-in max-w-2xl">
          <h3 className="font-black text-sm text-ac-brown border-b border-ac-brown/15 pb-2">
            {editingWish ? 'Modifier le souhait' : 'Ajouter un nouveau souhait au catalogue'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Nom du projet d'achat *</label>
              <input
                type="text"
                value={wishName}
                onChange={(e) => setWishName(e.target.value)}
                placeholder="Ex: Nintendo Switch, Canapé Nook..."
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold text-ac-brown focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Prix (Clochettes) *</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={wishPrice}
                  onChange={(e) => setWishPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl pl-8 pr-4 py-2 text-sm font-bold text-ac-brown focus:outline-none"
                  required
                />
                <span className="absolute left-3 top-2.5 text-xs font-black">🔔</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Description / Notes</label>
            <input
              type="text"
              value={wishDescription}
              onChange={(e) => setWishDescription(e.target.value)}
              placeholder="Ex: Couleur bleu et rouge, à acheter à la Boutique Nook..."
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold text-ac-brown focus:outline-none"
            />
          </div>

          <InlineShareSelector
            allowedUsers={sharedFriendUids}
            userRoles={formUserRoles}
            onChange={(newAllowed, newUserRoles) => {
              setSharedFriendUids(newAllowed);
              setFormUserRoles(newUserRoles);
            }}
            ownerId={editingWish?.creatorId || user?.uid}
          />

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="bg-white text-ac-brown font-extrabold text-xs px-4 py-2.5 rounded-xl border border-ac-brown hover:bg-ac-cream cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`bg-ac-green text-white font-extrabold text-xs px-4 py-2.5 rounded-xl border border-ac-brown shadow-ac-sm transition-all ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:translate-y-[1px]'
              }`}
              style={isSubmitting ? { cursor: 'not-allowed' } : {}}
            >
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}

      {/* Wish Catalogue Grid */}
      {wishes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl border-3 border-ac-brown text-ac-brown-light space-y-4">
          <Gift className="w-12 h-12 text-ac-brown-light/45 mx-auto" />
          <p className="font-extrabold text-sm">Ton catalogue de souhaits est vide.</p>
          <p className="text-xs max-w-sm mx-auto">Ajoute ton premier souhait de clochettes en cliquant sur le bouton "Nouveau Souhait" en haut à droite ! 🍃</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedWishes.map((wish, index) => {
            const isDragging = draggableWishId === wish.id;
            const isPopoverOpen = openPopoverWishId === wish.id;
            const isOwner = wish.ownerId === user?.uid || wish.creatorId === user?.uid || !wish.ownerId && !wish.creatorId || (wish.allowedUsers && wish.allowedUsers[0] === user?.uid);
            return (
              <div 
                key={wish.id} 
                draggable={isDragging}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`ac-card bg-[#FFFDF9] border-ac-brown p-5 flex flex-col justify-between group select-none relative transition-all overflow-visible ${
                  isPopoverOpen ? 'z-30' : 'z-0'
                } ${
                  isDragging ? 'ring-3 ring-ac-green ring-offset-2 scale-[1.01] border-dashed opacity-75' : ''
                }`}
              >
                {/* Gift tag ornament (Drag handle via long press) */}
                <div 
                  onMouseDown={() => handleStartLongPress(wish.id)}
                  onTouchStart={() => handleStartLongPress(wish.id)}
                  onMouseUp={handleCancelLongPress}
                  onTouchEnd={handleCancelLongPress}
                  onMouseLeave={handleCancelLongPress}
                  className="absolute top-0 right-4 bg-ac-red border-l-2 border-r-2 border-b-2 border-ac-brown rounded-b-lg px-2 py-1.5 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-ac-red-light transition-colors z-10 select-none"
                  title="Glisser-déposer (clic long sur le cadeau)"
                >
                  <Gift className="w-3.5 h-3.5 text-white" />
                </div>

                <div className="space-y-3 pr-6">
                  <h4 className="font-black text-base text-ac-brown uppercase tracking-wide truncate">
                    {wish.name}
                  </h4>
                  
                  {wish.description ? (
                    <p className="text-xs font-semibold text-ac-brown-light italic line-clamp-2">
                      "{wish.description}"
                    </p>
                  ) : (
                    <p className="text-xs font-semibold text-ac-brown-light/40 italic">
                      Aucune description renseignée.
                    </p>
                  )}

                  {/* Price Display */}
                  <div className="bg-ac-gold-light border-2 border-ac-gold rounded-2xl px-4 py-2 inline-flex items-center gap-1.5 shadow-ac-xs">
                    <Coins className="w-4 h-4 text-ac-gold" />
                    <span className="font-black text-ac-gold-dark text-sm">
                      {wish.price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                    </span>
                  </div>
                </div>

                {/* Action Buttons Group */}
                <div className="mt-6 pt-4 border-t border-ac-brown/10 flex items-center justify-between">
                  {/* Edit & Delete & Share */}
                  <div className="flex gap-1.5">
                    <AvatarStackPopover
                      allowedUsers={wish.allowedUsers || []}
                      userRoles={wish.userRoles || {}}
                      ownerId={wish.creatorId || wish.userId}
                      docId={wish.id}
                      collectionName="wishlist"
                      onOpenChange={(open) => setOpenPopoverWishId(open ? wish.id : null)}
                    />
                    <button
                      onClick={() => handleEditWish(wish)}
                      className="p-2 hover:bg-ac-cream rounded-xl text-ac-brown-light hover:text-ac-brown border border-ac-brown/15 cursor-pointer transition-colors"
                      title="Modifier ce souhait"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {isOwner ? (
                      <button
                        onClick={() => handleDeleteWish(wish.id)}
                        className="p-2 hover:bg-ac-red-light rounded-xl text-ac-brown-light hover:text-ac-red border border-ac-brown/15 cursor-pointer transition-colors"
                        title="Supprimer ce souhait"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleLeaveWish(wish)}
                        className="p-2 hover:bg-ac-red-light rounded-xl text-ac-brown-light hover:text-ac-red border border-ac-brown/15 cursor-pointer transition-colors"
                        title="Quitter le partage"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Purchase Button */}
                  <button
                    onClick={() => openPurchaseModal(wish)}
                    className="bg-ac-green text-white font-extrabold text-xs px-4 py-2 rounded-xl border-2 border-ac-brown shadow-ac-xs hover:translate-y-[1px] cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 fill-white" /> Acheter
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Purchase Modal Dialog */}
      {buyingWish && (
        <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4 z-50 animate-fade-in text-ac-brown">
          <div className="bg-[#FFFDF9] border-t-4 border-x-4 md:border-4 border-ac-brown rounded-t-3xl md:rounded-3xl p-6 max-w-md w-full shadow-ac-lg relative animate-slide-up md:animate-bounce-in pb-safe-bottom">
            {/* Grab handle */}
            <div className="w-12 h-1.5 bg-ac-brown/20 rounded-full mx-auto mb-4 md:hidden shrink-0"></div>
            {/* Close button */}
            <button 
              type="button"
              onClick={() => {
                setBuyingWish(null);
                setPurchaseSuccess(false);
              }}
              className="absolute top-4 right-4 z-50 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 transition-all hover:scale-110 text-ac-brown cursor-pointer"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
            
            {/* Show success message or payment selection */}
            {purchaseSuccess ? (
              <div className="text-center py-6 space-y-4 animate-bounce-in">
                <div className="w-16 h-16 bg-ac-green-light border-3 border-ac-green rounded-full flex items-center justify-center mx-auto shadow-ac-sm">
                  <Sparkles className="w-10 h-10 text-ac-green fill-ac-green-light" />
                </div>
                <h3 className="text-lg font-black text-ac-green">Achat validé avec succès ! 🎉</h3>
                <div className="bg-ac-cream border-2 border-ac-brown/30 rounded-2xl p-4 text-xs font-bold leading-relaxed text-ac-brown">
                  <span className="text-lg block mb-1">🍃 Méli & Mélo :</span>
                  "Grelot de joie ! Le produit <strong>{buyingWish.name}</strong> a été retiré de votre liste de souhaits, et le montant a été déduit de votre compte ! Merci beaucoup et à bientôt !"
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-black text-ac-brown mb-4 flex items-center gap-1.5 border-b border-ac-brown/10 pb-2">
                  <Coins className="w-5 h-5 text-ac-gold" /> Validation de l'achat
                </h3>

                <div className="bg-ac-cream border-2 border-ac-brown/30 rounded-xl p-3.5 mb-4 text-xs font-semibold space-y-1">
                  <p className="text-[10px] text-ac-brown-light uppercase font-black">Produit à acheter</p>
                  <p className="text-sm font-extrabold">{buyingWish.name}</p>
                  <p className="text-xs text-ac-gold-dark font-black">Prix : {buyingWish.price.toLocaleString('fr-FR')} 🔔</p>
                </div>

                <form onSubmit={handleConfirmPurchase} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase text-ac-brown-light mb-1.5">
                      Déduire l'achat depuis le compte *
                    </label>
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white cursor-pointer"
                      required
                    >
                      <option value="">-- Choisir le compte de débit --</option>
                      {accounts?.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.visibleBalance.toLocaleString('fr-FR')} 🔔 disponible)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-4 pt-4 border-t border-ac-brown/10">
                    <button
                      type="button"
                      onClick={() => setBuyingWish(null)}
                      className="flex-1 h-12 bg-white hover:bg-ac-cream text-ac-brown rounded-2xl border-3 border-ac-brown font-extrabold text-sm shadow-ac-sm transition-transform active:translate-y-1 active:shadow-none cursor-pointer flex items-center justify-center"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isBuying}
                      className={`flex-1 h-12 bg-ac-green text-white rounded-2xl border-3 border-ac-brown font-extrabold text-sm shadow-ac-sm transition-all flex items-center justify-center ${
                        isBuying ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:translate-y-1'
                      }`}
                      style={isBuying ? { cursor: 'not-allowed' } : {}}
                    >
                      {isBuying ? 'Validation...' : "Valider l'achat"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}


    </div>
  );
}
