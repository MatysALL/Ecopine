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

  // Sorting state
  const [sortField, setSortField] = useState('username');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'

  // Fetch table data and set sensible sort defaults when activeSubTab changes
  useEffect(() => {
    if (activeSubTab === 'users') {
      setSortField('username');
      setSortOrder('asc');
      setTableData([]);
      return;
    }

    if (activeSubTab === 'accounts') {
      setSortField('balance');
      setSortOrder('desc');
    } else if (activeSubTab === 'transactions') {
      setSortField('date');
      setSortOrder('desc');
    } else if (activeSubTab === 'pockets') {
      setSortField('allocated');
      setSortOrder('desc');
    } else if (activeSubTab === 'categories') {
      setSortField('name');
      setSortOrder('asc');
    } else if (activeSubTab === 'debts') {
      setSortField('amount');
      setSortOrder('desc');
    } else if (activeSubTab === 'wishlist') {
      setSortField('price');
      setSortOrder('desc');
    } else if (activeSubTab === 'friendships') {
      setSortField('senderEmail');
      setSortOrder('asc');
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

      // Reset tutorial progress
      const userRef = doc(firestoreDb, 'users_meta', uid);
      const batchMeta = writeBatch(firestoreDb);
      batchMeta.update(userRef, {
        tutorialProgress: {
          isCompleted: false,
          steps: {
            accounts: false,
            calendar: false,
            debts: false,
            wishlist: false,
            home: false,
            settings: false
          }
        }
      });
      await batchMeta.commit();

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

  // Robust sorted Users list
  const sortedUsers = useMemo(() => {
    const list = [...allUsersMeta];
    return list.sort((a, b) => {
      let valA, valB;
      if (sortField === 'role') {
        valA = a.role || 'member';
        valB = b.role || 'member';
      } else if (sortField === 'email') {
        valA = a.email || '';
        valB = b.email || '';
      } else if (sortField === 'uid') {
        valA = a.uid || '';
        valB = b.uid || '';
      } else {
        valA = a.username || '';
        valB = b.username || '';
      }

      const cmp = valA.localeCompare(valB, 'fr', { sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [allUsersMeta, sortField, sortOrder]);

  // Robust sorted collection list
  const sortedTableData = useMemo(() => {
    const list = [...filteredTableData];
    const findUserName = (uid) => {
      const u = allUsersMeta.find(m => m.uid === uid);
      return u ? u.username : (uid || '');
    };

    return list.sort((a, b) => {
      let result = 0;
      
      // Numbers
      if (['balance', 'amount', 'allocated', 'spent', 'price'].includes(sortField)) {
        const numA = Number(a[sortField]) || 0;
        const numB = Number(b[sortField]) || 0;
        result = numA - numB;
      }
      // Dates
      else if (sortField === 'date') {
        const dateA = new Date(a.date || a.createdAt || 0).getTime();
        const dateB = new Date(b.date || b.createdAt || 0).getTime();
        result = dateA - dateB;
      }
      // Owner / User fields
      else if (['creatorId', 'userId', 'senderId', 'receiverId'].includes(sortField)) {
        const nameA = findUserName(a[sortField]) || '';
        const nameB = findUserName(b[sortField]) || '';
        result = nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
      }
      // General strings
      else {
        const strA = String(a[sortField] || a.name || a.description || a.title || a.id || '').trim();
        const strB = String(b[sortField] || b.name || b.description || b.title || b.id || '').trim();
        result = strA.localeCompare(strB, 'fr', { sensitivity: 'base' });
      }

      return sortOrder === 'asc' ? result : -result;
    });
  }, [filteredTableData, sortField, sortOrder, allUsersMeta]);

  // Handler for Desktop Header Click
  const handleHeaderSort = (fieldKey) => {
    if (sortField === fieldKey) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(fieldKey);
      if (['balance', 'amount', 'allocated', 'spent', 'price', 'date'].includes(fieldKey)) {
        setSortOrder('desc');
      } else {
        setSortOrder('asc');
      }
    }
  };

  const renderSortableTh = (fieldKey, labelText, extraClasses = "text-left") => {
    const isSorted = sortField === fieldKey;
    return (
      <th
        onClick={() => handleHeaderSort(fieldKey)}
        className={`p-3 text-xs font-black uppercase text-ac-brown hover:bg-ac-brown/10 cursor-pointer transition-colors select-none ${extraClasses}`}
        title={`Cliquer pour trier par ${labelText}`}
      >
        <div className="flex items-center gap-1">
          <span>{labelText}</span>
          {isSorted ? (
            <span className="text-xs font-bold text-ac-green">
              {sortOrder === 'asc' ? '⬆️' : '⬇️'}
            </span>
          ) : (
            <span className="text-[10px] text-ac-brown/30">↕️</span>
          )}
        </div>
      </th>
    );
  };

  const getMobileSortOptions = (tab) => {
    switch (tab) {
      case 'users':
        return [
          { value: 'username:asc', label: 'Pseudo : A ➔ Z' },
          { value: 'username:desc', label: 'Pseudo : Z ➔ A' },
          { value: 'email:asc', label: 'E-mail : A ➔ Z' },
          { value: 'email:desc', label: 'E-mail : Z ➔ A' },
          { value: 'role:asc', label: 'Rôle : Admin ➔ Membre' },
          { value: 'role:desc', label: 'Rôle : Membre ➔ Admin' }
        ];
      case 'accounts':
        return [
          { value: 'balance:desc', label: 'Solde : Max ➔ Min' },
          { value: 'balance:asc', label: 'Solde : Min ➔ Max' },
          { value: 'name:asc', label: 'Nom du compte : A ➔ Z' },
          { value: 'name:desc', label: 'Nom du compte : Z ➔ A' },
          { value: 'creatorId:asc', label: 'Propriétaire : A ➔ Z' },
          { value: 'type:asc', label: 'Type : A ➔ Z' }
        ];
      case 'transactions':
        return [
          { value: 'date:desc', label: 'Date : Récente ➔ Ancienne' },
          { value: 'date:asc', label: 'Date : Ancienne ➔ Récente' },
          { value: 'amount:desc', label: 'Montant : Max ➔ Min' },
          { value: 'amount:asc', label: 'Montant : Min ➔ Max' },
          { value: 'description:asc', label: 'Nom : A ➔ Z' },
          { value: 'userId:asc', label: 'Habitant : A ➔ Z' }
        ];
      case 'pockets':
        return [
          { value: 'allocated:desc', label: 'Montant alloué : Max ➔ Min' },
          { value: 'allocated:asc', label: 'Montant alloué : Min ➔ Max' },
          { value: 'spent:desc', label: 'Montant dépensé : Max ➔ Min' },
          { value: 'name:asc', label: 'Nom : A ➔ Z' },
          { value: 'userId:asc', label: 'Habitant : A ➔ Z' }
        ];
      case 'categories':
        return [
          { value: 'name:asc', label: 'Catégorie : A ➔ Z' },
          { value: 'name:desc', label: 'Catégorie : Z ➔ A' },
          { value: 'userId:asc', label: 'Habitant : A ➔ Z' }
        ];
      case 'debts':
        return [
          { value: 'amount:desc', label: 'Montant : Max ➔ Min' },
          { value: 'amount:asc', label: 'Montant : Min ➔ Max' },
          { value: 'description:asc', label: 'Libellé : A ➔ Z' },
          { value: 'date:desc', label: 'Date : Récente ➔ Ancienne' },
          { value: 'creatorId:asc', label: 'Créateur : A ➔ Z' }
        ];
      case 'wishlist':
        return [
          { value: 'price:desc', label: 'Prix : Max ➔ Min' },
          { value: 'price:asc', label: 'Prix : Min ➔ Max' },
          { value: 'title:asc', label: 'Titre : A ➔ Z' },
          { value: 'creatorId:asc', label: 'Créateur : A ➔ Z' }
        ];
      case 'friendships':
        return [
          { value: 'senderEmail:asc', label: 'Relation : A ➔ Z' },
          { value: 'status:asc', label: 'Statut : A ➔ Z' }
        ];
      default:
        return [];
    }
  };

  const renderTableHeaders = (tableId) => {
    switch (tableId) {
      case 'accounts':
        return (
          <>
            {renderSortableTh('id', 'ID')}
            {renderSortableTh('name', 'Nom')}
            {renderSortableTh('balance', 'Solde')}
            {renderSortableTh('currency', 'Devise')}
            {renderSortableTh('creatorId', 'Créateur')}
          </>
        );
      case 'transactions':
        return (
          <>
            {renderSortableTh('id', 'ID')}
            {renderSortableTh('description', 'Description')}
            {renderSortableTh('amount', 'Montant')}
            {renderSortableTh('date', 'Date')}
            {renderSortableTh('userId', 'Habitant')}
          </>
        );
      case 'pockets':
        return (
          <>
            {renderSortableTh('id', 'ID')}
            {renderSortableTh('name', 'Nom')}
            {renderSortableTh('allocated', 'Alloué')}
            {renderSortableTh('spent', 'Statut / Dépensé')}
            {renderSortableTh('userId', 'Habitant')}
          </>
        );
      case 'categories':
        return (
          <>
            {renderSortableTh('id', 'ID')}
            {renderSortableTh('name', 'Catégorie')}
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Couleur</th>
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">-</th>
            {renderSortableTh('userId', 'Habitant')}
          </>
        );
      case 'debts':
        return (
          <>
            {renderSortableTh('id', 'ID')}
            {renderSortableTh('description', 'Libellé')}
            {renderSortableTh('amount', 'Détails / Montant')}
            {renderSortableTh('date', 'Date')}
            {renderSortableTh('creatorId', 'Créateur')}
          </>
        );
      case 'wishlist':
        return (
          <>
            {renderSortableTh('id', 'ID')}
            {renderSortableTh('title', 'Titre')}
            {renderSortableTh('price', 'Prix')}
            <th className="p-3 text-left text-xs font-black uppercase text-ac-brown">Lien</th>
            {renderSortableTh('creatorId', 'Créateur')}
          </>
        );
      case 'friendships':
        return (
          <>
            {renderSortableTh('id', 'ID')}
            {renderSortableTh('senderEmail', 'Relation')}
            {renderSortableTh('status', 'Statut')}
            {renderSortableTh('senderId', 'Envoyeur')}
            {renderSortableTh('receiverId', 'Destinataire')}
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
    <div className="space-y-8 animate-fade-in text-ac-brown select-none pb-28">
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
      <div className="flex flex-nowrap overflow-x-auto gap-2 pb-2 border-b-2 border-ac-brown/10 scrollbar-none">
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
        <div className="ac-card p-4 md:p-6 bg-white border-ac-brown space-y-6">
          <div className="flex justify-between items-center pb-3 border-b-2 border-ac-brown/5">
            <h3 className="text-base font-black text-ac-brown flex items-center gap-2">
              🍃 Registre Général des Habitants ({sortedUsers.length})
            </h3>
          </div>

          {/* Mobile Sort Bar (< md) */}
          <div className="flex md:hidden items-center justify-between gap-2 p-3 bg-ac-cream/50 border-2 border-[#5C3A41] rounded-2xl">
            <label className="text-xs font-black text-[#5C3A41] flex items-center gap-1 shrink-0">
              ↕️ Tri :
            </label>
            <select
              value={`${sortField}:${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split(':');
                setSortField(field);
                setSortOrder(order);
              }}
              className="w-full bg-white border-2 border-[#5C3A41] rounded-xl px-3 py-1.5 text-xs font-bold text-[#5C3A41] shadow-sm focus:outline-none cursor-pointer"
            >
              {getMobileSortOptions('users').map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block overflow-x-auto shadow-inner rounded-2xl border-2 border-ac-brown bg-ac-cream/20">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-ac-brown/15 bg-ac-cream-dark/30 text-left">
                  <th className="p-3 text-xs font-black uppercase text-ac-brown">Avatar</th>
                  {renderSortableTh('username', 'Habitant')}
                  {renderSortableTh('email', 'E-mail')}
                  {renderSortableTh('role', 'Rôle')}
                  {renderSortableTh('uid', 'UID')}
                  <th className="p-3 text-center text-xs font-black uppercase text-ac-brown">Actions de Maintenance</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map(u => (
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

          {/* Mobile Cards View (< md) */}
          <div className="block md:hidden space-y-3">
            {sortedUsers.map(u => (
              <div key={u.uid} className="bg-ac-cream/40 border-2 border-ac-brown rounded-2xl p-4 space-y-3 shadow-ac-xs">
                {/* Header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full border border-ac-brown/25 overflow-hidden flex items-center justify-center shrink-0 bg-ac-cream-dark shadow-ac-xs">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="Pfp" className="w-full h-full object-cover object-center block" />
                      ) : (
                        <span className="text-sm font-bold text-ac-brown">🍃</span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-ac-brown">{u.username || 'Sans nom'}</h4>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase mt-0.5 ${
                        u.role === 'admin' 
                          ? 'bg-[#E57373] text-white border border-[#E57373]/20 shadow-xs' 
                          : 'bg-ac-sky-light text-ac-sky border border-ac-sky/20'
                      }`}>
                        {u.role || 'member'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="space-y-1 bg-white p-3 rounded-xl border border-ac-brown/15 text-xs">
                  <div className="font-semibold text-ac-brown break-all">
                    <span className="text-[10px] font-black uppercase text-ac-brown-light block mb-0.5">E-mail</span>
                    {u.email}
                  </div>
                  <div className="pt-2 border-t border-ac-brown/10">
                    <span className="text-[10px] font-black uppercase text-ac-brown-light block mb-0.5">UID Firebase</span>
                    <span className="font-mono text-[10px] text-ac-brown-light select-all break-all">{u.uid}</span>
                  </div>
                </div>

                {/* Footer / Actions */}
                <div className="pt-1">
                  {isTargetAdmin(u) ? (
                    <div className="w-full text-[10px] font-black text-ac-green bg-ac-green-light border border-ac-green/30 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-ac-xs">
                      🛡️ Compte Protégé (Admin)
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleResetUser(u.uid, u.username)}
                        className="w-full py-2 px-3 rounded-xl bg-ac-orange hover:bg-ac-orange/90 text-white font-black text-xs border-2 border-ac-brown shadow-ac-xs active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Réinitialiser
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.uid, u.username)}
                        className="w-full py-2 px-3 rounded-xl bg-ac-red hover:bg-ac-red/90 text-white font-black text-xs border-2 border-ac-brown shadow-ac-xs active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Supprimer
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. COLLECTION DATA MONITOR SECTION */}
      {activeSubTab !== 'users' && (
        <div className="ac-card p-4 md:p-6 bg-white border-ac-brown space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b-2 border-ac-brown/5">
            <h3 className="text-base font-black text-ac-brown flex items-center gap-2">
              📂 Monitoring de la Table : <span className="underline">{activeSubTab}</span> ({sortedTableData.length} documents)
            </h3>

            {/* Filter by User */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs font-extrabold text-ac-brown-light shrink-0">Habitant :</label>
              <select
                value={selectedUserFilter}
                onChange={(e) => setSelectedUserFilter(e.target.value)}
                className="bg-white border-2 border-ac-brown rounded-xl px-2 py-1 text-xs font-bold focus:outline-none cursor-pointer w-full sm:w-auto"
              >
                <option value="all">Tous les habitants</option>
                {allUsersMeta.map(u => (
                  <option key={u.uid} value={u.uid}>{u.username} ({u.email})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mobile Sort Bar (< md) */}
          <div className="flex md:hidden items-center justify-between gap-2 p-3 bg-ac-cream/50 border-2 border-[#5C3A41] rounded-2xl">
            <label className="text-xs font-black text-[#5C3A41] flex items-center gap-1 shrink-0">
              ↕️ Tri :
            </label>
            <select
              value={`${sortField}:${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split(':');
                setSortField(field);
                setSortOrder(order);
              }}
              className="w-full bg-white border-2 border-[#5C3A41] rounded-xl px-3 py-1.5 text-xs font-bold text-[#5C3A41] shadow-sm focus:outline-none cursor-pointer"
            >
              {getMobileSortOptions(activeSubTab).map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {loadingTable ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <div className="animate-spin w-8 h-8 border-3 border-ac-green border-t-transparent rounded-full"></div>
              <p className="text-xs font-bold text-ac-brown-light">Chargement de la collection...</p>
            </div>
          ) : sortedTableData.length === 0 ? (
            <div className="py-12 text-center bg-ac-cream/45 border-2 border-dashed border-ac-brown/15 rounded-2xl">
              <p className="text-xs font-black text-ac-brown">Aucune ligne trouvée dans cette table</p>
              <p className="text-[10px] text-ac-brown-light/75 mt-0.5">Aucun document ne correspond aux filtres.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto shadow-inner rounded-2xl border-2 border-ac-brown bg-ac-cream/20">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-ac-brown/15 bg-ac-cream-dark/30 text-left">
                      {renderTableHeaders(activeSubTab)}
                      <th className="p-3 text-center text-xs font-black uppercase text-ac-brown">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTableData.map(row => (
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

              {/* Mobile Cards View (< md) */}
              <div className="block md:hidden space-y-3">
                {sortedTableData.map(row => {
                  const findUserName = (uid) => {
                    const u = allUsersMeta.find(m => m.uid === uid);
                    return u ? u.username : uid?.slice(0, 8);
                  };

                  return (
                    <div key={row.id} className="bg-ac-cream/40 border-2 border-ac-brown rounded-2xl p-4 space-y-3 shadow-ac-xs text-xs">
                      <div className="flex justify-between items-start gap-2 border-b border-ac-brown/10 pb-2">
                        <div>
                          <span className="font-mono text-[10px] text-ac-brown-light bg-white border border-ac-brown/20 px-1.5 py-0.5 rounded font-bold">
                            ID: {row.id?.slice(0, 8)}...
                          </span>
                          <h4 className="font-black text-sm text-ac-brown mt-1">
                            {row.name || row.description || row.title || (row.senderEmail ? `${row.senderEmail} ➔ ${row.receiverEmail}` : 'Document')}
                          </h4>
                        </div>
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          className="bg-white hover:bg-ac-red-light border-2 border-ac-brown text-ac-red p-2 rounded-xl cursor-pointer shadow-ac-xs active:translate-y-0.5 transition-all"
                          title="Supprimer la ligne"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Content details depending on collection */}
                      <div className="space-y-1 text-ac-brown">
                        {activeSubTab === 'accounts' && (
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-ac-gold text-sm">{row.balance} 💰 ({row.currency || 'EUR'})</span>
                            <span className="text-[10px] font-black bg-white px-2 py-0.5 rounded-full border border-ac-brown/15">
                              Créateur: {findUserName(row.creatorId)}
                            </span>
                          </div>
                        )}
                        {activeSubTab === 'transactions' && (
                          <div className="flex justify-between items-center">
                            <span className={`font-bold text-sm ${row.type === 'expense' ? 'text-ac-red' : 'text-ac-green'}`}>
                              {row.type === 'expense' ? '-' : '+'}{row.amount}
                            </span>
                            <div className="text-right">
                              <span className="text-[10px] text-ac-brown-light block">{row.date}</span>
                              <span className="text-[10px] font-black text-ac-brown">Habitant: {findUserName(row.userId)}</span>
                            </div>
                          </div>
                        )}
                        {activeSubTab === 'pockets' && (
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-ac-green text-sm">{row.allocated} 💰 (Dépensé: {row.spent || 0})</span>
                            <span className="text-[10px] font-black text-ac-brown">Habitant: {findUserName(row.userId)}</span>
                          </div>
                        )}
                        {activeSubTab === 'categories' && (
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{row.emoji}</span>
                              <span className="w-4 h-4 rounded-full border border-ac-brown/20" style={{ backgroundColor: row.color }}></span>
                            </div>
                            <span className="text-[10px] font-black text-ac-brown">Habitant: {findUserName(row.userId)}</span>
                          </div>
                        )}
                        {activeSubTab === 'debts' && (
                          <div className="flex justify-between items-center">
                            <span className={`font-bold ${row.type === 'owed' ? 'text-ac-green' : 'text-ac-red'}`}>
                              {row.type === 'owed' ? 'Dû par' : 'Dû à'} {row.person} : {row.amount}
                            </span>
                            <span className="text-[10px] font-black text-ac-brown">Créateur: {findUserName(row.creatorId)}</span>
                          </div>
                        )}
                        {activeSubTab === 'wishlist' && (
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-ac-gold">{row.price}</span>
                            <span className="text-[10px] font-black text-ac-brown">Créateur: {findUserName(row.creatorId)}</span>
                          </div>
                        )}
                        {activeSubTab === 'friendships' && (
                          <div className="flex justify-between items-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              row.status === 'accepted' ? 'bg-ac-green-light text-ac-green border border-ac-green/20' : 'bg-ac-gold-light text-ac-gold-dark border border-ac-gold/20'
                            }`}>
                              Statut: {row.status}
                            </span>
                            <span className="text-[10px] font-black text-ac-brown">Envoyeur: {findUserName(row.senderId)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}


