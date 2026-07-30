import React, { useState, useMemo, useRef } from 'react';
import { db, useDb, calculateLivretInterests } from '../db';
import { doc, writeBatch } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { 
  Plus, Edit, Trash2, ArrowLeft, Upload, FileText, CheckCircle, 
  Coins, PiggyBank, HelpCircle, AlertTriangle, 
  Landmark, Sparkles, FileSpreadsheet, ArrowRightLeft, X, Mail
} from 'lucide-react';
import TransactionModal from './TransactionModal';
import PocketManager from './PocketManager';
import InlineShareSelector from './InlineShareSelector';
import AvatarStackPopover from './AvatarStackPopover';

export default function AccountsView({ selectedAccountId, setSelectedAccountId }) {
  // Account Form states
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState('Courant');
  const [accBankName, setAccBankName] = useState('');
  const [accDescription, setAccDescription] = useState('');
  const [accRib, setAccRib] = useState('');
  const [accInitial, setAccInitial] = useState('');
  const [accRate, setAccRate] = useState('');
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
  const [isDragActive, setIsDragActive] = useState(false);
  const [csvPreviewTxs, setCsvPreviewTxs] = useState(null);
  const [csvError, setCsvError] = useState('');

  const { accountsData: accounts, transactions: allTransactions, user, acceptedFriends, username } = useDb();

  // Sharing popup state
  const [sharingDoc, setSharingDoc] = useState(null);

  // Sharing checkboxes state
  const [sharedFriendUids, setSharedFriendUids] = useState([]);

  // Sharing roles state
  const [formUserRoles, setFormUserRoles] = useState({});
  const [openPopoverAccountId, setOpenPopoverAccountId] = useState(null);

  // Drag & Drop state for Accounts
  const [draggableAccountId, setDraggableAccountId] = useState(null);
  const longPressTimer = useRef(null);

  const sortedAccounts = useMemo(() => {
    if (!accounts) return [];
    return [...accounts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [accounts]);

  // Drag & Drop handlers for Accounts
  const handleAccountDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleAccountDragOver = (e) => {
    e.preventDefault();
  };

  const handleAccountDrop = async (e, hoverIndex) => {
    e.preventDefault();
    const dragIndex = Number(e.dataTransfer.getData('text/plain'));
    if (dragIndex === hoverIndex || isNaN(dragIndex)) return;

    const reordered = [...sortedAccounts];
    const [dragged] = reordered.splice(dragIndex, 1);
    reordered.splice(hoverIndex, 0, dragged);

    // Save order sequence in Firestore
    const batch = writeBatch(firestoreDb);
    reordered.forEach((acc, idx) => {
      const ref = doc(firestoreDb, 'accounts', acc.id);
      batch.update(ref, { order: idx });
    });
    
    await batch.commit();
    setDraggableAccountId(null);
  };

  const handleAccountDragEnd = () => {
    setDraggableAccountId(null);
  };

  const handleStartLongPress = (id) => {
    longPressTimer.current = setTimeout(() => {
      setDraggableAccountId(id);
    }, 850);
  };

  const handleCancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  // Fetch transactions for the active account
  const activeAccount = accounts?.find(a => a.id === selectedAccountId);

  const transactions = useMemo(() => {
    if (!selectedAccountId || !allTransactions) return [];
    return allTransactions
      .filter(t => t.accountId === selectedAccountId)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedAccountId, allTransactions]);

  // Fetch live interest simulation for booklet accounts
  const activeAccountInterests = useMemo(() => {
    if (!activeAccount || !transactions) return null;
    const isLivret = activeAccount.type && activeAccount.type.toLowerCase() !== 'courant';
    if (!isLivret || Number(activeAccount.rate) <= 0) return null;

    const todayStr = new Date().toISOString().split('T')[0];
    return calculateLivretInterests(activeAccount, transactions, todayStr);
  }, [activeAccount, transactions]);

  // Current active account user role
  const myRole = useMemo(() => {
    if (!activeAccount) return 'owner';
    return activeAccount.userRoles?.[user?.uid] || 'owner';
  }, [activeAccount, user]);

  // Handle Account Form Submit
  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    if (!accName || !accInitial || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const initial = parseFloat(accInitial);
      const rate = accRate ? parseFloat(accRate) : 0;

      const ownerId = editingAccount ? (editingAccount.ownerId || editingAccount.creatorId || user.uid) : user.uid;

      const data = {
        name: accName.trim(),
        type: accType,
        bankName: accBankName.trim(),
        description: accDescription.trim(),
        rib: accRib.trim(),
        initialBalance: isNaN(initial) ? 0 : initial,
        rate: isNaN(rate) ? 0 : rate,
      };

      if (editingAccount && editingAccount.ownerId !== user.uid) {
        // Safe merge for editors
        data.allowedUsers = editingAccount.allowedUsers;
        data.ownerId = ownerId;
        data.userRoles = editingAccount.userRoles || { [ownerId]: 'owner', [user.uid]: 'editor' };
        data.sharedWithNames = editingAccount.sharedWithNames || [];
      } else {
        // Owner logic
        const roles = { [ownerId]: 'owner' };
        const sharedNames = [];
        const updatedAllowedUsers = [ownerId];

        sharedFriendUids.forEach(uid => {
          const friend = acceptedFriends?.find(f => f.uid === uid);
          if (friend) {
            roles[uid] = formUserRoles[uid] || 'editor';
            sharedNames.push(friend.name);
            updatedAllowedUsers.push(uid);
          }
        });

        data.allowedUsers = updatedAllowedUsers;
        data.ownerId = ownerId;
        data.userRoles = roles;
        data.sharedWithNames = sharedNames;
      }

      if (editingAccount) {
        await db.accounts.update(editingAccount.id, data);
        setEditingAccount(null);
      } else {
        const newId = await db.accounts.add({
          ...data,
          currentBalance: data.initialBalance
        });
        setSelectedAccountId(newId);
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
    setAccType('Courant');
    setAccBankName('');
    setAccDescription('');
    setAccRib('');
    setAccInitial('');
    setAccRate('');
    setSharedFriendUids([]);
    setFormUserRoles({});
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

    const sourceTx = {
      accountId: transferSourceId,
      name: `Virement vers ${destAccount.name} : ${desc}`,
      description: `Virement vers ${destAccount.name} : ${desc}`,
      amount: amount,
      type: 'debit',
      date: dateStr,
      categoryId: null,
      category: 'Virement',
      executionType: 'spontaneous',
      isRecurring: false,
      recurrencePeriod: 'none',
      recurrenceEnd: ''
    };

    const destTx = {
      accountId: transferDestId,
      name: `Virement depuis ${sourceAccount.name} : ${desc}`,
      description: `Virement depuis ${sourceAccount.name} : ${desc}`,
      amount: amount,
      type: 'credit',
      date: dateStr,
      categoryId: null,
      category: 'Virement',
      executionType: 'spontaneous',
      isRecurring: false,
      recurrencePeriod: 'none',
      recurrenceEnd: ''
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
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccType(acc.type || 'Courant');
    setAccBankName(acc.bankName || '');
    setAccDescription(acc.description || '');
    setAccRib(acc.rib || '');
    setAccInitial(acc.initialBalance.toString());
    setAccRate(acc.rate ? acc.rate.toString() : '');
    const accountOwner = acc.ownerId || acc.creatorId || user?.uid;
    setSharedFriendUids(acc.allowedUsers ? acc.allowedUsers.filter(uid => uid !== accountOwner) : []);
    setFormUserRoles(acc.userRoles || {});
    setAccountFormOpen(true);
  };

  const handleDeleteAccount = async (accId) => {
    const confirmDelete = window.confirm(
      "Es-tu sûr de vouloir supprimer ce compte ? Cela supprimera également toutes ses transactions et budgets liés."
    );
    if (!confirmDelete) return;

    await db.accounts.delete(accId);
    setSelectedAccountId(null);
  };

  const handleLeaveAccount = async (acc) => {
    const confirmLeave = window.confirm("Es-tu sûr de vouloir quitter ce compte partagé ?");
    if (!confirmLeave) return;

    try {
      const myUsername = username || 'Habitant';
      const updatedAllowedUsers = (acc.allowedUsers || []).filter(uid => uid !== user?.uid);
      
      const updatedUserRoles = { ...(acc.userRoles || {}) };
      delete updatedUserRoles[user?.uid];

      const updatedSharedWithNames = (acc.sharedWithNames || []).filter(
        name => name.toLowerCase() !== myUsername.toLowerCase()
      );

      await db.accounts.update(acc.id, {
        allowedUsers: updatedAllowedUsers,
        userRoles: updatedUserRoles,
        sharedWithNames: updatedSharedWithNames
      });

      setSelectedAccountId(null);
      alert("Vous avez quitté le compte.");
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la sortie du compte.");
    }
  };

  const handleAddTransactionFromBudget = (budgetId) => {
    setPreselectedBudgetId(budgetId);
    setEditingTransaction(null);
    setTxModalOpen(true);
  };

  // Transaction CRUD handlers
  const handleSaveTransaction = async (txData) => {
    if (editingTransaction) {
      await db.transactions.update(editingTransaction.id, txData);
    } else {
      await db.transactions.add(txData);
    }
    setTxModalOpen(false);
    setEditingTransaction(null);
  };

  const handleDeleteTransaction = async (txId) => {
    if (window.confirm("Supprimer cette transaction ?")) {
      await db.transactions.delete(txId);
    }
  };

  const handleExportCSV = () => {
    if (!transactions || transactions.length === 0) {
      alert("Aucune transaction à exporter pour ce compte.");
      return;
    }

    const headers = ["Date", "Description", "Categorie", "Montant", "Type"];
    
    const rows = transactions.map(t => [
      t.date,
      `"${(t.name || t.description || '').replace(/"/g, '""')}"`,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      t.amount.toFixed(2),
      t.type
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    const safeAccountName = (activeAccount?.name || 'compte').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const todayStr = new Date().toISOString().split('T')[0];
    
    link.setAttribute("href", url);
    link.setAttribute("download", `export_transactions_${safeAccountName}_${todayStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Drag and Drop Parser
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCSVFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      processCSVFile(e.target.files[0]);
    }
  };

  const parseCSVDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.trim().split(/[./-]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) { // DD/MM/YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (parts[0].length === 4) { // YYYY-MM-DD
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    }
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    } catch (e) {}
    return dateStr;
  };

  const parseCSVAmount = (amountStr) => {
    if (!amountStr) return 0;
    let clean = amountStr.replace(/\s/g, '').replace(',', '.').replace('€', '').trim();
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  const processCSVFile = (file) => {
    setCsvError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      
      if (lines.length < 2) {
        setCsvError("Le fichier CSV est vide ou ne contient pas assez de données.");
        return;
      }

      let delimiter = ',';
      if (lines[0].includes(';')) delimiter = ';';
      else if (lines[0].includes('\t')) delimiter = '\t';

      const rows = lines.map(line => line.split(delimiter).map(cell => cell.trim().replace(/^["']|["']$/g, '')));
      
      const headers = rows[0].map(h => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      
      let dateCol = headers.findIndex(h => h.includes('date') || h.includes('valeur'));
      let descCol = headers.findIndex(h => h.includes('description') || h.includes('libelle') || h.includes('communication') || h.includes('motif') || h.includes('details') || h.includes('nom'));
      let amountCol = headers.findIndex(h => h.includes('montant') || h.includes('somme') || h.includes('valeur') || h.includes('amount'));

      if (dateCol === -1 || amountCol === -1) {
        const testRow = rows[1];
        if (testRow) {
          testRow.forEach((cell, idx) => {
            if (dateCol === -1 && (cell.includes('/') || cell.includes('-')) && cell.length >= 8) {
              dateCol = idx;
            } else if (amountCol === -1 && !isNaN(parseFloat(cell.replace(',', '.')))) {
              amountCol = idx;
            } else if (descCol === -1 && cell.length > 3 && isNaN(parseFloat(cell))) {
              descCol = idx;
            }
          });
        }
      }

      if (dateCol === -1 || amountCol === -1) {
        setCsvError("Impossible de détecter automatiquement les colonnes de Date ou de Montant.");
        return;
      }

      const parsedTransactions = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length <= Math.max(dateCol, amountCol, descCol)) continue;

        const rawDate = row[dateCol];
        const rawDesc = descCol !== -1 ? row[descCol] : 'Transaction Importée';
        const rawAmount = row[amountCol];

        const date = parseCSVDate(rawDate);
        const amount = parseCSVAmount(rawAmount);

        if (date && amount !== 0) {
          const isIncome = amount > 0;
          parsedTransactions.push({
            date,
            name: rawDesc || 'Transaction sans nom',
            description: rawDesc || 'Transaction sans nom',
            amount: Math.abs(amount),
            type: isIncome ? 'credit' : 'debit',
            category: 'Import CSV',
            categoryId: null,
            budgetId: null,
            executionType: 'spontaneous',
            isRecurring: false,
            recurrencePeriod: 'none',
            recurrenceEnd: ''
          });
        }
      }

      if (parsedTransactions.length === 0) {
        setCsvError("Aucune transaction valide n'a pu être lue dans le fichier.");
      } else {
        setCsvPreviewTxs(parsedTransactions);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmCSVImport = async () => {
    if (!csvPreviewTxs || !selectedAccountId) return;
    
    const preparedTxs = csvPreviewTxs.map(tx => ({
      ...tx,
      accountId: selectedAccountId
    }));

    await db.transactions.bulkAdd(preparedTxs);
    setCsvPreviewTxs(null);
    alert(`${preparedTxs.length} transactions importées avec succès !`);
  };

  return (
    <div className="space-y-8 select-none">
      {/* 1. Detail View of Account */}
      {selectedAccountId && activeAccount ? (
        <div className="space-y-8 animate-fade-in">
          {/* Header & Account info banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSelectedAccountId(null)}
                className="bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 text-ac-brown" />
              </button>
              <div>
                <h2 className="text-2xl font-black text-ac-brown flex items-center gap-2">
                  {activeAccount.name}
                  <AvatarStackPopover
                    allowedUsers={activeAccount.allowedUsers || []}
                    userRoles={activeAccount.userRoles || {}}
                    ownerId={activeAccount.creatorId || activeAccount.ownerId}
                    docId={activeAccount.id}
                    collectionName="accounts"
                    size="md"
                  />
                  {activeAccount.bankName && (
                    <span className="text-xs font-black text-ac-brown-light bg-ac-cream px-2 py-0.5 rounded-md border border-ac-brown/15">
                      {activeAccount.bankName}
                    </span>
                  )}
                </h2>
                <div className="flex flex-wrap gap-2 items-center text-xs font-bold text-ac-brown-light mt-1">
                  <span className="bg-ac-gold-light border border-ac-gold/30 text-ac-gold-dark px-2.5 py-0.5 rounded-full font-black uppercase text-[9px]">
                    {activeAccount.sharedWithNames && activeAccount.sharedWithNames.length > 0 
                      ? `Partagé avec ${activeAccount.sharedWithNames.join(', ')}` 
                      : activeAccount.type}
                  </span>
                  {activeAccount.rate > 0 && (
                    <span className="bg-ac-green-light border border-ac-green/20 text-ac-green px-2.5 py-0.5 rounded-full">
                      Taux: {activeAccount.rate}%
                    </span>
                  )}
                  {activeAccount.rib && (
                    <span className="bg-ac-cream-dark/40 px-2.5 py-0.5 rounded-full border border-ac-brown/10 font-mono text-[10px]">
                      RIB: {activeAccount.rib}
                    </span>
                  )}
                </div>
                {activeAccount.description && (
                  <p className="text-[11px] font-semibold text-ac-brown-light mt-2 italic">
                    "{activeAccount.description}"
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-left md:text-right bg-ac-cream-dark/20 border-2 border-ac-brown rounded-2xl px-6 py-2.5 min-w-[200px]">
                <span className="text-[9px] font-black text-ac-brown-light uppercase block">Solde Réel Principal</span>
                <span className="text-2xl font-black text-ac-brown">
                  {activeAccount.balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                </span>
              </div>
              
              {activeAccount.balance !== activeAccount.visibleBalance && (
                <div className="text-left md:text-right bg-ac-gold-light/45 border-2 border-ac-gold rounded-2xl px-6 py-2.5 min-w-[200px] animate-bounce-in">
                  <span className="text-[9px] font-black text-ac-gold-dark uppercase block flex items-center justify-end gap-1">
                    Solde Disponible <Sparkles className="w-3 h-3 fill-ac-gold" />
                  </span>
                  <span className="text-2xl font-black text-ac-gold-dark">
                    {activeAccount.visibleBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Booklet interests calculation simulator */}
          {activeAccountInterests && (
            <div className="bg-ac-sky-light/40 border-3 border-ac-brown rounded-3xl p-5 shadow-ac-sm flex items-center justify-between gap-4 animate-bounce-in">
              <div className="space-y-1">
                <h4 className="font-black text-xs text-ac-brown flex items-center gap-1.5 uppercase">
                  <Landmark className="w-4 h-4 text-ac-sky" /> Simulation des Intérêts (Calcul par Quinzaine)
                </h4>
                <p className="text-[10px] font-semibold text-ac-brown-light">
                  Simulation selon les modalités annuelles standard françaises appliquées sur ce livret.
                </p>
              </div>

              <div className="flex gap-4">
                <div className="bg-white border-2 border-ac-brown rounded-xl px-4 py-2 text-center shadow-ac-sm">
                  <span className="text-[8px] font-black text-ac-brown-light uppercase block">Capitalisés (Années antérieures)</span>
                  <span className="text-sm font-black text-ac-brown">
                    +{activeAccountInterests.capitalized.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                  </span>
                </div>

                <div className="bg-white border-2 border-ac-brown rounded-xl px-4 py-2 text-center shadow-ac-sm">
                  <span className="text-[8px] font-black text-ac-sky uppercase block">Courus (Année en cours)</span>
                  <span className="text-sm font-black text-ac-sky">
                    +{activeAccountInterests.accrued.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Account Edit/Delete Controls */}
          <div className="flex gap-3">
            {myRole !== 'viewer' && (
              <button
                onClick={() => handleEditAccount(activeAccount)}
                className="bg-white hover:bg-ac-cream text-ac-brown font-extrabold text-xs px-4 py-2.5 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center gap-1.5 transition-transform active:translate-y-[1px] cursor-pointer"
              >
                <Edit className="w-4 h-4" /> Modifier le Compte
              </button>
            )}
            {(myRole === 'owner' || activeAccount.ownerId === user?.uid) ? (
              <button
                onClick={() => handleDeleteAccount(activeAccount.id)}
                className="bg-ac-red-light hover:bg-ac-red/10 text-ac-red font-extrabold text-xs px-4 py-2.5 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center gap-1.5 transition-transform active:translate-y-[1px] cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Supprimer le Compte
              </button>
            ) : (
              <button
                onClick={() => handleLeaveAccount(activeAccount)}
                className="bg-ac-red/10 hover:bg-ac-red/20 text-ac-red font-extrabold text-xs px-4 py-2.5 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center gap-1.5 transition-transform active:translate-y-[1px] cursor-pointer"
                title="Quitter ce compte partagé"
              >
                <X className="w-4 h-4" /> Quitter le compte
              </button>
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
              <div className="flex flex-wrap gap-3 self-start sm:self-auto">
                <button
                  onClick={handleExportCSV}
                  className="bg-white hover:bg-ac-cream text-ac-brown font-extrabold text-sm px-4 py-3 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center justify-center gap-1.5 hover:translate-y-[1px] cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Exporter en CSV
                </button>
                {myRole !== 'viewer' && (
                  <button
                    onClick={() => {
                      setEditingTransaction(null);
                      setTxModalOpen(true);
                    }}
                    className="bg-ac-green text-white font-extrabold text-sm px-4 py-3 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center justify-center gap-1.5 hover:translate-y-[1px] cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Nouvelle Transaction
                  </button>
                )}
              </div>
            </div>

            {/* CSV Synchro zone */}
            {myRole !== 'viewer' && (
              <div className="mb-6">
                <h4 className="text-xs font-black uppercase text-ac-brown-light mb-2 flex items-center gap-1">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Importation relevé bancaire (CSV)
                </h4>
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-3 border-dashed rounded-2xl p-6 text-center transition-colors flex flex-col items-center justify-center cursor-pointer select-none ${
                    isDragActive 
                      ? 'border-ac-green bg-ac-green-light/40' 
                      : 'border-ac-brown/20 bg-ac-cream/20 hover:bg-ac-cream/40'
                  }`}
                >
                  <Upload className="w-8 h-8 text-ac-brown-light mb-2" />
                  <p className="text-xs font-bold text-ac-brown">
                    Dépose ton fichier CSV bancaire ici ou <label className="text-ac-green underline cursor-pointer">recherche un fichier<input type="file" accept=".csv" className="hidden" onChange={handleFileInput} /></label>
                  </p>
                  <p className="text-[10px] text-ac-brown-light mt-1">
                    Les colonnes Date, Description et Montant seront détectées automatiquement.
                  </p>
                </div>

                {csvError && (
                  <div className="mt-2 text-xs font-bold text-ac-red bg-ac-red-light px-3 py-2 rounded-xl border border-ac-red/25 flex items-center gap-2">
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
                      {csvPreviewTxs.slice(0, 10).map((tx, idx) => (
                        <div key={idx} className="p-3 text-xs flex justify-between items-center">
                          <div>
                            <p className="font-extrabold text-ac-brown">{tx.name}</p>
                            <span className="text-[10px] font-bold text-ac-brown-light">{new Date(tx.date).toLocaleDateString('fr-FR')}</span>
                          </div>
                          <span className={`font-black ${tx.type === 'credit' ? 'text-ac-green' : 'text-ac-brown'}`}>
                            {tx.type === 'credit' ? '+' : '-'}{tx.amount.toFixed(2)} 🔔
                          </span>
                        </div>
                      ))}
                      {csvPreviewTxs.length > 10 && (
                        <div className="p-2 text-center text-[10px] font-bold text-ac-brown-light italic">
                          Et {csvPreviewTxs.length - 10} autres transactions...
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button 
                        onClick={() => setCsvPreviewTxs(null)}
                        className="bg-white hover:bg-ac-cream border border-ac-brown text-ac-brown font-extrabold text-xs px-3 py-1.5 rounded-xl cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button 
                        onClick={handleConfirmCSVImport}
                        className="bg-ac-green text-white font-extrabold text-xs px-3 py-1.5 rounded-xl border border-ac-brown shadow-ac-sm flex items-center gap-1.5 hover:translate-y-[1px] cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" /> Importer
                      </button>
                    </div>
                  </div>
                )}
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
                        <th className="pb-3 pt-2">Catégorie</th>
                        <th className="pb-3 pt-2">Exécution</th>
                        <th className="pb-3 pt-2 text-right">Montant</th>
                        <th className="pb-3 pt-2 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ac-cream-dark">
                      {transactions.map((tx) => {
                        const isIncome = tx.type === 'credit';
                        return (
                          <tr key={tx.id} className="hover:bg-ac-cream-light/35 transition-colors group">
                            <td className="py-3.5 pl-2 text-xs font-bold text-ac-brown-light">
                              {new Date(tx.date).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="py-3.5 font-extrabold text-sm text-ac-brown">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {tx.name || tx.description}
                                {tx.isRecurring && (
                                  <span className="text-[9px] font-black bg-ac-gold-light border border-ac-gold/20 text-ac-gold-dark px-1.5 py-0.2 rounded" title="Transaction récurrente">
                                    ♻️ {tx.recurrencePeriod === 'weekly' ? 'Hebdo' : 'Mensuel'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5">
                              {tx.category ? (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-ac-green-light text-ac-green border border-ac-green/10">
                                  {tx.category}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-ac-cream-dark/50 text-ac-brown-light">
                                  Aucun
                                </span>
                              )}
                            </td>
                            <td className="py-3.5">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${
                                tx.executionType === 'planned' ? 'bg-ac-sky-light border-ac-sky/20 text-ac-sky' :
                                tx.executionType === 'past' ? 'bg-ac-cream-dark/55 border-ac-brown/15 text-ac-brown-light' :
                                'bg-ac-green-light border-ac-green/20 text-ac-green'
                              }`}>
                                {tx.executionType === 'planned' ? 'À prévoir' :
                                 tx.executionType === 'past' ? 'Passée' : 'Spontanée'}
                              </span>
                            </td>
                            <td className="py-3.5 text-right font-black text-sm">
                              <span className={isIncome ? 'text-ac-green' : 'text-ac-brown'}>
                                {isIncome ? '+' : '-'}{tx.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
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
                    return (
                      <div key={tx.id} className="bg-ac-cream/20 border-2 border-ac-brown rounded-2xl p-4 flex flex-col gap-2 relative">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-black text-ac-brown-light">
                              {new Date(tx.date).toLocaleDateString('fr-FR')}
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
                            {isIncome ? '+' : '-'}{tx.amount.toLocaleString('fr-FR')} 🔔
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 items-center mt-1">
                          {tx.category ? (
                            <span className="text-[9px] font-black px-2 py-0.5 rounded bg-ac-green-light text-ac-green border border-ac-green/10">
                              {tx.category}
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-ac-cream-dark/55 text-ac-brown-light">
                              Aucun
                            </span>
                          )}
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${
                            tx.executionType === 'planned' ? 'bg-ac-sky-light border-ac-sky/20 text-ac-sky' :
                            tx.executionType === 'past' ? 'bg-ac-cream-dark/55 border-ac-brown/15 text-ac-brown-light' :
                            'bg-ac-green-light border-ac-green/20 text-ac-green'
                          }`}>
                            {tx.executionType === 'planned' ? 'À prévoir' :
                             tx.executionType === 'past' ? 'Passée' : 'Spontanée'}
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
            <div className="flex gap-3">
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
          ) : accounts.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-3xl border-3 border-ac-brown text-ac-brown-light">
              <p className="font-extrabold mb-4">Tu n'as pas encore créé de compte ou de livret.</p>
              <p className="text-xs">Commence par créer ton compte courant principal en cliquant sur "Nouveau Compte" ci-dessus !</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedAccounts.map((acc, index) => {
                const isDragging = draggableAccountId === acc.id;
                const isPopoverOpen = openPopoverAccountId === acc.id;
                return (
                  <div 
                    key={acc.id}
                    draggable={isDragging}
                    onDragStart={(e) => handleAccountDragStart(e, index)}
                    onDragOver={handleAccountDragOver}
                    onDrop={(e) => handleAccountDrop(e, index)}
                    onDragEnd={handleAccountDragEnd}
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={`ac-card bg-[#FFFDF9] border-ac-brown p-5 cursor-pointer relative group overflow-visible flex flex-col justify-between transition-all ${
                      isPopoverOpen ? 'z-30' : 'z-0'
                    } ${
                      isDragging ? 'ring-3 ring-ac-green ring-offset-2 scale-[1.01] border-dashed opacity-75' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-extrabold text-sm text-ac-brown leading-tight flex items-center gap-1.5 flex-wrap">
                          {acc.name}
                          <span className="text-[8px] font-black uppercase tracking-wider bg-ac-cream-dark/50 border border-ac-brown/10 text-ac-brown-light px-2 py-0.5 rounded-full">
                            {acc.sharedWithNames && acc.sharedWithNames.length > 0 
                              ? `Partagé avec ${acc.sharedWithNames.join(', ')}` 
                              : acc.type}
                          </span>
                        </h4>
                        {acc.bankName && (
                          <span className="text-[9px] font-bold text-ac-brown-light/80 block mt-1">
                            🏦 {acc.bankName}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-1.5 shrink-0 items-center">
                        <div onClick={(e) => e.stopPropagation()}>
                          <AvatarStackPopover
                            allowedUsers={acc.allowedUsers || []}
                            userRoles={acc.userRoles || {}}
                            ownerId={acc.creatorId || acc.ownerId}
                            docId={acc.id}
                            collectionName="accounts"
                            size="sm"
                            onOpenChange={(open) => setOpenPopoverAccountId(open ? acc.id : null)}
                          />
                        </div>
                        <div 
                          onMouseDown={(e) => { e.stopPropagation(); handleStartLongPress(acc.id); }}
                          onTouchStart={(e) => { e.stopPropagation(); handleStartLongPress(acc.id); }}
                          onMouseUp={(e) => { e.stopPropagation(); handleCancelLongPress(); }}
                          onTouchEnd={(e) => { e.stopPropagation(); handleCancelLongPress(); }}
                          onMouseLeave={(e) => { e.stopPropagation(); handleCancelLongPress(); }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-9 h-9 bg-ac-cream rounded-full border border-ac-brown/20 flex items-center justify-center group-hover:bg-ac-gold/10 transition-colors cursor-grab active:cursor-grabbing"
                          title="Glisser-déposer (clic long sur la tirelire)"
                        >
                          <PiggyBank className="w-5 h-5 text-ac-gold" />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-ac-brown/10 flex justify-between items-baseline">
                      <span className="text-[10px] font-black uppercase tracking-wide text-ac-brown-light/60">Solde Disponible</span>
                      <span className="font-black text-base text-ac-brown">
                        {acc.visibleBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Transfer Dialog Modal */}
      {transferModalOpen && (
        <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4 z-50 animate-fade-in text-ac-brown">
          <div className="bg-[#FFFDF9] border-t-4 border-x-4 md:border-4 border-ac-brown rounded-t-3xl md:rounded-3xl p-6 max-w-md w-full shadow-ac-lg relative animate-slide-up md:animate-bounce-in pb-safe-bottom">
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
                      {acc.name} ({acc.visibleBalance.toLocaleString('fr-FR')} 🔔 dispo)
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
                      {acc.name} ({acc.visibleBalance.toLocaleString('fr-FR')} 🔔 dispo)
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Nom du compte *</label>
                  <input
                    type="text"
                    value={accName}
                    onChange={(e) => setAccName(e.target.value)}
                    placeholder="Ex: Livret A, Poche principale"
                    className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Type de Compte</label>
                  <select
                    value={accType}
                    onChange={(e) => setAccType(e.target.value)}
                    className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white cursor-pointer"
                  >
                    <option value="Courant">Courant (Dépenses courantes)</option>
                    <option value="Livret A">Livret A (Épargne)</option>
                    <option value="LDDS">LDDS (Épargne)</option>
                    <option value="LEP">LEP (Épargne pop.)</option>
                    <option value="Autre Livret">Autre Livret d'épargne</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Banque / Établissement</label>
                  <input
                    type="text"
                    value={accBankName}
                    onChange={(e) => setAccBankName(e.target.value)}
                    placeholder="Ex: Nook Banque, Caisse d'Épargne"
                    className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Numéro de Compte / RIB</label>
                  <input
                    type="text"
                    value={accRib}
                    onChange={(e) => setAccRib(e.target.value)}
                    placeholder="Ex: FR76 3000..."
                    className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Solde Initial *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={accInitial}
                      onChange={(e) => setAccInitial(e.target.value)}
                      placeholder="0.00"
                      className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl pl-7 pr-3 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                      disabled={!!editingAccount}
                      required
                    />
                    <span className="absolute left-2.5 top-3.5 text-xs font-black">🔔</span>
                  </div>
                  {editingAccount && <p className="text-[9px] text-ac-brown-light/60 mt-1">Le solde initial ne peut pas être modifié après création.</p>}
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Taux d'intérêt annuel (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={accRate}
                    onChange={(e) => setAccRate(e.target.value)}
                    placeholder="0.00"
                    disabled={accType === 'Courant'}
                    className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white disabled:opacity-40"
                  />
                </div>
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

              {(!editingAccount || editingAccount.ownerId === user?.uid || editingAccount.creatorId === user?.uid) && (
                <InlineShareSelector
                  allowedUsers={sharedFriendUids}
                  userRoles={formUserRoles}
                  onChange={(newAllowed, newUserRoles) => {
                    setSharedFriendUids(newAllowed);
                    setFormUserRoles(newUserRoles);
                  }}
                  ownerId={editingAccount?.ownerId || user?.uid}
                />
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


    </div>
  );
}
