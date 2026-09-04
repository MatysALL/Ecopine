import React, { useState, useMemo, useEffect } from 'react';
import { db, useDb } from '../db';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { Plus, Trash2, Handshake, X, Coins, Sparkles, Edit2, AlertCircle, CheckCircle, Users, User, Lock } from 'lucide-react';

export default function DebtsView() {
  const { debts = [], accountsData: accounts = [], user, acceptedFriends = [], username } = useDb();

  // Toast state
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: string }

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Editing debt state
  const [editingDebt, setEditingDebt] = useState(null);

  // Mode for entity: 'free' (saisie libre) or 'friend' (choisir un ami)
  const [entityMode, setEntityMode] = useState('free');

  // Associated friend ID state
  const [associatedFriendId, setAssociatedFriendId] = useState('');

  // Form toggle
  const [formOpen, setFormOpen] = useState(false);

  // Form fields
  const [debtType, setDebtType] = useState('to_pay'); // 'to_pay' = Je dois, 'to_collect' = On me doit
  const [debtPerson, setDebtPerson] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtDescription, setDebtDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Settlement state
  const [settlingDebt, setSettlingDebt] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [settleSuccess, setSettleSuccess] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [activeDebtTab, setActiveDebtTab] = useState('payables'); // 'payables' or 'receivables' on mobile

  // Filter active (non-settled / non-resolved) debts (Strictly exclude project debts and foreign mirror debts)
  const pendingDebts = useMemo(() => {
    return (debts || []).filter(d => {
      if (d.projectId) return false;
      if (user?.uid && d.userId && d.userId !== user.uid) return false;
      if (d.status === 'resolved' || d.status === 'settled' || d.status === 'paid') return false;
      if (d.isPaid === true || d.isSettled === true) return false;
      return true;
    });
  }, [debts, user]);

  // Split into two categories (Je dois vs On me doit) with multi-key type tolerance
  const payables = useMemo(() => {
    return pendingDebts.filter(d => {
      const type = (d.type || '').toLowerCase().trim();
      if (['i_owe', 'debt', 'je_dois', 'to_pay', 'dette'].includes(type)) return true;
      if (['owed_to_me', 'claim', 'on_me_doit', 'to_collect', 'creance'].includes(type)) return false;
      return typeof d.amount === 'number' && d.amount < 0;
    });
  }, [pendingDebts]);

  const receivables = useMemo(() => {
    return pendingDebts.filter(d => {
      const type = (d.type || '').toLowerCase().trim();
      if (['owed_to_me', 'claim', 'on_me_doit', 'to_collect', 'creance'].includes(type)) return true;
      if (['i_owe', 'debt', 'je_dois', 'to_pay', 'dette'].includes(type)) return false;
      return typeof d.amount === 'number' && d.amount >= 0;
    });
  }, [pendingDebts]);

  // Selected friend helper
  const selectedFriend = useMemo(() => {
    if (entityMode !== 'friend' || !associatedFriendId) return null;
    return (acceptedFriends || []).find(f => f.uid === associatedFriendId) || null;
  }, [entityMode, associatedFriendId, acceptedFriends]);

  // Form submit handler
  const handleDebtSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || !user?.uid) return;

    let targetEntityName = '';
    let targetFriend = null;

    if (entityMode === 'friend') {
      targetFriend = (acceptedFriends || []).find(f => f.uid === associatedFriendId);
      if (!targetFriend) {
        setToast({ type: 'error', message: "Veuillez sélectionner un ami dans la liste." });
        return;
      }
      
      // Check if friend allows mirror debt creation
      if (targetFriend.allowDebts === false) {
        setToast({ 
          type: 'error', 
          message: `${targetFriend.name} n'autorise pas la création automatique de dettes.` 
        });
        return;
      }

      targetEntityName = targetFriend.name;
    } else {
      targetEntityName = debtPerson.trim();
      if (!targetEntityName) {
        setToast({ type: 'error', message: "Veuillez saisir un nom ou une entité." });
        return;
      }
    }

    const amt = parseFloat(debtAmount);
    if (isNaN(amt) || amt <= 0) {
      setToast({ type: 'error', message: "Veuillez entrer une somme supérieure à 0." });
      return;
    }

    setIsSubmitting(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const createdAt = new Date().toISOString();
      const currentUserPseudo = username?.trim() || user?.displayName || 'Habitant';

      if (editingDebt) {
        // Mode modification : modification stricte et locale de cette dette uniquement
        await db.debts.update(editingDebt.id, {
          entityName: targetEntityName,
          amount: amt,
          type: debtType,
          description: debtDescription.trim(),
          status: editingDebt.status || 'pending',
          date: editingDebt.date || todayStr,
          createdAt: editingDebt.createdAt || createdAt,
          associatedFriendId: targetFriend ? targetFriend.uid : (editingDebt.associatedFriendId || null),
          associatedFriendName: targetFriend ? targetFriend.name : (editingDebt.associatedFriendName || null),
          userId: user.uid,
          allowedUsers: [user.uid]
        });
        setToast({ type: 'success', message: "Dette modifiée avec succès ! 🍃" });
      } else {
        const batch = writeBatch(firestoreDb);

        if (targetFriend) {
          // CAS 2 : Sélection d'un ami (création autorisée de 2 documents indépendants)
          // 1. Document du créateur (Utilisateur A)
          const myDebtRef = doc(collection(firestoreDb, "debts"));
          batch.set(myDebtRef, {
            userId: user.uid,
            entityName: targetFriend.name || targetFriend.username || "Ami",
            associatedFriendId: targetFriend.uid || targetFriend.id,
            associatedFriendName: targetFriend.name || targetFriend.username,
            amount: amt,
            type: debtType,
            description: debtDescription.trim() || "",
            date: todayStr,
            createdAt: createdAt,
            status: "pending",
            allowedUsers: [user.uid]
          });

          // 2. Document miroir de l'ami (Utilisateur B)
          const mirrorDebtRef = doc(collection(firestoreDb, "debts"));
          let mirrorType = 'to_pay';
          if (debtType === 'to_pay' || debtType === 'je_dois' || debtType === 'i_owe' || debtType === 'debt') {
            mirrorType = 'to_collect';
          } else {
            mirrorType = 'to_pay';
          }

          batch.set(mirrorDebtRef, {
            userId: targetFriend.uid || targetFriend.id,
            entityName: currentUserPseudo,
            associatedFriendId: user.uid,
            associatedFriendName: currentUserPseudo,
            amount: amt,
            type: mirrorType, // Type inversé automatiquement
            description: debtDescription.trim() ? `[Miroir] ${debtDescription.trim()}` : "",
            date: todayStr,
            createdAt: createdAt,
            status: "pending",
            allowedUsers: [targetFriend.uid || targetFriend.id]
          });

          await batch.commit();

          setToast({ 
            type: 'success', 
            message: `Dette enregistrée (et ajoutée sur le compte de ${targetFriend.name}) ! 🍃` 
          });
        } else {
          // CAS 1 : Saisie manuelle classique
          const myDebtRef = doc(collection(firestoreDb, "debts"));
          batch.set(myDebtRef, {
            userId: user.uid,
            entityName: targetEntityName,
            amount: amt,
            type: debtType,
            description: debtDescription.trim() || "",
            date: todayStr,
            createdAt: createdAt,
            status: "pending",
            associatedFriendId: null,
            associatedFriendName: null,
            allowedUsers: [user.uid]
          });

          await batch.commit();

          setToast({ type: 'success', message: "Dette enregistrée avec succès ! 🍃" });
        }
      }

      resetForm();
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: "Impossible d'enregistrer cette dette : " + (err.message || "Erreur inconnue") });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditDebt = (debt) => {
    setEditingDebt(debt);
    setDebtType(debt.type || 'to_pay');
    const name = debt.entityName || debt.person || debt.name || '';
    setDebtPerson(name);
    setDebtAmount(debt.amount ? debt.amount.toString() : '');
    setDebtDescription(debt.description || '');
    if (debt.associatedFriendId && acceptedFriends?.some(f => f.uid === debt.associatedFriendId)) {
      setEntityMode('friend');
      setAssociatedFriendId(debt.associatedFriendId);
    } else {
      setEntityMode('free');
      setAssociatedFriendId('');
    }
    setFormOpen(true);
  };

  const resetForm = () => {
    setDebtPerson('');
    setDebtAmount('');
    setDebtDescription('');
    setAssociatedFriendId('');
    setEntityMode('free');
    setEditingDebt(null);
    setFormOpen(false);
  };

  // Delete directly
  const handleDeleteDebt = async (id) => {
    if (window.confirm("Es-tu sûr de vouloir effacer cette dette de ton registre ?")) {
      try {
        await db.debts.delete(id);
        setToast({ type: 'success', message: "Dette supprimée du registre." });
      } catch (err) {
        console.error(err);
        setToast({ type: 'error', message: "Erreur lors de la suppression." });
      }
    }
  };

  // Settlement flow
  const openSettleModal = (debt) => {
    setSettlingDebt(debt);
    setSelectedAccountId('');
    setSettleSuccess(false);
  };

  const handleConfirmSettle = async (e) => {
    e.preventDefault();
    if (!settlingDebt || !selectedAccountId || isSettling) return;

    const targetAccount = accounts.find(a => a.id === selectedAccountId);
    if (!targetAccount) {
      setToast({ type: 'error', message: "Compte sélectionné introuvable." });
      return;
    }

    setIsSettling(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const debtorOrCreditor = settlingDebt.entityName || settlingDebt.person || settlingDebt.name || 'Dette';

      const txDescription = settlingDebt.description
        ? `${debtorOrCreditor} - ${settlingDebt.description}`
        : debtorOrCreditor;

      const rawType = (settlingDebt.type || '').toLowerCase().trim();
      const isToPay = ['i_owe', 'debt', 'je_dois', 'to_pay', 'dette'].includes(rawType) || (typeof settlingDebt.amount === 'number' && settlingDebt.amount < 0);
      const txType = isToPay ? 'debit' : 'credit';
      const label = isToPay ? `Remboursement : ${debtorOrCreditor}` : `Encaissement : ${debtorOrCreditor}`;

      const newTx = {
        accountId: selectedAccountId,
        name: label,
        description: txDescription,
        amount: Math.abs(settlingDebt.amount),
        type: txType,
        date: todayStr,
        createdAt: new Date().toISOString(),
        pocketId: null
      };

      await db.transactions.add(newTx);
      await db.debts.delete(settlingDebt.id);

      setSettleSuccess(true);

      setTimeout(() => {
        setSettlingDebt(null);
        setSettleSuccess(false);
      }, 2000);
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: "Erreur lors de la validation du règlement." });
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <div className="space-y-6 relative text-ac-brown select-none">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl border-2 border-ac-brown shadow-ac-md flex items-center gap-3 text-sm font-black animate-bounce-in ${
          toast.type === 'error' ? 'bg-ac-red text-white' : 'bg-ac-green text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm">
        <div>
          <h2 className="text-2xl font-black text-ac-brown flex items-center gap-2">
            <Handshake className="w-6 h-6 text-ac-orange animate-bounce" /> Registre des Dettes
          </h2>
          <p className="text-xs font-semibold text-ac-brown-light mt-0.5">
            Suiveurs d'emprunts et créances avec remboursement et écriture automatique en un clic.
          </p>
        </div>

        <button
          onClick={() => {
            if (formOpen) {
              resetForm();
            } else {
              setFormOpen(true);
            }
          }}
          className="bg-ac-green text-white font-extrabold text-xs px-4 py-3 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center gap-1.5 hover:translate-y-[1px] cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> {formOpen ? 'Masquer le formulaire' : 'Nouvelle Dette / Créance'}
        </button>
      </div>

      {/* Debt Creation Form */}
      {formOpen && (
        <form onSubmit={handleDebtSubmit} className="bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm space-y-4 animate-bounce-in max-w-2xl">
          <h3 className="font-black text-sm text-ac-brown border-b border-ac-brown/15 pb-2 flex items-center justify-between">
            <span>{editingDebt ? 'Modifier une entrée du registre' : 'Créer une nouvelle entrée dans le registre'}</span>
            {editingDebt && (
              <span className="text-[10px] bg-ac-orange/15 text-ac-orange px-2 py-0.5 rounded-full border border-ac-orange/30 font-bold">
                Édition locale
              </span>
            )}
          </h3>

          {/* Type selector Switch */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase text-ac-brown-light">Nature de l'entrée</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 font-bold text-xs cursor-pointer select-none">
                <input
                  type="radio"
                  name="debtType"
                  value="to_pay"
                  checked={debtType === 'to_pay'}
                  onChange={() => setDebtType('to_pay')}
                  className="w-4 h-4 accent-ac-red cursor-pointer"
                />
                <span className={debtType === 'to_pay' ? 'text-ac-red font-extrabold' : ''}>
                  Je dois de l'argent (Dette)
                </span>
              </label>
              <label className="flex items-center gap-2 font-bold text-xs cursor-pointer select-none">
                <input
                  type="radio"
                  name="debtType"
                  value="to_collect"
                  checked={debtType === 'to_collect'}
                  onChange={() => setDebtType('to_collect')}
                  className="w-4 h-4 accent-ac-green cursor-pointer"
                />
                <span className={debtType === 'to_collect' ? 'text-ac-green font-extrabold' : ''}>
                  On me doit de l'argent (Créance)
                </span>
              </label>
            </div>
          </div>

          {/* Personne / Entité : Saisie libre vs Choisir un ami */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="block text-[10px] font-black uppercase text-ac-brown-light">
                Personne / Entité concernée *
              </label>
              
              {/* Option Selector Toggle */}
              <div className="flex bg-ac-cream border-2 border-ac-brown/30 rounded-xl p-0.5 gap-1 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setEntityMode('free');
                  }}
                  className={`px-3 py-1 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    entityMode === 'free'
                      ? 'bg-ac-brown text-white shadow-xs'
                      : 'text-ac-brown hover:bg-black/5'
                  }`}
                >
                  <User className="w-3.5 h-3.5" /> Saisie libre
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEntityMode('friend');
                    if (acceptedFriends.length > 0 && !associatedFriendId) {
                      const firstAllowed = acceptedFriends.find(f => f.allowDebts !== false) || acceptedFriends[0];
                      setAssociatedFriendId(firstAllowed.uid);
                      setDebtPerson(firstAllowed.name);
                    }
                  }}
                  className={`px-3 py-1 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    entityMode === 'friend'
                      ? 'bg-ac-brown text-white shadow-xs'
                      : 'text-ac-brown hover:bg-black/5'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" /> Choisir un ami ({acceptedFriends.length})
                </button>
              </div>
            </div>

            {/* Entity input view depending on mode */}
            {entityMode === 'free' ? (
              <input
                type="text"
                value={debtPerson}
                onChange={(e) => setDebtPerson(e.target.value)}
                placeholder="Ex: Boulangerie, Paul, Tom Nook..."
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                required
              />
            ) : (
              acceptedFriends && acceptedFriends.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={associatedFriendId}
                    onChange={(e) => {
                      const friendId = e.target.value;
                      setAssociatedFriendId(friendId);
                      const found = acceptedFriends.find(f => f.uid === friendId);
                      if (found) {
                        setDebtPerson(found.name);
                      }
                    }}
                    className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white cursor-pointer"
                    required
                  >
                    <option value="">-- Sélectionner un ami --</option>
                    {acceptedFriends.map((friend) => {
                      const isAllowed = friend.allowDebts !== false;
                      return (
                        <option 
                          key={friend.uid || friend.id} 
                          value={friend.uid}
                          disabled={!isAllowed}
                          className={!isAllowed ? "text-ac-brown-light italic" : ""}
                        >
                          {friend.name} ({friend.email}) {!isAllowed ? '— (Non autorisé 🔒)' : ''}
                        </option>
                      );
                    })}
                  </select>

                  {selectedFriend && (
                    selectedFriend.allowDebts !== false ? (
                      <div className="flex items-center gap-2.5 p-2.5 bg-ac-green/10 border-2 border-dashed border-ac-green/30 rounded-2xl">
                        <img 
                          src={selectedFriend.photoURL || '/utilisateur.png'} 
                          alt={selectedFriend.name} 
                          className="w-8 h-8 rounded-full border-2 border-ac-brown object-cover shrink-0"
                          onError={(e) => { e.target.src = '/utilisateur.png'; }}
                        />
                        <div className="text-xs min-w-0">
                          <p className="font-black text-ac-brown truncate">
                            Ami sélectionné : <span className="text-ac-green">{selectedFriend.name}</span>
                          </p>
                          <p className="text-[10px] text-ac-brown-light font-semibold">
                            🍃 Une dette miroir automatique sera enregistrée sur le compte de {selectedFriend.name}.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 p-3 bg-ac-red/10 border-2 border-dashed border-ac-red/30 rounded-2xl text-xs font-bold text-ac-red">
                        <Lock className="w-5 h-5 shrink-0" />
                        <div>
                          <p className="font-black">Création de dette partagée bloquée</p>
                          <p className="text-[10px] text-ac-brown-light font-semibold">
                            {selectedFriend.name} n'autorise pas la création automatique de dettes sur son compte.
                          </p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="p-4 bg-ac-cream rounded-2xl border-2 border-dashed border-ac-brown/20 text-xs font-bold text-ac-brown space-y-1">
                  <p className="flex items-center gap-1.5 font-extrabold text-ac-brown">
                    <Users className="w-4 h-4 text-ac-orange" /> Aucun ami validé pour l'instant
                  </p>
                  <p className="text-[11px] text-ac-brown-light font-semibold">
                    Tu peux ajouter des amis dans l'onglet Social, ou basculer en <strong>Saisie libre</strong> pour entrer un nom manuellement !
                  </p>
                </div>
              )
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Montant (en euros) *</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl pl-8 pr-4 py-2 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                  required
                />
                <span className="absolute left-3 top-2.5 text-xs font-black">€</span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Description / Motif (Optionnel)</label>
              <input
                type="text"
                value={debtDescription}
                onChange={(e) => setDebtDescription(e.target.value)}
                placeholder="Ex: Prêt pour le pont, Achat de navets..."
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
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
              disabled={isSubmitting || (entityMode === 'friend' && selectedFriend?.allowDebts === false)}
              className={`bg-ac-green text-white font-extrabold text-xs px-4 py-2.5 rounded-xl border border-ac-brown shadow-ac-sm transition-all ${
                isSubmitting || (entityMode === 'friend' && selectedFriend?.allowDebts === false)
                  ? 'opacity-60 cursor-not-allowed bg-gray-400'
                  : 'cursor-pointer hover:translate-y-[1px]'
              }`}
            >
              {isSubmitting ? 'Enregistrement...' : (editingDebt ? 'Mettre à jour' : 'Enregistrer')}
            </button>
          </div>
        </form>
      )}

      {/* Segmented Control - Mobile only */}
      <div className="flex md:hidden border-2 border-ac-brown rounded-2xl overflow-hidden p-1 bg-ac-cream mb-6 select-none">
        <button
          type="button"
          onClick={() => setActiveDebtTab('payables')}
          className={`flex-1 h-11 flex items-center justify-center font-black text-xs rounded-xl transition-all ${
            activeDebtTab === 'payables'
              ? 'bg-ac-red text-white border-2 border-ac-brown shadow-ac-sm'
              : 'text-ac-brown hover:bg-white/40'
          }`}
          style={{ minHeight: '44px' }}
        >
          📤 Je dois ({payables.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveDebtTab('receivables')}
          className={`flex-1 h-11 flex items-center justify-center font-black text-xs rounded-xl transition-all ${
            activeDebtTab === 'receivables'
              ? 'bg-ac-green text-white border-2 border-ac-brown shadow-ac-sm'
              : 'text-ac-brown hover:bg-white/40'
          }`}
          style={{ minHeight: '44px' }}
        >
          📥 On me doit ({receivables.length})
        </button>
      </div>

      {/* Registry Lists Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-20 md:pb-0">
        
        {/* Column 1: Payables (Dettes) */}
        <div className={`ac-card p-6 bg-white border-ac-brown ${activeDebtTab === 'payables' ? 'block' : 'hidden md:block'}`}>
          <h3 className="text-base font-black text-ac-red mb-4 flex items-center gap-2 border-b border-ac-brown/15 pb-4">
            <Coins className="w-5 h-5 text-ac-red fill-ac-red/10" /> Je dois de l'argent ({payables.length})
          </h3>

          {payables.length === 0 ? (
            <p className="text-xs font-semibold text-ac-brown-light italic py-6 text-center bg-ac-cream/50 rounded-2xl border border-dashed border-ac-brown/15">
              Aucune dette enregistrée ! Tu as réglé tous tes créanciers. 🍃
            </p>
          ) : (
            <div className="space-y-4">
              {payables.map((debt) => {
                const personName = debt.entityName || debt.person || debt.name || debt.associatedFriendName || 'Créancier / Dette';
                const formattedDate = debt.date ? (debt.date?.toDate ? debt.date.toDate().toLocaleDateString('fr-FR') : (isNaN(new Date(debt.date).getTime()) ? String(debt.date) : new Date(debt.date).toLocaleDateString('fr-FR'))) : 'Date non spécifiée';
                const formattedAmount = Math.abs(debt.amount ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
                return (
                  <div key={debt.id} className="p-4 bg-ac-red-light/10 border-2 border-ac-brown rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:translate-y-[-1px] transition-transform shadow-ac-xs relative overflow-visible">
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="font-extrabold text-sm text-ac-brown">{personName}</span>
                        <span className="text-[9px] font-bold text-ac-brown-light">({formattedDate})</span>
                      </div>
                      {debt.description ? (
                        <p className="text-xs text-ac-brown-light leading-relaxed">"{debt.description}"</p>
                      ) : (
                        <p className="text-xs text-ac-brown-light/45 italic leading-relaxed">Aucun détail.</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-dashed border-ac-brown/10 sm:border-t-0 pt-3 sm:pt-0 shrink-0">
                      <span className="font-black text-ac-red text-sm bg-white border border-ac-brown/25 px-2.5 py-1 rounded-full shadow-ac-xs">
                        -{formattedAmount} €
                      </span>

                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleEditDebt(debt)}
                          className="p-1.5 bg-white hover:bg-ac-cream rounded-lg text-ac-brown-light hover:text-ac-brown border border-ac-brown/15 cursor-pointer transition-colors"
                          title="Modifier cette dette"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openSettleModal(debt)}
                          className="bg-ac-green hover:bg-ac-green/95 text-white font-extrabold text-[10px] px-3 py-1.5 rounded-lg border-2 border-ac-brown shadow-ac-xs hover:translate-y-[1px] cursor-pointer"
                          title="Régler / Solder"
                        >
                          Solder
                        </button>
                        <button
                          onClick={() => handleDeleteDebt(debt.id)}
                          className="p-1.5 bg-white hover:bg-ac-cream rounded-lg text-ac-brown-light hover:text-ac-red border border-ac-brown/15 cursor-pointer transition-colors"
                          title="Supprimer sans solder"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Column 2: Receivables (Créances) */}
        <div className={`ac-card p-6 bg-white border-ac-brown ${activeDebtTab === 'receivables' ? 'block' : 'hidden md:block'}`}>
          <h3 className="text-base font-black text-ac-green mb-4 flex items-center gap-2 border-b border-ac-brown/15 pb-4">
            <Coins className="w-5 h-5 text-ac-green fill-ac-green/10" /> On me doit de l'argent ({receivables.length})
          </h3>

          {receivables.length === 0 ? (
            <p className="text-xs font-semibold text-ac-brown-light italic py-6 text-center bg-ac-cream/50 rounded-2xl border border-dashed border-ac-brown/15">
              Aucune créance en cours. Relance tes débiteurs ou prête un peu ! 🍃
            </p>
          ) : (
            <div className="space-y-4">
              {receivables.map((debt) => {
                const personName = debt.entityName || debt.person || debt.name || debt.associatedFriendName || 'Débiteurs / Créance';
                const formattedDate = debt.date ? (debt.date?.toDate ? debt.date.toDate().toLocaleDateString('fr-FR') : (isNaN(new Date(debt.date).getTime()) ? String(debt.date) : new Date(debt.date).toLocaleDateString('fr-FR'))) : 'Date non spécifiée';
                const formattedAmount = Math.abs(debt.amount ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
                return (
                  <div key={debt.id} className="p-4 bg-ac-green-light/20 border-2 border-ac-brown rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:translate-y-[-1px] transition-transform shadow-ac-xs relative overflow-visible">
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="font-extrabold text-sm text-ac-brown">{personName}</span>
                        <span className="text-[9px] font-bold text-ac-brown-light">({formattedDate})</span>
                      </div>
                      {debt.description ? (
                        <p className="text-xs text-ac-brown-light leading-relaxed">"{debt.description}"</p>
                      ) : (
                        <p className="text-xs text-ac-brown-light/45 italic leading-relaxed">Aucun détail.</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-dashed border-ac-brown/10 sm:border-t-0 pt-3 sm:pt-0 shrink-0">
                      <span className="font-black text-ac-green text-sm bg-white border border-ac-brown/25 px-2.5 py-1 rounded-full shadow-ac-xs">
                        +{formattedAmount} €
                      </span>

                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleEditDebt(debt)}
                          className="p-1.5 bg-white hover:bg-ac-cream rounded-lg text-ac-brown-light hover:text-ac-brown border border-ac-brown/15 cursor-pointer transition-colors"
                          title="Modifier cette créance"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openSettleModal(debt)}
                          className="bg-ac-green hover:bg-ac-green/95 text-white font-extrabold text-[10px] px-3 py-1.5 rounded-lg border-2 border-ac-brown shadow-ac-xs hover:translate-y-[1px] cursor-pointer"
                          title="Récupérer / Solder"
                        >
                          Solder
                        </button>
                        <button
                          onClick={() => handleDeleteDebt(debt.id)}
                          className="p-1.5 bg-white hover:bg-ac-cream rounded-lg text-ac-brown-light hover:text-ac-red border border-ac-brown/15 cursor-pointer transition-colors"
                          title="Supprimer sans solder"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Settle Debt Modal Dialog */}
      {settlingDebt && (
        <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4 z-50 animate-fade-in text-ac-brown">
          <div className="bg-[#FFFDF9] border-t-4 border-x-4 md:border-4 border-ac-brown rounded-t-3xl md:rounded-3xl p-6 max-w-md w-full shadow-ac-lg relative animate-slide-up md:animate-bounce-in pb-safe-bottom">
            {/* Grab handle */}
            <div className="w-12 h-1.5 bg-ac-brown/20 rounded-full mx-auto mb-4 md:hidden shrink-0"></div>
            {/* Close button */}
            <button 
              type="button"
              onClick={() => {
                setSettlingDebt(null);
                setSettleSuccess(false);
              }}
              className="absolute top-4 right-4 z-50 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 transition-all hover:scale-110 text-ac-brown cursor-pointer"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
            
            {settleSuccess ? (
              <div className="text-center py-6 space-y-4 animate-bounce-in">
                <div className="w-16 h-16 bg-ac-green-light border-3 border-ac-green rounded-full flex items-center justify-center mx-auto shadow-ac-sm">
                  <Sparkles className="w-10 h-10 text-ac-green fill-ac-green-light" />
                </div>
                <h3 className="text-lg font-black text-ac-green">Règlement enregistré ! 🎉</h3>
                <div className="bg-ac-cream border-2 border-ac-brown/30 rounded-2xl p-4 text-xs font-bold leading-relaxed text-ac-brown">
                  <span className="text-lg block mb-1">🍃 Tom Nook :</span>
                  "Oui, oui ! La transaction a été générée avec succès sur le compte sélectionné et la dette a été archivée !"
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-black text-ac-brown mb-4 flex items-center gap-1.5 border-b border-ac-brown/10 pb-2">
                  <Coins className="w-5 h-5 text-ac-gold" /> Règlement de dette
                </h3>

                <div className="bg-ac-cream border-2 border-ac-brown/30 rounded-xl p-3.5 mb-4 text-xs font-semibold space-y-1">
                  <p className="text-[10px] text-ac-brown-light uppercase font-black">
                    {settlingDebt.type === 'to_pay' ? 'Créancier' : 'Débiteur'}
                  </p>
                  <p className="text-sm font-extrabold">{settlingDebt.entityName || settlingDebt.person || settlingDebt.name || 'Dette'}</p>
                  <p className={`text-xs font-black ${settlingDebt.type === 'to_pay' ? 'text-ac-red' : 'text-ac-green'}`}>
                    Montant : {(settlingDebt.amount ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </p>
                </div>

                <form onSubmit={handleConfirmSettle} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase text-ac-brown-light mb-1.5">
                      Imputer le montant sur le compte *
                    </label>
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white cursor-pointer"
                      required
                    >
                      <option value="">-- Choisir le compte concerné --</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({(acc.visibleBalance ?? acc.balance ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € disponible)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-4 pt-4 border-t border-ac-brown/10">
                    <button
                      type="button"
                      onClick={() => setSettlingDebt(null)}
                      className="flex-1 h-12 bg-white hover:bg-ac-cream text-ac-brown rounded-2xl border-3 border-ac-brown font-extrabold text-sm shadow-ac-sm transition-transform active:translate-y-1 active:shadow-none cursor-pointer flex items-center justify-center"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isSettling}
                      className={`flex-1 h-12 bg-ac-green text-white rounded-2xl border-3 border-ac-brown font-extrabold text-sm shadow-ac-sm transition-all flex items-center justify-center ${
                        isSettling ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:translate-y-1'
                      }`}
                      style={isSettling ? { cursor: 'not-allowed' } : {}}
                    >
                      {isSettling ? 'Validation...' : "Valider le règlement"}
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
