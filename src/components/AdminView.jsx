import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDb, COLOR_PALETTE, getCustomCardStyle } from '../db';
import { db as firestoreDb } from '../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  deleteDoc, 
  updateDoc,
  writeBatch, 
  query, 
  where 
} from 'firebase/firestore';
import { 
  Shield, 
  Users, 
  CreditCard, 
  FolderOpen, 
  Database, 
  Gift, 
  Handshake, 
  UserPlus, 
  Search, 
  RefreshCw, 
  Edit, 
  Trash2, 
  X, 
  Check, 
  AlertTriangle, 
  AlertCircle, 
  Sparkles, 
  Filter, 
  Palette,
  CheckCircle,
  Clock,
  Mail,
  User,
  ArrowRightLeft
} from 'lucide-react';

const COLLECTIONS = [
  { id: 'users', name: 'Utilisateurs', icon: Users, colName: 'users_meta', color: 'text-ac-green', bg: 'bg-ac-green/10' },
  { id: 'accounts', name: 'Comptes', icon: CreditCard, colName: 'accounts', ownerField: 'creatorId', color: 'text-ac-gold-dark', bg: 'bg-ac-gold/10' },
  { id: 'pockets', name: 'Poches', icon: FolderOpen, colName: 'pockets', ownerField: 'userId', color: 'text-ac-sky', bg: 'bg-ac-sky/10' },
  { id: 'transactions', name: 'Transactions', icon: Database, colName: 'transactions', ownerField: 'userId', color: 'text-ac-orange', bg: 'bg-ac-orange/10' },
  { id: 'wishlist', name: 'Souhaits', icon: Gift, colName: 'wishlist', ownerField: 'creatorId', color: 'text-ac-red', bg: 'bg-ac-red/10' },
  { id: 'debts', name: 'Dettes', icon: Handshake, colName: 'debts', ownerField: 'creatorId', color: 'text-purple-600', bg: 'bg-purple-100' },
  { id: 'friendships', name: 'Amitiés', icon: UserPlus, colName: 'friendships', ownerField: 'senderId', color: 'text-pink-600', bg: 'bg-pink-100' }
];

