import React, { useState, useEffect, useMemo } from 'react';
import { useDb } from '../db';
import { db as firestoreDb } from '../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  deleteDoc, 
  writeBatch, 
  query, 
  where 
} from 'firebase/firestore';
import { 
  Users, 
  Database, 
  Trash2, 
  RefreshCw, 
  AlertTriangle, 
  CreditCard, 
  Tags, 
  Handshake, 
  Gift, 
  UserPlus, 
  Settings2,
  FolderOpen
} from 'lucide-react';

const TABLES = [
  { id: 'accounts', name: 'Comptes', icon: CreditCard, ownerField: 'creatorId' },
  { id: 'transactions', name: 'Transactions', icon: Database, ownerField: 'userId' },
  { id: 'pockets', name: 'Poches', icon: FolderOpen, ownerField: 'userId' },
  { id: 'categories', name: 'Catégories', icon: Tags, ownerField: 'userId' },
  { id: 'debts', name: 'Dettes', icon: Handshake, ownerField: 'creatorId' },
  { id: 'wishlist', name: 'Souhaits', icon: Gift, ownerField: 'creatorId' },
  { id: 'friendships', name: 'Amitiés', icon: UserPlus, ownerField: 'senderId' }
];

export default function AdminView() {
  const { allUsersMeta = [] } = useDb();
  const [activeSubTab, setActiveSubTab] = useState('users'); // 'users' or a collection ID
  const [tableData, setTableData] = useState([]);
  const [loadingTable, setLoadingTable] = useState(false);
  const [selectedUserFilter, setSelectedUserFilter] = useState('all');

  // Fetch table data when activeSubTab changes
  useEffect(() => {
    if (activeSubTab === 'users') {
      setTableData([]);
      return;
    }

    const loadData = async () => {
      setLoadingTable(true);
      try {
        const snap = await getDocs(collection(firestoreDb, activeSubTab));
        const list = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        setTableData(list);
      } catch (err) {
        console.error("Error loading table data:", err);
      } finally {
        setLoadingTable(false);
      }
    };

    loadData();
  }, [activeSubTab]);

  const handleDeleteRow = async (rowId) => {
    if (!window.confirm("Es-tu sûr de vouloir supprimer définitivement cette ligne dans Firestore ?")) return;

    try {
      await deleteDoc(doc(firestoreDb, activeSubTab, rowId));
      setTableData(prev => prev.filter(r => r.id !== rowId));
    } catch (err) {
      console.error("Error deleting document:", err);
      alert("Erreur lors de la suppression du document.");
    }
  };

  const isTargetAdmin = (user) => user?.email === 'matysallanet@gmail.com' || user?.role === 'admin';

  const handleResetUser = async (uid, username) => {
    const targetUser = allUsersMeta.find(u => u.uid === uid);
    if (isTargetAdmin(targetUser)) {
      alert("Impossible de réinitialiser ou supprimer un compte administrateur !");
      return;
    }

    if (!window.confirm(`Es-tu sûr de vouloir RÉINITIALISER le compte de ${username} ? Cela supprimera toutes ses transactions, poches, dettes et souhaits associés.`)) return;

    try {
      const collectionsToPurge = [
        { name: 'transactions', ownerField: 'userId' },
        { name: 'pockets', ownerField: 'userId' },
        { name: 'debts', ownerField: 'creatorId' },
        { name: 'wishlist', ownerField: 'creatorId' }
      ];

      for (const col of collectionsToPurge) {
        const q = query(collection(firestoreDb, col.name), where(col.ownerField, '==', uid));
        const snap = await getDocs(q);
        const batch = writeBatch(firestoreDb);
        snap.docs.forEach(docSnap => batch.delete(doc(firestoreDb, col.name, docSnap.id)));
        await batch.commit();
      }

      alert(`Le compte de ${username} a été réinitialisé avec succès !`);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la réinitialisation du compte.");
    }
  };

  const handleDeleteUser = async (uid, username) => {
    const targetUser = allUsersMeta.find(u => u.uid === uid);
    if (isTargetAdmin(targetUser)) {
      alert("Impossible de réinitialiser ou supprimer un compte administrateur !");
      return;
    }

    if (!window.confirm(`⚠️ ATTENTION ⚠️\nEs-tu sûr de vouloir SUPPRIMER DÉFINITIVEMENT ${username} ? Cela supprimera toutes ses données dans la base (y compris ses comptes, catégories, amitiés et son profil de la mairie).`)) return;

    try {
      const collectionsToPurge = [
        { name: 'transactions', ownerField: 'userId' },
        { name: 'pockets', ownerField: 'userId' },
        { name: 'categories', ownerField: 'userId' },
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
      const snap1 = await getDocs(f1);
      const snap2 = await getDocs(f2);

      const batchFriendships = writeBatch(firestoreDb);
      snap1.docs.forEach(docSnap => batchFriendships.delete(doc(firestoreDb, 'friendships', docSnap.id)));
      snap2.docs.forEach(docSnap => batchFriendships.delete(doc(firestoreDb, 'friendships', docSnap.id)));
      await batchFriendships.commit();

      // Delete users_meta
      await deleteDoc(doc(firestoreDb, 'users_meta', uid));

      alert(`L'habitant ${username} a été supprimé d'Ecopine !`);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression de l'habitant.");
    }
  };

  const filteredTableData = useMemo(() => {
    if (selectedUserFilter === 'all') return tableData;

    return tableData.filter(row => {
      if (activeSubTab === 'transactions' || activeSubTab === 'pockets' || activeSubTab === 'categories') {
        return row.userId === selectedUserFilter;
      }
      if (activeSubTab === 'accounts' || activeSubTab === 'debts' || activeSubTab === 'wishlist') {
        return row.creatorId === selectedUserFilter;
      }
      if (activeSubTab === 'friendships') {
        return row.senderId === selectedUserFilter || row.receiverId === selectedUserFilter;
      }
      return true;
    });
  }, [tableData, selectedUserFilter, activeSubTab]);

  const renderTableHeaders = (tableId) => {
    switch (tableId) {
      case 'accounts':
        return (
          <>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">ID</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Nom</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Solde</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Devise</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Créateur</th>
          </>
        );
      case 'transactions':
        return (
          <>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">ID</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Description</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Montant</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Date</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Habitant</th>
          </>
        );
      case 'pockets':
        return (
          <>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">ID</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Nom</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Alloué</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Statut</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Habitant</th>
          </>
        );
      case 'categories':
        return (
          <>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">ID</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Catégorie</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Couleur</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">-</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Habitant</th>
          </>
        );
      case 'debts':
        return (
          <>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">ID</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Libellé</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Détails</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Date</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Créateur</th>
          </>
        );
      case 'wishlist':
        return (
          <>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">ID</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Titre</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Prix</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Lien</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Créateur</th>
          </>
        );
      case 'friendships':
        return (
          <>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">ID</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Relation (Emails)</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Statut</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Envoyeur</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Destinataire</th>
          </>
        );
      default:
        return null;
    }
  };

  const renderRowCells = (row, tableId, usersList) => {
    const findUserName = (uid) => {
      const u = usersList.find(m => m.uid === uid);
      return u ? u.username : uid?.slice(0, 8);
    };

    switch (tableId) {
      case 'accounts':
        return (
          <>
            <td className="p-3 text-xs font-mono break-all text-ac-brown">{row.id?.slice(0, 8)}...</td>
            <td className="p-3 text-xs font-bold text-ac-brown">{row.name}</td>
            <td className="p-3 text-xs font-bold text-ac-gold">{row.balance} 💰</td>
            <td className="p-3 text-xs opacity-75 text-ac-brown">{row.currency || 'EUR'}</td>
            <td className="p-3 text-xs font-bold text-ac-brown">{findUserName(row.creatorId)}</td>
          </>
        );
      case 'transactions':
        return (
          <>
            <td className="p-3 text-xs font-mono break-all text-ac-brown">{row.id?.slice(0, 8)}...</td>
            <td className="p-3 text-xs font-bold text-ac-brown">{row.description}</td>
            <td className={`p-3 text-xs font-bold ${row.type === 'expense' ? 'text-ac-red' : 'text-ac-green'}`}>
              {row.type === 'expense' ? '-' : '+'}{row.amount}
            </td>
            <td className="p-3 text-xs opacity-75 text-ac-brown">{row.date}</td>
            <td className="p-3 text-xs font-bold text-ac-brown">{findUserName(row.userId)}</td>
          </>
        );
      case 'pockets':
        return (
          <>
            <td className="p-3 text-xs font-mono break-all text-ac-brown">{row.id?.slice(0, 8)}...</td>
            <td className="p-3 text-xs font-bold text-ac-brown">{row.name}</td>
            <td className="p-3 text-xs font-bold text-ac-green">{row.allocated} 💰</td>
            <td className="p-3 text-xs opacity-75 text-ac-brown">Dépensé : {row.spent || 0}</td>
            <td className="p-3 text-xs font-bold text-ac-brown">{findUserName(row.userId)}</td>
          </>
        );
      case 'categories':
        return (
          <>
            <td className="p-3 text-xs font-mono break-all text-ac-brown">{row.id?.slice(0, 8)}...</td>
            <td className="p-3 text-xs font-bold flex items-center gap-1.5 text-ac-brown">
              <span className="text-sm">{row.emoji}</span>
              <span>{row.name}</span>
            </td>
            <td className="p-3 text-xs">
              <span className="w-4 h-4 rounded-full inline-block border border-ac-brown/20 shadow-ac-xs" style={{ backgroundColor: row.color }}></span>
            </td>
            <td className="p-3 text-xs font-bold text-ac-brown">-</td>
            <td className="p-3 text-xs font-bold text-ac-brown">{findUserName(row.userId)}</td>
          </>
        );
      case 'debts':
        return (
          <>
            <td className="p-3 text-xs font-mono break-all text-ac-brown">{row.id?.slice(0, 8)}...</td>
            <td className="p-3 text-xs font-bold text-ac-brown">{row.description || 'Dette'}</td>
            <td className={`p-3 text-xs font-bold ${row.type === 'owed' ? 'text-ac-green' : 'text-ac-red'}`}>
              {row.type === 'owed' ? 'Dû par' : 'Dû à'} {row.person} : {row.amount}
            </td>
            <td className="p-3 text-xs opacity-75 text-ac-brown">{row.date}</td>
            <td className="p-3 text-xs font-bold text-ac-brown">{findUserName(row.creatorId)}</td>
          </>
        );
      case 'wishlist':
        return (
          <>
            <td className="p-3 text-xs font-mono break-all text-ac-brown">{row.id?.slice(0, 8)}...</td>
            <td className="p-3 text-xs font-bold text-ac-brown">{row.title}</td>
            <td className="p-3 text-xs font-bold text-ac-gold">{row.price}</td>
            <td className="p-3 text-xs text-ac-sky truncate max-w-[120px]">{row.link || '-'}</td>
            <td className="p-3 text-xs font-bold text-ac-brown">{findUserName(row.creatorId)}</td>
          </>
        );
      case 'friendships':
        return (
          <>
            <td className="p-3 text-xs font-mono break-all text-ac-brown">{row.id?.slice(0, 8)}...</td>
            <td className="p-3 text-xs font-semibold text-ac-brown">{row.senderEmail} ➔ {row.receiverEmail}</td>
            <td className="p-3 text-xs font-bold">
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                row.status === 'accepted' ? 'bg-ac-green-light text-ac-green border border-ac-green/20' : 'bg-ac-gold-light text-ac-gold-dark border border-ac-gold/20'
              }`}>
                {row.status}
              </span>
            </td>
            <td className="p-3 text-xs font-bold text-ac-brown">{findUserName(row.senderId)}</td>
            <td className="p-3 text-xs font-bold text-ac-brown">{findUserName(row.receiverId)}</td>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-ac-brown select-none pb-8">
      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-ac-brown flex items-center gap-2">
            🏛️ Bureau d'Administration d'Ecopine
          </h2>
          <p className="text-xs font-semibold text-ac-brown-light leading-relaxed mt-1">
            Mairie, monitoring en direct des tables Firestore, et maintenance de la base de données.
          </p>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex gap-2 pb-2 overflow-x-auto border-b-2 border-ac-brown/10 scrollbar-thin">
        <button
          onClick={() => setActiveSubTab('users')}
          className={`px-4 py-2.5 rounded-2xl border-2 font-black text-xs transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'users'
              ? 'bg-ac-brown text-white border-ac-brown shadow-ac-xs translate-y-0.5'
              : 'bg-white text-ac-brown border-ac-brown hover:bg-ac-cream-dark'
          }`}
        >
          <Users className="w-4 h-4" /> Habitants
        </button>

        {TABLES.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id)}
              className={`px-4 py-2.5 rounded-2xl border-2 font-black text-xs transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === t.id
                  ? 'bg-ac-green text-white border-ac-brown shadow-ac-xs translate-y-0.5'
                  : 'bg-white text-ac-brown border-ac-brown hover:bg-ac-cream-dark'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.name}
            </button>
          );
        })}
      </div>

      {/* 1. USERS MONITORS SECTION */}
      {activeSubTab === 'users' && (
        <div className="ac-card p-6 bg-white border-ac-brown space-y-6">
          <div className="flex justify-between items-center pb-3 border-b-2 border-ac-brown/5">
            <h3 className="text-base font-black text-ac-brown flex items-center gap-2">
              🍃 Registre Général des Habitants ({allUsersMeta.length})
            </h3>
          </div>

          <div className="overflow-x-auto rounded-2xl border-2 border-ac-brown bg-ac-cream/20">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-ac-brown/15 bg-ac-cream-dark/30 text-left">
                  <th className="p-3 text-xs font-black uppercase text-ac-brown">Avatar</th>
                  <th className="p-3 text-xs font-black uppercase text-ac-brown">Habitant</th>
                  <th className="p-3 text-xs font-black uppercase text-ac-brown">E-mail</th>
                  <th className="p-3 text-xs font-black uppercase text-ac-brown">Rôle</th>
                  <th className="p-3 text-xs font-black uppercase text-ac-brown">UID</th>
                  <th className="p-3 text-center text-xs font-black uppercase text-ac-brown">Actions de Maintenance</th>
                </tr>
              </thead>
              <tbody>
                {allUsersMeta.map(u => (
                  <tr key={u.uid} className="border-b border-ac-brown/10 hover:bg-ac-cream-dark/15 transition-colors">
                    <td className="p-3">
                      <div className="w-8 h-8 rounded-full border border-ac-brown/25 overflow-hidden flex items-center justify-center shrink-0 bg-ac-cream-dark">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt="Pfp" className="w-full h-full object-cover object-center block" />
                        ) : (
                          <span className="text-xs font-bold text-ac-brown">🍃</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-xs font-black text-ac-brown">{u.username || 'Sans nom'}</td>
                    <td className="p-3 text-xs text-ac-brown/85">{u.email}</td>
                    <td className="p-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        u.role === 'admin' 
                          ? 'bg-[#E57373] text-white border border-[#E57373]/20 shadow-xs' 
                          : 'bg-ac-cream-dark text-ac-brown border border-ac-brown/20'
                      }`}>
                        {u.role || 'member'}
                      </span>
                    </td>
                    <td className="p-3 text-xs font-mono opacity-85 text-ac-brown select-all break-all">{u.uid}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        {isTargetAdmin(u) ? (
                          <span className="text-[10px] font-black text-ac-green bg-ac-green-light border border-ac-green/30 px-3 py-1.5 rounded-full flex items-center justify-center gap-1 shadow-ac-xs">
                            🛡️ Compte Protégé (Admin)
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleResetUser(u.uid, u.username)}
                              className="px-2.5 py-1 rounded-xl bg-ac-orange text-white border-2 border-ac-brown font-extrabold text-[10px] shadow-ac-xs hover:translate-y-[-1px] active:translate-y-0.5 cursor-pointer flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" /> Réinitialiser
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.uid, u.username)}
                              className="px-2.5 py-1 rounded-xl bg-ac-red text-white border-2 border-ac-brown font-extrabold text-[10px] shadow-ac-xs hover:translate-y-[-1px] active:translate-y-0.5 cursor-pointer flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> Supprimer
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. COLLECTION DATA MONITOR SECTION */}
      {activeSubTab !== 'users' && (
        <div className="ac-card p-6 bg-white border-ac-brown space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b-2 border-ac-brown/5">
            <h3 className="text-base font-black text-ac-brown flex items-center gap-2">
              📂 Monitoring de la Table : <span className="underline">{activeSubTab}</span> ({filteredTableData.length} documents)
            </h3>

            {/* Filter by User */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-extrabold text-ac-brown-light">Habitant :</label>
              <select
                value={selectedUserFilter}
                onChange={(e) => setSelectedUserFilter(e.target.value)}
                className="bg-white border-2 border-ac-brown rounded-xl px-2 py-1 text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="all">Tous les habitants</option>
                {allUsersMeta.map(u => (
                  <option key={u.uid} value={u.uid}>{u.username} ({u.email})</option>
                ))}
              </select>
            </div>
          </div>

          {loadingTable ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <div className="animate-spin w-8 h-8 border-3 border-ac-green border-t-transparent rounded-full"></div>
              <p className="text-xs font-bold text-ac-brown-light">Chargement de la collection...</p>
            </div>
          ) : filteredTableData.length === 0 ? (
            <div className="py-12 text-center bg-ac-cream/45 border-2 border-dashed border-ac-brown/15 rounded-2xl">
              <p className="text-xs font-black text-ac-brown">Aucune ligne trouvée dans cette table</p>
              <p className="text-[10px] text-ac-brown-light/75 mt-0.5">Aucun document ne correspond aux filtres.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border-2 border-ac-brown bg-ac-cream/20">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-ac-brown/15 bg-ac-cream-dark/30 text-left">
                    {renderTableHeaders(activeSubTab)}
                    <th className="p-3 text-center text-xs font-black uppercase text-ac-brown">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTableData.map(row => (
                    <tr key={row.id} className="border-b border-ac-brown/10 hover:bg-ac-cream-dark/15 transition-colors">
                      {renderRowCells(row, activeSubTab, allUsersMeta)}
                      <td className="p-3">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => handleDeleteRow(row.id)}
                            className="bg-white hover:bg-ac-red-light border border-ac-brown/25 hover:border-ac-red/20 text-ac-brown-light hover:text-ac-red p-1.5 rounded-lg cursor-pointer transition-colors"
                            title="Supprimer la ligne"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
