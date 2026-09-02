import React, { useState, useMemo, useRef, useEffect } from 'react';
import { db, useDb, COLOR_PALETTE, getCustomCardStyle, resolveColorHex, getExecutionBadgeInfo, getActiveOrFavoriteAccount } from '../db';
import { 
  collection, doc, setDoc, deleteDoc, query, where, onSnapshot, getDocs, writeBatch 
} from 'firebase/firestore';
import { auth, db as firestoreDb } from '../firebase';
import { 
  Plus, Edit, Trash2, ArrowLeft, Upload, FileText, CheckCircle, 
  Coins, PiggyBank, AlertTriangle, 
  Sparkles, FileSpreadsheet, ArrowRightLeft, X, Star,
  Palette, Check, Calendar
} from 'lucide-react';
import TransactionModal from './TransactionModal';
import PocketManager from './PocketManager';

export default function AccountsView({ 
  selectedAccountId, 
  setSelectedAccountId, 
  setActiveTab, 
  setCurrentView, 
  onNavigate 
}) {
  // Account Form states
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [accName, setAccName] = useState('');
  const [accBankName, setAccBankName] = useState('');
  const [accDescription, setAccDescription] = useState('');
  const [accColor, setAccColor] = useState('#6CBAD8');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Transaction Modal state
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [preselectedBudgetId, setPreselectedBudgetId] = useState(null);

  // Transfer Modal state
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferSourceId, setTransferSourceId] = useState('');
  const [transferDestId, setTransferDestId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDesc, setTransferDesc] = useState('');

  // CSV Dropzone state
  const [selectedCsvFile, setSelectedCsvFile] = useState(null);
  const [csvPreviewTxs, setCsvPreviewTxs] = useState(null);
  const [csvError, setCsvError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [accountImports, setAccountImports] = useState([]);
  const [importsLoading, setImportsLoading] = useState(false);

  const { accountsData, transactions: allTransactions, pockets: allPockets, user, username, usersMetaDoc, userMeta, projects = [] } = useDb();
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    if (accountsData) {
      setAccounts(accountsData);
    }
  }, [accountsData]);

  // 1. Separation of personal accounts (reorderable by Drag & Drop) & project accounts
  const personalAccounts = useMemo(() => {
    if (!accounts) return [];
    return [...accounts]
      .filter(acc => !acc.projectId)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }, [accounts]);

  const sortedProjectAccounts = useMemo(() => {
    if (!accounts) return [];
    return [...accounts]
      .filter(acc => acc.projectId != null)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }, [accounts]);

  // Favorite account calculation
  const storedFavoriteId = useMemo(() => {
    return usersMetaDoc?.favoriteAccountId || userMeta?.find(m => m.key === 'favorite_account_id')?.value || null;
  }, [usersMetaDoc, userMeta]);

  // Résolution stricte : cherche le favori explicite si défini et valide, sinon prend strictement le premier de la liste (index 0)
  const activeFavoriteAccount = useMemo(() => {
    const explicitFavorite = personalAccounts.find(acc => acc.id === storedFavoriteId);
    return explicitFavorite || personalAccounts[0] || null;
  }, [personalAccounts, storedFavoriteId]);

  // Auto-attribution dans Firestore si aucun favori valide n'est défini
  useEffect(() => {
    if (!user?.uid || personalAccounts.length === 0) return;

    const hasValidFavorite = personalAccounts.some(acc => acc.id === storedFavoriteId);

    if (!hasValidFavorite && personalAccounts[0]?.id) {
      const defaultFavId = personalAccounts[0].id;
      db.user_meta.put({ key: 'favorite_account_id', value: defaultFavId })
        .catch(err => console.error("Erreur mise à jour favori par défaut :", err));
    }
  }, [personalAccounts, storedFavoriteId, user?.uid]);

  const handleToggleFavorite = async (e, accId) => {
    e.stopPropagation();
    try {
      await db.user_meta.put({ key: 'favorite_account_id', value: accId });
    } catch (err) {
      console.error("Erreur lors de la définition du compte favori :", err);
    }
  };

  const handleOpenCalendar = () => {
    if (typeof setCurrentView === 'function') setCurrentView('calendar');
    else if (typeof setActiveTab === 'function') setActiveTab('calendar');
    else if (typeof onNavigate === 'function') onNavigate('calendar');
  };

  // Drag & Drop states for Personal Accounts
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnter = (e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // 1. Réorganisation optimiste locale sur les comptes personnels uniquement
    const reordered = [...personalAccounts];
    const [movedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(dragOverIndex, 0, movedItem);

    // Mise à jour immédiate de l'affichage local en préservant les comptes de projets
    setAccounts(prev => {
      const projectAccs = (prev || []).filter(a => a.projectId);
      return [...reordered, ...projectAccs];
    });

    setDraggedIndex(null);
    setDragOverIndex(null);

    // 2. Persistance dans Firestore (Batch Write)
    try {
      const batch = writeBatch(firestoreDb);
      reordered.forEach((acc, index) => {
        const accRef = doc(firestoreDb, "accounts", acc.id);
        batch.update(accRef, { order: index });
      });
      await batch.commit();
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de l'ordre des comptes personnels :", error);
    }
  };

  // Drag & Drop states for Shared Project Accounts
  const [draggedProjIndex, setDraggedProjIndex] = useState(null);
  const [dragOverProjIndex, setDragOverProjIndex] = useState(null);

  const handleProjectDragStart = (e, index) => {
    setDraggedProjIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleProjectDragEnter = (e, index) => {
    e.preventDefault();
    setDragOverProjIndex(index);
  };

  const handleProjectDragEnd = async () => {
    if (
      draggedProjIndex === null || 
      dragOverProjIndex === null || 
      draggedProjIndex === dragOverProjIndex
    ) {
      setDraggedProjIndex(null);
      setDragOverProjIndex(null);
      return;
    }

    // 1. Réorganisation locale optimiste
    const reordered = [...sortedProjectAccounts];
    const [movedItem] = reordered.splice(draggedProjIndex, 1);
    reordered.splice(dragOverProjIndex, 0, movedItem);

    // Mise à jour de l'état global
    setAccounts(prev => {
      const personalAccs = (prev || []).filter(a => !a.projectId);
      return [...personalAccs, ...reordered];
    });

    setDraggedProjIndex(null);
    setDragOverProjIndex(null);

    // 2. Persistance dans Firestore (Batch Write)
    try {
      const batch = writeBatch(firestoreDb);
      reordered.forEach((acc, index) => {
        const accRef = doc(firestoreDb, "accounts", acc.id);
        batch.update(accRef, { order: index });
      });
      await batch.commit();
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de l'ordre des comptes de projet :", error);
    }
  };

  // Raw active account definition
  const rawActiveAccount = useMemo(() => {
    return accounts?.find(a => String(a.id) === String(selectedAccountId)) || null;
  }, [accounts, selectedAccountId]);

  // Determine current project if account is associated with a project
  const currentProject = useMemo(() => {
    if (!rawActiveAccount?.projectId) return null;
    return projects?.find(p => p.id === rawActiveAccount.projectId) || null;
  }, [rawActiveAccount, projects]);

  // Determine role for active account
  const myRole = useMemo(() => {
    if (!rawActiveAccount) return 'owner';
    if (rawActiveAccount.projectId) {
      if (!currentProject) return 'viewer';
      if (currentProject.ownerId === user?.uid) return 'owner';
      return currentProject.members?.[user?.uid]?.role || 'viewer';
    }
    if (rawActiveAccount.role) return rawActiveAccount.role;
    const ownerId = rawActiveAccount.userId || rawActiveAccount.creatorId;
    if (ownerId && user?.uid && ownerId !== user.uid) {
      return 'viewer';
    }
    return 'owner';
  }, [rawActiveAccount, currentProject, user]);

  const canEdit = myRole === 'owner' || myRole === 'editor';

  // 1. Récupération ciblée des transactions dans Firestore pour le compte sélectionné
  const [accountTransactions, setAccountTransactions] = useState(null);

  useEffect(() => {
    if (!selectedAccountId) {
      setAccountTransactions(null);
      return;
    }

    const q = query(
      collection(firestoreDb, "transactions"),
      where("accountId", "==", String(selectedAccountId))
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Tri par date décroissante
      transList.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
      setAccountTransactions(transList);
    }, (error) => {
      console.error("Erreur chargement transactions :", error);
    });

    return () => unsubscribe();
  }, [selectedAccountId]);

  const transactions = useMemo(() => {
    if (!selectedAccountId) return [];
    if (accountTransactions !== null) {
      return accountTransactions;
    }
    if (allTransactions) {
      return allTransactions
        .filter(t => String(t.accountId) === String(selectedAccountId))
        .slice()
        .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
    }
    return [];
  }, [selectedAccountId, accountTransactions, allTransactions]);

  // 2. Calcul dynamique du solde réel principal et disponible en temps réel
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const calculatedBalance = useMemo(() => {
    if (!transactions) return 0;
    return transactions
      .filter(t => {
        if (t.executionType === 'already_executed' || t.executionType === 'past') return false;
        if (t.executionType === 'forecast' || t.executionType === 'planned') {
          const txDate = t.date ? (t.date?.toDate ? t.date.toDate().toISOString().split('T')[0] : String(t.date).split('T')[0]) : '';
          return txDate <= todayStr;
        }
        return true;
      })
      .reduce((acc, t) => {
        const amount = Number(t.amount) || 0;
        return (t.type === 'credit' || t.type === 'income') ? acc + amount : acc - amount;
      }, 0);
  }, [transactions, todayStr]);

  const calculatedPocketsTotal = useMemo(() => {
    if (!selectedAccountId || !allPockets) return 0;
    return allPockets
      .filter(p => String(p.accountId) === String(selectedAccountId))
      .reduce((sum, p) => sum + (Number(p.allocatedAmount) || 0), 0);
  }, [selectedAccountId, allPockets]);

  const calculatedVisibleBalance = calculatedBalance - calculatedPocketsTotal;

  // Active account enriched with real-time dynamic balance
  const activeAccount = useMemo(() => {
    if (!rawActiveAccount) return null;
    return {
      ...rawActiveAccount,
      balance: calculatedBalance,
      visibleBalance: calculatedVisibleBalance,
      totalAllouePoches: calculatedPocketsTotal
    };
  }, [rawActiveAccount, calculatedBalance, calculatedVisibleBalance, calculatedPocketsTotal]);

  // Handle Account Form Submit
  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    if (!accName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const data = {
        name: accName.trim(),
        bank: accBankName.trim(),
        description: accDescription.trim(),
        color: editingAccount?.projectId ? '#1E232A' : (resolveColorHex(accColor) || '#6CBAD8'),
      };

      if (editingAccount) {
        await db.accounts.update(editingAccount.id, data);
        setEditingAccount(null);
      } else {
        const currentUid = user?.uid || auth.currentUser?.uid;
        const newId = await db.accounts.add({
          ...data,
          userId: currentUid,
          allowedUsers: [currentUid],
          order: personalAccounts.length,
          createdAt: new Date().toISOString()
        });
        setSelectedAccountId(newId);

        // Règle par défaut : Si un utilisateur crée son TOUT PREMIER compte (et qu'aucun favori n'existe), définis-le automatiquement comme le compte favori par défaut.
        if (!storedFavoriteId || !accounts || accounts.length === 0) {
          await db.user_meta.put({ key: 'favorite_account_id', value: newId });
        }
      }

      setAccountFormOpen(false);
      resetAccountForm();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement du compte.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAccountForm = () => {
    setAccName('');
    setAccBankName('');
    setAccDescription('');
    setAccColor('#6CBAD8');
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferSourceId || !transferDestId || !transferAmount) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    if (transferSourceId === transferDestId) {
      alert("Le compte source et le compte destination doivent être différents.");
      return;
    }

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Veuillez entrer un montant valide supérieur à 0.");
      return;
    }

    const sourceAccount = accounts.find(a => a.id === transferSourceId);
    const destAccount = accounts.find(a => a.id === transferDestId);

    if (!sourceAccount || !destAccount) {
      alert("Comptes introuvables.");
      return;
    }

    const desc = transferDesc.trim() || 'Virement';
    const dateStr = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();
    const currentUid = user?.uid || auth.currentUser?.uid;

    const sourceTx = {
      accountId: transferSourceId,
      name: `Virement vers ${destAccount.name} : ${desc}`,
      description: `Virement vers ${destAccount.name} : ${desc}`,
      amount: amount,
      type: 'debit',
      date: dateStr,
      userId: currentUid,
      allowedUsers: sourceAccount.allowedUsers && sourceAccount.allowedUsers.length > 0 ? sourceAccount.allowedUsers : (currentUid ? [currentUid] : []),
      projectId: sourceAccount.projectId || null,
      createdAt: nowIso
    };

    const destTx = {
      accountId: transferDestId,
      name: `Virement depuis ${sourceAccount.name} : ${desc}`,
      description: `Virement depuis ${sourceAccount.name} : ${desc}`,
      amount: amount,
      type: 'credit',
      date: dateStr,
      userId: currentUid,
      allowedUsers: destAccount.allowedUsers && destAccount.allowedUsers.length > 0 ? destAccount.allowedUsers : (currentUid ? [currentUid] : []),
      projectId: destAccount.projectId || null,
      createdAt: nowIso
    };

    await db.transaction('rw', db.transactions, async () => {
      await db.transactions.add(sourceTx);
      await db.transactions.add(destTx);
    });

    setTransferModalOpen(false);
    resetTransferForm();
  };

  const resetTransferForm = () => {
    setTransferSourceId('');
    setTransferDestId('');
    setTransferAmount('');
    setTransferDesc('');
  };

  const handleEditAccount = (acc) => {
    if (!canEdit) {
      alert("Action non autorisée en mode spectateur.");
      return;
    }
    setEditingAccount(acc);
    setAccName(acc.name || '');
    setAccBankName(acc.bank || acc.bankName || '');
    setAccDescription(acc.description || '');
    setAccColor(acc.projectId ? '#1E232A' : (resolveColorHex(acc.color) || '#6CBAD8'));
    setAccountFormOpen(true);
  };

  const handleDeleteAccount = async (accId) => {
    if (!canEdit) {
      alert("Action non autorisée en mode spectateur.");
      return;
    }
    const acc = accounts?.find(a => a.id === accId);
    if (!acc) return;
    const confirmDelete = window.confirm(
      "Es-tu sûr de vouloir supprimer ce compte ? Cela supprimera également toutes ses transactions et budgets liés."
    );
    if (!confirmDelete) return;

    await db.accounts.delete(accId);
    setSelectedAccountId(null);
  };

  const handleAddTransactionFromBudget = (budgetId) => {
    if (!canEdit) {
      alert("Action non autorisée en mode spectateur.");
      return;
    }
    setPreselectedBudgetId(budgetId);
    setEditingTransaction(null);
    setTxModalOpen(true);
  };

  // Transaction CRUD handlers
  const handleSaveTransaction = async (txData) => {
    if (!canEdit) {
      alert("Action non autorisée en mode spectateur.");
      return;
    }

    const targetAccount = accounts?.find(a => a.id === (txData.accountId || selectedAccountId));
    const currentUid = user?.uid || auth.currentUser?.uid;
    const allowed = targetAccount?.allowedUsers && targetAccount.allowedUsers.length > 0
      ? targetAccount.allowedUsers
      : (currentUid ? [currentUid] : []);

    const enrichedTx = {
      ...txData,
      userId: txData.userId || currentUid,
      allowedUsers: txData.allowedUsers || allowed,
      projectId: txData.projectId !== undefined ? txData.projectId : (targetAccount?.projectId || null)
    };

    if (editingTransaction) {
      await db.transactions.update(editingTransaction.id, enrichedTx);
    } else {
      await db.transactions.add(enrichedTx);
    }
    setTxModalOpen(false);
    setEditingTransaction(null);
  };

  const handleDeleteTransaction = async (txId) => {
    if (!canEdit) {
      alert("Action non autorisée en mode spectateur.");
      return;
    }
    if (window.confirm("Supprimer cette transaction ?")) {
      await db.transactions.delete(txId);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedCsvFile(file);
      processCSVFile(file);
    }
  };

  // Real-time listener for import batches of the account currently being edited
  useEffect(() => {
    if (!editingAccount?.id) {
      setAccountImports([]);
      return;
    }

    setImportsLoading(true);
    const q = query(
      collection(firestoreDb, 'imports'),
      where('accountId', '==', editingAccount.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.importedAt || '').localeCompare(a.importedAt || ''));
      setAccountImports(docs);
      setImportsLoading(false);
    }, (err) => {
      console.error("Erreur lors de la récupération des lots d'importation :", err);
      setImportsLoading(false);
    });

    return () => unsubscribe();
  }, [editingAccount?.id]);

  // Delete all transactions linked to a specific import batch and the import doc itself
  const handleDeleteImportBatch = async (batch) => {
    if (!batch?.id) return;
    const batchId = batch.id;
    const count = batch.transactionCount ?? 0;
    const confirmMsg = `Voulez-vous vraiment supprimer cet import "${batch.fileName || 'CSV'}" et ses ${count} transaction(s) ?`;
    
    if (!window.confirm(confirmMsg)) return;

    try {
      // 1. Récupère toutes les transactions où importBatchId == batchId
      const txQuery = query(
        collection(firestoreDb, 'transactions'),
        where('importBatchId', '==', batchId)
      );
      const txSnap = await getDocs(txQuery);

      // 2. Supprime ces transactions en batch
      const txDocs = txSnap.docs;
      const chunkSize = 450;
      for (let i = 0; i < txDocs.length; i += chunkSize) {
        const chunk = txDocs.slice(i, i + chunkSize);
        const batchObj = writeBatch(firestoreDb);
        chunk.forEach(docSnap => {
          batchObj.delete(docSnap.ref);
        });
        await batchObj.commit();
      }

      // 3. Supprime le document correspondant dans imports/{batchId}
      await deleteDoc(doc(firestoreDb, 'imports', batchId));

      setToastMessage("Lot d'importation et ses transactions supprimés avec succès ! 🍃");
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error("Error deleting import batch:", err);
      alert("Erreur lors de la suppression du lot d'importation.");
    }
  };

  // Helper to escape special characters for CSV format
  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!activeAccount || !transactions) return;

    // Colonnes générées : Date,Libellé,Type,Montant (séparateur point-virgule pour compatibilité Excel FR)
    const headers = ['Date', 'Libellé', 'Type', 'Montant'];
    const rows = transactions.map(tx => {
      const typeLabel = tx.type === 'credit' ? 'Crédit' : 'Débit';
      const amountVal = Math.abs(Number(tx.amount) || 0).toFixed(2);

      return [
        escapeCSV(tx.date || ''),
        escapeCSV(tx.name || 'Transaction'),
        escapeCSV(typeLabel),
        escapeCSV(amountVal)
      ].join(';');
    });

    // UTF-8 avec BOM (\uFEFF) et séparateur point-virgule (;)
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const todayStr = new Date().toISOString().split('T')[0];
    const sanitizedAccountName = (activeAccount.name || 'compte')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/gi, '_')
      .replace(/_+/g, '_');

    const fileName = `ecopine_${sanitizedAccountName}_${todayStr}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseCSVDate = (dateStr) => {
    if (!dateStr) return '';
    const clean = dateStr.trim().replace(/^["']|["']$/g, '');
    const parts = clean.split(/[./-]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) { // DD/MM/YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (parts[0].length === 4) { // YYYY-MM-DD
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 2) { // DD/MM/YY
        const year = parseInt(parts[2], 10) > 50 ? `19${parts[2]}` : `20${parts[2]}`;
        return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    try {
      const d = new Date(clean);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    } catch (e) {}
    return clean;
  };

  const parseCSVAmount = (amountStr) => {
    if (!amountStr) return 0;
    const clean = String(amountStr)
      .replace(/[\s\u00A0\u202F€$£🔔]/g, '')
      .replace(',', '.')
      .trim();
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  const processCSVFile = (file) => {
    setCsvError('');
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result || '';
      // Strip UTF-8 BOM if present
      const cleanText = text.replace(/^\uFEFF/, '');
      const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      
      if (lines.length < 2) {
        setCsvError("Le fichier CSV est vide ou ne contient pas assez de données. Veuillez vérifier les colonnes du CSV.");
        return;
      }

      // Detect separator: ';' default, fallback ',' or '\t'
      let delimiter = ';';
      if (!lines[0].includes(';') && lines[0].includes(',')) {
        delimiter = ',';
      } else if (!lines[0].includes(';') && !lines[0].includes(',') && lines[0].includes('\t')) {
        delimiter = '\t';
      }

      const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === delimiter && !inQuotes) {
            result.push(current.trim().replace(/^["']|["']$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        return result;
      };

      const rows = lines.map(parseCSVLine);
      
      const headers = rows[0].map(h => 
        h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
      );
      
      // Detection of column headers
      const dateCol = headers.findIndex(h => h.includes('date') || h.includes('valeur') || h.includes('operation'));
      const nameCol = headers.findIndex(h => h.includes('libelle') || h.includes('nom') || h.includes('name') || h.includes('description') || h.includes('detail') || h.includes('motif'));
      const amountCol = headers.findIndex(h => h.includes('montant') || h.includes('amount') || h.includes('somme') || h.includes('valeur'));
      const typeCol = headers.findIndex(h => h.includes('type') || h.includes('sens') || h.includes('mouvement'));

      // Validate minimal presence of Date and Montant columns
      if (dateCol === -1 || amountCol === -1) {
        setCsvError("Format de fichier non reconnu. Veuillez vérifier que votre fichier CSV contient au moins les colonnes 'Date' et 'Montant' (ou 'Libellé').");
        return;
      }

      const parsedTransactions = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length <= Math.max(dateCol, amountCol)) continue;

        const rawDate = row[dateCol];
        const rawName = nameCol !== -1 && row[nameCol] ? row[nameCol].trim() : 'Transaction importée';
        const rawAmountStr = row[amountCol];
        const rawType = typeCol !== -1 ? row[typeCol] : '';

        const date = parseCSVDate(rawDate);
        const amountNum = parseCSVAmount(rawAmountStr);

        if (date && amountNum !== 0) {
          let detectedType = amountNum > 0 ? 'credit' : 'debit';
          
          if (rawType) {
            const normalizedType = rawType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            if (normalizedType.includes('credit') || normalizedType.includes('recette') || normalizedType.includes('revenu') || normalizedType === '+' || normalizedType === 'c') {
              detectedType = 'credit';
            } else if (normalizedType.includes('debit') || normalizedType.includes('depense') || normalizedType.includes('charge') || normalizedType === '-' || normalizedType === 'd') {
              detectedType = 'debit';
            }
          }

          parsedTransactions.push({
            name: rawName || 'Transaction importée',
            amount: Math.abs(amountNum) || 0,
            type: detectedType,
            date: date || new Date().toISOString().split('T')[0]
          });
        }
      }

      if (parsedTransactions.length === 0) {
        setCsvError("Aucune transaction valide n'a pu être lue dans le fichier. Veuillez vérifier les colonnes du CSV.");
      } else {
        setCsvPreviewTxs(parsedTransactions);
      }
    };
    reader.onerror = () => {
      setCsvError("Erreur lors de la lecture du fichier CSV. Veuillez vérifier les colonnes et le format de votre CSV.");
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleConfirmCSVImport = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!csvPreviewTxs || csvPreviewTxs.length === 0 || !activeAccount) return;
    
    const currentUser = user || auth.currentUser;
    if (!currentUser) {
      alert("Vous devez être connecté pour importer des transactions.");
      return;
    }

    setIsImporting(true);
    setCsvError('');

    try {
      const batchId = "import_" + Date.now();
      const nowIso = new Date().toISOString();
      const fileName = selectedCsvFile?.name || "import.csv";
      const totalCount = csvPreviewTxs.length;

      // Batch write in chunks of up to 450 (Firestore limit is 500 ops per batch)
      const chunkSize = 450;
      
      // 1. Premier lot incluant le document 'imports' et les premières transactions
      const firstChunk = csvPreviewTxs.slice(0, chunkSize);
      const firstBatch = writeBatch(firestoreDb);

      // Enregistrement du document du lot dans 'imports'
      const importDocRef = doc(firestoreDb, "imports", batchId);
      firstBatch.set(importDocRef, {
        id: batchId,
        accountId: activeAccount.id,
        userId: currentUser.uid,
        fileName: fileName,
        transactionCount: totalCount,
        importedAt: nowIso
      });

      // Ajout des transactions du premier lot
      firstChunk.forEach((t) => {
        const transRef = doc(collection(firestoreDb, "transactions"));
        const isCredit = t.type === 'credit' || t.type === 'income';
        firstBatch.set(transRef, {
          name: t.name || "Transaction importée",
          amount: Math.abs(Number(t.amount)) || 0,
          type: isCredit ? 'credit' : 'debit',
          date: t.date || nowIso.split('T')[0],
          createdAt: nowIso,
          executionType: "import",
          importBatchId: batchId,
          importFileName: fileName,
          userId: currentUser.uid,
          accountId: activeAccount.id,
          projectId: activeAccount.projectId || null,
          allowedUsers: activeAccount.allowedUsers || [currentUser.uid],
          pocketId: null,
          isRecurring: false
        });
      });

      await firstBatch.commit();

      // Lots suivants si le fichier contient plus de 450 transactions
      for (let i = chunkSize; i < csvPreviewTxs.length; i += chunkSize) {
        const chunk = csvPreviewTxs.slice(i, i + chunkSize);
        const subBatch = writeBatch(firestoreDb);
        chunk.forEach((t) => {
          const transRef = doc(collection(firestoreDb, "transactions"));
          const isCredit = t.type === 'credit' || t.type === 'income';
          subBatch.set(transRef, {
            name: t.name || "Transaction importée",
            amount: Math.abs(Number(t.amount)) || 0,
            type: isCredit ? 'credit' : 'debit',
            date: t.date || nowIso.split('T')[0],
            createdAt: nowIso,
            executionType: "import",
            importBatchId: batchId,
            importFileName: fileName,
            userId: currentUser.uid,
            accountId: activeAccount.id,
            projectId: activeAccount.projectId || null,
            allowedUsers: activeAccount.allowedUsers || [currentUser.uid],
            pocketId: null,
            isRecurring: false
          });
        });
        await subBatch.commit();
      }

      setCsvPreviewTxs(null);
      setSelectedCsvFile(null);
      setToastMessage(`${totalCount} transaction${totalCount > 1 ? 's' : ''} importée${totalCount > 1 ? 's' : ''} avec succès ! 🍃`);
      setTimeout(() => {
        setToastMessage(null);
      }, 4000);
    } catch (error) {
      console.error("Erreur lors de l'importation CSV :", error);
      setCsvError(`Erreur lors de l'enregistrement des transactions : ${error.message || error}`);
      alert("Erreur lors de l'enregistrement des transactions : " + (error.message || error));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-8 select-none">
      {/* 1. Detail View of Account */}
      {selectedAccountId && activeAccount ? (
        <div className="space-y-8 animate-fade-in">
          {/* Header & Account info banner */}
          <div 
            style={activeAccount.projectId ? { backgroundColor: '#1E232A', borderColor: '#2E3440', color: '#ffffff' } : { backgroundColor: resolveColorHex(activeAccount.color), color: '#ffffff', borderColor: '#4A3E3D' }}
            className={`flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-3xl p-6 shadow-ac-sm transition-colors ${
              activeAccount.projectId 
                ? 'project-account-card bg-[#1E232A] text-white border-3 border-[#2E3440]' 
                : 'border-3 border-ac-brown text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSelectedAccountId(null)}
                className={`border-2 rounded-full p-2 transition-colors cursor-pointer ${
                  activeAccount.projectId 
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-white' 
                    : 'bg-white/20 hover:bg-white/30 border-white/40 text-white'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-2xl font-black flex items-center gap-2 flex-wrap text-white">
                  {(() => {
                    const accountName = activeAccount.name || "Compte";
                    const projectName = activeAccount.projectName || (projects?.find(p => p.id === activeAccount.projectId)?.name) || "";
                    return projectName ? `${accountName} - ${projectName}` : accountName;
                  })()}
                  {activeAccount.projectId && (
                    <span className="text-xs font-black uppercase px-2.5 py-0.5 bg-ac-gold/20 text-ac-gold border border-ac-gold/40 rounded-full">
                      📁 Projet
                    </span>
                  )}
                  <span className={`text-xs font-black px-2 py-0.5 rounded-md border ${
                    activeAccount.projectId 
                      ? 'bg-slate-800 text-slate-300 border-slate-700' 
                      : 'text-white bg-white/20 border-white/30'
                  }`}>
                    {activeAccount.bank || activeAccount.bankName || '—'}
                  </span>
                </h2>
                {activeAccount.description && (
                  <p className={`text-[11px] font-semibold mt-2 italic ${activeAccount.projectId ? 'text-slate-300' : 'text-white/90'}`}>
                    "{activeAccount.description}"
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className={`text-left md:text-right border-2 rounded-2xl px-6 py-2.5 min-w-[200px] ${
                activeAccount.projectId 
                  ? 'bg-slate-800/80 border-slate-700 text-white' 
                  : 'bg-white/20 border-white/30 text-white'
              }`}>
                <span className={`text-[9px] font-black uppercase block ${activeAccount.projectId ? 'text-slate-400' : 'text-white/80'}`}>Solde Réel Principal</span>
                <span className="text-2xl font-black text-white">
                  {(activeAccount.balance ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                </span>
              </div>
              
              {activeAccount.balance !== activeAccount.visibleBalance && (
                <div className={`text-left md:text-right border-2 rounded-2xl px-6 py-2 min-w-[200px] animate-bounce-in ${
                  activeAccount.visibleBalance < 0 
                    ? 'bg-amber-500/20 border-amber-400 text-white' 
                    : (activeAccount.projectId ? 'bg-slate-800/60 border-slate-700 text-white' : 'bg-white/20 border-white/30 text-white')
                }`}>
                  <span className={`text-[9px] font-black uppercase block flex items-center justify-start md:justify-end gap-1 ${activeAccount.visibleBalance < 0 ? 'text-amber-300' : (activeAccount.projectId ? 'text-slate-400' : 'text-white/80')}`}>
                    Solde Disponible (indicatif) <Sparkles className="w-3 h-3 fill-ac-gold" />
                  </span>
                  <span className={`text-xl font-black ${activeAccount.visibleBalance < 0 ? 'text-amber-300' : (activeAccount.projectId ? 'text-ac-gold' : 'text-white')}`}>
                    {(activeAccount.visibleBalance ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Account Edit/Export/Import/Delete Controls */}
          <div className="flex flex-wrap gap-3 items-center">
            {canEdit && (
              <button
                onClick={() => handleEditAccount(activeAccount)}
                className="bg-white hover:bg-ac-cream text-ac-brown font-extrabold text-xs px-4 py-2.5 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center gap-1.5 transition-transform active:translate-y-[1px] cursor-pointer"
              >
                <Edit className="w-4 h-4" /> Modifier le Compte
              </button>
            )}

            {/* 📤 Exporter en CSV */}
            <button
              onClick={handleExportCSV}
              className="bg-white hover:bg-ac-cream text-ac-brown font-extrabold text-xs px-4 py-2.5 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center gap-1.5 transition-transform active:translate-y-[1px] cursor-pointer"
              title="Exporter le relevé de ce compte au format CSV"
            >
              <Upload className="w-4 h-4 text-ac-green rotate-180" /> 📤 Exporter en CSV
            </button>

            {/* 📥 Importer un CSV */}
            {canEdit && (
              <label className="bg-white hover:bg-ac-cream text-ac-brown font-extrabold text-xs px-4 py-2.5 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center gap-1.5 transition-transform active:translate-y-[1px] cursor-pointer">
                <Upload className="w-4 h-4 text-ac-sky" /> 📥 Importer un CSV
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  onChange={handleFileInput} 
                />
              </label>
            )}

            {canEdit && (
              <button
                onClick={() => handleDeleteAccount(activeAccount.id)}
                className="bg-ac-red-light hover:bg-ac-red/10 text-ac-red font-extrabold text-xs px-4 py-2.5 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center gap-1.5 transition-transform active:translate-y-[1px] cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Supprimer le Compte
              </button>
            )}

            {!canEdit && (
              <span className="text-xs font-bold text-ac-brown-light bg-slate-100 px-3 py-1.5 rounded-full border border-slate-300">
                Mode spectateur (lecture seule)
              </span>
            )}
          </div>

          {/* Nested Pocket Section */}
          <PocketManager accountId={activeAccount.id} role={myRole} />

          {/* Transactions CRUD Card */}
          <div className="ac-card p-6 bg-white border-ac-brown">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 border-b border-ac-brown/10 pb-4">
              <div>
                <h3 className="text-lg font-black text-ac-brown">
                  Transactions de ce compte
                </h3>
                <p className="text-xs font-semibold text-ac-brown-light mt-0.5">
                  Visualise, ajoute ou modifie tes écritures comptables.
                </p>
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-3 self-start sm:self-auto">
                  <button
                    onClick={() => {
                      setEditingTransaction(null);
                      setTxModalOpen(true);
                    }}
                    className="bg-ac-green text-white font-extrabold text-sm px-4 py-3 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center justify-center gap-1.5 hover:translate-y-[1px] cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Nouvelle Transaction
                  </button>
                </div>
              )}
            </div>

            {/* CSV Error Banner */}
            {csvError && (
              <div className="mb-4 text-xs font-bold text-ac-red bg-ac-red-light px-4 py-3 rounded-2xl border border-ac-red/25 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> {csvError}
              </div>
            )}

                {/* CSV Preview panel */}
                {csvPreviewTxs && (
                  <div className="mt-4 bg-ac-cream-light/60 border-2 border-ac-brown rounded-2xl p-4 animate-bounce-in space-y-4">
                    <h5 className="font-extrabold text-xs text-ac-brown flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-ac-gold" /> Aperçu de l'importation ({csvPreviewTxs.length} transactions détectées)
                    </h5>
                    <div className="max-h-60 overflow-y-auto border border-ac-brown/10 rounded-xl divide-y divide-ac-brown/10 bg-white">
                      {csvPreviewTxs.slice(0, 10).map((tx, idx) => {
                        const formattedDate = tx.date ? (tx.date?.toDate ? tx.date.toDate().toLocaleDateString('fr-FR') : (isNaN(new Date(tx.date).getTime()) ? String(tx.date) : new Date(tx.date).toLocaleDateString('fr-FR'))) : '';
                        return (
                          <div key={idx} className="p-3 text-xs flex justify-between items-center">
                            <div>
                              <p className="font-extrabold text-ac-brown">{tx.name}</p>
                              <span className="text-[10px] font-bold text-ac-brown-light">{formattedDate}</span>
                            </div>
                            <span className={`font-black ${tx.type === 'credit' ? 'text-ac-green' : 'text-ac-brown'}`}>
                              {tx.type === 'credit' ? '+' : '-'}{(Number(tx.amount) || 0).toFixed(2)} 🔔
                            </span>
                          </div>
                        );
                      })}
                      {csvPreviewTxs.length > 10 && (
                        <div className="p-2 text-center text-[10px] font-bold text-ac-brown-light italic">
                          Et {csvPreviewTxs.length - 10} autres transactions...
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button 
                        type="button"
                        onClick={() => {
                          setCsvPreviewTxs(null);
                          setSelectedCsvFile(null);
                        }}
                        disabled={isImporting}
                        className="bg-white hover:bg-ac-cream border border-ac-brown text-ac-brown font-extrabold text-xs px-3 py-1.5 rounded-xl cursor-pointer disabled:opacity-50"
                      >
                        Annuler
                      </button>
                      <button 
                        type="button"
                        onClick={handleConfirmCSVImport}
                        disabled={isImporting}
                        className={`bg-ac-green text-white font-extrabold text-xs px-3 py-1.5 rounded-xl border border-ac-brown shadow-ac-sm flex items-center gap-1.5 transition-all ${
                          isImporting ? 'opacity-70 cursor-not-allowed' : 'hover:translate-y-[1px] cursor-pointer'
                        }`}
                      >
                        <CheckCircle className="w-4 h-4" /> {isImporting ? 'Importation en cours...' : 'Importer'}
                      </button>
                    </div>
                  </div>
                )}

            {/* Transactions List */}
            {transactions === undefined ? (
              <div className="text-center py-6 text-ac-brown-light">Recalcul des transactions...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 bg-ac-cream rounded-3xl border border-dashed border-ac-brown/20 text-ac-brown-light text-sm font-semibold">
                Aucune clochette dépensée ou gagnée ici pour le moment ! Utilise le bouton ci-dessus pour ajouter ta première transaction. 🍃
              </div>
            ) : (
              <>
                {/* Desktop View: Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b-2 border-ac-brown text-ac-brown-light font-black text-xs uppercase">
                        <th className="pb-3 pt-2 pl-2">Date</th>
                        <th className="pb-3 pt-2">Nom</th>
                        <th className="pb-3 pt-2">Exécution</th>
                        <th className="pb-3 pt-2 text-right">Montant</th>
                        <th className="pb-3 pt-2 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ac-cream-dark">
                      {transactions.map((tx) => {
                        const isIncome = tx.type === 'credit';
                        const formattedDate = tx.date ? (tx.date?.toDate ? tx.date.toDate().toLocaleDateString('fr-FR') : (isNaN(new Date(tx.date).getTime()) ? String(tx.date) : new Date(tx.date).toLocaleDateString('fr-FR'))) : '';
                        const isImport = tx.executionType === 'import' || tx.importBatchId != null;
                        return (
                          <tr key={tx.id} className="hover:bg-ac-cream-light/35 transition-colors group">
                            <td className="py-3.5 pl-2 text-xs font-bold text-ac-brown-light">
                              {formattedDate}
                            </td>
                            <td className="py-3.5 font-extrabold text-sm text-ac-brown">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {tx.name || tx.description}
                                {tx.isRecurring && (
                                  <span className="text-[8px] font-black bg-ac-gold-light border border-ac-gold/20 text-ac-gold-dark px-1.5 py-0.2 rounded" title="Transaction récurrente">
                                    ♻️ {tx.recurrencePeriod === 'weekly' ? 'Hebdo' : 'Mensuel'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5">
                              {(() => {
                                const badge = getExecutionBadgeInfo(tx);
                                return (
                                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${badge.className}`}>
                                    {badge.icon && <span>{badge.icon}</span>}
                                    <span>{badge.label}</span>
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-3.5 text-right font-black text-sm">
                              <span className={isIncome ? 'text-ac-green' : 'text-ac-brown'}>
                                {isIncome ? '+' : '-'}{(tx.amount ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                              </span>
                            </td>
                            <td className="py-3.5 text-center">
                              {myRole !== 'viewer' && (
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingTransaction(tx);
                                      setTxModalOpen(true);
                                    }}
                                    className="p-1.5 hover:bg-ac-cream rounded-lg text-ac-brown-light hover:text-ac-brown border border-transparent hover:border-ac-brown/25 cursor-pointer"
                                    title="Modifier"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTransaction(tx.id)}
                                    className="p-1.5 hover:bg-ac-red-light rounded-lg text-ac-brown-light hover:text-ac-red border border-transparent hover:border-ac-brown/25 cursor-pointer"
                                    title="Supprimer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View: Compact list */}
                <div className="md:hidden flex flex-col gap-3">
                  {transactions.map((tx) => {
                    const isIncome = tx.type === 'credit';
                    const formattedDate = tx.date ? (tx.date?.toDate ? tx.date.toDate().toLocaleDateString('fr-FR') : (isNaN(new Date(tx.date).getTime()) ? String(tx.date) : new Date(tx.date).toLocaleDateString('fr-FR'))) : '';
                    const badge = getExecutionBadgeInfo(tx);
                    return (
                      <div key={tx.id} className="bg-ac-cream/20 border-2 border-ac-brown rounded-2xl p-4 flex flex-col gap-2 relative">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-black text-ac-brown-light">
                              {formattedDate}
                            </span>
                            <h4 className="font-extrabold text-sm text-ac-brown mt-0.5">
                              {tx.name || tx.description}
                              {tx.isRecurring && (
                                <span className="text-[8px] font-black bg-ac-gold-light border border-ac-gold/20 text-ac-gold-dark px-1.5 py-0.2 rounded ml-1.5 inline-block">
                                  ♻️ {tx.recurrencePeriod === 'weekly' ? 'Hebdo' : 'Mensuel'}
                                </span>
                              )}
                            </h4>
                          </div>
                          <span className={`font-black text-sm whitespace-nowrap ${isIncome ? 'text-ac-green' : 'text-ac-brown'}`}>
                            {isIncome ? '+' : '-'}{(tx.amount ?? 0).toLocaleString('fr-FR')} 🔔
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 items-center mt-1">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded border inline-flex items-center gap-1 ${badge.className}`}>
                            {badge.icon && <span>{badge.icon}</span>}
                            <span>{badge.label}</span>
                          </span>
                        </div>

                        {/* Actions for mobile (tactile-friendly) */}
                        {myRole !== 'viewer' && (
                          <div className="flex justify-end gap-3 mt-2 pt-2 border-t border-ac-brown/10">
                            <button
                              onClick={() => {
                                setEditingTransaction(tx);
                                setTxModalOpen(true);
                              }}
                              className="h-12 px-4 bg-white hover:bg-ac-cream text-ac-brown rounded-xl border-2 border-ac-brown shadow-ac-sm cursor-pointer flex items-center justify-center gap-1.5 font-bold text-xs"
                            >
                              <Edit className="w-3.5 h-3.5" /> Modifier
                            </button>
                            <button
                              onClick={() => handleDeleteTransaction(tx.id)}
                              className="h-12 px-4 bg-white hover:bg-ac-red-light text-ac-red rounded-xl border-2 border-ac-brown shadow-ac-sm cursor-pointer flex items-center justify-center gap-1.5 font-bold text-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Modal to add/edit transaction */}
          <TransactionModal
            isOpen={txModalOpen}
            onClose={() => {
              setTxModalOpen(false);
              setEditingTransaction(null);
              setPreselectedBudgetId(null);
            }}
            onSave={handleSaveTransaction}
            transaction={editingTransaction}
            accountId={selectedAccountId}
            preselectedBudgetId={preselectedBudgetId}
          />
        </div>
      ) : (
        // 2. Listing of all accounts
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm">
            <div>
              <h2 className="text-2xl font-black text-ac-brown flex items-center gap-2">
                <Coins className="w-6 h-6 text-ac-green" /> Gestion des comptes
              </h2>
              <p className="text-xs font-semibold text-ac-brown-light mt-0.5">
                Crée tes livrets d'épargne ou tes comptes courants pour visualiser tes finances.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleOpenCalendar}
                className="bg-ac-sky text-white font-extrabold text-sm px-4 py-3 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center justify-center gap-1.5 hover:translate-y-[1px] cursor-pointer self-start sm:self-auto transition-all"
              >
                <Calendar className="w-4 h-4" /> Calendrier
              </button>
              <button
                onClick={() => {
                  setTransferSourceId('');
                  setTransferDestId('');
                  setTransferAmount('');
                  setTransferDesc('');
                  setTransferModalOpen(true);
                }}
                className="bg-ac-gold text-white font-extrabold text-sm px-4 py-3 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center justify-center gap-1.5 hover:translate-y-[1px] cursor-pointer self-start sm:self-auto"
              >
                <ArrowRightLeft className="w-4 h-4" /> Faire un virement
              </button>
              <button
                onClick={() => {
                  setEditingAccount(null);
                  setAccountFormOpen(true);
                }}
                className="bg-ac-green text-white font-extrabold text-sm px-4 py-3 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center justify-center gap-1.5 hover:translate-y-[1px] cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" /> Nouveau Compte
              </button>
            </div>
          </div>

          {/* Accounts Grid */}
          {!accounts ? (
            <div className="text-center py-6 text-ac-brown-light">Chargement...</div>
          ) : personalAccounts.length === 0 && sortedProjectAccounts.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-3xl border-3 border-ac-brown text-ac-brown-light">
              <p className="font-extrabold mb-4">Tu n'as pas encore créé de compte ou de livret.</p>
              <p className="text-xs">Commence par créer ton compte courant principal en cliquant sur "Nouveau Compte" ci-dessus !</p>
            </div>
          ) : (
            <div className="space-y-10">
              {/* --- 1. SECTION COMPTES PERSONNELS --- */}
              {personalAccounts.length > 0 && (
                <div className="accounts-section">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {personalAccounts.map((acc, index) => {
                      const isExplicitFavorite = storedFavoriteId === acc.id;
                      const isDefaultFavorite = !storedFavoriteId && activeFavoriteAccount?.id === acc.id;
                      const isFavorite = isExplicitFavorite || isDefaultFavorite;
                      const titleText = acc.name || acc.title || "Compte";

                      return (
                        <div 
                          key={acc.id}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragEnter={(e) => handleDragEnter(e, index)}
                          onDragOver={handleDragOver}
                          onDragEnd={handleDragEnd}
                          onClick={() => setSelectedAccountId(acc.id)}
                          style={{ backgroundColor: resolveColorHex(acc.color), color: '#ffffff' }}
                          className={`ac-card account-card p-5 cursor-grab active:cursor-grabbing relative group overflow-visible flex flex-col justify-between transition-all duration-200 border-ac-brown text-white ${
                            draggedIndex === index ? 'opacity-40 scale-95 border-dashed border-2 border-green-500' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-sm leading-tight break-words text-white">
                                {titleText}
                              </h3>
                              <span className="text-[10px] font-bold block mt-1.5 text-white/80">
                                🏦 {acc.bank || acc.bankName || '—'}
                              </span>
                            </div>

                            <div className="flex gap-1.5 shrink-0 items-center">
                              <button
                                type="button"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => handleToggleFavorite(e, acc.id)}
                                className="w-9 h-9 rounded-full border flex items-center justify-center transition-colors cursor-pointer bg-white/20 hover:bg-white/30 border-white/30"
                                title={isExplicitFavorite ? "Compte favori actuel" : (isDefaultFavorite ? "Compte principal par défaut (index 0)" : "Définir comme compte favori")}
                              >
                                <Star className={`w-4 h-4 ${isFavorite ? 'text-amber-300 fill-amber-300' : 'text-white/60 hover:text-amber-300'}`} />
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-white/20 flex justify-between items-baseline">
                            <span className="text-[10px] font-black uppercase tracking-wide text-white/80">Solde Réel</span>
                            <span className="font-black text-base text-white">
                              {(acc.balance ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                            </span>
                          </div>

                          {acc.balance !== acc.visibleBalance && (
                            <div className="text-[9px] font-extrabold flex justify-between items-center mt-1 text-white/80">
                              <span>Solde disponible :</span>
                              <span className={acc.visibleBalance < 0 ? 'text-amber-300 font-black' : 'text-white/90 font-black'}>
                                {(acc.visibleBalance ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* --- 2. SECTION COMPTES DE PROJETS (SI PRÉSENTS) --- */}
              {sortedProjectAccounts.length > 0 && (
                <div className="project-accounts-section mt-10">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-700">
                    📁 Comptes de Projets Partagés ({sortedProjectAccounts.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedProjectAccounts.map((acc, index) => {
                      const isExplicitFavorite = storedFavoriteId === acc.id;
                      const isDefaultFavorite = !storedFavoriteId && activeFavoriteAccount?.id === acc.id;
                      const isFavorite = isExplicitFavorite || isDefaultFavorite;
                      const titleText = acc.name || acc.title || "Compte Projet";
                      const projectName = acc.projectName || (projects?.find(p => p.id === acc.projectId)?.name) || "";

                      return (
                        <div 
                          key={acc.id}
                          draggable={true}
                          onDragStart={(e) => handleProjectDragStart(e, index)}
                          onDragEnter={(e) => handleProjectDragEnter(e, index)}
                          onDragOver={(e) => e.preventDefault()}
                          onDragEnd={handleProjectDragEnd}
                          onClick={() => setSelectedAccountId(acc.id)}
                          style={{ backgroundColor: '#1E232A', borderColor: '#2E3440', color: '#ffffff' }}
                          className={`ac-card account-card p-5 cursor-grab active:cursor-grabbing relative group overflow-visible flex flex-col justify-between transition-all duration-200 project-account-card bg-[#1E232A] text-white border-3 border-[#2E3440] shadow-ac-md ${
                            draggedProjIndex === index 
                              ? 'opacity-40 scale-95 border-dashed border-2 border-indigo-400' 
                              : ''
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-extrabold text-sm leading-tight break-words text-white">
                                  {titleText}
                                </h3>
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-ac-gold/20 text-ac-gold border border-ac-gold/40 rounded-full inline-flex items-center gap-1 shrink-0">
                                  📁 {projectName || 'PROJET'}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold block mt-1.5 text-slate-300">
                                🏦 {acc.bank || acc.bankName || '—'}
                              </span>
                            </div>

                            <div className="flex gap-1.5 shrink-0 items-center">
                              <button
                                type="button"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => handleToggleFavorite(e, acc.id)}
                                className="w-9 h-9 rounded-full border flex items-center justify-center transition-colors cursor-pointer bg-slate-800 hover:bg-slate-700 border-slate-700"
                                title={isExplicitFavorite ? "Compte favori actuel" : (isDefaultFavorite ? "Compte principal par défaut (index 0)" : "Définir comme compte favori")}
                              >
                                <Star className={`w-4 h-4 ${isFavorite ? 'text-amber-300 fill-amber-300' : 'text-slate-500 hover:text-amber-300'}`} />
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-700 flex justify-between items-baseline">
                            <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Solde Réel</span>
                            <span className="font-black text-base text-white">
                              {(acc.balance ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                            </span>
                          </div>

                          {acc.balance !== acc.visibleBalance && (
                            <div className="text-[9px] font-extrabold flex justify-between items-center mt-1 text-slate-400">
                              <span>Solde disponible :</span>
                              <span className={acc.visibleBalance < 0 ? 'text-amber-300 font-black' : 'text-ac-gold font-black'}>
                                {(acc.visibleBalance ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Transfer Dialog Modal */}
      {transferModalOpen && (
        <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4 z-50 animate-fade-in text-ac-brown">
          <div className="bg-[#FFFDF9] border-t-4 border-x-4 md:border-4 border-ac-brown rounded-t-3xl md:rounded-3xl p-6 max-w-md w-full shadow-ac-lg relative animate-slide-up md:animate-bounce-in pb-safe-bottom">
            {/* Grab handle */}
            <div className="w-12 h-1.5 bg-ac-brown/20 rounded-full mx-auto mb-4 md:hidden shrink-0"></div>
            {/* Close button */}
            <button 
              type="button"
              onClick={() => {
                setTransferModalOpen(false);
                resetTransferForm();
              }}
              className="absolute top-4 right-4 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 transition-all hover:scale-110 text-ac-brown cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black mb-4 flex items-center gap-1.5 border-b border-ac-brown/10 pb-2">
              <ArrowRightLeft className="w-5 h-5 text-ac-gold" /> Faire un virement interne
            </h3>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1.5">Compte Source (Débit) *</label>
                <select
                  value={transferSourceId}
                  onChange={(e) => setTransferSourceId(e.target.value)}
                  className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white cursor-pointer"
                  required
                >
                  <option value="">-- Sélectionner le compte à débiter --</option>
                  {accounts?.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({(acc.visibleBalance ?? acc.balance ?? 0).toLocaleString('fr-FR')} 🔔 dispo)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1.5">Compte Cible (Crédit) *</label>
                <select
                  value={transferDestId}
                  onChange={(e) => setTransferDestId(e.target.value)}
                  className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white cursor-pointer"
                  required
                >
                  <option value="">-- Sélectionner le compte à créditer --</option>
                  {accounts?.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({(acc.visibleBalance ?? acc.balance ?? 0).toLocaleString('fr-FR')} 🔔 dispo)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Montant *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl pl-7 pr-3 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                      required
                    />
                    <span className="absolute left-2.5 top-3.5 text-xs font-black">🔔</span>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Motif / Description</label>
                  <input
                    type="text"
                    value={transferDesc}
                    onChange={(e) => setTransferDesc(e.target.value)}
                    placeholder="Épargne mensuelle, remboursement..."
                    className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-ac-brown/10">
                <button
                  type="button"
                  onClick={() => {
                    setTransferModalOpen(false);
                    resetTransferForm();
                  }}
                  className="flex-1 h-12 bg-white hover:bg-ac-cream text-ac-brown rounded-2xl border-3 border-ac-brown font-extrabold text-sm shadow-ac-sm transition-transform active:translate-y-1 active:shadow-none cursor-pointer flex items-center justify-center"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 h-12 bg-ac-green text-white rounded-2xl border-3 border-ac-brown font-extrabold text-sm shadow-ac-sm transition-transform active:translate-y-1 active:shadow-none cursor-pointer flex items-center justify-center"
                >
                  Transférer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Creation / Edition Modal Form */}
      {accountFormOpen && (
        <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4 z-50 animate-fade-in text-ac-brown">
          <div className="bg-[#FFFDF9] border-t-4 border-x-4 md:border-4 border-ac-brown rounded-t-3xl md:rounded-3xl p-6 max-w-lg w-full shadow-ac-lg relative animate-slide-up md:animate-bounce-in pb-safe-bottom">
            {/* Grab handle */}
            <div className="w-12 h-1.5 bg-ac-brown/20 rounded-full mx-auto mb-4 md:hidden shrink-0"></div>
            {/* Close button */}
            <button 
              type="button"
              onClick={() => {
                setAccountFormOpen(false);
                setEditingAccount(null);
                resetAccountForm();
              }}
              className="absolute top-4 right-4 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 transition-all hover:scale-110 text-ac-brown cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black mb-4 flex items-center gap-1.5 border-b border-ac-brown/10 pb-2">
              <Coins className="w-5 h-5 text-ac-green" /> {editingAccount ? 'Modifier le compte' : 'Créer un nouveau compte'}
            </h3>

            <form onSubmit={handleAccountSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Nom du compte *</label>
                <input
                  type="text"
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  placeholder="Ex: Compte Principal, Poche d'épargne..."
                  className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Banque / Établissement</label>
                <input
                  type="text"
                  value={accBankName}
                  onChange={(e) => setAccBankName(e.target.value)}
                  placeholder="Ex: Nook Banque, Caisse d'Épargne..."
                  className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Description / Rôle du compte</label>
                <input
                  type="text"
                  value={accDescription}
                  onChange={(e) => setAccDescription(e.target.value)}
                  placeholder="Ex: Pour financer mon futur projet de pont..."
                  className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                />
              </div>

              {!editingAccount?.projectId && (
                <div>
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1.5 flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5 text-ac-orange" /> Couleur d'arrière-plan du compte
                  </label>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setAccColor(c.hex)}
                        className={`w-8 h-8 rounded-full border-2 border-ac-brown flex items-center justify-center transition-transform cursor-pointer shadow-xs ${
                          accColor === c.hex || accColor === c.id ? 'scale-115 ring-2 ring-ac-brown ring-offset-1' : 'hover:scale-105 opacity-80'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.label}
                      >
                        {(accColor === c.hex || accColor === c.id) && <Check className="w-4 h-4 text-white stroke-[3]" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Section: Historique & Gestion des imports CSV */}
              {editingAccount && (
                <div className="border-t border-ac-brown/10 pt-4 space-y-3">
                  <h4 className="text-xs font-black uppercase text-ac-brown flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-ac-green" /> Historique &amp; Gestion des imports CSV
                  </h4>
                  {importsLoading ? (
                    <p className="text-xs text-ac-brown-light italic bg-ac-cream/50 p-3 rounded-2xl border border-ac-brown/10">
                      Chargement de l'historique des imports...
                    </p>
                  ) : accountImports.length === 0 ? (
                    <p className="text-xs text-ac-brown-light italic bg-ac-cream/50 p-3 rounded-2xl border border-ac-brown/10">
                      Aucun lot d'importation CSV enregistré pour ce compte.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {accountImports.map(batch => {
                        const formattedDate = batch.importedAt 
                          ? (batch.importedAt?.toDate 
                              ? batch.importedAt.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                              : (isNaN(new Date(batch.importedAt).getTime()) 
                                  ? String(batch.importedAt) 
                                  : new Date(batch.importedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })))
                          : '—';
                        const count = batch.transactionCount ?? 0;
                        return (
                          <div 
                            key={batch.id} 
                            className="bg-white border-2 border-ac-brown/20 rounded-2xl p-3 flex justify-between items-center shadow-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="bg-ac-green-light p-2 rounded-xl border border-ac-green/30 text-ac-green shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-extrabold text-ac-brown truncate max-w-[180px] sm:max-w-[240px]" title={batch.fileName}>
                                  {batch.fileName || 'Import CSV'}
                                </p>
                                <p className="text-[10px] font-bold text-ac-brown-light">
                                  {count} transaction{count > 1 ? 's' : ''} • {formattedDate}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteImportBatch(batch)}
                              className="bg-ac-red-light hover:bg-ac-red/20 text-ac-red p-2 rounded-xl border border-ac-red/30 transition-transform active:scale-95 cursor-pointer shrink-0 ml-2"
                              title="Supprimer le lot"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-4 pt-4 border-t border-ac-brown/10">
                <button
                  type="button"
                  onClick={() => {
                    setAccountFormOpen(false);
                    setEditingAccount(null);
                    resetAccountForm();
                  }}
                  className="flex-1 h-12 bg-white hover:bg-ac-cream text-ac-brown rounded-2xl border-3 border-ac-brown font-extrabold text-sm shadow-ac-sm transition-transform active:translate-y-1 active:shadow-none cursor-pointer flex items-center justify-center"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 h-12 bg-ac-green text-white rounded-2xl border-3 border-ac-brown font-extrabold text-sm shadow-ac-sm transition-all flex items-center justify-center ${
                    isSubmitting ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:translate-y-1'
                  }`}
                  style={isSubmitting ? { cursor: 'not-allowed' } : {}}
                >
                  {isSubmitting ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-ac-green text-white font-extrabold text-sm px-5 py-3 rounded-2xl border-3 border-ac-brown shadow-ac-lg z-50 animate-bounce-in flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
