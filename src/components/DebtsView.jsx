import React, { useState, useMemo } from 'react';
import { db, useDb } from '../db';
import { doc, getDoc, getDocs, query, collection, where } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { Plus, Trash2, Handshake, X, Coins, Sparkles, Mail, Edit2 } from 'lucide-react';
import InlineShareSelector from './InlineShareSelector';
import AvatarStackPopover from './AvatarStackPopover';

export default function DebtsView() {
  const { debts = [], accountsData: accounts = [], user, acceptedFriends, username } = useDb();

  // Sharing state
  const [sharedFriendUids, setSharedFriendUids] = useState([]);
  const [formUserRoles, setFormUserRoles] = useState({});
  const [openPopoverDebtId, setOpenPopoverDebtId] = useState(null);

  // Editing debt state
  const [editingDebt, setEditingDebt] = useState(null);

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

  // Filter pending debts
  const pendingDebts = useMemo(() => {
    return debts.filter(d => d.status !== 'resolved');
  }, [debts]);

  // Split into two categories
  const payables = useMemo(() => {
    return pendingDebts.filter(d => d.type === 'to_pay');
  }, [pendingDebts]);

  const receivables = useMemo(() => {
    return pendingDebts.filter(d => d.type === 'to_collect');
  }, [pendingDebts]);

  // Form submit handler
  const handleDebtSubmit = async (e) => {
    e.preventDefault();
    if (!debtPerson.trim() || !debtAmount || isSubmitting) return;

    const amt = parseFloat(debtAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Veuillez entrer une somme supérieure à 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      const primaryFriendId = associatedFriendId || (sharedFriendUids.length > 0 ? sharedFriendUids[0] : null);
      const selectedFriend = acceptedFriends?.find(f => f.uid === primaryFriendId);

      const debtData = {
        type: debtType,
        person: debtPerson.trim(),
        amount: amt,
        description: debtDescription.trim(),
        status: 'pending',
        associatedFriendId: primaryFriendId,
        associatedFriendName: selectedFriend ? selectedFriend.name : null,
        allowedUsers: Array.from(new Set([user.uid, ...sharedFriendUids])),
        userRoles: { [user.uid]: 'owner', ...formUserRoles }
      };

      if (editingDebt) {
        await db.debts.update(editingDebt.id, {
          ...debtData,
          status: editingDebt.status,
          date: editingDebt.date
        });
      } else {
        await db.debts.add({
          ...debtData,
          date: new Date().toISOString().split('T')[0]
        });
      }

      resetForm();
    } catch (err) {
      console.error(err);
      alert("Impossible d'enregistrer cette dette.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditDebt = (debt) => {
    setEditingDebt(debt);
    setDebtType(debt.type);
    setDebtPerson(debt.person);
    setDebtAmount(debt.amount.toString());
    setDebtDescription(debt.description || '');
    setAssociatedFriendId(debt.associatedFriendId || '');
    setSharedFriendUids(debt.allowedUsers ? debt.allowedUsers.filter(uid => uid !== user?.uid) : []);
    setFormUserRoles(debt.userRoles || {});
    setFormOpen(true);
  };

  const resetForm = () => {
    setDebtPerson('');
    setDebtAmount('');
    setDebtDescription('');
    setAssociatedFriendId('');
    setSharedFriendUids([]);
    setFormUserRoles({});
    setEditingDebt(null);
    setFormOpen(false);
  };

  // Delete directly
  const handleDeleteDebt = async (id) => {
    const debt = debts?.find(d => d.id === id);
    if (!debt) return;
    const isOwner = debt.ownerId === user?.uid || debt.creatorId === user?.uid || debt.userId === user?.uid || !debt.ownerId && !debt.creatorId && !debt.userId || (debt.allowedUsers && debt.allowedUsers[0] === user?.uid);
    if (!isOwner) {
      alert("Vous n'êtes pas le propriétaire de cette dette.");
      return;
    }
    if (window.confirm("Es-tu sûr de vouloir effacer cette dette de ton registre ?")) {
      try {
        await db.debts.delete(id);
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la suppression.");
      }
    }
  };

  const handleLeaveDebt = async (debt) => {
    const confirmLeave = window.confirm("Es-tu sûr de vouloir quitter cette dette partagée ?");
    if (!confirmLeave) return;

    try {
      const myUsername = username || 'Habitant';
      const updatedAllowedUsers = (debt.allowedUsers || []).filter(uid => uid !== user?.uid);
      
      const updatedUserRoles = { ...(debt.userRoles || {}) };
      delete updatedUserRoles[user?.uid];

      const updatedSharedWithNames = (debt.sharedWithNames || []).filter(
        name => name.toLowerCase() !== myUsername.toLowerCase()
      );

      await db.debts.update(debt.id, {
        allowedUsers: updatedAllowedUsers,
        userRoles: updatedUserRoles,
        sharedWithNames: updatedSharedWithNames
      });

      alert("Vous avez quitté le partage de cette dette.");
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la sortie du partage.");
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
      alert("Compte sélectionné introuvable.");
      return;
    }

    setIsSettling(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // Format description as strict: [Nom de la dette] - [Description] or just [Nom]
      const txDescription = settlingDebt.description
        ? `${settlingDebt.person} - ${settlingDebt.description}`
        : settlingDebt.person;

      const isToPay = settlingDebt.type === 'to_pay';

      // Create new transaction structure
      const newTx = {
        accountId: selectedAccountId,
        name: isToPay ? `Remboursement : ${settlingDebt.person}` : `Encaissement : ${settlingDebt.person}`,
        description: txDescription,
        amount: settlingDebt.amount,
        type: isToPay ? 'debit' : 'credit',
        date: todayStr,
        pocketId: null
      };

      // Check shared debt & account details for mirror transaction
      const isSharedDebt = (settlingDebt.allowedUsers || []).length > 1;
      const isSharedAccount = (targetAccount.allowedUsers || []).length > 1;
      const otherUid = isSharedDebt ? settlingDebt.allowedUsers.find(uid => uid !== user?.uid) : null;
      let otherAccountId = null;

      if (isSharedDebt && isSharedAccount && otherUid) {
        const otherMetaRef = doc(firestoreDb, 'users_meta', otherUid);
        const otherMetaSnap = await getDoc(otherMetaRef);
        if (otherMetaSnap.exists()) {
          otherAccountId = otherMetaSnap.data().favoriteAccountId;
        }

        if (!otherAccountId) {
          const qAccs = query(collection(firestoreDb, 'accounts'), where('allowedUsers', 'array-contains', otherUid));
          const snapAccs = await getDocs(qAccs);
          if (!snapAccs.empty) {
            otherAccountId = snapAccs.docs[0].id;
          }
        }
      }

      // Run transactional update
      await db.transaction('rw', [db.transactions, db.debts], async () => {
        // Add transaction
        await db.transactions.add(newTx);

        // Add mirror transaction if shared and other participant account is resolved
        if (isSharedDebt && isSharedAccount && otherAccountId) {
          const mirrorTx = {
            accountId: otherAccountId,
            name: isToPay ? `Encaissement (Miroir) : ${settlingDebt.person}` : `Remboursement (Miroir) : ${settlingDebt.person}`,
            description: `Ajustement miroir pour dette/créance partagée : ${settlingDebt.description || settlingDebt.person}`,
            amount: settlingDebt.amount,
            type: isToPay ? 'credit' : 'debit',
            date: todayStr,
            pocketId: null
          };
          await db.transactions.add(mirrorTx);
        }

        // Delete debt (resolved)
        await db.debts.delete(settlingDebt.id);
      });

      setSettleSuccess(true);

      // Close modal after delay
      setTimeout(() => {
        setSettlingDebt(null);
        setSettleSuccess(false);
      }, 2000);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la validation du règlement.");
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <div className="space-y-6 relative text-ac-brown select-none">
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
          onClick={() => setFormOpen(!formOpen)}
          className="bg-ac-green text-white font-extrabold text-xs px-4 py-3 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center gap-1.5 hover:translate-y-[1px] cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> {formOpen ? 'Masquer le formulaire' : 'Nouvelle Dette / Créance'}
        </button>
      </div>

      {/* Debt Creation Form */}
      {formOpen && (
        <form onSubmit={handleDebtSubmit} className="bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm space-y-4 animate-bounce-in max-w-2xl">
          <h3 className="font-black text-sm text-ac-brown border-b border-ac-brown/15 pb-2">
            Créer une nouvelle entrée dans le registre
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Qui (Personne / Entité) *</label>
              <input
                type="text"
                value={debtPerson}
                onChange={(e) => setDebtPerson(e.target.value)}
                placeholder="Ex: Tom Nook, Raymond, Maman..."
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold text-ac-brown focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Montant *</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl pl-8 pr-4 py-2 text-sm font-bold text-ac-brown focus:outline-none"
                  required
                />
                <span className="absolute left-3 top-2.5 text-xs font-black">🔔</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Description / Notes (Optionnel)</label>
            <input
              type="text"
              value={debtDescription}
              onChange={(e) => setDebtDescription(e.target.value)}
              placeholder="Ex: Prêt à taux zéro pour le pont, Achat de navets..."
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
            onSelectFriend={(friend) => {
              if (friend && friend.name) {
                setDebtPerson(friend.name);
                setAssociatedFriendId(friend.uid);
              }
            }}
            ownerId={editingDebt?.creatorId || user?.uid}
            title="Passeport Habitants — Attribuer & Partager la Dette"
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
                const isPopoverOpen = openPopoverDebtId === debt.id;
                const isOwner = debt.ownerId === user?.uid || debt.creatorId === user?.uid || debt.userId === user?.uid || !debt.ownerId && !debt.creatorId && !debt.userId || (debt.allowedUsers && debt.allowedUsers[0] === user?.uid);
                return (
                  <div key={debt.id} className={`p-4 bg-ac-red-light/10 border-2 border-ac-brown rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:translate-y-[-1px] transition-transform shadow-ac-xs relative overflow-visible ${
                    isPopoverOpen ? 'z-30' : 'z-0'
                  }`}>
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="font-extrabold text-sm text-ac-brown">{debt.person}</span>
                        <span className="text-[9px] font-bold text-ac-brown-light">({new Date(debt.date).toLocaleDateString('fr-FR')})</span>
                      </div>
                      {debt.description ? (
                        <p className="text-xs text-ac-brown-light leading-relaxed">"{debt.description}"</p>
                      ) : (
                        <p className="text-xs text-ac-brown-light/45 italic leading-relaxed">Aucun détail.</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-dashed border-ac-brown/10 sm:border-t-0 pt-3 sm:pt-0 shrink-0">
                      <span className="font-black text-ac-red text-sm bg-white border border-ac-brown/25 px-2.5 py-1 rounded-full shadow-ac-xs">
                        -{debt.amount.toLocaleString('fr-FR')} 🔔
                      </span>

                      <div className="flex gap-1.5">
                        <AvatarStackPopover
                          allowedUsers={debt.allowedUsers || []}
                          userRoles={debt.userRoles || {}}
                          ownerId={debt.creatorId || debt.userId}
                          docId={debt.id}
                          collectionName="debts"
                          onOpenChange={(open) => setOpenPopoverDebtId(open ? debt.id : null)}
                        />
                      {(debt.creatorId === user?.uid || !debt.creatorId) && (
                        <button
                          onClick={() => handleEditDebt(debt)}
                          className="p-1.5 bg-white hover:bg-ac-cream rounded-lg text-ac-brown-light hover:text-ac-brown border border-ac-brown/15 cursor-pointer transition-colors"
                          title="Modifier cette dette"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => openSettleModal(debt)}
                        className="bg-ac-red hover:bg-ac-red/95 text-white font-extrabold text-[10px] px-3 py-1.5 rounded-lg border-2 border-ac-brown shadow-ac-xs hover:translate-y-[1px] cursor-pointer"
                        title="Régler / Solder"
                      >
                        Solder
                      </button>
                      {isOwner ? (
                        <button
                          onClick={() => handleDeleteDebt(debt.id)}
                          className="p-1.5 bg-white hover:bg-ac-cream rounded-lg text-ac-brown-light hover:text-ac-red border border-ac-brown/15 cursor-pointer transition-colors"
                          title="Supprimer sans solder"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleLeaveDebt(debt)}
                          className="p-1.5 bg-white hover:bg-ac-cream rounded-lg text-ac-brown-light hover:text-ac-red border border-ac-brown/15 cursor-pointer transition-colors"
                          title="Quitter le partage"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
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
                const isPopoverOpen = openPopoverDebtId === debt.id;
                const isOwner = debt.ownerId === user?.uid || debt.creatorId === user?.uid || debt.userId === user?.uid || !debt.ownerId && !debt.creatorId && !debt.userId || (debt.allowedUsers && debt.allowedUsers[0] === user?.uid);
                return (
                  <div key={debt.id} className={`p-4 bg-ac-green-light/20 border-2 border-ac-brown rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:translate-y-[-1px] transition-transform shadow-ac-xs relative overflow-visible ${
                    isPopoverOpen ? 'z-30' : 'z-0'
                  }`}>
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="font-extrabold text-sm text-ac-brown">{debt.person}</span>
                        <span className="text-[9px] font-bold text-ac-brown-light">({new Date(debt.date).toLocaleDateString('fr-FR')})</span>
                      </div>
                      {debt.description ? (
                        <p className="text-xs text-ac-brown-light leading-relaxed">"{debt.description}"</p>
                      ) : (
                        <p className="text-xs text-ac-brown-light/45 italic leading-relaxed">Aucun détail.</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-dashed border-ac-brown/10 sm:border-t-0 pt-3 sm:pt-0 shrink-0">
                      <span className="font-black text-ac-green text-sm bg-white border border-ac-brown/25 px-2.5 py-1 rounded-full shadow-ac-xs">
                        +{debt.amount.toLocaleString('fr-FR')} 🔔
                      </span>

                      <div className="flex gap-1.5">
                        <AvatarStackPopover
                          allowedUsers={debt.allowedUsers || []}
                          userRoles={debt.userRoles || {}}
                          ownerId={debt.creatorId || debt.userId}
                          docId={debt.id}
                          collectionName="debts"
                          onOpenChange={(open) => setOpenPopoverDebtId(open ? debt.id : null)}
                        />
                      {(debt.creatorId === user?.uid || !debt.creatorId) && (
                        <button
                          onClick={() => handleEditDebt(debt)}
                          className="p-1.5 bg-white hover:bg-ac-cream rounded-lg text-ac-brown-light hover:text-ac-brown border border-ac-brown/15 cursor-pointer transition-colors"
                          title="Modifier cette créance"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => openSettleModal(debt)}
                        className="bg-ac-green hover:bg-ac-green/95 text-white font-extrabold text-[10px] px-3 py-1.5 rounded-lg border-2 border-ac-brown shadow-ac-xs hover:translate-y-[1px] cursor-pointer"
                        title="Récupérer / Solder"
                      >
                        Solder
                      </button>
                      {isOwner ? (
                        <button
                          onClick={() => handleDeleteDebt(debt.id)}
                          className="p-1.5 bg-white hover:bg-ac-cream rounded-lg text-ac-brown-light hover:text-ac-red border border-ac-brown/15 cursor-pointer transition-colors"
                          title="Supprimer sans solder"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleLeaveDebt(debt)}
                          className="p-1.5 bg-white hover:bg-ac-cream rounded-lg text-ac-brown-light hover:text-ac-red border border-ac-brown/15 cursor-pointer transition-colors"
                          title="Quitter le partage"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
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
                  <p className="text-sm font-extrabold">{settlingDebt.person}</p>
                  <p className={`text-xs font-black ${settlingDebt.type === 'to_pay' ? 'text-ac-red' : 'text-ac-green'}`}>
                    Montant : {settlingDebt.amount.toLocaleString('fr-FR')} 🔔
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
                          {acc.name} ({acc.visibleBalance.toLocaleString('fr-FR')} 🔔 disponible)
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
