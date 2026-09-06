import React, { useState, useMemo, useEffect } from 'react';
import { db, useDb } from '../db';
import { doc, writeBatch } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { 
  Plus, Edit2, Trash2, Gift, Coins, Sparkles, X
} from 'lucide-react';
import { triggerAnimalEncounter } from '../context/EncounterContext';
import TotemBadge from './TotemBadge';

export default function WishlistView() {
  const { wishlist: wishes, accountsData: accounts, user, projects = [] } = useDb();

  // UI state
  const [formOpen, setFormOpen] = useState(false);
  const [editingWish, setEditingWish] = useState(null);
  
  // Form fields
  const [wishName, setWishName] = useState('');
  const [wishDescription, setWishDescription] = useState('');

  // Purchase flow state
  const [buyingWish, setBuyingWish] = useState(null);
  const [realPrice, setRealPrice] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBuying, setIsBuying] = useState(false);

  // Drag & Drop state for Wishes
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);

  const sortedWishes = useMemo(() => {
    if (!wishes) return [];
    return wishes
      .filter(w => {
        if (w.isCompleted) return false;
        if (!w.projectId) return true;
        const proj = projects?.find(p => p.id === w.projectId);
        return Boolean(proj && (proj.ownerId === user?.uid || proj.memberUids?.includes(user?.uid)));
      })
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }, [wishes, user, projects]);

  const [localWishes, setLocalWishes] = useState([]);

  useEffect(() => {
    setLocalWishes(sortedWishes);
  }, [sortedWishes]);

  const saveNewOrder = async (reorderedItems, collectionName) => {
    try {
      const batch = writeBatch(firestoreDb);
      reorderedItems.forEach((item, index) => {
        const itemRef = doc(firestoreDb, collectionName, item.id);
        batch.update(itemRef, { order: index });
      });
      await batch.commit();
    } catch (error) {
      console.error(`Erreur lors de la réorganisation de ${collectionName} :`, error);
    }
  };

  // Drag & Drop handlers for Wishes
  const handleDragStart = (e, index) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragEnter = (e, targetIndex) => {
    if (draggedItemIndex === null || draggedItemIndex === targetIndex) return;
    const reordered = [...localWishes];
    const [dragged] = reordered.splice(draggedItemIndex, 1);
    reordered.splice(targetIndex, 0, dragged);
    setDraggedItemIndex(targetIndex);
    setLocalWishes(reordered);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragEnd = async () => {
    if (draggedItemIndex !== null) {
      setDraggedItemIndex(null);
      await saveNewOrder(localWishes, 'wishlist');
    }
  };

  // Handlers for Wish Form
  const handleWishSubmit = async (e) => {
    e.preventDefault();
    if (!wishName || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const wishData = {
        name: wishName.trim(),
        description: wishDescription.trim(),
        isCompleted: false,
        completedAt: null,
        completedAmount: null,
        projectId: editingWish?.projectId || null,
        createdAt: editingWish?.createdAt || new Date().toISOString()
      };

      if (editingWish) {
        await db.wishlist.update(editingWish.id, wishData);
        setEditingWish(null);
      } else {
        await db.wishlist.add({
          ...wishData,
          order: sortedWishes.length
        });
        // 1 chance sur 3 (environ 33.3%)
        if (Math.random() < 0.333) {
          triggerAnimalEncounter("renard");
        }
      }

      resetForm();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement du souhait.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canUserEditWish = (wish) => {
    if (!wish?.projectId) return true;
    const proj = projects?.find(p => p.id === wish.projectId);
    if (!proj) return false;
    if (proj.ownerId === user?.uid) return true;
    const memberRole = proj.members?.[user?.uid]?.role;
    return memberRole === 'editor';
  };

  const handleEditWish = (wish) => {
    if (!canUserEditWish(wish)) {
      alert("Action non autorisée en mode spectateur.");
      return;
    }
    setEditingWish(wish);
    setWishName(wish.name || wish.title || '');
    setWishDescription(wish.description || '');
    setFormOpen(true);
  };

  const handleDeleteWish = async (id) => {
    const wish = wishes?.find(w => w.id === id);
    if (wish && !canUserEditWish(wish)) {
      alert("Action non autorisée en mode spectateur.");
      return;
    }
    if (window.confirm("Es-tu sûr de vouloir retirer ce souhait de ton catalogue ?")) {
      await db.wishlist.delete(id);
    }
  };

  const resetForm = () => {
    setWishName('');
    setWishDescription('');
    setFormOpen(false);
    setEditingWish(null);
  };

  // Handlers for Purchase flow
  const openPurchaseModal = (wish) => {
    if (!canUserEditWish(wish)) {
      alert("Action non autorisée en mode spectateur.");
      return;
    }
    setBuyingWish(wish);
    setRealPrice('');
    setSelectedAccountId('');
    setPurchaseSuccess(false);
  };

  const handleConfirmPurchase = async (e) => {
    e.preventDefault();
    if (!buyingWish || !selectedAccountId || isBuying) return;

    const priceValue = parseFloat(realPrice);
    if (isNaN(priceValue) || priceValue <= 0) {
      alert("Veuillez entrer un prix réel valide supérieur à 0.");
      return;
    }

    const selectedAccount = accounts?.find(a => a.id === selectedAccountId);
    if (!selectedAccount) {
      alert("Compte sélectionné introuvable.");
      return;
    }

    setIsBuying(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const wishTitle = buyingWish.name || buyingWish.title;

      // Create the debit transaction
      const newTx = {
        accountId: selectedAccountId,
        name: `Achat : ${wishTitle}`,
        description: buyingWish.description || `Achat depuis le Catalogue : ${wishTitle}`,
        amount: priceValue,
        type: 'debit',
        date: todayStr,
        createdAt: new Date().toISOString(),
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

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <TotemBadge totemId="renard" />
          <button
            onClick={() => {
              if (formOpen) {
                resetForm();
              } else {
                setEditingWish(null);
                setFormOpen(true);
              }
            }}
            className="bg-ac-green text-white font-extrabold text-xs px-4 py-3 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center gap-1.5 hover:translate-y-[1px] cursor-pointer"
          >
            <Plus className="w-4 h-4" /> {formOpen ? 'Masquer le formulaire' : 'Nouveau Souhait'}
          </button>
        </div>
      </div>

      {/* Toggleable Wish Form */}
      {formOpen && (
        <form onSubmit={handleWishSubmit} className="bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm space-y-4 animate-bounce-in max-w-2xl">
          <h3 className="font-black text-sm text-ac-brown border-b border-ac-brown/15 pb-2">
            {editingWish ? 'Modifier le souhait' : 'Ajouter un nouveau souhait au catalogue'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
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
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Description / Notes (optionnel)</label>
              <input
                type="text"
                value={wishDescription}
                onChange={(e) => setWishDescription(e.target.value)}
                placeholder="Ex: Couleur bleu et rouge, à acheter à la Boutique Nook..."
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold text-ac-brown focus:outline-none"
              />
            </div>
          </div>

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
      {localWishes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl border-3 border-ac-brown text-ac-brown-light space-y-4">
          <Gift className="w-12 h-12 text-ac-brown-light/45 mx-auto" />
          <p className="font-extrabold text-sm">Ton catalogue de souhaits est vide.</p>
          <p className="text-xs max-w-sm mx-auto">Ajoute ton premier souhait en cliquant sur le bouton "Nouveau Souhait" en haut à droite ! 🍃</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {localWishes.map((wish, index) => {
            const isDragging = draggedItemIndex === index;
            const isProjectWish = Boolean(wish.projectId);
            const wishName = wish.name || wish.title || (isProjectWish ? "Souhait Projet" : "Souhait");
            const projectName = wish.projectName || (projects?.find(p => p.id === wish.projectId)?.name) || "";
            const canEdit = canUserEditWish(wish);

            return (
              <div 
                key={wish.id} 
                draggable={canEdit}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                style={isProjectWish ? { backgroundColor: '#1E232A', borderColor: '#2E3440', color: '#ffffff' } : undefined}
                className={`ac-card wish-card p-5 flex flex-col justify-between group select-none relative transition-all overflow-visible ${
                  canEdit ? 'cursor-grab active:cursor-grabbing' : ''
                } ${
                  isProjectWish 
                    ? 'project-wish-card bg-[#1E232A] text-white border-3 border-[#2E3440] shadow-ac-md' 
                    : 'bg-[#FFFDF9] border-ac-brown'
                } ${
                  isDragging ? 'opacity-50 scale-[0.98] ring-2 ring-ac-green' : ''
                }`}
              >
                {/* Decorative gift tag */}
                <div 
                  className="absolute top-0 right-4 bg-ac-red border-l-2 border-r-2 border-b-2 border-ac-brown rounded-b-lg px-2 py-1.5 flex items-center justify-center pointer-events-none z-10 select-none"
                >
                  <Gift className="w-3.5 h-3.5 text-white" />
                </div>

                <div className="space-y-2 pr-6">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-bold text-base uppercase tracking-wide break-words ${isProjectWish ? 'text-white font-extrabold' : 'text-ac-brown'}`}>
                      {wishName}
                    </h3>
                    {isProjectWish && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-ac-gold/20 text-ac-gold border border-ac-gold/40 rounded-full inline-flex items-center gap-1 shrink-0">
                        📁 {projectName ? projectName : 'PROJET'}
                      </span>
                    )}
                  </div>
                  
                  {wish.description ? (
                    <p className={`text-xs font-semibold italic line-clamp-2 ${isProjectWish ? 'text-slate-300' : 'text-ac-brown-light'}`}>
                      "{wish.description}"
                    </p>
                  ) : (
                    <p className={`text-xs font-semibold italic ${isProjectWish ? 'text-slate-500' : 'text-ac-brown-light/40'}`}>
                      Aucune description renseignée.
                    </p>
                  )}
                </div>

                {/* Action Buttons Group */}
                <div className={`mt-6 pt-4 border-t flex items-center justify-between ${isProjectWish ? 'border-slate-700' : 'border-ac-brown/10'}`}>
                  {canEdit ? (
                    <>
                      {/* Edit & Delete */}
                      <div className="flex gap-1.5">
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); handleEditWish(wish); }}
                          className={`p-2 rounded-xl border cursor-pointer transition-colors ${
                            isProjectWish 
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' 
                              : 'hover:bg-ac-cream text-ac-brown-light hover:text-ac-brown border-ac-brown/15'
                          }`}
                          title="Modifier ce souhait"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); handleDeleteWish(wish.id); }}
                          className={`p-2 rounded-xl border cursor-pointer transition-colors ${
                            isProjectWish 
                              ? 'bg-slate-800 hover:bg-red-900/40 text-red-400 border-slate-700' 
                              : 'hover:bg-ac-red-light text-ac-brown-light hover:text-ac-red border-ac-brown/15'
                          }`}
                          title="Supprimer ce souhait"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Purchase Button */}
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); openPurchaseModal(wish); }}
                        className="bg-ac-green text-white font-extrabold text-xs px-4 py-2 rounded-xl border-2 border-ac-brown shadow-ac-xs hover:translate-y-[1px] cursor-pointer flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 fill-white" /> Solder le souhait
                      </button>
                    </>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 italic">
                      Mode lecture seule (spectateur)
                    </span>
                  )}
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
                  <p className="text-[10px] text-ac-brown-light uppercase font-black">Souhait à solder</p>
                  <p className="text-sm font-extrabold">{buyingWish.name}</p>
                  {buyingWish.description && (
                    <p className="text-xs text-ac-brown-light italic">{buyingWish.description}</p>
                  )}
                </div>

                <form onSubmit={handleConfirmPurchase} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase text-ac-brown-light mb-1.5">
                      Prix réel payé (en euros) *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={realPrice}
                        onChange={(e) => setRealPrice(e.target.value)}
                        placeholder="Ex: 299.99"
                        className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl pl-10 pr-4 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                        required
                      />
                      <span className="absolute left-3.5 top-3 text-sm font-black">€</span>
                    </div>
                  </div>

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
                          {acc.name} (Solde : {(acc.visibleBalance ?? acc.currentBalance ?? acc.balance ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)
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