export default function AdminView() {
  const { allUsersMeta = [], isAdmin, user: currentUser } = useDb();
  
  // Selected collection tab
  const [activeTab, setActiveTab] = useState('users');
  const [tableData, setTableData] = useState([]);
  const [loadingTable, setLoadingTable] = useState(false);
  
  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  
  // Toast notifications
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: string }
  
  // Edit Modal state
  const [editingItem, setEditingItem] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  
  // Double-confirmation Purge/Delete user modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    actionType: null, // 'reset' or 'delete_user'
    targetUser: null,
    inputConfirmation: '',
    isProcessing: false
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Map UID -> User object for easy lookup
  const userMap = useMemo(() => {
    const map = new Map();
    (allUsersMeta || []).forEach(u => {
      if (u.uid) {
        map.set(u.uid, u);
      }
    });
    return map;
  }, [allUsersMeta]);

  // Fetch active collection data
  const loadCollectionData = useCallback(async () => {
    if (activeTab === 'users') {
      setTableData(allUsersMeta || []);
      return;
    }

    setLoadingTable(true);
    try {
      const snap = await getDocs(collection(firestoreDb, activeTab));
      const list = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setTableData(list);
    } catch (err) {
      console.error(`Erreur lors du chargement de la collection ${activeTab}:`, err);
      showToast(`Impossible de charger les données : ${err.message}`, 'error');
    } finally {
      setLoadingTable(false);
    }
  }, [activeTab, allUsersMeta]);

  useEffect(() => {
    loadCollectionData();
  }, [loadCollectionData]);

  // Check if target is admin (to prevent self-destruction/accidental lockout)
  const isTargetAdmin = (userObj) => {
    if (!userObj) return false;
    return (
      userObj.email?.toLowerCase() === 'matysallanet@gmail.com' ||
      userObj.role === 'admin'
    );
  };

  // Resolve user info helper
  const getOwnerInfo = (uid) => {
    if (!uid) return { username: 'Inconnu', email: 'Sans e-mail', role: 'member' };
    const found = userMap.get(uid);
    if (found) {
      return {
        username: found.username || found.displayName || 'Habitant',
        email: found.email || 'Email masqué',
        role: found.role || 'member'
      };
    }
    return { username: `ID: ${uid.slice(0, 6)}...`, email: uid, role: 'member' };
  };

  // Filtered dataset
  const filteredData = useMemo(() => {
    const queryStr = searchQuery.trim().toLowerCase();

    return tableData.filter(item => {
      // 1. User Filter
      if (userFilter !== 'all') {
        if (activeTab === 'users') {
          if (item.uid !== userFilter) return false;
        } else if (activeTab === 'accounts' || activeTab === 'debts' || activeTab === 'wishlist') {
          if (item.creatorId !== userFilter && item.userId !== userFilter) return false;
        } else if (activeTab === 'transactions' || activeTab === 'pockets') {
          if (item.userId !== userFilter && item.creatorId !== userFilter) return false;
        } else if (activeTab === 'friendships') {
          if (item.senderId !== userFilter && item.receiverId !== userFilter) return false;
        }
      }

      // 2. Text Search
      if (!queryStr) return true;

      // Check common fields
      const searchFields = [
        item.id,
        item.name,
        item.title,
        item.description,
        item.username,
        item.email,
        item.senderEmail,
        item.receiverEmail,
        item.bankName,
        item.category,
        item.person,
        item.role,
        item.type,
        String(item.amount ?? ''),
        String(item.balance ?? ''),
        String(item.price ?? ''),
        String(item.allocatedAmount ?? '')
      ];

      // Also search owner username/email if applicable
      const ownerUid = item.userId || item.creatorId || item.senderId;
      if (ownerUid) {
        const owner = userMap.get(ownerUid);
        if (owner) {
          searchFields.push(owner.username, owner.email);
        }
      }

      return searchFields.some(val => val && String(val).toLowerCase().includes(queryStr));
    });
  }, [tableData, searchQuery, userFilter, activeTab, userMap]);

  // Delete single row
  const handleDeleteRow = async (row) => {
    if (activeTab === 'users') {
      if (isTargetAdmin(row)) {
        showToast("Impossible de supprimer un compte administrateur.", 'error');
        return;
      }
      setConfirmModal({
        isOpen: true,
        actionType: 'delete_user',
        targetUser: row,
        inputConfirmation: '',
        isProcessing: false
      });
      return;
    }

    const rowName = row.name || row.title || row.description || row.id;
    if (!window.confirm(`Es-tu sûr de vouloir supprimer définitivement "${rowName}" (${row.id}) ?`)) {
      return;
    }

    try {
      await deleteDoc(doc(firestoreDb, activeTab, row.id));
      setTableData(prev => prev.filter(r => r.id !== row.id));
      showToast(`Élément "${rowName}" supprimé avec succès.`);
    } catch (err) {
      console.error("Erreur lors de la suppression:", err);
      showToast(`Erreur lors de la suppression : ${err.message}`, 'error');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setEditFormData({ ...item });
  };

  // Save Edit Modal
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingItem || isSavingEdit) return;

    setIsSavingEdit(true);
    try {
      const col = activeTab === 'users' ? 'users_meta' : activeTab;
      const targetId = editingItem.id || editingItem.uid;
      const ref = doc(firestoreDb, col, targetId);

      // Clean payload: do not send undefined or id inside fields
      const payload = { ...editFormData };
      delete payload.id;

      // Numeric conversions for safety
      if (payload.amount !== undefined) payload.amount = Number(payload.amount);
      if (payload.balance !== undefined) payload.balance = Number(payload.balance);
      if (payload.currentBalance !== undefined) payload.currentBalance = Number(payload.currentBalance);
      if (payload.initialBalance !== undefined) payload.initialBalance = Number(payload.initialBalance);
      if (payload.allocatedAmount !== undefined) payload.allocatedAmount = Number(payload.allocatedAmount);
      if (payload.currentAmount !== undefined) payload.currentAmount = Number(payload.currentAmount);
      if (payload.price !== undefined) payload.price = Number(payload.price);
      if (payload.rate !== undefined) payload.rate = Number(payload.rate);
      if (payload.renewalDay !== undefined && payload.renewalDay !== '') payload.renewalDay = Number(payload.renewalDay);

      await updateDoc(ref, payload);

      // Update local state strictly for the targeted item to prevent mutating all rows
      const targetIdentifier = activeTab === 'users' ? (editingItem.uid || editingItem.id) : editingItem.id;
      setTableData(prev => prev.map(row => {
        const rowIdentifier = activeTab === 'users' ? (row.uid || row.id) : row.id;
        if (rowIdentifier && rowIdentifier === targetIdentifier) {
          return { ...row, ...payload };
        }
        return row;
      }));

      showToast(`Modifications enregistrées avec succès.`);
      setEditingItem(null);
    } catch (err) {
      console.error("Erreur lors de la mise à jour:", err);
      showToast(`Erreur lors de l'enregistrement : ${err.message}`, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Execute double-confirmed purge / reset
  const handleExecutePurge = async () => {
    const { actionType, targetUser, inputConfirmation } = confirmModal;
    if (!targetUser || inputConfirmation.trim() !== 'CONFIRMER') {
      showToast("Veuillez saisir 'CONFIRMER' exactement pour valider.", 'error');
      return;
    }

    if (isTargetAdmin(targetUser)) {
      showToast("Action interdite sur un compte administrateur.", 'error');
      return;
    }

    setConfirmModal(prev => ({ ...prev, isProcessing: true }));
    const uid = targetUser.uid;

    try {
      if (actionType === 'reset') {
        // Purge accounts, pockets, transactions, debts, wishlist
        const collectionsToPurge = [
          { name: 'transactions', ownerField: 'userId' },
          { name: 'pockets', ownerField: 'userId' },
          { name: 'debts', ownerField: 'creatorId' },
          { name: 'wishlist', ownerField: 'creatorId' },
          { name: 'accounts', ownerField: 'creatorId' }
        ];

        for (const col of collectionsToPurge) {
          const q = query(collection(firestoreDb, col.name), where(col.ownerField, '==', uid));
          const snap = await getDocs(q);
          const batch = writeBatch(firestoreDb);
          snap.docs.forEach(docSnap => batch.delete(doc(firestoreDb, col.name, docSnap.id)));
          await batch.commit();
        }

        // Reset tutorial progress
        const userRef = doc(firestoreDb, 'users_meta', uid);
        await updateDoc(userRef, {
          favoriteAccountId: null,
          tutorialProgress: {
            isCompleted: false,
            steps: { accounts: false, calendar: false, debts: false, wishlist: false, home: false, settings: false }
          }
        });

        showToast(`Les données de ${targetUser.username || targetUser.email} ont été réinitialisées.`);
      } else if (actionType === 'delete_user') {
        // Complete purge + users_meta deletion
        const collectionsToPurge = [
          { name: 'transactions', ownerField: 'userId' },
          { name: 'pockets', ownerField: 'userId' },
          { name: 'debts', ownerField: 'creatorId' },
          { name: 'wishlist', ownerField: 'creatorId' },
          { name: 'accounts', ownerField: 'creatorId' }
        ];

        for (const col of collectionsToPurge) {
          const q = query(collection(firestoreDb, col.name), where(col.ownerField, '==', uid));
          const snap = await getDocs(q);
          const batch = writeBatch(firestoreDb);
          snap.docs.forEach(docSnap => batch.delete(doc(firestoreDb, col.name, docSnap.id)));
          await batch.commit();
        }

        // Purge friendships
        const f1 = query(collection(firestoreDb, 'friendships'), where('senderId', '==', uid));
        const f2 = query(collection(firestoreDb, 'friendships'), where('receiverId', '==', uid));
        const [snap1, snap2] = await Promise.all([getDocs(f1), getDocs(f2)]);

        const batchFriendships = writeBatch(firestoreDb);
        snap1.docs.forEach(d => batchFriendships.delete(doc(firestoreDb, 'friendships', d.id)));
        snap2.docs.forEach(d => batchFriendships.delete(doc(firestoreDb, 'friendships', d.id)));
        await batchFriendships.commit();

        // Delete users_meta
        await deleteDoc(doc(firestoreDb, 'users_meta', uid));

        setTableData(prev => prev.filter(u => u.uid !== uid));
        showToast(`L'habitant ${targetUser.username || targetUser.email} a été définitivement supprimé.`);
      }

      setConfirmModal({ isOpen: false, actionType: null, targetUser: null, inputConfirmation: '', isProcessing: false });
    } catch (err) {
      console.error("Erreur lors de l'opération de purge:", err);
      showToast(`Erreur lors de l'opération : ${err.message}`, 'error');
      setConfirmModal(prev => ({ ...prev, isProcessing: false }));
    }
  };

  // If not admin, block view
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center select-none">
        <div className="w-20 h-20 bg-ac-red/10 border-3 border-ac-brown rounded-full flex items-center justify-center shadow-ac-md mb-4 animate-bounce">
          <Shield className="w-10 h-10 text-ac-red" />
        </div>
        <h2 className="text-2xl font-black text-ac-brown mb-2">Accès Restreint</h2>
        <p className="text-sm font-bold text-ac-brown-light max-w-md">
          Ce module de monitoring et d'administration est réservé aux administrateurs certifiés de l'île.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none animate-fade-in text-ac-brown pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl border-3 border-ac-brown shadow-ac-md flex items-center gap-2.5 font-black text-xs text-white animate-bounce-in ${
          toast.type === 'error' ? 'bg-ac-red' : 'bg-ac-green'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[#FFFDF9] border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛠️</span>
            <h2 className="text-xl md:text-2xl font-black text-ac-brown">
              Centre de Monitoring &amp; Administration
            </h2>
          </div>
          <p className="text-xs font-bold text-ac-brown-light mt-1">
            Supervision, inspection directe, édition et gestion de l'ensemble des données Firestore d'Ecopine.
          </p>
        </div>

        <button
          onClick={loadCollectionData}
          disabled={loadingTable}
          className="bg-ac-cream hover:bg-ac-cream-dark text-ac-brown font-extrabold text-xs px-4 py-2.5 rounded-2xl border-2 border-ac-brown shadow-ac-xs flex items-center gap-2 cursor-pointer transition-transform active:translate-y-0.5 disabled:opacity-50"
          title="Actualiser les données"
        >
          <RefreshCw className={`w-4 h-4 text-ac-green ${loadingTable ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Collection Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {COLLECTIONS.map(col => {
          const Icon = col.icon;
          const isActive = activeTab === col.id;
          return (
            <button
              key={col.id}
              onClick={() => {
                setActiveTab(col.id);
                setSearchQuery('');
              }}
              className={`px-4 py-3 rounded-2xl border-2 border-ac-brown font-black text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer shadow-ac-xs ${
                isActive
                  ? 'bg-ac-brown text-white scale-[1.02] shadow-ac-sm'
                  : 'bg-white hover:bg-ac-cream text-ac-brown'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : col.color}`} />
              <span>{col.name}</span>
              {isActive && (
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-black ml-1">
                  {filteredData.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Global Toolbar: Instant Search + User Filter + Counters */}
      <div className="bg-[#FFFDF9] border-3 border-ac-brown rounded-3xl p-4 shadow-ac-xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-ac-brown-light absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Rechercher dans ${COLLECTIONS.find(c => c.id === activeTab)?.name.toLowerCase()} (pseudo, e-mail, ID, libellé, montant...)...`}
            className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ac-brown-light hover:text-ac-brown p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* User Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-ac-brown-light shrink-0" />
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white cursor-pointer"
          >
            <option value="all">Tous les habitants ({allUsersMeta.length})</option>
            {allUsersMeta.map(u => (
              <option key={u.uid} value={u.uid}>
                {u.username || u.displayName || 'Habitant'} ({u.email || u.uid.slice(0, 6)})
              </option>
            ))}
          </select>
        </div>

        {/* Counter Badge */}
        <div className="bg-ac-cream-dark/30 border border-ac-brown/20 rounded-xl px-3 py-2 text-[11px] font-black text-ac-brown-light text-center">
          Affichage : <strong className="text-ac-brown">{filteredData.length}</strong> / {tableData.length} élément(s)
        </div>
      </div>

      {/* Main Table View */}
      <div className="bg-[#FFFDF9] border-3 border-ac-brown rounded-3xl overflow-hidden shadow-ac-sm">
        {loadingTable ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-ac-green border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-ac-brown-light">Chargement des données Firestore...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="py-16 text-center">
            <AlertCircle className="w-8 h-8 text-ac-brown-light mx-auto mb-2 opacity-50" />
            <p className="text-xs font-black text-ac-brown">Aucun enregistrement trouvé.</p>
            <p className="text-[10px] font-bold text-ac-brown-light mt-1">
              Modifie ta recherche ou sélectionne un autre filtre.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-ac-cream border-b-2 border-ac-brown text-ac-brown text-[11px] font-black uppercase">
                  {renderTableHeaders(activeTab)}
                  <th className="p-3.5 text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ac-brown/10 text-xs">
                {filteredData.map((row, index) => {
                  const rowId = row.id || row.uid;
                  return (
                    <tr 
                      key={rowId || index} 
                      className="hover:bg-ac-cream/40 transition-colors"
                    >
                      {renderTableCells(row, activeTab, getOwnerInfo)}

                      {/* Actions column */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(row)}
                            className="p-1.5 bg-white hover:bg-ac-gold-light border border-ac-brown/30 rounded-xl text-ac-brown hover:text-ac-gold-dark transition-colors cursor-pointer"
                            title="Éditer / Inspecter"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          
                          {activeTab === 'users' ? (
                            <>
                              <button
                                onClick={() => setConfirmModal({
                                  isOpen: true,
                                  actionType: 'reset',
                                  targetUser: row,
                                  inputConfirmation: '',
                                  isProcessing: false
                                })}
                                disabled={isTargetAdmin(row)}
                                className="p-1.5 bg-white hover:bg-amber-100 border border-ac-brown/30 rounded-xl text-amber-700 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Réinitialiser les données de cet habitant"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRow(row)}
                                disabled={isTargetAdmin(row)}
                                className="p-1.5 bg-white hover:bg-ac-red-light border border-ac-brown/30 rounded-xl text-ac-red transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Supprimer définitivement cet habitant"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleDeleteRow(row)}
                              className="p-1.5 bg-white hover:bg-ac-red-light border border-ac-brown/30 rounded-xl text-ac-red transition-colors cursor-pointer"
                              title="Supprimer la ligne"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / Inspect Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-ac-brown select-none">
          <div className="bg-[#FFFDF9] border-4 border-ac-brown rounded-3xl p-6 max-w-xl w-full shadow-ac-lg relative animate-bounce-in max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingItem(null)}
              className="absolute top-4 right-4 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 transition-transform hover:scale-110 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-black flex items-center gap-2 border-b border-ac-brown/10 pb-3 mb-4">
              <Edit className="w-4 h-4 text-ac-gold" />
              Édition : {COLLECTIONS.find(c => c.id === activeTab)?.name} ({editingItem.id || editingItem.uid})
            </h3>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {renderEditFormFields(activeTab, editFormData, setEditFormData)}

              <div className="flex justify-end gap-3 pt-4 border-t border-ac-brown/10">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="bg-white border-2 border-ac-brown text-ac-brown font-extrabold text-xs px-4 py-2.5 rounded-2xl hover:bg-ac-cream cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="bg-ac-green text-white font-extrabold text-xs px-6 py-2.5 rounded-2xl border-2 border-ac-brown shadow-ac-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Enregistrer les modifications</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Double Confirmation Purge / Delete User Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-ac-brown/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-ac-brown select-none">
          <div className="bg-[#FFFDF9] border-4 border-ac-brown rounded-3xl p-6 max-w-md w-full shadow-ac-lg relative animate-bounce-in">
            <button
              onClick={() => setConfirmModal({ isOpen: false, actionType: null, targetUser: null, inputConfirmation: '', isProcessing: false })}
              className="absolute top-4 right-4 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 transition-transform hover:scale-110 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 text-ac-red mb-3">
              <div className="w-10 h-10 bg-ac-red/10 rounded-full flex items-center justify-center border-2 border-ac-red/30">
                <AlertTriangle className="w-5 h-5 text-ac-red" />
              </div>
              <h3 className="text-base font-black">
                {confirmModal.actionType === 'reset' 
                  ? 'Réinitialisation des Données' 
                  : 'Suppression Définitive de l\'Habitant'}
              </h3>
            </div>

            <p className="text-xs font-bold text-ac-brown-light leading-relaxed mb-4">
              {confirmModal.actionType === 'reset' ? (
                <>
                  Tu t'apprêtes à <strong>purger l'ensemble des comptes, poches, dettes, souhaits et transactions</strong> de <strong>{confirmModal.targetUser?.username || confirmModal.targetUser?.email}</strong>. Son profil sera conservé avec un tutoriel réinitialisé.
                </>
              ) : (
                <>
                  Tu t'apprêtes à <strong>supprimer définitivement le compte et toutes les données</strong> de <strong>{confirmModal.targetUser?.username || confirmModal.targetUser?.email}</strong>. Cette action est irréversible.
                </>
              )}
            </p>

            <div className="bg-ac-cream-dark/30 border-2 border-ac-brown/30 rounded-2xl p-3.5 mb-4">
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1.5">
                Pour confirmer, saisis le mot <strong className="text-ac-red">CONFIRMER</strong> :
              </label>
              <input
                type="text"
                value={confirmModal.inputConfirmation}
                onChange={(e) => setConfirmModal(prev => ({ ...prev, inputConfirmation: e.target.value }))}
                placeholder="CONFIRMER"
                className="w-full bg-white border-2 border-ac-brown rounded-xl px-3 py-2 text-xs font-black text-ac-brown focus:outline-none focus:ring-2 focus:ring-ac-red"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmModal({ isOpen: false, actionType: null, targetUser: null, inputConfirmation: '', isProcessing: false })}
                className="bg-white border-2 border-ac-brown text-ac-brown font-extrabold text-xs px-4 py-2 rounded-xl hover:bg-ac-cream cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleExecutePurge}
                disabled={confirmModal.inputConfirmation.trim() !== 'CONFIRMER' || confirmModal.isProcessing}
                className="bg-ac-red text-white font-extrabold text-xs px-5 py-2 rounded-xl border-2 border-ac-brown shadow-ac-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {confirmModal.isProcessing ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Exécuter la purge</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------------------
// TABLE CELLS & HEADERS RENDERERS
// --------------------------------------------------------------------------------------

function renderTableHeaders(tableId) {
  switch (tableId) {
    case 'users':
      return (
        <>
          <th className="p-3.5">Habitant</th>
          <th className="p-3.5">E-mail</th>
          <th className="p-3.5">Rôle</th>
          <th className="p-3.5">Thème Préféré</th>
          <th className="p-3.5">UID</th>
        </>
      );
    case 'accounts':
      return (
        <>
          <th className="p-3.5">Nom du Compte</th>
          <th className="p-3.5">Banque</th>
          <th className="p-3.5">Solde</th>
          <th className="p-3.5">Propriétaire</th>
        </>
      );
    case 'pockets':
      return (
        <>
          <th className="p-3.5">Nom de la Poche</th>
          <th className="p-3.5">Alloué</th>
          <th className="p-3.5">Restant</th>
          <th className="p-3.5">Renouvellement</th>
          <th className="p-3.5">Propriétaire</th>
        </>
      );
    case 'transactions':
      return (
        <>
          <th className="p-3.5">Libellé / Nom</th>
          <th className="p-3.5">Montant</th>
          <th className="p-3.5">Type</th>
          <th className="p-3.5">Date</th>
          <th className="p-3.5">Habitant</th>
        </>
      );
    case 'wishlist':
      return (
        <>
          <th className="p-3.5">Souhait</th>
          <th className="p-3.5">Description / Note</th>
          <th className="p-3.5">Propriétaire</th>
        </>
      );
    case 'debts':
      return (
        <>
          <th className="p-3.5">Libellé</th>
          <th className="p-3.5">Montant</th>
          <th className="p-3.5">Personne Concernée</th>
          <th className="p-3.5">Statut</th>
          <th className="p-3.5">Propriétaire</th>
        </>
      );
    case 'friendships':
      return (
        <>
          <th className="p-3.5">Expéditeur</th>
          <th className="p-3.5">Destinataire</th>
          <th className="p-3.5">Statut</th>
          <th className="p-3.5">Date de demande</th>
        </>
      );
    default:
      return null;
  }
}

function renderTableCells(row, tableId, getOwnerInfo) {
  const renderOwnerBadge = (uid) => {
    const owner = getOwnerInfo(uid);
    return (
      <div className="flex items-center gap-1.5">
        <span className="bg-ac-cream border border-ac-brown/20 px-2 py-0.5 rounded-lg font-black text-ac-brown text-[11px] flex items-center gap-1">
          <User className="w-3 h-3 text-ac-green" />
          {owner.username}
        </span>
        <span className="text-[10px] text-ac-brown-light font-bold truncate max-w-[140px]" title={owner.email}>
          ({owner.email})
        </span>
      </div>
    );
  };

  switch (tableId) {
    case 'users': {
      const isAdm = row.role === 'admin' || row.email === 'matysallanet@gmail.com';
      return (
        <>
          <td className="p-3.5 font-black text-ac-brown flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-ac-green/20 border border-ac-brown/30 flex items-center justify-center text-xs font-black">
              {row.username ? row.username.slice(0, 2).toUpperCase() : '🍃'}
            </div>
            <span>{row.username || row.displayName || 'Sans pseudo'}</span>
          </td>
          <td className="p-3.5 font-bold text-ac-brown-light">{row.email || 'Non renseigné'}</td>
          <td className="p-3.5">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
              isAdm ? 'bg-ac-orange/20 text-ac-orange border-ac-orange/40' : 'bg-ac-cream text-ac-brown border-ac-brown/20'
            }`}>
              {isAdm ? '🔑 Admin' : 'Habitant'}
            </span>
          </td>
          <td className="p-3.5 font-bold text-ac-brown-light capitalize">{row.themePreference || 'Défaut'}</td>
          <td className="p-3.5 font-mono text-[10px] text-ac-brown-light/70">{row.uid || row.id}</td>
        </>
      );
    }

    case 'accounts': {
      const solde = row.balance ?? row.currentBalance ?? row.initialBalance ?? 0;
      return (
        <>
          <td className="p-3.5 font-black text-ac-brown flex items-center gap-2">
            {row.color && (
              <span className="w-3 h-3 rounded-full border border-ac-brown/30 shrink-0" style={{ backgroundColor: row.color }} />
            )}
            <span>{row.name || 'Compte sans nom'}</span>
          </td>
          <td className="p-3.5 font-bold text-ac-brown-light">{row.bankName || '—'}</td>
          <td className="p-3.5 font-black text-ac-gold-dark">
            {solde.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
          </td>
          <td className="p-3.5">{renderOwnerBadge(row.creatorId || row.userId)}</td>
        </>
      );
    }

    case 'pockets': {
      const current = row.currentAmount !== undefined ? Number(row.currentAmount) : Number(row.allocatedAmount);
      const allocated = Number(row.allocatedAmount) || 0;
      return (
        <>
          <td className="p-3.5 font-black text-ac-brown flex items-center gap-2">
            {row.color && (
              <span className="w-3 h-3 rounded-full border border-ac-brown/30 shrink-0" style={{ backgroundColor: row.color }} />
            )}
            <span>{row.name || 'Poche sans nom'}</span>
          </td>
          <td className="p-3.5 font-black text-ac-brown">{(allocated ?? 0).toLocaleString('fr-FR')} 🔔</td>
          <td className="p-3.5 font-black text-ac-green">{(current ?? 0).toLocaleString('fr-FR')} 🔔</td>
          <td className="p-3.5 font-bold text-ac-brown-light text-[10px]">
            {row.renewalFrequency && row.renewalFrequency !== 'none' ? (
              <span className="capitalize">{row.renewalFrequency}</span>
            ) : (
              <span className="text-ac-brown-light/50">Manuel</span>
            )}
          </td>
          <td className="p-3.5">{renderOwnerBadge(row.userId || row.creatorId)}</td>
        </>
      );
    }

    case 'transactions': {
      const isCredit = row.type === 'credit';
      const formattedDate = row.date ? (row.date?.toDate ? row.date.toDate().toLocaleDateString('fr-FR') : String(row.date)) : '—';
      return (
        <>
          <td className="p-3.5 font-black text-ac-brown truncate max-w-[200px]" title={row.name || row.description}>
            {row.name || row.description || 'Transaction'}
          </td>
          <td className={`p-3.5 font-black ${isCredit ? 'text-ac-green' : 'text-ac-brown'}`}>
            {isCredit ? '+' : '-'}{(row.amount ?? 0).toLocaleString('fr-FR')} 🔔
          </td>
          <td className="p-3.5 font-bold">
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
              isCredit ? 'bg-ac-green-light text-ac-green border border-ac-green/30' : 'bg-ac-cream text-ac-brown border border-ac-brown/20'
            }`}>
              {row.type || 'débit'}
            </span>
          </td>
          <td className="p-3.5 font-bold text-ac-brown-light text-[11px]">{formattedDate}</td>
          <td className="p-3.5">{renderOwnerBadge(row.userId || row.creatorId)}</td>
        </>
      );
    }

    case 'wishlist': {
      return (
        <>
          <td className="p-3.5 font-black text-ac-brown">{row.title || row.name || 'Souhait'}</td>
          <td className="p-3.5 font-bold text-ac-brown-light italic">{row.description || row.note || '—'}</td>
          <td className="p-3.5">{renderOwnerBadge(row.creatorId || row.userId)}</td>
        </>
      );
    }

    case 'debts': {
      const isSettled = row.isSettled === true || row.status === 'settled';
      return (
        <>
          <td className="p-3.5 font-black text-ac-brown">{row.description || row.name || 'Dette'}</td>
          <td className="p-3.5 font-black text-ac-brown">{(row.amount ?? 0).toLocaleString('fr-FR')} 🔔</td>
          <td className="p-3.5 font-bold text-ac-brown-light">{row.person || row.debtorName || '—'}</td>
          <td className="p-3.5">
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
              isSettled ? 'bg-ac-green-light text-ac-green border-ac-green/30' : 'bg-ac-red-light text-ac-red border-ac-red/30'
            }`}>
              {isSettled ? 'Réglée' : 'En cours'}
            </span>
          </td>
          <td className="p-3.5">{renderOwnerBadge(row.creatorId || row.userId)}</td>
        </>
      );
    }

    case 'friendships': {
      const sender = getOwnerInfo(row.senderId);
      const receiver = getOwnerInfo(row.receiverId);
      const status = row.status || 'pending';
      return (
        <>
          <td className="p-3.5 font-bold text-ac-brown">
            <div className="flex flex-col">
              <span className="font-black">{row.senderName || sender.username}</span>
              <span className="text-[10px] text-ac-brown-light">{row.senderEmail || sender.email}</span>
            </div>
          </td>
          <td className="p-3.5 font-bold text-ac-brown">
            <div className="flex flex-col">
              <span className="font-black">{row.receiverName || receiver.username}</span>
              <span className="text-[10px] text-ac-brown-light">{row.receiverEmail || receiver.email}</span>
            </div>
          </td>
          <td className="p-3.5">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
              status === 'accepted' 
                ? 'bg-ac-green-light text-ac-green border-ac-green/30' 
                : status === 'declined' 
                ? 'bg-ac-red-light text-ac-red border-ac-red/30' 
                : 'bg-ac-gold-light text-ac-gold-dark border-ac-gold/30'
            }`}>
              {status === 'accepted' ? 'Acceptée' : status === 'declined' ? 'Refusée' : 'En attente'}
            </span>
          </td>
          <td className="p-3.5 font-bold text-ac-brown-light text-[11px]">
            {row.createdAt ? (row.createdAt?.toDate ? row.createdAt.toDate().toLocaleDateString('fr-FR') : String(row.createdAt)) : '—'}
          </td>
        </>
      );
    }

    default:
      return null;
  }
}

// --------------------------------------------------------------------------------------
// EDIT MODAL FORM FIELDS
// --------------------------------------------------------------------------------------

function renderEditFormFields(tableId, data, setData) {
  const handleChange = (field, value) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  switch (tableId) {
    case 'users':
      return (
        <>
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Pseudo de l'habitant</label>
            <input
              type="text"
              value={data.username || ''}
              onChange={(e) => handleChange('username', e.target.value)}
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Adresse E-mail</label>
            <input
              type="email"
              value={data.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Rôle</label>
            <select
              value={data.role || 'member'}
              onChange={(e) => handleChange('role', e.target.value)}
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white cursor-pointer"
            >
              <option value="member">Habitant (Membre standard)</option>
              <option value="admin">Administrateur (Maire)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Thème d'affichage</label>
            <select
              value={data.themePreference || 'default'}
              onChange={(e) => handleChange('themePreference', e.target.value)}
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white cursor-pointer"
            >
              <option value="default">Défaut (Vert prairie)</option>
              <option value="sky">Ciel azur</option>
              <option value="sunset">Crépuscule</option>
              <option value="cherry">Cerisier en fleurs</option>
              <option value="night">Nuit étoilée</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Note du tableau de bord</label>
            <textarea
              rows={2}
              value={data.dashboardNote || ''}
              onChange={(e) => handleChange('dashboardNote', e.target.value)}
              placeholder="Note personnelle ou mémo..."
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
            />
          </div>
        </>
      );

    case 'accounts':
      return (
        <>
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Nom du compte</label>
            <input
              type="text"
              value={data.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Banque</label>
            <input
              type="text"
              value={data.bankName || ''}
              onChange={(e) => handleChange('bankName', e.target.value)}
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1.5 flex items-center gap-1">
              <Palette className="w-3.5 h-3.5 text-ac-orange" /> Couleur d'arrière-plan du compte
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => handleChange('color', c.hex)}
                  className={`w-7 h-7 rounded-full border-2 border-ac-brown flex items-center justify-center transition-transform cursor-pointer shadow-xs ${
                    data.color === c.hex ? 'scale-115 ring-2 ring-ac-brown ring-offset-1' : 'hover:scale-105 opacity-80'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                >
                  {data.color === c.hex && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Description</label>
            <textarea
              rows={2}
              value={data.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
            />
          </div>
        </>
      );

    case 'pockets':
      return (
        <>
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Nom de la poche</label>
            <input
              type="text"
              value={data.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Montant alloué (🔔)</label>
              <input
                type="number"
                value={data.allocatedAmount || 0}
                onChange={(e) => handleChange('allocatedAmount', e.target.value)}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Montant restant (🔔)</label>
              <input
                type="number"
                value={data.currentAmount !== undefined ? data.currentAmount : data.allocatedAmount}
                onChange={(e) => handleChange('currentAmount', e.target.value)}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Fréquence de renouvellement</label>
              <select
                value={data.renewalFrequency || 'none'}
                onChange={(e) => handleChange('renewalFrequency', e.target.value)}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white cursor-pointer"
              >
                <option value="none">Sans renouvellement</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="monthly">Mensuel</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Jour de renouvellement</label>
              <input
                type="number"
                value={data.renewalDay || ''}
                onChange={(e) => handleChange('renewalDay', e.target.value)}
                placeholder="1-31"
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1.5 flex items-center gap-1">
              <Palette className="w-3.5 h-3.5 text-ac-orange" /> Couleur d'arrière-plan de la poche
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => handleChange('color', c.hex)}
                  className={`w-7 h-7 rounded-full border-2 border-ac-brown flex items-center justify-center transition-transform cursor-pointer shadow-xs ${
                    data.color === c.hex ? 'scale-115 ring-2 ring-ac-brown ring-offset-1' : 'hover:scale-105 opacity-80'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                >
                  {data.color === c.hex && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>
        </>
      );

    case 'transactions':
      return (
        <>
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Libellé / Nom de la transaction</label>
            <input
              type="text"
              value={data.name || data.description || ''}
              onChange={(e) => {
                handleChange('name', e.target.value);
                handleChange('description', e.target.value);
              }}
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Montant (🔔)</label>
              <input
                type="number"
                step="any"
                value={data.amount || 0}
                onChange={(e) => handleChange('amount', e.target.value)}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Type de flux</label>
              <select
                value={data.type || 'debit'}
                onChange={(e) => handleChange('type', e.target.value)}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white cursor-pointer"
              >
                <option value="debit">Débit (Dépense)</option>
                <option value="credit">Crédit (Revenu)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Date</label>
              <input
                type="date"
                value={data.date || ''}
                onChange={(e) => handleChange('date', e.target.value)}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Catégorie</label>
              <input
                type="text"
                value={data.category || ''}
                onChange={(e) => handleChange('category', e.target.value)}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
              />
            </div>
          </div>
        </>
      );

    case 'wishlist':
      return (
        <>
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Nom du souhait</label>
            <input
              type="text"
              value={data.title || data.name || ''}
              onChange={(e) => {
                handleChange('title', e.target.value);
                handleChange('name', e.target.value);
              }}
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Description / Note</label>
            <textarea
              rows={3}
              value={data.description || data.note || ''}
              onChange={(e) => {
                handleChange('description', e.target.value);
                handleChange('note', e.target.value);
              }}
              placeholder="Détails, liens ou note..."
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Lien URL (optionnel)</label>
            <input
              type="url"
              value={data.url || data.link || ''}
              onChange={(e) => {
                handleChange('url', e.target.value);
                handleChange('link', e.target.value);
              }}
              placeholder="https://..."
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
            />
          </div>
        </>
      );

    case 'debts':
      return (
        <>
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Libellé de la dette</label>
            <input
              type="text"
              value={data.description || data.name || ''}
              onChange={(e) => {
                handleChange('description', e.target.value);
                handleChange('name', e.target.value);
              }}
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Montant (🔔)</label>
              <input
                type="number"
                value={data.amount || 0}
                onChange={(e) => handleChange('amount', e.target.value)}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Personne concernée</label>
              <input
                type="text"
                value={data.person || data.debtorName || ''}
                onChange={(e) => {
                  handleChange('person', e.target.value);
                  handleChange('debtorName', e.target.value);
                }}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Type</label>
              <select
                value={data.type || 'i_owe'}
                onChange={(e) => handleChange('type', e.target.value)}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white cursor-pointer"
              >
                <option value="i_owe">Je dois de l'argent</option>
                <option value="they_owe">On me doit de l'argent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Statut</label>
              <select
                value={data.isSettled ? 'settled' : 'active'}
                onChange={(e) => {
                  const isSettled = e.target.value === 'settled';
                  handleChange('isSettled', isSettled);
                  handleChange('status', e.target.value);
                }}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white cursor-pointer"
              >
                <option value="active">En cours</option>
                <option value="settled">Réglée / Clôturée</option>
              </select>
            </div>
          </div>
        </>
      );

    case 'friendships':
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">E-mail Expéditeur</label>
              <input
                type="email"
                value={data.senderEmail || ''}
                onChange={(e) => handleChange('senderEmail', e.target.value)}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">E-mail Destinataire</label>
              <input
                type="email"
                value={data.receiverEmail || ''}
                onChange={(e) => handleChange('receiverEmail', e.target.value)}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Statut de la relation</label>
            <select
              value={data.status || 'pending'}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white cursor-pointer"
            >
              <option value="pending">En attente (Pending)</option>
              <option value="accepted">Acceptée (Accepted)</option>
              <option value="declined">Refusée (Declined)</option>
            </select>
          </div>
        </>
      );

    default:
      return null;
  }
}
